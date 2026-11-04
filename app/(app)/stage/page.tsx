"use client";

import { useQuery } from "@apollo/client/react";
import { Badge, Box, Card, Circle, Flex, Heading, SimpleGrid, Stack, Table, Text } from "@chakra-ui/react";
import { Hourglass, Mic } from "lucide-react";
import { RoleOnly } from "@/components/AdminOnly";
import { ErrorAlert } from "@/components/ErrorAlert";
import { EnvelopeQuestions, ParticipantInfo } from "@/components/JudgingParts";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { readApiError } from "@/lib/errors";
import { PARTICIPANT_SHEETS, STAGE, STAGE_QUEUE, type JudgeSheet } from "@/lib/graphql/judging";
import { PARTICIPANT_COUNTS } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// Admin and staff watch the competition live: who is reciting, the questions they drew and each
// judge's sheet as it is being marked. Only the judges run the stage (call, draw, mark).
export default function StagePage() {
  const stage = useQuery(STAGE);
  const counts = useQuery(PARTICIPANT_COUNTS);
  const onStage = stage.data?.stage.participant ?? null;
  const judgeCount = counts.data?.settings.judgeCount ?? 4;
  const { tx } = useI18n();

  return (
    <RoleOnly roles={["ADMIN", "STAFF"]}>
      <Stack gap={{ base: "5", md: "6" }}>
        <ErrorAlert message={stage.error ? readApiError(stage.error).message : null} />
        {!stage.data ? (
          <Text color="fg.muted">{tx("Loading…")}</Text>
        ) : onStage ? (
          <Card.Root overflow="hidden">
            <ParticipantInfo
              participant={onStage}
              label={tx("Live · on stage")}
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
                  <LiveSheets participantId={onStage.id} judgeCount={judgeCount} score={onStage.score} />
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
        <Order onStageId={onStage?.id ?? null} />
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
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="3">
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

function LiveSheet({ sheet: s }: { sheet: JudgeSheet }) {
  const { tx } = useI18n();
  return (
    <Stack gap="2" p="4" rounded="xl" borderWidth="1px" bg={s.submitted ? "white" : "bg.subtle"}>
      <Flex justify="space-between" align="center" gap="2">
        <Text fontWeight="semibold" color="brand.900" truncate>
          {s.judge?.name ?? tx("Judge")}
        </Text>
        {s.submitted ? <Badge colorPalette="green">{tx("Submitted")}</Badge> : <Badge colorPalette="gray">{tx("Marking…")}</Badge>}
      </Flex>
      <Table.Root size="sm" variant="line">
        <Table.Body>
          {s.questions.map((q, i) => (
            <Table.Row key={i}>
              <Table.Cell px="1">{tx("Q{n}", { n: i + 1 })}</Table.Cell>
              <Table.Cell px="1" color="fg.muted" fontSize="xs">
                X{q.tajweed} I{q.tanbih} ●{q.fath}
              </Table.Cell>
              <Table.Cell px="1" textAlign="end" fontWeight="semibold" color={q.deleted ? "red.600" : undefined}>
                {q.deleted ? tx("Deleted") : q.score}
              </Table.Cell>
            </Table.Row>
          ))}
          <Table.Row>
            <Table.Cell px="1" colSpan={2}>
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

// The running order: who still waits and who already recited, with their result.
function Order({ onStageId }: { onStageId: string | null }) {
  const { data } = useQuery(STAGE_QUEUE);
  const all = [...(data?.participants ?? [])].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
  const waiting = all.filter((p) => !p.envelope && p.id !== onStageId);
  const recited = all.filter((p) => p.envelope && p.id !== onStageId);
  const { tx } = useI18n();

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: "5", md: "6" }}>
      {[
        { key: "waiting", title: tx("Waiting ({n})", { n: waiting.length }), list: waiting, empty: tx("Nobody is waiting.") },
        { key: "recited", title: tx("Recited ({n})", { n: recited.length }), list: [...recited].reverse(), empty: tx("Nobody has recited yet.") },
      ].map((col) => (
        <Card.Root key={col.key}>
          <Card.Body p={{ base: "4", md: "6" }} gap="3">
            <Heading size="sm" color="brand.900">
              {col.title}
            </Heading>
            {col.list.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                {col.empty}
              </Text>
            ) : (
              <Stack gap="0">
                {col.list.map((p, i) => (
                  <Flex key={p.id} align="center" gap="3" py="2" borderTopWidth={i === 0 ? "0" : "1px"}>
                    <ParticipantPhoto path={p.photoUrl} size="thumb" />
                    <Box flex="1" minW="0">
                      <Text fontWeight="semibold" color="brand.900" truncate>
                        {p.fullName}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" truncate>
                        {p.institution}
                        {p.envelope && ` · ${tx("envelope {n} · {sheets} sheets", { n: p.envelope.number, sheets: p.sheetsSubmitted })}`}
                      </Text>
                    </Box>
                    {p.envelope && (
                      <Flex align="center" gap="2">
                        {p.score !== null && (
                          <Text fontWeight="bold" color="brand.900">
                            {p.score}
                          </Text>
                        )}
                        <StatusBadge status={p.status} />
                      </Flex>
                    )}
                  </Flex>
                ))}
              </Stack>
            )}
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
  );
}
