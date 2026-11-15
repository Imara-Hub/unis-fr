"use client";

import { useEffect } from "react";

// Registers public/sw.js once the page is loaded (so it never competes with the page's own
// requests). Production only: in development a service worker gets in the way of hot reload.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Not allowed (http on a LAN address, private mode…): the app works the same without it.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
