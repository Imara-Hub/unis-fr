"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import {
  Badge,
  Box,
  Button,
  Card,
  chakra,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Crown, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { AdminOnly } from "@/components/AdminOnly";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { googleSignInAvailable } from "@/components/GoogleSignIn";
import { PageBanner } from "@/components/PageBanner";
import { LoginLinkActions, useLoginLinkUrl } from "@/components/LoginLinkActions";
import { isLocalLink, LocalLinkWarning, ShareLink } from "@/components/ShareLink";
import { LoginDetailsCard } from "@/components/LoginDetailsCard";
import { TeamMembers } from "@/components/TeamMembers";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { dateLocale } from "@/lib/i18n/core";
import type { AppKey } from "@/lib/i18n";
import {
  PARTICIPANT_COUNTS,
  SET_CHIEF_JUDGE,
  SET_JUDGE_COUNT,
  SETTINGS,
} from "@/lib/graphql/participants";
import {
  CREATE_STAFF_INVITATION,
  CREATE_TEAM_MEMBER,
  REVOKE_STAFF_INVITATION,
  ROLE_LABELS,
  TEAM,
  type InvitableRole,
  type InvitationStatus,
  type StaffInvitation,
} from "@/lib/graphql/staff";
import { useI18n } from "@/lib/i18n";

const INVITATION_COLORS: Record<InvitationStatus, string> = {
  PENDING: "blue",
  USED: "green",
  EXPIRED: "gray",
  REVOKED: "red",
};
const INVITATION_LABELS: Record<InvitationStatus, AppKey> = {
  PENDING: "Waiting",
  USED: "Used",
  EXPIRED: "Expired",
  REVOKED: "Cancelled",
};

const ROLE_CHOICES: { role: InvitableRole; title: AppKey; text: AppKey }[] = [
  {
    role: "JUDGE",
    title: "Judge",
    text: "Prepares envelopes, calls participants and marks their own sheet.",
  },
  {
    role: "STAFF",
    title: "Staff",
    text: "Watches the live stage, the list, the sheets and the PDF. Cannot mark.",
  },
];

export default function TeamPage() {
  const { data } = useQuery(TEAM);
  const users = data?.users;
  const waiting = data?.staffInvitations.filter(
    (i) => i.status === "PENDING",
  ).length;
  const { tx } = useI18n();

  return (
    <AdminOnly>
      <PageBanner
        eyebrow={tx("People")}
        title={tx("Team")}
        description={tx(
          "Judges prepare the envelopes, call participants and mark the sheets. Staff watch. You create their accounts here, or send them an invite link.",
        )}
        stats={[
          {
            label: tx("Active judges"),
            value: users?.filter((u) => u.role === "JUDGE" && u.isActive)
              .length,
          },
          {
            label: tx("Staff"),
            value: users?.filter((u) => u.role === "STAFF").length,
          },
          { label: tx("Invites waiting"), value: waiting },
        ]}
      />
      <Stack gap={{ base: "6", md: "8" }}>
        <PanelSizeCard />
        <ChiefJudgeCard />
        <AddMemberCard />
        <TeamMembers
          showAdmin
          framed
          empty={
            <Text fontSize="sm" color="fg.muted">
              {tx("Nobody has joined yet. Add your judges above.")}
            </Text>
          }
        />
        <LoginDetailsCard />
        <InvitationsCard />
      </Stack>
    </AdminOnly>
  );
}

// How many judges sit on the panel: the admin decides, any number from 1 to 20. The final score
// of a participant is the average of that many sheets. Saved as soon as it is changed.
function PanelSizeCard() {
  const settings = useQuery(SETTINGS);
  const team = useQuery(TEAM);
  const [setJudgeCount, { loading }] = useMutation(SET_JUDGE_COUNT, {
    refetchQueries: [{ query: SETTINGS }, { query: PARTICIPANT_COUNTS }],
  });
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();

  const count = settings.data?.settings.judgeCount;
  const active = team.data?.users.filter(
    (u) => u.role === "JUDGE" && u.isActive,
  ).length;

  async function change(next: number) {
    if (next < 1 || next > 20) return;
    setError(null);
    try {
      await setJudgeCount({ variables: { judgeCount: next } });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Card.Root borderTopWidth="3px" borderTopColor="gold.400">
      <Card.Body p={{ base: "5", md: "7" }}>
        <Flex
          gap={{ base: "4", md: "8" }}
          align={{ base: "flex-start", md: "center" }}
          direction={{ base: "column", md: "row" }}
        >
          <Box flex="1">
            <Heading size="md" color="brand.900">
              {tx("Judges on the panel")}
            </Heading>
            <Text fontSize="sm" color="fg.muted" mt="1">
              {tx(
                "You choose how many judges mark each participant. The final score is the average of their sheets, once all of them have submitted.",
              )}
            </Text>
            {count !== undefined && active !== undefined && (
              <Text
                fontSize="sm"
                mt="2"
                fontWeight="medium"
                color={active >= count ? "green.700" : "orange.700"}
              >
                {active >= count
                  ? tx("{n} active judges: the panel is complete.", {
                      n: active,
                    })
                  : tx(
                      "{n} of {total} judges have an account: add {missing} more below.",
                      { n: active, total: count, missing: count - active },
                    )}
              </Text>
            )}
            <ErrorAlert message={error} />
          </Box>
          <Flex
            align="center"
            borderWidth="1px"
            rounded="lg"
            overflow="hidden"
            flexShrink={0}
          >
            <Button
              variant="ghost"
              rounded="none"
              size="lg"
              onClick={() => count && change(count - 1)}
              disabled={!count || count <= 1 || loading}
              aria-label={tx("One judge less")}
            >
              −
            </Button>
            <Text
              w="14"
              textAlign="center"
              fontSize="2xl"
              fontWeight="bold"
              color="brand.900"
              fontVariantNumeric="tabular-nums"
            >
              {count ?? "…"}
            </Text>
            <Button
              variant="ghost"
              rounded="none"
              size="lg"
              onClick={() => count && change(count + 1)}
              disabled={!count || count >= 20 || loading}
              aria-label={tx("One judge more")}
            >
              +
            </Button>
          </Flex>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

// The chief judge: the only judge who calls participants to the stage (and sends them back or
// ends a turn). The other judges only mark. Nobody chosen: any judge may call. Saved on tap.
function ChiefJudgeCard() {
  const settings = useQuery(SETTINGS);
  const team = useQuery(TEAM);
  const [setChief, { loading }] = useMutation(SET_CHIEF_JUDGE, {
    refetchQueries: [{ query: SETTINGS }, { query: PARTICIPANT_COUNTS }],
  });
  const [savingId, setSavingId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();

  const chiefId = settings.data?.settings.chiefJudgeId ?? null;
  const judges = team.data?.users.filter((u) => u.role === "JUDGE" && u.isActive) ?? [];

  async function choose(userId: string | null) {
    if (userId === chiefId) return;
    setError(null);
    setSavingId(userId);
    try {
      await setChief({ variables: { userId } });
    } catch (err) {
      setError(readApiError(err).message);
    } finally {
      setSavingId(undefined);
    }
  }

  const option = (id: string | null, label: string, hint: string) => {
    const on = id === chiefId;
    return (
      <Button
        key={id ?? "none"}
        variant="outline"
        h="auto"
        py="2.5"
        px="3.5"
        rounded="xl"
        justifyContent="flex-start"
        gap="2.5"
        bg={on ? "gold.50" : "white"}
        borderColor={on ? "gold.400" : "border"}
        borderWidth={on ? "2px" : "1px"}
        color="brand.900"
        loading={loading && savingId === id}
        disabled={loading}
        onClick={() => void choose(id)}
        aria-pressed={on}
      >
        <Flex
          w="7"
          h="7"
          rounded="full"
          align="center"
          justify="center"
          flexShrink={0}
          bg={on ? "linear-gradient(160deg, #FDD199 0%, #FBB75E 50%, #E07F0A 100%)" : "gray.100"}
          color={on ? "brand.900" : "fg.muted"}
        >
          {id ? <Crown size={15} aria-hidden /> : <Users size={15} aria-hidden />}
        </Flex>
        <Box textAlign="start" minW="0">
          <Text fontWeight="semibold" truncate>
            {label}
          </Text>
          <Text fontSize="xs" color="fg.muted" fontWeight="normal" truncate>
            {hint}
          </Text>
        </Box>
      </Button>
    );
  };

  return (
    <Card.Root borderTopWidth="3px" borderTopColor="gold.400">
      <Card.Body p={{ base: "5", md: "7" }} gap="4">
        <Box>
          <Heading size="md" color="brand.900">
            {tx("Chief judge")}
          </Heading>
          <Text fontSize="sm" color="fg.muted" mt="1">
            {tx("The chief judge alone calls the next participant to the stage, sends them back or ends their turn. The other judges only mark.")}
          </Text>
        </Box>
        {team.data && judges.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            {tx("Add a judge below first.")}
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="2.5">
            {option(null, tx("No chief judge"), tx("Any judge may call"))}
            {judges.map((u) => option(u.id, u.name, u.id === chiefId ? tx("Calls the participants") : tx("Judge")))}
          </SimpleGrid>
        )}
        <ErrorAlert message={error} />
      </Card.Body>
    </Card.Root>
  );
}

type AddMode = "account" | "link";

// Two ways to add a judge or staff member: the admin creates the account (name, email, a
// temporary password to pass on: nothing for the person to fill in), or sends an invite link.
function AddMemberCard() {
  const [mode, setMode] = useState<AddMode>("account");
  const { tx } = useI18n();

  return (
    <Card.Root>
      <Card.Body p={{ base: "5", md: "7" }}>
        <Stack gap="5">
          <Flex align="center" justify="space-between" gap="3" wrap="wrap">
            <Heading size="md" color="brand.900">
              {tx("Add someone to the team")}
            </Heading>
            <Flex
              role="tablist"
              borderWidth="1px"
              rounded="lg"
              overflow="hidden"
              fontSize="sm"
            >
              {(
                [
                  { id: "account", label: "Create the account" },
                  { id: "link", label: "Send an invite link" },
                ] as { id: AddMode; label: AppKey }[]
              ).map((m) => (
                <chakra.button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => setMode(m.id)}
                  px="3"
                  py="1.5"
                  fontWeight="medium"
                  bg={mode === m.id ? "brand.700" : "white"}
                  color={mode === m.id ? "white" : "brand.900"}
                  _hover={mode === m.id ? undefined : { bg: "brand.50" }}
                >
                  {tx(m.label)}
                </chakra.button>
              ))}
            </Flex>
          </Flex>
          {mode === "account" ? <CreateAccountForm /> : <InviteForm />}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

// Role as two cards to pick from.
function RolePicker({
  role,
  onChange,
}: {
  role: InvitableRole;
  onChange: (role: InvitableRole) => void;
}) {
  const { tx } = useI18n();
  return (
    <Stack gap="2">
      <Text fontSize="sm" fontWeight="medium">
        {tx("Role")}
      </Text>
      <SimpleGrid
        columns={{ base: 1, sm: 2 }}
        gap="3"
        role="radiogroup"
        aria-label={tx("Role")}
      >
        {ROLE_CHOICES.map((c) => {
          const active = role === c.role;
          return (
            <chakra.button
              type="button"
              key={c.role}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c.role)}
              textAlign="start"
              p="4"
              rounded="lg"
              borderWidth={active ? "2px" : "1px"}
              borderColor={active ? "brand.600" : "border"}
              bg={active ? "brand.50" : "white"}
              cursor="pointer"
              transition="border-color 0.15s, background 0.15s"
              _hover={{ borderColor: "brand.400" }}
              _focusVisible={{
                outline: "2px solid",
                outlineColor: "brand.500",
                outlineOffset: "2px",
              }}
            >
              <Flex align="center" gap="2">
                <Box
                  w="4"
                  h="4"
                  rounded="full"
                  borderWidth={active ? "5px" : "2px"}
                  borderColor={active ? "brand.600" : "gray.300"}
                  flexShrink={0}
                />
                <Text fontWeight="semibold" color="brand.900">
                  {tx(c.title)}
                </Text>
              </Flex>
              <Text fontSize="sm" color="fg.muted" mt="1" ps="6">
                {tx(c.text)}
              </Text>
            </chakra.button>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

function CreateAccountForm() {
  const [role, setRole] = useState<InvitableRole>("JUDGE");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    name: string;
    role: InvitableRole;
    loginLink: string | null;
  } | null>(null);
  const [create, { loading }] = useMutation(CREATE_TEAM_MEMBER, {
    refetchQueries: [{ query: TEAM }],
  });
  const { tx } = useI18n();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      const { data } = await create({
        variables: { input: { name: name.trim(), email: email.trim(), role } },
      });
      if (data) {
        // The temporary password is not shown: the personal login link replaces it (it can be
        // sent again any time from the team list). "Forgotten password" still makes one if needed.
        const { user } = data.createTeamMember;
        setCreated({ name: user.name, role, loginLink: user.loginLink });
      }
      setName("");
      setEmail("");
    } catch (err) {
      const failure = readApiError(err);
      setError(failure.message);
      setFieldErrors(failure.fields);
    }
  }

  if (created) {
    return (
      <Stack gap="4">
        <Box>
          <Text fontWeight="semibold" color="green.700">
            {tx("Account created for {name} ({role})", {
              name: created.name,
              role: tx(ROLE_LABELS[created.role]),
            })}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {tx("{name} logs in with this personal link, no password needed. Send it now or later: it stays on their card in the team list below.", {
              name: created.name.split(" ")[0]!,
            })}
          </Text>
        </Box>
        {created.loginLink && <CreatedLoginLink name={created.name} path={created.loginLink} />}
        <Box>
          <Button
            size="sm"
            variant="ghost"
            colorPalette="brand"
            onClick={() => setCreated(null)}
          >
            {tx("Add someone else")}
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap="5">
        <ErrorAlert message={error} />
        <RolePicker role={role} onChange={setRole} />
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
          <FormField label={tx("Full name")} error={fieldErrors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tx("e.g. Sheikh Omar")}
              autoComplete="off"
            />
          </FormField>
          <FormField
            label={tx("Email")}
            error={fieldErrors.email}
            helper={tx("They log in with it.")}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="omar@example.com"
              autoComplete="off"
            />
          </FormField>
        </SimpleGrid>
        <Box>
          <Button
            type="submit"
            colorPalette="brand"
            loading={loading}
            disabled={name.trim().length < 2 || !email.includes("@")}
          >
            {tx("Create the account")}
          </Button>
        </Box>
      </Stack>
    </form>
  );
}

function InviteForm() {
  const [role, setRole] = useState<InvitableRole>("JUDGE");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<{
    url: string;
    role: InvitableRole;
    note: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [create, { loading }] = useMutation(CREATE_STAFF_INVITATION, {
    refetchQueries: [{ query: TEAM }],
  });
  const { tx } = useI18n();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    try {
      const { data } = await create({
        variables: { input: { role, note: note.trim() || null } },
      });
      if (data)
        setCreated({
          url: data.createStaffInvitation.url,
          role,
          note: note.trim(),
        });
      setNote("");
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Stack gap="5">
      <ErrorAlert message={error} />

      {created ? (
        // The link is shown only once: the server keeps only its hash.
        <Stack gap="4">
          <Box>
            <Text fontWeight="semibold" color="green.700">
              {created.note
                ? tx("Invite link ready for {name}", { name: created.note })
                : tx("Invite link ready")}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {tx(
                "Send it now. It works once and expires in 7 days. It is shown only now; if you lose it, create a new one.",
              )}
            </Text>
          </Box>
          <ShareLink
            url={created.url}
            message={`${GREETING}! ${tx("You are invited to join the Musabaqa team as {role}. Open this link to create your account:", { role: tx(ROLE_LABELS[created.role]).toLowerCase() })}`}
          />
          <Box>
            <Button
              size="sm"
              variant="ghost"
              colorPalette="brand"
              onClick={() => setCreated(null)}
            >
              {tx("Invite someone else")}
            </Button>
          </Box>
        </Stack>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <Stack gap="5">
            <Text fontSize="sm" color="fg.muted">
              {googleSignInAvailable()
                ? tx("The person opens the link, fills in their name, email and password (or continues with Google), then logs in.")
                : tx("The person opens the link, fills in their name, email and password, then logs in.")}
            </Text>
            <RolePicker role={role} onChange={setRole} />

            <FormField
              label={tx("Who is it for?")}
              required={false}
              helper={tx("Only you see this, to know which link is whose.")}
            >
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={tx("e.g. Sheikh Omar")}
              />
            </FormField>

            <Box>
              <Button type="submit" colorPalette="brand" loading={loading}>
                {tx("Create invite link")}
              </Button>
            </Box>
          </Stack>
        </form>
      )}
    </Stack>
  );
}

function InvitationsCard() {
  const { data } = useQuery(TEAM);
  const [revoke] = useMutation(REVOKE_STAFF_INVITATION);
  const [error, setError] = useState<string | null>(null);
  const invitations = data?.staffInvitations ?? [];
  const { tx } = useI18n();

  async function onRevoke(id: string) {
    if (
      !(await confirmDialog({
        message: tx("Cancel this invite link? It stops working immediately."),
        destructive: true,
      }))
    )
      return;
    setError(null);
    try {
      await revoke({ variables: { id } });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  if (invitations.length === 0) return null;

  return (
    <Card.Root>
      <Card.Body p={{ base: "5", md: "7" }}>
        <Stack gap="2">
          <Heading size="md" color="brand.900">
            {tx("Invite links")}
          </Heading>
          <ErrorAlert message={error} />
          <Stack gap="0">
            {invitations.map((inv, i) => (
              <Flex
                key={inv.id}
                align="center"
                gap="4"
                py="3"
                borderTopWidth={i === 0 ? "0" : "1px"}
              >
                <Box flex="1" minW="0">
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text fontWeight="semibold" color="brand.900" truncate>
                      {inv.usedBy?.name ?? inv.note ?? tx("No name")}
                    </Text>
                    <Badge
                      colorPalette={INVITATION_COLORS[inv.status]}
                      variant="subtle"
                    >
                      {tx(INVITATION_LABELS[inv.status])}
                    </Badge>
                  </Flex>
                  <Text fontSize="sm" color="fg.muted">
                    {tx(ROLE_LABELS[inv.role])} · {inviteTimeText(inv, tx)}
                  </Text>
                </Box>
                {inv.status === "PENDING" && (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => onRevoke(inv.id)}
                  >
                    {tx("Cancel")}
                  </Button>
                )}
              </Flex>
            ))}
          </Stack>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

// "Expires in 5 days", "Expired on 3 Nov", "Created 2 Nov"…
function inviteTimeText(
  inv: StaffInvitation,
  tx: ReturnType<typeof useI18n>["tx"],
) {
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale(), {
      day: "numeric",
      month: "short",
    });
  if (inv.status === "PENDING") {
    const ms = new Date(inv.expiresAt).getTime() - Date.now();
    // Past its date but the server has not marked it yet (it does so on the next check).
    if (ms <= 0) return tx("Expired on {date}", { date: date(inv.expiresAt) });
    const hours = Math.ceil(ms / 3_600_000);
    if (hours <= 1) return tx("Expires within the hour");
    if (hours < 24) return tx("Expires in {n} hours", { n: hours });
    const days = Math.floor(ms / 86_400_000);
    return days === 1
      ? tx("Expires in 1 day")
      : tx("Expires in {n} days", { n: days });
  }
  if (inv.status === "EXPIRED")
    return tx("Expired on {date}", { date: date(inv.expiresAt) });
  return tx("Created {date}", { date: date(inv.createdAt) });
}

// The new person's login link, written out in full, with Copy and WhatsApp.
function CreatedLoginLink({ name, path }: { name: string; path: string }) {
  const url = useLoginLinkUrl(path);
  return (
    <Stack gap="3">
      {url && (
        <Box px="4" py="3" rounded="md" bg="bg.subtle" borderWidth="1px" borderStyle="dashed" borderColor="gold.400" fontSize="sm" fontWeight="medium" color="brand.900" wordBreak="break-all">
          {url}
        </Box>
      )}
      <LoginLinkActions name={name} path={path} size="md" />
      {url && isLocalLink(url) && <LocalLinkWarning />}
    </Stack>
  );
}
