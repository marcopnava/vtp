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

/** ---------- Mini Toast (inline component) ---------- **/
type ToastKind = "success" | "error" | "info";
function Toast({
  kind = "info",
  title,
  desc,
  onClose,
}: {
  kind?: ToastKind;
  title: string;
  desc?: string;
  onClose: () => void;
}) {
  const tone =
    kind === "success"
      ? "bg-green-600"
      : kind === "error"
      ? "bg-red-600"
      : "bg-gray-900";
  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <div className={`min-w-[280px] max-w-[380px] text-white rounded-2xl shadow-lg ${tone}`}>
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="font-semibold leading-tight">{title}</div>
              {desc ? <div className="text-sm opacity-90 mt-1">{desc}</div> : null}
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white leading-none px-2"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------- Helpers numeri ---------- **/

// Converte stringhe con migliaia/decimali misti (es. "4,401.1" -> 4401.1, "1,0800" -> 1.0800)
function toSmartFloat(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s+/g, "");
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    // supponiamo virgola = separatore migliaia, punto = decimale
    s = s.replace(/,/g, "");
  } else if (!hasDot && hasComma) {
    // solo virgola -> usala come decimale
    s = s.replace(/,/g, ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function toNumber0(v: any): number {
  return toSmartFloat(v);
}

function sanitizeTrade(t: any): Trade {
  return {
    symbol: normalizeSymbol(String(t.symbol || "").toUpperCase()),
    side: (String(t.side || "buy").toLowerCase() === "sell" ? "sell" : "buy") as "buy" | "sell",
    lot: toNumber0(t.lot) || 0.01,
    sl: toNumber0(t.sl || 0) || 0,
    tp: toNumber0(t.tp || 0) || 0,
  };
}

/** ---------- Import Pool (localStorage) ---------- */
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

/** ---------- Parser testo grezzo ---------- **
 * Supporta:
 *  A) Formato “AI note” multi-riga, es:
 *     Buy ETHUSD (Ethereum): Confluence 85%...
 *     Entry: 4,401.1
 *     SL: 4,225.1 ...
 *     TP1: 4,730.4 (...), TP2: ..., TP3: ...
 *     -> side=buy, symbol=ETHUSD, sl=4225.1, tp=4730.4 (TP1), lot=0.01 (editabile)
 *
 *  B) Formati compatti a riga singola:
 *     EURUSD buy 0,10 SL 1,0800 TP 1,0900
 *     US100, sell, 0.25, sl=17890, tp=17500
 *     XAUUSD buy 0.05
 *     long/short accettati (long=buy, short=sell)
 */
function parseRawText(raw: string): Trade[] {
  if (!raw) return [];
  const text = raw.replace(/\r/g, "").trim();
  const trades: Trade[] = [];

  // 1) Prova a estrarre blocchi AI: (Buy|Sell) SYMBOL ... Entry: ... SL: ... TP1: ...
  // Cattura multipli nel testo.
  const aiRegex = /(Buy|Sell)\s+([A-Z0-9._-]+)(?:\s*\([^)]+\))?[\s\S]*?Entry\s*:\s*([0-9.,]+)[\s\S]*?SL\s*:\s*([0-9.,]+)[\s\S]*?(?:TP1?\s*:\s*|TP\s*:\s*)([0-9.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = aiRegex.exec(text)) !== null) {
    const side = m[1].toLowerCase() === "sell" ? "sell" : "buy";
    const symbol = normalizeSymbol(m[2]);
    // Entry lo ignoriamo per ora (apriamo a mercato)
    const sl = toSmartFloat(m[4]);
    const tp = toSmartFloat(m[5]);
    trades.push({ symbol, side: side as "buy" | "sell", lot: 0.01, sl, tp });
  }

  // Se abbiamo trovato almeno un blocco AI, ritorna.
  if (trades.length) return trades.map(sanitizeTrade);

  // 2) Altrimenti fallback line-by-line (formati compatti)
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const L = line.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    // JSON-like singola riga
    if (/^\{.+\}$/.test(L)) {
      try {
        const obj = JSON.parse(L.replace(/,(\s*[}\]])/g, "$1"));
        trades.push(sanitizeTrade(obj));
        continue;
      } catch {}
    }
    const lc = L.toLowerCase();
    // symbol = prima parola
    const symMatch = L.match(/^[A-Z0-9._-]+/i);
    let symbol = symMatch ? normalizeSymbol(symMatch[0]) : "";
    // side
    let side: "buy" | "sell" = /(^|\s)(sell|short)(\s|$)/i.test(lc) ? "sell" : "buy";
    // lot
    let lot = 0;
    const lotMatch =
      lc.match(/(?:lot|lotti|qty|size)\s*[:=]?\s*([0-9]+[.,]?[0-9]*)/) ||
      lc.match(/\b([0-9]+[.,][0-9]+)\b/);
    if (lotMatch) lot = toSmartFloat(lotMatch[1]);
    if (!lot) {
      const m2 = L.match(/(?:buy|sell|long|short)\s+([0-9]+[.,]?[0-9]*)/i);
      if (m2) lot = toSmartFloat(m2[1]);
    }
    if (!lot) lot = 0.01;

    // SL/TP
    const slMatch = lc.match(/(?:\bsl\b|stop(?:loss)?|stop)\s*[:=]?\s*([0-9]+[.,]?[0-9]*)/);
    const tpMatch = lc.match(/(?:\btp\b|take(?:profit)?)\s*[:=]?\s*([0-9]+[.,]?[0-9]*)/);
    const sl = slMatch ? toSmartFloat(slMatch[1]) : 0;
    const tp = tpMatch ? toSmartFloat(tpMatch[1]) : 0;

    trades.push({ symbol, side, lot, sl, tp });
  }

  return trades.map(sanitizeTrade);
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

  // Toast
  const [toast, setToast] = useState<{ kind: ToastKind; title: string; desc?: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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
      setToast({ kind: "error", title: "Import fallito", desc: "Nessun dato trovato nel Pool." });
      return;
    }
    setError(null);
    setTrades(arr);
    setToast({ kind: "success", title: "Import riuscito", desc: `${arr.length} operazioni caricate` });
  }

  function clearAll() {
    setTrades([]);
    setResult(null);
    setConfirm(false);
    setRawPaste("");
    setToast({ kind: "info", title: "Pulito", desc: "Lista operazioni azzerata." });
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
    if (!trades.length) {
      const msg = "Nessuna operazione da inviare.";
      setError(msg);
      setToast({ kind: "error", title: "Errore", desc: msg });
      return;
    }
    if (!selectedAccounts.length) {
      const msg = "Seleziona almeno un account.";
      setError(msg);
      setToast({ kind: "error", title: "Errore", desc: msg });
      return;
    }
    if (!confirm) {
      const msg = "Conferma il recap prima di aprire.";
      setError(msg);
      setToast({ kind: "error", title: "Errore", desc: msg });
      return;
    }
    try {
      setBusy(true);
      const accounts = ACCOUNTS.filter((a) => selectedAccounts.includes(a.id));
      const items = buildQueueItems(trades, accounts, baseline, planName);
      const out = await postQueue({ plan_name: planName, created_by: "live-session", items });
      setResult(out);
      setToast({
        kind: "success",
        title: "Piano inviato",
        desc: `Queued: ${out?.queued ?? 0} • Filled: ${out?.filled ?? 0} • Rejected: ${out?.rejected ?? 0}`,
      });
    } catch (e: any) {
      const msg = e?.message || "Errore invio ordini.";
      setError(msg);
      setToast({ kind: "error", title: "Errore invio", desc: msg });
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
    const parsed = parseRawText(rawPaste);
    if (!parsed.length) {
      const msg = "Nessuna operazione riconosciuta nel testo incollato.";
      setError(msg);
      setToast({ kind: "error", title: "Parse fallito", desc: msg });
      return;
    }
    setTrades(parsed);
    setToast({ kind: "success", title: "Parse riuscito", desc: `${parsed.length} operazioni caricate` });
  }
  function onParseAppend() {
    setError(null);
    const parsed = parseRawText(rawPaste);
    if (!parsed.length) {
      const msg = "Nessuna operazione riconosciuta nel testo incollato.";
      setError(msg);
      setToast({ kind: "error", title: "Parse fallito", desc: msg });
      return;
    }
    setTrades((prev) => [...prev, ...parsed]);
    setToast({ kind: "success", title: "Aggiunte", desc: `${parsed.length} operazioni aggiunte` });
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

      {/* Paste area */}
      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Incolla operazioni (testo grezzo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <textarea
            className="w-full min-h-32 border rounded-2xl p-3 font-mono text-xs shadow-sm"
            placeholder={`Incolla qui. Esempio supportato:\n\nBuy ETHUSD (Ethereum): Confluence 85%...\nEntry: 4,401.1\nSL: 4,225.1 (...)\nTP1: 4,730.4 (...), TP2: ..., TP3: ...\n\nOppure formati compatti:\nEURUSD buy 0,10 SL 1,0800 TP 1,0900\nUS100, sell, 0.25, sl=17890, tp=17500`}
            value={rawPaste}
            onChange={(e) => setRawPaste(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onParseReplace}>Parse & Replace</Button>
            <Button variant="ghost" size="sm" onClick={onParseAppend}>Parse & Append</Button>
          </div>
          <div className="text-muted-foreground">
            • Capisco blocchi “Buy/Sell … Entry … SL … TP1 …” (uso TP1 come TP).  
            • Numeri con virgola/punto e migliaia (es. 4,401.1 o 1,0800). Long=buy, Short=sell.
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

      {/* Toast mount */}
      {toast && (
        <Toast
          kind={toast.kind}
          title={toast.title}
          desc={toast.desc}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
