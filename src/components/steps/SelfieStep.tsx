import Webcam from "react-webcam";
import type { LivenessChallenge } from "../../lib/constants/kyc.constants";
import { CHALLENGE_CONFIGS } from "../../lib/challenges";
import type { LivenessPhase } from "../../hooks/useFaceLiveness";
import type { FaceBox } from "../../types/kyc";

// ─── FaceOvalOverlay ──────────────────────────────────────────────────────────
//
// Renders as an absolutely-positioned SVG that sits directly on top of the
// <Webcam> element. It draws:
//   1. A guide oval (where the user SHOULD place their face).
//   2. An optional live oval (scaled from the detected faceBox) that pulses
//      when the face is in position.
//
// Colour states:
//   gray   — no face detected yet
//   amber  — face detected but not positioned correctly
//   cyan   — face detected & quality OK (ready / challenging & qualityOk)
//   green  — all challenges done
//
// The video stream is 720×540 (from videoConstraints). The detected bounding
// box from face-api is in those same pixel coordinates. We map it to SVG
// percentage coordinates using the known video dimensions so the overlay
// stays correct regardless of how the CSS scales the <video> element.
//

const VIDEO_W = 720;
const VIDEO_H = 540;

// Guide oval target — centred, occupying a comfortable face-sized region
const GUIDE_CX = 50; // % of width
const GUIDE_CY = 48; // % of height  (slightly above centre looks natural)
const GUIDE_RX = 22; // % of width
const GUIDE_RY = 31; // % of height

type OvalState = "none" | "detected" | "good" | "done";

function FaceOvalOverlay({
  faceBox,
  faceDetected,
  qualityOk,
  phase,
}: {
  faceBox: FaceBox | null;
  faceDetected: boolean;
  qualityOk: boolean;
  phase: LivenessPhase;
}) {
  let state: OvalState = "none";
  if (phase === "done") state = "done";
  else if (faceDetected && qualityOk) state = "good";
  else if (faceDetected) state = "detected";

  const strokeColor =
    state === "done"
      ? "#34d399" // green
      : state === "good"
        ? "#22d3ee" // cyan
        : state === "detected"
          ? "#fbbf24" // amber
          : "#64748b"; // slate-500

  const glowColor =
    state === "done"
      ? "rgba(52,211,153,0.18)"
      : state === "good"
        ? "rgba(34,211,238,0.15)"
        : state === "detected"
          ? "rgba(251,191,36,0.12)"
          : "transparent";

  // Map the detected faceBox (in video pixels) to SVG % coords.
  // face-api box represents the face only; we expand it slightly so the oval
  // wraps around the whole head including forehead and chin.
  let liveCX: number | null = null;
  let liveCY: number | null = null;
  let liveRX: number | null = null;
  let liveRY: number | null = null;

  if (faceBox) {
    // Expand box by 40% horizontally and 55% vertically to cover full head
    const padX = faceBox.width * 0.2;
    const padYTop = faceBox.height * 0.45; // more headroom above
    const padYBot = faceBox.height * 0.1;

    const expandedX = faceBox.x - padX;
    const expandedY = faceBox.y - padYTop;
    const expandedW = faceBox.width + padX * 2;
    const expandedH = faceBox.height + padYTop + padYBot;

    // Center in % of video dimensions
    liveCX = ((expandedX + expandedW / 2) / VIDEO_W) * 100;
    liveCY = ((expandedY + expandedH / 2) / VIDEO_H) * 100;
    liveRX = (expandedW / 2 / VIDEO_W) * 100;
    liveRY = (expandedH / 2 / VIDEO_H) * 100;
  }

  const isPulsing = state === "good" || state === "done";
  const animClass = isPulsing ? "oval-pulse" : "";

  return (
    <svg
      // Fill the parent container (the webcam wrapper div)
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "visible",
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes ovalPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        @keyframes ovalAppear {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        .oval-pulse {
          animation: ovalPulse 1.8s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .oval-appear {
          animation: ovalAppear 0.35s ease-out both;
          transform-origin: center;
          transform-box: fill-box;
        }
      `}</style>

      {/* ── Dark vignette outside the guide oval ────────────────────────── */}
      {/* We clip a full rect with the oval cut out to darken the surroundings */}
      <defs>
        <mask id="ovalMask">
          {/* White = show (outside oval) */}
          <rect x="0" y="0" width="100" height="100" fill="white" />
          {/* Black = hide (inside oval — punches the hole) */}
          <ellipse
            cx={GUIDE_CX}
            cy={GUIDE_CY}
            rx={GUIDE_RX}
            ry={GUIDE_RY}
            fill="black"
          />
        </mask>
      </defs>

      {/* Darkened surround — more opaque when no face, lighter when detected */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="rgba(0,0,0,0.45)"
        mask="url(#ovalMask)"
        style={{ transition: "opacity 0.4s" }}
        opacity={state === "none" ? 1 : 0.6}
      />

      {/* ── Inner glow fill of the oval ─────────────────────────────────── */}
      <ellipse
        cx={GUIDE_CX}
        cy={GUIDE_CY}
        rx={GUIDE_RX}
        ry={GUIDE_RY}
        fill={glowColor}
        style={{ transition: "fill 0.4s" }}
      />

      {/* ── Guide oval border ────────────────────────────────────────────── */}
      <ellipse
        cx={GUIDE_CX}
        cy={GUIDE_CY}
        rx={GUIDE_RX}
        ry={GUIDE_RY}
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.6"
        strokeDasharray={state === "none" ? "2 1.2" : "none"}
        className={animClass}
        style={{ transition: "stroke 0.4s, stroke-dasharray 0.4s" }}
      />

      {/* ── Corner tick marks on the guide oval ─────────────────────────── */}
      {/* Top */}
      <line
        x1={GUIDE_CX}
        y1={GUIDE_CY - GUIDE_RY - 1.5}
        x2={GUIDE_CX}
        y2={GUIDE_CY - GUIDE_RY + 2.5}
        stroke={strokeColor}
        strokeWidth="0.7"
        strokeLinecap="round"
        style={{ transition: "stroke 0.4s" }}
      />
      {/* Bottom */}
      <line
        x1={GUIDE_CX}
        y1={GUIDE_CY + GUIDE_RY - 2.5}
        x2={GUIDE_CX}
        y2={GUIDE_CY + GUIDE_RY + 1.5}
        stroke={strokeColor}
        strokeWidth="0.7"
        strokeLinecap="round"
        style={{ transition: "stroke 0.4s" }}
      />
      {/* Left */}
      <line
        x1={GUIDE_CX - GUIDE_RX - 1.5}
        y1={GUIDE_CY}
        x2={GUIDE_CX - GUIDE_RX + 2.5}
        y2={GUIDE_CY}
        stroke={strokeColor}
        strokeWidth="0.7"
        strokeLinecap="round"
        style={{ transition: "stroke 0.4s" }}
      />
      {/* Right */}
      <line
        x1={GUIDE_CX + GUIDE_RX - 2.5}
        y1={GUIDE_CY}
        x2={GUIDE_CX + GUIDE_RX + 1.5}
        y2={GUIDE_CY}
        stroke={strokeColor}
        strokeWidth="0.7"
        strokeLinecap="round"
        style={{ transition: "stroke 0.4s" }}
      />

    
      {/* ── Proximity label ─────────────────────────────────────────────── */}
      {/* Shows "Move closer" / "Move back" / "Good" below the oval.        */}
      {faceDetected && liveCX !== null && liveRX !== null && (
        <text
          x={GUIDE_CX}
          y={GUIDE_CY + GUIDE_RY + 5.5}
          textAnchor="middle"
          fontSize="3.2"
          fill={strokeColor}
          fontFamily="system-ui, sans-serif"
          fontWeight="500"
          opacity="0.9"
          style={{ transition: "fill 0.4s" }}
        >
          {liveRX < GUIDE_RX * 0.72
            ? "Move closer"
            : liveRX > GUIDE_RX * 1.18
              ? "Move back"
              : null}
        </text>
      )}
    </svg>
  );
}

// ─── SelfieStep ───────────────────────────────────────────────────────────────

export default function SelfieStep({
  selfieWebcamRef,
  videoConstraints,
  landmarkStatus,
  livenessCompleted,
  livenessDone,
  captureSelfie,
  prevStep,
  selfieImage,
  faceSidePhoto,
  captureFaceSidePhoto,
  livenessChallenge,
  challengeSequence,
  challengeIndex,
  challengeTimeLeft,
  phase,
  startChallenges,
  retryChallenge,
}: {
  selfieWebcamRef: React.RefObject<any>;
  videoConstraints: object;
  landmarkStatus: {
    faceDetected: boolean;
    qualityOk: boolean;
    yawEstimate: number;
    hint: string;
    faceBox: FaceBox | null; // ← NEW
  };
  livenessCompleted: Record<LivenessChallenge, boolean>;
  livenessDone: boolean;
  captureSelfie: () => Promise<void>;
  prevStep: () => void;
  selfieImage: string;
  faceSidePhoto: string;
  captureFaceSidePhoto: () => Promise<void>;
  livenessChallenge: LivenessChallenge;
  challengeSequence: LivenessChallenge[];
  challengeIndex: number;
  challengeTimeLeft: number;
  phase: LivenessPhase;
  startChallenges: () => void;
  retryChallenge: () => void;
}) {
  const currentConfig = CHALLENGE_CONFIGS[livenessChallenge];

  const timerPercent = Math.max(0, (challengeTimeLeft / 5) * 100);
  const timerColor =
    challengeTimeLeft > 3
      ? "#34d399"
      : challengeTimeLeft > 1
        ? "#fbbf24"
        : "#f87171";

  const RADIUS = 20;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = (timerPercent / 100) * CIRC;

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Selfie &amp; Liveness Check
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {phase === "detecting" &&
              "Position your face in the frame to begin."}
            {phase === "ready" &&
              "Face detected! Ready to start the challenge."}
            {phase === "challenging" &&
              `Challenge ${challengeIndex + 1} of ${challengeSequence.length}`}
            {phase === "timeout" && "Challenge timed out."}
            {phase === "done" &&
              "All challenges complete. Capture your selfie!"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-400 uppercase tracking-widest">
          {phase === "done"
            ? "✓ Liveness verified"
            : `Step ${challengeIndex + 1} / ${challengeSequence.length}`}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        {/* ── Webcam + overlays ──────────────────────────────────────────── */}
        {/*
          IMPORTANT: position:relative on this wrapper is what makes the
          FaceOvalOverlay (position:absolute, inset:0) line up perfectly
          over the video element.
        */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-black">
          <Webcam
            ref={selfieWebcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
          />

          {/* ── Oval face guide — always rendered on top of video ── */}
          <FaceOvalOverlay
            faceBox={landmarkStatus.faceBox}
            faceDetected={landmarkStatus.faceDetected}
            qualityOk={landmarkStatus.qualityOk}
            phase={phase}
          />

          {/* DETECTING */}
          {phase === "detecting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-end bg-transparent pb-6 gap-3 pointer-events-none">
              <div className="flex items-center gap-2 bg-black/60 rounded-2xl px-4 py-2">
                <div className="w-3 h-3 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin" />
                <p className="text-slate-300 text-xs">Detecting your face…</p>
              </div>
            </div>
          )}

          {/* READY */}
          {phase === "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-end bg-transparent pb-6 gap-3">
              <div className="bg-black/75 backdrop-blur rounded-2xl px-6 py-4 flex flex-col items-center gap-3 mx-4 text-center">
                <p className="text-base font-semibold text-white">
                  Face Detected!
                </p>
                <p className="text-slate-300 text-xs max-w-xs">
                  You'll be given{" "}
                  <strong className="text-cyan-300">
                    {challengeSequence.length} quick challenges
                  </strong>
                  . Each one has{" "}
                  <strong className="text-cyan-300">5 seconds</strong>. Ready?
                </p>
                <button
                  onClick={startChallenges}
                  className="rounded-2xl bg-cyan-500 px-6 py-2 font-semibold text-slate-950 hover:bg-cyan-400 transition-colors text-sm"
                >
                  I'm Ready →
                </button>
              </div>
            </div>
          )}

          {/* CHALLENGING */}
          {phase === "challenging" && (
            <div className="absolute top-0 left-0 right-0 flex items-center gap-3 bg-black/75 backdrop-blur px-4 py-3">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                className="shrink-0 -rotate-90"
              >
                <circle
                  cx="24"
                  cy="24"
                  r={RADIUS}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r={RADIUS}
                  fill="none"
                  stroke={timerColor}
                  strokeWidth="4"
                  strokeDasharray={`${dash} ${CIRC}`}
                  strokeLinecap="round"
                  style={{
                    transition: "stroke-dasharray 0.9s linear, stroke 0.3s",
                  }}
                />
                <text
                  x="24"
                  y="24"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                  style={{
                    transform: "rotate(90deg)",
                    transformOrigin: "24px 24px",
                  }}
                >
                  {challengeTimeLeft}s
                </text>
              </svg>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
                  Challenge {challengeIndex + 1} of {challengeSequence.length}
                </div>
                <div className="text-base font-semibold text-white truncate">
                  {currentConfig.icon} {currentConfig.label}
                </div>
              </div>
            </div>
          )}

          {/* TIMEOUT */}
          {phase === "timeout" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-5 px-6 text-center">
              <div className="text-5xl animate-bounce">⏰</div>
              <p className="text-2xl font-semibold text-white">Time's Up!</p>
              <p className="text-slate-300 text-sm max-w-xs">
                You didn't complete the challenge in time. Let's try again from
                the beginning.
              </p>
              <button
                onClick={retryChallenge}
                className="mt-2 rounded-2xl bg-amber-500 px-8 py-3 font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                Retry Challenges →
              </button>
            </div>
          )}

          {/* DONE */}
          {phase === "done" && (
            <div className="absolute top-3 left-3 right-3 flex items-center gap-2 rounded-2xl bg-emerald-900/80 border border-emerald-700 px-4 py-2 text-sm text-emerald-200">
              <span className="text-lg">✓</span>
              <span>
                All challenges passed! You may now capture your selfie.
              </span>
            </div>
          )}
        </div>
       
        {/* Right panel */}
        <div className="space-y-4">
          {/* Live guidance */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              Live guidance
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  landmarkStatus.faceDetected
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                }`}
              />
              <span
                className={
                  landmarkStatus.faceDetected
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              >
                {landmarkStatus.faceDetected
                  ? "Face detected"
                  : "No face detected"}
              </span>
            </div>
            <div className="rounded-xl bg-slate-900 p-3 text-slate-200 text-sm leading-snug">
              {landmarkStatus.hint}
            </div>
          </div>

          {/* Challenge progress */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">
              Challenge progress
            </div>
            <div className="space-y-2">
              {challengeSequence.map((id, i) => {
                const cfg = CHALLENGE_CONFIGS[id];
                const done = livenessCompleted[id];
                const isCurrent =
                  phase === "challenging" && i === challengeIndex;
                const isFuture =
                  phase !== "done" && i > challengeIndex && !done;

                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300 ${
                      done
                        ? "bg-emerald-950/60 border border-emerald-800/50"
                        : isCurrent
                          ? "bg-cyan-950 border border-cyan-700"
                          : "bg-slate-900 opacity-50"
                    }`}
                  >
                    <span className="text-lg">
                      {isFuture ? "🔒" : cfg.icon}
                    </span>
                    <span
                      className={
                        done
                          ? "text-emerald-300"
                          : isCurrent
                            ? "text-cyan-200 font-medium"
                            : "text-slate-500"
                      }
                    >
                      {isFuture ? "Locked" : cfg.label}
                    </span>
                    <span className="ml-auto text-base">
                      {done ? (
                        "✓"
                      ) : isCurrent ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      ) : (
                        "○"
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
         <div className="flex gap-5">
          {/* Captured selfie preview */}
          {selfieImage && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                Captured selfie
              </div>
              <img
                src={selfieImage}
                alt="Selfie"
                className="rounded-2xl w-full"
              />
            </div>
          )}

          {/* Face side photo preview */}
          {faceSidePhoto && (
            <div className="rounded-2xl border border-violet-900/50 bg-slate-950 p-3">
              <div className="mb-2 text-xs uppercase tracking-wide text-violet-400">
                Face side photo
              </div>
              <img
                src={faceSidePhoto}
                alt="Face side"
                className="rounded-2xl w-full"
              />
            </div>
          )}
        </div>
      </div>
      

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={prevStep}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Back
        </button>

        <button
          onClick={() => void captureSelfie()}
          disabled={!livenessDone}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-cyan-400 transition-colors"
        >
          {livenessDone
            ? "Capture selfie & continue →"
            : "Complete all challenges first"}
        </button>

        {selfieImage && (
          <button
            onClick={() => void captureFaceSidePhoto()}
            className="rounded-2xl bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-500 transition-colors"
          >
            {faceSidePhoto
              ? "↺ Retake side photo"
              : "Capture face side photo →"}
          </button>
        )}
      </div>
    </section>
  );
}
