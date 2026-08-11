"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import Button from "@/components/ui/Button";
import { TextInput, ErrorNote } from "@/components/ui/Field";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Distinguishes "the link itself is dead" from an ordinary validation error
  // (weak password, mismatch) — the former needs a different recovery path
  // (request a new link) than the latter (just fix the form).
  const [linkDead, setLinkDead] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLinkDead(false);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      // A full navigation (not router.push) so every part of the app that
      // reads auth state on load — the axios interceptor, the auth context —
      // picks up the freshly issued token rather than relying on stale state.
      localStorage.setItem("token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err) {
      const message = apiError(err);
      setError(message);
      if (/invalid or has expired/i.test(message)) setLinkDead(true);
    } finally {
      setBusy(false);
    }
  }

  if (linkDead) {
    return (
      <div className="file-sheet p-6 text-center">
        <h1 className="text-lg font-semibold text-ink">This link has expired</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          Reset links work once and expire after an hour. Request a fresh one below.
        </p>
        <Link href="/forgot-password">
          <Button className="mt-4 w-full">Request a new link</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="file-sheet p-6">
      <h1 className="text-lg font-semibold text-ink">Choose a new password</h1>

      <form onSubmit={submit} className="mt-5">
        <TextInput
          label="New password"
          type="password"
          required
          autoFocus
          minLength={8}
          hint="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextInput
          label="Confirm new password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="mt-4 w-full" disabled={busy}>
          {busy ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </div>
  );
}
