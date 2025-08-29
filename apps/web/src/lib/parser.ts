// apps/web/src/lib/parser.ts
"use client";
import { ALIAS_TO_CANONICAL, type Canonical } from "./aliases";

export type AiTrade = {
  symbol: Canonical;
  side: "buy" | "sell";
  entry: number;
  sl: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  varPct?: number;
};

function toCanonical(raw: string): Canonical | null {
  const u = raw.toUpperCase().trim();
  const canon = (ALIAS_TO_CANONICAL as any)[u];
  return (canon as Canonical) ?? null;
}

function parseNum(s: string): number {
  // converte "1,89" -> 1.89, rimuove spazi
  return parseFloat(s.replace(/\s+/g, "").replace(",", "."));
}

function normalize(text: string): string {
  // spezza i "•" su nuove righe per semplificare il parsing
  return text.replace(/•/g, "\n");
}

export function parseAiTrades(txt: string): AiTrade[] {
  const text = normalize(txt);
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const out: AiTrade[] = [];
  let cur: Partial<AiTrade> = {};

  for (const L of lines) {
    // intestazione tipo:
    // 1] Long S&P 500 (SPX500): Confluence 85%. 5-Day Vol: 1.46%. VAR: 0.37%
    // Long EUR/USD (EURUSD): ...
    let m = L.match(/^\s*(\d+\]|\#\d+)?\s*(Long|Short)\s+.+\(([A-Za-z0-9_\/]+)\)/i)
          || L.match(/^\s*(Long|Short)\s+.+\(([A-Za-z0-9_\/]+)\)/i);
    if (m) {
      if (cur.entry && cur.sl && cur.symbol && cur.side) out.push(cur as AiTrade);
      const dir = (m[2] ?? m[1]).toLowerCase().includes("long") ? "buy" : "sell";
      const ticker = (m[3] ?? m[2]).toUpperCase();
      const canon = toCanonical(ticker);
      cur = { side: dir as "buy"|"sell" };
      if (canon) (cur as any).symbol = canon;
      // prova a pescare VAR inline
      const vMatch = L.match(/VAR:\s*([0-9\.,]+)\s*%/i);
      if (vMatch) (cur as any).varPct = parseNum(vMatch[1]);
      continue;
    }

    // Entry/SL/TP
    let mm;
    if ((mm = L.match(/Entry:\s*([0-9\.,]+)/i))) {
      (cur as any).entry = parseNum(mm[1]);
      continue;
    }
    if ((mm = L.match(/SL:\s*([0-9\.,]+)/i))) {
      (cur as any).sl = parseNum(mm[1]);
      continue;
    }
    if ((mm = L.match(/TP1:\s*([0-9\.,]+)/i))) {
      (cur as any).tp1 = parseNum(mm[1]);
      continue;
    }
    if ((mm = L.match(/TP2:\s*([0-9\.,]+)/i))) {
      (cur as any).tp2 = parseNum(mm[1]);
      continue;
    }
    if ((mm = L.match(/TP3:\s*([0-9\.,]+)/i))) {
      (cur as any).tp3 = parseNum(mm[1]);
      continue;
    }
    if ((mm = L.match(/VAR:\s*([0-9\.,]+)\s*%/i))) {
      (cur as any).varPct = parseNum(mm[1]);
      continue;
    }
  }
  if (cur.entry && cur.sl && cur.symbol && cur.side) out.push(cur as AiTrade);
  return out;
}
