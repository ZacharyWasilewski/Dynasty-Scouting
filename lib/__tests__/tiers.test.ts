import { describe, it, expect } from "vitest";
import { getTierForScore, getTierColor } from "@/lib/tiers";

describe("getTierForScore", () => {
  it("returns undefined for undefined input", () => {
    expect(getTierForScore(undefined)).toBeUndefined();
  });

  it("uses inclusive lower bounds at each tier boundary", () => {
    expect(getTierForScore(95)).toBe("Generational");
    expect(getTierForScore(94.9)).toBe("Elite");
    expect(getTierForScore(84)).toBe("Elite");
    expect(getTierForScore(83.9)).toBe("Starter");
    expect(getTierForScore(74)).toBe("Starter");
    expect(getTierForScore(63)).toBe("Flex");
    expect(getTierForScore(53)).toBe("Upside Shot");
    expect(getTierForScore(42)).toBe("Bench");
    expect(getTierForScore(30)).toBe("Taxi Squad");
    expect(getTierForScore(0)).toBe("Roster Clogger");
  });

  it("returns undefined below the lowest tier's floor", () => {
    expect(getTierForScore(-1)).toBeUndefined();
  });
});

describe("getTierColor", () => {
  it("returns the defined hex color for a known tier", () => {
    expect(getTierColor("Generational")).toBe("#7C3AED");
    expect(getTierColor("Roster Clogger")).toBe("#DC2626");
  });
});
