import Webcam from "react-webcam";
import { cx } from "../../lib/utils";

export default function DocumentStep({
  documentPreviewMode,
  setDocumentPreviewMode,
  docWebcamRef,
  captureDocument,
  handleDocumentUpload,
  documentImage,
  runOCRAndMRZ,
  prevStep,
  docVideoConstraints,
documentQuality,
saveDocumentBlobLocally,
busy
   
}: any) {
  return (
     <section className="space-y-5">
                   <div>
                     <h2 className="text-2xl font-semibold">Document capture</h2>
                     <p className="mt-1 text-sm text-slate-300">
                       Capture or upload a clear passport or ID image. A passport data page works best for MRZ.
                     </p>
                   </div>
   
                   <div className="flex gap-2">
                     <button
                       onClick={() => setDocumentPreviewMode("camera")}
                       className={cx(
                         "rounded-2xl px-4 py-2 text-sm",
                         documentPreviewMode === "camera" ? "bg-cyan-500 text-slate-950" : "border border-slate-700 text-slate-200"
                       )}
                     >
                       Camera
                     </button>
                     <button
                       onClick={() => setDocumentPreviewMode("upload")}
                       className={cx(
                         "rounded-2xl px-4 py-2 text-sm",
                         documentPreviewMode === "upload" ? "bg-cyan-500 text-slate-950" : "border border-slate-700 text-slate-200"
                       )}
                     >
                       Upload image
                     </button>
                   </div>
   
                   {documentPreviewMode === "camera" ? (
                     <div className="overflow-hidden rounded-3xl border border-slate-800 bg-black">
                       <Webcam
                         ref={docWebcamRef}
                         audio={false}
                         screenshotFormat="image/jpeg"
                         videoConstraints={docVideoConstraints}
                         className="aspect-video w-full object-cover"
                       />
                     </div>
                   ) : (
                     <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 px-6 py-10 text-center text-slate-300">
                       <span className="text-lg font-medium">Upload passport or ID image</span>
                       <span className="mt-2 text-sm text-slate-400">PNG or JPG. Prefer a flat, sharp image with visible MRZ.</span>
                       <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleDocumentUpload(e)} />
                     </label>
                   )}
   
                   {documentImage && (
                     <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                       <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                         <div className="mb-3 text-sm text-slate-300">Selected document image</div>
                         <img src={documentImage} alt="Document" className="max-h-[420px] rounded-2xl object-contain" />
                       </div>
                       <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                         <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Quality checks</div>
                         {documentQuality ? (
                           <div className="space-y-2">
                             <div>Resolution: <span className="text-cyan-300">{documentQuality.width} × {documentQuality.height}</span></div>
                             <div>Brightness: <span className="text-cyan-300">{documentQuality.brightness}</span></div>
                             <div>Contrast: <span className="text-cyan-300">{documentQuality.contrast}</span></div>
                             <div>Blur score: <span className="text-cyan-300">{documentQuality.blurScore}</span></div>
                             <div>Glare ratio: <span className="text-cyan-300">{documentQuality.glareRatio}</span></div>
                             <div>
                               Verdict:{" "}
                               <span className={documentQuality.looksUsefulForOCR ? "text-emerald-300" : "text-amber-300"}>
                                 {documentQuality.looksUsefulForOCR ? "Good for OCR" : "Needs improvement"}
                               </span>
                             </div>
                             {documentQuality.reasons.length > 0 && (
                               <ul className="mt-3 space-y-2 rounded-2xl bg-slate-900 p-3 text-xs text-slate-200">
                                 {documentQuality.reasons.map((reason:any) => (
                                   <li key={reason}>• {reason}</li>
                                 ))}
                               </ul>
                             )}
                           </div>
                         ) : (
                           <div className="text-slate-400">No quality analysis yet.</div>
                         )}
                       </div>
                     </div>
                   )}
   
                   <div className="flex flex-wrap gap-3">
                     <button onClick={prevStep} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                       Back
                     </button>
                     {documentPreviewMode === "camera" && (
                       <button onClick={() => void captureDocument()} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                         Capture document
                       </button>
                     )}
                     <button
                       onClick={() => void saveDocumentBlobLocally()}
                       disabled={!documentImage}
                       className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 disabled:opacity-40"
                     >
                       Download image
                     </button>
                     <button
                       onClick={() => void runOCRAndMRZ()}
                       disabled={!documentImage || busy}
                       className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                     >
                       Run OCR and MRZ with AI
                     </button>
                       <button
                       onClick={() => void runOCRAndMRZ()}
                       disabled={!documentImage || busy}
                       className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                     >
                       Run OCR and MRZ
                     </button>
                   </div>
                 </section>
  );
}