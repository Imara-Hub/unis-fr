"use client";

import { Box, Center, Flex, Grid, Heading, Stack, Text } from "@chakra-ui/react";
import Image from "next/image";
import type { ReactNode } from "react";
import { CompetitionTitle } from "@/components/brand/CompetitionTitle";
import { Logo } from "@/components/brand/Logo";
import { LOADING_DELAY_MS } from "@/components/Delayed";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { Octagram, StarLattice } from "@/components/brand/Octagram";

type AuthCardProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  wide?: boolean;
  footer?: ReactNode;
  // Shown above the title, e.g. the competition banner on the registration form.
  top?: ReactNode;
  // Login and invite: the illuminated navy panel beside the form (a band on top on phones).
  panel?: boolean;
  children: ReactNode;
};

// Public pages (login, signup, invite, registration): a rounded glass card on the page glow,
// with the copyright at the bottom. With `panel`, the card is split: navy panel left, form right.
export function AuthCard({ panel = false, ...props }: AuthCardProps) {
  return panel ? <WithPanel {...props} /> : <Plain {...props} />;
}

function Plain({ wide = false, ...props }: Omit<AuthCardProps, "panel">) {
  return (
    <Flex minH="100dvh" direction="column" align="center" p={{ base: "0", md: "6", xl: "10" }}>
      {/* The language button at the very top of the page, above the card. */}
      <Flex w="full" maxW={wide ? "3xl" : "lg"} justify="flex-end" px={{ base: "4", md: "0" }} pt={{ base: "3", md: "0" }} pb={{ base: "3", md: "3" }}>
        <LanguageSwitcher />
      </Flex>
      <Flex
        flex={{ base: "1", md: "initial" }}
        as="main"
        direction="column"
        w="full"
        maxW={wide ? "3xl" : "lg"}
        layerStyle="glass"
        bg="glass.strong"
        rounded={{ base: "none", md: "3xl" }}
        borderWidth={{ base: "0", md: "1px" }}
        borderTopWidth="3px"
        borderTopColor="gold.400"
        px={{ base: "5", sm: "8", md: "10" }}
        pt={{ base: "7", md: "9" }}
        pb="6"
        // Comes in softly after the loading screen instead of popping in.
        animation="fade-in 0.4s ease-out, slide-from-bottom 0.4s ease-out"
        _motionReduce={{ animation: "none" }}
      >
        <Content {...props} />
        <Copyright pt="8" />
      </Flex>
    </Flex>
  );
}

function WithPanel(props: Omit<AuthCardProps, "panel">) {
  return (
    <Flex minH="100dvh" align="center" justify="center" p={{ base: "0", md: "6", xl: "10" }}>
      <Grid
        w="full"
        maxW="6xl"
        minH={{ base: "100dvh", md: "auto", lg: "min(46rem, calc(100dvh - 5rem))" }}
        templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
        layerStyle="glass"
        bg="glass.strong"
        rounded={{ base: "none", md: "3xl" }}
        borderWidth={{ base: "0", md: "1px" }}
        p={{ base: "0", md: "3.5" }}
        gap={{ base: "0", lg: "3.5" }}
        animation="fade-in 0.4s ease-out, slide-from-bottom 0.4s ease-out"
        _motionReduce={{ animation: "none" }}
      >
        <IlluminatedPanel />

        <Flex as="main" direction="column" px={{ base: "5", sm: "8", lg: "12", xl: "16" }} pt={{ base: "4", lg: "5" }} pb="6" minW="0">
          <TopBar />
          <Flex flex="1" align={{ base: "flex-start", lg: "center" }} py={{ base: "2", lg: "4" }}>
            <Box w="full" maxW="md" mx={{ base: "auto", lg: "0" }}>
              <Content {...props} />
            </Box>
          </Flex>
          <Copyright pt="6" />
        </Flex>
      </Grid>
    </Flex>
  );
}

function Content({ eyebrow, title, subtitle, footer, top, children }: Omit<AuthCardProps, "panel" | "wide">) {
  return (
    <Stack w="full" gap="7" css={AUTH_FIELDS}>
      {top}
      <Stack gap="2">
        {eyebrow && (
          <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.18em" textTransform="uppercase" color="gold.600">
            {eyebrow}
          </Text>
        )}
        <Heading
          as="h1"
          fontFamily="display"
          fontSize={{ base: "2xl", md: "3xl" }}
          lineHeight="1.15"
          letterSpacing="-0.01em"
          color="brand.900"
        >
          {title}
        </Heading>
        {subtitle && <Text color="fg.muted">{subtitle}</Text>}
      </Stack>
      {children}
      {footer && (
        <Box fontSize="sm" color="fg.muted" textAlign="center">
          {footer}
        </Box>
      )}
    </Stack>
  );
}

// Every public page (login, signup, invite, registration) can switch language, from the top corner.
function TopBar() {
  return (
    <Flex justify="flex-end" mb="4" mr={{ lg: "-6", xl: "-10" }}>
      <LanguageSwitcher />
    </Flex>
  );
}

function Copyright({ pt }: { pt: string }) {
  return (
    <Text fontSize="xs" color="fg.subtle" textAlign="center" pt={pt} mt="auto">
      © {new Date().getFullYear()} UNIS · Union des Initiatives Solidaires
    </Text>
  );
}

// The quiet filled fields of the login look: light grey, white with a navy ring when focused.
const AUTH_FIELDS = {
  "& label": { fontSize: "sm", color: "fg.muted", fontWeight: "medium" },
  "& input:not([type=checkbox]):not([type=radio]):not([type=file]), & textarea, & select": {
    bg: "#F3F4F8",
    borderColor: "#E6E8F0",
    borderRadius: "lg",
    transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
  },
  "& input:not([type=checkbox]):not([type=radio]):focus, & textarea:focus, & select:focus": {
    bg: "white",
    borderColor: "brand.500",
    boxShadow: "0 0 0 3px rgba(58,76,140,0.15)",
  },
  "& [aria-invalid=true]": { borderColor: "red.400" },
};

// The design of the competition's cover: royal blue with a gold frame, the Bismillah, the UNIS
// badge and the association's name, the competition title, and the Quran at the bottom.
function IlluminatedPanel() {
  return (
    <Box
      position="relative"
      overflow="hidden"
      bg="radial-gradient(ellipse at 50% 55%, #123A9C 0%, #0B2A80 40%, #0A1D5C 100%)"
      color="white"
      rounded={{ base: "none", md: "2xl" }}
      roundedBottom="2xl"
      minH={{ base: "44", lg: "auto" }}
    >
      {/* The star pattern, only at the top, fading out. */}
      <Box position="absolute" insetX="0" top="0" h="45%" css={{ maskImage: "linear-gradient(to bottom, black, transparent)" }}>
        <StarLattice color="#8FA6E0" opacity={0.16} />
      </Box>
      <Box position="absolute" inset={{ base: "2.5", lg: "4" }} rounded="xl" borderWidth="2px" borderColor="gold.400" pointerEvents="none" />

      {/* Phones: a short band with the badge and the title. */}
      <Flex
        position="relative"
        display={{ base: "flex", lg: "none" }}
        h="full"
        minH="44"
        direction="column"
        align="center"
        justify="center"
        gap="3"
        px="8"
        py="7"
      >
        <Badge size={60} />
        <CompetitionTitle maxW="xs" priority />
      </Flex>

      {/* Computers */}
      <Flex
        position="relative"
        display={{ base: "none", lg: "flex" }}
        h="full"
        direction="column"
        align="center"
        justify="space-between"
        textAlign="center"
        px={{ lg: "12", xl: "16" }}
        py="12"
        gap="6"
      >
        {/* The calligraphic Bismillah ligature (﷽), as on the competition's cover. */}
        <Text lang="ar" fontFamily="bismillah" fontSize="3xl" lineHeight="1.4" whiteSpace="nowrap" aria-label="بسم الله الرحمن الرحيم">
          {"﷽"}
        </Text>
        <Stack align="center" gap="5">
          <Badge size={150} />
          <Text fontSize="sm" fontStyle="italic" letterSpacing="0.06em" color="whiteAlpha.900">
            ASSOCIATION « UNION DES INITIATIVES SOLIDAIRES »
          </Text>
        </Stack>
        <CompetitionTitle maxW="md" priority />
        <Image src="/quran-white.png" alt="" width={225} height={247} style={{ width: 104, height: "auto" }} />
      </Flex>
    </Box>
  );
}

// The UNIS badge on a white disc, so it reads on the blue.
function Badge({ size }: { size: number }) {
  return (
    <Center bg="white" rounded="full" p="1" boxShadow="0 10px 30px rgba(0,0,0,0.35)">
      <Logo size={size} priority />
    </Center>
  );
}

// The loading screen: the logo, breathing, inside a slowly turning gold star (۞).
// "Loading…" only fades in if loading takes a while, so fast loads stay calm.
export function FullPageSpinner() {
  const { tx } = useI18n();
  return (
    <Center minH="100dvh" flexDirection="column" gap="5" role="status" aria-busy aria-label={tx("Loading…")}>
      <Center position="relative" boxSize="32" animation="scale-in 0.35s ease-out" _motionReduce={{ animation: "none" }}>
        <Box
          position="absolute"
          inset="0"
          color="gold.400"
          opacity={0.55}
          animation="spin 12s linear infinite"
          _motionReduce={{ animation: "none" }}
        >
          <Octagram size="100%" strokeWidth={0.6} />
        </Box>
        <Box animation="pulse 1.6s ease-in-out infinite" _motionReduce={{ animation: "none" }}>
          <Logo size={72} priority />
        </Box>
      </Center>
      <Text
        fontSize="sm"
        fontWeight="medium"
        letterSpacing="0.08em"
        color="fg.muted"
        animation="fade-in 0.4s ease-out both"
        animationDelay={`${LOADING_DELAY_MS}ms`}
        _motionReduce={{ animation: "none" }}
      >
        {tx("Loading…")}
      </Text>
    </Center>
  );
}
