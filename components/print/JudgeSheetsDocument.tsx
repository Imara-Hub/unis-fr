"use client";

import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { INK, LetterheadPage, LetterheadTop, NAVY, scoreText, SignatureBlock, upper } from "@/components/print/Letterhead";
import type { Envelope, JudgeSheet, Round } from "@/lib/graphql/judging";
import type { ParticipantDetail } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";
import { MARK_TYPES } from "@/lib/marks";
import { questionLabel } from "@/lib/quran/label";

// One round of a participant's judging, on the letterhead (one A4 page): who they are, the envelope
// and its three questions, then each judge's sheet as on paper (every mark counted, each question's
// points, the sauti and the total), the score (the judges' average) and the chief judge's signature.

export interface RoundSheets {
  round: Round;
  envelope: Envelope | null;
  sheets: JudgeSheet[];
  score: number | null; // the round's score: the average once every judge submitted
}

export function JudgeSheetsDocument({
  participant: p,
  rounds,
  judgeCount,
  maxScore,
  place,
  signer,
  onPlace,
  onSigner,
}: {
  participant: ParticipantDetail;
  rounds: RoundSheets[];
  judgeCount: number;
  maxScore: number;
  place: string;
  signer: string[];
  onPlace?: (v: string) => void;
  onSigner?: (i: number, v: string) => void;
}) {
  const { tx } = useI18n();
  const year = new Date().getFullYear();
  return (
    <>
      {rounds.map((r, i) => {
        const submitted = r.sheets.filter((s) => s.submitted);
        const title = r.round === "FINAL" ? tx("JUDGES' SHEETS {year}: FINAL", { year }) : tx("JUDGES' SHEETS {year}: TASFIA", { year });
        return (
          <LetterheadPage key={r.round} number={i + 1} total={rounds.length}>
            <LetterheadTop place={place} title={title} onPlace={onPlace} />

            {/* Who, and what they recited */}
            <Grid templateColumns="1fr 1fr" gap="1.5mm 8mm" fontSize="10.5pt" borderWidth="1.5px" borderColor={INK} px="4mm" py="3mm">
              <Info label={tx("Full name")} value={upper(p.fullName)} bold />
              <Info label="N°" value={p.number === null ? "—" : String(p.number)} />
              <Info label={tx("Madrassa / Markaz")} value={upper(p.institution)} />
              <Info label={tx("Where they live")} value={upper(p.commune === p.province ? p.commune : `${p.commune} - ${p.province}`)} />
              <Box gridColumn="1 / -1">
                <Info
                  label={r.envelope ? tx("Envelope {n}", { n: r.envelope.number }) : tx("Envelope")}
                  value={r.envelope ? r.envelope.questions.map((q, k) => `${k + 1}. ${questionLabel(q)}`).join("   ") : tx("Has not drawn an envelope yet.")}
                />
              </Box>
            </Grid>

            {r.sheets.length === 0 ? (
              <Text mt="8mm" textAlign="center" color="#4A4F66">
                {tx("No judge has started a sheet yet.")}
              </Text>
            ) : (
              <SheetsTable sheets={r.sheets} questions={r.envelope?.questions.length ?? 3} />
            )}

            {/* The marks, as on the paper sheet */}
            <Text mt="2mm" fontSize="8.5pt" color="#4A4F66">
              {MARK_TYPES.map((m) => `${m.sign} ${m.name}`).join("   ·   ")}
            </Text>

            <Flex mt="5mm" align="baseline" gap="3mm" fontSize="12pt">
              <Text fontWeight="bold" color={NAVY}>
                {tx("Points")}:
              </Text>
              {r.score !== null ? (
                <Text fontWeight="bold" fontSize="14pt">
                  {scoreText(r.score)} / {maxScore}
                </Text>
              ) : (
                <Text color="#4A4F66">—</Text>
              )}
              <Text fontSize="10pt" color="#4A4F66">
                {r.score !== null
                  ? tx("the average of the {n} judges", { n: submitted.length })
                  : tx("{n} of {total} judges submitted", { n: submitted.length, total: judgeCount })}
              </Text>
            </Flex>

            <SignatureBlock lines={signer} onLine={onSigner} />
          </LetterheadPage>
        );
      })}
    </>
  );
}

function Info({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <Flex gap="2mm" minW="0">
      <Text color="#4A4F66" flexShrink={0}>
        {label}:
      </Text>
      <Text fontWeight={bold ? "bold" : "semibold"} minW="0">
        {value}
      </Text>
    </Flex>
  );
}

function SheetsTable({ sheets, questions }: { sheets: JudgeSheet[]; questions: number }) {
  const { tx } = useI18n();
  const template = `minmax(0, 1.2fr) repeat(${questions}, minmax(0, 1fr)) 15mm 20mm`;
  const cell = { px: "2mm", borderStartWidth: "1.5px", borderColor: INK, display: "flex", alignItems: "center", justifyContent: "center", minW: "0" } as const;
  return (
    <Box mt="5mm" borderWidth="1.5px" borderColor={INK}>
      <Grid templateColumns={template} minH="10mm" fontWeight="bold" fontSize="10pt" borderBottomWidth="1.5px" borderColor={INK} textAlign="center">
        <Flex align="center" justify="center" px="2mm">
          {tx("Judge")}
        </Flex>
        {Array.from({ length: questions }, (_, q) => (
          <Flex key={q} {...cell}>
            {tx("Question {n}", { n: q + 1 })}
          </Flex>
        ))}
        <Flex {...cell}>Sauti</Flex>
        <Flex {...cell}>{tx("Total")}</Flex>
      </Grid>
      {sheets.map((s, i) => (
        <Grid key={s.id} templateColumns={template} minH="15mm" borderTopWidth={i === 0 ? "0" : "1.5px"} borderColor={INK} fontSize="10pt">
          <Flex direction="column" justify="center" px="2mm" minW="0">
            <Text fontWeight="bold" truncate>
              {s.judge?.name ?? tx("Removed judge")}
            </Text>
            {!s.submitted && (
              <Text fontSize="8.5pt" color="#B42318">
                {tx("Not submitted")}
              </Text>
            )}
          </Flex>
          {Array.from({ length: questions }, (_, q) => {
            const m = s.questions[q];
            return (
              <Flex key={q} {...cell} direction="column" gap="0.5mm">
                {!m ? (
                  <Text color="#4A4F66">—</Text>
                ) : (
                  <>
                    <Text fontWeight="bold" fontSize="11pt" fontVariantNumeric="tabular-nums">
                      {m.deleted ? `0 · ${tx("Deleted")}` : scoreText(m.score)}
                    </Text>
                    <Text fontSize="8.5pt" color="#4A4F66" whiteSpace="nowrap">
                      {MARK_TYPES.map((t) => `${t.sign}${m[t.kind]}`).join(" ")}
                    </Text>
                  </>
                )}
              </Flex>
            );
          })}
          <Flex {...cell} fontVariantNumeric="tabular-nums">
            {s.sauti ?? "—"}
          </Flex>
          <Flex {...cell} fontWeight="bold" fontSize="11.5pt" fontVariantNumeric="tabular-nums">
            {s.total === null ? "—" : scoreText(s.total)}
          </Flex>
        </Grid>
      ))}
    </Box>
  );
}
