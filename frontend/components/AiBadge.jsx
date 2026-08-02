/**
 * Marks anything the assistant touched. Deliberately plain rather than shiny:
 * this is a provenance label, not a feature boast, and it stays on a record
 * even after the vet has rewritten every word.
 */
export default function AiBadge({ label = "AI-assisted", title }) {
  return (
    <span
      title={title || "A draft from the documentation assistant contributed to this text."}
      className="chip border-line-strong bg-paper text-ink-soft"
    >
      {label}
    </span>
  );
}
