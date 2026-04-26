// src/hooks/useFaceLiveness.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";

import type { LandmarkStatus } from "../types/kyc";
import type { LivenessChallenge } from "../lib/constants/kyc.constants";

import {
  computeFaceQuality,
  computeYawFromLandmarks,
  computeFaceSizeRatio,
} from "../lib/services/face.service";
import { waitForVideoReady } from "../lib/services/video.service";
import { buildChallengeSequence, CHALLENGE_CONFIGS } from "../lib/challenges";
import {
  areGestureModelsLoaded,
  computePitchFromPose,
  detectGestures,
  isRaisingLeftHand,
  isRaisingRightHand,
} from "../lib/services/gesture.service";

type UseFaceLivenessProps = {
  webcamRef: React.RefObject<Webcam | null>;
  modelsLoaded: boolean;
  active: boolean;
  challengeCount?: number;
};

const NOD_WINDOW = 8;
const NOD_DELTA_THRESHOLD = 0.06;

// Minimum face width ratio to pass moveCloser (35% of frame width)
const CLOSE_ENOUGH_RATIO = 0.35;

// Challenges that need MediaPipe pose
const POSE_CHALLENGES = new Set<LivenessChallenge>([
  "raiseLeftHand",
  "raiseRightHand",
  "nodHead",
]);

export function useFaceLiveness({
  webcamRef,
  modelsLoaded,
  active,
  challengeCount = 4,
}: UseFaceLivenessProps) {
  const intervalRef = useRef<number | null>(null);

  const [challengeSequence] = useState<LivenessChallenge[]>(() =>
    buildChallengeSequence(challengeCount)
  );

  const [challengeIndex, setChallengeIndex] = useState(0);
  const [completedSet, setCompletedSet] = useState<Set<LivenessChallenge>>(new Set());

  const [landmarkStatus, setLandmarkStatus] = useState<LandmarkStatus>({
    faceDetected: false,
    yawEstimate: 0,
    qualityOk: false,
    hint: "Center your face inside the frame.",
  });

  // Nod detection
  const pitchWindow = useRef<number[]>([]);

 
  // ── Derived ────────────────────────────────────────────────────────────────

  const livenessChallenge: LivenessChallenge =
    challengeSequence[challengeIndex] ?? "center";

  const livenessDone = completedSet.size >= challengeSequence.length;

  const livenessCompleted = useMemo(() => {
    return Object.fromEntries(
      challengeSequence.map((id) => [id, completedSet.has(id)])
    ) as Record<LivenessChallenge, boolean>;
  }, [challengeSequence, completedSet]);

  // ── Nod helper ─────────────────────────────────────────────────────────────

  const detectNod = useCallback((currentPitch: number): boolean => {
    pitchWindow.current.push(currentPitch);
    if (pitchWindow.current.length > NOD_WINDOW) pitchWindow.current.shift();
    if (pitchWindow.current.length < NOD_WINDOW) return false;
    const min = Math.min(...pitchWindow.current);
    const max = Math.max(...pitchWindow.current);
    return max - min > NOD_DELTA_THRESHOLD;
  }, []);


  // ── Advance challenge ──────────────────────────────────────────────────────

  const completeCurrentChallenge = useCallback(() => {
    setCompletedSet((prev) => {
      const next = new Set(prev);
      next.add(livenessChallenge);
      return next;
    });
    setChallengeIndex((i) => Math.min(i + 1, challengeSequence.length - 1));
    // Reset per-challenge state
    pitchWindow.current = [];

  }, [livenessChallenge, challengeSequence.length]);

  // ── Main analysis loop ─────────────────────────────────────────────────────

  const analyzeLiveFace = useCallback(async (): Promise<void> => {
    if (!modelsLoaded) return;
    if (livenessDone) return;

    const video = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!video) return;

    // If pose challenge and MediaPipe not ready yet, wait gracefully
    const needsPose = POSE_CHALLENGES.has(livenessChallenge);
    if (needsPose && !areGestureModelsLoaded()) {
      setLandmarkStatus((prev) => ({
        ...prev,
        hint: "Almost ready… preparing gesture detection.",
      }));
      return;
    }

    try {
      await waitForVideoReady(video);

      const detections = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 })
        )
        .withFaceLandmarks();

      if (!detections || detections.length === 0) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate: 0,
          qualityOk: false,
          hint: "No face detected. Move closer or improve lighting.",
        });
        return;
      }

      if (detections.length > 1) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate: 0,
          qualityOk: false,
          hint: "Only one person should be in frame.",
        });
        return;
      }

      const detection = detections[0];
      const yaw = computeYawFromLandmarks(detection.landmarks);
      const qualityOk = computeFaceQuality(detection);
      const gestureFrame = areGestureModelsLoaded() ? detectGestures(video) : null;

      const config = CHALLENGE_CONFIGS[livenessChallenge];
      let hint = config.instruction;
      let passed = false;

      switch (livenessChallenge) {

        // ── Face-only ──────────────────────────────────────────────────────

        case "center":
          if (Math.abs(yaw) < 0.08 && qualityOk) {
            passed = true;
            hint = "✓ Face centered!";
          } else {
            hint = Math.abs(yaw) < 0.08
              ? "Hold steady, checking quality…"
              : "Face the camera directly.";
          }
          break;

        case "lookLeft":
          if (yaw > 0.12 && qualityOk) { passed = true; hint = "✓ Good!"; }
          break;

        case "lookRight":
          if (yaw < -0.12 && qualityOk) { passed = true; hint = "✓ Good!"; }
          break;

        // ── Move closer (face size ratio) ──────────────────────────────────

        case "moveCloser": {
          const ratio = computeFaceSizeRatio(detection, video.videoWidth || 720);
          if (ratio >= CLOSE_ENOUGH_RATIO) {
            passed = true;
            hint = "✓ Close enough!";
          } else {
            const pct = Math.round(ratio * 100);
            hint = `Move closer — face is ${pct}% of frame, need ${Math.round(CLOSE_ENOUGH_RATIO * 100)}%+`;
          }
          break;
        }


        // ── Pose (MediaPipe) ───────────────────────────────────────────────

        case "raiseLeftHand":
          if (gestureFrame && isRaisingLeftHand(gestureFrame.pose)) {
            passed = true;
            hint = "✓ Left hand raised!";
          }
          break;

        case "raiseRightHand":
          if (gestureFrame && isRaisingRightHand(gestureFrame.pose)) {
            passed = true;
            hint = "✓ Right hand raised!";
          }
          break;

        case "nodHead": {
          if (gestureFrame) {
            const pitch = computePitchFromPose(gestureFrame.pose);
            if (pitch !== null && detectNod(pitch)) {
              passed = true;
              hint = "✓ Head nod detected!";
            }
          }
          break;
        }
      }

      if (passed) completeCurrentChallenge();

      setLandmarkStatus({
        faceDetected: true,
        yawEstimate: Number(yaw.toFixed(4)),
        qualityOk,
        hint,
      });
    } catch (err) {
      console.error("Face detection error:", err);
    }
  }, [
    modelsLoaded,
    webcamRef,
    livenessChallenge,
    livenessDone,
    detectNod,
    completeCurrentChallenge,
  ]);

  // ── Interval ───────────────────────────────────────────────────────────────

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

  // ── Reset ──────────────────────────────────────────────────────────────────

  const resetLiveness = useCallback(() => {
    setChallengeIndex(0);
    setCompletedSet(new Set());
    pitchWindow.current = [];
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
    challengeSequence,
    challengeIndex,
    resetLiveness,
  };
}