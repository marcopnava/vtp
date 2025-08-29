// apps/web/src/lib/tool.ts
// Helpers condivisi: alias simboli, parsing numeri (virgola→punto),
// scaling lotti per equity, import dal Pool (localStorage), invio queue.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

/** ----------------- Modelli ----------------- */
export type Trade = {
  symbol: string;             // canonical (es. EURUSD, US100, XAUUSD...)
  side: "buy" | "sell";
  lot: number;                // lotto "base" calcolato dal Calculator (baseline equity)
  sl?: number | null;         // prezzi assoluti (0/undefined = nessuno)
  tp?: number | null;
};

export type Account = {
  id: string;                 // deve combaciare con ACCOUNT_ID dell'EA
  label: string;
  equity: number;             // equity corrente del conto
};

/** ----------------- Baseline & Accounts ----------------- */
export const BASELINE_EQUITY = 10000; // riferimento del Calculator (editabile da UI)

export const ACCOUNTS: Account[] = [
  { id: "ACC_DEMO_1", label: "Demo #1 (KTM)", equity: 10000 },
  // aggiungi qui altri conti
];

/** ----------------- Aliases simboli (frontend canonical) -----------------
 * Canonical target = universo della piattaforma.
 * NB: Il suffisso broker (.m ecc.) lo aggiunge l'EA, qui teniamo canonical puliti.
 */
const CANONICALS = [
  "EURUSD","GBPUSD","AUDUSD","NZDUSD","USDJPY","USDCHF","USDCAD","EURJPY",
  "GBPJPY","AUDJPY","NZDJPY","CADJPY","EURNZD","AUDNZD","EURCAD","EURAUD",
  "SPX","US100","DAX","US500","FTSEMIB","JP225",
  "XAUUSD","XAGUSD","USOIL","NGAS","CORN","WHEAT","COFFEE","COCOA","SUGAR","SOYBEAN","XPTUSD",
  "US10Y","BTCUSD","ETHUSD","DXY",
] as const;

const SYMBOL_ALIASES: Record<string, string[]> = {
  // Indici / CFD comuni
  SPX:   ["SPX","US500","SPX500","S&P500","SNP500","US500cash","SPX500cash"],
  US500: ["US500","SPX","SPX500","US500cash"],
  US100: ["US100","NAS100","NASDAQ100","USTECH100","US100cash","NAS100cash","NDX"],
  DAX:   ["DAX","DE30","DE40","GER30","GER40","DAX40","DEGER40","GER40cash"],
  FTSEMIB:["FTSEMIB","IT40","ITA40","MIB40","FTSEMIBcash"],
  JP225: ["JP225","JPN225","NIKKEI225","NI225","JP225cash"],

  // Commodities/metalli alias ricorrenti
  XAUUSD:["XAUUSD","GOLD","XAUUSDcash","GOLDspot"],
  XAGUSD:["XAGUSD","SILVER","XAGUSDcash","SILVERspot"],
  USOIL: ["USOIL","WTI","OIL","WTIcash","USOILcash"],
  NGAS:  ["NGAS","NATGAS","GAS","NATGAScash"],

  // Forex (di solito già canonical)
  EURUSD:["EURUSD"], GBPUSD:["GBPUSD"], AUDUSD:["AUDUSD"], NZDUSD:["NZDUSD"],
  USDJPY:["USDJPY"], USDCHF:["USDCHF"], USDCAD:["USDCAD"], EURJPY:["EURJPY"],
  GBPJPY:["GBPJPY"], AUDJPY:["AUDJPY"], NZDJPY:["NZDJPY"], CADJPY:["CADJPY"],
  EURNZD:["EURNZD"], AUDNZD:["AUDNZD"], EURCAD:["EURCAD"], EURAUD:["EURAUD"],

  // Softs
  CORN:["CORN"], WHEAT:["WHEAT"], COFFEE:["COFFEE"], COCOA:["COCOA"], SUGAR:["SUGAR"], SOYBEAN:["SOYBEAN"], XPTUSD:["XPTUSD"],

  // Bond / Crypto / Dollar index
  US10Y:["US10Y","UST10Y","TNOTE10Y"],
  BTCUSD:["BTCUSD","BTCUSDspot","BTCUSDcash","XBTUSD"],
  ETHUSD:["ETHUSD","ETHUSDspot","ETHUSDcash"],
  DXY:["DXY","USDIDX","USDX"],
};

/** Mappa rapida alias->canonical (uppercased) */
const ALIAS_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const c of CANONICALS) {
    map[c] = c;
    const al = SYMBOL_ALIASES[c] || [];
    for (const a of al) map[a.toUpperCase()] = c;
  }
  return map;
})();

/** Normalizza un simbolo testo in canonical (se riconosciuto), altrimenti uppercase grezzo */
export function normalizeSymbol(input: any): string {
  if (input == null) return "";
  let s = String(input).trim().toUpperCase();

  // rimuovi eventuali spazi e caratteri non alfanumerici basilari
  s = s.replace(/\s+/g, "");

  // se è tipo "EURUSD.m" prova a togliere suffisso comune .m /.pro /._...
  const m = s.match(/^([A-Z0-9]+)(\.[A-Z0-9_]+)?$/);
  if (m && m[1] && ALIAS_TO_CANONICAL[m[1]]) return ALIAS_TO_CANONICAL[m[1]];

  return ALIAS_TO_CANONICAL[s] || s;
}

/** ----------------- Numeri (virgola→punto) ----------------- */
export function toNumber0(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim().replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

/** ----------------- Scaling ----------------- */
export function scaleLot(baseLot: number, accountEquity: number, baseline: number) {
  if (!baseline || baseline <= 0) return baseLot;
  const scaled = baseLot * (accountEquity / baseline);
  // Lascia 2 decimali; l'EA poi normalizza al LOTSTEP del broker
  return Math.max(0, parseFloat(scaled.toFixed(2)));
}

/** ----------------- Preview / Queue builders ----------------- */
export function buildPreviewRows(
  trades: Trade[],
  accounts: Account[],
  baseline: number
) {
  const rows: {
    account_id: string;
    account_label: string;
    symbol: string;
    side: "buy" | "sell";
    base_lot: number;
    scaled_lot: number;
    sl?: number | null;
    tp?: number | null;
  }[] = [];

  for (const acc of accounts) {
    for (const t0 of trades) {
      const t = {
        symbol: normalizeSymbol(t0.symbol),
        side: t0.side,
        lot: toNumber0(t0.lot),
        sl: toNumber0(t0.sl ?? 0),
        tp: toNumber0(t0.tp ?? 0),
      };
      rows.push({
        account_id: acc.id,
        account_label: acc.label,
        symbol: t.symbol,
        side: t.side,
        base_lot: t.lot,
        scaled_lot: scaleLot(t.lot, acc.equity, baseline),
        sl: t.sl || 0,
        tp: t.tp || 0,
      });
    }
  }
  return rows;
}

export function buildQueueItems(
  trades: Trade[],
  accounts: Account[],
  baseline: number,
  planName: string
) {
  const items: any[] = [];
  for (const acc of accounts) {
    for (const t0 of trades) {
      const t = {
        symbol: normalizeSymbol(t0.symbol),
        side: t0.side,
        lot: toNumber0(t0.lot),
        sl: toNumber0(t0.sl ?? 0),
        tp: toNumber0(t0.tp ?? 0),
      };
      const lot = scaleLot(t.lot, acc.equity, baseline);
      items.push({
        account_id: acc.id,
        symbol: t.symbol,
        side: t.side,
        lot,
        sl: t.sl || 0,
        tp: t.tp || 0,
        idempotency_key: `${planName}:${acc.id}:${t.symbol}:${t.side}:${lot}`,
      });
    }
  }
  return items;
}

/** ----------------- Import dal Pool (localStorage) ----------------- */
export function loadPoolTrades(): Trade[] {
  const candidates = [
    "vtp_pool_confirmed",
    "vtp_calculator_trades",
    "vtp_selected_trades",
    "vtp_pool_selected",
  ];
  for (const key of candidates) {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) continue;
      // sanifica
      const trades: Trade[] = arr.map((x: any) => ({
        symbol: normalizeSymbol(x?.symbol),
        side: String(x?.side || "buy").toLowerCase() === "sell" ? "sell" : "buy",
        lot: toNumber0(x?.lot) || 0.01,
        sl: toNumber0(x?.sl || 0) || 0,
        tp: toNumber0(x?.tp || 0) || 0,
      }));
      if (trades.length) return trades;
    } catch {}
  }
  return [];
}

/** ----------------- API calls ----------------- */
export async function postQueue(payload: any) {
  const res = await fetch(`${API_BASE}/copy/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Queue failed: ${res.status}`);
  return res.json();
}

export async function fetchPlanStatus(planId: number) {
  const res = await fetch(`${API_BASE}/queue/status?plan_id=${planId}`);
  if (!res.ok) throw new Error(`Status failed: ${res.status}`);
  return res.json();
}

/** ----------------- Hook TopBar (tool mode) ----------------- */
import { useEffect, useState } from "react";
export function useTool() {
  const [enabled, setEnabledState] = useState<boolean>(false);
  useEffect(() => {
    try {
      const val = typeof window !== "undefined" ? window.localStorage.getItem("vtp_tool_enabled") : null;
      setEnabledState(val === "1");
    } catch {}
  }, []);
  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem("vtp_tool_enabled", v ? "1" : "0");
    } catch {}
  };
  return { enabled, setEnabled };
}
