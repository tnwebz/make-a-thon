import React, { useState, useEffect } from "react";
import axios from "axios";
import { PlusCircle, Search, Edit2, Trash2, BookOpen } from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

interface SchoolClass {
  id: number;
  name: string;
  academic_year: string;
  createdAt: string;
}

const ClassManagement = () => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeClass, setActiveClass] = useState<SchoolClass | null>(null);

  const [formData, setFormData] = useState({ name: "", academic_year: "" });

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [classRes, studentRes] = await Promise.all([
         axios.get(`${API_BASE_URL}/admin/classes`, config),
         axios.get(`${API_BASE_URL}/admin/students`, config)
      ]);
      
      setClasses(classRes.data);
      
      // Calculate student counts
      const counts: Record<string, number> = {};
      studentRes.data.forEach((s: any) => {
         const cName = s.school_class;
         if (cName) {
            counts[cName] = (counts[cName] || 0) + 1;
         }
      });
      setStudentCounts(counts);

    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/admin/classes`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddModal(false);
      setFormData({ name: "", academic_year: "" });
      fetchData();
    } catch (error) {
      console.error("Error creating class", error);
      alert("Failed to create class.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass) return;
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/admin/classes/${activeClass.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowEditModal(false);
      setActiveClass(null);
      setFormData({ name: "", academic_year: "" });
      fetchData();
    } catch (error) {
      console.error("Error updating class", error);
      alert("Failed to update class.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this class? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/admin/classes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting class", error);
      alert("Failed to delete class.");
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.academic_year.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto p-8 pb-20 mt-4">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
             <BookOpen size={28} className="text-emerald-500" /> Class Management
          </h1>
          <p className="text-slate-500 font-medium mt-2">Create, edit, and organize academic classes.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search classes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium w-64 shadow-sm"
            />
          </div>
          <button
            onClick={() => { setFormData({ name: "", academic_year: "" }); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <PlusCircle size={18} /> Add Class
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-5 font-black text-slate-400 text-xs uppercase tracking-wider">Class Name</th>
                <th className="p-5 font-black text-slate-400 text-xs uppercase tracking-wider">Academic Year</th>
                <th className="p-5 font-black text-slate-400 text-xs uppercase tracking-wider">Students Enrolled</th>
                <th className="p-5 font-black text-slate-400 text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">Loading classes...</td>
                </tr>
              ) : filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                     <div className="flex flex-col items-center justify-center text-slate-400">
                        <BookOpen size={48} className="mb-4 text-slate-200" />
                        <p className="font-bold text-lg text-slate-600">No classes found.</p>
                        <p className="text-sm mt-1">Try adjusting your search or add a new class.</p>
                     </div>
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls) => (
                  <tr key={cls.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                    <td className="p-5">
                       <div className="font-black text-slate-900">{cls.name}</div>
                       <div className="text-xs text-slate-400 font-medium mt-0.5">Created {new Date(cls.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="p-5">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">{cls.academic_year}</span>
                    </td>
                    <td className="p-5">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-sm">
                                {studentCounts[cls.name] || 0}
                            </div>
                            <span className="text-sm font-medium text-slate-500">Active</span>
                        </div>
                    </td>
                    <td className="p-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => { 
                                    setActiveClass(cls); 
                                    setFormData({ name: cls.name, academic_year: cls.academic_year });
                                    setShowEditModal(true); 
                                }}
                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Class"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button 
                                onClick={() => handleDelete(cls.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Class"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900 mb-6">Create New Class</h3>
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class Name</label>
                <input
                  type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-emerald-500 transition-all text-slate-900"
                  placeholder="e.g. Class 10"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Year</label>
                <input
                  type="text" required value={formData.academic_year} onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-emerald-500 transition-all text-slate-900"
                  placeholder="e.g., 2024-2025"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">Create Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900 mb-6">Edit Class</h3>
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class Name</label>
                <input
                  type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Year</label>
                <input
                  type="text" required value={formData.academic_year} onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
