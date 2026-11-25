import { ApolloLink } from "@apollo/client";
import { useSyncExternalStore } from "react";
import { Observable } from "rxjs";
import { seasonHeaders } from "./season";

// The judging desk and the registration form open without a connection. The service worker keeps
// the pages (public/sw.js); this keeps the last answer to each query those two pages need, and
// gives it back when the network does not answer. Everything else always goes to the server.
// - Only these queries, never a mutation: a mark is kept by the sheet outbox, a registration by
//   the registration outbox, and both are checked by the server when they arrive.
// - Only the current year: a past year is looked at online.
// - At most a day old: a copy from an earlier competition day is never shown as today's stage.
// - Forgotten on login and logout (the client's clearStore), so the next person never sees them.
// While a saved answer is shown, `useOffline()` gives the time it was saved: the pages say so.

const KEPT = new Set([
  "Me",
  "Stage",
  "ScoringRules",
  "StageQueue",
  "Envelopes",
  "EnvelopeSlots",
  "ParticipantCounts",
  "JudgingParticipant",
  "RegistrationLinkStatus",
  "Branding",
]);
const PREFIX = "musabaqa_offline:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// One copy per participant opened on the desk: only the most recent ones are kept.
const MAX_PER_QUERY = 10;

interface Saved {
  at: number;
  result: { data: unknown };
}

const keyOf = (name: string, variables: Record<string, unknown>) => `${PREFIX}${name}:${JSON.stringify(variables)}`;

function read(key: string): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Saved | null;
    if (!saved || Date.now() - saved.at > MAX_AGE_MS) return null;
    return saved;
  } catch {
    return null;
  }
}

function write(name: string, key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), result: { data } } satisfies Saved));
    // The oldest copies of this query go first.
    const same: { key: string; at: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${PREFIX}${name}:`)) same.push({ key: k, at: read(k)?.at ?? 0 });
    }
    same
      .sort((a, b) => b.at - a.at)
      .slice(MAX_PER_QUERY)
      .forEach((s) => localStorage.removeItem(s.key));
  } catch {
    // Storage full or blocked (private mode): the page simply needs the network.
  }
}

export function clearOfflineCopies() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Nothing to clear.
  }
  setShownSince(null);
}

// The time of the saved answers on screen, or null while the server answers.
let shownSince: number | null = null;
const listeners = new Set<() => void>();
function setShownSince(at: number | null) {
  if (at !== null && shownSince !== null) at = Math.min(at, shownSince); // the oldest one shown
  if (at === shownSince) return;
  shownSince = at;
  listeners.forEach((l) => l());
}

export function useOffline(): number | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => shownSince,
    () => null,
  );
}

export const offlineLink = new ApolloLink((operation, forward) => {
  const name = operation.operationName;
  const kept = typeof window !== "undefined" && !!name && KEPT.has(name) && !seasonHeaders()["x-season"];
  const key = kept ? keyOf(name!, operation.variables) : "";
  const saved = () => (kept ? read(key) : null);

  // The phone knows it has no network: no need to wait for the request to fail.
  if (kept && typeof navigator !== "undefined" && !navigator.onLine) {
    const s = saved();
    if (s) {
      setShownSince(s.at);
      return new Observable((observer) => {
        observer.next(s.result as never);
        observer.complete();
      });
    }
  }

  return new Observable((observer) => {
    const sub = forward(operation).subscribe({
      next: (result) => {
        // The server answered: whatever is on screen is live again.
        setShownSince(null);
        if (kept && result.data && !result.errors?.length) write(name!, key, result.data);
        observer.next(result);
      },
      // No answer (no network, timeout, server asleep): the saved answer, if there is one.
      error: (err) => {
        const s = saved();
        if (!s) {
          observer.error(err);
          return;
        }
        setShownSince(s.at);
        observer.next(s.result as never);
        observer.complete();
      },
      complete: () => observer.complete(),
    });
    return () => sub.unsubscribe();
  });
});
