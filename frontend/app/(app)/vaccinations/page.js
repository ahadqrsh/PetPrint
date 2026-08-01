"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import PetCode from "@/components/PetCode";
import DueChip from "@/components/DueChip";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/pets";

const WINDOWS = [
  { id: 7, label: "This week" },
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" }
];

export default function VaccinationsDuePage() {
  const { user } = useAuth();
  const isStaff = user.role !== "owner";

  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/vaccinations/due", { params: { days } });
      setData(res.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const overdue = data?.due.filter((d) => d.status === "overdue") || [];
  const upcoming = data?.due.filter((d) => d.status !== "overdue") || [];

  function Group({ title, items, tone }) {
    if (items.length === 0) return null;
    return (
      <>
        <div
          className={`flex items-center justify-between border-t px-5 py-2 sm:px-6 ${
            tone === "warning"
              ? "border-clay/30 bg-clay-soft"
              : "border-line bg-paper/60"
          }`}
        >
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
              tone === "warning" ? "text-clay-ink" : "text-ink-faint"
            }`}
          >
            {title}
          </span>
          <span
            className={`data text-[11px] ${
              tone === "warning" ? "text-clay-ink" : "text-ink-faint"
            }`}
          >
            {items.length}
          </span>
        </div>

        <ul className="divide-y divide-line">
          {items.map((item, i) => (
            <li
              key={item.id}
              className="animate-rise-in"
              style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
            >
              <Link
                href={`/pets/${item.pet.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-paper/60 sm:px-6"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">
                      {item.pet.name}
                    </span>
                    <PetCode code={item.pet.petCode} size="sm" />
                    <DueChip status={item.status} label={item.label} />
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-soft">
                    {item.vaccine?.name || "Vaccination"}
                    {item.vaccine?.isCore ? " (core)" : ""}
                    {isStaff && item.owner ? ` · ${item.owner.name}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="data block text-[12px] text-ink-soft">
                    {formatDate(item.dueDate)}
                  </span>
                  <span className="block text-[11px] text-ink-faint">
                    last given {formatDate(item.lastGiven)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <PageHeader
      tab="Vaccinations"
      title={isStaff ? "Vaccinations due" : "My pets' vaccinations"}
      description={
        isStaff
          ? "Everything overdue or coming up across the clinic. Open a pet to record a dose."
          : "Vaccinations coming up for your pets. Your clinic will be in touch to book."
      }
      action={
        <div className="flex gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => setDays(w.id)}
              aria-pressed={days === w.id}
              className={[
                "rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                days === w.id
                  ? "border-jade bg-jade/10 text-jade-deep"
                  : "border-line-strong bg-white text-ink-soft hover:text-ink"
              ].join(" ")}
            >
              {w.label}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="divide-y divide-line border-t border-line">
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-5 py-3.5 sm:px-6">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border-t border-line px-6 py-10 text-center">
          <p className="text-[14px] text-ink">{error}</p>
          <Button variant="secondary" className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : data.due.length === 0 ? (
        <div className="border-t border-line">
          <EmptyState
            title="Nothing due"
            body={
              isStaff
                ? `No vaccinations are overdue or due in the next ${days} days. Record a dose on a pet's chart and it'll schedule the next one automatically.`
                : `None of your pets have a vaccination due in the next ${days} days.`
            }
            action={
              isStaff ? (
                <Link href="/pets"><Button>Go to pets</Button></Link>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <Group title="Overdue" items={overdue} tone="warning" />
          <Group title={`Due within ${days} days`} items={upcoming} />
          <div className="border-t border-line px-5 py-3 sm:px-6">
            <p className="data text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              {data.due.length} total · {data.counts.overdue} overdue
            </p>
          </div>
        </>
      )}
    </PageHeader>
  );
}
