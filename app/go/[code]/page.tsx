"use client";

import { useApolloClient, useMutation } from "@apollo/client/react";
import { Button, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthCard, FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { googleSignInAvailable } from "@/components/GoogleSignIn";
import { readApiError } from "@/lib/errors";
import { LOGIN_WITH_LINK } from "@/lib/graphql/auth";
import { useI18n } from "@/lib/i18n";
import { setSessionToken } from "@/lib/sessionToken";
import { setViewedSeason } from "@/lib/season";

export default function LoginLinkPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const client = useApolloClient();
  const { tx, apiError } = useI18n();
  const [loginWithLink] = useMutation(LOGIN_WITH_LINK);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Once per opening (development renders effects twice).
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await loginWithLink({ variables: { code: decodeURIComponent(code) } });
        if (!res.data?.loginWithLink.user) throw new Error("Not logged in");
        setSessionToken(res.data.loginWithLink.token);
        setViewedSeason(null); // a new login starts in the current year
        // Nothing loaded for whoever used this browser before is kept for the new login.
        await client.clearStore();
        // Replaced, so the link is not left in this tab's history.
        router.replace("/dashboard");
      } catch (err) {
        setError(apiError(readApiError(err)).message);
      }
    })();
  }, [code, loginWithLink, client, router, apiError]);

  if (!error) return <FullPageSpinner />;

  return (
    <AuthCard panel title={tx("Login link")}>
      <Stack gap="5">
        <ErrorAlert message={error} />
        <Text fontSize="sm" color="fg.muted">
          {googleSignInAvailable()
            ? tx("If you also have a password or a Google account for Musabaqa, you can log in with it instead.")
            : tx("If you also have a password for Musabaqa, you can log in with it instead.")}
        </Text>
        <Button asChild colorPalette="brand">
          <NextLink href="/login" replace>
            {tx("Go to the login page")}
          </NextLink>
        </Button>
      </Stack>
    </AuthCard>
  );
}
