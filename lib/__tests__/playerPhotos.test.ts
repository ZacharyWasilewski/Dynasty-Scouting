import { describe, it, expect } from "vitest";
import { lookupPlayerPhoto } from "@/lib/playerPhotos";

describe("lookupPlayerPhoto", () => {
  it("matches on exact name + position", () => {
    const index = new Map([["marvin harrison|WR", "url-a"]]);
    expect(lookupPlayerPhoto(index, "Marvin Harrison", "WR")).toBe("url-a");
  });

  it("falls back to a name-only match when this site's position and Sleeper's stored position disagree — regression test for N'Keal Harry, confirmed stored as TE in Sleeper despite being a WR", () => {
    const index = new Map([
      ["nkeal harry|TE", "url-b"],
      ["name-only:nkeal harry", "url-b"],
    ]);
    expect(lookupPlayerPhoto(index, "N'Keal Harry", "WR")).toBe("url-b");
  });

  it("resolves a known nickname alias — regression test for Will Fuller, confirmed stored as William Fuller in Sleeper", () => {
    const index = new Map([["william fuller|WR", "url-c"]]);
    expect(lookupPlayerPhoto(index, "Will Fuller", "WR")).toBe("url-c");
  });

  it("returns undefined when nothing matches at all", () => {
    const index = new Map([["someone else|WR", "url-d"]]);
    expect(lookupPlayerPhoto(index, "Nobody Here", "WR")).toBeUndefined();
  });
});
