import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, resolveMediaUrl } from "./config";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  ArrowLeft, Video, HelpCircle, FileText, Star,
  Trash2, Edit3, Layout, ChevronDown, Plus, Code, Radio, Zap,
  X, Clock, Lock, BarChart, GripVertical, Save, Users, Award, TrendingUp, BookOpen, Image as ImageIcon,
  UploadCloud, Globe, Sparkles, CheckCircle2, AlertCircle, RotateCw, ExternalLink, RefreshCw, Play, PlayCircle,
  Mic, Volume2, Sliders, Music
} from "lucide-react";

import { GlassToast } from "./components/GlassToast";
import BatchManagementTab from "./BatchManagementTab";

interface CodeProblem {
  title: string;
  description: string;
  difficulty: string;
  testCases: { input: string; output: string }[];
}

interface QuizOptionForm {
  id?: number;
  option_text: string;
  option_index: number;
}

interface QuizQuestionForm {
  id?: number;
  question_text: string;
  order_index: number;
  correct_option_index: number; // 0, 1, 2, or 3
  options: QuizOptionForm[];
}

const getLessonIcon = (type: string) => {
  switch (type) {
    case 'video': return <Video size={18} className="text-blue-500" />;
    case 'note': return <FileText size={18} className="text-amber-500" />;
    case 'quiz': return <HelpCircle size={18} className="text-emerald-500" />;
    case 'code': return <Code size={18} className="text-purple-500" />;
    case 'assignment': return <FileText size={18} className="text-indigo-500" />;
    case 'live': return <Radio size={18} className="text-red-500" />;
    case 'test': return <Zap size={18} className="text-yellow-500" />;
    default: return <FileText size={18} className="text-slate-500" />;
  }
};

const CourseBuilder = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Course State
  const [courseTitle, setCourseTitle] = useState("Loading...");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseImageUrl, setCourseImageUrl] = useState("");
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeConfirmation, setFinalizeConfirmation] = useState("");

  // UI State
  const [expandedModules, setExpandedModules] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "Curriculum");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  // Batches State
  const [batches, setBatches] = useState<any[]>([]);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchSection, setNewBatchSection] = useState("");

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Languages State
  const [languagesList, setLanguagesList] = useState<any[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [isGeneratingHindi, setIsGeneratingHindi] = useState(false);
  const [hindiProgressData, setHindiProgressData] = useState<any>(null);
  const [isGeneratingTamil, setIsGeneratingTamil] = useState(false);
  const [tamilProgressData, setTamilProgressData] = useState<any>(null);
  const [isGeneratingHindiSubs, setIsGeneratingHindiSubs] = useState(false);
  const [isGeneratingTamilSubs, setIsGeneratingTamilSubs] = useState(false);
  const [videoSummary, setVideoSummary] = useState<any>(null);

  // Settings & Pricing State
  const [priceType, setPriceType] = useState("Free");
  const [priceAmount, setPriceAmount] = useState("0");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Add Module State
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  // Content Selection Modal
  const [showContentPicker, setShowContentPicker] = useState<number | null>(null);

  // Add/Edit Item Modal State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [itemTitle, setItemTitle] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [itemInstructions, setItemInstructions] = useState("");
  const [duration, setDuration] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);

  const [problems, setProblems] = useState<CodeProblem[]>([
    { title: "", description: "", difficulty: "Easy", testCases: [{ input: "", output: "" }] }
  ]);

  // Quiz Builder State
  const [quizType, setQuizType] = useState<"manual" | "external">("manual");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionForm[]>([
    {
      question_text: "",
      order_index: 1,
      correct_option_index: 0,
      options: [
        { option_text: "", option_index: 0 },
        { option_text: "", option_index: 1 },
        { option_text: "", option_index: 2 },
        { option_text: "", option_index: 3 },
      ]
    }
  ]);

  // 🎙️ Multilingual Voice Studio State (Tamil & Hindi)
  const [voiceModalItem, setVoiceModalItem] = useState<any | null>(null);
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<"ta" | "hi">("ta");
  const [voiceMode, setVoiceMode] = useState<"auto" | "manual">("auto");
  const [voiceStartTime, setVoiceStartTime] = useState("0");
  const [voiceEndTime, setVoiceEndTime] = useState("12");
  const [customTranscript, setCustomTranscript] = useState("");
  const [extractedRefVoice, setExtractedRefVoice] = useState<any | null>(null);
  const [isExtractingRef, setIsExtractingRef] = useState(false);
  const [isGeneratingVoiceDub, setIsGeneratingVoiceDub] = useState(false);
  const [isPreviewingVoiceDub, setIsPreviewingVoiceDub] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [voiceDubStatus, setVoiceDubStatus] = useState<any | null>(null);

  const resetForm = () => {
    setItemTitle("");
    setItemUrl("");
    setSelectedFile(null);
    setUploadProgress(null);
    setIsUploadingFile(false);
    setItemInstructions("");
    setDuration("");
    setIsMandatory(false);
    setProblems([{ title: "", description: "", difficulty: "Easy", testCases: [{ input: "", output: "" }] }]);
    setQuizType("manual");
    setQuizQuestions([
      {
        question_text: "",
        order_index: 1,
        correct_option_index: 0,
        options: [
          { option_text: "", option_index: 0 },
          { option_text: "", option_index: 1 },
          { option_text: "", option_index: 2 },
          { option_text: "", option_index: 3 },
        ]
      }
    ]);
  };


  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    // 2.5s display time
    setTimeout(() => setToast({ show: false, message: "", type }), 2500);
  };

  useEffect(() => {
    fetchCourseData();
    fetchPublishedState();
  }, [courseId]);

  useEffect(() => {
    if (activeTab === "Analytics" && !analyticsData && !loadingAnalytics) {
      const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/analytics`, { headers: { Authorization: `Bearer ${token}` } });
          setAnalyticsData(res.data);
        } catch (e) {
          console.error("Failed to fetch analytics:", e);
        } finally {
          setLoadingAnalytics(false);
        }
      };
      fetchAnalytics();
    }
  }, [activeTab, courseId, analyticsData, loadingAnalytics]);

  const fetchPublishedState = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/courses`, { headers: { Authorization: `Bearer ${token}` } });
      const currentCourse = res.data.find((c: any) => c.id === Number(courseId));
      if (currentCourse) {
        setIsPublished(currentCourse.is_published);
      }
    } catch (e) { console.error(e); }
  };

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/player`, { headers: { Authorization: `Bearer ${token}` } });
      setCourseTitle(res.data.title);
      setCourseDescription(res.data.description || "A comprehensive course designed to help students master the fundamentals.");
      setPriceAmount(res.data.price ? res.data.price.toString() : "0");
      setPriceType(res.data.price > 0 ? "Paid" : "Free");
      setCourseImageUrl(res.data.image_url || "");

      setModules(res.data.modules);
      setIsFinalized(res.data.is_finalized || false);
      if (res.data.modules.length > 0) {
        setExpandedModules(res.data.modules.map((m: any) => m.id));
      }
      
      try {
        const feedbackRes = await axios.get(`${API_BASE_URL}/instructor/reviews`, { headers: { Authorization: `Bearer ${token}` } });
        setFeedbacks(feedbackRes.data.filter((f: any) => f.course_id === Number(courseId)));
      } catch (err) {
        console.error("Failed to load reviews:", err);
      }
      
      try {
        const batchRes = await axios.get(`${API_BASE_URL}/courses/${courseId}/batches`, { headers: { Authorization: `Bearer ${token}` } });
        setBatches(batchRes.data);
      } catch (err) {
        console.error("Failed to load batches:", err);
      }

      // Load course languages
      fetchLanguages();
      
    } catch (err) {
      console.error("Failed to load curriculum", err);
      triggerToast("Failed to load course details", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLanguages = async () => {
    try {
      setLoadingLanguages(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/languages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLanguagesList(res.data.languages || []);
      if (res.data.video_summary) {
        setVideoSummary(res.data.video_summary);
      }
      const hi = res.data.languages?.find((l: any) => l.language_code === 'hi');
      if (hi) {
        setHindiProgressData(hi);
        if (hi.status === 'GENERATING') {
          setIsGeneratingHindi(true);
        }
      }
      const ta = res.data.languages?.find((l: any) => l.language_code === 'ta');
      if (ta) {
        setTamilProgressData(ta);
        if (ta.status === 'GENERATING') {
          setIsGeneratingTamil(true);
        }
      }
    } catch (e) {
      console.error("Failed to load course languages", e);
    } finally {
      setLoadingLanguages(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Languages") {
      fetchLanguages();
    }
  }, [activeTab, courseId]);

  const handleGenerateHindi = async () => {
    try {
      setIsGeneratingHindi(true);
      setHindiProgressData((prev: any) => ({ ...prev, status: 'GENERATING', progress: 5, current_file: 'Initializing AI translation...' }));
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/courses/${courseId}/languages/hi/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      triggerToast("Hindi course generation (PDFs + Subtitles) started!", "success");
      fetchLanguages();
    } catch (err: any) {
      setIsGeneratingHindi(false);
      triggerToast(err.response?.data?.detail || "Failed to start Hindi translation", "error");
    }
  };

  const handleGenerateTamil = async () => {
    try {
      setIsGeneratingTamil(true);
      setTamilProgressData((prev: any) => ({ ...prev, status: 'GENERATING', progress: 5, current_file: 'Initializing AI translation...' }));
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/courses/${courseId}/languages/ta/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      triggerToast("Tamil course generation (PDFs + Subtitles) started!", "success");
      fetchLanguages();
    } catch (err: any) {
      setIsGeneratingTamil(false);
      triggerToast(err.response?.data?.detail || "Failed to start Tamil translation", "error");
    }
  };

  const handleGenerateSubtitles = async (lang: 'hi' | 'ta') => {
    try {
      if (lang === 'hi') setIsGeneratingHindiSubs(true);
      else setIsGeneratingTamilSubs(true);
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/subtitles/${lang}/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      triggerToast(res.data.message || `Started generating ${lang === 'hi' ? 'Hindi' : 'Tamil'} video subtitles!`, "success");
      setTimeout(() => fetchLanguages(), 1500);
    } catch (err: any) {
      triggerToast(err.response?.data?.detail || "Failed to trigger subtitle generation", "error");
    } finally {
      if (lang === 'hi') setIsGeneratingHindiSubs(false);
      else setIsGeneratingTamilSubs(false);
    }
  };


  useEffect(() => {
    let interval: any = null;
    if (isGeneratingHindi || hindiProgressData?.status === 'GENERATING') {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/languages/hi/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setHindiProgressData(res.data);
          if (res.data.status === 'READY') {
            setIsGeneratingHindi(false);
            triggerToast("🎉 Hindi course notes generated successfully!", "success");
            fetchLanguages();
          } else if (res.data.status === 'FAILED') {
            setIsGeneratingHindi(false);
            triggerToast("Hindi generation encountered errors.", "error");
            fetchLanguages();
          }
        } catch (e) {}
      }, 2500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGeneratingHindi, hindiProgressData?.status, courseId]);

  useEffect(() => {
    let interval: any = null;
    if (isGeneratingTamil || tamilProgressData?.status === 'GENERATING') {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/languages/ta/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setTamilProgressData(res.data);
          if (res.data.status === 'READY') {
            setIsGeneratingTamil(false);
            triggerToast("🎉 Tamil course notes generated successfully!", "success");
            fetchLanguages();
          } else if (res.data.status === 'FAILED') {
            setIsGeneratingTamil(false);
            triggerToast("Tamil generation encountered errors.", "error");
            fetchLanguages();
          }
        } catch (e) {}
      }, 2500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGeneratingTamil, tamilProgressData?.status, courseId]);

  // Open Voice Modal & Fetch Status
  const openVoiceModal = async (item: any, lang: "ta" | "hi" = "ta") => {
    setVoiceModalItem(item);
    setSelectedVoiceLang(lang);
    setVoiceMode("auto");
    setVoiceStartTime("0");
    setVoiceEndTime("12");
    setCustomTranscript("");
    setExtractedRefVoice(null);
    setVoiceDubStatus(null);
    setPreviewVideoUrl(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/items/${item.id}/voice/status?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVoiceDubStatus(res.data);
      if (res.data.reference_voice_url) {
        setExtractedRefVoice({
          reference_audio_url: res.data.reference_voice_url,
          reference_transcript: res.data.reference_transcript,
          start_time: res.data.ref_start_time,
          end_time: res.data.ref_end_time,
          mode: res.data.reference_mode || "auto"
        });
        if (res.data.reference_transcript) {
          setCustomTranscript(res.data.reference_transcript);
        }
      }
    } catch (e) {
      console.error("Failed to load voice status", e);
    }
  };

  const handleVoiceLangChange = async (lang: "ta" | "hi") => {
    setSelectedVoiceLang(lang);
    setPreviewVideoUrl(null);
    if (!voiceModalItem) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/items/${voiceModalItem.id}/voice/status?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVoiceDubStatus(res.data);
    } catch (e) {
      console.error("Failed to switch voice status", e);
    }
  };

  const handleExtractReferenceVoice = async () => {
    if (!voiceModalItem) return;
    try {
      setIsExtractingRef(true);
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/items/${voiceModalItem.id}/voice/reference`, {
        mode: voiceMode,
        start_time: voiceMode === 'manual' ? parseFloat(voiceStartTime) : undefined,
        end_time: voiceMode === 'manual' ? parseFloat(voiceEndTime) : undefined,
        custom_transcript: customTranscript.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setExtractedRefVoice(res.data);
      if (res.data.reference_transcript) {
        setCustomTranscript(res.data.reference_transcript);
      }
      triggerToast("Reference voice extracted successfully!", "success");
    } catch (err: any) {
      triggerToast(err.response?.data?.detail || "Failed to extract reference voice", "error");
    } finally {
      setIsExtractingRef(false);
    }
  };

  const handlePreviewVoiceDub = async () => {
    if (!voiceModalItem) return;
    try {
      setIsPreviewingVoiceDub(true);
      setPreviewVideoUrl(null);
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/items/${voiceModalItem.id}/voice/preview`, {
        reference_voice_path: extractedRefVoice?.reference_audio_path,
        reference_transcript: customTranscript || extractedRefVoice?.reference_transcript,
        mode: voiceMode,
        target_language: selectedVoiceLang,
        start_time: voiceMode === 'manual' ? parseFloat(voiceStartTime) : undefined,
        end_time: voiceMode === 'manual' ? parseFloat(voiceEndTime) : undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreviewVideoUrl(res.data.preview_video_url);
      triggerToast(`Preview generated successfully! Listen to verify natural ${selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} alignment.`, "success");
    } catch (err: any) {
      triggerToast(err.response?.data?.detail || "Failed to generate preview", "error");
    } finally {
      setIsPreviewingVoiceDub(false);
    }
  };

  const handleGenerateVoiceDub = async () => {
    if (!voiceModalItem) return;
    try {
      setIsGeneratingVoiceDub(true);
      setVoiceDubStatus({ status: 'GENERATING', progress: 5, target_language: selectedVoiceLang });
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE_URL}/courses/${courseId}/items/${voiceModalItem.id}/voice/generate`, {
        reference_voice_path: extractedRefVoice?.reference_audio_path,
        reference_transcript: customTranscript || extractedRefVoice?.reference_transcript,
        mode: voiceMode,
        target_language: selectedVoiceLang,
        start_time: voiceMode === 'manual' ? parseFloat(voiceStartTime) : undefined,
        end_time: voiceMode === 'manual' ? parseFloat(voiceEndTime) : undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      triggerToast(res.data.message || `AI ${selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} voice synthesis started on GPU!`, "success");
    } catch (err: any) {
      setIsGeneratingVoiceDub(false);
      triggerToast(err.response?.data?.detail || "Failed to trigger voice generation", "error");
    }
  };

  // Poll voice dubbing status
  useEffect(() => {
    let interval: any = null;
    if (voiceModalItem && (isGeneratingVoiceDub || voiceDubStatus?.status === 'GENERATING')) {
      interval = setInterval(async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await axios.get(`${API_BASE_URL}/courses/${courseId}/items/${voiceModalItem.id}/voice/status?lang=${selectedVoiceLang}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setVoiceDubStatus(res.data);
          if (res.data.status === 'READY') {
            setIsGeneratingVoiceDub(false);
            triggerToast(`🎉 ${selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} dubbed video generated successfully!`, "success");
            fetchLanguages();
            fetchCourseData();
          } else if (res.data.status === 'FAILED') {
            setIsGeneratingVoiceDub(false);
            triggerToast("Voice dubbing generation failed.", "error");
          }
        } catch (e) {}
      }, 2500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGeneratingVoiceDub, voiceDubStatus?.status, voiceModalItem, selectedVoiceLang, courseId]);

  const handleCreateBatch = async () => {
    if (!newBatchName.trim() || !newBatchSection.trim()) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/courses/${courseId}/batches`, {
        name: newBatchName,
        section: newBatchSection
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewBatchName("");
      setNewBatchSection("");
      fetchCourseData();
      triggerToast("Batch created successfully!", "success");
    } catch (err: any) { 
      triggerToast(err.response?.data?.detail || "Error creating batch", "error"); 
    }
  };

  const handleSyncStudents = async (batchId: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE_URL}/courses/batches/${batchId}/onboard`, {}, { headers: { Authorization: `Bearer ${token}` } });
      triggerToast(res.data.message || "Students synced!", "success");
      fetchCourseData();
    } catch (err) {
      triggerToast("Error syncing students", "error");
    }
  };

  // Drag and Drop ordering handler
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    if (isFinalized) return;

    const { source, destination, type } = result;
    if (destination.index === source.index && destination.droppableId === source.droppableId) return;

    if (type === "module") {
      // Reorder Modules
      const newModules = Array.from(modules);
      const [reorderedItem] = newModules.splice(source.index, 1);
      newModules.splice(destination.index, 0, reorderedItem);
      setModules(newModules);

      setIsSavingOrder(true);
      try {
        const token = localStorage.getItem("token");
        await axios.patch(`${API_BASE_URL}/courses/${courseId}/modules/reorder`, {
          module_ids: newModules.map(m => m.id)
        }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        triggerToast("Failed to save reorder.", "error");
        fetchCourseData();
      } finally { setIsSavingOrder(false); }

    } else if (type === "lesson") {
      // Reorder Lessons (Cross-Module support)
      const newModules = Array.from(modules);
      const sourceModuleIndex = newModules.findIndex(m => `module-${m.id}` === source.droppableId);
      const destModuleIndex = newModules.findIndex(m => `module-${m.id}` === destination.droppableId);

      if (sourceModuleIndex === -1 || destModuleIndex === -1) return;

      const sourceLessons = Array.from(newModules[sourceModuleIndex].lessons || []);
      const destLessons = source.droppableId === destination.droppableId ? sourceLessons : Array.from(newModules[destModuleIndex].lessons || []);

      const [reorderedLesson] = sourceLessons.splice(source.index, 1);
      destLessons.splice(destination.index, 0, reorderedLesson);

      newModules[sourceModuleIndex].lessons = sourceLessons;
      if (source.droppableId !== destination.droppableId) {
        newModules[destModuleIndex].lessons = destLessons;
      }
      setModules(newModules);

      // Collect required API data
      const affectedLessons: any[] = [];
      newModules[sourceModuleIndex].lessons.forEach((l: any, idx: number) => {
        affectedLessons.push({ lesson_id: l.id, module_id: newModules[sourceModuleIndex].id, order: idx });
      });
      if (source.droppableId !== destination.droppableId) {
        newModules[destModuleIndex].lessons.forEach((l: any, idx: number) => {
          affectedLessons.push({ lesson_id: l.id, module_id: newModules[destModuleIndex].id, order: idx });
        });
      }

      setIsSavingOrder(true);
      try {
        const token = localStorage.getItem("token");
        await axios.patch(`${API_BASE_URL}/courses/${courseId}/lessons/reorder`, {
          items: affectedLessons
        }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        triggerToast("Failed to save lesson order", "error");
        fetchCourseData();
      } finally { setIsSavingOrder(false); }
    }
  };

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/courses/${courseId}/modules`, {
        title: newModuleTitle, order: modules.length + 1
      }, { headers: { Authorization: `Bearer ${token}` } });
      setNewModuleTitle(""); setShowAddModule(false);
      fetchCourseData();
      triggerToast("Module added successfully!", "success");
    } catch (err) { triggerToast("Error adding module", "error"); }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${API_BASE_URL}/courses/${courseId}/publish`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setIsPublished(true);
      if (isPublished) triggerToast("Course Changes Republished Successfully!", "success");
      else triggerToast("Course Published! It is now live.", "success");
    } catch (err) { triggerToast("Error publishing course.", "error"); } finally { setIsPublishing(false); }
  };

  const handleFinalize = async () => {
    if (finalizeConfirmation !== "FINALIZE") {
      triggerToast("Please type exactly FINALIZE to confirm", "error");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${API_BASE_URL}/courses/${courseId}/finalize`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setIsFinalized(true);
      setShowFinalizeModal(false);
      triggerToast("Course Permanently Finalized!", "success");
    } catch (err) { triggerToast("Error finalizing course.", "error"); }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (isFinalized) return;
    if (!confirm("Are you sure you want to delete this item? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/content/${itemId}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchCourseData();
      triggerToast("Item deleted successfully", "success");
    } catch (err) { triggerToast("Failed to delete item.", "error"); }
  };

  const handleEditStart = (item: any) => {
    if (isFinalized) return;
    setEditingItem(item);
    const modalName = (item.type === 'code_test' || item.type === 'code') ? 'Code Test' : (item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Item');
    setActiveModal(modalName);
    setItemTitle(item.title || "");
    setItemUrl(item.content || item.url || "");
    setDuration(item.duration ? item.duration.toString() : "");
    setIsMandatory(item.is_mandatory || false);
    setItemInstructions(item.instructions || "");

    if (item.test_config) {
      try {
        let parsed = JSON.parse(item.test_config);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (parsed.problems && Array.isArray(parsed.problems)) {
          setProblems(parsed.problems);
        }
      } catch (e) {}
    } else {
      setProblems([{ title: "", description: "", difficulty: "Easy", testCases: [{ input: "", output: "" }] }]);
    }

    if (item.type === 'quiz') {
      const token = localStorage.getItem("token");
      axios.get(`${API_BASE_URL}/quizzes/content-item/${item.id}?lang=en`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data && res.data.questions && res.data.questions.length > 0) {
          setQuizType("manual");
          setQuizQuestions(res.data.questions.map((q: any) => ({
            id: q.id,
            question_text: q.question_text,
            order_index: q.order_index,
            correct_option_index: typeof q.correct_option_index === 'number' ? q.correct_option_index : 0,
            options: (q.options || []).map((opt: any) => ({
              id: opt.id,
              option_text: opt.option_text,
              option_index: opt.option_index
            }))
          })));
        } else {
          setQuizType("external");
        }
      }).catch(() => {
        setQuizType("external");
      });
    }
  };

  const handleEditSave = async () => {
    if (!editingItem) return;
    try {
      const token = localStorage.getItem("token");

      if (editingItem.type === "quiz" || activeModal === "Quiz") {
        if (quizType === "manual") {
          for (let i = 0; i < quizQuestions.length; i++) {
            const q = quizQuestions[i];
            if (!q.question_text.trim()) return triggerToast(`Question ${i + 1} is missing question text!`, "error");
            if (!q.options || q.options.length !== 4) return triggerToast(`Question ${i + 1} must have 4 options!`, "error");
            for (let j = 0; j < 4; j++) {
              if (!q.options[j].option_text.trim()) return triggerToast(`Question ${i + 1}, Option ${String.fromCharCode(65 + j)} cannot be empty!`, "error");
            }
          }

          const payload = {
            course_id: courseId,
            content_item_id: editingItem.id,
            title: itemTitle,
            description: itemInstructions,
            duration_minutes: duration ? parseInt(duration) : 15,
            is_mandatory: isMandatory,
            questions: quizQuestions
          };

          await axios.post(`${API_BASE_URL}/quizzes`, payload, { headers: { Authorization: `Bearer ${token}` } });
          setEditingItem(null); setActiveModal(null); resetForm(); fetchCourseData();
          triggerToast("Manual Quiz updated successfully", "success");
          return;
        }
      }

      let finalUrl = itemUrl;

      if (selectedFile) {
        setIsUploadingFile(true);
        try {
          const formData = new FormData();
          formData.append("file", selectedFile);

          const uploadRes = await axios.post(`${API_BASE_URL}/content/upload`, formData, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data"
            },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(percent);
              }
            }
          });

          finalUrl = uploadRes.data.fileUrl;
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          triggerToast("Failed to upload file. Please try again.", "error");
          setIsUploadingFile(false);
          return;
        } finally {
          setIsUploadingFile(false);
        }
      }

      const payload: any = {
        title: itemTitle, url: finalUrl, duration: duration ? parseInt(duration) : null,
        is_mandatory: isMandatory, instructions: itemInstructions
      };

      if (editingItem.type === "code" || editingItem.type === "code_test" || editingItem.type === "test" || activeModal === "Code Test" || activeModal === "Code") {
        for (let i = 0; i < problems.length; i++) {
          if (!problems[i].title.trim()) return triggerToast(`Problem ${i + 1} is missing a title!`, "error");
          if (!problems[i].description.trim()) return triggerToast(`Problem ${i + 1} is missing a description!`, "error");
        }
        payload.test_config = JSON.stringify({ problems });
      }

      await axios.patch(`${API_BASE_URL}/content/${editingItem.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setEditingItem(null); setActiveModal(null); resetForm(); fetchCourseData();
      triggerToast("Item updated successfully", "success");
    } catch (err: any) { triggerToast(err.response?.data?.detail || "Failed to update item.", "error"); }
  };

  const saveContentItem = async () => {
    if (!selectedModuleId) return triggerToast("Select a module to add this item to.", "error");
    if (!itemTitle.trim()) return triggerToast("Please enter a title for this item.", "error");

    const token = localStorage.getItem("token");
    const typeKey = activeModal?.toLowerCase().replace(" ", "_") || "video";

    if (activeModal === "Quiz" || typeKey === "quiz") {
      if (quizType === "manual") {
        for (let i = 0; i < quizQuestions.length; i++) {
          const q = quizQuestions[i];
          if (!q.question_text.trim()) return triggerToast(`Question ${i + 1} is missing question text!`, "error");
          if (!q.options || q.options.length !== 4) return triggerToast(`Question ${i + 1} must have 4 options!`, "error");
          for (let j = 0; j < 4; j++) {
            if (!q.options[j].option_text.trim()) return triggerToast(`Question ${i + 1}, Option ${String.fromCharCode(65 + j)} cannot be empty!`, "error");
          }
        }

        const payload = {
          course_id: courseId,
          module_id: selectedModuleId,
          title: itemTitle,
          description: itemInstructions,
          duration_minutes: duration ? parseInt(duration) : 15,
          is_mandatory: isMandatory,
          questions: quizQuestions
        };

        try {
          await axios.post(`${API_BASE_URL}/quizzes`, payload, { headers: { Authorization: `Bearer ${token}` } });
          triggerToast("Manual Quiz added successfully!", "success");
          setActiveModal(null); resetForm(); fetchCourseData();
          if (!expandedModules.includes(selectedModuleId)) toggleModule(selectedModuleId);
        } catch (err: any) {
          triggerToast(err.response?.data?.detail || "Failed to save manual quiz.", "error");
        }
        return;
      }
    }

    let finalUrl = itemUrl;

    if (selectedFile) {
      setIsUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await axios.post(`${API_BASE_URL}/content/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percent);
            }
          }
        });

        finalUrl = uploadRes.data.fileUrl;
      } catch (uploadErr) {
        console.error("Upload error:", uploadErr);
        triggerToast("Failed to upload file. Please try again.", "error");
        setIsUploadingFile(false);
        return;
      } finally {
        setIsUploadingFile(false);
      }
    }

    const payload: any = {
      title: itemTitle, type: typeKey, url: finalUrl, duration: duration ? parseInt(duration) : null,
      is_mandatory: isMandatory, instructions: itemInstructions, module_id: selectedModuleId
    };

    if (activeModal === "Code Test" || activeModal === "Code" || typeKey === "code" || typeKey === "code_test") {
      for (let i = 0; i < problems.length; i++) {
        if (!problems[i].title.trim()) return triggerToast(`Problem ${i + 1} is missing a title!`, "error");
        if (!problems[i].description.trim()) return triggerToast(`Problem ${i + 1} is missing a description!`, "error");
      }
      payload.test_config = JSON.stringify({ problems });
    }

    try {
      await axios.post(`${API_BASE_URL}/content`, payload, { headers: { Authorization: `Bearer ${token}` } });
      triggerToast(`${activeModal} added successfully!`, "success");
      setActiveModal(null); resetForm(); fetchCourseData();
      if (!expandedModules.includes(selectedModuleId)) toggleModule(selectedModuleId);
    } catch (err: any) { triggerToast(err.response?.data?.detail || "Failed to save.", "error"); }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${API_BASE_URL}/courses/${courseId}/settings`, {
        title: courseTitle,
        description: courseDescription,
        price: priceType === "Paid" ? parseInt(priceAmount) || 0 : 0,
        image_url: courseImageUrl
      }, { headers: { Authorization: `Bearer ${token}` } });

      triggerToast("Current setup updated successfully!", "success");
    } catch (err) {
      triggerToast("Failed to save configurations.", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRemoveThumbnail = async () => {
    setIsSavingSettings(true);
    try {
      const token = localStorage.getItem("token");
      await axios.patch(`${API_BASE_URL}/courses/${courseId}/settings`, {
        image_url: ""
      }, { headers: { Authorization: `Bearer ${token}` } });
      setCourseImageUrl("");
      triggerToast("Thumbnail Removed!", "success");
    } catch (err) {
      triggerToast("Failed to remove thumbnail.", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const toggleModule = (id: number) => {
    setExpandedModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const tabs = [
    { name: "Curriculum", icon: <Layout size={18} /> },
    { name: "Batches", icon: <Users size={18} /> },
    { name: "Languages", icon: <Globe size={18} /> },
    { name: "Analytics", icon: <BarChart size={18} /> },
    { name: "Settings", icon: <Edit3 size={18} /> },
  ];

  const contentTypes = [
    { type: "Note", icon: <Edit3 size={24} className="text-blue-600" />, desc: "Drive PDF Links" },
    { type: "Video", icon: <Video size={24} className="text-blue-600" />, desc: "YouTube lessons" },
    { type: "Quiz", icon: <HelpCircle size={24} className="text-emerald-600" />, desc: "Google Form Links" },
    { type: "Code Test", icon: <Code size={24} className="text-purple-600" />, desc: "Compiler Challenges" },
    { type: "Assignment", icon: <FileText size={24} className="text-indigo-600" />, desc: "PDF projects (Drive)" },
    { type: "Live Class", icon: <Radio size={24} className="text-red-500" />, desc: "YouTube Live Link" },
    { type: "Live Test", icon: <Zap size={24} className="text-yellow-500" />, desc: "Timed assessment" },
  ];

  // Dynamic UI values
  const totalEnrollments = 1248; // Mocked realistic data point (frontend doesn't have live API tracking logic yet)
  const numericPrice = parseInt(priceAmount) || 0;
  const rawRevenue = priceType === "Paid" ? numericPrice * totalEnrollments : 0;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm w-full">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard/courses")}
              className="p-2.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{courseTitle}</h1>
                {isFinalized && <span className="bg-slate-800 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1 font-bold tracking-wider"><Lock size={12} /> FINALIZED</span>}
              </div>
              <p className="text-sm text-slate-500 font-medium tracking-wide">
                {isPublished ? "Live - Published" : "Draft - Not Published"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePublish} disabled={isPublishing}
              className={`px-6 py-2.5 rounded-xl text-white font-bold transition-all focus:outline-none focus:ring-4 ${isPublished
                ? "bg-emerald-500/90 backdrop-blur-md border border-emerald-400 shadow-[0_8px_30px_rgb(16,185,129,0.3)] hover:bg-emerald-600 focus:ring-emerald-500/30"
                : "bg-emerald-600 shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-emerald-700/30 focus:ring-emerald-600/30"
                }`}
            >
              {isPublishing ? "Processing..." : isPublished ? "Republish Changes" : "Publish Course"}
            </button>

            {!isFinalized && (
              <button
                onClick={() => setShowFinalizeModal(true)}
                className="px-6 py-2.5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/80 backdrop-blur text-red-600 font-bold hover:bg-red-100 hover:border-red-300 transition-all shadow-sm focus:ring-4 focus:ring-red-100"
              >
                <Lock size={18} /> Finalize Course
              </button>
            )}
          </div>
        </div>
      </header>

      {/* TWO-COLUMN WORKSPACE */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-10 flex flex-col md:flex-row gap-10 items-start">

        {/* LEFT NAV BAR */}
        <aside className="w-full md:w-64 shrink-0 md:sticky top-32 flex flex-col gap-2">
          {tabs.map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl w-full text-left font-bold transition-all ${activeTab === tab.name
                ? "bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-100"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 hover:scale-[1.02]"
                }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </aside>

        {/* MAIN EDITOR */}
        <main className="flex-1 w-full max-w-[800px]">
          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
          ) : activeTab === "Batches" ? (
            <BatchManagementTab courseId={courseId!} triggerToast={triggerToast} />
          ) : activeTab === "Curriculum" ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-5xl font-black bg-gradient-to-br from-slate-900 via-slate-600 to-slate-900 bg-clip-text text-transparent tracking-tight mb-2 inline-block pb-1">Curriculum Builder</h2>
                  <p className="text-slate-500 text-lg">Build your architecture. Drag and drop modules or lessons to reorder.</p>
                </div>
                {isSavingOrder && <span className="text-blue-500 font-bold flex items-center gap-2 animate-pulse bg-blue-50 px-4 py-2 rounded-full"><Zap size={16} /> Syncing Order...</span>}
              </div>

              {/* MODULES LIST WITH DRAG & DROP */}
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="modules-list" type="module">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-col gap-6">
                      {modules.map((module, index) => {
                        const isExpanded = expandedModules.includes(module.id);

                        return (
                          <Draggable key={`module-${module.id}`} draggableId={`module-${module.id}`} index={index} isDragDisabled={isFinalized}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-200 ${snapshot.isDragging ? 'shadow-2xl scale-[1.02] border-blue-400 z-[100]' : ''}`}
                                style={provided.draggableProps.style}
                              >
                                {/* MODULE HEADER */}
                                <div className="w-full flex items-center justify-between p-2 pl-4 bg-slate-50/50 hover:bg-slate-100/50 transition-colors border-b border-transparent">
                                  <div className="flex items-center gap-4 flex-1">
                                    <div
                                      {...provided.dragHandleProps}
                                      className={`p-2 rounded-lg cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 hover:bg-slate-200 ${isFinalized ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`}
                                    >
                                      <GripVertical size={20} />
                                    </div>
                                    <h3
                                      onClick={() => toggleModule(module.id)}
                                      className="text-lg font-extrabold text-slate-800 cursor-pointer flex-1 py-4"
                                    >
                                      {module.title}
                                    </h3>
                                  </div>
                                  <button onClick={() => toggleModule(module.id)} className="flex items-center gap-4 text-slate-400 p-4 shrink-0 hover:text-slate-600 transition-colors">
                                    <span className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full">{module.lessons?.length || 0} lessons</span>
                                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                                      <ChevronDown size={24} />
                                    </motion.div>
                                  </button>
                                </div>

                                {/* LESSONS LIST */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden border-t border-slate-100"
                                    >
                                      <div className="p-6 flex flex-col gap-3">
                                        <Droppable droppableId={`module-${module.id}`} type="lesson">
                                          {(providedLesson, snapshotLesson) => (
                                            <div
                                              {...providedLesson.droppableProps}
                                              ref={providedLesson.innerRef}
                                              className={`flex flex-col gap-3 min-h-[50px] rounded-2xl transition-all ${snapshotLesson.isDraggingOver ? 'bg-blue-50/50 ring-2 ring-blue-200 ring-inset p-2' : ''}`}
                                            >
                                              {!module.lessons || module.lessons.length === 0 ? (
                                                <div className="text-center py-6 text-slate-400 font-bold italic">Drop lessons here...</div>
                                              ) : (
                                                module.lessons.map((lesson: any, lessonIndex: number) => (
                                                  <Draggable key={`lesson-${lesson.id}`} draggableId={`lesson-${lesson.id}`} index={lessonIndex} isDragDisabled={isFinalized}>
                                                    {(providedDragLesson, snapshotDragLesson) => (
                                                      <div
                                                        ref={providedDragLesson.innerRef}
                                                        {...providedDragLesson.draggableProps}
                                                        className={`group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white border shadow-sm transition-all gap-4 sm:gap-0 ${snapshotDragLesson.isDragging ? "shadow-2xl border-blue-400 scale-[1.03] z-[120] ring-4 ring-blue-500/20" : "border-slate-100 hover:border-slate-300"
                                                          }`}
                                                        style={providedDragLesson.draggableProps.style}
                                                      >
                                                        <div className="flex items-center gap-4 overflow-hidden flex-1">
                                                          <div
                                                            {...providedDragLesson.dragHandleProps}
                                                            className={`text-slate-200 hover:text-slate-400 cursor-grab active:cursor-grabbing ${isFinalized ? "hidden" : ""}`}
                                                          >
                                                            <GripVertical size={18} />
                                                          </div>
                                                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex-shrink-0">
                                                            {getLessonIcon(lesson.type)}
                                                          </div>
                                                          <div className="overflow-hidden flex-1">
                                                            <span className="font-bold text-slate-800 block truncate">{lesson.title}</span>
                                                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-0.5 truncate block">{lesson.type} {lesson.url ? `• Link Attached` : ""}</span>
                                                          </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity justify-end shrink-0">
                                                          {(lesson.type?.toLowerCase() === 'video') && (
                                                            <button
                                                              onClick={() => openVoiceModal(lesson)}
                                                              className="px-3 py-1.5 bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 text-cyan-800 border border-cyan-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
                                                              title="Configure Professor Reference Voice & AI Tamil Dubbing"
                                                            >
                                                              <Mic size={14} className="text-cyan-600" />
                                                              <span>Voice Studio</span>
                                                            </button>
                                                          )}
                                                          {!isFinalized && (
                                                            <>
                                                              <button onClick={() => handleEditStart(lesson)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"><Edit3 size={18} /></button>
                                                              <button onClick={() => handleDeleteItem(lesson.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                                                            </>
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </Draggable>
                                                ))
                                              )}
                                              {providedLesson.placeholder}
                                            </div>
                                          )}
                                        </Droppable>

                                        {!isFinalized && (
                                          showContentPicker === module.id ? (
                                            <div className="mt-4 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                                              <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-bold text-slate-800">Assign Content Type</h4>
                                                <button onClick={() => setShowContentPicker(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500"><X size={16} /></button>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {contentTypes.map(typeObj => (
                                                  <button key={typeObj.type} onClick={() => { setSelectedModuleId(module.id); setActiveModal(typeObj.type); setShowContentPicker(null); }} className="flex items-center gap-3 p-4 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-lg rounded-xl text-left transition-all">
                                                    <div className="shrink-0">{typeObj.icon}</div>
                                                    <div>
                                                      <div className="font-bold text-sm text-slate-800">{typeObj.type}</div>
                                                      <div className="text-xs font-medium text-slate-500 mt-0.5">{typeObj.desc}</div>
                                                    </div>
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          ) : (
                                            <button onClick={() => setShowContentPicker(module.id)} className="flex items-center justify-center gap-2 mt-4 py-4 px-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800 transition-all uppercase tracking-widest text-sm">
                                              <Plus size={18} /> Add Content
                                            </button>
                                          )
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* NEW MODULE BUTTON */}
              {!isFinalized && (
                showAddModule ? (
                  <div className="mt-8 p-6 bg-white border border-slate-200 rounded-3xl shadow-lg">
                    <h4 className="font-extrabold text-slate-900 mb-3 text-lg">New Module Title</h4>
                    <input autoFocus placeholder="e.g. Setting up the architecture..." value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-slate-900 focus:outline-none mb-6 font-medium text-lg" />
                    <div className="flex gap-4">
                      <button onClick={handleAddModule} className="flex-1 py-4 bg-slate-900 text-white font-extrabold rounded-xl hover:bg-slate-800 transition-colors">Create Module</button>
                      <button onClick={() => setShowAddModule(false)} className="flex-1 py-4 bg-slate-100 text-slate-700 font-extrabold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddModule(true)} className="mt-10 flex items-center justify-center gap-2 w-full py-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-[2rem] text-slate-600 font-extrabold hover:bg-slate-100 hover:border-slate-400 hover:text-slate-900 transition-all text-xl tracking-wide shadow-sm">
                    <Plus size={28} /> Build New Module
                  </button>
                )
              )}

            </div>
          ) : activeTab === "Analytics" ? (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-4xl font-black tracking-tight mb-2">Platform Analytics</h2>
                  <p className="text-slate-500 text-lg">Track engagement, completions, and digital literacy progression.</p>
                </div>
                <div className="px-4 py-2 bg-emerald-50 rounded-xl text-emerald-600 font-bold border border-emerald-100 flex items-center gap-2">
                  <TrendingUp size={18} /> Real-time Data
                </div>
              </div>

              {loadingAnalytics || !analyticsData ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-slate-900"></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                      <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4"><Users size={24} /></div>
                      <div>
                        <div className="text-3xl font-black text-slate-900">{analyticsData.totalEnrollments.toLocaleString()}</div>
                        <div className="text-slate-500 font-bold text-sm tracking-wide mt-1 uppercase">Total Enrollments</div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between relative overflow-hidden group">
                      <div className="absolute -right-6 -top-6 bg-emerald-500/10 w-32 h-32 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center mb-4 relative z-10"><Zap size={24} /></div>
                      <div className="relative z-10">
                        <div className="text-3xl font-black text-slate-900">{analyticsData.activeLearners}</div>
                        <div className="text-slate-500 font-bold text-sm tracking-wide mt-1 uppercase">Active Learners</div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4"><Award size={24} /></div>
                      <div>
                        <div className="text-3xl font-black text-slate-900">{analyticsData.funnel.complete}</div>
                        <div className="text-slate-500 font-bold text-sm tracking-wide mt-1 uppercase">Course Completions</div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                      <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-4"><BookOpen size={24} /></div>
                      <div>
                        <div className="text-3xl font-black text-slate-900">{analyticsData.totalItems}</div>
                        <div className="text-slate-500 font-bold text-sm tracking-wide mt-1 uppercase">Course Items</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
                    <h4 className="font-extrabold text-slate-900 text-xl mb-6">Daily Learning Engagement (Last 7 Days)</h4>
                    <div className="h-48 flex items-end gap-3 w-full border-b border-slate-100 pb-2">
                      {analyticsData.dailyEngagement.map((count: number, i: number) => {
                        const maxCount = Math.max(...analyticsData.dailyEngagement, 10);
                        const h = (count / maxCount) * 100;
                        return (
                          <div key={i} className="flex-1 bg-emerald-100 hover:bg-emerald-400 transition-colors rounded-t-lg relative group" style={{ height: `${Math.max(h, 2)}%` }}>
                            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              {count} lessons
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mt-4">
                      {Array.from({length: 7}).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return <span key={i}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>;
                      })}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <h4 className="font-extrabold text-slate-900 text-xl mb-6">Student Enrollment Funnel</h4>
                    <div className="space-y-6">
                      {[
                        { label: "Completed Final Exam (100%)", count: analyticsData.funnel.complete, color: "bg-emerald-500" },
                        { label: "Active & Engaging (50-99%)", count: analyticsData.funnel.active, color: "bg-blue-500" },
                        { label: "Started First Module (1-49%)", count: analyticsData.funnel.started, color: "bg-amber-400" },
                        { label: "Bounced / Inactive (0%)", count: analyticsData.funnel.inactive, color: "bg-slate-300" },
                      ].map((stat, i) => {
                        const total = analyticsData.totalEnrollments || 1; // avoid divide by zero
                        const pct = Math.round((stat.count / total) * 100);
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                              <span>{stat.label}</span>
                              <span className="text-slate-400">{pct}% · {stat.count} users</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: i * 0.1 }} className={`h-full ${stat.color} rounded-full`}></motion.div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

          ) : activeTab === "Languages" ? (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 w-full max-w-7xl pb-20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm">
                      <Globe size={22} />
                    </div>
                    Multilingual Course Studio
                  </h2>
                  <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
                    Manage AI-powered PDF & document translations while preserving original English videos and architecture.
                  </p>
                </div>
                <button
                  onClick={fetchLanguages}
                  disabled={loadingLanguages}
                  className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 shadow-sm self-start sm:self-auto flex items-center gap-2 text-xs font-bold transition-all"
                >
                  <RefreshCw size={14} className={loadingLanguages ? "animate-spin text-emerald-600" : ""} /> Refresh Status
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* 1. ORIGINAL ENGLISH MASTER CARD */}
                <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-[0_10px_30px_rgb(0,0,0,0.03)] flex flex-col justify-between relative overflow-hidden group hover:border-slate-300 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-700 font-black text-xs flex items-center justify-center shadow-xs shrink-0 tracking-wider">
                          EN
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">English</h3>
                          <span className="text-[11px] font-bold text-slate-400">Master Source</span>
                        </div>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs shrink-0 whitespace-nowrap">
                        <CheckCircle2 size={11} /> Master
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 min-h-[48px]">
                      Primary master curriculum containing all uploaded modules, native videos, coding challenges, and English PDF notes.
                    </p>

                    <div className="mt-auto mb-6">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center text-xs font-bold text-slate-600 min-h-[58px]">
                        <span>Course Modules</span>
                        <span className="font-black text-slate-900 bg-white px-2.5 py-1 rounded-xl border border-slate-200/60 shadow-2xs">
                          {modules.length} Modules
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/course/${courseId}/player`)}
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                  >
                    <ExternalLink size={15} /> Preview English Course
                  </button>
                </div>

                {/* 2. HINDI TRANSLATION CARD */}
                <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-[0_10px_30px_rgb(0,0,0,0.03)] flex flex-col justify-between relative overflow-hidden group hover:border-emerald-200 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-black text-xs flex items-center justify-center shadow-xs shrink-0 tracking-wider">
                          HI
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">हिन्दी (Hindi)</h3>
                          <span className="text-[11px] font-bold text-slate-400">IndicTrans2 AI</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {hindiProgressData?.status === 'READY' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                            <CheckCircle2 size={11} /> Ready
                          </span>
                        ) : hindiProgressData?.status === 'GENERATING' || isGeneratingHindi ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs animate-pulse whitespace-nowrap">
                            <RotateCw size={11} className="animate-spin" /> Translating...
                          </span>
                        ) : hindiProgressData?.status === 'FAILED' ? (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                            <AlertCircle size={11} /> Failed
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                            Not Generated
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 min-h-[48px]">
                      Translates English PDF notes into Devanagari Hindi while preserving code, layout geometry, and original English videos.
                    </p>

                    {/* PROGRESS BAR OR STATUS INFO */}
                    <div className="mt-auto mb-4">
                      {(isGeneratingHindi || hindiProgressData?.status === 'GENERATING') ? (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-h-[58px] flex flex-col justify-center">
                          <div className="flex justify-between items-center text-xs font-black text-slate-800 mb-1.5">
                            <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-emerald-500" /> Translating</span>
                            <span className="text-emerald-600">{hindiProgressData?.progress || 10}%</span>
                          </div>
                          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden mb-1.5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(hindiProgressData?.progress || 10, 8)}%` }}
                              transition={{ duration: 0.5 }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                            />
                          </div>
                          <div className="text-[10px] font-medium text-slate-500 truncate">
                            {hindiProgressData?.current_file || "Translating documents..."}
                          </div>
                        </div>
                      ) : hindiProgressData?.status === 'READY' ? (
                        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-emerald-900 min-h-[58px]">
                          <span>Converted Documents</span>
                          <span className="font-black bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                            {hindiProgressData.total_files === 0 ? "No PDF Notes in Course" : `${hindiProgressData.completed_files || 0} / ${hindiProgressData.total_files} Hindi PDFs Active`}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-slate-500 min-h-[58px]">
                          <span>Status</span>
                          <span className="font-bold text-slate-400">{hindiProgressData?.total_files === 0 ? "0 PDFs to convert" : "Ready to Convert"}</span>
                        </div>
                      )}
                    </div>

                    {/* VIDEO SUBTITLES & DUBBED VOICE WIDGETS */}
                    <div className="space-y-2 mb-6">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          <PlayCircle size={15} className="text-emerald-500" />
                          <span>Hindi Subtitles</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {videoSummary?.hindi_subtitles_ready || hindiProgressData?.subtitles_ready || 0}/{videoSummary?.total_videos || hindiProgressData?.total_videos || 0}
                          </span>
                          <button
                            onClick={() => handleGenerateSubtitles('hi')}
                            disabled={isGeneratingHindiSubs}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all border border-emerald-200 shadow-xs"
                            title="Generate / Re-sync Hindi Subtitles"
                          >
                            <Sparkles size={11} className={isGeneratingHindiSubs ? "animate-spin" : ""} />
                            {isGeneratingHindiSubs ? "Generating..." : "Generate"}
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          <Mic size={15} className="text-emerald-600" />
                          <span>Natural Hindi Voice (IndicF5)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {videoSummary?.hindi_voice_dubbed_ready || 0}/{videoSummary?.total_videos || hindiProgressData?.total_videos || 0}
                          </span>
                          <button
                            onClick={() => {
                              // Find first video lesson in curriculum to open modal
                              let firstVid: any = null;
                              for (const m of modules) {
                                if (m.lessons) {
                                  for (const l of m.lessons) {
                                    if (l.type?.toLowerCase() === 'video') {
                                      firstVid = l;
                                      break;
                                    }
                                  }
                                }
                                if (firstVid) break;
                              }
                              if (firstVid) {
                                openVoiceModal(firstVid, 'hi');
                              } else {
                                triggerToast("Add a video lesson in Curriculum tab to configure voice", "error");
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all shadow-xs"
                            title="Open Hindi Voice Studio"
                          >
                            <Mic size={11} /> Voice Studio
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BUTTON ACTIONS */}
                  <div className="flex gap-2.5">
                    {hindiProgressData?.status === 'READY' ? (
                      <>
                        <button
                          onClick={() => navigate(`/course/${courseId}/player?lang=hi`)}
                          className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                        >
                          <ExternalLink size={15} /> Open Hindi
                        </button>
                        <button
                          onClick={handleGenerateHindi}
                          disabled={isGeneratingHindi}
                          className="h-12 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs"
                          title="Regenerate all Hindi PDFs"
                        >
                          <RotateCw size={14} /> Regenerate
                        </button>
                      </>
                    ) : hindiProgressData?.status === 'GENERATING' || isGeneratingHindi ? (
                      <div className="flex gap-2 w-full">
                        <button
                          disabled
                          className="flex-1 h-12 bg-slate-100 text-slate-400 border border-slate-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <RotateCw size={15} className="animate-spin text-slate-400" /> Translating...
                        </button>
                        <button
                          onClick={handleGenerateHindi}
                          className="h-12 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                          title="Force Re-trigger or Reset"
                        >
                          <RotateCw size={13} /> Reset
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleGenerateHindi}
                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-98"
                      >
                        <Sparkles size={16} /> Generate Hindi Course
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. TAMIL TRANSLATION CARD */}
                <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-[0_10px_30px_rgb(0,0,0,0.03)] flex flex-col justify-between relative overflow-hidden group hover:border-cyan-200 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-200/80 text-cyan-700 font-black text-xs flex items-center justify-center shadow-xs shrink-0 tracking-wider">
                          TA
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">தமிழ் (Tamil)</h3>
                          <span className="text-[11px] font-bold text-slate-400">IndicTrans2 AI</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {tamilProgressData?.status === 'READY' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                            <CheckCircle2 size={11} /> Ready
                          </span>
                        ) : tamilProgressData?.status === 'GENERATING' || isGeneratingTamil ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs animate-pulse whitespace-nowrap">
                            <RotateCw size={11} className="animate-spin" /> Translating...
                          </span>
                        ) : tamilProgressData?.status === 'FAILED' ? (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                            <AlertCircle size={11} /> Failed
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                            Not Generated
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 min-h-[48px]">
                      Translates all PDF notes into natural modern Tamil while preserving layouts, code blocks, and English lecture videos.
                    </p>

                    {/* PROGRESS BAR OR STATUS INFO */}
                    <div className="mt-auto mb-4">
                      {(isGeneratingTamil || tamilProgressData?.status === 'GENERATING') ? (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-h-[58px] flex flex-col justify-center">
                          <div className="flex justify-between items-center text-xs font-black text-slate-800 mb-1.5">
                            <span className="flex items-center gap-1.5"><Sparkles size={13} className="text-cyan-500" /> Translating</span>
                            <span className="text-cyan-600">{tamilProgressData?.progress || 10}%</span>
                          </div>
                          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden mb-1.5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(tamilProgressData?.progress || 10, 8)}%` }}
                              transition={{ duration: 0.5 }}
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                            />
                          </div>
                          <div className="text-[10px] font-medium text-slate-500 truncate">
                            {tamilProgressData?.current_file || "Translating documents..."}
                          </div>
                        </div>
                      ) : tamilProgressData?.status === 'READY' ? (
                        <div className="bg-cyan-50/60 border border-cyan-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-cyan-900 min-h-[58px]">
                          <span>Converted Documents</span>
                          <span className="font-black bg-white px-2.5 py-1 rounded-xl border border-cyan-200 shadow-2xs">
                            {tamilProgressData.total_files === 0 ? "No PDF Notes in Course" : `${tamilProgressData.completed_files || 0} / ${tamilProgressData.total_files} Tamil PDFs Active`}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-slate-500 min-h-[58px]">
                          <span>Status</span>
                          <span className="font-bold text-slate-400">{tamilProgressData?.total_files === 0 ? "0 PDFs to convert" : "Ready to Convert"}</span>
                        </div>
                      )}
                    </div>

                    {/* VIDEO SUBTITLES & DUBBED VOICE WIDGETS */}
                    <div className="space-y-2 mb-6">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          <PlayCircle size={15} className="text-cyan-500" />
                          <span>Tamil Subtitles</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {videoSummary?.tamil_subtitles_ready || tamilProgressData?.subtitles_ready || 0}/{videoSummary?.total_videos || tamilProgressData?.total_videos || 0}
                          </span>
                          <button
                            onClick={() => handleGenerateSubtitles('ta')}
                            disabled={isGeneratingTamilSubs}
                            className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all border border-cyan-200 shadow-xs"
                            title="Generate / Re-sync Tamil Subtitles"
                          >
                            <Sparkles size={11} className={isGeneratingTamilSubs ? "animate-spin" : ""} />
                            {isGeneratingTamilSubs ? "Generating..." : "Generate"}
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                          <Mic size={15} className="text-cyan-600" />
                          <span>Natural Tamil Voice (IndicF5)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {videoSummary?.tamil_voice_dubbed_ready || 0}/{videoSummary?.total_videos || tamilProgressData?.total_videos || 0}
                          </span>
                          <button
                            onClick={() => {
                              // Find first video lesson in curriculum to open modal
                              let firstVid: any = null;
                              for (const m of modules) {
                                if (m.lessons) {
                                  for (const l of m.lessons) {
                                    if (l.type?.toLowerCase() === 'video') {
                                      firstVid = l;
                                      break;
                                    }
                                  }
                                }
                                if (firstVid) break;
                              }
                              if (firstVid) {
                                openVoiceModal(firstVid);
                              } else {
                                triggerToast("Add a video lesson in Curriculum tab to configure voice", "error");
                              }
                            }}
                            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all shadow-xs"
                            title="Open Tamil Voice Studio"
                          >
                            <Mic size={11} /> Voice Studio
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BUTTON ACTIONS */}
                  <div className="flex gap-2.5">
                    {tamilProgressData?.status === 'READY' ? (
                      <>
                        <button
                          onClick={() => navigate(`/course/${courseId}/player?lang=ta`)}
                          className="flex-1 h-12 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
                        >
                          <ExternalLink size={15} /> Open Tamil
                        </button>
                        <button
                          onClick={handleGenerateTamil}
                          disabled={isGeneratingTamil}
                          className="h-12 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 shadow-xs"
                          title="Regenerate all Tamil PDFs"
                        >
                          <RotateCw size={14} /> Regenerate
                        </button>
                      </>
                    ) : tamilProgressData?.status === 'GENERATING' || isGeneratingTamil ? (
                      <div className="flex gap-2 w-full">
                        <button
                          disabled
                          className="flex-1 h-12 bg-slate-100 text-slate-400 border border-slate-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <RotateCw size={15} className="animate-spin text-slate-400" /> Translating...
                        </button>
                        <button
                          onClick={handleGenerateTamil}
                          className="h-12 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                          title="Force Re-trigger or Reset"
                        >
                          <RotateCw size={13} /> Reset
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleGenerateTamil}
                        className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 active:scale-98"
                      >
                        <Sparkles size={16} /> Generate Tamil Course
                      </button>
                    )}
                  </div>

                </div>

              </div>

              {/* ARCHITECTURE INFORMATION BOX */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 shadow-sm">
                  <Sparkles size={20} className="text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 mb-1">IndicTrans2 AI Document Translation Engine</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Course documents are processed through PyMuPDF and the pretrained AI4Bharat IndicTrans2 distilled model. Text formatting, mathematical expressions, code blocks, URLs, and original English videos remain completely preserved. When students select Hindi or Tamil online or in LAN ShareHub, translated PDFs will be served automatically.
                  </p>
                </div>
              </div>
            </div>

          ) : activeTab === "Communications" ? (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-2xl px-2">
              <h2 className="text-4xl font-black tracking-tight mb-2">Communications</h2>
              <p className="text-slate-500 text-lg mb-8">Manage student relationships, announcements, and direct feedback.</p>

              <div className="bg-white p-8 mb-8 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h4 className="font-extrabold text-slate-900 text-lg mb-2">Broadcast Announcement</h4>
                <p className="text-slate-500 text-sm mb-6">Send an urgent alert strictly to enrolled students in this course.</p>
                <textarea placeholder="Compose your message here..." rows={4} className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 mb-4 font-medium text-slate-800 transition-all resize-y" />
                <button className="px-6 py-3.5 bg-blue-600 text-white font-extrabold rounded-xl hover:bg-blue-700 shadow-md transition-all flex items-center justify-center gap-2 w-full">
                  Broadcast Update
                </button>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h4 className="font-extrabold text-slate-900 text-lg mb-6">Course Feedback Logs</h4>
                
                {feedbacks.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow-sm mb-4"><Users size={28} className="text-slate-400" /></div>
                    <p className="font-bold text-slate-800">No Feedback Submitted Yet</p>
                    <p className="text-sm text-slate-500 mt-1">Once students rate or review this course, data will aggregate here.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {feedbacks.map((fb: any, i: number) => (
                      <div key={i} className="p-5 border border-slate-200 rounded-2xl flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black">
                              {fb.student.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 leading-tight">{fb.student}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{fb.time}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} size={14} className={s <= fb.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200"} />
                            ))}
                          </div>
                        </div>
                        {fb.text && <p className="text-sm text-slate-600 leading-relaxed max-w-[90%] font-medium">"{fb.text}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "Languages" ? (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-4xl pb-20">
              {/* Header */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-bold text-xs tracking-wide uppercase mb-3">
                  <Sparkles size={14} className="text-emerald-600" /> AI Multilingual Engine
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Language Versions & Translation</h2>
                <p className="text-slate-500 text-lg">
                  Translate your course curriculum and PDF notes to Hindi (हिन्दी) using high-precision neural translation.
                </p>
              </div>

              {/* Language Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 1. English (Original) Card */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -z-10 pointer-events-none" />
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🇬🇧</span>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-xl">English</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Original Base Version</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    </div>

                    <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                      Primary master course. All new modules, lessons, and PDF note uploads are added here first.
                    </p>

                    <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                        <span className="flex items-center gap-2"><BookOpen size={14} className="text-slate-400" /> Modules</span>
                        <span className="font-bold text-slate-900">{modules.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                        <span className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Total Lessons</span>
                        <span className="font-bold text-slate-900">
                          {modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/dashboard/course/${courseId}/player`)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 px-4 rounded-2xl transition-all text-sm"
                  >
                    <ExternalLink size={16} /> Preview English Course
                  </button>
                </div>

                {/* 2. Hindi (हिन्दी) Card */}
                <div className="bg-white rounded-3xl p-8 border border-emerald-200/80 shadow-[0_8px_30px_rgb(5,150,105,0.06)] flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -z-10 pointer-events-none" />
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🇮🇳</span>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-xl">हिन्दी (Hindi)</h3>
                          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">AI IndicTrans2 Engine</p>
                        </div>
                      </div>

                      {hindiProgressData?.status === 'READY' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={12} /> Ready
                        </span>
                      ) : isGeneratingHindi || hindiProgressData?.status === 'GENERATING' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 animate-pulse">
                          <RotateCw size={12} className="animate-spin" /> {hindiProgressData?.progress || 10}%
                        </span>
                      ) : hindiProgressData?.status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800">
                          <AlertCircle size={12} /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600">
                          Not Generated
                        </span>
                      )}
                    </div>

                    <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                      Converts all PDF notes and document content into clear Hindi with HarfBuzz Devanagari font rendering while keeping code syntax protected.
                    </p>

                    {/* Progress Bar when Generating */}
                    {(isGeneratingHindi || hindiProgressData?.status === 'GENERATING') && (
                      <div className="mb-6 p-4 bg-blue-50/80 border border-blue-200/80 rounded-2xl">
                        <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-2">
                          <span className="flex items-center gap-2">
                            <RotateCw size={14} className="animate-spin text-blue-600" />
                            {hindiProgressData?.stage_message || "Translating course PDF notes to Hindi..."}
                          </span>
                          <span>{hindiProgressData?.progress || 15}%</span>
                        </div>
                        <div className="w-full bg-blue-200/60 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(hindiProgressData?.progress || 10, 8)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-blue-600 mt-2 font-medium">
                          ⚡ NVIDIA RTX GPU neural translation in progress. You can stay on this page or check back anytime.
                        </p>
                      </div>
                    )}

                    {/* Features list when not generating */}
                    {!isGeneratingHindi && hindiProgressData?.status !== 'GENERATING' && (
                      <div className="space-y-2.5 mb-6 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                          <span>AI4Bharat IndicTrans2 neural translation</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                          <span>Devanagari Unicode shaping &amp; formatted PDF rendering</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                          <span>Source code syntax &amp; technical term protection</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div>
                    {hindiProgressData?.status === 'READY' ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => navigate(`/dashboard/course/${courseId}/player?lang=hi`)}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-all text-sm shadow-lg shadow-emerald-600/20"
                        >
                          <Play size={16} /> Preview in Hindi Player
                        </button>
                        <button
                          onClick={handleGenerateHindi}
                          disabled={isGeneratingHindi}
                          className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-2xl transition-all text-sm"
                          title="Re-translate all PDF notes"
                        >
                          <RefreshCw size={16} /> Re-translate
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleGenerateHindi}
                        disabled={isGeneratingHindi || hindiProgressData?.status === 'GENERATING'}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Sparkles size={18} />
                        {isGeneratingHindi ? "Generating Hindi Version..." : "Generate Hindi Course (हिन्दी)"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Informational Footer Box */}
              <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex items-start gap-4">
                <div className="p-3 bg-white/10 rounded-2xl shrink-0">
                  <Globe size={24} className="text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base mb-1">How Multilingual Courses Work in SkillForge</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Generating a Hindi version extracts all PDF notes from this course, applies technical keyword masking to keep code intact, translates sentence-by-sentence via local IndicTrans2 AI, and generates a formatted Devanagari PDF. Students can seamlessly toggle between English and Hindi in the Course Player and download offline Hindi ZIP bundles via ShareHub.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 max-w-2xl pb-20">
              <h2 className="text-4xl font-black tracking-tight mb-2">Global Settings</h2>
              <p className="text-slate-500 text-lg mb-8">Update your course metadata and presentation layers.</p>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-8">

                {/* THUMBNAIL MANAGER */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Course Thumbnail Engine</label>

                  {courseImageUrl ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      <img src={courseImageUrl} alt="Course Cover" className="w-full h-64 object-cover" />
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <button onClick={handleRemoveThumbnail} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg flex items-center gap-2">
                          <Trash2 size={18} /> Remove Thumbnail Graphic
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-blue-400 border-dashed rounded-2xl p-8 bg-blue-50/50 text-center flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-blue-100 flex items-center justify-center rounded-full text-blue-500"><ImageIcon size={32} /></div>
                      <div>
                        <div className="text-blue-900 font-bold text-base mb-1">Upload Thumbnail Image</div>
                        <p className="text-xs text-slate-500">Choose an image file from your device or paste a URL below</p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setCourseImageUrl(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer bg-white p-2 rounded-xl border border-blue-200"
                        />
                      </div>

                      <div className="w-full max-w-md flex items-center gap-2 text-xs text-slate-400">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span>OR PASTE URL</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>

                      <input
                        placeholder="https://images.unsplash..."
                        value={courseImageUrl} onChange={e => setCourseImageUrl(e.target.value)}
                        className="w-full max-w-md p-3 rounded-xl border border-blue-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-sm font-medium bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* BASIC INFO */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">SEO Title</label>
                  <input
                    value={courseTitle} onChange={e => setCourseTitle(e.target.value)}
                    className="w-full text-xl p-5 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-bold text-slate-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Marketing Description</label>
                  <textarea
                    rows={5} value={courseDescription} onChange={e => setCourseDescription(e.target.value)}
                    className="w-full text-lg p-5 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-700 transition-all resize-y font-medium"
                  />
                </div>

                <button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full mt-2 py-5 bg-slate-900 text-white font-extrabold text-lg rounded-2xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10">
                  {isSavingSettings ? "Injecting Data..." : <><Save size={20} /> Save Global Settings</>}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FINALIZE COURSE CONFIRMATION STRICT MODAL */}
      <AnimatePresence>
        {showFinalizeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[150] p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white max-w-lg w-full rounded-[2rem] p-8 shadow-2xl relative border border-slate-100">
              <button onClick={() => setShowFinalizeModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={24} /></button>
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6 border border-red-100 shadow-inner">
                <Lock size={32} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Finalize Permanently?</h3>
              <p className="text-slate-500 mb-8 text-lg leading-relaxed">
                You cannot add, edit, or delete modules. This officially unlocks certificates for enrolled students. <strong className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">Irreversible action.</strong>
              </p>

              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 mb-8">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">Type "FINALIZE" below</label>
                <input
                  type="text" value={finalizeConfirmation} onChange={(e) => setFinalizeConfirmation(e.target.value)}
                  placeholder="FINALIZE"
                  className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20 font-black tracking-widest text-red-600 bg-white text-lg placeholder:text-red-200 transition-all"
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setShowFinalizeModal(false)} className="flex-1 py-5 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all text-lg">Cancel</button>
                <button
                  onClick={handleFinalize}
                  disabled={finalizeConfirmation !== "FINALIZE"}
                  className="flex-1 py-5 font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_30px_rgb(220,38,38,0.3)] text-lg"
                >
                  Confirm Lock
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY MODAL FOR ADDING ITEM */}
      <AnimatePresence>
        {activeModal && showContentPicker === null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => { setActiveModal(null); resetForm(); }}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  {getLessonIcon(activeModal.toLowerCase().replace(" ", "_"))}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{editingItem ? "Edit" : "Add"} {activeModal}</h3>
                  <p className="text-slate-500 font-medium">Configure the details below</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Title <span className="text-red-500">*</span></label>
                  <input
                    value={itemTitle} onChange={(e) => setItemTitle(e.target.value)}
                    placeholder="e.g. Introduction to React"
                    className="w-full text-lg p-4 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all"
                  />
                </div>

                {activeModal === "Quiz" && (
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 mb-6">
                    <button
                      type="button"
                      onClick={() => setQuizType("manual")}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                        quizType === "manual"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <HelpCircle size={16} className="text-emerald-500" />
                      <span>Manual Quiz Builder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuizType("external")}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                        quizType === "external"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <ExternalLink size={16} className="text-blue-500" />
                      <span>External Quiz (Google Form / Link)</span>
                    </button>
                  </div>
                )}

                {(activeModal === "Code Test" || activeModal === "Code") ? (
                  <div className="space-y-6 border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-800 text-base">Coding Problems & Test Cases</h4>
                      <button
                        type="button"
                        onClick={() => setProblems([...problems, { title: "", description: "", difficulty: "Easy", testCases: [{ input: "", output: "" }] }])}
                        className="px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-xl text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Problem
                      </button>
                    </div>

                    {problems.map((prob, pIdx) => (
                      <div key={pIdx} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 relative">
                        {problems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setProblems(problems.filter((_, idx) => idx !== pIdx))}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}

                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Problem {pIdx + 1} Title <span className="text-red-500">*</span></label>
                            <input
                              value={prob.title}
                              onChange={(e) => {
                                const updated = [...problems];
                                updated[pIdx].title = e.target.value;
                                setProblems(updated);
                              }}
                              placeholder="e.g. Reverse a String"
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-purple-500"
                            />
                          </div>
                          <div className="w-1/3">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Difficulty</label>
                            <select
                              value={prob.difficulty}
                              onChange={(e) => {
                                const updated = [...problems];
                                updated[pIdx].difficulty = e.target.value;
                                setProblems(updated);
                              }}
                              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-purple-500"
                            >
                              <option value="Easy">Easy</option>
                              <option value="Medium">Medium</option>
                              <option value="Hard">Hard</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Problem Description <span className="text-red-500">*</span></label>
                          <textarea
                            value={prob.description}
                            onChange={(e) => {
                              const updated = [...problems];
                              updated[pIdx].description = e.target.value;
                              setProblems(updated);
                            }}
                            rows={3}
                            placeholder="Describe the problem, constraints, and requirements..."
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-purple-500"
                          />
                        </div>

                        {/* Test Cases */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Test Cases</label>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...problems];
                                updated[pIdx].testCases.push({ input: "", output: "" });
                                setProblems(updated);
                              }}
                              className="text-xs font-bold text-purple-600 hover:text-purple-700"
                            >
                              + Add Test Case
                            </button>
                          </div>

                          {prob.testCases.map((tc, tcIdx) => (
                            <div key={tcIdx} className="flex gap-3 items-center">
                              <div className="flex-1">
                                <input
                                  value={tc.input}
                                  onChange={(e) => {
                                    const updated = [...problems];
                                    updated[pIdx].testCases[tcIdx].input = e.target.value;
                                    setProblems(updated);
                                  }}
                                  placeholder="Input (e.g. hello)"
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-purple-500"
                                />
                              </div>
                              <div className="flex-1">
                                <input
                                  value={tc.output}
                                  onChange={(e) => {
                                    const updated = [...problems];
                                    updated[pIdx].testCases[tcIdx].output = e.target.value;
                                    setProblems(updated);
                                  }}
                                  placeholder="Expected Output (e.g. olleh)"
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-purple-500"
                                />
                              </div>
                              {prob.testCases.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...problems];
                                    updated[pIdx].testCases = updated[pIdx].testCases.filter((_, idx) => idx !== tcIdx);
                                    setProblems(updated);
                                  }}
                                  className="text-slate-400 hover:text-red-500 p-1"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (activeModal === "Quiz" && quizType === "manual") ? (
                  <div className="space-y-6 border-t border-slate-200 pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-base">Questions ({quizQuestions.length})</h4>
                        <p className="text-xs text-slate-500 mt-0.5">4 options per question. Select the correct answer radio button.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuizQuestions([
                            ...quizQuestions,
                            {
                              question_text: "",
                              order_index: quizQuestions.length + 1,
                              correct_option_index: 0,
                              options: [
                                { option_text: "", option_index: 0 },
                                { option_text: "", option_index: 1 },
                                { option_text: "", option_index: 2 },
                                { option_text: "", option_index: 3 },
                              ]
                            }
                          ]);
                        }}
                        className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Plus size={15} /> Add Question
                      </button>
                    </div>

                    <div className="space-y-6">
                      {quizQuestions.map((q, qIdx) => (
                        <div key={qIdx} className="p-6 bg-slate-50/80 border border-slate-200 rounded-3xl space-y-4 relative shadow-xs">
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                            <span className="font-black text-sm text-slate-800 flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-black">
                                {qIdx + 1}
                              </span>
                              Question {qIdx + 1}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              {quizQuestions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuizQuestions(quizQuestions.filter((_, idx) => idx !== qIdx));
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete question"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">Question Text <span className="text-red-500">*</span></label>
                            <textarea
                              value={q.question_text}
                              onChange={(e) => {
                                const updated = [...quizQuestions];
                                updated[qIdx].question_text = e.target.value;
                                setQuizQuestions(updated);
                              }}
                              rows={2}
                              placeholder="e.g. What is the difference between an abstract class and an interface in Java?"
                              className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-y"
                            />
                          </div>

                          {/* 4 Options */}
                          <div className="space-y-2.5 pt-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Options (Click radio button on the left to set Correct Answer)
                            </label>
                            
                            {q.options.map((opt, optIdx) => {
                              const isCorrect = q.correct_option_index === optIdx;
                              const optLetter = String.fromCharCode(65 + optIdx);

                              return (
                                <div
                                  key={optIdx}
                                  className={`flex items-center gap-3 p-2.5 pr-3.5 rounded-2xl border transition-all ${
                                    isCorrect 
                                      ? "bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/20" 
                                      : "bg-white border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = [...quizQuestions];
                                      updated[qIdx].correct_option_index = optIdx;
                                      setQuizQuestions(updated);
                                    }}
                                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 ${
                                      isCorrect
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                    title={isCorrect ? "Correct Answer" : "Click to mark as Correct Answer"}
                                  >
                                    {optLetter}
                                  </button>

                                  <input
                                    value={opt.option_text}
                                    onChange={(e) => {
                                      const updated = [...quizQuestions];
                                      updated[qIdx].options[optIdx].option_text = e.target.value;
                                      setQuizQuestions(updated);
                                    }}
                                    placeholder={`Option ${optLetter} text...`}
                                    className="flex-1 bg-transparent border-0 outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
                                  />

                                  {isCorrect && (
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">Video / PDF / Resource Content</label>
                    
                    {/* Selected File Card */}
                    {selectedFile ? (
                      <div className="p-4 bg-blue-50/70 border-2 border-blue-200 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {selectedFile.name.endsWith(".mp4") || selectedFile.name.endsWith(".webm") ? "VID" : "DOC"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {selectedFile.name}
                            </div>
                            <div className="text-xs font-semibold text-blue-700">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload to server
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* File Upload Drop Area */}
                        <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition-all">
                          <UploadCloud size={24} className="text-blue-600 mb-1.5" />
                          <span className="text-xs font-bold text-slate-800">Upload Video or PDF File</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Supports large MP4, WebM, PDF (Up to 2GB)</span>
                          <input
                            type="file"
                            accept="video/*,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSelectedFile(file);
                                if (!itemTitle.trim()) {
                                  // Auto-fill title from filename
                                  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                                  setItemTitle(nameWithoutExt);
                                }
                              }
                            }}
                            className="hidden"
                          />
                        </label>

                        {/* URL Paste Option */}
                        <div className="flex flex-col justify-center border-2 border-slate-200 rounded-2xl p-3 bg-white">
                          <span className="text-[11px] font-bold text-slate-500 mb-1.5">Or Paste Web / YouTube Link:</span>
                          <input
                            value={itemUrl}
                            onChange={(e) => setItemUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500 font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {/* Progress Bar when uploading */}
                    {isUploadingFile && uploadProgress !== null && (
                      <div className="space-y-1.5 p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="flex justify-between text-xs font-bold text-blue-900">
                          <span>Uploading large media to server storage...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Duration (mins)</label>
                    <input
                      type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                      placeholder="e.g. 45"
                      className="w-full text-lg p-4 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-end">
                    <label className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-700 block">Mandatory Lesson</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Instructions / Notes</label>
                  <textarea
                    value={itemInstructions} onChange={(e) => setItemInstructions(e.target.value)} rows={3}
                    placeholder="Optional instructions for students..."
                    className="w-full text-lg p-4 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-medium transition-all resize-y"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button
                  onClick={() => { setActiveModal(null); resetForm(); }}
                  className="flex-1 py-4 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingItem ? handleEditSave : saveContentItem}
                  className="flex-1 py-4 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
                >
                  {editingItem ? "Save Changes" : `Add ${activeModal}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🎙️ TAMIL VOICE DUBBING STUDIO MODAL (AI4Bharat IndicF5) */}
      <AnimatePresence>
        {voiceModalItem && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-100 relative my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
                    <Mic size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      Tamil Voice Studio
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                        AI4Bharat IndicF5
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium truncate max-w-md mt-0.5">
                      Lesson: "{voiceModalItem.title}"
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setVoiceModalItem(null)}
                  className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="py-6 space-y-6 max-h-[70vh] overflow-y-auto pr-1">

                {/* Section 1: Professor Reference Voice */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                      <Volume2 size={16} className="text-cyan-600" />
                      <span>1. Professor Reference Voice (English)</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">8–15s voice clone sample</span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Select continuous clean speech from the instructor's original English lecture. IndicF5 uses this reference to clone the instructor's exact vocal timbre, pitch, and pacing into modern spoken Tamil.
                  </p>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setVoiceMode("auto")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        voiceMode === "auto" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      ✨ Auto-Detect Best Sample
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoiceMode("manual")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        voiceMode === "manual" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      ⏱️ Manual Timestamps
                    </button>
                  </div>

                  {/* Manual Inputs */}
                  {voiceMode === "manual" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Start Time (seconds)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={voiceStartTime}
                          onChange={(e) => setVoiceStartTime(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold outline-none focus:border-cyan-500"
                          placeholder="e.g. 0"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">End Time (seconds)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          value={voiceEndTime}
                          onChange={(e) => setVoiceEndTime(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold outline-none focus:border-cyan-500"
                          placeholder="e.g. 12"
                        />
                      </div>
                    </div>
                  )}

                  {/* Extract Button */}
                  <button
                    type="button"
                    onClick={handleExtractReferenceVoice}
                    disabled={isExtractingRef}
                    className="w-full py-2.5 bg-white hover:bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 disabled:opacity-50"
                  >
                    <Sparkles size={14} className={isExtractingRef ? "animate-spin text-cyan-600" : "text-cyan-600"} />
                    {isExtractingRef ? "Extracting 24kHz Reference Audio..." : "Extract & Preview Reference Voice"}
                  </button>

                  {/* Extracted Preview Player */}
                  {extractedRefVoice && extractedRefVoice.reference_audio_url && (
                    <div className="bg-white border border-cyan-100 rounded-2xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-cyan-900 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          Reference Audio Isolated
                        </span>
                        <span className="text-[10px] font-black text-slate-400">
                          {extractedRefVoice.duration ? `${extractedRefVoice.duration.toFixed(1)}s sample` : "24kHz Mono"}
                        </span>
                      </div>

                      <audio
                        controls
                        src={resolveMediaUrl(extractedRefVoice.reference_audio_url)}
                        className="w-full h-9 rounded-xl outline-none"
                      />

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                          English Reference Transcript (Matches Audio)
                        </label>
                        <textarea
                          rows={2}
                          value={customTranscript}
                          onChange={(e) => setCustomTranscript(e.target.value)}
                          placeholder="Reference speech transcript in English..."
                          className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-cyan-500 font-medium text-slate-800 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Neural Speech Synthesis & Synchronization */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                      <Sparkles size={16} className="text-blue-600" />
                      <span>2. Neural Voice Dubbing & Alignment Engine</span>
                    </div>

                    {/* Language Switcher Tabs */}
                    <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleVoiceLangChange("ta")}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                          selectedVoiceLang === "ta"
                            ? "bg-white text-blue-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        தமிழ் (Tamil)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVoiceLangChange("hi")}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                          selectedVoiceLang === "hi"
                            ? "bg-white text-orange-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        हिन्दी (Hindi)
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Converts {selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} subtitles into natural classroom lecture speech (preserving tech keywords like <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[11px]">class</code>, <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[11px]">function</code>, <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[11px]">prompt</code>, <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[11px]">workflow</code>) and synchronizes audio timing with original video.
                  </p>

                  {/* Status Indicator / Progress */}
                  {voiceDubStatus?.status === 'GENERATING' || isGeneratingVoiceDub ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-center text-xs font-black text-blue-900">
                        <span className="flex items-center gap-2">
                          <RotateCw size={13} className="animate-spin text-blue-600" />
                          Synthesizing & Synchronizing {selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} Voice...
                        </span>
                        <span className="text-blue-600">{voiceDubStatus?.progress || 10}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(voiceDubStatus?.progress || 10, 10)}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                        />
                      </div>
                      <p className="text-[10px] text-blue-700 font-medium truncate">
                        Synthesizing pure {selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} speech with intelligent audio alignment & zero-cut timeline synchronization...
                      </p>
                    </div>
                  ) : previewVideoUrl ? (
                    <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-purple-900 flex items-center gap-1.5">
                          <CheckCircle2 size={15} className="text-purple-600" />
                          30s Aligned {selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} Voice Preview Ready
                        </span>
                        <span className="text-[10px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                          Zero-Cut Verified
                        </span>
                      </div>

                      {/* Video Player Preview */}
                      <video
                        controls
                        src={resolveMediaUrl(previewVideoUrl)}
                        className="w-full h-44 rounded-xl bg-black object-contain shadow-xs"
                      />

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[11px] font-medium text-purple-800 truncate max-w-[280px]">
                          Preview: {previewVideoUrl}
                        </span>
                        <span className="text-[11px] text-purple-600 font-bold">
                          Natural Spoken Alignment Active
                        </span>
                      </div>
                    </div>
                  ) : voiceDubStatus?.status === 'READY' && voiceDubStatus?.dubbed_video_url ? (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 size={15} className="text-emerald-600" />
                          {selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} Dubbed Video Ready (Fully Aligned)
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                          Stream Active
                        </span>
                      </div>

                      {/* Video Player Preview */}
                      <video
                        controls
                        src={resolveMediaUrl(voiceDubStatus.dubbed_video_url)}
                        className="w-full h-44 rounded-xl bg-black object-contain shadow-xs"
                      />

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[11px] font-medium text-emerald-800 truncate max-w-[280px]">
                          Dubbed Video: {voiceDubStatus.dubbed_video_url}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/course/${courseId}/player?lang=${selectedVoiceLang}`)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <ExternalLink size={12} /> Student View
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs font-bold text-slate-600">
                      <span>{selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} Dubbing Status</span>
                      <span className="text-slate-400 font-medium">Ready to Synthesize</span>
                    </div>
                  )}

                  {/* Action Buttons: Preview & Full Generate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handlePreviewVoiceDub}
                      disabled={isPreviewingVoiceDub || isGeneratingVoiceDub || voiceDubStatus?.status === 'GENERATING'}
                      className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
                    >
                      <Sparkles size={14} className={isPreviewingVoiceDub ? "animate-spin text-purple-400" : "text-purple-400"} />
                      {isPreviewingVoiceDub ? "Synthesizing Preview..." : `Preview ${selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} Voice (30s)`}
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateVoiceDub}
                      disabled={isPreviewingVoiceDub || isGeneratingVoiceDub || voiceDubStatus?.status === 'GENERATING'}
                      className="w-full py-3.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 active:scale-98 disabled:opacity-50"
                    >
                      <Sparkles size={14} className={isGeneratingVoiceDub ? "animate-spin" : ""} />
                      {voiceDubStatus?.status === 'READY'
                        ? `Re-Generate Full ${selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} Video`
                        : `Generate Full ${selectedVoiceLang === "hi" ? "Hindi" : "Tamil"} Video`}
                    </button>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setVoiceModalItem(null)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                >
                  Close Studio
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GLASSMORPHIC TOAST */}
      <GlassToast toast={{ show: toast.show, msg: toast.message, type: toast.type as "success" | "error", id: 0 }} />

    </div>
  );
};

export default CourseBuilder;