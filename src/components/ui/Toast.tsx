"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, Sparkles, X } from "lucide-react";
import { ToastOptions } from "@/lib/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastOptions>;
      if (!customEvent.detail) return;

      const newToast = customEvent.detail;
      setToasts((prev) => [...prev, newToast]);

      const duration = newToast.duration || 3500;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, duration);
    };

    window.addEventListener("vastrax-toast", handleToast);
    return () => window.removeEventListener("vastrax-toast", handleToast);
  }, []);

  const removeToast = (id?: string) => {
    if (!id) return;
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 md:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-start gap-3.5 p-4 rounded-xl bg-[#0A192F]/95 text-white border border-[#D4AF37]/30 shadow-2xl backdrop-blur-md"
          >
            {toast.image ? (
              <img
                src={toast.image}
                alt={toast.title}
                className="w-11 h-11 rounded-lg object-cover border border-[#D4AF37]/20 flex-shrink-0"
              />
            ) : toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            ) : toast.type === "info" ? (
              <Info className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-sm font-semibold tracking-wide text-white leading-tight">
                {toast.title}
              </h4>
              {toast.description && (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2 font-light">
                  {toast.description}
                </p>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
