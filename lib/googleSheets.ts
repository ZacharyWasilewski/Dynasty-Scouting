import Papa from "papaparse";
import fs from "fs";
import os from "os";
import path from "path";
import { SCHOOL_LOOKUP, normalizeName, normalizeNameLoose } from "./schoolLookup";
import { getTierForScore } from "./tiers";
import {
  DEFAULT_OPPORTUNITY_SCALES,
  OPPORTUNITY_OPTIONS_BY_POSITION,
  OPPORTUNITY_POSITIONS,
  normalizeOpportunityLabel,
  type OpportunityPosition,
} from "./opportunityScales";
import { applyDDScores } from "./ddScore";
import { getPlayerPhotoIndexIfReady, lookupPlayerPhoto, getSleeperBioIndexIfReady, lookupPlayerBio, type PlayerBio } from "./playerPhotos";
import { getCollegePhotoIndexIfReady, lookupCollegePhoto, getSchoolLogoIndex, matchKey as matchKeyForLog, getCollegeBioIndexIfReady, lookupCollegeBio } from "./collegePhotos";
import { reportStatus, reportHealthEvent } from "./systemStatus";
import { maybeRefreshScoreSnapshot } from "./trending";
import { query, withDbClient, subscribeToDbChannel } from "./db";
import type {
  Prospect,
  Position,
  TierSummaryRow,
  ClassYearTrend,
} from "@/types/prospect";

/**
 * Live data source: "All-Time Prospect Scores" Google Sheet.
 *
 * IMPORTANT — for this to work in production, the sheet must be
 * shared as "Anyone with the link can view" (File → Share → General
 * access). This code fetches the public CSV export URL, which only
 * works for a sheet shared that way — Vercel has no Google login of
 * its own. If you'd rather keep the sheet private, swap this fetcher
 * for the Google Sheets API with a service account instead; see the
 * README for details.
 */
const SHEET_ID = "1ku35MZfYjSfn0lXZgsMcnWguCnDbXxqHzjY_heoEBgU";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

// Revalidate every 60 seconds — edits in the sheet show up on the
// site within a minute, without a redeploy.
const REVALIDATE_SECONDS = 60;
// Full roster/photo dumps are useful while debugging a missing image, but
// serializing hundreds of names into Railway logs every refresh adds avoidable
// CPU and I/O. Keep the diagnostics available behind an explicit switch.
const VERBOSE_DATA_DIAGNOSTICS = process.env.DD_VERBOSE_DATA_DIAGNOSTICS === "true";

type Row = string[];

/**
 * The master table's tab name. Fetched explicitly by name rather than
 * relying on tab order.
 *
 * SHEET_CSV_URL (/export?format=csv with no gid) returns whichever tab
 * happens to be LEFTMOST in the spreadsheet, not a tab by name. That
 * silently reads the wrong tab the moment another one is added to the
 * left, reordered, or duplicated, which looks exactly like "an edit I
 * made didn't show up" or "a player I added is missing" rather than
 * like a bug.
 */
const MASTER_TAB_NAME = "All Prospects";

async function fetchSheetRows(): Promise<Row[]> {
  // Prefer the tab by name so tab order can never change which data the
  // site reads.
  const byName = await fetchNamedTabRows(MASTER_TAB_NAME);
  // A valid master table always has far more than a couple of rows, so a
  // near-empty result means the named fetch failed (renamed tab, rate
  // limit, transient error) rather than a legitimately tiny sheet.
  if (byName.length > 5) return byName;

  // Fallback: the original leftmost-tab export. Keeps the site serving
  // if the tab is ever renamed, at the cost of the ordering fragility
  // described above.
  console.error(
    `[sheet] Named fetch of "${MASTER_TAB_NAME}" returned ${byName.length} rows; falling back to the default tab export.`
  );
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Google Sheet (status ${res.status}). Make sure it's shared as "Anyone with the link can view".`
    );
  }

  const text = await res.text();
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  return parsed.data;
}

/**
 * Fetches a single named tab from the sheet (rather than the default
 * first tab). Used for the forward-looking "2027 Class" / "2028
 * Class" tabs, which live on their own tabs separate from the master
 * combined table. Returns [] if the tab can't be reached, rather than
 * throwing — these are supplemental, so a hiccup here shouldn't take
 * down the rest of the site.
 */
async function fetchNamedTabRows(sheetName: string, attempt = 1): Promise<Row[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  try {
    // Same rule as the master sheet: one snapshot cache controls freshness.
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 429 && attempt < 6) {
      // Google's gviz endpoint rate-limits aggressively when many tabs
      // are fetched in a short window. Back off and retry rather than
      // silently losing the data.
      await new Promise((r) => setTimeout(r, attempt * 600));
      return fetchNamedTabRows(sheetName, attempt + 1);
    }
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
    return parsed.data;
  } catch {
    return [];
  }
}

function toNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const cleaned = raw.replace(/%/g, "").replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "#N/A") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function toPercent(raw: string | undefined): number | null {
  const n = toNumber(raw);
  return n === undefined ? null : n;
}


/**
 * Sheet spelling -> preferred display spelling.
 *
 * Deliberately empty. Use with care: the value here replaces the name
 * for the rest of the pipeline, not just the label shown on screen, so
 * an entry also changes the player's URL slug and is what SCHOOL_LOOKUP,
 * the live position-tab overlay, and both photo sources are matched
 * against. Aliasing a name whose sheet spelling is already correct
 * therefore makes the player unfindable by their real name and can
 * silently strip their school and headshot.
 *
 * ("jeremiyah love" -> "Jeremiah Love" lived here and did exactly that:
 * it dropped the y from Jeremiyah Love's name, so he appeared to be
 * missing from the 2026 class entirely.)
 */
const CANONICAL_DISPLAY_NAMES: Record<string, string> = {};

function canonicalDisplayName(name: string): string {
  return CANONICAL_DISPLAY_NAMES[normalizeName(name)] ?? name;
}

function slugify(name: string, draftClass?: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return draftClass ? `${base}-${draftClass}` : base;
}

const VALID_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

interface SubScoreMetric {
  label: string;
  col: string;
  lowerIsBetter: boolean;
}

/**
 * Every raw column that gets its own percentile sub-score per
 * position, in display order — everything else in that position's
 * tab (MOCK, and the specific exclusions below) is intentionally
 * left out. Draft Capital (ADP) and Opportunity (OPP) are handled
 * separately and always appended last, the same for every position.
 *
 * Exclusions: MOCK never scored (any position); "o/u" not scored for
 * RB; PROD not scored for RB; Height/Weight not scored for WR; TS%
 * not scored for TE.
 */
/**
 * Stand-in raw values for a metric that's explicitly the worst
 * possible case (e.g. "None" for breakout age, "UDFA" for a mock
 * slot) rather than genuinely missing data — since both of those
 * metrics are "lower is better", a value guaranteed to be worse than
 * anyone's real number gives a real 0th-percentile score instead of
 * silently excluding the player from the sub-score entirely.
 */
const NONE_BREAKOUT_AGE_SENTINEL = 50;
const UDFA_MOCK_SENTINEL = 500;

/** Synthetic metric column for the WR Size sub-score. Not a real sheet
 *  column — buildWrSizeMetric fills it in before percentile ranking. */
const WR_SIZE_COL = "__WR_SIZE";

/** Accepted spellings for the WR tab's height/weight columns. Whichever
 *  is found first wins; if neither is present the Size metric is simply
 *  absent rather than wrong. */
const WR_HEIGHT_COLS = ["HEIGHT", "HT", "HGT"];
const WR_WEIGHT_COLS = ["WEIGHT", "WT", "WGT", "LBS"];

/** Raw keys the parsed height/weight land under before being combined. */
const WR_HEIGHT_KEY = "__WR_HEIGHT";
const WR_WEIGHT_KEY = "__WR_WEIGHT";

/**
 * Parses a height cell into inches, accepting the formats a sheet
 * realistically contains: 74, 74.5, 6'2, 6'2", 6-2, 6 2.
 */
function parseHeightInches(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const text = raw.trim();
  if (!text) return undefined;

  const feetInches = text.match(/^(\d)\s*(?:'|-|\s)\s*(\d{1,2}(?:\.\d+)?)\s*"?$/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2]);
    if (Number.isFinite(feet) && Number.isFinite(inches)) return feet * 12 + inches;
  }

  const plain = toNumber(text);
  // A bare number under 12 is feet, not inches (e.g. "6.2" is unusable
  // as inches and almost certainly means 6ft) — treat it as missing
  // rather than guess and produce a nonsense percentile.
  if (plain !== undefined && plain >= 12) return plain;
  return undefined;
}

/** Percentile rank of value within sorted (0-100, higher = bigger). */
function percentileRank(sorted: number[], value: number): number {
  if (sorted.length <= 1) return 50;
  let below = 0;
  for (const v of sorted) {
    if (v < value) below++;
  }
  return (below / (sorted.length - 1)) * 100;
}

/**
 * Builds the WR "Size" metric from height and weight.
 *
 * Deliberately not BMI. BMI is a ratio, so it collapses genuinely
 * different players onto one number and actively penalises height: a
 * tall lean receiver and a short thick one can score identically,
 * which is the opposite of what size means for a WR.
 *
 * Instead each dimension is percentile-ranked against every other WR
 * independently and then averaged. Being taller raises the score on
 * its own, being heavier raises it on its own, and grading out elite
 * requires being both. A player missing either measurement is scored
 * on whichever one is present rather than dropped entirely.
 */
function buildWrSizeMetric(rawData: Map<string, RawTabData>) {
  const heights: number[] = [];
  const weights: number[] = [];
  for (const raw of rawData.values()) {
    const h = raw.metrics[WR_HEIGHT_KEY];
    const w = raw.metrics[WR_WEIGHT_KEY];
    if (h !== undefined) heights.push(h);
    if (w !== undefined) weights.push(w);
  }
  if (heights.length === 0 && weights.length === 0) return;
  heights.sort((a, b) => a - b);
  weights.sort((a, b) => a - b);

  for (const raw of rawData.values()) {
    const h = raw.metrics[WR_HEIGHT_KEY];
    const w = raw.metrics[WR_WEIGHT_KEY];
    const parts: number[] = [];
    if (h !== undefined && heights.length > 0) parts.push(percentileRank(heights, h));
    if (w !== undefined && weights.length > 0) parts.push(percentileRank(weights, w));
    if (parts.length === 0) continue;
    raw.metrics[WR_SIZE_COL] = parts.reduce((sum, v) => sum + v, 0) / parts.length;
  }
}

const POSITION_METRICS: Record<"QB" | "RB" | "WR" | "TE", SubScoreMetric[]> = {
  QB: [
    { label: "Production", col: "Pass Y/G", lowerIsBetter: false },
    { label: "Accuracy", col: "Comp%", lowerIsBetter: false },
    { label: "Ball Security", col: "INT%", lowerIsBetter: true },
    { label: "Rushing", col: "Rush Y/G", lowerIsBetter: false },
  ],
  RB: [
    { label: "Size", col: "BMI", lowerIsBetter: false },
    { label: "Speed", col: "40T", lowerIsBetter: true },
    { label: "Receiving", col: "CTS", lowerIsBetter: false },
    { label: "Age", col: "AGE", lowerIsBetter: true },
  ],
  WR: [
    { label: "Production", col: "PROD", lowerIsBetter: false },
    { label: "Dominator", col: "MKT", lowerIsBetter: false },
    { label: "Breakout Age", col: "B/O AGE", lowerIsBetter: true },
    // Derived from the tab's height and weight columns rather than
    // read directly — see buildWrSizeMetric.
    { label: "Size", col: WR_SIZE_COL, lowerIsBetter: false },
  ],
  TE: [
    { label: "Production", col: "YPG", lowerIsBetter: false },
    { label: "Volume", col: "CTS", lowerIsBetter: false },
    { label: "Redzone Threat", col: "TD/G", lowerIsBetter: false },
    { label: "Athleticism", col: "RAS", lowerIsBetter: false },
  ],
};

interface RawTabData {
  school?: string;
  metrics: Record<string, number | undefined>; // keyed by SubScoreMetric.col
  metricIsElite?: Record<string, boolean>; // e.g. an Age value written as "18.5+"
  adp?: number;
  opp?: string; // e.g. "QB1", "WR1" — a text draft-slot label, not a number
  mock?: number; // pre-draft mock-draft pick number, used for prospects without ADP yet
}

const norm = (s: string | undefined) => (s ?? "").replace(/\s+/g, "").toLowerCase();

/**
 * Everything before 2016 lives on one combined tab per position
 * (e.g. "QBSPRE16") instead of a tab per individual year — those
 * older classes weren't broken out year by year.
 */
function resolveTabName(position: "QB" | "RB" | "WR" | "TE", draftClass: string): string {
  const year = Number(draftClass);
  if (!Number.isFinite(year) || year < 2016) {
    return `${position}SPRE16`;
  }
  return `${position}S${draftClass.slice(-2)}`;
}

/**
 * Every position/class-year tab (e.g. "QBS27", "RBS24", or the
 * combined "QBSPRE16" for anything before 2016) has School plus
 * this position's measurable columns, live. Returns a Name -> raw-
 * data map for that one tab. Returns an empty map on any failure, so
 * a missing/renamed tab doesn't take down the rest of the site.
 */
async function fetchPositionTab(position: "QB" | "RB" | "WR" | "TE", tabName: string): Promise<Map<string, RawTabData>> {
  const rows = await fetchNamedTabRows(tabName);

  const header = findHeaderPair(rows, "Name", "School");
  const map = new Map<string, RawTabData>();
  if (!header) {
    return map;
  }
  const { row: headerRowIndex, col: nameCol } = header;
  const headerRow = rows[headerRowIndex] ?? [];

  const findCol = (label: string) => {
    const target = norm(label);
    return headerRow.findIndex((cell) => norm(cell) === target);
  };

  // WR_SIZE_COL is synthetic (built from height/weight below), so it
  // never resolves to a real header and is excluded from the direct
  // column reads.
  const metricCols = POSITION_METRICS[position]
    .filter((m) => m.col !== WR_SIZE_COL)
    .map((m) => ({ col: m.col, idx: findCol(m.col) }));
  const firstFoundCol = (labels: string[]) => {
    for (const label of labels) {
      const idx = findCol(label);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const colHeight = position === "WR" ? firstFoundCol(WR_HEIGHT_COLS) : -1;
  const colWeight = position === "WR" ? firstFoundCol(WR_WEIGHT_COLS) : -1;
  if (position === "WR" && colHeight < 0 && colWeight < 0) {
    const message = `Tab "${tabName}": no height or weight column found — Size sub-score will be absent for this class.`;
    console.error(`[wr-size] ${message} Header row: ${headerRow.join(" | ")}`);
    reportHealthEvent(`[WR Size] ${message}`);
  }
  const colAdp = findCol("ADP");
  const colOpp = findCol("OPP");
  const colMock = findCol("MOCK");
  // Confirming/ruling out a sheet-side column rename as the cause of
  // a reported "no drafted player has hasDraftData=true" regression
  // — Name/School still resolve fine (different lookup), so if ADP
  // or OPP specifically come back -1 here, that's the real answer,
  // not a code bug in the matching logic itself.
  if (colAdp < 0 || colOpp < 0) {
    console.error(
      `[sheet-columns] Tab "${tabName}" — ADP column ${colAdp < 0 ? "NOT FOUND" : `found at ${colAdp}`}, OPP column ${colOpp < 0 ? "NOT FOUND" : `found at ${colOpp}`}. Actual header row: ${headerRow.join(" | ")}`
    );
  }

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const name = r[nameCol]?.trim();
    const school = r[nameCol + 1]?.trim();
    if (!name) continue;

    const metrics: Record<string, number | undefined> = {};
    const metricIsElite: Record<string, boolean> = {};
    for (const { col, idx } of metricCols) {
      const raw = idx >= 0 ? r[idx]?.trim() : undefined;
      // "Age" is sometimes written like "18.5+", meaning an elite
      // breakout age — always the best possible value, rather than
      // something toNumber can parse normally.
      if (raw && raw.endsWith("+") && (col === "AGE" || col === "B/O AGE")) {
        metrics[col] = 1;
        metricIsElite[col] = true;
      } else if (col === "B/O AGE") {
        // No usable breakout age at all — blank, "None", or anything
        // else that isn't a real number — is the worst possible
        // value for this metric (lower is better), not a missing
        // data point, so it scores as a real 0th percentile and
        // still counts toward everyone else's percentile pool.
        metrics[col] = toNumber(raw) ?? NONE_BREAKOUT_AGE_SENTINEL;
      } else {
        metrics[col] = toNumber(raw);
      }
    }

    if (colHeight >= 0) {
      const h = parseHeightInches(r[colHeight]);
      if (h !== undefined) metrics[WR_HEIGHT_KEY] = h;
    }
    if (colWeight >= 0) {
      const w = toNumber(r[colWeight]?.trim());
      if (w !== undefined) metrics[WR_WEIGHT_KEY] = w;
    }

    const mockRaw = colMock >= 0 ? r[colMock]?.trim() : undefined;
    // Same idea for Mock — blank, "UDFA", or anything else that
    // isn't a real pick number is undrafted-free-agent territory,
    // the worst possible mock slot, not a missing data point.
    const mock = colMock >= 0 ? toNumber(mockRaw) ?? UDFA_MOCK_SENTINEL : undefined;

    map.set(normalizeNameLoose(name), {
      school: school || undefined,
      metrics,
      metricIsElite,
      adp: colAdp >= 0 ? toNumber(r[colAdp]) : undefined,
      opp: colOpp >= 0 ? (r[colOpp]?.trim() || undefined) : undefined,
      mock,
    });
  }

  // Size is relative to the rest of the position, so it can only be
  // computed once every row on this tab has been read.
  if (position === "WR") buildWrSizeMetric(map);

  return map;
}

/**
 * Live school + sub-score raw data for every distinct (position,
 * tab) combination present in the current prospect list — every
 * pre-2016 year for a position shares one tab, so this naturally
 * dedupes them into a single fetch instead of one per year. Fetches
 * each tab in parallel, throttled.
 */
async function fetchLivePositionData(prospects: Prospect[]): Promise<Map<string, RawTabData>> {
  const combos = new Set<string>();
  for (const p of prospects) {
    if (p.draftClass && VALID_POSITIONS.includes(p.position)) {
      const tabName = resolveTabName(p.position as "QB" | "RB" | "WR" | "TE", p.draftClass);
      combos.add(`${p.position}|${tabName}`);
    }
  }

  // Fetching 50+ tabs from the same sheet all at once trips Google's
  // gviz rate limit almost immediately. A handful at a time, with the
  // retry/backoff in fetchNamedTabRows covering the rest, gets
  // through reliably instead. PRE16 tabs go first — each one covers
  // many players at once, so losing one to a stubborn rate limit
  // hurts far more than losing a single year's tab.
  const CONCURRENCY = 3;
  const keys = [...combos].sort((a, b) => {
    const aPre = a.includes("PRE16") ? 0 : 1;
    const bPre = b.includes("PRE16") ? 0 : 1;
    return aPre - bPre;
  });
  const merged = new Map<string, RawTabData>();

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    const maps = await Promise.all(
      batch.map((key) => {
        const [position, tabName] = key.split("|") as ["QB" | "RB" | "WR" | "TE", string];
        return fetchPositionTab(position, tabName);
      })
    );
    for (const m of maps) {
      for (const [k, v] of m) merged.set(k, v);
    }
  }

  return merged;
}

/**
 * Percentile rank (0-100) of `value` within `values`, where a higher
 * result always means "better" — direction is normalized by the
 * caller via `lowerIsBetter`. Ties share the same percentile.
 */
function percentileOf(value: number, values: number[], lowerIsBetter: boolean): number {
  if (values.length === 0) return 0;
  const betterOrEqualCount = values.filter((v) => (lowerIsBetter ? v >= value : v <= value)).length;
  return Math.round((betterOrEqualCount / values.length) * 100);
}

/**
 * Computes every position-specific percentile sub-score for each
 * prospect, from the live per-position raw data just fetched. Every
 * metric in POSITION_METRICS is a true percentile among every
 * prospect at that position.
 *
 * A prospect's remaining two scores depend on whether they have an
 * ADP yet:
 *  - Has ADP ("resolved"): Draft Capital (percentile of ADP, lower
 *    is better) + Opportunity (a text label from the sheet, e.g.
 *    "QB1", not a percentile).
 *  - No ADP but has a MOCK value ("pre-draft", e.g. an upcoming
 *    class): Mock (percentile of MOCK pick number, lower is better —
 *    computed across every prospect with a MOCK value, regardless of
 *    position, since mock-draft slot is comparable across positions).
 *
 * A raw value flagged elite (e.g. an "18.5+" breakout age) always
 * scores as the single best possible value for its metric.
 */
/**
 * These WRs are manually locked in as an elite (100th percentile)
 * breakout age, regardless of what the sheet's B/O AGE column shows
 * or whether their tab data was found at all — set directly per
 * request rather than relying on parsing a "+" out of the sheet.
 */
const ELITE_BREAKOUT_AGE_WRS = new Set(
  [
    "Malachi Toney",
    "Jeremiah Smith",
    "Malik Nabers",
    "David Bell",
    "Ronald Moore",
    "Juju Smith-Schuster",
    "Tyler Boyd",
    "Amari Cooper",
    "Jamison Crowder",
  ].map(normalizeName)
);

/**
 * Assigns photoUrl to each prospect — Sleeper for drafted players,
 * ESPN college rosters for devy/undrafted ones. Extracted into its
 * own function (rather than staying inline) specifically so it's
 * unit-testable in isolation, and specifically so its precondition
 * can be stated and enforced in one place instead of being an
 * implicit assumption buried in a much larger function.
 *
 * REQUIRES p.hasDraftData to already be correctly set on every
 * prospect before this runs — i.e., call this AFTER
 * applySubScores/applyDDScores, never before. This exact ordering
 * mistake shipped to production once already: with hasDraftData not
 * yet computed, every prospect (including real historical drafted
 * players) evaluated as "not drafted" and got routed to the ESPN
 * college-roster lookup instead of Sleeper, silently breaking photos
 * for thousands of players at once. The invariant check below exists
 * specifically to catch a recurrence of that immediately and loudly
 * in logs, rather than requiring another round of manual log
 * archaeology to find it again.
 */
/**
 * Also assigns heightIn/weightLbs in this same pass — not a separate
 * function, deliberately. The hasDraftData-ordering bug documented
 * above (drafted players silently routed to the wrong source) would
 * be just as real a risk for bio data as it was for photos; reusing
 * this exact function and its already-correct branching means bio
 * assignment inherits that same correctness guarantee for free,
 * rather than needing its own independently-verified invariant.
 */
export function assignProspectPhotos(
  prospects: Prospect[],
  photoIndex: Map<string, string>,
  collegePhotoIndex: Map<string, string>,
  bioIndex: Map<string, PlayerBio>,
  collegeBioIndex: Map<string, PlayerBio>
): void {
  if (prospects.length > 50 && !prospects.some((p) => p.hasDraftData === true)) {
    console.error(
      `[assignProspectPhotos] INVARIANT VIOLATION: ${prospects.length} prospects passed in, but zero have hasDraftData === true. This function must run AFTER applySubScores/applyDDScores have computed hasDraftData, never before — every photo assigned this cycle will be wrong.`
    );
  }

  for (const p of prospects) {
    if (p.hasDraftData !== true) {
      const collegePhoto = lookupCollegePhoto(collegePhotoIndex, p.name);
      if (collegePhoto) p.photoUrl = collegePhoto;
      const bio = lookupCollegeBio(collegeBioIndex, p.name);
      if (bio) {
        if (bio.heightIn !== undefined) p.heightIn = bio.heightIn;
        if (bio.weightLbs !== undefined) p.weightLbs = bio.weightLbs;
      }
      continue;
    }
    const photo = lookupPlayerPhoto(photoIndex, p.name, p.position);
    if (photo) p.photoUrl = photo;
    const bio = lookupPlayerBio(bioIndex, p.name, p.position);
    if (bio) {
      if (bio.heightIn !== undefined) p.heightIn = bio.heightIn;
      if (bio.weightLbs !== undefined) p.weightLbs = bio.weightLbs;
    }
  }
}

/**
 * Assigns schoolLogoUrl to every prospect with a recognized school —
 * unlike assignProspectPhotos, this applies uniformly to drafted and
 * devy prospects alike (a team logo isn't tied to draft status the
 * way a player headshot's source is), and has no hasDraftData
 * dependency at all, so none of that function's ordering concerns
 * apply here.
 */
export function assignSchoolLogos(prospects: Prospect[], logoIndex: Map<string, string>): void {
  for (const p of prospects) {
    if (!p.school) continue;
    const logo = logoIndex.get(p.school.toUpperCase());
    if (logo) p.schoolLogoUrl = logo;
  }
}

function applySubScores(prospects: Prospect[], rawData: Map<string, RawTabData>) {
  type Bucket = { metrics: Record<string, number[]>; adp: number[] };
  const byPosition: Record<"QB" | "RB" | "WR" | "TE", Bucket> = {
    QB: { metrics: {}, adp: [] },
    RB: { metrics: {}, adp: [] },
    WR: { metrics: {}, adp: [] },
    TE: { metrics: {}, adp: [] },
  };
  for (const pos of Object.keys(byPosition) as (keyof typeof byPosition)[]) {
    for (const m of POSITION_METRICS[pos]) byPosition[pos].metrics[m.col] = [];
  }

  const perProspectRaw = new Map<string, RawTabData>();
  const allMockValues: number[] = [];
  for (const p of prospects) {
    if (!(p.position in byPosition)) continue;
    const pos = p.position as keyof typeof byPosition;
    let raw = rawData.get(normalizeNameLoose(p.name));

    if (pos === "WR" && ELITE_BREAKOUT_AGE_WRS.has(normalizeName(p.name))) {
      // Force this WR's Breakout Age to the best possible raw value
      // (matches the internal convention used for a "+" elite age),
      // creating a stub record if their tab data wasn't found at all
      // so the override always applies.
      raw = raw ?? { metrics: {} };
      raw.metrics["B/O AGE"] = 1;
      raw.metricIsElite = { ...raw.metricIsElite, "B/O AGE": true };
    }

    if (!raw) continue;
    // A player is considered drafted/resolved only when the live sheet has
    // BOTH real ADP and OPP data. This is intentionally data-driven rather
    // than based on draft year, so it updates automatically as the sheet does.
    p.hasDraftData = raw.adp !== undefined && raw.opp !== undefined;
    // Keep the raw draft position too (not just its percentile sub-score) —
    // only when the prospect is actually resolved, mirroring hasDraftData.
    if (p.hasDraftData) p.adp = raw.adp;
    perProspectRaw.set(p.id, raw);
    const bucket = byPosition[pos];
    for (const m of POSITION_METRICS[pos]) {
      const v = raw.metrics[m.col];
      if (v !== undefined) (bucket.metrics[m.col] ??= []).push(v);
    }
    if (raw.adp !== undefined) bucket.adp.push(raw.adp);
    // Only prospects without an ADP yet count toward the mock pool —
    // once someone has real draft capital, their mock pick doesn't
    // belong in the "still projecting" comparison pool.
    if (!(raw.adp !== undefined && raw.opp !== undefined) && raw.mock !== undefined) {
      allMockValues.push(raw.mock);
    }
  }

  for (const p of prospects) {
    if (!(p.position in byPosition)) continue;
    const pos = p.position as keyof typeof byPosition;
    const raw = perProspectRaw.get(p.id);
    if (!raw) continue;
    const bucket = byPosition[pos];

    const scores: import("@/types/prospect").SubScore[] = [];
    for (const m of POSITION_METRICS[pos]) {
      const v = raw.metrics[m.col];
      if (v !== undefined) {
        const isElite = raw.metricIsElite?.[m.col] === true;
        scores.push({
          label: m.label,
          value: percentileOf(v, bucket.metrics[m.col] ?? [], m.lowerIsBetter),
          isElite,
        });
      }
    }

    // "Resolved" (Draft Capital + Opportunity, based on Prospect
    // Score) requires BOTH an ADP and an OPP value — missing either
    // one means this prospect hasn't been placed in a real class yet,
    // so it falls back to the pre-draft regime (Mock, Pre-Draft
    // Score) instead.
    if (raw.adp !== undefined && raw.opp !== undefined) {
      scores.push({ label: "Draft Capital", value: percentileOf(raw.adp, bucket.adp, true) });
      scores.push({ label: "Opportunity", text: raw.opp });
    } else if (p.draftClass === "2028") {
      // 2028 is intentionally pre-draft: do not turn mock/placeholder
      // draft data into a percentile. Both contextual rings remain TBD.
      scores.push({ label: "Mock", text: "TBD", isPending: true });
      scores.push({ label: "Opportunity", text: "TBD", isPending: true });
    } else if (raw.mock !== undefined) {
      scores.push({ label: "Mock", value: percentileOf(raw.mock, allMockValues, true) });
      scores.push({ label: "Opportunity", text: "—", isPending: true });
    }
    if (scores.length > 0) p.subScores = scores;
  }
}

/**
 * Reads the "Weight Scales" tab to learn how much each sub-score
 * should count when finding similar prospects. The tab is laid out
 * in two side-by-side blocks: most metric names sit in column C with
 * their weight 3 rows below in column N; the rest (e.g. Dominator)
 * sit in column P with their weight 3 rows below in column Z. Weight
 * lookup is by raw sheet column name (e.g. "BMI"), not the display
 * label, since that's what's actually written in the tab.
 */
async function fetchSubScoreWeights(): Promise<Record<"QB" | "RB" | "WR" | "TE", Record<string, number>>> {
  const result: Record<"QB" | "RB" | "WR" | "TE", Record<string, number>> = { QB: {}, RB: {}, WR: {}, TE: {} };
  const rows = await fetchNamedTabRows("Weight Scales");
  if (rows.length === 0) return result;

  // Legacy fixed positions, kept only as a last-resort fallback below.
  const LABEL_COL_1 = 2; // C
  const WEIGHT_COL_1 = 13; // N
  const LABEL_COL_2 = 15; // P
  const WEIGHT_COL_2 = 25; // Z
  const ROW_OFFSET = 3;

  /**
   * Each metric block in Weight Scales looks like this, with the block
   * name, the index rows and the weights row all sharing one column:
   *
   *   PROD          | Tier 1 | Tier 2 | ...
   *   Lower Index   | -      | 600    | ...
   *   Higher Index  | 599    | 699    | ...
   *   Weights       | 0.4    | 0.62   | ...   | 26   <- Category Weight
   *
   * Scanning for the block name in ANY column and then finding its own
   * Weights row matters because the previous version only looked in
   * columns C and P and always read exactly 3 rows down. Any metric
   * whose block sat elsewhere, or had a different number of index
   * rows, silently returned no weight — and a missing weight doesn't
   * fail loudly, it falls back to 1 in findSimilarProspects, which
   * quietly flattens every metric to equal importance and is exactly
   * what makes comparisons look "off".
   */
  let categoryWeightCol = -1;
  for (let i = 0; i < rows.length && categoryWeightCol < 0; i++) {
    const row = rows[i];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (norm(row[c]) === "categoryweight") {
        categoryWeightCol = c;
        break;
      }
    }
  }

  function weightFromRow(row: Row | undefined, labelCol: number): number | undefined {
    if (!row) return undefined;
    if (categoryWeightCol >= 0) {
      const w = toNumber(row[categoryWeightCol]);
      if (w !== undefined) return w;
    }
    // Category Weight is the rightmost value on the row, so the last
    // numeric cell is a safe fallback when the header isn't found.
    for (let z = row.length - 1; z > labelCol; z--) {
      const w = toNumber(row[z]);
      if (w !== undefined) return w;
    }
    return undefined;
  }

  function findWeight(rawColName: string): number | undefined {
    const target = norm(rawColName);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (norm(row[c]) !== target) continue;
        // The block's own Weights row, in the same column as its name.
        for (let k = i + 1; k < Math.min(i + 6, rows.length); k++) {
          if (norm(rows[k]?.[c]) !== "weights") continue;
          const w = weightFromRow(rows[k], c);
          if (w !== undefined) return w;
        }
      }
    }
    // Last resort: the original fixed-column lookup, so a layout this
    // scan doesn't understand still behaves as it did before.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      if (norm(row[LABEL_COL_1]) === target) {
        const w = toNumber(rows[i + ROW_OFFSET]?.[WEIGHT_COL_1]);
        if (w !== undefined) return w;
      }
      if (norm(row[LABEL_COL_2]) === target) {
        const w = toNumber(rows[i + ROW_OFFSET]?.[WEIGHT_COL_2]);
        if (w !== undefined) return w;
      }
    }
    return undefined;
  }

  const positions = Object.keys(POSITION_METRICS) as ("QB" | "RB" | "WR" | "TE")[];
  for (const pos of positions) {
    for (const m of POSITION_METRICS[pos]) {
      const w = findWeight(m.col);
      if (w !== undefined) result[pos][m.label] = w;
    }
    const adpWeight = findWeight("ADP");
    if (adpWeight !== undefined) {
      result[pos]["Draft Capital"] = adpWeight;
      // Mock stands in for Draft Capital before a prospect has a real
      // ADP — same underlying importance, so it gets the same weight.
      result[pos]["Mock"] = adpWeight;
    }
    const oppWeight = findWeight("OPP");
    if (oppWeight !== undefined) result[pos]["Opportunity"] = oppWeight;
  }

  // A silently-empty weight map is the difference between comparisons
  // ranked by real model importance and comparisons where every metric
  // counts the same, so make the failure visible instead of letting it
  // degrade quietly.
  for (const pos of positions) {
    const found = Object.keys(result[pos]).length;
    const expected = POSITION_METRICS[pos].length + 2; // + Draft Capital/Mock + Opportunity
    if (found < expected) {
      const message = `${pos}: resolved ${found}/${expected} category weights from Weight Scales — comparisons and Positional Score for this position may be using default weighting for the rest.`;
      console.error(`[subscore-weights] ${message} Found: ${JSON.stringify(result[pos])}`);
      reportHealthEvent(`[Sub-Score Weights] ${message}`);
    }
  }

  return result;
}

/**
 * Finds a table's header row and starting column by scanning every
 * cell for the given label (rather than a hardcoded column index),
 * so inserting or removing a column elsewhere in the sheet can't
 * silently break parsing. Returns null if not found anywhere.
 */
function findHeader(
  rows: Row[],
  label: string
): { row: number; col: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      if (row[j]?.trim() === label) {
        return { row: i, col: j };
      }
    }
  }
  return null;
}

/**
 * Like findHeader, but requires the next cell to match a second
 * label too. Several small per-position tables in this sheet each
 * have their own "Name" column, so the master table's "Name" has to
 * be disambiguated by what immediately follows it ("Draft Year").
 */
function findHeaderPair(
  rows: Row[],
  label: string,
  nextLabel: string
): { row: number; col: number } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      if (row[j]?.trim() === label && row[j + 1]?.trim() === nextLabel) {
        return { row: i, col: j };
      }
    }
  }
  return null;
}

/**
 * The sheet's "master" combined table — one row per prospect across
 * all tracked classes, with real draft year, position, scores, and
 * career hit/miss outcome. The "Name" header is located dynamically
 * each fetch, and every other field is read relative to that column,
 * so the table can shift left or right in the sheet without breaking.
 */
function parseProspects(rows: Row[]): Prospect[] {
  const header = findHeaderPair(rows, "Name", "Draft Year");
  if (!header) return [];
  const { row: headerRowIndex, col: c } = header;
  // Relative layout: Name, Draft Year, Position, Raw Score,
  // Pre-Draft Score, O.I.S, Prospect Score, Pre-Draft %, Prospect %,
  // Finishes, Hit/Miss
  const [cName, cDraftYear, cPosition, cRaw, cPreDraft, , cProspect, , , cFinish, cHitMiss] = [
    c, c + 1, c + 2, c + 3, c + 4, c + 5, c + 6, c + 7, c + 8, c + 9, c + 10,
  ];

  const prospects: Prospect[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const rawName = r[cName]?.trim();
    if (!rawName) continue;
    const name = canonicalDisplayName(rawName);

    const position = r[cPosition]?.trim() as Position;
    if (!VALID_POSITIONS.includes(position)) continue;

    const draftClass = r[cDraftYear]?.trim() || undefined;
    const rawScore = toNumber(r[cRaw]);
    const preDraftScore = toNumber(r[cPreDraft]);
    const opportunityScore = toNumber(r[c + 5]);
    const prospectScore = toNumber(r[cProspect]);
    const finish = r[cFinish]?.trim() || undefined;
    const hitMissRaw = r[cHitMiss]?.trim().toUpperCase();
    const hitMiss = hitMissRaw === "HIT" || hitMissRaw === "MISS" ? hitMissRaw : undefined;

    prospects.push({
      id: slugify(name, draftClass),
      name,
      school: SCHOOL_LOOKUP[normalizeName(name)],
      position,
      draftClass,
      rawScore,
      preDraftScore,
      positionalScore: prospectScore,
      opportunityScore,
      finish,
      hitMiss,
      tier: getTierForScore(prospectScore),
      grade:
        prospectScore !== undefined
          ? {
              film: rawScore ?? prospectScore,
              production: preDraftScore ?? prospectScore,
              measurables: opportunityScore ?? prospectScore,
              overall: prospectScore,
            }
          : undefined,
    });
  }

  // The master sheet can contain accidental duplicate rows. A prospect is
  // uniquely identified by the same name + class slug used everywhere else
  // in the application. Keep the first complete row for each id so counts,
  // rankings, class totals, and analytics all describe one population.
  const unique = new Map<string, Prospect>();
  for (const prospect of prospects) {
    if (!unique.has(prospect.id)) unique.set(prospect.id, prospect);
  }

  // Overall rank is assigned only after live ADP/OPP data and DD Scores
  // have been applied. At this stage we deliberately do not assign a
  // potentially stale/static rank from the raw master table.
  return [...unique.values()];
}

/**
 * A forward-looking class tab — e.g. "2027 Class" — with prospects
 * that haven't been through a real draft or NFL season yet. Layout:
 * Name, Position, Raw Score, Pre-Draft Score, O.I.S, Prospect Score.
 * O.I.S and Prospect Score are #N/A until the class actually
 * develops, so those come through as undefined — the UI shows "TBD"
 * for those instead of a final score.
 */
function parseFutureClassTab(rows: Row[], classYear: string): Prospect[] {
  const header = findHeaderPair(rows, "Name", "Position");
  if (!header) return [];
  const { row: headerRowIndex, col: c } = header;
  const cName = c;
  const cPosition = c + 1;
  const cRaw = c + 2;
  const cPreDraft = c + 3;
  const cProspect = c + 5;

  // Read School live from this same tab when it's there, rather than
  // relying only on the static one-time SCHOOL_LOOKUP snapshot — that
  // snapshot was built once from historical tabs and doesn't cover
  // every prospect who's since been added directly to a future
  // class's own tab.
  const headerRow = rows[headerRowIndex] ?? [];
  const cSchool = headerRow.findIndex((cell) => norm(cell) === "school");

  const prospects: Prospect[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const rawName = r[cName]?.trim();
    if (!rawName) continue;
    const name = canonicalDisplayName(rawName);

    const position = r[cPosition]?.trim() as Position;
    if (!VALID_POSITIONS.includes(position)) continue;

    const rawScore = toNumber(r[cRaw]);
    const preDraftScore = toNumber(r[cPreDraft]);
    const prospectScore = toNumber(r[cProspect]);
    const liveSchool = cSchool >= 0 ? r[cSchool]?.trim() : undefined;

    prospects.push({
      id: slugify(name, classYear),
      name,
      school: liveSchool || SCHOOL_LOOKUP[normalizeName(name)],
      position,
      draftClass: classYear,
      rawScore,
      preDraftScore,
      positionalScore: prospectScore,
      tier: getTierForScore(prospectScore),
      grade:
        prospectScore !== undefined
          ? {
              film: rawScore ?? prospectScore,
              production: preDraftScore ?? prospectScore,
              measurables: prospectScore,
              overall: prospectScore,
            }
          : undefined,
    });
  }

  return prospects;
}

/**
 * The sheet's overall (all-position) Tier summary block — real
 * counts and hit rates per tier, computed by the user's own model.
 */
function parseTierSummary(rows: Row[]): TierSummaryRow[] {
  const header = findHeader(rows, "Tier");
  if (!header) return [];
  const { row: headerRowIndex, col: c } = header;
  const cProspects = c + 1;
  const cEligible = c + 2;
  const cHitRate = c + 16; // "HIT Rate" column, well past the per-tier-name sub-columns

  const summary: TierSummaryRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const tier = r[c]?.trim();
    if (!tier) break;

    summary.push({
      tier,
      prospects: toNumber(r[cProspects]) ?? 0,
      eligibleProspects: toNumber(r[cEligible]) ?? 0,
      hitRate: toPercent(r[cHitRate]),
    });
  }

  return summary;
}

/**
 * The sheet's Class Year historical trend block — real hit rate and
 * round-by-round Approximate Value by draft class, going back over a
 * decade of backtested classes.
 */
function parseClassTrend(rows: Row[]): ClassYearTrend[] {
  const header = findHeader(rows, "Class Year");
  if (!header) return [];
  const { row: headerRowIndex, col: c } = header;
  // Relative layout: Class Year, 1st-4th Round AV, 1st-4th Round HIT, HIT Rate
  const cRound1AV = c + 1;
  const cRound2AV = c + 2;
  const cRound3AV = c + 3;
  const cRound4AV = c + 4;
  const cRound1Hit = c + 5;
  const cRound2Hit = c + 6;
  const cRound3Hit = c + 7;
  const cRound4Hit = c + 8;
  const cHitRate = c + 9;

  const trend: ClassYearTrend[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const classYear = r[c]?.trim();
    if (!classYear) break;
    if (classYear.toUpperCase().includes("AVG")) continue;

    trend.push({
      classYear,
      round1AV: toNumber(r[cRound1AV]) ?? null,
      round2AV: toNumber(r[cRound2AV]) ?? null,
      round3AV: toNumber(r[cRound3AV]) ?? null,
      round4AV: toNumber(r[cRound4AV]) ?? null,
      round1HitRate: toPercent(r[cRound1Hit]),
      round2HitRate: toPercent(r[cRound2Hit]),
      round3HitRate: toPercent(r[cRound3Hit]),
      round4HitRate: toPercent(r[cRound4Hit]),
      hitRate: toPercent(r[cHitRate]),
    });
  }

  return trend;
}

export interface SheetData {
  prospects: Prospect[];
  tierSummary: TierSummaryRow[];
  classTrend: ClassYearTrend[];
  subScoreWeights: Record<"QB" | "RB" | "WR" | "TE", Record<string, number>>;
}

let cache: { data: SheetData; expires: number; version: number } | null = null;
// Monotonic snapshot version used to prevent a failed/older cache read from
// replacing a newer in-memory dataset. A refresh builds a complete new snapshot
// first, then promotes it in one assignment.
let snapshotVersion = 0;
// Guards against a "thundering herd": without this, several requests
// arriving in the same instant right after the 60s cache expires would
// each independently kick off the full fetch + parse + DD Score
// calibration fit at once, multiplying both CPU and memory load right
// when the server is already doing its most expensive work. With it,
// only the first caller does the work; everyone else awaits that same
// in-flight promise instead of starting their own.
let inFlight: Promise<SheetData> | null = null;

// Development-only disk fallback. Production never reads this once
// DATABASE_URL is configured: the shared Postgres snapshot is the sole source
// of truth, so an old /tmp file can never resurrect stale data after a newer
// snapshot has been published elsewhere.
const DISK_CACHE_PATH = path.join(os.tmpdir(), "dynasty-database-sheet-cache.json");

// Used only as a last-resort fallback in local development when a live fetch
// fails and no shared snapshot store exists. Production deliberately does not
// read this file, preserving the global no-rollback invariant.
function readDiskCacheIgnoringExpiry(): { data: SheetData; expires: number; version?: number } | null {
  try {
    const raw = fs.readFileSync(DISK_CACHE_PATH, "utf8");
    return JSON.parse(raw) as { data: SheetData; expires: number; version?: number };
  } catch {
    return null;
  }
}

function writeDiskCache(entry: { data: SheetData; expires: number; version: number }): void {
  try {
    // Atomic replace prevents another request/process from ever reading a
    // half-written or mixed snapshot. Readers see either the complete old
    // snapshot or the complete new snapshot, never an intermediate state.
    const tmpPath = `${DISK_CACHE_PATH}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(entry));
    fs.renameSync(tmpPath, DISK_CACHE_PATH);
  } catch {
    // Best-effort only — a failed write just means the next call
    // (in this or another worker) re-fetches instead of reading it.
  }
}

/**
 * Fetches and parses the live sheet. Production freshness is owned by the
 * shared versioned snapshot; in-memory state is only a fast local mirror and
 * development may additionally use a disk fallback.
 */
/**
 * The actual fetch + parse + score pipeline, pulled out as its own
 * function so getSheetData can wrap it in a try/catch and fall back
 * to cached data on failure without duplicating this whole body in
 * both the success and error paths.
 */
// DD Score from the previous successful refresh, keyed by prospect
// id — kept only to power the "did this swing a lot" health check
// below, not used for anything score-facing.
let previousDDScoresById: Map<string, number> | null = null;

/**
 * Best-effort integrity pass over the freshly-parsed prospect list,
 * run once per live refresh. This doesn't fix anything or block the
 * page — it just makes data problems visible in logs the moment they
 * appear (a duplicate id, a blank name/position, a score that jumped
 * implausibly since last cycle) instead of only being noticed when
 * someone happens to spot a broken-looking player card.
 */
function runDataHealthCheck(prospects: Prospect[]): void {
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const missingName: Prospect[] = [];
  const missingPosition: Prospect[] = [];

  for (const p of prospects) {
    if (seenIds.has(p.id)) duplicateIds.add(p.id);
    seenIds.add(p.id);
    if (!p.name?.trim()) missingName.push(p);
    if (!p.position) missingPosition.push(p);
  }

  if (duplicateIds.size > 0) {
    const msg = `${duplicateIds.size} duplicate prospect id(s): ${[...duplicateIds].slice(0, 20).join(", ")}`;
    console.error(`[data-health] ${msg}`);
    reportHealthEvent(msg);
  }
  if (missingName.length > 0) {
    const msg = `${missingName.length} prospect(s) with no name (ids: ${missingName.slice(0, 20).map((p) => p.id).join(", ")})`;
    console.error(`[data-health] ${msg}`);
    reportHealthEvent(msg);
  }
  if (missingPosition.length > 0) {
    const msg = `${missingPosition.length} prospect(s) with no position: ${missingPosition.slice(0, 20).map((p) => p.name).join(", ")}`;
    console.error(`[data-health] ${msg}`);
    reportHealthEvent(msg);
  }

  // A DD Score that moved a lot in a single 60s cycle almost always
  // means a sheet edit (intentional re-grade, or a fat-fingered
  // cell) rather than the model itself — worth a glance either way.
  const SWING_THRESHOLD = 15;
  if (previousDDScoresById) {
    const swings: { name: string; from: number; to: number }[] = [];
    for (const p of prospects) {
      if (p.ddScore === undefined) continue;
      const prev = previousDDScoresById.get(p.id);
      if (prev !== undefined && Math.abs(p.ddScore - prev) >= SWING_THRESHOLD) {
        swings.push({ name: p.name, from: prev, to: p.ddScore });
      }
    }
    if (swings.length > 0) {
      const msg = `${swings.length} DD Score swing(s) of ${SWING_THRESHOLD}+ points since last refresh: ${swings.slice(0, 20).map((s) => `${s.name} (${s.from.toFixed(1)} → ${s.to.toFixed(1)})`).join(" | ")}`;
      console.error(`[data-health] ${msg}`);
      reportHealthEvent(msg);
    }
  }
  previousDDScoresById = new Map(prospects.filter((p) => p.ddScore !== undefined).map((p) => [p.id, p.ddScore as number]));
  if (duplicateIds.size === 0 && missingName.length === 0 && missingPosition.length === 0) {
    reportStatus("data-health", "ok", `${prospects.length} prospects checked, no issues found`);
  } else {
    reportStatus("data-health", "error", `${duplicateIds.size} duplicate id(s), ${missingName.length} missing name(s), ${missingPosition.length} missing position(s)`);
  }
}

async function fetchLiveSheetData(): Promise<SheetData> {
  const [rows, rows2027, rows2028] = await Promise.all([
    fetchSheetRows(),
    fetchNamedTabRows("2027 Class"),
    fetchNamedTabRows("2028 Class"),
  ]);

  const masterProspects = parseProspects(rows);
  const future2027 = parseFutureClassTab(rows2027, "2027");
  const future2028 = parseFutureClassTab(rows2028, "2028");

  // Don't duplicate a prospect who's already in the master table
  // under the same name + class (e.g. once they're fully graded).
  const masterKeys = new Set(masterProspects.map((p) => p.id));
  const extraProspects = [...future2027, ...future2028].filter(
    (p) => !masterKeys.has(p.id)
  );

  const prospects = [...masterProspects, ...extraProspects];

  // Overlay live school + sub-score raw data on top of the static
  // one-time school snapshot — live wins whenever a tab has the
  // name, the snapshot just covers gaps (renamed tabs, very old
  // classes, etc.).
  const [livePositionData, subScoreWeights] = await Promise.all([
    fetchLivePositionData(prospects),
    fetchSubScoreWeights(),
  ]);
  for (const p of prospects) {
    const live = livePositionData.get(normalizeNameLoose(p.name));
    if (live?.school) p.school = live.school;
  }
  applySubScores(prospects, livePositionData);

  // Diagnostic for the other half of the "missing photo" problem —
  // a prospect with no school at all (neither the live tab nor the
  // static SCHOOL_LOOKUP snapshot has them) can never get a college
  // photo lookup in the first place, since that lookup is keyed on
  // school. This is a data gap (the sheet itself needs a School
  // value for that row), not something the matching logic below
  // can fix on its own.
  const missingSchool = prospects.filter((p) => p.hasDraftData !== true && !p.school);
  if (missingSchool.length > 0) {
    console.error(
      `[college-photos] ${missingSchool.length} undrafted prospects have no school at all (add one in the sheet to enable a photo lookup) — sample: ${missingSchool.slice(0, 15).map((p) => p.name).join(" | ")}`
    );
  }

  // Photos have a bounded worst-case wait (see COLD_START_TIMEOUT_MS
  // in each file) only on a genuinely cold process — every call
  // after that returns instantly from cache while refreshing in
  // the background, so this is never the multi-second blocker the
  // old sheet-data cache thundering-herd issue was. Run together
  // rather than one after the other, since they're independent —
  // cuts the cold-start worst case roughly in half.
  const undraftedSchools = prospects
    .filter((p) => p.hasDraftData !== true && p.school)
    .map((p) => p.school as string);
  // Logos apply to every prospect with a school, drafted or not —
  // unlike undraftedSchools above (which only needs to cover devy
  // prospects, since that's the only population that needs a full
  // roster fetch), so this collects every school in the dataset.
  const allSchools = prospects.filter((p) => p.school).map((p) => p.school as string);
  const [photoIndex, collegePhotoIndex, logoIndex, bioIndex, collegeBioIndex] = await Promise.all([
    getPlayerPhotoIndexIfReady(),
    getCollegePhotoIndexIfReady(undraftedSchools),
    getSchoolLogoIndex(allSchools),
    getSleeperBioIndexIfReady(),
    getCollegeBioIndexIfReady(undraftedSchools),
  ]);
  assignProspectPhotos(prospects, photoIndex, collegePhotoIndex, bioIndex, collegeBioIndex);
  assignSchoolLogos(prospects, logoIndex);
  // Targeted diagnostic for specific players confirmed to be matched
  // (present with a real photoUrl here) but still reported as showing
  // no photo on the actual page — meaning the URL itself is failing
  // to load in the browser, not a matching failure. Printing the
  // exact assigned URL is the fastest way to tell a genuine ESPN gap
  // (404/placeholder) apart from a malformed URL on our end, instead
  // of guessing at either from outside.
  const PHOTO_DEBUG_NAMES = VERBOSE_DATA_DIAGNOSTICS ? ["hollywood smothers"] : [];
  if (PHOTO_DEBUG_NAMES.length > 0) {
    for (const p of prospects) {
      if (PHOTO_DEBUG_NAMES.includes(normalizeNameLoose(p.name))) {
        console.error(`[photo-debug] ${p.name}: photoUrl = ${p.photoUrl ?? "(none assigned)"}`);
      }
    }
  }
  // One-time diagnostic: the school-resolution pipeline is now
  // succeeding cleanly, but several known prospects are still not
  // matching by name within their school's successfully-fetched
  // roster. Logging the actual raw names ESPN returned (once, per
  // cache cycle) makes it possible to directly compare against a
  // real prospect name instead of guessing at another formatting
  // difference blind.
  if (VERBOSE_DATA_DIAGNOSTICS && collegePhotoIndex.size > 0) {
    console.error(
      `[college-photos] ${collegePhotoIndex.size} names found across fetched rosters — sample: ${[...collegePhotoIndex.keys()].slice(0, 30).join(" | ")}`
    );
    const stillMissing = prospects.filter((p) => p.hasDraftData !== true && p.school && !p.photoUrl);
    // Full list now (not just a sample) — with each name run through
    // the exact same matchKey the roster lookup itself uses, so a
    // formatting mismatch (nickname on the roster vs. legal name in
    // the sheet, a hyphen/apostrophe difference, etc.) is visible
    // directly instead of having to guess at it blind.
    console.error(
      `[college-photos] ${stillMissing.length} undrafted prospects still unmatched (full list): ${stillMissing.map((p) => `${p.name} (${p.school}) [key: ${matchKeyForLog(p.name)}]`).join(" | ")}`
    );
  }
  // Devy-specific breakdown, separate from the diagnostic above —
  // that one spans every backtested class since 2010, which makes
  // it useless for answering "how many 2027/2028 guys actually have
  // a photo right now". This isolates just the two forward-looking
  // classes and reports school/photo status per player directly.
  const devyClasses = prospects.filter((p) => p.draftClass === "2027" || p.draftClass === "2028");
  const devyNoSchool = devyClasses.filter((p) => !p.school);
  const devyWithSchoolNoPhoto = devyClasses.filter((p) => p.school && !p.photoUrl);
  const devyWithPhoto = devyClasses.filter((p) => p.photoUrl);
  if (VERBOSE_DATA_DIAGNOSTICS) console.error(
    `[devy-photos] ${devyClasses.length} total 2027/2028 prospects — ${devyWithPhoto.length} have a photo, ${devyNoSchool.length} have no school at all, ${devyWithSchoolNoPhoto.length} have a school but no photo`
  );
  if (VERBOSE_DATA_DIAGNOSTICS && devyNoSchool.length > 0) {
    console.error(
      `[devy-photos] no school at all: ${devyNoSchool.map((p) => `${p.name} (${p.draftClass})`).join(" | ")}`
    );
  }
  if (VERBOSE_DATA_DIAGNOSTICS && devyWithSchoolNoPhoto.length > 0) {
    console.error(
      `[devy-photos] has school, no photo: ${devyWithSchoolNoPhoto.map((p) => `${p.name} (${p.school}, ${p.draftClass})`).join(" | ")}`
    );
  }
  // Same breakdown for drafted (NFL) players, using the Sleeper
  // index instead of ESPN college rosters — added specifically to
  // stop guessing at whether a reported "drafted players missing
  // photos" regression is a matching problem (this index) or
  // something else (e.g. the client-side <img> itself failing).
  const draftedPlayers = prospects.filter((p) => p.hasDraftData === true);
  const draftedWithPhoto = draftedPlayers.filter((p) => p.photoUrl);
  const draftedWithoutPhoto = draftedPlayers.filter((p) => !p.photoUrl);
  if (VERBOSE_DATA_DIAGNOSTICS) console.error(
    `[drafted-photos] sleeper index size: ${photoIndex.size} — ${draftedPlayers.length} total drafted players, ${draftedWithPhoto.length} have a photo, ${draftedWithoutPhoto.length} do not`
  );
  if (VERBOSE_DATA_DIAGNOSTICS && draftedWithoutPhoto.length > 0) {
    console.error(
      `[drafted-photos] sample missing (first 30): ${draftedWithoutPhoto.slice(0, 30).map((p) => `${p.name} (${p.position}) [key: ${normalizeNameLoose(p.name).replace(/\s+(jr|sr|ii|iii|iv|v)$/, "")}]`).join(" | ")}`
    );
  }

  // DD Score is computed once per live data refresh. Undrafted players
  // intentionally retain an undefined/TBD DD Score; they are never given
  // a synthetic DD value from Pre-Draft Score.
  applyDDScores(prospects);
  runDataHealthCheck(prospects);
  // Cheap in the overwhelmingly common case (one indexed SELECT,
  // no-op since the snapshot is usually still fresh) — awaited rather
  // than fire-and-forget so there's no edge case around a process
  // restart racing an in-flight snapshot write.
  await maybeRefreshScoreSnapshot(prospects);
  // logDDScoreValidation(prospects) is available in lib/ddScore.ts for
  // manual calibration checks — intentionally not called here. It ran
  // on every 60s cache refresh, adding real CPU work (dozens of filter
  // passes across every format/tier) to the slowest part of the
  // request path and flooding production logs with ~37 debug lines
  // each time, which made real issues (like the OOM crash) harder to
  // spot in Railway's log stream.

  // Assign the live overall rank from the same rules used by the rankings UI:
  // drafted players first, ordered by DD Score; undrafted players after them,
  // ordered only among themselves by Pre-Draft Score.
  const ranked = [...prospects].sort((a, b) => {
    const aDrafted = a.hasDraftData === true;
    const bDrafted = b.hasDraftData === true;
    if (aDrafted !== bDrafted) return aDrafted ? -1 : 1;
    if (aDrafted) return (b.ddScore ?? -Infinity) - (a.ddScore ?? -Infinity);
    return (b.preDraftScore ?? -Infinity) - (a.preDraftScore ?? -Infinity);
  });
  ranked.forEach((p, i) => {
    p.rank = i + 1;
  });

  const data: SheetData = {
    prospects,
    tierSummary: parseTierSummary(rows),
    classTrend: parseClassTrend(rows),
    subScoreWeights,
  };

  // Snapshot promotion is deliberately handled outside this builder. The full
  // data object must exist before it is assigned to the process cache or the
  // shared database snapshot, so callers can only ever observe complete data.
  return data;
}

type Snapshot = { data: SheetData; expires: number; version: number };
type SharedSnapshotRow = { version: number | string; expires_at: string | Date; data: SheetData };
type SharedSnapshotMeta = { version: number; expires: number };

let sharedMeta: SharedSnapshotMeta | null = null;
let sharedMetaCheckedAt = 0;
let sharedMetaInFlight: Promise<SharedSnapshotMeta | null> | null = null;
// The shared snapshot is the only production authority. Do not give another
// instance even a short TTL window to serve an older version after a newer
// version has been published. Version checks are deduped while in flight, so
// concurrent callers still share the same database read.
// LISTEN/NOTIFY invalidates this immediately when another Railway instance
// publishes a snapshot. The short fallback is only for a missed notification
// or a reconnecting listener, eliminating the old per-request Postgres read.
const SHARED_META_CHECK_MS = 2000;
const SHARED_REFRESH_LOCK_KEY = 734221901;
const HAS_SHARED_SNAPSHOT_STORE = Boolean(process.env.DATABASE_URL);

if (HAS_SHARED_SNAPSHOT_STORE) {
  subscribeToDbChannel("dd_sheet_snapshot", (payload) => {
    const version = Number(payload);
    if (!Number.isFinite(version)) {
      sharedMetaCheckedAt = 0;
      return;
    }
    if (!sharedMeta || version > sharedMeta.version) {
      // Mark the local mirror stale. The next normal request pulls the full,
      // already-complete snapshot before rendering anything.
      sharedMeta = { version, expires: 0 };
      sharedMetaCheckedAt = Date.now();
    }
  });
}

function normalizeSharedRow(row: SharedSnapshotRow): Snapshot {
  return {
    data: row.data,
    version: Number(row.version),
    expires: new Date(row.expires_at).getTime(),
  };
}

function promoteSnapshot(next: Snapshot, source: "shared" | "disk" | "live"): Snapshot {
  // Never move backwards. This is the core invariant behind Old → New → Old
  // prevention: once this process has observed version N, an older source is
  // not allowed to overwrite it.
  if (cache && next.version < cache.version) return cache;
  cache = next;
  snapshotVersion = Math.max(snapshotVersion, next.version);
  if (source !== "shared") writeDiskCache(next);
  return cache;
}

async function readSharedSnapshotMeta(): Promise<SharedSnapshotMeta | null> {
  try {
    const rows = await query<{ version: number | string; expires_at: string | Date }>(
      "SELECT version, expires_at FROM sheet_data_snapshot WHERE id = 1"
    );
    const row = rows[0];
    if (!row) return null;
    return { version: Number(row.version), expires: new Date(row.expires_at).getTime() };
  } catch {
    return null;
  }
}

async function getSharedSnapshotMeta(): Promise<SharedSnapshotMeta | null> {
  if (!HAS_SHARED_SNAPSHOT_STORE) return null;
  const now = Date.now();
  if (sharedMeta && SHARED_META_CHECK_MS > 0 && now - sharedMetaCheckedAt < SHARED_META_CHECK_MS) return sharedMeta;
  if (sharedMetaInFlight) return sharedMetaInFlight;
  sharedMetaInFlight = readSharedSnapshotMeta().then((meta) => {
    sharedMeta = meta;
    sharedMetaCheckedAt = Date.now();
    return meta;
  }).finally(() => {
    sharedMetaInFlight = null;
  });
  return sharedMetaInFlight;
}

async function readSharedSnapshot(): Promise<Snapshot | null> {
  if (!HAS_SHARED_SNAPSHOT_STORE) return null;
  try {
    const rows = await query<SharedSnapshotRow>(
      "SELECT version, expires_at, data FROM sheet_data_snapshot WHERE id = 1"
    );
    const row = rows[0];
    if (!row) return null;
    const snapshot = normalizeSharedRow(row);
    sharedMeta = { version: snapshot.version, expires: snapshot.expires };
    sharedMetaCheckedAt = Date.now();
    return snapshot;
  } catch {
    return null;
  }
}

async function refreshWithSharedLock(): Promise<SheetData> {
  if (!HAS_SHARED_SNAPSHOT_STORE) throw new Error("Shared snapshot store is not configured");
  return withDbClient(async (client) => {
    const lockResult = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [SHARED_REFRESH_LOCK_KEY]
    );
    const locked = lockResult.rows[0]?.locked === true;

    if (!locked) {
      // Another instance is already building the next version. Serve its last
      // complete shared snapshot instead of starting duplicate work or making
      // this request wait behind a multi-second sheet/photo refresh.
      const rows = await client.query<SharedSnapshotRow>(
        "SELECT version, expires_at, data FROM sheet_data_snapshot WHERE id = 1"
      );
      const row = rows.rows[0];
      if (row) {
        const snapshot = normalizeSharedRow(row);
        promoteSnapshot(snapshot, "shared");
        return snapshot.data;
      }
      if (cache) return cache.data;
      throw new Error("Sheet refresh is already running and no shared snapshot exists yet");
    }

    try {
      // Re-check after acquiring the lock. A different process may have
      // finished the refresh just before this connection acquired it.
      const current = await client.query<{ version: number | string; expires_at: string | Date; data: SheetData }>(
        "SELECT version, expires_at, data FROM sheet_data_snapshot WHERE id = 1"
      );
      const currentRow = current.rows[0];
      const existing = currentRow ? normalizeSharedRow(currentRow) : null;
      if (existing && existing.expires > Date.now()) {
        promoteSnapshot(existing, "shared");
        return existing.data;
      }

      const data = await fetchLiveSheetData();
      const expires = new Date(Date.now() + REVALIDATE_SECONDS * 1000).toISOString();
      const published = await client.query<SharedSnapshotRow>(
        `INSERT INTO sheet_data_snapshot (id, version, expires_at, data, updated_at)
         VALUES (1, 1, $1::timestamptz, $2::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           version = sheet_data_snapshot.version + 1,
           expires_at = EXCLUDED.expires_at,
           data = EXCLUDED.data,
           updated_at = now()
         RETURNING version, expires_at, data`,
        [expires, JSON.stringify(data)]
      );
      const publishedRow = published.rows[0];
      if (!publishedRow) throw new Error("Shared snapshot publish returned no row");
      const snapshot = normalizeSharedRow(publishedRow);
      promoteSnapshot(snapshot, "shared");
      sharedMeta = { version: snapshot.version, expires: snapshot.expires };
      sharedMetaCheckedAt = Date.now();
      // Wake other Railway instances immediately. They still read the full
      // snapshot atomically on their next request; the notification only
      // invalidates their local mirror and carries no prospect data.
      await client.query("SELECT pg_notify('dd_sheet_snapshot', $1)", [String(snapshot.version)]).catch(() => {});
      reportStatus("google-sheet", "ok", `${data.prospects.length} prospects loaded live (snapshot v${snapshot.version})`);
      return snapshot.data;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SHARED_REFRESH_LOCK_KEY]).catch(() => {});
    }
  });
}

async function refreshLocally(): Promise<SheetData> {
  const data = await fetchLiveSheetData();
  const next: Snapshot = {
    data,
    expires: Date.now() + REVALIDATE_SECONDS * 1000,
    version: Math.max(snapshotVersion, cache?.version ?? 0) + 1,
  };
  promoteSnapshot(next, "live");
  reportStatus("google-sheet", "ok", `${data.prospects.length} prospects loaded live (local fallback)`);
  return data;
}

/**
 * Forces an immediate refresh, bypassing the normal 60s TTL — for the
 * admin-only manual refresh action. Deliberately a thin wrapper around
 * the exact same startSheetRefresh() the automatic stale-while-
 * revalidate path already uses, not a second refresh implementation:
 * same single-flight guard (a refresh already in flight is reused
 * rather than started twice), same shared-Postgres-snapshot
 * distributed-lock behavior, same error handling. The only thing this
 * adds is bypassing the "only refresh if actually expired" check —
 * an admin who just edited the sheet wants the new data now, not
 * whenever the TTL happens to lapse.
 */
export async function forceSheetRefresh(): Promise<{ prospectCount: number; version: number }> {
  await startSheetRefresh();
  if (!cache) throw new Error("Refresh completed without producing a snapshot");
  return { prospectCount: cache.data.prospects.length, version: cache.version };
}

function startSheetRefresh(): Promise<SheetData> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      // In production the shared Postgres snapshot is the ONLY authority.
      // Falling back to a process-local refresh while another instance still
      // serves the last shared version can create two different "latest"
      // datasets and is exactly how cross-instance old/new bouncing happens.
      // Development without DATABASE_URL keeps the local path.
      if (HAS_SHARED_SNAPSHOT_STORE) {
        return await refreshWithSharedLock();
      }
      return await refreshLocally();
    } catch (err) {
      console.error("[sheet-data] Live refresh failed; keeping last known-good data:", err);
      if (cache) {
        reportStatus("google-sheet", "stale", "Live refresh failed — keeping current snapshot");
        return cache.data;
      }
      // Never let a cold production instance resurrect an arbitrary /tmp
      // snapshot. Once DATABASE_URL exists, the shared version is canonical;
      // serving an old disk file while another instance has already promoted a
      // newer shared version would violate the no-rollback invariant. Disk is
      // retained only for local development/builds without the shared store.
      if (!HAS_SHARED_SNAPSHOT_STORE) {
        const staleDisk = readDiskCacheIgnoringExpiry();
        if (staleDisk) {
          const snapshot: Snapshot = {
            data: staleDisk.data,
            expires: staleDisk.expires,
            version: staleDisk.version ?? ++snapshotVersion,
          };
          promoteSnapshot(snapshot, "disk");
          reportStatus("google-sheet", "stale", `Live refresh failed — serving disk cache from ${snapshot.data.prospects.length} prospects`);
          return snapshot.data;
        }
      }
      reportStatus("google-sheet", "error", `Live refresh failed with no cache anywhere: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  })();

  inFlight.finally(() => { inFlight = null; }).catch(() => {});
  return inFlight;
}


export type OpportunityScales = Record<
  OpportunityPosition,
  { multipliers: Record<string, number>; opportunityWeight: number }
>;

let opportunityScalesCache: OpportunityScales | null = null;
let opportunityScalesCacheAt = 0;
let opportunityScalesInFlight: Promise<OpportunityScales> | null = null;

/**
 * Reads the Opportunity multipliers out of the live Weight Scales tab.
 *
 * The tab's real shape (verified against the sheet itself) is a run of
 * per-position sections headed "QBS" / "RBS" / "WRS" / "TES", each
 * containing metric blocks laid out as three rows in column A:
 *
 *   OPP      | Tier 1 | Tier 2 | ...        <- block name
 *   Index    | DEPTH  | RB2H   | ...        <- the labels
 *   Weights  | 0      | 0.34   | ...   | 17 <- multipliers, then Category Weight
 *
 * An earlier version of this parser looked for headings spelled "QB"/"RB"
 * and expected labels to start in column C, so it matched nothing at all
 * and the whole feature stayed hidden. This one keys off the structure
 * above instead, and any position it can't read falls back to the
 * transcribed values in lib/opportunityScales.ts rather than disabling
 * the feature outright.
 */
export async function getOpportunityScales(): Promise<OpportunityScales> {
  const now = Date.now();
  if (opportunityScalesCache && now - opportunityScalesCacheAt < REVALIDATE_SECONDS * 1000) {
    return opportunityScalesCache;
  }
  if (opportunityScalesInFlight) return opportunityScalesInFlight;

  opportunityScalesInFlight = (async () => {
    // Start from the transcribed defaults so a partial parse degrades to
    // "some positions live, the rest from the sheet snapshot" instead of
    // an empty map that hides the feature everywhere.
    const out: OpportunityScales = {
      QB: { ...DEFAULT_OPPORTUNITY_SCALES.QB, multipliers: { ...DEFAULT_OPPORTUNITY_SCALES.QB.multipliers } },
      RB: { ...DEFAULT_OPPORTUNITY_SCALES.RB, multipliers: { ...DEFAULT_OPPORTUNITY_SCALES.RB.multipliers } },
      WR: { ...DEFAULT_OPPORTUNITY_SCALES.WR, multipliers: { ...DEFAULT_OPPORTUNITY_SCALES.WR.multipliers } },
      TE: { ...DEFAULT_OPPORTUNITY_SCALES.TE, multipliers: { ...DEFAULT_OPPORTUNITY_SCALES.TE.multipliers } },
    };

    let rows: Row[] = [];
    try {
      rows = await fetchNamedTabRows("Weight Scales");
    } catch {
      return out;
    }
    if (rows.length === 0) return out;

    const cell = (r: number, c: number) => rows[r]?.[c]?.trim() ?? "";
    const firstCell = (r: number) => cell(r, 0).toUpperCase();

    // "Category Weight" sits in one fixed far-right column, labelled once
    // in the very first block's header row.
    let categoryWeightCol = -1;
    for (let r = 0; r < rows.length && categoryWeightCol < 0; r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (normalizeOpportunityLabel(row[c]) === "CATEGORYWEIGHT") {
          categoryWeightCol = c;
          break;
        }
      }
    }

    const headingToPosition = (value: string): OpportunityPosition | undefined => {
      const normalized = normalizeOpportunityLabel(value);
      // The sheet pluralises these ("QBS"), which the previous parser
      // did not account for. Both spellings are accepted here.
      for (const position of OPPORTUNITY_POSITIONS) {
        if (normalized === position || normalized === `${position}S`) return position;
      }
      return undefined;
    };

    const weightAt = (r: number): number | undefined => {
      if (categoryWeightCol >= 0) {
        const value = toNumber(cell(r, categoryWeightCol));
        if (value !== undefined) return value;
      }
      return undefined;
    };

    let current: OpportunityPosition | undefined;
    const parsed: Partial<Record<OpportunityPosition, Record<string, number>>> = {};
    const oppWeights: Partial<Record<OpportunityPosition, number>> = {};

    for (let r = 0; r < rows.length; r++) {
      const heading = headingToPosition(firstCell(r));
      if (heading) {
        current = heading;
        continue;
      }
      if (!current) continue;

      if (firstCell(r) !== "OPP") continue;

      // Find this block's Index and Weights rows, which follow directly.
      let indexRow = -1;
      let weightsRow = -1;
      for (let k = r + 1; k < Math.min(r + 5, rows.length); k++) {
        const name = firstCell(k);
        if (name === "INDEX" && indexRow < 0) indexRow = k;
        else if (name === "WEIGHTS" && weightsRow < 0) weightsRow = k;
        if (indexRow >= 0 && weightsRow >= 0) break;
      }
      if (indexRow < 0 || weightsRow < 0) continue;

      const multipliers: Record<string, number> = {};
      const width = Math.max(rows[indexRow]?.length ?? 0, rows[weightsRow]?.length ?? 0);
      for (let c = 1; c < width; c++) {
        if (c === categoryWeightCol) continue;
        const rawLabel = cell(indexRow, c);
        if (!rawLabel) continue;
        const value = toNumber(cell(weightsRow, c));
        if (value === undefined) continue;
        // Store against the canonical spelling so lookups don't depend
        // on the sheet's punctuation.
        const canonical = OPPORTUNITY_OPTIONS_BY_POSITION[current].find(
          (option) => normalizeOpportunityLabel(option) === normalizeOpportunityLabel(rawLabel)
        );
        if (canonical) multipliers[canonical] = value;
      }

      const expected = OPPORTUNITY_OPTIONS_BY_POSITION[current];
      if (expected.every((option) => Number.isFinite(multipliers[option]))) {
        parsed[current] = multipliers;
        const oppWeight = weightAt(weightsRow);
        if (oppWeight !== undefined) oppWeights[current] = oppWeight;
      }
    }

    for (const position of OPPORTUNITY_POSITIONS) {
      const multipliers = parsed[position];
      if (!multipliers) continue;
      out[position] = {
        multipliers,
        opportunityWeight: oppWeights[position] ?? DEFAULT_OPPORTUNITY_SCALES[position].opportunityWeight,
      };
    }

    opportunityScalesCache = out;
    opportunityScalesCacheAt = Date.now();
    return out;
  })().finally(() => {
    opportunityScalesInFlight = null;
  });

  return opportunityScalesInFlight;
}

export async function getSheetSnapshot(): Promise<Readonly<Snapshot>> {
  const now = Date.now();
  const shared = await getSharedSnapshotMeta();

  // If another Railway instance has already promoted a newer version, pull the
  // complete snapshot before serving this request. This is what makes the data
  // version process-independent rather than merely atomic inside one process.
  if (shared && (!cache || shared.version > cache.version)) {
    const latest = await readSharedSnapshot();
    if (latest) promoteSnapshot(latest, "shared");
  }

  if (cache) {
    if (shared && cache.version === shared.version) cache.expires = shared.expires;
    if (cache.expires <= now) {
      // Stale-while-revalidate: keep the exact current snapshot mounted while
      // the next complete version is built. No request waits on the refresh.
      void startSheetRefresh();
      reportStatus("google-sheet", "stale", `Refreshing in background — serving snapshot v${cache.version}`);
    }
    return cache;
  }

  // A cold process first joins the shared snapshot, which is the normal fast
  // path after a restart/deploy and avoids every instance rebuilding the sheet.
  const sharedSnapshot = await readSharedSnapshot();
  if (sharedSnapshot) {
    promoteSnapshot(sharedSnapshot, "shared");
    if (sharedSnapshot.expires <= now) void startSheetRefresh();
    reportStatus("google-sheet", sharedSnapshot.expires > now ? "ok" : "stale", `${sharedSnapshot.data.prospects.length} prospects loaded from shared snapshot v${sharedSnapshot.version}`);
    return sharedSnapshot;
  }

  if (!HAS_SHARED_SNAPSHOT_STORE) {
    const disk = readDiskCacheIgnoringExpiry();
    if (disk) {
      const snapshot: Snapshot = {
        data: disk.data,
        expires: disk.expires,
        version: disk.version ?? ++snapshotVersion,
      };
      promoteSnapshot(snapshot, "disk");
      void startSheetRefresh();
      reportStatus("google-sheet", "stale", `Refreshing disk snapshot in background — serving ${snapshot.data.prospects.length} prospects`);
      return snapshot;
    }
  }

  // Truly empty deployment: one request may wait for the first complete
  // snapshot. Every other request shares the in-flight work or the result.
  await startSheetRefresh();
  if (!cache) throw new Error("Sheet refresh completed without a snapshot");
  return cache;
}

export async function getSheetData(): Promise<SheetData> {
  return (await getSheetSnapshot()).data;
}

export async function getProspects(): Promise<Prospect[]> {
  return (await getSheetSnapshot()).data.prospects;
}

export async function getProspectById(id: string): Promise<Prospect | undefined> {
  const prospects = (await getSheetSnapshot()).data.prospects;
  return prospects.find((p) => p.id === id);
}
