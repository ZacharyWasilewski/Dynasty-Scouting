"use client";

import { useState } from "react";
import { RotateCcw, Loader2, Check } from "@/components/ui/SiteIcons";

interface Props {
  initialVersion: number;
  initialProspectCount: number;
}

export function AdminRefreshControl({ initialVersion, initialProspectCount }: Props) {
  const [state, setState] = useState<"idle" | "refreshing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(initialVersion);
  const [prospectCount, setProspectCount] = useState(initialProspectCount);
  const [justRefreshed, setJustRefreshed] = useState(false);

  async function handleRefresh() {
    // The button itself already disables while refreshing (below), but
    // this is the real guard — a second click during an in-flight
    // request is a no-op rather than a second concurrent refresh.
    if (state === "refreshing") return;
    setState("refreshing");
    setError(null);
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Refresh failed.");
        setState("error");
        return;
      }
      setVersion(data.version);
      setProspectCount(data.prospectCount);
      setJustRefreshed(true);
      setState("done");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setState("error");
    }
  }

  return (
    <div className="mt-8 border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-ink-tertiary">Data cache</p>
          <p className="mt-2 text-sm text-ink-secondary">
            Snapshot v{version} · {prospectCount} prospects loaded
            {justRefreshed && (
              <>
                {" · "}
                <span className="text-riser">refreshed just now</span>
              </>
            )}
          </p>
          <p className="mt-1 font-mono text-[10px] text-ink-tertiary">
            Normally refreshes automatically within 60s of a sheet edit — this forces it immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={state === "refreshing"}
          aria-label="Refresh data now"
          className="flex shrink-0 items-center gap-2 border border-border-strong px-3 py-2 text-xs font-semibold uppercase tracking-widest2 text-ink-secondary transition-colors duration-150 hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "refreshing" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : state === "done" ? (
            <Check className="h-3.5 w-3.5 text-riser" strokeWidth={2} />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          Refresh data now
        </button>
      </div>
      {error && (
        <p className="mt-3 border border-faller/30 bg-faller/10 px-3 py-2 text-xs text-faller">{error}</p>
      )}
    </div>
  );
}
