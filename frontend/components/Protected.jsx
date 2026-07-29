"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// Redirects to /login when signed out, or to /dashboard when the role can't
// use this page. The API enforces the same rules — this is just so people
// don't land on a screen that will only refuse them.
export default function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (roles && !roles.includes(user.role)) router.replace("/dashboard");
  }, [user, loading, roles, router]);

  if (loading || !user || (roles && !roles.includes(user.role))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="data text-[12px] uppercase tracking-[0.16em] text-ink-faint">
          Checking your session
        </p>
      </div>
    );
  }

  return children;
}
