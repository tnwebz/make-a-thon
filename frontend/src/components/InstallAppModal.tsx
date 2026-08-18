import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Download, Laptop, CheckCircle2, ShieldCheck, 
  ExternalLink, Sparkles, Plus, HelpCircle, HardDrive, 
  Layers, ArrowRight
} from "lucide-react";
import { usePwaInstall } from "../usePwaInstall";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const handleInstallClick = async () => {
    if (isInstalled) {
      window.open("/offline-player", "_blank");
      onClose();
      return;
    }

    const outcome = await triggerInstall();
    if (outcome === "accepted") {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } else if (outcome === "unavailable") {
      // Browser didn't provide native trigger directly, show instructions
      setShowManualGuide(true);
    }
  };

  const handleOpenWebPlayer = () => {
    window.open("/offline-player", "_blank");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_25px_60px_rgba(0,0,0,0.12)] p-6 sm:p-8 z-10 overflow-hidden text-slate-900"
          >
            {/* Background Decorative Glow */}
            <div 
              className="absolute -top-20 -right-20 w-52 h-52 pointer-events-none rounded-full blur-3xl opacity-50"
              style={{ background: "radial-gradient(circle, rgba(5, 150, 105, 0.25) 0%, transparent 70%)" }}
            />

            {/* Header */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-md">
                  S
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                      SkillForge Desktop App
                    </h3>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      PWA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">Standalone Offline Course Player</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Success Message */}
            {installSuccess ? (
              <div className="my-8 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-xl font-black text-slate-900">App Installed Successfully!</h4>
                <p className="text-xs text-slate-500 font-medium">
                  SkillForge has been added to your Desktop & Taskbar. You can launch it anytime without internet.
                </p>
              </div>
            ) : (
              <>
                {/* Feature Highlights Bento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-6">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                      <ShieldCheck size={18} />
                    </div>
                    <span className="text-xs font-black text-slate-900">100% Offline</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">Zero Wi-Fi or data required</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                      <Plus size={18} />
                    </div>
                    <span className="text-xs font-black text-slate-900">Drag & Drop ZIP</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">Auto-structures courses</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
                      <Laptop size={18} />
                    </div>
                    <span className="text-xs font-black text-slate-900">Desktop Icon</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">Runs in clean window</span>
                  </div>
                </div>

                {/* Manual Browser Guide (If prompt wasn't triggered automatically) */}
                {showManualGuide && (
                  <div className="mb-5 p-4 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-xs text-indigo-900 space-y-2">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <HelpCircle size={15} className="text-indigo-600" />
                      <span>How to Install on Desktop / Browser:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                      <li>Look at your browser address bar at the top right.</li>
                      <li>Click the <strong>Install app (⊕)</strong> or <strong>App available</strong> icon.</li>
                      <li>Click <strong>Install</strong> to add SkillForge to your Desktop & Taskbar!</li>
                    </ol>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={handleInstallClick}
                    className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    <Download size={18} />
                    <span>{isInstalled ? "Launch Desktop App" : "Download & Install to Desktop"}</span>
                  </button>

                  <button
                    onClick={handleOpenWebPlayer}
                    className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Open Standalone Web Player</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </>
            )}

            {/* Footer note */}
            <p className="text-[11px] text-slate-400 text-center font-medium mt-4">
              Works across Windows, macOS, Linux, Android, and iOS.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
