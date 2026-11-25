"use client";

import { Alert } from "@chakra-ui/react";
import { useI18n } from "@/lib/i18n";
import { useOffline } from "@/lib/offlineCopies";

// Said at the top while the page shows the answers kept on the device (no connection): what is
// on screen is from that time, and what is done now waits on the device (lib/offlineCopies.ts).
export function OfflineBanner({ kind, mb = "5" }: { kind: "desk" | "form" | "page"; mb?: string }) {
  const since = useOffline();
  const { tx, lang } = useI18n();
  if (since === null) return null;
  const time = new Date(since).toLocaleTimeString(lang === "en" ? "en-GB" : lang, { hour: "2-digit", minute: "2-digit" });
  return (
    <Alert.Root status="warning" mb={mb}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{tx("No connection: showing what was loaded at {time}.", { time })}</Alert.Title>
        <Alert.Description>
          {kind === "desk"
            ? tx("Your marks are kept on this device and sent by themselves when the connection is back.")
            : kind === "form"
              ? tx("You can fill in the form: it is kept on this phone and sent by itself when the connection is back.")
              : tx("Changes need the connection: try again once it is back.")}
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
}
