"use client";

import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

// After a deploy, a page left open (a judge's tablet, the admin's phone, the installed app) still
// runs the version it was opened with. This asks the server which version is live and, when it is
// a newer one, offers "Update": the page reloads on the new version. Nothing to uninstall: the
// installed app is the website, so a reload is all it takes.
// - Asked on opening, every 15 minutes, and when the app comes back to the screen. A tiny answer
//   (a few bytes), fine on 2G; no connection = no question, nothing shown.
// - Never reloads by itself: a judge may be typing marks.
// - Not on the registration form (a reload would lose what is typed; its next opening is new
//   anyway) nor on the stage screen (shown to the audience).
// Production only: in development every save is a new version.
const EVERY_MS = 15 * 60_000;
const BUILT = process.env.APP_VERSION ?? null;

export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const pathname = usePathname();
  const { tx } = useI18n();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !BUILT) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        const { version } = (await res.json()) as { version: string | null };
        if (!stopped && version && version !== BUILT) setReady(true);
      } catch {
        // No connection: asked again later.
      }
    };
    void check();
    const timer = setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);

  if (!ready || pathname.startsWith("/register/") || pathname.startsWith("/stage-screen/")) return null;

  async function update() {
    setUpdating(true);
    // The service worker checks for its own new version too, then the page reloads on the new app.
    const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
    await registration?.update().catch(() => undefined);
    window.location.reload();
  }

  return (
    <Box position="fixed" insetX="0" bottom="0" zIndex="toast" p="3" pb="calc(0.75rem + env(safe-area-inset-bottom))" pointerEvents="none">
      <Flex
        role="status"
        maxW="xl"
        mx="auto"
        align="center"
        gap="3"
        px="4"
        py="3"
        rounded="xl"
        bg="brand.900"
        color="white"
        shadow="lg"
        pointerEvents="auto"
      >
        <Text fontSize="sm" flex="1">
          {tx("A new version of the app is ready.")}
        </Text>
        <Button size="sm" colorPalette="gold" onClick={update} loading={updating} flexShrink={0}>
          <RefreshCw size={15} aria-hidden />
          {tx("Update")}
        </Button>
      </Flex>
    </Box>
  );
}
