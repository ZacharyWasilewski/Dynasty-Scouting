import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), locked: true }));
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mocks.query(...args),
  withDbClient: (fn: (client: unknown) => unknown) => fn({query: async (sql: string) => {
    if (sql.includes("pg_try_advisory_lock")) return {rows:[{locked:mocks.locked}]};
    return {rows: await mocks.query(sql)};
  }}),
  subscribeToDbChannel: vi.fn()
}));
const data = {prospects: [{id:"retained",name:"Retained Player",position:"WR"}],tierSummary:[],classYearTrends:[]};
beforeEach(() => {
  vi.resetModules(); vi.stubEnv("DATABASE_URL", "postgres://test-only");
  mocks.locked = true;
  mocks.query.mockReset();
  mocks.query.mockResolvedValue([{version:7,expires_at:new Date(Date.now()+60_000),data}]);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Source unavailable")));
  vi.spyOn(console,"error").mockImplementation(() => {});
});
afterEach(() => {vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
it("bypasses a fresh shared snapshot on manual refresh and rejects instead of claiming cached success", async () => {
  const {getSheetSnapshot,forceSheetRefresh} = await import("@/lib/googleSheets");
  expect((await getSheetSnapshot()).version).toBe(7);
  expect(fetch).not.toHaveBeenCalled();
  await expect(forceSheetRefresh()).rejects.toThrow();
  expect(fetch).toHaveBeenCalled();
  expect((await getSheetSnapshot()).data.prospects[0]?.id).toBe("retained");
});
it("reports another server's active refresh instead of claiming the old shared snapshot is newly fetched", async () => {
  mocks.locked = false;
  const {forceSheetRefresh} = await import("@/lib/googleSheets");
  await expect(forceSheetRefresh()).rejects.toThrow("Another server");
  expect(fetch).not.toHaveBeenCalled();
});
it("coalesces concurrent manual refresh requests into one live attempt", async () => {
  const {forceSheetRefresh} = await import("@/lib/googleSheets");
  const first = forceSheetRefresh(); const second = forceSheetRefresh();
  expect(first).toBe(second);
  await Promise.allSettled([first,second]);
  expect(mocks.query.mock.calls.filter(([sql]) => String(sql).includes("pg_advisory_unlock"))).toHaveLength(1);
});
