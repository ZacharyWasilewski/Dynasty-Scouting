import type { Metadata } from "next";
import type { Prospect } from "@/types/prospect";
import { formatFromParam, FORMAT_QUERY_PARAM, playerHref } from "@/lib/playerLinks";
import { playerScoreStage, scoreAtStage, SCORE_STAGE_LABELS } from "@/lib/scoreStage";
import { getTierForScore, getTierColor } from "@/lib/tiers";

export function playerShareDetails(prospect: Prospect, formatParam?: string) {
  const format = formatFromParam(formatParam ?? null);
  const stage = playerScoreStage(prospect);
  const value = scoreAtStage(prospect, stage, format);
  const score = value !== undefined && Number.isFinite(value) ? value.toFixed(1) : "TBD";
  const tier = value !== undefined && Number.isFinite(value) ? getTierForScore(value) : undefined;
  const formatLabel = `${format.startsWith("1QB") ? "1QB" : "Superflex"} · ${format.endsWith("TEP") ? "TE Premium" : "Standard"}`;
  const identity = [prospect.position, prospect.school, prospect.draftClass && `${prospect.draftClass} class`].filter(Boolean).join(" · ");
  const title = `${prospect.name} — Dynasty Database`;
  const description = `${identity}. ${SCORE_STAGE_LABELS[stage]}: ${score}${tier ? ` (${tier})` : ""}. ${formatLabel}. Explore prospect metrics, comparisons, and draft context.`;
  const url = `https://dynastydatabase.com${playerHref(prospect.id, format)}`;
  const imageUrl = `https://dynastydatabase.com/players/${encodeURIComponent(prospect.id)}/share-image?format=${FORMAT_QUERY_PARAM[format]}`;
  return { title, description, identity, score, stageLabel: SCORE_STAGE_LABELS[stage], tier, color: tier ? getTierColor(tier) : "#245FED", formatLabel, url, imageUrl };
}

export function playerMetadata(prospect: Prospect, formatParam?: string): Metadata {
  const details = playerShareDetails(prospect, formatParam);
  const images = [{ url: details.imageUrl, width: 1200, height: 630, alt: `${prospect.name} — ${details.stageLabel} ${details.score}, ${details.formatLabel}` }];
  return {
    title: details.title,
    description: details.description,
    alternates: { canonical: `https://dynastydatabase.com/players/${encodeURIComponent(prospect.id)}` },
    openGraph: { type: "website", siteName: "Dynasty Database", title: details.title, description: details.description, url: details.url, images },
    twitter: { card: "summary_large_image", title: details.title, description: details.description, images },
  };
}
