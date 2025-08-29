// apps/web/src/app/sizing-calculator/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAiTrades, type AiTrade } from "@/lib/parser";
import { Badge } from "@/components/ui/badge";

type Row = AiTrade & { selected: boolean; stopDistance: number };

export default function SizingCalculatorPage() {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [apiBase, setApiBase] = useState<string>("");

  useEffect(() => {
    setApiBase(process.env.NEXT_PUBLIC_API_BASE || "");
    // tenta import da Pool/Output-AI
    importFromOutputAI();
  }, []);

  function importFromOutputAI() {
    try {
      const pool = localStorage.getItem("vtp_pool_trades");
      const s = pool || localStorage.getItem("vtp_parsed_order") || localStorage.getItem("vtp_output_ai_raw");
      if (!s) return;
      let arr: AiTrade[] = [];
      if (s.trim().startsWith("{") || s.trim().startsWith("[")) {
        const j = JSON.parse(s);
        arr = Array.isArray(j) ? j : (Array.isArray(j.items) ? j.items : []);
      } else {
        arr = parseAiTrades(s);
      }
      if (!arr.length) return;
      setRows(arr.map(t => ({
        ...t,
        selected: true,
        stopDistance: Math.abs((t.entry ?? 0) - (t.sl ?? 0)),
      })));
    } catch {}
  }

  function parseFromTextarea() {
    const arr = parseAiTrades(raw);
    if (!arr.length) {
      alert("Formato non riconosciuto.");
      return;
    }
    setRows(arr.map(t => ({
      ...t,
      selected: true,
      stopDistance: Math.abs((t.entry ?? 0) - (t.sl ?? 0)),
    })));
  }

  function proceedLive() {
    const sel = rows.filter(r => r.selected).map(({ selected, ...rest }) => rest);
    if (!sel.length) {
      alert("Seleziona almeno un trade");
      return;
    }
    localStorage.setItem("vtp_selected_trades", JSON.stringify(sel));
    window.location.href = "/live-session";
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle>Calculator — import & review</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm opacity-80">
            Importa dai pulsanti o incolla il testo dell’Output AI qui sotto e premi <em>Parse</em>.
          </div>

          <div className="flex gap-2">
            <Button onClick={importFromOutputAI}>Import from Output AI/Pool</Button>
          </div>

          <Textarea className="h-40 font-mono text-xs" value={raw} onChange={(e)=>setRaw(e.target.value)} placeholder="Incolla qui i 10 trade…"/>
          <Button onClick={parseFromTextarea}>Parse</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Review & confirm</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length===0 && <div className="text-sm opacity-70">Nessun trade importato.</div>}
          {rows.length>0 && (
            <>
              <div className="text-xs opacity-80 mb-2">Seleziona quali trade includere, poi procedi alla Live Session.</div>
              <div className="space-y-2">
                {rows.map((r, i)=>(
                  <div key={i} className="border border-border rounded-md p-3 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-mono">{r.symbol} <span className="opacity-80">({r.side.toUpperCase()})</span></div>
                      <div className="opacity-80 text-xs">Entry {r.entry} · SL {r.sl} · Δ {r.stopDistance.toFixed(5)} {typeof r.varPct==="number" && <Badge className="ml-2 bg-blue-600/30 text-blue-200">VAR {r.varPct}%</Badge>}</div>
                      {r.tp1 && <div className="text-xs opacity-60">TP1 {r.tp1}{r.tp2?` · TP2 ${r.tp2}`:""}{r.tp3?` · TP3 ${r.tp3}`:""}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="scale-125" checked={r.selected} onChange={(e)=>{
                        const v = e.target.checked; setRows(prev=>prev.map((x,idx)=> idx===i? {...x, selected:v}: x));
                      }}/>
                      <span className="text-xs opacity-70">Include</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={proceedLive}>Proceed to Live Session</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
