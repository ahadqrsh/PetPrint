export default function Avatar({ name = "", size = "md" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const sizes = {
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-[12px]"
  };

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-jade/10 font-mono font-semibold text-jade-deep ${sizes[size]}`}
    >
      {initials || "?"}
    </span>
  );
}
