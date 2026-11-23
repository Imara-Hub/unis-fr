"use client";

import { Button, Flex } from "@chakra-ui/react";
import { Copy } from "lucide-react";
import { useSyncExternalStore } from "react";
import { CopyButton } from "@/components/CopyButton";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { GREETING } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";

const noSubscribe = () => () => {};

// The full address of a personal login link. The API gives a path (/go/<code>); the web app's own
// address goes in front, the one the admin is using (so not "localhost" when they use the LAN or
// the domain). Empty during the server render.
export function useLoginLinkUrl(path: string | null | undefined) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  return path && origin ? new URL(path, origin).toString() : null;
}

// Copy and "Send on WhatsApp" for a judge's or staff member's personal login link. Always
// available on the Team page: nothing is "shown once".
export function LoginLinkActions({
  name,
  path,
  size = "sm",
  stretch = false,
}: {
  name: string;
  path: string;
  size?: "xs" | "sm" | "md";
  stretch?: boolean;
}) {
  const { tx } = useI18n();
  const url = useLoginLinkUrl(path);
  if (!url) return null;

  const first = name.split(" ")[0]!;
  const message = [
    `${GREETING} ${first}!`,
    tx("Open this link to log in to Musabaqa:"),
    url,
    tx("Keep this link to yourself: it logs you in without a password."),
  ].join("\n");
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <Flex gap="2" wrap="wrap" w={stretch ? "full" : undefined}>
      <CopyButton value={url} size={size} variant="outline" colorPalette="brand" flex={stretch ? "1" : undefined} icon={<Copy size={14} aria-hidden />}>
        {tx("Copy link")}
      </CopyButton>
      <Button asChild size={size} variant="outline" colorPalette="green" flex={stretch ? "1" : undefined}>
        <a href={whatsapp} target="_blank" rel="noreferrer" aria-label={tx("Send {name}’s login link on WhatsApp", { name: first })}>
          <WhatsAppIcon />
          WhatsApp
        </a>
      </Button>
    </Flex>
  );
}
