import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotte pubbliche
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public");

  if (isPublic) return NextResponse.next();

  // Controllo cookie auth
  const token = req.cookies.get("vtp_auth")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protegge tutto tranne login, api/login, assets
  matcher: ["/((?!_next|favicon.ico|api/login|login|public).*)"],
};
