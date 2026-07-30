"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import ListingImage from "@/components/ListingImage";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatDate, relativeDate } from "@/lib/pets";

export default function ApplicationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isStaff = user.role !== "owner";

  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState(isStaff ? "applied" : "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState(null); // { application, status }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filter === "all" ? {} : { status: filter };
      const res = await api.get("/adoptions/applications", { params });
      setApplications(res.data.applications);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function decide() {
    setBusy(true);
    try {
      await api.put(`/adoptions/applications/${decision.application.id}`, {
        status: decision.status
      });
      toast(
        decision.status === "approved"
          ? `${decision.application.applicant?.name || "Applicant"} approved — ${decision.application.listing?.name} marked adopted`
          : "Application rejected"
      );
      setDecision(null);
      load();
    } catch (err) {
      toast(apiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const filters = [
    { id: isStaff ? "applied" : "all", label: isStaff ? "Awaiting review" : "All" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: isStaff ? "Rejected" : "Not chosen" },
    ...(isStaff ? [{ id: "all", label: "All" }] : [])
  ];

  return (
    <PageHeader
      tab={isStaff ? "Review queue" : "My applications"}
      title={isStaff ? "Adoption applications" : "My applications"}
      description={
        isStaff
          ? "Approving one application marks the animal adopted and turns down everyone else waiting on it."
          : "Every application you've sent, and where each one stands."
      }
      action={
        <Link href="/adoptions">
          <Button variant="secondary">{isStaff ? "Listings" : "Browse animals"}</Button>
        </Link>
      }
    >
      <div className="flex flex-wrap gap-1.5 border-t border-line px-5 py-4 sm:px-6">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={[
              "rounded-md border px-3 py-1.5 text-[13px] font-semibold transition-colors",
              filter === f.id
                ? "border-jade bg-jade/10 text-jade-deep"
                : "border-line-strong bg-white text-ink-soft hover:text-ink"
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="divide-y divide-line border-t border-line">
          {[0, 1].map((i) => (
            <div key={i} className="px-5 py-4 sm:px-6">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border-t border-line px-6 py-10 text-center">
          <p className="text-[14px] text-ink">{error}</p>
          <Button variant="secondary" className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : applications.length === 0 ? (
        <div className="border-t border-line">
          <EmptyState
            title={isStaff ? "Nothing to review" : "No applications yet"}
            body={
              isStaff
                ? "Applications from owners at this clinic will appear here as they arrive."
                : "When you apply to adopt an animal, you'll be able to track it here."
            }
            action={
              !isStaff ? (
                <Link href="/adoptions"><Button>Browse animals</Button></Link>
              ) : null
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {applications.map((app, i) => (
            <li
              key={app.id}
              className="animate-rise-in px-5 py-4 sm:px-6"
              style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
            >
              <div className="flex gap-4">
                {app.listing && (
                  <Link href={`/adoptions/${app.listing.id}`} className="shrink-0">
                    <ListingImage
                      src={app.listing.imageUrl}
                      alt={app.listing.name}
                      species={app.listing.species}
                      className="h-16 w-16 rounded border border-line"
                    />
                  </Link>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      {app.listing ? (
                        <Link
                          href={`/adoptions/${app.listing.id}`}
                          className="text-[15px] font-semibold text-ink hover:underline"
                        >
                          {app.listing.name}
                        </Link>
                      ) : (
                        <span className="text-[15px] font-semibold text-ink-faint">
                          Listing removed
                        </span>
                      )}
                      <p className="text-[12px] text-ink-soft">
                        {formatDate(app.createdAt)} · {relativeDate(app.createdAt)}
                      </p>
                    </div>
                    <StatusChip status={app.status} />
                  </div>

                  {isStaff && app.applicant && (
                    <div className="mt-2.5 flex items-center gap-2.5 rounded-md border border-line bg-paper px-3 py-2">
                      <Avatar name={app.applicant.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {app.applicant.name}
                        </p>
                        <p className="truncate text-[12px] text-ink-soft">
                          {app.applicant.email}
                          {app.applicant.phone ? ` · ${app.applicant.phone}` : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {app.message ? (
                    <p className="mt-2.5 whitespace-pre-line rounded-md border border-line bg-white px-3 py-2 text-[13px] leading-relaxed text-ink">
                      {app.message}
                    </p>
                  ) : (
                    <p className="mt-2.5 text-[13px] text-ink-faint">No message was included.</p>
                  )}

                  {isStaff && app.status === "applied" && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setDecision({ application: app, status: "approved" })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDecision({ application: app, status: "rejected" })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        onConfirm={decide}
        busy={busy}
        title={
          decision?.status === "approved"
            ? `Approve ${decision?.application.applicant?.name || "this applicant"}?`
            : "Reject this application?"
        }
        body={
          decision?.status === "approved"
            ? `${decision?.application.listing?.name} will be marked adopted, and any other open applications for them will be turned down automatically.`
            : "The applicant will see that they weren't chosen. Other applications stay open."
        }
        confirmLabel={decision?.status === "approved" ? "Approve" : "Reject"}
      />
    </PageHeader>
  );
}
