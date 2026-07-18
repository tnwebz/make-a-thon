import { useState, useEffect } from "react";
import axios from "axios";
import { Users, CheckCircle, Search, UserPlus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BatchManagementTab({ courseId, triggerToast }: { courseId: string, triggerToast: (msg: string, type: "success" | "error") => void }) {
    const [batches, setBatches] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    
    // Filters
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
    const [newBatchName, setNewBatchName] = useState("");
    const [loadingBatches, setLoadingBatches] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    
    // Add student form modal
    const [showAddForm, setShowAddForm] = useState(false);
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentEmail, setNewStudentEmail] = useState("");
    const [newStudentPassword, setNewStudentPassword] = useState("");
    const [newStudentSection, setNewStudentSection] = useState("");
    
    useEffect(() => {
        fetchBatches();
        fetchClasses();
    }, [courseId]);

    useEffect(() => {
        if (selectedClassId) fetchStudents(selectedClassId, selectedSection);
        else setStudents([]);
    }, [selectedClassId, selectedSection]);

    const fetchBatches = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`http://localhost:8000/api/v1/courses/${courseId}/batches`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBatches(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingBatches(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get(`http://localhost:8000/api/v1/admin/classes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setClasses(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchStudents = async (classId: string, section: string) => {
        setLoadingStudents(true);
        try {
            const token = localStorage.getItem("token");
            let url = `http://localhost:8000/api/v1/admin/classes/${classId}/students`;
            if (section) url += `?section=${section}`;
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
            setStudents(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleCreateBatch = async () => {
        if (!newBatchName.trim()) return triggerToast("Batch name is required", "error");
        if (!selectedClassId) return triggerToast("Please select a target class", "error");

        try {
            const token = localStorage.getItem("token");
            await axios.post(`http://localhost:8000/api/v1/courses/${courseId}/batches`, {
                name: newBatchName,
                school_class_id: selectedClassId,
                student_ids: Array.from(selectedStudentIds)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            triggerToast("Batch created successfully!", "success");
            setNewBatchName("");
            setSelectedClassId("");
            setSelectedSection("");
            setSelectedStudentIds(new Set());
            fetchBatches();
        } catch (e: any) {
            triggerToast(e.response?.data?.detail || "Failed to create batch", "error");
        }
    };

    const handleToggleStudent = (id: number) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedStudentIds.size === students.length) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(students.map(s => s.id)));
        }
    };

    const handleAddNewStudent = async () => {
        if (!newStudentName || !newStudentEmail || !newStudentPassword) {
            return triggerToast("Name, email and password are required", "error");
        }
        try {
            const token = localStorage.getItem("token");
            const res = await axios.post("http://localhost:8000/api/v1/admin/admit-student", {
                full_name: newStudentName,
                email: newStudentEmail,
                password: newStudentPassword,
                school_class_id: selectedClassId,
                section: newStudentSection || selectedSection,
                course_ids: []
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            triggerToast("Student created successfully!", "success");
            setNewStudentName("");
            setNewStudentEmail("");
            setNewStudentPassword("");
            setShowAddForm(false);
            
            // Optionally auto select this new student by fetching again
            fetchStudents(selectedClassId, selectedSection);
        } catch (e) {
            triggerToast("Failed to create student", "error");
        }
    };

    // Calculate unique years
    const availableYears = Array.from(new Set(classes.map(c => c.academic_year))).sort();
    
    // Filter classes based on selected year
    const filteredClasses = selectedYear ? classes.filter(c => c.academic_year === selectedYear) : classes;

    // Hardcoded sections
    const sections = ["A", "B", "C", "D", "E", "F"];

    return (
        <div className="animate-in fade-in duration-500 pb-20">
            <h2 className="text-4xl font-black text-slate-900 mb-2">Batch Management</h2>
            <p className="text-slate-500 mb-8 font-medium">Create batches to deliver this course to specific classes and select their students.</p>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
                <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Users className="text-blue-500" /> Create New Batch
                </h3>
                <div className="flex flex-col gap-5">
                    <input
                        type="text"
                        placeholder="Batch Name (e.g. 2026 Batch A)"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium transition-colors"
                        value={newBatchName}
                        onChange={(e) => setNewBatchName(e.target.value)}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium transition-colors cursor-pointer"
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(e.target.value);
                                setSelectedClassId("");
                            }}
                        >
                            <option value="">Filter by Year...</option>
                            {availableYears.map(y => (
                                <option key={y as string} value={y as string}>{y as string}</option>
                            ))}
                        </select>

                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium transition-colors cursor-pointer"
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                        >
                            <option value="">Select Target Class...</option>
                            {filteredClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium transition-colors cursor-pointer"
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            disabled={!selectedClassId}
                        >
                            <option value="">Filter by Section (Optional)...</option>
                            {sections.map(s => (
                                <option key={s} value={s}>Section {s}</option>
                            ))}
                        </select>
                    </div>

                    {selectedClassId && (
                        <div className="mt-2 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                                <h4 className="font-bold text-slate-900">Select Students ({students.length} found)</h4>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowAddForm(true)} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                                        <UserPlus size={16} /> Add New Student
                                    </button>
                                    <button onClick={handleSelectAll} className="text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">
                                        {selectedStudentIds.size === students.length && students.length > 0 ? "Deselect All" : "Select All"}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-2 max-h-[400px] overflow-y-auto">
                                {loadingStudents ? (
                                    <div className="p-8 text-center text-slate-500 text-sm font-medium">Loading students...</div>
                                ) : students.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm font-medium">No students found. Try adjusting filters or add one!</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {students.map(s => (
                                            <div 
                                                key={s.id} 
                                                onClick={() => handleToggleStudent(s.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedStudentIds.has(s.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${selectedStudentIds.has(s.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'}`}>
                                                    {selectedStudentIds.has(s.id) && <CheckCircle size={14} />}
                                                </div>
                                                <div className="flex-1 truncate">
                                                    <p className="font-bold text-sm text-slate-900 truncate">{s.full_name}</p>
                                                    <p className="text-xs text-slate-500 truncate">{s.email}</p>
                                                    {s.section && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-1 inline-block">Sec {s.section}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <button
                        onClick={handleCreateBatch}
                        className="w-full py-4 mt-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        Create Batch & Enroll Selected Students
                    </button>
                </div>
            </div>

            <h3 className="text-xl font-black text-slate-900 mb-4 ml-1">Existing Batches</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingBatches ? (
                    <div className="col-span-full py-12 text-center text-slate-400">Loading batches...</div>
                ) : batches.length === 0 ? (
                    <div className="col-span-full text-center p-12 bg-white border border-slate-200 rounded-3xl shadow-sm">
                        <Users className="mx-auto text-slate-300 mb-4" size={48} />
                        <p className="text-slate-500 font-medium">No batches created for this course yet.</p>
                    </div>
                ) : (
                    batches.map(batch => (
                        <div key={batch.id} className="flex flex-col justify-between p-6 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-xl font-black text-slate-900">{batch.name}</h4>
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                                        {batch.schoolClass?.name || "Manual"}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                                    <Users size={16} /> Enrolled: <span className="text-slate-900 font-bold">{batch.enrolled_count}</span>
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Student Modal */}
            <AnimatePresence>
                {showAddForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <UserPlus className="text-blue-500" /> Onboard Student
                                </h3>
                                <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                                        value={newStudentName}
                                        onChange={e => setNewStudentName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                                        value={newStudentEmail}
                                        onChange={e => setNewStudentEmail(e.target.value)}
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Temporary Password</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                                        value={newStudentPassword}
                                        onChange={e => setNewStudentPassword(e.target.value)}
                                        placeholder="Secret@123"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Class</label>
                                        <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-medium text-sm truncate">
                                            {classes.find(c => c.id == selectedClassId)?.name || "N/A"}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Section</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-sm"
                                            value={newStudentSection}
                                            onChange={e => setNewStudentSection(e.target.value)}
                                        >
                                            <option value="">(None)</option>
                                            {sections.map(s => (
                                                <option key={s} value={s}>Section {s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddNewStudent}
                                    className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                                >
                                    Admit & Save
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
