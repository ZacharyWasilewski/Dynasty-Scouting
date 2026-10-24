"use client";

import { FilterSelect } from "@/components/rankings/FilterSelect";
import { SCORE_TYPE_LABELS, SCORE_TYPE_OPTIONS, type ScoreType } from "@/lib/scoreType";

/**
 * `autoDescription` names the score "Current-stage score" resolves to for the
 * list on screen (e.g. "Pre-Draft Score" or "DD / Pre-Draft by row"), so the
 * selector never claims a different score than the table shows.
 */
export function ScoreTypeSelect({
  value,
  onChange,
  autoDescription,
}: {
  value: ScoreType;
  onChange: (next: ScoreType) => void;
  autoDescription?: string;
}) {
  return (
    <FilterSelect label="Score type" value={value} onChange={(e) => onChange(e.target.value as ScoreType)}>
      {SCORE_TYPE_OPTIONS.map((type) => (
        <option key={type} value={type}>
          {type === "auto" && autoDescription
            ? `Score: ${SCORE_TYPE_LABELS.auto} (${autoDescription})`
            : `Score: ${SCORE_TYPE_LABELS[type]}`}
        </option>
      ))}
    </FilterSelect>
  );
}
