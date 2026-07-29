"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="data text-[12px] uppercase tracking-[0.16em] text-ink-faint">Loading</p>
    </div>
  );
}
