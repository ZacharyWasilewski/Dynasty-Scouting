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
    accent: "#5B8DEF",
    description:
      "Draft capital is king. We'll leave the intangibles to the pro scouts.",
  },
  rb: {
    slug: "rb",
    code: "RB",
    label: "Running Backs",
    singular: "Running Back",
    accent: "#4ADE80",
    description:
      "Size and speed are the biggest tells towards NFL success. Don't worry, receiving skill set is included for your PPR leagues.",
  },
  wr: {
    slug: "wr",
    code: "WR",
    label: "Wide Receivers",
    singular: "Wide Receiver",
    accent: "#A78BFA",
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
