"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, tone = "success") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list, { id, message, tone }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={[
              "pointer-events-auto animate-slide-up rounded-md border px-4 py-2.5 text-left text-[13px] shadow-lg",
              t.tone === "error"
                ? "border-clay/40 bg-clay-soft text-clay-ink"
                : "border-petrol-lift bg-petrol text-white"
            ].join(" ")}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
