"use client";

import { Box, Center, Flex, Grid, Heading, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { StarLattice } from "@/components/brand/Octagram";

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
    <Flex minH="100dvh" justify="center" align={{ base: "stretch", md: "flex-start" }} p={{ base: "0", md: "6", xl: "10" }}>
      <Flex
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
        mt={{ md: "4", xl: "6" }}
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
      >
        <IlluminatedPanel />

        <Flex as="main" direction="column" px={{ base: "5", sm: "8", lg: "12", xl: "16" }} pt={{ base: "7", lg: "10" }} pb="6" minW="0">
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
      {/* Every public page (login, signup, invite, registration) can switch language. */}
      <Flex justify="flex-end" mb="-4">
        <LanguageSwitcher />
      </Flex>
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

// Deep logo blue, gold star lattice and a gold frame like the opening page of a Mushaf:
// Bismillah, the UNIS badge, the headline, and the gold مسابقة at the bottom.
function IlluminatedPanel() {
  const { t } = useI18n();
  return (
    <Box
      position="relative"
      overflow="hidden"
      bg="linear-gradient(160deg, #23305F 0%, #1A234E 50%, #121A40 100%)"
      color="white"
      rounded={{ base: "none", md: "2xl" }}
      roundedBottom="2xl"
      minH={{ base: "44", lg: "auto" }}
    >
      <StarLattice color="#C99A35" opacity={0.28} />
      {/* Calm the pattern behind the words. */}
      <Box
        position="absolute"
        inset="0"
        bg="linear-gradient(180deg, rgba(26,35,78,0.35) 0%, rgba(26,35,78,0.92) 45%, rgba(18,26,64,0.75) 100%)"
      />
      <Box position="absolute" inset="3" rounded="xl" borderWidth="1px" borderColor="gold.400/50" pointerEvents="none" />

      {/* Phones: a short band with the logo and name. */}
      <Flex
        position="relative"
        display={{ base: "flex", lg: "none" }}
        h="full"
        minH="44"
        direction="column"
        align="center"
        justify="center"
        gap="1"
      >
        <Flex align="center" gap="3">
          <Logo size={48} priority />
          <Text fontFamily="display" fontSize="2xl" letterSpacing="0.06em">
            UNIS
          </Text>
        </Flex>
        <Text lang="ar" dir="rtl" fontFamily="arabic" fontWeight="bold" fontSize="2xl" color="gold.300">
          مسابقة
        </Text>
      </Flex>

      {/* Computers */}
      <Flex
        position="relative"
        display={{ base: "none", lg: "flex" }}
        h="full"
        direction="column"
        justify="space-between"
        px={{ lg: "10", xl: "14" }}
        py="12"
        gap="8"
      >
        <Stack gap="6">
          <Text lang="ar" dir="rtl" fontFamily="arabic" fontSize="xl" color="gold.300" textAlign="center" opacity={0.9}>
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </Text>
          <Stack align="center" gap="2">
            <Logo size={120} priority />
            <Text fontFamily="display" fontSize="2xl" letterSpacing="0.16em">
              UNIS
            </Text>
          </Stack>
          <Stack gap="5">
            <Box w="12" h="1px" bg="gold.400" />
            <Heading as="p" fontFamily="display" fontSize={{ lg: "4xl", xl: "5xl" }} lineHeight="1.1" letterSpacing="-0.015em">
              {t.panel.headline}
            </Heading>
            <Text fontSize="md" color="whiteAlpha.800" maxW="sm">
              {t.panel.text}
            </Text>
          </Stack>
        </Stack>

        <Box>
          <Text lang="ar" dir="rtl" fontFamily="arabic" fontWeight="bold" fontSize="6xl" lineHeight="1.2" color="gold.300">
            مسابقة
          </Text>
          <Text fontSize="xs" letterSpacing="0.3em" textTransform="uppercase" color="whiteAlpha.700">
            {t.panel.tagline}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

export function FullPageSpinner() {
  return (
    <Center minH="100dvh" aria-label="Loading">
      <Box animation="pulse 1.6s ease-in-out infinite" _motionReduce={{ animation: "none" }}>
        <Logo size={72} priority />
      </Box>
    </Center>
  );
}
