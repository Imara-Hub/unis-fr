import type { NextRequest, NextResponse } from "next/server";

// The gate: the team's pages (login, dashboard, judging…) open only for a browser that holds the
// access cookie. The key behind it lives in the API (the admin makes their own in Settings, Access
// to the app; before that, the API's ORG_ACCESS_KEY; with neither there is no gate). This module
// is the web app's side: it asks the API whether a cookie is good (proxy.ts) and trades the entry
// key (/enter/<key>) or an invite link for the cookie's value. Server only.
//
// The cookie holds a hash of the key, never the key, so a new key ends every cookie at once.

export const ACCESS_COOKIE = "musabaqa_access";
const ONE_YEAR_S = 365 * 24 * 60 * 60;

// Every page load would otherwise ask the API: answers are kept a short while.
const CACHE_MS = 30_000;
const API_TIMEOUT_MS = 4_000;

type Verdict = "open" | "ok" | "no";

// The API as seen from this server (API_URL, e.g. an internal address), else the public one.
const apiUrl = () => process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5500/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf": "1" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T; errors?: unknown[] };
    return body.errors?.length ? null : (body.data ?? null);
  } catch {
    return null; // unreachable, timed out: the caller treats it as "unknown"
  } finally {
    clearTimeout(timer);
  }
}

const verdicts = new Map<string, { verdict: Verdict; until: number }>();
// Cookies the API once said yes to, kept after they expire from `verdicts`: when the API cannot be
// reached, those browsers still get in (they will see "Cannot reach the server" anyway, not data).
const knownGood = new Set<string>();

// Does this cookie open the team's pages? "open" = no key exists, everyone may enter.
export async function checkAccess(token: string | undefined): Promise<Verdict> {
  const cacheKey = token ?? "";
  const now = Date.now();
  const cached = verdicts.get(cacheKey);
  if (cached && cached.until > now) return cached.verdict;

  const data = await gql<{ accessCheck: { gated: boolean; valid: boolean } }>(
    `query AccessCheck($token: String) { accessCheck(token: $token) { gated valid } }`,
    { token: token ?? null },
  );
  if (!data) return token && knownGood.has(token) ? "ok" : "no";

  const verdict: Verdict = !data.accessCheck.gated ? "open" : data.accessCheck.valid ? "ok" : "no";
  if (verdict === "ok" && token) knownGood.add(token);
  if (verdicts.size > 1000) verdicts.clear();
  verdicts.set(cacheKey, { verdict, until: now + CACHE_MS });
  return verdict;
}

// The cookie's value for the entry key, or null for a wrong one (or an API that cannot be reached).
export async function enterWithKey(key: string): Promise<string | null> {
  const data = await gql<{ enterWithKey: string | null }>(`mutation Enter($key: String!) { enterWithKey(key: $key) }`, { key });
  return data?.enterWithKey ?? null;
}

// The cookie's value for a usable invite link, or null.
export async function enterWithInvitation(inviteToken: string): Promise<string | null> {
  const data = await gql<{ enterWithInvitation: string | null }>(
    `mutation EnterInvite($token: String!) { enterWithInvitation(token: $token) }`,
    { token: inviteToken },
  );
  return data?.enterWithInvitation ?? null;
}

export function grantAccess(request: NextRequest, response: NextResponse, token: string) {
  knownGood.add(token);
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: ONE_YEAR_S,
  });
  return response;
}
