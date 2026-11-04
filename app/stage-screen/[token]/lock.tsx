"use client";

import { Box, Button, Circle, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { Expand, Lock, LockOpen, Maximize } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

// The stage screen is a tablet in the participant's hands: it runs full screen and "locked".
// A web page cannot stop the tablet's home button, but it can: go full screen, keep the screen
// awake, block the back button, zoom, long-press menus and accidental reloads, and come back to
// full screen with one tap. The admin unlocks it by holding the logo for 3 seconds.
// For a hardware lock too, use Guided Access (iPad) or Screen pinning (Android).

type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const fullscreenElement = () => document.fullscreenElement ?? (document as FullscreenDoc).webkitFullscreenElement ?? null;
const canFullscreen = () => {
  const el = document.documentElement as FullscreenEl;
  return Boolean(el.requestFullscreen ?? el.webkitRequestFullscreen);
};
// Opened from the home screen icon: the browser bars are already gone.
const isInstalled = () =>
  window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function enterFullscreen() {
  const el = document.documentElement as FullscreenEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else await el.webkitRequestFullscreen?.();
  } catch {
    // Refused (not from a tap, or not allowed): the screen still works, just with the browser bars.
  }
}

async function exitFullscreen() {
  const doc = document as FullscreenDoc;
  try {
    if (!fullscreenElement()) return;
    if (document.exitFullscreen) await document.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    // Already out.
  }
}

export function useScreenLock() {
  const [locked, setLocked] = useState(false);
  const [full, setFull] = useState(false);
  const [env, setEnv] = useState({ supported: true, installed: false });

  useEffect(() => {
    const update = () => setFull(Boolean(fullscreenElement()));
    // Read once in the browser (these do not exist while the page is built on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({ supported: canFullscreen(), installed: isInstalled() });
    update();
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  // While locked: no back button, no reload without a warning, no zoom, no long-press menu,
  // and the screen never goes to sleep.
  useEffect(() => {
    if (!locked) return;
    history.pushState({ stageScreenLock: true }, "");
    const stayHere = () => history.pushState({ stageScreenLock: true }, "");
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const noMenu = (e: Event) => e.preventDefault();
    const noPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    window.addEventListener("popstate", stayHere);
    window.addEventListener("beforeunload", warn);
    document.addEventListener("contextmenu", noMenu);
    document.addEventListener("gesturestart", noMenu); // iPad pinch zoom
    document.addEventListener("touchmove", noPinch, { passive: false });

    let wakeLock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Not allowed (battery saver, old browser): the tablet's own sleep setting applies.
      }
    };
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);

    return () => {
      window.removeEventListener("popstate", stayHere);
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("contextmenu", noMenu);
      document.removeEventListener("gesturestart", noMenu);
      document.removeEventListener("touchmove", noPinch);
      document.removeEventListener("visibilitychange", keepAwake);
      void wakeLock?.release();
    };
  }, [locked]);

  const start = useCallback(async () => {
    await enterFullscreen();
    setLocked(true);
  }, []);
  const unlock = useCallback(async () => {
    setLocked(false);
    await exitFullscreen();
  }, []);

  // Locked but out of full screen (swipe, Escape key): ask for one tap to go back.
  const needsFullscreen = locked && env.supported && !env.installed && !full;
  return { locked, needsFullscreen, fullscreenSupported: env.supported, installed: env.installed, start, unlock, resume: enterFullscreen };
}

// Covers the whole screen: before starting, and whenever full screen was left while locked.
export function LockOverlay({
  mode,
  fullscreenSupported,
  installed,
  onStart,
  languagePicker,
}: {
  mode: "start" | "resume";
  fullscreenSupported: boolean;
  installed: boolean;
  onStart: () => void;
  languagePicker: ReactNode;
}) {
  const { tx } = useI18n();
  return (
    <Flex
      position="fixed"
      inset="0"
      zIndex="overlay"
      direction="column"
      align="center"
      justify="center"
      px="6"
      bg="rgba(15,20,48,0.94)"
      backdropFilter="blur(6px)"
      color="white"
      textAlign="center"
      onClick={mode === "resume" ? onStart : undefined}
    >
      {mode === "start" && (
        <Box position="absolute" top="calc(16px + env(safe-area-inset-top))" right="calc(16px + env(safe-area-inset-right))">
          {languagePicker}
        </Box>
      )}
      <Stack align="center" gap="5" maxW="lg">
        <Circle size="20" bg="whiteAlpha.100" borderWidth="1px" borderColor="whiteAlpha.200" color="gold.300">
          {mode === "start" ? <Lock size={34} aria-hidden /> : <Expand size={34} aria-hidden />}
        </Circle>
        <Heading as="h1" fontFamily="display" fontSize={{ base: "2xl", md: "4xl" }} lineHeight="1.2">
          {mode === "start" ? tx("Stage screen") : tx("Tap to go back to full screen")}
        </Heading>
        {mode === "start" ? (
          <>
            <Text fontSize={{ base: "md", md: "lg" }} color="whiteAlpha.800">
              {tx("Starting opens full screen and locks this tablet for the participants: no menus, no going back, the screen stays on.")}
            </Text>
            <Button size="2xl" colorPalette="gold" color="brand.900" px="10" onClick={onStart}>
              <Maximize size={22} aria-hidden />
              {tx("Start the stage screen")}
            </Button>
            {!fullscreenSupported && !installed && (
              <Text fontSize="sm" color="gold.200">
                {tx("This browser cannot go full screen. Add this page to the home screen (Share, then “Add to Home Screen”) and open it from there.")}
              </Text>
            )}
            <Text fontSize="sm" color="whiteAlpha.600">
              {tx("To unlock: hold the logo for 3 seconds. For a full lock, also turn on Guided Access (iPad) or Screen pinning (Android).")}
            </Text>
          </>
        ) : (
          <Text fontSize="lg" color="whiteAlpha.800">
            {tx("The stage screen left full screen.")}
          </Text>
        )}
      </Stack>
    </Flex>
  );
}

// Wraps the logo: holding it 3 seconds asks whether to unlock. Nothing shows while holding,
// so participants do not discover it by accident.
export function HoldToUnlock({ enabled, onUnlock, children }: { enabled: boolean; onUnlock: () => void; children: ReactNode }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const { tx } = useI18n();
  const cancel = () => clearTimeout(timer.current);

  useEffect(() => cancel, []);

  return (
    <>
      <Box
        onPointerDown={() => {
          if (!enabled) return;
          cancel();
          timer.current = setTimeout(() => setAsking(true), 3000);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        css={{ WebkitTouchCallout: "none" }}
      >
        {children}
      </Box>
      {asking && (
        <Flex position="fixed" inset="0" zIndex="modal" align="center" justify="center" px="6" bg="rgba(15,20,48,0.85)">
          <Stack bg="white" color="brand.900" rounded="2xl" p="7" gap="5" maxW="sm" textAlign="center" align="center" boxShadow="2xl">
            <Circle size="14" bg="brand.50" color="brand.700">
              <LockOpen size={26} aria-hidden />
            </Circle>
            <Heading size="lg">{tx("Unlock the stage screen?")}</Heading>
            <Text color="fg.muted">{tx("Full screen and the lock end. Only for the organisers.")}</Text>
            <Flex gap="3" w="full" direction="column">
              <Button
                size="lg"
                colorPalette="brand"
                onClick={() => {
                  setAsking(false);
                  onUnlock();
                }}
              >
                {tx("Unlock")}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setAsking(false)}>
                {tx("Stay locked")}
              </Button>
            </Flex>
          </Stack>
        </Flex>
      )}
    </>
  );
}
