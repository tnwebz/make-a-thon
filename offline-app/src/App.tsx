import React, { useState, useEffect, useRef, useMemo } from "react";
import JSZip from "jszip";
import { openDB, type IDBPDatabase } from "idb";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlayCircle, FileText, ChevronLeft, Menu, Code, HelpCircle,
  UploadCloud, CheckCircle, ChevronDown, ChevronRight, Lock,
  Unlock, Award, Play, Download, Loader2, Sparkles, Plus,
  FolderOpen, Trash2, BookOpen, Laptop, HardDrive, RefreshCw,
  Maximize2, ArrowLeft, Layers, Check, X, ShieldCheck, Smartphone
} from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { PdfViewer } from "./components/PdfViewer";

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

export default function App() {
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
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 1024 : false);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Android Native Back Button Handler
  useEffect(() => {
    let handlePromise: Promise<any> | null = null;
    try {
      if (typeof CapApp !== "undefined" && CapApp.addListener) {
        handlePromise = CapApp.addListener('backButton', () => {
          if (showLibraryModal) {
            setShowLibraryModal(false);
          } else if (isMobile && sidebarOpen) {
            setSidebarOpen(false);
          } else if (activeCourse && !activeLesson) {
            setActiveCourse(null);
          } else if (activeLesson) {
            setSidebarOpen(true);
          } else {
            CapApp.exitApp();
          }
        });
      }
    } catch (e) {
      // Non-Capacitor environment (desktop/browser)
    }

    return () => {
      if (handlePromise) {
        handlePromise.then(h => h && h.remove && h.remove()).catch(() => {});
      }
    };
  }, [showLibraryModal, isMobile, sidebarOpen, activeCourse, activeLesson]);

  const loadCachedCourses = async () => {
    setLoadingDB(true);
    try {
      if (typeof window !== "undefined" && "indexedDB" in window) {
        const db = await getOfflineDB();
        const stored = await db.getAll(STORE_COURSES);
        if (stored && stored.length > 0) {
          // Restore active blob URLs from persistent Blob data
          const restored: OfflineCourse[] = stored.map(c => ({
            ...c,
            modules: (c.modules || []).map(m => ({
              ...m,
              lessons: (m.lessons || []).map(l => {
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

          const rawBlob = await zipEntry.async("blob");
          const blobData = new Blob([rawBlob], { type: mimeType });
          const blobUrl = URL.createObjectURL(blobData);

          if (!moduleMap[moduleName]) moduleMap[moduleName] = [];
          moduleMap[moduleName].push({
            id: `lesson-${count++}`,
            title: fileName.replace(/\.[^/.]+$/, "").replace(/^\d+[\s-_]*/, ""),
            type,
            blobUrl,
            blobData,
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
            <div className="w-full h-full min-h-[65vh] sm:min-h-[75vh] max-w-6xl rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/70 bg-slate-900 flex flex-col mx-auto">
              {activeLesson.blobUrl ? (
                <PdfViewer blobUrl={activeLesson.blobUrl} title={activeLesson.title} />
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
            <h3 className="text-slate-900 font-black text-sm sm:text-lg md:text-2xl tracking-tight truncate">
              {activeLesson.title}
            </h3>
            <p className="text-slate-400 text-[10px] sm:text-[11px] font-black uppercase tracking-widest truncate">
              {activeLesson.type} • Native Client Offline
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

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-2xl text-xs font-black transition-colors shadow-xs cursor-pointer"
          title="Import another course ZIP"
        >
          <Plus size={14} />
          <span>Add ZIP</span>
        </button>
      </div>

      {/* Course Title Header */}
      <div className="p-6 pb-3 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Offline Course
          </span>
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight line-clamp-2">
          {activeCourse?.title || "Course"}
        </h2>
      </div>

      {/* Modules List Accordion */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 custom-scrollbar">
        {activeCourse?.modules?.map((mod, modIdx) => {
          const isExpanded = expandedModules.includes(String(mod.id));
          const modDone = isModuleComplete(mod);

          return (
            <div
              key={String(mod.id)}
              className="rounded-2xl border border-slate-200/80 bg-white/70 overflow-hidden shadow-xs transition-all"
            >
              {/* Module Header */}
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                    modDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {modDone ? <Check size={14} /> : modIdx + 1}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Phase {modIdx + 1}
                    </span>
                    <span className="font-extrabold text-xs sm:text-sm text-slate-800 line-clamp-1">
                      {mod.title}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-slate-400">
                    {mod.lessons?.length || 0}
                  </span>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
              </button>

              {/* Module Lessons */}
              {isExpanded && mod.lessons && (
                <div className="p-2 pt-0 space-y-1 border-t border-slate-100/80 bg-slate-50/40">
                  {mod.lessons.map(lesson => {
                    const isActive = activeLesson?.id === lesson.id;
                    const isLessonDone = completedLessonIds.includes(String(lesson.id));

                    return (
                      <button
                        key={String(lesson.id)}
                        onClick={() => handleSelectLesson(lesson)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs font-extrabold transition-all cursor-pointer ${
                          isActive
                            ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                            : "text-slate-600 hover:bg-slate-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          {lesson.type === "video" && <PlayCircle size={15} className={isActive ? "text-emerald-400" : isLessonDone ? "text-emerald-500" : "text-slate-400"} />}
                          {lesson.type === "note" && <FileText size={15} className={isActive ? "text-amber-400" : isLessonDone ? "text-emerald-500" : "text-slate-400"} />}
                          {(lesson.type === "quiz" || lesson.type === "code_test") && <Code size={15} className={isActive ? "text-indigo-400" : isLessonDone ? "text-emerald-500" : "text-slate-400"} />}
                          <span className="truncate">{lesson.title}</span>
                        </div>

                        {isLessonDone && (
                          <CheckCircle size={14} className={isActive ? "text-emerald-400 shrink-0" : "text-emerald-500 shrink-0"} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Certificate Banner */}
      <div className="p-5 border-t border-slate-100 shrink-0 bg-slate-50/60">
        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
          isCourseComplete 
            ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
            : "bg-white border-slate-200/80 text-slate-700"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isCourseComplete ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 text-slate-400"
            }`}>
              <Award size={18} />
            </div>
            <div>
              <div className="text-xs font-black">Course Certificate</div>
              <div className="text-[10px] text-slate-400 font-bold">
                {isCourseComplete ? "READY TO CLAIM" : "Complete all lessons"}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            {isCourseComplete ? (
              <span className="bg-emerald-500 text-white p-1.5 rounded-lg flex items-center justify-center">
                <Unlock size={14} />
              </span>
            ) : (
              <span className="text-slate-300 p-1.5 flex items-center justify-center">
                <Lock size={14} />
              </span>
            )}
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
      className="relative flex h-[100dvh] w-screen overflow-hidden bg-[#f8fafc] text-slate-900 select-none"
    >
      {/* Background Radial Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[450px] pointer-events-none opacity-60"
        style={{ background: "radial-gradient(circle at 50% 10%, rgba(5, 150, 105, 0.08) 0%, transparent 70%)" }}
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ================= LOADING OR NO ACTIVE COURSE ================= */}
      {loadingDB ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
            <Loader2 size={28} className="animate-spin text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">SkillForge Offline</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Initializing offline client...</p>
          </div>
        </div>
      ) : !activeCourse ? (
        <div className="flex-1 flex flex-col justify-between items-center p-6 sm:p-10 relative z-10 overflow-y-auto">
          {/* Header */}
          <header className="w-full max-w-4xl flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <img src="./pwa-192x192.png" alt="SkillForge" className="w-11 h-11 rounded-2xl shadow-md border border-slate-200/80" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">SkillForge Offline</h1>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Native Client
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
                  Standalone Offline Course Player
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold shadow-xs">
                <ShieldCheck size={14} />
                <span>100% Offline</span>
              </div>
            </div>
          </header>

          {/* Central '+' Drop Zone Card */}
          <div className="w-full max-w-xl my-auto py-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/80 backdrop-blur-2xl border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-[2.5rem] p-8 sm:p-12 text-center shadow-[0_20px_60px_rgba(0,0,0,0.03)] cursor-pointer group transition-all space-y-6 relative overflow-hidden"
            >
              {/* Center '+' Button */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 group-hover:bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-xl shadow-slate-900/10 group-hover:shadow-emerald-500/30 transition-all duration-300 transform group-hover:scale-105">
                <Plus size={44} strokeWidth={2.5} />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
                  Add Course Package
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                  Click or drag and drop your downloaded SkillForge <span className="font-mono font-bold text-slate-700">.zip</span> course package to start learning offline.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3.5 rounded-2xl">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-2xl transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <UploadCloud size={16} className="text-emerald-400" />
                  <span>Select Course ZIP</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-6 text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5"><HardDrive size={13} className="text-emerald-600" /> Stored Locally</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-indigo-600" /> 0 Internet Required</span>
              </div>
            </motion.div>
          </div>

          {/* Footer */}
          <footer className="w-full max-w-4xl text-center text-xs text-slate-400 font-medium pb-2">
            SkillForge Native Client &bull; Works with zero network connection after import
          </footer>
        </div>
      ) : (
        /* ================= IF ACTIVE COURSE -> RENDER MAIN PLAYER ================= */
        <div className="flex-1 flex overflow-hidden w-full h-full relative">
          
          {/* MOBILE DRAWER BACKDROP */}
          {isMobile && sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />
          )}

          {/* LEFT CURRICULUM SIDEBAR */}
          <aside
            className={`
              fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px] lg:static lg:w-80 xl:w-96
              border-r border-slate-200/80 bg-white flex flex-col h-full shrink-0 shadow-2xl lg:shadow-none
              transition-transform duration-300 ease-out
              ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
            `}
          >
            {renderSidebarContent()}
          </aside>

          {/* MAIN PLAYER VIEW */}
          <main className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden relative">
            {/* Top Toolbar */}
            <div className="p-3 sm:p-4 md:p-6 pb-0 flex items-center justify-between shrink-0 z-20">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setSidebarOpen(prev => !prev)}
                  className="p-2 sm:px-3 sm:py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 shadow-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <Menu size={15} />
                  <span>Modules</span>
                </button>

                <div className="flex items-center gap-2 bg-white border border-slate-200/80 px-3 py-1.5 rounded-full text-xs font-black text-slate-800 shadow-xs max-w-[180px] sm:max-w-xs truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{activeCourse.title}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLibraryModal(true)}
                  className="p-2 sm:px-3 sm:py-1.5 text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Manage Offline Courses"
                >
                  <Layers size={14} />
                  <span className="hidden sm:inline">Library</span>
                </button>

                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold shadow-xs">
                  <HardDrive size={13} />
                  <span className="hidden xs:inline">Offline Mode</span>
                </div>
              </div>
            </div>

            {/* Media Content Stage */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              {renderContentStage()}
            </div>
          </main>
        </div>
      )}

      {/* ================= UNPACKING MODAL ================= */}
      <AnimatePresence>
        {isUnpacking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 text-white"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full text-center space-y-5 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <Loader2 size={28} className="animate-spin" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">Importing Course Package</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">{unpackProgress.text}</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${unpackProgress.percent}%` }}
                />
              </div>

              <span className="text-[11px] font-mono text-emerald-400 font-bold block">
                {unpackProgress.percent}%
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= COURSE LIBRARY MODAL ================= */}
      <AnimatePresence>
        {showLibraryModal && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLibraryModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-[2rem] border border-slate-200 shadow-2xl p-6 sm:p-8 z-10 overflow-hidden text-slate-900 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Offline Course Library</h3>
                    <p className="text-xs text-slate-400 font-semibold">{courses.length} courses stored on device</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowLibraryModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Course List */}
              <div className="flex-1 overflow-y-auto py-4 space-y-2.5 custom-scrollbar">
                {courses.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest">
                    No imported courses yet.
                  </div>
                ) : (
                  courses.map(c => {
                    const isCurrent = activeCourse?.id === c.id;
                    const totalLessons = c.modules?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) || 0;

                    return (
                      <div
                        key={c.id}
                        onClick={() => selectCourse(c)}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-slate-900 text-white border-slate-900 shadow-md"
                            : "bg-white border-slate-200/80 hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 pr-3 flex-1">
                          <h4 className="font-black text-sm truncate">{c.title}</h4>
                          <div className={`flex items-center gap-3 text-[11px] font-bold mt-1 ${isCurrent ? "text-slate-400" : "text-slate-400"}`}>
                            <span>{c.modules?.length || 0} Modules</span>
                            <span>&bull;</span>
                            <span>{totalLessons} Lessons</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrent && (
                            <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                              Active
                            </span>
                          )}

                          <button
                            onClick={(e) => handleDeleteCourse(c.id, e)}
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${
                              isCurrent ? "text-slate-400 hover:text-red-400 hover:bg-slate-800" : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                            }`}
                            title="Delete course from device"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Button in Modal */}
              <div className="pt-3 border-t border-slate-100 shrink-0">
                <button
                  onClick={() => {
                    setShowLibraryModal(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Import Another Course ZIP</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
