"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Alert, Button, Input, InputGroup, Link, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthCard, FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { MailIcon, PasswordInput } from "@/components/PasswordInput";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";
import { LOGIN, ME, SIGNUP_OPEN } from "@/lib/graphql/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  // Coming from an invitation: the new account's email, and a word that it is ready.
  const params = useSearchParams();
  const justCreated = params.get("created") === "1";
  const { t, apiError } = useI18n();
  const me = useQuery(ME);
  const client = useApolloClient();
  // Always asked fresh: a cached "open" from before the admin existed must not redirect.
  const signupOpen = useQuery(SIGNUP_OPEN, { fetchPolicy: "network-only" });
  const firstRun = signupOpen.data?.signupOpen === true;
  const [login, { loading }] = useMutation(LOGIN, {
    refetchQueries: [{ query: ME }],
    awaitRefetchQueries: true,
  });

  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  // Already logged in: go straight to the dashboard. Nobody has an account yet (first time the
  // app is opened, empty database): create the admin account first.
  // Coming from an invitation, the form shows even if someone is logged in here: they stay
  // logged in until the new person logs in (and only on this browser).
  const someoneHere = me.data?.me ?? null;
  const stay = justCreated && Boolean(someoneHere);
  useEffect(() => {
    if (someoneHere && !justCreated) router.replace("/dashboard");
    else if (!someoneHere && firstRun) router.replace("/signup");
  }, [someoneHere, justCreated, firstRun, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login({ variables: { email, password } });
      // Nothing loaded for whoever used this browser before is kept for the new login.
      await client.clearStore();
      router.replace("/dashboard");
    } catch (err) {
      setError(apiError(readApiError(err)).message);
      setPassword("");
    }
  }

  // Wait for both answers so the login form never flashes before the signup redirect.
  // If the signup check fails, show the login form anyway.
  if (me.loading || (someoneHere && !stay) || signupOpen.loading || (firstRun && !someoneHere)) return <FullPageSpinner />;

  return (
    <AuthCard
      panel
      eyebrow={GREETING}
      title={t.login.title}
      subtitle={t.login.subtitle}
      footer={t.login.footer}
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="5">
          {justCreated && !error && (
            <Alert.Root status="success" rounded="lg">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t.login.accountCreated}</Alert.Title>
                <Alert.Description>
                  {t.login.accountCreatedHelp}
                  {someoneHere && ` ${t.login.stillLoggedIn(someoneHere.name)}`}
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}
          <ErrorAlert message={error} />

          <FormField label={t.common.email}>
            <InputGroup startElement={<MailIcon />}>
              <Input
                type="email"
                autoComplete="email"
                placeholder={t.common.emailPlaceholder}
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={!justCreated}
              />
            </InputGroup>
          </FormField>

          <FormField
            label={t.common.password}
            labelEnd={
              <Link
                as="button"
                type="button"
                fontSize="sm"
                fontWeight="semibold"
                color="brand.600"
                aria-expanded={showForgot}
                onClick={() => setShowForgot((v) => !v)}
              >
                {t.login.forgot}
              </Link>
            }
          >
            <PasswordInput
              autoComplete="current-password"
              size="lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          {showForgot && (
            <Text fontSize="sm" color="fg.muted" bg="brand.50" rounded="lg" px="3.5" py="2.5">
              {t.login.forgotHelp}
            </Text>
          )}

          <Button type="submit" colorPalette="brand" size="lg" loading={loading} disabled={!email || !password}>
            {t.login.submit}
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
