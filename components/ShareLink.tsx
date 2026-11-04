"use client";

import { Alert, Box, Button, Flex, QrCode, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { useI18n } from "@/lib/i18n";

// Is this a link only this computer can open? Then phones that receive it will fail.
export function isLocalLink(url: string) {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

// A link to share: the address, Copy, Share on WhatsApp, and optionally a QR code to scan.
export function ShareLink({ url, message, qr = false }: { url: string; message: string; qr?: boolean }) {
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`;
  const { tx } = useI18n();

  return (
    <Stack gap="4">
      <Flex gap="5" direction={{ base: "column", md: "row" }} align={{ md: "center" }}>
        {qr && (
          <Box p="2" bg="white" rounded="md" borderWidth="1px" alignSelf={{ base: "center", md: "auto" }} flexShrink={0}>
            <QrCode.Root value={url} size="lg" encoding={{ ecc: "M" }}>
              <QrCode.Frame>
                <QrCode.Pattern />
              </QrCode.Frame>
              <QrCode.DownloadTrigger asChild fileName="registration-link-qr.png" mimeType="image/png">
                <Button size="2xs" variant="ghost" w="full" mt="1" colorPalette="brand">
                  {tx("Download QR")}
                </Button>
              </QrCode.DownloadTrigger>
            </QrCode.Root>
          </Box>
        )}

        <Stack gap="3" flex="1" minW="0">
          <Box
            px="4"
            py="3"
            rounded="md"
            bg="bg.subtle"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="gold.400"
            fontSize="sm"
            fontWeight="medium"
            color="brand.900"
            wordBreak="break-all"
          >
            {url}
          </Box>
          <Flex gap="2" wrap="wrap">
            <CopyButton value={url} colorPalette="brand" icon={<CopyIcon />}>
              {tx("Copy link")}
            </CopyButton>
            <Button asChild variant="outline" colorPalette="green">
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <WhatsAppIcon />
                {tx("Share on WhatsApp")}
              </a>
            </Button>
          </Flex>
        </Stack>
      </Flex>

      {isLocalLink(url) && <LocalLinkWarning />}
    </Stack>
  );
}

// Explains why a localhost link will not work on phones, and how to fix it.
function LocalLinkWarning(): ReactNode {
  const { tx } = useI18n();
  return (
    <Alert.Root status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{tx("This link works only on this computer")}</Alert.Title>
        <Alert.Description>
          {tx("It starts with “localhost”. Phones need the computer’s network address (testing) or your domain (online). Set FRONTEND_URL in the API’s .env file and restart the API.")}
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
}

// Icons (lucide)
function CopyIcon() {
  return <Copy size={16} aria-hidden />;
}
function WhatsAppIcon() {
  return <MessageCircle size={16} aria-hidden />;
}
