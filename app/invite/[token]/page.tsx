"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Button, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { MailIcon, MIN_PASSWORD_LENGTH, PasswordInput, PasswordStrength, UserIcon } from "@/components/PasswordInput";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";
import { LOGIN, ME } from "@/lib/graphql/auth";
import { ACCEPT_STAFF_INVITATION, INVITATION_CHECK, type InvitableRole } from "@/lib/graphql/staff";

type FormState = { name: string; email: string; password: string; confirm: string };
const EMPTY: FormState = { name: "", email: "", password: "", confirm: "" };

export default function InvitePage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Invite />
    </Suspense>
  );
}

// A judge or staff member opens the link the admin sent them: 1. they create their account
// (this does not log anyone in or out), 2. they log in with it. If someone is already logged in on
// this browser (often the admin testing the link), they stay logged in: one browser holds one
// login, so the new person logs in on their own device, or here only if they choose to switch.
function Invite() {
  const router = useRouter();
  const { t, apiError } = useI18n();
  const client = useApolloClient();
  const { token } = useParams<{ token: string }>();
  const check = useQuery(INVITATION_CHECK, { variables: { token }, fetchPolicy: "network-only" });
  const me = useQuery(ME, { fetchPolicy: "network-only" });
  const [accept, { loading }] = useMutation(ACCEPT_STAFF_INVITATION);
  // Set once the account exists: the page then shows the login step for that email.
  const [created, setCreated] = useState<{ email: string } | null>(null);

  const invitationRole = check.data?.invitationCheck.role ?? null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const confirmMismatch = form.confirm.length >= form.password.length && form.confirm.length > 0 && form.confirm !== form.password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // The button is always active (solid blue, like Log in): the checks happen here.
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t.common.enterName;
    if (!form.email.trim()) errors.email = t.common.enterEmail;
    if (form.password.length < MIN_PASSWORD_LENGTH) errors.password = t.password.atLeast(MIN_PASSWORD_LENGTH);
    if (form.password !== form.confirm) errors.confirm = t.common.passwordsDontMatch;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      const { name, email, password } = form;
      await accept({ variables: { input: { token, name, email, password } } });
      setCreated({ email: email.trim() });
    } catch (err) {
      const failure = apiError(readApiError(err));
      setError(failure.message);
      setFieldErrors(failure.fields);
    }
  }

  const current = me.data?.me;

  // Step 2, after the account was created (the link is used up now, so check it no more).
  if (created && invitationRole) {
    return (
      <LoginStep
        email={created.email}
        role={invitationRole}
        current={current ?? null}
        onLoggedIn={async () => {
          // Forget everything cached for whoever used this browser before, then load the new account.
          await client.clearStore();
          router.replace("/dashboard");
        }}
      />
    );
  }

  if (check.loading || me.loading) return <FullPageSpinner />;
  if (check.error) {
    return (
      <AuthCard panel title={t.invite.eyebrow}>
        <ErrorAlert message={apiError(readApiError(check.error)).message} />
      </AuthCard>
    );
  }

  const invitation = check.data?.invitationCheck;
  if (!invitation?.valid || !invitation.role) {
    return (
      <AuthCard
        panel
        eyebrow={t.invite.eyebrow}
        title={t.invite.invalidTitle}
        subtitle={t.invite.invalidSubtitle}
      >
        <Text color="fg.muted">{t.invite.invalidHelp}</Text>
      </AuthCard>
    );
  }

  const role = invitation.role;

  return (
    <AuthCard
      panel
      eyebrow={GREETING}
      title={t.invite.joinAs(t.invite.roles[role] ?? role)}
      subtitle={role === "JUDGE" ? t.invite.subtitleJudge : t.invite.subtitleStaff}
      footer={t.invite.footer}
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
          >
            <PasswordInput autoComplete="new-password" size="lg" value={form.confirm} onChange={set("confirm")} />
          </FormField>

          <Button type="submit" colorPalette="brand" size="lg" loading={loading}>
            {t.invite.submit}
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}

type CurrentUser = { name: string; role: string };

// Step 2: log in with the new account. If someone else is logged in on this browser, nothing
// happens to them unless the new person chooses to log in here (which switches this browser).
function LoginStep({
  email: createdEmail,
  role,
  current,
  onLoggedIn,
}: {
  email: string;
  role: InvitableRole;
  current: CurrentUser | null;
  onLoggedIn: () => Promise<void>;
}) {
  const { t, apiError } = useI18n();
  const [login, { loading }] = useMutation(LOGIN);
  const [switching, setSwitching] = useState(false);
  const [email, setEmail] = useState(createdEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login({ variables: { email, password } });
      await onLoggedIn();
    } catch (err) {
      setError(apiError(readApiError(err)).message);
      setPassword("");
    }
  }

  const roleLabel = t.invite.roles[role] ?? role;

  if (current && !switching) {
    return (
      <AuthCard panel eyebrow={t.invite.createdEyebrow} title={t.invite.readyTitle(roleLabel)}>
        <Stack gap="5">
          <Text color="fg.muted">
            {t.invite.stillLoggedIn(current.name, t.invite.roles[current.role] ?? current.role)}{" "}
            {t.invite.newLogsInBefore(roleLabel)} <b>{createdEmail}</b> {t.invite.newLogsInAfter}
          </Text>
          <Button asChild colorPalette="brand" size="lg">
            <NextLink href="/dashboard">{t.invite.backToDashboard}</NextLink>
          </Button>
          <Button variant="outline" size="lg" onClick={() => setSwitching(true)}>
            {t.invite.loginHereInstead(roleLabel)}
          </Button>
        </Stack>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      panel
      eyebrow={t.invite.createdEyebrow}
      title={t.invite.nowLogIn}
      subtitle={current ? t.invite.switchesFrom(current.name) : t.invite.useNewCredentials}
    >
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="5">
          <ErrorAlert message={error} />

          <FormField label={t.common.email}>
            <InputGroup startElement={<MailIcon />}>
              <Input
                type="email"
                autoComplete="email"
                size="lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </InputGroup>
          </FormField>

          <FormField label={t.common.password}>
            <PasswordInput
              autoComplete="current-password"
              size="lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </FormField>

          <Button type="submit" colorPalette="brand" size="lg" loading={loading} disabled={!email || !password}>
            {t.invite.submitLogin}
          </Button>
          {current && (
            <Button variant="ghost" size="lg" onClick={() => setSwitching(false)}>
              {t.invite.cancelStay(current.name)}
            </Button>
          )}
        </Stack>
      </form>
    </AuthCard>
  );
}
