"use client";

import { Badge, Box, chakra, createListCollection, Flex, Portal, Select, Text } from "@chakra-ui/react";
import { useMemo, type ReactNode, type RefObject } from "react";

export interface RichOption {
  value: string;
  /** Shown in the closed box once chosen, and read by screen readers. */
  label: string;
  /** Left: a number in a gold circle. */
  badge?: string | number;
  title: ReactNode;
  /** A second, smaller line under the title. */
  detail?: ReactNode;
  /** Right: an Arabic name, in the Arabic font. */
  arabic?: string;
  /** A small tag after the title (e.g. "start", "end"). */
  tag?: string;
  disabled?: boolean;
}

// A dropdown whose options are small cards (number, name, detail, Arabic), for the question picker.
export function RichSelect({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
  maxH = "72",
  portalContainer,
}: {
  options: RichOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  maxH?: string;
  /** Inside a dialog: its content, so the list opens in the dialog. */
  portalContainer?: RefObject<HTMLElement | null>;
}) {
  const collection = useMemo(
    () =>
      createListCollection({
        items: options,
        itemToString: (o) => o.label,
        itemToValue: (o) => o.value,
        isItemDisabled: (o) => Boolean(o.disabled),
      }),
    [options],
  );
  const chosen = options.find((o) => o.value === value);

  return (
    <Select.Root
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(e) => e.value[0] && onChange(e.value[0])}
      disabled={disabled}
      size="md"
      positioning={{ sameWidth: true, gutter: 4 }}
      // The list exists only while open: lighter (an ayah list can hold 286 options, times 3
      // questions) and nothing hidden is rendered on the server, where its styles did not match.
      lazyMount
      unmountOnExit
    >
      <Select.HiddenSelect aria-label={ariaLabel} />
      <Select.Control>
        <Select.Trigger
          aria-label={ariaLabel}
          bg="white"
          rounded="lg"
          borderColor="blackAlpha.200"
          minH="11"
          pe="10" // room for the arrow
          transition="background 0.15s, border-color 0.15s, box-shadow 0.15s"
          _hover={{ bg: "brand.50", borderColor: "brand.200" }}
          _expanded={{ bg: "brand.50", borderColor: "brand.300", boxShadow: "0 0 0 3px rgba(52,67,127,0.12)" }}
          _focusVisible={{ borderColor: "brand.300", boxShadow: "0 0 0 3px rgba(52,67,127,0.12)" }}
        >
          {chosen ? (
            <Flex align="center" gap="2.5" minW="0" flex="1" textAlign="start">
              {chosen.badge !== undefined && <NumberBadge value={chosen.badge} />}
              <Text truncate flex="1" fontWeight="semibold" color="brand.900" fontSize="sm">
                {chosen.label}
              </Text>
              {chosen.arabic && <Arabic text={chosen.arabic} />}
            </Flex>
          ) : (
            <Text color="fg.muted" fontSize="sm">
              {placeholder}
            </Text>
          )}
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal container={portalContainer}>
        <Select.Positioner>
          <Select.Content p="0" overflow="hidden" rounded="xl" boxShadow="lg" borderTopWidth="2px" borderTopColor="gold.400">
            <Flex align="center" px="4" py="2.5" bg="bg.subtle" borderBottomWidth="1px" color="fg.muted">
              <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.12em" truncate>
                {ariaLabel}
              </Text>
            </Flex>
            <Box maxH={maxH} overflowY="auto" p="1.5">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                item={o}
                rounded="lg"
                px="2.5"
                py="2"
                gap="3"
                cursor="pointer"
                _highlighted={{ bg: "bg.muted" }}
                _checked={{ bg: "brand.50" }}
              >
                {o.badge !== undefined && <NumberBadge value={o.badge} />}
                <Box flex="1" minW="0">
                  <Flex align="center" gap="2">
                    <Text fontWeight="semibold" color="brand.900" fontSize="sm" truncate>
                      {o.title}
                    </Text>
                    {o.tag && (
                      <Badge size="xs" variant="subtle" bg="gold.100" color="gold.800" rounded="full">
                        {o.tag}
                      </Badge>
                    )}
                  </Flex>
                  {o.detail && (
                    <Text fontSize="xs" color="fg.muted" truncate>
                      {o.detail}
                    </Text>
                  )}
                </Box>
                {o.arabic && <Arabic text={o.arabic} />}
                <Select.ItemIndicator color="brand.600" />
              </Select.Item>
            ))}
            </Box>
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}

function NumberBadge({ value }: { value: string | number }) {
  return (
    <Flex
      flexShrink={0}
      minW="7"
      h="7"
      px="1.5"
      align="center"
      justify="center"
      rounded="full"
      bg="brand.900"
      color="gold.300"
      fontSize="xs"
      fontWeight="bold"
      fontVariantNumeric="tabular-nums"
    >
      {value}
    </Flex>
  );
}

function Arabic({ text, ms }: { text: string; ms?: string }) {
  return (
    <chakra.span lang="ar" dir="rtl" ms={ms} flexShrink={0} fontFamily="var(--font-arabic), serif" fontSize="md" color="gold.800" lineHeight="1">
      {text}
    </chakra.span>
  );
}
