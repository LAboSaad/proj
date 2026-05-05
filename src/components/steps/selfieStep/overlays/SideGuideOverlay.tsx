
import { GUIDE_CX, GUIDE_CY, GUIDE_RX, GUIDE_RY } from "../selfie.constants";

interface SideGuideOverlayProps {
  yawProgress: number; // 0–1
  isReady:     boolean;
}

const ARC_R    = 18;
const ARC_CIRC = 2 * Math.PI * ARC_R;

export function SideGuideOverlay({ yawProgress, isReady }: SideGuideOverlayProps) {
  const arcFill = yawProgress * ARC_CIRC;
  const color   = isReady ? "#34d399" : "#22d3ee";

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes arrowBounce { 0%,100%{transform:translateX(0)} 50%{transform:translateX(3px)} }
        .arrow-bounce { animation: arrowBounce 1s ease-in-out infinite; transform-box:fill-box; transform-origin:center }
      `}</style>

      {/* Dim surround */}
      <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.35)" />

      {/* Arc track */}
      <ellipse cx={GUIDE_CX} cy={GUIDE_CY} rx={ARC_R + 2} ry={GUIDE_RY + 2}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

      {/* Arc fill */}
      <ellipse cx={GUIDE_CX} cy={GUIDE_CY} rx={ARC_R + 2} ry={GUIDE_RY + 2}
        fill="none" stroke={color} strokeWidth="1.5"
        strokeDasharray={`${arcFill} ${ARC_CIRC}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.4s", transform: "rotate(-90deg)", transformOrigin: `${GUIDE_CX}% ${GUIDE_CY}%`, transformBox: "fill-box" }}
      />

      {/* Oval border */}
      <ellipse cx={GUIDE_CX} cy={GUIDE_CY} rx={GUIDE_RX} ry={GUIDE_RY}
        fill="rgba(34,211,238,0.05)" stroke={color} strokeWidth="0.6"
        style={{ transition: "stroke 0.4s" }} />

      {/* Bouncing arrow (not ready) or checkmark (ready) */}
      {!isReady ? (
        <g className="arrow-bounce">
          <text x={GUIDE_CX + GUIDE_RX + 5} y={GUIDE_CY + 1.5}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="7" fill="#22d3ee" opacity="0.9">→</text>
        </g>
      ) : (
        <text x={GUIDE_CX} y={GUIDE_CY + 1.5} textAnchor="middle" dominantBaseline="middle"
          fontSize="7" fill="#34d399" opacity="0.95">✓</text>
      )}

      {/* Label */}
      <text x={GUIDE_CX} y={GUIDE_CY + GUIDE_RY + 6} textAnchor="middle"
        fontSize="3.2" fill={color} fontFamily="system-ui, sans-serif"
        fontWeight="500" opacity="0.9" style={{ transition: "fill 0.4s" }}>
        {isReady ? "Good! Now capture →" : "Turn your head right"}
      </text>
    </svg>
  );
}