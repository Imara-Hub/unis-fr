"use client";

import { Box, Text } from "@chakra-ui/react";
import { useI18n } from "@/lib/i18n";

// The points on a 0…max line, with the gold pass-mark line: you see at once how far
// above or below the pass mark a participant is.
export function ScoreScale({
  score,
  passMark,
  maxScore,
}: {
  score: number | null;
  passMark: number;
  maxScore: number;
}) {
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / maxScore) * 100))}%`;
  const passed = score !== null && score >= passMark;
  const { tx } = useI18n();

  return (
    <Box pt="2" aria-hidden>
      <Box position="relative" h="2.5" rounded="full" bg="bg.muted">
        {score !== null && (
          <Box
            position="absolute"
            insetY="0"
            left="0"
            w={pct(score)}
            rounded="full"
            bg={passed ? "green.500" : "red.500"}
            transition="width 0.35s ease, background 0.35s"
            _motionReduce={{ transition: "none" }}
          />
        )}
        <Box position="absolute" top="-1.5" bottom="-1.5" left={pct(passMark)} w="0.5" bg="gold.500" transform="translateX(-50%)" />
      </Box>
      <Box position="relative" h="5" mt="2" fontSize="xs" color="fg.muted">
        <Text position="absolute" left="0">
          0
        </Text>
        <Text
          position="absolute"
          left={pct(passMark)}
          transform="translateX(-50%)"
          color="gold.700"
          fontWeight="medium"
          whiteSpace="nowrap"
        >
          {tx("Pass mark {n}", { n: passMark })}
        </Text>
        <Text position="absolute" right="0">
          {maxScore}
        </Text>
      </Box>
    </Box>
  );
}
