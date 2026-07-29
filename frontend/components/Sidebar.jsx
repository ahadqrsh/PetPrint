"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { sectionsForRole } from "./nav-items";
import Avatar from "./ui/Avatar";

function NavItem({ item, active, onNavigate }) {
  if (item.soon) {
    return (
      <span
        className="flex cursor-default items-center justify-between rounded-md px-3 py-2 text-[14px] text-white/35"
        title={`Arrives in ${item.soon}`}
      >
        {item.label}
        <span className="data text-[10px] uppercase tracking-[0.12em] text-white/25">
          {item.soon.replace("Phase ", "P")}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center rounded-md px-3 py-2 text-[14px] transition-colors",
        active ? "bg-petrol-light text-white" : "text-white/70 hover:bg-petrol-light/60 hover:text-white"
      ].join(" ")}
    >
      {/* Brass marker: the tab-edge of the file you currently have open. */}
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brass" />
      )}
      {item.label}
    </Link>
  );
}

export default function Sidebar({ clinic, onNavigate }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!user) return null;
  const sections = sectionsForRole(user.role);

  return (
    <div className="flex h-full flex-col bg-petrol">
      <div className="px-5 pb-4 pt-5">
        <Link href="/dashboard" onClick={onNavigate} className="inline-flex items-baseline gap-2">
          <span className="font-display text-lg font-semibold tracking-[-0.02em] text-white">
            PetPrint
          </span>
        </Link>

        <div className="mt-4 rounded-md border border-petrol-lift bg-petrol-light/50 px-3 py-2.5">
          {clinic ? (
            <>
              <p className="truncate text-[13px] font-semibold text-white">{clinic.name}</p>
              <p className="mt-1 flex items-center gap-1.5">
                <span className="data text-[10px] uppercase tracking-[0.14em] text-white/50">
                  {clinic.type === "ngo" ? "Rescue" : "Clinic"}
                </span>
                <span
                  className={[
                    "chip",
                    clinic.plan === "paid"
                      ? "border-brass/50 bg-brass/15 text-brass"
                      : "border-white/20 bg-white/5 text-white/50"
                  ].join(" ")}
                >
                  {clinic.plan}
                </span>
              </p>
            </>
          ) : (
            <span className="block h-8 animate-pulse rounded bg-white/10" />
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.label}
                  item={item}
                  active={pathname === item.href}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-petrol-lift px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="data text-[10px] uppercase tracking-[0.14em] text-white/40">
              {user.role}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="mt-2.5 w-full rounded-md border border-petrol-lift px-3 py-1.5 text-[13px] text-white/60 transition-colors hover:bg-petrol-light hover:text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
