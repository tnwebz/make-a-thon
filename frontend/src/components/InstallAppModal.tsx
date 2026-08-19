import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Download, Laptop, CheckCircle2, ShieldCheck, 
  ExternalLink, Sparkles, Plus, HelpCircle, HardDrive, 
  Layers, ArrowRight, Smartphone, Share, Check, ArrowDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState<"android" | "windows" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent;
      const android = /Android/i.test(ua);
      const windows = /Windows/i.test(ua);
      const ios = (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) && !(window as any).MSStream;

      setIsAndroid(android);
      setIsWindows(windows);
      setIsIOS(ios);
    }
  }, []);

  const handleDownloadAndroid = () => {
    setDownloadStarted("android");
    // Direct LAN download from Express Backend API
    const downloadUrl = `${API_BASE_URL}/downloads/android-apk`;
    window.location.href = downloadUrl;
  };

  const handleDownloadWindows = () => {
    setDownloadStarted("windows");
    // Direct LAN download from Express Backend API
    const downloadUrl = `${API_BASE_URL}/downloads/windows-app`;
    window.location.href = downloadUrl;
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
                  alt="SkillForge Offline" 
                  className="w-12 h-12 rounded-2xl shadow-md border border-slate-100 object-cover" 
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
                      SkillForge Offline
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Native Client
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

            {/* Feature Highlights Bento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-6">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                  <ShieldCheck size={18} />
                </div>
                <span className="text-xs font-black text-slate-900">100% Offline</span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">Router OFF &bull; 0 Wi-Fi</span>
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
                  <HardDrive size={18} />
                </div>
                <span className="text-xs font-black text-slate-900">Saved Locally</span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">Permanent on device</span>
              </div>
            </div>

            {/* Download Status Notification */}
            {downloadStarted && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5"
              >
                <div className="font-black flex items-center gap-1.5 text-emerald-700 text-sm">
                  <CheckCircle2 size={16} />
                  <span>Download Started!</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {downloadStarted === "android" 
                    ? "Install the SkillForge-Offline.apk file on your Android phone. When prompted, tap 'Install' or 'Allow from this source'."
                    : "Run the SkillForge-Offline installer on your PC. After installation, launch the app from your Desktop!"}
                </p>
              </motion.div>
            )}

            {/* Platform Download Actions */}
            <div className="space-y-2.5 pt-1">
              {/* If on Android -> Android APK is primary */}
              {isAndroid ? (
                <>
                  <button
                    onClick={handleDownloadAndroid}
                    className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    <Smartphone size={18} className="text-emerald-400" />
                    <span>Download Android App (.apk)</span>
                  </button>

                  <button
                    onClick={handleDownloadWindows}
                    className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Laptop size={15} />
                    <span>Download Windows Desktop App (.exe)</span>
                  </button>
                </>
              ) : isWindows ? (
                /* If on Windows -> Windows Installer is primary */
                <>
                  <button
                    onClick={handleDownloadWindows}
                    className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    <Laptop size={18} className="text-emerald-400" />
                    <span>Download Windows Desktop App (.exe)</span>
                  </button>

                  <button
                    onClick={handleDownloadAndroid}
                    className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Smartphone size={15} />
                    <span>Download Android App (.apk)</span>
                  </button>
                </>
              ) : isIOS ? (
                /* If on iOS */
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
                    <Smartphone size={16} />
                    <span>iOS Standalone Web App:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                    <li>Tap the <strong>Share button (⎋)</strong> at the bottom of Safari.</li>
                    <li>Scroll down and tap <strong>"Add to Home Screen" (+)</strong>.</li>
                    <li>Tap <strong>Add</strong> at top right to launch SkillForge standalone!</li>
                  </ol>
                </div>
              ) : (
                /* Fallback (Other OS) */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadAndroid}
                    className="h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Smartphone size={15} className="text-emerald-400" />
                    <span>Android APK</span>
                  </button>
                  <button
                    onClick={handleDownloadWindows}
                    className="h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Laptop size={15} className="text-emerald-400" />
                    <span>Windows (.exe)</span>
                  </button>
                </div>
              )}

              {/* Standalone Web Player Button */}
              <button
                onClick={handleOpenOfflinePlayer}
                className="w-full h-11 rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent hover:border-slate-200"
              >
                <span>Open Standalone Web Player</span>
                <ExternalLink size={13} />
              </button>
            </div>

            {/* Footer note */}
            <p className="text-[11px] text-slate-400 text-center font-medium mt-4">
              Direct Local LAN Download &bull; Works 100% without internet
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
