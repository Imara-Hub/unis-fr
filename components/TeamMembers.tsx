"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import {
  Badge,
  Box,
  Button,
  Card,
  Circle,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Input,
  Menu,
  Portal,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { ROLE_STYLE, RoleBadge } from "@/components/RoleBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { readApiError } from "@/lib/errors";
import type { Role } from "@/lib/graphql/auth";
import { SETTINGS } from "@/lib/graphql/participants";
import { NEW_LOGIN_LINK, REMOVE_USER, RESET_USER_PASSWORD, SET_USER_ACTIVE, TEAM, UPDATE_USER, type InvitableRole, type TeamMember } from "@/lib/graphql/staff";
import { CalendarDays, Eye, Gavel, UserCog, CirclePause, CirclePlay, Ellipsis, KeyRound, Link2, Mail, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { LoginLinkActions } from "@/components/LoginLinkActions";
import { TemporaryPassword } from "@/components/TemporaryPassword";
import { useI18n } from "@/lib/i18n";
import { Dropdown, DropdownCard, dropdownItemStyle, ItemBadge } from "@/components/Dropdown";

// Where to log in, for the message with a new password: the member's personal login link (it also
// opens the app's gate on their browser), else the login page with their email filled in. Never
// the team's access key: it would travel in WhatsApp messages and could be forwarded.
function loginLinkFor(email: string | null | undefined, personalLink: string | null | undefined) {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  if (personalLink) return new URL(personalLink, origin).toString();
  if (!email) return null;
  const url = new URL("/login", origin);
  url.searchParams.set("email", email);
  return url.toString();
}

// Colours per role, matching the role badges: card band, avatar ring, section stripe.
const TONE: Record<Role, { band: string; ring: string; soft: string }> = {
  ADMIN: { band: "linear-gradient(135deg, #F3E3B5 0%, #E2C277 100%)", ring: "gold.400", soft: "gold.50" },
  JUDGE: { band: "linear-gradient(135deg, #DBE6FE 0%, #93B4F8 100%)", ring: "blue.500", soft: "blue.50" },
  STAFF: { band: "linear-gradient(135deg, #CCF3EC 0%, #7DD8C7 100%)", ring: "teal.500", soft: "teal.50" },
};

// The team by role, judges first. On the Team page each role is its own card (`framed`); in
// Settings they are plain sections. Each person has a "⋯" menu: edit, deactivate, remove.
export function TeamMembers({ showAdmin = false, framed = false, empty }: { showAdmin?: boolean; framed?: boolean; empty?: ReactNode }) {
  const { data, loading, error } = useQuery(TEAM);
  const settings = useQuery(SETTINGS);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [resetting, setResetting] = useState<TeamMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [setActive] = useMutation(SET_USER_ACTIVE);
  const [newLoginLink] = useMutation(NEW_LOGIN_LINK);
  const { tx } = useI18n();

  const users = data?.users ?? [];
  const judgeCount = settings.data?.settings.judgeCount;
  const groups: Role[] = showAdmin ? ["JUDGE", "STAFF", "ADMIN"] : ["JUDGE", "STAFF"];

  async function toggleActive(u: TeamMember) {
    if (u.isActive && !(await confirmDialog({ message: tx("Deactivate {name}? They are logged out at once and cannot log in until reactivated.", { name: u.name }), destructive: true }))) {
      return;
    }
    setActionError(null);
    try {
      await setActive({ variables: { input: { userId: u.id, active: !u.isActive } } });
    } catch (err) {
      setActionError(readApiError(err).message);
    }
  }

  // The link went to the wrong person, or a phone was lost.
  async function renewLink(u: TeamMember) {
    const first = u.name.split(" ")[0]!;
    if (
      !(await confirmDialog({
        message: tx("Make a new login link for {name}? The old link stops working and {name} is logged out on every device. Then send them the new one.", { name: first }),
        destructive: true,
      }))
    ) {
      return;
    }
    setActionError(null);
    try {
      await newLoginLink({ variables: { userId: u.id } });
    } catch (err) {
      setActionError(readApiError(err).message);
    }
  }

  if (loading) return <Text color="fg.muted">{tx("Loading…")}</Text>;

  return (
    <>
      <ErrorAlert message={error ? readApiError(error).message : actionError} />
      {users.every((u) => u.role === "ADMIN") && empty}
      <Stack gap={framed ? { base: "6", md: "8" } : "8"}>
        {groups.map((role) => {
          const members = users.filter((u) => u.role === role);
          const section = (
            <RoleSection role={role} members={members} judgeCount={judgeCount}>
              {members.map((u) => (
                <MemberCard
                  key={u.id}
                  member={u}
                  onEdit={() => setEditing(u)}
                  onToggle={() => toggleActive(u)}
                  onResetPassword={() => setResetting(u)}
                  onNewLink={() => renewLink(u)}
                  onRemove={() => setRemoving(u)}
                />
              ))}
            </RoleSection>
          );
          return framed ? (
            <Card.Root key={role} borderTopWidth="3px" borderTopColor={TONE[role].ring}>
              <Card.Body p={{ base: "5", md: "7" }}>{section}</Card.Body>
            </Card.Root>
          ) : (
            <Box key={role}>{section}</Box>
          );
        })}
      </Stack>

      {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveMemberDialog member={removing} onClose={() => setRemoving(null)} />}
      {resetting && <ResetPasswordDialog member={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function RoleSection({
  role,
  members,
  judgeCount,
  children,
}: {
  role: Role;
  members: TeamMember[];
  judgeCount: number | undefined;
  children: ReactNode;
}) {
  const style = ROLE_STYLE[role];
  const { tx } = useI18n();
  const Icon = style.icon;
  const active = members.filter((u) => u.isActive).length;
  const short = role === "JUDGE" && judgeCount !== undefined && active < judgeCount;

  return (
    <Stack gap="4">
      <Flex align="center" gap="3" wrap="wrap">
        <Circle size="11" bg={TONE[role].soft} color={`${style.palette}.700`} borderWidth="1px" borderColor={TONE[role].ring}>
          <Icon size={20} aria-hidden />
        </Circle>
        <Box flex="1" minW="48">
          <Flex align="center" gap="2">
            <Heading size="md" color="brand.900">
              {tx(style.plural)}
            </Heading>
            <Badge colorPalette={style.palette} variant="subtle" fontVariantNumeric="tabular-nums">
              {role === "JUDGE" && judgeCount ? tx("{n} of {total} needed", { n: active, total: judgeCount }) : `${members.length}`}
            </Badge>
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {tx(style.does)}
          </Text>
        </Box>
      </Flex>
      {short && (
        <Text fontSize="sm" color="orange.700" bg="orange.50" px="3" py="2" rounded="md">
          {tx("The panel has {total} judges: add {n} more, or change the number of judges on the panel.", {
            total: judgeCount!,
            n: judgeCount! - active,
          })}
        </Text>
      )}
      {members.length === 0 ? (
        <Flex py="6" justify="center" rounded="xl" borderWidth="1px" borderStyle="dashed" color="fg.subtle" fontSize="sm">
          {tx("Nobody yet.")}
        </Flex>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, "2xl": 4 }} gap="4">
          {children}
        </SimpleGrid>
      )}
    </Stack>
  );
}

// A profile card: role-coloured band, big picture, name and email, joined date and status.
function MemberCard({
  member: u,
  onEdit,
  onToggle,
  onResetPassword,
  onNewLink,
  onRemove,
}: {
  member: TeamMember;
  onEdit: () => void;
  onToggle: () => void;
  onResetPassword: () => void;
  onNewLink: () => void;
  onRemove: () => void;
}) {
  const tone = TONE[u.role];
  const { tx, locale } = useI18n();
  const joined = new Date(u.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <Box
      position="relative"
      rounded="2xl"
      borderWidth="1px"
      bg="white"
      overflow="hidden"
      shadow="xs"
      transition="box-shadow 0.15s, transform 0.15s"
      _hover={{ shadow: "md", transform: "translateY(-2px)" }}
      opacity={u.isActive ? 1 : 0.7}
      filter={u.isActive ? undefined : "grayscale(0.6)"}
    >
      {/* Band with the role and the actions */}
      <Flex h="16" bg={tone.band} px="3" pt="2.5" justify="space-between" align="flex-start">
        <RoleBadge role={u.role} />
        {u.role === "ADMIN" ? (
          <Badge variant="solid" bg="whiteAlpha.800" color="brand.900">
            {tx("You")}
          </Badge>
        ) : (
          <Menu.Root positioning={{ placement: "bottom-end" }}>
            <Menu.Trigger asChild>
              <IconButton aria-label={tx("Actions for {name}", { name: u.name })} size="xs" rounded="full" bg="whiteAlpha.800" color="brand.900" _hover={{ bg: "white" }}>
                <MoreIcon />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <DropdownCard title={u.name} minW="60">
                  <Menu.Item value="edit" onSelect={onEdit} {...dropdownItemStyle()}>
                    <ItemBadge>
                      <EditIcon />
                    </ItemBadge>
                    {tx("Edit name or role")}
                  </Menu.Item>
                  <Menu.Item value="active" onSelect={onToggle} {...dropdownItemStyle()}>
                    <ItemBadge>{u.isActive ? <PauseIcon /> : <CirclePlay size={16} aria-hidden />}</ItemBadge>
                    {u.isActive ? tx("Deactivate") : tx("Reactivate")}
                  </Menu.Item>
                  <Menu.Item value="link" onSelect={onNewLink} {...dropdownItemStyle()}>
                    <ItemBadge>
                      <RefreshCw size={16} aria-hidden />
                    </ItemBadge>
                    {tx("New login link")}
                  </Menu.Item>
                  <Menu.Item value="password" onSelect={onResetPassword} {...dropdownItemStyle()}>
                    <ItemBadge>
                      <KeyRound size={16} aria-hidden />
                    </ItemBadge>
                    {tx("Forgotten password")}
                  </Menu.Item>
                  <Menu.Separator my="1.5" />
                  <Menu.Item value="remove" onSelect={onRemove} {...dropdownItemStyle(false, "danger")}>
                    <ItemBadge tone="danger">
                      <TrashIcon />
                    </ItemBadge>
                    {tx("Remove from the team")}
                  </Menu.Item>
                </DropdownCard>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        )}
      </Flex>

      {/* Picture overlapping the band */}
      <Stack align="center" textAlign="center" gap="1" px="4" mt="-9">
        <Box rounded="full" p="1" bg="white" borderWidth="2px" borderColor={u.isActive ? tone.ring : "gray.300"}>
          <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="xl" />
        </Box>
        <Text fontWeight="semibold" fontSize="md" color="brand.900" mt="1.5" lineClamp={1} title={u.name}>
          {u.name}
        </Text>
        <Flex align="center" gap="1.5" color="fg.muted" fontSize="xs" maxW="full">
          <Mail size={12} aria-hidden />
          <Text truncate title={u.email ?? undefined}>
            {u.email ?? "—"}
          </Text>
        </Flex>
      </Stack>

      {/* Personal login link: copy or send it any time (not for the admin; paused while deactivated) */}
      {u.role !== "ADMIN" && (
        <Stack gap="1.5" px="4" mt="3">
          <Flex align="center" gap="1.5" fontSize="xs" color="fg.muted" justify="center">
            <Link2 size={12} aria-hidden />
            {u.loginLink ? tx("Login link, no password needed") : tx("Login link paused while deactivated")}
          </Flex>
          {u.loginLink && <LoginLinkActions name={u.name} path={u.loginLink} size="xs" stretch />}
        </Stack>
      )}

      {/* Joined + status */}
      <Flex mt="4" px="4" py="2.5" borderTopWidth="1px" bg="bg.subtle" justify="space-between" align="center" fontSize="xs">
        <Flex align="center" gap="1.5" color="fg.muted">
          <CalendarDays size={12} aria-hidden />
          {tx("Joined {date}", { date: joined })}
        </Flex>
        <Flex align="center" gap="1.5" fontWeight="semibold" color={u.isActive ? "green.700" : "orange.700"}>
          <Box w="2" h="2" rounded="full" bg={u.isActive ? "green.500" : "orange.400"} />
          {u.isActive ? tx("Active") : tx("Deactivated")}
        </Flex>
      </Flex>
    </Box>
  );
}

function EditMemberDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<InvitableRole>(member.role === "STAFF" ? "STAFF" : "JUDGE");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [updateUser, { loading }] = useMutation(UPDATE_USER);
  const { tx } = useI18n();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      await updateUser({ variables: { input: { userId: member.id, name, role } } });
      onClose();
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setFieldErrors(apiError.fields);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content borderTopWidth="3px" borderTopColor="gold.400">
            <form onSubmit={onSubmit} noValidate>
              <Dialog.Header>
                <Dialog.Title color="brand.900">{tx("Edit {name}", { name: member.name })}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="4">
                  <ErrorAlert message={error} />
                  <FormField label={tx("Full name")} error={fieldErrors.name}>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </FormField>
                  <FormField label={tx("Role")} helper={tx(ROLE_STYLE[role].does)}>
                    {/* Inside the dialog: the list opens within it. */}
                    <Dropdown
                      label={tx("Role")}
                      icon={<UserCog size={15} strokeWidth={2} />}
                      portalled={false}
                      value={role}
                      onChange={(v) => setRole(v as InvitableRole)}
                      options={[
                        { value: "JUDGE", label: tx("Judge"), icon: <Gavel size={15} aria-hidden />, detail: tx(ROLE_STYLE.JUDGE.does) },
                        { value: "STAFF", label: tx("Staff"), icon: <Eye size={15} aria-hidden />, detail: tx(ROLE_STYLE.STAFF.does) },
                      ]}
                    />
                  </FormField>
                  {role !== member.role && (
                    <Text fontSize="sm" color="gold.700">
                      {tx("The new role applies at once, even if {name} is logged in now.", { name: member.name.split(" ")[0]! })}
                    </Text>
                  )}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="ghost" onClick={onClose}>
                  {tx("Cancel")}
                </Button>
                <Button
                  type="submit"
                  colorPalette="brand"
                  loading={loading}
                  disabled={name.trim().length < 2 || (name.trim() === member.name && role === member.role)}
                >
                  {tx("Save")}
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function RemoveMemberDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [removeUser, { loading }] = useMutation(REMOVE_USER, { refetchQueries: [{ query: TEAM }] });
  const { tx } = useI18n();

  async function onRemove() {
    setError(null);
    try {
      await removeUser({ variables: { userId: member.id } });
      onClose();
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} placement="center" role="alertdialog">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content borderTopWidth="3px" borderTopColor="red.400">
            <Dialog.Header>
              <Dialog.Title>{tx("Remove {name}?", { name: member.name })}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="3">
                <ErrorAlert message={error} />
                <Text>
                  {tx("{name} is logged out at once and disappears from the team. Sheets they already submitted stay, with their name.", { name: member.name })}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {tx("This cannot be undone. To bring them back, send them a new invite (the same email works). If you only want to pause their access, use Deactivate instead.")}
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose}>
                {tx("Cancel")}
              </Button>
              <Button colorPalette="red" loading={loading} onClick={onRemove}>
                {tx("Remove")}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// A judge or staff member forgot their password: the admin gives them a temporary one. Two steps
// on the same dialog: confirm (they are logged out everywhere), then the password, shown once,
// with Copy and WhatsApp. Closing it is final: the password cannot be shown again.
function ResetPasswordDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [reset, { loading }] = useMutation(RESET_USER_PASSWORD, { refetchQueries: [{ query: TEAM }] });
  const { tx } = useI18n();
  const first = member.name.split(" ")[0]!;

  async function onReset() {
    setError(null);
    try {
      const res = await reset({ variables: { userId: member.id } });
      setPassword(res.data?.resetUserPassword.temporaryPassword ?? null);
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} placement="center" role={password ? "dialog" : "alertdialog"}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content borderTopWidth="3px" borderTopColor="gold.400">
            <Dialog.Header>
              <Dialog.Title color="brand.900">
                {password ? tx("Temporary password for {name}", { name: member.name }) : tx("{name} forgot their password?", { name: member.name })}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="3">
                <ErrorAlert message={error} />
                {password ? (
                  <TemporaryPassword
                    password={password}
                    name={member.name}
                    email={member.email}
                    loginUrl={loginLinkFor(member.email, member.loginLink)}
                    note={tx("{name} logs in with it. You can see it again any time in Login details on the Team page.", { name: first })}
                  />
                ) : (
                  <>
                    <Text>{tx("A temporary password is created for {name}. The old one stops working and they are logged out on every device.", { name: member.name })}</Text>
                    <Text fontSize="sm" color="fg.muted">
                      {tx("You then give it to them yourself (WhatsApp, or in person). Any login lock from their wrong tries is lifted.")}
                    </Text>
                  </>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              {password ? (
                <Button colorPalette="brand" onClick={onClose}>
                  {tx("Done")}
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={onClose}>
                    {tx("Cancel")}
                  </Button>
                  <Button colorPalette="brand" loading={loading} onClick={onReset}>
                    {tx("Create a temporary password")}
                  </Button>
                </>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// Icons (lucide)
function MoreIcon() {
  return <Ellipsis size={16} aria-hidden />;
}
function EditIcon() {
  return <Pencil size={16} aria-hidden />;
}
function PauseIcon() {
  return <CirclePause size={16} aria-hidden />;
}
function TrashIcon() {
  return <Trash2 size={16} aria-hidden />;
}
