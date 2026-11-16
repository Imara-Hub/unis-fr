"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

// Google's "Sign in with Google" button (Google Identity Services). Google shows its own button
// in our box; when the person picks an account, Google hands us an ID token that the API checks
// (loginWithGoogle, signupWithGoogle, acceptStaffInvitationWithGoogle). Nothing without
// NEXT_PUBLIC_GOOGLE_CLIENT_ID: the pages then only have the password form.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleId {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: "popup"; itp_support?: boolean }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

export const googleSignInAvailable = () => Boolean(CLIENT_ID);

let scriptPromise: Promise<GoogleId> | null = null;

function loadGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error("Google script empty")));
    script.onerror = () => {
      scriptPromise = null; // try again next time
      reject(new Error("Google script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Google's locale codes for our languages (Kirundi is not one of them: French, the closest).
const LOCALES: Record<string, string> = { en: "en", fr: "fr", sw: "sw", rn: "fr" };

export function GoogleSignIn({
  onCredential,
  text = "signin_with",
  disabled = false,
}: {
  onCredential: (idToken: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Google keeps the callback from initialize(); the ref always points at the latest one.
  const callback = useRef(onCredential);
  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);
  const { lang, t } = useI18n();

  useEffect(() => {
    if (!CLIENT_ID || !box.current) return;
    const parent = box.current;
    let cancelled = false;
    loadGoogle()
      .then((id) => {
        if (cancelled) return;
        id.initialize({ client_id: CLIENT_ID, callback: (r) => callback.current(r.credential), ux_mode: "popup", itp_support: true });
        parent.replaceChildren();
        id.renderButton(parent, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "left",
          width: Math.min(Math.max(parent.offsetWidth, 200), 400),
          locale: LOCALES[lang] ?? "en",
        });
      })
      .catch(() => {
        // No Google (offline, blocked): the password form is still there.
      });
    return () => {
      cancelled = true;
    };
  }, [lang, text]);

  if (!CLIENT_ID) return null;

  return (
    <Box>
      <Flex align="center" gap="3" mb="4" color="fg.muted" fontSize="sm">
        <Box flex="1" h="1px" bg="border" />
        <Text>{t.google.or}</Text>
        <Box flex="1" h="1px" bg="border" />
      </Flex>
      <Flex justify="center" pointerEvents={disabled ? "none" : "auto"} opacity={disabled ? 0.6 : 1}>
        <Box ref={box} w="full" maxW="400px" minH="44px" display="flex" justifyContent="center" />
      </Flex>
    </Box>
  );
}
