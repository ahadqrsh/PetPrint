"use client";

import { useState } from "react";
import api, { apiError } from "@/lib/api";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import AiBadge from "./AiBadge";
import { ErrorNote } from "./ui/Field";
import { useToast } from "./ui/Toast";

/**
 * Staff-only. Drafts a plain-language summary of an already-saved record, then
 * holds it back until a vet explicitly releases it to the owner.
 *
 * The unapproved state is the important one: the server won't send the text to
 * an owner's client at all until approved is true.
 */
export default function OwnerSummaryPanel({ record, aiAvailable, onSaved, onClose }) {
  const toast = useToast();
  const [summary, setSummary] = useState(record.ownerSummary || "");
  const [approved, setApproved] = useState(Boolean(record.ownerSummaryApproved));
  const [aiAssisted, setAiAssisted] = useState(Boolean(record.ownerSummaryAiAssisted));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function draft() {
    setError("");
    setBusy(true);
    try {
      const res = await api.post(`/records/${record.id}/ai/owner-summary`);
      setSummary(res.data.summary);
      setAiAssisted(true);
      setApproved(false);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(release) {
    setError("");
    setBusy(true);
    try {
      const res = await api.put(`/records/${record.id}/owner-summary`, {
        summary,
        approved: release
      });
      setApproved(res.data.approved);
      toast(
        release
          ? "Summary released — the owner can now see it"
          : "Summary saved as a draft"
      );
      onSaved?.(res.data);
      if (release) onClose();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        className={`rounded-md border px-3 py-2 text-[13px] ${
          approved
            ? "border-jade/30 bg-jade/10 text-jade-deep"
            : "border-brass/40 bg-brass-soft text-brass"
        }`}
      >
        {approved
          ? "This summary is visible to the owner."
          : "Not visible to the owner. Nothing is shared until you release it."}
      </div>

      {aiAvailable && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={draft}
          disabled={busy}
        >
          {busy ? "Drafting…" : summary ? "Redraft with the assistant" : "Draft with the assistant"}
        </Button>
      )}

      <label className="mt-3 block">
        <span className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-ink">
            Summary for the owner
          </span>
          {aiAssisted && <AiBadge />}
        </span>
        <textarea
          rows={7}
          value={summary}
          maxLength={4000}
          placeholder="Write in plain language what the owner needs to know about this visit."
          onChange={(e) => {
            setSummary(e.target.value);
            if (approved) setApproved(false); // editing withdraws approval
          }}
          className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[14px] leading-relaxed placeholder:text-ink-faint focus:border-jade"
        />
      </label>

      <p className="mt-1.5 text-[12px] text-ink-faint">
        You&apos;re responsible for what this says. Edit it freely — releasing it
        is your sign-off.
      </p>

      <ErrorNote>{error}</ErrorNote>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => save(false)}
          disabled={busy || !summary.trim()}
        >
          Save as draft
        </Button>
        <Button
          type="button"
          onClick={() => save(true)}
          disabled={busy || !summary.trim()}
        >
          {approved ? "Keep released" : "Release to owner"}
        </Button>
      </div>
    </div>
  );
}

export function OwnerSummaryModal({ record, aiAvailable, open, onClose, onSaved }) {
  if (!record) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Summary for the owner"
      description="Plain-language notes the owner can read alongside the clinical record."
    >
      <OwnerSummaryPanel
        record={record}
        aiAvailable={aiAvailable}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Modal>
  );
}
