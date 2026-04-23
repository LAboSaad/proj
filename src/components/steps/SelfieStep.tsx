import Webcam from "react-webcam";

export default function SelfieStep({
  selfieWebcamRef,
  videoConstraints,
  landmarkStatus,
  livenessCompleted,
  livenessDone,
  captureSelfie,
  prevStep,
  selfieImage,
  livenessChallenge
}: any) {
  return (
    <section className="space-y-5">
                   <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                     <div>
                       <h2 className="text-2xl font-semibold">Selfie capture and active liveness</h2>
                       <p className="mt-1 text-sm text-slate-300">
                         Complete the head-movement prompts, then capture the final selfie.
                       </p>
                     </div>
                     <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                       Current prompt:{" "}
                       <span className="text-cyan-300">
                         {livenessChallenge === "center"
                           ? "Look straight"
                           : livenessChallenge === "lookLeft"
                             ? "Look left"
                             : "Look right"}
                       </span>
                     </div>
                   </div>
   
                   <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                     <div className="overflow-hidden rounded-3xl border border-slate-800 bg-black">
                       <Webcam
                         ref={selfieWebcamRef}
                         audio={false}
                         mirrored
                         screenshotFormat="image/jpeg"
                         videoConstraints={videoConstraints}
                         className="aspect-[4/3] w-full object-cover"
                       />
                     </div>
   
                     <div className="space-y-4">
                       <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                         <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Live analysis</div>
                         <div>
                           Face detected:{" "}
                           <span className={landmarkStatus.faceDetected ? "text-emerald-300" : "text-amber-300"}>
                             {landmarkStatus.faceDetected ? "Yes" : "No"}
                           </span>
                         </div>
                         <div>
                           Quality:{" "}
                           <span className={landmarkStatus.qualityOk ? "text-emerald-300" : "text-amber-300"}>
                             {landmarkStatus.qualityOk ? "OK" : "Improve capture"}
                           </span>
                         </div>
                         <div>
                           Yaw estimate: <span className="text-cyan-300">{landmarkStatus.yawEstimate}</span>
                         </div>
                         <div className="mt-3 rounded-xl bg-slate-900 p-3 text-slate-200">{landmarkStatus.hint}</div>
                       </div>
   
                       <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                         <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Challenge progress</div>
                         <div className="space-y-2">
                           <div>
                             Look straight:{" "}
                             <span className={livenessCompleted.center ? "text-emerald-300" : "text-slate-400"}>
                               {livenessCompleted.center ? "Done" : "Pending"}
                             </span>
                           </div>
                           <div>
                             Look left:{" "}
                             <span className={livenessCompleted.lookLeft ? "text-emerald-300" : "text-slate-400"}>
                               {livenessCompleted.lookLeft ? "Done" : "Pending"}
                             </span>
                           </div>
                           <div>
                             Look right:{" "}
                             <span className={livenessCompleted.lookRight ? "text-emerald-300" : "text-slate-400"}>
                               {livenessCompleted.lookRight ? "Done" : "Pending"}
                             </span>
                           </div>
                         </div>
                       </div>
   
                       {selfieImage && (
                         <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                           <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Captured selfie</div>
                           <img src={selfieImage} alt="Selfie" className="rounded-2xl" />
                         </div>
                       )}
                     </div>
                   </div>
   
                   <div className="flex flex-wrap gap-3">
                     <button onClick={prevStep} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                       Back
                     </button>
                     <button
                       onClick={() => void captureSelfie()}
                       disabled={!livenessDone}
                       className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                     >
                       Capture selfie and continue
                     </button>
                   </div>
                 </section>
  );
}