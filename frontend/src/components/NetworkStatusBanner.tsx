import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, Sparkles } from "lucide-react";

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {/* Offline Alert */}
      {!isOnline && (
        <motion.div
          initial={{ y: -60, x: "-50%", opacity: 0 }}
          animate={{ y: 0, x: "-50%", opacity: 1 }}
          exit={{ y: -60, x: "-50%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-2 left-1/2 z-[99999] flex items-center gap-2 bg-amber-50/90 backdrop-blur-md border border-amber-200 px-4 py-1.5 rounded-full shadow-[0_10px_30px_rgba(217,119,6,0.1)] text-amber-800 font-sans"
        >
          <WifiOff size={14} className="animate-pulse text-amber-600" />
          <span className="text-[11px] font-bold tracking-wide">
            Working Offline — showing cached content
          </span>
        </motion.div>
      )}

      {/* Online Restored Toast */}
      {isOnline && showRestored && (
        <motion.div
          initial={{ y: -60, x: "-50%", opacity: 0 }}
          animate={{ y: 0, x: "-50%", opacity: 1 }}
          exit={{ y: -60, x: "-50%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-2 left-1/2 z-[99999] flex items-center gap-2 bg-emerald-50/90 backdrop-blur-md border border-emerald-200 px-4 py-1.5 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.1)] text-emerald-800 font-sans"
        >
          <Wifi size={14} className="text-emerald-600" />
          <span className="text-[11px] font-bold tracking-wide flex items-center gap-1">
            Connection Restored <Sparkles size={10} className="text-emerald-500" />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
