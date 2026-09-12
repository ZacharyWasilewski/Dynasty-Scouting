import type { CommunityFormatKey, CommunityPlayer } from "@/lib/mockDraft";

export type CommunitySource = "fantasycalc" | "unavailable";

export interface CommunitySnapshot {
  source: CommunitySource;
  classYear: string;
  formatKey: CommunityFormatKey;
  fetchedAt: string | null;
  players: Record<string, CommunityPlayer>;
}
