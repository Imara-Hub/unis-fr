"use client";

import { Box, Flex, IconButton, Input, InputGroup, Stack, Text, VisuallyHidden, type InputProps } from "@chakra-ui/react";
import { useState } from "react";
import { Check, Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Password field with a show/hide eye button.
export function PasswordInput(props: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  return (
    <InputGroup
      startElement={<LockIcon />}
      endElement={
        <IconButton
          aria-label={visible ? t.password.hide : t.password.show}
          aria-pressed={visible}
          size="xs"
          variant="ghost"
          color="fg.muted"
          me="-2"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </IconButton>
      }
    >
      <Input {...props} type={visible ? "text" : "password"} />
    </InputGroup>
  );
}

export const MIN_PASSWORD_LENGTH = 10;

const LEVELS = [
  { key: "fair", color: "orange.400", track: "orange.50" },
  { key: "good", color: "green.500", track: "green.50" },
  { key: "strong", color: "green.600", track: "green.50" },
] as const;

// Live feedback while choosing a new password: a bar that fills towards the 10 characters
// (counting down what is left), then shows how strong the password is, with the checks that
// make it stronger lighting up as they are met. The 10 characters are the only rule.
export function PasswordStrength({ value }: { value: string }) {
  const { t } = useI18n();
  const p = t.password;
  const length = value.length;
  const longEnough = length >= MIN_PASSWORD_LENGTH;
  const checks = [
    { label: p.minChars(MIN_PASSWORD_LENGTH), met: longEnough, required: true },
    { label: p.cases, met: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { label: p.number, met: /\d/.test(value) },
    { label: p.symbol, met: /[^A-Za-z0-9\s]/.test(value) },
    { label: p.minChars(14), met: length >= 14 },
  ];
  const extras = checks.filter((c) => !c.required && c.met).length;
  const level = LEVELS[Math.min(2, extras >= 3 ? 2 : extras >= 1 ? 1 : 0)]!;
  const left = MIN_PASSWORD_LENGTH - length;

  // Before 10 characters the bar measures the length (up to 40 %); after, the strength.
  const pct = longEnough ? 40 + Math.round((extras / 4) * 60) : Math.round((length / MIN_PASSWORD_LENGTH) * 40);
  const color = !longEnough ? (length === 0 ? "gray.300" : "brand.500") : level.color;
  const label = length === 0 ? p.atLeast(MIN_PASSWORD_LENGTH) : !longEnough ? p.more(left) : p[level.key];

  return (
    <Stack gap="2.5" mt="2">
      <Flex align="center" gap="3">
        <Box
          flex="1"
          h="1.5"
          rounded="full"
          bg={longEnough ? level.track : "blackAlpha.100"}
          overflow="hidden"
          role="meter"
          aria-label={p.meter}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={label}
        >
          <Box h="full" w={`${pct}%`} rounded="full" bg={color} transition="width 0.35s ease, background 0.35s" _motionReduce={{ transition: "none" }} />
        </Box>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color={longEnough ? level.color : length === 0 ? "fg.muted" : "brand.600"}
          whiteSpace="nowrap"
          fontVariantNumeric="tabular-nums"
          aria-live="polite"
        >
          {label}
        </Text>
      </Flex>

      <Flex gap="1.5" wrap="wrap" aria-label={p.checks}>
        {checks.map((c) => (
          <Flex
            key={c.label}
            align="center"
            gap="1"
            ps="1"
            pe="2"
            py="0.5"
            rounded="full"
            fontSize="xs"
            fontWeight="medium"
            borderWidth="1px"
            transition="all 0.2s"
            bg={c.met ? "green.50" : "white"}
            borderColor={c.met ? "green.200" : c.required ? "brand.200" : "blackAlpha.100"}
            color={c.met ? "green.700" : c.required ? "brand.700" : "fg.muted"}
          >
            <Flex
              align="center"
              justify="center"
              boxSize="4"
              rounded="full"
              bg={c.met ? "green.500" : "transparent"}
              borderWidth={c.met ? "0" : "1.5px"}
              borderColor={c.required ? "brand.300" : "blackAlpha.200"}
              color="white"
              transition="all 0.2s"
              aria-hidden
            >
              {c.met && <Check size={10} strokeWidth={3.5} />}
            </Flex>
            <span>{c.label}</span>
            <VisuallyHidden>{` (${c.met ? p.done : c.required ? p.required : p.optional})`}</VisuallyHidden>
          </Flex>
        ))}
      </Flex>
    </Stack>
  );
}

// Icons (lucide)
export function MailIcon() {
  return <Mail size={16} aria-hidden />;
}
export function UserIcon() {
  return <UserRound size={16} aria-hidden />;
}
function LockIcon() {
  return <Lock size={16} aria-hidden />;
}
function EyeIcon() {
  return <Eye size={16} aria-hidden />;
}
function EyeOffIcon() {
  return <EyeOff size={16} aria-hidden />;
}
