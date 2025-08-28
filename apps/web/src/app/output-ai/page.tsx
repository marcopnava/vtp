"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function OutputAIPage() {
  const STORAGE_KEY = "vtp_output_ai";
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  const [text, setText] = useState("");
  const [ping, setPing] = useState<null | { ok: boolean; message: string }>(null);
  const [saving, setSaving] = useState(false);

  // carica da localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setText(saved);
    } catch {}
  }, []);

  // salva su localStorage
  useEffect(() => {
    setSaving(true);
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, text);
      } catch {}
      setSaving(false);
    }, 250);
    return () => clearTimeout(id);
  }, [text]);

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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Incolla qui il testo (strategie multiple, una per riga o blocco)</Label>
            <textarea
              className="w-full h-80 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="Incolla qui i blocchi, es:&#10;Long S&P 500 (SPX500): Confluence 85%...&#10;Long NASDAQ (US100): ..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="text-xs opacity-70">
              {saving ? "Saving..." : "Saved locally"} (localStorage key: <code>{STORAGE_KEY}</code>)
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/sizing-calculator">
              <Button>Open Calculator</Button>
            </Link>
            <Link href="/live-session">
              <Button variant="secondary">Go to Live Session</Button>
            </Link>
          </div>

          <div className="text-xs opacity-70">
            Nota: il Calculator potrà leggere questo testo da localStorage per precompilare simbolo, entry/SL, ecc.
            In una fase successiva aggiungeremo il parser automatico per calcolare i lotti per ogni account-size.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
