// apps/web/src/lib/tool.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

/** ---- Modello Trades (come salvati dal Calculator) ---- */
export type Trade = {
  symbol: string;
  side: "buy" | "sell";
  lot: number;           // lotto "base" calcolato dal Calculator (baseline equity)
  sl?: number | null;    // prezzi assoluti (0/undefined = nessuno)
  tp?: number | null;
};

/** ---- Conti & Scaling ----
 * BASELINE_EQUITY: l'equity di riferimento per cui il Calculator ha calcolato 'lot'.
 * Esempio: se il Calculator lavora a 10k, allora:
 *  - account 10k -> lot = x
 *  - account 20k -> lot = 2x
 */
export const BASELINE_EQUITY = 10000; // puoi modificarlo da UI nel prossimo step

export type Account = {
  id: string;            // deve combaciare con ACCOUNT_ID dell'EA
  label: string;
  equity: number;        // equity corrente del conto
};

export const ACCOUNTS: Account[] = [
  { id: "ACC_DEMO_1", label: "Demo #1 (KTM)", equity: 10000 },
  // aggiungi altri conti con la loro equity attuale
];

/** Scala il lotto in base al rapporto equity/baseline */
export function scaleLot(baseLot: number, accountEquity: number, baseline: number) {
  if (!baseline || baseline <= 0) return baseLot;
  const scaled = baseLot * (accountEquity / baseline);
  // arrotonda a 2 decimali (l'EA poi normalizza al LOTSTEP broker)
  return Math.max(0, parseFloat(scaled.toFixed(2)));
}

/** Costruisce le righe d'anteprima (per conferma prima dell'enqueue) */
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
    for (const t of trades) {
      rows.push({
        account_id: acc.id,
        account_label: acc.label,
        symbol: t.symbol,
        side: t.side,
        base_lot: t.lot,
        scaled_lot: scaleLot(t.lot, acc.equity, baseline),
        sl: t.sl ?? null,
        tp: t.tp ?? null,
      });
    }
  }
  return rows;
}

/** Converte l'anteprima in payload per /copy/queue */
export function buildQueueItems(
  trades: Trade[],
  accounts: Account[],
  baseline: number,
  planName: string
) {
  const items: any[] = [];
  for (const acc of accounts) {
    for (const t of trades) {
      const lot = scaleLot(t.lot, acc.equity, baseline);
      items.push({
        account_id: acc.id,
        symbol: t.symbol,
        side: t.side,
        lot,
        sl: t.sl ?? null,
        tp: t.tp ?? null,
        idempotency_key: `${planName}:${acc.id}:${t.symbol}:${t.side}:${lot}`,
      });
    }
  }
  return items;
}

/** ---- API calls ---- */
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
import { useEffect, useState } from "react";

export function useTool() {
  const [enabled, setEnabledState] = useState<boolean>(false);

  useEffect(() => {
    try {
      const val = window.localStorage.getItem("vtp_tool_enabled");
      setEnabledState(val === "1");
    } catch {}
  }, []);

  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    try {
      window.localStorage.setItem("vtp_tool_enabled", v ? "1" : "0");
    } catch {}
  };

  return { enabled, setEnabled };
}