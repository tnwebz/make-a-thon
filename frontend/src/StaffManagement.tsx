import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "./config";
import { PlusCircle, UserPlus, Shield } from "lucide-react";

interface Staff {
  id: number;
  full_name: string;
  email: string;
  status: string;
  createdAt: string;
}

const StaffManagement = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ full_name: "", email: "", password: "" });

  const fetchStaff = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE_URL}/admin/staff`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(res.data);
    } catch (error) {
      console.error("Error fetching staff", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const toggleSuspend = async (staffMember: Staff) => {
    try {
      const token = localStorage.getItem("token");
      const newStatus = staffMember.status === "Active" ? "Suspended" : "Active";
      await axios.patch(`${API_BASE_URL}/admin/staff/${staffMember.id}/status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(staff.map(s => s.id === staffMember.id ? { ...s, status: newStatus } : s));
    } catch (error) {
      console.error("Error updating status", error);
      alert("Failed to update staff status.");
    }
  };

  const deleteStaff = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this staff member? This action cannot be undone.")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/admin/staff/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(staff.filter(s => s.id !== id));
    } catch (error) {
      console.error("Error deleting staff", error);
      alert("Failed to delete staff.");
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_BASE_URL}/admin/staff`, newStaff, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddModal(false);
      setNewStaff({ full_name: "", email: "", password: "" });
      fetchStaff();
      alert("Staff created successfully! Credentials sent to email.");
    } catch (error: any) {
      console.error("Error creating staff", error);
      alert(error.response?.data?.detail || "Failed to create staff.");
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading staff...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto animation-fadeIn">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 m-0">Staff Management</h2>
          <p className="text-slate-500 m-0 mt-1">Onboard and manage school instructors and staff.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition-colors"
        >
          <UserPlus size={18} /> Onboard Staff
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Staff Name</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Email</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Role</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Joined At</th>
              <th className="p-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">No staff found.</td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-slate-800 font-medium">{member.full_name}</td>
                  <td className="p-4 text-slate-600">{member.email}</td>
                  <td className="p-4">
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-600 rounded max-w-max">
                      <Shield size={12} /> Staff
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${member.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {member.status || "Active"}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 text-sm">{new Date(member.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => toggleSuspend(member)} 
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                          member.status === 'Active' 
                            ? 'text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100' 
                            : 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        {member.status === "Active" ? "Suspend" : "Activate"}
                      </button>
                      <button 
                        onClick={() => deleteStaff(member.id)} 
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Onboard Staff</h3>
            <form onSubmit={handleAddStaff} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1e293b]"
                  placeholder="Staff Name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1e293b]"
                  placeholder="Email"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Initial Password (Optional)</label>
                <input
                  type="text"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1e293b]"
                  placeholder="Leave empty to auto-generate"
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
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
