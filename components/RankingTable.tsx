"use client";

import { Badge, Box, Card, Flex, Heading, Stack, Table, Text } from "@chakra-ui/react";
import { CircleCheck, CircleX, Trophy } from "lucide-react";
import NextLink from "next/link";
import { Fragment, type ReactNode } from "react";
import { NumberTag } from "@/components/NumberTag";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { StatusIcons } from "@/components/StatusBadge";
import type { ParticipantRow } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// The ranking table and its pieces: used on the Ranking page and on the judging desk once every
// participant has recited.

export function RankStat({ label, value }: { label: string; value: string }) {
  return (
    <Flex align="baseline" gap="2" px="3" py="1.5" rounded="md" bg="white" borderWidth="1px">
      <Text color="fg.muted">{label}</Text>
      <Text fontWeight="bold" color="brand.900" fontVariantNumeric="tabular-nums">
        {value}
      </Text>
    </Flex>
  );
}

// Gold, silver, bronze for the first three; a plain number after.
const MEDALS = ["#F9971D", "#A8A9AD", "#B87333"];
export function RankBadge({ rank }: { rank: number }) {
  const medal = MEDALS[rank - 1];
  if (!medal) {
    return (
      <Text as="span" fontWeight="semibold" color="fg.muted">
        {rank}
      </Text>
    );
  }
  return (
    <Badge rounded="full" px="2.5" py="0.5" bg={medal} color="white" fontWeight="bold" fontVariantNumeric="tabular-nums">
      {rank}
    </Badge>
  );
}

// What a ranked row needs: the participant list and the judging queue both carry it.
export type Rankable = Pick<ParticipantRow, "id" | "number" | "fullName" | "photoUrl" | "institution" | "commune" | "score" | "status" | "finalist">;
export type RankedRow<T extends Rankable = Rankable> = { p: T & { score: number }; rank: number };

// Everyone with a final score, best first, with their overall rank. Ties keep the same order as the
// final's line: name A–Z ignoring capitals and accents.
export function rankParticipants<T extends Rankable>(list: readonly T[]): RankedRow<T>[] {
  return list
    .filter((p): p is T & { score: number } => p.score !== null)
    .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }))
    .map((p, i) => ({ p, rank: i + 1 }));
}

// One section of the ranking (passed, or did not pass): a heading and its table.
export function RankSection({
  title,
  icon,
  tone,
  rows,
  maxScore,
  empty,
}: {
  title: string;
  icon: ReactNode;
  tone: "green" | "red" | "gold";
  rows: RankedRow[];
  maxScore: number;
  empty: string;
}) {
  const { tx } = useI18n();
  return (
    <Card.Root overflow="hidden" borderTopWidth="3px" borderTopColor={`${tone}.500`} boxShadow={tone === "gold" ? "0 10px 30px -12px rgba(249,151,29,0.45)" : undefined}>
      <Flex
        align="center"
        gap="2"
        px={{ base: "4", md: "5" }}
        py="3"
        color={`${tone}.700`}
        bg={tone === "gold" ? "linear-gradient(90deg, #FFF6EB 0%, #FFFFFF 100%)" : undefined}
      >
        {icon}
        <Heading size="md" color="brand.900">
          {title}
        </Heading>
      </Flex>
      {rows.length === 0 ? (
        <Text px={{ base: "4", md: "5" }} pb="5" fontSize="sm" color="fg.muted">
          {empty}
        </Text>
      ) : (
        <Table.ScrollArea>
          <Table.Root size="sm" variant="line" interactive>
            <Table.Header>
              <Table.Row bg="bg.subtle">
                <Table.ColumnHeader w="14" textAlign="end">
                  {tx("Rank")}
                </Table.ColumnHeader>
                <Table.ColumnHeader>{tx("Participant")}</Table.ColumnHeader>
                <Table.ColumnHeader display={{ base: "none", md: "table-cell" }}>{tx("Halaqa")}</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">{tx("Points")}</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="center" w="24">
                  %
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="center" w="28" display={{ base: "none", sm: "table-cell" }}>
                  {tx("Result")}
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map(({ p, rank }) => {
                const pct = Math.round((p.score / maxScore) * 1000) / 10;
                return (
                  <Table.Row key={p.id} bg={rank <= 3 ? "gold.50" : p.finalist ? "#FFF9F1" : undefined}>
                    <Table.Cell textAlign="end" fontVariantNumeric="tabular-nums">
                      <RankBadge rank={rank} />
                    </Table.Cell>
                    <Table.Cell>
                      <Flex align="center" gap="3" minW="0">
                        <ParticipantPhoto path={p.photoUrl} size="thumb" />
                        <Box minW="0">
                          <Flex align="center" gap="2" wrap="wrap">
                            <NumberTag number={p.number} />
                            <Text asChild fontWeight="semibold" color="brand.900" _hover={{ textDecoration: "underline" }}>
                              <NextLink href={`/participants/${p.id}`}>{p.fullName}</NextLink>
                            </Text>
                          </Flex>
                          <Text fontSize="xs" color="fg.muted" display={{ base: "block", md: "none" }} truncate>
                            {p.institution}
                          </Text>
                        </Box>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell display={{ base: "none", md: "table-cell" }} color="fg.muted">
                      {p.institution}
                      <Text as="span" color="fg.subtle">
                        {" "}
                        · {p.commune}
                      </Text>
                    </Table.Cell>
                    <Table.Cell textAlign="end" fontWeight="bold" color="brand.900" fontVariantNumeric="tabular-nums">
                      {p.score}
                      <Text as="span" fontWeight="normal" color="fg.subtle" fontSize="xs">
                        {" "}
                        / {maxScore}
                      </Text>
                    </Table.Cell>
                    <Table.Cell textAlign="center" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
                      {pct} %
                    </Table.Cell>
                    <Table.Cell textAlign="center" display={{ base: "none", sm: "table-cell" }}>
                      <Flex justify="center">
                        <StatusIcons status={p.status} finalist={p.finalist} />
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
      )}
    </Card.Root>
  );
}

// The results in their groups. With a final: those going to it (the server marks the best
// `finalistCount` who passed), then the others who passed, then those who did not. The rank stays
// the overall one in every group.
export function ResultSections<T extends Rankable>({
  rows,
  maxScore,
  finalistCount,
}: {
  rows: RankedRow<T>[];
  maxScore: number;
  finalistCount: number;
}) {
  const { tx } = useI18n();
  const passed = rows.filter((r) => r.p.status === "PASSED");
  const failed = rows.filter((r) => r.p.status !== "PASSED");
  const finalists = passed.filter((r) => r.p.finalist);
  const passedOnly = passed.filter((r) => !r.p.finalist);
  const hasFinal = finalistCount > 0;

  return (
    <Stack gap={{ base: "6", md: "8" }}>
      {hasFinal && (
        <RankSection
          title={tx("Going to the final ({n})", { n: finalists.length })}
          icon={<Trophy size={18} aria-hidden />}
          tone="gold"
          rows={finalists}
          maxScore={maxScore}
          empty={tx("Nobody has passed yet.")}
        />
      )}
      <RankSection
        title={hasFinal ? tx("Passed, not in the final ({n})", { n: passedOnly.length }) : tx("Passed ({n})", { n: passed.length })}
        icon={<CircleCheck size={18} aria-hidden />}
        tone="green"
        rows={hasFinal ? passedOnly : passed}
        maxScore={maxScore}
        empty={hasFinal ? tx("Nobody so far.") : tx("Nobody has passed yet.")}
      />
      <RankSection
        title={tx("Did not pass ({n})", { n: failed.length })}
        icon={<CircleX size={18} aria-hidden />}
        tone="red"
        rows={failed}
        maxScore={maxScore}
        empty={tx("Nobody so far.")}
      />
    </Stack>
  );
}

// The Ranking page: one table, best first, in Chakra's own table style (outline, striped, column
// borders). Each judge's points, the total of the panel (out of judges × 100), the percentage (out
// of 100: the average) and the result. It always fits the screen's width (no sideways scroll): on
// narrower screens the judges' points, then the total and the result, move under the name.
export interface JudgeColumn {
  id: string;
  name: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Which columns show from which screen width; below it, their content is under the name.
const JUDGES_SHOWN = { base: "none", lg: "table-cell" } as const;
const TOTAL_SHOWN = { base: "none", md: "table-cell" } as const;
const UNDER_NAME_JUDGES = { base: "flex", lg: "none" } as const;
const UNDER_NAME_REST = { base: "flex", md: "none" } as const;

export function RankingGrid<T extends Rankable>({
  rows,
  judges,
  points,
  maxScore,
  passMark,
  judgeCount,
}: {
  rows: RankedRow<T>[];
  judges: JudgeColumn[];
  /** participant id → judge id → that judge's total (submitted sheets only). */
  points: Map<string, Map<string, number>>;
  maxScore: number;
  passMark: number | null;
  /** The panel size: the total is out of judgeCount × maxScore (4 judges: / 400). */
  judgeCount: number;
}) {
  const { tx } = useI18n();
  const firstFailed = rows.findIndex((r) => r.p.status !== "PASSED");
  // Each participant is marked by one panel of judgeCount (a judge replaced midway adds a column,
  // never a sheet), so the total is out of judgeCount × points.
  const totalMax = Math.max(judgeCount, 1) * maxScore;
  const cols = 5 + judges.length;
  const num = { textAlign: "center", fontVariantNumeric: "tabular-nums" } as const;

  return (
    <Table.Root size="sm" variant="outline" striped interactive tableLayout="fixed" w="full" bg="bg">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader w={{ base: "10", md: "12" }} textAlign="center">
            #
          </Table.ColumnHeader>
          {/* Once the judges show, the participant keeps just the width it needs (photo, N°, name)
              and the score columns, which have no set width there, share all the rest. Below
              that, the participant takes the space left by the set-width columns. */}
          <Table.ColumnHeader w={{ base: "auto", lg: "12rem" }}>{tx("Participant")}</Table.ColumnHeader>
          {judges.map((j, i) => (
            <Table.ColumnHeader key={j.id} textAlign="center" display={JUDGES_SHOWN} title={j.name}>
              <Text fontSize="2xs" color="fg.muted">
                {tx("Judge {n}", { n: i + 1 })}
              </Text>
              <Text textTransform="capitalize" lineHeight="1.2" lineClamp={2} wordBreak="break-word">
                {j.name}
              </Text>
            </Table.ColumnHeader>
          ))}
          <Table.ColumnHeader w={{ md: "24", lg: "auto" }} textAlign="center" display={TOTAL_SHOWN}>
            {tx("Total")}
            <Text fontSize="2xs" color="fg.muted">
              / {totalMax}
            </Text>
          </Table.ColumnHeader>
          <Table.ColumnHeader w={{ base: "20", md: "24", lg: "auto" }} textAlign="center">
            %
            <Text fontSize="2xs" color="fg.muted">
              / 100
            </Text>
          </Table.ColumnHeader>
          <Table.ColumnHeader w={{ md: "24", lg: "auto" }} textAlign="center" display={TOTAL_SHOWN}>
            {tx("Result")}
          </Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map(({ p, rank }, i) => {
          const mine = points.get(p.id);
          const given = judges.map((j) => mine?.get(j.id));
          const counted = given.filter((v): v is number => v !== undefined);
          const total = counted.length > 0 ? round2(counted.reduce((a, b) => a + b, 0)) : null;
          const pct = Math.round((p.score / maxScore) * 1000) / 10;
          return (
            <Fragment key={p.id}>
              {/* The pass mark: those above passed, those below did not. */}
              {i === firstFailed && i > 0 && (
                <Table.Row>
                  <Table.Cell colSpan={cols} textAlign="center" color="fg.error" fontSize="xs" fontWeight="semibold">
                    {passMark !== null ? tx("Pass mark: {n} / {max}", { n: passMark, max: maxScore }) : tx("Did not pass")}
                  </Table.Cell>
                </Table.Row>
              )}
              <Table.Row>
                <Table.Cell {...num}>
                  <RankBadge rank={rank} />
                </Table.Cell>
                <Table.Cell>
                  {/* A small round photo, the number above the name; nothing else (room for the points). */}
                  <Flex align="center" gap="2" minW="0">
                  <Box display={{ base: "none", sm: "block" }} flexShrink={0}>
                    <ParticipantPhoto path={p.photoUrl} size="avatar" />
                  </Box>
                  <Box minW="0" flex="1">
                    <Box>
                      <NumberTag number={p.number} />
                    </Box>
                    <Text asChild display="block" mt="1" fontSize="xs" fontWeight="medium" truncate _hover={{ textDecoration: "underline" }}>
                      <NextLink href={`/participants/${p.id}`} title={p.fullName}>
                        {p.fullName}
                      </NextLink>
                    </Text>
                    <Box>
                      {/* Narrower screens: each judge's points here, then the total and the result. */}
                      {counted.length > 0 && (
                        <Flex display={UNDER_NAME_JUDGES} gap="1" wrap="wrap" mt="1.5">
                          {given.map((v, k) =>
                            v === undefined ? null : (
                              <Badge key={judges[k]!.id} title={judges[k]!.name} size="sm" variant="surface" fontVariantNumeric="tabular-nums">
                                {tx("J{n}", { n: k + 1 })} {v}
                              </Badge>
                            ),
                          )}
                        </Flex>
                      )}
                      <Flex display={UNDER_NAME_REST} gap="1.5" wrap="wrap" align="center" mt="1.5">
                        {total !== null && (
                          <Text fontSize="xs" fontVariantNumeric="tabular-nums">
                            {tx("Total")} {total} / {totalMax}
                          </Text>
                        )}
                        <StatusIcons status={p.status} finalist={p.finalist} />
                      </Flex>
                    </Box>
                  </Box>
                  </Flex>
                </Table.Cell>
                {given.map((v, k) => (
                  <Table.Cell key={judges[k]!.id} {...num} display={JUDGES_SHOWN} color={v === undefined ? "fg.subtle" : undefined}>
                    {v ?? "—"}
                  </Table.Cell>
                ))}
                <Table.Cell {...num} display={TOTAL_SHOWN} fontWeight="semibold">
                  {total ?? "—"}
                </Table.Cell>
                <Table.Cell {...num} fontWeight="semibold" whiteSpace="nowrap">
                  {pct} %
                </Table.Cell>
                <Table.Cell {...num} display={TOTAL_SHOWN}>
                  <StatusIcons status={p.status} finalist={p.finalist} />
                </Table.Cell>
              </Table.Row>
            </Fragment>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
}
