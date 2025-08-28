"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type InstrumentSpec = {
  symbol: string;
  tick_size: number;
  tick_value: number;   // EUR per tick @ 1 lot
  min_lot: number;
  lot_step: number;
  max_lot?: number | null;
};

type MasterInfo = {
  balance: number;
  equity: number;
};

type MasterOrder = {
  symbol: string;
  side: "buy" | "sell";
  lot: number;
  sl?: number | null;
  tp?: number | null;
  comment?: string | null;
};

type ProportionalRule = {
  type: "proportional";
  base: "balance" | "equity";
  multiplier: number;
};

type FixedRule = {
  type: "fixed";
  lots: number;
};

type LotPerUnitRule = {
  type: "lot_per_10k";
  base: "balance" | "equity";
  lots_per_unit: number;
  unit: number; // es. 10000
};

type Rule = ProportionalRule | FixedRule | LotPerUnitRule;

type FollowerAccount = {
  id: string;
  name?: string | null;
  balance: number;
  equity: number;
  rule: Rule;
  enabled: boolean;
};

type CopyPreviewRequest = {
  instrument: InstrumentSpec;
  master_info: MasterInfo;
  master_order: MasterOrder;
  followers: FollowerAccount[];
};

type FollowerPreview = {
  follower_id: string;
  follower_name?: string | null;
  raw_lot: number;
  rounded_lot: number;
  warnings: string[];
};

type CopyPreviewResponse = {
  symbol: string;
  side: "buy" | "sell";
  master_lot: number;
  total_followers: number;
  total_lots_raw: number;
  total_lots_rounded: number;
  previews: FollowerPreview[];
};

export default function OrdersPage() {
  // Instrument
  const [instrument, setInstrument] = useState<InstrumentSpec>({
    symbol: "EURUSD",
    tick_size: 0.0001,
    tick_value: 10,
    min_lot: 0.01,
    lot_step: 0.01,
    max_lot: 50,
  });

  // Master info & order
  const [masterInfo, setMasterInfo] = useState<MasterInfo>({ balance: 10000, equity: 10000 });
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [masterLot, setMasterLot] = useState<number>(1.0);
  const [sl, setSl] = useState<number | "">("");
  const [tp, setTp] = useState<number | "">("");
  const [comment, setComment] = useState<string>("");

  // Followers editor (JSON semplice per MVP)
  const defaultFollowersJSON = `[
  {
    "id": "acc-001",
    "name": "Follower A",
    "balance": 10000,
    "equity": 10000,
    "enabled": true,
    "rule": { "type": "proportional", "base": "equity", "multiplier": 1.0 }
  },
  {
    "id": "acc-002",
    "name": "Follower B",
    "balance": 20000,
    "equity": 20000,
    "enabled": true,
    "rule": { "type": "proportional", "base": "equity", "multiplier": 1.0 }
  },
  {
    "id": "acc-003",
    "name": "Fixed 0.10",
    "balance": 5000,
    "equity": 5000,
    "enabled": true,
    "rule": { "type": "fixed", "lots": 0.10 }
  }
]`;
  const [followersJSON, setFollowersJSON] = useState<string>(defaultFollowersJSON);
  const [followers, setFollowers] = useState<FollowerAccount[]>([]);
  const [jsonError, setJsonError] = useState<string>("");

  // Preview result
  const [result, setResult] = useState<CopyPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  function parseFollowersJSON() {
    setJsonError("");
    try {
      const parsed = JSON.parse(followersJSON);
      if (!Array.isArray(parsed)) throw new Error("Il JSON deve essere un array di follower");
      setFollowers(parsed);
    } catch (e: any) {
      setJsonError(e.message || "JSON non valido");
    }
  }

  async function handlePreview() {
    setLoading(true);
    setResult(null);
    setJsonError("");

    // se non hai ancora premuto "Carica JSON", prova a parse al volo
    if (followers.length === 0) {
      try {
        const parsed = JSON.parse(followersJSON);
        if (Array.isArray(parsed)) setFollowers(parsed);
      } catch {
        setJsonError("Followers JSON non valido");
        setLoading(false);
        return;
      }
    }

    const payload: CopyPreviewRequest = {
      instrument,
      master_info: masterInfo,
      master_order: {
        symbol: instrument.symbol,
        side,
        lot: Number(masterLot),
        sl: sl === "" ? undefined : Number(sl),
        tp: tp === "" ? undefined : Number(tp),
        comment: comment || undefined,
      },
      followers: followers.length > 0 ? followers : JSON.parse(followersJSON),
    };

    const res = await fetch(`${apiBase}/copy/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      setJsonError(`Errore API: ${res.status} ${text}`);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as CopyPreviewResponse;
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Instrument */}
      <Card>
        <CardHeader>
          <CardTitle>Instrument & Master</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          {/* Colonna 1: Instrument */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Instrument</h3>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={instrument.symbol}
                onChange={(e) => setInstrument({ ...instrument, symbol: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label>Lot Step</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={instrument.lot_step}
                  onChange={(e) => setInstrument({ ...instrument, lot_step: Number(e.target.value) })}
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
            </div>
          </div>

          {/* Colonna 2: Master info */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Master Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Balance (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={masterInfo.balance}
                  onChange={(e) => setMasterInfo({ ...masterInfo, balance: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Equity (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={masterInfo.equity}
                  onChange={(e) => setMasterInfo({ ...masterInfo, equity: Number(e.target.value) })}
                />
              </div>
            </div>

            <h3 className="text-lg font-semibold pt-2">Master Order</h3>
            <div className="space-y-2">
              <Label>Side</Label>
              <RadioGroup
                value={side}
                onValueChange={(v: any) => setSide(v)}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="buy" value="buy" />
                  <Label htmlFor="buy">Buy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="sell" value="sell" />
                  <Label htmlFor="sell">Sell</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Lot</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={masterLot}
                  onChange={(e) => setMasterLot(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>SL (price)</Label>
                <Input
                  type="number"
                  step="0.00001"
                  value={sl}
                  onChange={(e) => setSl(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div>
                <Label>TP (price)</Label>
                <Input
                  type="number"
                  step="0.00001"
                  value={tp}
                  onChange={(e) => setTp(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="(opzionale)"
              />
            </div>
          </div>

          {/* Colonna 3: Followers JSON */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Followers (JSON)</h3>
            <textarea
              className="w-full h-72 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={followersJSON}
              onChange={(e) => setFollowersJSON(e.target.value)}
            />
            {jsonError && <div className="text-red-400 text-sm">{jsonError}</div>}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={parseFollowersJSON}>Carica JSON</Button>
              <Button onClick={handlePreview} disabled={loading}>
                {loading ? "Preview..." : "Preview Copy"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risultato Preview */}
      {result && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Recap — {result.symbol} {result.side.toUpperCase()} (master {result.master_lot} lot)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm opacity-80">
              Followers: <b>{result.total_followers}</b> — Total lots (raw): <b>{result.total_lots_raw.toFixed(4)}</b> — Total lots (rounded): <b>{result.total_lots_rounded.toFixed(2)}</b>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left border-b border-border">
                  <tr>
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Raw Lot</th>
                    <th className="py-2 pr-4">Rounded Lot</th>
                    <th className="py-2 pr-4">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {result.previews.map((p) => (
                    <tr key={p.follower_id} className="border-b border-border/40">
                      <td className="py-2 pr-4 font-mono">{p.follower_id}</td>
                      <td className="py-2 pr-4">{p.follower_name ?? "-"}</td>
                      <td className="py-2 pr-4">{p.raw_lot.toFixed(4)}</td>
                      <td className="py-2 pr-4 font-semibold">{p.rounded_lot.toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        {p.warnings.length > 0 ? (
                          <ul className="list-disc pl-5">
                            {p.warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
