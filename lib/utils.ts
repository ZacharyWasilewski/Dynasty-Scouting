import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names safely, resolving conflicting utility
 * classes in favor of the last one supplied.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "1st", "2nd", "3rd", "4th" ... with the 11/12/13 exception (always
 * "th" — "11th", not "11st"; "12th", not "12nd"; "13th", not "13rd").
 */
export function ordinalSuffix(n: number): string {
  const rounded = Math.round(n);
  const mod100 = rounded % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`;
  switch (rounded % 10) {
    case 1:
      return `${rounded}st`;
    case 2:
      return `${rounded}nd`;
    case 3:
      return `${rounded}rd`;
    default:
      return `${rounded}th`;
  }
}

/** "3 days ago" style relative time — used for "since your last
 *  visit" style copy. Deliberately coarse (no seconds/minutes
 *  granularity below an hour) since the use case is always "when did
 *  you last check this page," not a live-updating timestamp. */
export function relativeTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 3600) return "less than an hour ago";
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/**
 * Maps a letter grade (A/B/C/D/F, with optional +/-) to a Tailwind
 * text-color class — used for mock draft pick grades across several
 * pages. Previously duplicated as 4 separate copies (one per file
 * that needed it) using raw hardcoded hex values tuned for the old
 * dark theme specifically — A used a bright, pale green that reads
 * fine glowing on near-black but has poor contrast as text on a
 * light background, and B used the theme's soft/glow blue (meant for
 * dark-background highlights, not for body text on white). Fixed to
 * reference the real theme tokens for A/D/F (so grade colors track
 * the same riser/faller decision the rest of the site made) and to
 * a readable, saturated blue for B specifically, rather than fixing
 * each of the 4 duplicated copies slightly differently by hand.
 */
export function gradeTextColorClass(grade: string | null | undefined): string {
  if (!grade) return "text-ink-tertiary";
  if (grade.startsWith("A")) return "text-riser";
  if (grade.startsWith("B")) return "text-accent";
  // Was the raw #FACC15 — the same "poor contrast as text on a light
  // background" problem this function's own comment describes fixing
  // for A/B/D/F, left as the one unfixed original with nothing
  // explaining why.
  //
  // #8A6608, not the #B7860B this was first changed to: that value
  // computes to only 3.05:1 against the light theme's background,
  // clearing WCAG's 3:1 large-text floor but not the 4.5:1 required
  // for normal-size text, which this renders as. Recomputed properly
  // rather than trusting a value because it was already used
  // elsewhere in the codebase for the same problem.
  if (grade.startsWith("C")) return "text-[#8A6608]";
  return "text-faller";
}
