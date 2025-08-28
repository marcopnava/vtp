// apps/web/src/lib/cot_score.ts
import type { Canonical } from "./aliases";
import type { MergedCotItem } from "./cot_merge";

/**
 * Heuristics:
 * - trust sorgente: entrambe & no-conflict = 1.0; entrambe & conflict = 0.7; singola = 0.8
 * - evidenze: len(evidence) in [0..4+] -> factor [0..1]
 * - neutral => 50%
 * - bullish/bearish => 50 + 50*(0.4*trust + 0.6*evidenceFactor)
 */
export function confluenceForMerged(item: MergedCotItem): number {
  if (item.stance === "neutral") return 50;

  let trust = 0.8;
  if (item.sources.length === 2) trust = item.conflict ? 0.7 : 1.0;

  const evidenceFactor = Math.min(1, (item.evidence?.length ?? 0) / 4); // 0..1
  const score = 0.4 * trust + 0.6 * evidenceFactor;                      // 0..1
  const pct = Math.round(50 + 50 * score);                                // 50..100
  return Math.max(50, Math.min(100, pct));
}

export type ScoredMerged = MergedCotItem & { confluence: number };

export function annotateConfluence(items: MergedCotItem[]): ScoredMerged[] {
  return items.map(it => ({ ...it, confluence: confluenceForMerged(it) }));
}
