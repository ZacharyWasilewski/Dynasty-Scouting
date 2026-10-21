import { Check } from "@/components/ui/SiteIcons";
import { cn } from "@/lib/utils";

/** Small, self-contained presentational primitives used on the Mock
 *  Draft setup screen — extracted from MockDraftExperience.tsx (which
 *  was 2,200+ lines) alongside AvailablePlayerRow and ResultsScreen.
 *  None of these ever referenced that component's own state, only
 *  their own props. */

export function Segment<T extends string | number>({ label, options, value, onChange, display }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; display?: (v: T) => string }) {
  return <div><label className="mb-2 block text-[10px] font-semibold text-ink-tertiary">{label}</label><div className="grid grid-cols-3 gap-1.5">{options.map((option) => <button key={String(option)} onClick={() => onChange(option)} className={cn("min-h-10 border px-2 py-2.5 text-xs font-semibold transition-all", value === option ? "border-accent bg-accent text-white shadow-[0_8px_18px_-14px_rgba(37,99,235,.9)]" : "border-border-strong bg-surface-raised text-ink-secondary hover:border-accent/50 hover:text-ink")}>{display ? display(option) : option}</button>)}</div></div>;
}

export function EngineCard({ active, onClick, title, short, description }: { active: boolean; onClick: () => void; title: string; short: string; description: string }) {
  return <button onClick={onClick} className={cn("group flex items-center gap-3 border p-3.5 text-left transition-all", active ? "border-accent bg-accent/5 shadow-[0_12px_28px_-24px_rgba(37,99,235,.8)]" : "border-border-strong bg-surface-raised hover:border-accent/50 hover:bg-surface")}><span className={cn("flex h-11 w-11 shrink-0 items-center justify-center border font-mono text-xs font-bold transition-colors", active ? "border-accent bg-accent text-white" : "border-border text-accent group-hover:border-accent/40")}>{short}</span><span className="min-w-0"><span className="block text-sm font-semibold text-ink">{title}</span><span className="mt-1 block text-xs leading-relaxed text-ink-tertiary">{description}</span></span>{active && <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white"><Check className="h-3.5 w-3.5" /></span>}</button>;
}

export function DraftTypeCard({ active, onClick, title, description }: { active: boolean; onClick: () => void; title: string; description: string }) {
  return <button onClick={onClick} className={cn("group border p-4 text-left transition-all", active ? "border-accent bg-accent/5 shadow-[0_12px_28px_-24px_rgba(37,99,235,.8)]" : "border-border-strong bg-surface-raised hover:border-accent/50 hover:bg-surface")}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-ink">{title}</span>{active && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white"><Check className="h-3.5 w-3.5" /></span>}</div><p className="mt-1.5 text-xs leading-relaxed text-ink-tertiary">{description}</p></button>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border border-border bg-surface-raised p-2"><p className="text-[10px] text-ink-tertiary">{label}</p><p className="mt-1 truncate text-xs font-semibold text-ink">{value}</p></div>;
}
