"use client";

import { useId } from "react";

export function Field({ label, hint, error, children }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-[13px] font-semibold text-ink">{label}</label>
        {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[12px] text-clay-ink">{error}</p>}
    </div>
  );
}

const CONTROL =
  "w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] " +
  "text-ink placeholder:text-ink-faint focus:border-jade";

export function TextInput({ label, hint, error, className = "", ...props }) {
  const id = useId();
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">
          {label}
        </label>
        {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
      </div>
      <input id={id} className={`${CONTROL} ${className}`} {...props} />
      {error && <p className="mt-1 text-[12px] text-clay-ink">{error}</p>}
    </div>
  );
}

export function SelectInput({ label, hint, children, className = "", ...props }) {
  const id = useId();
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">
          {label}
        </label>
        {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
      </div>
      <select id={id} className={`${CONTROL} ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mt-4 rounded-md border border-clay/40 bg-clay-soft px-3 py-2 text-[13px] text-clay-ink"
    >
      {children}
    </p>
  );
}
