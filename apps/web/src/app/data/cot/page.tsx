"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SYMBOLS } from "@/lib/symbols";
import type { Canonical } from "@/lib/aliases";
import { parseCot } from "@/lib/cot";
import { mergeCot, type MergedCotItem } from "@/lib/cot_merge";
import { annotateConfluence } from "@/lib/cot_score";

const STORAGE_DISAGG_RAW = "vtp_cot_disagg_raw";
const STORAGE_FIN_RAW = "vtp_cot_fin_raw";
const STORAGE_DISAGG_PARSED = "vtp_cot_disagg_parsed";
const STORAGE_FIN_PARSED = "vtp_cot_fin_parsed";
const STORAGE_COMBINED_PARSED = "vtp_cot_parsed"; // letto da Output AI

type CotItem = { symbol: Canonical; stance: "bullish"|"bearish"|"neutral"; evidence: string[] };

function ExportBtn({
  fileName,
  payload,
  onAlsoSaveLocalKey,
}: {
  fileName: string;
  payload: any;
  onAlsoSaveLocalKey?: string;
}) {
  function doExport() {
    const s = JSON.stringify(payload, null, 2);
    const blob = new Blob([s], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    if (onAlsoSaveLocalKey) {
      try { localStorage.setItem(onAlsoSaveLocalKey, s); } catch {}
    }
  }
  return (
    <Button onClick={doExport} disabled={!payload || (Array.isArray(payload.items) && payload.items.length === 0)}>
      Export JSON
    </Button>
  );
}

function StanceBadge({ stance }: { stance: "bullish"|"bearish"|"neutral" }) {
  if (stance === "bullish") return <Badge className="bg-green-600/30 text-green-300 hover:bg-green-600/30">BULLISH</Badge>;
  if (stance === "bearish") return <Badge className="bg-red-600/30 text-red-300 hover:bg-red-600/30">BEARISH</Badge>;
  return <Badge className="bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/30">NEUTRAL</Badge>;
}

function SourceBadge({ s }: { s: "disaggregated" | "financial" }) {
  return (
    <Badge className="bg-zinc-700/40 text-zinc-200 hover:bg-zinc-700/40">
      {s === "disaggregated" ? "Disagg" : "Financial"}
    </Badge>
  );
}

export default function COTPage() {
  const allowed = useMemo(() => SYMBOLS as Canonical[], []);

  const [disaggRaw, setDisaggRaw]   = useState("");
  const [finRaw, setFinRaw]         = useState("");
  const [savingDis, setSavingDis]   = useState(false);
  const [savingFin, setSavingFin]   = useState(false);

  // Filtri merged
  const [stanceFilter, setStanceFilter] = useState<"all"|"bullish"|"bearish"|"neutral"|"conflict">("all");
  const [search, setSearch] = useState("");

  // load from storage
  useEffect(() => {
    try {
      const d = localStorage.getItem(STORAGE_DISAGG_RAW);
      if (d) setDisaggRaw(d);
      const f = localStorage.getItem(STORAGE_FIN_RAW);
      if (f) setFinRaw(f);
    } catch {}
  }, []);

  // autosave disagg
  useEffect(() => {
    setSavingDis(true);
    const id = setTimeout(() => {
      try { localStorage.setItem(STORAGE_DISAGG_RAW, disaggRaw); } catch {}
      setSavingDis(false);
    }, 250);
    return () => clearTimeout(id);
  }, [disaggRaw]);

  // autosave fin
  useEffect(() => {
    setSavingFin(true);
    const id = setTimeout(() => {
      try { localStorage.setItem(STORAGE_FIN_RAW, finRaw); } catch {}
      setSavingFin(false);
    }, 250);
    return () => clearTimeout(id);
  }, [finRaw]);

  // parsing
  const disaggParsed = useMemo(() => disaggRaw ? parseCot(disaggRaw, allowed) : [], [disaggRaw, allowed]);
  const finParsed    = useMemo(() => finRaw ? parseCot(finRaw, allowed) : [], [finRaw, allowed]);

  // MERGE + Confluence
  const mergedRaw: MergedCotItem[] = useMemo(() => mergeCot(disaggParsed, finParsed), [disaggParsed, finParsed]);
  const merged = useMemo(() => annotateConfluence(mergedRaw), [mergedRaw]);

  // filtri UI sul merged
  const mergedFiltered = useMemo(() => {
    let items = merged;
    if (stanceFilter !== "all") {
      if (stanceFilter === "conflict") {
        items = items.filter(i => i.conflict);
      } else {
        items = items.filter(i => i.stance === stanceFilter);
      }
    }
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      items = items.filter(i => i.symbol.includes(q));
    }
    return items;
  }, [merged, stanceFilter, search]);

  // payload export per-tab e merged
  const exportDis = { when: new Date().toISOString(), items: disaggParsed };
  const exportFin = { when: new Date().toISOString(), items: finParsed };
  // Export combinato (MERGED) — include meta.confluence
  const exportMerged = {
    when: new Date().toISOString(),
    items: merged.map(m => ({
      symbol: m.symbol,
      stance: m.stance,
      evidence: m.evidence,
      meta: {
        conflict: m.conflict,
        preferred: m.preferred,
        sources: m.sources,
        confluence: m.confluence, // <— nuovo
        notes: m.notes ?? [],
      },
    })),
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Commitments of Traders (COT)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm opacity-80">
            Incolla i testi grezzi del report. Il parser filtra solo i tuoi strumenti ({SYMBOLS.length}).<br/>
            <b>Novità:</b> vista <i>Merged</i> con precedenze, gestione conflitti e <b>Confluence%</b> calcolata.
          </div>

          <Tabs defaultValue="disagg" className="w-full">
            <TabsList>
              <TabsTrigger value="disagg">Disaggregated</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
            </TabsList>

            {/* DISAGGREGATED */}
            <TabsContent value="disagg" className="space-y-4">
              <div className="space-y-2">
                <Label>Disaggregated — raw text</Label>
                <textarea
                  className="w-full h-64 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                  placeholder="Incolla qui il testo grezzo (Disaggregated)…"
                  value={disaggRaw}
                  onChange={(e) => setDisaggRaw(e.target.value)}
                />
                <div className="text-xs opacity-70">{savingDis ? "Saving..." : "Saved"} — key: <code>{STORAGE_DISAGG_RAW}</code></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">Rilevazioni trovate: <b>{disaggParsed.length}</b></div>
                <div className="flex gap-3">
                  <ExportBtn fileName="cot_disaggregated.json" payload={exportDis} onAlsoSaveLocalKey={STORAGE_DISAGG_PARSED} />
                </div>
              </div>

              {disaggParsed.length > 0 && (
                <div className="grid gap-3">
                  {disaggParsed.map((p) => (
                    <div key={`dis-${p.symbol}`} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-mono">{p.symbol}</div>
                        <div className="flex items-center gap-2">
                          <StanceBadge stance={p.stance} />
                          <SourceBadge s="disaggregated" />
                        </div>
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
            </TabsContent>

            {/* FINANCIAL */}
            <TabsContent value="financial" className="space-y-4">
              <div className="space-y-2">
                <Label>Financial — raw text</Label>
                <textarea
                  className="w-full h-64 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                  placeholder="Incolla qui il testo grezzo (Financial)…"
                  value={finRaw}
                  onChange={(e) => setFinRaw(e.target.value)}
                />
                <div className="text-xs opacity-70">{savingFin ? "Saving..." : "Saved"} — key: <code>{STORAGE_FIN_RAW}</code></div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">Rilevazioni trovate: <b>{finParsed.length}</b></div>
                <div className="flex gap-3">
                  <ExportBtn fileName="cot_financial.json" payload={exportFin} onAlsoSaveLocalKey={STORAGE_FIN_PARSED} />
                </div>
              </div>

              {finParsed.length > 0 && (
                <div className="grid gap-3">
                  {finParsed.map((p) => (
                    <div key={`fin-${p.symbol}`} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-mono">{p.symbol}</div>
                        <div className="flex items-center gap-2">
                          <StanceBadge stance={p.stance} />
                          <SourceBadge s="financial" />
                        </div>
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
            </TabsContent>
          </Tabs>

          {/* MERGED + FILTRI + CONFLUENCE */}
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-base">Merged view (precedenze, conflitti, Confluence%)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <Label>Filtro stance</Label>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={stanceFilter}
                    onChange={(e) => setStanceFilter(e.target.value as any)}
                  >
                    <option value="all">Tutti</option>
                    <option value="bullish">Solo Bullish</option>
                    <option value="bearish">Solo Bearish</option>
                    <option value="neutral">Solo Neutral</option>
                    <option value="conflict">Solo Conflicts</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm">Cerca simbolo</Label>
                  <Input
                    className="w-48"
                    placeholder="es. EURUSD"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">Elementi (filtrati): <b>{mergedFiltered.length}</b> / totali: <b>{merged.length}</b></div>
                <ExportBtn
                  fileName="cot_merged.json"
                  payload={{ when: new Date().toISOString(), items: merged.map(m => ({
                    symbol: m.symbol,
                    stance: m.stance,
                    evidence: m.evidence,
                    meta: {
                      conflict: m.conflict,
                      preferred: m.preferred,
                      sources: m.sources,
                      confluence: m.confluence,
                      notes: m.notes ?? [],
                    },
                  })) }}
                  onAlsoSaveLocalKey={STORAGE_COMBINED_PARSED}
                />
              </div>

              {mergedFiltered.length > 0 && (
                <div className="grid gap-3">
                  {mergedFiltered.map((m) => (
                    <div key={`m-${m.symbol}`} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono">{m.symbol}</div>
                        <div className="flex items-center gap-2">
                          {m.conflict && <Badge className="bg-amber-600/30 text-amber-200">CONFLICT</Badge>}
                          <StanceBadge stance={m.stance} />
                          <Badge className="bg-blue-600/30 text-blue-200">Conf {m.confluence}%</Badge>
                          {m.sources.map(s => <SourceBadge key={s} s={s} />)}
                          {m.preferred && (
                            <Badge className="bg-blue-600/20 text-blue-200">preferred: {m.preferred}</Badge>
                          )}
                        </div>
                      </div>
                      {m.notes && m.notes.length > 0 && (
                        <div className="mt-2 text-xs opacity-80">
                          {m.notes.map((n, i) => <div key={i}>• {n}</div>)}
                        </div>
                      )}
                      {m.evidence.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 opacity-80">
                          {m.evidence.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-xs opacity-70">
            L'export <b>cot_merged.json</b> salva anche localmente in <code>{STORAGE_COMBINED_PARSED}</code> (usato da <b>Output AI</b> per i badge COT + Confluence%).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
