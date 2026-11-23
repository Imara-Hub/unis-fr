"use client";

import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { Copy, Link2 } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { GREETING } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";

// A temporary password the admin passes on (new account, or forgotten password): big and
// copyable, with Copy and WhatsApp. Shown once: the server never keeps it in clear.
// When loginUrl is set (entry link or /login?email=…), it is shown and included in WhatsApp
// so the person opens the app straight on the login page.
export function TemporaryPassword({
  password,
  name,
  email,
  loginUrl,
  note,
}: {
  password: string;
  name: string;
  email?: string | null;
  loginUrl?: string | null;
  note: string;
}) {
  const { tx } = useI18n();
  const first = name.split(" ")[0]!;
  const lines = [
    `${GREETING} ${first}!`,
    loginUrl ? tx("Open this link to log in to Musabaqa:") : null,
    loginUrl ?? null,
    email ? tx("Your Musabaqa account: {email}", { email }) : tx("Your new temporary password for Musabaqa:"),
    email ? tx("Temporary password: {password}", { password }) : password,
    tx("Keep it for yourself. If you forget it, ask the admin."),
  ].filter((line): line is string => Boolean(line));
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;

  return (
    <Stack gap="3">
      {loginUrl && (
        <Stack gap="2">
          <Text fontSize="sm" fontWeight="medium" color="brand.900">
            {tx("Login link")}
          </Text>
          <Flex
            gap="2"
            align="center"
            px="3"
            py="2"
            rounded="md"
            bg="bg.subtle"
            borderWidth="1px"
            fontSize="sm"
            wordBreak="break-all"
          >
            <Link2 size={16} aria-hidden style={{ flexShrink: 0 }} />
            <Text flex="1" color="brand.900">
              {loginUrl}
            </Text>
            <CopyButton value={loginUrl} size="xs" variant="ghost" colorPalette="brand" icon={<Copy size={14} aria-hidden />}>
              {tx("Copy link")}
            </CopyButton>
          </Flex>
        </Stack>
      )}
      <Box
        px="4"
        py="3"
        rounded="md"
        bg="bg.subtle"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="gold.400"
        fontFamily="mono"
        fontSize="2xl"
        fontWeight="semibold"
        color="brand.900"
        textAlign="center"
        letterSpacing="0.08em"
        userSelect="all"
      >
        {password}
      </Box>
      <Flex gap="2" wrap="wrap">
        <CopyButton value={password} colorPalette="brand" icon={<Copy size={16} aria-hidden />}>
          {tx("Copy password")}
        </CopyButton>
        <Button asChild variant="outline" colorPalette="green">
          <a href={whatsapp} target="_blank" rel="noreferrer">
            <WhatsAppIcon />
            {tx("Send on WhatsApp")}
          </a>
        </Button>
      </Flex>
      <Text fontSize="sm" color="fg.muted">
        {note}
      </Text>
    </Stack>
  );
}
