"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseAiTrades, type AiTrade } from "@/lib/parser";

const KEY_POOL = "vtp_pool_trades";

export default function PoolPage() {
  const [rows, setRows] = useState<(AiTrade & { selected: boolean })[]>([]);
  const [raw, setRaw] = useState("");

  useEffect(() => {
    // tenta import automatico da localStorage (output ai)
    const raw1 = localStorage.getItem("vtp_parsed_order") || localStorage.getItem("vtp_output_ai_raw");
    if (raw1) {
      try {
        if (raw1.trim().startsWith("{") || raw1.trim().startsWith("[")) {
          const j = JSON.parse(raw1);
          const arr: AiTrade[] = Array.isArray(j) ? j : (Array.isArray(j.items) ? j.items : []);
          if (arr.length) setRows(arr.map(t => ({ ...t, selected: true })));
        } else {
          const arr = parseAiTrades(raw1);
          if (arr.length) setRows(arr.map(t => ({ ...t, selected: true })));
        }
      } catch {}
    }
  }, []);

  function parseFromTextarea() {
    const arr = parseAiTrades(raw);
    if (arr.length === 0) {
      alert("Formato non riconosciuto.");
      return;
    }
    setRows(arr.map(t => ({ ...t, selected: true })));
  }

  function toggleAll(sel: boolean) {
    setRows(prev => prev.map(r => ({ ...r, selected: sel })));
  }

  function sendToCalculator() {
    const selected = rows.filter(r => r.selected).map(({ selected, ...rest }) => rest);
    if (selected.length === 0) {
      alert("Seleziona almeno un trade");
      return;
    }
    localStorage.setItem(KEY_POOL, JSON.stringify(selected));
    // opzionale: anche vtp_parsed_order per retrocompat
    localStorage.setItem("vtp_parsed_order", JSON.stringify(selected));
    window.location.href = "/sizing-calculator";
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle>Pool — seleziona i trade da inviare al Calculator</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={()=>toggleAll(true)}>Select all</Button>
            <Button variant="secondary" onClick={()=>toggleAll(false)}>Unselect all</Button>
            <Button className="ml-auto" onClick={sendToCalculator}>Send to Calculator</Button>
          </div>

          {rows.length===0 && (
            <div className="space-y-2">
              <div className="text-sm opacity-80">Incolla qui l’output AI se non è già stato salvato.</div>
              <Textarea className="h-40 font-mono text-xs" value={raw} onChange={(e)=>setRaw(e.target.value)} placeholder="Incolla qui i 10 trade…"/>
              <Button onClick={parseFromTextarea}>Parse</Button>
            </div>
          )}

          {rows.length>0 && (
            <div className="space-y-2">
              {rows.map((r, i)=>(
                <div key={i} className="border border-border rounded-md p-3 text-sm flex items-center justify-between">
                  <div>
                    <div className="font-mono">{r.symbol} <span className="opacity-80">({r.side.toUpperCase()})</span></div>
                    <div className="opacity-80 text-xs">Entry {r.entry} · SL {r.sl} · TP1 {r.tp1 ?? "-"} {typeof r.varPct==="number" && <Badge className="ml-2 bg-blue-600/30 text-blue-200">VAR {r.varPct}%</Badge>}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="scale-125" checked={r.selected} onChange={(e)=>{
                      const v = e.target.checked; setRows(prev=>prev.map((x,idx)=> idx===i? {...x, selected:v}: x));
                    }}/>
                    <span className="text-xs opacity-70">Select</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
