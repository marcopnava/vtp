// apps/web/src/app/live-session/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ACCOUNTS,
  BASELINE_EQUITY as DEFAULT_BASELINE,
  buildPreviewRows,
  buildQueueItems,
  postQueue,
  normalizeSymbol,      // alias→canonical
  type Trade,
} from "@/lib/tool";

/** ---------- Helpers ---------- **/

function toNumber0(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim().replace(",", "."); // virgola -> punto
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
function sanitizeTrade(t: any): Trade {
  return {
    symbol: String(t.symbol || "").toUpperCase(),
    side: (String(t.side || "buy").toLowerCase() === "sell" ? "sell" : "buy") as "buy" | "sell",
    lot: toNumber0(t.lot) || 0.01,
    sl: toNumber0(t.sl || 0) || 0,
    tp: toNumber0(t.tp || 0) || 0,
  };
}

/** Prova a importare da localStorage usando più chiavi "probabili" */
function loadFromLocalStorage(): Trade[] {
  const candidates = [
    "vtp_pool_confirmed",
    "vtp_calculator_trades",
    "vtp_selected_trades",
    "vtp_pool_selected",
  ];
  for (const key of candidates) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.map(sanitizeTrade);
      }
    } catch {}
  }
  return [];
}

/** Parser testo grezzo (line-by-line):
 * Accetta formati come:
 *   EURUSD buy 0,10 SL 1,0800 TP 1,0900
 *   US100, sell, 0.25, sl=17890, tp=17500
 *   XAUUSD buy 0.05
 * Side: buy/sell/long/short (long=buy, short=sell)
 * Numeri: virgola o punto.
 */
function parseRawLines(raw: string): Trade[] {
  const out: Trade[] = [];
  if (!raw) return out;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const L = line
      .replace(/\t/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // prova JSON-like
    if (/^\{.+\}$/.test(L)) {
      try {
        const obj = JSON.parse(L.replace(/,(\s*[}\]])/g, "$1"));
        out.push(sanitizeTrade(obj));
        continue;
      } catch {}
    }

    // estrazione generica con regex tolleranti
    // numeri: con virgola o punto
    const lc = L.toLowerCase();

    // symbol = prima parola alfanumerica
    const symMatch = L.match(/^[A-Z0-9._-]+/i);
    let symbol = symMatch ? symMatch[0] : "";

    // side
    let side: "buy" | "sell" = /(^|\s)(sell|short)(\s|$)/i.test(lc) ? "sell" : "buy";

    // lot: cerca "lot" o primo float plausibile dopo symbol/side
    let lot = 0;
    // preferisci pattern con "lot" o "lotti"
    const lotMatch =
      lc.match(/(?:lot|lotti|qty|size)\s*[:=]?\s*([0-9]+[.,]?[0-9]*)/) ||
      lc.match(/\b([0-9]+[.,][0-9]+)\b/); // fallback: primo decimale
    if (lotMatch) lot = toNumber0(lotMatch[1]);

    // SL/TP
    const slMatch = lc.match(/(?:\bsl\b|stop(?:loss)?|stop)\s*[:=]?\s*([0-9]+[.,]?[0-9]*)/);
    const tpMatch = lc.match(/(?:\btp\b|take(?:profit)?)\s*[:=]?\s*([0-9]+[.,]?[0-9]*)/);
    const sl = slMatch ? toNumber0(slMatch[1]) : 0;
    const tp = tpMatch ? toNumber0(tpMatch[1]) : 0;

    // se lot ancora zero, cerca un float dopo side
    if (!lot) {
      const m2 = L.match(/(?:buy|sell|long|short)\s+([0-9]+[.,]?[0-9]*)/i);
      if (m2) lot = toNumber0(m2[1]);
    }
    if (!lot) lot = 0.01;

    // normalizza symbol via alias
    symbol = normalizeSymbol(symbol);

    out.push({ symbol, side, lot, sl, tp });
  }
  return out;
}

/** ---------- Page ---------- **/

export default function LiveSessionPage() {
  const [planName, setPlanName] = useState("live-" + new Date().toISOString().slice(0, 19));
  const [baseline, setBaseline] = useState<number>(DEFAULT_BASELINE);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Broker suffix helper (promemoria UI)
  const [suffixHint, setSuffixHint] = useState<string>("");
  const [aliasTestIn, setAliasTestIn] = useState<string>("US500");
  const [aliasTestOut, setAliasTestOut] = useState<string>("");

  // Paste area state
  const [rawPaste, setRawPaste] = useState<string>("");

  // Import iniziale
  useEffect(() => {
    try {
      const pre = loadFromLocalStorage();
      if (pre.length) setTrades(pre);
    } catch {}
  }, []);

  // Suffix hint
  useEffect(() => {
    try {
      const s = window.localStorage.getItem("vtp_broker_suffix_hint") || "";
      setSuffixHint(s);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("vtp_broker_suffix_hint", suffixHint || "");
    } catch {}
  }, [suffixHint]);

  const allChecked = useMemo(
    () => selectedAccounts.length === ACCOUNTS.length && ACCOUNTS.length > 0,
    [selectedAccounts]
  );

  const preview = useMemo(() => {
    if (!trades.length || !selectedAccounts.length) return [];
    const accounts = ACCOUNTS.filter((a) => selectedAccounts.includes(a.id));
    return buildPreviewRows(trades, accounts, baseline);
  }, [trades, selectedAccounts, baseline]);

  function toggleAll() {
    setSelectedAccounts(allChecked ? [] : ACCOUNTS.map((a) => a.id));
  }
  function toggleOne(id: string, checked: boolean | string) {
    setSelectedAccounts((xs) => (checked === true ? [...new Set([...xs, id])] : xs.filter((x) => x !== id)));
  }

  function importFromPool() {
    const arr = loadFromLocalStorage();
    if (!arr.length) {
      setError("Nessuna operazione trovata nel Pool/Calculator (localStorage).");
      return;
    }
    setError(null);
    setTrades(arr);
  }

  function clearAll() {
    setTrades([]);
    setResult(null);
    setConfirm(false);
    setRawPaste("");
  }

  function updateTrade(i: number, patch: Partial<Trade>) {
    setTrades((prev) => {
      const copy = [...prev];
      const t = { ...copy[i], ...patch };
      t.lot = toNumber0(t.lot);
      t.sl  = toNumber0(t.sl);
      t.tp  = toNumber0(t.tp);
      copy[i] = t;
      return copy;
    });
  }

  async function handleOpen() {
    setError(null);
    setResult(null);
    if (!trades.length) return setError("Nessuna operazione da inviare.");
    if (!selectedAccounts.length) return setError("Seleziona almeno un account.");
    if (!confirm) return setError("Spunta la conferma del recap prima di aprire.");
    try {
      setBusy(true);
      const accounts = ACCOUNTS.filter((a) => selectedAccounts.includes(a.id));
      const items = buildQueueItems(trades, accounts, baseline, planName);
      const out = await postQueue({ plan_name: planName, created_by: "live-session", items });
      setResult(out);
    } catch (e: any) {
      setError(e?.message || "Errore invio ordini.");
    } finally {
      setBusy(false);
    }
  }

  function runAliasTest() {
    const out = normalizeSymbol(aliasTestIn);
    setAliasTestOut(out);
  }

  function onParseReplace() {
    setError(null);
    const parsed = parseRawLines(rawPaste);
    if (!parsed.length) {
      setError("Nessuna operazione riconosciuta nel testo incollato.");
      return;
    }
    setTrades(parsed);
  }
  function onParseAppend() {
    setError(null);
    const parsed = parseRawLines(rawPaste);
    if (!parsed.length) {
      setError("Nessuna operazione riconosciuta nel testo incollato.");
      return;
    }
    setTrades((prev) => [...prev, ...parsed]);
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Live Session</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded-2xl px-3 py-2 w-[360px] shadow-sm"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="Plan name"
          />
          <Button variant="secondary" onClick={importFromPool}>Import from Pool</Button>
          <Button variant="ghost" onClick={clearAll}>Clear</Button>
        </div>
      </div>

      {/* Paste area (NUOVO) */}
      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Incolla operazioni (testo grezzo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <textarea
            className="w-full min-h-32 border rounded-2xl p-3 font-mono text-xs shadow-sm"
            placeholder={`Esempi:\nEURUSD buy 0,10 SL 1,0800 TP 1,0900\nUS100, sell, 0.25, sl=17890, tp=17500\nXAUUSD buy 0.05`}
            value={rawPaste}
            onChange={(e) => setRawPaste(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onParseReplace}>Parse & Replace</Button>
            <Button variant="ghost" size="sm" onClick={onParseAppend}>Parse & Append</Button>
          </div>
          <div className="text-muted-foreground">
            • Accetta <b>virgole</b> nei numeri (es. 0,10) e alias (es. NAS100→US100, SPX500→SPX/US500).<br/>
            • Capiamo anche <i>long/short</i> (long=buy, short=sell). SL/TP via “SL … / TP …” o “sl= / tp=”.
          </div>
        </CardContent>
      </Card>

      {/* Accounts + Baseline */}
      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Accounts & Baseline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
            <span className="text-sm text-muted-foreground">Seleziona tutti</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ACCOUNTS.map((acc) => {
              const checked = selectedAccounts.includes(acc.id);
              return (
                <label
                  key={acc.id}
                  className={`border rounded-2xl p-3 flex items-center gap-2 ${checked ? "bg-muted" : ""}`}
                >
                  <Checkbox checked={checked} onCheckedChange={(ch) => toggleOne(acc.id, ch)} />
                  <div>
                    <div className="font-medium">{acc.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {acc.id} • equity ~ {acc.equity}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="w-40 text-sm">Baseline equity</span>
            <input
              className="border rounded-2xl px-3 py-2 w-60 shadow-sm"
              type="number"
              value={baseline}
              min={100}
              step={100}
              onChange={(e) => setBaseline(Number(e.target.value))}
            />
            <span className="text-xs text-muted-foreground">
              lot_scaled = lot_base × equity / baseline
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Trades editor */}
      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Operazioni (importate o incollate)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!trades.length && (
            <div className="text-sm text-muted-foreground">
              Nessuna operazione. Usa <b>Import from Pool</b> o incolla nel riquadro sopra.
            </div>
          )}

          {trades.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Symbol</th>
                    <th className="py-2 pr-3">Side</th>
                    <th className="py-2 pr-3">Base lot</th>
                    <th className="py-2 pr-3">SL (price)</th>
                    <th className="py-2 pr-3">TP (price)</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <input
                          value={t.symbol}
                          onChange={(e) => updateTrade(i, { symbol: e.target.value.toUpperCase() })}
                          className="border rounded-2xl px-2 py-1 w-36 shadow-sm"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={t.side}
                          onChange={(e) =>
                            updateTrade(i, { side: e.target.value === "sell" ? "sell" : "buy" })
                          }
                          className="border rounded-2xl px-2 py-1 w-28 shadow-sm"
                        >
                          <option value="buy">buy</option>
                          <option value="sell">sell</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={t.lot}
                          onChange={(e) => updateTrade(i, { lot: toNumber0(e.target.value) })}
                          className="border rounded-2xl px-2 py-1 w-28 shadow-sm"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          value={String(t.sl ?? 0)}
                          onChange={(e) => updateTrade(i, { sl: toNumber0(e.target.value) })}
                          className="border rounded-2xl px-2 py-1 w-32 shadow-sm"
                          placeholder="0 = none"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          value={String(t.tp ?? 0)}
                          onChange={(e) => updateTrade(i, { tp: toNumber0(e.target.value) })}
                          className="border rounded-2xl px-2 py-1 w-32 shadow-sm"
                          placeholder="0 = none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recap + Confirm + Open */}
      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Recap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedAccounts.length || !trades.length ? (
            <div className="text-sm text-muted-foreground">
              Seleziona almeno un account e aggiungi operazioni per vedere il recap.
            </div>
          ) : (
            <>
              <div className="text-sm">
                Operazioni totali: <b>{trades.length}</b> • Righe recap: <b>{preview.length}</b>
              </div>
              <div className="max-h-72 overflow-auto border rounded-2xl shadow-sm">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 px-2">Account</th>
                      <th className="py-2 px-2">Symbol</th>
                      <th className="py-2 px-2">Side</th>
                      <th className="py-2 px-2">Base lot</th>
                      <th className="py-2 px-2">Scaled lot</th>
                      <th className="py-2 px-2">SL</th>
                      <th className="py-2 px-2">TP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1 px-2">{r.account_label}</td>
                        <td className="py-1 px-2">{r.symbol}</td>
                        <td className="py-1 px-2">{r.side}</td>
                        <td className="py-1 px-2">{r.base_lot}</td>
                        <td className="py-1 px-2 font-medium">{r.scaled_lot}</td>
                        <td className="py-1 px-2">{r.sl ?? 0}</td>
                        <td className="py-1 px-2">{r.tp ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <label className="flex items-center gap-3">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
            <span className="text-sm">
              Confermo lotti / SL / TP per gli ordini da inviare (vedi recap).
            </span>
          </label>

          <div className="flex gap-3">
            <Button disabled={!confirm || !selectedAccounts.length || !trades.length || busy} onClick={handleOpen}>
              {busy ? "Sending…" : "Open Trade"}
            </Button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {result && (
            <div className="text-sm">
              queued: <b>{result.queued ?? 0}</b> • reserved: <b>{result.reserved ?? 0}</b> • filled:{" "}
              <b>{result.filled ?? 0}</b> • rejected: <b>{result.rejected ?? 0}</b>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Broker Suffix Helper (promemoria) */}
      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Broker Symbols & Suffix helper</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-muted-foreground">
            Imposta il suffisso broker direttamente negli <b>Input</b> dell’EA <b>VTP_Executor</b> (campo <b>SYMBOL_SUFFIX</b>).
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-40">Suffix hint (promemoria)</span>
            <input
              className="border rounded-2xl px-3 py-2 w-48 shadow-sm"
              placeholder='.m'
              value={suffixHint}
              onChange={(e) => setSuffixHint(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              (non modifica il payload; l’EA aggiunge il suffisso)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-40">Test alias → canonical</span>
            <input
              className="border rounded-2xl px-3 py-2 w-48 shadow-sm"
              value={aliasTestIn}
              onChange={(e) => setAliasTestIn(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={runAliasTest}>Test</Button>
            <span>= <b>{aliasTestOut || "…"}</b></span>
          </div>

          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Se i simboli non partono: MT4 → <b>Visualizza → Osservazione del Mercato → Mostra tutto</b>.</li>
            <li>EA Inputs: <b>SYMBOL_SUFFIX</b> (es. <code>.m</code>), <b>API_BASE</b>, <b>ACCOUNT_ID</b>, <b>EXEC_API_KEY</b>.</li>
            <li><b>Strumenti → Opzioni → Consulenti Esperti</b>: Consenti <b>WebRequest</b> per <code>http://127.0.0.1:8000</code>.</li>
            <li>Pulsante <b>AutoTrading</b> in alto → deve essere <b>verde</b>.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
