import { useState, useEffect } from "react";
import axios from "axios";
import { User, Lock, Video } from "lucide-react";
import { motion } from "framer-motion";

const InstructorSettings = () => {
  const [userProfile, setUserProfile] = useState<any>({ name: "", email: "", profile_pic: "", initials: "IN" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [zoomAccountId, setZoomAccountId] = useState("");
  const [zoomClientId, setZoomClientId] = useState("");
  const [zoomClientSecret, setZoomClientSecret] = useState("");
  const [savingZoom, setSavingZoom] = useState(false);

  const triggerToast = (msg: string, type: string) => {
    alert(`${type.toUpperCase()}: ${msg}`); // Quick fallback if no toast available
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://127.0.0.1:8000/api/v1/profile", { headers: { Authorization: `Bearer ${token}` } });
        setUserProfile({
          ...res.data,
          name: res.data.full_name || "Instructor",
          initials: (res.data.full_name || "Instructor").substring(0, 2).toUpperCase()
        });
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const token = localStorage.getItem("token");
      const res = await axios.put(`http://127.0.0.1:8000/api/v1/profile`, {
        full_name: userProfile.name,
        profile_pic: userProfile.profile_pic,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setUserProfile({
        ...res.data,
        name: res.data.full_name,
        initials: res.data.full_name.substring(0, 2).toUpperCase()
      });
      triggerToast("Profile Updated Successfully!", "success");
    } catch (err) {
      triggerToast("Failed to update profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const token = localStorage.getItem("token");
      await axios.put(`http://127.0.0.1:8000/api/v1/profile/password`, { oldPassword, newPassword }, { headers: { Authorization: `Bearer ${token}` } });
      triggerToast("Password Updated Successfully!", "success");
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      triggerToast(err.response?.data?.error || "Failed to update password.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleZoomUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingZoom(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post("http://127.0.0.1:8000/api/v1/user/zoom-credentials", 
        { account_id: zoomAccountId, client_id: zoomClientId, client_secret: zoomClientSecret }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      triggerToast("Zoom API Credentials updated successfully!", "success");
    } catch (err) { triggerToast("Failed to save credentials.", "error"); } 
    finally { setSavingZoom(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto pb-20 mt-4">
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-8 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Platform Settings</h2>
          <p className="text-slate-500 font-medium mt-1">Manage your instructor profile, security preferences, and integrations.</p>
        </div>

        <div className="p-8 md:p-10">
          
          {/* --- PROFILE SECTION --- */}
          <section className="mb-12">
            <div className="mb-8">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <User size={18} className="text-blue-500" /> Public Profile
              </h3>
            </div>

            <form onSubmit={handleProfileSave}>
              {/* Avatar Upload */}
              <div className="flex items-center gap-6 mb-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                {userProfile.profile_pic ? (
                  <img src={userProfile.profile_pic} alt="Profile" className="w-20 h-20 rounded-full object-cover shadow-sm border-2 border-white" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-2xl shadow-sm border-2 border-white">{userProfile.initials}</div>
                )}
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-sm font-bold text-slate-700">Profile Picture</label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <label className="cursor-pointer bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-sm text-center flex items-center justify-center">
                      <span>Upload Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setUserProfile({...userProfile, profile_pic: reader.result as string});
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                    <input type="text" value={userProfile.profile_pic || ""} onChange={(e) => setUserProfile({...userProfile, profile_pic: e.target.value})} placeholder="Or paste image URL..." className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-all font-medium" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Recommended size: 256x256px. Max size: 2MB.</p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                  <input type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                  <input type="email" value={userProfile.email} disabled className="w-full px-4 py-3 bg-slate-100/80 text-slate-400 border border-slate-200 rounded-xl font-bold cursor-not-allowed" />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={savingProfile} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 flex items-center gap-2">
                  {savingProfile ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </section>

          <hr className="border-slate-100 my-10" />

          {/* --- SECURITY SECTION --- */}
          <section>
            <div className="mb-8">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <Lock size={18} className="text-slate-600" /> Account Security
              </h3>
            </div>

            <form onSubmit={handlePasswordSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current Password</label>
                  <input type="password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-slate-900 transition-all text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                  <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-slate-900 transition-all text-slate-900" />
                </div>
              </div>
              
              <div className="flex justify-end">
                <button type="submit" disabled={savingSettings} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-black/10 disabled:opacity-70 flex items-center gap-2">
                  {savingSettings ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </section>

          <hr className="border-slate-100 my-10" />

          {/* --- INTEGRATIONS SECTION --- */}
          <section>
            <div className="mb-8">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <Video size={18} className="text-indigo-500" /> Zoom Integration
              </h3>
              <p className="text-sm text-slate-500 mt-1">Manage your automated meeting link settings.</p>
            </div>

            <form onSubmit={handleZoomUpdate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Account ID</label>
                  <input type="text" required value={zoomAccountId} onChange={(e) => setZoomAccountId(e.target.value)} placeholder="e.g. abc123def456" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client ID</label>
                  <input type="text" required value={zoomClientId} onChange={(e) => setZoomClientId(e.target.value)} placeholder="e.g. r8t5v_xy1aA" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-900" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client Secret</label>
                  <input type="password" required value={zoomClientSecret} onChange={(e) => setZoomClientSecret(e.target.value)} placeholder="•••••••••••••••••••••" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:bg-white focus:border-indigo-500 transition-all text-slate-900" />
                </div>
              </div>
              
              <div className="flex justify-end">
                <button type="submit" disabled={savingZoom} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-70 flex items-center gap-2">
                  {savingZoom ? "Saving Keys..." : "Save Zoom Credentials"}
                </button>
              </div>
            </form>
          </section>

        </div>
      </div>
    </motion.div>
  );
};

export default InstructorSettings;