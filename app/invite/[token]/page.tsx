"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Button, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { MailIcon, MIN_PASSWORD_LENGTH, PasswordInput, PasswordStrength, UserIcon } from "@/components/PasswordInput";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { useI18n } from "@/lib/i18n";
import { ACCEPT_STAFF_INVITATION, INVITATION_CHECK } from "@/lib/graphql/staff";

type FormState = { name: string; email: string; password: string; confirm: string };
const EMPTY: FormState = { name: "", email: "", password: "", confirm: "" };

export default function InvitePage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Invite />
    </Suspense>
  );
}

// A judge or staff member opens the link the admin sent them: 1. they create their account,
// 2. the login page opens, where they log in with it. Nobody is logged out: whoever is logged in on
// this browser (often the admin testing the link) stays so until the new person actually logs in
// here, and their sessions on other devices are never touched.
function Invite() {
  const router = useRouter();
  const { t, apiError } = useI18n();
  const { token } = useParams<{ token: string }>();
  const check = useQuery(INVITATION_CHECK, { variables: { token }, fetchPolicy: "network-only" });
  const [accept, { loading }] = useMutation(ACCEPT_STAFF_INVITATION);
  const [leaving, setLeaving] = useState(false);
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
      setLeaving(true);
      const params = new URLSearchParams({ created: "1", email: email.trim() });
      router.replace(`/login?${params}`);
    } catch (err) {
      const failure = apiError(readApiError(err));
      setError(failure.message);
      setFieldErrors(failure.fields);
    }
  }

  // Account created: on the way to the login page.
  if (leaving || check.loading) return <FullPageSpinner />;
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
