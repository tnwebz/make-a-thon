import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import AdminLogin from "./AdminLogin";
import Login from "./Login";
import LandingPage from "./LandingPage";
import DashboardLayout from "./DashboardLayout";
import CreateCourse from "./CreateCourse";
import CourseBuilder from "./CourseBuilder";
import AssignmentManager from "./AssignmentManager";
import StudentDashboard from "./StudentDashboard";
import CoursePlayer from "./CoursePlayer";
import AddAdmits from "./AddAdmits";
import CoursePreview from "./CoursePreview";
import CodeArena from "./CodeArena";
import Dashboard from "./Dashboard";
import InstructorSettings from "./InstructorSettings";
import StudentManagement from "./StudentManagement";
import CourseList from "./CourseList";
import InstructorBatches from "./InstructorBatches";
import MeetingManager from "./MeetingManager";
import AdminDashboardLayout from "./AdminDashboardLayout";
import ClassManagement from "./ClassManagement";
import StaffManagement from "./StaffManagement";
import AdminOverview from "./AdminOverview";
import ShareHub from "./ShareHub";
import InstructorShareHub from "./InstructorShareHub";
import ShareAccess from "./ShareAccess";
import SharedCourseViewer from "./SharedCourseViewer";
import OfflineCoursePlayer from "./OfflineCoursePlayer";

import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";

function App() {
  useEffect(() => {
    if (!navigator.onLine && !window.location.pathname.startsWith("/offline-player") && !window.location.pathname.startsWith("/share")) {
      window.location.replace("/offline.html");
    }
  }, []);

  return (
    <Router>
      <PwaInstallPrompt />
      <PwaUpdatePrompt />
      <NetworkStatusBanner />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* PUBLIC OFFLINE SHARE ACCESS & COURSE VIEWER ROUTES */}
        <Route path="/share/:shareCode" element={<ShareAccess />} />
        <Route path="/share/:shareCode/course" element={<SharedCourseViewer />} />

        {/* STANDALONE OFFLINE PWA COURSE PLAYER (DRAG & DROP ZIP IMPORTER) */}
        <Route path="/offline-player" element={<OfflineCoursePlayer />} />

        {/* ADMIN ROUTES */}
        <Route path="/admin-dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboardLayout /></ProtectedRoute>}>
          <Route index element={<AdminOverview />} />
          <Route path="classes" element={<ClassManagement />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="staff" element={<StaffManagement />} />
        </Route>

        {/* INSTRUCTOR ROUTES */}
        <Route path="/dashboard" element={<ProtectedRoute requiredRole="instructor"><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="courses" element={<CourseList />} />
          <Route path="batches" element={<InstructorBatches />} />
          <Route path="create-course" element={<CreateCourse />} />
          <Route path="course/:courseId/builder" element={<CourseBuilder />} />
          <Route path="assignments" element={<AssignmentManager />} />
          <Route path="meetings" element={<MeetingManager />} />
          <Route path="add-admits" element={<AddAdmits />} />
          <Route path="course/:courseId/preview" element={<CoursePreview />} />
          <Route path="share-hub/:courseId" element={<InstructorShareHub />} />
          <Route path="code-arena" element={<CodeArena />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="settings" element={<InstructorSettings />} />
        </Route>

        <Route path="/student-dashboard" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
        <Route path="/course/:courseId/player" element={<ProtectedRoute requiredRole="student"><CoursePlayer /></ProtectedRoute>} />
        <Route path="/share-hub" element={<ProtectedRoute requiredRole="student"><ShareHub /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

const ProtectedRoute = ({ children, requiredRole }: { children: any, requiredRole?: string }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) { 
    if (role === "admin") return <Navigate to="/admin-dashboard" replace />;
    if (role === "instructor") return <Navigate to="/dashboard" replace />;
    return <Navigate to="/student-dashboard" replace />; 
  }
  return children;
};

export default App;