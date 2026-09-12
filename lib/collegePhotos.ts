import { normalizeNameLoose } from "@/lib/schoolLookup";
import { reportStatus } from "@/lib/systemStatus";
import type { PlayerBio } from "@/lib/playerPhotos";

// Suffix mismatches (a prospect stored as "Mark Fletcher Jr." while
// ESPN's roster lists him as plain "Mark Fletcher", or vice versa)
// turned out to be the single biggest cause of missed matches once
// roster fetching/parsing itself was working. Stripped only for this
// file's own matching — normalizeNameLoose itself stays untouched,
// since it's shared with school/live-data matching elsewhere in the
// app where suffix-sensitivity isn't a known problem and shouldn't
// be changed without a reason specific to that code.
export function matchKey(name: string): string {
  return normalizeNameLoose(name).replace(/\s+(jr|sr|ii|iii|iv|v)$/, "");
}

// ESPN's public site API is undocumented — unlike Sleeper's, there's
// no formal terms covering third-party use, and no guarantee it
// stays stable. Deliberately scoped narrow (only ever called for
// undrafted/devy prospects, who have no other photo source) and,
// like the Sleeper integration, fully non-blocking — a slow or
// failing ESPN response can never add latency to a page load. If
// this endpoint ever gets reshaped or blocked, the only effect is
// devy prospects losing their photos; nothing else on the site
// depends on it.

const REVALIDATE_SECONDS = 24 * 60 * 60;
// Same reasoning as lib/playerPhotos.ts — retry sooner than a full
// day if a fetch fails or comes back empty, but never let that wipe
// out a cache that was previously working.
const RETRY_ON_FAILURE_SECONDS = 5 * 60;
// Building this index is inherently slower than Sleeper's single
// fetch (a team-index fetch, then several roster fetches in small
// batches) — a bit more patience on a cold process is worth it, but
// still bounded. See lib/playerPhotos.ts for the same pattern and
// the fuller reasoning.
const COLD_START_TIMEOUT_MS = 2000;
// A low limit here was the actual root cause of most missing photos —
// there are 700+ college football teams across every division once
// you go beyond FBS, and the previous limit=260 silently cut the
// list off before reaching several major FBS programs (Tennessee,
// Miami, TCU, UCF among them), not because of any abbreviation
// mismatch. Confirmed against real-world reports of this exact
// endpoint before changing it.
const TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=700";
// This app's abbreviations and ESPN's own aren't always the same
// convention, confirmed against real data pulled from production
// logs — e.g. this app uses "BAMA" where ESPN's field says "ALA",
// "MIZZ" where ESPN says "MIZ". Verified pairs only; not a guess.
const ABBREVIATION_ALIASES: Record<string, string> = {
  BAMA: "ALA",
  "S BAMA": "USA", // South Alabama
  ARI: "ARIZ",
  COL: "COLO",
  MIZZ: "MIZ",
  WISC: "WIS",
  TAMU: "TA&M",
  "VA TECH": "VT",
  "S ILL": "SIU",
  // Added after auditing the full ESPN abbreviation list against this
  // app's own school abbreviations (see the diagnostic logging in
  // buildPhotoIndex below) — these were the confidently-identifiable
  // mismatches. A few from that same audit (VA ST., EC OK, LRU, and
  // "GERMANY" — not a US college at all) were left out deliberately:
  // there wasn't a confident match in ESPN's list, and a wrong guess
  // here means showing the wrong player's photo, which is worse than
  // showing none.
  "N IOWA": "UNI",
  "NC ST.": "NCSU",
  UMASS: "MASS",
  TUL: "TULN", // Tulane
  "APP ST.": "APP",
  "LA TECH": "LT",
  LTU: "LT", // Louisiana Tech, alternate abbreviation seen in the sheet
  FORD: "FOR", // Fordham
  WF: "WAKE",
  NW: "NU", // Northwestern
  "SO MISS": "USM",
  RUT: "RUTG",
  KAN: "KU",
  "NM ST.": "NMSU",
  "MISS ST.": "MSST",
  "ORE ST.": "ORST",
  "GRAM ST.": "GRAM",
  "FRES ST.": "FRES",
  MARSH: "MRSH",
  DAYT: "DAY",
  NHU: "UNH", // New Hampshire
  UCONN: "CONN",
  "C MIZZ ST.": "UCM", // Central Missouri
  CUSE: "SYR", // Syracuse
  CHAR: "CLT", // Charlotte
  DRAKE: "DRKE",
  "GA TECH": "GT",
  "N TEX": "UNT",
  MON: "MONT", // Montana
  "MON ST.": "MTST", // Montana State
  "W. BAMA": "UWA", // West Alabama
  "ILL ST.": "ILST",
};

/**
 * Direct team-ID overrides, keyed by THIS app's abbreviation —
 * bypasses the abbreviation-matching step entirely for cases where
 * ESPN's OWN abbreviation collides with something entirely different
 * from what this app means. Confirmed via direct search against real
 * ESPN pages, not guessed: this app's "BSU" (Boise State) previously
 * resolved to ESPN's own "BSU", which is a different, small school
 * (matching this app's own earlier "6 unfixable D2 schools" —
 * they weren't unfixable, they were the WRONG schools). Same root
 * cause for "CC" (this app means Coastal Carolina; ESPN's "CC" is
 * Curry College) and "MARY" (this app means Maryland; ESPN's "MARY"
 * is a different school). An ID here is strictly more reliable than
 * an abbreviation alias, since it can't be broken by ESPN using yet
 * another abbreviation than expected.
 */
const TEAM_ID_OVERRIDES: Record<string, string> = {
  BSU: "68", // Boise State (ESPN's own "BSU" is a different school)
  CC: "324", // Coastal Carolina (ESPN's own "CC" is Curry College)
  MARY: "120", // Maryland (ESPN's own "MARY" is a different school)
};

function espnAbbreviationFor(schoolAbbreviation: string): string {
  const upper = schoolAbbreviation.toUpperCase();
  if (ABBREVIATION_ALIASES[upper]) return ABBREVIATION_ALIASES[upper];
  // ESPN's own abbreviations never contain spaces or periods (e.g.
  // "OKST", not "OK ST.") — stripping those from this app's version
  // resolves several formatting-only mismatches on its own, without
  // needing an explicit alias for every one of them.
  return upper.replace(/[.\s]/g, "");
}

/** See TEAM_ID_OVERRIDES' own comment — checked before the normal
 *  abbreviation-based lookup, and wins over it when present. */
export function resolveTeamId(schoolAbbreviation: string, teamIndex: Map<string, string>): string | undefined {
  const upper = schoolAbbreviation.toUpperCase();
  if (TEAM_ID_OVERRIDES[upper]) return TEAM_ID_OVERRIDES[upper];
  return teamIndex.get(espnAbbreviationFor(schoolAbbreviation));
}

// Confirmed against real production logs — the roster endpoint
// silently caps its response at 100 athletes with no limit param
// (the same behavior the team-list endpoint has, which is why
// TEAMS_URL above already passes its own ?limit=700). A 100-player
// cutoff drops anyone past it — not by alphabetical or roster
// order, just whatever ESPN's default ordering happens to put last,
// which cut real starters (e.g. a team's own leading rusher) despite
// their being clearly rostered and photographed. 150 covers every
// real FBS roster (they top out around 130) without repeating the
// earlier ?limit=300 attempt, which made responses large enough that
// a single slow team could stall the whole batched fetch — see the
// explicit per-request timeout below, which is the actual fix for
// that failure mode rather than just requesting less data.
const rosterUrl = (teamId: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${teamId}/roster?limit=150`;

let teamIndex: Map<string, string> | null = null; // uppercase abbreviation -> ESPN team id
let teamIndexExpires = 0;
let teamIndexInFlight: Promise<Map<string, string>> | null = null;

let photoIndex: Map<string, string> | null = null; // normalized player name -> headshot URL
let bioIndex: Map<string, PlayerBio> | null = null;
let photoIndexExpires = 0;
let photoIndexInFlight: Promise<{ photos: Map<string, string>; bios: Map<string, PlayerBio> }> | null = null;

async function fetchTeamIndex(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  try {
    const res = await fetch(TEAMS_URL, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) {
      console.error(`[college-photos] ESPN teams fetch returned ${res.status}`);
      return index;
    }
    const data = await res.json();
    const teams = data?.sports?.[0]?.leagues?.[0]?.teams;
    if (!Array.isArray(teams)) {
      console.error("[college-photos] ESPN teams response didn't match the expected shape");
      return index;
    }
    for (const entry of teams) {
      const team = entry?.team;
      const abbreviation = typeof team?.abbreviation === "string" ? team.abbreviation.toUpperCase() : null;
      const id = team?.id;
      if (abbreviation && id) index.set(abbreviation, String(id));
    }
  } catch (err) {
    console.error("[college-photos] ESPN teams fetch failed:", err);
  }
  return index;
}

function getTeamIndex(): Promise<Map<string, string>> {
  if (teamIndex && teamIndexExpires > Date.now()) return Promise.resolve(teamIndex);
  if (teamIndexInFlight) return teamIndexInFlight;
  const wasNeverFetched = teamIndex === null;
  teamIndexInFlight = fetchTeamIndex()
    .then((index) => {
      if (index.size > 0 || teamIndex === null) {
        teamIndex = index;
        teamIndexExpires = Date.now() + REVALIDATE_SECONDS * 1000;
      } else {
        // Empty/failed fetch, but a good index already exists — keep
        // it (a bad fetch here would otherwise zero out every
        // college photo on the site) and just retry sooner.
        teamIndexExpires = Date.now() + RETRY_ON_FAILURE_SECONDS * 1000;
      }
      return teamIndex ?? new Map();
    })
    .finally(() => {
      teamIndexInFlight = null;
    });
  if (wasNeverFetched) return teamIndexInFlight;
  return Promise.resolve(teamIndex ?? new Map());
}

interface RosterAthlete {
  fullName?: string;
  displayName?: string;
  headshot?: { href?: string };
  // ESPN's Core API typically exposes both a raw numeric height (in
  // inches) and weight (in lbs) directly, plus pre-formatted display
  // strings (e.g. displayHeight: "6' 2\"", displayWeight: "215 lbs").
  // Captured both here since this is an undocumented endpoint this
  // codebase can't verify live — if the raw numeric fields turn out
  // to be absent or named differently on some response shapes, the
  // display-string parser below is the fallback, not a second guess
  // stacked on the first.
  height?: number;
  weight?: number;
  displayHeight?: string;
  displayWeight?: string;
}

/** Parses ESPN's "6' 2\"" display format into total inches. Returns
 *  undefined for anything that doesn't match — never a guessed value. */
function parseDisplayHeight(display: string | undefined): number | undefined {
  if (!display) return undefined;
  const match = display.match(/(\d+)'\s*(\d+)/);
  if (!match) return undefined;
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return undefined;
  return feet * 12 + inches;
}

/** Parses ESPN's "215 lbs" display format into a plain number. */
function parseDisplayWeight(display: string | undefined): number | undefined {
  if (!display) return undefined;
  const match = display.match(/(\d+)/);
  if (!match) return undefined;
  const lbs = Number(match[1]);
  return Number.isFinite(lbs) ? lbs : undefined;
}

function isAthleteLike(value: unknown): value is RosterAthlete {
  const v = value as RosterAthlete | null;
  return !!v && (typeof v.fullName === "string" || typeof v.displayName === "string");
}

function extractAthletes(data: unknown): RosterAthlete[] {
  // ESPN's own documentation notes that not every field or shape is
  // guaranteed to be present for every team's roster response — this
  // tries several known variants rather than assuming one fixed
  // structure, which is why some teams parsed fine while others (a
  // flatter list, or nesting one level deeper under "team") came back
  // with nothing.
  const athletes: RosterAthlete[] = [];

  // Variant 1: grouped by position — { athletes: [{ items: [...] }] }
  const groups = (data as { athletes?: unknown })?.athletes;
  if (Array.isArray(groups)) {
    for (const group of groups) {
      const items = (group as { items?: unknown })?.items;
      if (Array.isArray(items)) {
        athletes.push(...(items as RosterAthlete[]).filter(isAthleteLike));
      } else if (isAthleteLike(group)) {
        // Variant 2: a flat list — { athletes: [{ fullName, headshot }, ...] }
        athletes.push(group);
      }
    }
  }

  // Variant 3: nested one level deeper — { team: { athletes: [...] } }
  if (athletes.length === 0) {
    const teamAthletes = (data as { team?: { athletes?: unknown } })?.team?.athletes;
    if (Array.isArray(teamAthletes)) {
      for (const entry of teamAthletes) {
        const items = (entry as { items?: unknown })?.items;
        if (Array.isArray(items)) {
          athletes.push(...(items as RosterAthlete[]).filter(isAthleteLike));
        } else if (isAthleteLike(entry)) {
          athletes.push(entry);
        }
      }
    }
  }

  // Variant 4: position groups keyed "athletes" instead of "items" —
  // seen on a handful of teams (e.g. Boise State) whose roster
  // response otherwise matches Variant 1's grouped-by-position shape.
  if (athletes.length === 0 && Array.isArray(groups)) {
    for (const group of groups) {
      const nested = (group as { athletes?: unknown })?.athletes;
      if (Array.isArray(nested)) {
        athletes.push(...(nested as RosterAthlete[]).filter(isAthleteLike));
      }
    }
  }

  return athletes;
}

async function fetchRosterPhotos(teamId: string): Promise<{ photos: Map<string, string>; bios: Map<string, PlayerBio> }> {
  const index = new Map<string, string>();
  const bios = new Map<string, PlayerBio>();
  // Explicit timeout, separate from the app-wide cold-start timeout —
  // that one only guards the very first call ever; every call after
  // that awaits the real in-flight promise with no bound at all. One
  // slow/hanging team response inside the batched Promise.all below
  // would otherwise stall every team behind it in the same and later
  // batches indefinitely. 8s is generous for a single roster fetch
  // under normal conditions but short enough that one bad team can't
  // hold up the rest of the index from ever finishing.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(rosterUrl(teamId), {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[college-photos] ESPN roster fetch for team ${teamId} returned ${res.status}`);
      return { photos: index, bios };
    }
    const data = await res.json();
    const athletes = extractAthletes(data);
    if (athletes.length === 0) {
      console.error(`[college-photos] ESPN roster for team ${teamId} had no recognizable athletes — response shape may have changed`);
    }
    for (const athlete of athletes) {
      const name = athlete.fullName ?? athlete.displayName;
      const href = athlete.headshot?.href;
      // ESPN returns a real, loadable placeholder graphic
      // (".../nophoto.png") for players it doesn't have an actual
      // photo of yet, rather than omitting the headshot field —
      // without this check that gets recorded as a successful match,
      // silently handing out a generic gray-silhouette "photo" (or,
      // via whatever renders it downstream, a broken-looking blank)
      // instead of correctly falling through to no photo at all.
      if (name && href && !href.includes("nophoto")) index.set(matchKey(name), href);

      // Raw numeric fields preferred when present; falls back to
      // parsing the display strings otherwise — see the parser
      // comments above for why both paths exist on an undocumented,
      // unverified API response.
      const heightIn = Number.isFinite(athlete.height) ? athlete.height : parseDisplayHeight(athlete.displayHeight);
      const weightLbs = Number.isFinite(athlete.weight) ? athlete.weight : parseDisplayWeight(athlete.displayWeight);
      if (name && (heightIn !== undefined || weightLbs !== undefined)) {
        bios.set(matchKey(name), { heightIn, weightLbs });
      }
    }
  } catch (err) {
    console.error(`[college-photos] ESPN roster fetch for team ${teamId} failed:`, err);
  } finally {
    clearTimeout(timeout);
  }
  return { photos: index, bios };
}

async function buildPhotoIndex(schoolAbbreviations: string[]): Promise<{ photos: Map<string, string>; bios: Map<string, PlayerBio> }> {
  const teams = await getTeamIndex();
  const uniqueAbbreviations = [...new Set(schoolAbbreviations.map((a) => a.toUpperCase()))];
  const resolved = uniqueAbbreviations
    .map((abbr) => ({ abbr, id: resolveTeamId(abbr, teams) }))
    .filter((r): r is { abbr: string; id: string } => !!r.id);
  const unresolved = uniqueAbbreviations.filter((abbr) => !resolveTeamId(abbr, teams));

  // This is the step that turned out to matter most — if this app's
  // school abbreviations don't line up with however ESPN spells
  // theirs, every player at that school silently gets no photo with
  // no roster fetch (and so no roster-level error) ever happening.
  // Logging the actual mismatch, plus a sample of what ESPN calls
  // things, makes that visible instead of indistinguishable from
  // "the roster fetch worked fine but had nobody in it."
  if (unresolved.length > 0) {
    console.error(
      `[college-photos] ${unresolved.length}/${uniqueAbbreviations.length} school abbreviations had no matching ESPN team: ${unresolved.join(", ")}`
    );
    // Logging every ESPN abbreviation (not just a sample) this time —
    // a partial list wasn't enough to build an accurate mapping
    // between this app's convention and ESPN's without guessing at
    // the rest.
    console.error(
      `[college-photos] Full ESPN abbreviation list (${teams.size} total): ${[...teams.entries()].map(([abbr, id]) => `${abbr}=${id}`).join(", ")}`
    );
  }

  const teamIds = resolved.map((r) => r.id);

  // Same "handful at a time" throttling already used for Google
  // Sheets tab fetches elsewhere in this codebase — hammering an
  // undocumented endpoint with dozens of simultaneous requests is
  // both impolite and the fastest way to get rate-limited or blocked.
  const CONCURRENCY = 6;
  const next = new Map<string, string>();
  const nextBios = new Map<string, PlayerBio>();
  for (let i = 0; i < teamIds.length; i += CONCURRENCY) {
    const batch = teamIds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((id) => fetchRosterPhotos(id)));
    for (const roster of results) {
      for (const [name, url] of roster.photos) next.set(name, url);
      for (const [name, bio] of roster.bios) nextBios.set(name, bio);
    }
  }
  return { photos: next, bios: nextBios };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      }
    );
  });
}

/**
 * Best-effort college headshots for undrafted/devy prospects. There's
 * no equivalent to Sleeper's single flat player file for college
 * rosters, so this instead resolves each unique school (by the same
 * abbreviation already used elsewhere in this app, e.g. "MICH") to
 * an ESPN team ID once, fetches that team's roster, and matches by
 * name. Silent and best-effort throughout — a school abbreviation
 * ESPN doesn't recognize under the same convention, or a roster
 * shape that doesn't parse, just means no photo for those players,
 * never a broken page (though see the console.error calls above for
 * actually diagnosing which case is happening).
 *
 * Non-blocking after the first call, same as the Sleeper index — see
 * lib/playerPhotos.ts for the fuller reasoning on the cold-start
 * exception below.
 */
export async function getCollegePhotoIndexIfReady(schoolAbbreviations: string[]): Promise<Map<string, string>> {
  const result = await ensureCollegeIndexFetched(schoolAbbreviations);
  return result.photos;
}

/** Height/weight for undrafted/devy prospects, same matching and
 *  caching as the photo index above — one shared fetch, not a
 *  second pass over 700+ college rosters. */
export async function getCollegeBioIndexIfReady(schoolAbbreviations: string[]): Promise<Map<string, PlayerBio>> {
  const result = await ensureCollegeIndexFetched(schoolAbbreviations);
  return result.bios;
}

async function ensureCollegeIndexFetched(
  schoolAbbreviations: string[]
): Promise<{ photos: Map<string, string>; bios: Map<string, PlayerBio> }> {
  if (photoIndex && bioIndex && photoIndexExpires > Date.now()) return { photos: photoIndex, bios: bioIndex };

  const wasNeverFetched = photoIndex === null;

  if (!photoIndexInFlight) {
    photoIndexInFlight = buildPhotoIndex(schoolAbbreviations)
      .then((result) => {
        if (result.photos.size > 0 || photoIndex === null) {
          photoIndex = result.photos;
          bioIndex = result.bios;
          photoIndexExpires = Date.now() + REVALIDATE_SECONDS * 1000;
          reportStatus("espn-college-photos", "ok", `${result.photos.size} college headshots indexed`);
        } else {
          // Empty/failed build, but a good index already exists —
          // keep serving it and just retry sooner, rather than
          // wiping out every devy photo over one bad ESPN cycle.
          photoIndexExpires = Date.now() + RETRY_ON_FAILURE_SECONDS * 1000;
          reportStatus("espn-college-photos", "stale", `Build came back empty — still serving ${photoIndex?.size ?? 0} cached headshots`);
        }
        return { photos: photoIndex ?? new Map(), bios: bioIndex ?? new Map() };
      })
      .finally(() => {
        photoIndexInFlight = null;
      });
  }

  if (wasNeverFetched) {
    // Wait for the shared first build so Devy headshots are available on the
    // initial page response instead of rendering blank and appearing later.
    return photoIndexInFlight;
  }
  return { photos: photoIndex ?? new Map(), bios: bioIndex ?? new Map() };
}

// Three confirmed, isolated 2027 devy cases whose ESPN roster lookup can
// miss despite the rest of the college-photo system working correctly. Keep
// these as exact-name fallbacks rather than changing the shared matcher or
// roster/indexing pipeline, so the fix cannot broaden into false matches for
// anyone else. ESPN serves stable headshots by athlete id at this CDN path.
const EXACT_PHOTO_OVERRIDES: Record<string, string> = {
  "junior sherrill": "https://a.espncdn.com/i/headshots/college-football/players/full/5078165.png",
  "peter clarke": "https://a.espncdn.com/i/headshots/college-football/players/full/5080547.png",
  "demond williams": "https://a.espncdn.com/i/headshots/college-football/players/full/5079653.png",
  "demond williams jr": "https://a.espncdn.com/i/headshots/college-football/players/full/5079653.png",
  // Preserve the exact spelling currently present in the DD data if/where it
  // appears without teaching the global matcher a fuzzy spelling rule.
  "demons williams jr": "https://a.espncdn.com/i/headshots/college-football/players/full/5079653.png",
};

export function lookupCollegePhoto(index: Map<string, string>, name: string): string | undefined {
  const key = matchKey(name);
  return index.get(key) ?? EXACT_PHOTO_OVERRIDES[key];
}

/** Same matching as lookupCollegePhoto — no equivalent to
 *  EXACT_PHOTO_OVERRIDES here, since that table exists specifically
 *  for a few known ESPN roster-lookup failures affecting photos, not
 *  something with a bio-data equivalent. */
export function lookupCollegeBio(index: Map<string, PlayerBio>, name: string): PlayerBio | undefined {
  return index.get(matchKey(name));
}

/**
 * School abbreviation (this app's own convention) -> ESPN team logo
 * URL. Reuses the same team index already built for photo matching
 * — team logos need only the team-level list (already fully fetched
 * and cached), never a per-team roster fetch, so this is dramatically
 * cheaper than the photo index despite covering every school on the
 * site at once rather than just devy prospects' schools. Confirmed
 * URL pattern (a.espncdn.com/i/teamlogos/ncaa/500/{id}.png) directly
 * from a real, live response — not a guess.
 */
export async function getSchoolLogoIndex(schoolAbbreviations: string[]): Promise<Map<string, string>> {
  const teamIndex = await getTeamIndex();
  const result = new Map<string, string>();
  for (const abbr of new Set(schoolAbbreviations)) {
    if (!abbr) continue;
    const id = resolveTeamId(abbr, teamIndex);
    if (id) result.set(abbr.toUpperCase(), `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`);
  }
  return result;
}
