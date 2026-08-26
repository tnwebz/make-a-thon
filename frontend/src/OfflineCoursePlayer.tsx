import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { openDB, type IDBPDatabase } from "idb";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, FileText, ChevronLeft, Menu, Code, HelpCircle,
  UploadCloud, CheckCircle, ChevronDown, ChevronRight, Lock,
  Unlock, Award, Play, Download, Loader2, Sparkles, Plus,
  FolderOpen, Trash2, BookOpen, Laptop, HardDrive, RefreshCw,
  Maximize2, ArrowLeft, Layers, Check, X, ShieldCheck
} from "lucide-react";
import { usePwaInstall } from "./usePwaInstall";
import { InstallAppModal } from "./components/InstallAppModal";

interface OfflineLesson {
  id: string | number;
  title: string;
  type: "video" | "note" | "quiz" | "code_test";
  blobUrl?: string;
  blobData?: Blob;
  textContent?: string | null;
  mimeType?: string;
  duration?: number | null;
  order: number;
}

interface OfflineModule {
  id: string | number;
  title: string;
  order: number;
  lessons: OfflineLesson[];
}

interface OfflineCourse {
  id: string;
  title: string;
  description?: string;
  importedAt: string;
  language?: string;
  modules: OfflineModule[];
}

const DB_NAME = "skillforge_offline_lms";
const DB_VERSION = 1;
const STORE_COURSES = "courses";
const STORE_PROGRESS = "progress";

async function getOfflineDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_COURSES)) {
        db.createObjectStore(STORE_COURSES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS, { keyPath: "courseId" });
      }
    },
  });
}

const OfflineCoursePlayer: React.FC = () => {
  const navigate = useNavigate();

  // Course library & active state
  const [courses, setCourses] = useState<OfflineCourse[]>([]);
  const [activeCourse, setActiveCourse] = useState<OfflineCourse | null>(null);
  const [activeLesson, setActiveLesson] = useState<OfflineLesson | null>(null);
  const [loadingDB, setLoadingDB] = useState(true);

  // Unpacking & drag-drop states
  const [isDragging, setIsDragging] = useState(false);
  const [isUnpacking, setIsUnpacking] = useState(false);
  const [unpackProgress, setUnpackProgress] = useState<{ percent: number; text: string }>({ percent: 0, text: "" });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Player UI states
  const { canInstall, isInstalled } = usePwaInstall();
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 1024 : false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Resize listener for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize DB and load cached courses
  useEffect(() => {
    loadCachedCourses();
  }, []);

  const loadCachedCourses = async () => {
    setLoadingDB(true);
    try {
      if (typeof window !== "undefined" && "indexedDB" in window) {
        const db = await getOfflineDB();
        const stored = await db.getAll(STORE_COURSES);
        if (stored && stored.length > 0) {
          // Restore active blob URLs from persistent Blob data
          const restored: OfflineCourse[] = stored.map((c: OfflineCourse) => ({
            ...c,
            modules: (c.modules || []).map((m: OfflineModule) => ({
              ...m,
              lessons: (m.lessons || []).map((l: OfflineLesson) => {
                let blobUrl = l.blobUrl;
                if (l.blobData) {
                  try {
                    blobUrl = URL.createObjectURL(l.blobData);
                  } catch (e) {}
                }
                return { ...l, blobUrl };
              })
            }))
          }));

          setCourses(restored);
          selectCourse(restored[0]);
        }
      }
    } catch (e) {
      console.error("IndexedDB load error:", e);
    } finally {
      setLoadingDB(false);
    }
  };

  const selectCourse = async (c: OfflineCourse) => {
    setActiveCourse(c);
    if (c.modules && c.modules.length > 0) {
      setExpandedModules([String(c.modules[0].id)]);
      if (c.modules[0].lessons && c.modules[0].lessons.length > 0) {
        setActiveLesson(c.modules[0].lessons[0]);
      }
    }
    // Load progress for this course
    try {
      const db = await getOfflineDB();
      const progressRecord = await db.get(STORE_PROGRESS, c.id);
      if (progressRecord && Array.isArray(progressRecord.completed)) {
        setCompletedLessonIds(progressRecord.completed);
      } else {
        setCompletedLessonIds([]);
      }
    } catch (e) {}
    setShowLibraryModal(false);
  };

  const handleMarkComplete = async () => {
    if (!activeLesson || !activeCourse) return;
    const lessonIdStr = String(activeLesson.id);
    const nextCompleted = completedLessonIds.includes(lessonIdStr)
      ? completedLessonIds.filter(id => id !== lessonIdStr)
      : [...completedLessonIds, lessonIdStr];

    setCompletedLessonIds(nextCompleted);

    try {
      const db = await getOfflineDB();
      await db.put(STORE_PROGRESS, {
        courseId: activeCourse.id,
        completed: nextCompleted,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Save progress error:", e);
    }
  };

  const toggleModule = (modId: string | number) => {
    const idStr = String(modId);
    setExpandedModules(prev =>
      prev.includes(idStr) ? prev.filter(i => i !== idStr) : [...prev, idStr]
    );
  };

  const handleSelectLesson = (lesson: OfflineLesson) => {
    setActiveLesson(lesson);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // ZIP Unpacking Engine
  const processZipFile = async (file: File) => {
    setIsUnpacking(true);
    setErrorMsg(null);
    setUnpackProgress({ percent: 10, text: "Reading course package..." });

    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      setUnpackProgress({ percent: 30, text: "Parsing course structure..." });

      // Find course_manifest.json if available
      let manifestFile = loadedZip.file("course_manifest.json");
      if (!manifestFile) {
        // Search inside root subfolders (e.g., CourseName/course_manifest.json)
        const matches = loadedZip.file(/course_manifest\.json$/);
        if (matches.length > 0) {
          manifestFile = matches[0];
        }
      }

      let parsedCourse: OfflineCourse;

      if (manifestFile) {
        // Manifest-driven unpacking
        const manifestText = await manifestFile.async("text");
        const manifest = JSON.parse(manifestText);
        setUnpackProgress({ percent: 50, text: "Unpacking videos and notes..." });

        const manifestDir = manifestFile.name.replace("course_manifest.json", "");
        const allEntries = Object.keys(loadedZip.files).filter(k => !loadedZip.files[k].dir);

        // Robust ZIP entry lookup function that handles directory prefixes and relative paths
        const findZipEntry = (filePath: string) => {
          if (!filePath) return null;
          const cleanPath = filePath.replace(/^\/+/, "").replace(/\\+/g, "/");

          // 1. Direct match
          if (loadedZip.file(cleanPath)) return loadedZip.file(cleanPath);
          if (loadedZip.file(filePath)) return loadedZip.file(filePath);

          // 2. Match with manifest directory prefix
          if (manifestDir) {
            const prefixed = `${manifestDir}${cleanPath}`.replace(/^\/+/, "");
            if (loadedZip.file(prefixed)) return loadedZip.file(prefixed);
          }

          // 3. Match by suffix (e.g. entry is "CourseName/Module 1/01 - video.mp4" and path is "Module 1/01 - video.mp4")
          const suffixMatch = allEntries.find(k => 
            k.endsWith(cleanPath) || 
            k.toLowerCase().endsWith(cleanPath.toLowerCase())
          );
          if (suffixMatch) return loadedZip.file(suffixMatch);

          // 4. Match by filename only
          const fileName = cleanPath.split("/").pop();
          if (fileName) {
            const fileMatch = allEntries.find(k => 
              k.endsWith(fileName) || 
              k.toLowerCase().endsWith(fileName.toLowerCase())
            );
            if (fileMatch) return loadedZip.file(fileMatch);
          }

          return null;
        };

        const modules: OfflineModule[] = [];
        const totalLessons = manifest.modules.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0);
        let processedLessons = 0;

        for (const m of manifest.modules || []) {
          const lessons: OfflineLesson[] = [];

          for (const l of m.lessons || []) {
            let blobUrl: string | undefined = undefined;
            let blobData: Blob | undefined = undefined;
            let mimeType = "application/octet-stream";

            if (l.filePath) {
              const mediaZipEntry = findZipEntry(l.filePath);

              if (mediaZipEntry) {
                const ext = mediaZipEntry.name.toLowerCase();
                if (ext.endsWith(".mp4")) mimeType = "video/mp4";
                else if (ext.endsWith(".webm")) mimeType = "video/webm";
                else if (ext.endsWith(".mov")) mimeType = "video/mp4";
                else if (ext.endsWith(".pdf")) mimeType = "application/pdf";
                else if (ext.endsWith(".txt")) mimeType = "text/plain";

                const rawBlob = await mediaZipEntry.async("blob");
                blobData = new Blob([rawBlob], { type: mimeType });
                blobUrl = URL.createObjectURL(blobData);
              }
            }

            lessons.push({
              id: l.id || `lesson-${Date.now()}-${Math.random()}`,
              title: l.title || "Lesson",
              type: (l.type as any) || (l.filePath?.endsWith(".mp4") ? "video" : "note"),
              blobUrl,
              blobData,
              textContent: l.textContent || null,
              mimeType,
              duration: l.duration || null,
              order: l.order || 1
            });

            processedLessons++;
            const pct = 50 + Math.round((processedLessons / Math.max(totalLessons, 1)) * 45);
            setUnpackProgress({ percent: pct, text: `Unpacking: ${l.title}` });
          }

          modules.push({
            id: m.id || `mod-${Date.now()}-${Math.random()}`,
            title: m.title || "Module",
            order: m.order || 1,
            lessons
          });
        }

        parsedCourse = {
          id: `course-${Date.now()}`,
          title: manifest.title || file.name.replace(/\.zip$/i, ""),
          description: manifest.description || "Offline course package",
          importedAt: new Date().toISOString(),
          language: manifest.language || (file.name.toLowerCase().includes("hindi") ? "hi" : "en"),
          modules
        };
      } else {
        // Fallback: Smart file & folder structure parser
        setUnpackProgress({ percent: 50, text: "Auto-detecting course files and modules..." });

        const moduleMap: Record<string, OfflineLesson[]> = {};
        const entries = Object.keys(loadedZip.files).filter(p => !loadedZip.files[p].dir);

        let count = 0;
        for (const relativePath of entries) {
          const parts = relativePath.split("/").filter(Boolean);
          if (parts.length === 0) continue;

          const fileName = parts[parts.length - 1];
          const moduleName = parts.length > 1 ? parts[parts.length - 2] : "Course Materials";

          if (fileName.startsWith(".") || fileName.toLowerCase() === "course_manifest.json") continue;

          const zipEntry = loadedZip.files[relativePath];
          const ext = fileName.toLowerCase();
          let type: "video" | "note" = "note";
          let mimeType = "application/octet-stream";

          if (ext.endsWith(".mp4") || ext.endsWith(".webm") || ext.endsWith(".mov")) {
            type = "video";
            mimeType = ext.endsWith(".webm") ? "video/webm" : "video/mp4";
          } else if (ext.endsWith(".pdf")) {
            type = "note";
            mimeType = "application/pdf";
          } else if (ext.endsWith(".txt") || ext.endsWith(".md")) {
            type = "note";
            mimeType = "text/plain";
          }

          const blob = await zipEntry.async("blob");
          const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));

          if (!moduleMap[moduleName]) moduleMap[moduleName] = [];
          moduleMap[moduleName].push({
            id: `lesson-${count++}`,
            title: fileName.replace(/\.[^/.]+$/, "").replace(/^\d+[\s-_]*/, ""),
            type,
            blobUrl,
            mimeType,
            order: count
          });
        }

        const modules: OfflineModule[] = Object.keys(moduleMap).map((name, idx) => ({
          id: `mod-${idx + 1}`,
          title: name,
          order: idx + 1,
          lessons: moduleMap[name]
        }));

        parsedCourse = {
          id: `course-${Date.now()}`,
          title: file.name.replace(/\.zip$/i, ""),
          description: "Locally imported course package",
          importedAt: new Date().toISOString(),
          modules
        };
      }

      setUnpackProgress({ percent: 100, text: "Course ready!" });

      // Save to DB and state
      try {
        const db = await getOfflineDB();
        await db.put(STORE_COURSES, parsedCourse);
      } catch (e) {}

      setCourses(prev => [parsedCourse, ...prev.filter(c => c.id !== parsedCourse.id)]);
      selectCourse(parsedCourse);
    } catch (err: any) {
      console.error("ZIP processing error:", err);
      setErrorMsg("Failed to unpack course ZIP. Please make sure this is a valid course file.");
    } finally {
      setIsUnpacking(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".zip")) {
        processZipFile(file);
      } else {
        setErrorMsg("Please drop a valid .zip course file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processZipFile(e.target.files[0]);
    }
  };

  const handleDeleteCourse = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this offline course?")) return;
    try {
      const db = await getOfflineDB();
      await db.delete(STORE_COURSES, courseId);
      await db.delete(STORE_PROGRESS, courseId);
      const remaining = courses.filter(c => c.id !== courseId);
      setCourses(remaining);
      if (activeCourse?.id === courseId) {
        if (remaining.length > 0) {
          selectCourse(remaining[0]);
        } else {
          setActiveCourse(null);
          setActiveLesson(null);
        }
      }
    } catch (e) {
      console.error("Delete course error:", e);
    }
  };

  // Check completion
  const isModuleComplete = (mod: OfflineModule) => {
    return mod.lessons && mod.lessons.length > 0 && mod.lessons.every(l => completedLessonIds.includes(String(l.id)));
  };

  const isCourseComplete = useMemo(() => {
    if (!activeCourse || !activeCourse.modules || activeCourse.modules.length === 0) return false;
    let total = 0;
    let completed = 0;
    activeCourse.modules.forEach(m => {
      m.lessons.forEach(l => {
        total++;
        if (completedLessonIds.includes(String(l.id))) completed++;
      });
    });
    return total > 0 && completed === total;
  }, [activeCourse, completedLessonIds]);

  // Next / Prev lessons
  const allLessons = activeCourse?.modules?.flatMap(m => m.lessons) || [];
  const currentIndex = allLessons.findIndex(l => l.id === activeLesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Render Lesson Content Stage
  const renderContentStage = () => {
    if (!activeLesson) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 font-bold p-6 text-center">
          <BookOpen size={48} className="mb-3 opacity-40" />
          <span className="tracking-widest uppercase text-xs sm:text-sm">Select a lesson to begin</span>
        </div>
      );
    }

    const isDone = completedLessonIds.includes(String(activeLesson.id));

    return (
      <div className="flex flex-col h-full bg-transparent w-full relative">
        {/* CENTER STAGE */}
        <div className="flex-1 relative overflow-y-auto lg:overflow-hidden flex flex-col items-center justify-center w-full p-2.5 sm:p-5 md:p-8">

          {/* 1. PDF / NOTES */}
          {activeLesson.type === "note" && (
            <div className="w-full h-full min-h-[65vh] sm:min-h-[75vh] max-w-6xl rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/70 bg-white flex flex-col mx-auto">
              
              {/* PDF Top Bar */}
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-semibold shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={15} className="text-amber-400 shrink-0" />
                  <span className="truncate">{activeLesson.title}</span>
                </div>
                {activeLesson.blobUrl && (
                  <a
                    href={activeLesson.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-colors"
                  >
                    <Maximize2 size={13} />
                    <span>Fullscreen</span>
                  </a>
                )}
              </div>

              {activeLesson.blobUrl ? (
                <iframe
                  key={String(activeLesson.id)}
                  src={`${activeLesson.blobUrl}#toolbar=1&navpanes=0`}
                  title={activeLesson.title}
                  className="w-full flex-1 border-0 bg-white"
                />
              ) : (
                <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-white">
                  <div className="flex items-center gap-2 text-amber-600 text-xs font-black uppercase tracking-wider mb-4">
                    <FileText size={16} />
                    <span>Study Notes & Documentation</span>
                  </div>
                  <div className="prose prose-slate max-w-none text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
                    {activeLesson.textContent || "No written notes in this lesson file."}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. VIDEO PLAYER */}
          {activeLesson.type === "video" && (
            <div className="w-full flex flex-col items-center justify-center h-full max-w-5xl">
              <div className="w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-black relative flex items-center justify-center">
                {activeLesson.blobUrl ? (
                  <video
                    key={String(activeLesson.id)}
                    controls
                    autoPlay
                    playsInline
                    controlsList="nodownload"
                    className="w-full h-full object-contain bg-black"
                    src={activeLesson.blobUrl}
                  >
                    Your browser does not support offline video playback.
                  </video>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 font-bold tracking-widest uppercase text-xs sm:text-sm">
                    No Offline Video Source Found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. CODE TEST / QUIZ */}
          {(activeLesson.type === "code_test" || activeLesson.type === "quiz") && (
            <div className="w-full h-full max-w-5xl rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-slate-200/60 bg-white p-5 sm:p-8">
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-wider mb-3">
                <Code size={16} />
                <span>Offline Assignment</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">{activeLesson.title}</h2>
              <div className="p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {activeLesson.textContent || "Complete this offline lesson as instructed."}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM ACTION DOCK */}
        <div className="py-3 sm:py-4 md:py-6 bg-white/95 backdrop-blur-2xl border-t border-slate-200/70 flex items-center justify-between px-3 sm:px-6 md:px-12 shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] gap-2">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight truncate flex items-center gap-2">
              <span>{activeLesson.title}</span>
              {(activeCourse?.language === "hi" || activeLesson.title.toLowerCase().includes("hindi")) && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                  <Sparkles size={10} className="text-emerald-500" /> हिन्दी
                </span>
              )}
              {(activeCourse?.language === "ta" || activeLesson.title.toLowerCase().includes("tamil")) && (
                <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
                  <Sparkles size={10} className="text-cyan-500" /> தமிழ்
                </span>
              )}
            </h3>
            <p className="text-slate-400 text-[10px] sm:text-[11px] font-black uppercase tracking-widest truncate">
              {activeLesson.type} • Offline Mode
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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

  // Render Sidebar Curriculum
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-3xl">
      {/* Top Bar */}
      <div className="pt-6 pb-4 px-6 shrink-0 flex items-center justify-between border-b border-slate-100">
        <button
          onClick={() => setShowLibraryModal(true)}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold text-xs sm:text-sm bg-slate-100 hover:bg-slate-200 px-3.5 py-2.5 rounded-2xl transition-colors cursor-pointer"
        >
          <Layers size={16} />
          <span>Courses ({courses.length})</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
            title="Import Another Course ZIP"
          >
            <Plus size={16} />
          </button>

          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close Curriculum"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Modules List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
        {activeCourse?.modules?.map((module, idx) => {
          const isExpanded = expandedModules.includes(String(module.id));
          const moduleComplete = isModuleComplete(module);

          return (
            <div key={String(module.id)} className="bg-white border border-slate-200/70 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs">
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
                        const isLessonDone = completedLessonIds.includes(String(lesson.id));

                        return (
                          <button
                            key={String(lesson.id)}
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
                              ) : lesson.type === "video" ? (
                                <PlayCircle size={16} />
                              ) : (
                                <FileText size={16} />
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

      {/* Certificate Gate */}
      <div className="p-4 sm:p-6 shrink-0 bg-white border-t border-slate-200/60">
        <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 border ${isCourseComplete ? "border-green-200 bg-green-50 shadow-xs" : "border-slate-100 bg-slate-50"} transition-all`}>
          <div className="relative z-10">
            <h4 className={`font-black mb-1 flex items-center gap-2 text-sm sm:text-base ${isCourseComplete ? "text-green-700" : "text-slate-700"}`}>
              <Award size={18} /> Offline Certificate
            </h4>
            <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-widest">
              {isCourseComplete ? "UNLOCKED & READY" : "COMPLETE ALL MODULES"}
            </p>
            <div className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 ${
              isCourseComplete ? "bg-emerald-500 text-white shadow-xs" : "bg-white border border-slate-200 text-slate-400"
            }`}>
              {isCourseComplete ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{isCourseComplete ? "Course Mastered" : "Locked"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex h-[100dvh] w-screen overflow-hidden font-sans bg-[#f8fafc] text-slate-900 selection:bg-emerald-500 selection:text-white relative"
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".zip"
        className="hidden"
      />

      {/* Background Studio Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[150px] pointer-events-none opacity-80" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-slate-200/50 rounded-full blur-[180px] pointer-events-none" />

      {/* Dragging Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-emerald-950/70 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white pointer-events-none border-4 border-dashed border-emerald-400">
          <UploadCloud size={64} className="animate-bounce text-emerald-300 mb-4" />
          <h2 className="text-3xl font-black mb-2">Drop Course ZIP Here</h2>
          <p className="text-emerald-200 text-sm font-semibold">SkillForge Offline Player will unpack and structure it automatically!</p>
        </div>
      )}

      {/* Unpacking Overlay Modal */}
      {isUnpacking && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white">
          <div className="bg-slate-900 border border-slate-700/80 p-8 rounded-3xl max-w-md w-full text-center space-y-5 shadow-2xl">
            <Loader2 size={48} className="animate-spin text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-xl font-black">Unpacking Course</h3>
              <p className="text-xs text-slate-400 mt-1">{unpackProgress.text}</p>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${unpackProgress.percent}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">{unpackProgress.percent}%</span>
          </div>
        </div>
      )}

      {/* IF NO ACTIVE COURSE: SHOW THE GLOWING '+' DROP ZONE */}
      {!activeCourse ? (
        <div className="flex-1 flex flex-col items-center justify-between p-6 sm:p-10 z-20 overflow-y-auto">
          
          {/* Header */}
          <div className="w-full max-w-4xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-sm">
                S
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">SkillForge Offline</h1>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
                  Standalone Course Player
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isInstalled ? (
                <button
                  onClick={() => setShowInstallModal(true)}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <Download size={13} />
                  <span>Install SkillForge App</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs">
                  <Laptop size={13} />
                  <span>SkillForge Installed</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs">
                <ShieldCheck size={14} />
                <span>100% Offline</span>
              </div>
            </div>
          </div>

          {/* Central '+' Drop Zone Card */}
          <div className="w-full max-w-xl my-auto py-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/80 backdrop-blur-2xl border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-[2.5rem] p-8 sm:p-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.03)] cursor-pointer group transition-all space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Sparkles size={20} className="text-emerald-500" />
              </div>

              {/* Glowing '+' Center Icon */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 group-hover:bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-xl shadow-slate-900/10 group-hover:shadow-emerald-500/30 transition-all group-hover:scale-105 duration-300">
                <Plus size={48} className="stroke-[2.5]" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
                  Drop Course ZIP Here
                </h2>
                <p className="text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                  Drag and drop your downloaded course package, or click anywhere to select the <span className="font-mono font-bold text-slate-700">.zip</span> file from your device.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3 rounded-2xl">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <UploadCloud size={16} />
                  <span>Select Course ZIP</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-6 text-[11px] font-bold text-slate-400">
                <span>⚡ Zero Internet Required</span>
                <span>🔒 Stored Securely on Device</span>
              </div>
            </motion.div>
          </div>

          {/* Footer note */}
          <footer className="w-full max-w-4xl text-center text-xs text-slate-400 font-medium">
            SkillForge Offline Course Runtime • Works anywhere without Wi-Fi
          </footer>

        </div>
      ) : (
        /* IF COURSE IS LOADED: RENDER THE FULL PLAYER INTERFACE */
        <>
          {/* 1. DESKTOP SIDEBAR */}
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

          {/* 2. MOBILE / TABLET OVERLAY DRAWER */}
          {isMobile && (
            <AnimatePresence>
              {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSidebarOpen(false)}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
                  />
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

          {/* RIGHT MAIN STAGE */}
          <div className="flex-1 flex flex-col relative z-20 overflow-hidden h-full">
            
            {/* Top Bar */}
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

                <div className="flex items-center gap-2 bg-slate-100/80 border border-slate-200/60 px-3.5 py-1.5 rounded-full text-xs font-extrabold text-slate-700 max-w-[200px] md:max-w-xs truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{activeCourse.title}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isInstalled && (
                  <button
                    onClick={() => setShowInstallModal(true)}
                    className="p-2 sm:px-3 sm:py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Install SkillForge App to Desktop or Home Screen"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Install SkillForge App</span>
                  </button>
                )}

                <button
                  onClick={() => setShowLibraryModal(true)}
                  className="p-2 sm:px-3 sm:py-1.5 text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Manage Offline Courses"
                >
                  <Layers size={14} />
                  <span className="hidden sm:inline">Library</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 sm:px-3 sm:py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Add Another Course"
                >
                  <Plus size={14} />
                  <span className="hidden sm:inline">Add ZIP</span>
                </button>
              </div>
            </div>

            {/* Content Stage */}
            <div className="flex-1 h-full overflow-hidden">
              {renderContentStage()}
            </div>
          </div>
        </>
      )}

      {/* COURSE LIBRARY MODAL */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">Downloaded Course Library</h3>
                <p className="text-xs text-slate-400 font-medium">Courses stored locally on this device</p>
              </div>
              <button
                onClick={() => setShowLibraryModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5 custom-scrollbar">
              {courses.map(c => (
                <div
                  key={c.id}
                  onClick={() => selectCourse(c)}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                    activeCourse?.id === c.id
                      ? "border-emerald-500 bg-emerald-50/50"
                      : "border-slate-100 hover:border-slate-300 bg-slate-50/50"
                  }`}
                >
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{c.title}</h4>
                    <p className="text-xs text-slate-400 font-medium">
                      {c.modules.length} Modules • {c.modules.reduce((a, m) => a + m.lessons.length, 0)} Lessons
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeCourse?.id === c.id && (
                      <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-md">
                        ACTIVE
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteCourse(c.id, e)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete offline course"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button
                onClick={() => { setShowLibraryModal(false); fileInputRef.current?.click(); }}
                className="flex items-center gap-2 text-xs font-black text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                <Plus size={16} />
                <span>Import New Course ZIP</span>
              </button>
              <button
                onClick={() => setShowLibraryModal(false)}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Desktop App Install Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

    </div>
  );
};

export default OfflineCoursePlayer;
