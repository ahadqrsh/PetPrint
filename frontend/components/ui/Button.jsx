"use client";

const VARIANTS = {
  primary: "bg-jade text-white hover:bg-jade-deep border-transparent",
  secondary: "bg-white text-ink hover:bg-paper border-line-strong",
  danger: "bg-clay text-white hover:bg-clay-ink border-transparent",
  quiet: "bg-transparent text-ink-soft hover:text-ink hover:bg-paper border-transparent"
};

const SIZES = {
  sm: "px-2.5 py-1.5 text-[13px]",
  md: "px-4 py-2 text-sm"
};

export default function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md border font-semibold",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        full ? "w-full" : "",
        className
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
