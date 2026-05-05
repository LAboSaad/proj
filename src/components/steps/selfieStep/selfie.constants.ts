// src/components/steps/selfie/selfie.constants.ts
//
// Shared constants for the selfie step and its sub-components.
// Centralised here so FaceOvalOverlay, SideGuideOverlay, and SelfieStep
// all read from one source instead of duplicating magic numbers.

import type { CaptureStatus } from "../../../hooks/useSelfie";

// ── SVG guide oval geometry ───────────────────────────────────────────────────
// These values mirror the viewBox="0 0 100 100" coordinate space used by the
// SVG overlays. Changing them here updates every overlay simultaneously.

export const VIDEO_W = 720;
export const VIDEO_H = 540;

export const GUIDE_CX = 50; // oval centre-x  (% of viewBox width)
export const GUIDE_CY = 48; // oval centre-y  (% of viewBox height)
export const GUIDE_RX = 22; // oval x-radius
export const GUIDE_RY = 31; // oval y-radius

// ── Timer arc ─────────────────────────────────────────────────────────────────

export const TIMER_RADIUS = 20;
export const TIMER_CIRC = 2 * Math.PI * TIMER_RADIUS;

// ── Capture progress bar ──────────────────────────────────────────────────────

export const PROGRESS_STEPS: Array<{
  key: string;
  label: string;
  icon: string;
}> = [
  { key: "liveness", label: "Liveness", icon: "🛡️" },
  { key: "front", label: "Front Photo", icon: "🤳" },
  { key: "side", label: "Side Photo", icon: "↩️" },
];

// Maps CaptureStatus phase → which 0-based progress step is active.
// Defined here (not inside the component) so it is not re-created on every render.
export const PHASE_TO_STEP: Record<CaptureStatus["phase"], number> = {
  idle: 0,
  "front-guide": 1,
  "front-countdown": 1,
  "front-captured": 1,
  "side-guide": 2,
  "side-ready": 2,
  "side-captured": 2,
  complete: 3,
};
