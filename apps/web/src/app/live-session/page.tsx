"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LiveSessionPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  // Safety Guard: ON = blocca esecuzioni reali (rimane solo DRY RUN)
  const [safetyGuard, setSafetyGuard] = useState<boolean>(true);
  const [apiOk, setApiOk] = useState<null | boolean>(null);
  const [pingMsg, setPingMsg] = useState<string>("");

  useEffect(() => {
    // ping API per status
    (async () => {
      try {
        const res = await fetch(`${apiBase}/health`);
        setApiOk(res.ok);
        const data = await res.json().catch(() => ({}));
        setPingMsg(res.ok ? JSON.stringify(data) : `HTTP ${res.status}`);
      } catch (e: any) {
        setApiOk(false);
        setPingMsg(e?.message ?? "Network error");
      }
    })();
  }, [apiBase]);

  function toggleSafety() {
    setSafetyGuard((s) => !s);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Live Session — Control Room</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          {/* Colonna 1: Stato API + Guard */}
          <div className="space-y-4">
            <div className="text-sm">
              <div className="opacity-80">API base:</div>
              <div className="font-mono">{apiBase}</div>
              <div className={`mt-2 text-sm ${apiOk ? "text-green-400" : "text-red-400"}`}>
                {apiOk === null ? "Checking..." : apiOk ? "API OK" : "API ERROR"} {pingMsg && `— ${pingMsg}`}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base">Safety Guard</Label>
              <div className="text-sm opacity-80">
                {safetyGuard
                  ? "ON — nessuna esecuzione reale (solo DRY RUN / preview)"
                  : "OFF — attenzione: esecuzioni reali abilitate (quando il bridge sarà collegato)"}
              </div>
              <div className="flex gap-3">
                <Button variant={safetyGuard ? "default" : "secondary"} onClick={toggleSafety}>
                  {safetyGuard ? "Disable Guard" : "Enable Guard"}
                </Button>
              </div>
            </div>
          </div>

          {/* Colonna 2: Comandi sessione (placeholder) */}
          <div className="space-y-4">
            <Label className="text-base">Session Commands</Label>
            <div className="flex gap-3">
              <Button disabled>Start DRY RUN</Button>
              <Button variant="secondary" disabled>Execute Copy (coming soon)</Button>
            </div>
            <div className="text-xs opacity-70">
              In questa sezione collegheremo l’endpoint <code>/copy/execute</code>. Con Safety Guard ON, resterà in DRY RUN.
            </div>
          </div>

          {/* Colonna 3: Link rapidi */}
          <div className="space-y-2">
            <Label className="text-base">Shortcuts</Label>
            <div className="flex flex-col gap-2">
              <a className="underline opacity-90 hover:opacity-100" href="/output-ai">Apri Output AI</a>
              <a className="underline opacity-90 hover:opacity-100" href="/orders">Vai a Orders (Preview)</a>
              <a className="underline opacity-90 hover:opacity-100" href="/sizing-calculator">Apri Calculator</a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Feed (coming soon)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm opacity-80">
          Qui vedrai: richieste di preview, esiti (OK/ERR), tempi di risposta, e—quando abiliteremo il bridge—gli ID degli ordini, slippage, esecuzioni per account.
        </CardContent>
      </Card>
    </div>
  );
}
