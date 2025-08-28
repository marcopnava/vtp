"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type InstrumentSpec = {
  symbol: string;
  tick_size: number;   // prezzo per tick
  tick_value: number;  // EUR per tick @ 1 lot
  min_lot: number;
  lot_step: number;
  max_lot?: number | null;
};

type SizingRequest = {
  risk_mode: "fixed" | "percent_balance" | "percent_equity";
  risk_value: number;
  balance?: number | null;
  equity?: number | null;
  stop_distance: number;
  slippage: number;
  instrument: InstrumentSpec;
};

type SizingResponse = {
  suggested_lots: number;
  rounded_to_step: number;
  per_lot_risk: number;
  risk_at_suggested: number;
  warnings: string[];
};

export default function Page() {
  const [riskMode, setRiskMode] = useState<SizingRequest["risk_mode"]>("fixed");
  const [riskValue, setRiskValue] = useState<number>(100);
  const [balance, setBalance] = useState<number | undefined>(undefined);
  const [equity, setEquity] = useState<number | undefined>(undefined);
  const [stopDistance, setStopDistance] = useState<number>(0.0020);
  const [slippage, setSlippage] = useState<number>(0.0);
  const [instrument, setInstrument] = useState<InstrumentSpec>({
    symbol: "EURUSD",
    tick_size: 0.0001,
    tick_value: 10,
    min_lot: 0.01,
    lot_step: 0.01,
    max_lot: 50,
  });
  const [result, setResult] = useState<SizingResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  async function handleCalc() {
    setLoading(true);
    setResult(null);
    const body: SizingRequest = {
      risk_mode: riskMode,
      risk_value: Number(riskValue),
      balance: riskMode === "percent_balance" ? Number(balance) : undefined,
      equity: riskMode === "percent_equity" ? Number(equity) : undefined,
      stop_distance: Number(stopDistance),
      slippage: Number(slippage),
      instrument,
    };
    const res = await fetch(`${apiBase}/sizing/calc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Position Sizing Calculator</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {/* Colonna sinistra: parametri strumento & stop */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={instrument.symbol}
                onChange={(e) => setInstrument({ ...instrument, symbol: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tick Size</Label>
                <Input
                  type="number"
                  step="0.00001"
                  value={instrument.tick_size}
                  onChange={(e) => setInstrument({ ...instrument, tick_size: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Tick Value (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={instrument.tick_value}
                  onChange={(e) => setInstrument({ ...instrument, tick_value: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Lot Step</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={instrument.lot_step}
                  onChange={(e) => setInstrument({ ...instrument, lot_step: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Min Lot</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={instrument.min_lot}
                  onChange={(e) => setInstrument({ ...instrument, min_lot: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Max Lot</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={instrument.max_lot ?? 0}
                  onChange={(e) =>
                    setInstrument({ ...instrument, max_lot: Number(e.target.value) || undefined })
                  }
                />
              </div>
              <div>
                <Label>Stop Distance (price)</Label>
                <Input
                  type="number"
                  step="0.00001"
                  value={stopDistance}
                  onChange={(e) => setStopDistance(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slippage (price)</Label>
                <Input
                  type="number"
                  step="0.00001"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Colonna destra: rischio & risultato */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Risk Mode</Label>
              <RadioGroup
                value={riskMode}
                onValueChange={(v: any) => setRiskMode(v)}
                className="grid grid-cols-3 gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="fixed" value="fixed" />
                  <Label htmlFor="fixed">Fixed €</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="pb" value="percent_balance" />
                  <Label htmlFor="pb">% Balance</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="pe" value="percent_equity" />
                  <Label htmlFor="pe">% Equity</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{riskMode === "fixed" ? "Risk (€)" : "Risk (%)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={riskValue}
                  onChange={(e) => setRiskValue(Number(e.target.value))}
                />
              </div>

              {riskMode === "percent_balance" && (
                <div>
                  <Label>Balance (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={balance ?? ""}
                    onChange={(e) => setBalance(Number(e.target.value))}
                  />
                </div>
              )}

              {riskMode === "percent_equity" && (
                <div>
                  <Label>Equity (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={equity ?? ""}
                    onChange={(e) => setEquity(Number(e.target.value))}
                  />
                </div>
              )}
            </div>

            <Button onClick={handleCalc} disabled={loading}>
              {loading ? "Calcolo..." : "Calcola Lottaggio"}
            </Button>

            {result && (
              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle>Risultato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>Lots (raw): <b>{result.suggested_lots.toFixed(4)}</b></div>
                  <div>Lots (rounded): <b>{result.rounded_to_step.toFixed(2)}</b></div>
                  <div>Per-lot Risk: <b>{result.per_lot_risk.toFixed(2)} €</b></div>
                  <div>Risk @ rounded: <b>{result.risk_at_suggested.toFixed(2)} €</b></div>
                  {result.warnings?.length > 0 && (
                    <ul className="text-yellow-300 list-disc pl-5">
                      {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
