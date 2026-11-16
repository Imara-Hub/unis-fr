"use client";

import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Share, Smartphone, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";

// "Install the app" card at the top of every page after login, until it is installed or dismissed.
//
// Android and desktop Chrome/Edge announce that the site can be installed with a
// `beforeinstallprompt` event; we keep it and offer one button. iPhone and iPad never announce
// anything, so there we spell out the two taps. Already installed (opened from the home screen):
// nothing. Other browsers that announce nothing: nothing either, rather than guessing their menus.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "install-hint-dismissed";

// The event fires early, often before this component mounts: it is kept here, at module level.
let installEvent: BeforeInstallPromptEvent | null = null;
let installed = false;
let dismissedHere = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // no browser mini-bar: our card is the prompt
    installEvent = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    installEvent = null;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type Platform = "ios" | "other";

interface Snapshot {
  standalone: boolean;
  dismissed: boolean;
  platform: Platform;
  canPrompt: boolean;
}

const SERVER: Snapshot = { standalone: true, dismissed: true, platform: "other", canPrompt: false };

let snapshot: Snapshot | null = null;

function read(): Snapshot {
  const standalone =
    installed ||
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
  let dismissed = dismissedHere;
  try {
    dismissed ||= localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // private window: dismissed for this tab only (dismissedHere)
  }
  // iPad with a desktop user agent: a Mac that has touch points is an iPad.
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const next: Snapshot = { standalone, dismissed, platform: ios ? "ios" : "other", canPrompt: installEvent !== null };
  // Same values → same object, so React does not re-render for nothing.
  if (
    snapshot &&
    snapshot.standalone === next.standalone &&
    snapshot.dismissed === next.dismissed &&
    snapshot.platform === next.platform &&
    snapshot.canPrompt === next.canPrompt
  ) {
    return snapshot;
  }
  snapshot = next;
  return next;
}

function dismiss() {
  dismissedHere = true;
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // private window: forgotten when the tab closes
  }
  emit();
}

export function InstallPrompt() {
  const state = useSyncExternalStore(subscribe, read, () => SERVER);
  const { tx } = useI18n();

  if (state.standalone || state.dismissed) return null;
  if (state.platform !== "ios" && !state.canPrompt) return null;

  async function install() {
    const event = installEvent;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    installEvent = null; // a prompt event can be used once
    if (outcome === "accepted") installed = true;
    emit();
  }

  return (
    <Flex
      role="region"
      aria-label={tx("Install the app")}
      align={{ base: "flex-start", md: "center" }}
      gap="3"
      mb="5"
      px="4"
      py="3"
      rounded="lg"
      bg="brand.50"
      borderWidth="1px"
      borderColor="brand.100"
      direction={{ base: "column", md: "row" }}
    >
      <Flex align="center" gap="3" flex="1" minW="0">
        <Box color="brand.700" flexShrink={0}>
          <Smartphone size={22} aria-hidden />
        </Box>
        <Box minW="0">
          <Text fontWeight="semibold" color="brand.900" fontSize="sm">
            {tx("Install Musabaqa on this device")}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {state.platform === "ios"
              ? tx("Tap Share (the square with an arrow), then “Add to Home Screen”. You stay logged in there.")
              : tx("Opens full screen from your home screen, and you stay logged in.")}
          </Text>
        </Box>
      </Flex>
      <Flex gap="2" flexShrink={0} alignSelf={{ base: "flex-end", md: "auto" }}>
        {state.platform === "ios" ? (
          <Flex align="center" gap="1.5" color="brand.700" fontSize="sm" fontWeight="medium" px="2">
            <Share size={16} aria-hidden />
            {tx("Share")}
          </Flex>
        ) : (
          <Button size="sm" colorPalette="brand" onClick={install}>
            {tx("Install")}
          </Button>
        )}
        <Button size="sm" variant="ghost" colorPalette="gray" onClick={dismiss} aria-label={tx("Not now")}>
          <X size={16} aria-hidden />
          <Box display={{ base: "none", md: "inline" }}>{tx("Not now")}</Box>
        </Button>
      </Flex>
    </Flex>
  );
}
