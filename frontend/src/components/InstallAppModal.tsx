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
  const [downloadTriggered, setDownloadTriggered] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  const handleDownloadApp = () => {
    // 1. Direct file download of the standalone offline player
    const link = document.createElement("a");
    link.href = "/SkillForge-Offline-Player.html";
    link.download = "SkillForge-Offline-Player.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadTriggered(true);

    // 2. Also try native PWA installation if available
    triggerInstall().then((outcome) => {
      if (outcome === "accepted") {
        setInstallSuccess(true);
      }
    });
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

                {/* Download / Installed Notification Banner */}
                {downloadTriggered && (
                  <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1 animate-fadeIn">
                    <div className="font-black flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 size={16} />
                      <span>Downloading SkillForge-Offline-Player.html!</span>
                    </div>
                    <p className="text-slate-600 pl-5">
                      Save this file to your Desktop. Whenever you want to view a downloaded course, simply double-click the file and drop your course ZIP!
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={handleDownloadApp}
                    className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    <Download size={18} />
                    <span>Download Desktop App (.html)</span>
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
