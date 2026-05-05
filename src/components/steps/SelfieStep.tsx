import Webcam from "react-webcam";
import { CHALLENGE_CONFIGS } from "../../lib/challenges";
import type { LivenessPhase } from "../../hooks/useFaceLiveness";
import type { CaptureStatus } from "../../hooks/useSelfie";
import type { FaceBox, LivenessChallenge } from "../../types/kyc";

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_W = 720;
const VIDEO_H = 540;
const GUIDE_CX = 50;
const GUIDE_CY = 48;
const GUIDE_RX = 22;
const GUIDE_RY = 31;

// ─── FaceOvalOverlay ──────────────────────────────────────────────────────────

type OvalState = "none" | "detected" | "good" | "done" | "capturing";

function FaceOvalOverlay({
  faceBox,
  faceDetected,
  qualityOk,
  phase,
  capturePhase,
  countdown,
}: {
  faceBox: FaceBox | null;
  faceDetected: boolean;
  qualityOk: boolean;
  phase: LivenessPhase;
  capturePhase: CaptureStatus["phase"];
  countdown: number;
}) {
  let state: OvalState = "none";
  if (capturePhase === "front-countdown" || capturePhase === "front-captured")
    state = "capturing";
  else if (phase === "done") state = "done";
  else if (faceDetected && qualityOk) state = "good";
  else if (faceDetected) state = "detected";

  const strokeColor =
    state === "capturing"
      ? "#f59e0b" // amber — countdown
      : state === "done"
        ? "#34d399" // green
        : state === "good"
          ? "#22d3ee" // cyan
          : state === "detected"
            ? "#fbbf24" // amber
            : "#64748b"; // slate

  const glowColor =
    state === "capturing"
      ? "rgba(245,158,11,0.18)"
      : state === "done"
        ? "rgba(52,211,153,0.18)"
        : state === "good"
          ? "rgba(34,211,238,0.15)"
          : state === "detected"
            ? "rgba(251,191,36,0.12)"
            : "transparent";

  // Live oval mapping
  let liveCX: number | null = null;
  let liveRX: number | null = null;

  if (faceBox) {
    const padX = faceBox.width * 0.2;
    const padYTop = faceBox.height * 0.45;
    const padYBot = faceBox.height * 0.1;
    const expandedX = faceBox.x - padX;
    const expandedW = faceBox.width + padX * 2;
    const expandedH = faceBox.height + padYTop + padYBot;
    liveCX = ((expandedX + expandedW / 2) / VIDEO_W) * 100;
    liveRX = (expandedW / 2 / VIDEO_W) * 100;
  }

  const isPulsing = state === "good" || state === "done";
  const isCountdown = state === "capturing";

  // Countdown arc: full circle at 3s, shrinks to 0 at 0s
  const RADIUS = GUIDE_RX;
  const CIRC = 2 * Math.PI * RADIUS;
  const countdownFrac = Math.max(0, Math.min(1, countdown / 3));
  const arcDash = countdownFrac * CIRC;

  return (
    <svg
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
        @keyframes countdownPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .oval-pulse {
          animation: ovalPulse 1.8s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .countdown-pulse {
          animation: countdownPulse 1s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
      `}</style>

      <defs>
        <mask id="ovalMask">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          <ellipse
            cx={GUIDE_CX}
            cy={GUIDE_CY}
            rx={GUIDE_RX}
            ry={GUIDE_RY}
            fill="black"
          />
        </mask>
      </defs>

      {/* Darkened surround */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="rgba(0,0,0,0.45)"
        mask="url(#ovalMask)"
        opacity={state === "none" ? 1 : 0.55}
        style={{ transition: "opacity 0.4s" }}
      />

      {/* Inner glow */}
      <ellipse
        cx={GUIDE_CX}
        cy={GUIDE_CY}
        rx={GUIDE_RX}
        ry={GUIDE_RY}
        fill={glowColor}
        style={{ transition: "fill 0.4s" }}
      />

      {/* Guide oval border */}
      <ellipse
        cx={GUIDE_CX}
        cy={GUIDE_CY}
        rx={GUIDE_RX}
        ry={GUIDE_RY}
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.6"
        strokeDasharray={state === "none" ? "2 1.2" : "none"}
        className={
          isPulsing ? "oval-pulse" : isCountdown ? "countdown-pulse" : ""
        }
        style={{ transition: "stroke 0.4s, stroke-dasharray 0.4s" }}
      />

      {/* Countdown arc — drawn on top of oval border */}
      {isCountdown && (
        <ellipse
          cx={GUIDE_CX}
          cy={GUIDE_CY}
          rx={GUIDE_RX}
          ry={GUIDE_RY}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.2"
          strokeDasharray={`${arcDash} ${CIRC}`}
          strokeLinecap="round"
          style={{
            transformOrigin: `${GUIDE_CX}% ${GUIDE_CY}%`,
            transform: "rotate(-90deg)",
            transformBox: "fill-box",
            transition: "stroke-dasharray 0.9s linear",
          }}
        />
      )}

      {/* Countdown number */}
      {isCountdown && countdown > 0 && (
        <text
          x={GUIDE_CX}
          y={GUIDE_CY + 1.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill="#f59e0b"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          opacity="0.9"
        >
          {countdown}
        </text>
      )}

      {/* Tick marks */}
      {[
        [
          GUIDE_CX,
          GUIDE_CY - GUIDE_RY - 1.5,
          GUIDE_CX,
          GUIDE_CY - GUIDE_RY + 2.5,
        ],
        [
          GUIDE_CX,
          GUIDE_CY + GUIDE_RY - 2.5,
          GUIDE_CX,
          GUIDE_CY + GUIDE_RY + 1.5,
        ],
        [
          GUIDE_CX - GUIDE_RX - 1.5,
          GUIDE_CY,
          GUIDE_CX - GUIDE_RX + 2.5,
          GUIDE_CY,
        ],
        [
          GUIDE_CX + GUIDE_RX - 2.5,
          GUIDE_CY,
          GUIDE_CX + GUIDE_RX + 1.5,
          GUIDE_CY,
        ],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={strokeColor}
          strokeWidth="0.7"
          strokeLinecap="round"
          style={{ transition: "stroke 0.4s" }}
        />
      ))}

      {/* Proximity label */}
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

// ─── SideGuideOverlay ─────────────────────────────────────────────────────────
// Shows a turn-direction arrow + yaw progress arc during side-photo phase

function SideGuideOverlay({
  yawProgress,
  isReady,
}: {
  yawProgress: number;
  isReady: boolean;
}) {
  const ARC_R = 18;
  const ARC_CIRC = 2 * Math.PI * ARC_R;
  const arcFill = yawProgress * ARC_CIRC;
  const color = isReady ? "#34d399" : "#22d3ee";

  return (
    <svg
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
        @keyframes arrowBounce {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }
        .arrow-bounce {
          animation: arrowBounce 1s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
      `}</style>

      {/* Dim surround — lighter during side guide */}
      <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.35)" />

      {/* Progress arc around oval */}
      <ellipse
        cx={GUIDE_CX}
        cy={GUIDE_CY}
        rx={ARC_R + 2}
        ry={GUIDE_RY + 2}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.5"
      />
      <ellipse
        cx={GUIDE_CX}
        cy={GUIDE_CY}
        rx={ARC_R + 2}
        ry={GUIDE_RY + 2}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={`${arcFill} ${ARC_CIRC}`}
        strokeLinecap="round"
        style={{
          transition: "stroke-dasharray 0.3s ease, stroke 0.4s",
          transform: "rotate(-90deg)",
          transformOrigin: `${GUIDE_CX}% ${GUIDE_CY}%`,
          transformBox: "fill-box",
        }}
      />

      {/* Oval border */}
      <ellipse
        cx={GUIDE_CX}
        cy={GUIDE_CY}
        rx={GUIDE_RX}
        ry={GUIDE_RY}
        fill="rgba(34,211,238,0.05)"
        stroke={color}
        strokeWidth="0.6"
        style={{ transition: "stroke 0.4s" }}
      />

      {/* Arrow pointing right */}
      {!isReady && (
        <g className="arrow-bounce">
          <text
            x={GUIDE_CX + GUIDE_RX + 5}
            y={GUIDE_CY + 1.5}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fill="#22d3ee"
            opacity="0.9"
          >
            →
          </text>
        </g>
      )}

      {/* Checkmark when ready */}
      {isReady && (
        <text
          x={GUIDE_CX}
          y={GUIDE_CY + 1.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7"
          fill="#34d399"
          opacity="0.95"
        >
          ✓
        </text>
      )}

      {/* Label */}
      <text
        x={GUIDE_CX}
        y={GUIDE_CY + GUIDE_RY + 6}
        textAnchor="middle"
        fontSize="3.2"
        fill={color}
        fontFamily="system-ui, sans-serif"
        fontWeight="500"
        opacity="0.9"
        style={{ transition: "fill 0.4s" }}
      >
        {isReady ? "Good! Now capture →" : "Turn your head right"}
      </text>
    </svg>
  );
}

// ─── CaptureFlash ─────────────────────────────────────────────────────────────

function CaptureFlash({ active }: { active: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "white",
        borderRadius: "inherit",
        pointerEvents: "none",
        opacity: active ? 0.75 : 0,
        transition: active ? "opacity 0s" : "opacity 0.4s ease-out",
        zIndex: 20,
      }}
    />
  );
}

// ─── CaptureProgressBar ───────────────────────────────────────────────────────

function CaptureProgressBar({ phase }: { phase: CaptureStatus["phase"] }) {
  const steps: Array<{
    key: CaptureStatus["phase"] | string;
    label: string;
    icon: string;
  }> = [
    { key: "liveness", label: "Liveness", icon: "🛡️" },
    { key: "front", label: "Front Photo", icon: "🤳" },
    { key: "side", label: "Side Photo", icon: "↩️" },
  ];

  const phaseToStep: Record<CaptureStatus["phase"], number> = {
    idle: 0,
    "front-guide": 1,
    "front-countdown": 1,
    "front-captured": 1,
    "side-guide": 2,
    "side-ready": 2,
    "side-captured": 2,
    complete: 3,
  };

  const activeStep = phaseToStep[phase];

  return (
    <div className="flex items-center gap-2 w-full">
      {steps.map((s, i) => {
        const done = i < activeStep;
        const active = i === activeStep - 1 || (activeStep === 0 && i === 0);
        return (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-300 flex-1 ${
                done
                  ? "bg-emerald-900/60 border border-emerald-700/50 text-emerald-300"
                  : active
                    ? "bg-cyan-900/60 border border-cyan-700 text-cyan-200"
                    : "bg-slate-800/60 border border-slate-700 text-slate-500"
              }`}
            >
              <span>{s.icon}</span>
              <span className="truncate">{s.label}</span>
              {done && <span className="ml-auto">✓</span>}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-3 shrink-0 transition-all duration-500 ${done ? "bg-emerald-600" : "bg-slate-700"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── StatusBanner ─────────────────────────────────────────────────────────────

function StatusBanner({
  phase,
  capturePhase,
  countdown,
  faceDetected,
  qualityOk,
  hint,
}: {
  phase: LivenessPhase;
  capturePhase: CaptureStatus["phase"];
  countdown: number;
  faceDetected: boolean;
  qualityOk: boolean;
  hint: string;
}) {
  // During capture phases, override with capture-specific messaging
  if (capturePhase === "front-guide") {
    if (!faceDetected) {
      return (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-sm text-slate-300">
            Position your face in the oval to begin auto-capture
          </p>
        </div>
      );
    }
    if (!qualityOk) {
      return (
        <div className="flex items-center gap-3 rounded-2xl bg-amber-950/60 border border-amber-700/50 px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-sm text-amber-200">
            Face detected — move a little closer for better quality
          </p>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-cyan-950/60 border border-cyan-700/50 px-4 py-3">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
        <p className="text-sm text-cyan-200">
          Hold still — starting auto-capture…
        </p>
      </div>
    );
  }

  if (capturePhase === "front-countdown") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-amber-950/60 border border-amber-600/60 px-4 py-3">
        <div className="text-amber-400 text-lg font-bold shrink-0">
          {countdown}
        </div>
        <p className="text-sm text-amber-200 font-medium">
          Capturing in {countdown}… hold still and look at the camera
        </p>
      </div>
    );
  }

  if (capturePhase === "front-captured") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/50 px-4 py-3">
        <span className="text-emerald-400 text-lg shrink-0">✓</span>
        <p className="text-sm text-emerald-200 font-medium">
          Front photo captured! Preparing side photo…
        </p>
      </div>
    );
  }

  if (capturePhase === "side-guide") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-3">
        <span className="text-2xl shrink-0">↩️</span>
        <div>
          <p className="text-sm text-white font-medium">
            Now take a side photo
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Slowly turn your head to the right until the indicator fills
          </p>
        </div>
      </div>
    );
  }

  if (capturePhase === "side-ready") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/50 px-4 py-3">
        <span className="text-emerald-400 text-lg shrink-0">✓</span>
        <p className="text-sm text-emerald-200 font-medium">
          Perfect angle! Tap the button to capture.
        </p>
      </div>
    );
  }

  if (capturePhase === "side-captured" || capturePhase === "complete") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/50 px-4 py-3">
        <span className="text-emerald-400 text-lg shrink-0">🎉</span>
        <p className="text-sm text-emerald-200 font-medium">
          All photos captured! Proceeding…
        </p>
      </div>
    );
  }

  // Liveness phase — show landmark hint
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-3">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${faceDetected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
      />
      <p className="text-sm text-slate-300 truncate">{hint}</p>
    </div>
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
  captureStatus,
}: {
  selfieWebcamRef: React.RefObject<any>;
  videoConstraints: object;
  landmarkStatus: {
    faceDetected: boolean;
    qualityOk: boolean;
    yawEstimate: number;
    hint: string;
    faceBox: FaceBox | null;
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
  captureStatus: CaptureStatus;
}) {
  const currentConfig = CHALLENGE_CONFIGS[livenessChallenge];
  const {
    phase: capturePhase,
    countdown,
    flashActive,
    yawProgress,
  } = captureStatus;

  const isSidePhase =
    capturePhase === "side-guide" ||
    capturePhase === "side-ready" ||
    capturePhase === "side-captured";

  const isCapturePhase = capturePhase !== "idle";

  // Timer arc for liveness challenges
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
    <section className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Selfie &amp; Liveness Check
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {!isCapturePhase && (
              <>
                {phase === "detecting" &&
                  "Position your face in the frame to begin."}
                {phase === "ready" &&
                  "Face detected! Ready to start the challenge."}
                {phase === "challenging" &&
                  `Challenge ${challengeIndex + 1} of ${challengeSequence.length}`}
                {phase === "timeout" && "Challenge timed out."}
                {phase === "done" &&
                  "Liveness verified — capturing photos now."}
              </>
            )}
            {isCapturePhase && (
              <>
                {capturePhase === "front-guide" &&
                  "Auto-capture will start when your face is ready."}
                {capturePhase === "front-countdown" &&
                  `Capturing in ${countdown}s — hold still!`}
                {capturePhase === "front-captured" && "Front photo captured!"}
                {capturePhase === "side-guide" &&
                  "Now turn your head to capture the side profile."}
                {capturePhase === "side-ready" &&
                  "Perfect! Tap the button to take the side photo."}
                {(capturePhase === "side-captured" ||
                  capturePhase === "complete") &&
                  "All done! Moving to next step…"}
              </>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-400 uppercase tracking-widest shrink-0">
          {isCapturePhase
            ? isSidePhase
              ? "Step 2 / 2 — Side"
              : "Step 1 / 2 — Front"
            : phase === "done"
              ? "✓ Liveness verified"
              : `Challenge ${challengeIndex + 1} / ${challengeSequence.length}`}
        </div>
      </div>

      {/* ── Capture progress (only after liveness done) ─────────────────── */}
      {isCapturePhase && <CaptureProgressBar phase={capturePhase} />}

      {/* ── Status banner ───────────────────────────────────────────────── */}
      <StatusBanner
        phase={phase}
        capturePhase={capturePhase}
        countdown={countdown}
        faceDetected={landmarkStatus.faceDetected}
        qualityOk={landmarkStatus.qualityOk}
        hint={landmarkStatus.hint}
      />

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        {/* ── Webcam + overlays ──────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-black">
          <Webcam
            ref={selfieWebcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
          />

          {/* Flash overlay */}
          <CaptureFlash active={flashActive} />

          {/* Face oval — liveness + front capture phases */}
          {!isSidePhase && (
            <FaceOvalOverlay
              faceBox={landmarkStatus.faceBox}
              faceDetected={landmarkStatus.faceDetected}
              qualityOk={landmarkStatus.qualityOk}
              phase={phase}
              capturePhase={capturePhase}
              countdown={countdown}
            />
          )}

          {/* Side guide overlay */}
          {isSidePhase && (
            <SideGuideOverlay
              yawProgress={yawProgress}
              isReady={capturePhase === "side-ready"}
            />
          )}

          {/* ── Liveness phase overlays (unchanged behavior) ──────────── */}

          {/* DETECTING */}
          {phase === "detecting" && !isCapturePhase && (
            <div className="absolute inset-0 flex flex-col items-center justify-end bg-transparent pb-6 gap-3 pointer-events-none">
              <div className="flex items-center gap-2 bg-black/60 rounded-2xl px-4 py-2">
                <div className="w-3 h-3 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin" />
                <p className="text-slate-300 text-xs">Detecting your face…</p>
              </div>
            </div>
          )}

          {/* READY */}
          {phase === "ready" && !isCapturePhase && (
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
                  . Each has{" "}
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
          {phase === "challenging" && !isCapturePhase && (
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
                You didn't complete the challenge in time. Let's try again.
              </p>
              <button
                onClick={retryChallenge}
                className="mt-2 rounded-2xl bg-amber-500 px-8 py-3 font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                Retry Challenges →
              </button>
            </div>
          )}

          {/* FRONT-GUIDE: manual capture fallback button (subtle) */}
          {capturePhase === "front-guide" && (
            <div className="absolute inset-0 flex items-end justify-center pb-5 pointer-events-none">
              <div className="pointer-events-auto">
                <button
                  onClick={() => void captureSelfie()}
                  className="rounded-2xl bg-black/60 border border-slate-600 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors backdrop-blur"
                >
                  Capture manually
                </button>
              </div>
            </div>
          )}

          {/* SIDE-READY: capture button on video */}
          {capturePhase === "side-ready" && (
            <div className="absolute inset-0 flex items-end justify-center pb-6">
              <button
                onClick={() => void captureFaceSidePhoto()}
                className="rounded-2xl bg-emerald-500 px-8 py-3 font-semibold text-slate-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-900/40 text-sm"
              >
                📸 Capture Side Photo
              </button>
            </div>
          )}

          {/* SIDE-GUIDE: capture button (disabled) so user knows it's coming */}
          {capturePhase === "side-guide" && (
            <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
              <button
                disabled
                className="rounded-2xl bg-slate-700/80 px-8 py-3 font-semibold text-slate-400 text-sm cursor-not-allowed"
              >
                Turn further to unlock →
              </button>
            </div>
          )}
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* During liveness: challenge progress */}
          {!isCapturePhase && (
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
          )}

          {/* During capture: step-by-step guide */}
          {isCapturePhase && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300 space-y-3">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Photo guide
              </div>

              {/* Step 1 */}
              <div
                className={`rounded-xl p-3 border transition-all ${
                  capturePhase === "front-guide" ||
                  capturePhase === "front-countdown"
                    ? "border-cyan-700 bg-cyan-950/40"
                    : capturePhase === "front-captured" || isSidePhase
                      ? "border-emerald-800/50 bg-emerald-950/30"
                      : "border-slate-700 bg-slate-900/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🤳</span>
                  <span className="font-medium text-white">Front Photo</span>
                  {(capturePhase === "front-captured" || isSidePhase) && (
                    <span className="ml-auto text-emerald-400 text-xs">
                      ✓ Done
                    </span>
                  )}
                  {(capturePhase === "front-guide" ||
                    capturePhase === "front-countdown") && (
                    <span className="ml-auto">
                      <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Face the camera directly. Auto-capture begins when your face
                  quality is good.
                </p>
              </div>

              {/* Step 2 */}
              <div
                className={`rounded-xl p-3 border transition-all ${
                  capturePhase === "side-guide" || capturePhase === "side-ready"
                    ? "border-cyan-700 bg-cyan-950/40"
                    : capturePhase === "side-captured" ||
                        capturePhase === "complete"
                      ? "border-emerald-800/50 bg-emerald-950/30"
                      : "border-slate-700 bg-slate-900/40 opacity-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">↩️</span>
                  <span className="font-medium text-white">Side Photo</span>
                  {(capturePhase === "side-captured" ||
                    capturePhase === "complete") && (
                    <span className="ml-auto text-emerald-400 text-xs">
                      ✓ Done
                    </span>
                  )}
                  {(capturePhase === "side-guide" ||
                    capturePhase === "side-ready") && (
                    <span className="ml-auto">
                      <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Slowly turn your head right. The button activates when angle
                  is good.
                </p>

                {/* Yaw progress bar */}
                {(capturePhase === "side-guide" ||
                  capturePhase === "side-ready") && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Turn angle</span>
                      <span>{Math.round(yawProgress * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${capturePhase === "side-ready" ? "bg-emerald-400" : "bg-cyan-400"}`}
                        style={{ width: `${yawProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview thumbnails */}
          {(selfieImage || faceSidePhoto) && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Captured
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selfieImage && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Front</div>
                    <img
                      src={selfieImage}
                      alt="Selfie"
                      className="rounded-xl w-full object-cover aspect-square"
                    />
                  </div>
                )}
                {faceSidePhoto && (
                  <div>
                    <div className="text-xs text-violet-400 mb-1">Side</div>
                    <img
                      src={faceSidePhoto}
                      alt="Side"
                      className="rounded-xl w-full object-cover aspect-square"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={prevStep}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Back
        </button>

        {/* During liveness: disabled continue */}
        {!isCapturePhase && (
          <button
            disabled
            className="rounded-2xl bg-cyan-500/30 px-5 py-3 font-medium text-slate-400 cursor-not-allowed text-sm"
          >
            {livenessDone ? "Auto-capturing…" : "Complete liveness first"}
          </button>
        )}

        {/* Side-ready: primary CTA also in footer */}
        {capturePhase === "side-ready" && (
          <button
            onClick={() => void captureFaceSidePhoto()}
            className="rounded-2xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 hover:bg-emerald-400 transition-colors"
          >
            📸 Capture Side Photo
          </button>
        )}

        {/* Side guide: disabled */}
        {capturePhase === "side-guide" && (
          <button
            disabled
            className="rounded-2xl bg-slate-700 px-5 py-3 font-medium text-slate-500 cursor-not-allowed text-sm"
          >
            Turn your head to unlock →
          </button>
        )}
      </div>
    </section>
  );
}
