import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Download, Laptop, CheckCircle2, ShieldCheck, 
  ExternalLink, Plus, ArrowRight, Smartphone, AlertTriangle, 
  Terminal, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { usePwaInstall } from "../usePwaInstall";
import { useNavigate } from "react-router-dom";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { canInstall, isInstalled, isIOS, triggerInstall, diagnostics } = usePwaInstall();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const navigate = useNavigate();

  const handleInstallClick = async () => {
    if (isInstalled) {
      navigate("/offline-player");
      onClose();
      return;
    }

    if (isIOS) {
      return;
    }

    const outcome = await triggerInstall();
    if (outcome === "accepted") {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    }
  };

  const handleOpenOfflinePlayer = () => {
    navigate("/offline-player");
    onClose();
  };

  const isAlreadyInstalled = isInstalled || installSuccess;

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
            className="relative w-full max-w-lg bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_25px_60px_rgba(0,0,0,0.12)] p-6 sm:p-8 z-10 overflow-hidden text-slate-900 max-h-[92vh] flex flex-col"
          >
            {/* Background Decorative Glow */}
            <div 
              className="absolute -top-20 -right-20 w-52 h-52 pointer-events-none rounded-full blur-3xl opacity-50"
              style={{ background: "radial-gradient(circle, rgba(5, 150, 105, 0.25) 0%, transparent 70%)" }}
            />

            {/* Header */}
            <div className="flex items-start justify-between relative z-10 shrink-0">
              <div className="flex items-center gap-3">
                <img 
                  src="/pwa-192x192.png" 
                  alt="SkillForge App" 
                  className="w-12 h-12 rounded-2xl shadow-md border border-slate-100 object-cover" 
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                      Install SkillForge
                    </h3>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      PWA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">Get SkillForge as an app on your device and use it offline.</p>
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

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 my-4 space-y-4 pr-1">
              {/* If Already Installed */}
              {isAlreadyInstalled ? (
                <div className="my-6 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900">✓ SkillForge Already Installed</h4>
                    <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto mt-1.5 leading-relaxed">
                      SkillForge is installed on your device as a standalone application with offline support.
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1.5">
                        <ShieldCheck size={18} />
                      </div>
                      <span className="text-xs font-black text-slate-900">100% Offline</span>
                      <span className="text-[10px] text-slate-400 font-medium">Works without internet</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-1.5">
                        <Plus size={18} />
                      </div>
                      <span className="text-xs font-black text-slate-900">Drag & Drop ZIP</span>
                      <span className="text-[10px] text-slate-400 font-medium">Auto-structures courses</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5">
                        <Laptop size={18} />
                      </div>
                      <span className="text-xs font-black text-slate-900">Standalone App</span>
                      <span className="text-[10px] text-slate-400 font-medium">Independent window</span>
                    </div>
                  </div>

                  {/* Insecure Context Notice (If testing on http://192.168.x.x) */}
                  {!diagnostics.isSecureContext && !isIOS && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                      <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
                        <AlertTriangle size={15} />
                        <span>Chromium Security Notice (LAN IP)</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Browsers require a <strong>Secure Context</strong> for 1-click installation. You are accessing via unencrypted LAN IP (<code className="font-mono text-slate-800 font-bold">{diagnostics.origin}</code>).
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        👉 To test native 1-click install, open via <strong className="text-slate-900 font-mono">http://localhost:5173</strong> or enable HTTPS with <strong className="text-slate-900 font-mono">npm run dev:https</strong>.
                      </p>
                    </div>
                  )}

                  {/* iPhone / iPad Specific Native Guidance */}
                  {isIOS && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-900 space-y-2">
                      <div className="font-extrabold flex items-center gap-1.5 text-slate-950">
                        <Smartphone size={15} className="text-emerald-600" />
                        <span>Add to Home Screen (iOS):</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 text-[11px] leading-relaxed">
                        <li>Tap the <strong>Share button (⎋)</strong> at the bottom of Safari.</li>
                        <li>Scroll down and tap <strong>"Add to Home Screen" (+)</strong>.</li>
                        <li>Tap <strong>Add</strong> at the top right to complete.</li>
                      </ol>
                    </div>
                  )}

                  {/* Development Diagnostics Drawer */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDiagnostics(!showDiagnostics)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-100/80 hover:bg-slate-200/70 rounded-xl text-[11px] font-bold text-slate-600 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Terminal size={13} className="text-slate-500" />
                        <span>PWA Diagnostics ({diagnostics.isSecureContext ? "Secure" : "Insecure Context"})</span>
                      </span>
                      {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <AnimatePresence>
                      {showDiagnostics && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 p-3 bg-slate-900 rounded-xl text-[10px] font-mono text-slate-300 space-y-1.5 overflow-hidden"
                        >
                          <div className="flex justify-between">
                            <span className="text-slate-400">Secure Context:</span>
                            <span className={diagnostics.isSecureContext ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                              {diagnostics.isSecureContext ? "YES (Secure)" : "NO (Insecure HTTP)"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Origin / Host:</span>
                            <span className="text-slate-200">{diagnostics.hostname || "localhost"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Manifest:</span>
                            <span className={diagnostics.manifestLoaded ? "text-emerald-400 font-bold" : "text-amber-400"}>
                              {diagnostics.manifestLoaded ? "Loaded (200 OK)" : "Checking..."}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Service Worker:</span>
                            <span className={diagnostics.swRegistered ? "text-emerald-400 font-bold" : "text-slate-400"}>
                              {diagnostics.swRegistered ? "Registered & Active" : "Registering..."}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">SW Controlling Page:</span>
                            <span className={diagnostics.swControlling ? "text-emerald-400 font-bold" : "text-slate-400"}>
                              {diagnostics.swControlling ? "YES" : "NO (Will control on next load)"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">beforeinstallprompt:</span>
                            <span className={diagnostics.promptReceived ? "text-emerald-400 font-bold" : "text-amber-400"}>
                              {diagnostics.promptReceived ? "Received & Ready" : diagnostics.isSecureContext ? "Waiting for browser..." : "Blocked by Insecure Origin"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">App Installed:</span>
                            <span className={diagnostics.isInstalled ? "text-emerald-400 font-bold" : "text-slate-400"}>
                              {diagnostics.isInstalled ? "YES" : "NO"}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2 shrink-0">
                    {!isIOS && (
                      <button
                        onClick={handleInstallClick}
                        className={`w-full h-13 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                          canInstall 
                            ? "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10 active:scale-[0.99]" 
                            : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10 active:scale-[0.99]"
                        }`}
                      >
                        <Download size={18} />
                        <span>Install SkillForge App</span>
                      </button>
                    )}

                    <button
                      onClick={handleOpenOfflinePlayer}
                      className={`w-full ${isIOS ? 'h-13 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm' : 'h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs'} rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer`}
                    >
                      <span>Open Standalone Web Player</span>
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Footer note */}
            <p className="text-[11px] text-slate-400 text-center font-medium shrink-0 pt-1">
              Progressive Web App • Desktop, Android & iOS Ready
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
