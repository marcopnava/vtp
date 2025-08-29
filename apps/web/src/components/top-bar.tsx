"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTool } from "@/lib/tool";

const NAV = [
  { href: "/data", label: "Data" },
  { href: "/clients", label: "Clients" },
  { href: "/output-ai", label: "Output AI" },
  { href: "/pool", label: "Pool" },
  { href: "/sizing-calculator", label: "Calculator" },
  { href: "/live-session", label: "Live Session" },
];

export default function TopBar() {
  const path = usePathname();
  const { enabled, setEnabled } = useTool();

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/" className="text-lg font-semibold">vtp</Link>
        <nav className="flex items-center gap-2">
          {NAV.map(n => {
            const active = path?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`text-sm px-3 py-1.5 rounded-md ${active ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs opacity-70">Tool</label>
          <input type="checkbox" className="scale-125" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} />
          <form action="/api/logout" method="post">
            <Button type="submit" size="sm" variant="secondary">Logout</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
