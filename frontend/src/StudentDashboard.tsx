import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Compass, Award, Settings, LogOut,
  PlayCircle, ShoppingBag, User, Download, Clock,
  CreditCard, X, Lock, Save, CheckCircle,
  Code, Play, Terminal, Monitor, AlertTriangle, Eye, EyeOff,
  ChevronRight, Menu, Zap, Cpu, Bell, Search, LayoutDashboard,
  CheckSquare, FileText, HelpCircle, Lightbulb, Trophy, Star,
  TrendingUp, Activity, Cloud, Layers, Unlock, Video, Users
} from "lucide-react";
import { GlassToast } from "./components/GlassToast";
import StudentMeetings from "./StudentMeetings";

import { runPythonLocally } from './utils/pyodideEnv';
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";
// --- TYPES ---
interface Course { id: number; title: string; description: string; price: number; image_url: string; instructor_id: number; progress?: any; user_rating?: number; }
interface CodeTest { id: number; title: string; time_limit: number; problems: any[]; completed?: boolean; result_status?: string; }

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "home");
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Navigation & Profile State
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activityTab, setActivityTab] = useState("assignments");

  const [userProfile, setUserProfile] = useState<any>({ name: "Student", email: "", initials: "ST", profile_pic: "" });

  // Modal & Settings
  const [showModal, setShowModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [processing, setProcessing] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // --- REVIEW SYSTEM STATES ---
  const [showReviewModal, setShowReviewModal] = useState<Course | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // --- CODE ARENA STATES ---
  const [codeTests, setCodeTests] = useState<CodeTest[]>([]);
  const [activeTest, setActiveTest] = useState<CodeTest | null>(null);
  const [passKeyInput, setPassKeyInput] = useState("");
  const [showPassKeyModal, setShowPassKeyModal] = useState<number | null>(null);
  const [certSearchQuery, setCertSearchQuery] = useState("");

  // --- PROCTORING & IDE STATES ---
  const [timeLeft, setTimeLeft] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);

  // Problem & Code State
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [solutions, setSolutions] = useState<{ [key: number]: string }>({});
  const [userCode, setUserCode] = useState("");
  const [language, setLanguage] = useState(71);

  const [consoleOutput, setConsoleOutput] = useState("Ready to execute...");
  const [executionStatus, setExecutionStatus] = useState("idle");

  const VIOLATION_LIMIT = 5;

  const languages = [
    { id: 71, name: "Python (3.8.1)", value: "python" },
    { id: 62, name: "Java (OpenJDK 13)", value: "java" },
    { id: 54, name: "C++ (GCC 9.2.0)", value: "cpp" },
    { id: 63, name: "JavaScript (Node.js)", value: "javascript" },
  ];

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  // ============================================================================
  // 🔄 DATA FETCHING & PROCTORING EFFECTS
  // ============================================================================

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role === "instructor") { navigate("/dashboard"); return; }
    fetchData();
    fetchCodeTests();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const profileRes = await axios.get(`${API_BASE_URL}/profile`, config);
      setUserProfile({
        ...profileRes.data,
        name: profileRes.data.full_name,
        initials: profileRes.data.full_name.substring(0, 2).toUpperCase()
      });

      const allRes = await axios.get(`${API_BASE_URL}/courses`, config);
      const myRes = await axios.get(`${API_BASE_URL}/my-courses`, config);
      const dashRes = await axios.get(`${API_BASE_URL}/student/dashboard`, config);
      
      try {
        const classesRes = await axios.get(`${API_BASE_URL}/profile/classes`);
        setClassesList(classesRes.data);
      } catch (e) { console.error("Error fetching classes"); }

      const myCourseIds = new Set(myRes.data.map((c: Course) => c.id));
      setAvailableCourses(allRes.data.filter((c: Course) => !myCourseIds.has(c.id)));
      
      const enrolledWithProgress = myRes.data.map((course: Course) => {
          const dashCourse = dashRes.data.enrolled_courses.find((dc: any) => dc.id === course.id);
          return { ...course, progress: dashCourse ? dashCourse.progress : 0 };
      });
      setEnrolledCourses(enrolledWithProgress);
      setDashboardData(dashRes.data);
    } catch (err: any) {
      if (err.response?.status === 401) { localStorage.clear(); navigate("/"); }
    } finally { setLoading(false); }
  };

  const fetchCodeTests = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${API_BASE_URL}/code-tests`, { headers: { Authorization: `Bearer ${token}` } });
      setCodeTests(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    let timerInterval: any;
    if (activeTest) {
      const savedWarns = localStorage.getItem(`warns_${activeTest.id}`);
      if (savedWarns) setViolationCount(parseInt(savedWarns));

      const savedSolutions = localStorage.getItem(`sols_${activeTest.id}`);
      if (savedSolutions) {
        const parsed = JSON.parse(savedSolutions);
        setSolutions(parsed);
        setUserCode(parsed[0] || "# Write your solution here...");
      } else {
        setUserCode("# Write your solution here...");
      }

      // Countdown timer
      timerInterval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { terminateTest("timeout"); return 0; }
          return prev - 1;
        });
      }, 1000);

      // ── Proctoring: fullscreen exit detection ──────────────────────────────
      const handleFullScreenChange = () => {
        if (!document.fullscreenElement) {
          setIsFullScreen(false);
          setShowWarningOverlay(true);
          recordViolation();
        } else {
          setIsFullScreen(true);
        }
      };
      document.addEventListener("fullscreenchange", handleFullScreenChange);

      // ── Proctoring: tab switch / window blur detection ─────────────────────
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setShowWarningOverlay(true);
          recordViolation();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearInterval(timerInterval);
        document.removeEventListener("fullscreenchange", handleFullScreenChange);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [activeTest]);

  // ── Centralised violation recorder ────────────────────────────────────────
  const recordViolation = () => {
    setViolationCount(prev => {
      const next = prev + 1;
      if (activeTest) localStorage.setItem(`warns_${activeTest.id}`, next.toString());
      if (next >= VIOLATION_LIMIT) {
        terminateTest("proctoring");
      }
      return next;
    });
  };

  // ── Force-terminate (proctoring / timeout) — saves status='terminated' ────
  const terminateTest = async (reason: string) => {
    if (!activeTest) return;
    const token = localStorage.getItem("token");
    const timeSpent = Math.floor((activeTest.time_limit * 60 - timeLeft) / 60);
    try {
      await axios.post(`${API_BASE_URL}/code-tests/submit`, {
        test_id: activeTest.id, score: 0,
        problems_solved: Object.keys(solutions).length,
        time_taken: `${timeSpent} mins`,
        status: "terminated"
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (_) { /* already submitted — ignore 409 */ }
    fetchCodeTests();
    setActiveTest(null);
    triggerToast(reason === "timeout" ? "Time expired — test closed." : "Test terminated: proctoring violation limit reached.", "error");
  };


  // ============================================================================
  // ⚡ HYBRID EXECUTION LOGIC (The "Anti-Cheese" Rules)
  // ============================================================================

  const handleRun = async () => {
    setExecutionStatus("running");
    setConsoleOutput("Processing...");

    // 🟢 CASE 1: PYTHON (Run Locally via Pyodide)
    if (language === 71) {
      setConsoleOutput("🔹 Loading Pyodide WASM (first run may take ~10s)...");

      // Extract the first visible (non-hidden) test case input to feed into stdin.
      // This makes input() and sys.stdin.read() work correctly in the browser.
      let sampleStdin = "";
      let expectedOutput = "";
      try {
        const prob = activeTest?.problems[currentProblemIndex];
        const allCases = typeof prob?.test_cases === 'string'
          ? JSON.parse(prob.test_cases)
          : prob?.test_cases;
        const firstPublicCase = (allCases || []).find((c: any) => !c.hidden);
        sampleStdin = firstPublicCase?.input ?? "";
        expectedOutput = firstPublicCase?.output ?? "";
      } catch (_) { }

      const localResult = await runPythonLocally(userCode, sampleStdin);

      if (localResult.success) {
        const outTrim = localResult.output.trim();
        const expTrim = expectedOutput.trim();
        if (outTrim === expTrim) {
          setExecutionStatus("success");
          setConsoleOutput(`✅ Output Matched:\n${localResult.output}\n\n(Click 'Submit' to grade against hidden test cases)`);
          triggerToast("Executed Successfully (Local)", "success");
        } else {
          setExecutionStatus("error");
          setConsoleOutput(`❌ Output Mismatch:\n\nExpected:\n${expectedOutput}\n\nActual:\n${localResult.output}`);
          triggerToast("Output Incorrect", "error");
        }
      } else {
        setExecutionStatus("error");
        setConsoleOutput(`❌ Python Error:\n${localResult.error}`);
        triggerToast("Syntax / Runtime Error", "error");
      }
      return; // STOP HERE. Do not hit AWS.
    }

    // 🔴 CASE 2: C++ / JAVA (Run on Server - Dry Run Only)
    setConsoleOutput("🚀 Compiling on Server (Dry Run)...");
    try {
      const currentProb = activeTest?.problems[currentProblemIndex];
      let sampleCases: any[] = [];

      try {
        const allCases = typeof currentProb?.test_cases === 'string' ? JSON.parse(currentProb.test_cases) : currentProb?.test_cases;
        // ONLY SEND ONE PUBLIC CASE for "Run"
        sampleCases = (allCases && allCases.length > 0) ? [allCases[0]] : [];
      } catch (e) { }

      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_BASE_URL}/execute`, {
        source_code: userCode,
        language_id: language,
        test_cases: sampleCases
      }, { headers: { Authorization: `Bearer ${token}` } });

      const report = res.data.stats ? res.data : res.data.data;

      if (report.error || (report.results && report.results.some((r: any) => r.status !== 'Passed'))) {
        setExecutionStatus("error");
        const fail = report.results?.find((r: any) => r.status !== "Passed");
        setConsoleOutput(fail ? `❌ DRY RUN FAILED:\nExpected: ${fail.expected}\nActual: ${fail.actual}` : `❌ Error: ${report.error}`);
      } else {
        setExecutionStatus("success");
        setConsoleOutput(`✅ Dry Run Passed!\nOutput: ${report.results?.[0]?.output || "Success"}\n\n(Click 'Submit' to grade all cases)`);
      }
    } catch (err: any) {
      setExecutionStatus("error");
      setConsoleOutput("System Error: " + (err.response?.data?.error || err.message));
    }
  };

  const submitTest = async () => {
    if (!activeTest) return;
    setExecutionStatus("running");
    setConsoleOutput("🚀 Submitting to Official Grader...");
    const token = localStorage.getItem("token");

    try {
      const currentProb = activeTest?.problems[currentProblemIndex];
      let cases = [];
      try {
        const rawCases = currentProb?.test_cases;
        cases = typeof rawCases === 'string' ? JSON.parse(rawCases) : rawCases;

        // STRICT VALIDATION: Ensure test cases exist
        if (!cases || cases.length === 0) {
          setExecutionStatus("error");
          setConsoleOutput("❌ Error: No test cases found to grade against.");
          return;
        }
      } catch (e) {
        setExecutionStatus("error");
        setConsoleOutput("❌ Error: Invalid Test Case Format.");
        return;
      }

      // SEND ALL CASES TO AWS
      const res = await axios.post(`${API_BASE_URL}/execute`, {
        source_code: userCode,
        language_id: language,
        test_cases: cases
      }, { headers: { Authorization: `Bearer ${token}` } });

      let report = res.data;
      if (report.body && typeof report.body === 'string') report = JSON.parse(report.body);

      if (report.error) {
        setExecutionStatus("error");
        setConsoleOutput(`❌ SERVER ERROR:\n\n${report.error}`);
        return;
      }

      // STRICT SUCCESS VALIDATION (The "Anti-Cheese" Rule)
      const passedCount = report.stats?.passed || 0;
      const totalCount = report.stats?.total || 0;

      if (totalCount > 0 && passedCount === totalCount) {
        setExecutionStatus("success");
        setConsoleOutput(`🎉 SUCCESS! All ${totalCount} Test Cases Passed.\nRuntime: ${report.stats.runtime_ms}ms`);
        triggerToast("Problem Solved!", "success");

        // Save Progress internally
        handleSave(true);

        // If this was the last action, submit entire test to DB
        const timeSpent = Math.floor((activeTest.time_limit * 60 - timeLeft) / 60);
        await axios.post(`${API_BASE_URL}/code-tests/submit`, {
          test_id: activeTest.id,
          score: 100,
          problems_solved: Object.keys(solutions).length + 1,
          time_taken: `${timeSpent} mins`
        }, { headers: { Authorization: `Bearer ${token}` } });

      } else {
        setExecutionStatus("error");
        const fail = report.results?.find((r: any) => r.status !== "Passed");
        if (fail) {
          setConsoleOutput(`❌ TEST FAILED (Case ${fail.id + 1})\n\nInput: ${fail.input}\nExpected: ${fail.expected}\nActual: ${fail.actual}`);
        } else {
          setConsoleOutput("❌ Unknown Error: Output did not match expected results.");
        }
        triggerToast("Hidden Test Cases Failed", "error");
      }
    } catch (err: any) {
      setExecutionStatus("error");
      setConsoleOutput("System Error: " + (err.response?.data?.error || err.message));
    }
  };

  // ============================================================================
  // 🛠️ UTILITY HANDLERS
  // ============================================================================

  const handleStartTest = async () => {
    const token = localStorage.getItem("token");
    try {
      const payload = { pass_key: passKeyInput };
      const res = await axios.post(`${API_BASE_URL}/code-tests/${showPassKeyModal}/start`, payload, { headers: { Authorization: `Bearer ${token}` } });
      const prevWarns = localStorage.getItem(`warns_${res.data.id}`);
      if (prevWarns && parseInt(prevWarns) > 2) { triggerToast("⛔ You have been disqualified from this test.", "error"); return; }
      setActiveTest(res.data);
      setTimeLeft(res.data.time_limit * 60);
      setShowPassKeyModal(null);
      if (document.documentElement.requestFullscreen) { document.documentElement.requestFullscreen().catch((e) => console.log("Enable full screen")); }
    } catch (err) { triggerToast("Invalid Pass Key", "error"); }
  };

  const handleSave = (silent = false) => {
    if (!activeTest) return;
    const newSolutions = { ...solutions, [currentProblemIndex]: userCode };
    setSolutions(newSolutions);
    localStorage.setItem(`sols_${activeTest.id}`, JSON.stringify(newSolutions));
    if (!silent) triggerToast("✅ Code Saved! You can move to other questions.", "success");
  };

  const switchQuestion = (index: number) => {
    handleSave(true);
    setCurrentProblemIndex(index);
    setUserCode(solutions[index] || "# Write your solution here...");
    setConsoleOutput("Ready to execute...");
    setExecutionStatus("idle");
  };

  const returnToFullScreen = () => {
    document.documentElement.requestFullscreen().catch(() => { });
    setIsFullScreen(true);
    setShowWarningOverlay(false);
  };

  const handleDownloadCertificate = async (id: number, title: string) => {
    setDownloadingId(id);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/generate-pdf/${id}`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Certificate-${title.replace(/\s+/g, "_")}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      triggerToast("Certificate Downloaded Successfully!");
    } catch (err: any) {
      if (err.response && err.response.status === 403) {
        triggerToast("Instructor hasn't finalized this course yet. Check back soon!", "error");
      } else {
        triggerToast("Failed to generate certificate.", "error");
      }
    } finally { setDownloadingId(null); }
  };

  const openEnrollModal = (course: Course) => { setSelectedCourse(course); setShowModal(true); };
  const handlePayment = async (courseId: number, price: number) => { /* Razorpay Logic */ triggerToast("Payment Portal Triggered", "success"); };
  const handleEnrollRequest = async () => { if (!selectedCourse) return; setProcessing(true); try { const token = localStorage.getItem("token"); await axios.post(`${API_BASE_URL}/enroll/${selectedCourse.id}`, { type: "full" }, { headers: { Authorization: `Bearer ${token}` } }); triggerToast("Enrollment Successful!"); setShowModal(false); setActiveTab("learning"); fetchData(); } catch (e) { triggerToast("Error enrolling in course", "error"); } finally { setProcessing(false); } };
  const handleLogout = () => { localStorage.clear(); navigate("/"); };

  const handleSubmitReview = async () => {
    if (!showReviewModal) return;
    if (reviewRating === 0) {
      triggerToast("Please select a rating", "error");
      return;
    }
    setSubmittingReview(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/courses/${showReviewModal.id}/reviews`, {
        rating: reviewRating,
        feedback: reviewFeedback
      }, { headers: { Authorization: `Bearer ${token}` } });
      triggerToast("Thank you for your feedback!", "success");
      setShowReviewModal(null);
      setReviewRating(0);
      setReviewFeedback("");
      fetchData();
    } catch (e) {
      triggerToast("Failed to submit review", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  // ============================================================================
  // 🎨 UI COMPONENTS (SkillForge Theme)
  // ============================================================================

  const NavItem = ({ label, active, onClick, icon }: any) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${active ? "bg-black text-white shadow-md" : "text-gray-500 hover:text-black hover:bg-gray-100"}`}
    >
      {icon} {label}
    </button>
  );

  // --- 🔴 FULL SCREEN PROCTORING VIEW (ACTIVE TEST) ---
  if (activeTest) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 font-sans overflow-hidden">

        {/* Test Header */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-black font-extrabold text-lg tracking-tight">
              <div className="w-6 h-6 bg-black flex items-center justify-center rounded-[4px]"><Layers className="text-white" size={12} strokeWidth={2.5} /></div>
              SkillForge <span className="text-gray-400 font-normal">Arena</span>
            </div>
            <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
            <h3 className="text-sm font-bold text-gray-700 hidden md:block">{activeTest.title}</h3>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
            {activeTest.problems.map((_, idx) => (
              <button key={idx} onClick={() => switchQuestion(idx)} className={`px-4 py-1 rounded-md text-xs font-bold transition-all ${idx === currentProblemIndex ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>
                Q{idx + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-1.5 rounded-full border font-mono text-sm font-bold flex items-center gap-2 ${timeLeft < 300 ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "bg-white border-gray-200 text-black shadow-sm"}`}>
              <Clock size={14} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </div>
            <button onClick={submitTest} className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-full text-xs font-bold transition-colors shadow-lg">Submit Test</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden p-4 gap-4">

          {/* Left Panel: Problem & Camera */}
          <div className="w-[35%] flex flex-col gap-4">
            <div className="flex-1 bg-white rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200 p-6 overflow-y-auto">
              <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-2xl font-black text-black tracking-tight">{activeTest.problems[currentProblemIndex]?.title}</h2>
                <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-3 py-1 rounded-full border border-gray-200 uppercase tracking-widest">Problem {currentProblemIndex + 1}</span>
              </div>
              <div className="prose prose-sm text-gray-600 leading-relaxed mb-8 whitespace-pre-wrap font-medium">
                {activeTest.problems[currentProblemIndex]?.description || "No description available."}
              </div>

              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h4 className="text-xs font-black text-black uppercase tracking-widest mb-4 flex items-center gap-2"><Code size={14} /> Test Cases</h4>
                {JSON.parse(activeTest.problems[currentProblemIndex]?.test_cases || "[]").length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 mb-2">INPUT</div>
                      <code className="block bg-white border border-gray-200 p-3 rounded-lg text-sm font-mono text-black shadow-sm">{JSON.parse(activeTest.problems[currentProblemIndex].test_cases)[0].input}</code>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 mb-2">EXPECTED OUTPUT</div>
                      <code className="block bg-white border border-gray-200 p-3 rounded-lg text-sm font-mono text-black shadow-sm">{JSON.parse(activeTest.problems[currentProblemIndex].test_cases)[0].output}</code>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Proctoring Cam */}
            {/* Proctoring Status (Camera Removed) */}
            <div className="h-[120px] shrink-0 bg-black rounded-[1.5rem] border border-gray-800 shadow-xl overflow-hidden relative flex flex-col items-center justify-center text-center p-4">
              <div className="absolute top-3 left-3 z-10">
                <div className="px-3 py-1.5 rounded-full text-[10px] font-black text-white bg-green-500/80 border border-green-400 flex items-center gap-2 shadow-lg backdrop-blur-md">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                  PROCTORING ACTIVE
                </div>
              </div>
              {violationCount > 0 && (
                <div className="absolute top-3 right-3 z-10 bg-red-500/80 px-2 py-1 rounded-full text-[9px] font-black text-white border border-red-400 shadow-md">
                  ⚠️ {violationCount} warning{violationCount > 1 ? 's' : ''}
                </div>
              )}
              <Monitor className="text-gray-600 mb-2" size={32} />
              <p className="text-xs text-gray-400 font-medium">Activity is being monitored.<br />Do not switch tabs or exit full screen.</p>
            </div>
          </div>

          {/* Right Panel: Editor & Terminal */}
          <div className="w-[65%] flex flex-col gap-4">

            <div className="flex-[2] bg-white rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-200 flex flex-col overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 h-14 flex items-center justify-between px-6">
                <div className="flex items-center gap-2 text-sm font-black text-black tracking-tight">
                  <Terminal size={16} /> Code Editor
                </div>
                <select value={language} onChange={(e) => setLanguage(parseInt(e.target.value))} className="bg-white border border-gray-300 text-sm font-bold text-black rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-black cursor-pointer shadow-sm">
                  {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex-1 pt-4 pb-2 bg-white">
                <Editor height="100%" defaultLanguage="python" language={languages.find(l => l.id === language)?.value} theme="light" value={userCode} onChange={(val) => setUserCode(val || "")} options={{ minimap: { enabled: false }, fontSize: 15, scrollBeyondLastLine: false, padding: { top: 10 }, fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
            </div>

            <div className="flex-[1] flex flex-col gap-4">
              <div className="flex-1 bg-[#0A0A0A] rounded-[1.5rem] shadow-2xl border border-gray-800 flex flex-col overflow-hidden">
                <div className="bg-[#111] h-10 flex items-center px-6 border-b border-gray-800 text-[10px] font-black text-gray-500 uppercase tracking-widest gap-2">
                  <Monitor size={14} /> Terminal Output
                </div>
                <div className={`flex-1 p-6 font-mono text-sm overflow-y-auto whitespace-pre-wrap leading-relaxed ${executionStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  {consoleOutput}
                </div>
              </div>

              <div className="h-14 flex gap-4">
                <button onClick={() => handleSave()} className="w-1/4 bg-white border border-gray-300 hover:bg-gray-50 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                  <Save size={18} /> Save
                </button>
                <button onClick={handleRun} disabled={executionStatus === "running"} className="flex-1 bg-gray-100 hover:bg-gray-200 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 border border-gray-300 shadow-sm">
                  {executionStatus === "running" ? <Cpu className="animate-spin" size={18} /> : <Play size={18} />} Run Code
                </button>
                <button onClick={submitTest} disabled={executionStatus === "running"} className="flex-1 bg-black hover:bg-gray-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-xl shadow-black/10">
                  <Cloud size={18} /> Submit
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Proctoring Violation Overlay */}
        {showWarningOverlay && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center text-center p-8">
            <AlertTriangle size={80} className="text-red-500 mb-8 animate-bounce" />
            <h1 className="text-4xl font-black text-white mb-4 tracking-tighter">Test Interrupted</h1>
            <p className="text-gray-400 max-w-lg mb-10 text-lg leading-relaxed">
              You have exited full-screen mode or switched tabs. This is a strict proctoring violation. Your action has been recorded.
            </p>
            <div className="bg-red-500/10 text-red-500 px-8 py-4 rounded-2xl font-mono font-bold mb-10 border border-red-500/30 text-2xl shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              Remaining Warnings: {VIOLATION_LIMIT - violationCount}
            </div>
            <button onClick={returnToFullScreen} className="bg-white text-black hover:bg-gray-200 px-10 py-5 rounded-full font-black tracking-wide transition-all shadow-xl flex items-center gap-3 text-lg">
              <Monitor size={24} /> RETURN TO FULL SCREEN AND RESUME
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // 🟢 MAIN DASHBOARD VIEW (Light Glassmorphic Bento Box)
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#f4f4f5] font-sans text-black selection:bg-black selection:text-white relative overflow-x-hidden pb-20">

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-white rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-gray-200/50 rounded-full blur-[150px] pointer-events-none" />

      {/* 1. TOP NAVIGATION BAR */}
      <header className="fixed top-0 left-0 w-full h-20 bg-white/70 backdrop-blur-xl border-b border-gray-200 z-50 flex items-center justify-between px-6 md:px-10 shadow-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("home")}>
          <div className="w-8 h-8 bg-black flex items-center justify-center rounded-[6px] shadow-md">
            <Layers className="text-white" size={18} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-black tracking-tight text-black">Skill<span className="text-gray-500">Forge</span></span>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden lg:flex items-center gap-2 bg-gray-100/50 p-1.5 rounded-full border border-gray-200">
          <NavItem icon={<LayoutDashboard size={16} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
          <NavItem icon={<BookOpen size={16} />} label="My Courses" active={activeTab === "learning"} onClick={() => setActiveTab("learning")} />
          <NavItem icon={<Code size={16} />} label="Code Arena" active={activeTab === "test"} onClick={() => setActiveTab("test")} />
          <NavItem icon={<Video size={16} />} label="Live Classes" active={activeTab === "meetings"} onClick={() => setActiveTab("meetings")} />
          <NavItem icon={<Award size={16} />} label="Certificates" active={activeTab === "certificates"} onClick={() => setActiveTab("certificates")} />
          <NavItem icon={<Compass size={16} />} label="Explore" active={activeTab === "explore"} onClick={() => setActiveTab("explore")} />
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-5">
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative text-gray-500 hover:text-black transition-colors">
            <Bell size={22} />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          <div className="relative">
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-white border border-gray-200 rounded-full hover:shadow-md transition-all">
              {userProfile.profile_pic ? (
                <img src={userProfile.profile_pic} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 text-black flex items-center justify-center font-bold text-xs">{userProfile.initials}</div>
              )}
              <span className="text-sm font-bold hidden md:block">{userProfile.name}</span>
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-14 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-50">
                  <div className="mb-4 border-b border-gray-100 pb-4 px-2">
                    <p className="font-black text-black">{userProfile.name}</p>
                    <p className="text-xs text-gray-500 font-medium truncate">{userProfile.email}</p>
                  </div>
                  <button onClick={() => { setActiveTab("settings"); setShowProfileMenu(false); }} className="flex items-center gap-3 w-full p-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-black font-bold text-sm transition-colors mb-1"><Settings size={18} /> Account Settings</button>
                  <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 rounded-xl text-red-500 hover:bg-red-50 font-bold text-sm transition-colors"><LogOut size={18} /> Sign Out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto pt-32 px-6 relative z-10">

        {/* TAB: HOME (BENTO GRID) */}
        {activeTab === "home" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-6">

            <div className="mb-4">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-black">Forge Your Future, {userProfile.name}!</h1>
              <p className="text-gray-500 font-medium mt-2">Welcome back to your learning hub.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                <div className="bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.08)] relative overflow-hidden group hover:shadow-[0_15px_40px_rgba(0,0,0,0.12)] transition-all">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm"><BookOpen size={24} /></div>
                    </div>
                    <h3 className="text-slate-500 font-bold text-[11px] uppercase tracking-widest mb-1 relative z-10">Total Enrolled</h3>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight relative z-10">{dashboardData?.stats?.totalEnrolled || 0}</h2>
                </div>

                <div className="bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.08)] relative overflow-hidden group hover:shadow-[0_15px_40px_rgba(0,0,0,0.12)] transition-all">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm"><CheckCircle size={24} /></div>
                    </div>
                    <h3 className="text-slate-500 font-bold text-[11px] uppercase tracking-widest mb-1 relative z-10">Completed Lessons</h3>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight relative z-10">{dashboardData?.stats?.completedLessons || 0}</h2>
                </div>

                <div className="bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.08)] relative overflow-hidden group hover:shadow-[0_15px_40px_rgba(0,0,0,0.12)] transition-all">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm"><TrendingUp size={24} /></div>
                        <span className="flex items-center gap-1 text-[11px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">Global Avg</span>
                    </div>
                    <h3 className="text-slate-500 font-bold text-[11px] uppercase tracking-widest mb-1 relative z-10">Average Progress</h3>
                    <div className="flex items-end gap-4 relative z-10">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">{dashboardData?.stats?.avgProgress || 0}%</h2>
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full mb-2.5 overflow-hidden"><div className="h-full bg-slate-800 rounded-full transition-all duration-1000" style={{ width: `${dashboardData?.stats?.avgProgress || 0}%` }} /></div>
                    </div>
                </div>

                <div className="bg-[#1e293b] p-6 md:p-8 rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col justify-between border border-slate-800">
                    <div className="absolute top-[-50%] right-[-20%] w-60 h-60 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none" />
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-sm"><Users size={24} className="text-blue-400"/></div>
                        <span className="flex items-center gap-1 text-[10px] font-black text-blue-400 bg-blue-400/10 border border-blue-400/20 px-3 py-1.5 rounded-full shadow-sm uppercase tracking-widest">Enrolled</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mb-1">Active Batches</h3>
                        <div className="flex items-center justify-between">
                            <h2 className="text-4xl font-black text-white tracking-tight">{dashboardData?.stats?.activeBatches || 0}</h2>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]">
              {/* BENTO 1: My Courses (Large) */}
              <div className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-xl border border-slate-200/80 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-xl flex items-center gap-2"><BookOpen size={20} className="text-slate-500" /> Active Courses</h3>
                  <button onClick={() => setActiveTab("learning")} className="text-xs font-bold bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">View All</button>
                </div>

                <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide flex-1">
                  {enrolledCourses.slice(0, 4).map((c, i) => (
                    <div key={i} className="min-w-[160px] bg-white rounded-2xl p-4 border border-gray-100 flex flex-col justify-between group shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-center mb-4">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-100" />
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="175" strokeDashoffset={175 - (175 * (c.progress || 0)) / 100} className="text-black" />
                          </svg>
                          <span className="absolute text-xs font-black">{c.progress || 0}%</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <h4 className="font-bold text-sm text-slate-800 truncate mb-1" title={c.title}>{c.title}</h4>
                      </div>
                      <button onClick={() => navigate(`/course/${c.id}/player`)} className="w-full mt-4 bg-black text-white text-xs font-bold py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Resume</button>
                    </div>
                  ))}
                  {enrolledCourses.length === 0 && (
                    <div className="w-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl p-8">
                      <Compass size={32} className="mb-2 text-slate-300" />
                      <p className="text-sm font-bold text-slate-400">No active courses. Start exploring!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* BENTO 2: Recommended Courses */}
              <div className="lg:col-span-1 bg-gradient-to-br from-white to-slate-50/80 backdrop-blur-xl border border-slate-200/80 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex flex-col">
                <h3 className="font-black text-xl mb-4 flex items-center gap-2"><Star size={20} className="text-yellow-500" /> Recommended For You</h3>
                <div className="flex flex-col gap-4 flex-1">
                  {dashboardData?.recommended_courses?.map((c: any, i: number) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-colors cursor-pointer" onClick={() => navigate(`/course/${c.id}`)}>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{c.title}</h4>
                        <p className="text-xs font-medium text-slate-500 mt-1">by {c.instructor}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500" />
                    </div>
                  ))}
                  {(!dashboardData?.recommended_courses || dashboardData?.recommended_courses.length === 0) && (
                    <p className="text-sm text-slate-400 font-medium">Keep exploring to get recommendations!</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB: MY COURSES */}
        {activeTab === "learning" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20">
            <div className="mb-10">
              <h2 className="text-3xl font-black mb-2 tracking-tight">My Enrolled Courses</h2>
              <p className="text-gray-500 font-bold">Pick up where you left off or review completed materials.</p>
            </div>

            {enrolledCourses.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl py-20">
                <Compass size={48} className="mb-4 text-gray-300" />
                <p className="text-lg font-bold">You are not enrolled in any courses yet. Start exploring!</p>
                <button onClick={() => setActiveTab("explore")} className="mt-4 bg-black text-white px-6 py-2 rounded-full font-bold">Explore Catalog</button>
              </div>
            ) : (
              <div className="space-y-16">

                {/* IN PROGRESS COURSES */}
                <div className="space-y-6">
                  <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <div className="w-2 h-6 bg-blue-500 rounded-full"></div> In Progress ({enrolledCourses.filter(c => c.progress < 100).length})
                  </h3>

                  {enrolledCourses.filter(c => c.progress < 100).length === 0 ? (
                    <p className="text-sm font-bold text-gray-400 px-4">No courses currently in progress.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {enrolledCourses.filter(c => c.progress < 100).map((c: any) => (
                        <div key={c.id} className="bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] p-6 shadow-lg hover:shadow-xl transition-all group flex flex-col h-full relative overflow-hidden">

                          {/* RIBBON */}
                          <div className="absolute top-5 -right-8 bg-blue-500 text-white text-[10px] font-black py-1 px-10 rotate-45 uppercase tracking-widest shadow-md z-20">
                            In Progress
                          </div>

                          <div className="h-40 bg-gray-100 rounded-xl mb-6 overflow-hidden relative border border-gray-200">
                            {c.image_url ? <img src={c.image_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><BookOpen size={40} /></div>}



                            {/* FINALIZED INDICATOR */}
                            <div className="absolute bottom-3 left-3">
                              {c.is_finalized ? (
                                <span className="bg-black/80 backdrop-blur-md text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-white/20">Finalized</span>
                              ) : (
                                <span className="bg-white/80 backdrop-blur-md text-gray-600 border border-gray-300 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest">Draft</span>
                              )}
                            </div>
                          </div>

                          <h3 className="text-xl font-black mb-1 leading-tight text-gray-900 tracking-tight pr-8">{c.title}</h3>
                          <div className="mb-4 flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.progress || 0}%` }}></div>
                            </div>
                            <span className="text-[10px] font-black text-blue-600">{c.progress || 0}%</span>
                          </div>

                          <p className="text-sm text-gray-500 font-medium mb-6 line-clamp-2 flex-1">{c.description || "Course description goes here."}</p>

                          <button onClick={() => navigate(`/course/${c.id}/player`)} className="w-full bg-black text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-md">
                            <PlayCircle size={18} /> Resume Journey
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* COMPLETED COURSES SECTION OVERHAUL */}
                <div className="space-y-6">
                  <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <div className="w-2 h-6 bg-blue-600 rounded-full"></div> Completed ({enrolledCourses.filter(c => c.progress === 100).length})
                  </h3>

                  {enrolledCourses.filter(c => c.progress === 100).length === 0 ? (
                    <p className="text-sm font-bold text-gray-400 px-4">No completed courses yet. Keep learning!</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {enrolledCourses.filter(c => c.progress === 100).map((c: any) => (
                        <div key={c.id} className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-[2rem] p-6 shadow-lg hover:shadow-2xl transition-all group flex flex-col h-full relative overflow-hidden">

                          {/* RIBBON */}
                          <div className="absolute top-5 -right-8 bg-gray-200 text-gray-700 text-[10px] font-black py-1 px-10 rotate-45 uppercase tracking-widest shadow-md z-20 border border-gray-300">
                            Completed
                          </div>

                          <div className="h-40 bg-gray-100 rounded-xl mb-6 overflow-hidden relative border border-gray-200">
                            {c.image_url ? <img src={c.image_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Award size={40} /></div>}



                            {/* FINALIZED INDICATOR */}
                            <div className="absolute bottom-3 left-3">
                              {c.is_finalized ? (
                                <span className="bg-white/90 backdrop-blur-md text-blue-600 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border border-gray-200 shadow-sm">Finalized</span>
                              ) : (
                                <span className="bg-gray-100/90 backdrop-blur-md text-gray-500 border border-gray-200 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest">Draft</span>
                              )}
                            </div>
                          </div>

                          <h3 className="text-xl font-black mb-1 leading-tight text-gray-900 tracking-tight pr-8">{c.title}</h3>
                          <div className="mb-4 flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-green-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-green-700" style={{ width: `100%` }}></div>
                            </div>
                            <span className="text-[10px] font-black text-green-700">100% Complete</span>
                          </div>

                          <p className="text-sm text-gray-500 font-medium mb-6 line-clamp-2 flex-1">{c.description || "Course description goes here."}</p>

                          <div className="flex flex-col gap-3">
                            {/* Stars Section */}
                            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex gap-1" title={c.user_rating ? "Your rating" : "Not rated yet"}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star key={star} size={16} className={star <= (c.user_rating || 0) ? "fill-yellow-500 text-yellow-500" : "text-gray-300"} />
                                ))}
                              </div>
                              <button onClick={() => setShowReviewModal(c)} className="text-[10px] font-black bg-white border border-blue-100 text-blue-600 px-4 py-1.5 rounded-lg shadow-sm hover:bg-blue-50 transition-colors uppercase tracking-widest active:scale-95">
                                Rate
                              </button>
                            </div>

                            <div className="flex gap-2">
                              <button onClick={() => navigate(`/course/${c.id}/player`)} className="flex-1 bg-white border border-gray-200 text-gray-700 font-black py-3.5 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm text-sm tracking-tight active:scale-95">
                                Review
                              </button>
                              <button onClick={() => { setActiveTab("certificates"); }} className="flex-[1.5] bg-gray-200 text-gray-700 font-black py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-300 transition-colors shadow-md text-sm tracking-tight active:scale-95 shadow-gray-200/20">
                                <Award size={16} /> Claim Certificate
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </motion.div>
        )}

        {/* TAB: CODE ARENA */}
        {activeTab === "test" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20">
            <div className="mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black mb-2">SkillForge Arena</h2>
                <p className="text-gray-500 font-medium">Proctored challenges and assessments.</p>
              </div>
            </div>

            <div className="space-y-4">
              {codeTests.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] p-12 text-center shadow-sm">
                  <Terminal size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-lg font-bold text-gray-500">No active challenges available right now.</p>
                </div>
              ) : (
                codeTests.map(test => (
                  <div key={test.id} className="bg-white/80 backdrop-blur-xl border border-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black">{test.title}</h3>
                        {test.result_status === "terminated" && <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-1 rounded-md uppercase tracking-widest border border-red-200 shadow-sm">Course Terminated</span>}
                        {test.result_status === "submitted" && <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase tracking-widest border border-green-200 shadow-sm">Test Submitted Successfully</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Clock size={14} /> {test.time_limit} Mins</span>
                        <span className="flex items-center gap-1"><Code size={14} /> Standard</span>
                      </div>
                    </div>
                    <button onClick={() => setShowPassKeyModal(test.id)} className="bg-black text-white px-8 py-3.5 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg whitespace-nowrap">
                      Enter Arena
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* TAB: CERTIFICATES */}
        {activeTab === "certificates" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20">
            <div className="mb-10">
              <h2 className="text-3xl font-black mb-2 tracking-tight">My Certifications</h2>
              <p className="text-gray-500 font-bold">Track your completed courses and claim your rewards.</p>
            </div>

            {enrolledCourses.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] p-12 text-center shadow-sm">
                <Award size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-bold text-gray-500">You haven't enrolled in any courses yet.</p>
              </div>
            ) : (
              <div className="space-y-16">
                
                {/* IN PROGRESS SECTION (TOP) */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest px-2 mb-4">In Progress ({enrolledCourses.filter(c => c.progress < 100).length})</h3>
                  {enrolledCourses.filter(c => c.progress < 100).length === 0 ? (
                    <p className="text-sm font-bold text-gray-400 py-4 px-2">No courses currently in progress.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {enrolledCourses.filter(c => c.progress < 100).map((course: any) => (
                        <div key={course.id} className="bg-white/70 border border-gray-100 rounded-[2rem] p-5 shadow-sm hover:shadow-xl transition-all group flex flex-col h-full relative overflow-hidden">
                          <div className="h-32 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 mb-4 relative shrink-0">
                            {course.image_url ? (
                                <img src={course.image_url} alt={course.title} className="w-full h-full object-cover grayscale-[40%] group-hover:grayscale-0 transition-all" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-200"><BookOpen size={32} /></div>
                            )}
                            <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                          </div>
                          
                          <div className="flex-1 flex flex-col">
                            <h3 className="text-md font-black text-gray-900 tracking-tight mb-3 line-clamp-2 leading-tight h-10">{course.title}</h3>
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-gray-400">Progress</span>
                                    <span className="text-red-500">{course.progress || 0}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${course.progress || 0}%` }} className="h-full bg-red-500 rounded-full" />
                                </div>
                            </div>
                            
                            <button disabled className="mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed">
                              <Lock size={14} /> Locked
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* COMPLETED SECTION (BOTTOM) */}
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 mb-4">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Completed ({enrolledCourses.filter(c => c.progress === 100).length})</h3>
                    
                    {/* SEARCH BAR */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Search certificates..." 
                            value={certSearchQuery}
                            onChange={(e) => setCertSearchQuery(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black transition-all"
                        />
                    </div>
                  </div>

                  {enrolledCourses.filter(c => c.progress === 100).length === 0 ? (
                    <p className="text-sm font-bold text-gray-400 py-4 px-2">No completed courses yet. Keep learning!</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {enrolledCourses
                        .filter(c => c.progress === 100)
                        .filter(c => c.title.toLowerCase().includes(certSearchQuery.toLowerCase()))
                        .map((course: any) => (
                        <div key={course.id} className="bg-white border border-gray-100 rounded-[2rem] p-5 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col h-full relative overflow-hidden">
                          <div className="h-32 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 mb-4 relative shrink-0">
                            {course.image_url ? (
                                <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-200"><BookOpen size={32} /></div>
                            )}
                            <div className="absolute inset-0 bg-green-500/5" />
                          </div>

                          <div className="flex-1 flex flex-col">
                            <h3 className="text-md font-black text-gray-900 tracking-tight mb-3 line-clamp-2 leading-tight h-10">{course.title}</h3>
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-gray-400">Status</span>
                                    <span className="text-green-600">100%</span>
                                </div>
                                <div className="w-full h-1.5 bg-green-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `100%` }} />
                                </div>
                            </div>

                            <button
                              onClick={() => handleDownloadCertificate(course.id, course.title)}
                              className="mt-auto w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20 active:scale-95"
                            >
                              <Unlock size={14} /> Claim Certificate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB: EXPLORE COURSES */}
        {activeTab === "explore" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-20">
            <h2 className="text-3xl font-black mb-2">Explore Catalog</h2>
            <p className="text-gray-500 font-medium mb-8">Browse courses available for your class.</p>
            
            {availableCourses.length === 0 ? (
              <div className="w-full bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                <Compass size={64} className="text-gray-200 mb-4" />
                <h3 className="text-xl font-black text-gray-800 mb-2">No Courses Available</h3>
                <p className="text-gray-500 font-medium max-w-sm">
                  There are currently no new published courses available for your class. Check back later or ask your instructor!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {availableCourses.map(c => (
                  <div key={c.id} className="bg-white/80 backdrop-blur-xl border border-white rounded-[2rem] p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col h-full">
                    <div className="h-40 bg-gray-100 rounded-xl mb-6 overflow-hidden border border-gray-200 flex items-center justify-center text-gray-300">
                      {c.image_url ? <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" /> : <BookOpen size={40} />}
                    </div>
                    <h3 className="text-xl font-black mb-2 leading-tight">{c.title}</h3>
                    <p className="text-xs text-gray-500 font-medium line-clamp-2 mb-6 flex-1">{c.description || "Learn new skills and upgrade your knowledge."}</p>
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
                      <span className="text-xs font-black text-blue-500 uppercase bg-blue-50 px-2 py-1 rounded-md">Class Assigned</span>
                      <button onClick={() => openEnrollModal(c)} className="bg-black text-white font-bold py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors shadow-md active:scale-95 text-xs uppercase tracking-wider">
                        <ShoppingBag size={14} /> Request Enroll
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === "settings" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto pb-20">
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200 overflow-hidden">
              
              {/* Header */}
              <div className="px-8 py-8 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Account Settings</h2>
                <p className="text-slate-500 font-medium mt-1">Manage your public profile and security preferences.</p>
              </div>

              <div className="p-8 md:p-10">
                
                {/* --- PROFILE SECTION --- */}
                <section className="mb-12">
                  <div className="mb-8">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
                      <User size={18} className="text-blue-500" /> Public Profile
                    </h3>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      setSavingProfile(true);
                      const token = localStorage.getItem("token");
                      const res = await axios.put(`${API_BASE_URL}/profile`, {
                        full_name: userProfile.name,
                        profile_pic: userProfile.profile_pic,
                        school_class_id: userProfile.school_class_id,
                        section: userProfile.section
                      }, { headers: { Authorization: `Bearer ${token}` } });
                      setUserProfile({
                        ...res.data,
                        name: res.data.full_name,
                        initials: res.data.full_name.substring(0, 2).toUpperCase()
                      });
                      triggerToast("Profile Updated Successfully!", "success");
                    } catch (err) {
                      triggerToast("Failed to update profile.", "error");
                    } finally {
                      setSavingProfile(false);
                    }
                  }}>
                    
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-6 mb-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                      {userProfile.profile_pic ? (
                        <img src={userProfile.profile_pic} alt="Profile" className="w-20 h-20 rounded-full object-cover shadow-sm border-2 border-white" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-2xl shadow-sm border-2 border-white">{userProfile.initials}</div>
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <label className="text-sm font-bold text-slate-700">Profile Picture</label>
                        <div className="flex flex-col md:flex-row gap-3">
                          <label className="cursor-pointer bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm text-center">
                            <span>Upload Image</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setUserProfile({...userProfile, profile_pic: reader.result as string});
                                reader.readAsDataURL(file);
                              }
                            }} />
                          </label>
                          <input type="text" value={userProfile.profile_pic || ""} onChange={(e) => setUserProfile({...userProfile, profile_pic: e.target.value})} placeholder="Or paste image URL..." className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-all font-medium" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Recommended size: 256x256px. Max size: 2MB.</p>
                      </div>
                    </div>

                    {/* Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                        <input type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                        <input type="email" value={userProfile.email} disabled className="w-full px-4 py-3 bg-slate-100/80 text-slate-400 border border-slate-200 rounded-xl font-bold cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class / Academic Year</label>
                        <div className="relative">
                          <select value={userProfile.school_class_id || ""} onChange={(e) => setUserProfile({...userProfile, school_class_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-900 appearance-none">
                            <option value="">Select your class...</option>
                            {classesList.map(c => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" size={16} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Section / Cohort</label>
                        <input type="text" value={userProfile.section || ""} onChange={(e) => setUserProfile({...userProfile, section: e.target.value})} placeholder="e.g. Section A" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-900" />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button type="submit" disabled={savingProfile} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 flex items-center gap-2">
                        {savingProfile ? "Saving..." : "Save Profile Changes"}
                      </button>
                    </div>
                  </form>
                </section>

                <hr className="border-slate-100 my-10" />

                {/* --- SECURITY SECTION --- */}
                <section>
                  <div className="mb-8">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
                      <Lock size={18} className="text-slate-600" /> Account Security
                    </h3>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      setSavingSettings(true);
                      const token = localStorage.getItem("token");
                      await axios.put(`${API_BASE_URL}/profile/password`, { oldPassword, newPassword }, { headers: { Authorization: `Bearer ${token}` } });
                      triggerToast("Password Updated Successfully!", "success");
                      setOldPassword("");
                      setNewPassword("");
                    } catch (err: any) {
                      triggerToast(err.response?.data?.error || "Failed to update password.", "error");
                    } finally {
                      setSavingSettings(false);
                    }
                  }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current Password</label>
                        <input type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-slate-900 transition-all text-slate-900" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                        <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-slate-900 transition-all text-slate-900" />
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <button type="submit" disabled={savingSettings} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-black/10 disabled:opacity-70 flex items-center gap-2">
                        {savingSettings ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                </section>

              </div>
            </div>
          </motion.div>
        )}

        {/* TAB: MEETINGS / CALENDAR */}
        {activeTab === "meetings" && (
            <StudentMeetings />
        )}

      </main>

      {/* ============================================================================
          MODALS & TOASTS
      ============================================================================ */}

      {/* PassKey Modal */}
      <AnimatePresence>
        {showPassKeyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white p-10 rounded-[2rem] w-full max-w-md shadow-2xl text-center border border-gray-100">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={24} className="text-black" /></div>
              <h3 className="text-2xl font-black mb-2">Arena Access Key</h3>
              <p className="text-gray-500 text-sm font-medium mb-8">This assessment is protected. Enter the key provided by your instructor.</p>
              <input type="password" value={passKeyInput} onChange={e => setPassKeyInput(e.target.value)} placeholder="Enter key..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-center font-mono text-xl tracking-widest font-bold focus:outline-none focus:border-black mb-6" />
              <div className="flex gap-3">
                <button onClick={() => setShowPassKeyModal(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button onClick={handleStartTest} className="flex-1 py-4 bg-black text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-colors">Verify & Start</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enrollment Modal */}
      <AnimatePresence>
        {showModal && selectedCourse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-gray-100 relative">
              <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-600" /></button>

              <h2 className="text-3xl font-black mb-2 pr-10">{selectedCourse.title}</h2>
              <p className="text-gray-500 font-medium mb-8">Submit a request to your staff to get access to this course.</p>

              <button onClick={handleEnrollRequest} disabled={processing} className="w-full py-4 bg-black hover:bg-gray-800 text-white rounded-xl font-bold shadow-lg shadow-black/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                {processing ? "Sending Request..." : "Send Enroll Request"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl border border-gray-100 relative">
              <button onClick={() => { setShowReviewModal(null); setReviewRating(0); setReviewFeedback(""); }} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-600" /></button>
              
              <div className="w-16 h-16 bg-yellow-50 rounded-2xl border border-yellow-100 flex items-center justify-center mb-6 shadow-sm">
                <Star size={32} className="text-yellow-500 fill-yellow-500" />
              </div>

              <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight pr-8 mb-2">Rate {showReviewModal.title}</h3>
              <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed">Your feedback helps instructors improve and helps other students make decisions.</p>

              <div className="flex justify-center gap-3 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-inner">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setReviewRating(star)} className="group relative outline-none focus:outline-none">
                    <Star size={44} className={`transition-all duration-300 ${star <= reviewRating ? "text-yellow-400 fill-yellow-400 scale-110 drop-shadow-md" : "text-gray-300 hover:text-yellow-300"}`} />
                  </button>
                ))}
              </div>

              <div className="mb-8">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Feedback (Optional)</label>
                <textarea value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)} placeholder="What did you like or dislike? Write your review here..." rows={4} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all resize-none shadow-sm"></textarea>
              </div>

              <button onClick={handleSubmitReview} disabled={submittingReview} className="w-full py-4 bg-black text-white font-black rounded-xl hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-70 flex items-center justify-center gap-2 uppercase tracking-widest text-sm active:scale-95">
                {submittingReview ? "Submitting..." : "Submit Feedback"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GLASSMORPHIC TOAST */}
      <GlassToast toast={{ show: toast.show, msg: toast.message || '', type: toast.type as "success" | "error", id: 0 }} />

    </div>
  );
};

export default StudentDashboard;