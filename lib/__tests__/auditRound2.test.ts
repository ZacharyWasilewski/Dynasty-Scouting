import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FORMAT, getGlobalFormat, parseFormatParam, resolveFormat } from "@/lib/globalFormat";
import { withFormatParam } from "@/lib/useFormatQuery";
import { autoStageFor, describeScoreType, parseScoreType, scoreForType } from "@/lib/scoreType";
import { availableQueue, isDraftComplete, mockScoreName } from "@/lib/mockDraft";
import type { Prospect } from "@/types/prospect";

function stubStorage(value: string | null, throws = false) {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: () => {
      if (throws) throw new Error("blocked");
      return value;
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

const prospect = (over: Partial<Prospect>): Prospect =>
  ({ id: "x", name: "X", position: "WR", draftClass: "2027", preDraftScore: 80, rawScore: 70, ...over }) as Prospect;

describe("league format precedence", () => {
  it("defaults to Superflex with TEP off when nothing is saved", () => {
    stubStorage(null);
    expect(getGlobalFormat()).toBe(DEFAULT_FORMAT);
    expect(DEFAULT_FORMAT).toBe("SUPERFLEX");
  });

  it("uses a saved preference when the URL has none", () => {
    stubStorage("1QB_TEP");
    expect(getGlobalFormat()).toBe("1QB_TEP");
    expect(resolveFormat(null)).toBe("1QB_TEP");
  });

  it("lets an explicit URL format win over the saved preference", () => {
    stubStorage("1QB");
    expect(resolveFormat("sf-tep")).toBe("SUPERFLEX_TEP");
    expect(resolveFormat("sf")).toBe("SUPERFLEX");
  });

  it("ignores junk values and unavailable storage", () => {
    stubStorage("nonsense");
    expect(getGlobalFormat()).toBe("SUPERFLEX");
    stubStorage(null, true);
    expect(getGlobalFormat()).toBe("SUPERFLEX");
    expect(parseFormatParam("bogus")).toBeNull();
  });

  it("parses every format param", () => {
    expect(parseFormatParam("1qb")).toBe("1QB");
    expect(parseFormatParam("1qb-tep")).toBe("1QB_TEP");
    expect(parseFormatParam("sf")).toBe("SUPERFLEX");
    expect(parseFormatParam("sf-tep")).toBe("SUPERFLEX_TEP");
  });

  it("header links to format-aware pages carry the format; others do not", () => {
    expect(withFormatParam("/classes/2027", "1qb")).toBe("/classes/2027?format=1qb");
    expect(withFormatParam("/players", "sf-tep")).toBe("/players?format=sf-tep");
    expect(withFormatParam("/methodology", "1qb")).toBe("/methodology");
    expect(withFormatParam("/classes/2027?format=sf", "1qb")).toBe("/classes/2027?format=sf");
    expect(withFormatParam("/players", null)).toBe("/players");
  });
});

describe("score type labels", () => {
  const preDraft = [prospect({ id: "a" }), prospect({ id: "b" })];
  const drafted = prospect({ id: "c", hasDraftData: true });

  it("defaults to current-stage score and names the stage actually shown", () => {
    expect(parseScoreType(null)).toBe("auto");
    expect(parseScoreType("dd")).toBe("dd");
    expect(describeScoreType(preDraft, "auto").columnLabel).toBe("Pre-Draft Score");
    expect(describeScoreType(preDraft, "auto", true).columnLabel).toBe("Raw Score");
    expect(describeScoreType([drafted], "auto").columnLabel).toBe("DD Score");
  });

  it("flags mixed-stage lists instead of picking one label", () => {
    const d = describeScoreType([...preDraft, drafted], "auto");
    expect(d.mixed).toBe(true);
    expect(d.columnLabel).toBe("Score (by stage)");
  });

  it("keeps labels stable for empty lists and explicit types", () => {
    expect(describeScoreType([], "auto").columnLabel).toBe("Current-stage score");
    expect(describeScoreType(preDraft, "dd").columnLabel).toBe("DD Score");
  });

  it("does not substitute another score when an explicit type is unavailable", () => {
    expect(scoreForType(prospect({}), "dd", "SUPERFLEX")).toBeUndefined();
    expect(autoStageFor(prospect({}))).toBe("preDraft");
    expect(autoStageFor(prospect({ hasDraftData: true }))).toBe("dd");
    expect(autoStageFor(prospect({}), true)).toBe("raw");
  });
});

describe("mock draft queue and completion", () => {
  it("queue only contains players still on the board, in order", () => {
    const available = new Set(["a", "c"]);
    expect(availableQueue(["a", "b", "c"], available)).toEqual(["a", "c"]);
    expect(availableQueue(["b"], available)).toEqual([]);
  });

  it("badge count equals the actionable queue after an opponent pick", () => {
    const queued = ["baugh", "other"];
    const afterPick = new Set(["other"]);
    expect(availableQueue(queued, afterPick).length).toBe(1);
  });

  it("detects a completed draft regardless of saved step", () => {
    expect(isDraftComplete(48, 200, 12)).toBe(true);
    expect(isDraftComplete(47, 200, 12)).toBe(false);
    expect(isDraftComplete(30, 30, 12)).toBe(true);
  });

  it("names the score the mock is evaluated with", () => {
    expect(mockScoreName([{ hasDraftData: false }, { hasDraftData: undefined }]).long).toBe("Pre-Draft Score");
    expect(mockScoreName([{ hasDraftData: true }]).short).toBe("DD");
    expect(mockScoreName([{ hasDraftData: true }, { hasDraftData: false }]).short).toBe("Model");
  });
});
