import Webcam from "react-webcam";
import type { LivenessChallenge } from "../../lib/constants/kyc.constants";
import { CHALLENGE_CONFIGS } from "../../lib/challenges";
import type { LivenessPhase } from "../../hooks/useFaceLiveness";

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
        {/* Webcam + overlays */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-black">
          <Webcam
            ref={selfieWebcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full object-cover"
          />

          {/* DETECTING */}
          {phase === "detecting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-slate-600 border-t-cyan-400 animate-spin" />
              <p className="text-slate-300 text-sm">Detecting your face…</p>
            </div>
          )}

          {/* READY */}
          {phase === "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-5 px-6 text-center">
              <div className="text-4xl animate-bounce">👤</div>
              <p className="text-xl font-semibold text-white">Face Detected!</p>
              <p className="text-slate-300 text-sm max-w-xs">
                You'll be given{" "}
                <strong className="text-cyan-300">
                  {challengeSequence.length} quick challenges
                </strong>
                . Each one has{" "}
                <strong className="text-cyan-300">5 seconds</strong>. Are you
                ready?
              </p>
              <button
                onClick={startChallenges}
                className="mt-2 rounded-2xl bg-cyan-500 px-8 py-3 font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
              >
                I'm Ready →
              </button>
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

        {/* Face side photo button — only shown after selfie is captured */}
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