"use client";

import { useQuery } from "@apollo/client/react";
import {
  Box,
  Button,
  Card,
  Circle,
  Flex,
  Grid,
  Heading,
  Link,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Wrap,
} from "@chakra-ui/react";
import {
  ChartColumn,
  Check,
  ChevronRight,
  CircleCheck,
  CircleX,
  FileText,
  Hourglass,
  Link2,
  Scale,
  Settings as SettingsIcon,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { StarLattice } from "@/components/brand/Octagram";
import { CopyButton } from "@/components/CopyButton";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ExportResultsButton } from "@/components/ExportResultsButton";
import { RESULT_COLORS, ResultsDonut, ScoreHistogram } from "@/components/OverviewCharts";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { JudgingDesk } from "@/components/JudgingDesk";
import { ReviewBadge, StatusBadge } from "@/components/StatusBadge";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { ME, type User } from "@/lib/graphql/auth";
import { PARTICIPANT_COUNTS, PARTICIPANTS, type Counts, type Settings } from "@/lib/graphql/participants";
import { REGISTRATION_LINK, REGISTRATION_TERMS } from "@/lib/graphql/registration";
import { TEAM } from "@/lib/graphql/staff";
import { useI18n } from "@/lib/i18n";

export default function OverviewPage() {
  const { data } = useQuery(ME);
  const user = data?.me;
  // Judges have their own home and may not read the counts: no request for them.
  const counts = useQuery(PARTICIPANT_COUNTS, { skip: !user || user.role === "JUDGE" });
  const { tx } = useI18n();
  if (!user) return null;
  // Judges get their own home: the judging desk, not the overview.
  if (user.role === "JUDGE") return <JudgingDesk />;

  const c = counts.data?.participantCounts;
  const settings = counts.data?.settings;
  const isAdmin = user.role === "ADMIN";

  return (
    <Stack gap={{ base: "5", md: "6" }}>
      <Welcome user={user} />
      {counts.error && (
        <Flex align="center" gap="3" wrap="wrap">
          <Box flex="1" minW="48">
            <ErrorAlert message={readApiError(counts.error).message} />
          </Box>
          <Button size="sm" variant="outline" colorPalette="brand" onClick={() => void counts.refetch()}>
            {tx("Try again")}
          </Button>
        </Flex>
      )}
      <StatTiles counts={c} loading={counts.loading || Boolean(counts.error)} isAdmin={isAdmin} />
      <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: "5", md: "6" }} alignItems="stretch">
        <JudgingProgress counts={c} failed={Boolean(counts.error)} />
        <LatestRegistrations isAdmin={isAdmin} />
      </Grid>
      <Grid templateColumns={{ base: "1fr", lg: isAdmin ? "1fr 1fr" : "1fr" }} gap={{ base: "5", md: "6" }} alignItems="stretch">
        <ScoreDistribution settings={settings} />
        {isAdmin && <SetupChecklist />}
      </Grid>
    </Stack>
  );
}

// ——— Building blocks ———

// Card title row: an icon, the title (and a line under it), and an optional action on the right.
function CardTitle({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Flex align="flex-start" gap="3" justify="space-between">
      <Flex align="flex-start" gap="3" minW="0">
        <Box color="brand.700" mt="0.5" flexShrink={0}>
          <Icon size={24} strokeWidth={1.75} aria-hidden />
        </Box>
        <Box minW="0">
          <Heading size="md" color="brand.900">
            {title}
          </Heading>
          {subtitle && (
            <Text fontSize="sm" color="fg.muted">
              {subtitle}
            </Text>
          )}
        </Box>
      </Flex>
      {action}
    </Flex>
  );
}

// Empty state inside a card: a round icon, a short title, one line of help, maybe a button.
function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <Stack
      flex="1"
      align="center"
      justify="center"
      textAlign="center"
      gap="1.5"
      px="5"
      py="8"
      rounded="xl"
      bg="bg.subtle"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="blackAlpha.200"
    >
      <Circle size="12" bg="brand.50" color="brand.600" mb="1.5">
        <Icon size={22} strokeWidth={1.75} aria-hidden />
      </Circle>
      <Text fontWeight="semibold" color="brand.900">
        {title}
      </Text>
      <Text fontSize="sm" color="fg.muted" maxW="sm">
        {text}
      </Text>
      {action && <Box mt="3">{action}</Box>}
    </Stack>
  );
}

// ——— Sections ———

// Blue banner with the gold lattice: today, the greeting, main actions.
function Welcome({ user }: { user: User }) {
  const { tx, locale } = useI18n();
  const today = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <Box
      position="relative"
      overflow="hidden"
      rounded="2xl"
      bg="linear-gradient(120deg, #1A234E 0%, #1E2956 60%, #23305F 100%)"
      color="white"
      px={{ base: "6", md: "9" }}
      py={{ base: "6", md: "7" }}
      boxShadow="0 12px 30px -14px rgba(16,22,58,0.55)"
    >
      {/* Lattice across the band, fading behind the text */}
      <Box position="absolute" inset="0" aria-hidden>
        <StarLattice color="#C99A35" opacity={0.3} />
        <Box
          position="absolute"
          inset="0"
          bg="linear-gradient(to right, rgba(26,35,78,0.97) 0%, rgba(26,35,78,0.8) 40%, rgba(26,35,78,0.2) 100%)"
        />
      </Box>

      <Flex
        position="relative"
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        align={{ md: "flex-end" }}
        gap="6"
      >
        <Stack gap="1" maxW="xl">
          <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.18em" textTransform="uppercase" color="gold.300">
            {today}
          </Text>
          <Heading as="h1" fontFamily="display" fontSize={{ base: "xl", md: "2xl" }} lineHeight="1.2">
            {GREETING}
          </Heading>
          <Text color="whiteAlpha.800" mt="1">
            {user.role === "ADMIN"
              ? tx("Manage registrations and competition results.")
              : tx("Follow the registrations and the results as they come in.")}
          </Text>
        </Stack>

        <Flex gap="3" wrap="wrap" flexShrink={0}>
          <Button asChild size="lg" bg="gold.400" color="brand.950" _hover={{ bg: "gold.300" }}>
            <NextLink href="/participants">
              <Users size={18} aria-hidden />
              {tx("View participants")}
            </NextLink>
          </Button>
          <ExportResultsButton
            size="lg"
            variant="outline"
            color="white"
            bg="whiteAlpha.50"
            borderColor="whiteAlpha.500"
            _hover={{ bg: "whiteAlpha.200" }}
          >
            <FileText size={18} aria-hidden />
            {tx("Export results")}
          </ExportResultsButton>
        </Flex>
      </Flex>
    </Box>
  );
}

// Four numbers at a glance, each with its round colored icon.
function StatTiles({ counts, loading, isAdmin }: { counts?: Counts; loading: boolean; isAdmin: boolean }) {
  const awaiting = counts?.awaitingReview ?? 0;
  const { tx } = useI18n();
  const tiles: { label: string; value: number; caption: string; icon: LucideIcon; color: string; bg: string }[] = [
    {
      label: tx("Participants"),
      value: counts?.total ?? 0,
      caption: isAdmin && awaiting > 0 ? tx("{n} more awaiting your review", { n: awaiting }) : tx("Approved to compete"),
      icon: Users,
      color: "gold.600",
      bg: "gold.50",
    },
    { label: tx("Passed"), value: counts?.passed ?? 0, caption: tx("Judged as pass"), icon: CircleCheck, color: RESULT_COLORS.passed, bg: "green.50" },
    { label: tx("Failed"), value: counts?.failed ?? 0, caption: tx("Judged as fail"), icon: CircleX, color: "red.500", bg: "red.50" },
    { label: tx("Awaiting judging"), value: counts?.pending ?? 0, caption: tx("Not judged yet"), icon: Hourglass, color: "brand.600", bg: "brand.50" },
  ];

  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap={{ base: "3", md: "5" }}>
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Card.Root key={t.label}>
            <Card.Body p={{ base: "4", md: "5" }}>
              <Flex align="center" gap="4">
                <Circle size="14" bg={t.bg} color={t.color} flexShrink={0}>
                  <Icon size={26} strokeWidth={1.75} aria-hidden />
                </Circle>
                <Box minW="0">
                  <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.12em" textTransform="uppercase" color="fg.muted">
                    {t.label}
                  </Text>
                  <Skeleton loading={loading && !counts} w="fit-content">
                    <Text fontFamily="display" fontSize={{ base: "3xl", md: "4xl" }} lineHeight="1.1" color="brand.900">
                      {t.value}
                    </Text>
                  </Skeleton>
                  <Text fontSize="xs" color="fg.muted" truncate>
                    {t.caption}
                  </Text>
                </Box>
              </Flex>
            </Card.Body>
          </Card.Root>
        );
      })}
    </SimpleGrid>
  );
}

// How far the judging is: a bar, then the donut of passed / failed / still to judge.
function JudgingProgress({ counts, failed }: { counts?: Counts; failed: boolean }) {
  const total = counts?.total ?? 0;
  const judged = (counts?.passed ?? 0) + (counts?.failed ?? 0);
  const pct = total ? Math.round((judged / total) * 100) : 0;
  const { tx } = useI18n();

  return (
    <Card.Root h="full">
      <Card.Body gap="5">
        <CardTitle icon={Scale} title={tx("Judging progress")} />
        <Box>
          <Flex justify="space-between" fontSize="sm" mb="2">
            <Text color="fg.muted">
              {tx("{n} of {total} participants judged", { n: judged, total })}
            </Text>
            <Text fontWeight="semibold" color="brand.900">
              {pct}%
            </Text>
          </Flex>
          <Box
            h="2"
            rounded="full"
            bg="blackAlpha.100"
            overflow="hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={tx("Judging progress")}
          >
            <Box h="full" w={`${pct}%`} rounded="full" bg="brand.600" transition="width 0.4s" />
          </Box>
        </Box>
        {!counts && failed ? (
          <EmptyState icon={Scale} title={tx("Progress not available")} text={tx("The numbers could not be loaded. Try again above.")} />
        ) : !counts ? (
          <Skeleton h="200px" rounded="xl" />
        ) : judged === 0 ? (
          <EmptyState
            icon={Users}
            title={tx("Ready when your participants are")}
            text={total === 0 ? tx("Progress appears after judging begins.") : tx("The chart appears once the first points are entered.")}
          />
        ) : (
          <ResultsDonut counts={counts} />
        )}
      </Card.Body>
    </Card.Root>
  );
}

// The five newest registrations (the list comes newest first). Updates live like the rest.
// The admin sees every registration, so new ones waiting for review show up here first;
// the others see approved participants only.
function LatestRegistrations({ isAdmin }: { isAdmin: boolean }) {
  const { data, loading } = useQuery(PARTICIPANTS, {
    variables: { status: null, search: null, review: isAdmin ? null : "APPROVED" },
  });
  const link = useQuery(REGISTRATION_LINK, { skip: !isAdmin });
  const latest = data?.participants.slice(0, 5) ?? [];
  const url = link.data?.registrationLink?.url;
  const { tx } = useI18n();

  return (
    <Card.Root h="full">
      <Card.Body gap="4">
        <CardTitle
          icon={UserRound}
          title={tx("Latest registrations")}
          action={
            <Link asChild fontSize="sm" fontWeight="semibold" color="brand.600" flexShrink={0}>
              <NextLink href={isAdmin ? "/registrations" : "/participants"}>{tx("See all")}</NextLink>
            </Link>
          }
        />

        {loading && !data ? (
          <Stack gap="3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h="12" rounded="lg" />
            ))}
          </Stack>
        ) : latest.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={tx("No registrations yet")}
            text={tx("Share your link to welcome participants.")}
            action={
              url ? (
                <CopyButton value={url} size="sm" variant="outline" colorPalette="brand" icon={<Link2 size={16} aria-hidden />}>
                  {tx("Copy registration link")}
                </CopyButton>
              ) : isAdmin ? (
                <Button asChild size="sm" variant="outline" colorPalette="brand">
                  <NextLink href="/registration-link">
                    <Link2 size={16} aria-hidden />
                    {tx("Create the registration link")}
                  </NextLink>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Stack gap="0" mx="-2">
            {latest.map((p) => (
              <Flex
                key={p.id}
                asChild
                align="center"
                gap="3"
                px="2"
                py="2.5"
                rounded="lg"
                _hover={{ bg: "bg.subtle" }}
                _focusVisible={{ outline: "2px solid", outlineColor: "brand.500" }}
              >
                <NextLink href={`/participants/${p.id}`}>
                  <ParticipantPhoto path={p.photoUrl} size="thumb" />
                  <Box flex="1" minW="0">
                    <Text fontWeight="medium" truncate>
                      {p.fullName}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" truncate>
                      {p.institution} · {p.commune}
                    </Text>
                  </Box>
                  {p.review === "APPROVED" ? <StatusBadge status={p.status} finalist={p.finalist} /> : <ReviewBadge review={p.review} />}
                </NextLink>
              </Flex>
            ))}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}

// How the points are spread, against the pass mark. Uses the same cached list as "Latest registrations".
function ScoreDistribution({ settings }: { settings?: Settings }) {
  // The same cached list as the participants page's default view (approved participants).
  const { data } = useQuery(PARTICIPANTS, { variables: { status: null, search: null, review: "APPROVED" } });
  const scores = (data?.participants ?? []).flatMap((p) => (p.score === null ? [] : [p.score]));
  const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  const { tx } = useI18n();

  return (
    <Card.Root h="full">
      <Card.Body gap="5">
        <CardTitle
          icon={ChartColumn}
          title={tx("Score distribution")}
          subtitle={settings ? tx("Participant scores out of {n}", { n: settings.maxScore }) : tx("Participant scores")}
          action={
            average !== null && (
              <Box textAlign="end" flexShrink={0}>
                <Text fontSize="xs" letterSpacing="0.12em" textTransform="uppercase" color="fg.muted">
                  {tx("Average")}
                </Text>
                <Text fontFamily="display" fontSize="2xl" lineHeight="1.1" color="brand.900">
                  {average}
                </Text>
              </Box>
            )
          }
        />
        {!settings || !data ? (
          <Skeleton h="56" rounded="xl" />
        ) : scores.length === 0 ? (
          <EmptyState icon={ChartColumn} title={tx("Scores will appear here")} text={tx("Available once judges submit results.")} />
        ) : (
          <>
            <ScoreHistogram scores={scores} passMark={settings.passMark} maxScore={settings.maxScore} />
            <Wrap gap="5" fontSize="sm">
              <LegendKey color={RESULT_COLORS.passed} label={tx("Passed")} />
              <LegendKey color={RESULT_COLORS.failed} label={tx("Failed")} />
              <Flex align="center" gap="2">
                <Box w="4" borderTopWidth="2px" borderTopStyle="dashed" borderTopColor="gold.500" />
                <Text color="fg.muted">{tx("Pass mark ({n})", { n: settings.passMark })}</Text>
              </Flex>
            </Wrap>
          </>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <Flex align="center" gap="2">
      <Box w="3" h="3" rounded="sm" bg={color} />
      <Text color="fg.muted">{label}</Text>
    </Flex>
  );
}

// The admin's preparation, in the order it has to happen. Steps tick themselves off.
function SetupChecklist() {
  const terms = useQuery(REGISTRATION_TERMS);
  const link = useQuery(REGISTRATION_LINK);
  const team = useQuery(TEAM);
  const counts = useQuery(PARTICIPANT_COUNTS);

  const savedTerms = terms.data?.registrationTerms;
  const awaiting = counts.data?.participantCounts.awaitingReview ?? 0;
  // Active judges and staff (the admin and deactivated members do not count).
  const memberCount = team.data?.users.filter((u) => u.role !== "ADMIN" && u.isActive).length ?? 0;
  const regLink = link.data?.registrationLink;
  const { tx } = useI18n();

  const steps: { key: string; title: string; detail: string; done: boolean | null; action: ReactNode }[] = [
    {
      key: "terms",
      title: tx("Write the terms and conditions"),
      detail: savedTerms ? tx("Version {n}", { n: savedTerms.version }) : tx("People accept them to register. Nobody can register before."),
      done: Boolean(savedTerms),
      action: savedTerms ? (
        <RowLink href="/registration-link">{tx("Edit")}</RowLink>
      ) : (
        <RowButton href="/registration-link">{tx("Write terms")}</RowButton>
      ),
    },
    {
      key: "link",
      title: tx("Share registration link"),
      detail: regLink
        ? regLink.isOpen
          ? tx("Registration is open")
          : tx("Registration is closed")
        : tx("Post it in the participants’ WhatsApp group."),
      done: Boolean(regLink),
      action: regLink ? (
        <CopyButton value={regLink.url} size="sm" variant="ghost" colorPalette="brand" px="2" after={<ChevronRight size={16} aria-hidden />}>
          {tx("Copy link")}
        </CopyButton>
      ) : (
        <RowButton href="/registration-link">{tx("Create link")}</RowButton>
      ),
    },
    {
      key: "team",
      title: tx("Invite judges and staff"),
      detail: memberCount
        ? memberCount === 1
          ? tx("1 active member")
          : tx("{n} active members", { n: memberCount })
        : tx("Judges enter the points."),
      done: memberCount > 0,
      action: memberCount > 0 ? <RowLink href="/team">{tx("Manage")}</RowLink> : <RowButton href="/team">{tx("Invite")}</RowButton>,
    },
    {
      key: "review",
      title: tx("Review registrations"),
      detail: awaiting
        ? tx("{n} waiting for your decision", { n: awaiting })
        : tx("Approve or reject each one against the terms. Only approved people compete."),
      // Ongoing while registration is open: a reminder, not a step to tick off.
      done: null,
      action:
        awaiting > 0 ? <RowButton href="/registrations">{tx("Review")}</RowButton> : <RowLink href="/registrations">{tx("Open")}</RowLink>,
    },
    {
      key: "passmark",
      title: tx("Confirm pass mark"),
      detail: tx("Points at or above it count as passed."),
      // Always has a value, so there is nothing to tick off: only a reminder to check it.
      done: null,
      action: <RowButton href="/settings#competition">{tx("Review")}</RowButton>,
    },
  ];
  const tracked = steps.filter((s) => s.done !== null);
  const doneCount = tracked.filter((s) => s.done).length;
  const pct = Math.round((doneCount / tracked.length) * 100);

  return (
    <Card.Root h="full">
      <Card.Body gap="3" pb="2">
        <CardTitle
          icon={SettingsIcon}
          title={tx("Competition setup")}
          action={
            <Flex align="center" gap="3" flexShrink={0}>
              <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
                {tx("{n} of {total} completed", { n: doneCount, total: tracked.length })}
              </Text>
              <Box w={{ base: "16", sm: "28" }} h="2" rounded="full" bg="blackAlpha.100" overflow="hidden" aria-hidden>
                <Box h="full" w={`${pct}%`} rounded="full" bg="gold.400" transition="width 0.4s" />
              </Box>
            </Flex>
          }
        />
        <Box mx="-6">
          {steps.map((step, i) => (
            <Flex key={step.key} align="center" gap="4" px="6" py="3.5" borderTopWidth="1px" borderColor="blackAlpha.100">
              {step.done ? (
                <Circle size="8" flexShrink={0} bg={RESULT_COLORS.passed} color="white" aria-label={tx("Done")}>
                  <Check size={16} strokeWidth={3} aria-hidden />
                </Circle>
              ) : (
                <Circle
                  size="8"
                  flexShrink={0}
                  borderWidth="1.5px"
                  borderColor="gold.400"
                  color="gold.700"
                  fontSize="sm"
                  fontWeight="semibold"
                >
                  {i + 1}
                </Circle>
              )}
              <Box flex="1" minW="0">
                <Text fontWeight="medium" color="brand.900">
                  {step.title}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {step.detail}
                </Text>
              </Box>
              {step.action}
            </Flex>
          ))}
        </Box>
      </Card.Body>
    </Card.Root>
  );
}

// A done step: quiet text link with a chevron.
function RowLink({ href, children }: { href: string; children: string }) {
  return (
    <Button asChild size="sm" variant="ghost" colorPalette="brand" px="2">
      <NextLink href={href}>
        {children}
        <ChevronRight size={16} aria-hidden />
      </NextLink>
    </Button>
  );
}

// A step still to do: a small outlined button.
function RowButton({ href, children }: { href: string; children: string }) {
  return (
    <Button asChild size="sm" variant="outline" colorPalette="gray">
      <NextLink href={href}>{children}</NextLink>
    </Button>
  );
}
