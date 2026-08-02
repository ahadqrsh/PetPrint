"use client";

import { useState } from "react";
import api, { apiError } from "@/lib/api";
import Button from "./ui/Button";
import { ErrorNote } from "./ui/Field";

/**
 * Sits inside the "add a visit" form. The vet types rough notes, the assistant
 * returns a tidied draft, and the draft is loaded into the form's own fields —
 * where it can be edited before saving. Nothing is saved from here.
 */
export default function AiDraftPanel({ petId, onDraft, disabled }) {
  const [open, setOpen] = useState(false);
  const [observations, setObservations] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setError("");
    setBusy(true);
    try {
      const res = await api.post(`/pets/${petId}/ai/draft-record`, { observations });
      onDraft(res.data.draft);
      setOpen(false);
      setObservations("");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-1 w-full rounded-md border border-dashed border-line-strong bg-paper px-3 py-2.5 text-left transition-colors hover:border-jade disabled:opacity-50"
      >
        <span className="text-[13px] font-semibold text-ink">
          Write it up from rough notes
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-faint">
          Type what you found and the assistant will draft the fields below for
          you to check.
        </span>
      </button>
    );
  }

  return (
    <div className="mt-1 rounded-md border border-line-strong bg-paper p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink">Your notes</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          className="text-[12px] text-ink-soft underline underline-offset-2"
        >
          Cancel
        </button>
      </div>

      <textarea
        rows={4}
        autoFocus
        value={observations}
        maxLength={4000}
        placeholder="e.g. head shaking, right ear, yeasty smell, canal red and inflamed. Otitis externa. Flushed in clinic, otic drops twice daily 7 days."
        onChange={(e) => setObservations(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-jade"
      />

      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
        This tidies up your own observations. It doesn&apos;t diagnose, suggest
        treatment, or add anything you haven&apos;t written.
      </p>

      <ErrorNote>{error}</ErrorNote>

      <Button
        type="button"
        size="sm"
        className="mt-3"
        onClick={generate}
        disabled={busy || observations.trim().length < 15}
      >
        {busy ? "Drafting…" : "Draft the fields"}
      </Button>
    </div>
  );
}
