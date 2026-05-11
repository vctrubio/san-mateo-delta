// Reusable section block: small mono eyebrow on the left, optional hint on
// the right, content below. Used to group whatever the page wants to surface
// — KPI cards, charts, the AdminTable, etc.

export type AdminSectionProps = {
  eyebrow: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
};

export default function AdminSection({ eyebrow, hint, children }: AdminSectionProps) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2 px-1">
        <h2 className="text-xs font-mono uppercase tracking-[0.25em] text-slate-400">
          {eyebrow}
        </h2>
        {hint && <span className="text-xs font-mono text-slate-300">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
