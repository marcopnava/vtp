"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SYMBOLS } from "@/lib/symbols";
import type { Canonical } from "@/lib/aliases";
import { parseCot } from "@/lib/cot";

const STORAGE_RAW = "vtp_cotfilter_raw";
const STORAGE_PARSED = "vtp_cotfilter_parsed";

type CotItem = { symbol: Canonical; stance: "bullish"|"bearish"|"neutral"; evidence: string[] };

function ExportBtn({ items }: { items: CotItem[] }) {
  function doExport() {
    const payload = { when: new Date().toISOString(), items };
    const s = JSON.stringify(payload, null, 2);
    const blob = new Blob([s], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cot_filter.json";
    a.click();
    URL.revokeObjectURL(url);
    try { localStorage.setItem(STORAGE_PARSED, s); } catch {}
  }
  return (
    <Button onClick={doExport} disabled={items.length === 0}>
      Export JSON
    </Button>
  );
}

function StanceBadge({ stance }: { stance: "bullish"|"bearish"|"neutral" }) {
  if (stance === "bullish") return <Badge className="bg-green-600/30 text-green-300 hover:bg-green-600/30">BULLISH</Badge>;
  if (stance === "bearish") return <Badge className="bg-red-600/30 text-red-300 hover:bg-red-600/30">BEARISH</Badge>;
  return <Badge className="bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/30">NEUTRAL</Badge>;
}

export default function CotFilterQuick() {
  const allowed = useMemo(() => SYMBOLS as Canonical[], []);
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE_RAW);
      if (r) setRaw(r);
    } catch {}
  }, []);

  useEffect(() => {
    setSaving(true);
    const id = setTimeout(() => {
      try { localStorage.setItem(STORAGE_RAW, raw); } catch {}
      setSaving(false);
    }, 250);
    return () => clearTimeout(id);
  }, [raw]);

  const parsed = useMemo(() => raw ? parseCot(raw, allowed) : [], [raw, allowed]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>COT Filter (quick)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Raw text</Label>
            <textarea
              className="w-full h-64 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="Incolla qui il testo grezzo…"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <div className="text-xs opacity-70">{saving ? "Saving..." : "Saved"} — key: <code>{STORAGE_RAW}</code></div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm opacity-80">Rilevazioni trovate: <b>{parsed.length}</b></div>
            <ExportBtn items={parsed} />
          </div>

          {parsed.length > 0 && (
            <div className="grid gap-3">
              {parsed.map((p) => (
                <div key={p.symbol} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-mono">{p.symbol}</div>
                    <StanceBadge stance={p.stance} />
                  </div>
                  {p.evidence.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 opacity-80">
                      {p.evidence.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
