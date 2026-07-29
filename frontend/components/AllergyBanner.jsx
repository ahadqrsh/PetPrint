// The first thing a vet must see. Clay is reserved for exactly this.
export default function AllergyBanner({ allergies = [], chronicConditions = [] }) {
  const hasAllergies = allergies.length > 0;
  const hasConditions = chronicConditions.length > 0;
  if (!hasAllergies && !hasConditions) return null;

  return (
    <div
      role="note"
      className={`border-y px-5 py-4 sm:px-6 ${
        hasAllergies ? "border-clay/30 bg-clay-soft" : "border-line bg-paper"
      }`}
    >
      {hasAllergies && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-clay-ink">
            Allergies — do not administer
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {allergies.map((a) => (
              <span
                key={a}
                className="rounded border border-clay/40 bg-white px-2 py-0.5 text-[13px] font-semibold text-clay-ink"
              >
                {a}
              </span>
            ))}
          </p>
        </div>
      )}

      {hasConditions && (
        <div className={hasAllergies ? "mt-3 border-t border-clay/20 pt-3" : ""}>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Ongoing conditions
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5">
            {chronicConditions.map((c) => (
              <span
                key={c}
                className="rounded border border-line-strong bg-white px-2 py-0.5 text-[13px] text-ink"
              >
                {c}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
