"use client";

import { Box, Flex, Menu, Portal, Text } from "@chakra-ui/react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";

// The language picker, in the dashboard's top bar and on the public pages.
// A small pill (icon + "FR") opens a card listing each language named in its own language,
// so people find theirs whatever is shown now.
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <Menu.Root
      positioning={{ placement: "bottom-end", gutter: 10 }}
      onSelect={({ value }) => setLang(value as Lang)}
    >
      <Menu.Trigger asChild>
        <Flex
          as="button"
          aria-label={t.language}
          align="center"
          gap="1.5"
          h="9"
          ps="2.5"
          pe="2"
          rounded="full"
          borderWidth="1px"
          borderColor="blackAlpha.200"
          bg="white"
          color="brand.900"
          fontSize="sm"
          fontWeight="semibold"
          letterSpacing="0.06em"
          cursor="pointer"
          transition="background 0.15s, border-color 0.15s, box-shadow 0.15s"
          _hover={{ bg: "brand.50", borderColor: "brand.200" }}
          _expanded={{ bg: "brand.50", borderColor: "brand.300", boxShadow: "0 0 0 3px rgba(52,67,127,0.12)" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
        >
          <Box as="span" display="inline-flex" color="gold.600" aria-hidden>
            <Languages size={16} strokeWidth={2} />
          </Box>
          <Text as="span" textTransform="uppercase">
            {lang}
          </Text>
          <Box as="span" display="inline-flex" color="fg.muted" aria-hidden>
            <ChevronDown size={14} />
          </Box>
        </Flex>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="56" p="0" overflow="hidden" rounded="xl" boxShadow="lg">
            <Flex
              align="center"
              gap="2"
              px="4"
              py="2.5"
              bg="bg.subtle"
              borderTopWidth="2px"
              borderTopColor="gold.400"
              borderBottomWidth="1px"
              color="fg.muted"
            >
              <Languages size={14} aria-hidden />
              <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.12em">
                {t.language}
              </Text>
            </Flex>
            <Box p="1.5">
              {LANGUAGES.map((l) => {
                const current = l.code === lang;
                return (
                  <Menu.Item
                    key={l.code}
                    value={l.code}
                    lang={l.code}
                    aria-current={current ? "true" : undefined}
                    gap="3"
                    px="2.5"
                    py="2"
                    rounded="lg"
                    cursor="pointer"
                    bg={current ? "brand.50" : undefined}
                    _highlighted={{ bg: current ? "brand.100" : "bg.muted" }}
                  >
                    {/* The language code as a small round badge; navy and gold for the chosen one. */}
                    <Flex
                      align="center"
                      justify="center"
                      boxSize="8"
                      flexShrink={0}
                      rounded="full"
                      fontSize="2xs"
                      fontWeight="bold"
                      letterSpacing="0.08em"
                      textTransform="uppercase"
                      bg={current ? "brand.900" : "white"}
                      color={current ? "gold.300" : "brand.700"}
                      borderWidth="1px"
                      borderColor={current ? "brand.900" : "blackAlpha.200"}
                    >
                      {l.code}
                    </Flex>
                    <Text flex="1" fontWeight={current ? "semibold" : "medium"} color="brand.900">
                      {l.name}
                    </Text>
                    <Box as="span" display="inline-flex" color="brand.600" visibility={current ? "visible" : "hidden"} aria-hidden>
                      <Check size={16} strokeWidth={2.5} />
                    </Box>
                  </Menu.Item>
                );
              })}
            </Box>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
