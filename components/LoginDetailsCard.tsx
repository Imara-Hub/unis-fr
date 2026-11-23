"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Box, Button, Card, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { ClipboardList, Copy, KeyRound, Mail } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { ErrorAlert } from "@/components/ErrorAlert";
import { LoginLinkActions } from "@/components/LoginLinkActions";
import { RoleBadge } from "@/components/RoleBadge";
import { readApiError } from "@/lib/errors";
import { RESET_USER_PASSWORD, TEAM, type TeamMember } from "@/lib/graphql/staff";
import { useI18n } from "@/lib/i18n";

const noSubscribe = () => () => {};

// Everyone's login details in one place, for the admin who no longer remembers what they sent:
// email, password and personal login link of each judge and staff member, with Copy and WhatsApp.
// The admin creates every judge and staff password (they cannot change it themselves), so it can
// always be shown here. Accounts made before passwords were saved (or with Google or an invite)
// have none: the admin creates one here (which logs them out).
export function LoginDetailsCard() {
  const { data } = useQuery(TEAM);
  const { tx } = useI18n();
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const [reset] = useMutation(RESET_USER_PASSWORD, { refetchQueries: [{ query: TEAM }], awaitRefetchQueries: true });
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const members = (data?.users ?? [])
    .filter((u) => u.role !== "ADMIN")
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "JUDGE" ? -1 : 1));

  if (members.length === 0) return null;

  async function createPassword(u: TeamMember) {
    const first = u.name.split(" ")[0]!;
    if (
      !(await confirmDialog({
        message: tx("Create a password for {name}? Any password they use now stops working and they are logged out on every device. Then give them the new one.", { name: first }),
        destructive: true,
      }))
    ) {
      return;
    }
    setError(null);
    setCreating(u.id);
    try {
      await reset({ variables: { userId: u.id } });
    } catch (err) {
      setError(readApiError(err).message);
    } finally {
      setCreating(null);
    }
  }

  const full = (u: TeamMember) => (u.loginLink && origin ? new URL(u.loginLink, origin).toString() : null);
  // One block of text for the admin's own notes (or to print).
  const all = members
    .map((u) => [
        `${u.name} (${tx(u.role === "JUDGE" ? "Judge" : "Staff")})`,
        u.email ?? "",
        u.password ? `${tx("Password")}: ${u.password}` : "",
        full(u) ?? tx("Login link paused while deactivated"),
      ]
        .filter(Boolean).join("\n"))
    .join("\n\n");

  return (
    <Card.Root borderTopWidth="3px" borderTopColor="brand.500">
      <Card.Body p={{ base: "5", md: "7" }}>
        <Stack gap="5">
          <Flex align={{ base: "flex-start", sm: "center" }} gap="3" direction={{ base: "column", sm: "row" }}>
            <Box flex="1">
              <Flex align="center" gap="2">
                <KeyRound size={18} aria-hidden />
                <Heading size="md" color="brand.900">
                  {tx("Login details")}
                </Heading>
              </Flex>
              <Text fontSize="sm" color="fg.muted">
                {tx("Each person's email, password and personal login link, to give again whenever they need them. Someone forgot their password: give it again, or create a new one.")}
              </Text>
            </Box>
            <CopyButton value={all} size="sm" variant="outline" colorPalette="brand" icon={<ClipboardList size={14} aria-hidden />}>
              {tx("Copy all")}
            </CopyButton>
          </Flex>

          <ErrorAlert message={error} />
          <Stack gap="0" borderWidth="1px" rounded="lg" overflow="hidden">
            {members.map((u, i) => {
              const url = full(u);
              return (
                <Flex
                  key={u.id}
                  gap={{ base: "2", md: "4" }}
                  px="4"
                  py="3"
                  align={{ base: "stretch", md: "center" }}
                  direction={{ base: "column", md: "row" }}
                  borderTopWidth={i === 0 ? "0" : "1px"}
                  bg={u.isActive ? undefined : "bg.subtle"}
                >
                  <Stack gap="1" flex="1" minW="0">
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text fontWeight="semibold" color="brand.900">
                        {u.name}
                      </Text>
                      <RoleBadge role={u.role} />
                    </Flex>
                    {u.email && (
                      <Flex align="center" gap="1.5" fontSize="sm" color="fg.muted" minW="0">
                        <Mail size={12} aria-hidden style={{ flexShrink: 0 }} />
                        <Text truncate title={u.email}>
                          {u.email}
                        </Text>
                        <CopyButton value={u.email} size="2xs" variant="ghost" colorPalette="brand" icon={<Copy size={12} aria-hidden />}>
                          {tx("Copy")}
                        </CopyButton>
                      </Flex>
                    )}
                    <Flex align="center" gap="1.5" fontSize="sm" minW="0" wrap="wrap">
                      <KeyRound size={12} aria-hidden style={{ flexShrink: 0 }} />
                      {u.password ? (
                        <>
                          <Text fontFamily="mono" fontWeight="semibold" color="brand.900" letterSpacing="0.04em" userSelect="all">
                            {u.password}
                          </Text>
                          <CopyButton value={u.password} size="2xs" variant="ghost" colorPalette="brand" icon={<Copy size={12} aria-hidden />}>
                            {tx("Copy")}
                          </CopyButton>
                        </>
                      ) : (
                        <>
                          <Text color="fg.muted">{tx("No password saved yet")}</Text>
                          {u.isActive && (
                            <Button size="2xs" variant="ghost" colorPalette="brand" loading={creating === u.id} onClick={() => createPassword(u)}>
                              {tx("Create a password")}
                            </Button>
                          )}
                        </>
                      )}
                    </Flex>
                    {url ? (
                      <Text fontSize="xs" color="fg.subtle" truncate title={url}>
                        {url}
                      </Text>
                    ) : (
                      <Text fontSize="xs" color="orange.700">
                        {tx("Login link paused while deactivated")}
                      </Text>
                    )}
                  </Stack>
                  {u.loginLink && <LoginLinkActions name={u.name} path={u.loginLink} size="xs" />}
                </Flex>
              );
            })}
          </Stack>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
