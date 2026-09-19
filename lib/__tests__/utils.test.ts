import { describe, it, expect } from "vitest";
import { ordinalSuffix } from "@/lib/utils";

describe("ordinalSuffix", () => {
  it("handles the standard 1st/2nd/3rd/4th cases", () => {
    expect(ordinalSuffix(1)).toBe("1st");
    expect(ordinalSuffix(2)).toBe("2nd");
    expect(ordinalSuffix(3)).toBe("3rd");
    expect(ordinalSuffix(4)).toBe("4th");
  });

  it("handles the 11/12/13 exception (always 'th', never st/nd/rd)", () => {
    expect(ordinalSuffix(11)).toBe("11th");
    expect(ordinalSuffix(12)).toBe("12th");
    expect(ordinalSuffix(13)).toBe("13th");
    expect(ordinalSuffix(111)).toBe("111th");
    expect(ordinalSuffix(112)).toBe("112th");
    expect(ordinalSuffix(113)).toBe("113th");
  });

  it("resumes st/nd/rd immediately after the 11-13 exception", () => {
    expect(ordinalSuffix(21)).toBe("21st");
    expect(ordinalSuffix(22)).toBe("22nd");
    expect(ordinalSuffix(23)).toBe("23rd");
  });

  it("gets the two cases that were bugged before this fix", () => {
    expect(ordinalSuffix(91)).toBe("91st");
    expect(ordinalSuffix(82)).toBe("82nd");
  });

  it("handles round numbers and zero", () => {
    expect(ordinalSuffix(100)).toBe("100th");
    expect(ordinalSuffix(0)).toBe("0th");
  });

  it("rounds non-integer input before formatting", () => {
    expect(ordinalSuffix(82.6)).toBe("83rd");
  });
});
