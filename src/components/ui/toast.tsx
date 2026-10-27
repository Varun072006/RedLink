"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";

interface Toast {
  id: number;
  tone: "success" | "error";
  text: string;
}

const Ctx = createContext<{ push: (tone: Toast["tone"], text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const reduce = useReducedMotion();

  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-sm ${
                t.tone === "success" ? "border-forest/40 bg-[#dfeae4] text-forest" : "border-oxblood/40 bg-[#f3dfe1] text-oxblood-ink"
              }`}
            >
              {t.tone === "success" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <TriangleAlert size={18} className="mt-0.5 shrink-0" />}
              <span>{t.text}</span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}
                className="ml-1 rounded p-0.5 hover:bg-black/5"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
