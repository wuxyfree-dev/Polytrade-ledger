"use client";
import React from "react";

type Toast = { id: string; type: "success" | "error" | "info"; message: string };

const ToastContext = React.createContext<{
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = (t: Omit<Toast, "id">) => {
    const id = String(Date.now()) + Math.random().toString(16).slice(2);
    setToasts((p) => [...p, { id, ...t }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 2800);
  };

  return (
    <ToastContext.Provider value={{ toasts, push }}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "rounded-2xl px-4 py-3 text-sm shadow-soft border " +
              (t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : t.type === "error"
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-slate-50 border-slate-200 text-slate-900")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
