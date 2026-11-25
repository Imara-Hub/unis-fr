// What a question's passage shows of the printed mushaf: only the ayahs from its start to its end,
// line by line as printed, plus a surah's title and basmala when that surah begins inside it.
// No React here, so it can be checked against every page (see MushafPage for the drawing).
import { indexOf, pageOf, type AyahRef } from ".";

// [surah, ayah, glyph, 1 when the glyph is the ayah's end number]
export type Word = [number, number, string, number];
/** One page of public/mushaf/pages/{n}.json. */
export interface PageData {
  page: number;
  lines: [number, Word[]][];
}

// What a page shows on its lines: words, or a surah title / the basmala in the gaps.
type PageRow = { kind: "words"; line: number; words: Word[] } | { kind: "title"; surah: number } | { kind: "basmala"; surah: number };
/** A row of the passage: words of one printed line, a title, the basmala, or where a page turns. */
export type PassageRow =
  | { kind: "words"; page: number; line: number; words: Word[]; trimmed: boolean }
  | { kind: "title"; surah: number }
  | { kind: "basmala" }
  | { kind: "turn"; page: number };

const LINES = 15;

/** The pages a passage is on, first to last. */
export function pagesOf(start: AyahRef, end?: AyahRef): number[] {
  const first = pageOf(start);
  const last = end && indexOf(end) > indexOf(start) ? pageOf(end) : first;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

// The lines with no words are a surah's title, and its basmala (except At-Tawba, and Al-Fatiha
// whose basmala is its first ayah). A title at the bottom of a page has its basmala on the next.
function rowsOf(data: PageData): PageRow[] {
  const rows: PageRow[] = [];
  const byLine = new Map(data.lines);
  const last = data.page <= 2 ? Math.max(...data.lines.map(([n]) => n)) : LINES;
  let gap = 0;
  const fill = (count: number, surah: number, atTop: boolean) => {
    const basmala = surah !== 1 && surah !== 9;
    if (count >= 2) rows.push({ kind: "title", surah }, ...(basmala ? [{ kind: "basmala", surah } as PageRow] : []));
    else if (count === 1) rows.push(atTop && basmala ? { kind: "basmala", surah } : { kind: "title", surah });
  };
  for (let line = 1; line <= last; line++) {
    const words = byLine.get(line);
    if (!words) {
      gap++;
      continue;
    }
    if (gap) fill(gap, words[0]![0], rows.length === 0 && line === gap + 1 && data.page > 2);
    gap = 0;
    rows.push({ kind: "words", line, words });
  }
  if (gap) {
    const lastWords = data.lines[data.lines.length - 1]![1];
    fill(gap, lastWords[lastWords.length - 1]![0] + 1, false);
  }
  return rows;
}

/**
 * The rows of the passage from `start` to `end` (inclusive; no end: the start ayah alone), from
 * the data of its pages (`pagesOf`, in order): the words of those ayahs only, a surah's title and
 * basmala when that surah begins inside the passage (or the passage begins it), and a `turn`
 * where the next page begins.
 */
export function passageRows(pages: PageData[], start: AyahRef, end?: AyahRef): PassageRow[] {
  const from = indexOf(start);
  const to = end ? Math.max(from, indexOf(end)) : from;
  const rows: PassageRow[] = [];
  const begins = (surah: number) => {
    const at = indexOf({ surah, ayah: 1 });
    return at >= from && at <= to;
  };
  for (const data of pages) {
    const ofPage: PassageRow[] = [];
    for (const row of rowsOf(data)) {
      if (row.kind === "words") {
        const words = row.words.filter(([surah, ayah]) => {
          const at = indexOf({ surah, ayah });
          return at >= from && at <= to;
        });
        if (words.length) ofPage.push({ kind: "words", page: data.page, line: row.line, words, trimmed: words.length < row.words.length });
      } else if (begins(row.surah)) {
        ofPage.push(row.kind === "title" ? { kind: "title", surah: row.surah } : { kind: "basmala" });
      }
    }
    if (ofPage.length && rows.length > 0) rows.push({ kind: "turn", page: data.page });
    rows.push(...ofPage);
  }
  // A passage starting a surah whose title is printed at the bottom of the page before (not
  // loaded): the title still opens the passage.
  if (start.ayah === 1 && !rows.some((r) => r.kind === "title" && r.surah === start.surah)) {
    rows.unshift({ kind: "title", surah: start.surah });
  }
  return rows;
}
