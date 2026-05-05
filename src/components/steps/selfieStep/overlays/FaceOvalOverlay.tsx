
import type { LivenessPhase } from "../../../../hooks/useFaceLiveness";
import type { CaptureStatus } from "../../../../hooks/useSelfie";
import type { FaceBox } from "../../../../types/kyc";
import { GUIDE_CX, GUIDE_CY, GUIDE_RX, GUIDE_RY, VIDEO_W } from "../selfie.constants";

// ── Types ─────────────────────────────────────────────────────────────────────

type OvalState = "none" | "detected" | "good" | "done" | "capturing";

interface FaceOvalOverlayProps {
  faceBox:      FaceBox | null;
  faceDetected: boolean;
  qualityOk:    boolean;
  phase:        LivenessPhase;
  capturePhase: CaptureStatus["phase"];
  countdown:    number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveOvalState(
  phase:        LivenessPhase,
  capturePhase: CaptureStatus["phase"],
  faceDetected: boolean,
  qualityOk:    boolean,
): OvalState {
  if (capturePhase === "front-countdown" || capturePhase === "front-captured") return "capturing";
  if (phase === "done")                   return "done";
  if (faceDetected && qualityOk)          return "good";
  if (faceDetected)                       return "detected";
  return "none";
}

const STROKE_COLOR: Record<OvalState, string> = {
  capturing: "#f59e0b",
  done:      "#34d399",
  good:      "#22d3ee",
  detected:  "#fbbf24",
  none:      "#64748b",
};

const GLOW_COLOR: Record<OvalState, string> = {
  capturing: "rgba(245,158,11,0.18)",
  done:      "rgba(52,211,153,0.18)",
  good:      "rgba(34,211,238,0.15)",
  detected:  "rgba(251,191,36,0.12)",
  none:      "transparent",
};

const TICK_MARKS: [number, number, number, number][] = [
  [GUIDE_CX,            GUIDE_CY - GUIDE_RY - 1.5, GUIDE_CX,            GUIDE_CY - GUIDE_RY + 2.5],
  [GUIDE_CX,            GUIDE_CY + GUIDE_RY - 2.5, GUIDE_CX,            GUIDE_CY + GUIDE_RY + 1.5],
  [GUIDE_CX - GUIDE_RX - 1.5, GUIDE_CY,            GUIDE_CX - GUIDE_RX + 2.5, GUIDE_CY           ],
  [GUIDE_CX + GUIDE_RX - 2.5, GUIDE_CY,            GUIDE_CX + GUIDE_RX + 1.5, GUIDE_CY           ],
];

// Arc geometry
const ARC_CIRC = 2 * Math.PI * GUIDE_RX;

// ── Component ─────────────────────────────────────────────────────────────────

export function FaceOvalOverlay({
  faceBox,
  faceDetected,
  qualityOk,
  phase,
  capturePhase,
  countdown,
}: FaceOvalOverlayProps) {
  const state       = resolveOvalState(phase, capturePhase, faceDetected, qualityOk);
  const strokeColor = STROKE_COLOR[state];
  const glowColor   = GLOW_COLOR[state];
  const isPulsing   = state === "good"  || state === "done";
  const isCountdown = state === "capturing";
  const arcDash     = Math.max(0, Math.min(1, countdown / 3)) * ARC_CIRC;

  // Derive live oval size from faceBox for the proximity label
  let liveRX: number | null = null;
  if (faceBox) {
    const padX      = faceBox.width * 0.2;
    const expandedW = faceBox.width + padX * 2;
    liveRX = (expandedW / 2 / VIDEO_W) * 100;
  }

  const proximityLabel =
    faceDetected && liveRX !== null
      ? liveRX < GUIDE_RX * 0.72 ? "Move closer"
      : liveRX > GUIDE_RX * 1.18 ? "Move back"
      : null
      : null;

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes ovalPulse       { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes countdownPulse  { 0%,100%{opacity:1} 50%{opacity:.7}  }
        .oval-pulse      { animation: ovalPulse 1.8s ease-in-out infinite; transform-origin:center; transform-box:fill-box }
        .countdown-pulse { animation: countdownPulse 1s ease-in-out infinite; transform-origin:center; transform-box:fill-box }
      `}</style>

      <defs>
        <mask id="ovalMask">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          <ellipse cx={GUIDE_CX} cy={GUIDE_CY} rx={GUIDE_RX} ry={GUIDE_RY} fill="black" />
        </mask>
      </defs>

      {/* Darkened surround */}
      <rect x="0" y="0" width="100" height="100"
        fill="rgba(0,0,0,0.45)" mask="url(#ovalMask)"
        opacity={state === "none" ? 1 : 0.55}
        style={{ transition: "opacity 0.4s" }}
      />

      {/* Inner glow */}
      <ellipse cx={GUIDE_CX} cy={GUIDE_CY} rx={GUIDE_RX} ry={GUIDE_RY}
        fill={glowColor} style={{ transition: "fill 0.4s" }} />

      {/* Guide oval border */}
      <ellipse cx={GUIDE_CX} cy={GUIDE_CY} rx={GUIDE_RX} ry={GUIDE_RY}
        fill="none" stroke={strokeColor} strokeWidth="0.6"
        strokeDasharray={state === "none" ? "2 1.2" : "none"}
        className={isPulsing ? "oval-pulse" : isCountdown ? "countdown-pulse" : ""}
        style={{ transition: "stroke 0.4s, stroke-dasharray 0.4s" }}
      />

      {/* Countdown arc */}
      {isCountdown && (
        <ellipse cx={GUIDE_CX} cy={GUIDE_CY} rx={GUIDE_RX} ry={GUIDE_RY}
          fill="none" stroke="#f59e0b" strokeWidth="1.2"
          strokeDasharray={`${arcDash} ${ARC_CIRC}`} strokeLinecap="round"
          style={{ transformOrigin: `${GUIDE_CX}% ${GUIDE_CY}%`, transform: "rotate(-90deg)", transformBox: "fill-box", transition: "stroke-dasharray 0.9s linear" }}
        />
      )}

      {/* Countdown number */}
      {isCountdown && countdown > 0 && (
        <text x={GUIDE_CX} y={GUIDE_CY + 1.5} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fill="#f59e0b" fontFamily="system-ui, sans-serif" fontWeight="700" opacity="0.9">
          {countdown}
        </text>
      )}

      {/* Tick marks */}
      {TICK_MARKS.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={strokeColor} strokeWidth="0.7" strokeLinecap="round"
          style={{ transition: "stroke 0.4s" }} />
      ))}

      {/* Proximity label */}
      {proximityLabel && (
        <text x={GUIDE_CX} y={GUIDE_CY + GUIDE_RY + 5.5} textAnchor="middle"
          fontSize="3.2" fill={strokeColor} fontFamily="system-ui, sans-serif"
          fontWeight="500" opacity="0.9" style={{ transition: "fill 0.4s" }}>
          {proximityLabel}
        </text>
      )}
    </svg>
  );
}