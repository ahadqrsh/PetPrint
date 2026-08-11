"use client";

import { useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "./ui/Toast";

/**
 * Non-blocking, matching the backend's stance: an unverified account can
 * still do everything, this is a nudge, not a gate. Dismissable for the
 * session so it doesn't nag on every single page view.
 */
export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  async function resend() {
    setBusy(true);
    try {
      await api.post("/auth/resend-verification");
      setSent(true);
      toast("Verification email sent");
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brass/30 bg-brass-soft px-4 py-2.5 sm:px-6">
      <p className="text-[13px] text-brass">
        {sent
          ? "Verification email sent — check your inbox."
          : "Confirm your email so a password reset can reach you if you ever need one."}
      </p>
      <div className="flex shrink-0 gap-3">
        {!sent && (
          <button
            onClick={resend}
            disabled={busy}
            className="text-[13px] font-semibold text-brass underline underline-offset-2 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Resend email"}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-[13px] text-brass/70 underline underline-offset-2"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
