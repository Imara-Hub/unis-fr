import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { API_URL } from "./api";

const REQUEST_TIMEOUT_MS = 15_000;

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: API_URL,
      // Send the httpOnly session cookie with every request (API is on another port/origin).
      credentials: "include",
      // The API rejects mutations without this header (CSRF protection).
      headers: { "x-csrf": "1" },
      // Give up after 15 s instead of waiting forever, so the page can show "Try again".
      fetch: (input, init) => {
        const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        return fetch(input, { ...init, signal });
      },
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
