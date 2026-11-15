// The app's service worker. It does not cache pages or data: the app always talks to the server
// (judging must never run on stale data), and the sheets and registrations already have their own
// offline queues in the page. It exists so older browsers count the app as installable, and so a
// tap on the home screen icon without any network shows a short message instead of a browser error.
// Only navigations (and the one icon on that message) are handled; API calls (another origin) and
// everything else go straight through. Bump VERSION when this file changes, so old caches are dropped.

const VERSION = "v1";
const CACHE = `musabaqa-${VERSION}`;
// The only thing kept on the device: the logo shown on the "no connection" page.
const OFFLINE_ICON = "/icons/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_ICON)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => offlinePage()));
    return;
  }
  if (new URL(request.url).pathname === OFFLINE_ICON) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
  }
});

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
