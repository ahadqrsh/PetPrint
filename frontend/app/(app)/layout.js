"use client";

import Protected from "@/components/Protected";
import AppShell from "@/components/AppShell";

// Route group: URLs are unchanged (/dashboard, /admin/vets), but every page
// inside shares the auth guard and the shell.
export default function AppLayout({ children }) {
  return (
    <Protected>
      <AppShell>{children}</AppShell>
    </Protected>
  );
}
