import { describe, it, expect } from "vitest";
import {
  formatPick,
  normalizePlayerName,
  getCommunityFormatKey,
  getCommunityFormatLabel,
  deriveIsUserTurn,
  deriveManualEntryLimit,
} from "@/lib/mockDraft";

describe("formatPick", () => {
  it("formats the first and last pick of round 1", () => {
    expect(formatPick(1, 12)).toBe("1.01");
    expect(formatPick(12, 12)).toBe("1.12");
  });

  it("rolls over into round 2 correctly", () => {
    expect(formatPick(13, 12)).toBe("2.01");
    expect(formatPick(25, 12)).toBe("3.01");
  });

  it("pads single-digit slots with a leading zero", () => {
    expect(formatPick(9, 12)).toBe("1.09");
  });

  it("works for a non-12-team league size", () => {
    expect(formatPick(30, 10)).toBe("3.10");
  });
});

describe("normalizePlayerName", () => {
  it("normalizes curly quotes to straight ones", () => {
    expect(normalizePlayerName("Ja\u2019Marr Chase")).toBe("ja'marr chase");
  });

  it("strips trademark/registered symbols", () => {
    expect(normalizePlayerName("CJ Stroud\u00AE")).toBe("cj stroud");
  });

  it("collapses whitespace, trims, and lowercases", () => {
    expect(normalizePlayerName("  Bryce   Young  ")).toBe("bryce young");
  });
});

describe("getCommunityFormatKey", () => {
  it("maps all four QB/TE combinations to the right FantasyCalc board", () => {
    expect(getCommunityFormatKey("1QB", "STANDARD")).toBe("FC_1QB_STANDARD");
    expect(getCommunityFormatKey("1QB", "TEP")).toBe("FC_1QB_TE_PLUS");
    expect(getCommunityFormatKey("SUPERFLEX", "STANDARD")).toBe("FC_SF_STANDARD");
    expect(getCommunityFormatKey("SUPERFLEX", "TEP")).toBe("FC_SF_TE_PLUS");
  });
});

describe("getCommunityFormatLabel", () => {
  it("builds a readable label for each format", () => {
    expect(getCommunityFormatLabel("1QB", "STANDARD")).toBe("1 QB · Off");
    expect(getCommunityFormatLabel("SUPERFLEX", "TEP")).toBe("Superflex · TE+");
  });
});

describe("deriveIsUserTurn", () => {
  it("falls back to the simple single-slot model when real pick order isn't active", () => {
    expect(deriveIsUserTurn(5, 5, 5, null)).toBe(true);
    expect(deriveIsUserTurn(5, 5, 7, null)).toBe(false);
  });

  it("uses real ownership when active, regardless of the simple slot value", () => {
    const owned = new Set([1, 9, 15]);
    // currentSlot/slot both say "not my turn" under the simple model,
    // but this exact overall pick is one of the user's real picks —
    // real order must win.
    expect(deriveIsUserTurn(9, 9, 3, owned)).toBe(true);
    expect(deriveIsUserTurn(10, 10, 3, owned)).toBe(false);
  });

  it("correctly reflects a non-contiguous ownership pattern across rounds — the exact scenario a single slot number can't represent", () => {
    // Owns pick 5 in round 1, no pick at all in round 2, an extra
    // pick (9) in round 3 on top of a normal one (15).
    const owned = new Set([5, 9, 15]);
    expect(deriveIsUserTurn(5, 5, 5, owned)).toBe(true); // round 1, owned
    expect(deriveIsUserTurn(17, 5, 5, owned)).toBe(false); // round 2 slot 5 (17 = round2 in a 12-team), not owned
    expect(deriveIsUserTurn(9, 9, 5, owned)).toBe(true); // extra acquired pick
  });
});

describe("deriveManualEntryLimit", () => {
  it("falls back to slot - 1 when real pick order isn't active", () => {
    expect(deriveManualEntryLimit(null, 5)).toBe(4);
    expect(deriveManualEntryLimit(new Set(), 5)).toBe(4);
  });

  it("uses the user's first real owned pick, minus one, when real order is active", () => {
    const owned = new Set([9, 15, 21]);
    expect(deriveManualEntryLimit(owned, 5)).toBe(8); // min(9,15,21) - 1, NOT slot-based
  });

  it("never goes negative even if the user's first owned pick is pick 1", () => {
    const owned = new Set([1, 9]);
    expect(deriveManualEntryLimit(owned, 5)).toBe(0);
  });

  it("REGRESSION: does not silently evaluate to slot-1=0 when real order is active and slot is stale at its default — this was a real shipped bug that hid the entire manual-entry panel", () => {
    // slot defaults to 1 and isn't meaningfully updated once real
    // order takes over — the old buggy behavior (slot - 1) would
    // have produced 0 here regardless of real ownership, hiding the
    // manual-entry panel outright. The fix uses real ownership
    // instead whenever it's available.
    const owned = new Set([9]);
    const staleDefaultSlot = 1;
    expect(deriveManualEntryLimit(owned, staleDefaultSlot)).toBe(8);
    expect(deriveManualEntryLimit(owned, staleDefaultSlot)).not.toBe(0);
  });
});
