// components/layout/Header.tsx
type Props = {
  modelsLoaded: boolean;
  activeStepLabel: string;
};

export default function Header({ modelsLoaded, activeStepLabel }: Props) {
  return (
    <div className="mb-8 flex flex-col  gap-4 lg:flex-row lg:items-end lg:justify-between">
             <div>
               <p className=" uppercase  text-[#fcd573] text-l">Self Registration</p>
              <h1 className="text-2xl ">
 KYC onboarding
</h1>
              
             </div>
             <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300 shadow-2xl shadow-cyan-950/30">
               {/* <div>
                 Models loaded: <span className={modelsLoaded ? "text-emerald-300" : "text-amber-300"}>{modelsLoaded ? "Yes" : "Loading..."}</span>
               </div> */}
               <div>
                 Current step: <span className="text-cyan-300">{activeStepLabel}</span>
               </div>
             </div>
           </div>
  );
}