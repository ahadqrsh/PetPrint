// The folder tab + sheet header. `tab` names the section of the file you're
// looking at; the sheet below carries the title, a one-line explanation of
// what the page is for, and any page-level action.
export default function PageHeader({ tab, title, description, action, children }) {
  return (
    <div className="animate-rise-in">
      <div className="file-tab">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" />
        {tab}
      </div>
      <div className="file-sheet">
        <header className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h1>{title}</h1>
            {description && (
              <p className="mt-1 max-w-prose text-[14px] text-ink-soft">{description}</p>
            )}
          </div>
          {action}
        </header>
        {children}
      </div>
    </div>
  );
}
