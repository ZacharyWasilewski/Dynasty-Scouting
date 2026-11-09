import { describe, expect, it } from "vitest";
import { isGenerationalProfile } from "../generational";

const s = (label: string, value?: number, extra: object = {}) => ({ label, value, ...extra });

describe("isGenerationalProfile", () => {
  it("requires 95+ on every percentile subscore", () => {
    expect(isGenerationalProfile({ subScores: [s("Size", 95), s("Speed", 99), s("Age", 100)] })).toBe(true);
    expect(isGenerationalProfile({ subScores: [s("Size", 95), s("Speed", 94.9), s("Age", 100)] })).toBe(false);
  });
  it("ignores text and pending subscores", () => {
    expect(
      isGenerationalProfile({
        subScores: [s("Size", 96), s("Speed", 97), s("Draft Capital", 98), s("Opportunity", undefined, { text: "QB1" }), s("Mock", undefined, { text: "TBD", isPending: true })],
      })
    ).toBe(true);
  });
  it("needs at least three percentile subscores", () => {
    expect(isGenerationalProfile({ subScores: [s("Size", 99), s("Speed", 99)] })).toBe(false);
    expect(isGenerationalProfile({})).toBe(false);
  });
});
