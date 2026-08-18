import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, FileText, ChevronLeft, Menu, Code, HelpCircle,
  UploadCloud, CheckCircle, ChevronDown, ChevronRight, Lock,
  Unlock, Award, Play, ExternalLink, Download, Loader2, Sparkles,
  Wifi, Eye, AlertCircle, RefreshCw, Maximize2
} from "lucide-react";

interface LessonItem {
  id: number;
  title: string;
  type: string;
  contentUrl: string | null;
  youtubeUrl: string | null;
  rawUrl: string | null;
  textContent: string | null;
  isPdf?: boolean;
  mimeType?: string | null;
  duration: number | null;
  is_mandatory: boolean;
  order: number;
  instructions: string | null;
}

interface ModuleItem {
  id: number;
  title: string;
  order: number;
  lessons: LessonItem[];
}

interface SharedCourseData {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  accessMode: "VIEW_ONLY" | "ALLOW_DOWNLOAD";
  shareCode: string;
  modules: ModuleItem[];
}

const SharedCourseViewer: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();

  const codeUpper = (shareCode || "").toUpperCase();
  const token = localStorage.getItem(`share_token_${codeUpper}`);

  const [course, setCourse] = useState<SharedCourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<number[]>([]);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  
  const [downloadingCourse, setDownloadingCourse] = useState(false);
  const [downloadingModuleId, setDownloadingModuleId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      navigate(`/share/${codeUpper}`);
      return;
    }
    fetchSharedCourse();
  }, [codeUpper, token]);

  const fetchSharedCourse = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/share-sessions/${codeUpper}/course`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data: SharedCourseData = res.data;
      setCourse(data);

      if (data.modules && data.modules.length > 0) {
        // Expand first module by default
        setExpandedModules([data.modules[0].id]);
        if (data.modules[0].lessons && data.modules[0].lessons.length > 0) {
          setActiveLesson(data.modules[0].lessons[0]);
        }
      }

      // Load locally stored progress for this share session if available
      const cachedProgress = localStorage.getItem(`share_progress_${codeUpper}`);
      if (cachedProgress) {
        try {
          setCompletedLessons(JSON.parse(cachedProgress));
        } catch (e) {}
      }
    } catch (err: any) {
      console.error("Failed to load shared course", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem(`share_token_${codeUpper}`);
        navigate(`/share/${codeUpper}`);
      } else {
        setErrorMsg(err.response?.data?.detail || "Failed to load course contents from the local server.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleId: number) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleMarkComplete = () => {
    if (!activeLesson) return;
    setCompletedLessons(prev => {
      const next = prev.includes(activeLesson.id) 
        ? prev.filter(id => id !== activeLesson.id)
        : [...prev, activeLesson.id];
      localStorage.setItem(`share_progress_${codeUpper}`, JSON.stringify(next));
      return next;
    });
  };

  const isModuleComplete = (module: ModuleItem) => {
    return module.lessons && module.lessons.length > 0 && module.lessons.every(l => completedLessons.includes(l.id));
  };

  const isCourseComplete = useMemo(() => {
    if (!course || !course.modules || course.modules.length === 0) return false;
    let total = 0;
    let completed = 0;
    course.modules.forEach(m => {
      m.lessons.forEach(l => {
        total++;
        if (completedLessons.includes(l.id)) completed++;
      });
    });
    return total > 0 && completed === total;
  }, [course, completedLessons]);

  const handleDownloadCourse = () => {
    if (!token || course?.accessMode !== "ALLOW_DOWNLOAD") return;
    setDownloadingCourse(true);
    const downloadUrl = `${API_BASE_URL}/share-sessions/${codeUpper}/download/course?token=${token}`;
    window.location.href = downloadUrl;
    setTimeout(() => setDownloadingCourse(false), 3000);
  };

  const handleDownloadModule = (e: React.MouseEvent, modId: number) => {
    e.stopPropagation();
    if (!token || course?.accessMode !== "ALLOW_DOWNLOAD") return;
    setDownloadingModuleId(modId);
    const downloadUrl = `${API_BASE_URL}/share-sessions/${codeUpper}/download/module/${modId}?token=${token}`;
    window.location.href = downloadUrl;
    setTimeout(() => setDownloadingModuleId(null), 3000);
  };

  // Helper for YouTube ID
  const getYoutubeId = (url?: string | null) => {
    if (!url) return null;
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Helper to safely build absolute URL for media streams without duplicating /api/v1
  const resolveMediaUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/api/v1/")) {
      const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
      return `${origin}${url}`;
    }
    const cleanPath = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE_URL}${cleanPath}`;
  };

  // Helper for Google Docs / Drive embed
  const getEmbedUrl = (content?: string | null) => {
    if (!content) return "";
    if (content.includes("docs.google.com/forms")) {
      return content.replace(/\/viewform.*/, "/viewform?embedded=true").replace(/\/view.*/, "/viewform?embedded=true");
    }
    return content.replace("/view", "/preview");
  };

  // Next / Prev lessons
  const allLessons = course?.modules?.flatMap(m => m.lessons) || [];
  const currentIndex = allLessons.findIndex(l => l.id === activeLesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const renderContent = () => {
    if (!activeLesson) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400 font-bold tracking-widest uppercase">
          Select a lesson to begin
        </div>
      );
    }

    const isDone = completedLessons.includes(activeLesson.id);
    const mediaStreamUrl = activeLesson.contentUrl ? `${resolveMediaUrl(activeLesson.contentUrl)}?token=${token}` : null;

    return (
      <div className="flex flex-col h-full bg-transparent w-full relative">

        {/* CENTER STAGE: Content Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center w-full p-6 md:p-10">

          {/* 1. PDF / NOTES (Image 5 Style Embedded Viewer) */}
          {(activeLesson.type === "note" || activeLesson.type === "assignment") && (
            <div className="w-full h-full max-w-6xl rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/60 bg-white/50 backdrop-blur-xl mx-auto p-2">
              {mediaStreamUrl ? (
                <iframe
                  key={activeLesson.id}
                  src={`${mediaStreamUrl}#toolbar=1&navpanes=0`}
                  title={activeLesson.title}
                  className="w-full h-full rounded-[1.5rem] border-0 bg-white"
                />
              ) : activeLesson.rawUrl ? (
                <iframe
                  src={getEmbedUrl(activeLesson.rawUrl)}
                  title={activeLesson.title}
                  className="w-full h-full rounded-[1.5rem] border-0 bg-white"
                  allowFullScreen
                />
              ) : (
                <div className="p-8 sm:p-12 overflow-y-auto h-full bg-white rounded-[1.5rem]">
                  <div className="flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-wider mb-4">
                    <FileText size={16} />
                    <span>Study Notes & Documentation</span>
                  </div>
                  <div className="prose prose-slate max-w-none text-slate-700 text-base leading-relaxed whitespace-pre-wrap font-medium">
                    {activeLesson.textContent || activeLesson.instructions || "No written notes provided."}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. VIDEO PLAYER (Image 2 Style Video Stage) */}
          {(activeLesson.type === "video" || activeLesson.type === "live_class") && (
            <div className="w-full flex flex-col items-center justify-center h-full">
              <div className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-black relative group">
                
                {/* Mode & Download Overlay Button */}
                {course?.accessMode === "ALLOW_DOWNLOAD" && (
                  <button
                    onClick={handleDownloadCourse}
                    disabled={downloadingCourse}
                    className="absolute top-4 right-4 z-50 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 disabled:opacity-100 shadow-xl border border-white/10"
                  >
                    <Download size={16} />
                    <span>{downloadingCourse ? "Downloading..." : "Download Offline"}</span>
                  </button>
                )}

                {mediaStreamUrl ? (
                  /* Offline Local Video Stream */
                  <video
                    key={activeLesson.id}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain bg-black"
                    src={mediaStreamUrl}
                  >
                    Your browser does not support offline video playback.
                  </video>
                ) : (activeLesson.youtubeUrl || getYoutubeId(activeLesson.rawUrl)) ? (
                  /* YouTube Stream */
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeId(activeLesson.youtubeUrl || activeLesson.rawUrl)}?autoplay=1&rel=0&modestbranding=1`}
                    title={activeLesson.title}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : activeLesson.rawUrl ? (
                  /* External Drive / Web Video */
                  <iframe
                    src={getEmbedUrl(activeLesson.rawUrl)}
                    title={activeLesson.title}
                    className="w-full h-full border-0 bg-black"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 font-bold tracking-widest uppercase">
                    Invalid Video Source
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. CODE TEST */}
          {activeLesson.type === "code_test" && (
            <div className="w-full h-full max-w-5xl rounded-3xl overflow-hidden shadow-xl border border-slate-200/60 bg-white p-8">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-wider mb-4">
                <Code size={16} />
                <span>Code Challenge Overview</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3">{activeLesson.title}</h2>
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {activeLesson.instructions || "Follow instructor instructions to solve this problem."}
              </div>
            </div>
          )}

          {/* 4. QUIZ */}
          {activeLesson.type === "quiz" && (
            <div className="w-full h-full max-w-6xl rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/60 bg-white/50 backdrop-blur-xl mx-auto p-2">
              {activeLesson.rawUrl ? (
                <iframe
                  src={getEmbedUrl(activeLesson.rawUrl)}
                  title={activeLesson.title}
                  className="w-full h-full rounded-[1.5rem] border-0 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-[1.5rem]">
                  <HelpCircle size={48} className="text-purple-500 mb-3" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{activeLesson.title}</h3>
                  <p className="text-slate-500 text-sm max-w-md">{activeLesson.instructions || "Complete this quiz as directed in class."}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* BOTTOM ACTION BAR (Image 2 Style) */}
        <div className="h-28 bg-white/90 backdrop-blur-2xl border-t border-slate-200/60 flex items-center justify-between px-8 md:px-14 shrink-0 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
          <div>
            <h3 className="text-slate-900 font-black text-2xl tracking-tight mb-1">{activeLesson.title}</h3>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">{activeLesson.type}</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Prev / Next Navigation Buttons */}
            {prevLesson && (
              <button
                onClick={() => setActiveLesson(prevLesson)}
                className="hidden sm:flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors"
                title={prevLesson.title}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
            )}

            {nextLesson && (
              <button
                onClick={() => setActiveLesson(nextLesson)}
                className="hidden sm:flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors"
                title={nextLesson.title}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            )}

            {/* GREEN ACTION BUTTON (Matching Image 2) */}
            <button
              onClick={handleMarkComplete}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all text-sm cursor-pointer ${
                isDone 
                  ? "bg-green-50 border border-green-200 text-green-600 shadow-xs" 
                  : "bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-emerald-500/20 active:scale-95"
              }`}
            >
              {isDone ? (
                <>
                  <CheckCircle size={20} className="text-emerald-500" />
                  <span>Module Completed</span>
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>Mark as Complete</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 space-y-4">
        <RefreshCw size={36} className="animate-spin text-slate-800" />
        <p className="text-sm font-bold text-slate-600">Initializing Classroom Content...</p>
      </div>
    );
  }

  if (errorMsg || !course) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 max-w-md shadow-sm space-y-4">
          <AlertCircle size={40} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Access Error</h2>
          <p className="text-sm text-slate-500">{errorMsg || "Unable to find course details."}</p>
          <button
            onClick={() => navigate(`/share/${codeUpper}`)}
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl text-sm hover:bg-slate-800 transition-colors"
          >
            Return to Gateway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans bg-[#f8fafc] text-slate-900 selection:bg-emerald-500 selection:text-white relative">

      {/* 🎨 THEME: Crisp Glass Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[150px] pointer-events-none opacity-80" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-slate-200/50 rounded-full blur-[180px] pointer-events-none" />

      {/* LEFT SIDEBAR (Matching Image 2 Layout) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex flex-col h-full bg-white/80 backdrop-blur-3xl border-r border-slate-200/60 z-30 shrink-0 relative shadow-2xl"
          >
            {/* Top Bar: Exit Player */}
            <div className="pt-8 pb-4 px-8 shrink-0 flex items-center justify-between">
              <button
                onClick={() => navigate(`/share/${codeUpper}`)}
                className="flex items-center justify-center gap-3 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft size={18} />
                <span>Exit Player</span>
              </button>

              {course.accessMode === "ALLOW_DOWNLOAD" && (
                <button
                  onClick={handleDownloadCourse}
                  disabled={downloadingCourse}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-2xl transition-colors cursor-pointer"
                  title="Download full course as ZIP"
                >
                  <Download size={18} />
                </button>
              )}
            </div>

            {/* Modules List (Matching Phase 1 / Phase 2 Card Style) */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {course.modules?.map((module, idx) => {
                const isExpanded = expandedModules.includes(module.id);
                const moduleComplete = isModuleComplete(module);

                return (
                  <div key={module.id} className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="text-left flex-1 pr-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Phase {idx + 1}
                          </span>
                          {moduleComplete && <CheckCircle size={14} className="text-emerald-500" />}
                        </div>
                        <div className={`text-base font-black tracking-tight ${moduleComplete ? "text-slate-400" : "text-slate-900"}`}>
                          {module.title}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight size={20} className="text-slate-400 shrink-0" />
                      )}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-slate-50/50 border-t border-slate-100"
                        >
                          <div className="p-3 space-y-1.5">
                            {module.lessons?.map((lesson) => {
                              const isActive = activeLesson?.id === lesson.id;
                              const isLessonDone = completedLessons.includes(lesson.id);

                              return (
                                <button
                                  key={lesson.id}
                                  onClick={() => setActiveLesson(lesson)}
                                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer ${
                                    isActive
                                      ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-slate-200 text-slate-900"
                                      : "hover:bg-slate-100 border border-transparent text-slate-500"
                                  }`}
                                >
                                  <div className={`${isActive ? "text-slate-900" : isLessonDone ? "text-emerald-500" : "text-slate-400"}`}>
                                    {isLessonDone ? (
                                      <CheckCircle size={18} />
                                    ) : lesson.type === "video" || lesson.type === "live_class" ? (
                                      <PlayCircle size={18} />
                                    ) : lesson.type === "note" ? (
                                      <FileText size={18} />
                                    ) : lesson.type === "quiz" ? (
                                      <HelpCircle size={18} />
                                    ) : (
                                      <UploadCloud size={18} />
                                    )}
                                  </div>
                                  <div className={`text-sm text-left truncate flex-1 font-bold ${isActive ? "text-slate-900" : "text-slate-500"}`}>
                                    {lesson.title}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* THE CERTIFICATE GATE (Matching Image 2 Bottom Card) */}
            <div className="p-8 shrink-0 bg-white border-t border-slate-200/60">
              <div className={`relative overflow-hidden rounded-3xl p-6 border ${isCourseComplete ? "border-green-200 bg-green-50 shadow-sm" : "border-slate-100 bg-slate-50"} transition-all`}>
                <div className="relative z-10">
                  <h4 className={`font-black mb-2 flex items-center gap-3 text-base ${isCourseComplete ? "text-green-700" : "text-slate-700"}`}>
                    <Award size={20} /> Course Certificate
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mb-6 uppercase tracking-widest">
                    {isCourseComplete ? "UNLOCKED & READY" : "COMPLETE ALL MODULES"}
                  </p>
                  
                  <button
                    disabled={!isCourseComplete}
                    className={`w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 transition-all ${
                      isCourseComplete
                        ? "bg-[#10b981] text-white hover:bg-[#059669] shadow-md shadow-emerald-500/20 cursor-pointer"
                        : "bg-white border border-slate-200 text-slate-400 cursor-not-allowed shadow-sm"
                    }`}
                  >
                    {isCourseComplete ? (
                      <>
                        <Unlock size={18} /> Completed All Modules
                      </>
                    ) : (
                      <>
                        <Lock size={18} /> Locked
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* RIGHT MAIN VIEW */}
      <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
        {/* Floating Menu Toggle */}
        <div className="absolute top-8 left-8 z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 bg-white/80 backdrop-blur-2xl rounded-2xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white transition-colors shadow-sm cursor-pointer"
            title="Toggle Curriculum Sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="flex-1 h-full pt-0 overflow-hidden">
          {renderContent()}
        </div>
      </div>

    </div>
  );
};

export default SharedCourseViewer;
