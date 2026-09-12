import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prospect } from "@/types/prospect";

const query = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => query(...args),
}));

const { maybeRefreshScoreSnapshot, getScoreMovers, getScoreDeltas } = await import("@/lib/trending");

function prospect(overrides: Partial<Prospect> & { id: string }): Prospect {
  return {
    name: overrides.id,
    position: "WR",
    hasDraftData: false,
    ...overrides,
  } as Prospect;
}

beforeEach(() => {
  query.mockReset();
});

describe("maybeRefreshScoreSnapshot", () => {
  it("establishes an initial baseline on the very first run, tracking only devy (non-drafted) prospects", async () => {
    query.mockResolvedValueOnce([]); // SELECT finds no existing row
    query.mockResolvedValueOnce([]); // INSERT

    const prospects = [
      prospect({ id: "a", preDraftScore: 70, hasDraftData: false }),
      prospect({ id: "b", preDraftScore: 80, hasDraftData: true }), // drafted — excluded
      prospect({ id: "c", hasDraftData: false }), // no preDraftScore — excluded
    ];
    await maybeRefreshScoreSnapshot(prospects);

    expect(query).toHaveBeenCalledTimes(2);
    const insertCall = query.mock.calls[1];
    expect(insertCall[0]).toMatch(/INSERT INTO score_snapshot/);
    const insertedScores = JSON.parse(insertCall[1][0]);
    expect(insertedScores).toEqual({ a: 70 });
  });

  it("does nothing at all when scores are unchanged from the settled baseline, no matter how old it is", async () => {
    query.mockResolvedValueOnce([
      { settled_scores: { a: 70 }, pending_scores: null, pending_since: null },
    ]);

    await maybeRefreshScoreSnapshot([prospect({ id: "a", preDraftScore: 70 })]);

    expect(query).toHaveBeenCalledTimes(1); // only the initial SELECT — no write at all
  });

  it("clears a stale pending change if scores revert back to exactly the settled baseline", async () => {
    query.mockResolvedValueOnce([
      { settled_scores: { a: 70 }, pending_scores: { a: 75 }, pending_since: new Date().toISOString() },
    ]);
    query.mockResolvedValueOnce([]); // the clearing UPDATE

    await maybeRefreshScoreSnapshot([prospect({ id: "a", preDraftScore: 70 })]);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toMatch(/pending_scores = NULL/);
  });

  it("starts a fresh display window when a new change is detected", async () => {
    query.mockResolvedValueOnce([
      { settled_scores: { a: 70 }, pending_scores: null, pending_since: null },
    ]);
    query.mockResolvedValueOnce([]); // the UPDATE setting pending

    await maybeRefreshScoreSnapshot([prospect({ id: "a", preDraftScore: 75 })]);

    expect(query).toHaveBeenCalledTimes(2);
    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toMatch(/SET pending_scores = \$1, pending_since = now\(\)/);
    expect(JSON.parse(updateCall[1][0])).toEqual({ a: 75 });
  });

  it("does NOT rotate the baseline while the same pending change is still within the display window", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    query.mockResolvedValueOnce([
      { settled_scores: { a: 70 }, pending_scores: { a: 75 }, pending_since: twoDaysAgo },
    ]);

    await maybeRefreshScoreSnapshot([prospect({ id: "a", preDraftScore: 75 })]);

    expect(query).toHaveBeenCalledTimes(1); // only the SELECT — window hasn't elapsed yet
  });

  it("rotates the pending change into the new settled baseline once the display window has elapsed — this is the exact fix that replaced the old fixed-timer design", async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    query.mockResolvedValueOnce([
      { settled_scores: { a: 70 }, pending_scores: { a: 75 }, pending_since: fiveDaysAgo },
    ]);
    query.mockResolvedValueOnce([]); // the rotation UPDATE

    await maybeRefreshScoreSnapshot([prospect({ id: "a", preDraftScore: 75 })]);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toMatch(/SET settled_scores = pending_scores/);
  });

  it("never throws — a DB failure is swallowed so it can never break the sheet-data refresh it's called from", async () => {
    query.mockRejectedValueOnce(new Error("connection refused"));
    await expect(maybeRefreshScoreSnapshot([prospect({ id: "a", preDraftScore: 70 })])).resolves.toBeUndefined();
  });
});

describe("getScoreMovers", () => {
  it("returns empty risers/fallers (not an error) when no baseline exists yet", async () => {
    query.mockResolvedValueOnce([]);
    const result = await getScoreMovers([prospect({ id: "a", preDraftScore: 70 })]);
    expect(result).toEqual({ risers: [], fallers: [] });
  });

  it("correctly splits risers and fallers and sorts each by magnitude", async () => {
    query.mockResolvedValueOnce([{ settled_scores: { a: 70, b: 80, c: 60, d: 90 } }]);
    const prospects = [
      prospect({ id: "a", preDraftScore: 75 }), // +5
      prospect({ id: "b", preDraftScore: 78 }), // -2
      prospect({ id: "c", preDraftScore: 60 }), // unchanged — excluded
      prospect({ id: "d", preDraftScore: 82 }), // -8
    ];
    const { risers, fallers } = await getScoreMovers(prospects);

    expect(risers).toHaveLength(1);
    expect(risers[0]?.id).toBe("a");
    expect(fallers.map((f) => f.id)).toEqual(["d", "b"]); // largest drop first
  });

  it("ignores a drafted player even if it somehow has a stale entry in the baseline", async () => {
    query.mockResolvedValueOnce([{ settled_scores: { a: 70 } }]);
    const result = await getScoreMovers([prospect({ id: "a", preDraftScore: 90, hasDraftData: true })]);
    expect(result).toEqual({ risers: [], fallers: [] });
  });
});

describe("getScoreDeltas", () => {
  it("returns an empty map when no baseline exists", async () => {
    query.mockResolvedValueOnce([]);
    const deltas = await getScoreDeltas([prospect({ id: "a", preDraftScore: 70 })]);
    expect(deltas.size).toBe(0);
  });

  it("returns every real delta, not just a top-N slice — this is what powers the per-row indicator on ranking pages", async () => {
    query.mockResolvedValueOnce([{ settled_scores: { a: 70, b: 80, c: 90, d: 60, e: 50 } }]);
    const prospects = ["a", "b", "c", "d", "e"].map((id, i) =>
      prospect({ id, preDraftScore: [75, 82, 91, 55, 65][i] })
    );
    const deltas = await getScoreDeltas(prospects);
    expect(deltas.size).toBe(5);
    expect(deltas.get("a")).toBe(5);
    expect(deltas.get("d")).toBe(-5);
  });
});
