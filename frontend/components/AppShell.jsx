"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Sidebar from "./Sidebar";

export default function AppShell({ children }) {
  const { user } = useAuth();
  const [clinic, setClinic] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;
    api.get("/clinic").then((res) => setClinic(res.data.clinic)).catch(() => {});
  }, [user]);

  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen lg:block">
        <Sidebar clinic={clinic} />
      </aside>

      {/* Mobile bar + drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-petrol-lift bg-petrol px-4 py-3 lg:hidden">
        <span className="font-display text-base font-semibold text-white">PetPrint</span>
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-md border border-petrol-lift px-3 py-1.5 text-[13px] text-white/80"
          aria-label="Open menu"
        >
          Menu
        </button>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-petrol/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 animate-fade-in">
            <Sidebar clinic={clinic} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-shell px-4 py-6 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
