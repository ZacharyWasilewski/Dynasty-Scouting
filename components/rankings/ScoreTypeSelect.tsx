"use client";

import { FilterSelect } from "@/components/rankings/FilterSelect";
import { SCORE_TYPE_LABELS, SCORE_TYPE_OPTIONS, type ScoreType } from "@/lib/scoreType";

/**
 * The default option is named for the score it actually shows (e.g.
 * "Pre-Draft Score" or "DD Score"), or "Score by stage" for mixed lists, and
 * the same stage is not listed a second time.
 */
export function ScoreTypeSelect({
  value,
  onChange,
  autoStage,
}: {
  value: ScoreType;
  onChange: (next: ScoreType) => void;
  /** The single stage "auto" resolves to for this list, or null when mixed/empty. */
  autoStage: ScoreType | null;
}) {
  const autoLabel = autoStage ? SCORE_TYPE_LABELS[autoStage] : "Score by stage";
  const shown = value === autoStage ? "auto" : value;
  return (
    <FilterSelect label="Score type" value={shown} onChange={(e) => onChange(e.target.value as ScoreType)}>
      {SCORE_TYPE_OPTIONS.filter((type) => type === "auto" || type !== autoStage).map((type) => (
        <option key={type} value={type}>
          {type === "auto" ? autoLabel : SCORE_TYPE_LABELS[type]}
        </option>
      ))}
    </FilterSelect>
  );
}
