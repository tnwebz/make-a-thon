import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Download, Laptop, CheckCircle2, ShieldCheck, 
  ExternalLink, Sparkles, Plus, HelpCircle, HardDrive, 
  Layers, ArrowRight, Smartphone, Share
} from "lucide-react";
import { usePwaInstall } from "../usePwaInstall";
import { useNavigate } from "react-router-dom";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { canInstall, isInstalled, isIOS, triggerInstall } = usePwaInstall();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const navigate = useNavigate();

  const handleInstallClick = async () => {
    if (isInstalled) {
      navigate("/offline-player");
      onClose();
      return;
    }

    if (isIOS) {
      setShowManualGuide(true);
      return;
    }

    const outcome = await triggerInstall();
    if (outcome === "accepted") {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      // If native programmatic prompt not exposed, show standard PWA browser guide
      setShowManualGuide(true);
    }
  };

  const handleOpenOfflinePlayer = () => {
    navigate("/offline-player");
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
                <img 
                  src="/pwa-192x192.png" 
                  alt="SkillForge App" 
                  className="w-12 h-12 rounded-2xl shadow-md border border-slate-100 object-cover" 
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                      SkillForge App
                    </h3>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      PWA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">Progressive Web Application</p>
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

            {/* If Already Installed or Just Installed */}
            {isInstalled || installSuccess ? (
              <div className="my-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">SkillForge is already installed</h4>
                  <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto mt-1.5 leading-relaxed">
                    SkillForge is installed as a standalone app on this device. You can launch it from your Desktop or Mobile Home Screen anytime offline.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleOpenOfflinePlayer}
                    className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    <span>Open Offline Player</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
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
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">Works without internet</span>
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
                    <span className="text-xs font-black text-slate-900">Home Screen Icon</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">Desktop & Mobile app</span>
                  </div>
                </div>

                {/* Device-Specific Guidance (If programmatic prompt not available) */}
                {showManualGuide && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-xs text-indigo-900 space-y-2.5 overflow-hidden"
                  >
                    {isIOS ? (
                      <div>
                        <div className="font-extrabold flex items-center gap-1.5 text-indigo-950 mb-1">
                          <Smartphone size={15} className="text-indigo-600" />
                          <span>Install on iPhone / iPad:</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 text-[11px] leading-relaxed">
                          <li>Tap the <strong>Share button (⎋)</strong> at the bottom of Safari.</li>
                          <li>Scroll down and tap <strong>"Add to Home Screen" (+)</strong>.</li>
                          <li>Tap <strong>Add</strong> at the top right to install SkillForge!</li>
                        </ol>
                      </div>
                    ) : (
                      <div>
                        <div className="font-extrabold flex items-center gap-1.5 text-indigo-950 mb-1">
                          <HelpCircle size={15} className="text-indigo-600" />
                          <span>Install SkillForge in your Browser:</span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Look at your browser address bar at the top right and click the <strong>Install app (⊕)</strong> icon to add SkillForge to your Desktop / Taskbar.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={handleInstallClick}
                    className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    <Download size={18} />
                    <span>Install SkillForge App</span>
                  </button>

                  <button
                    onClick={handleOpenOfflinePlayer}
                    className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <span>Open Offline Player</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </>
            )}

            {/* Footer note */}
            <p className="text-[11px] text-slate-400 text-center font-medium mt-4">
              Standards-Based Progressive Web Application (PWA)
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
