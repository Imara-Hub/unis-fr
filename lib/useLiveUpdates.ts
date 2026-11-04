"use client";

import { useApolloClient } from "@apollo/client/react";
import { useEffect, useState } from "react";
import { API_URL } from "./api";

const SUBSCRIPTION = "subscription { participantsChanged { kind participantId } }";

// Listens to the API's live updates (Server-Sent Events) and reloads every query on
// screen when a participant registers, gets points, is deleted, or the pass mark changes.
// Returns whether the live connection is up.
export function useLiveUpdates() {
  const client = useApolloClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let opened = false;

    // Many changes in a row (a judge typing fast) → one reload.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void client.refetchQueries({ include: "active" }), 300);
    };

    const open = () => {
      if (source) return;
      const url = new URL(API_URL);
      url.searchParams.set("query", SUBSCRIPTION);
      // withCredentials: send the login cookie to the API (another port/origin).
      const es = new EventSource(url, { withCredentials: true });
      source = es;
      es.onopen = () => {
        setConnected(true);
        // After a reconnect (server restart, network drop, tab shown again) we may have missed changes.
        if (opened) refresh();
        opened = true;
      };
      es.onerror = () => setConnected(false); // the browser reconnects by itself
      es.addEventListener("next", refresh);
      es.addEventListener("message", refresh);
      // The server ended the stream (e.g. logged out): stop instead of reconnecting forever.
      es.addEventListener("complete", () => {
        es.close();
        if (source === es) source = null;
        setConnected(false);
      });
    };

    const close = () => {
      source?.close();
      source = null;
      setConnected(false);
    };

    // The browser allows only 6 open connections to the API at a time, and this stream
    // keeps one open for good. Tabs in the background give theirs up, so the tab you are
    // looking at (or reloading) never waits for a free connection.
    const onVisibility = () => (document.visibilityState === "visible" ? open() : close());

    if (document.visibilityState === "visible") open();
    document.addEventListener("visibilitychange", onVisibility);
    // Leaving or reloading the page: free the connection at once.
    window.addEventListener("pagehide", close);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", close);
      close();
    };
  }, [client]);

  return connected;
}
