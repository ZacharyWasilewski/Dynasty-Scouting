import { afterEach, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";
import { computeDDValueCaptured } from "@/lib/mockDraft";
import type { Prospect } from "@/types/prospect";
const request = (path: string, method = "POST") => new Request(`https://example.com${path}`, {method});
afterEach(() => vi.useRealTimers());
it("keeps page tracking and login budgets separate while enforcing the login limit", () => {
  for (let i = 0; i < 20; i++) checkRateLimit(request("/api/track"), {limit: 120});
  for (let i = 0; i < 10; i++) expect(checkRateLimit(request("/api/auth/login"), {limit: 10}).allowed).toBe(true);
  expect(checkRateLimit(request("/api/auth/login?retry=1"), {limit: 10}).allowed).toBe(false);
});
it("shares dynamic resource budgets without blocking different methods or actions", () => {
  expect(checkRateLimit(request("/api/mock-drafts/a", "DELETE"), {limit: 1}).allowed).toBe(true);
  expect(checkRateLimit(request("/api/mock-drafts/b", "DELETE"), {limit: 1}).allowed).toBe(false);
  expect(checkRateLimit(request("/api/mock-drafts/a", "GET"), {limit: 1}).allowed).toBe(true);
  expect(checkRateLimit(request("/api/board/opportunity/2027"), {limit: 1}).allowed).toBe(true);
  expect(checkRateLimit(request("/api/board/opportunity/2028"), {limit: 1}).allowed).toBe(false);
  expect(checkRateLimit(request("/api/board/2027"), {limit: 1}).allowed).toBe(true);
});
it("does not sweep a long-lived budget using another endpoint's shorter window", () => {
  vi.useFakeTimers();
  checkRateLimit(request("/api/long-window"), {limit: 1, windowMs: 900_000});
  vi.advanceTimersByTime(360_000);
  checkRateLimit(request("/api/short-window"), {limit: 1});
  expect(checkRateLimit(request("/api/long-window"), {limit: 1, windowMs: 900_000}).allowed).toBe(false);
  vi.advanceTimersByTime(540_000);
  expect(checkRateLimit(request("/api/long-window"), {limit: 1, windowMs: 900_000}).allowed).toBe(true);
});
it("includes the selected player in the best-available benchmark and excludes earlier picks", () => {
  const prospects: Prospect[] = [100,90,80,50].map((score,i) => ({id:String(i),name:String(i),position:"WR",hasDraftData:false,preDraftScore:score}));
  const picks = [{overall:1,playerId:"0"},{overall:2,playerId:"1"},{overall:3,playerId:"3"}];
  const rows = [{player:prospects[0]!,pick:picks[0]!},{player:prospects[3]!,pick:picks[2]!}];
  expect(computeDDValueCaptured(rows,prospects,picks,"SUPERFLEX","STANDARD")).toBeCloseTo(150/180*100);
  expect(computeDDValueCaptured(rows.slice(0,1),prospects,picks,"SUPERFLEX","STANDARD")).toBe(100);
  expect(computeDDValueCaptured([],prospects,[],"SUPERFLEX","STANDARD")).toBe(0);
});
