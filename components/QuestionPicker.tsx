"use client";

import { Box, Button, Flex, IconButton, Stack, Text } from "@chakra-ui/react";
import { BookOpen, Dices } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { RichSelect, type RichOption } from "@/components/RichSelect";
import { useI18n } from "@/lib/i18n";
import { ayahRangeInJuz, juzBounds, juzOf, parseRef, QUESTION_JUZ, randomRef, refText, surahArabicName, surahsInJuz, type AyahRef } from "@/lib/quran";
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

// One question, as on the organisers' sheet: a juz of this question's ten (question 1: juz 1–10,
// question 2: juz 11–20, question 3: juz 21–30), then a surah of that juz, then an ayah of it.
export function QuestionPicker({
  index,
  value,
  error,
  previewing,
  onChange,
  onPreview,
  portalContainer,
}: {
  index: number;
  value: string;
  error?: string;
  previewing: boolean;
  onChange: (value: string) => void;
  onPreview: () => void;
  /** Inside a dialog: its content, so the dropdown lists open in the dialog. */
  portalContainer?: RefObject<HTMLElement | null>;
}) {
  const { tx } = useI18n();
  const [from, to] = QUESTION_JUZ[index]!;
  const ref = parseRef(value);
  const info = questionInfo(value);
  const juz = ref ? juzOf(ref) : null;
  const range = ref && juz ? ayahRangeInJuz(ref.surah, juz) : null;
  const where = (r: AyahRef) => `${surahLabel(r.surah)} ${r.ayah}`;

  const juzOptions: RichOption[] = Array.from({ length: to - from + 1 }, (_, k) => from + k).map((j) => {
    const b = juzBounds(j);
    return {
      value: String(j),
      label: tx("Juz {n}", { n: j }),
      badge: j,
      title: tx("Juz {n}", { n: j }),
      detail: `${where(b.first)} \u2192 ${where(b.last)}`,
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
          detail: tx("Ayah {first} \u2192 {last} in this juz", { first: r[0], last: r[1] }),
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

  // A new juz starts on its first ayah; a new surah on its first ayah inside the juz.
  function chooseJuz(next: number) {
    onChange(refText(juzBounds(next).first));
  }
  function chooseSurah(surah: number) {
    if (!juz) return;
    const r = ayahRangeInJuz(surah, juz);
    if (r) onChange(refText({ surah, ayah: r[0] }));
  }

  return (
    <Stack gap="3" rounded="xl" borderWidth="1px" borderColor={error ? "red.300" : "gold.200"} bg="gold.50" p="4">
      <Flex justify="space-between" align="center" gap="2">
        <Box>
          <Text fontWeight="semibold" color="brand.900">
            {tx("Question {n}", { n: index + 1 })}
          </Text>
          <Text fontSize="xs" color="gold.800">
            {tx("Juz {from}–{to}", { from, to })}
          </Text>
        </Box>
        <IconButton
          aria-label={tx("Pick at random")}
          title={tx("Pick at random")}
          size="sm"
          variant="outline"
          colorPalette="brand"
          bg="white"
          onClick={() => onChange(refText(randomRef(index)))}
        >
          <Dices size={16} />
        </IconButton>
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
          onChange={(v) => ref && onChange(refText({ surah: ref.surah, ayah: Number(v) }))}
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

      {info ? (
        <Flex justify="space-between" align="center" gap="2" wrap="wrap">
          <Text fontSize="sm" color="brand.800">
            {tx("Page {n}", { n: info.page })} · {tx("Juz {n}", { n: info.juz })}
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
