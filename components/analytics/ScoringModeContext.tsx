"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialStateFor, saveState } from "@/lib/formatPersistence";

export type ScoringMode = "standard" | "weighted";

const STORAGE_KEY = "analyticsScoringMode";
const VALID_MODES: readonly ScoringMode[] = ["standard", "weighted"];

interface ScoringModeContextValue {
  mode: ScoringMode;
  setMode: (mode: ScoringMode) => void;
}

const ScoringModeContext = createContext<ScoringModeContextValue | undefined>(undefined);

export function ScoringModeProvider({ children }: { children: ReactNode }) {
  // Always starts at the default (matches SSR output, avoids a hydration
  // mismatch), then restores the last-used mode in an effect — but only
  // if this mount is really the result of a genuine browser Back/Forward
  // into this page. A fresh visit or a normal link click stays default.
  const [mode, setModeState] = useState<ScoringMode>("standard");

  useEffect(() => {
    const restored = initialStateFor(STORAGE_KEY, "standard", VALID_MODES);
    if (restored !== "standard") setModeState(restored);
  }, []);

  function setMode(next: ScoringMode) {
    setModeState(next);
    saveState(STORAGE_KEY, next);
  }

  return (
    <ScoringModeContext.Provider value={{ mode, setMode }}>{children}</ScoringModeContext.Provider>
  );
}

/** Reads the current scoring mode. Must be used under a ScoringModeProvider. */
export function useScoringMode(): ScoringModeContextValue {
  const ctx = useContext(ScoringModeContext);
  if (!ctx) {
    throw new Error("useScoringMode must be used within a ScoringModeProvider");
  }
  return ctx;
}
