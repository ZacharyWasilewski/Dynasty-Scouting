import * as React from "react";
import { createElement } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Prospect } from "@/types/prospect";

const base = { position: "RB", school: "X", draftClass: "2026", preDraftScore: 80, rawScore: 80 } as const;
const drafted = {
  ...base, id: "a", name: "Drafted Guy", hasDraftData: true, mockPercentile: 88,
  subScores: [{ label: "Size", value: 70 }, { label: "Draft Capital", value: 91 }, { label: "Opportunity", text: "RB1" }],
} as unknown as Prospect;
const pre = {
  ...base, id: "b", name: "Pre Guy", hasDraftData: false,
  subScores: [{ label: "Size", value: 60 }, { label: "Mock", value: 75 }, { label: "Opportunity", text: "—", isPending: true }],
} as unknown as Prospect;

describe("cross-stage comparison", () => {
  // The component file uses the classic JSX runtime, so React must be global.
  (globalThis as { React?: unknown }).React = React;
  let html = "";
  beforeAll(async () => {
    const { ComparisonPanel } = await import("../comparison/ComparisonPanel");
    html = renderToStaticMarkup(createElement(ComparisonPanel, { current: drafted, other: pre, format: "SUPERFLEX" }));
  });
  it("compares Mock using the drafted player's backend mock percentile", () => {
    expect(html).toContain("88.0");
    expect(html).toContain("75.0");
    expect(html).toContain(">Mock<");
  });
  it("still shows scores only one side has", () => {
    expect(html).toContain(">Draft Capital<");
    expect(html).toContain("RB1");
  });
});
