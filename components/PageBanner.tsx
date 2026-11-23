import { Box, Flex, Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { StarLattice } from "@/components/brand/Octagram";

export type BannerStat = { label: string; value: number | string | undefined };
// A count shown as a round progress ring: value out of total.
export type BannerRing = { label: string; value: number | undefined; total: number; color: string };

function Ring({ label, value, total, color }: BannerRing) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const part = value !== undefined && total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <Flex align="center" gap="4" px="4" py="3" pe="6" rounded="full" bg="whiteAlpha.100" borderWidth="1px" borderColor="whiteAlpha.200" backdropFilter="blur(10px)">
      <Box position="relative" w="20" h="20" flexShrink={0}>
        <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden style={{ transform: "rotate(-90deg)" }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - part)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <Flex position="absolute" inset="0" align="center" justify="center">
          <Text fontFamily="display" fontSize="2xl" fontWeight="bold" lineHeight="1" color="white" fontVariantNumeric="tabular-nums">
            {value ?? "·"}
          </Text>
        </Flex>
      </Box>
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color="white" letterSpacing="0.06em" textTransform="uppercase">
          {label}
        </Text>
        <Text fontSize="xs" color="whiteAlpha.700" fontVariantNumeric="tabular-nums">
          {value !== undefined && total > 0 ? `${Math.round(part * 100)}% · ${value} / ${total}` : "—"}
        </Text>
      </Box>
    </Flex>
  );
}
// A state shown as a pill at the top, e.g. "Registration open" (good) / "Registration closed".
export type BannerStatus = { label: string; tone: "good" | "bad" | "neutral" };

const TONES = {
  good: { dot: "#4ade80", bg: "rgba(74,222,128,0.14)", border: "rgba(74,222,128,0.45)" },
  bad: { dot: "#f87171", bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.45)" },
  neutral: { dot: "#a1a1aa", bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.25)" },
};

function StatusPill({ label, tone }: BannerStatus) {
  const t = TONES[tone];
  return (
    <Flex
      align="center"
      gap="2"
      px="3"
      py="1"
      rounded="full"
      bg={t.bg}
      borderWidth="1px"
      borderColor={t.border}
      fontSize="xs"
      fontWeight="semibold"
      color="white"
    >
      <Box w="2" h="2" rounded="full" bg={t.dot} />
      {label}
    </Flex>
  );
}

// Big page title on the blue band with the gold lattice and frame (same look as the overview
// welcome). Optional status pill at the top, figures along the bottom, and actions on the right.
export function PageBanner({
  eyebrow,
  status,
  title,
  description,
  stats,
  actions,
  rings,
}: {
  eyebrow?: string;
  status?: BannerStatus;
  title: string;
  description?: string;
  stats?: BannerStat[];
  actions?: ReactNode;
  rings?: BannerRing[];
}) {
  return (
    <Box
      position="relative"
      overflow="hidden"
      rounded="xl"
      bg="brand.900"
      color="white"
      px={{ base: "6", md: "10" }}
      pt={{ base: "7", md: "10" }}
      pb={{ base: "6", md: "8" }}
      mb={{ base: "6", md: "8" }}
    >
      <Box position="absolute" insetY="0" right="0" w={{ base: "full", md: "50%" }} aria-hidden>
        <StarLattice color="#F9971D" opacity={0.3} />
        <Box
          position="absolute"
          inset="0"
          bg="linear-gradient(to right, #1A234E 0%, rgba(26,35,78,0.6) 45%, rgba(26,35,78,0.15) 100%)"
        />
      </Box>
      <Box position="absolute" inset="2.5" rounded="lg" borderWidth="1px" borderColor="gold.400/50" pointerEvents="none" />

      <Stack position="relative" gap={{ base: "6", md: "8" }}>
        <Flex direction={{ base: "column", md: "row" }} justify="space-between" align={{ md: "flex-end" }} gap="5">
          <Stack gap="2" maxW="2xl">
            {(eyebrow || status) && (
              <Flex align="center" gap="3" wrap="wrap">
                {eyebrow && (
                  <Text fontSize="xs" letterSpacing="0.2em" textTransform="uppercase" color="gold.300">
                    {eyebrow}
                  </Text>
                )}
                {status && <StatusPill {...status} />}
              </Flex>
            )}
            <Heading as="h1" fontFamily="display" fontSize={{ base: "4xl", md: "5xl" }} lineHeight="1.05" letterSpacing="-0.01em">
              {title}
            </Heading>
            {description && (
              <Text color="whiteAlpha.800" fontSize={{ base: "md", md: "lg" }} mt="1">
                {description}
              </Text>
            )}
          </Stack>
          {actions && (
            <Flex gap="3" wrap="wrap" flexShrink={0}>
              {actions}
            </Flex>
          )}
        </Flex>

        {stats && stats.length > 0 && (
          <SimpleGrid
            columns={{ base: Math.min(stats.length, 3), md: stats.length }}
            maxW={{ md: `${stats.length * 12}rem` }}
            gap={{ base: "2", md: "3" }}
          >
            {stats.map((s) => (
              // Small frosted-glass tile on the blue band.
              <Box
                key={s.label}
                px={{ base: "3", md: "4" }}
                py="3"
                rounded="lg"
                bg="whiteAlpha.100"
                backdropFilter="blur(10px) saturate(150%)"
                borderWidth="1px"
                borderColor="whiteAlpha.200"
                boxShadow="inset 0 1px 0 rgba(255,255,255,0.15)"
              >
                <Text fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }} lineHeight="1.1" color="gold.300">
                  {s.value ?? "·"}
                </Text>
                <Text fontSize="xs" color="whiteAlpha.700" letterSpacing="0.06em" textTransform="uppercase">
                  {s.label}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        )}
        {rings && rings.length > 0 && (
          <Flex gap={{ base: "3", md: "4" }} wrap="wrap">
            {rings.map((r) => (
              <Ring key={r.label} {...r} />
            ))}
          </Flex>
        )}
      </Stack>
    </Box>
  );
}
