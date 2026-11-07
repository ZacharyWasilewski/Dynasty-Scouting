import { matchKey } from "./collegePhotos";
import type { PlayerBio } from "./playerPhotos";

/**
 * Height/weight for NFL players from the open nflverse players table. It
 * carries combine measurements for retired players that Sleeper and ESPN
 * have dropped (e.g. Jahvid Best). Used only to fill gaps.
 */
const URL = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";
const TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

type Entry = { bio: PlayerBio; draftYear?: number };
let index = new Map<string, Entry[]>();
let loadedAt = 0;
let nextTry = 0;
let inFlight: Promise<void> | null = null;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseNflverseBios(csv: string): Map<string, Entry[]> {
  const lines = csv.split(/\r?\n/);
  const head = splitCsvLine(lines[0] ?? "");
  const col = (n: string) => head.indexOf(n);
  const iName = col("display_name"), iPos = col("position"), iH = col("height"), iW = col("weight"), iY = col("draft_year");
  const out = new Map<string, Entry[]>();
  if ([iName, iPos, iH, iW].some((i) => i < 0)) return out;
  for (let l = 1; l < lines.length; l++) {
    const row = splitCsvLine(lines[l]!);
    const h = Number(row[iH]);
    const w = Number(row[iW]);
    const bio: PlayerBio = {
      heightIn: h >= 60 && h <= 90 ? Math.round(h) : undefined,
      weightLbs: w >= 140 && w <= 400 ? Math.round(w) : undefined,
    };
    if (bio.heightIn === undefined && bio.weightLbs === undefined) continue;
    const name = row[iName];
    if (!name) continue;
    const key = `${matchKey(name)}|${row[iPos]}`;
    const y = Number(row[iY]);
    const list = out.get(key) ?? [];
    list.push({ bio, draftYear: y > 1900 ? y : undefined });
    out.set(key, list);
  }
  return out;
}

async function load(): Promise<void> {
  try {
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const next = parseNflverseBios(await res.text());
    if (next.size > 0) {
      index = next;
      loadedAt = Date.now();
    }
  } catch (err) {
    console.error("[nflverse-bios] fetch failed:", err);
    nextTry = Date.now() + RETRY_MS;
  }
}

/** Returns the index loaded so far and refreshes it in the background; never waits. */
export function getNflverseBiosIfReady(): Map<string, Entry[]> {
  const now = Date.now();
  if (!inFlight && now > nextTry && now - loadedAt > TTL_MS) {
    inFlight = load().finally(() => {
      inFlight = null;
    });
  }
  return index;
}

export function lookupNflverseBio(idx: Map<string, Entry[]>, name: string, position: string, draftYear?: number): PlayerBio | undefined {
  const list = idx.get(`${matchKey(name)}|${position}`);
  if (!list || list.length === 0) return undefined;
  if (list.length === 1) return list[0]!.bio;
  // Same-name players: only trust a match on draft year.
  if (draftYear === undefined) return undefined;
  const hits = list.filter((e) => e.draftYear === draftYear);
  return hits.length === 1 ? hits[0]!.bio : undefined;
}
