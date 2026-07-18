import { useRegisterSW } from "virtual:pwa-register/react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Sparkles } from "lucide-react";

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("SW registered:", r);
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  const handleReload = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-6 z-[9999] max-w-sm w-full bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.08)] text-slate-900 font-sans"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold tracking-wider text-emerald-700 uppercase">Update Available</span>
                <h3 className="font-extrabold text-slate-900 leading-tight">New Version Ready</h3>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 bg-slate-100 hover:bg-slate-200/80 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Description */}
          <p className="mt-3.5 text-sm text-slate-500 leading-relaxed">
            SkillForge has been updated with new features and performance improvements. Reload to apply updates.
          </p>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleReload}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-2.5 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            >
              <RefreshCw size={14} />
              Reload Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-sm rounded-2xl transition-colors"
            >
              Later
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
