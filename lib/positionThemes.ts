import type { Position } from "@/types/prospect";

export type PositionSlug = "qb" | "rb" | "wr" | "te";

export interface PositionTheme {
  slug: PositionSlug;
  code: Position;
  label: string;
  singular: string;
  accent: string; // hex
  description: string;
}

export const POSITION_THEMES: Record<PositionSlug, PositionTheme> = {
  qb: {
    slug: "qb",
    code: "QB",
    label: "Quarterbacks",
    singular: "Quarterback",
    // Deepened from the original #5B8DEF — used as real text color
    // across the position pages (PositionStats, PositionExplorer,
    // PositionHeader), and the original was tuned to read well
    // against near-black specifically, with less margin for
    // contrast against the new light background.
    accent: "#3D6FCC",
    description:
      "Draft capital is king. We'll leave the intangibles to the pro scouts.",
  },
  rb: {
    slug: "rb",
    code: "RB",
    label: "Running Backs",
    singular: "Running Back",
    // Same adjustment as the Flex tier / Team Sync's B grade — the
    // original #4ADE80 is the same class of pale, dark-tuned green
    // with real contrast problems as text on a light background.
    accent: "#3F8F5F",
    description:
      "Size and speed are the biggest tells towards NFL success. Don't worry, receiving skill set is included for your PPR leagues.",
  },
  wr: {
    slug: "wr",
    code: "WR",
    label: "Wide Receivers",
    singular: "Wide Receiver",
    // Deepened from the original #A78BFA (a pale lavender) for the
    // same reason as QB and RB above.
    accent: "#7C5CE0",
    description:
      "Production, production, production. Not much else matters, see Matt Harmon for some fun separation analytics.",
  },
  te: {
    slug: "te",
    code: "TE",
    label: "Tight Ends",
    singular: "Tight End",
    accent: "#FB923C",
    description:
      "The best tight ends are freaks of nature. RAS plays a huge part in these grades on top of draft capital.",
  },
};

export function getPositionTheme(slug: string): PositionTheme | undefined {
  return POSITION_THEMES[slug as PositionSlug];
}
