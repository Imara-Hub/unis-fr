// The version of the app this server runs (next.config.mjs, APP_VERSION: fixed when the app is
// built). An open page compares it with its own and offers "Update" when a newer one is out
// (components/UpdateBanner.tsx). Never cached: it must always say what is live.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ version: process.env.APP_VERSION ?? null }, { headers: { "Cache-Control": "no-store" } });
}
