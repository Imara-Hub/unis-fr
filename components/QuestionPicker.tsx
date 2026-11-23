"use client";

import { Box, Button, chakra, Flex, IconButton, Stack, Text } from "@chakra-ui/react";
import { BookOpen, Dices, Flag, Play, RotateCcw } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { RichSelect, type RichOption } from "@/components/RichSelect";
import { useI18n } from "@/lib/i18n";
import {
  ayahCount,
  ayahRangeInJuz,
  endChoices,
  juzBounds,
  juzOf,
  parseQuestion,
  QUESTION_JUZ,
  questionFrom,
  questionText,
  randomQuestion,
  surahArabicName,
  surahsInJuz,
  type AyahRef,
  type Round,
} from "@/lib/quran";
import { questionInfo } from "@/lib/quran/label";
import { surahLabel } from "@/lib/quran/names";

// A small label above each dropdown.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="1">
      <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.06em" textTransform="uppercase" color="gold.800">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

const same = (a: AyahRef, b: AyahRef) => a.surah === b.surah && a.ayah === b.ayah;

/** The same starts, each end put back where this round has it (one page, or half a page). */
export const questionsForRound = (questions: string[], round: Round) =>
  questions.map((text) => {
    const q = parseQuestion(text);
    return q ? questionText(questionFrom(q.start, round)) : text;
  });

// Tasfia (one page a question) or final (half a page): what the ends and the random picks follow.
export function RoundChoice({ value, onChange, id }: { value: Round; onChange: (round: Round) => void; id?: string }) {
  const { tx } = useI18n();
  const options: { round: Round; title: string; detail: string }[] = [
    { round: "TASFIA", title: tx("Tasfia"), detail: tx("One whole page from the start") },
    { round: "FINAL", title: tx("Final"), detail: tx("Half a page from the start") },
  ];
  return (
    <Flex id={id} role="radiogroup" aria-label={tx("Round")} gap="2" wrap="wrap">
      {options.map((o) => {
        const on = o.round === value;
        return (
          <chakra.button
            key={o.round}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.round)}
            textAlign="start"
            px="4"
            py="2.5"
            rounded="lg"
            borderWidth="2px"
            borderColor={on ? "brand.700" : "border"}
            bg={on ? "brand.50" : "bg"}
            cursor="pointer"
            _hover={{ borderColor: on ? "brand.700" : "gold.300" }}
            flex={{ base: "1", sm: "initial" }}
            minW="44"
          >
            <Text fontWeight="semibold" color="brand.900">
              {o.title}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {o.detail}
            </Text>
          </chakra.button>
        );
      })}
    </Flex>
  );
}

// One question, as on the organisers' sheet: where the participant starts (a juz of this
// question's ten: question 1 juz 1–10, question 2 juz 11–20, question 3 juz 21–30, then a surah
// of that juz, then an ayah of it) and where they finish. Choosing a start puts the end where the
// round has it: one page on in the tasfia, half a page in the final. The admin may then move it.
export function QuestionPicker({
  index,
  value,
  round,
  error,
  previewing,
  onChange,
  onPreview,
  portalContainer,
}: {
  index: number;
  /** "surah:ayah-surah:ayah", or "" while not chosen. */
  value: string;
  round: Round;
  error?: string;
  previewing: boolean;
  onChange: (value: string) => void;
  onPreview: () => void;
  /** Inside a dialog: its content, so the dropdown lists open in the dialog. */
  portalContainer?: RefObject<HTMLElement | null>;
}) {
  const { tx } = useI18n();
  const [from, to] = QUESTION_JUZ[index]!;
  const q = parseQuestion(value);
  const ref = q?.start ?? null;
  const end = q?.end ?? null;
  const info = questionInfo(value);
  const juz = ref ? juzOf(ref) : null;
  const range = ref && juz ? ayahRangeInJuz(ref.surah, juz) : null;
  const where = (r: AyahRef) => `${surahLabel(r.surah)} ${r.ayah}`;
  const usual = ref ? questionFrom(ref, round).end : null;
  const usualLabel = round === "FINAL" ? tx("Half a page") : tx("One page");

  // A new start: the end goes where the round has it.
  const setStart = (start: AyahRef) => onChange(questionText(questionFrom(start, round)));
  const setEnd = (next: AyahRef) => ref && onChange(questionText({ start: ref, end: next }));

  const juzOptions: RichOption[] = Array.from({ length: to - from + 1 }, (_, k) => from + k).map((j) => {
    const b = juzBounds(j);
    return {
      value: String(j),
      label: tx("Juz {n}", { n: j }),
      badge: j,
      title: tx("Juz {n}", { n: j }),
      detail: `${where(b.first)} → ${where(b.last)}`,
    };
  });
  const surahOptions: RichOption[] = juz
    ? surahsInJuz(juz).map((n) => {
        const r = ayahRangeInJuz(n, juz)!;
        return {
          value: String(n),
          label: surahLabel(n),
          badge: n,
          title: surahLabel(n),
          detail: tx("Ayah {first} → {last} in this juz", { first: r[0], last: r[1] }),
          arabic: surahArabicName(n),
        };
      })
    : [];
  const ayahOptions: RichOption[] = range
    ? Array.from({ length: range[1] - range[0] + 1 }, (_, k) => range[0] + k).map((a) => ({
        value: String(a),
        label: `${tx("Ayah")} ${a}`,
        title: `${tx("Ayah")} ${a}`,
        tag: a === range[0] ? tx("start") : a === range[1] ? tx("end") : undefined,
      }))
    : [];

  // Where it may finish: from the start on, up to a few pages after it.
  const limits = ref ? endChoices(ref) : null;
  const endAyahs = (surah: number): [number, number] | null => {
    if (!ref || !limits) return null;
    const first = surah === ref.surah ? ref.ayah : 1;
    const last = surah === limits.last.surah ? limits.last.ayah : ayahCount(surah);
    return first <= last ? [first, last] : null;
  };
  const endSurahOptions: RichOption[] =
    ref && limits
      ? Array.from({ length: limits.last.surah - ref.surah + 1 }, (_, k) => ref.surah + k)
          .filter((n) => endAyahs(n))
          .map((n) => {
            const [a, b] = endAyahs(n)!;
            return {
              value: String(n),
              label: surahLabel(n),
              badge: n,
              title: surahLabel(n),
              detail: tx("Ayah {first} → {last}", { first: a, last: b }),
              arabic: surahArabicName(n),
            };
          })
      : [];
  const endRange = end ? endAyahs(end.surah) : null;
  const endAyahOptions: RichOption[] = endRange
    ? Array.from({ length: endRange[1] - endRange[0] + 1 }, (_, k) => endRange[0] + k).map((a) => ({
        value: String(a),
        label: `${tx("Ayah")} ${a}`,
        title: `${tx("Ayah")} ${a}`,
        tag: usual && usual.surah === end!.surah && usual.ayah === a ? usualLabel : undefined,
      }))
    : [];

  // A new juz starts on its first ayah; a new surah on its first ayah inside the juz.
  function chooseJuz(next: number) {
    setStart(juzBounds(next).first);
  }
  function chooseSurah(surah: number) {
    if (!juz) return;
    const r = ayahRangeInJuz(surah, juz);
    if (r) setStart({ surah, ayah: r[0] });
  }
  // Another surah to finish in: its first ayah allowed.
  function chooseEndSurah(surah: number) {
    const r = endAyahs(surah);
    if (r) setEnd({ surah, ayah: r[0] });
  }

  return (
    <Stack gap="3" rounded="xl" borderWidth="1px" borderColor={error ? "red.300" : "gold.200"} bg="gold.50" p="4">
      <Flex justify="space-between" align="center" gap="2">
        <Box>
          <Text fontWeight="semibold" color="brand.900">
            {tx("Question {n}", { n: index + 1 })}
          </Text>
          <Text fontSize="xs" color="gold.800">
            {tx("Starts in juz {from}–{to}", { from, to })}
          </Text>
        </Box>
        <IconButton
          aria-label={tx("Pick at random")}
          title={tx("Pick at random")}
          size="sm"
          variant="outline"
          colorPalette="brand"
          bg="white"
          onClick={() => onChange(questionText(randomQuestion(index, round)))}
        >
          <Dices size={16} />
        </IconButton>
      </Flex>

      <Flex align="center" gap="1.5" color="brand.900" fontSize="sm" fontWeight="semibold">
        <Play size={14} aria-hidden />
        {tx("Starts at")}
      </Flex>
      <Field label={tx("Juz")}>
        <RichSelect
          ariaLabel={tx("Juz")}
          placeholder={tx("Choose a juz")}
          value={juz ? String(juz) : ""}
          onChange={(v) => chooseJuz(Number(v))}
          options={juzOptions}
          portalContainer={portalContainer}
        />
      </Field>

      <Field label={tx("Surah")}>
        <RichSelect
          ariaLabel={tx("Surah")}
          placeholder={juz ? tx("Choose a surah") : tx("Choose a juz first")}
          disabled={!juz}
          value={ref ? String(ref.surah) : ""}
          onChange={(v) => chooseSurah(Number(v))}
          options={surahOptions}
          portalContainer={portalContainer}
        />
      </Field>

      <Field label={tx("Ayah")}>
        <RichSelect
          ariaLabel={tx("Ayah")}
          placeholder={tx("Choose an ayah")}
          disabled={!ref}
          value={ref ? String(ref.ayah) : ""}
          onChange={(v) => ref && setStart({ surah: ref.surah, ayah: Number(v) })}
          options={ayahOptions}
          portalContainer={portalContainer}
        />
      </Field>
      {/* Where this surah starts and finishes inside the chosen juz. */}
      {ref && range && juz && (
        <Text fontSize="xs" color="brand.800" mt="-1.5">
          {tx("In juz {juz}, {surah} goes from ayah {first} to ayah {last}.", {
            juz,
            surah: surahLabel(ref.surah),
            first: range[0],
            last: range[1],
          })}
        </Text>
      )}

      <Box borderTopWidth="1px" borderColor="gold.200" />
      <Flex align="center" justify="space-between" gap="2" wrap="wrap">
        <Flex align="center" gap="1.5" color="brand.900" fontSize="sm" fontWeight="semibold">
          <Flag size={14} aria-hidden />
          {tx("Finishes at")}
        </Flex>
        {ref && end && usual && !same(end, usual) && (
          <Button size="xs" variant="ghost" colorPalette="brand" onClick={() => setStart(ref)} title={tx("Back to the usual end of this round")}>
            <RotateCcw size={13} aria-hidden />
            {usualLabel}
          </Button>
        )}
      </Flex>
      <Field label={tx("Surah")}>
        <RichSelect
          ariaLabel={tx("Surah where it finishes")}
          placeholder={tx("Choose the start first")}
          disabled={!ref}
          value={end ? String(end.surah) : ""}
          onChange={(v) => chooseEndSurah(Number(v))}
          options={endSurahOptions}
          portalContainer={portalContainer}
        />
      </Field>
      <Field label={tx("Ayah")}>
        <RichSelect
          ariaLabel={tx("Ayah where it finishes")}
          placeholder={tx("Choose an ayah")}
          disabled={!end}
          value={end ? String(end.ayah) : ""}
          onChange={(v) => end && setEnd({ surah: end.surah, ayah: Number(v) })}
          options={endAyahOptions}
          portalContainer={portalContainer}
        />
      </Field>

      {info ? (
        <Flex justify="space-between" align="center" gap="2" wrap="wrap">
          <Text fontSize="sm" color="brand.800">
            {info.endPage === info.page ? tx("Page {n}", { n: info.page }) : tx("Pages {a}–{b}", { a: info.page, b: info.endPage })} ·{" "}
            {tx("Juz {n}", { n: info.juz })}
          </Text>
          <Button size="xs" variant={previewing ? "solid" : "ghost"} colorPalette="brand" onClick={onPreview}>
            <BookOpen size={14} aria-hidden />
            {previewing ? tx("Hide page") : tx("See page")}
          </Button>
        </Flex>
      ) : (
        <Text fontSize="sm" color="fg.muted">
          {tx("Choose a juz, then a surah and an ayah")}
        </Text>
      )}
      {error && (
        <Text fontSize="sm" color="red.600">
          {error}
        </Text>
      )}
    </Stack>
  );
}
