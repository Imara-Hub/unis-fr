"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, chakra, Flex, Heading, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { AdminOnly } from "@/components/AdminOnly";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { PageBanner } from "@/components/PageBanner";
import { ShareLink } from "@/components/ShareLink";
import { TeamMembers } from "@/components/TeamMembers";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { dateLocale } from "@/lib/i18n/core";
import type { AppKey } from "@/lib/i18n";
import {
  CREATE_STAFF_INVITATION,
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
  { role: "JUDGE", title: "Judge", text: "Prepares envelopes, calls participants and marks their own sheet." },
  { role: "STAFF", title: "Staff", text: "Watches the live stage, the list, the sheets and the PDF. Cannot mark." },
];

export default function TeamPage() {
  const { data } = useQuery(TEAM);
  const users = data?.users;
  const waiting = data?.staffInvitations.filter((i) => i.status === "PENDING").length;
  const { tx } = useI18n();

  return (
    <AdminOnly>
      <PageBanner
        eyebrow={tx("People")}
        title={tx("Team")}
        description={tx("Judges prepare the envelopes, call participants and mark the sheets. Staff watch. Both join with an invite link.")}
        stats={[
          { label: tx("Active judges"), value: users?.filter((u) => u.role === "JUDGE" && u.isActive).length },
          { label: tx("Staff"), value: users?.filter((u) => u.role === "STAFF").length },
          { label: tx("Invites waiting"), value: waiting },
        ]}
      />
      <Stack gap={{ base: "6", md: "8" }}>
        <InviteCard />
        <TeamMembers
          showAdmin
          framed
          empty={
            <Text fontSize="sm" color="fg.muted">
              {tx("Nobody has joined yet. Invite your judges above.")}
            </Text>
          }
        />
        <InvitationsCard />
      </Stack>
    </AdminOnly>
  );
}

function InviteCard() {
  const [role, setRole] = useState<InvitableRole>("JUDGE");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<{ url: string; role: InvitableRole; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [create, { loading }] = useMutation(CREATE_STAFF_INVITATION, { refetchQueries: [{ query: TEAM }] });
  const { tx } = useI18n();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    try {
      const { data } = await create({ variables: { input: { role, note: note.trim() || null } } });
      if (data) setCreated({ url: data.createStaffInvitation.url, role, note: note.trim() });
      setNote("");
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Card.Root>
      <Card.Body p={{ base: "5", md: "7" }}>
        <Stack gap="5">
          <Heading size="md" color="brand.900">
            {tx("Invite someone")}
          </Heading>
          <ErrorAlert message={error} />

          {created ? (
            // The link is shown only once: the server keeps only its hash.
            <Stack gap="4">
              <Box>
                <Text fontWeight="semibold" color="green.700">
                  {created.note ? tx("Invite link ready for {name}", { name: created.note }) : tx("Invite link ready")}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {tx("Send it now. It works once and expires in 7 days. It is shown only now; if you lose it, create a new one.")}
                </Text>
              </Box>
              <ShareLink
                url={created.url}
                message={`${GREETING}! ${tx("You are invited to join the Musabaqa team as {role}. Open this link to create your account:", { role: tx(ROLE_LABELS[created.role]).toLowerCase() })}`}
              />
              <Box>
                <Button size="sm" variant="ghost" colorPalette="brand" onClick={() => setCreated(null)}>
                  {tx("Invite someone else")}
                </Button>
              </Box>
            </Stack>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <Stack gap="5">
                {/* Role as two cards to pick from */}
                <Stack gap="2">
                  <Text fontSize="sm" fontWeight="medium">
                    {tx("Role")}
                  </Text>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3" role="radiogroup" aria-label={tx("Role")}>
                    {ROLE_CHOICES.map((c) => {
                      const active = role === c.role;
                      return (
                        <chakra.button
                          type="button"
                          key={c.role}
                          role="radio"
                          aria-checked={active}
                          onClick={() => setRole(c.role)}
                          textAlign="start"
                          p="4"
                          rounded="lg"
                          borderWidth={active ? "2px" : "1px"}
                          borderColor={active ? "brand.600" : "border"}
                          bg={active ? "brand.50" : "white"}
                          cursor="pointer"
                          transition="border-color 0.15s, background 0.15s"
                          _hover={{ borderColor: "brand.400" }}
                          _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "2px" }}
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

                <FormField label={tx("Who is it for?")} required={false} helper={tx("Only you see this, to know which link is whose.")}>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx("e.g. Sheikh Omar")} />
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
      </Card.Body>
    </Card.Root>
  );
}

function InvitationsCard() {
  const { data } = useQuery(TEAM);
  const [revoke] = useMutation(REVOKE_STAFF_INVITATION);
  const [error, setError] = useState<string | null>(null);
  const invitations = data?.staffInvitations ?? [];
  const { tx } = useI18n();

  async function onRevoke(id: string) {
    if (!(await confirmDialog({ message: tx("Cancel this invite link? It stops working immediately."), destructive: true }))) return;
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
              <Flex key={inv.id} align="center" gap="4" py="3" borderTopWidth={i === 0 ? "0" : "1px"}>
                <Box flex="1" minW="0">
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text fontWeight="semibold" color="brand.900" truncate>
                      {inv.usedBy?.name ?? inv.note ?? tx("No name")}
                    </Text>
                    <Badge colorPalette={INVITATION_COLORS[inv.status]} variant="subtle">
                      {tx(INVITATION_LABELS[inv.status])}
                    </Badge>
                  </Flex>
                  <Text fontSize="sm" color="fg.muted">
                    {tx(ROLE_LABELS[inv.role])} · {inviteTimeText(inv, tx)}
                  </Text>
                </Box>
                {inv.status === "PENDING" && (
                  <Button size="xs" variant="ghost" colorPalette="red" onClick={() => onRevoke(inv.id)}>
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
function inviteTimeText(inv: StaffInvitation, tx: ReturnType<typeof useI18n>["tx"]) {
  const date = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" });
  if (inv.status === "PENDING") {
    const ms = new Date(inv.expiresAt).getTime() - Date.now();
    // Past its date but the server has not marked it yet (it does so on the next check).
    if (ms <= 0) return tx("Expired on {date}", { date: date(inv.expiresAt) });
    const hours = Math.ceil(ms / 3_600_000);
    if (hours <= 1) return tx("Expires within the hour");
    if (hours < 24) return tx("Expires in {n} hours", { n: hours });
    const days = Math.floor(ms / 86_400_000);
    return days === 1 ? tx("Expires in 1 day") : tx("Expires in {n} days", { n: days });
  }
  if (inv.status === "EXPIRED") return tx("Expired on {date}", { date: date(inv.expiresAt) });
  return tx("Created {date}", { date: date(inv.createdAt) });
}
