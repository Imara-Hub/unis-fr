"use client";

import { useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, Circle, Flex, Heading, IconButton, SimpleGrid, Stack, Table, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Hourglass, Mic, Trophy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { RoleOnly } from "@/components/AdminOnly";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FinalControl } from "@/components/FinalControl";
import { FinalResults } from "@/components/FinalResults";
import { EnvelopeQuestions, ParticipantInfo } from "@/components/JudgingParts";
import { NumberTag } from "@/components/NumberTag";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { byPassageOrder, PARTICIPANT_SHEETS, STAGE, STAGE_QUEUE, type JudgeSheet, type QueueParticipant, type Round } from "@/lib/graphql/judging";
import { PARTICIPANT_COUNTS } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";
import { MARK_TYPES } from "@/lib/marks";
import { MarkName } from "@/components/MarkName";

// Admin and staff watch the competition live: who is reciting, the questions they drew and each
// judge's sheet as it is being marked. Only the judges run the stage (call, draw, mark).
export default function StagePage() {
  const stage = useQuery(STAGE);
  const counts = useQuery(PARTICIPANT_COUNTS);
  const queue = useQuery(STAGE_QUEUE);
  const isAdmin = useQuery(ME).data?.me?.role === "ADMIN";
  // Finished: the last participant stays "on stage" (nobody else is called): the end shows instead.
  const finished = stage.data?.stage.finished ?? false;
  const round: Round = stage.data?.stage.round ?? "TASFIA";
  const final = round === "FINAL";
  const onStage = finished ? null : (stage.data?.stage.participant ?? null);
  const judgeCount = counts.data?.settings.judgeCount ?? 4;
  const { tx } = useI18n();

  return (
    <RoleOnly roles={["ADMIN", "STAFF"]}>
      <Stack gap={{ base: "5", md: "6" }}>
        <ErrorAlert message={stage.error ? readApiError(stage.error).message : null} />
        {isAdmin && stage.data && counts.data && (
          <FinalControl round={round} finalists={counts.data.participantCounts.finalists} tasfiaFinished={!final && finished} />
        )}
        {/* Also the panel size first, so "submitted n / total" is never a guess. */}
        {!stage.data || (!counts.data && !counts.error) ? (
          <Text color="fg.muted">{tx("Loading…")}</Text>
        ) : onStage ? (
          <Card.Root overflow="hidden">
            <ParticipantInfo
              participant={onStage}
              label={final ? tx("Final · live on stage") : tx("Live · on stage")}
              right={
                <Badge colorPalette={onStage.sheetsSubmitted >= judgeCount ? "green" : "gold"} variant="solid" size="md">
                  {tx("Judges submitted {n} / {total}", { n: onStage.sheetsSubmitted, total: judgeCount })}
                </Badge>
              }
            />
            <Card.Body p={{ base: "4", md: "7" }} gap="6">
              {onStage.envelope ? (
                <>
                  <EnvelopeQuestions number={onStage.envelope.number} questions={onStage.envelope.questions} />
                  <LiveSheets participantId={onStage.id} judgeCount={judgeCount} score={final ? onStage.finalScore : onStage.score} />
                </>
              ) : (
                <Flex direction="column" align="center" textAlign="center" gap="2" py="8" color="fg.muted">
                  <Hourglass size={26} strokeWidth={1.75} aria-hidden />
                  <Text fontWeight="semibold" color="brand.900">
                    {tx("Choosing an envelope")}
                  </Text>
                  <Text fontSize="sm">{tx("The questions appear here once the participant opens one.")}</Text>
                </Flex>
              )}
            </Card.Body>
          </Card.Root>
        ) : finished ? (
          <Card.Root>
            <Card.Body alignItems="center" textAlign="center" py="12" gap="3">
              <Circle size="16" bg="gold.50" color="gold.600">
                <Trophy size={28} strokeWidth={1.75} aria-hidden />
              </Circle>
              <Heading size="lg" color="brand.900">
                {final ? tx("The final is finished") : tx("The tasfia is finished")}
              </Heading>
              <Text color="fg.muted">
                {final
                  ? tx("Every finalist has recited and every judge's sheet is in. Here is the final ranking.")
                  : tx("Every participant has recited and every judge's sheet is in. The results are on the Ranking page.")}
              </Text>
              <Button asChild colorPalette="brand" size="sm" mt="2">
                <NextLink href="/ranking">{tx("See the ranking")}</NextLink>
              </Button>
            </Card.Body>
          </Card.Root>
        ) : (
          <Card.Root>
            <Card.Body alignItems="center" textAlign="center" py="12" gap="3">
              <Circle size="16" bg="brand.50" color="brand.600">
                <Mic size={28} strokeWidth={1.75} aria-hidden />
              </Circle>
              <Heading size="lg" color="brand.900">
                {tx("Nobody on stage")}
              </Heading>
              <Text color="fg.muted">{tx("The judges call the next participant from their judging desk.")}</Text>
            </Card.Body>
          </Card.Root>
        )}
        {final && <FinalResults participants={queue.data?.participants ?? []} maxScore={counts.data?.settings.maxScore ?? 100} />}
        <Order onStageId={onStage?.id ?? null} round={round} />
      </Stack>
    </RoleOnly>
  );
}

// Each judge's sheet, updated while they mark (drafts too).
function LiveSheets({ participantId, judgeCount, score }: { participantId: string; judgeCount: number; score: number | null }) {
  const { data } = useQuery(PARTICIPANT_SHEETS, { variables: { id: participantId } });
  const sheets = data?.participant?.sheets ?? [];
  const missing = Math.max(0, judgeCount - sheets.length);
  const { tx } = useI18n();

  return (
    <Stack gap="3">
      <Flex justify="space-between" align="baseline" gap="3" wrap="wrap">
        <Heading size="md" color="brand.900">
          {tx("Judges’ sheets")}
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          {tx("Final score (average):")}{" "}
          <Text as="span" fontWeight="bold" color="brand.900" fontSize="lg">
            {score ?? "—"}
          </Text>
        </Text>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
        {sheets.map((s) => (
          <LiveSheet key={s.id} sheet={s} />
        ))}
        {Array.from({ length: missing }, (_, i) => (
          <Flex key={i} p="4" rounded="xl" borderWidth="1px" borderStyle="dashed" color="fg.muted" fontSize="sm" align="center" justify="center" minH="32">
            {tx("Not started yet")}
          </Flex>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

// One judge's sheet: each question with its marks by name (Fath, Tanbih, Tajweed, Kusita) and points.
function LiveSheet({ sheet: s }: { sheet: JudgeSheet }) {
  const { tx } = useI18n();
  return (
    <Stack gap="3" p="4" rounded="xl" borderWidth="1px" bg={s.submitted ? "white" : "bg.subtle"}>
      <Flex justify="space-between" align="center" gap="2">
        <Text fontWeight="semibold" color="brand.900" truncate>
          {s.judge?.name ?? tx("Judge")}
        </Text>
        {s.submitted ? <Badge colorPalette="green">{tx("Submitted")}</Badge> : <Badge colorPalette="gray">{tx("Marking…")}</Badge>}
      </Flex>
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader px="1" />
            {MARK_TYPES.map((t) => (
              <Table.ColumnHeader key={t.kind} px="1" textAlign="center" fontSize="xs" color={`${t.palette}.700`}>
                <MarkName mark={t} />
              </Table.ColumnHeader>
            ))}
            <Table.ColumnHeader px="1" textAlign="end" fontSize="xs">
              {tx("Points")}
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {s.questions.map((q, i) => (
            <Table.Row key={i} bg={q.deleted ? "red.50" : undefined}>
              <Table.Cell px="1" fontWeight="semibold" whiteSpace="nowrap">
                {tx("Q{n}", { n: i + 1 })}
              </Table.Cell>
              {MARK_TYPES.map((t) => {
                const n = q[t.kind] ?? 0;
                return (
                  <Table.Cell key={t.kind} px="1" textAlign="center" fontVariantNumeric="tabular-nums" color={n ? `${t.palette}.700` : "fg.subtle"} fontWeight={n ? "bold" : "normal"}>
                    {n}
                  </Table.Cell>
                );
              })}
              <Table.Cell px="1" textAlign="end" fontWeight="semibold" whiteSpace="nowrap" color={q.deleted ? "red.600" : undefined}>
                {q.deleted ? tx("Deleted") : q.score}
              </Table.Cell>
            </Table.Row>
          ))}
          <Table.Row>
            <Table.Cell px="1" colSpan={MARK_TYPES.length + 1}>
              Sauti
            </Table.Cell>
            <Table.Cell px="1" textAlign="end" fontWeight="semibold">
              {s.sauti ?? "—"}
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
      <Text textAlign="right" fontWeight="bold" fontSize="lg" color="brand.900">
        {s.total ?? "—"} <Text as="span" fontSize="sm" color="fg.muted" fontWeight="normal">/ 100</Text>
      </Text>
    </Stack>
  );
}

// The running order: who still waits, who is late, and who already recited. Late = they have not
// recited although someone with a later passage number already did (or is on stage): they were
// not there when their turn came. They go back to normal once they recite. Results are not shown
// here: they are on the Ranking page.
// In the final, only the finalists are in the order.
function Order({ onStageId, round }: { onStageId: string | null; round: Round }) {
  const { data } = useQuery(STAGE_QUEUE);
  const all = byPassageOrder((data?.participants ?? []).filter((p) => round === "TASFIA" || p.inFinal));
  const called = all.filter((p) => p.envelope || p.id === onStageId).map((p) => p.number ?? 0);
  const reached = called.length ? Math.max(...called) : 0;
  const notYet = all.filter((p) => !p.envelope && p.id !== onStageId);
  const late = notYet.filter((p) => p.number !== null && p.number < reached);
  const waiting = notYet.filter((p) => !late.includes(p));
  const recited = all.filter((p) => p.envelope && p.id !== onStageId);
  const { tx } = useI18n();

  return (
    <SimpleGrid columns={{ base: 1, lg: 3 }} gap={{ base: "5", md: "6" }} alignItems="start">
      <OrderColumn
        title={tx("Waiting")}
        icon={<Clock size={16} aria-hidden />}
        palette="brand"
        list={waiting}
        empty={tx("Nobody is waiting.")}
        highlightFirst
      />
      <OrderColumn
        title={tx("Late")}
        icon={<AlertTriangle size={16} aria-hidden />}
        palette="red"
        list={late}
        empty={tx("Nobody is late.")}
      />
      <OrderColumn
        title={tx("Recited")}
        icon={<CheckCircle2 size={16} aria-hidden />}
        palette="green"
        list={[...recited].reverse()} // the last one to recite first
        empty={tx("Nobody has recited yet.")}
      />
    </SimpleGrid>
  );
}

// Rows per page in each column: the three columns stay about the same height.
const ORDER_PAGE = 8;

function OrderColumn({
  title,
  icon,
  palette,
  list,
  empty,
  highlightFirst = false,
}: {
  title: string;
  icon: ReactNode;
  palette: "brand" | "red" | "green";
  list: QueueParticipant[];
  empty: string;
  highlightFirst?: boolean;
}) {
  const { tx } = useI18n();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(list.length / ORDER_PAGE));
  const shownPage = Math.min(page, pages - 1); // the list got shorter (someone recited)
  const from = shownPage * ORDER_PAGE;
  const shown = list.slice(from, from + ORDER_PAGE);

  return (
    <Card.Root overflow="hidden">
      <Box h="1" bg={`${palette}.500`} />
      <Card.Body p={{ base: "4", md: "5" }} gap="3">
        <Flex align="center" justify="space-between" gap="2">
          <Flex align="center" gap="2" color={`${palette}.700`}>
            <Circle size="7" bg={`${palette}.50`}>
              {icon}
            </Circle>
            <Heading size="sm" color="brand.900">
              {title}
            </Heading>
          </Flex>
          <Badge colorPalette={palette === "brand" ? "blue" : palette} variant="subtle" rounded="full" px="2.5" fontVariantNumeric="tabular-nums">
            {list.length}
          </Badge>
        </Flex>

        {list.length === 0 ? (
          <Flex py="6" justify="center" rounded="lg" borderWidth="1px" borderStyle="dashed" color="fg.muted" fontSize="sm">
            {empty}
          </Flex>
        ) : (
          <Stack gap="1" key={shownPage} animation="fade-in 0.2s ease-out">
            {shown.map((p, i) => {
              const next = highlightFirst && from + i === 0;
              return (
                <Flex
                  key={p.id}
                  align="center"
                  gap="3"
                  px="2"
                  py="2"
                  rounded="lg"
                  bg={next ? "brand.50" : undefined}
                  borderWidth="1px"
                  borderColor={next ? "brand.200" : "transparent"}
                  _hover={{ bg: next ? "brand.50" : "bg.subtle" }}
                >
                  <ParticipantPhoto path={p.photoUrl} size="thumb" />
                  <Box flex="1" minW="0">
                    <Flex align="center" gap="2" minW="0">
                      <NumberTag number={p.number} />
                      <Text fontWeight="semibold" color="brand.900" truncate>
                        {p.fullName}
                      </Text>
                    </Flex>
                    <Text fontSize="xs" color="fg.muted" truncate>
                      {p.institution}
                      {p.envelope && ` · ${tx("envelope {n} · {sheets} sheets", { n: p.envelope.number, sheets: p.sheetsSubmitted })}`}
                    </Text>
                  </Box>
                  {next && (
                    <Badge colorPalette="blue" variant="solid" size="sm" flexShrink={0}>
                      {tx("Next up")}
                    </Badge>
                  )}
                </Flex>
              );
            })}
          </Stack>
        )}

        {pages > 1 && (
          <Flex align="center" justify="space-between" gap="2" pt="2" borderTopWidth="1px">
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
              {tx("{from}–{to} of {total}", { from: from + 1, to: from + shown.length, total: list.length })}
            </Text>
            <Flex align="center" gap="1">
              <IconButton
                size="xs"
                variant="ghost"
                aria-label={tx("Previous page")}
                disabled={shownPage === 0}
                onClick={() => setPage(shownPage - 1)}
              >
                <ChevronLeft size={16} aria-hidden />
              </IconButton>
              <Text fontSize="xs" fontWeight="medium" minW="10" textAlign="center" fontVariantNumeric="tabular-nums">
                {shownPage + 1} / {pages}
              </Text>
              <IconButton
                size="xs"
                variant="ghost"
                aria-label={tx("Next page")}
                disabled={shownPage === pages - 1}
                onClick={() => setPage(shownPage + 1)}
              >
                <ChevronRight size={16} aria-hidden />
              </IconButton>
            </Flex>
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
}
