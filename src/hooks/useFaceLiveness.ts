import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";

import type { LandmarkStatus, LivenessChallenge } from "../types/kyc";

import { computeFaceQuality, computeYawFromLandmarks } from "../lib/services/face.service";
import { waitForVideoReady } from "../lib/services/video.service";

type UseFaceLivenessProps = {
  webcamRef: React.RefObject<Webcam | null>;
  modelsLoaded: boolean;
  active: boolean;
};

export function useFaceLiveness({
  webcamRef,
  modelsLoaded,
  active,
}: UseFaceLivenessProps) {
  const intervalRef = useRef<number | null>(null);

  const [livenessChallenge, setLivenessChallenge] =
    useState<LivenessChallenge>("center");

  const [livenessCompleted, setLivenessCompleted] =
    useState<Record<LivenessChallenge, boolean>>({
      center: false,
      lookLeft: false,
      lookRight: false,
    });

  const [landmarkStatus, setLandmarkStatus] = useState<LandmarkStatus>({
    faceDetected: false,
    yawEstimate: 0,
    qualityOk: false,
    hint: "Center your face inside the frame.",
  });

  const livenessDone = useMemo(
    () => Object.values(livenessCompleted).every(Boolean),
    [livenessCompleted]
  );

  // =========================================================
  // 🔍 FACE ANALYSIS
  // =========================================================
  const analyzeLiveFace = useCallback(async (): Promise<void> => {
    if (!modelsLoaded) return;

    const video = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!video) return;

    try {
      await waitForVideoReady(video);

      const detections = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.3,
          })
        )
        .withFaceLandmarks();

      // ❌ NO FACE
      if (!detections || detections.length === 0) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate: 0,
          qualityOk: false,
          hint: "No face detected. Move closer, improve lighting, or face the camera.",
        });
        return;
      }

      // ❌ MULTIPLE FACES
      if (detections.length > 1) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate: 0,
          qualityOk: false,
          hint: "Only one person should be in the frame.",
        });
        return;
      }

      // ✅ ONE FACE
      const detection = detections[0];

      const yaw = computeYawFromLandmarks(detection.landmarks);
      const qualityOk = computeFaceQuality(detection);

      let hint = "Hold steady.";

      if (livenessChallenge === "center") {
        hint =
          Math.abs(yaw) < 0.08
            ? "Good. Keep centered."
            : "Face the camera directly.";

        if (Math.abs(yaw) < 0.08 && qualityOk) {
          setLivenessCompleted((prev) => ({ ...prev, center: true }));
          setLivenessChallenge("lookLeft");
        }
      } else if (livenessChallenge === "lookLeft") {
        hint = "Turn your head slightly to your left.";

        if (yaw > 0.12 && qualityOk) {
          setLivenessCompleted((prev) => ({ ...prev, lookLeft: true }));
          setLivenessChallenge("lookRight");
        }
      } else {
        hint = "Turn your head slightly to your right.";

        if (yaw < -0.12 && qualityOk) {
          setLivenessCompleted((prev) => ({ ...prev, lookRight: true }));
        }
      }

      setLandmarkStatus({
        faceDetected: true,
        yawEstimate: Number(yaw.toFixed(4)),
        qualityOk,
        hint,
      });
    } catch (err) {
      console.error("Face detection error:", err);
    }
  }, [modelsLoaded, webcamRef, livenessChallenge]);

  // =========================================================
  // ⏱ INTERVAL CONTROL
  // =========================================================
  useEffect(() => {
    if (!active || !modelsLoaded) return;

    intervalRef.current = window.setInterval(() => {
      void analyzeLiveFace();
    }, 650);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, modelsLoaded, analyzeLiveFace]);

  // =========================================================
  // 🔄 RESET (important for reuse)
  // =========================================================
  const resetLiveness = useCallback(() => {
    setLivenessChallenge("center");
    setLivenessCompleted({
      center: false,
      lookLeft: false,
      lookRight: false,
    });
    setLandmarkStatus({
      faceDetected: false,
      yawEstimate: 0,
      qualityOk: false,
      hint: "Center your face inside the frame.",
    });
  }, []);

  return {
    landmarkStatus,
    livenessCompleted,
    livenessChallenge,
    livenessDone,
    resetLiveness,
  };
}