"use client";

import { Box, chakra, Flex, Text } from "@chakra-ui/react";
import { Octagram } from "@/components/brand/Octagram";

// One closed envelope, drawn with CSS: cream and gold paper, the side and bottom folds, the
// top flap with its shadow, and a navy wax seal with the ۞ star.
// `position` is only its place on the screen (1, 2, 3…), shuffled again for every participant: it is
// not the envelope's real number, so it tells nothing about the questions inside.
export function EnvelopeCard({
  index,
  position,
  label,
  selected,
  faded,
  disabled,
  onPick,
}: {
  index: number;
  position: number;
  label: string;
  selected: boolean;
  faded: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <chakra.button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      position="relative"
      w="full"
      aspectRatio={1.55}
      rounded="xl"
      overflow="hidden"
      bg="linear-gradient(165deg, #F7EAC6 0%, #EDD08A 55%, #DDB25B 100%)"
      cursor="pointer"
      boxShadow={
        selected
          ? "0 0 0 4px #1A234E, 0 0 0 8px #E2C06A, 0 0 60px rgba(226,192,106,0.55), 0 26px 50px rgba(0,0,0,0.5)"
          : "0 14px 30px rgba(0,0,0,0.38), 0 2px 0 rgba(255,255,255,0.35) inset"
      }
      transform={selected ? "translateY(-10px) scale(1.05)" : undefined}
      opacity={faded ? 0.5 : 1}
      transition="transform 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease"
      animation="fade-in 0.5s ease-out both"
      animationDelay={`${Math.min(index, 24) * 60}ms`}
      _hover={disabled || selected ? undefined : { transform: "translateY(-5px)" }}
      _active={disabled ? undefined : { transform: selected ? "translateY(-10px) scale(1.03)" : "scale(0.98)" }}
      _disabled={{ cursor: "pointer" }}
      _focusVisible={{
        outline: "3px solid",
        outlineColor: "white",
        outlineOffset: "4px",
      }}
    >
      {/* Side folds */}
      <Box
        position="absolute"
        inset="0"
        bg="linear-gradient(90deg, #E3BF6C 0%, #EED596 100%)"
        clipPath="polygon(0 0, 52% 56%, 0 100%)"
        aria-hidden
      />
      <Box
        position="absolute"
        inset="0"
        bg="linear-gradient(270deg, #E3BF6C 0%, #EED596 100%)"
        clipPath="polygon(100% 0, 48% 56%, 100% 100%)"
        aria-hidden
      />
      {/* Bottom fold */}
      <Box
        position="absolute"
        inset="0"
        bg="linear-gradient(0deg, #D7A94F 0%, #E8C678 100%)"
        clipPath="polygon(0 100%, 50% 50%, 100% 100%)"
        aria-hidden
      />
      {/* Top flap, with its shadow on the folds below */}
      <Box position="absolute" insetX="0" top="0" h="60%" filter="drop-shadow(0 4px 4px rgba(90,58,8,0.35))" aria-hidden>
        <Box
          w="full"
          h="full"
          bg="linear-gradient(180deg, #FAEFD0 0%, #E9C878 100%)"
          clipPath="polygon(0 0, 100% 0, 50% 100%)"
        />
      </Box>
      {/* A thin gold line along the flap's edges */}
      <Box
        position="absolute"
        insetX="0"
        top="0"
        h="60%"
        bg="rgba(176,128,40,0.55)"
        clipPath="polygon(0 0, 1.2% 0, 50% 97%, 98.8% 0, 100% 0, 50% 100%)"
        aria-hidden
      />
      {/* Wax seal with the ۞ star */}
      <Flex
        position="absolute"
        left="50%"
        top="60%"
        w="24%"
        aspectRatio={1}
        transform="translate(-50%, -50%)"
        rounded="full"
        align="center"
        justify="center"
        color="#E2C06A"
        bg="radial-gradient(circle at 35% 30%, #3E4E92 0%, #23305F 45%, #141B40 100%)"
        borderWidth="3px"
        borderColor={selected ? "#F3DB98" : "#C99A35"}
        boxShadow={
          selected
            ? "0 0 0 4px rgba(226,192,106,0.35), 0 0 24px rgba(226,192,106,0.8), 0 4px 10px rgba(0,0,0,0.45)"
            : "0 4px 10px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.18)"
        }
        transition="box-shadow 0.22s ease, border-color 0.22s ease"
        aria-hidden
      >
        <Box w="62%" aspectRatio={1} display="flex">
          <Octagram size="100%" strokeWidth={2.4} />
        </Box>
      </Flex>
      {/* Its place on the screen, in the top left corner */}
      <Flex
        position="absolute"
        top="7%"
        left="5%"
        w="15%"
        aspectRatio={1}
        rounded="full"
        align="center"
        justify="center"
        bg="rgba(255,255,255,0.55)"
        borderWidth="1.5px"
        borderColor="rgba(140,96,20,0.55)"
        color="#23305F"
        fontFamily="display"
        fontWeight="bold"
        fontSize={{ base: "md", md: "xl", xl: "2xl" }}
        lineHeight="1"
        fontVariantNumeric="tabular-nums"
        aria-hidden
      >
        {position}
      </Flex>
      {/* The same line on every envelope */}
      <Text
        position="absolute"
        insetX="0"
        bottom="7%"
        textAlign="center"
        fontSize={{ base: "2xs", md: "xs", xl: "sm" }}
        fontWeight="semibold"
        letterSpacing="0.22em"
        textTransform="uppercase"
        color="rgba(35,48,95,0.75)"
        aria-hidden
      >
        Musabaqa ·{" "}
        <Text as="span" lang="ar" dir="rtl" fontFamily="arabic" letterSpacing="0" textTransform="none" fontSize="1.15em">
          بسم الله
        </Text>{" "}
        · 1448 H
      </Text>
    </chakra.button>
  );
}
