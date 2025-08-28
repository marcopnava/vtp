"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ParsedOrder = {
  side: "buy" | "sell";
  symbol: string;
  entry?: number;
  sl?: number;
  tp1?: number;
  sourceSnippet?: string;
  cot_stance?: "bullish" | "bearish" | "neutral";
};

type CotParsed = { when: string; items: Array<{ symbol: string; stance: "bullish"|"bearish"|"neutral"; evidence: string[] }> };

const STORAGE_TEXT = "vtp_output_ai";
const STORAGE_PARSED = "vtp_parsed_order";
const STORAGE_COT_PARSED = "vtp_cot_parsed";

function parseBlocks(text: string): ParsedOrder[] {
  const blocks = text
    .split(/\n\s*\n|(?:\r?\n){2,}/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const results: ParsedOrder[] = [];

  for (const block of blocks) {
    const src = block.replace(/\s+/g, " ");

    const sideMatch = src.match(/\b(Long|Short)\b/i);
    const side = sideMatch ? (sideMatch[1].toLowerCase() === "long" ? "buy" : "sell") : undefined;

    // (Ticker) tra parentesi
    const symMatch = src.match(/\(([A-Z0-9._\-]{3,15})\)/i);
    const symbol = symMatch ? symMatch[1].toUpperCase() : undefined;

    const entryMatch = src.match(/Entry:\s*([0-9]+(?:\.[0-9]+)?)/i);
    const entry = entryMatch ? Number(entryMatch[1]) : undefined;

    const slMatch = src.match(/\bSL:\s*([0-9]+(?:\.[0-9]+)?)/i);
    const sl = slMatch ? Number(slMatch[1]) : undefined;

    const tp1Match = src.match(/\bTP1:\s*([0-9]+(?:\.[0-9]+)?)/i);
    const tp1 = tp1Match ? Number(tp1Match[1]) : undefined;

    if (side && symbol) {
      results.push({
        side,
        symbol,
        entry,
        sl,
        tp1,
        sourceSnippet: block.slice(0, 220),
      });
    }
  }

  return results;
}

export default function OutputAIPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const [text, setText] = useState("");
  const [ping, setPing] = useState<null | { ok: boolean; message: string }>(null);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<ParsedOrder | null>(null);
  const [cotMap, setCotMap] = useState<Record<string, "bullish"|"bearish"|"neutral">>({});

  // carica testo & scelta & COT
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TEXT);
      if (saved) setText(saved);
      const p = localStorage.getItem(STORAGE_PARSED);
      if (p) setPicked(JSON.parse(p));
      const cotS = localStorage.getItem(STORAGE_COT_PARSED);
      if (cotS) {
        const cot: CotParsed = JSON.parse(cotS);
        const map: Record<string, "bullish"|"bearish"|"neutral"> = {};
        for (const it of cot.items ?? []) map[it.symbol] = it.stance;
        setCotMap(map);
      }
    } catch {}
  }, []);

  // salva testo
  useEffect(() => {
    setSaving(true);
    const id = setTimeout(() => {
      try { localStorage.setItem(STORAGE_TEXT, text); } catch {}
      setSaving(false);
    }, 250);
    return () => clearTimeout(id);
  }, [text]);

  const parsed = useMemo(() => {
    const blocks = parseBlocks(text);
    // arricchisci con COT stance
    return blocks.map(b => ({ ...b, cot_stance: cotMap[b.symbol] }));
  }, [text, cotMap]);

  function choose(it: ParsedOrder) {
    const withCot = { ...it, cot_stance: cotMap[it.symbol] };
    setPicked(withCot);
    try { localStorage.setItem(STORAGE_PARSED, JSON.stringify(withCot)); } catch {}
  }

  async function handlePing() {
    setPing(null);
    try {
      const res = await fetch(`${apiBase}/health`);
      if (!res.ok) { setPing({ ok: false, message: `HTTP ${res.status}` }); return; }
      const data = await res.json();
      setPing({ ok: true, message: JSON.stringify(data) });
    } catch (e: any) {
      setPing({ ok: false, message: e?.message ?? "Network error" });
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <CardTitle>Output AI</CardTitle>
          <div className="text-xs opacity-80">
            API base: <b>{apiBase}</b>{" "}
            <Button size="sm" variant="secondary" className="ml-2" onClick={handlePing}>Ping API</Button>
            {ping && (
              <span className={`ml-3 ${ping.ok ? "text-green-400" : "text-red-400"}`}>
                {ping.ok ? "OK" : "ERR"} — {ping.message}
              </span>
            )}
          </div>
          <div className="text-xs opacity-80">
            COT Filter: compila prima <Link href="/cot-filter" className="underline">qui</Link> (Export JSON: salva anche localmente).
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Incolla qui i blocchi (es. 10 trade)</Label>
            <textarea
              className="w-full h-80 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="Incolla qui..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="text-xs opacity-70">{saving ? "Saving..." : "Saved locally"} — key: <code>{STORAGE_TEXT}</code></div>
          </div>

          <div className="space-y-2">
            <div className="text-sm opacity-80">Riconosciuti: <b>{parsed.length}</b> blocchi</div>
            {parsed.length > 0 && (
              <div className="grid gap-3">
                {parsed.map((p, i) => {
                  const badge =
                    p.cot_stance === "bullish" ? <span className="text-xs rounded bg-green-600/30 px-2 py-1 text-green-300">COT Bullish</span> :
                    p.cot_stance === "bearish" ? <span className="text-xs rounded bg-red-600/30 px-2 py-1 text-red-300">COT Bearish</span> :
                    p.cot_stance === "neutral" ? <span className="text-xs rounded bg-yellow-600/30 px-2 py-1 text-yellow-300">COT Neutral</span> :
                    <span className="text-xs rounded bg-zinc-600/30 px-2 py-1 text-zinc-300">COT —</span>;

                  return (
                    <div key={i} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono">
                          {p.side.toUpperCase()} {p.symbol}
                          {typeof p.entry === "number" ? ` @ ${p.entry}` : ""}{" "}
                          {typeof p.sl === "number" ? `| SL ${p.sl}` : ""}{" "}
                          {typeof p.tp1 === "number" ? `| TP1 ${p.tp1}` : ""}
                        </div>
                        <div className="flex items-center gap-2">
                          {badge}
                          <Button size="sm" variant="secondary" onClick={() => choose(p)}>Usa questo</Button>
                        </div>
                      </div>
                      {p.sourceSnippet && <div className="mt-2 text-xs opacity-70">{p.sourceSnippet}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/sizing-calculator"><Button>Open Calculator</Button></Link>
            <Link href="/orders"><Button variant="secondary">Open Orders</Button></Link>
          </div>

          {picked && (
            <div className="text-xs opacity-80">
              Selezionato: <b>{picked.side.toUpperCase()} {picked.symbol}</b>
              {typeof picked.entry === "number" ? ` @ ${picked.entry}` : ""}{" "}
              {typeof picked.sl === "number" ? `| SL ${picked.sl}` : ""}{" "}
              {typeof picked.tp1 === "number" ? `| TP1 ${picked.tp1}` : ""}{" "}
              {picked.cot_stance ? `| COT ${picked.cot_stance.toUpperCase()}` : ""}
              — salvato in <code>{STORAGE_PARSED}</code>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
