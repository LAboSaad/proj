// src/lib/challenges.ts
import type { ChallengeConfig, LivenessChallenge } from "./constants/kyc.constants";

export const CHALLENGE_CONFIGS: Record<LivenessChallenge, ChallengeConfig> = {
  center: {
    id: "center",
    label: "Face Forward",
    instruction: "Look directly at the camera.",
    icon: "🎯",
    requiresHand: false,
    requiresPose: false,
  },
  lookLeft: {
    id: "lookLeft",
    label: "Look Left",
    instruction: "Slowly turn your head to your left.",
    icon: "👈",
    requiresHand: false,
    requiresPose: false,
  },
  lookRight: {
    id: "lookRight",
    label: "Look Right",
    instruction: "Slowly turn your head to your right.",
    icon: "👉",
    requiresHand: false,
    requiresPose: false,
  },
  raiseLeftHand: {
    id: "raiseLeftHand",
    label: "Raise Left Hand",
    instruction: "Raise your left hand above your shoulder.",
    icon: "🤚",
    requiresHand: false,
    requiresPose: true,
  },
  raiseRightHand: {
    id: "raiseRightHand",
    label: "Raise Right Hand",
    instruction: "Raise your right hand above your shoulder.",
    icon: "✋",
    requiresHand: false,
    requiresPose: true,
  },
  nodHead: {
    id: "nodHead",
    label: "Nod Your Head",
    instruction: "Nod your head up and down slowly.",
    icon: "🙆",
    requiresHand: false,
    requiresPose: true,
  },
  moveCloser: {
    id: "moveCloser",
    label: "Move Closer",
    instruction: "Move your face closer to the camera.",
    icon: "🔍",
    requiresHand: false,
    requiresPose: false,
  },
 
};

/**
 * "center" is always first.
 * Then picks `count - 1` random challenges from the pool without repeats.
 */
export function buildChallengeSequence(count = 4): LivenessChallenge[] {
  const pool: LivenessChallenge[] = [
    "lookLeft",
    "lookRight",
    "raiseLeftHand",
    "raiseRightHand",
    "nodHead",
    "moveCloser",
   
  ];

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.max(1, count - 1));

  return ["center", ...picked];
}