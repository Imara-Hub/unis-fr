"use client";

import { CombinedGraphQLErrors, gql, type TypedDocumentNode } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { API_URL } from "./api";

const SUBSCRIPTION = "subscription { participantsChanged { kind participantId } }";

const CREATE_LIVE_TICKET: TypedDocumentNode<{ createLiveTicket: string }, Record<string, never>> = gql`
  mutation CreateLiveTicket {
    createLiveTicket
  }
`;

// A stream that stayed open this long was healthy: the next retry starts from the short wait.
const HEALTHY_MS = 30_000;

// While the stream is down, the data is reloaded this often instead (a new registration still
// shows up on its own, just a little later).
const POLL_MS = 15_000;
// Reopening a stream the browser gave up on: a short wait first, then longer, never more than this.
const RETRY_MIN_MS = 3_000;
const RETRY_MAX_MS = 60_000;

// Listens to the API's live updates (Server-Sent Events) and reloads every query on
// screen when a participant registers, gets points, is deleted, or the pass mark changes.
// Returns whether the live connection is up.
export function useLiveUpdates() {
  const client = useApolloClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retryDelay = RETRY_MIN_MS;
    let opened = false;
    let openedAt = 0; // when the current stream opened (0: not open)
    let opening = false; // a ticket is on its way
    let cancelled = false; // the component is gone
    let stopped = false; // this tab is logged out: do not come back

    // Many changes in a row → one reload, at most 300 ms after the first. Not pushed back by each
    // new change: with 4 judges marking at once the changes never stop, and the screen would wait.
    // On a slow connection (2G) a reload takes seconds: never two at once (a change meanwhile is
    // reloaded once the first is done), and the next one waits as long as the last one took, so
    // the line stays free for the judges' own saves.
    let reloading = false;
    let again = false; // a change came in during the reload
    let lastTook = 0;
    const refresh = () => {
      if (reloading) {
        again = true;
        return;
      }
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        reloading = true;
        const started = Date.now();
        void client
          .refetchQueries({ include: "active" })
          .catch(() => undefined)
          .finally(() => {
            reloading = false;
            lastTook = Date.now() - started;
            if (again && !cancelled) {
              again = false;
              refresh();
            }
          });
      }, Math.max(300, Math.min(lastTook, 10_000)));
    };

    // No stream: reload on a timer so nobody has to pull to refresh. Stops once the stream is back.
    const startPolling = () => {
      if (poll !== undefined || stopped) return;
      poll = setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, POLL_MS);
    };
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };

    // This tab is logged out (or deactivated, or removed): stop for good and reload once. The login
    // check (ME) then finds nobody logged in and the layout goes to the login page.
    const loggedOut = () => {
      stopped = true;
      stopPolling();
      setConnected(false);
      void client.refetchQueries({ include: "active" });
    };

    // Reopen later, waiting a little longer each time. A stream that had stayed up a while was
    // healthy: start again from the short wait.
    const scheduleRetry = () => {
      if (retry !== undefined || stopped) return;
      if (openedAt && Date.now() - openedAt > HEALTHY_MS) retryDelay = RETRY_MIN_MS;
      openedAt = 0;
      retry = setTimeout(() => {
        retry = undefined;
        void open();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    };

    const open = async () => {
      if (source || opening || stopped || cancelled || document.visibilityState !== "visible") return;
      clearTimeout(retry);
      retry = undefined;

      // EventSource cannot send the Authorization header, and the login token must never go in a
      // URL (servers and proxies log URLs). So this tab first trades its own login (header, or the
      // cookie when it has none) for a 2-minute ticket that only opens this stream. Each window
      // asks with its own token, so each stream runs as that window's account.
      let ticket: string;
      opening = true;
      try {
        const { data } = await client.mutate({ mutation: CREATE_LIVE_TICKET, fetchPolicy: "no-cache" });
        if (!data?.createLiveTicket) throw new Error("No ticket");
        ticket = data.createLiveTicket;
      } catch (err) {
        if (cancelled) return;
        if (CombinedGraphQLErrors.is(err) && err.errors.some((e) => e.extensions?.code === "UNAUTHENTICATED")) {
          loggedOut();
        } else {
          // API asleep or restarting, network down: keep the data fresh by polling and try again.
          setConnected(false);
          startPolling();
          scheduleRetry();
        }
        return;
      } finally {
        opening = false;
      }
      // Things may have changed while the ticket was on its way.
      if (source || stopped || cancelled || document.visibilityState !== "visible") return;

      const url = new URL(API_URL);
      url.searchParams.set("query", SUBSCRIPTION);
      url.searchParams.set("ticket", ticket);
      const es = new EventSource(url, { withCredentials: true });
      source = es;
      es.onopen = () => {
        setConnected(true);
        stopPolling();
        openedAt = Date.now();
        // After a reconnect (server restart, network drop, tab shown again) we may have missed changes.
        if (opened) refresh();
        opened = true;
      };
      es.onerror = () => {
        setConnected(false);
        startPolling();
        // After a non-200 answer (the API restarting or asleep, a proxy hiccup) the browser gives
        // up for good. A plain drop it would retry by itself, but with the same (by then maybe
        // expired) ticket: close it in both cases and reopen with a fresh ticket.
        es.close();
        if (source === es) source = null;
        scheduleRetry();
      };
      es.addEventListener("next", refresh);
      es.addEventListener("message", refresh);
      // The server ended the stream: this tab was logged out (or deactivated, or removed), or its
      // ticket ran out on a reconnect. Asking for a new ticket tells the two apart: it fails only
      // when the tab is really logged out. Another window logging out never ends this one.
      es.addEventListener("complete", () => {
        es.close();
        if (source === es) source = null;
        setConnected(false);
        startPolling();
        refresh();
        scheduleRetry();
      });
    };

    const close = () => {
      source?.close();
      source = null;
      clearTimeout(retry);
      retry = undefined;
      stopPolling();
      setConnected(false);
    };

    // The browser allows only 6 open connections to the API at a time, and this stream
    // keeps one open for good. Tabs in the background give theirs up, so the tab you are
    // looking at (or reloading) never waits for a free connection.
    const onVisibility = () => (document.visibilityState === "visible" ? void open() : close());
    // The network came back: do not wait for the next retry.
    const onOnline = () => {
      retryDelay = RETRY_MIN_MS;
      if (!source) void open();
    };

    if (document.visibilityState === "visible") void open();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    // Leaving or reloading the page: free the connection at once.
    window.addEventListener("pagehide", close);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", close);
      close();
    };
  }, [client]);

  return connected;
}
