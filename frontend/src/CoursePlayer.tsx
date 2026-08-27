import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassToast } from "./components/GlassToast";

import {
  PlayCircle, FileText, ChevronLeft, Menu, Code, HelpCircle,
  UploadCloud, CheckCircle, ChevronDown, ChevronRight, Lock,
  Unlock, Award, Play, Save, Monitor, Cpu, ExternalLink, Download, Loader2,
  Globe, Sparkles
} from "lucide-react";

import { API_BASE_URL, resolveMediaUrl } from "./config";
import { ManualQuizPlayer } from "./components/ManualQuizPlayer";


// --- 💻 COMPONENT: PROFESSIONAL CODE ARENA ---
const CodeCompiler = ({ lesson }: { lesson: any }) => {
  const problems = useMemo(() => {
    try {
      if (!lesson.test_config) return [];
      let parsed = JSON.parse(lesson.test_config);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed.problems || [];
    } catch (e) {
      return [];
    }
  }, [lesson.test_config]);

  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const activeProblem = problems[activeProblemIndex] || { title: "No Problem Configured", description: "Instructor needs to update this test.", testCases: [] };

  const [code, setCode] = useState("# Write your solution here...\nprint('Hello SkillForge')");
  const [output, setOutput] = useState("Ready to execute...");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(71);

  const languages = [
    { id: 71, name: "Python", value: "python" },
    { id: 62, name: "Java", value: "java" },
    { id: 54, name: "C++", value: "cpp" },
    { id: 63, name: "JavaScript", value: "javascript" },
  ];

  const runCode = async () => {
    setLoading(true); setOutput("Compiling & Executing...");
    try {
      const res = await axios.post(`${API_BASE_URL}/execute`, {
        source_code: code, language_id: language,
        stdin: activeProblem.testCases?.[0]?.input || ""
      });
      if (res.data.stdout) setOutput(res.data.stdout);
      else if (res.data.stderr) setOutput(`Error:\n${res.data.stderr}`);
      else if (res.data.compile_output) setOutput(`Compile Error:\n${res.data.compile_output}`);
      else setOutput("Execution finished with no output.");
    } catch (err) { setOutput("❌ Execution Failed."); }
    finally { setLoading(false); }
  };

  if (!problems.length) return <div className="flex items-center justify-center h-full text-slate-400 font-bold">⚠️ No coding problems found.</div>;

  return (
    <div className="flex h-full gap-6 font-sans w-full max-w-[1600px] mx-auto p-4 md:p-8">
      {/* LEFT PANEL: Problems */}
      <div className="w-[35%] flex flex-col gap-4">
        <div className="flex-1 bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-200/60 p-8 overflow-y-auto shadow-sm">
          <div className="flex gap-2 mb-6 border-b border-slate-100 pb-4 overflow-x-auto">
            {problems.map((_: any, idx: number) => (
              <button key={idx} onClick={() => { setActiveProblemIndex(idx); setOutput("Ready to execute..."); }}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${activeProblemIndex === idx ? "bg-black text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800"}`}
              >Problem {idx + 1}</button>
            ))}
          </div>
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-black text-slate-900 m-0 tracking-tight">{activeProblem.title}</h2>
            <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest">{activeProblem.difficulty || "Medium"}</span>
          </div>
          <div className="prose prose-sm text-slate-600 mb-8 whitespace-pre-wrap font-medium leading-relaxed">{activeProblem.description || "No description provided."}</div>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Test Cases</h3>
          <div className="space-y-4">
            {activeProblem.testCases?.map((tc: any, i: number) => (
              <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Input:</div>
                <div className="font-mono text-xs bg-white text-slate-700 p-3.5 rounded-xl border border-slate-200 mb-4 shadow-sm">{tc.input}</div>
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Expected Output:</div>
                <div className="font-mono text-xs bg-white text-slate-700 p-3.5 rounded-xl border border-slate-200 shadow-sm">{tc.output}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Editor */}
      <div className="w-[65%] flex flex-col gap-4">
        <div className="flex-[2.5] flex flex-col bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200/60 p-3 flex justify-between items-center px-6 h-16">
            <div className="flex items-center gap-3 text-slate-700 font-bold text-sm"><Code size={18} /> Editor</div>
            <select className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-black shadow-sm" value={language} onChange={(e) => setLanguage(parseInt(e.target.value))}>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex-1 p-3">
            <Editor height="100%" defaultLanguage="python" language={languages.find(l => l.id === language)?.value} theme="light" value={code} onChange={(val) => setCode(val || "")} options={{ minimap: { enabled: false }, fontSize: 15, scrollBeyondLastLine: false, roundedSelection: true, padding: { top: 20 }, cursorBlinking: "smooth" }} />
          </div>
        </div>

        {/* Terminal & Actions */}
        <div className="flex-[1.5] flex flex-col gap-4">
          <div className="flex-[1.3] flex flex-col bg-slate-900 rounded-3xl overflow-hidden shadow-lg border border-slate-800">
            <div className="bg-slate-950 text-slate-400 px-6 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border-b border-slate-800"><Monitor size={16} /> Terminal Output</div>
            <div className="flex-1 p-6 font-mono text-sm text-emerald-400 overflow-y-auto whitespace-pre-wrap leading-relaxed">{output}</div>
          </div>
          <div className="flex-[0.2] flex gap-4 h-16">
            <button onClick={() => alert("✅ Code Saved!")} className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all shadow-sm"><Save size={18} /> Save Progress</button>
            {/* GREEN ACTION BUTTON */}
            <button onClick={runCode} disabled={loading} className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-70 shadow-lg shadow-emerald-500/20">{loading ? <Cpu size={20} className="animate-spin" /> : <Play size={20} className="fill-white" />} {loading ? "Running..." : "Execute Code"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 🔄 COMPONENT: WINDOWS CYCLE LOADER ---
const WindowsLoader = () => {
    return (
        <div className="flex flex-col items-center justify-center gap-6">
            <div className="relative w-12 h-12">
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-blue-600 rounded-full"
                        initial={{ rotate: 0, opacity: 0 }}
                        animate={{ 
                            rotate: 360,
                            opacity: [0, 1, 1, 0],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.15,
                        }}
                        style={{
                            originX: "24px",
                            originY: "24px",
                            left: "calc(50% - 4px)",
                            top: "0"
                        }}
                    />
                ))}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse font-sans">Initializing Content...</p>
        </div>
    );
};

// --- 📝 WEBVTT PARSER & TIMESTAMPS ---
interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

const parseWebVTT = (vttText: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  const lines = vttText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  let currentTextLines: string[] = [];

  const timeToSeconds = (timeStr: string): number => {
    const clean = timeStr.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
    } else if (parts.length === 2) {
      const [m, s] = parts;
      return parseFloat(m) * 60 + parseFloat(s);
    }
    return parseFloat(clean) || 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const parts = line.split('-->');
      if (parts.length === 2) {
        currentStart = timeToSeconds(parts[0]);
        currentEnd = timeToSeconds(parts[1].trim().split(' ')[0]);
        currentTextLines = [];
      }
    } else if (currentStart !== null && currentEnd !== null) {
      if (line === '') {
        if (currentTextLines.length > 0) {
          cues.push({
            start: currentStart,
            end: currentEnd,
            text: currentTextLines.join(' ')
          });
          currentStart = null;
          currentEnd = null;
          currentTextLines = [];
        }
      } else if (!/^\d+$/.test(line) && !line.startsWith('NOTE') && !line.startsWith('WEBVTT')) {
        currentTextLines.push(line);
      }
    }
  }

  if (currentStart !== null && currentEnd !== null && currentTextLines.length > 0) {
    cues.push({
      start: currentStart,
      end: currentEnd,
      text: currentTextLines.join(' ')
    });
  }

  return cues;
};

// --- MAIN PLAYER COMPONENT ---
const CoursePlayer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentLang, setCurrentLang] = useState<string>(searchParams.get("lang") || "en");
  
  const [course, setCourse] = useState<any>(() => {
    // Attempt cache first for instantaneous offline capability
    try {
      const cached = localStorage.getItem(`cached_course_player_${courseId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<number[]>([]);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [isMarking, setIsMarking] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // 🎬 Video Subtitles & Synced Overlay State
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState<string | null>(null);
  const [blobTrackUrl, setBlobTrackUrl] = useState<string | null>(null);

  const [toast, setToast] = useState({ show: false, msg: "", type: "success" });
  const [showPendingCertModal, setShowPendingCertModal] = useState(false);
  const triggerToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: "", type }), 4000);
  };

  // 📡 Fetch Subtitles & Create Same-Origin Blob URL
  useEffect(() => {
    let isMounted = true;

    const loadSubtitles = async () => {
      if (!activeLesson || currentLang === 'en') {
        if (isMounted) {
          setSubtitleCues([]);
          setCurrentSubtitleText(null);
          setBlobTrackUrl(null);
        }
        return;
      }

      // Find subtitle URL for requested language
      let subUrl = activeLesson.subtitle_url;
      if (!subUrl && Array.isArray(activeLesson.subtitles)) {
        const match = activeLesson.subtitles.find((s: any) => s.lang === currentLang);
        if (match) subUrl = match.src;
      }

      if (!subUrl) {
        if (isMounted) {
          setSubtitleCues([]);
          setCurrentSubtitleText(null);
          setBlobTrackUrl(null);
        }
        return;
      }

      try {
        const fullUrl = resolveMediaUrl(subUrl);
        const res = await axios.get(fullUrl, { responseType: 'text' });
        const vttContent = res.data;

        if (typeof vttContent === 'string' && vttContent.includes('WEBVTT')) {
          const parsed = parseWebVTT(vttContent);
          const blob = new Blob([vttContent], { type: 'text/vtt; charset=utf-8' });
          const newBlobUrl = URL.createObjectURL(blob);

          if (isMounted) {
            if (currentBlobUrlRef.current && currentBlobUrlRef.current !== newBlobUrl) {
              try { URL.revokeObjectURL(currentBlobUrlRef.current); } catch (e) {}
            }
            currentBlobUrlRef.current = newBlobUrl;
            setSubtitleCues(parsed);
            setBlobTrackUrl(newBlobUrl);
          } else {
            try { URL.revokeObjectURL(newBlobUrl); } catch (e) {}
          }
        }
      } catch (e) {
        console.warn("Could not load subtitle track:", e);
      }
    };

    loadSubtitles();

    return () => {
      isMounted = false;
    };
  }, [activeLesson?.id, activeLesson?.subtitle_url, currentLang]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (currentBlobUrlRef.current) {
        try { URL.revokeObjectURL(currentBlobUrlRef.current); } catch (e) {}
      }
    };
  }, []);

  // ⏱️ Synchronize Subtitles to Video Time Update
  useEffect(() => {
    if (subtitleCues.length === 0 || currentLang === 'en') {
      setCurrentSubtitleText(null);
      return;
    }

    const interval = setInterval(() => {
      const video = videoContainerRef.current?.querySelector('video');
      if (video) {
        const time = video.currentTime;
        const active = subtitleCues.find(c => time >= c.start && time <= c.end);
        setCurrentSubtitleText(active ? active.text : null);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [subtitleCues, currentLang]);

  // 🖥️ Dynamic Fullscreen Subtitle Mode Switcher
  useEffect(() => {
    const handleFullscreenChange = () => {
      const video = videoContainerRef.current?.querySelector('video');
      if (!video || !video.textTracks || video.textTracks.length === 0) return;
      const isVideoFullscreen = document.fullscreenElement === video;
      for (let i = 0; i < video.textTracks.length; i++) {
        // In native video fullscreen, enable browser track (styled by CSS video:fullscreen::cue)
        // In normal view, hide native track (so only our custom glassmorphic overlay renders)
        video.textTracks[i].mode = isVideoFullscreen ? 'showing' : 'hidden';
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);



  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/player?lang=${currentLang}`, { headers: { Authorization: `Bearer ${token}` } });
        setCourse(res.data);
        setCompletedLessons(res.data.completed_lessons || []);
        
        // Cache this course data for offline usage (safely catch quota exceptions)
        try {
          localStorage.setItem(`cached_course_player_${courseId}_${currentLang}`, JSON.stringify(res.data));
        } catch (storageErr) {
          console.warn("Storage quota exceeded, continuing without local cache update.");
        }

        if (!activeLesson && res.data.modules?.[0]) {
          setExpandedModules([res.data.modules[0].id]);
          if (res.data.modules[0].lessons?.length > 0) setActiveLesson(res.data.modules[0].lessons[0]);
        } else if (activeLesson && res.data.modules) {
          // Keep same active lesson but updated content if lang switched
          for (const m of res.data.modules) {
            const found = m.lessons?.find((l: any) => l.id === activeLesson.id);
            if (found) {
              setActiveLesson(found);
              break;
            }
          }
        }
      } catch (err) { 
        console.error(err); 
        // If offline and we loaded a cached course, auto-select first lesson so player works
        if (course && course.modules?.[0] && !activeLesson) {
          setExpandedModules([course.modules[0].id]);
          if (course.modules[0].lessons?.length > 0) setActiveLesson(course.modules[0].lessons[0]);
        }
      }
    };
    fetchCourse();
  }, [courseId, currentLang]);

  const handleLanguageChange = (langCode: string) => {
    setCurrentLang(langCode);
    setSearchParams(langCode === 'en' ? {} : { lang: langCode });
  };

  useEffect(() => {
    if (activeLesson) {
      if (activeLesson.type === 'quiz') {
        if (activeLesson.quiz_data) {
          setContentLoading(false);
        } else if (!activeLesson.content) {
          // Fallback: Fetch manual quiz directly if not attached to player payload
          const token = localStorage.getItem("token");
          axios.get(`${API_BASE_URL}/quizzes/content-item/${activeLesson.id}?lang=${currentLang}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => {
            if (res.data && res.data.questions && res.data.questions.length > 0) {
              setActiveLesson((prev: any) => (prev ? { ...prev, quiz_data: res.data } : prev));
            }
            setContentLoading(false);
          }).catch(() => {
            setContentLoading(false);
          });
        } else {
          setContentLoading(true);
          const timer = setTimeout(() => setContentLoading(false), 2000);
          return () => clearTimeout(timer);
        }
      } else if (activeLesson.type === 'note') {
        if (activeLesson.content) {
          setContentLoading(true);
          const timer = setTimeout(() => setContentLoading(false), 2000);
          return () => clearTimeout(timer);
        } else {
          setContentLoading(false);
        }
      } else {
        setContentLoading(false);
      }
    }
  }, [activeLesson?.id, activeLesson?.type, currentLang]);

  const toggleModule = (moduleId: number) => setExpandedModules(prev => prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]);

  const handleMarkComplete = async () => {
    if (!activeLesson || completedLessons.includes(activeLesson.id)) return;
    setIsMarking(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/progress/toggle`, { lesson_id: activeLesson.id }, { headers: { Authorization: `Bearer ${token}` } });
      setCompletedLessons(prev => [...prev, activeLesson.id]);
    } catch (err) { console.error(err); } finally { setIsMarking(false); }
  };

  const isModuleComplete = (module: any) => module.lessons && module.lessons.length > 0 && module.lessons.every((l: any) => completedLessons.includes(l.id));
  const isCourseComplete = useMemo(() => {
    if (!course || !course.modules) return false;
    let total = 0, completed = 0;
    course.modules.forEach((m: any) => m.lessons.forEach((l: any) => { total++; if (completedLessons.includes(l.id)) completed++; }));
    return total > 0 && completed === total;
  }, [course, completedLessons]);

  const handleDownloadCertificate = async () => {
    if (!isCourseComplete) return;
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/generate-pdf/${courseId}`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `${course.title.replace(/\s+/g, "_")}_Certificate.pdf`);
      document.body.appendChild(link); link.click();
    } catch (err: any) {
      if (err.response && err.response.status === 403) {
        setShowPendingCertModal(true);
      } else {
        triggerToast("Failed to generate certificate at this time.", "error");
      }
    }
  };

  const getEmbedUrl = (content: string) => {
    if (!content) return "";
    if (content.startsWith("/uploads/") || content.startsWith("uploads/")) {
      return resolveMediaUrl(content);
    }
    if (content.includes("docs.google.com/forms")) {
      return content.replace(/\/viewform.*/, "/viewform?embedded=true").replace(/\/view.*/, "/viewform?embedded=true");
    }
    if (content.includes("drive.google.com")) {
      return content.replace("/view", "/preview");
    }
    return resolveMediaUrl(content);
  };
  const getYoutubeId = (content: string) => { const match = content?.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/); return (match && match[2].length === 11) ? match[2] : null; };

  const handleDownloadYoutube = async (url: string, title: string) => {
    setIsDownloading(true);
    setDownloadProgress(0);
    
    // Fake progress animation for a much better user experience in hackathon
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 10) + 5;
      });
    }, 500);

    triggerToast("Starting download... This may take a minute.", "success");
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/offline/download`, { url, title }, { headers: { Authorization: `Bearer ${token}` } });
      setDownloadProgress(100);
      setTimeout(() => {
          triggerToast("Download complete! Available in ShareHub.", "success");
          setIsDownloading(false);
          setDownloadProgress(0);
      }, 500);
    } catch (err) {
      console.error(err);
      triggerToast("Failed to download video.", "error");
      setIsDownloading(false);
      setDownloadProgress(0);
    } finally {
      clearInterval(interval);
    }
  };

  const renderContent = () => {
    if (!activeLesson) return <div className="flex items-center justify-center h-full text-slate-400 font-bold tracking-widest uppercase">Select a lesson to begin</div>;
    const isDone = completedLessons.includes(activeLesson.id);

    return (
      <div className="flex flex-col h-full bg-transparent w-full relative">
        {/* WINDOWS LOADER OVERLAY */}
        <AnimatePresence>
            {contentLoading && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[100] bg-[#f8fafc]/90 backdrop-blur-xl flex items-center justify-center p-8 rounded-[3rem]"
                >
                    <WindowsLoader />
                </motion.div>
            )}
        </AnimatePresence>

        {/* CENTER STAGE: Content Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center w-full p-8 md:p-12">

          {activeLesson.type === "note" && (
            <div className="w-full h-full max-w-6xl rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/60 bg-white/50 backdrop-blur-xl mx-auto flex flex-col p-2">
              <div className="px-5 py-2.5 bg-white rounded-t-[1.5rem] border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-amber-500" />
                  <span className="text-xs font-bold text-slate-800 truncate">{activeLesson.title}</span>
                </div>
                {currentLang === 'hi' && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Sparkles size={11} className="text-emerald-500" /> हिन्दी PDF
                  </span>
                )}
                {currentLang === 'ta' && (
                  <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Sparkles size={11} className="text-cyan-500" /> தமிழ் PDF
                  </span>
                )}
              </div>
              {activeLesson.content ? (
                <iframe 
                  key={`${activeLesson.id}-${currentLang}-${activeLesson.content}`}
                  src={getEmbedUrl(activeLesson.content)} 
                  className="w-full h-full flex-1 rounded-b-[1.5rem] border-0 bg-white" 
                  onLoad={() => setContentLoading(false)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest bg-white rounded-b-[1.5rem]">No notes uploaded</div>
              )}
            </div>
          )}

          {activeLesson.type === "quiz" && (
            <div className="w-full h-full max-w-5xl rounded-[2rem] overflow-y-auto shadow-xl border border-slate-200/60 bg-white/70 backdrop-blur-xl mx-auto p-4 sm:p-6">
              {activeLesson.quiz_data ? (
                <ManualQuizPlayer
                  quiz={activeLesson.quiz_data}
                  language={currentLang}
                  onSubmitOnline={async (answers) => {
                    const token = localStorage.getItem("token");
                    const res = await axios.post(
                      `${API_BASE_URL}/quizzes/${activeLesson.quiz_data.id}/submit`,
                      { answers, language_code: currentLang },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    return res.data;
                  }}
                  onCompleted={(res) => {
                    if (res.passed && !completedLessons.includes(activeLesson.id)) {
                      handleMarkComplete();
                    }
                  }}
                />
              ) : activeLesson.content ? (
                <iframe 
                  src={getEmbedUrl(activeLesson.content)} 
                  className="w-full h-[75vh] rounded-[1.5rem] border-0 bg-white" 
                  onLoad={() => setContentLoading(false)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 font-bold uppercase tracking-widest bg-white rounded-[1.5rem] py-20">
                  No quiz uploaded
                </div>
              )}
            </div>
          )}

          {(activeLesson.type === "video" || activeLesson.type === "live_class") && (
            <div className="w-full flex flex-col items-center justify-center h-full">
              <div 
                ref={videoContainerRef}
                className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-black relative group"
              >
                
                {/* Download Button Overlay */}
                {getYoutubeId(activeLesson.content) && (
                  <button
                    onClick={() => handleDownloadYoutube(activeLesson.content, activeLesson.title)}
                    disabled={isDownloading}
                    className="absolute top-4 right-4 z-50 px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center overflow-hidden min-w-[160px] opacity-0 group-hover:opacity-100 disabled:opacity-100 shadow-xl border border-white/10"
                  >
                    {isDownloading && (
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-emerald-500/50 transition-all duration-300 ease-out" 
                        style={{ width: `${downloadProgress}%` }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-2">
                      {isDownloading ? <Loader2 size={16} className="animate-spin text-emerald-400" /> : <Download size={16} />}
                      {isDownloading ? `Downloading... ${downloadProgress}%` : "Download Offline"}
                    </div>
                  </button>
                )}

                {/* Subtitles & Dubbed Voice Badge */}
                {currentLang === 'ta' && activeLesson.dubbed_video_url ? (
                  <div className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-cyan-950/90 to-blue-950/90 backdrop-blur-md rounded-xl border border-cyan-400/40 text-white shadow-xl pointer-events-none">
                    <Sparkles size={14} className="text-cyan-400 animate-pulse" />
                    <span className="text-[11px] font-bold tracking-wide flex items-center gap-1.5">
                      <span>🎙️ AI4Bharat Natural Tamil Voice</span>
                      <span className="bg-cyan-500/30 text-cyan-200 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider border border-cyan-400/30">Active</span>
                    </span>
                  </div>
                ) : (activeLesson.subtitle_url || (activeLesson.subtitles && activeLesson.subtitles.length > 0) || blobTrackUrl) ? (
                  <div className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-lg pointer-events-none">
                    <Sparkles size={14} className="text-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-bold tracking-wide flex items-center gap-1.5">
                      <span>{currentLang === 'ta' ? '🇮🇳 தமிழ் Subtitles' : '🇮🇳 हिन्दी Subtitles'}</span>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase">Active</span>
                    </span>
                  </div>
                ) : null}

                {/* 🎯 ULTRA-RESPONSIVE DYNAMIC FLOATING SUBTITLE OVERLAY */}
                {currentSubtitleText && currentLang !== 'en' && (
                  <div className="absolute bottom-14 left-0 right-0 z-40 flex justify-center pointer-events-none px-6 select-none transition-all duration-150">
                    <div className="bg-slate-950/90 backdrop-blur-xl text-white text-sm sm:text-base md:text-xl font-bold px-6 py-2.5 rounded-2xl border border-white/20 shadow-2xl max-w-[85%] text-center tracking-wide leading-relaxed font-sans">
                      {currentSubtitleText}
                    </div>
                  </div>
                )}

                {/* 2. NATIVE VIDEO & STREAM PLAYER */}
                {getYoutubeId(activeLesson.content) ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeId(activeLesson.content)}?autoplay=1&rel=0&modestbranding=1`}
                    title={activeLesson.title}
                    className="w-full h-full rounded-[1.5rem] border-0 bg-black"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : activeLesson.content && (
                  activeLesson.content.startsWith("data:") || 
                  activeLesson.content.endsWith(".mp4") || 
                  activeLesson.content.endsWith(".webm") || 
                  activeLesson.content.endsWith(".ogg") ||
                  activeLesson.dubbed_video_url
                ) ? (
                  <video
                    key={`${activeLesson.id}-${currentLang}-${!!activeLesson.dubbed_video_url}`}
                    src={currentLang !== 'en' && activeLesson.dubbed_video_url
                      ? resolveMediaUrl(activeLesson.dubbed_video_url)
                      : (activeLesson.content.startsWith("data:") 
                          ? `${API_BASE_URL}/content/media/${activeLesson.id}` 
                          : resolveMediaUrl(activeLesson.content))}
                    controls
                    autoPlay
                    playsInline
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain bg-black rounded-[1.5rem]"
                    onLoadedData={(e) => {
                      const video = e.currentTarget;
                      if (video.textTracks) {
                        const isVideoFullscreen = document.fullscreenElement === video;
                        for (let i = 0; i < video.textTracks.length; i++) {
                          video.textTracks[i].mode = isVideoFullscreen ? 'showing' : 'hidden';
                        }
                      }
                    }}
                  >
                    {blobTrackUrl && (
                      <track
                        kind="subtitles"
                        label={currentLang === 'ta' ? 'தமிழ்' : 'हिन्दी'}
                        srcLang={currentLang}
                        src={blobTrackUrl}
                        default
                      />
                    )}
                    Your browser does not support HTML5 video.
                  </video>
                ) : activeLesson.content ? (
                  <iframe 
                    src={getEmbedUrl(activeLesson.content)} 
                    className="w-full h-full rounded-[1.5rem] border-0 bg-black" 
                    allowFullScreen
                    onLoad={() => setContentLoading(false)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 font-bold tracking-widest uppercase">Invalid Video Source</div>
                )}
              </div>
            </div>

          )}


          {activeLesson.type === "code_test" && <div className="w-full h-full"><CodeCompiler lesson={activeLesson} /></div>}

          {activeLesson.type === "assignment" && (
            <div className="flex flex-col items-center justify-center h-full text-center w-full max-w-3xl mx-auto">
              <div className="bg-white/80 backdrop-blur-3xl border border-slate-200/60 p-16 rounded-[3rem] w-full shadow-xl">
                <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-slate-100 shadow-sm">
                  <UploadCloud size={40} className="text-slate-800" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">{activeLesson.title}</h2>
                <p className="text-slate-500 mb-12 leading-relaxed whitespace-pre-wrap font-medium text-lg">{activeLesson.instructions || "Access the assignment details via the secure link below."}</p>
                <a href={activeLesson.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-3 bg-black text-white px-10 py-5 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-lg w-full text-lg">
                  Access Assignment Files <ExternalLink size={20} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="h-28 bg-white/90 backdrop-blur-2xl border-t border-slate-200/60 flex items-center justify-between px-8 md:px-14 shrink-0 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
          <div>
            <h3 className="text-slate-900 font-black text-2xl tracking-tight mb-1">{activeLesson.title}</h3>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">{activeLesson.type}</p>
          </div>

          {/* GREEN ACTION BUTTON */}
          <button
            onClick={handleMarkComplete} disabled={isDone || isMarking}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all text-sm ${isDone ? 'bg-green-50 border border-green-200 text-green-600 cursor-default' : 'bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-emerald-500/20 active:scale-95'}`}
          >
            {isDone ? <><CheckCircle size={20} /> Module Completed</> : <><CheckCircle size={20} /> Mark as Complete</>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans bg-[#f8fafc] text-slate-900 selection:bg-emerald-500 selection:text-white relative">

      {/* 🎨 THEME: Bright, Crisp Glass Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[150px] pointer-events-none opacity-80" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-slate-200/50 rounded-full blur-[180px] pointer-events-none" />

      {/* LEFT SIDEBAR */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 380, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex flex-col h-full bg-white/80 backdrop-blur-3xl border-r border-slate-200/60 z-30 shrink-0 relative shadow-2xl">

            <div className="pt-8 pb-4 px-8 shrink-0">
              <button onClick={() => navigate("/student-dashboard", { state: { activeTab: "learning" } })} className="flex items-center justify-center gap-3 text-slate-500 hover:text-slate-900 transition-colors font-bold text-sm bg-white border border-slate-200 px-5 py-3 rounded-2xl w-fit shadow-sm hover:bg-slate-50">
                <ChevronLeft size={18} /> Exit Player
              </button>
            </div>

            {/* Modules List */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {course?.modules.map((module: any, idx: number) => {
                const isExpanded = expandedModules.includes(module.id);
                const moduleComplete = isModuleComplete(module);

                return (
                  <div key={module.id} className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
                    <button onClick={() => toggleModule(module.id)} className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="text-left flex-1 pr-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phase {idx + 1}</span>
                          {moduleComplete && <CheckCircle size={14} className="text-emerald-500" />}
                        </div>
                        <div className={`text-base font-black tracking-tight ${moduleComplete ? 'text-slate-400' : 'text-slate-900'}`}>{module.title}</div>
                      </div>
                      {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50/50 border-t border-slate-100">
                          <div className="p-3 space-y-1.5">
                            {module.lessons.map((lesson: any) => {
                              const isActive = activeLesson?.id === lesson.id;
                              const isLessonDone = completedLessons.includes(lesson.id);

                              return (
                                <button key={lesson.id} onClick={() => setActiveLesson(lesson)} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive ? 'bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-slate-200 text-slate-900' : 'hover:bg-slate-100 border border-transparent text-slate-500'}`}>
                                  <div className={`${isActive ? 'text-slate-900' : isLessonDone ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {isLessonDone ? <CheckCircle size={18} /> : lesson.type === "video" ? <PlayCircle size={18} /> : lesson.type === "note" ? <FileText size={18} /> : lesson.type === "quiz" ? <HelpCircle size={18} /> : <UploadCloud size={18} />}
                                  </div>
                                  <div className={`text-sm text-left truncate flex-1 font-bold ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{lesson.title}</div>
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
            <div className="p-8 shrink-0 bg-white border-t border-slate-200/60">
              <div className={`relative overflow-hidden rounded-3xl p-6 border ${isCourseComplete ? 'border-green-200 bg-green-50 shadow-sm' : 'border-slate-100 bg-slate-50'} transition-all`}>
                <div className="relative z-10">
                  <h4 className={`font-black mb-2 flex items-center gap-3 text-base ${isCourseComplete ? "text-green-700" : "text-slate-700"}`}>
                    <Award size={20} /> Course Certificate
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold mb-6 uppercase tracking-widest">
                    {isCourseComplete ? "UNLOCKED & READY" : "COMPLETE ALL MODULES"}
                  </p>
                  {/* GREEN CLAIM BUTTON */}
                  <button onClick={handleDownloadCertificate} disabled={!isCourseComplete}
                    className={`w-full py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-3 transition-all ${isCourseComplete ? 'bg-[#10b981] text-white hover:bg-[#059669] shadow-md shadow-emerald-500/20' : 'bg-white border border-slate-200 text-slate-400 cursor-not-allowed shadow-sm'}`}
                  >
                    {isCourseComplete ? <><Unlock size={18} /> Claim Certificate</> : <><Lock size={18} /> Locked</>}
                  </button>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* RIGHT MAIN VIEW */}
      <div className="flex-1 flex flex-col relative z-20">
        <div className="absolute top-8 left-8 z-30">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-3 bg-white/80 backdrop-blur-2xl rounded-2xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white transition-colors shadow-sm">
            <Menu size={20} />
          </button>
        </div>

        {/* MULTILINGUAL LANGUAGE SWITCHER */}
        {course?.available_languages && course.available_languages.length > 1 && (
          <div className="absolute top-8 right-8 z-30 flex items-center bg-white/90 backdrop-blur-2xl p-1 rounded-2xl border border-slate-200/80 shadow-md">
            {course.available_languages.map((l: any) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  currentLang === l.code
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{l.code === 'hi' || l.code === 'ta' ? '🇮🇳' : '🇬🇧'}</span>
                <span>{l.nativeName}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 h-full pt-0">{renderContent()}</div>
      </div>

      {/* PENDING CERTIFICATE MODAL */}
      <AnimatePresence>
        {showPendingCertModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 relative text-center"
            >
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock size={32} className="text-amber-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">
                Instructor Review Pending
              </h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Congratulations on finishing the modules! Your instructor is currently reviewing and finalizing the course materials. Your official certificate will be unlocked automatically once the course is fully finalized.
              </p>
              <button
                onClick={() => setShowPendingCertModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-95"
              >
                Got it, I'll wait!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GLASSMORPHIC TOAST */}
      <GlassToast toast={{ show: toast.show, msg: toast.msg, type: toast.type as "success" | "error", id: 0 }} />
    </div>
  );
};

export default CoursePlayer;