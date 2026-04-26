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

export type LivenessPhase = "detecting" | "ready" | "challenging" | "done";

type UseFaceLivenessProps = {
  webcamRef: React.RefObject<Webcam | null>;
  modelsLoaded: boolean;
  active: boolean;
  challengeCount?: number;
};

const NOD_WINDOW = 8;
const NOD_DELTA_THRESHOLD = 0.06;
const CLOSE_ENOUGH_RATIO = 0.35;
const CHALLENGE_TIMEOUT_MS = 5000;

const POSE_CHALLENGES = new Set<LivenessChallenge>([
  "raiseLeftHand",
  "raiseRightHand",
  "nodHead",
]);

export function useFaceLiveness({
  webcamRef,
  modelsLoaded,
  active,
  challengeCount = 3,
}: UseFaceLivenessProps) {
  const intervalRef       = useRef<number | null>(null);
  const challengeTimerRef = useRef<number | null>(null);
  const pitchWindow       = useRef<number[]>([]);

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<LivenessPhase>("detecting");

  // ── Challenges ─────────────────────────────────────────────────────────────
  const [challengeSequence] = useState<LivenessChallenge[]>(() =>
    buildChallengeSequence(challengeCount)
  );
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [completedSet, setCompletedSet]     = useState<Set<LivenessChallenge>>(new Set());

  // ── Per-challenge timer countdown (0-5) ────────────────────────────────────
  const [challengeTimeLeft, setChallengeTimeLeft] = useState<number>(CHALLENGE_TIMEOUT_MS / 1000);

  // ── Landmark status ────────────────────────────────────────────────────────
  const [landmarkStatus, setLandmarkStatus] = useState<LandmarkStatus>({
    faceDetected: false,
    yawEstimate: 0,
    qualityOk: false,
    hint: "Center your face inside the frame.",
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const livenessChallenge: LivenessChallenge =
    challengeSequence[challengeIndex] ?? challengeSequence[challengeSequence.length - 1];

  const livenessDone = phase === "done";

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

  // ── Clear challenge timer ──────────────────────────────────────────────────
  const clearChallengeTimer = useCallback(() => {
    if (challengeTimerRef.current) {
      window.clearInterval(challengeTimerRef.current);
      challengeTimerRef.current = null;
    }
  }, []);

  // ── Advance to next challenge ──────────────────────────────────────────────
  const advanceChallenge = useCallback(
    (passed: boolean, currentIndex: number, currentChallenge: LivenessChallenge) => {
      clearChallengeTimer();
      pitchWindow.current = [];

      if (passed) {
        setCompletedSet((prev) => {
          const next = new Set(prev);
          next.add(currentChallenge);
          return next;
        });
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= challengeSequence.length) {
        setChallengeIndex(challengeSequence.length - 1);
        setPhase("done");
      } else {
        setChallengeIndex(nextIndex);
        setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
        // Start the countdown for the next challenge
        startChallengeTimer(nextIndex);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [challengeSequence, clearChallengeTimer]
  );

  // ── Start per-challenge countdown timer ────────────────────────────────────
  // Stored in ref so advanceChallenge can be called inside without stale closure
  const advanceChallengeRef = useRef(advanceChallenge);
  useEffect(() => { advanceChallengeRef.current = advanceChallenge; }, [advanceChallenge]);

  const startChallengeTimer = useCallback((forIndex: number) => {
    clearChallengeTimer();
    let remaining = CHALLENGE_TIMEOUT_MS / 1000;
    setChallengeTimeLeft(remaining);

    challengeTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      setChallengeTimeLeft(remaining);
      if (remaining <= 0) {
        // Time's up — advance without marking as passed
        const challenge = challengeSequence[forIndex];
        advanceChallengeRef.current(false, forIndex, challenge);
      }
    }, 1000);
  }, [challengeSequence, clearChallengeTimer]);

  // ── "Are you ready?" — user clicks ready ──────────────────────────────────
  const startChallenges = useCallback(() => {
    setChallengeIndex(0);
    setCompletedSet(new Set());
    setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
    setPhase("challenging");
    startChallengeTimer(0);
  }, [startChallengeTimer]);

  // ── Main analysis loop ─────────────────────────────────────────────────────
  const analyzeLiveFace = useCallback(async (): Promise<void> => {
    if (!modelsLoaded) return;

    const video = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!video) return;

    // During "detecting" phase — just check for face presence
    if (phase === "detecting") {
      try {
        await waitForVideoReady(video);
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks();

        const faceDetected = detections?.length === 1;
        setLandmarkStatus((prev) => ({
          ...prev,
          faceDetected,
          hint: faceDetected
            ? "Face detected! Click 'I'm Ready' to begin."
            : "Center your face inside the frame.",
        }));

        if (faceDetected) {
          setPhase("ready");
        }
      } catch (err) {
        console.error("Face detection error:", err);
      }
      return;
    }

    // During "challenging" phase — run full liveness check
    if (phase !== "challenging") return;

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
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
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

      const detection    = detections[0];
      const yaw          = computeYawFromLandmarks(detection.landmarks);
      const qualityOk    = computeFaceQuality(detection);
      const gestureFrame = areGestureModelsLoaded() ? detectGestures(video) : null;

      const config = CHALLENGE_CONFIGS[livenessChallenge];
      let hint     = config.instruction;
      let passed   = false;

      switch (livenessChallenge) {
        case "center":
          if (Math.abs(yaw) < 0.08 && qualityOk) {
            passed = true;
            hint = "✓ Face centered!";
          } else {
            hint = Math.abs(yaw) < 0.08 ? "Hold steady, checking quality…" : "Face the camera directly.";
          }
          break;

        case "lookLeft":
          if (yaw > 0.12 && qualityOk) { passed = true; hint = "✓ Good!"; }
          break;

        case "lookRight":
          if (yaw < -0.12 && qualityOk) { passed = true; hint = "✓ Good!"; }
          break;

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

      if (passed) {
        advanceChallenge(true, challengeIndex, livenessChallenge);
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
  }, [
    modelsLoaded,
    webcamRef,
    phase,
    livenessChallenge,
    challengeIndex,
    detectNod,
    advanceChallenge,
  ]);

  // ── Detection interval ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !modelsLoaded) return;
    if (phase === "done") return;

    intervalRef.current = window.setInterval(() => {
      void analyzeLiveFace();
    }, 650);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, modelsLoaded, analyzeLiveFace, phase]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearChallengeTimer();
    };
  }, [clearChallengeTimer]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetLiveness = useCallback(() => {
    clearChallengeTimer();
    setChallengeIndex(0);
    setCompletedSet(new Set());
    setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
    setPhase("detecting");
    pitchWindow.current = [];
    setLandmarkStatus({
      faceDetected: false,
      yawEstimate: 0,
      qualityOk: false,
      hint: "Center your face inside the frame.",
    });
  }, [clearChallengeTimer]);

  return {
    phase,
    landmarkStatus,
    livenessCompleted,
    livenessChallenge,
    livenessDone,
    challengeSequence,
    challengeIndex,
    challengeTimeLeft,
    startChallenges,
    resetLiveness,
  };
}