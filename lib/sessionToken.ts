import { setViewedSeason } from "./season";

// Per-tab login token (sessionStorage is not shared across windows of the same browser), in
// development only: several people can stay logged in side by side in one browser. In production
// the API never hands the token over (null): the login lives only in its httpOnly cookie.
const KEY = "musabaqa_session_token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function setSessionToken(token: string | null | undefined) {
  if (token) sessionStorage.setItem(KEY, token);
  else sessionStorage.removeItem(KEY); // cookie login: nothing kept here (and no older tab token)
}

export function clearSessionToken() {
  sessionStorage.removeItem(KEY);
  setViewedSeason(null); // the next person on this tab starts in the current year
  photoTicket = null;
}

// <img> cannot send the Authorization header, and the login token must never go in a URL
// (servers and proxies log URLs). So picture addresses carry this tab's photo ticket: it opens
// pictures only, belongs to this tab's session (each window sees its own account's pictures) and
// stays the same for hours (the browser's image cache keeps working). The layout keeps it up to
// date from the ME query; it lives in this tab's memory only.
let photoTicket: string | null = null;

export function getPhotoTicket(): string | null {
  return photoTicket;
}

export function setPhotoTicket(ticket: string | null) {
  photoTicket = ticket;
}
