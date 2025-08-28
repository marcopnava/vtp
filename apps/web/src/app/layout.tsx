// /Users/marconava/Desktop/vtp/apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "VTP",
  description: "Copy trading & sizing platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border/40 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold">VTP</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/output-ai" className="opacity-90 hover:opacity-100">Output AI</Link>
              <Link href="/orders" className="opacity-90 hover:opacity-100">Orders</Link>
              <Link href="/sizing-calculator" className="opacity-90 hover:opacity-100">Calculator</Link>
              <Link href="/live-session" className="opacity-90 hover:opacity-100">Live Session</Link>
            </nav>
          </div>
        </header>
        <main className="py-6">{children}</main>
      </body>
    </html>
  );
}
