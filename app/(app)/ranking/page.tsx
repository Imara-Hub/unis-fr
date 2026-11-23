"use client";

import { skipToken, useQuery } from "@apollo/client/react";
import { Box, Button, Card, Flex, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Download, FileText, Trophy } from "lucide-react";
import NextLink from "next/link";
import { useMemo } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ExportResultsButton } from "@/components/ExportResultsButton";
import { FinalResults } from "@/components/FinalResults";
import { PageHeader } from "@/components/PageHeader";
import { RankingGrid, RankStat, rankParticipants } from "@/components/RankingTable";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { PARTICIPANT_COUNTS, PARTICIPANTS, RANKING_SHEETS } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// Every judged participant, best first, in two sections: those who passed, then those who did not.
// The rank is the overall one (the same as the ranking PDF), so the first who did not pass keeps
// the number after the last who passed.
export default function RankingPage() {
  const counts = useQuery(PARTICIPANT_COUNTS);
  const me = useQuery(ME);
  // Approved participants only (the others never get a score); the ones with a final score are ranked.
  const list = useQuery(PARTICIPANTS, { variables: { status: null, search: null, review: "APPROVED" } });
  // Each judge's points: admin and staff see every sheet (a judge only their own, so not here).
  const role = me.data?.me?.role;
  // A judge never asks for them (skipToken: not even prepared).
  const sheets = useQuery(RANKING_SHEETS, !role || role === "JUDGE" ? skipToken : {});
  const { tx } = useI18n();

  const settings = counts.data?.settings;
  const maxScore = settings?.maxScore ?? 100;
  const loaded = list.data?.participants ?? list.previousData?.participants;

  const rows = useMemo(() => rankParticipants(loaded ?? []), [loaded]);
  const ranked = rows;
  const pending = (loaded ?? []).length - ranked.length;
  const passed = rows.filter((r) => r.p.status === "PASSED");

  // The judges, as columns (by name), and each participant's points from each of them.
  const { judges, points } = useMemo(() => {
    const names = new Map<string, string>();
    const points = new Map<string, Map<string, number>>();
    for (const p of sheets.data?.participants ?? sheets.previousData?.participants ?? []) {
      const byJudge = new Map<string, number>();
      for (const s of p.sheets) {
        if (!s.submitted || s.total === null || !s.judge) continue;
        names.set(s.judge.id, s.judge.name);
        byJudge.set(s.judge.id, s.total);
      }
      points.set(p.id, byJudge);
    }
    const judges = [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    return { judges, points };
  }, [sheets.data, sheets.previousData]);
  const failed = rows.filter((r) => r.p.status !== "PASSED");

  return (
    <>
      <PageHeader
        title={tx("Ranking")}
        description={tx("Everyone with a final score, from first to last: each judge's points, their total, the percentage and the result.")}
        actions={
          <Flex gap="2" wrap="wrap">
            {/* The official sheet on the association's letterhead (admin only). */}
            {me.data?.me?.role === "ADMIN" &&
              (ranked.length === 0 ? (
                <Button colorPalette="brand" size="sm" disabled>
                  <FileText size={16} aria-hidden />
                  {tx("Results sheet (print / PDF)")}
                </Button>
              ) : (
                <Button asChild colorPalette="brand" size="sm">
                  <NextLink href="/results-sheet">
                    <FileText size={16} aria-hidden />
                    {tx("Results sheet (print / PDF)")}
                  </NextLink>
                </Button>
              ))}
            <ExportResultsButton file="ranking" colorPalette="brand" variant="outline" disabled={ranked.length === 0}>
              <Download size={16} aria-hidden />
              {tx("Ranking PDF")}
            </ExportResultsButton>
          </Flex>
        }
      />

      <ErrorAlert message={list.error ? readApiError(list.error).message : null} />

      <Flex gap="3" wrap="wrap" mb="5" fontSize="sm">
        <RankStat label={tx("Judged")} value={loaded ? String(ranked.length) : "…"} />
        <RankStat label={tx("Passed")} value={loaded ? String(passed.length) : "…"} />
        <RankStat label={tx("Did not pass")} value={loaded ? String(failed.length) : "…"} />
        <RankStat label={tx("Not judged yet")} value={loaded ? String(pending) : "…"} />
        {settings && <RankStat label={tx("Pass mark")} value={`${settings.passMark} / ${maxScore}`} />}
        {settings && settings.finalistCount > 0 && (
          <RankStat label={tx("Go to the final")} value={loaded ? String(rows.filter((r) => r.p.finalist).length) : "…"} />
        )}
      </Flex>

      {!loaded ? (
        <Card.Root>
          <Stack p="5" gap="3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h="10" rounded="md" />
            ))}
          </Stack>
        </Card.Root>
      ) : ranked.length === 0 ? (
        <Card.Root>
          <Flex direction="column" align="center" gap="3" py="16" color="fg.muted" textAlign="center" px="6">
            <Trophy size={36} aria-hidden />
            <Text fontWeight="semibold" color="brand.900">
              {tx("No final score yet")}
            </Text>
            <Text fontSize="sm" maxW="md">
              {tx("A participant appears here once every judge on the panel has submitted their sheet.")}
            </Text>
          </Flex>
        </Card.Root>
      ) : (
        <>
          {/* The final started: its ranking first, the tasfia's below it. */}
          {loaded.some((p) => p.inFinal) && (
            <Box mb="6">
              <FinalResults participants={loaded} maxScore={maxScore} />
            </Box>
          )}
          <RankingGrid rows={rows} judges={judges} points={points} maxScore={maxScore} passMark={settings?.passMark ?? null} judgeCount={settings?.judgeCount ?? 4} />
        </>
      )}
    </>
  );
}
