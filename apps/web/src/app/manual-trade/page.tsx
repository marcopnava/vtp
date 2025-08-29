// apps/web/src/app/manual-trade/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { API_BASE, ACCOUNTS, BASELINE_EQUITY, buildQueueItems, type Trade } from "@/lib/tool";

const UNIVERSE = [
  "EURUSD","GBPUSD","AUDUSD","NZDUSD","USDJPY","USDCHF","USDCAD","EURJPY",
  "GBPJPY","AUDJPY","NZDJPY","CADJPY","EURNZD","AUDNZD","EURCAD","EURAUD",
  "SPX","US100","DAX","US500","FTSEMIB","JP225",
  "XAUUSD","XAGUSD","USOIL","NGAS","CORN","WHEAT","COFFEE","COCOA","SUGAR","SOYBEAN","XPTUSD",
  "US10Y","BTCUSD","ETHUSD","DXY",
];

export default function ManualTradePage() {
  const [planName, setPlanName] = useState("manual-" + new Date().toISOString().slice(0,19));
  const [baseLot, setBaseLot] = useState<number>(0.01);
  const [sl, setSl] = useState<string>("0");  // prezzi assoluti (0 = nessuno)
  const [tp, setTp] = useState<string>("0");
  const [symbol, setSymbol] = useState<string>("EURUSD");
  const [side, setSide] = useState<"buy"|"sell">("buy");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const allChecked = useMemo(() => selectedAccounts.length === ACCOUNTS.length, [selectedAccounts]);
  const toggleAll = () => setSelectedAccounts(allChecked ? [] : ACCOUNTS.map(a => a.id));
  const toggleOne = (id: string, checked: boolean | string) =>
    setSelectedAccounts(xs => (checked === true ? [...new Set([...xs, id])] : xs.filter(x => x !== id)));

  async function postQueue(payload: any) {
    const res = await fetch(`${API_BASE}/copy/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Queue failed: ${res.status}`);
    return res.json();
  }

  const toNumberOrNull = (s: string) => {
    const n = Number(s.replace(",", "."));
    return isFinite(n) && n > 0 ? n : 0;
  };

  async function queueSingle() {
    setError(null); setResult(null);
    if (!confirm) { setError("Spunta la conferma prima di inviare."); return; }
    if (!selectedAccounts.length) { setError("Seleziona almeno un account."); return; }
    try {
      setBusy(true);
      const t: Trade = { symbol, side, lot: baseLot, sl: toNumberOrNull(sl), tp: toNumberOrNull(tp) };
      const items = buildQueueItems([t], ACCOUNTS.filter(a => selectedAccounts.includes(a.id)), BASELINE_EQUITY, planName);
      const out = await postQueue({ plan_name: planName, created_by: "manual", items });
      setResult(out);
    } catch (e:any) {
      setError(e?.message || "Errore invio");
    } finally { setBusy(false); }
  }

  async function queueUniverse() {
    setError(null); setResult(null);
    if (!confirm) { setError("Spunta la conferma prima di inviare."); return; }
    if (!selectedAccounts.length) { setError("Seleziona almeno un account."); return; }
    try {
      setBusy(true);
      const trades: Trade[] = UNIVERSE.map(sym => ({
        symbol: sym, side: "buy", lot: baseLot, sl: toNumberOrNull(sl), tp: toNumberOrNull(tp)
      }));
      const items = buildQueueItems(trades, ACCOUNTS.filter(a => selectedAccounts.includes(a.id)), BASELINE_EQUITY, planName);
      const out = await postQueue({ plan_name: planName, created_by: "manual", items });
      setResult(out);
    } catch (e:any) {
      setError(e?.message || "Errore invio");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Trade (Open)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <label className="font-medium">Plan name</label>
            <input className="border rounded px-3 py-2 w-96" value={planName}
              onChange={(e)=>setPlanName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <span className="w-32">Symbol</span>
              <select className="border rounded px-3 py-2 flex-1" value={symbol} onChange={(e)=>setSymbol(e.target.value)}>
                {UNIVERSE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <label className="flex items-center gap-3">
              <span className="w-32">Side</span>
              <select className="border rounded px-3 py-2 flex-1" value={side} onChange={(e)=>setSide(e.target.value as any)}>
                <option value="buy">buy</option>
                <option value="sell">sell</option>
              </select>
            </label>

            <label className="flex items-center gap-3">
              <span className="w-32">Base lot</span>
              <input className="border rounded px-3 py-2 flex-1" value={baseLot}
                onChange={(e)=>setBaseLot(Number(e.target.value))} type="number" min={0.01} step={0.01}/>
            </label>

            <label className="flex items-center gap-3">
              <span className="w-32">SL (price)</span>
              <input className="border rounded px-3 py-2 flex-1" value={sl}
                onChange={(e)=>setSl(e.target.value)} placeholder="0 = none"/>
            </label>

            <label className="flex items-center gap-3">
              <span className="w-32">TP (price)</span>
              <input className="border rounded px-3 py-2 flex-1" value={tp}
                onChange={(e)=>setTp(e.target.value)} placeholder="0 = none"/>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
            <span className="text-sm text-muted-foreground">Select all accounts</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ACCOUNTS.map(acc => {
              const checked = selectedAccounts.includes(acc.id);
              return (
                <label key={acc.id} className={`border rounded-xl p-3 flex items-center gap-2 ${checked ? "bg-muted" : ""}`}>
                  <Checkbox checked={checked} onCheckedChange={(ch)=>toggleOne(acc.id, ch)} />
                  <div>
                    <div className="font-medium">{acc.label}</div>
                    <div className="text-xs text-muted-foreground">{acc.id} • equity ~ {acc.equity}</div>
                  </div>
                </label>
              );
            })}
          </div>

          <label className="flex items-center gap-3">
            <Checkbox checked={confirm} onCheckedChange={(v)=>setConfirm(v===true)} />
            <span className="text-sm">Confermo lottaggi / SL / TP per gli ordini selezionati</span>
          </label>

          <div className="flex flex-wrap gap-3">
            <Button disabled={!confirm || !selectedAccounts.length || busy} onClick={queueSingle}>
              {busy ? "Sending…" : "Queue Single"}
            </Button>
            <Button variant="secondary" disabled={!confirm || !selectedAccounts.length || busy} onClick={queueUniverse}>
              {busy ? "Sending…" : "Queue All Universe (BUY)"}
            </Button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {result && (
            <div className="text-sm">
              queued: <b>{result.queued ?? 0}</b> • reserved: <b>{result.reserved ?? 0}</b> •
              {" "}filled: <b>{result.filled ?? 0}</b> • rejected: <b>{result.rejected ?? 0}</b>
              <div className="text-xs text-muted-foreground mt-1">Apri il Terminale MT4 → Trade per vedere le posizioni, e “Esperti/Diario” per i log.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Nota sulla chiusura</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Oggi la chiusura è manuale in MT4: <i>Visualizza → Terminale → Trade → tasto destro sull’ordine → Chiudi ordine</i>.
          Se vuoi, nel prossimo step aggiungo il comando di <b>close via API</b> (server+EA) per chiudere dal web.
        </CardContent>
      </Card>
    </div>
  );
}
