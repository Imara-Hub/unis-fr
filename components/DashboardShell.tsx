"use client";

import { Badge, Box, CloseButton, Drawer, Flex, Heading, IconButton, Menu, Portal, Spacer, Stack, Status, Text } from "@chakra-ui/react";
import { ChevronDown, ClipboardCheck, House, Link2, LogOut, Mail, Menu as MenuIcon, Mic, Scale, Settings, UserCog, Users, type LucideIcon } from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo as LogoBadge } from "@/components/brand/Logo";
import { StarLattice } from "@/components/brand/Octagram";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UserAvatar } from "@/components/UserAvatar";
import type { Role, User } from "@/lib/graphql/auth";
import type { AppKey } from "@/lib/i18n";
import { ROLE_LABELS } from "@/lib/graphql/staff";
import { useI18n } from "@/lib/i18n";

// Pages in the sidebar, and which roles see them. New features add a line here.
const NAV: { href: string; label: AppKey; icon: LucideIcon; roles: Role[] }[] = [
  { href: "/dashboard", label: "Overview", icon: House, roles: ["ADMIN", "STAFF"] },
  { href: "/dashboard", label: "Judging", icon: Scale, roles: ["JUDGE"] }, // the judging desk
  { href: "/stage", label: "Live stage", icon: Mic, roles: ["ADMIN", "STAFF"] }, // watch the judging (read only)
  { href: "/registrations", label: "Registrations", icon: ClipboardCheck, roles: ["ADMIN"] }, // review queue
  { href: "/participants", label: "Participants", icon: Users, roles: ["ADMIN", "JUDGE", "STAFF"] },
  { href: "/envelopes", label: "Envelopes", icon: Mail, roles: ["ADMIN", "JUDGE", "STAFF"] }, // judges prepare them
  { href: "/registration-link", label: "Registration link", icon: Link2, roles: ["ADMIN"] },
  { href: "/team", label: "Team", icon: UserCog, roles: ["ADMIN"] },
  // Everyone: their own profile and password. The admin also sees competition and team settings.
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN", "JUDGE", "STAFF"] },
];

const ROLE_COLORS: Record<Role, string> = { ADMIN: "gold", JUDGE: "brand", STAFF: "gray" };

// Height of the top bar. The sidebar's logo block uses it too, so both line up.
const BAR_H = "16";

// "Participants" stays highlighted on a participant's own page too.
function isActive(href: string, pathname: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

// The logo: the UNIS badge, the short name, and the competition in Latin letters and Arabic.
function Logo({ compact, dark }: { compact?: boolean; dark?: boolean }) {
  const { tx } = useI18n();
  return (
    <Flex
      asChild
      align="center"
      gap="3"
      color={dark ? "brand.900" : "white"}
      rounded="sm"
      _focusVisible={{ outline: "2px solid", outlineColor: "gold.300", outlineOffset: "4px" }}
    >
      <NextLink href="/dashboard" aria-label={tx("UNIS Musabaqa, overview")}>
        <LogoBadge size={compact ? 36 : 46} priority />
        <Box lineHeight="1.1">
          <Text fontFamily="display" fontSize={compact ? "lg" : "xl"} letterSpacing="0.16em">
            UNIS
          </Text>
          <Flex align="baseline" gap="1.5" fontSize="xs" color={dark ? "gold.600" : "gold.300"}>
            <Text as="span" letterSpacing="0.12em" textTransform="uppercase">
              Musabaqa
            </Text>
            <Text as="span" lang="ar" dir="rtl" fontFamily="arabic" fontSize="sm">
              مسابقة
            </Text>
          </Flex>
        </Box>
      </NextLink>
    </Flex>
  );
}

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { tx } = useI18n();
  return (
    <Stack as="nav" gap="1.5" aria-label={tx("Main")}>
      {NAV.filter((item) => item.roles.includes(role)).map((item) => {
        const active = isActive(item.href, pathname);
        const Icon = item.icon;
        return (
          <Flex
            key={item.href}
            asChild
            position="relative"
            align="center"
            gap="3.5"
            ps="4"
            pe="3"
            py="2.5"
            rounded="lg"
            fontSize="sm"
            fontWeight={active ? "semibold" : "medium"}
            color={active ? "white" : "whiteAlpha.800"}
            // Active item: a lighter pane of navy glass with the gold bar on its left edge.
            bg={active ? "rgba(58,76,140,0.45)" : "transparent"}
            boxShadow={active ? "inset 3px 0 0 #DDB65A, inset 0 0 0 1px rgba(255,255,255,0.08)" : "none"}
            backdropFilter={active ? "blur(8px)" : undefined}
            transition="background 0.15s, color 0.15s"
            _hover={{ bg: active ? undefined : "whiteAlpha.100", color: "white" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "gold.300", outlineOffset: "1px" }}
          >
            <NextLink href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
              <Box as="span" color={active ? "gold.300" : "whiteAlpha.700"} display="inline-flex">
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </Box>
              {tx(item.label)}
            </NextLink>
          </Flex>
        );
      })}
    </Stack>
  );
}

// Navy column: logo on top, menu, and the gold star lattice softly across the whole column.
function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <Flex
      direction="column"
      h="full"
      bg="linear-gradient(180deg, #1E2956 0%, #1A234E 55%, #151C42 100%)"
      color="white"
      position="relative"
      overflow="hidden"
    >
      <Box position="absolute" inset="0" aria-hidden pointerEvents="none">
        <StarLattice color="#C99A35" opacity={0.22} />
        {/* Strongest at the bottom, faded behind the menu. */}
        <Box
          position="absolute"
          inset="0"
          bg="linear-gradient(to bottom, rgba(26,35,78,0.96) 0%, rgba(26,35,78,0.82) 45%, rgba(21,28,66,0.25) 100%)"
        />
      </Box>

      {/* Same height as the top bar, so they read as one line. */}
      <Flex position="relative" align="center" h={BAR_H} flexShrink={0} px="5" borderBottomWidth="1px" borderBottomColor="whiteAlpha.100">
        <Logo />
      </Flex>
      <Box position="relative" px="3" pt="5">
        <NavLinks role={role} onNavigate={onNavigate} />
      </Box>
    </Flex>
  );
}

function LivePill({ live }: { live: boolean }) {
  const { tx } = useI18n();
  return (
    <Status.Root
      colorPalette={live ? "green" : "orange"}
      size="sm"
      title={live ? tx("Changes from others appear by themselves") : tx("Reconnecting… reload the page if this stays")}
      px={{ base: "2", md: "3" }}
      py="1"
      rounded="full"
      bg={live ? "green.50" : "orange.50"}
      borderWidth="1px"
      borderColor={live ? "green.100" : "orange.100"}
    >
      <Status.Indicator />
      <Text as="span" display={{ base: "none", md: "inline" }} fontSize="xs" fontWeight="semibold" color={live ? "green.700" : "orange.700"}>
        {live ? tx("Live") : tx("Reconnecting")}
      </Text>
    </Status.Root>
  );
}

// Avatar + name in the bar; opens a menu with the account details and "Log out".
function UserMenu({ user, onLogout, loggingOut }: { user: User; onLogout: () => void; loggingOut: boolean }) {
  const { tx } = useI18n();
  return (
    <Menu.Root
      positioning={{ placement: "bottom-end", gutter: 10 }}
      onSelect={({ value }) => {
        if (value === "logout") onLogout();
      }}
    >
      <Menu.Trigger asChild>
        <Flex
          as="button"
          align="center"
          gap="2.5"
          ps="1"
          pe={{ base: "1", sm: "2" }}
          py="1"
          rounded="full"
          color="brand.900"
          cursor="pointer"
          transition="background 0.15s"
          _hover={{ bg: "brand.50" }}
          _expanded={{ bg: "brand.50" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
          aria-label={tx("Account menu")}
        >
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
          <Box textAlign="start" lineHeight="1.2" display={{ base: "none", sm: "block" }}>
            <Text fontSize="sm" fontWeight="semibold" maxW="40" truncate>
              {user.name}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {tx(ROLE_LABELS[user.role])}
            </Text>
          </Box>
          <Box display={{ base: "none", sm: "block" }} color="fg.muted">
            <ChevronDown size={16} aria-hidden />
          </Box>
        </Flex>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="64" p="0" overflow="hidden" rounded="xl">
            <Box px="4" py="3" bg="bg.subtle" borderBottomWidth="1px" borderTopWidth="2px" borderTopColor="gold.400">
              <Text fontWeight="semibold" truncate>
                {user.name}
              </Text>
              <Text fontSize="sm" color="fg.muted" truncate>
                {user.email}
              </Text>
              <Badge mt="2" colorPalette={ROLE_COLORS[user.role]} variant="subtle">
                {tx(ROLE_LABELS[user.role])}
              </Badge>
            </Box>
            <Box p="1.5">
              <Menu.Item value="profile" asChild cursor="pointer">
                <NextLink href="/settings">
                  <Settings size={16} aria-hidden />
                  {tx("My profile and settings")}
                </NextLink>
              </Menu.Item>
              <Menu.Item
                value="logout"
                disabled={loggingOut}
                color="fg.error"
                cursor="pointer"
                _highlighted={{ bg: "bg.error", color: "fg.error" }}
              >
                <LogOut size={16} aria-hidden />
                {loggingOut ? tx("Logging out…") : tx("Log out")}
              </Menu.Item>
            </Box>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

export function DashboardShell({
  user,
  live,
  onLogout,
  loggingOut,
  children,
}: {
  user: User;
  live: boolean;
  onLogout: () => void;
  loggingOut: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { tx } = useI18n();
  const page = NAV.find((item) => item.roles.includes(user.role) && isActive(item.href, pathname));
  const pageTitle = page ? tx(page.label) : "";

  return (
    <Flex minH="100dvh">
      {/* Sidebar (with the logo) on tablets and computers, full height */}
      <Box as="aside" display={{ base: "none", md: "block" }} w="64" flexShrink={0} position="sticky" top="0" h="100dvh">
        <Sidebar role={user.role} />
      </Box>

      <Flex direction="column" flex="1" minW="0">
        {/* Top bar: page name, live status and account menu. On phones also the menu button. */}
        <Flex
          as="header"
          align="center"
          gap={{ base: "2", md: "4" }}
          // Frosted white: the page scrolls under it, softly blurred.
          bg="rgba(255,255,255,0.78)"
          backdropFilter="blur(16px) saturate(170%)"
          borderBottomWidth="1px"
          borderBottomColor="blackAlpha.100"
          px={{ base: "3", md: "8" }}
          h={BAR_H}
          flexShrink={0}
          position="sticky"
          top="0"
          zIndex="docked"
        >
          <IconButton
            display={{ md: "none" }}
            aria-label={tx("Open menu")}
            variant="ghost"
            size="sm"
            color="brand.900"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon size={20} aria-hidden />
          </IconButton>
          <Box display={{ md: "none" }}>
            <Logo compact dark />
          </Box>
          <Heading as="p" display={{ base: "none", md: "block" }} fontFamily="display" fontSize="xl" color="brand.900">
            {pageTitle}
          </Heading>
          <Spacer />
          <LivePill live={live} />
          <LanguageSwitcher />
          <Box h="7" w="1px" bg="blackAlpha.100" display={{ base: "none", sm: "block" }} />
          <UserMenu user={user} onLogout={onLogout} loggingOut={loggingOut} />
        </Flex>

        {/* Same menu as a drawer on phones */}
        <Drawer.Root open={menuOpen} onOpenChange={(e) => setMenuOpen(e.open)} placement="start" size="xs">
          <Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content bg="#1A234E">
                <Drawer.Body p="0">
                  <Sidebar role={user.role} onNavigate={() => setMenuOpen(false)} />
                </Drawer.Body>
                <Drawer.CloseTrigger asChild>
                  <CloseButton size="sm" color="white" _hover={{ bg: "whiteAlpha.200" }} />
                </Drawer.CloseTrigger>
              </Drawer.Content>
            </Drawer.Positioner>
          </Portal>
        </Drawer.Root>

        <Box as="main" flex="1" minW="0" px={{ base: "4", md: "8" }} py={{ base: "5", md: "7" }} maxW="7xl" w="full">
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
