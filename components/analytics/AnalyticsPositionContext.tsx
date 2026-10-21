"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialStateFor, saveState } from "@/lib/formatPersistence";

// Deliberately the narrow "QB"|"RB"|"WR"|"TE" union, not the wider
// Position type from types/prospect.ts (which also includes values
// like "FB") — CalibrationCurveChart specifically requires this exact
// narrower type, and a wider type isn't safely assignable to it. The
// narrow type IS safely assignable everywhere the wider Position type
// is expected, so this stays compatible with all three consumers.
export type AnalyticsPosition = "QB" | "RB" | "WR" | "TE";

const STORAGE_KEY = "analyticsScoreQualityPosition";
const VALID_POSITIONS: readonly AnalyticsPosition[] = ["QB", "RB", "WR", "TE"];

interface AnalyticsPositionContextValue {
  position: AnalyticsPosition;
  setPosition: (position: AnalyticsPosition) => void;
}

const AnalyticsPositionContext = createContext<AnalyticsPositionContextValue | undefined>(undefined);

/**
 * CalibrationCurveChart, SubScoreSignalChart, and OpportunityHitRateChart
 * each used to keep their own independent position filter, always
 * defaulting back to QB — meaning picking WR in one and scrolling to
 * the next chart silently reset it, three separate re-selections to
 * read the whole Score Quality section for one position. This shares
 * one selection across all three, same persistence pattern as the
 * page's existing ScoringModeProvider/LeagueFormatProvider.
 */
export function AnalyticsPositionProvider({ children }: { children: ReactNode }) {
  const [position, setPositionState] = useState<AnalyticsPosition>("QB");

  useEffect(() => {
    const restored = initialStateFor(STORAGE_KEY, "QB", VALID_POSITIONS);
    if (restored !== "QB") setPositionState(restored);
  }, []);

  function setPosition(next: AnalyticsPosition) {
    setPositionState(next);
    saveState(STORAGE_KEY, next);
  }

  return (
    <AnalyticsPositionContext.Provider value={{ position, setPosition }}>{children}</AnalyticsPositionContext.Provider>
  );
}

/** Reads the shared Score Quality position filter. Must be used under an AnalyticsPositionProvider. */
export function useAnalyticsPosition(): AnalyticsPositionContextValue {
  const ctx = useContext(AnalyticsPositionContext);
  if (!ctx) {
    throw new Error("useAnalyticsPosition must be used within an AnalyticsPositionProvider");
  }
  return ctx;
}
