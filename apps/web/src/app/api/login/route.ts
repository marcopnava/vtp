import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const password = String(body?.password ?? "");
  const expected = process.env.AUTH_PASSWORD || "vtp";
  if (password && password === expected) {
    const jar = await cookies();
    jar.set("vtp_auth", "ok", {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60*60*24*7
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
}
