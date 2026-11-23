// A question is where the recitation starts and where it finishes: two ayahs, written
// "surah:ayah-surah:ayah" (e.g. "2:255-2:260"), in the Madina mushaf (604 pages of 15 lines).
// In the tasfia a question is one page from its start, in the final half a page (ROUND_LINES);
// the admin may move the end. An older question holds only its start ("2:255"): one page.
// Each question starts in its own third of the Quran:
//   question 1 → juz 1–10, question 2 → juz 11–20, question 3 → juz 21–30.
// The same file is in unis-be/src/lib/quran.ts: keep both identical (only the imports differ).
import { AYAH_LINES } from "./lines";
import { JUZ_STARTS, PAGE_STARTS, SURAHS } from "./meta";

export { SURAHS };

export interface AyahRef {
  surah: number;
  ayah: number;
}

export const TOTAL_AYAHS = 6236;

/** The juz each question comes from, inclusive: index 0 = question 1. */
export const QUESTION_JUZ: readonly (readonly [number, number])[] = [
  [1, 10],
  [11, 20],
  [21, 30],
];

// Position of the first ayah of each surah in the whole Quran (0-based).
const SURAH_OFFSETS: number[] = [];
{
  let total = 0;
  for (const [ayahs] of SURAHS) {
    SURAH_OFFSETS.push(total);
    total += ayahs;
  }
}

export const ayahCount = (surah: number) => SURAHS[surah - 1]?.[0] ?? 0;
export const surahName = (surah: number) => SURAHS[surah - 1]?.[2] ?? "";
export const surahArabicName = (surah: number) => SURAHS[surah - 1]?.[1] ?? "";

export const isAyah = ({ surah, ayah }: AyahRef) =>
  Number.isInteger(surah) && Number.isInteger(ayah) && surah >= 1 && surah <= 114 && ayah >= 1 && ayah <= ayahCount(surah);

/** 0-based position in the whole Quran. */
export const indexOf = ({ surah, ayah }: AyahRef) => SURAH_OFFSETS[surah - 1]! + ayah - 1;

// The mushaf line each ayah starts on (see lines.ts): (page - 1) × 15 + line - 1.
const FIRST_LINE: number[] = [];
{
  let line = 0;
  for (let i = 0; i < AYAH_LINES.length; i += 2) {
    line += parseInt(AYAH_LINES[i]!, 36);
    FIRST_LINE.push(line);
  }
}

function fromIndex(index: number): AyahRef {
  let surah = 114;
  while (surah > 1 && SURAH_OFFSETS[surah - 1]! > index) surah--;
  return { surah, ayah: index - SURAH_OFFSETS[surah - 1]! + 1 };
}

// The last start (juz or page) at or before this ayah, 1-based.
function lastStartAtOrBefore(starts: readonly (readonly [number, number])[], ref: AyahRef): number {
  const i = indexOf(ref);
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const [surah, ayah] = starts[mid]!;
    if (indexOf({ surah, ayah }) <= i) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export const juzOf = (ref: AyahRef) => lastStartAtOrBefore(JUZ_STARTS, ref);
export const pageOf = (ref: AyahRef) => lastStartAtOrBefore(PAGE_STARTS, ref);
export const PAGES = PAGE_STARTS.length;

/** "2:255" → { surah: 2, ayah: 255 }. Anything else (an old free-text question) → null. */
export function parseRef(text: string): AyahRef | null {
  const m = /^\s*(\d{1,3})\s*:\s*(\d{1,3})\s*$/.exec(text);
  if (!m) return null;
  const ref = { surah: Number(m[1]), ayah: Number(m[2]) };
  return isAyah(ref) ? ref : null;
}

export const refText = ({ surah, ayah }: AyahRef) => `${surah}:${ayah}`;

/** Is this ayah in the juz allowed for question `question` (0-based)? */
export function inQuestionRange(ref: AyahRef, question: number): boolean {
  const range = QUESTION_JUZ[question];
  if (!range) return false;
  const juz = juzOf(ref);
  return juz >= range[0] && juz <= range[1];
}

/** The first and last ayah positions (0-based, inclusive) of a run of juz. */
function juzSpan([from, to]: readonly [number, number]): [number, number] {
  const [s, a] = JUZ_STARTS[from - 1]!;
  const first = indexOf({ surah: s, ayah: a });
  const next = JUZ_STARTS[to];
  const last = next ? indexOf({ surah: next[0], ayah: next[1] }) - 1 : TOTAL_AYAHS - 1;
  return [first, last];
}

/** Any ayah of any surah, at random, within the juz of question `question` (0-based). */
export function randomRef(question: number, random: () => number = Math.random): AyahRef {
  const [first, last] = juzSpan(QUESTION_JUZ[question]!);
  return fromIndex(first + Math.floor(random() * (last - first + 1)));
}

// The surahs with at least one ayah between two positions (0-based, inclusive).
function surahsInSpan([first, last]: [number, number]): number[] {
  const from = fromIndex(first).surah;
  const to = fromIndex(last).surah;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// The ayahs of a surah between two positions: [first, last] ayah numbers, or null if none.
function ayahRangeInSpan(surah: number, [first, last]: [number, number]): [number, number] | null {
  const start = SURAH_OFFSETS[surah - 1];
  if (start === undefined) return null;
  const end = start + ayahCount(surah) - 1;
  const lo = Math.max(first, start);
  const hi = Math.min(last, end);
  return lo > hi ? null : [lo - start + 1, hi - start + 1];
}

/** The surahs that have at least one ayah in the juz of question `question` (0-based). */
export const surahsForQuestion = (question: number) => surahsInSpan(juzSpan(QUESTION_JUZ[question]!));

/** The ayahs of a surah allowed for question `question` (0-based): [first, last], inclusive. */
export const ayahRangeForQuestion = (surah: number, question: number) =>
  ayahRangeInSpan(surah, juzSpan(QUESTION_JUZ[question]!));

/** Where a juz starts and ends, e.g. juz 3: Al-Baqara 253 → Aal-i-Imraan 92. */
export function juzBounds(juz: number): { first: AyahRef; last: AyahRef } {
  const [first, last] = juzSpan([juz, juz]);
  return { first: fromIndex(first), last: fromIndex(last) };
}

/** The surahs that have at least one ayah in this juz. */
export const surahsInJuz = (juz: number) => surahsInSpan(juzSpan([juz, juz]));

/** The ayahs of a surah inside this juz: [first, last], inclusive, or null if none. */
export const ayahRangeInJuz = (surah: number, juz: number) => ayahRangeInSpan(surah, juzSpan([juz, juz]));

// ---- Where a question starts and finishes ----

export type Round = "TASFIA" | "FINAL";
export const ROUNDS: readonly Round[] = ["TASFIA", "FINAL"];
/** Mushaf lines a question covers: one whole page in the tasfia, half a page in the final. */
export const ROUND_LINES: Record<Round, number> = { TASFIA: 15, FINAL: 8 };
/** The end may be moved by hand, but a question stays within this many pages after its start. */
export const MAX_QUESTION_PAGES = 5;

export interface Question {
  start: AyahRef;
  end: AyahRef;
}

/**
 * Where a recitation of `lines` mushaf lines from `start` finishes: the last ayah that begins on
 * or before the last of those lines (it is recited to its end). Never before `start`.
 */
export function spanEnd(start: AyahRef, lines: number): AyahRef {
  const i = indexOf(start);
  const target = FIRST_LINE[i]! + Math.max(1, lines) - 1;
  let j = i;
  while (j < TOTAL_AYAHS - 1 && FIRST_LINE[j + 1]! <= target) j++;
  return fromIndex(j);
}

/** The usual question of this round from `start`: one page (tasfia) or half a page (final). */
export const questionFrom = (start: AyahRef, round: Round): Question => ({ start, end: spanEnd(start, ROUND_LINES[round]) });

/** "2:255-2:260" → its start and end; an older "2:255" → one page from it. Anything else → null. */
export function parseQuestion(text: string): Question | null {
  const m = /^\s*(\d{1,3}\s*:\s*\d{1,3})\s*(?:-\s*(\d{1,3}\s*:\s*\d{1,3})\s*)?$/.exec(text);
  if (!m) return null;
  const start = parseRef(m[1]!);
  if (!start) return null;
  if (!m[2]) return questionFrom(start, "TASFIA");
  const end = parseRef(m[2]);
  return end && isQuestionSpan(start, end) ? { start, end } : null;
}

/** The end comes at or after the start, and at most MAX_QUESTION_PAGES pages after it. */
export const isQuestionSpan = (start: AyahRef, end: AyahRef) =>
  indexOf(end) >= indexOf(start) && pageOf(end) - pageOf(start) <= MAX_QUESTION_PAGES;

export const questionText = ({ start, end }: Question) => `${refText(start)}-${refText(end)}`;

/** A random question `question` (0-based) of this round: a random start in its juz, the usual end. */
export const randomQuestion = (question: number, round: Round, random: () => number = Math.random): Question =>
  questionFrom(randomRef(question, random), round);

/** The ayahs an end may be: from the start up to MAX_QUESTION_PAGES pages after it. */
export function endChoices(start: AyahRef): { first: AyahRef; last: AyahRef } {
  const lastPage = Math.min(PAGES, pageOf(start) + MAX_QUESTION_PAGES);
  const next = PAGE_STARTS[lastPage]; // the page after the last one allowed
  const last = next ? fromIndex(indexOf({ surah: next[0], ayah: next[1] }) - 1) : fromIndex(TOTAL_AYAHS - 1);
  return { first: start, last };
}
