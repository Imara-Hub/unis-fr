import type { Marks, Round } from "@/lib/graphql/judging";

// A judge's sheet kept on the tablet (localStorage) until the server has it, so a lost connection,
// a reload or a closed tab never loses a mark. `submit`: the judge already pressed Submit and the
// sheet goes in as soon as the connection is back.
export interface StoredSheet {
  marks: Marks[];
  sauti: number | null;
  submit: boolean;
  at: number;
  // The server's updatedAt of the sheet these marks were made on (null: none on the server yet).
  // If the server copy changed since (fixed from another device), the server copy wins.
  // Missing in copies saved by older versions.
  base?: string | null;
  // The round it was marked in (missing: the tasfia, from before the final existed). Sent with it,
  // so a tasfia sheet still waiting here when the final starts is never taken as a final sheet.
  round?: Round;
}

const PREFIX = "musabaqa-sheet:";

export const sheetKey = (judgeId: string, participantId: string) => `${PREFIX}${judgeId}:${participantId}`;

function valid(value: unknown): value is StoredSheet {
  const s = value as StoredSheet;
  return (
    Boolean(s) &&
    Array.isArray(s.marks) &&
    s.marks.every((m) => m && ["fath", "tanbih", "tajweed", "kusita"].every((k) => Number.isInteger(m[k as keyof Marks]) && m[k as keyof Marks] >= 0)) &&
    (s.sauti === null || (Number.isInteger(s.sauti) && s.sauti >= 0 && s.sauti <= 5)) &&
    typeof s.submit === "boolean"
  );
}

export function readSheet(key: string): StoredSheet | null {
  try {
    const raw = localStorage.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return valid(value) ? value : null;
  } catch {
    return null; // private window, or a damaged value
  }
}

export function writeSheet(key: string, sheet: Omit<StoredSheet, "at">) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...sheet, at: Date.now() }));
  } catch {
    // Storage full or blocked: the marks still go to the server as usual.
  }
}

export function removeSheet(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing to do
  }
}

// This judge's sheets still waiting on the tablet.
export function waitingSheets(judgeId: string) {
  const mine = `${PREFIX}${judgeId}:`;
  const found: { key: string; participantId: string; sheet: StoredSheet }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(mine)) continue;
      const sheet = readSheet(key);
      if (sheet) found.push({ key, participantId: key.slice(mine.length), sheet });
    }
  } catch {
    // storage blocked
  }
  return found;
}

// Is this copy older than the sheet on the server (`server`: its updatedAt, null if none)? Yes when
// the server sheet changed since the copy was made (`base`) and after the copy's own last change:
// someone fixed it from another device or tab, and the newer server copy wins. A save from this
// tablet that went in although its answer was lost also moves the server on, but before the copy's
// last change: that copy (maybe a Submit pressed since) is kept. Copies from older versions have no
// base: kept.
export function outdated(sheet: StoredSheet, server: string | null) {
  if (sheet.base === undefined || server === null || server === sheet.base) return false;
  return Date.parse(server) > sheet.at;
}

// Answers that settle a waiting sheet for good: it is in (SHEET_LOCKED: already submitted), or it
// can never go in (participant deleted, panel complete, invalid marks). Anything else (login expired,
// too many requests, server error, no connection) leaves the sheet on the tablet to send again later.
const FINAL_ANSWERS = new Set(["SHEET_LOCKED", "NOT_FOUND", "NOT_DRAWN", "PANEL_COMPLETE", "VALIDATION_FAILED", "ROUND_CHANGED"]);
export const isFinalAnswer = (code: string | undefined) => Boolean(code && FINAL_ANSWERS.has(code));

// Sheets open on screen send themselves; the background sender leaves them alone.
export const openSheets = new Set<string>();
