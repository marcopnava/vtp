import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/top-bar";

export const metadata: Metadata = {
  title: "VTP",
  description: "Copy trading & sizing platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <TopBar />
        <main className="py-6">{children}</main>
      </body>
    </html>
  );
}
