"use client";

import { Box, Flex, Menu, Portal, Text, type FlexProps } from "@chakra-ui/react";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// Every dropdown in the app looks like the language picker: a white trigger with a gold icon and
// a chevron, opening a card with a gold top edge, a small uppercase title, and the options as rows
// (a round badge, the name, a check on the chosen one).

export interface DropdownOption {
  value: string;
  label: string;
  /** A short code or number in the round badge (e.g. "FR", "1"). */
  badge?: ReactNode;
  /** An icon in the round badge, when there is no code. */
  icon?: ReactNode;
  /** A smaller second line. */
  detail?: ReactNode;
  disabled?: boolean;
}

export function Dropdown({
  value,
  onChange,
  options,
  label,
  icon,
  placeholder,
  size = "md",
  shape = "field",
  portalled = true,
  maxH = "72",
  minW = "56",
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** The card's title, and the trigger's name for screen readers. */
  label: string;
  /** Gold icon in the trigger and in the card's title. */
  icon?: ReactNode;
  /** Shown in the trigger when nothing is chosen. */
  placeholder?: string;
  size?: "sm" | "md";
  /** "pill": round, sized to its text (toolbars). "field": full width, like an input (forms). */
  shape?: "pill" | "field";
  /** Off inside dialogs and popovers, so the list opens within them. */
  portalled?: boolean;
  maxH?: string;
  minW?: string;
} & Omit<FlexProps, "onChange" | "children">) {
  const chosen = options.find((o) => o.value === value);
  const pill = shape === "pill";

  return (
    <Menu.Root
      positioning={{ placement: pill ? "bottom-end" : "bottom-start", gutter: 8, sameWidth: !pill, strategy: portalled ? "absolute" : "fixed" }}
      onSelect={({ value: v }) => onChange(v)}
      lazyMount
      unmountOnExit
    >
      <Menu.Trigger asChild>
        <Flex
          as="button"
          {...{ type: "button" }} // never submits the form it sits in
          aria-label={label}
          align="center"
          gap="2"
          h={size === "sm" ? "9" : "10"}
          ps="3"
          pe="2.5"
          w={pill ? "auto" : "full"}
          minW="0"
          rounded={pill ? "full" : "lg"}
          borderWidth="1px"
          borderColor="blackAlpha.200"
          bg="white"
          color="brand.900"
          fontSize="sm"
          fontWeight="semibold"
          cursor="pointer"
          textAlign="start"
          transition="background 0.15s, border-color 0.15s, box-shadow 0.15s"
          _hover={{ bg: "brand.50", borderColor: "brand.200" }}
          _expanded={{ bg: "brand.50", borderColor: "brand.300", boxShadow: "0 0 0 3px rgba(52,67,127,0.12)" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
          css={{ "&[data-state=open] .dropdown-chevron": { transform: "rotate(180deg)" } }}
          {...rest}
        >
          {icon && (
            <Box as="span" display="inline-flex" color="gold.600" flexShrink={0} aria-hidden>
              {icon}
            </Box>
          )}
          <Text as="span" flex="1" minW="0" truncate color={chosen ? "brand.900" : "fg.muted"} fontWeight={chosen ? "semibold" : "medium"}>
            {chosen?.label ?? placeholder ?? ""}
          </Text>
          <Box as="span" className="dropdown-chevron" display="inline-flex" color="fg.muted" flexShrink={0} transition="transform 0.2s" aria-hidden>
            <ChevronDown size={14} />
          </Box>
        </Flex>
      </Menu.Trigger>
      <MaybePortal on={portalled}>
        <Menu.Positioner>
          <DropdownCard title={label} icon={icon} minW={minW} maxH={maxH}>
            {options.map((o) => {
              const current = o.value === value;
              return (
                <Menu.Item key={o.value} value={o.value} disabled={o.disabled} aria-current={current ? "true" : undefined} {...dropdownItemStyle(current)}>
                  {(o.badge !== undefined || o.icon) && <ItemBadge current={current}>{o.badge ?? o.icon}</ItemBadge>}
                  <Box flex="1" minW="0">
                    <Text fontWeight={current ? "semibold" : "medium"} color="brand.900" truncate>
                      {o.label}
                    </Text>
                    {o.detail && (
                      <Text fontSize="xs" color="fg.muted" truncate>
                        {o.detail}
                      </Text>
                    )}
                  </Box>
                  <Box as="span" display="inline-flex" color="brand.600" visibility={current ? "visible" : "hidden"} aria-hidden>
                    <Check size={16} strokeWidth={2.5} />
                  </Box>
                </Menu.Item>
              );
            })}
          </DropdownCard>
        </Menu.Positioner>
      </MaybePortal>
    </Menu.Root>
  );
}

function MaybePortal({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? <Portal>{children}</Portal> : <>{children}</>;
}

// The card of a dropdown or an actions menu ("⋯"): gold top edge, a small uppercase title, the rows.
export function DropdownCard({
  title,
  icon,
  minW = "56",
  maxH,
  header,
  children,
}: {
  title?: string;
  icon?: ReactNode;
  minW?: string;
  maxH?: string;
  /** In place of the title: a richer header (e.g. the account menu's name and email). */
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Menu.Content minW={minW} p="0" overflow="hidden" rounded="xl" boxShadow="lg" borderTopWidth="2px" borderTopColor="gold.400">
      {header ??
        (title && (
          <Flex align="center" gap="2" px="4" py="2.5" bg="bg.subtle" borderBottomWidth="1px" color="fg.muted">
            {icon && (
              <Box as="span" display="inline-flex" css={{ "& svg": { width: "14px", height: "14px" } }} aria-hidden>
                {icon}
              </Box>
            )}
            <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.12em" truncate>
              {title}
            </Text>
          </Flex>
        ))}
      <Box p="1.5" maxH={maxH} overflowY={maxH ? "auto" : undefined}>
        {children}
      </Box>
    </Menu.Content>
  );
}

// The look of each row, for Menu.Item. tone "danger": red, for Remove / Log out.
export function dropdownItemStyle(current = false, tone: "default" | "danger" = "default") {
  return {
    gap: "3",
    px: "2.5",
    py: "2",
    rounded: "lg",
    cursor: "pointer",
    fontSize: "sm",
    color: tone === "danger" ? "fg.error" : "brand.900",
    bg: current ? "brand.50" : undefined,
    _highlighted: tone === "danger" ? { bg: "bg.error", color: "fg.error" } : { bg: current ? "brand.100" : "bg.muted" },
  } as const;
}

// The round badge at the start of a row: a code, a number or an icon. Navy and gold when chosen.
export function ItemBadge({ children, current = false, tone = "default" }: { children: ReactNode; current?: boolean; tone?: "default" | "danger" }) {
  const danger = tone === "danger";
  return (
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
      fontVariantNumeric="tabular-nums"
      bg={current ? "brand.900" : danger ? "red.50" : "white"}
      color={current ? "gold.300" : danger ? "red.600" : "brand.700"}
      borderWidth="1px"
      borderColor={current ? "brand.900" : danger ? "red.200" : "blackAlpha.200"}
      css={{ "& svg": { width: "15px", height: "15px" } }}
    >
      {children}
    </Flex>
  );
}
