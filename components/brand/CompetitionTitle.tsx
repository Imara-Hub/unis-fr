"use client";

import { Box, Text } from "@chakra-ui/react";
import Image from "next/image";
import { editionLine, useBranding } from "@/components/brand/YearBanner";

const NAME =
  "مسابقة بوروندي الكبرى لحفظ القرآن الكريم — Grand concours de mémorisation du Saint Coran au Burundi — Mashindano makubwa ya kuhifadhi Quran tukufu nchini Burundi";

// The competition's title artwork (Arabic calligraphy, French and Swahili), in white:
// for navy backgrounds only. public/title-white.png is 1600×293.
export function CompetitionTitle({ maxW = "full", priority }: { maxW?: string | Record<string, string>; priority?: boolean }) {
  return (
    <Box w="full" maxW={maxW}>
      <Image src="/title-white.png" alt={NAME} width={1600} height={293} priority={priority} style={{ width: "100%", height: "auto" }} />
    </Box>
  );
}

// The public forms' header (registration, results): the title in navy on the white card, no box.
// public/title-navy.png is the same artwork as title-white.png, in the logo's navy.
export function CompetitionBand() {
  // The year's edition line, set by the admin (e.g. "ÉDITION 7 · 1448 H – 2027 M").
  const line = editionLine(useBranding());
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap="2.5" textAlign="center" pb="1">
      <Box w="full" maxW="xl">
        <Image src="/title-navy.png" alt={NAME} width={1600} height={293} priority style={{ width: "100%", height: "auto" }} />
      </Box>
      <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="semibold" letterSpacing="0.18em" color="gold.600" minH="1.5em">
        {line}
      </Text>
      <Box w="16" h="2px" bg="gold.400" rounded="full" />
    </Box>
  );
}
