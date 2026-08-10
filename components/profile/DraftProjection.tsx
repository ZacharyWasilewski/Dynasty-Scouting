import { Target } from "lucide-react";

export function DraftProjection({ label }: { label: string }) {
  return (
    <div className="border border-accent/30 bg-accent/[0.06] p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
          <Target className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest2 text-accent">
            Draft Projection
          </h3>
          <p className="mt-0.5 font-display text-lg font-semibold text-ink">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
