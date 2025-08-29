"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type Rule =
  | { type: "proportional"; base: "equity" | "balance"; multiplier: number }
  | { type: "fixed"; lots: number }
  | { type: "lot_per_10k"; base: "equity" | "balance"; lots_per_10k: number };

type ClientAcc = {
  id: string;        // account id (usato come follower_id)
  name: string;      // Nome Cognome
  balance?: number;
  equity?: number;
  enabled: boolean;
  rule: Rule;
};

const KEY = "vtp_clients";

export default function ClientsPage() {
  const [list, setList] = useState<ClientAcc[]>([]);
  const [form, setForm] = useState<ClientAcc>({
    id: "",
    name: "",
    balance: undefined,
    equity: undefined,
    enabled: true,
    rule: { type: "proportional", base: "equity", multiplier: 1.0 },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setList(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(list));
  }, [list]);

  function save() {
    if (!form.id || !form.name) {
      alert("Inserisci almeno Nome e Account ID");
      return;
    }
    setList(prev => {
      const exists = prev.findIndex(x => x.id === form.id);
      if (exists >= 0) {
        const copy = [...prev];
        copy[exists] = form;
        return copy;
      }
      return [...prev, form];
    });
    setForm({
      id: "",
      name: "",
      balance: undefined,
      equity: undefined,
      enabled: true,
      rule: { type: "proportional", base: "equity", multiplier: 1.0 },
    });
  }

  function edit(id: string) {
    const it = list.find(x => x.id === id);
    if (it) setForm(it);
  }
  function remove(id: string) {
    if (!confirm("Rimuovere questo account?")) return;
    setList(prev => prev.filter(x => x.id !== id));
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vtp_clients.json"; a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(String(r.result || "[]"));
        if (Array.isArray(j)) setList(j as ClientAcc[]);
      } catch (err: any) { alert("JSON non valido: " + err?.message); }
    };
    r.readAsText(f);
  }

  const ruleType = (form.rule as any).type;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle>Clients (anagrafica conti)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Nome e cognome</Label>
              <Input value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})}/>
            </div>
            <div>
              <Label>Account ID (follower_id)</Label>
              <Input value={form.id} onChange={(e)=>setForm({...form, id: e.target.value})}/>
            </div>
            <div className="flex items-end gap-3">
              <Switch checked={form.enabled} onCheckedChange={(v)=>setForm({...form, enabled: v})}/>
              <Label>Enabled</Label>
            </div>

            <div>
              <Label>Balance (€)</Label>
              <Input type="number" value={form.balance ?? ""} onChange={(e)=>setForm({...form, balance: parseFloat(e.target.value || "0")})}/>
            </div>
            <div>
              <Label>Equity (€)</Label>
              <Input type="number" value={form.equity ?? ""} onChange={(e)=>setForm({...form, equity: parseFloat(e.target.value || "0")})}/>
            </div>

            <div>
              <Label>Rule type</Label>
              <Select value={ruleType} onValueChange={(v)=> {
                if (v==="proportional") setForm({...form, rule: { type:"proportional", base:"equity", multiplier:1.0 }});
                if (v==="fixed")        setForm({...form, rule: { type:"fixed", lots:0.10 }});
                if (v==="lot_per_10k")  setForm({...form, rule: { type:"lot_per_10k", base:"equity", lots_per_10k:0.10 }});
              }}>
                <SelectTrigger><SelectValue placeholder="Seleziona"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proportional">proportional</SelectItem>
                  <SelectItem value="fixed">fixed</SelectItem>
                  <SelectItem value="lot_per_10k">lot_per_10k</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {ruleType==="proportional" && (
              <>
                <div>
                  <Label>Base</Label>
                  <Select value={(form.rule as any).base} onValueChange={(v)=>setForm({...form, rule:{ type:"proportional", base: v as any, multiplier:(form.rule as any).multiplier }})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equity">equity</SelectItem>
                      <SelectItem value="balance">balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Multiplier</Label>
                  <Input type="number" step="0.01" value={(form.rule as any).multiplier ?? 1} onChange={(e)=>setForm({...form, rule:{ ...(form.rule as any), multiplier: parseFloat(e.target.value || "0") }})}/>
                </div>
              </>
            )}
            {ruleType==="fixed" && (
              <div>
                <Label>Lots</Label>
                <Input type="number" step="0.01" value={(form.rule as any).lots ?? 0} onChange={(e)=>setForm({...form, rule:{ type:"fixed", lots: parseFloat(e.target.value || "0") }})}/>
              </div>
            )}
            {ruleType==="lot_per_10k" && (
              <>
                <div>
                  <Label>Base</Label>
                  <Select value={(form.rule as any).base} onValueChange={(v)=>setForm({...form, rule:{ type:"lot_per_10k", base: v as any, lots_per_10k:(form.rule as any).lots_per_10k }})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equity">equity</SelectItem>
                      <SelectItem value="balance">balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lots per 10k</Label>
                  <Input type="number" step="0.01" value={(form.rule as any).lots_per_10k ?? 0} onChange={(e)=>setForm({...form, rule:{ ...(form.rule as any), lots_per_10k: parseFloat(e.target.value || "0") }})}/>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button variant="secondary" onClick={exportJson}>Export JSON</Button>
            <div className="relative">
              <input type="file" accept="application/json" className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={importJson}/>
              <Button variant="secondary">Import JSON</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Elenco</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length===0 && <div className="opacity-70 text-sm">Nessun account ancora.</div>}
          {list.map(c => (
            <div key={c.id} className="border border-border rounded-md p-3 flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">{c.name} <span className="opacity-70">({c.id})</span></div>
                <div className="text-sm opacity-80">Balance: {c.balance ?? "-"} — Equity: {c.equity ?? "-"}</div>
                <div className="text-xs opacity-80">
                  Rule: { (c.rule as any).type } { (c.rule as any).base ? `· base=${(c.rule as any).base}` : "" }
                  { (c.rule as any).multiplier ? ` · mult=${(c.rule as any).multiplier}` : "" }
                  { (c.rule as any).lots ? ` · lots=${(c.rule as any).lots}` : "" }
                  { (c.rule as any).lots_per_10k ? ` · lots/10k=${(c.rule as any).lots_per_10k}` : "" }
                </div>
              </div>
              <div className="flex gap-2">
                {c.enabled ? <Badge className="bg-green-600/30 text-green-200">enabled</Badge> : <Badge className="bg-zinc-600/30 text-zinc-200">disabled</Badge>}
                <Button size="sm" onClick={()=>edit(c.id)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={()=>remove(c.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
