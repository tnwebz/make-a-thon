import React, { useState, useEffect } from "react";
import axios from "axios";
import { Users, BookOpen, ShieldCheck, Activity, ArrowRight, UserPlus, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const AdminOverview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ students: 0, classes: 0, staff: 0 });
  const [loading, setLoading] = useState(true);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);

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

        const students = resStudents.data;
        const classes = resClasses.data;
        const staff = resStaff.data;

        setStats({
          students: students.length || 0,
          classes: classes.length || 0,
          staff: staff.length || 0
        });

        // 1. Process Chart Data (Students by Class)
        const classMap: Record<string, number> = {};
        classes.forEach((c: any) => { classMap[c.name] = 0; });
        students.forEach((s: any) => {
          const className = s.school_class || "Unassigned";
          if (classMap[className] !== undefined) {
             classMap[className]++;
          } else {
             classMap[className] = 1;
          }
        });
        
        const cData = Object.keys(classMap).map(key => ({
            name: key,
            students: classMap[key]
        }));
        // Sort alphabetically
        cData.sort((a, b) => a.name.localeCompare(b.name));
        setChartData(cData);

        // 2. Process Recent Activity (Last 5 joined students)
        const sortedStudents = [...students].sort((a: any, b: any) => {
            return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
        });
        setRecentStudents(sortedStudents.slice(0, 4));

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto pb-20 mt-4">
      <div className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
          <Activity size={32} className="text-blue-500" /> System Analytics
        </h1>
        <p className="text-slate-500 font-bold mt-2">Here is the real-time pulse of your academy today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {statCards.map((card, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={card.label} 
            className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200"
          >
            <div className={`w-14 h-14 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center mb-6`}>
              <card.icon size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</h3>
            <p className="text-5xl font-black text-slate-900">
              {loading ? "..." : card.value}
            </p>
          </motion.div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART SECTION */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm flex flex-col min-h-[400px]">
           <h2 className="text-xl font-black text-slate-900 mb-2">Student Distribution</h2>
           <p className="text-sm text-slate-500 font-medium mb-8">Number of active students enrolled in each school class.</p>
           
           <div className="flex-1 w-full relative">
             {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold">Loading chart data...</div>
             ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                    <Tooltip 
                        cursor={{fill: '#f1f5f9'}}
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold'}}
                        labelStyle={{color: '#64748b', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase'}}
                    />
                    <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#3b82f6" : "#0ea5e9"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             )}
           </div>
        </div>

        {/* SIDEBAR SECTION */}
        <div className="flex flex-col gap-6">
            
            {/* QUICK ACTIONS */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-xl text-white">
                <h3 className="text-lg font-black mb-6">Quick Actions</h3>
                <div className="space-y-3">
                    <button onClick={() => navigate('/admin/students')} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                            <UserPlus size={18} className="text-blue-400" />
                            <span className="font-bold text-sm">Add Student</span>
                        </div>
                        <ArrowRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                    <button onClick={() => navigate('/admin/classes')} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                            <PlusCircle size={18} className="text-emerald-400" />
                            <span className="font-bold text-sm">Create Class</span>
                        </div>
                        <ArrowRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                    <button onClick={() => navigate('/admin/staff')} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={18} className="text-purple-400" />
                            <span className="font-bold text-sm">Manage Staff</span>
                        </div>
                        <ArrowRight size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                    </button>
                </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm flex-1">
                <h3 className="text-lg font-black text-slate-900 mb-6">Recent Joinees</h3>
                
                {loading ? (
                    <div className="text-sm font-bold text-slate-400">Loading activity...</div>
                ) : recentStudents.length > 0 ? (
                    <div className="space-y-6">
                        {recentStudents.map((student, idx) => (
                            <div key={idx} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 shrink-0">
                                    {student.full_name ? student.full_name.substring(0,2).toUpperCase() : "ST"}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-slate-900 leading-tight truncate max-w-[150px]">{student.full_name}</p>
                                    <p className="text-xs font-medium text-slate-500 mt-0.5">Joined {student.joined_at}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm font-bold text-slate-400">No students found.</div>
                )}
            </div>

        </div>

      </div>
    </div>
  );
};

export default AdminOverview;
