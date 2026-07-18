import React, { useState, useEffect } from "react";
import axios from "axios";
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";
import { PlusCircle, Search } from "lucide-react";

interface SchoolClass {
  id: number;
  name: string;
  academic_year: string;
  createdAt: string;
}

const ClassManagement = () => {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClass, setNewClass] = useState({ name: "", academic_year: "" });

  const fetchClasses = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/admin/classes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClasses(res.data);
    } catch (error) {
      console.error("Error fetching classes", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/admin/classes`, newClass, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddModal(false);
      setNewClass({ name: "", academic_year: "" });
      fetchClasses();
    } catch (error) {
      console.error("Error creating class", error);
      alert("Failed to create class.");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading classes...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto animation-fadeIn">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 m-0">Class Management</h2>
          <p className="text-slate-500 m-0 mt-1">Manage standard classes and academic years.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
        >
          <PlusCircle size={18} /> Add Class
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Class Name</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Academic Year</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Created At</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500">No classes found.</td>
              </tr>
            ) : (
              classes.map((cls) => (
                <tr key={cls.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-800 font-medium">{cls.name}</td>
                  <td className="p-4 text-slate-600">{cls.academic_year}</td>
                  <td className="p-4 text-slate-500 text-sm">{new Date(cls.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Create New Class</h3>
            <form onSubmit={handleAddClass} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Class Name (e.g., Form 1, Class 10)</label>
                <input
                  type="text"
                  required
                  value={newClass.name}
                  onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1e293b]"
                  placeholder="Class Name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  required
                  value={newClass.academic_year}
                  onChange={(e) => setNewClass({ ...newClass, academic_year: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1e293b]"
                  placeholder="e.g., 2024-2025"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1e293b] text-white font-semibold rounded-lg hover:bg-slate-800"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassManagement;
