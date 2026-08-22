import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assignProspectPhotos, assignSchoolLogos } from "@/lib/googleSheets";
import type { Prospect } from "@/types/prospect";

function prospect(overrides: Partial<Prospect> & { id: string }): Prospect {
  return {
    name: overrides.id,
    position: "WR",
    ...overrides,
  } as Prospect;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("assignProspectPhotos", () => {
  it("routes a drafted player (hasDraftData true) through the Sleeper index, never ESPN", () => {
    const photoIndex = new Map([["nkeal harry|WR", "sleeper-url"]]);
    const collegePhotoIndex = new Map([["nkeal harry", "espn-url"]]);
    const p = prospect({ id: "a", name: "N'Keal Harry", hasDraftData: true, school: "ASU" });

    assignProspectPhotos([p], photoIndex, collegePhotoIndex);

    expect(p.photoUrl).toBe("sleeper-url");
  });

  it("routes a devy player (hasDraftData not true) through ESPN college rosters, never Sleeper", () => {
    const photoIndex = new Map([["hollywood smothers|RB", "wrong-sleeper-namesake-url"]]);
    const collegePhotoIndex = new Map([["hollywood smothers", "real-espn-url"]]);
    const p = prospect({ id: "a", name: "Hollywood Smothers", position: "RB", hasDraftData: false, school: "TEX" });

    assignProspectPhotos([p], photoIndex, collegePhotoIndex);

    expect(p.photoUrl).toBe("real-espn-url");
  });

  it("treats hasDraftData === undefined the same as false — routes to ESPN, not Sleeper", () => {
    const photoIndex = new Map([["a|WR", "sleeper-url"]]);
    const collegePhotoIndex = new Map([["a", "espn-url"]]);
    const p = prospect({ id: "a", hasDraftData: undefined, school: "TEX" });

    assignProspectPhotos([p], photoIndex, collegePhotoIndex);

    expect(p.photoUrl).toBe("espn-url");
  });

  it("leaves photoUrl unset when nothing matches in either index", () => {
    const p = prospect({ id: "a", hasDraftData: true });
    assignProspectPhotos([p], new Map(), new Map());
    expect(p.photoUrl).toBeUndefined();
  });

  it("REGRESSION: fires a loud invariant violation if called on a large list where nobody has hasDraftData === true — this is the exact bug that shipped (called before applySubScores had run)", () => {
    const prospects = Array.from({ length: 60 }, (_, i) =>
      prospect({ id: `p${i}`, hasDraftData: undefined })
    );

    assignProspectPhotos(prospects, new Map(), new Map());

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("INVARIANT VIOLATION"));
  });

  it("does NOT false-positive the invariant check on a small, legitimately all-devy list", () => {
    const prospects = Array.from({ length: 10 }, (_, i) =>
      prospect({ id: `p${i}`, hasDraftData: false })
    );

    assignProspectPhotos(prospects, new Map(), new Map());

    const violationCalls = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("INVARIANT VIOLATION")
    );
    expect(violationCalls).toHaveLength(0);
  });

  it("does NOT fire the invariant check when at least one prospect is correctly marked drafted", () => {
    const prospects = [
      prospect({ id: "drafted", hasDraftData: true }),
      ...Array.from({ length: 60 }, (_, i) => prospect({ id: `devy${i}`, hasDraftData: false })),
    ];

    assignProspectPhotos(prospects, new Map(), new Map());

    const violationCalls = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes("INVARIANT VIOLATION")
    );
    expect(violationCalls).toHaveLength(0);
  });
});

describe("assignSchoolLogos", () => {
  it("assigns a logo URL to a prospect whose school matches the index, case-insensitively", () => {
    const logoIndex = new Map([["TEX", "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png"]]);
    const p = prospect({ id: "a", school: "tex" });
    assignSchoolLogos([p], logoIndex);
    expect(p.schoolLogoUrl).toBe("https://a.espncdn.com/i/teamlogos/ncaa/500/251.png");
  });

  it("applies equally to a drafted player, unlike photo assignment which branches on hasDraftData", () => {
    const logoIndex = new Map([["TEX", "logo-url"]]);
    const p = prospect({ id: "a", school: "TEX", hasDraftData: true });
    assignSchoolLogos([p], logoIndex);
    expect(p.schoolLogoUrl).toBe("logo-url");
  });

  it("leaves schoolLogoUrl unset for a prospect with no school", () => {
    const p = prospect({ id: "a", school: undefined });
    assignSchoolLogos([p], new Map([["TEX", "logo-url"]]));
    expect(p.schoolLogoUrl).toBeUndefined();
  });

  it("leaves schoolLogoUrl unset when the school isn't in the index at all", () => {
    const p = prospect({ id: "a", school: "SOME UNKNOWN SCHOOL" });
    assignSchoolLogos([p], new Map([["TEX", "logo-url"]]));
    expect(p.schoolLogoUrl).toBeUndefined();
  });
});
