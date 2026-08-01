// Vaccination urgency shares the app's existing colour vocabulary:
// clay = act now, brass = coming up, jade = in hand, grey = can't tell.
const TONES = {
  overdue: "border-clay/40 bg-clay-soft text-clay-ink",
  due: "border-brass/40 bg-brass-soft text-brass",
  upcoming: "border-jade/30 bg-jade/10 text-jade-deep",
  unknown: "border-line-strong bg-paper text-ink-soft"
};

export default function DueChip({ status, label }) {
  return <span className={`chip ${TONES[status] || TONES.unknown}`}>{label}</span>;
}
