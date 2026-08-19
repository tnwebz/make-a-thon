import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, FileText, ChevronLeft, Menu, Code, HelpCircle,
  UploadCloud, CheckCircle, ChevronDown, ChevronRight, Lock,
  Unlock, Award, Play, ExternalLink, Download, Loader2, Sparkles,
  Wifi, Eye, AlertCircle, RefreshCw, Maximize2, BookOpen, Laptop
} from "lucide-react";
import { InstallAppModal } from "./components/InstallAppModal";

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
  // Default open on desktop (>=1024px), closed on mobile/tablet (<1024px)
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 1024 : false);
  const [expandedModules, setExpandedModules] = useState<number[]>([]);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  
  const [downloadingCourse, setDownloadingCourse] = useState(false);
  const [downloadingModuleId, setDownloadingModuleId] = useState<number | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // Responsive window resize listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!token) {
      navigate(`/share/${codeUpper}`);
      return;
    }
    fetchSharedCourse();
  }, [codeUpper, token]);

  // Periodic heartbeat to report active connection and student presence
  useEffect(() => {
    if (!token || !codeUpper) return;
    const clientId = localStorage.getItem("skillforge_client_id");
    const studentName = localStorage.getItem("skillforge_student_name");

    const sendHeartbeat = async () => {
      try {
        await axios.post(
          `${API_BASE_URL}/share-sessions/${codeUpper}/heartbeat`,
          { clientId, studentName },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e) {}
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 8000);
    return () => clearInterval(interval);
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

  const handleSelectLesson = (lesson: LessonItem) => {
    setActiveLesson(lesson);
    // On mobile screens, auto-close drawer when lesson is selected
    if (isMobile) {
      setSidebarOpen(false);
    }
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
    const clientId = localStorage.getItem("skillforge_client_id") || "";
    const downloadUrl = `${API_BASE_URL}/share-sessions/${codeUpper}/download/course?token=${token}&clientId=${clientId}`;
    window.location.href = downloadUrl;
    setTimeout(() => setDownloadingCourse(false), 3000);
  };

  const handleDownloadModule = (e: React.MouseEvent, modId: number) => {
    e.stopPropagation();
    if (!token || course?.accessMode !== "ALLOW_DOWNLOAD") return;
    setDownloadingModuleId(modId);
    const clientId = localStorage.getItem("skillforge_client_id") || "";
    const downloadUrl = `${API_BASE_URL}/share-sessions/${codeUpper}/download/module/${modId}?token=${token}&clientId=${clientId}`;
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
        <div className="flex flex-col items-center justify-center h-full text-slate-400 font-bold p-6 text-center">
          <BookOpen size={48} className="mb-3 opacity-40" />
          <span className="tracking-widest uppercase text-xs sm:text-sm">Select a lesson to begin</span>
        </div>
      );
    }

    const isDone = completedLessons.includes(activeLesson.id);
    const mediaStreamUrl = activeLesson.contentUrl ? `${resolveMediaUrl(activeLesson.contentUrl)}?token=${token}` : null;

    return (
      <div className="flex flex-col h-full bg-transparent w-full relative">

        {/* CENTER STAGE: Content Area */}
        <div className="flex-1 relative overflow-y-auto lg:overflow-hidden flex flex-col items-center justify-center w-full p-2.5 sm:p-5 md:p-8">

          {/* 1. PDF / NOTES */}
          {(activeLesson.type === "note" || activeLesson.type === "assignment") && (
            <div className="w-full h-full min-h-[65vh] sm:min-h-[75vh] max-w-6xl rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/70 bg-white flex flex-col mx-auto">
              
              {/* PDF Top Bar for mobile quick controls */}
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-semibold shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={15} className="text-amber-400 shrink-0" />
                  <span className="truncate">{activeLesson.title}</span>
                </div>
                {mediaStreamUrl && (
                  <a
                    href={mediaStreamUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-colors"
                  >
                    <Maximize2 size={13} />
                    <span className="hidden xs:inline">Fullscreen / Download</span>
                    <span className="xs:hidden">Open</span>
                  </a>
                )}
              </div>

              {mediaStreamUrl ? (
                <iframe
                  key={activeLesson.id}
                  src={`${mediaStreamUrl}#toolbar=1&navpanes=0`}
                  title={activeLesson.title}
                  className="w-full flex-1 border-0 bg-white"
                />
              ) : activeLesson.rawUrl ? (
                <iframe
                  src={getEmbedUrl(activeLesson.rawUrl)}
                  title={activeLesson.title}
                  className="w-full flex-1 border-0 bg-white"
                  allowFullScreen
                />
              ) : (
                <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-white">
                  <div className="flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-wider mb-4">
                    <FileText size={16} />
                    <span>Study Notes & Documentation</span>
                  </div>
                  <div className="prose prose-slate max-w-none text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
                    {activeLesson.textContent || activeLesson.instructions || "No written notes provided."}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. VIDEO PLAYER */}
          {(activeLesson.type === "video" || activeLesson.type === "live_class") && (
            <div className="w-full flex flex-col items-center justify-center h-full max-w-5xl">
              <div className="w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-black relative group flex items-center justify-center">
                
                {/* Mode & Download Overlay Button */}
                {course?.accessMode === "ALLOW_DOWNLOAD" && (
                  <button
                    onClick={handleDownloadCourse}
                    disabled={downloadingCourse}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/70 hover:bg-black/90 backdrop-blur text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl border border-white/10 cursor-pointer"
                  >
                    <Download size={14} />
                    <span className="hidden xs:inline">{downloadingCourse ? "Downloading..." : "Download Course ZIP"}</span>
                    <span className="xs:hidden">ZIP</span>
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
                  <div className="flex items-center justify-center h-full text-slate-400 font-bold tracking-widest uppercase text-xs sm:text-sm">
                    Invalid Video Source
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. CODE TEST */}
          {activeLesson.type === "code_test" && (
            <div className="w-full h-full max-w-5xl rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-slate-200/60 bg-white p-5 sm:p-8">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-wider mb-3">
                <Code size={16} />
                <span>Code Challenge Overview</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">{activeLesson.title}</h2>
              <div className="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {activeLesson.instructions || "Follow instructor instructions to solve this problem."}
              </div>
            </div>
          )}

          {/* 4. QUIZ */}
          {activeLesson.type === "quiz" && (
            <div className="w-full h-full max-w-6xl rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/60 bg-white/50 backdrop-blur-xl mx-auto p-2">
              {activeLesson.rawUrl ? (
                <iframe
                  src={getEmbedUrl(activeLesson.rawUrl)}
                  title={activeLesson.title}
                  className="w-full h-full min-h-[60vh] rounded-[1.5rem] border-0 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-8 bg-white rounded-[1.5rem]">
                  <HelpCircle size={40} className="text-purple-500 mb-3" />
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">{activeLesson.title}</h3>
                  <p className="text-slate-500 text-xs sm:text-sm max-w-md">{activeLesson.instructions || "Complete this quiz as directed in class."}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* BOTTOM ACTION BAR: Responsive Layout */}
        <div className="py-3 sm:py-4 md:py-6 bg-white/95 backdrop-blur-2xl border-t border-slate-200/70 flex items-center justify-between px-3 sm:px-6 md:px-12 shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] gap-2">
          
          {/* Lesson Metadata */}
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-slate-900 font-black text-sm sm:text-lg md:text-2xl tracking-tight truncate">
              {activeLesson.title}
            </h3>
            <p className="text-slate-400 text-[10px] sm:text-[11px] font-black uppercase tracking-widest truncate">
              {activeLesson.type}
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Prev Navigation Button */}
            {prevLesson && (
              <button
                onClick={() => setActiveLesson(prevLesson)}
                className="flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl sm:rounded-2xl text-xs transition-colors cursor-pointer"
                title={prevLesson.title}
              >
                <ChevronLeft size={16} />
                <span className="hidden xs:inline">Prev</span>
              </button>
            )}

            {/* Next Navigation Button */}
            {nextLesson && (
              <button
                onClick={() => setActiveLesson(nextLesson)}
                className="flex items-center justify-center gap-1 px-2.5 sm:px-4 py-2 sm:py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl sm:rounded-2xl text-xs transition-colors cursor-pointer"
                title={nextLesson.title}
              >
                <span className="hidden xs:inline">Next</span>
                <ChevronRight size={16} />
              </button>
            )}

            {/* GREEN ACTION BUTTON */}
            <button
              onClick={handleMarkComplete}
              className={`flex items-center gap-1.5 sm:gap-2.5 px-3.5 sm:px-6 md:px-8 py-2.5 sm:py-3.5 md:py-4 rounded-xl sm:rounded-2xl font-black transition-all text-xs sm:text-sm cursor-pointer shrink-0 ${
                isDone 
                  ? "bg-green-50 border border-green-200 text-green-600 shadow-xs" 
                  : "bg-[#10b981] hover:bg-[#059669] text-white shadow-md shadow-emerald-500/20 active:scale-95"
              }`}
            >
              {isDone ? (
                <>
                  <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                  <span className="hidden xs:inline">Completed</span>
                  <span className="xs:hidden">Done</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="shrink-0" />
                  <span className="hidden xs:inline">Mark as Complete</span>
                  <span className="xs:hidden">Complete</span>
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
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 max-w-md shadow-sm space-y-4 mx-4">
          <AlertCircle size={40} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Access Error</h2>
          <p className="text-sm text-slate-500">{errorMsg || "Unable to find course details."}</p>
          <button
            onClick={() => navigate(`/share/${codeUpper}`)}
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl text-sm hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Return to Gateway
          </button>
        </div>
      </div>
    );
  }

  // Common Sidebar Content Component
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-3xl">
      {/* Top Bar: Exit Player */}
      <div className="pt-6 pb-4 px-6 shrink-0 flex items-center justify-between border-b border-slate-100">
        <button
          onClick={() => navigate(`/share/${codeUpper}`)}
          className="flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-bold text-xs sm:text-sm bg-white border border-slate-200 px-4 py-2.5 rounded-2xl shadow-xs hover:bg-slate-50 cursor-pointer"
        >
          <ChevronLeft size={16} />
          <span>Exit Player</span>
        </button>

        <div className="flex items-center gap-2">
          {course.accessMode === "ALLOW_DOWNLOAD" && (
            <button
              onClick={handleDownloadCourse}
              disabled={downloadingCourse}
              className="p-2 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Download full course as ZIP"
            >
              <Download size={15} />
              <span className="hidden sm:inline">ZIP</span>
            </button>
          )}

          {/* Close drawer button on mobile */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Close Curriculum"
            >
              <ChevronLeft size={20} className="rotate-180" />
            </button>
          )}
        </div>
      </div>

      {/* Student Profile Identity */}
      <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {(localStorage.getItem("skillforge_student_name") || "S").charAt(0).toUpperCase()}
          </div>
          <div className="truncate">
            <span className="text-xs font-bold text-slate-900 truncate block">
              {localStorage.getItem("skillforge_student_name") || "Connected Student"}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Classroom LAN Active
            </span>
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
        {course.modules?.map((module, idx) => {
          const isExpanded = expandedModules.includes(module.id);
          const moduleComplete = isModuleComplete(module);

          return (
            <div key={module.id} className="bg-white border border-slate-200/70 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs">
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-left"
              >
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Phase {idx + 1}
                    </span>
                    {moduleComplete && <CheckCircle size={13} className="text-emerald-500" />}
                  </div>
                  <div className={`text-sm sm:text-base font-black tracking-tight ${moduleComplete ? "text-slate-400" : "text-slate-900"}`}>
                    {module.title}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown size={18} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight size={18} className="text-slate-400 shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden bg-slate-50/60 border-t border-slate-100"
                  >
                    <div className="p-2 sm:p-3 space-y-1">
                      {module.lessons?.map((lesson) => {
                        const isActive = activeLesson?.id === lesson.id;
                        const isLessonDone = completedLessons.includes(lesson.id);

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => handleSelectLesson(lesson)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl sm:rounded-2xl transition-all cursor-pointer ${
                              isActive
                                ? "bg-white shadow-xs border border-slate-200 text-slate-900"
                                : "hover:bg-slate-100/80 border border-transparent text-slate-500"
                            }`}
                          >
                            <div className={`${isActive ? "text-slate-900" : isLessonDone ? "text-emerald-500" : "text-slate-400"}`}>
                              {isLessonDone ? (
                                <CheckCircle size={16} />
                              ) : lesson.type === "video" || lesson.type === "live_class" ? (
                                <PlayCircle size={16} />
                              ) : lesson.type === "note" ? (
                                <FileText size={16} />
                              ) : lesson.type === "quiz" ? (
                                <HelpCircle size={16} />
                              ) : (
                                <UploadCloud size={16} />
                              )}
                            </div>
                            <div className={`text-xs sm:text-sm text-left truncate flex-1 font-bold ${isActive ? "text-slate-900" : "text-slate-600"}`}>
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

      {/* THE CERTIFICATE GATE */}
      <div className="p-4 sm:p-6 shrink-0 bg-white border-t border-slate-200/60">
        <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 border ${isCourseComplete ? "border-green-200 bg-green-50 shadow-xs" : "border-slate-100 bg-slate-50"} transition-all`}>
          <div className="relative z-10">
            <h4 className={`font-black mb-1 flex items-center gap-2 text-sm sm:text-base ${isCourseComplete ? "text-green-700" : "text-slate-700"}`}>
              <Award size={18} /> Course Certificate
            </h4>
            <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-widest">
              {isCourseComplete ? "UNLOCKED & READY" : "COMPLETE ALL MODULES"}
            </p>
            
            <button
              disabled={!isCourseComplete}
              className={`w-full py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all ${
                isCourseComplete
                  ? "bg-[#10b981] text-white hover:bg-[#059669] shadow-md shadow-emerald-500/20 cursor-pointer"
                  : "bg-white border border-slate-200 text-slate-400 cursor-not-allowed shadow-xs"
              }`}
            >
              {isCourseComplete ? (
                <>
                  <Unlock size={16} /> Completed All Modules
                </>
              ) : (
                <>
                  <Lock size={16} /> Locked
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden font-sans bg-[#f8fafc] text-slate-900 selection:bg-emerald-500 selection:text-white relative">

      {/* Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[150px] pointer-events-none opacity-80" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-slate-200/50 rounded-full blur-[180px] pointer-events-none" />

      {/* 1. DESKTOP SIDEBAR (>= 1024px) */}
      {!isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col h-full border-r border-slate-200/60 z-30 shrink-0 relative shadow-xl overflow-hidden"
            >
              {renderSidebarContent()}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* 2. MOBILE / TABLET OVERLAY DRAWER (< 1024px) */}
      {isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 flex">
              {/* Darkened Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              />

              {/* Slide-out Drawer */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 280 }}
                className="relative w-[85vw] max-w-[340px] h-full z-50 shadow-2xl border-r border-slate-200"
              >
                {renderSidebarContent()}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}

      {/* RIGHT MAIN VIEW */}
      <div className="flex-1 flex flex-col relative z-20 overflow-hidden h-full">
        
        {/* Top Navbar / Floating Toggle Header */}
        <div className="p-3 sm:p-4 md:p-6 pb-0 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-white/90 backdrop-blur-2xl rounded-xl sm:rounded-2xl border border-slate-200/80 text-slate-700 hover:text-slate-900 hover:bg-white transition-all shadow-xs cursor-pointer text-xs sm:text-sm font-bold"
              title="Toggle Curriculum Sidebar"
            >
              <Menu size={18} />
              <span className="hidden xs:inline">Modules</span>
            </button>

            {/* Course Title Badge */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-100/80 border border-slate-200/60 px-3.5 py-1.5 rounded-full text-xs font-extrabold text-slate-700 max-w-[200px] md:max-w-xs truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{course.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Offline App / Standalone Player Button */}
            <button
              onClick={() => setShowInstallModal(true)}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              title="Install Desktop App or open Offline Player to view downloaded ZIPs anytime"
            >
              <Laptop size={14} className="text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">Offline App</span>
            </button>

            {/* Offline Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
              <Wifi size={12} className="shrink-0" />
              <span className="hidden xs:inline">Local LAN</span>
            </div>

            {/* Exit button for fast access */}
            <button
              onClick={() => navigate(`/share/${codeUpper}`)}
              className="p-2 sm:px-3 sm:py-1.5 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Exit to Gateway"
            >
              <ChevronLeft size={15} />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>

        {/* Content Render Stage */}
        <div className="flex-1 h-full overflow-hidden">
          {renderContent()}
        </div>
      </div>

      {/* Standalone Desktop App Install Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

    </div>
  );
};

export default SharedCourseViewer;
