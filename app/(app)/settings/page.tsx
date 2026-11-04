"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { MIN_PASSWORD_LENGTH, PasswordStrength } from "@/components/PasswordInput";
import { PageBanner } from "@/components/PageBanner";
import { TeamMembers } from "@/components/TeamMembers";
import { UserAvatar } from "@/components/UserAvatar";
import { uploadAvatar } from "@/lib/account";
import { readApiError } from "@/lib/errors";
import { CHANGE_PASSWORD, ME, REMOVE_AVATAR, UPDATE_PROFILE, type User } from "@/lib/graphql/auth";
import { SCORING_RULES, type ScoringRules } from "@/lib/graphql/judging";
import { SETTINGS, UPDATE_SETTINGS, type Settings } from "@/lib/graphql/participants";
import { preparePhoto } from "@/lib/register";
import { ROLE_LABELS } from "@/lib/graphql/staff";
import type { AppKey } from "@/lib/i18n";
import { Camera, Check, Lock, Trophy, UserRound, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Section = "profile" | "password" | "competition" | "team";

const SECTIONS: { key: Section; label: AppKey; hint: AppKey; adminOnly: boolean; icon: ReactNode }[] = [
  { key: "profile", label: "My profile", hint: "Picture and name", adminOnly: false, icon: <UserIcon /> },
  { key: "password", label: "Password", hint: "Change your password", adminOnly: false, icon: <LockIcon /> },
  { key: "competition", label: "Competition", hint: "Judges and pass mark", adminOnly: true, icon: <TrophyIcon /> },
  { key: "team", label: "Team members", hint: "Roles, names, access", adminOnly: true, icon: <TeamIcon /> },
];

function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export default function SettingsPage() {
  const { data } = useQuery(ME);
  const user = data?.me;
  // Open the section in the address (#password, #team…), so a link can point to it.
  // The hash is read only in the browser, so the server and the first browser render agree.
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
  const [picked, setPicked] = useState<Section | null>(null);
  const { tx } = useI18n();
  const section: Section = picked ?? (SECTIONS.some((s) => s.key === hash) ? (hash as Section) : "profile");
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  const sections = SECTIONS.filter((s) => isAdmin || !s.adminOnly);
  const current = sections.some((s) => s.key === section) ? section : "profile";

  function open(key: Section) {
    setPicked(key);
    history.replaceState(null, "", `#${key}`);
  }

  return (
    <>
      <PageBanner
        eyebrow={tx("Account")}
        title={tx("Settings")}
        description={
          isAdmin
            ? tx("Your profile and password, the competition rules, and the people on your team.")
            : tx("Your profile picture, your name and your password.")
        }
      />

      <Grid templateColumns={{ base: "1fr", lg: "240px 1fr" }} gap={{ base: "5", lg: "8" }} alignItems="start">
        {/* Section menu: a column on computers, a row of tabs on phones */}
        <Card.Root position={{ lg: "sticky" }} top={{ lg: "24" }}>
          <Card.Body p="2">
            <Flex as="nav" aria-label={tx("Settings sections")} direction={{ base: "row", lg: "column" }} gap="1" overflowX="auto">
              {sections.map((s) => {
                const active = current === s.key;
                return (
                  <Flex
                    as="button"
                    key={s.key}
                    onClick={() => open(s.key)}
                    aria-current={active ? "page" : undefined}
                    align="center"
                    gap="3"
                    px="3"
                    py="2.5"
                    rounded="md"
                    textAlign="start"
                    flexShrink={0}
                    position="relative"
                    bg={active ? "brand.50" : "transparent"}
                    color={active ? "brand.900" : "fg.muted"}
                    cursor="pointer"
                    _hover={{ bg: active ? "brand.50" : "bg.subtle", color: "brand.900" }}
                    _focusVisible={{ outline: "2px solid", outlineColor: "brand.500" }}
                  >
                    {active && (
                      <Box
                        position="absolute"
                        left="0"
                        top="2"
                        bottom="2"
                        w="0.5"
                        rounded="full"
                        bg="gold.400"
                        display={{ base: "none", lg: "block" }}
                      />
                    )}
                    <Box color={active ? "gold.600" : "currentColor"}>{s.icon}</Box>
                    <Box>
                      <Text fontSize="sm" fontWeight={active ? "semibold" : "medium"} whiteSpace="nowrap">
                        {tx(s.label)}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" display={{ base: "none", lg: "block" }}>
                        {tx(s.hint)}
                      </Text>
                    </Box>
                  </Flex>
                );
              })}
            </Flex>
          </Card.Body>
        </Card.Root>

        <Box minW="0">
          {current === "profile" && <ProfileSection user={user} />}
          {current === "password" && <PasswordSection />}
          {current === "competition" && <CompetitionSection />}
          {current === "team" && <TeamSection />}
        </Box>
      </Grid>
    </>
  );
}

// Card with a title line, used by every section.
function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card.Root overflow="hidden" borderTopWidth="3px" borderTopColor="gold.400">
      <Box px={{ base: "5", md: "7" }} pt="6" pb="4" borderBottomWidth="1px">
        <Heading size="lg" color="brand.900">
          {title}
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          {description}
        </Text>
      </Box>
      <Card.Body px={{ base: "5", md: "7" }} py="6">
        {children}
      </Card.Body>
    </Card.Root>
  );
}

function Saved({ children }: { children?: string }) {
  const { tx } = useI18n();
  return (
    <Flex align="center" gap="1.5" color="green.700" fontSize="sm">
      <CheckIcon />
      {children ?? tx("Saved.")}
    </Flex>
  );
}

// ——— My profile ———

function ProfileSection({ user }: { user: User }) {
  const client = useApolloClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updateProfile, { loading: saving }] = useMutation(UPDATE_PROFILE);
  const [removeAvatar, { loading: removing }] = useMutation(REMOVE_AVATAR);
  const { tx } = useI18n();

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const photo = await preparePhoto(file).catch(() => null);
      if (!photo) {
        setError(tx("This file is not a picture we can use. Choose a JPG or PNG photo."));
        return;
      }
      const result = await uploadAvatar(photo);
      if ("message" in result) setError(result.message);
      else await client.refetchQueries({ include: [ME] }); // navbar and this page show the new picture
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function onRemovePhoto() {
    setError(null);
    try {
      await removeAvatar();
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNameError(undefined);
    setSaved(false);
    try {
      await updateProfile({ variables: { input: { name } } });
      setSaved(true);
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setNameError(apiError.fields.name);
    }
  }

  return (
    <SectionCard title={tx("My profile")} description={tx("How you appear to the rest of the team.")}>
      <Stack gap="7">
        <ErrorAlert message={error} />

        {/* Picture */}
        <Flex gap="5" align="center" direction={{ base: "column", sm: "row" }} textAlign={{ base: "center", sm: "start" }}>
          <Box p="1" rounded="full" borderWidth="2px" borderColor="gold.400">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="2xl" />
          </Box>
          <Stack gap="2">
            <Box>
              <Text fontWeight="semibold">{tx("Profile picture")}</Text>
              <Text fontSize="sm" color="fg.muted">
                {tx("A clear photo of your face. JPG or PNG.")}
              </Text>
            </Box>
            <Flex gap="2" justify={{ base: "center", sm: "flex-start" }} wrap="wrap">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={(e) => onPickPhoto(e.target.files?.[0])}
              />
              <Button size="sm" colorPalette="brand" loading={uploading} onClick={() => fileInput.current?.click()}>
                <CameraIcon />
                {user.avatarUrl ? tx("Change picture") : tx("Upload picture")}
              </Button>
              {user.avatarUrl && (
                <Button size="sm" variant="ghost" colorPalette="red" loading={removing} onClick={onRemovePhoto}>
                  {tx("Remove")}
                </Button>
              )}
            </Flex>
          </Stack>
        </Flex>

        {/* Name and account */}
        <form onSubmit={onSave} noValidate>
          <Stack gap="5" pt="6" borderTopWidth="1px">
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="5">
              <FormField label={tx("Full name")} error={nameError}>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                />
              </FormField>
              <FormField label={tx("Email")} required={false} helper={tx("Used to log in. Ask the admin to change it.")}>
                <Input value={user.email ?? ""} readOnly bg="bg.subtle" color="fg.muted" />
              </FormField>
            </Grid>
            <Flex align="center" gap="2" fontSize="sm" color="fg.muted">
              {tx("Role:")}
              <Badge colorPalette={user.role === "ADMIN" ? "gold" : "brand"} variant="subtle">
                {tx(ROLE_LABELS[user.role])}
              </Badge>
            </Flex>
            <Flex gap="3" align="center">
              <Button type="submit" colorPalette="brand" loading={saving} disabled={name.trim() === user.name || name.trim().length < 2}>
                {tx("Save changes")}
              </Button>
              {saved && name.trim() === user.name && <Saved />}
            </Flex>
          </Stack>
        </form>
      </Stack>
    </SectionCard>
  );
}

// ——— Password ———

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD);
  const { tx } = useI18n();

  const mismatch = confirm.length > 0 && confirm !== next;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setDone(false);
    if (next !== confirm) return;
    try {
      await changePassword({ variables: { input: { currentPassword: current, newPassword: next } } });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setFieldErrors(apiError.fields);
    }
  }

  return (
    <SectionCard title={tx("Password")} description={tx("Use at least 10 characters. A short sentence is easy to remember.")}>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="5" maxW="md">
          <ErrorAlert message={error} />
          {done && (
            <Alert.Root status="success">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{tx("Password changed")}</Alert.Title>
                <Alert.Description>{tx("You stay logged in here. Your other devices were logged out.")}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}
          <FormField label={tx("Current password")} error={fieldErrors.currentPassword}>
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </FormField>
          <FormField label={tx("New password")} error={fieldErrors.newPassword}>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            {!fieldErrors.newPassword && <PasswordStrength value={next} />}
          </FormField>
          <FormField label={tx("Repeat the new password")} error={mismatch ? tx("The two passwords are not the same") : undefined}>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </FormField>
          <Flex>
            <Button type="submit" colorPalette="brand" loading={loading} disabled={!current || next.length < MIN_PASSWORD_LENGTH || next !== confirm}>
              {tx("Change password")}
            </Button>
          </Flex>
        </Stack>
      </form>
    </SectionCard>
  );
}

// ——— Competition (admin) ———

function CompetitionSection() {
  const { data, loading, error } = useQuery(SETTINGS);
  const rules = useQuery(SCORING_RULES);
  const failed = error ?? rules.error;
  const { tx } = useI18n();
  return (
    <SectionCard title={tx("Competition")} description={tx("How the judges’ sheets turn into a final score, and Passed or Failed.")}>
      {loading || rules.loading ? (
        <Text color="fg.muted">{tx("Loading…")}</Text>
      ) : failed || !data || !rules.data ? (
        <ErrorAlert message={readApiError(failed).message} />
      ) : (
        <Stack gap="8">
          <ScoringOverview rules={rules.data.scoringRules} />
          <CompetitionForm settings={data.settings} rules={rules.data.scoringRules} />
        </Stack>
      )}
    </SectionCard>
  );
}

// The paper sheet (fixed): how one judge's 100 points are made, and the penalties.
function ScoringOverview({ rules: r }: { rules: ScoringRules }) {
  const raw = r.questions * r.questionPoints;
  const { tx } = useI18n();
  const parts = [
    ...Array.from({ length: r.questions }, (_, i) => ({
      key: `q${i + 1}`,
      text: `${tx("Q{n}", { n: i + 1 })} · ${r.questionPoints}`,
      share: r.questionsWeight / r.questions,
      color: ["#23305F", "#34437F", "#4A5A9C"][i % 3],
    })),
    { key: "sauti", text: String(r.sautiMax), share: r.sautiMax, color: "#C99A35" },
  ];
  const penalties = [
    { sign: "X", name: tx("Tajweed, waqf or ibtida mistake"), points: r.tajweedPenalty },
    { sign: "I", name: tx("Tanbih (the judge taps the table)"), points: r.tanbihPenalty },
    { sign: "●", name: tx("Fath (the judge reminds)"), points: r.fathPenalty },
  ];

  return (
    <Stack gap="4">
      <Box>
        <Text fontWeight="semibold" color="brand.900">
          {tx("One judge’s sheet = 100 points")}
        </Text>
        <Text fontSize="sm" color="fg.muted">
          {tx("{n} questions of {points} points ({raw} in all, counted for {weight}) plus the voice (sauti) out of {sauti}. These rules come from the paper sheet and are the same for every judge.", {
            n: r.questions,
            points: r.questionPoints,
            raw,
            weight: r.questionsWeight,
            sauti: r.sautiMax,
          })}
        </Text>
      </Box>

      {/* The 100 points as one bar */}
      <Box>
        <Flex h="9" rounded="lg" overflow="hidden" gap="2px" bg="white">
          {parts.map((p) => (
            <Flex key={p.key} w={`${p.share}%`} bg={p.color} color="white" align="center" justify="center" fontSize="xs" fontWeight="semibold" minW="0">
              <Text truncate px="1">
                {p.text}
              </Text>
            </Flex>
          ))}
        </Flex>
        <Flex justify="space-between" mt="1.5" fontSize="xs" color="fg.muted">
          <Text>{tx("Questions: {n} points", { n: r.questionsWeight })}</Text>
          <Text>Sauti: {r.sautiMax}</Text>
        </Flex>
      </Box>

      <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="3">
        {penalties.map((p) => (
          <Flex key={p.sign} gap="3" align="center" p="3" rounded="lg" borderWidth="1px" bg="bg.subtle">
            <Flex w="9" h="9" rounded="md" bg="white" borderWidth="1px" align="center" justify="center" fontWeight="bold" fontSize="lg" color="brand.900" flexShrink={0}>
              {p.sign}
            </Flex>
            <Box minW="0">
              <Text fontWeight="bold" color="red.600" fontSize="sm">
                −{p.points}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {p.name}
              </Text>
            </Box>
          </Flex>
        ))}
      </Grid>
      <Text fontSize="sm" color="fg.muted">
        {tx("Reminder number {n} (●) deletes the question (it gets 0). The final score is the average of the judges’ sheets.", { n: r.fathLimit })}
      </Text>
    </Stack>
  );
}

// What the admin decides: how many judges sit on the panel and the pass mark (out of 100).
function CompetitionForm({ settings, rules }: { settings: Settings; rules: ScoringRules }) {
  const total = rules.questionsWeight + rules.sautiMax;
  const [passMark, setPassMark] = useState(String(settings.passMark));
  const [judgeCount, setJudgeCount] = useState(settings.judgeCount);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [update, { loading }] = useMutation(UPDATE_SETTINGS);
  const { tx } = useI18n();

  const mark = Number(passMark);
  const validMark = passMark.trim() !== "" && Number.isFinite(mark) && mark >= 0 && mark <= total;
  const changed = mark !== settings.passMark || judgeCount !== settings.judgeCount || settings.maxScore !== total;
  const pct = validMark ? (mark / total) * 100 : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      // The sheet always totals 100, so the maximum follows the rules.
      await update({ variables: { input: { passMark: mark, maxScore: total, judgeCount } } });
      setSaved(true);
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setFieldErrors(apiError.fields);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap="6" pt="6" borderTopWidth="1px">
        <ErrorAlert message={error} />

        {/* Panel size */}
        <Box>
          <Text fontWeight="semibold" color="brand.900">
            {tx("Judges on the panel")}
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="3">
            {tx("Every judge marks every participant. The final score appears once all of them have submitted.")}
          </Text>
          <Flex align="center" gap="3" wrap="wrap">
            <Flex align="center" borderWidth="1px" rounded="lg" overflow="hidden">
              <Button type="button" variant="ghost" rounded="none" onClick={() => setJudgeCount((n) => Math.max(1, n - 1))} disabled={judgeCount <= 1} aria-label={tx("One judge less")}>
                −
              </Button>
              <Text w="12" textAlign="center" fontSize="xl" fontWeight="bold" color="brand.900" fontVariantNumeric="tabular-nums">
                {judgeCount}
              </Text>
              <Button type="button" variant="ghost" rounded="none" onClick={() => setJudgeCount((n) => Math.min(20, n + 1))} disabled={judgeCount >= 20} aria-label={tx("One judge more")}>
                +
              </Button>
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              {tx("Final score = (sheet 1 + … + sheet {n}) ÷ {n}", { n: judgeCount })}
            </Text>
          </Flex>
          {fieldErrors.judgeCount && (
            <Text color="fg.error" fontSize="sm" mt="1">
              {fieldErrors.judgeCount}
            </Text>
          )}
        </Box>

        {/* Pass mark */}
        <Box>
          <Text fontWeight="semibold" color="brand.900">
            {tx("Pass mark")}
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="3">
            {tx("A final score of this or more is Passed; below is Failed.")}
          </Text>
          <Flex align="center" gap="3" wrap="wrap">
            <Flex align="baseline" gap="1.5">
              <Input type="number" min={0} max={total} step="0.5" w="24" fontSize="xl" fontWeight="bold" value={passMark} onChange={(e) => setPassMark(e.target.value)} aria-label={tx("Pass mark")} />
              <Text color="fg.muted">/ {total}</Text>
            </Flex>
            <Flex gap="1.5" wrap="wrap">
              {[50, 60, 70, 80].map((v) => (
                <Button key={v} type="button" size="sm" variant={mark === v ? "solid" : "outline"} colorPalette={mark === v ? "brand" : "gray"} onClick={() => setPassMark(String(v))}>
                  {v}
                </Button>
              ))}
            </Flex>
          </Flex>
          {(fieldErrors.passMark || !validMark) && (
            <Text color="fg.error" fontSize="sm" mt="1">
              {fieldErrors.passMark ?? tx("Give a number between 0 and {n}.", { n: total })}
            </Text>
          )}

          <Box mt="4" p="4" rounded="md" bg="bg.subtle" borderWidth="1px">
            <Box position="relative" h="3" rounded="full" overflow="hidden" bg="#f87171">
              <Box position="absolute" insetY="0" right="0" w={`${100 - pct}%`} bg="#15803d" />
            </Box>
            <Flex justify="space-between" mt="2" fontSize="xs" color="fg.muted">
              <Text>0 · {tx("Failed")}</Text>
              <Text color="gold.700" fontWeight="semibold">
                {validMark ? tx("{n} and more = Passed", { n: mark }) : "?"}
              </Text>
              <Text>{total}</Text>
            </Flex>
          </Box>
        </Box>

        <Text fontSize="sm" color="fg.muted">
          {tx("Saving updates every participant’s result immediately.")}
        </Text>
        <Flex gap="3" align="center">
          <Button type="submit" colorPalette="brand" loading={loading} disabled={!changed || !validMark}>
            {tx("Save")}
          </Button>
          {saved && !changed && <Saved />}
        </Flex>
      </Stack>
    </form>
  );
}

// ——— Team members (admin) ———

function TeamSection() {
  const { tx } = useI18n();
  return (
    <SectionCard title={tx("Team members")} description={tx("Change a role, fix a name, pause or remove someone’s access.")}>
      <Stack gap="4">
        <TeamMembers
          empty={
            <Stack align="center" textAlign="center" gap="2" py="8">
              <Text color="gold.400" fontSize="3xl" lineHeight="1" aria-hidden>
                ۞
              </Text>
              <Text fontWeight="semibold" color="brand.900">
                {tx("No judges or staff yet")}
              </Text>
              <Button asChild size="sm" colorPalette="brand" mt="1">
                <NextLink href="/team">{tx("Invite someone")}</NextLink>
              </Button>
            </Stack>
          }
        />
        <Text fontSize="sm" color="fg.muted" pt="2" borderTopWidth="1px">
          {tx("To add someone, send them an invite link from the Team page.")}{" "}
          <Box asChild color="brand.600" fontWeight="semibold" _hover={{ textDecoration: "underline" }}>
            <NextLink href="/team">{tx("Open the Team page")}</NextLink>
          </Box>
        </Text>
      </Stack>
    </SectionCard>
  );
}

// Icons (lucide)
function UserIcon() {
  return <UserRound size={18} aria-hidden />;
}
function LockIcon() {
  return <Lock size={18} aria-hidden />;
}
function TrophyIcon() {
  return <Trophy size={18} aria-hidden />;
}
function TeamIcon() {
  return <Users size={18} aria-hidden />;
}
function CameraIcon() {
  return <Camera size={16} aria-hidden />;
}
function CheckIcon() {
  return <Check size={16} aria-hidden />;
}
