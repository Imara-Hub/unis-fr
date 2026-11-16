import { NextResponse, type NextRequest } from "next/server";
import { enterWithKey, grantAccess } from "@/lib/access";

// The organisation's entry link: /enter/<key>. Opening it once on a device unlocks the team's
// pages there (see lib/access.ts), then goes to the login page (or to the admin signup on a fresh
// install). A wrong key just shows the public results, like any other visitor.
//
// Asked for JSON (fetch from Settings after the admin made a new key): answers { ok } and sets
// the cookie without leaving the page.
//
// Guesses are slowed down per visitor here; the API only sees this server's address.
const LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(ip: string) {
  const now = Date.now();
  if (attempts.size > 10_000) attempts.clear();
  const bucket = attempts.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + LIMIT.windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > LIMIT.max;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { key } = await params;

  const token = tooMany(ip) || key.length > 200 ? null : await enterWithKey(decodeURIComponent(key));
  if (!token) {
    if (wantsJson) return NextResponse.json({ ok: false }, { status: 403, headers: { "cache-control": "no-store" } });
    return NextResponse.redirect(new URL("/results", request.url));
  }
  attempts.delete(ip); // a right key is not a guess

  const response = wantsJson
    ? NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } })
    : NextResponse.redirect(new URL("/login", request.url));
  response.headers.set("cache-control", "no-store");
  return grantAccess(request, response, token);
}
