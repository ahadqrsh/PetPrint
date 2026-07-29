export default function EmptyState({ title, body, action }) {
  return (
    <div className="px-6 py-14 text-center">
      {/* A blank tab on an empty file — the signature, at rest. */}
      <div className="mx-auto mb-4 w-16">
        <div className="ml-1 h-2 w-7 rounded-t border border-line-strong border-b-0 bg-paper" />
        <div className="h-10 rounded border border-line-strong bg-paper" />
      </div>
      <h2 className="text-base">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-soft">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
