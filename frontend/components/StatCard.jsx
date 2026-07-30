import Link from "next/link";
import Skeleton from "./ui/Skeleton";

/**
 * A cell in the ledger strip. Numerals are mono so columns line up, and the
 * whole cell becomes a link when there's somewhere useful to go.
 */
export default function StatCard({ label, value, href, note, loading, tone }) {
  const body = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</p>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-10" />
      ) : (
        <p
          className={`data mt-0.5 text-[1.6rem] font-medium leading-tight ${
            tone === "warning" && value > 0 ? "text-clay" : "text-ink"
          }`}
        >
          {value ?? "—"}
        </p>
      )}
      {note && <p className="mt-0.5 text-[12px] text-ink-faint">{note}</p>}
    </>
  );

  if (href && !loading) {
    return (
      <Link href={href} className="block px-5 py-4 transition-colors hover:bg-paper/70 sm:px-6">
        {body}
      </Link>
    );
  }
  return <div className="px-5 py-4 sm:px-6">{body}</div>;
}
