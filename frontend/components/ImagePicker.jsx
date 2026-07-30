"use client";

import { useEffect, useRef, useState } from "react";

const MAX_MB = 5;

// File input with a live preview. Validates type and size before submit so the
// server round-trip isn't needed to tell someone their photo is too big.
export default function ImagePicker({ label = "Photo", hint, onChange, error }) {
  const [preview, setPreview] = useState(null);
  const [localError, setLocalError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function pick(file) {
    setLocalError("");
    if (!file) {
      setPreview(null);
      onChange(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLocalError("That file isn't an image.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`Images must be under ${MAX_MB} MB.`);
      return;
    }
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    onChange(file);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    pick(null);
  }

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-[13px] font-semibold text-ink">{label}</label>
        {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
      </div>

      {preview ? (
        <div className="overflow-hidden rounded-md border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected photo" className="h-44 w-full object-cover" />
          <div className="flex justify-between gap-2 border-t border-line bg-paper px-3 py-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-[13px] font-semibold text-jade underline underline-offset-2"
            >
              Choose another
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-[13px] text-ink-soft underline underline-offset-2 hover:text-clay-ink"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong bg-paper text-ink-soft transition-colors hover:border-jade hover:text-ink"
        >
          <span className="text-[14px] font-semibold">Choose a photo</span>
          <span className="text-[12px] text-ink-faint">JPEG, PNG, WebP or GIF · under {MAX_MB} MB</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] || null)}
      />

      {(localError || error) && (
        <p className="mt-1 text-[12px] text-clay-ink">{localError || error}</p>
      )}
    </div>
  );
}
