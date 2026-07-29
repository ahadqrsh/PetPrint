"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { TextInput, ErrorNote } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email, form.password);
      router.push("/dashboard");
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise-in">
      <p className="data text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        Clinic access
      </p>
      <h1 className="mt-1 text-[1.75rem]">Sign in</h1>

      <form onSubmit={onSubmit} className="mt-6">
        <TextInput
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@clinic.example"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <TextInput
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <ErrorNote>{error}</ErrorNote>
        <Button full className="mt-5" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-[13px] text-ink-soft">
        No account yet?{" "}
        <Link href="/register" className="font-semibold text-jade underline underline-offset-2">
          Create one
        </Link>
      </p>
    </div>
  );
}
