import { useState, useRef, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
    LayoutDashboard, BookOpen, Users, LogOut,
    ChevronDown, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_BASE_URL } from "./config";

function useOnClickOutside(ref: any, handler: any) {
    useEffect(() => {
        const listener = (event: any) => {
            if (!ref.current || ref.current.contains(event.target)) return;
            handler(event);
        };
        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);
        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, [ref, handler]);
}

const AdminDashboardLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showProfile, setShowProfile] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const [userData, setUserData] = useState({ name: "Admin", email: "..." });

    useOnClickOutside(profileRef, () => setShowProfile(false));

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await axios.get(`${API_BASE_URL}/user/me`, { headers: { Authorization: `Bearer ${token}` } });
            setUserData({
                name: res.data.full_name || "Admin",
                email: res.data.email || ""
            });
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const navItems = [
        { name: "Overview", path: "/admin-dashboard", icon: LayoutDashboard },
        { name: "Classes", path: "/admin-dashboard/classes", icon: BookOpen },
        { name: "Students", path: "/admin-dashboard/students", icon: Users },
        { name: "Staff", path: "/admin-dashboard/staff", icon: Users },
    ];

    const handleLogout = () => {
        localStorage.clear();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-black selection:text-white relative pb-20">
            {/* 🎨 THEME: Abstract Black/White/Gray Gradient Mesh */}
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-white rounded-full blur-[120px] pointer-events-none opacity-90 z-[-1]" />
            <div className="fixed bottom-[-10%] right-[-5%] w-[60%] h-[60%] bg-slate-200/50 rounded-full blur-[150px] pointer-events-none z-[-1]" />
            <div className="fixed top-[20%] right-[20%] w-[30%] h-[30%] bg-gray-300/30 rounded-full blur-[100px] pointer-events-none z-[-1]" />

            {/* 🚀 TOP NAVIGATION BAR */}
            <nav className="sticky top-0 z-50 px-4 md:px-8 py-4">
                <div className="max-w-[1600px] mx-auto bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex items-center justify-between px-6 py-3">

                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-md">
                            <Zap size={20} className="text-white fill-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter text-black">SkillForge<span className="text-gray-400">.</span></span>
                    </div>

                    {/* Horizontal Links */}
                    <div className="hidden lg:flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path || (item.path !== '/admin-dashboard' && location.pathname.startsWith(item.path));
                            return (
                                <button key={item.name} onClick={() => navigate(item.path)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${isActive ? 'bg-white text-black shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-black hover:bg-white/50'}`}
                                >
                                    <item.icon size={16} /> {item.name}
                                </button>
                            );
                        })}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4 relative">
                        {/* PROFILE MENU */}
                        <div ref={profileRef} className="relative">
                            <button onClick={() => setShowProfile(!showProfile)} className="flex items-center gap-3 group p-1 pr-3 rounded-full hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200">
                                <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=SkillForgeAdmin&backgroundColor=e2e8f0`} alt="avatar" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-left hidden sm:block">
                                    <p className="text-xs font-black text-black leading-none mb-0.5">{userData.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Admin Panel</p>
                                </div>
                                <ChevronDown size={14} className="text-slate-400 group-hover:text-black transition-colors" />
                            </button>

                            <AnimatePresence>
                                {showProfile && (
                                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute top-14 right-0 w-64 bg-white/90 backdrop-blur-2xl border border-slate-200/60 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-3 z-50"
                                    >
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                                            <p className="font-black text-sm text-black">{userData.email}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Super Admin</p>
                                        </div>
                                        <div className="h-px w-full bg-slate-100 my-1"></div>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                            <LogOut size={16} /> Secure Logout
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </nav>

            {/* 📄 MAIN CONTENT AREA */}
            <main className="w-full max-w-[1600px] mx-auto pt-4 px-4 md:px-8">
                <Outlet />
            </main>
        </div>
    );
};

export default AdminDashboardLayout;
