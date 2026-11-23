"use client";

import { useQuery } from "@apollo/client/react";
import { Box } from "@chakra-ui/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { apiUrl } from "@/lib/api";
import { BRANDING, type Branding } from "@/lib/graphql/seasons";

// Each competition year has its own look, set by the admin (Settings → Competition years): the
// edition line on the public pages and the banner of the printed forms. Nothing is shown before it
// is known (never last year's edition by mistake).

const NO_BRANDING: Branding = { year: 0, edition: null, hijriYear: null, gregorianYear: null, bannerUrl: null };

export function useBranding() {
  // Always asked again: the same tab may hold a past year's look (dashboard) and the current one
  // (public pages), and the answer depends on the page.
  const { data, error } = useQuery(BRANDING, { fetchPolicy: "network-only" });
  if (data) return data.branding;
  // Could not be loaded (network, server asleep): no edition line, the plain title as banner, so
  // printing is never blocked.
  return error ? NO_BRANDING : null;
}

// Printing waits for the banner: it now comes from the API, and a form printed before it arrives
// would have an empty space at the top. Ready once the picture has loaded (or failed to).
let bannerReady = false;
const readyListeners = new Set<() => void>();
function setBannerReady(ready: boolean) {
  if (bannerReady === ready) return;
  bannerReady = ready;
  readyListeners.forEach((l) => l());
}
function subscribeReady(l: () => void) {
  readyListeners.add(l);
  return () => {
    readyListeners.delete(l);
  };
}
export function useBannerReady() {
  return useSyncExternalStore(subscribeReady, () => bannerReady, () => false);
}

// "ÉDITION 8 · 1449 H – 2028 M": only the parts the admin set; null when none is.
export function editionLine(b: Pick<Branding, "edition" | "hijriYear" | "gregorianYear"> | null): string | null {
  if (!b) return null;
  const years = [b.hijriYear != null ? `${b.hijriYear} H` : null, b.gregorianYear != null ? `${b.gregorianYear} M` : null]
    .filter(Boolean)
    .join(" – ");
  const parts = [b.edition != null ? `ÉDITION ${b.edition}` : null, years || null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

// The banner at the top of the printed forms and the results sheet. Without one for the year: the
// competition's plain title (no edition on it).
export function YearBanner({ w }: { w: string }) {
  const branding = useBranding();
  const src = branding?.bannerUrl ? apiUrl(branding.bannerUrl) : "/title-navy.png";
  const imgRef = useRef<HTMLImageElement>(null);
  // A new picture: not ready until it loads, unless it is already there (from the browser cache,
  // complete before React sees its load event).
  useEffect(() => {
    const img = imgRef.current;
    setBannerReady(Boolean(img && img.complete && img.getAttribute("src") === src));
    return () => setBannerReady(false);
  }, [src, branding]);
  return (
    <Box w={w} minH={branding ? undefined : "20mm"}>
      {branding && (
        // A plain <img>: the banner comes from the API (a public, cached file), printed as is.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={() => setBannerReady(true)}
          onError={() => setBannerReady(true)}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      )}
    </Box>
  );
}
