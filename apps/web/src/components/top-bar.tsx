"use client";

import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { useToolEnabled } from "@/lib/tool";

export default function TopBar() {
  const { enabled, setEnabled } = useToolEnabled();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

  return (
    <header className="border-b border-border/40 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
        <Link href="/" className="font-semibold">VTP</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/output-ai" className="opacity-90 hover:opacity-100">Output AI</Link>
          <Link href="/orders" className="opacity-90 hover:opacity-100">Orders</Link>
          <Link href="/sizing-calculator" className="opacity-90 hover:opacity-100">Calculator</Link>
          <Link href="/live-session" className="opacity-90 hover:opacity-100">Live Session</Link>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="opacity-80">API: <code>{apiBase}</code></div>
          <div className="flex items-center gap-2">
            <span className="opacity-80">Tool</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className={enabled ? "text-green-400" : "text-red-400"}>{enabled ? "ON" : "OFF"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
