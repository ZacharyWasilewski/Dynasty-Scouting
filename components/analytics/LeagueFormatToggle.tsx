"use client";

import { useLeagueFormat } from "@/components/analytics/LeagueFormatContext";

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors duration-150 ${
        active ? "bg-accent text-void" : "text-ink-tertiary hover:text-ink-secondary"
      }`}
    >
      {children}
    </button>
  );
}

export function LeagueFormatToggle() {
  const { qbFormat, tepFormat, setQbFormat, setTepFormat } = useLeagueFormat();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex border border-border bg-surface p-1">
        <SegButton active={qbFormat === "1QB"} onClick={() => setQbFormat("1QB")}>
          1QB
        </SegButton>
        <SegButton active={qbFormat === "SF"} onClick={() => setQbFormat("SF")}>
          SF
        </SegButton>
      </div>
      <div className="inline-flex border border-border bg-surface p-1">
        <SegButton active={tepFormat === "STANDARD"} onClick={() => setTepFormat("STANDARD")}>
          Standard
        </SegButton>
        <SegButton active={tepFormat === "TEP"} onClick={() => setTepFormat("TEP")}>
          TE+
        </SegButton>
      </div>
    </div>
  );
}
