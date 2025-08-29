"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function DataIndexPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Commitments of Traders (COT)</div>
              <div className="text-sm opacity-80">
                Incolla testi grezzi dei report e filtra solo i tuoi strumenti. Include merge Disaggregated/Financial.
              </div>
            </div>
            <Link href="/data/cot" className="underline opacity-90 hover:opacity-100">
              Apri
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">COT Filter (quick)</div>
              <div className="text-sm opacity-80">
                Strumento veloce per filtrare e esportare i COT solo per il tuo universo (35 simboli).
              </div>
            </div>
            <Link href="/data/cot-filter" className="underline opacity-90 hover:opacity-100">
              Apri
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
