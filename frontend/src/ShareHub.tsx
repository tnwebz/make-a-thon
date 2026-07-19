import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { openDB } from "idb";
import type { IDBPDatabase } from "idb";
import axios from "axios";
import {
  ArrowLeft, Upload, Download, Share2, Copy, Check, Play, Trash2,
  Wifi, WifiOff, Loader2, X, Film, HardDrive, CheckCircle2
} from "lucide-react";

const API = "http://127.0.0.1:8000";

// IndexedDB helper
const getDB = async (): Promise<IDBPDatabase> => {
  return openDB("skillforge-offline", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos", { keyPath: "id" });
      }
    },
  });
};

interface DownloadedVideo {
  filename: string;
  title: string;
  size: number;
  thumbnail: string;
  downloadedAt: string;
}

interface OfflineVideo {
  id: string;
  title: string;
  size: number;
  blob: Blob;
  receivedAt: string;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const ShareHub = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"send" | "receive">(searchParams.get("code") ? "receive" : "send");

  // Sender state
  const [downloads, setDownloads] = useState<DownloadedVideo[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(true);
  const [sharingFilename, setSharingFilename] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [peerCount, setPeerCount] = useState(0);
  const [transfersDone, setTransfersDone] = useState(0);
  const [copied, setCopied] = useState(false);

  // Receiver state
  const [codeInput, setCodeInput] = useState(searchParams.get("code") || "");
  const [receiving, setReceiving] = useState(false);
  const [receivingTitle, setReceivingTitle] = useState("");
  const [receivingSize, setReceivingSize] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [receiveError, setReceiveError] = useState("");
  const [receiveSuccess, setReceiveSuccess] = useState(false);

  // Offline library
  const [offlineVideos, setOfflineVideos] = useState<OfflineVideo[]>([]);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Load downloaded videos (sender)
  useEffect(() => {
    fetchDownloads();
    loadOfflineLibrary();
  }, []);

  // Connect Socket.IO
  useEffect(() => {
    const socket = io(API, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("room-created", (data: { code: string }) => {
      setRoomCode(data.code);
      // Detect local IP for the share URL
      axios.get(`${API}/api/v1/offline/local-ip`).then(res => {
        setShareUrl(`http://${res.data.ip}:5173/share-hub?code=${data.code}`);
      }).catch(() => {
        setShareUrl(`http://192.168.137.1:5173/share-hub?code=${data.code}`);
      });
    });

    socket.on("peer-joined", () => {
      setPeerCount(prev => prev + 1);
    });

    socket.on("transfer-done", () => {
      setTransfersDone(prev => prev + 1);
    });

    socket.on("room-joined", async (data: { title: string; fileSize: number; downloadUrl: string }) => {
      setReceivingTitle(data.title);
      setReceivingSize(data.fileSize);
      setReceiving(true);
      setReceiveError("");

      try {
        // Download the file via HTTP
        const response = await axios.get(`${API}${data.downloadUrl}`, {
          responseType: "blob",
          onDownloadProgress: (event) => {
            if (event.total) {
              setDownloadProgress(Math.round((event.loaded / event.total) * 100));
            }
          }
        });

        // Save to IndexedDB
        const db = await getDB();
        const videoRecord = {
          id: `offline_${Date.now()}`,
          title: data.title,
          size: response.data.size,
          blob: response.data,
          receivedAt: new Date().toISOString()
        };
        await db.put("videos", videoRecord);

        setReceiveSuccess(true);
        setReceiving(false);

        // Notify sender
        const code = codeInput || searchParams.get("code");
        if (code) socket.emit("transfer-complete", { code });

        loadOfflineLibrary();
      } catch (err) {
        console.error("Transfer error:", err);
        setReceiveError("Failed to download the video. Please try again.");
        setReceiving(false);
      }
    });

    socket.on("room-error", (data: { message: string }) => {
      setReceiveError(data.message);
    });

    socket.on("room-closed", () => {
      setRoomCode(null);
      setSharingFilename(null);
    });

    return () => { socket.disconnect(); };
  }, []);

  const fetchDownloads = async () => {
    setLoadingDownloads(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/v1/offline/downloads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDownloads(res.data);
    } catch (err) {
      console.error("Failed to fetch downloads:", err);
    } finally {
      setLoadingDownloads(false);
    }
  };

  const loadOfflineLibrary = async () => {
    try {
      const db = await getDB();
      const all = await db.getAll("videos");
      setOfflineVideos(all as OfflineVideo[]);
    } catch (err) {
      console.error("IndexedDB error:", err);
    }
  };

  const handleShare = (video: DownloadedVideo) => {
    setSharingFilename(video.filename);
    setPeerCount(0);
    setTransfersDone(0);
    socketRef.current?.emit("create-room", {
      filename: video.filename,
      title: video.title,
      fileSize: video.size,
      thumbnail: video.thumbnail
    });
  };

  const handleStopSharing = () => {
    if (roomCode) {
      socketRef.current?.emit("close-room", { code: roomCode });
    }
    setRoomCode(null);
    setSharingFilename(null);
  };

  const handleJoinRoom = () => {
    if (codeInput.length !== 4) {
      setReceiveError("Please enter a valid 4-digit code");
      return;
    }
    setReceiveError("");
    setReceiveSuccess(false);
    setDownloadProgress(0);
    socketRef.current?.emit("join-room", { code: codeInput });
  };

  const handlePlayOffline = async (video: OfflineVideo) => {
    if (playingVideo === video.id) {
      if (playingUrl) URL.revokeObjectURL(playingUrl);
      setPlayingVideo(null);
      setPlayingUrl(null);
      return;
    }
    const url = URL.createObjectURL(video.blob);
    setPlayingUrl(url);
    setPlayingVideo(video.id);
  };

  const handleDeleteOffline = async (id: string) => {
    const db = await getDB();
    await db.delete("videos", id);
    if (playingVideo === id) {
      if (playingUrl) URL.revokeObjectURL(playingUrl);
      setPlayingVideo(null);
      setPlayingUrl(null);
    }
    loadOfflineLibrary();
  };

  const handleDeleteDownload = async (filename: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/v1/offline/downloads/${filename}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDownloads();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/student-dashboard")} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Share2 size={24} className="text-emerald-400" /> ShareHub
              </h1>
              <p className="text-sm text-slate-400">Offline video sharing over local network</p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1.5">
            <button
              onClick={() => { setMode("send"); setReceiveError(""); setReceiveSuccess(false); }}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${mode === "send" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "text-slate-400 hover:text-white"}`}
            >
              <Upload size={16} /> SEND
            </button>
            <button
              onClick={() => { setMode("receive"); }}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${mode === "receive" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" : "text-slate-400 hover:text-white"}`}
            >
              <Download size={16} /> RECEIVE
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {mode === "send" ? (
            <motion.div key="send" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              {/* Active Sharing Panel */}
              {roomCode && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-3xl p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-black text-emerald-400 flex items-center gap-2">
                        <Wifi size={20} className="animate-pulse" /> Sharing Active
                      </h3>
                      <p className="text-slate-400 text-sm mt-1">Share the room code and URL with your peers</p>
                    </div>
                    <button onClick={handleStopSharing} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-bold text-sm hover:bg-red-500/30 transition-colors flex items-center gap-2">
                      <X size={14} /> Stop Sharing
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Room Code Display */}
                    <div className="bg-black/30 rounded-2xl p-6 text-center">
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-4">Room Code</p>
                      <div className="flex items-center justify-center gap-3 mb-4">
                        {roomCode.split("").map((digit, i) => (
                          <div key={i} className="w-16 h-20 bg-white/10 border-2 border-emerald-500/50 rounded-2xl flex items-center justify-center text-4xl font-black text-emerald-400 shadow-lg shadow-emerald-500/10">
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Share URL */}
                    <div className="bg-black/30 rounded-2xl p-6">
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-4">Share This URL</p>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                        <code className="flex-1 text-sm text-emerald-300 truncate">{shareUrl}</code>
                        <button onClick={() => copyToClipboard(shareUrl)} className="p-2 bg-emerald-500/20 rounded-lg hover:bg-emerald-500/30 transition-colors">
                          {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-emerald-400" />}
                        </button>
                      </div>
                      <div className="mt-4 flex items-center gap-6 text-sm">
                        <span className="text-slate-400">Peers connected: <span className="text-white font-bold">{peerCount}</span></span>
                        <span className="text-slate-400">Transfers done: <span className="text-emerald-400 font-bold">{transfersDone}</span></span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Downloaded Videos Grid */}
              <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                <Film size={20} className="text-emerald-400" /> Downloaded Videos
              </h3>

              {loadingDownloads ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={32} className="animate-spin text-emerald-400" />
                </div>
              ) : downloads.length === 0 ? (
                <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10">
                  <HardDrive size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 font-bold text-lg">No downloads yet</p>
                  <p className="text-slate-500 text-sm mt-1">Go to a course player and download a YouTube video first</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {downloads.map((video) => (
                    <motion.div key={video.filename} layout className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all group">
                      {video.thumbnail && (
                        <div className="aspect-video bg-black relative overflow-hidden">
                          <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded-lg text-xs font-bold text-white">{formatBytes(video.size)}</div>
                        </div>
                      )}
                      <div className="p-4">
                        <h4 className="font-bold text-white text-sm truncate mb-3">{video.title}</h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleShare(video)}
                            disabled={!!sharingFilename}
                            className="flex-1 py-2.5 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Share2 size={14} /> Share
                          </button>
                          <button onClick={() => handleDeleteDownload(video.filename)} className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="receive" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>

              {/* Receive Panel */}
              <div className="max-w-xl mx-auto">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                  <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Download size={32} className="text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-black mb-2">Receive a Video</h3>
                  <p className="text-slate-400 mb-8">Enter the 4-digit room code shared by the sender</p>

                  {!receiving && !receiveSuccess && (
                    <>
                      <div className="flex items-center justify-center gap-3 mb-6">
                        {[0, 1, 2, 3].map((i) => (
                          <input
                            key={i}
                            type="text"
                            maxLength={1}
                            value={codeInput[i] || ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              const newCode = codeInput.split("");
                              newCode[i] = val;
                              setCodeInput(newCode.join(""));
                              if (val && e.target.nextElementSibling) {
                                (e.target.nextElementSibling as HTMLInputElement).focus();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !codeInput[i] && i > 0) {
                                const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
                                if (prev) prev.focus();
                              }
                            }}
                            className="w-16 h-20 bg-white/5 border-2 border-white/20 rounded-2xl text-center text-4xl font-black text-blue-400 focus:border-blue-500 focus:outline-none transition-colors"
                          />
                        ))}
                      </div>

                      {receiveError && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm font-bold mb-4">{receiveError}</motion.p>
                      )}

                      <button
                        onClick={handleJoinRoom}
                        disabled={codeInput.length !== 4}
                        className="w-full py-4 bg-blue-500 text-white font-black text-lg rounded-2xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Download size={20} /> Join & Receive
                      </button>
                    </>
                  )}

                  {receiving && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <p className="text-white font-bold text-lg">{receivingTitle}</p>
                      <p className="text-slate-400 text-sm">{formatBytes(receivingSize)}</p>
                      <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${downloadProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <p className="text-blue-400 font-bold">{downloadProgress}% downloaded...</p>
                    </motion.div>
                  )}

                  {receiveSuccess && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={32} className="text-emerald-400" />
                      </div>
                      <p className="text-emerald-400 font-black text-xl">Transfer Complete!</p>
                      <p className="text-slate-400 text-sm">The video has been saved to your Offline Library below</p>
                      <button
                        onClick={() => { setReceiveSuccess(false); setCodeInput(""); setDownloadProgress(0); }}
                        className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
                      >
                        Receive Another
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Offline Library */}
        <div className="mt-12">
          <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
            <HardDrive size={20} className="text-blue-400" /> My Offline Library
            <span className="text-slate-500 text-sm font-normal ml-2">({offlineVideos.length} videos stored in browser)</span>
          </h3>

          {offlineVideos.length === 0 ? (
            <div className="text-center py-10 bg-white/5 rounded-3xl border border-white/10">
              <WifiOff size={36} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-500 font-bold">No offline videos yet</p>
              <p className="text-slate-600 text-sm mt-1">Receive videos from peers to watch offline</p>
            </div>
          ) : (
            <div className="space-y-4">
              {offlineVideos.map((video) => (
                <motion.div key={video.id} layout className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <Film size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{video.title}</h4>
                        <p className="text-slate-500 text-xs">{formatBytes(video.size)} · Received {new Date(video.receivedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handlePlayOffline(video)} className={`px-4 py-2.5 font-bold text-sm rounded-xl transition-colors flex items-center gap-2 ${playingVideo === video.id ? "bg-red-500/20 text-red-400" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}>
                        {playingVideo === video.id ? <><X size={14} /> Close</> : <><Play size={14} /> Play</>}
                      </button>
                      <button onClick={() => handleDeleteOffline(video.id)} className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Inline Video Player */}
                  <AnimatePresence>
                    {playingVideo === video.id && playingUrl && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                        <div className="px-4 pb-4">
                          <video
                            src={playingUrl}
                            controls
                            autoPlay
                            className="w-full rounded-xl bg-black"
                            style={{ maxHeight: "500px" }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareHub;
