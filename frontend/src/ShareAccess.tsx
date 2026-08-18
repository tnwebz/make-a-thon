import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import axios from "axios";
import { 
  KeyRound, Users, Star, BookOpen, Layers, Lock, 
  ArrowRight, Wifi, AlertCircle, Loader2, CheckCircle2,
  Download, Eye, Sparkles, RefreshCw, Laptop
} from "lucide-react";
import { motion } from "framer-motion";

interface CoursePreviewData {
  shareCode: string;
  courseId: number;
  title: string;
  description: string;
  image_url: string | null;
  instructorName: string;
  accessMode: "VIEW_ONLY" | "ALLOW_DOWNLOAD";
  status: string;
  modulesCount: number;
  lessonsCount: number;
  totalDuration: number;
  studentCount: number;
  rating: number;
}

const ShareAccess: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();

  const codeUpper = (shareCode || "").toUpperCase();

  const [coursePreview, setCoursePreview] = useState<CoursePreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [passkey, setPasskey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasExistingToken, setHasExistingToken] = useState(false);

  useEffect(() => {
    if (!codeUpper) return;

    // Check if student already unlocked this session
    const existingToken = localStorage.getItem(`share_token_${codeUpper}`);
    if (existingToken) {
      setHasExistingToken(true);
    }

    fetchCoursePreview();
  }, [codeUpper]);

  const fetchCoursePreview = async () => {
    setLoadingPreview(true);
    setErrorMsg(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/share-sessions/${codeUpper}/preview`);
      setCoursePreview(res.data);
    } catch (err: any) {
      console.error("Preview load error:", err);
      if (err.response?.status === 404) {
        setErrorMsg("Share session not found. Please verify your link.");
      } else if (err.response?.status === 403) {
        setErrorMsg("This classroom share session has expired or was revoked by the instructor.");
      } else {
        setErrorMsg("Unable to reach classroom server. Please confirm you are connected to the router Wi-Fi.");
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePasskeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (raw.length <= 8) {
      setPasskey(raw);
      setErrorMsg(null);
    }
  };

  const handleEnterCourse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // If already authenticated with saved token, enter directly
    if (hasExistingToken) {
      navigate(`/share/${codeUpper}/course`);
      return;
    }

    if (passkey.length < 4) {
      setErrorMsg("Please enter the 8-character access passkey provided by your instructor.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await axios.post(`${API_BASE_URL}/share-sessions/${codeUpper}/access`, {
        passkey: passkey.trim()
      });

      const { token, accessMode, courseTitle, courseImage } = res.data;

      // Save token in localStorage
      localStorage.setItem(`share_token_${codeUpper}`, token);
      localStorage.setItem(
        `share_session_${codeUpper}`,
        JSON.stringify({
          shareCode: codeUpper,
          accessMode,
          courseTitle,
          courseImage,
          accessedAt: new Date().toISOString()
        })
      );

      // Transition to the course player
      navigate(`/share/${codeUpper}/course`);
    } catch (err: any) {
      console.error("Passkey verification error:", err);
      if (err.response?.data?.detail) {
        setErrorMsg(err.response.data.detail);
      } else if (err.response?.status === 401) {
        setErrorMsg("Invalid access passkey. Please check and try again.");
      } else if (err.response?.status === 403) {
        setErrorMsg("This session has expired or was revoked by the instructor.");
      } else if (err.response?.status === 429) {
        setErrorMsg("Too many attempts. Please wait a minute before trying again.");
      } else {
        setErrorMsg("Failed to connect to local server. Check your Wi-Fi connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingPreview) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-4">
        <RefreshCw size={36} className="animate-spin text-slate-800" />
        <p className="text-sm font-bold text-slate-600">Connecting to classroom share portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Background Studio Illumination Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none opacity-60"
        style={{
          background: "radial-gradient(circle at 50% 15%, rgba(5, 150, 105, 0.08) 0%, rgba(248, 250, 252, 0) 70%)"
        }}
      />

      {/* Top Header / Branding */}
      <header className="w-full max-w-lg flex items-center justify-between pt-3 sm:pt-6 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-sm">
            S
          </div>
          <div>
            <span className="text-base font-black text-slate-900 tracking-tight">SkillForge</span>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Classroom Broadcast
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open("/offline-player", "_blank")}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full shadow-xs text-xs font-bold transition-all cursor-pointer"
            title="Open standalone Offline Player to view downloaded ZIPs anytime"
          >
            <Laptop size={13} className="text-indigo-600" />
            <span>Offline App</span>
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1.5 rounded-full shadow-xs text-xs font-bold text-slate-600">
            <Wifi size={14} className="text-emerald-500" />
            <span className="hidden xs:inline">Offline LAN</span>
          </div>
        </div>
      </header>

      {/* Main Course Card Gate Container */}
      <main className="w-full max-w-lg my-auto py-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden"
        >
          {/* COURSE THUMBNAIL (Matching Image 3) */}
          <div className="relative h-56 sm:h-64 bg-slate-900 overflow-hidden">
            {coursePreview?.image_url ? (
              <img
                src={coursePreview.image_url}
                alt={coursePreview.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 text-center">
                <BookOpen size={48} className="text-slate-500 mb-3" />
                <span className="text-2xl font-black tracking-tight">{coursePreview?.title || "Classroom Course"}</span>
              </div>
            )}

            {/* Access Mode Pill Overlay */}
            <div className="absolute top-4 right-4 z-10">
              {coursePreview?.accessMode === "ALLOW_DOWNLOAD" ? (
                <div className="flex items-center gap-1.5 bg-indigo-950/80 backdrop-blur-md text-indigo-200 border border-indigo-500/30 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                  <Download size={13} className="text-indigo-400" />
                  <span>Downloads Allowed</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md text-slate-200 border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                  <Eye size={13} className="text-amber-400" />
                  <span>View Only</span>
                </div>
              )}
            </div>
          </div>

          {/* COURSE DETAILS BODY */}
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Title & Metadata (Matching Image 3 layout) */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
                {coursePreview?.title || "Classroom Course"}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-slate-500 text-sm font-semibold">
                <div className="flex items-center gap-1.5">
                  <Users size={16} className="text-emerald-500" />
                  <span>{coursePreview?.studentCount || 1} students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span>{coursePreview?.rating || 4.6}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers size={16} className="text-indigo-500" />
                  <span>{coursePreview?.modulesCount || 0} modules ({coursePreview?.lessonsCount || 0} lessons)</span>
                </div>
              </div>

              {coursePreview?.description && (
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-3 line-clamp-2 leading-relaxed">
                  {coursePreview.description}
                </p>
              )}
            </div>

            {/* ERROR ALERT */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-200/80 text-red-700 p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* PASSKEY ENTRY OR UNLOCKED STATE */}
            {hasExistingToken ? (
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-extrabold text-emerald-900">Access Key Verified</div>
                    <div className="text-[11px] text-emerald-700">You already unlocked this course session.</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem(`share_token_${codeUpper}`);
                    setHasExistingToken(false);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-700 font-bold underline cursor-pointer"
                >
                  Change Key
                </button>
              </div>
            ) : (
              <form onSubmit={handleEnterCourse} className="space-y-3">
                <div className="space-y-1.5">
                  <label 
                    htmlFor="passkey-input"
                    className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 pl-1"
                  >
                    Classroom Access Passkey
                  </label>
                  <div className="relative">
                    <input
                      id="passkey-input"
                      type="text"
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={passkey}
                      onChange={handlePasskeyChange}
                      placeholder="e.g. 7K4M92PX"
                      className="w-full text-center font-mono text-xl sm:text-2xl font-black tracking-widest py-3.5 px-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-slate-900 focus:outline-none transition-all placeholder:text-slate-300 placeholder:font-mono text-slate-900"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                      <Lock size={18} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-1 text-[11px] text-slate-400 font-medium">
                    <span>Enter 8-digit key from instructor</span>
                    <span className="font-mono font-bold text-slate-500">{passkey.length}/8</span>
                  </div>
                </div>
              </form>
            )}

            {/* ENTER COURSE ACTION BUTTON */}
            <button
              onClick={handleEnterCourse}
              disabled={isSubmitting || (!hasExistingToken && passkey.length < 4)}
              className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin text-white" />
                  <span>Unlocking Classroom...</span>
                </>
              ) : (
                <>
                  <span>Enter Course</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            {/* Footer Connection Note */}
            <p className="text-[11px] text-slate-400 text-center font-medium pt-1">
              Connected directly via local Wi-Fi router. No internet or login required.
            </p>

          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-lg pb-3 text-center text-xs text-slate-400 font-medium z-10">
        SkillForge Offline Sharing Engine &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default ShareAccess;
