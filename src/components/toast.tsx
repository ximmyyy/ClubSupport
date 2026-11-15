"use client";

import { CheckCircle2, Undo2 } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { useStore } from "@/lib/store";

type Toast = { id: number; message: string; undo?: boolean };
const ToastContext = createContext<(message: string, opts?: { undo?: boolean }) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { undo, canEdit } = useStore();
  const push = useCallback((message: string, opts?: { undo?: boolean }) => {
    const id = Date.now() + Math.random();
    // Mutations are blocked for read-only members: say so instead of confirming a change that did not happen
    if (opts?.undo && !canEdit) {
      message = "Je hebt alleen leesrechten; er is niets gewijzigd";
      opts = { undo: false };
    }
    setToasts((t) => [...t.slice(-2), { id, message, undo: opts?.undo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.undo ? 9000 : 6000);
  }, [canEdit]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:items-end lg:bottom-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="animate-toast pointer-events-auto flex items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-base text-white shadow-xl sm:text-sm">
            <CheckCircle2 size={20} className="shrink-0 text-brand-300" />
            <span className="flex-1">{t.message}</span>
            {t.undo && (
              <button
                onClick={() => {
                  undo();
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                }}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25 sm:min-h-9"
              >
                <Undo2 size={16} /> Ongedaan maken
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
