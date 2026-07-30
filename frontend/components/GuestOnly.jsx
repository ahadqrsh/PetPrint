"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// The inverse of Protected: keeps a signed-in user off the sign-in and sign-up
// pages. Uses replace() so the guarded page never enters history — otherwise
// Back would bounce between /login and /dashboard.
export default function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <p className="data text-center text-[12px] uppercase tracking-[0.16em] text-ink-faint">
        {user ? "Already signed in" : "Checking your session"}
      </p>
    );
  }

  return children;
}
