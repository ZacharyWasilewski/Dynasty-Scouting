"use client";

import { FilterSelect } from "@/components/rankings/FilterSelect";
import { SCORE_TYPE_LABELS, SCORE_TYPE_OPTIONS, type ScoreType } from "@/lib/scoreType";

export function ScoreTypeSelect({ value, onChange }: { value: ScoreType; onChange: (next: ScoreType) => void }) {
  return (
    <FilterSelect label="Score type" value={value} onChange={(e) => onChange(e.target.value as ScoreType)}>
      {SCORE_TYPE_OPTIONS.map((type) => (
        <option key={type} value={type}>
          {type === "dd" ? "Score: DD Score" : `Score: ${SCORE_TYPE_LABELS[type]}`}
        </option>
      ))}
    </FilterSelect>
  );
}
