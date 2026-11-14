// A question is where the recitation starts: one ayah, written "surah:ayah" (e.g. "2:255").
// The participant recites the whole mushaf page that holds it (Madani mushaf, 604 pages).
// Each question comes from its own third of the Quran:
//   question 1 → juz 1–10, question 2 → juz 11–20, question 3 → juz 21–30.
// The same file is in unis-be/src/lib/quran.ts: keep both identical (only the import differs).
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
const indexOf = ({ surah, ayah }: AyahRef) => SURAH_OFFSETS[surah - 1]! + ayah - 1;

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
