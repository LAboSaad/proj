// src/hooks/useFaceLiveness.ts

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

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const CHALLENGE_TIMEOUT_MS  = 5_000;
const DETECTION_INTERVAL_MS = 650;

// ── Nod detection tuning ──────────────────────────────────────────────────────
// Window of 5 frames at 650 ms = ~3.25 s of history — tight enough to capture
// a deliberate nod without accumulating stale drift from before the user moves.
const NOD_WINDOW = 5;

// MediaPipe pose landmarks use normalised coordinates (0–1).
// nose.y - shoulderMidY is typically 0.30–0.45 at rest.
// A deliberate nod shifts it by ~0.025–0.04. 0.028 is the minimum
// that filters out natural head sway while catching real nods.
const NOD_PITCH_THRESHOLD = 0.028;

// A valid nod must cross the midpoint in BOTH directions within the window
// (down then up, or up then down). This prevents random drift from passing.
// We split the window into two halves and require the peak to be in the
// first half and the trough in the second (or vice-versa).
const NOD_DIRECTION_SPLITS = 2;

// ── Move-closer tuning ────────────────────────────────────────────────────────
// We measure movement relative to the baseline captured when the challenge
// starts — not an absolute threshold. The user must move CLOSER_DELTA closer
// than their starting position. This prevents passing without moving.
const CLOSER_DELTA = 0.08;  // must grow face width by 8% of video width

// Absolute floor — face must be at least this wide even after moving.
// Prevents edge cases where a very-far baseline + delta still looks tiny.
const CLOSER_MIN_RATIO = 0.28;

const INITIAL_LANDMARK_STATUS: LandmarkStatus = {
  faceDetected: false,
  yawEstimate:  0,
  qualityOk:    false,
  hint:         "Center your face inside the frame.",
  faceBox:      null,
};

const POSE_CHALLENGES = new Set<LivenessChallenge>([
  "raiseLeftHand",
  "raiseRightHand",
  "nodHead",
]);

// ── Shared detection options ──────────────────────────────────────────────────
// Defined once at module level — avoids allocating new option objects on
// every detection call inside the 650 ms interval.

const TINY_OPTIONS_FAST = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.35,
});

const TINY_OPTIONS_DETECT = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.4,
});

const TINY_OPTIONS_CHALLENGE = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.3,
});

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFaceLiveness({
  webcamRef,
  modelsLoaded,
  active,
  challengeCount = 3,
}: UseFaceLivenessProps) {
  const intervalRef        = useRef<number | null>(null);
  const challengeTimerRef  = useRef<number | null>(null);
  const pitchWindow             = useRef<number[]>([]);
  // Captures the face-width ratio at the moment moveCloser challenge starts.
  // null = baseline not yet taken for this challenge instance.
  const moveCloserBaselineRef   = useRef<number | null>(null);

  // ── Phase ──────────────────────────────────────────────────────────────────
  const [phase, setPhaseState] = useState<LivenessPhase>("detecting");
  // phaseRef lets interval callbacks read the current phase without a
  // stale closure — intervals capture `phase` at creation time.
  const phaseRef = useRef<LivenessPhase>("detecting");

  const setPhase = useCallback((next: LivenessPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  // ── Challenges ─────────────────────────────────────────────────────────────
  const [challengeSequence, setChallengeSequence] = useState<LivenessChallenge[]>(
    () => buildChallengeSequence(challengeCount),
  );
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [completedSet,   setCompletedSet]   = useState<Set<LivenessChallenge>>(new Set());

  // Refs mirror state so interval callbacks always see the latest values
  const challengeSequenceRef = useRef(challengeSequence);
  const challengeIndexRef    = useRef(challengeIndex);

  useEffect(() => { challengeSequenceRef.current = challengeSequence; }, [challengeSequence]);
  useEffect(() => { challengeIndexRef.current    = challengeIndex;    }, [challengeIndex]);

  // ── Challenge timer countdown ──────────────────────────────────────────────
  const [challengeTimeLeft, setChallengeTimeLeft] = useState(
    CHALLENGE_TIMEOUT_MS / 1000,
  );

  // ── Landmark status ────────────────────────────────────────────────────────
  const [landmarkStatus, setLandmarkStatus] = useState<LandmarkStatus>(
    INITIAL_LANDMARK_STATUS,
  );

  // ── Derived ────────────────────────────────────────────────────────────────
  const livenessChallenge: LivenessChallenge =
    challengeSequence[challengeIndex] ??
    challengeSequence[challengeSequence.length - 1];

  const livenessDone = phase === "done";

  const livenessCompleted = useMemo(
    () =>
      Object.fromEntries(
        challengeSequence.map((id) => [id, completedSet.has(id)]),
      ) as Record<LivenessChallenge, boolean>,
    [challengeSequence, completedSet],
  );

  // ── Nod detection ──────────────────────────────────────────────────────────
  // Requires BOTH:
  //   1. Range > NOD_PITCH_THRESHOLD — enough movement to count
  //   2. Direction reversal — peak in first half, trough in second (or vice-versa)
  //      This rejects slow drift that happens to accumulate range over many frames.
  const detectNod = useCallback((currentPitch: number): boolean => {
    pitchWindow.current.push(currentPitch);
    if (pitchWindow.current.length > NOD_WINDOW) pitchWindow.current.shift();
    if (pitchWindow.current.length < NOD_WINDOW) return false;

    const w    = pitchWindow.current;
    const min  = Math.min(...w);
    const max  = Math.max(...w);

    // Condition 1: sufficient movement
    if (max - min <= NOD_PITCH_THRESHOLD) return false;

    // Condition 2: direction reversal within the window.
    // Split into two halves and check that the extremes swap sides.
    const mid       = Math.floor(w.length / NOD_DIRECTION_SPLITS);
    const firstHalf = w.slice(0, mid);
    const secondHalf= w.slice(mid);

    const firstMax  = Math.max(...firstHalf);
    const firstMin  = Math.min(...firstHalf);
    const secondMax = Math.max(...secondHalf);
    const secondMin = Math.min(...secondHalf);

    // Down-then-up: first half peaks high, second half dips low
    const downThenUp = firstMax > secondMax && firstMin > secondMin;
    // Up-then-down: first half dips low, second half peaks high
    const upThenDown = firstMin < secondMin && firstMax < secondMax;

    return downThenUp || upThenDown;
  }, []);

  // ── Timer helpers ──────────────────────────────────────────────────────────
  const clearChallengeTimer = useCallback(() => {
    if (challengeTimerRef.current) {
      window.clearInterval(challengeTimerRef.current);
      challengeTimerRef.current = null;
    }
  }, []);

  // ── Shared reset state ────────────────────────────────────────────────────
  // Used by both retryChallenge and resetLiveness to avoid duplication.
  const applyReset = useCallback(
    (freshSequence: LivenessChallenge[]) => {
      clearChallengeTimer();
      pitchWindow.current = [];
      moveCloserBaselineRef.current = null;

      setChallengeSequence(freshSequence);
      challengeSequenceRef.current = freshSequence;
      setChallengeIndex(0);
      challengeIndexRef.current = 0;
      setCompletedSet(new Set());
      setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
      setLandmarkStatus(INITIAL_LANDMARK_STATUS);
      setPhase("detecting");
    },
    [clearChallengeTimer, setPhase],
  );

  // ── Start per-challenge countdown ─────────────────────────────────────────
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
          // Use ref to avoid stale closure on advanceChallenge
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
      moveCloserBaselineRef.current = null;

      if (!passed) {
        setPhase("timeout");
        return;
      }

      setCompletedSet((prev) => {
        const next = new Set(prev);
        next.add(currentChallenge);
        return next;
      });

      const seq       = challengeSequenceRef.current;
      const nextIndex = currentIndex + 1;

      if (nextIndex >= seq.length) {
        setChallengeIndex(seq.length - 1);
        // Reset yaw to 0 so the side-capture phase starts from a clean
        // baseline, not the yaw value left over from the last challenge.
        setLandmarkStatus((prev) => ({ ...prev, yawEstimate: 0 }));
        setPhase("done");
      } else {
        setChallengeIndex(nextIndex);
        setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
        startChallengeTimer(nextIndex);
      }
    },
    [clearChallengeTimer, startChallengeTimer, setPhase],
  );

  // advanceChallengeRef breaks the stale-closure problem:
  // the countdown timer interval captures advanceChallenge at creation
  // time. Without the ref, it would call a stale version of the function.
  const advanceChallengeRef = useRef(advanceChallenge);
  useEffect(() => {
    advanceChallengeRef.current = advanceChallenge;
  }, [advanceChallenge]);

  // ── Start challenges ───────────────────────────────────────────────────────
  const startChallenges = useCallback(() => {
    setChallengeIndex(0);
    challengeIndexRef.current = 0;
    setCompletedSet(new Set());
    setChallengeTimeLeft(CHALLENGE_TIMEOUT_MS / 1000);
    setPhase("challenging");
    startChallengeTimer(0);
  }, [setPhase, startChallengeTimer]);

  // ── Retry after timeout ────────────────────────────────────────────────────
  const retryChallenge = useCallback(() => {
    applyReset(buildChallengeSequence(challengeCount));
  }, [applyReset, challengeCount]);

  // ── Side-capture yaw tracking (post-liveness) ──────────────────────────────
  // After liveness completes, runs a lightweight detection loop that only
  // updates yawEstimate + faceBox so useSelfie can react to head turns.
  // No challenge logic runs here.
  const analyzeForSideCapture = useCallback(async (): Promise<void> => {
    if (!modelsLoaded) return;
    const video = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!video) return;

    try {
      await waitForVideoReady(video);
      const detections = await faceapi
        .detectAllFaces(video, TINY_OPTIONS_FAST)
        .withFaceLandmarks();

      if (!detections || detections.length !== 1) {
        setLandmarkStatus((prev) => ({
          ...prev,
          faceDetected: false,
          faceBox:      null,
          yawEstimate:  0,
        }));
        return;
      }

      const detection = detections[0];
      const yaw        = computeYawFromLandmarks(detection.landmarks);
      const qualityOk  = computeFaceQuality(detection);
      const rawBox     = detection.detection.box;

      setLandmarkStatus({
        faceDetected: true,
        yawEstimate:  Number(yaw.toFixed(4)),
        qualityOk,
        hint:         "Turn your head to the right for the side photo.",
        faceBox:      { x: rawBox.x, y: rawBox.y, width: rawBox.width, height: rawBox.height },
      });
    } catch {
      // Non-critical tracking — silent failure is intentional
    }
  }, [modelsLoaded, webcamRef]);

  // ── Main analysis loop ─────────────────────────────────────────────────────
  const analyzeLiveFace = useCallback(async (): Promise<void> => {
    if (!modelsLoaded) return;
    const video = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!video) return;

    const currentPhase = phaseRef.current;

    // ── DETECTING / READY ────────────────────────────────────────────────
    if (currentPhase === "detecting" || currentPhase === "ready") {
      try {
        await waitForVideoReady(video);
        const detections = await faceapi
          .detectAllFaces(video, TINY_OPTIONS_DETECT)
          .withFaceLandmarks();

        if (detections?.length > 1) {
          setLandmarkStatus((prev) => ({
            ...prev,
            faceDetected: false,
            faceBox:      null,
            hint:         "Only one person should be in frame.",
          }));
          if (currentPhase === "ready") setPhase("detecting");
          return;
        }

        const rawDetected = detections?.length === 1;
        const rawBox      = rawDetected ? detections[0].detection.box : null;
        const faceBox     = rawBox
          ? { x: rawBox.x, y: rawBox.y, width: rawBox.width, height: rawBox.height }
          : null;

        // Check that face cardinal points lie within the guide oval.
        // THRESHOLD > 1 gives tolerance — face corners are allowed to
        // sit slightly outside the mathematical oval edge.
        const faceInOval = (() => {
          if (!rawBox || !video.videoWidth || !video.videoHeight) return false;
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          const ovalCX = 0.50 * vw;
          const ovalCY = 0.48 * vh;
          const ovalRX = 0.22 * vw;
          const ovalRY = 0.31 * vh;

          const faceCX = rawBox.x + rawBox.width  / 2;
          const faceCY = rawBox.y + rawBox.height / 2;

          const points: [number, number][] = [
            [faceCX,                  rawBox.y],
            [faceCX,                  rawBox.y + rawBox.height],
            [rawBox.x,                faceCY],
            [rawBox.x + rawBox.width, faceCY],
            [faceCX,                  faceCY],
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

        setLandmarkStatus((prev) => ({ ...prev, faceDetected, faceBox, hint }));

        if (currentPhase === "ready"    && !faceDetected) setPhase("detecting");
        if (currentPhase === "detecting" && faceDetected) setPhase("ready");
      } catch (err) {
        // Log detection errors — these are unexpected and should be surfaced
        console.error("[useFaceLiveness] detection error:", err);
      }
      return;
    }

    // ── CHALLENGING ──────────────────────────────────────────────────────
    if (currentPhase !== "challenging") return;

    const currentIndex     = challengeIndexRef.current;
    const currentSequence  = challengeSequenceRef.current;
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
        .detectAllFaces(video, TINY_OPTIONS_CHALLENGE)
        .withFaceLandmarks();

      if (!detections || detections.length === 0) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate:  0,
          qualityOk:    false,
          hint:         "No face detected. Move closer or improve lighting.",
          faceBox:      null,
        });
        return;
      }

      if (detections.length > 1) {
        setLandmarkStatus({
          faceDetected: false,
          yawEstimate:  0,
          qualityOk:    false,
          hint:         "Only one person should be in frame.",
          faceBox:      null,
        });
        return;
      }

      const detection    = detections[0];
      const yaw          = computeYawFromLandmarks(detection.landmarks);
      const qualityOk    = computeFaceQuality(detection);
      const gestureFrame = areGestureModelsLoaded() ? detectGestures(video) : null;
      const rawBox       = detection.detection.box;
      const faceBox      = { x: rawBox.x, y: rawBox.y, width: rawBox.width, height: rawBox.height };

      const config = CHALLENGE_CONFIGS[currentChallenge];
      let hint     = config.instruction;
      let passed   = false;

      switch (currentChallenge) {
        case "center":
          if (Math.abs(yaw) < 0.08 && qualityOk) {
            passed = true;
            hint   = "✓ Face centered!";
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

        case "moveCloser": {
          const ratio = computeFaceSizeRatio(detection, video.videoWidth || 720);

          // Capture baseline on the first frame of this challenge.
          // We intentionally do NOT reset this on a bad frame — if the face
          // briefly disappears, we keep the last known baseline so the user
          // doesn't have to restart their movement.
          if (moveCloserBaselineRef.current === null) {
            moveCloserBaselineRef.current = ratio;
          }

          const baseline  = moveCloserBaselineRef.current;
          const movedBy   = ratio - baseline;
          const pct       = Math.round(ratio * 100);
          const targetPct = Math.round((baseline + CLOSER_DELTA) * 100);

          if (movedBy >= CLOSER_DELTA && ratio >= CLOSER_MIN_RATIO) {
            passed = true;
            hint   = "✓ Close enough!";
          } else {
            hint = `Move closer — you are at ${pct}%, need ${targetPct}%`;
          }
          break;
        }

        case "raiseLeftHand":
          if (gestureFrame && isRaisingLeftHand(gestureFrame.pose)) {
            passed = true;
            hint   = "✓ Left hand raised!";
          }
          break;

        case "raiseRightHand":
          if (gestureFrame && isRaisingRightHand(gestureFrame.pose)) {
            passed = true;
            hint   = "✓ Right hand raised!";
          }
          break;

        case "nodHead":
          if (gestureFrame) {
            const pitch = computePitchFromPose(gestureFrame.pose);
            if (pitch !== null && detectNod(pitch)) {
              passed = true;
              hint   = "✓ Head nod detected!";
            }
          }
          break;
      }

      if (passed) advanceChallengeRef.current(true, currentIndex, currentChallenge);

      setLandmarkStatus({ faceDetected: true, yawEstimate: Number(yaw.toFixed(4)), qualityOk, hint, faceBox });
    } catch (err) {
      console.error("[useFaceLiveness] challenge detection error:", err);
    }
  }, [modelsLoaded, webcamRef, detectNod, setPhase]);

  // ── Detection interval ────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !modelsLoaded) return;

    intervalRef.current = window.setInterval(() => {
      const p = phaseRef.current;
      if (p === "done")    { void analyzeForSideCapture(); return; }
      if (p === "timeout") return; // fully stopped until retry
      void analyzeLiveFace();
    }, DETECTION_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, modelsLoaded, analyzeLiveFace, analyzeForSideCapture]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => clearChallengeTimer(), [clearChallengeTimer]);

  // ── Full reset (called from App handleReset) ───────────────────────────────
  const resetLiveness = useCallback(() => {
    applyReset(buildChallengeSequence(challengeCount));
  }, [applyReset, challengeCount]);

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