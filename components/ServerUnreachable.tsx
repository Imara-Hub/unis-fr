"use client";

import { Box, Button, Center, Heading, Stack, Text } from "@chakra-ui/react";
import { Logo } from "@/components/brand/Logo";
import { useI18n } from "@/lib/i18n";

// Full-page message with a retry button: the API did not answer, or a page crashed.
export function ServerUnreachable({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <Center minH="100dvh" bg="bg.subtle" px="4">
      <Stack align="center" textAlign="center" gap="4" maxW="md">
        <Logo size={64} />
        <Box w="12" h="1px" bg="gold.400" />
        <Heading size="lg" color="brand.900">
          {title ?? t.serverUnreachable.title}
        </Heading>
        <Text color="fg.muted">{message ?? t.serverUnreachable.message}</Text>
        <Button colorPalette="brand" onClick={onRetry}>
          {t.common.tryAgain}
        </Button>
      </Stack>
    </Center>
  );
}
