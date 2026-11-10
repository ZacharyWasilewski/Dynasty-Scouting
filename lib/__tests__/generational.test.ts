import { describe, expect, it } from "vitest";
import { isGenerationalProfile } from "../generational";

const s = (label: string, value?: number, extra: object = {}) => ({ label, value, ...extra });

describe("isGenerationalProfile", () => {
  it("requires an average percentile above 90", () => {
    expect(isGenerationalProfile({ subScores: [s("Size", 85), s("Speed", 95), s("Age", 100)] })).toBe(true); // avg 93.3
    expect(isGenerationalProfile({ subScores: [s("Size", 80), s("Speed", 95), s("Age", 95)] })).toBe(false); // avg 90
    expect(isGenerationalProfile({ subScores: [s("Size", 70), s("Speed", 95), s("Age", 100)] })).toBe(false); // avg 88.3
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
