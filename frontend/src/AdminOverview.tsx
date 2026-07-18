import React, { useState, useEffect } from "react";
import axios from "axios";
import { Users, BookOpen, ShieldCheck, Activity } from "lucide-react";
import { motion } from "framer-motion";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const AdminOverview = () => {
  const [stats, setStats] = useState({ students: 0, classes: 0, staff: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [resStudents, resClasses, resStaff] = await Promise.all([
          axios.get(`${API_BASE_URL}/admin/students`, config),
          axios.get(`${API_BASE_URL}/admin/classes`, config),
          axios.get(`${API_BASE_URL}/admin/staff`, config)
        ]);
        setStats({
          students: resStudents.data.length || 0,
          classes: resClasses.data.length || 0,
          staff: resStaff.data.length || 0
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Active Students", value: stats.students, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "School Classes", value: stats.classes, icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Staff Members", value: stats.staff, icon: ShieldCheck, color: "text-purple-500", bg: "bg-purple-50" }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
          <Activity size={32} className="text-slate-400" /> System Overview
        </h1>
        <p className="text-slate-500 font-bold mt-2">Here is the pulse of your academy today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {statCards.map((card, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={card.label} 
            className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
          >
            <div className={`w-12 h-12 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center mb-6`}>
              <card.icon size={24} strokeWidth={2.5} />
            </div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</h3>
            <p className="text-5xl font-black text-slate-900">
              {loading ? "..." : card.value}
            </p>
          </motion.div>
        ))}
      </div>
      
      <div className="bg-black text-white rounded-[2rem] p-10 flex items-center justify-between shadow-xl">
        <div>
           <h2 className="text-2xl font-black mb-2">Ready to onboard?</h2>
           <p className="text-slate-400 font-medium max-w-md">Manage your school infrastructure, enroll new students, or deploy new courses via staff members.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
