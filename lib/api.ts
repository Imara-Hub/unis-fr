// The GraphQL endpoint, and the API server's origin for photos and the PDF.
//
// When the page is opened through the computer's network address (a phone on the same
// Wi-Fi, e.g. http://172.20.10.3:3001), a "localhost" API address would point at the phone
// itself. So in that case the API is reached on the same host as the page, same port.
// A real domain in NEXT_PUBLIC_API_URL (online) is used as it is.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function resolveApiUrl() {
  const url = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5500/graphql");
  if (typeof window !== "undefined" && LOCAL_HOSTS.has(url.hostname) && !LOCAL_HOSTS.has(window.location.hostname)) {
    url.hostname = window.location.hostname;
  }
  return url.toString();
}

export const API_URL = resolveApiUrl();
export const API_ORIGIN = new URL(API_URL).origin;

// "/photos/x.jpg" → "http://localhost:5500/photos/x.jpg".
// Resolved on each call: on the server it is the configured address, in the browser the one the
// page is reached on. Use it in effects or client-only components, not in server-rendered markup,
// otherwise the two can differ (hydration warning).
export const apiUrl = (path: string) => `${new URL(resolveApiUrl()).origin}${path}`;
