// Listing and application status share one vocabulary of colour:
// jade = open/good, brass = waiting on a human, petrol = settled, clay = no.
const TONES = {
  available: "border-jade/30 bg-jade/10 text-jade-deep",
  pending: "border-brass/40 bg-brass-soft text-brass",
  adopted: "border-petrol/25 bg-petrol/10 text-petrol",
  applied: "border-brass/40 bg-brass-soft text-brass",
  approved: "border-jade/30 bg-jade/10 text-jade-deep",
  rejected: "border-line-strong bg-paper text-ink-soft"
};

const LABELS = {
  available: "Available",
  pending: "Application pending",
  adopted: "Adopted",
  applied: "Awaiting review",
  approved: "Approved",
  rejected: "Not chosen"
};

export default function StatusChip({ status, label }) {
  return (
    <span className={`chip ${TONES[status] || TONES.rejected}`}>
      {label || LABELS[status] || status}
    </span>
  );
}
