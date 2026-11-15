"use client";

import { CheckCircle2, Undo2 } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { useStore } from "@/lib/store";

type Toast = { id: number; message: string; undo?: boolean };
const ToastContext = createContext<(message: string, opts?: { undo?: boolean }) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { undo } = useStore();
  const push = useCallback((message: string, opts?: { undo?: boolean }) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, undo: opts?.undo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed right-4 bottom-20 z-[60] flex flex-col gap-2 md:bottom-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="animate-toast pointer-events-auto flex items-center gap-3 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-xl">
            <CheckCircle2 size={18} className="text-brand-300" />
            <span>{t.message}</span>
            {t.undo && (
              <button
                onClick={() => {
                  undo();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
                className="ml-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
              >
                <Undo2 size={14} /> Ongedaan maken
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
