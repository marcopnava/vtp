// /Users/marconava/Desktop/vtp/apps/web/src/lib/cot_merge.ts
import type { Canonical } from "./aliases";
import type { CotHit } from "./cot";

/**
 * Classificazione semplice per regole di precedenza:
 * - forex, index, bond -> prefer "financial"
 * - commodity, metal   -> prefer "disaggregated"
 * - crypto             -> nessuna fonte "ufficiale" CFTC (fallback financial)
 */
type Category = "forex" | "index" | "commodity" | "bond" | "crypto" | "metal";

function categoryOf(sym: Canonical): Category {
  switch (sym) {
    // Forex
    case "EURUSD": case "GBPUSD": case "AUDUSD": case "NZDUSD":
    case "USDJPY": case "USDCHF": case "USDCAD":
    case "EURJPY": case "GBPJPY": case "AUDJPY": case "NZDJPY": case "CADJPY":
    case "EURNZD": case "AUDNZD": case "EURCAD": case "EURAUD":
      return "forex";
    // Indici
    case "SPX": case "US100": case "DAX": case "US500": case "FTSEMIB": case "JP225":
      return "index";
    // Commodities
    case "USOIL": case "NGAS": case "CORN": case "WHEAT": case "COFFEE":
    case "COCOA": case "SUGAR": case "SOYBEAN":
      return "commodity";
    // Metalli
    case "XAUUSD": case "XAGUSD": case "XPTUSD":
      return "metal";
    // Bond
    case "US10Y":
      return "bond";
    // Crypto
    case "BTCUSD": case "ETHUSD":
      return "crypto";
  }
}

function preferredSourceFor(sym: Canonical): "financial" | "disaggregated" {
  const cat = categoryOf(sym);
  if (cat === "commodity" || cat === "metal") return "disaggregated";
  // forex/index/bond/crypto -> financial come default
  return "financial";
}

export type MergedCotItem = {
  symbol: Canonical;
  stance: "bullish" | "bearish" | "neutral";   // stance selezionata (per compat con Output AI)
  sources: Array<"disaggregated" | "financial">;
  conflict: boolean;
  preferred: "disaggregated" | "financial" | null;
  evidence: string[];      // unione (dedup, max 6 righe)
  notes?: string[];        // info utili (es. "divergence: disagg bullish vs fin bearish")
};

export function mergeCot(
  disagg: CotHit[],
  fin: CotHit[],
): MergedCotItem[] {
  const dMap = new Map<Canonical, CotHit>();
  const fMap = new Map<Canonical, CotHit>();
  for (const d of disagg) dMap.set(d.symbol, d);
  for (const f of fin) fMap.set(f.symbol, f);

  const allSymbols = new Set<Canonical>([
    ...Array.from(dMap.keys()),
    ...Array.from(fMap.keys()),
  ]);

  const out: MergedCotItem[] = [];
  for (const sym of Array.from(allSymbols).sort((a, b) => a.localeCompare(b))) {
    const d = dMap.get(sym);
    const f = fMap.get(sym);

    // sola una fonte
    if (d && !f) {
      out.push({
        symbol: sym,
        stance: d.stance,
        sources: ["disaggregated"],
        conflict: false,
        preferred: "disaggregated",
        evidence: uniq([...d.evidence]).slice(0, 6),
      });
      continue;
    }
    if (f && !d) {
      out.push({
        symbol: sym,
        stance: f.stance,
        sources: ["financial"],
        conflict: false,
        preferred: "financial",
        evidence: uniq([...f.evidence]).slice(0, 6),
      });
      continue;
    }

    // entrambe le fonti presenti
    const dSt = d!.stance, fSt = f!.stance;
    const evidence = uniq([...(d!.evidence || []), ...(f!.evidence || [])]).slice(0, 6);
    const sources: Array<"disaggregated" | "financial"> = ["disaggregated", "financial"];

    // stessa stance oppure una è neutral: scegli quella più "significativa"
    if (dSt === fSt || (dSt === "neutral" && fSt !== "neutral") || (fSt === "neutral" && dSt !== "neutral")) {
      const chosen = dSt === fSt ? dSt : (dSt === "neutral" ? fSt : dSt);
      out.push({
        symbol: sym,
        stance: chosen,
        sources,
        conflict: false,
        preferred: chosen === dSt && chosen !== fSt ? "disaggregated" : chosen === fSt && chosen !== dSt ? "financial" : preferredSourceFor(sym),
        evidence,
      });
      continue;
    }

    // Divergenza vera (bullish vs bearish)
    const pref = preferredSourceFor(sym);
    const chosen = (pref === "financial" ? fSt : dSt) as "bullish" | "bearish";
    out.push({
      symbol: sym,
      stance: chosen,
      sources,
      conflict: true,
      preferred: pref,
      evidence,
      notes: [`divergence: disagg=${dSt} vs fin=${fSt} → chosen=${pref}`],
    });
  }

  return out;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
