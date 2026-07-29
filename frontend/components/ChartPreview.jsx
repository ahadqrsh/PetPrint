// A specimen of the thing itself: one pet's chart as it looks inside the app.
// Static by design — it's a sample, not a live widget.
export default function ChartPreview() {
  return (
    <div className="my-10 max-w-sm select-none" aria-hidden="true">
      <div className="ml-4 inline-flex items-center gap-2 rounded-t-lg bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        Chart
      </div>
      <div className="rounded-lg rounded-tl-none bg-white p-4 shadow-2xl">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
            Biscuit
          </p>
          <span className="chip border-brass/40 bg-brass-soft text-[10px] text-brass">
            PET-2026-0042
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-ink-soft">Spaniel · Male · 4 yrs</p>

        <div className="mt-3 rounded border border-clay/30 bg-clay-soft px-2.5 py-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-clay-ink">
            Allergies
          </p>
          <p className="text-[12px] text-clay-ink">Penicillin · Chicken protein</p>
        </div>

        <div className="mt-3 space-y-2.5 border-t border-line pt-3">
          {[
            { date: "12 Jun 2026", note: "Ear infection — otic drops, 7 days" },
            { date: "04 Mar 2026", note: "Annual check — DHPP booster given" }
          ].map((row) => (
            <div key={row.date} className="flex gap-3">
              <span className="data w-[74px] shrink-0 text-[11px] text-ink-faint">
                {row.date}
              </span>
              <span className="text-[12px] leading-snug text-ink">{row.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
