"use client";

import { useState } from "react";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import Button from "@/components/ui/Button";
import { TextInput, ErrorNote } from "@/components/ui/Field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Always shown after submit, regardless of whether the email exists — the
  // server deliberately returns the same response either way, so the UI
  // can't leak that information either.
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="file-sheet p-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Check your email</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          If an account exists for <span className="font-medium text-ink">{email}</span>,
          we&apos;ve sent a link to reset your password. It expires in 1 hour.
        </p>
        <Link href="/login" className="mt-4 inline-block text-[13px] font-semibold text-jade underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="file-sheet p-6">
      <h1 className="text-lg font-semibold text-ink">Forgot your password?</h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        Enter the email on your account and we&apos;ll send a reset link.
      </p>

      <form onSubmit={submit} className="mt-5">
        <TextInput
          label="Email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="mt-4 w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <Link href="/login" className="mt-4 block text-center text-[13px] font-semibold text-jade underline underline-offset-2">
        Back to sign in
      </Link>
    </div>
  );
}
