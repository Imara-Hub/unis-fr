"use client";

import { Badge, Box, Card, Flex, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { CheckCircle2, Hourglass, XCircle } from "lucide-react";
import { ScoreScale } from "@/components/ScoreScale";
import { useI18n } from "@/lib/i18n";

// At most two decimals: the average of the judges is rarely a whole number.
const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

// The participant's final score: a ring that fills up to the score, the verdict against the
// pass mark (and by how much), which judges have sent their sheet, and the 0…max scale.
export function FinalScoreCard({
  score,
  sheetsSubmitted,
  judgeCount,
  maxScore,
  passMark,
}: {
  score: number | null;
  sheetsSubmitted: number;
  judgeCount: number;
  maxScore: number;
  passMark: number;
}) {
  const { tx } = useI18n();
  const scored = score !== null;
  const passed = scored && score >= passMark;
  const palette = !scored ? "gray" : passed ? "green" : "red";
  const delta = scored ? score - passMark : 0;

  return (
    <Card.Root overflow="hidden">
      <Box h="1" bg={!scored ? "gold.300" : passed ? "green.500" : "red.500"} />
      <Card.Body gap="6">
        <Flex gap={{ base: "5", sm: "8" }} align="center" direction={{ base: "column", sm: "row" }}>
          <ScoreRing score={score} maxScore={maxScore} palette={palette} />

          <Stack gap="3" flex="1" minW="0" align={{ base: "center", sm: "flex-start" }} textAlign={{ base: "center", sm: "start" }}>
            <Stack gap="0.5">
              <Heading size="md">{tx("Final score")}</Heading>
              <Text fontSize="sm" color="fg.muted">
                {tx("Average of the {total} judges · {n} of {total} submitted", {
                  total: judgeCount,
                  n: sheetsSubmitted,
                })}
              </Text>
            </Stack>

            <Flex gap="2" align="center" wrap="wrap" justify={{ base: "center", sm: "flex-start" }}>
              <Badge colorPalette={palette} variant="subtle" size="lg" rounded="full" px="3" gap="1.5">
                {!scored ? <Hourglass size={14} aria-hidden /> : passed ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
                {!scored ? tx("Waiting for the judges") : passed ? tx("Passed") : tx("Failed")}
              </Badge>
              {scored && (
                <Text fontSize="sm" color={passed ? "green.700" : "red.700"} fontWeight="medium">
                  {delta > 0
                    ? tx("{n} above the pass mark", { n: fmt(delta) })
                    : delta < 0
                      ? tx("{n} below the pass mark", { n: fmt(-delta) })
                      : tx("Right on the pass mark")}
                </Text>
              )}
            </Flex>

            <JudgeDots submitted={sheetsSubmitted} total={judgeCount} />
          </Stack>
        </Flex>

        <ScoreScale score={score} passMark={passMark} maxScore={maxScore} />
      </Card.Body>
    </Card.Root>
  );
}

function ScoreRing({ score, maxScore, palette }: { score: number | null; maxScore: number; palette: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const ratio = score === null ? 0 : Math.min(1, Math.max(0, score / maxScore));
  const stroke = palette === "gray" ? "var(--chakra-colors-gold-400)" : `var(--chakra-colors-${palette}-500)`;

  return (
    <Box position="relative" boxSize="36" flexShrink="0">
      <svg viewBox="0 0 128 128" width="100%" height="100%" aria-hidden style={{ transform: "rotate(-90deg)" }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--chakra-colors-bg-muted)" strokeWidth="10" />
        {score !== null && (
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        )}
      </svg>
      <Stack position="absolute" inset="0" align="center" justify="center" gap="0">
        <Text fontFamily="display" fontSize="4xl" lineHeight="1" color="brand.900">
          {score === null ? "—" : fmt(score)}
        </Text>
        <Text fontSize="sm" color="fg.muted">
          / {maxScore}
        </Text>
      </Stack>
    </Box>
  );
}

// One pip per judge: filled once their sheet is in.
function JudgeDots({ submitted, total }: { submitted: number; total: number }) {
  return (
    <HStack gap="1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          w="6"
          h="1.5"
          rounded="full"
          bg={i < submitted ? "brand.700" : "bg.muted"}
          borderWidth={i < submitted ? "0" : "1px"}
          borderColor="border"
          transition="background 0.3s"
        />
      ))}
    </HStack>
  );
}
