"use client";

import { useEffect, useRef } from "react";

// Accessible dialog: Escape closes, focus moves in on open and returns on
// close, background scroll is locked, and Tab is trapped inside.
export default function Modal({ open, onClose, title, description, children }) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter((el) => !el.disabled);

    focusable()[0]?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-petrol/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md animate-slide-up rounded-t-xl border border-line bg-white shadow-xl sm:rounded-xl"
      >
        <header className="border-b border-line px-5 py-4">
          <h2>{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>}
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
