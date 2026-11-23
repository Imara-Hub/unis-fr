"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Button, Input, InputGroup, Stack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { MailIcon, MIN_PASSWORD_LENGTH, PasswordInput, PasswordStrength, UserIcon } from "@/components/PasswordInput";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";
import { ME, SIGNUP, SIGNUP_OPEN, SIGNUP_WITH_GOOGLE } from "@/lib/graphql/auth";
import { setSessionToken } from "@/lib/sessionToken";
import { setViewedSeason } from "@/lib/season";

type FormState = { name: string; email: string; password: string; confirm: string };
const EMPTY: FormState = { name: "", email: "", password: "", confirm: "" };

// Open only until the first account exists; that first account is the admin. On a fresh install
// every page leads here (see the login page); once the admin exists, this page only redirects to login.
export default function SignupPage() {
  const router = useRouter();
  const client = useApolloClient();
  const { t, apiError } = useI18n();
  const signupOpen = useQuery(SIGNUP_OPEN, { fetchPolicy: "network-only" });
  const [signup, { loading }] = useMutation(SIGNUP, {
    // Not SIGNUP_OPEN: its "closed" answer would redirect this page to login while it goes to the
    // dashboard. Both pages ask it fresh from the server anyway.
    refetchQueries: [{ query: ME }],
    awaitRefetchQueries: true,
  });
  const [signupWithGoogle, { loading: googleLoading }] = useMutation(SIGNUP_WITH_GOOGLE, {
    refetchQueries: [{ query: ME }],
    awaitRefetchQueries: true,
  });
  const busy = loading || googleLoading;
  const closed = signupOpen.data?.signupOpen === false;

  useEffect(() => {
    if (closed && !busy) router.replace("/login");
  }, [closed, busy, router]);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const confirmMismatch = form.confirm.length > 0 && form.confirm !== form.password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (form.password !== form.confirm) {
      setFieldErrors({ confirm: t.common.passwordsDontMatch });
      return;
    }
    try {
      const { name, email, password } = form;
      const res = await signup({ variables: { input: { name, email, password } } });
      setSessionToken(res.data?.signup.token);
      setViewedSeason(null);
      await client.clearStore();
      router.replace("/dashboard");
    } catch (err) {
      const failure = apiError(readApiError(err));
      setError(failure.message);
      setFieldErrors(failure.fields);
    }
  }

  async function onGoogle(idToken: string) {
    setError(null);
    setFieldErrors({});
    try {
      const res = await signupWithGoogle({ variables: { idToken } });
      setSessionToken(res.data?.signupWithGoogle.token);
      setViewedSeason(null);
      await client.clearStore();
      router.replace("/dashboard");
    } catch (err) {
      setError(apiError(readApiError(err)).message);
    }
  }

  if (signupOpen.loading) return <FullPageSpinner />;

  // No answer from the API is not the same as "closed": say so, and let them retry.
  if (signupOpen.error) {
    return (
      <ServerUnreachable
        message={apiError(readApiError(signupOpen.error)).message}
        onRetry={() => void signupOpen.refetch()}
      />
    );
  }

  // The admin already exists: on the way to login.
  if (!signupOpen.data?.signupOpen) return <FullPageSpinner />;

  return (
    // Same split card as the login page: the illuminated panel beside the form.
    <AuthCard
      panel
      eyebrow={GREETING}
      title={t.signup.title}
      subtitle={t.signup.subtitle}
      footer={t.signup.footer}
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="5">
          <ErrorAlert message={error} />

          <FormField label={t.common.fullName} error={fieldErrors.name}>
            <InputGroup startElement={<UserIcon />}>
              <Input autoComplete="name" size="lg" value={form.name} onChange={set("name")} autoFocus />
            </InputGroup>
          </FormField>

          <FormField label={t.common.email} error={fieldErrors.email}>
            <InputGroup startElement={<MailIcon />}>
              <Input
                type="email"
                autoComplete="email"
                size="lg"
                placeholder={t.common.emailPlaceholder}
                value={form.email}
                onChange={set("email")}
              />
            </InputGroup>
          </FormField>

          <FormField
            label={t.common.password}
            error={fieldErrors.password}
          >
            <PasswordInput autoComplete="new-password" size="lg" value={form.password} onChange={set("password")} />
            {!fieldErrors.password && <PasswordStrength value={form.password} />}
          </FormField>

          <FormField
            label={t.common.repeatPassword}
            error={fieldErrors.confirm ?? (confirmMismatch ? t.common.passwordsDontMatch : undefined)}
            helper={form.confirm && !confirmMismatch ? t.common.passwordsMatch : undefined}
          >
            <PasswordInput autoComplete="new-password" size="lg" value={form.confirm} onChange={set("confirm")} />
          </FormField>

          <Button
            type="submit"
            colorPalette="brand"
            size="lg"
            loading={busy}
            disabled={!form.name || !form.email || form.password.length < MIN_PASSWORD_LENGTH || !form.confirm || confirmMismatch}
          >
            {t.signup.submit}
          </Button>

          <GoogleSignIn onCredential={onGoogle} text="signup_with" disabled={busy} />
        </Stack>
      </form>
    </AuthCard>
  );
}
