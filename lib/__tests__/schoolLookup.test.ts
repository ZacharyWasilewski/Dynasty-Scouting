import { describe, it, expect } from "vitest";
import { normalizeName, normalizeNameLoose } from "@/lib/schoolLookup";

describe("normalizeName", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeName("  John   Smith  ")).toBe("john smith");
  });

  it("does not strip periods or apostrophes (byte-compatible with SCHOOL_LOOKUP keys)", () => {
    expect(normalizeName("A.J. Brown")).toBe("a.j. brown");
  });
});

describe("normalizeNameLoose", () => {
  it("strips periods and apostrophes entirely", () => {
    expect(normalizeNameLoose("A.J. Brown")).toBe("aj brown");
    expect(normalizeNameLoose("Ja'Marr Chase")).toBe("jamarr chase");
  });

  it("treats hyphens as word separators", () => {
    expect(normalizeNameLoose("Jean-Baptiste")).toBe("jean baptiste");
  });

  it("strips accents/diacritics", () => {
    expect(normalizeNameLoose("José")).toBe("jose");
  });

  it("collapses whitespace and lowercases", () => {
    expect(normalizeNameLoose("  Marvin   Harrison ")).toBe("marvin harrison");
  });

  it("keeps suffixes as-is (suffix stripping happens separately, per-file)", () => {
    expect(normalizeNameLoose("Marvin Harrison Jr.")).toBe("marvin harrison jr");
    expect(normalizeNameLoose("Kenneth Walker III")).toBe("kenneth walker iii");
  });
});
