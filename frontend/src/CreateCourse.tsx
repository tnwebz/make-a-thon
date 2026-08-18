import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./config";
import { 
  Save, Image as ImageIcon, ArrowLeft, Clock, Upload, 
  Trash2, Link as LinkIcon, Sparkles, CheckCircle2 
} from "lucide-react";

const CreateCourse = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    title: "", 
    description: "", 
    price: "", 
    image_url: "", 
    duration: "", 
    school_class_id: "none" 
  });
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isFree, setIsFree] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE_URL}/admin/classes`, { headers: { Authorization: `Bearer ${token}` } });
        setClasses(res.data);
      } catch (err) {
        console.error("Failed to load classes", err);
      }
    };
    fetchClasses();
  }, []);

  // Handle direct file selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Image size exceeds 15MB. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setFormData(prev => ({ ...prev, image_url: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 🎨 PROFESSIONAL THEME
  const brand = {
    blue: "#005EB8",
    border: "#e2e8f0",
    textLabel: "#475569",
    inputBg: "#ffffff",
    textMain: "#1e293b",
    cardBg: "#F8FAFC"
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const finalDescription = formData.duration ? `${formData.description}\n\n[Duration: ${formData.duration}]` : formData.description;
      const response = await axios.post(
        `${API_BASE_URL}/courses`, 
        { 
          title: formData.title, 
          description: finalDescription, 
          price: isFree ? 0 : (parseInt(formData.price) || 0), 
          image_url: formData.image_url, 
          school_class_id: formData.school_class_id 
        }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Course Created Successfully! 🎉 Let's add some content.");
      navigate(`/dashboard/course/${response.data.id}/builder`);
    } catch (error: any) { 
      console.error(error); 
      alert("Failed to create course."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", animation: "fadeIn 0.5s ease" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h2 style={{ fontSize: "26px", fontWeight: "800", color: brand.textMain, marginBottom: "8px" }}>Create New Course</h2>
          <p style={{ color: "#64748b", margin: 0 }}>Set up your course details to begin building your curriculum.</p>
        </div>
        <button onClick={() => navigate("/dashboard/courses")} style={{ background: "none", border: "none", color: brand.blue, fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
          <ArrowLeft size={18} strokeWidth={2} /> Back to Courses
        </button>
      </div>

      {/* Main Form Card (Off-White) */}
      <div style={{ background: brand.cardBg, padding: "40px", borderRadius: "16px", border: `1px solid ${brand.border}`, boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.05)" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          
          <div>
            <label style={labelStyle}>Course Title</label>
            <input type="text" placeholder="e.g. Advanced Java Masterclass" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea rows={4} placeholder="Describe what your students will achieve..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div>
            <label style={labelStyle}>Target School Class (Optional)</label>
            <select value={formData.school_class_id} onChange={(e) => setFormData({...formData, school_class_id: e.target.value})} style={inputStyle}>
              <option value="none">-- Not Tied to a Specific Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}
            </select>
            <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Select a class if you want to deliver this course to specific sections (batches).</p>
          </div>

          <div>
            <label style={labelStyle}>Total Course Duration</label>
            <div style={{ position: "relative" }}>
              <Clock size={16} style={iconOverlayStyle} strokeWidth={1.5} />
              <input type="text" placeholder="e.g. 12 Hours 30 Mins" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} style={{ ...inputStyle, paddingLeft: "40px" }} />
            </div>
          </div>

          {/* COURSE THUMBNAIL (Direct File Upload & URL Option) */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Course Thumbnail</label>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setUploadMode("file")}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: uploadMode === "file" ? "700" : "500",
                    color: uploadMode === "file" ? brand.blue : "#94a3b8",
                    cursor: "pointer",
                    textDecoration: uploadMode === "file" ? "underline" : "none"
                  }}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("url")}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: uploadMode === "url" ? "700" : "500",
                    color: uploadMode === "url" ? brand.blue : "#94a3b8",
                    cursor: "pointer",
                    textDecoration: uploadMode === "url" ? "underline" : "none"
                  }}
                >
                  Paste URL
                </button>
              </div>
            </div>

            {uploadMode === "file" ? (
              <div>
                {imagePreview || formData.image_url ? (
                  <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", border: `1px solid ${brand.border}`, background: "white", maxHeight: "220px" }}>
                    <img 
                      src={imagePreview || formData.image_url} 
                      alt="Thumbnail Preview" 
                      style={{ width: "100%", height: "200px", objectFit: "cover" }} 
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "rgba(220, 38, 38, 0.9)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                      }}
                    >
                      <Trash2 size={14} /> Remove Image
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed #cbd5e1",
                      borderRadius: "12px",
                      padding: "32px 20px",
                      textAlign: "center",
                      background: "#ffffff",
                      cursor: "pointer",
                      transition: "border-color 0.2s"
                    }}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageFileChange} 
                      style={{ display: "none" }} 
                    />
                    <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto", color: brand.blue }}>
                      <Upload size={22} />
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", marginBottom: "4px" }}>
                      Click to upload course image
                    </div>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                      PNG, JPG, WEBP or GIF (Recommended 16:9 aspect ratio)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <ImageIcon size={16} style={iconOverlayStyle} strokeWidth={1.5} />
                <input 
                  type="text" 
                  placeholder="https://images.unsplash.com/photo-..." 
                  value={formData.image_url} 
                  onChange={(e) => {
                    setFormData({...formData, image_url: e.target.value});
                    setImagePreview(e.target.value);
                  }} 
                  style={{ ...inputStyle, paddingLeft: "40px" }} 
                />
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", marginTop: "10px" }}>
            <button type="button" onClick={() => navigate("/dashboard/courses")} style={{ padding: "12px 24px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "white", color: "#64748b", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 32px", borderRadius: "10px", border: "none", background: brand.blue, color: "white", fontWeight: "700", cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 12px rgba(0, 94, 184, 0.25)", transition: "all 0.2s" }}>
              <Save size={18} /> {loading ? "Creating..." : "Create & Build Curriculum"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// --- Styles (Professional) ---
const labelStyle = { display: "block", marginBottom: "8px", fontWeight: "700", color: "#334155", fontSize: "13px", textTransform: "uppercase" as const, letterSpacing: "0.5px" };
const inputStyle = { width: "100%", padding: "12px 16px", fontSize: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", outline: "none", color: "#1e293b", boxSizing: "border-box" as const, transition: "border 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" };
const iconOverlayStyle = { position: "absolute" as const, left: "14px", top: "14px", color: "#94a3b8" };

export default CreateCourse;