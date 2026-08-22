import { describe, it, expect } from "vitest";
import { resolveTeamId } from "@/lib/collegePhotos";

describe("resolveTeamId", () => {
  it("uses the confirmed override for BSU (Boise State) instead of ESPN's own colliding 'BSU' entry", () => {
    // Simulates ESPN's real team index containing a DIFFERENT school
    // under the literal "BSU" abbreviation — the override must win
    // regardless of what's actually in the index for that key.
    const teamIndex = new Map([["BSU", "9999-wrong-school"]]);
    expect(resolveTeamId("BSU", teamIndex)).toBe("68");
  });

  it("uses the confirmed override for CC (Coastal Carolina), not ESPN's own 'CC' (Curry College)", () => {
    const teamIndex = new Map([["CC", "9999-wrong-school"]]);
    expect(resolveTeamId("CC", teamIndex)).toBe("324");
  });

  it("uses the confirmed override for MARY (Maryland)", () => {
    const teamIndex = new Map([["MARY", "9999-wrong-school"]]);
    expect(resolveTeamId("MARY", teamIndex)).toBe("120");
  });

  it("is case-insensitive on the input abbreviation", () => {
    const teamIndex = new Map<string, string>();
    expect(resolveTeamId("bsu", teamIndex)).toBe("68");
    expect(resolveTeamId("Bsu", teamIndex)).toBe("68");
  });

  it("falls back to the normal abbreviation-based lookup for any school with no override", () => {
    const teamIndex = new Map([["TEX", "251"]]);
    expect(resolveTeamId("TEX", teamIndex)).toBe("251");
  });

  it("returns undefined (not throw) for a school that resolves nowhere at all", () => {
    expect(resolveTeamId("NOT A REAL SCHOOL", new Map())).toBeUndefined();
  });
});
