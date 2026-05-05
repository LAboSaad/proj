import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";

import type { LandmarkStatus, LivenessChallenge } from "../types/kyc";

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

export type LivenessPhase =
  | "detecting"
  | "ready"
  | "challenging"
  | "timeout"
  | "done";

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
  const intervalRef = useRef<number | null>(null);
  const challengeTimerRef = useRef<number | null>(null);
  const pitchWindow = useRef<number[]>([]);

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<LivenessPhase>("detecting");
  const phaseRef = useRef<LivenessPhase>("detecting");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── Challenges ─────────────────────────────────────────────────────────────
  const [challengeSequence, setChallengeSequence] = useState<
    LivenessChallenge[]
  >(() => buildChallengeSequence(challengeCount));
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [completedSet, setCompletedSet] = useState<Set<LivenessChallenge>>(
    new Set(),
  );

  const challengeSequenceRef = useRef(challengeSequence);
  const challengeIndexRef = useRef(challengeIndex);
  useEffect(() => {
    challengeSequenceRef.current = challengeSequence;
  }, [challengeSequence]);
  useEffect(() => {
    challengeIndexRef.current = challengeIndex;
  }, [challengeIndex]);

  // ── Per-challenge timer countdown ──────────────────────────────────────────
  const [challengeTimeLeft, setChallengeTimeLeft] = useState<number>(
    CHALLENGE_TIMEOUT_MS / 1000,
  );

  // ── Landmark status ────────────────────────────────────────────────────────
  const [landmarkStatus, setLandmarkStatus] = useState<LandmarkStatus>({
    faceDetected: false,
    yawEstimate: 0,
    qualityOk: false,
    hint: "Center your face inside the frame.",
    faceBox: null,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const livenessChallenge: LivenessChallenge =
    challengeSequence[challengeIndex] ??
    challengeSequence[challengeSequence.length - 1];

  const livenessDone = phase === "done";

  const livenessCompleted = useMemo(() => {
    return Object.fromEntries(
      challengeSequence.map((id) => [id, completedSet.has(id)]),
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

  // ── Start per-challenge countdown timer ────────────────────────────────────
  const startChallengeTimer = useCallback(
    (forIndex: number) => {
      clearChallengeTimer();
      let remaining = CHALLENGE_TIMEOUT_MS / 1000;
      setChallengeTimeLeft(remaining);

      challengeTimerRef.current = window.setInterval(() => {
        remaining -= 1;
        setChallengeTimeLeft(remaining);
        if (remaining <= 0) {
          const challenge = challengeSequenceRef.current[forIndex];
          advanceChallengeRef.current(false, forIndex, challenge);
        }
      }, 1000);
    },
    [clearChallengeTimer],
  );

  // ── Advance to next challenge ──────────────────────────────────────────────
  const advanceChallenge = useCallback(
    (
      passed: boolean,
      currentIndex: number,
      currentChallenge: LivenessChallenge,
    ) => {
      clearChallengeTimer();
      pitchWindow.current = [];

      if (passed) {
        setCompletedSet((prev) => {
          const next = new Set(prev);
          next.add(currentChallenge);
          return next;
        });

        const seq = challengeSequenceRef.current;
        const nextIndex = currentIndex + 1;

        if (nextIndex >= seq.length) {
          setChallengeIndex(seq.length - 1);
          // ── FIX 1: Reset yaw to 0 when transitioning to done so the
          // side-capture phase starts from a clean baseline, not the
          // yaw value left over from the last challenge frame.
          setLandmarkStatus((prev) => ({
            ...prev,
            yawEstimate: 0,
          }));
          setPhase("done");
          phaseRef.current = "done";
        } else {
          setChallengeIndex(nextIndex);
          setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
          startChallengeTimer(nextIndex);
        }
      } else {
        setPhase("timeout");
        phaseRef.current = "timeout";
      }
    },
    [clearChallengeTimer, startChallengeTimer],
  );

  const advanceChallengeRef = useRef(advanceChallenge);
  useEffect(() => {
    advanceChallengeRef.current = advanceChallenge;
  }, [advanceChallenge]);

  // ── "Are you ready?" ──────────────────────────────────────────────────────
  const startChallenges = useCallback(() => {
    setChallengeIndex(0);
    challengeIndexRef.current = 0;
    setCompletedSet(new Set());
    setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
    setPhase("challenging");
    phaseRef.current = "challenging";
    startChallengeTimer(0);
  }, [startChallengeTimer]);

  // ── Retry after timeout ───────────────────────────────────────────────────
  const retryChallenge = useCallback(() => {
    clearChallengeTimer();
    pitchWindow.current = [];

    const freshSequence = buildChallengeSequence(challengeCount);
    setChallengeSequence(freshSequence);
    challengeSequenceRef.current = freshSequence;

    setChallengeIndex(0);
    challengeIndexRef.current = 0;
    setCompletedSet(new Set());
    setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
    setLandmarkStatus({
      faceDetected: false,
      yawEstimate: 0,
      qualityOk: false,
      hint: "Center your face inside the frame.",
      faceBox: null,
    });
    setPhase("detecting");
    phaseRef.current = "detecting";
  }, [clearChallengeTimer, challengeCount]);

  // ── "done" phase: lightweight face tracking to keep yaw live ─────────────
  // FIX 2: After liveness completes, run a stripped-down detection loop that
  // only updates yawEstimate + faceBox so the side-capture phase in useSelfie
  // can react to head turns. No challenge logic runs here.
  const analyzeForSideCapture = useCallback(async (): Promise<void> => {
    if (!modelsLoaded) return;
    const video = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!video) return;

    try {
      await waitForVideoReady(video);
      const detections = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.35,
          }),
        )
        .withFaceLandmarks();

      if (!detections || detections.length !== 1) {
        setLandmarkStatus((prev) => ({
          ...prev,
          faceDetected: false,
          faceBox: null,
          yawEstimate: 0,
        }));
        return;
      }

      const detection = detections[0];
      const yaw = computeYawFromLandmarks(detection.landmarks);
      const qualityOk = computeFaceQuality(detection);
      const rawBox = detection.detection.box;

      setLandmarkStatus({
        faceDetected: true,
        yawEstimate: Number(yaw.toFixed(4)),
        qualityOk,
        hint: "Turn your head to the right for the side photo.",
        faceBox: {
          x: rawBox.x,
          y: rawBox.y,
          width: rawBox.width,
          height: rawBox.height,
        },
      });
    } catch {
      // silent — non-critical tracking
    }
  }, [modelsLoaded, webcamRef]);

  // ── Main analysis loop ────────────────────────────────────────────────────
  const analyzeLiveFace = useCallback(async (): Promise<void> => {
    if (!modelsLoaded) return;

    const video = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!video) return;

    const currentPhase = phaseRef.current;

    // ── DETECTING / READY ──────────────────────────────────────────────────
    if (currentPhase === "detecting" || currentPhase === "ready") {
      try {
        await waitForVideoReady(video);
        const detections = await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.4,
            }),
          )
          .withFaceLandmarks();

        if (detections?.length > 1) {
          setLandmarkStatus((prev) => ({
            ...prev,
            faceDetected: false,
            faceBox: null,
            hint: "Only one person should be in frame.",
          }));
          if (currentPhase === "ready") {
            setPhase("detecting");
            phaseRef.current = "detecting";
          }
          return;
        }

        const rawDetected = detections?.length === 1;
        const rawBox = rawDetected ? detections[0].detection.box : null;
        const faceBox = rawBox
          ? { x: rawBox.x, y: rawBox.y, width: rawBox.width, height: rawBox.height }
          : null;

        // Check that the face is genuinely inside the guide oval.
        // We test the four cardinal extremes of the RAW face box (no padding)
        // against the guide oval equation. Using the raw box avoids the problem
        // of the padded head ellipse being larger than the guide oval even when
        // the face looks perfectly centered.
        // Threshold 1.15 gives a comfortable tolerance — the face corners are
        // allowed to sit slightly outside the mathematical oval edge, which is
        // necessary because face-api boxes are conservative and often clip the
        // actual face boundary.
        const faceInOval = (() => {
          if (!rawBox || !video.videoWidth || !video.videoHeight) return false;
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // Guide oval in pixel space — mirrors FaceOvalOverlay SVG constants
          const ovalCX = 0.50 * vw;
          const ovalCY = 0.48 * vh;
          const ovalRX = 0.22 * vw;
          const ovalRY = 0.31 * vh;

          // Four cardinal points of the raw face box
          const faceCX = rawBox.x + rawBox.width / 2;
          const faceCY = rawBox.y + rawBox.height / 2;
          const points = [
            [faceCX,                  rawBox.y],                        // top
            [faceCX,                  rawBox.y + rawBox.height],        // bottom
            [rawBox.x,                faceCY],                          // left
            [rawBox.x + rawBox.width, faceCY],                          // right
            [faceCX,                  faceCY],                          // centre
          ];

          const THRESHOLD = 1.15;
          for (const [px, py] of points) {
            const dx = (px - ovalCX) / ovalRX;
            const dy = (py - ovalCY) / ovalRY;
            if (dx * dx + dy * dy > THRESHOLD) return false;
          }
          return true;
        })();

        const faceDetected = rawDetected && faceInOval;

        const hint = !rawDetected
          ? "Center your face inside the frame."
          : !faceInOval
            ? "Move your face into the oval guide."
            : "Face detected! Click 'I'm Ready' to begin.";

        setLandmarkStatus((prev) => ({
          ...prev,
          faceDetected,
          // Always show the box so the overlay can draw it, even when out of oval
          faceBox,
          hint,
        }));

        // Step back to detecting if face drifts out of oval while in ready state
        if (currentPhase === "ready" && !faceDetected) {
          setPhase("detecting");
          phaseRef.current = "detecting";
        }

        if (faceDetected && currentPhase === "detecting") {
          setPhase("ready");
          phaseRef.current = "ready";
        }
      } catch (err) {
        console.error("Face detection error:", err);
      }
      return;
    }

    // ── CHALLENGING ────────────────────────────────────────────────────────
    if (currentPhase !== "challenging") return;

    const currentIndex = challengeIndexRef.current;
    const currentSequence = challengeSequenceRef.current;
    const currentChallenge: LivenessChallenge =
      currentSequence[currentIndex] ??
      currentSequence[currentSequence.length - 1];

    const needsPose = POSE_CHALLENGES.has(currentChallenge);
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
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.3,
          }),
        )
        .withFaceLandmarks();

      if (!detections || detections.length === 0) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate: 0,
          qualityOk: false,
          hint: "No face detected. Move closer or improve lighting.",
          faceBox: null,
        });
        return;
      }

      if (detections.length > 1) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate: 0,
          qualityOk: false,
          hint: "Only one person should be in frame.",
          faceBox: null,
        });
        return;
      }

      const detection = detections[0];
      const yaw = computeYawFromLandmarks(detection.landmarks);
      const qualityOk = computeFaceQuality(detection);
      const gestureFrame = areGestureModelsLoaded()
        ? detectGestures(video)
        : null;

      const rawBox = detection.detection.box;
      const faceBox = {
        x: rawBox.x,
        y: rawBox.y,
        width: rawBox.width,
        height: rawBox.height,
      };

      const config = CHALLENGE_CONFIGS[currentChallenge];
      let hint = config.instruction;
      let passed = false;

      switch (currentChallenge) {
        case "center":
          if (Math.abs(yaw) < 0.08 && qualityOk) {
            passed = true;
            hint = "✓ Face centered!";
          } else {
            hint =
              Math.abs(yaw) < 0.08
                ? "Hold steady, checking quality…"
                : "Face the camera directly.";
          }
          break;

        case "lookLeft":
          if (yaw > 0.12 && qualityOk) {
            passed = true;
            hint = "✓ Good!";
          }
          break;

        case "lookRight":
          if (yaw < -0.12 && qualityOk) {
            passed = true;
            hint = "✓ Good!";
          }
          break;

        case "moveCloser": {
          const ratio = computeFaceSizeRatio(
            detection,
            video.videoWidth || 720,
          );
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
        advanceChallengeRef.current(true, currentIndex, currentChallenge);
      }

      setLandmarkStatus({
        faceDetected: true,
        yawEstimate: Number(yaw.toFixed(4)),
        qualityOk,
        hint,
        faceBox,
      });
    } catch (err) {
      console.error("Face detection error:", err);
    }
  }, [modelsLoaded, webcamRef, detectNod]);

  // ── Detection interval ────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !modelsLoaded) return;

    intervalRef.current = window.setInterval(() => {
      const p = phaseRef.current;
      // FIX 2 (interval side): when done, run lightweight yaw tracking
      // instead of stopping entirely.
      if (p === "done") {
        void analyzeForSideCapture();
        return;
      }
      // timeout: truly stop
      if (p === "timeout") return;
      void analyzeLiveFace();
    }, 650);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, modelsLoaded, analyzeLiveFace, analyzeForSideCapture]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearChallengeTimer();
    };
  }, [clearChallengeTimer]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetLiveness = useCallback(() => {
    clearChallengeTimer();
    const freshSequence = buildChallengeSequence(challengeCount);
    setChallengeSequence(freshSequence);
    challengeSequenceRef.current = freshSequence;
    setChallengeIndex(0);
    challengeIndexRef.current = 0;
    setCompletedSet(new Set());
    setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
    setPhase("detecting");
    phaseRef.current = "detecting";
    pitchWindow.current = [];
    setLandmarkStatus({
      faceDetected: false,
      yawEstimate: 0,
      qualityOk: false,
      hint: "Center your face inside the frame.",
      faceBox: null,
    });
  }, [clearChallengeTimer, challengeCount]);

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
    retryChallenge,
    resetLiveness,
  };
}