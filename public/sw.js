// The app's service worker. Two pages open without a connection: the judging desk (/dashboard) and
// the registration form (/register/<token>). For those, the page is fetched from the server first
// and a copy kept; with no network (or no answer within a few seconds on a weak line) the copy is
// shown. Their data comes from the last answers kept by the page itself (lib/offlineCopies.ts),
// and what is typed offline waits in the sheet and registration outboxes until the network is back.
// The app's code (/_next/static, names change on each deploy), the Mushaf pages and fonts, and the
// pictures of the app are kept once loaded. Every other page always comes from the server, with a
// short "no connection" message when there is none. API calls (another origin) are never touched.
// Bump VERSION when this file changes, so old caches are dropped.

const VERSION = "v2";
const PAGES = `musabaqa-pages-${VERSION}`;
const STATIC = `musabaqa-static-${VERSION}`;
// The only thing kept on the device: the logo shown on the "no connection" page.
const OFFLINE_ICON = "/icons/icon-192.png";
// On a weak line the server may answer after half a minute: past this, the kept page is shown
// (and the copy is still refreshed in the background when the answer comes).
const PAGE_WAIT_MS = 6000;
// Code from older deploys piles up: past this many files, the oldest go.
const MAX_STATIC = 600;

const offlinePageFor = (url) => url.pathname === "/dashboard" || url.pathname.startsWith("/register/");
const keptFile = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/_next/image") ||
  url.pathname.startsWith("/mushaf/") ||
  url.pathname.startsWith("/icons/") ||
  /.(png|svg|ico|woff2)$/.test(url.pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.add(OFFLINE_ICON)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // the API: never touched

  if (request.mode === "navigate") {
    event.respondWith(offlinePageFor(url) ? keptPage(event, request) : fetch(request).catch(() => offlinePage()));
    return;
  }
  // Next's own page data (client-side navigation): always the server.
  if (request.headers.get("rsc") || url.searchParams.has("_rsc")) return;
  if (keptFile(url)) event.respondWith(keptFileFor(request));
});

// The server's page when it answers in time (and a copy kept), else the copy, else the message.
async function keptPage(event, request) {
  const cache = await caches.open(PAGES);
  const key = new URL(request.url);
  key.search = ""; // the same page whatever is after "?"
  const fresh = fetch(request).then(async (res) => {
    // Only the page itself: never a redirect (to the login page, the entry gate) kept as the desk.
    if (res.ok && res.type === "basic" && !res.redirected) await cache.put(key.href, res.clone());
    return res;
  });
  event.waitUntil(fresh.catch(() => undefined)); // the copy is refreshed even when it is shown first
  const kept = await cache.match(key.href);
  if (!kept) return fresh.catch(() => offlinePage());
  const late = new Promise((resolve) => setTimeout(() => resolve(kept), PAGE_WAIT_MS));
  // A redirect is followed as the server says; a server error (asleep, restarting) shows the copy.
  const answer = fresh.then(
    (res) => (res.ok || res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400) ? res : kept),
    () => kept,
  );
  return Promise.race([answer, late]);
}

// Files that never change under their name: from the device once loaded.
async function keptFileFor(request) {
  const cache = await caches.open(STATIC);
  const kept = await cache.match(request);
  if (kept) return kept;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    trim(cache);
  }
  return res;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await cache.delete(old);
}

function offlinePage() {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1A234E">
<title>Musabaqa</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; align-items: center; justify-content: center; text-align: center;
    background: linear-gradient(180deg, #1E2956 0%, #1A234E 55%, #151C42 100%); color: #fff;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 24px; }
  img { width: 96px; height: 96px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { margin: 0 0 20px; color: rgba(255,255,255,0.8); line-height: 1.45; }
  button { background: #C99A35; color: #1A234E; border: 0; border-radius: 10px; padding: 12px 22px;
    font-size: 16px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<main>
  <img src="${OFFLINE_ICON}" alt="">
  <h1>Pas de connexion · No connection · Hakuna mtandao</h1>
  <p>Musabaqa a besoin d’Internet pour s’ouvrir.<br>Musabaqa needs the Internet to open.<br>Musabaqa inahitaji Intaneti ili kufunguka.</p>
  <button type="button" onclick="location.reload()">Réessayer · Try again · Jaribu tena</button>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-sw-version": VERSION },
  });
}
