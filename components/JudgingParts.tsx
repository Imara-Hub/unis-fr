"use client";

import { Badge, Box, Card, Flex, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Cake, GraduationCap, MapPin, User } from "lucide-react";
import { StarLattice } from "@/components/brand/Octagram";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { ageOf } from "@/lib/dates";
import type { ScoringRules } from "@/lib/graphql/judging";
import { useI18n } from "@/lib/i18n";
import { MARK_TYPES } from "@/lib/marks";

export const NAVY_GRADIENT = "linear-gradient(135deg, #23305F 0%, #1A234E 60%, #121A40 100%)";

export { ageOf };

export interface InfoParticipant {
  fullName: string;
  photoUrl: string;
  institution: string;
  commune: string;
  province: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
}

// Who is reciting: photo, name and every detail the judges need, on the navy band.
export function ParticipantInfo({
  participant: p,
  label,
  right,
  compact = false,
}: {
  participant: InfoParticipant;
  label: string;
  right?: React.ReactNode;
  // While marking: one line of facts and a smaller photo, so the sheet comes first.
  compact?: boolean;
}) {
  const { tx } = useI18n();
  if (compact) {
    const facts = [
      { icon: Cake, text: tx("{n} years", { n: ageOf(p.dateOfBirth) }) },
      { icon: User, text: p.gender === "MALE" ? tx("Boy") : tx("Girl") },
      { icon: GraduationCap, text: p.institution },
      { icon: MapPin, text: `${p.commune}, ${p.province}` },
    ];
    return (
      <Box position="relative" overflow="hidden" bg={NAVY_GRADIENT} color="white">
        <Box position="absolute" insetY="0" right="0" w={{ base: "full", md: "50%" }} aria-hidden>
          <StarLattice color="#C99A35" opacity={0.2} />
          <Box position="absolute" inset="0" bg="linear-gradient(to right, #1A234E 0%, rgba(26,35,78,0.6) 50%, rgba(26,35,78,0.15) 100%)" />
        </Box>
        <Flex position="relative" gap={{ base: "4", md: "5" }} align="center" wrap="wrap" px={{ base: "4", md: "7" }} py={{ base: "4", md: "5" }}>
          <Box p="1" rounded="lg" bg="linear-gradient(160deg, #F3DB98, #C99A35)" boxShadow="0 6px 16px rgba(0,0,0,0.35)" flexShrink={0}>
            <ParticipantPhoto path={p.photoUrl} size="medium" />
          </Box>
          <Stack gap="2" flex="1" minW="56">
            <Flex align="center" gap="2" alignSelf="flex-start" px="2.5" py="0.5" rounded="full" bg="red.500/20" borderWidth="1px" borderColor="red.400/60">
              <Box w="2" h="2" rounded="full" bg="red.400" animation="pulse 1.4s ease-in-out infinite" />
              <Text fontSize="2xs" fontWeight="bold" letterSpacing="0.16em" textTransform="uppercase" color="red.100">
                {label}
              </Text>
            </Flex>
            <Heading as="h1" fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }} lineHeight="1.1">
              {p.fullName}
            </Heading>
            <Flex gap="1.5" wrap="wrap">
              {facts.map(({ icon: Icon, text }) => (
                <Flex key={text} align="center" gap="1.5" px="2.5" py="1" rounded="full" bg="whiteAlpha.100" borderWidth="1px" borderColor="whiteAlpha.200" fontSize="xs">
                  <Icon size={13} color="#E2C06A" aria-hidden />
                  <Text>{text}</Text>
                </Flex>
              ))}
            </Flex>
          </Stack>
          {right}
        </Flex>
      </Box>
    );
  }
  const facts: [string, string][] = [
    [tx("Age"), tx("{n} years", { n: ageOf(p.dateOfBirth) })],
    [tx("Gender"), p.gender === "MALE" ? tx("Boy") : tx("Girl")],
    [tx("Halaqa"), p.institution],
    [tx("Commune"), p.commune],
    [tx("Province"), p.province],
  ];
  return (
    <Box bg={NAVY_GRADIENT} color="white" px={{ base: "5", md: "7" }} py={{ base: "5", md: "6" }}>
      <Flex gap={{ base: "4", md: "6" }} align={{ base: "flex-start", md: "center" }} direction={{ base: "column", sm: "row" }}>
        <ParticipantPhoto path={p.photoUrl} size="large" />
        <Stack gap="3" flex="1" minW="0">
          <Box>
            <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.16em" textTransform="uppercase" color="gold.300">
              {label}
            </Text>
            <Heading as="h1" fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }} lineHeight="1.15">
              {p.fullName}
            </Heading>
          </Box>
          <SimpleGrid columns={{ base: 2, md: 3 }} gap="2.5" maxW="2xl">
            {facts.map(([label, value]) => (
              <Box key={label} minW="0">
                <Text fontSize="xs" color="whiteAlpha.700">
                  {label}
                </Text>
                <Text fontWeight="semibold" truncate>
                  {value}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Stack>
        {right}
      </Flex>
    </Box>
  );
}

// The 3 questions of a drawn envelope.
export function EnvelopeQuestions({ number, questions }: { number: number; questions: string[] }) {
  const { tx } = useI18n();
  return (
    <Stack gap="3">
      <Text fontSize="sm" fontWeight="semibold" color="gold.700" letterSpacing="0.12em" textTransform="uppercase">
        {tx("Envelope {n}", { n: number })}
      </Text>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
        {questions.map((q, i) => (
          <Box key={i} rounded="xl" borderWidth="1px" borderColor="gold.200" bg="gold.50" p="4">
            <Text fontSize="xs" color="gold.800" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.08em">
              {tx("Question {n}", { n: i + 1 })}
            </Text>
            <Text fontFamily="display" fontSize={{ base: "lg", md: "xl" }} color="brand.900" mt="1">
              {q}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

// The ALAMA sheet rules, as printed on paper.
export function RulesCard({ rules: r }: { rules: ScoringRules }) {
  const { tx } = useI18n();
  // Fath, Tanbih, Tajweed, Kusita: the same order and colours as on the judges' sheet.
  const rows = MARK_TYPES.map((t) => ({ sign: t.sign, name: t.name, palette: t.palette, text: tx(t.rule), points: t.penalty(r) }));
  return (
    <Card.Root>
      <Card.Body p={{ base: "4", md: "6" }} gap="4">
        <Heading size="sm" color="brand.900">
          {tx("How the sheet is marked (Alama)")}
        </Heading>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="3">
          {rows.map((row) => (
            <Flex key={row.sign} gap="3" align="center" p="3" rounded="lg" bg="bg.subtle">
              <Flex w="10" h="10" rounded="lg" bg={`${row.palette}.100`} align="center" justify="center" fontWeight="bold" fontSize="xl" color={`${row.palette}.700`} flexShrink={0}>
                {row.sign}
              </Flex>
              <Box minW="0">
                <Text fontWeight="semibold" color="brand.900">
                  {row.name}{" "}
                  <Badge colorPalette="red" variant="subtle">
                    −{row.points}
                  </Badge>
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {row.text}
                </Text>
              </Box>
            </Flex>
          ))}
        </SimpleGrid>
        <Stack gap="1" fontSize="sm" color="fg.muted">
          <Text>• {tx("Each question is worth {n} points. Every mistake counts.", { n: r.questionPoints })}</Text>
          <Text>• {tx("Kusita: each time the participant hesitates (ku sita), 1 point is taken off. It never deletes the question.")}</Text>
          <Text>• {tx("Reminder number {n} (●) deletes the question: it gets 0 and you move on to the next one.", { n: r.fathLimit })}</Text>
          <Text>
            • {tx("{n} questions of {points} points, plus {presence} for being present: total 100.", {
              n: r.questions,
              points: r.questionPoints,
              presence: r.presencePoints,
            })}
          </Text>
          <Text>
            • {tx("The voice (sauti, out of {sauti}) is inside the questions: a third in each. A deleted question loses its third too.", {
              sauti: r.sautiMax,
            })}
          </Text>
          <Text>• {tx("The final score is the average of all the judges’ sheets.")}</Text>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
