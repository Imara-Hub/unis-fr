import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { API_URL } from "./api";

const REQUEST_TIMEOUT_MS = 15_000;

// A signal that aborts after `ms`, or when `outer` aborts. Older tablets (Safari < 17.4, old
// Android WebViews) lack AbortSignal.any / AbortSignal.timeout, so this is done by hand.
function withTimeout(outer: AbortSignal | null | undefined, ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), ms);
  const clear = () => clearTimeout(timer);
  controller.signal.addEventListener("abort", clear, { once: true });
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener("abort", () => controller.abort(outer.reason), { once: true });
  }
  return controller.signal;
}

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: API_URL,
      // Send the httpOnly session cookie with every request (API is on another port/origin).
      credentials: "include",
      // The API rejects mutations without this header (CSRF protection).
      headers: { "x-csrf": "1" },
      // Give up after 15 s instead of waiting forever, so the page can show "Try again".
      fetch: (input, init) => fetch(input, { ...init, signal: withTimeout(init?.signal, REQUEST_TIMEOUT_MS) }),
    }),
    cache: new InMemoryCache({
      typePolicies: {
        // Types without an `id`: tell the cache how to recognise them.
        RegistrationTerms: { keyFields: [] }, // only one set of terms
        RegistrationLink: { keyFields: [] }, // only one link exists
        Settings: { keyFields: [] }, // only one settings document
      },
    }),
  });
}
