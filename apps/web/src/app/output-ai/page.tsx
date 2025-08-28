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
};

const STORAGE_TEXT = "vtp_output_ai";
const STORAGE_PARSED = "vtp_parsed_order";

function parseBlocks(text: string): ParsedOrder[] {
  // Split per doppie righe o blocchi
  const blocks = text
    .split(/\n\s*\n|(?:\r?\n){2,}/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const results: ParsedOrder[] = [];

  for (const block of blocks) {
    const src = block.replace(/\s+/g, " ");

    // side (Long/Short)
    const sideMatch = src.match(/\b(Long|Short)\b/i);
    const side = sideMatch ? (sideMatch[1].toLowerCase() === "long" ? "buy" : "sell") : undefined;

    // symbol tra parentesi, es: (SPX500) (US100) (EURUSD)
    const symMatch = src.match(/\(([A-Z0-9._\-]{3,15})\)/i);
    const symbol = symMatch ? symMatch[1].toUpperCase() : undefined;

    // Entry
    const entryMatch = src.match(/Entry:\s*([0-9]+(?:\.[0-9]+)?)/i);
    const entry = entryMatch ? Number(entryMatch[1]) : undefined;

    // SL
    const slMatch = src.match(/\bSL:\s*([0-9]+(?:\.[0-9]+)?)/i);
    const sl = slMatch ? Number(slMatch[1]) : undefined;

    // TP1
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

  // carica testo & scelta
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TEXT);
      if (saved) setText(saved);
      const p = localStorage.getItem(STORAGE_PARSED);
      if (p) setPicked(JSON.parse(p));
    } catch {}
  }, []);

  // salva testo
  useEffect(() => {
    setSaving(true);
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_TEXT, text);
      } catch {}
      setSaving(false);
    }, 250);
    return () => clearTimeout(id);
  }, [text]);

  const parsed = useMemo(() => parseBlocks(text), [text]);

  function choose(it: ParsedOrder) {
    setPicked(it);
    try {
      localStorage.setItem(STORAGE_PARSED, JSON.stringify(it));
    } catch {}
  }

  async function handlePing() {
    setPing(null);
    try {
      const res = await fetch(`${apiBase}/health`);
      if (!res.ok) {
        setPing({ ok: false, message: `HTTP ${res.status}` });
        return;
      }
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
            <Button size="sm" variant="secondary" className="ml-2" onClick={handlePing}>
              Ping API
            </Button>
            {ping && (
              <span className={`ml-3 ${ping.ok ? "text-green-400" : "text-red-400"}`}>
                {ping.ok ? "OK" : "ERR"} — {ping.message}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Incolla qui i blocchi (una o più strategie)</Label>
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
                {parsed.map((p, i) => (
                  <div key={i} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono">
                        {p.side.toUpperCase()} {p.symbol}
                        {typeof p.entry === "number" ? ` @ ${p.entry}` : ""}{" "}
                        {typeof p.sl === "number" ? `| SL ${p.sl}` : ""}{" "}
                        {typeof p.tp1 === "number" ? `| TP1 ${p.tp1}` : ""}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => choose(p)}>Usa questo</Button>
                    </div>
                    {p.sourceSnippet && <div className="mt-2 text-xs opacity-70">{p.sourceSnippet}</div>}
                  </div>
                ))}
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
              {typeof picked.tp1 === "number" ? `| TP1 ${picked.tp1}` : ""} — salvato in <code>{STORAGE_PARSED}</code>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
