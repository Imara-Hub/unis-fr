import { juzOf, pageOf, parseRef, surahArabicName, type AyahRef } from ".";
import { surahLabel } from "./names";

export interface QuestionInfo {
  ref: AyahRef;
  surah: string; // "Al-Baqarah" (the organisers' spelling, see ./names)
  arabic: string; // "البقرة"
  page: number;
  juz: number;
}

/** What a question ("2:255") points at. Null for an old free-text question. */
export function questionInfo(text: string): QuestionInfo | null {
  const ref = parseRef(text);
  if (!ref) return null;
  return { ref, surah: surahLabel(ref.surah), arabic: surahArabicName(ref.surah), page: pageOf(ref), juz: juzOf(ref) };
}

/** "2:255" → "Al-Baqarah 255". An old free-text question is shown as it was written. */
export function questionLabel(text: string): string {
  const info = questionInfo(text);
  return info ? `${info.surah} ${info.ref.ayah}` : text;
}
