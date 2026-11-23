import { useSyncExternalStore } from "react";

// The competition year this tab looks at. Null = the current year (the normal case). A past year
// is chosen by the admin or staff from the top bar or Settings: every request then carries
// X-Season and the API answers for that year, read-only. Kept per tab (sessionStorage), so another
// window stays on the current year; forgotten on logout.
const KEY = "musabaqa_season";
const listeners = new Set<() => void>();

function read(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(KEY);
    return value && /^\d{4}$/.test(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

export function getViewedSeason(): number | null {
  return read();
}

export function setViewedSeason(year: number | null) {
  try {
    if (year === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, String(year));
  } catch {
    // Private mode or blocked storage: the current year stays.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useViewedSeason(): number | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

// Pages anyone can open (registration, public results, the stage screen, the blank form, login…)
// are always about the current year, even in a tab where the admin opened a past one: a stage
// screen projected from that tab must never show last year.
const PUBLIC_PAGES = /^\/(register|check-registration|results|stage-screen|forms\/blank|login|signup|invite|go|enter)(\/|$)/;
function onPublicPage() {
  return typeof window !== "undefined" && PUBLIC_PAGES.test(window.location.pathname);
}

// The header for the API (and the PDF download): nothing for the current year or a public page.
export function seasonHeaders(): Record<string, string> {
  if (onPublicPage()) return {};
  const year = read();
  return year === null ? {} : { "x-season": String(year) };
}
