import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import axios from "axios";
import { 
  ArrowLeft, Share2, Eye, Download, Copy, Check, ShieldAlert, 
  Sparkles, Radio, RefreshCw, Power, Clock, CheckCircle2, CheckCircle, Lock, Link as LinkIcon,
  Users, Smartphone, Laptop, Globe, Loader2, ArrowDownCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ShareSessionItem {
  id: number;
  shareCode: string;
  accessMode: "VIEW_ONLY" | "ALLOW_DOWNLOAD";
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  passkey?: string;
  shareUrl?: string;
}

interface ConnectedClient {
  clientId: string;
  studentName: string;
  deviceType: string;
  ip: string;
  joinedAt: string;
  lastSeenAt: string;
  status: "ONLINE" | "AWAY";
  downloadProgress?: {
    fileName: string;
    bytesTransferred: number;
    totalBytes: number;
    percent: number;
    status: "DOWNLOADING" | "COMPLETED" | "FAILED" | "CANCELLED";
    speed?: string;
    updatedAt: string;
  } | null;
}

const InstructorShareHub: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ShareSessionItem[]>([]);
  const [accessMode, setAccessMode] = useState<"VIEW_ONLY" | "ALLOW_DOWNLOAD">("VIEW_ONLY");
  const [creating, setCreating] = useState(false);
  const [activeSession, setActiveSession] = useState<ShareSessionItem | null>(null);
  const [newlyCreatedSession, setNewlyCreatedSession] = useState<ShareSessionItem | null>(null);
  
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPasskey, setCopiedPasskey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingMode, setUpdatingMode] = useState(false);

  // Live Connected Students & Transfer State
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [totalConnected, setTotalConnected] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    fetchCourseAndSessions();
  }, [courseId]);

  const fetchCourseAndSessions = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem("token");
      // Fetch course details
      const courseRes = await axios.get(`${API_BASE_URL}/courses/${courseId}/player`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourse(courseRes.data);

      // Fetch existing share sessions for this course
      const sessionRes = await axios.get(`${API_BASE_URL}/share-sessions?courseId=${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const fetchedSessions: ShareSessionItem[] = sessionRes.data;
      setSessions(fetchedSessions);

      // Find if there is an active session
      const active = fetchedSessions.find(s => s.status === "ACTIVE");
      if (active) {
        setActiveSession(active);
      } else {
        setActiveSession(null);
      }
    } catch (err: any) {
      console.error("Failed to load share hub data", err);
      setErrorMsg("Failed to load course details or share sessions.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    setCreating(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/share-sessions`,
        { courseId: Number(courseId), accessMode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const created: ShareSessionItem = res.data;
      setNewlyCreatedSession(created);
      setActiveSession(created);
      setSessions(prev => [created, ...prev]);
    } catch (err: any) {
      console.error("Failed to create share session", err);
      setErrorMsg(err.response?.data?.detail || "Failed to create share session.");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateActiveMode = async (newMode: "VIEW_ONLY" | "ALLOW_DOWNLOAD") => {
    if (!activeSession || activeSession.accessMode === newMode || updatingMode) return;
    setUpdatingMode(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE_URL}/share-sessions/${activeSession.shareCode}/mode`,
        { accessMode: newMode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActiveSession(prev => prev ? { ...prev, accessMode: newMode } : null);
      setSessions(prev => prev.map(s => s.shareCode === activeSession.shareCode ? { ...s, accessMode: newMode } : s));
    } catch (err) {
      console.error("Failed to update access mode", err);
      alert("Failed to update access mode.");
    } finally {
      setUpdatingMode(false);
    }
  };

  const handleRevokeSession = async (shareCode: string) => {
    if (!confirm("Are you sure you want to stop sharing? Students will immediately lose access.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/share-sessions/${shareCode}/revoke`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (activeSession && activeSession.shareCode === shareCode) {
        setActiveSession(null);
        setNewlyCreatedSession(null);
      }
      setSessions(prev => prev.map(s => s.shareCode === shareCode ? { ...s, status: "REVOKED" } : s));
    } catch (err: any) {
      console.error("Failed to revoke session", err);
      alert("Failed to revoke share session.");
    }
  };

  const getShareUrl = (code: string) => {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//${window.location.hostname}${port}/share/${code}`;
  };

  // Live polling for connected students & download transfer progress
  useEffect(() => {
    if (!activeSession?.shareCode) {
      setClients([]);
      setTotalConnected(0);
      setActiveCount(0);
      return;
    }

    const fetchClients = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/share-sessions/${activeSession.shareCode}/clients`);
        setClients(res.data.clients || []);
        setTotalConnected(res.data.totalConnected || 0);
        setActiveCount(res.data.activeCount || 0);
      } catch (err) {
        // Silently catch in polling loop
      }
    };

    fetchClients();
    const interval = setInterval(fetchClients, 2500); // 2.5s live polling
    return () => clearInterval(interval);
  }, [activeSession?.shareCode]);

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return (bytes / 1024).toFixed(0) + " KB";
    return mb.toFixed(1) + " MB";
  };

  const getDeviceIcon = (deviceType?: string) => {
    const dt = (deviceType || "").toLowerCase();
    if (dt.includes("android")) return <Smartphone size={14} className="text-emerald-600" />;
    if (dt.includes("ios") || dt.includes("iphone") || dt.includes("ipad")) return <Smartphone size={14} className="text-indigo-600" />;
    if (dt.includes("windows") || dt.includes("pc") || dt.includes("mac") || dt.includes("desktop")) return <Laptop size={14} className="text-blue-600" />;
    return <Globe size={14} className="text-slate-600" />;
  };

  const copyToClipboard = (text: string, type: "link" | "passkey") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedPasskey(true);
      setTimeout(() => setCopiedPasskey(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400 font-medium">
          <RefreshCw className="animate-spin text-slate-800" size={32} />
          <span>Setting up Share Hub...</span>
        </div>
      </div>
    );
  }

  const activeUrl = activeSession ? (activeSession.shareUrl || getShareUrl(activeSession.shareCode)) : '';

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Back Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard/courses")}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors bg-white border border-slate-200/80 px-4 py-2.5 rounded-2xl shadow-sm"
          >
            <ArrowLeft size={18} />
            Back to Courses
          </button>
          
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full border border-emerald-200 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Local Offline LAN Share Engine
          </div>
        </div>

        {/* Course Banner */}
        <div className="bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {course?.image_url ? (
              <img
                src={course.image_url}
                alt={course.title}
                className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-sm">
                {course?.title?.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 mb-1">
                Offline Classroom Hub
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {course?.title}
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {course?.modules?.length || 0} Modules available for local broadcast
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2">
            <ShieldAlert size={18} />
            {errorMsg}
          </div>
        )}

        {/* Active Session Display OR Create New Session */}
        {activeSession ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-md space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100/80 text-emerald-700 rounded-2xl">
                  <Share2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">Active Share Session</h2>
                    <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Students connected to your Airtel Router Wi-Fi can access this course.
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRevokeSession(activeSession.shareCode)}
                className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 font-semibold px-4 py-2.5 rounded-2xl transition-colors text-sm cursor-pointer"
              >
                <Power size={16} />
                Stop Sharing
              </button>
            </div>

            {/* Interactive Live Access Mode Switcher */}
            <div className="space-y-3 bg-slate-50 border border-slate-200/70 p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                    Student Permission Mode
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    Click to instantly switch between View Only and Download permissions for connected students:
                  </p>
                </div>
                {updatingMode && (
                  <span className="text-xs font-bold text-blue-600 animate-pulse">
                    Updating permissions...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Switch to View Only */}
                <button
                  type="button"
                  onClick={() => handleUpdateActiveMode("VIEW_ONLY")}
                  disabled={updatingMode}
                  className={`p-3.5 rounded-xl border-2 flex items-center gap-3 transition-all text-left cursor-pointer ${
                    activeSession.accessMode === "VIEW_ONLY"
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/50"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${activeSession.accessMode === "VIEW_ONLY" ? "bg-slate-800 text-amber-400" : "bg-slate-100 text-slate-600"}`}>
                    <Eye size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span>View Only</span>
                      {activeSession.accessMode === "VIEW_ONLY" && (
                        <span className="text-[10px] bg-emerald-500 text-slate-900 font-black px-1.5 py-0.5 rounded">ACTIVE</span>
                      )}
                    </div>
                    <div className={`text-[11px] font-medium ${activeSession.accessMode === "VIEW_ONLY" ? "text-slate-300" : "text-slate-400"}`}>
                      Stream and view content only (no downloads)
                    </div>
                  </div>
                </button>

                {/* Switch to Allow Download */}
                <button
                  type="button"
                  onClick={() => handleUpdateActiveMode("ALLOW_DOWNLOAD")}
                  disabled={updatingMode}
                  className={`p-3.5 rounded-xl border-2 flex items-center gap-3 transition-all text-left cursor-pointer ${
                    activeSession.accessMode === "ALLOW_DOWNLOAD"
                      ? "bg-indigo-950 border-indigo-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/50"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${activeSession.accessMode === "ALLOW_DOWNLOAD" ? "bg-indigo-900 text-indigo-300" : "bg-slate-100 text-slate-600"}`}>
                    <Download size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span>Allow Download</span>
                      {activeSession.accessMode === "ALLOW_DOWNLOAD" && (
                        <span className="text-[10px] bg-indigo-400 text-indigo-950 font-black px-1.5 py-0.5 rounded">ACTIVE</span>
                      )}
                    </div>
                    <div className={`text-[11px] font-medium ${activeSession.accessMode === "ALLOW_DOWNLOAD" ? "text-indigo-200" : "text-slate-400"}`}>
                      Students can download full course & module ZIPs
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* URL & Passkey Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Share URL Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <LinkIcon size={14} />
                  Student Access Link
                </label>
                <div className="flex items-center gap-2 bg-slate-900 text-slate-100 p-2.5 pl-4 rounded-2xl">
                  <span className="font-mono text-xs font-semibold tracking-wide truncate flex-1 select-all">
                    {activeUrl}
                  </span>
                  <button
                    onClick={() => copyToClipboard(activeUrl, "link")}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors shrink-0"
                  >
                    {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copiedLink ? "Copied!" : "Copy Link"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Students open this exact link on their phones connected to router Wi-Fi.
                </p>
              </div>

              {/* Passkey Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={14} />
                  Classroom Access Passkey
                </label>

                <div className="flex items-center gap-2 bg-amber-50 border-2 border-amber-200 text-amber-900 p-2.5 pl-4 rounded-2xl shadow-xs">
                  <span className="font-mono text-lg font-black tracking-widest flex-1 select-all text-amber-950">
                    {newlyCreatedSession?.passkey || activeSession.passkey || activeSession.shareCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedSession?.passkey || activeSession.passkey || activeSession.shareCode, "passkey")}
                    className="flex items-center gap-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    {copiedPasskey ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                    {copiedPasskey ? "Copied!" : "Copy Key"}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  Share this key with students to unlock course content on their devices.
                </p>
              </div>
            </div>

            {/* ============================================================ */}
            {/* LIVE CONNECTED STUDENTS & REAL-TIME DATA TRANSFER MONITOR */}
            {/* ============================================================ */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200/60 shadow-2xs">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Connected Students & Devices
                      </h3>
                      <span className="bg-emerald-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-2xs">
                        {totalConnected} {totalConnected === 1 ? "Connected" : "Connected"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Real-time live attendance & course file download transfer tracking
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 shadow-2xs">
                    <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                    <span>{activeCount} Active Online</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:inline bg-slate-100 px-2 py-1 rounded-md">
                    Live Sync 2.5s
                  </span>
                </div>
              </div>

              {/* Student Devices List or Empty State */}
              {clients.length === 0 ? (
                <div className="bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                    <Users size={22} />
                  </div>
                  <div className="text-sm font-bold text-slate-700">No Students Connected Yet</div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    When students open the access link, enter their name, and unlock the course, they will appear here with live device info and file download progress bars.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {clients.map((client) => {
                    const isDownloading = client.downloadProgress?.status === "DOWNLOADING";
                    const isCompleted = client.downloadProgress?.status === "COMPLETED";
                    const isFailed = client.downloadProgress?.status === "FAILED" || client.downloadProgress?.status === "CANCELLED";
                    const percent = client.downloadProgress?.percent || 0;

                    return (
                      <div
                        key={client.clientId}
                        className={`rounded-2xl border transition-all p-4 space-y-3 ${
                          isDownloading
                            ? "bg-indigo-50/50 border-indigo-200 shadow-xs"
                            : isCompleted
                            ? "bg-emerald-50/40 border-emerald-200"
                            : "bg-slate-50/60 border-slate-200/80 hover:border-slate-300 shadow-2xs"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Student identity */}
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl font-black text-sm flex items-center justify-center shadow-xs ${
                              isDownloading
                                ? "bg-indigo-600 text-white animate-pulse"
                                : isCompleted
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-900 text-white"
                            }`}>
                              {client.studentName.charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900">
                                  {client.studentName}
                                </span>
                                {client.status === "ONLINE" ? (
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300/60 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    ONLINE
                                  </span>
                                ) : (
                                  <span className="bg-slate-200/80 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    IDLE
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                                <span className="flex items-center gap-1 font-semibold text-slate-700">
                                  {getDeviceIcon(client.deviceType)}
                                  {client.deviceType}
                                </span>
                                <span>•</span>
                                <span className="font-mono text-slate-400">{client.ip}</span>
                                <span>•</span>
                                <span>Joined {new Date(client.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isDownloading ? (
                              <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-xs">
                                <Loader2 size={13} className="animate-spin text-white" />
                                <span>Downloading ({percent}%)</span>
                              </div>
                            ) : isCompleted ? (
                              <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-xs">
                                <CheckCircle size={14} className="text-white" />
                                <span>Received Successfully (100%)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-3 py-1 rounded-xl text-xs font-bold shadow-2xs">
                                <Eye size={13} className="text-slate-500" />
                                <span>Viewing Materials</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* LIVE DATA TRANSFER PROGRESS BAR */}
                        {client.downloadProgress && (
                          <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 shadow-2xs">
                            <div className="flex justify-between items-center text-xs font-bold">
                              <div className="flex items-center gap-1.5 text-slate-800 truncate pr-2">
                                <Download size={13} className={isDownloading ? "text-indigo-600 animate-bounce" : isCompleted ? "text-emerald-600" : "text-slate-400"} />
                                <span className="truncate">{client.downloadProgress.fileName}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                                <span className="text-slate-500">
                                  {formatBytes(client.downloadProgress.bytesTransferred)} / {formatBytes(client.downloadProgress.totalBytes)}
                                </span>
                                {client.downloadProgress.speed && (
                                  <span className="text-indigo-700 font-black bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">
                                    {client.downloadProgress.speed}
                                  </span>
                                )}
                                <span className={`font-black text-xs ${isCompleted ? "text-emerald-600" : "text-indigo-700"}`}>
                                  {percent}%
                                </span>
                              </div>
                            </div>

                            {/* Visual Progress Bar Track */}
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 relative">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className={`h-full rounded-full transition-all ${
                                  isCompleted
                                    ? "bg-emerald-500"
                                    : isFailed
                                    ? "bg-red-500"
                                    : "bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400"
                                }`}
                              />
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                              <span>
                                {isDownloading
                                  ? "Transferring course package directly over router Wi-Fi..."
                                  : isCompleted
                                  ? "✅ Verified: All files unpacked and saved on student device"
                                  : isFailed
                                  ? "⚠️ Transfer was interrupted or cancelled"
                                  : "Transfer status updated"}
                              </span>
                              {client.downloadProgress.updatedAt && (
                                <span>{new Date(client.downloadProgress.updatedAt).toLocaleTimeString()}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* Create New Session Card */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6"
          >
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Start New Classroom Sharing Session
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Configure access permissions and broadcast this course across your offline local network.
              </p>
            </div>

            {/* Mode Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: View Only */}
              <div
                onClick={() => setAccessMode("VIEW_ONLY")}
                className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between space-y-4 ${
                  accessMode === "VIEW_ONLY"
                    ? "border-slate-900 bg-slate-900 text-white shadow-md"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-900"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${accessMode === "VIEW_ONLY" ? "bg-slate-800 text-emerald-400" : "bg-slate-100 text-slate-700"}`}>
                    <Eye size={22} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    accessMode === "VIEW_ONLY" ? "border-emerald-400 bg-emerald-400" : "border-slate-300"
                  }`}>
                    {accessMode === "VIEW_ONLY" && <div className="w-2 h-2 rounded-full bg-slate-900" />}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base mb-1">View Only Mode</h3>
                  <p className={`text-xs leading-relaxed ${accessMode === "VIEW_ONLY" ? "text-slate-300" : "text-slate-500"}`}>
                    Students can read notes and stream videos directly over LAN. File downloads and ZIP exports are disabled.
                  </p>
                </div>
              </div>

              {/* Option 2: Allow Download */}
              <div
                onClick={() => setAccessMode("ALLOW_DOWNLOAD")}
                className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between space-y-4 ${
                  accessMode === "ALLOW_DOWNLOAD"
                    ? "border-indigo-600 bg-indigo-950 text-white shadow-md"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-900"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${accessMode === "ALLOW_DOWNLOAD" ? "bg-indigo-900 text-indigo-300" : "bg-slate-100 text-slate-700"}`}>
                    <Download size={22} />
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    accessMode === "ALLOW_DOWNLOAD" ? "border-indigo-400 bg-indigo-400" : "border-slate-300"
                  }`}>
                    {accessMode === "ALLOW_DOWNLOAD" && <div className="w-2 h-2 rounded-full bg-indigo-950" />}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base mb-1">Allow Download Mode</h3>
                  <p className={`text-xs leading-relaxed ${accessMode === "ALLOW_DOWNLOAD" ? "text-indigo-200" : "text-slate-500"}`}>
                    Students can stream content AND download modules or the entire course as ZIP files to save locally.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleCreateSession}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold shadow-lg shadow-slate-900/10 transition-all disabled:opacity-50 text-base"
            >
              {creating ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  Generating Share Credentials...
                </>
              ) : (
                <>
                  <Share2 size={20} />
                  Start Sharing Course Now
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Share Session History */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock size={18} className="text-slate-400" />
            Share Session History
          </h3>

          {sessions.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-4 text-center">
              No previous share sessions recorded for this course.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map(s => (
                <div key={s.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                      s.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : s.status === "REVOKED"
                        ? "bg-red-100 text-red-800 border border-red-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      {s.status}
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      {s.shareCode}
                    </span>
                    <span className="text-slate-500 font-medium">
                      ({s.accessMode === "ALLOW_DOWNLOAD" ? "Downloads Allowed" : "View Only"})
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 text-slate-400">
                    <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
                    {s.status === "ACTIVE" && (
                      <button
                        onClick={() => handleRevokeSession(s.shareCode)}
                        className="text-red-500 hover:text-red-700 font-bold hover:underline"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default InstructorShareHub;
