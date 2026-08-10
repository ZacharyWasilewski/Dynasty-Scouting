import Papa from "papaparse";
import { SCHOOL_LOOKUP, normalizeName } from "./schoolLookup";
import { getTierForScore } from "./tiers";
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

type Row = string[];

async function fetchSheetRows(): Promise<Row[]> {
  const res = await fetch(SHEET_CSV_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

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
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
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

  const metricCols = POSITION_METRICS[position].map((m) => ({ col: m.col, idx: findCol(m.col) }));
  const colAdp = findCol("ADP");
  const colOpp = findCol("OPP");
  const colMock = findCol("MOCK");

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

    const mockRaw = colMock >= 0 ? r[colMock]?.trim() : undefined;
    // Same idea for Mock — blank, "UDFA", or anything else that
    // isn't a real pick number is undrafted-free-agent territory,
    // the worst possible mock slot, not a missing data point.
    const mock = colMock >= 0 ? toNumber(mockRaw) ?? UDFA_MOCK_SENTINEL : undefined;

    map.set(normalizeName(name), {
      school: school || undefined,
      metrics,
      metricIsElite,
      adp: colAdp >= 0 ? toNumber(r[colAdp]) : undefined,
      opp: colOpp >= 0 ? (r[colOpp]?.trim() || undefined) : undefined,
      mock,
    });
  }

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
    let raw = rawData.get(normalizeName(p.name));

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
    } else if (raw.mock !== undefined) {
      scores.push({ label: "Mock", value: percentileOf(raw.mock, allMockValues, true) });
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

  const LABEL_COL_1 = 2; // C
  const WEIGHT_COL_1 = 13; // N
  const LABEL_COL_2 = 15; // P
  const WEIGHT_COL_2 = 25; // Z
  const ROW_OFFSET = 3;

  function findWeight(rawColName: string): number | undefined {
    const target = norm(rawColName);
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
    const name = r[cName]?.trim();
    if (!name) continue;

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

  const ranked = [...prospects].sort(
    (a, b) => (b.grade?.overall ?? -1) - (a.grade?.overall ?? -1)
  );
  ranked.forEach((p, i) => {
    p.rank = i + 1;
  });

  return prospects;
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

  const prospects: Prospect[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const name = r[cName]?.trim();
    if (!name) continue;

    const position = r[cPosition]?.trim() as Position;
    if (!VALID_POSITIONS.includes(position)) continue;

    const rawScore = toNumber(r[cRaw]);
    const preDraftScore = toNumber(r[cPreDraft]);
    const prospectScore = toNumber(r[cProspect]);

    prospects.push({
      id: slugify(name, classYear),
      name,
      school: SCHOOL_LOOKUP[normalizeName(name)],
      position,
      draftClass: classYear,
      rawScore,
      preDraftScore,
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

let cache: { data: SheetData; expires: number } | null = null;

/**
 * Fetches and parses the live sheet. Cached in-memory for the
 * duration of `REVALIDATE_SECONDS` per server instance, on top of
 * Next.js's own fetch cache — cheap to call from multiple places in
 * the same request.
 */
export async function getSheetData(): Promise<SheetData> {
  if (cache && cache.expires > Date.now()) return cache.data;

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
    const live = livePositionData.get(normalizeName(p.name));
    if (live?.school) p.school = live.school;
  }
  applySubScores(prospects, livePositionData);

  const ranked = [...prospects].sort(
    (a, b) => (b.grade?.overall ?? -1) - (a.grade?.overall ?? -1)
  );
  ranked.forEach((p, i) => {
    p.rank = i + 1;
  });

  const data: SheetData = {
    prospects,
    tierSummary: parseTierSummary(rows),
    classTrend: parseClassTrend(rows),
    subScoreWeights,
  };

  cache = { data, expires: Date.now() + REVALIDATE_SECONDS * 1000 };
  return data;
}

export async function getProspects(): Promise<Prospect[]> {
  return (await getSheetData()).prospects;
}

export async function getProspectById(id: string): Promise<Prospect | undefined> {
  const prospects = await getProspects();
  return prospects.find((p) => p.id === id);
}
