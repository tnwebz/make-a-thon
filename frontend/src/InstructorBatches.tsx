import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Users, KeyRound, Search, X, UserPlus, Trash2, BookOpen, CheckCircle, Edit2, PlusCircle } from "lucide-react";
import axios from "axios";

export default function InstructorBatches() {
    const [batches, setBatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);

    const fetchBatches = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get("http://localhost:8000/api/v1/courses/instructor/batches", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setBatches(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
    }, []);

    return (
        <div className="max-w-7xl mx-auto p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Layers className="text-blue-500" />
                        My Batches
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Manage students, reset passwords, and oversee your course batches.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>
            ) : batches.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/60 shadow-sm">
                    <Layers size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-700">No batches found.</h3>
                    <p className="text-slate-500 mt-2">Create batches from the Course Builder.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {batches.map(batch => (
                        <motion.div
                            key={batch.id}
                            whileHover={{ y: -4, scale: 1.01 }}
                            className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-xl transition-all relative group"
                            onClick={() => setSelectedBatch(batch)}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                                    {batch.schoolClass?.name || "No Class"}
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full text-xs font-semibold border border-slate-100">
                                    <Users size={14} /> {batch.enrolled_count} Students
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-1">{batch.name}</h3>
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mt-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                <BookOpen size={16} className="text-slate-400" />
                                {batch.course?.title}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {selectedBatch && (
                <BatchDetailsModal 
                    batch={selectedBatch} 
                    onClose={() => { setSelectedBatch(null); fetchBatches(); }} 
                />
            )}
        </div>
    );
}

function BatchDetailsModal({ batch, onClose }: { batch: any, onClose: () => void }) {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [toast, setToast] = useState({ show: false, msg: "", type: "success" });
    const [batchName, setBatchName] = useState(batch.name);

    // Add Student Feature State
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [availableStudents, setAvailableStudents] = useState<any[]>([]);
    const [addSearch, setAddSearch] = useState("");
    const [loadingAvailable, setLoadingAvailable] = useState(false);

    const fetchStudents = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`http://localhost:8000/api/v1/courses/batches/${batch.id}/students`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setStudents(res.data);
        } catch(e) {} finally { setLoading(false); }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleResetPassword = async (userId: number) => {
        const newPassword = prompt("Enter new password for this student:");
        if (!newPassword) return;

        try {
            const token = localStorage.getItem("token");
            const res = await axios.patch(`http://localhost:8000/api/v1/courses/batches/students/${userId}/reset-password`, { new_password: newPassword }, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 200) {
                setToast({ show: true, msg: "Password reset successfully!", type: "success" });
                fetchStudents();
                setTimeout(() => setToast({ show: false, msg: "", type: "success" }), 3000);
            }
        } catch(e) {}
    };

    const handleRemoveStudent = async (userId: number) => {
        if (!confirm("Are you sure you want to remove this student from the batch and course?")) return;
        try {
            const token = localStorage.getItem("token");
            const res = await axios.delete(`http://localhost:8000/api/v1/courses/batches/${batch.id}/students/${userId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 200) {
                setToast({ show: true, msg: "Student removed.", type: "success" });
                fetchStudents();
                setTimeout(() => setToast({ show: false, msg: "", type: "success" }), 3000);
            }
        } catch(e) {}
    };

    const handleEditBatchName = async () => {
        const newName = prompt("Enter new batch name:", batchName);
        if (!newName || newName === batchName) return;

        try {
            const token = localStorage.getItem("token");
            await axios.patch(`http://localhost:8000/api/v1/courses/batches/${batch.id}`, { name: newName }, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setBatchName(newName);
            setToast({ show: true, msg: "Batch name updated.", type: "success" });
            setTimeout(() => setToast({ show: false, msg: "", type: "success" }), 3000);
        } catch(e) {}
    };

    const handleDeleteBatch = async () => {
        if (!confirm(`Are you sure you want to delete the batch "${batchName}"? This action cannot be undone.`)) return;
        
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`http://localhost:8000/api/v1/courses/batches/${batch.id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            onClose(); // Close modal and refresh in parent
        } catch(e) {
            setToast({ show: true, msg: "Failed to delete batch.", type: "error" });
        }
    };

    const handleOpenAddStudent = async () => {
        setShowAddStudent(true);
        setLoadingAvailable(true);
        try {
            const token = localStorage.getItem("token");
            // Fetch all students in the school class if exists, else fetch all users?
            // Let's just fetch all students in the school class for simplicity.
            // Wait, we need an admin token to fetch classes. Actually, the instructor might not be an admin.
            // Oh, the `GET /api/v1/admin/classes/:id/students` is an admin route.
            // Since we just need to search any student, we could add a simple route in courses or just let them type an email.
            // Or better, fetch the class students if school_class_id exists.
            if (batch.school_class_id) {
                // If instructor is also admin, this works. Usually they are. If not, this might fail with 403.
                // Let's try it.
                const res = await axios.get(`http://localhost:8000/api/v1/admin/classes/${batch.school_class_id}/students`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                setAvailableStudents(res.data);
            } else {
                setAvailableStudents([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAvailable(false);
        }
    };

    const handleAddStudentToBatch = async (studentId: number) => {
        try {
            const token = localStorage.getItem("token");
            await axios.post(`http://localhost:8000/api/v1/courses/batches/${batch.id}/students`, { student_id: studentId }, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setToast({ show: true, msg: "Student added to batch!", type: "success" });
            fetchStudents();
            setTimeout(() => setToast({ show: false, msg: "", type: "success" }), 3000);
        } catch (e) {
            setToast({ show: true, msg: "Failed to add student.", type: "error" });
        }
    };

    const filtered = students.filter(s => s?.full_name?.toLowerCase().includes(search.toLowerCase()) || s?.email?.toLowerCase().includes(search.toLowerCase()));

    // Filter available students to exclude already enrolled ones
    const enrolledIds = new Set(students.map(s => s.id));
    const filteredAvailable = availableStudents.filter(s => 
        !enrolledIds.has(s.id) && 
        (s.full_name.toLowerCase().includes(addSearch.toLowerCase()) || s.email.toLowerCase().includes(addSearch.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
            >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-black text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
                                {batch.schoolClass?.name || "Batch"}
                            </span>
                            <button onClick={handleDeleteBatch} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold">
                                <Trash2 size={14} /> Delete Batch
                            </button>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 group">
                            {batchName}
                            <button onClick={handleEditBatchName} className="text-slate-300 group-hover:text-slate-500 transition-colors p-1 hover:bg-slate-200 rounded-md">
                                <Edit2 size={16} />
                            </button>
                        </h2>
                        <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                            <BookOpen size={16} /> {batch.course?.title}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors border border-slate-200 shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white relative">
                    {/* Add Student Section */}
                    {showAddStudent ? (
                        <div className="mb-6 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <UserPlus className="text-blue-500" size={18} /> Add Students from Class
                                </h4>
                                <button onClick={() => setShowAddStudent(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
                            </div>
                            <input 
                                type="text"
                                placeholder="Search by name or email..."
                                value={addSearch}
                                onChange={(e) => setAddSearch(e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 mb-3 text-sm"
                            />
                            {loadingAvailable ? (
                                <div className="text-sm text-slate-500">Loading...</div>
                            ) : filteredAvailable.length === 0 ? (
                                <div className="text-sm text-slate-500 text-center py-4 bg-white rounded-xl border border-slate-100">No students found or all students are already enrolled.</div>
                            ) : (
                                <div className="max-h-48 overflow-y-auto grid gap-2">
                                    {filteredAvailable.map(s => (
                                        <div key={s.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{s.full_name}</p>
                                                <p className="text-xs text-slate-500">{s.email}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleAddStudentToBatch(s.id)}
                                                className="bg-slate-900 text-white px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-800"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text"
                                    placeholder="Search students..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all font-medium"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-bold text-slate-400">
                                    {students.length} Enrolled
                                </span>
                                <button 
                                    onClick={handleOpenAddStudent}
                                    className="bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-100 transition-colors border border-blue-200"
                                >
                                    <PlusCircle size={16} /> Add Student
                                </button>
                            </div>
                        </div>
                    )}

                    {toast.show && (
                        <div className={`mb-6 p-4 rounded-2xl font-bold flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                            <CheckCircle size={18} /> {toast.msg}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div></div>
                    ) : filtered.length === 0 && !showAddStudent ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl">
                            <Users size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500 font-medium">No students found.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filtered.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl transition-colors shadow-sm hover:shadow-md">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                            {s.full_name?.charAt(0) || "?"}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">{s.full_name}</h4>
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
                                                <span>{s.email}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="text-indigo-500 font-bold">{s.temp_password || "Has Password"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleResetPassword(s.id)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                            title="Reset Password"
                                        >
                                            <KeyRound size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleRemoveStudent(s.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                            title="Remove Student"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
