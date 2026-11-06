import type { Marks, ScoringRules } from "@/lib/graphql/judging";
import type { AppKey } from "@/lib/i18n";

export type MarkKind = keyof Marks;

export interface MarkType {
  kind: MarkKind;
  // The sign on the paper sheet.
  sign: string;
  // The Arabic / Swahili term the judges use, the same in every language.
  name: string;
  // Chakra colour palette: the same colour on the judges' sheet, the live view and the rules.
  palette: "red" | "orange" | "blue" | "purple";
  // Short, on the judge's button.
  hint: AppKey;
  // A full sentence, in the rules.
  rule: AppKey;
  penalty: (r: ScoringRules) => number;
}

// The marks of the paper sheet, in the order the judges use them: Fath first.
export const MARK_TYPES: MarkType[] = [
  {
    kind: "fath",
    sign: "●",
    name: "Fath",
    palette: "red",
    hint: "Judge reminded the participant",
    rule: "The judge reminds the participant",
    penalty: (r) => r.fathPenalty,
  },
  {
    kind: "tanbih",
    sign: "I",
    name: "Tanbih",
    palette: "orange",
    hint: "Judge tapped the table",
    rule: "The judge taps the table (warning)",
    penalty: (r) => r.tanbihPenalty,
  },
  {
    kind: "tajweed",
    sign: "X",
    name: "Tajweed",
    palette: "blue",
    hint: "Tajweed, waqf or ibtida mistake",
    rule: "Mistake in tajweed, waqf or ibtida",
    penalty: (r) => r.tajweedPenalty,
  },
  {
    kind: "kusita",
    sign: "S",
    name: "Kusita",
    palette: "purple",
    hint: "The participant hesitated",
    rule: "The participant hesitates (kusita)",
    penalty: (r) => r.kusitaPenalty,
  },
];

export const EMPTY_MARKS: Marks = { fath: 0, tanbih: 0, tajweed: 0, kusita: 0 };

// Only the four counts (a question from the server also carries its score).
export const marksOnly = (q: Partial<Marks>): Marks => ({
  fath: q.fath ?? 0,
  tanbih: q.tanbih ?? 0,
  tajweed: q.tajweed ?? 0,
  kusita: q.kusita ?? 0,
});

export const hasMarks = (m: Marks) => MARK_TYPES.some((t) => m[t.kind] > 0);
