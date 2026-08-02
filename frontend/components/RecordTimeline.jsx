"use client";

import { formatDate, relativeDate } from "@/lib/pets";
import AiBadge from "./AiBadge";

function Line({ label, value }) {
  if (!value) return null;
  return (
    <div className="mt-2 first:mt-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-[14px] leading-relaxed text-ink">{value}</p>
    </div>
  );
}

// Newest first. The rule down the left is the spine of the chart; each visit
// is a stop on it, dated in mono because a date is data.
export default function RecordTimeline({
  records, canEdit, canDelete, onEdit, onDelete, onOwnerSummary, isOwner
}) {
  return (
    <ol className="relative px-5 py-5 sm:px-6">
      <span
        className="absolute bottom-6 left-[calc(1.25rem+5px)] top-7 w-px bg-line sm:left-[calc(1.5rem+5px)]"
        aria-hidden="true"
      />

      {records.map((record, i) => (
        <li
          key={record.id}
          className="relative animate-rise-in pb-6 pl-7 last:pb-0"
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
        >
          <span
            className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 ${
              i === 0 ? "border-jade bg-jade" : "border-line-strong bg-white"
            }`}
            aria-hidden="true"
          />

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <time className="data text-[13px] font-medium text-ink">
              {formatDate(record.visitDate)}
            </time>
            <span className="text-[12px] text-ink-faint">{relativeDate(record.visitDate)}</span>
            {record.vet?.name && (
              <span className="text-[12px] text-ink-soft">seen by {record.vet.name}</span>
            )}
            {i === 0 && (
              <span className="chip border-jade/30 bg-jade/10 text-jade">Latest</span>
            )}
            {record.aiAssisted && <AiBadge />}
          </div>

          <div className="mt-2 rounded-lg border border-line bg-paper/50 p-4">
            <Line label="Symptoms" value={record.symptoms} />
            <Line label="Diagnosis" value={record.diagnosis} />
            <Line label="Treatment" value={record.treatment} />
            <Line label="Notes" value={record.notes} />

            {!record.symptoms && !record.diagnosis && !record.treatment && !record.notes && (
              <p className="text-[13px] text-ink-faint">No detail recorded for this visit.</p>
            )}

            {/* A released summary. Owners only ever receive approved text —
                the server withholds drafts entirely. */}
            {record.ownerSummary && record.ownerSummaryApproved && (
              <div className="mt-3 rounded-md border border-jade/25 bg-jade/5 p-3">
                <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-jade-deep">
                  {isOwner ? "What this means" : "Shared with the owner"}
                  {record.ownerSummaryAiAssisted && !isOwner && <AiBadge />}
                </p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                  {record.ownerSummary}
                </p>
              </div>
            )}

            {(canEdit || canDelete) && (
              <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-2.5">
                {canEdit && (
                  <button
                    onClick={() => onEdit(record)}
                    className="text-[12px] font-semibold text-jade underline underline-offset-2"
                  >
                    Edit
                  </button>
                )}
                {onOwnerSummary && (
                  <button
                    onClick={() => onOwnerSummary(record)}
                    className="text-[12px] font-semibold text-jade underline underline-offset-2"
                  >
                    {record.ownerSummaryApproved
                      ? "Owner summary"
                      : record.ownerSummary
                        ? "Owner summary (draft)"
                        : "Write owner summary"}
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDelete(record)}
                    className="text-[12px] font-semibold text-ink-faint underline underline-offset-2 hover:text-clay-ink"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
