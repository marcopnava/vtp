// /Users/marconava/Desktop/vtp/apps/web/src/lib/cot.ts
import { Canonical } from "./aliases";
import { ALIAS_TO_CANONICAL } from "./aliases";

// Parole chiave molto semplici per stance (puoi raffinare)
const LONG_PAT = /(net\s+long|more\s+longs|bullish|increase\s+in\s+longs|long\s+position)/i;
const SHORT_PAT = /(net\s+short|more\s+shorts|bearish|increase\s+in\s+shorts|short\s+position)/i;

export type CotHit = {
  symbol: Canonical;
  stance: "bullish" | "bearish" | "neutral";
  evidence: string[];
};

export function parseCot(raw: string, allowed: Canonical[]): CotHit[] {
  const text = raw.replace(/\r/g, " ").replace(/\t/g, " ");
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  // alias -> canonico, limitato all'universo allowed
  const aliasMap = new Map<string, Canonical>();
  for (const [alias, canon] of Object.entries(ALIAS_TO_CANONICAL)) {
    if (allowed.includes(canon as Canonical)) aliasMap.set(alias.toUpperCase(), canon as Canonical);
  }

  const hits: Record<Canonical, { pos: number; evidence: string[]; score: number }> = {} as any;

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const U = L.toUpperCase();

    const matchedCanonicals = new Set<Canonical>();
    for (const [alias, canon] of aliasMap.entries()) {
      if (U.includes(alias)) matchedCanonicals.add(canon);
    }
    if (matchedCanonicals.size === 0) continue;

    // stance euristica (linea +/- contesto vicino)
    let stanceScore = 0;
    if (LONG_PAT.test(L)) stanceScore += 1;
    if (SHORT_PAT.test(L)) stanceScore -= 1;

    const prev = lines[i - 1] ?? "";
    const next = lines[i + 1] ?? "";
    if (LONG_PAT.test(prev) || LONG_PAT.test(next)) stanceScore += 1;
    if (SHORT_PAT.test(prev) || SHORT_PAT.test(next)) stanceScore -= 1;

    for (const sym of matchedCanonicals) {
      const rec = (hits[sym] ??= { pos: i, evidence: [], score: 0 });
      rec.evidence.push(L);
      rec.score += stanceScore;
    }
  }

  const out: CotHit[] = Object.entries(hits).map(([sym, v]) => {
    let stance: "bullish" | "bearish" | "neutral" = "neutral";
    if (v.score > 0) stance = "bullish";
    else if (v.score < 0) stance = "bearish";
    return { symbol: sym as Canonical, stance, evidence: v.evidence.slice(0, 4) };
  });

  out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return out;
}
