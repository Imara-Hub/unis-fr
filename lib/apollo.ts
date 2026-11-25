import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import { API_URL } from "./api";
import { clearOfflineCopies, offlineLink } from "./offlineCopies";
import { seasonHeaders } from "./season";
import { getSessionToken } from "./sessionToken";

// Long enough for a list on a 2G (EDGE) connection, where a few dozen KB take several seconds; a
// request that hangs still ends with "Try again" instead of a spinner for ever.
const REQUEST_TIMEOUT_MS = 45_000;

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
  // Per-tab token first; the cookie (credentials: include) is the fallback for photos/PDF.
  // Also the competition year this tab looks at (X-Season), when it is a past one.
  const authLink = new ApolloLink((operation, forward) => {
    const token = getSessionToken();
    const season = seasonHeaders();
    if (token || season["x-season"]) {
      operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
        headers: { ...headers, ...season, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      }));
    }
    return forward(operation);
  });

  const httpLink = new HttpLink({
    uri: API_URL,
    // Send the httpOnly session cookie with every request (API is on another port/origin).
    credentials: "include",
    // The API rejects mutations without this header (CSRF protection).
    headers: { "x-csrf": "1" },
    // Give up after a while instead of waiting forever, so the page can show "Try again".
    fetch: (input, init) => fetch(input, { ...init, signal: withTimeout(init?.signal, REQUEST_TIMEOUT_MS) }),
  });

  const client = new ApolloClient({
    // First the saved answers for the judging desk and the registration form (lib/offlineCopies.ts).
    link: ApolloLink.from([offlineLink, authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        // Types without an `id`: tell the cache how to recognise them.
        RegistrationTerms: { keyFields: [] }, // only one set of terms
        RegistrationLink: { keyFields: [] }, // only one link exists
        Settings: { keyFields: [] }, // only one settings document
        Season: { keyFields: ["year"] }, // one per competition year
        Branding: { keyFields: ["year"] }, // a year's edition line and banner
      },
    }),
  });
  // Login and logout clear the store: the saved answers of whoever used this device go with it.
  client.onClearStore(async () => clearOfflineCopies());
  return client;
}
