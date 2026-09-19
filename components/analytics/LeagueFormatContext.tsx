"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { QbFormat, TepFormat, LeagueFormatSelection } from "@/lib/analytics";
import { initialStateFor, saveState } from "@/lib/formatPersistence";
import { getGlobalFormat, reportFormatUsed } from "@/lib/globalFormat";

const QB_KEY = "analyticsQbFormat";
const TEP_KEY = "analyticsTepFormat";
const VALID_QB: readonly QbFormat[] = ["1QB", "SF"];
const VALID_TEP: readonly TepFormat[] = ["STANDARD", "TEP"];

interface LeagueFormatContextValue {
  qbFormat: QbFormat;
  tepFormat: TepFormat;
  setQbFormat: (v: QbFormat) => void;
  setTepFormat: (v: TepFormat) => void;
  selection: LeagueFormatSelection;
}

const LeagueFormatContext = createContext<LeagueFormatContextValue | undefined>(undefined);

export function LeagueFormatProvider({ children }: { children: ReactNode }) {
  // Same rule as ScoringModeProvider: default first (matches SSR),
  // restore in an effect only on a genuine Back/Forward into this page.
  // Otherwise falls back to the same sticky cross-page format
  // preference every other listing page uses (lib/globalFormat), so
  // Analytics' toggle isn't its own separate silo from the rest of
  // the site.
  const [qbFormat, setQbFormatState] = useState<QbFormat>("SF");
  const [tepFormat, setTepFormatState] = useState<TepFormat>("STANDARD");

  useEffect(() => {
    const restoredQb = initialStateFor(QB_KEY, "SF", VALID_QB);
    const restoredTep = initialStateFor(TEP_KEY, "STANDARD", VALID_TEP);
    if (restoredQb !== "SF" || restoredTep !== "STANDARD") {
      // A genuine Back/Forward into this exact page — trust it over
      // the sticky global default.
      setQbFormatState(restoredQb);
      setTepFormatState(restoredTep);
      return;
    }
    const global = getGlobalFormat();
    setQbFormatState(global === "SUPERFLEX" || global === "SUPERFLEX_TEP" ? "SF" : "1QB");
    setTepFormatState(global === "1QB_TEP" || global === "SUPERFLEX_TEP" ? "TEP" : "STANDARD");
  }, []);

  function reportGlobal(nextQb: QbFormat, nextTep: TepFormat) {
    const format = nextQb === "SF"
      ? (nextTep === "TEP" ? "SUPERFLEX_TEP" : "SUPERFLEX")
      : (nextTep === "TEP" ? "1QB_TEP" : "1QB");
    reportFormatUsed(format);
  }

  function setQbFormat(next: QbFormat) {
    setQbFormatState(next);
    saveState(QB_KEY, next);
    reportGlobal(next, tepFormat);
  }
  function setTepFormat(next: TepFormat) {
    setTepFormatState(next);
    saveState(TEP_KEY, next);
    reportGlobal(qbFormat, next);
  }

  return (
    <LeagueFormatContext.Provider
      value={{ qbFormat, tepFormat, setQbFormat, setTepFormat, selection: { qbFormat, tepFormat } }}
    >
      {children}
    </LeagueFormatContext.Provider>
  );
}

/** Reads the current league-format selection. Must be used under a LeagueFormatProvider. */
export function useLeagueFormat(): LeagueFormatContextValue {
  const ctx = useContext(LeagueFormatContext);
  if (!ctx) {
    throw new Error("useLeagueFormat must be used within a LeagueFormatProvider");
  }
  return ctx;
}
