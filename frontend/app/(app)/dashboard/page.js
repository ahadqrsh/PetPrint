"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SearchBar from "@/components/SearchBar";
import StatCard from "@/components/StatCard";
import PetCode from "@/components/PetCode";
import Skeleton from "@/components/ui/Skeleton";
import { formatDate, relativeDate } from "@/lib/pets";

function LedgerStrip({ counts, isStaff, loading }) {
  const cells = isStaff
    ? [
        { label: "Pets on file", value: counts?.pets, href: "/pets" },
        { label: "Visits this week", value: counts?.visitsThisWeek },
        { label: "Up for adoption", value: counts?.adoptable, href: "/adoptions" },
        {
          label: "To review",
          value: counts?.openApplications,
          href: "/adoptions/applications"
        }
      ]
    : [
        { label: "My pets", value: counts?.pets, href: "/pets" },
        { label: "Visits this week", value: counts?.visitsThisWeek },
        { label: "Looking for a home", value: counts?.adoptable, href: "/adoptions" },
        {
          label: "My applications",
          value: counts?.openApplications,
          href: "/adoptions/applications"
        }
      ];

  return (
    <div className="grid grid-cols-2 divide-line border-t border-line sm:grid-cols-4 sm:divide-x">
      {cells.map((cell) => (
        <StatCard key={cell.label} {...cell} loading={loading} />
      ))}
    </div>
  );
}

function RecentVisits({ visits, loading, isStaff }) {
  return (
    <div>
      <div className="file-tab">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        Recent activity
      </div>
      <div className="file-sheet">
        {loading ? (
          <div className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-5 py-3.5 sm:px-6">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-56" />
              </div>
            ))}
          </div>
        ) : visits.length === 0 ? (
          <p className="px-5 py-8 text-center text-[14px] text-ink-soft sm:px-6">
            {isStaff
              ? "No visits recorded yet. They'll show up here as your team writes them."
              : "No visits recorded for your pets yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visits.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/pets/${visit.petId}`}
                  className="flex items-start justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-paper/60 sm:px-6"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{visit.petName}</span>
                      {visit.petCode && <PetCode code={visit.petCode} size="sm" />}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-soft">
                      {visit.diagnosis || "No diagnosis recorded"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="data block text-[12px] text-ink-soft">
                      {formatDate(visit.visitDate)}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {relativeDate(visit.visitDate)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {}),
      api.get("/clinic").then((r) => setClinic(r.data.clinic)).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const isStaff = user.role !== "owner";
  const firstName = user.name.split(" ")[0];
  const allergyCount = stats?.counts?.petsWithAllergies;

  return (
    <>
      <PageHeader
        tab="Overview"
        title={`Good to see you, ${firstName}`}
        description={
          isStaff
            ? "Everything here is scoped to your clinic — you only ever see your own records."
            : "Your pets, their history, and animals looking for a home at this clinic."
        }
      >
        <LedgerStrip counts={stats?.counts} isStaff={isStaff} loading={loading} />
      </PageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <RecentVisits visits={stats?.recentVisits || []} loading={loading} isStaff={isStaff} />

        <div className="space-y-6">
          <div>
            <div className="file-tab">
              <span className="h-1.5 w-1.5 rounded-full bg-brass" />
              Find a chart
            </div>
            <div className="file-sheet p-5">
              <SearchBar
                placeholder={isStaff ? "Name, owner, or PET-2026-0001" : "Search your pets"}
              />
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Link
                  href="/pets"
                  className="rounded-md border border-line-strong bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-paper"
                >
                  {isStaff ? "All pets" : "My pets"}
                </Link>
                <Link
                  href="/pets/new"
                  className="rounded-md bg-jade px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-jade-deep"
                >
                  Register a pet
                </Link>
                <Link
                  href="/adoptions"
                  className="rounded-md border border-line-strong bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-paper"
                >
                  {isStaff ? "Adoption" : "Adopt a pet"}
                </Link>
              </div>
            </div>
          </div>

          {isStaff && allergyCount > 0 && (
            <div>
              <div className="file-tab">
                <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                Alerts
              </div>
              <div className="file-sheet border-t-0 p-5">
                <div className="rounded-md border border-clay/30 bg-clay-soft px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-clay-ink">
                    Allergies on file
                  </p>
                  <p className="mt-1 text-[14px] text-clay-ink">
                    <span className="data font-semibold">{allergyCount}</span>{" "}
                    {allergyCount === 1 ? "pet has" : "pets have"} a recorded allergy. Their
                    charts show a warning banner before any treatment detail.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="file-tab">
              <span className="h-1.5 w-1.5 rounded-full bg-brass" />
              {clinic?.type === "ngo" ? "Rescue" : "Clinic"}
            </div>
            <div className="file-sheet p-5">
              {loading ? (
                <>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-4 w-full" />
                </>
              ) : clinic ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base">{clinic.name}</h2>
                    <span
                      className={
                        clinic.plan === "paid"
                          ? "chip border-brass/40 bg-brass-soft text-brass"
                          : "chip border-line-strong bg-paper text-ink-soft"
                      }
                    >
                      {clinic.plan}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {[clinic.address, clinic.phone].filter(Boolean).join(" · ") ||
                      "No contact details recorded"}
                  </p>
                  {user.role === "admin" && (
                    <Link
                      href="/clinic"
                      className="mt-3 inline-block text-[13px] font-semibold text-jade underline underline-offset-2"
                    >
                      Clinic settings and export
                    </Link>
                  )}
                </>
              ) : (
                <p className="text-[14px] text-ink-soft">Clinic details couldn&apos;t be loaded.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
