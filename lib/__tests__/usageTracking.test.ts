import { expect, it, vi } from "vitest";
const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({query}));
import {getUsageSummary} from "@/lib/usageTracking";
it("counts page views separately from feature events", async () => {
  query.mockReset().mockResolvedValueOnce([{path:"/players",count:"4"}]).mockResolvedValueOnce([{event_type:"mock_complete",count:"2"}]).mockResolvedValueOnce([{count:"3"}]).mockResolvedValueOnce([{count:"4"}]);
  const result = await getUsageSummary(7,"admin");
  expect(result).toMatchObject({available:true,totalPageViews:4,uniqueActiveUsers:3});
  expect(query.mock.calls[3]?.[0]).toContain("event_type = 'page_view'");
  expect(query.mock.calls.every(([,params]) => params[1] === "admin")).toBe(true);
});
it("distinguishes unavailable statistics from zero usage", async () => {
  query.mockReset().mockRejectedValue(new Error("offline"));
  const log = vi.spyOn(console,"error").mockImplementation(() => {});
  expect((await getUsageSummary(7)).available).toBe(false);
  log.mockRestore();
});
