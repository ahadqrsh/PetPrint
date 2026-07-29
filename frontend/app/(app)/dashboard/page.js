"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import SearchBar from "@/components/SearchBar";

// A ledger strip rather than a row of floating stat cards: one sheet, hairline
// dividers, mono numerals — the summary line at the top of a paper file.
function LedgerStrip({ counts, team, isStaff, loading }) {
  const cells = isStaff
    ? [
        { label: "Pets on file", value: counts?.pets },
        { label: "Visits this week", value: counts?.visitsThisWeek },
        { label: "Vets", value: team?.vets },
        { label: "Registered owners", value: team?.owners }
      ]
    : [
        { label: "My pets", value: counts?.pets },
        { label: "Visits this week", value: counts?.visitsThisWeek }
      ];

  return (
    <div
      className={`grid divide-x divide-line border-t border-line ${
        cells.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"
      }`}
    >
      {cells.map((cell) => (
        <div key={cell.label} className="px-5 py-4 sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            {cell.label}
          </p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-10" />
          ) : (
            <p className="data mt-0.5 text-[1.6rem] font-medium leading-tight text-ink">
              {cell.value ?? "\u2014"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function NextUp({ role }) {
  const rows =
    role === "owner"
      ? [
          { phase: "Phase 4", text: "Browse cats and dogs up for adoption, and apply" },
          { phase: "Phase 5", text: "Printable PDF summaries of your pet's history" }
        ]
      : [
          { phase: "Phase 4", text: "Adoption listings and the application review queue" },
          { phase: "Phase 5", text: "PDF visit summaries, CSV export, and email notifications" },
          { phase: "Phase 6", text: "Vaccination scheduling with automatic due dates" }
        ];

  return (
    <div className="mt-6">
      <div className="file-tab">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        Roadmap
      </div>
      <div className="file-sheet divide-y divide-line">
        {rows.map((row) => (
          <div key={row.phase} className="flex gap-4 px-5 py-3.5 sm:px-6">
            <span className="data w-[62px] shrink-0 pt-0.5 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              {row.phase}
            </span>
            <span className="text-[14px] text-ink-soft">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/clinic")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const clinic = data?.clinic;
  const isStaff = user.role !== "owner";
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        tab="Overview"
        title={`Good to see you, ${firstName}`}
        description={
          isStaff
            ? "Everything here is scoped to your clinic — you only ever see your own records."
            : "You'll see your own pets and their history here, and nothing belonging to anyone else."
        }
      >
        <LedgerStrip counts={data?.counts} team={data?.team} isStaff={isStaff} loading={loading} />
      </PageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="file-tab">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" />
            {clinic?.type === "ngo" ? "Rescue" : "Clinic"}
          </div>
          <div className="file-sheet p-5 sm:p-6">
            {loading ? (
              <>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </>
            ) : clinic ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2>{clinic.name}</h2>
                  <span
                    className={
                      clinic.plan === "paid"
                        ? "chip border-brass/40 bg-brass-soft text-brass"
                        : "chip border-line-strong bg-paper text-ink-soft"
                    }
                  >
                    {clinic.plan} plan
                  </span>
                </div>

                <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-[14px]">
                  {[
                    ["Address", clinic.address],
                    ["Phone", clinic.phone],
                    [
                      "On PetPrint since",
                      clinic.createdAt
                        ? new Date(clinic.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })
                        : null
                    ]
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-4">
                      <dt className="w-[150px] shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                        {label}
                      </dt>
                      <dd className={value ? "text-ink" : "text-ink-faint"}>
                        {value || "Not set"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-[14px] text-ink-soft">
                Your clinic details couldn&apos;t be loaded. Refresh to try again.
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="file-tab">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" />
            Find a chart
          </div>
          <div className="file-sheet p-5 sm:p-6">
            <p className="text-[14px] text-ink-soft">
              {isStaff
                ? "Search by name, owner, or the code on the tag."
                : "Search your pets by name or code."}
            </p>
            <div className="mt-3">
              <SearchBar
                placeholder={isStaff ? "e.g. Biscuit, Olive, PET-2026-0001" : "e.g. Biscuit"}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <Link
                href="/pets"
                className="rounded-md border border-line-strong bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-paper"
              >
                All pets
              </Link>
              <Link
                href="/pets/new"
                className="rounded-md bg-jade px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-jade-deep"
              >
                Register a pet
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin/vets"
                  className="rounded-md border border-line-strong bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-paper"
                >
                  Manage team
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <NextUp role={user.role} />
    </>
  );
}
