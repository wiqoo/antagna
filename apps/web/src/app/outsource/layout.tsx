// The external module owns its own auth surface (independent login at
// /outsource/login). Each section self-gates (requireVolt / requirePartner), so
// this layout is just the dark wrapper — no nav, no auth — to keep login/invite
// pages free of the management chrome and avoid redirect loops.
export default function ExternalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">{children}</div>;
}
