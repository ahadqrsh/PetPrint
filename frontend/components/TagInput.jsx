"use client";

import { useId, useState } from "react";

// Free-text list input. Enter or comma commits an entry; Backspace on an empty
// field removes the last one. Used for allergies and ongoing conditions.
export default function TagInput({
  label, hint, placeholder, value = [], onChange, tone = "neutral"
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function commit(raw) {
    const entry = raw.trim().replace(/,$/, "");
    if (!entry) return;
    if (!value.some((v) => v.toLowerCase() === entry.toLowerCase())) {
      onChange([...value, entry]);
    }
    setDraft("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const chipTone =
    tone === "warning"
      ? "border-clay/40 bg-clay-soft text-clay-ink"
      : "border-line-strong bg-paper text-ink";

  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">{label}</label>
        {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
      </div>

      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((entry) => (
            <li key={entry}>
              <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[13px] ${chipTone}`}>
                {entry}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== entry))}
                  aria-label={`Remove ${entry}`}
                  className="text-current opacity-50 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-jade"
      />
    </div>
  );
}
