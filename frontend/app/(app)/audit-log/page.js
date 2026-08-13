"use client";

import { useCallback, useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import Protected from "@/components/Protected";
import PageHeader from "@/components/PageHeader";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { formatDate } from "@/lib/pets";

// Maps each raw action code to a plain-language label and a tone. Colour
// vocabulary matches the rest of the app: clay for account-security events
// worth noticing, jade for routine positive events, grey for everything else.
const ACTION_META = {
  "login.success": { label: "Signed in", tone: "default" },
  "login.failed": { label: "Failed sign-in attempt", tone: "warning" },
  "login.locked": { label: "Account locked (too many attempts)", tone: "warning" },
  "password.reset_requested": { label: "Password reset requested", tone: "warning" },
  "password.reset_completed": { label: "Password reset completed", tone: "warning" },
  "vet.deactivated": { label: "Vet deactivated", tone: "warning" },
  "vet.activated": { label: "Vet reactivated", tone: "default" },
  "pet.deleted": { label: "Pet deleted", tone: "warning" },
  "pet.restored": { label: "Pet restored", tone: "default" },
  "record.deleted": { label: "Medical record deleted", tone: "warning" },
  "record.restored": { label: "Medical record restored", tone: "default" },
  "export.csv": { label: "Exported records as CSV", tone: "warning" },
  "export.pdf": { label: "Exported a PDF history", tone: "default" },
  "ai.draft_used": { label: "Used the AI documentation assistant", tone: "default" }
};

function describeDetail(action, detail) {
  if (!detail || Object.keys(detail).length === 0) return "";
  if (action.startsWith("vet.")) return detail.vetName || "";
  if (action.startsWith("pet.")) return detail.petName || "";
  if (action === "export.csv") return typeof detail.rows === "number" ? `${detail.rows} rows` : "";
  if (action === "login.failed" || action === "login.locked") return detail.email || "";
  return "";
}

const ACTIONS = Object.keys(ACTION_META);

function AuditLogView() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 50 };
      if (actionFilter) params.action = actionFilter;
      const res = await api.get("/audit-log", { params });
      setData(res.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageHeader
      tab="Audit log"
      title="Activity log"
      description="Who did what, and when. Sensitive actions — sign-ins, deletions, exports — are recorded here permanently."
      action={
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-line-strong bg-white px-3 py-1.5 text-[13px] text-ink"
        >
          <option value="">All activity</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{ACTION_META[a].label}</option>
          ))}
        </select>
      }
    >
      {loading ? (
        <div className="divide-y divide-line border-t border-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-5 py-3.5 sm:px-6">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-1.5 h-3 w-32" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border-t border-line px-6 py-10 text-center">
          <p className="text-[14px] text-ink">{error}</p>
          <Button variant="secondary" className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : data.entries.length === 0 ? (
        <div className="border-t border-line">
          <EmptyState title="Nothing recorded yet" body="Activity will appear here as your clinic uses PetPrint." />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line border-t border-line">
            {data.entries.map((entry) => {
              const meta = ACTION_META[entry.action] || { label: entry.action, tone: "default" };
              const detail = describeDetail(entry.action, entry.detail);
              return (
                <li key={entry.id} className="flex items-start justify-between gap-4 px-5 py-3.5 sm:px-6">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`text-[14px] font-medium ${meta.tone === "warning" ? "text-clay-ink" : "text-ink"}`}>
                        {meta.label}
                      </span>
                      {detail && <span className="text-[13px] text-ink-soft">— {detail}</span>}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink-faint">
                      {entry.actorName ? `${entry.actorName} (${entry.actorRole})` : "System"}
                    </span>
                  </span>
                  <span className="data shrink-0 text-[12px] text-ink-faint">
                    {formatDate(entry.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-line px-5 py-3 sm:px-6">
            <p className="data text-[11px] uppercase tracking-[0.14em] text-ink-faint">
              Page {data.page} of {data.totalPages || 1} · {data.total} total
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </PageHeader>
  );
}

export default function Page() {
  return (
    <Protected roles={["admin"]}>
      <AuditLogView />
    </Protected>
  );
}
