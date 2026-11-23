import { juzOf, pageOf, parseQuestion, surahArabicName, type AyahRef } from ".";
import { surahLabel } from "./names";

export interface QuestionInfo {
  ref: AyahRef; // where the recitation starts
  end: AyahRef; // where it finishes
  surah: string; // "Al-Baqarah" (the organisers' spelling, see ./names)
  arabic: string; // "البقرة"
  page: number;
  endPage: number;
  juz: number;
}

/** What a question ("2:255-2:258", or an older "2:255") points at. Null for an old free-text question. */
export function questionInfo(text: string): QuestionInfo | null {
  const q = parseQuestion(text);
  if (!q) return null;
  const { start, end } = q;
  return {
    ref: start,
    end,
    surah: surahLabel(start.surah),
    arabic: surahArabicName(start.surah),
    page: pageOf(start),
    endPage: pageOf(end),
    juz: juzOf(start),
  };
}

/** "Al-Baqarah 255", or "Al-Baqarah 286" for an end in the same surah as `from`. */
export const ayahLabel = (r: AyahRef) => `${surahLabel(r.surah)} ${r.ayah}`;

/**
 * "2:255-2:258" → "Al-Baqarah 255 → 258"; across surahs "Al-Baqarah 286 → Aal-Imran 5".
 * An old free-text question is shown as it was written.
 */
export function questionLabel(text: string): string {
  const info = questionInfo(text);
  if (!info) return text;
  const { ref, end } = info;
  if (end.surah === ref.surah && end.ayah === ref.ayah) return ayahLabel(ref);
  return `${ayahLabel(ref)} → ${end.surah === ref.surah ? end.ayah : ayahLabel(end)}`;
}
