// The pet's code, set as an engraved brass tag — the one place brass appears
// in the content area, because this is the thing that gets printed and worn.
export default function PetCode({ code, size = "md" }) {
  const scale = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-brass/40 bg-brass-soft font-mono uppercase tracking-[0.1em] text-brass ${scale}`}
    >
      <span className="h-1 w-1 rounded-full bg-brass/60" aria-hidden="true" />
      {code}
    </span>
  );
}
