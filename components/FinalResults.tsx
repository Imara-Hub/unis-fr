"use client";

import { Box, Card, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { Crown } from "lucide-react";
import { NumberTag } from "@/components/NumberTag";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { RankBadge } from "@/components/RankingTable";
import { useI18n } from "@/lib/i18n";

// What a finalist row needs: the participant list and the judging queue both carry it.
export interface Finalist {
  id: string;
  number: number | null;
  fullName: string;
  photoUrl: string;
  institution: string;
  inFinal: boolean;
  score: number | null; // the tasfia's
  finalScore: number | null;
}

// The finalists, best first by the final's score; ties by name A–Z (as the tasfia's ranking).
// Those still waiting for the judges come after, by their tasfia score.
export function rankFinalists<T extends Finalist>(list: readonly T[]) {
  const byName = (a: T, b: T) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
  const finalists = list.filter((p) => p.inFinal);
  const judged = finalists
    .filter((p) => p.finalScore !== null)
    .sort((a, b) => b.finalScore! - a.finalScore! || byName(a, b))
    .map((p, i) => ({ p, rank: (i + 1) as number | null }));
  const waiting = finalists
    .filter((p) => p.finalScore === null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || byName(a, b))
    .map((p) => ({ p, rank: null as number | null }));
  return { judged, waiting, all: [...judged, ...waiting] };
}

// The final's ranking: the winner first. Shown on the Ranking page, on the stage page and on the
// judging desk once the final is over.
export function FinalResults({ participants, maxScore = 100 }: { participants: readonly Finalist[]; maxScore?: number }) {
  const { tx } = useI18n();
  const { judged, waiting, all } = rankFinalists(participants);
  if (all.length === 0) return null;

  return (
    <Card.Root overflow="hidden" borderTopWidth="3px" borderTopColor="gold.500" boxShadow="0 10px 30px -12px rgba(249,151,29,0.45)">
      <Card.Body p={{ base: "4", md: "6" }} gap="4">
        <Flex align="center" justify="space-between" gap="3" wrap="wrap">
          <Flex align="center" gap="2.5">
            <Box color="gold.600">
              <Crown size={22} aria-hidden />
            </Box>
            <Box>
              <Heading size="md" color="brand.900">
                {tx("Final ranking")}
              </Heading>
              <Text fontSize="sm" color="fg.muted">
                {tx("{n} of {total} finalists judged", { n: judged.length, total: all.length })}
              </Text>
            </Box>
          </Flex>
        </Flex>
        <Stack gap="0">
          {all.map(({ p, rank }, i) => (
            <Flex
              key={p.id}
              align="center"
              gap="3"
              py="2.5"
              px="2"
              borderTopWidth={i === 0 ? "0" : "1px"}
              bg={rank === 1 ? "gold.50" : undefined}
              rounded={rank === 1 ? "lg" : undefined}
            >
              <Box w="9" textAlign="center" flexShrink={0}>
                {rank ? <RankBadge rank={rank} /> : <Text color="fg.subtle">—</Text>}
              </Box>
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
                  {p.score !== null && ` · ${tx("Tasfia {n}", { n: p.score })}`}
                </Text>
              </Box>
              <Text fontWeight="bold" fontSize="lg" color={p.finalScore === null ? "fg.subtle" : "brand.900"} fontVariantNumeric="tabular-nums" flexShrink={0}>
                {p.finalScore ?? "—"}
                <Text as="span" fontSize="xs" color="fg.muted" fontWeight="normal">
                  {" "}
                  / {maxScore}
                </Text>
              </Text>
            </Flex>
          ))}
        </Stack>
        {waiting.length > 0 && (
          <Text fontSize="xs" color="fg.muted">
            {tx("A finalist is ranked once every judge has submitted their final sheet.")}
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}
