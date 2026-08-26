import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Download, Laptop, CheckCircle2, ShieldCheck, 
  ExternalLink, Plus, HardDrive, Smartphone, Loader2, AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import axios from "axios";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareCode?: string;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose, shareCode }) => {
  const navigate = useNavigate();
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const [downloadState, setDownloadState] = useState<{
    status: "IDLE" | "DOWNLOADING" | "COMPLETED" | "ERROR";
    type: "android" | "windows" | null;
    percent: number;
    bytesTransferred: number;
    totalBytes: number;
    speed: string;
    errorMsg: string | null;
  }>({
    status: "IDLE",
    type: null,
    percent: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    speed: "",
    errorMsg: null,
  });

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

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return (bytes / 1024).toFixed(0) + " KB";
    return mb.toFixed(1) + " MB";
  };

  const reportProgress = async (
    fileName: string,
    bytes: number,
    total: number,
    pct: number,
    spd: string,
    st: "DOWNLOADING" | "COMPLETED" | "FAILED"
  ) => {
    const code = shareCode || "";
    const clientId = localStorage.getItem("skillforge_client_id") || "";
    if (!code || !clientId) return;

    try {
      await axios.post(`${API_BASE_URL}/share-sessions/${code}/download-progress`, {
        clientId,
        fileName,
        bytesTransferred: bytes,
        totalBytes: total,
        percent: pct,
        speed: spd,
        status: st
      });
    } catch (e) {
      // Silently catch beacon errors
    }
  };

  const startStreamedDownload = async (type: "android" | "windows") => {
    const fileName = type === "android" ? "SkillForge-Offline.apk" : "SkillForge-Offline-Setup.exe";
    const endpoint = type === "android" ? "android-apk" : "windows-app";
    const clientId = localStorage.getItem("skillforge_client_id") || "";
    const code = shareCode || "";

    setDownloadState({
      status: "DOWNLOADING",
      type,
      percent: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      speed: "0 MB/s",
      errorMsg: null
    });

    try {
      const startTime = Date.now();
      let lastReport = 0;

      // Pass query params so server knows who is requesting
      const params = new URLSearchParams();
      if (clientId) params.set("clientId", clientId);
      if (code) params.set("shareCode", code);
      const qs = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(`${API_BASE_URL}/downloads/${endpoint}${qs}`);
      if (!response.ok || !response.body) {
        throw new Error(`Download request failed (Status ${response.status})`);
      }

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : (type === "android" ? 5.4 * 1024 * 1024 : 95 * 1024 * 1024);

      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let receivedBytes = 0;

      // Initial 0% report
      reportProgress(fileName, 0, total, 0, "0 MB/s", "DOWNLOADING");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        const now = Date.now();
        const elapsedSec = (now - startTime) / 1000;
        const spd = elapsedSec > 0 ? (receivedBytes / (1024 * 1024 * elapsedSec)).toFixed(1) + " MB/s" : "0 MB/s";
        const pct = total > 0 ? Math.min(99, Math.round((receivedBytes / total) * 100)) : 50;

        setDownloadState(prev => ({
          ...prev,
          bytesTransferred: receivedBytes,
          totalBytes: Math.max(total, receivedBytes),
          percent: pct,
          speed: spd
        }));

        if (now - lastReport > 200) {
          lastReport = now;
          reportProgress(fileName, receivedBytes, Math.max(total, receivedBytes), pct, spd, "DOWNLOADING");
        }
      }

      // Assemble binary blob and trigger browser download prompt
      const mimeType = type === "android" ? "application/vnd.android.package-archive" : "application/octet-stream";
      const blob = new Blob(chunks, { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);

      const totalElapsed = (Date.now() - startTime) / 1000;
      const finalSpeed = totalElapsed > 0 ? (receivedBytes / (1024 * 1024 * totalElapsed)).toFixed(1) + " MB/s" : "";

      setDownloadState({
        status: "COMPLETED",
        type,
        percent: 100,
        bytesTransferred: receivedBytes,
        totalBytes: receivedBytes,
        speed: finalSpeed,
        errorMsg: null
      });

      // Final 100% completed report
      await reportProgress(fileName, receivedBytes, receivedBytes, 100, finalSpeed, "COMPLETED");
    } catch (err: any) {
      console.error("Stream download error:", err);
      setDownloadState(prev => ({
        ...prev,
        status: "ERROR",
        errorMsg: err.message || "Failed to complete download"
      }));
      reportProgress(fileName, 0, 0, 0, "", "FAILED");
    }
  };

  const handleOpenOfflinePlayer = () => {
    navigate("/offline-player");
    onClose();
  };

  const isDownloading = downloadState.status === "DOWNLOADING";
  const isCompleted = downloadState.status === "COMPLETED";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isDownloading && onClose()}
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
                disabled={isDownloading}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-30"
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

            {/* REAL-TIME IN-MODAL DOWNLOAD PROGRESS BAR */}
            {isDownloading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-2.5 shadow-2xs"
              >
                <div className="flex justify-between items-center font-bold">
                  <div className="flex items-center gap-2 text-indigo-900">
                    <Loader2 size={15} className="animate-spin text-indigo-600 shrink-0" />
                    <span className="font-extrabold">
                      Downloading {downloadState.type === "android" ? "Android APK" : "Windows App"}...
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-indigo-600 font-semibold">{downloadState.speed}</span>
                    <span className="text-indigo-950 font-black">{downloadState.percent}%</span>
                  </div>
                </div>

                {/* Progress Track */}
                <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden border border-indigo-200/70">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadState.percent}%` }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                  <span>
                    {formatBytes(downloadState.bytesTransferred)} of {formatBytes(downloadState.totalBytes)}
                  </span>
                  <span>Receiving chunks directly over Wi-Fi...</span>
                </div>
              </motion.div>
            )}

            {/* DOWNLOAD COMPLETED NOTIFICATION */}
            {isCompleted && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5 shadow-2xs"
              >
                <div className="font-black flex items-center gap-1.5 text-emerald-700 text-sm">
                  <CheckCircle2 size={16} />
                  <span>Download Complete! (100%)</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {downloadState.type === "android" 
                    ? "SkillForge-Offline.apk is saved on your device. Open your Downloads folder and tap 'Install'."
                    : "SkillForge-Offline installer is saved. Run the file to install the desktop player!"}
                </p>
              </motion.div>
            )}

            {/* ERROR ALERT */}
            {downloadState.status === "ERROR" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
              >
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <span>{downloadState.errorMsg || "Download failed. Please check Wi-Fi connection."}</span>
              </motion.div>
            )}

            {/* Platform Download Actions */}
            <div className="space-y-2.5 pt-1">
              {/* If on Android -> Android APK is primary */}
              {isAndroid ? (
                <>
                  <button
                    onClick={() => startStreamedDownload("android")}
                    disabled={isDownloading}
                    className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    {isDownloading && downloadState.type === "android" ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-emerald-400" />
                        <span>Downloading APK ({downloadState.percent}%)...</span>
                      </>
                    ) : (
                      <>
                        <Smartphone size={18} className="text-emerald-400" />
                        <span>Download Android App (.apk)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => startStreamedDownload("windows")}
                    disabled={isDownloading}
                    className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Laptop size={15} />
                    <span>Download Windows Desktop App (.exe)</span>
                  </button>
                </>
              ) : isWindows ? (
                /* If on Windows -> Windows Installer is primary */
                <>
                  <button
                    onClick={() => startStreamedDownload("windows")}
                    disabled={isDownloading}
                    className="w-full h-13 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
                  >
                    {isDownloading && downloadState.type === "windows" ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-emerald-400" />
                        <span>Downloading Windows App ({downloadState.percent}%)...</span>
                      </>
                    ) : (
                      <>
                        <Laptop size={18} className="text-emerald-400" />
                        <span>Download Windows Desktop App (.exe)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => startStreamedDownload("android")}
                    disabled={isDownloading}
                    className="w-full h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                    onClick={() => startStreamedDownload("android")}
                    disabled={isDownloading}
                    className="h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Smartphone size={15} className="text-emerald-400" />
                    <span>Android APK</span>
                  </button>
                  <button
                    onClick={() => startStreamedDownload("windows")}
                    disabled={isDownloading}
                    className="h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Laptop size={15} className="text-emerald-400" />
                    <span>Windows (.exe)</span>
                  </button>
                </div>
              )}

              {/* Standalone Web Player Button */}
              <button
                onClick={handleOpenOfflinePlayer}
                disabled={isDownloading}
                className="w-full h-11 rounded-2xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-transparent hover:border-slate-200 disabled:opacity-40"
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
