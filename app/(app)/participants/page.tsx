"use client";

import { useQuery } from "@apollo/client/react";
import {
  Badge,
  Box,
  Button,
  Card,
  Collapsible,
  Flex,
  IconButton,
  Image,
  Input,
  InputGroup,
  Menu,
  NativeSelect,
  Portal,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ExportResultsButton } from "@/components/ExportResultsButton";
import { RESULT_COLORS } from "@/components/OverviewCharts";
import { PageHeader } from "@/components/PageHeader";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { StatusBadge } from "@/components/StatusBadge";
import { apiUrl } from "@/lib/api";
import { copyText } from "@/lib/clipboard";
import { ageOf } from "@/lib/dates";
import { readApiError } from "@/lib/errors";
import {
  PARTICIPANT_COUNTS,
  PARTICIPANTS,
  type Gender,
  type ParticipantRow,
  type ParticipantStatus,
  type Settings,
} from "@/lib/graphql/participants";
import { formatPhone, reachPhone } from "@/lib/phone";
import type { AppKey } from "@/lib/i18n";
import { Copy, Download, Ellipsis, Eye, LayoutGrid, List, Phone, Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Result tabs: filtered on the server, with the server's counts.
const TABS: {
  status: ParticipantStatus | null;
  label: AppKey;
  count: "total" | "pending" | "passed" | "failed";
  dot: string;
}[] = [
  { status: null, label: "All", count: "total", dot: "#B3832A" },
  { status: "PENDING", label: "Not judged", count: "pending", dot: "#a1a1aa" },
  { status: "PASSED", label: "Passed", count: "passed", dot: RESULT_COLORS.passed },
  { status: "FAILED", label: "Failed", count: "failed", dot: RESULT_COLORS.failed },
];

// The other filters run in the browser on the loaded list (one competition: a few hundred people).
// Labels are English keys, shown through tx().
const AGE_GROUPS: { value: string; label: AppKey; test: (a: number) => boolean }[] = [
  { value: "u10", label: "Under 10", test: (a: number) => a < 10 },
  { value: "10-13", label: "10 to 13", test: (a: number) => a >= 10 && a <= 13 },
  { value: "14-17", label: "14 to 17", test: (a: number) => a >= 14 && a <= 17 },
  { value: "18+", label: "18 and over", test: (a: number) => a >= 18 },
];

const GENDER_LABELS: Record<Gender, AppKey> = { MALE: "Boy", FEMALE: "Girl" };

const SORTS: Record<string, { label: AppKey; compare: (a: ParticipantRow, b: ParticipantRow) => number }> = {
  newest: { label: "Newest first", compare: (a: ParticipantRow, b: ParticipantRow) => b.registeredAt.localeCompare(a.registeredAt) },
  oldest: { label: "Oldest first", compare: (a: ParticipantRow, b: ParticipantRow) => a.registeredAt.localeCompare(b.registeredAt) },
  // The default. Capitals and accents ignored ("AMURI" next to "Amina"); same name: lower number first.
  name: {
    label: "Name A–Z",
    compare: (a: ParticipantRow, b: ParticipantRow) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }) || (a.number ?? 0) - (b.number ?? 0),
  },
  pointsHigh: { label: "Points: high to low", compare: (a: ParticipantRow, b: ParticipantRow) => (b.score ?? -1) - (a.score ?? -1) },
  pointsLow: {
    label: "Points: low to high",
    compare: (a: ParticipantRow, b: ParticipantRow) => (a.score ?? Infinity) - (b.score ?? Infinity),
  },
};
type SortKey = "newest" | "oldest" | "name" | "pointsHigh" | "pointsLow";

type Filters = { province: string; commune: string; institution: string; gender: "" | Gender; age: string };
const NO_FILTERS: Filters = { province: "", commune: "", institution: "", gender: "", age: "" };

type View = "list" | "grid";
const VIEW_KEY = "participants-view";

// The chosen view, remembered in localStorage (or only in memory in a private window).
let memoryView: View | null = null;
const viewListeners = new Set<() => void>();
function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => void viewListeners.delete(listener);
}
function readView(): View {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved) return saved === "grid" ? "grid" : "list";
  } catch {
    // private window: fall back to memory
  }
  return memoryView ?? "list";
}

const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export default function ParticipantsPage() {
  const [status, setStatus] = useState<ParticipantStatus | null>(null);
  const [searchText, setSearchText] = useState("");
  const search = useDebounced(searchText.trim(), 300);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>("name");
  const [showFilters, setShowFilters] = useState(false);
  // The server always draws the list; the remembered view takes over once in the browser.
  const view = useSyncExternalStore(subscribeView, readView, () => "list" as View);

  const counts = useQuery(PARTICIPANT_COUNTS);
  // Approved registrations only: the competitors. The admin reviews the others on /registrations.
  const list = useQuery(PARTICIPANTS, { variables: { status, search: search || null, review: "APPROVED" } });

  const loaded = list.data?.participants ?? list.previousData?.participants;
  const c = counts.data?.participantCounts;
  const settings = counts.data?.settings;
  const { tx } = useI18n();

  // Choices come from the people actually registered; communes follow the chosen province.
  const options = useMemo(() => {
    const all = loaded ?? [];
    const inProvince = filters.province ? all.filter((p) => p.province === filters.province) : all;
    return {
      provinces: uniqueSorted(all.map((p) => p.province)),
      communes: uniqueSorted(inProvince.map((p) => p.commune)),
      institutions: uniqueSorted(inProvince.map((p) => p.institution)),
    };
  }, [loaded, filters.province]);

  const participants = useMemo(() => {
    const age = AGE_GROUPS.find((g) => g.value === filters.age);
    return (loaded ?? [])
      .filter(
        (p) =>
          (!filters.province || p.province === filters.province) &&
          (!filters.commune || p.commune === filters.commune) &&
          (!filters.institution || p.institution === filters.institution) &&
          (!filters.gender || p.gender === filters.gender) &&
          (!age || age.test(ageOf(p.dateOfBirth))),
      )
      .sort(SORTS[sort]!.compare);
  }, [loaded, filters, sort]);

  const chips = activeChips(filters, tx);
  const anyFilter = Boolean(search || status || chips.length);

  function changeView(v: View) {
    memoryView = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // private window: the choice just isn't remembered
    }
    viewListeners.forEach((listener) => listener());
  }
  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    // A new province resets the commune and mosque/school, which may not exist there.
    setFilters((f) => (key === "province" ? { ...f, province: value as string, commune: "", institution: "" } : { ...f, [key]: value }));
  }
  function resetAll() {
    setStatus(null);
    setSearchText("");
    setFilters(NO_FILTERS);
  }

  return (
    <>
      <PageHeader
        title={tx("Participants")}
        description={
          settings
            ? tx("Approved participants. Pass mark {mark} of {max} points. Points appear by themselves.", {
                mark: settings.passMark,
                max: settings.maxScore,
              })
            : tx("Approved participants. Points appear by themselves.")
        }
        actions={
          <ExportResultsButton variant="outline" colorPalette="brand" bg="white">
            <DownloadIcon />
            {tx("Results PDF")}
          </ExportResultsButton>
        }
      />

      <Card.Root overflow="hidden">
        {/* Result tabs */}
        <Flex gap="1" overflowX="auto" role="tablist" aria-label={tx("Filter by result")} px={{ base: "2", md: "4" }} borderBottomWidth="1px">
          {TABS.map((t) => {
            const active = status === t.status;
            return (
              <Flex
                as="button"
                key={t.label}
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(t.status)}
                align="center"
                gap="2"
                px="3"
                pt="3.5"
                pb="3"
                mb="-1px"
                fontSize="sm"
                whiteSpace="nowrap"
                fontWeight={active ? "semibold" : "medium"}
                color={active ? "brand.900" : "fg.muted"}
                borderBottomWidth="2px"
                borderBottomColor={active ? "gold.400" : "transparent"}
                cursor="pointer"
                transition="color 0.15s, border-color 0.15s"
                _hover={{ color: "brand.900" }}
                _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "-2px" }}
              >
                <Box w="2" h="2" rounded="full" bg={t.dot} flexShrink={0} />
                {tx(t.label)}
                <Text
                  as="span"
                  fontSize="xs"
                  px="1.5"
                  rounded="full"
                  minW="6"
                  textAlign="center"
                  bg={active ? "brand.900" : "bg.muted"}
                  color={active ? "white" : "fg.muted"}
                >
                  {c ? c[t.count] : "·"}
                </Text>
              </Flex>
            );
          })}
        </Flex>

        {/* Search, filters button, sort, view */}
        <Stack gap="3" px={{ base: "3", md: "4" }} py="3" bg="bg.subtle" borderBottomWidth="1px">
          <Flex gap="2" wrap="wrap" align="center">
            <InputGroup
              flex="1"
              minW={{ base: "full", sm: "64" }}
              startElement={<SearchIcon />}
              endElement={
                searchText ? (
                  <Box
                    as="button"
                    aria-label={tx("Clear search")}
                    color="fg.muted"
                    cursor="pointer"
                    _hover={{ color: "fg" }}
                    onClick={() => setSearchText("")}
                  >
                    <ClearIcon />
                  </Box>
                ) : undefined
              }
            >
              <Input
                size="sm"
                bg="white"
                placeholder={tx("Search name, phone, halaqa, commune")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </InputGroup>

            <Button
              size="sm"
              variant={showFilters || chips.length ? "subtle" : "outline"}
              colorPalette="brand"
              bg={showFilters || chips.length ? undefined : "white"}
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <FilterIcon />
              {tx("Filters")}
              {chips.length > 0 && (
                <Badge size="xs" variant="solid" colorPalette="brand" rounded="full">
                  {chips.length}
                </Badge>
              )}
            </Button>

            <NativeSelect.Root size="sm" w={{ base: "auto", sm: "48" }} flex={{ base: "1", sm: "none" }}>
              <NativeSelect.Field
                bg="white"
                aria-label={tx("Sort")}
                value={sort}
                onChange={(e) => setSort(e.currentTarget.value as SortKey)}
              >
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key}>
                    {tx(s.label)}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>

            <Flex borderWidth="1px" rounded="md" bg="white" p="0.5" gap="0.5" role="group" aria-label={tx("View")}>
              <ViewButton active={view === "list"} label={tx("List")} onClick={() => changeView("list")}>
                <ListIcon />
              </ViewButton>
              <ViewButton active={view === "grid"} label={tx("Photo grid")} onClick={() => changeView("grid")}>
                <GridIcon />
              </ViewButton>
            </Flex>
          </Flex>

          {/* Filter panel */}
          <Collapsible.Root open={showFilters}>
            <Collapsible.Content>
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 5 }} gap="3" pt="1">
                <FilterSelect label={tx("Province")} value={filters.province} onChange={(v) => setFilter("province", v)} placeholder={tx("All provinces")}>
                  {options.provinces}
                </FilterSelect>
                <FilterSelect label={tx("Commune")} value={filters.commune} onChange={(v) => setFilter("commune", v)} placeholder={tx("All communes")}>
                  {options.communes}
                </FilterSelect>
                <FilterSelect
                  label={tx("Halaqa")}
                  value={filters.institution}
                  onChange={(v) => setFilter("institution", v)}
                  placeholder={tx("All")}
                >
                  {options.institutions}
                </FilterSelect>
                <FilterSelect
                  label={tx("Gender")}
                  value={filters.gender}
                  onChange={(v) => setFilter("gender", v as Filters["gender"])}
                  placeholder={tx("Boys and girls")}
                  labels={{ MALE: tx(GENDER_LABELS.MALE), FEMALE: tx(GENDER_LABELS.FEMALE) }}
                >
                  {["MALE", "FEMALE"]}
                </FilterSelect>
                <FilterSelect
                  label={tx("Age")}
                  value={filters.age}
                  onChange={(v) => setFilter("age", v)}
                  placeholder={tx("All ages")}
                  labels={Object.fromEntries(AGE_GROUPS.map((g) => [g.value, tx(g.label)]))}
                >
                  {AGE_GROUPS.map((g) => g.value)}
                </FilterSelect>
              </SimpleGrid>
            </Collapsible.Content>
          </Collapsible.Root>

          {/* Active filters as chips */}
          {chips.length > 0 && (
            <Flex gap="2" wrap="wrap" align="center">
              {chips.map((chip) => (
                <Flex
                  key={chip.key}
                  align="center"
                  gap="1.5"
                  ps="2.5"
                  pe="1"
                  py="0.5"
                  rounded="full"
                  fontSize="xs"
                  bg="white"
                  borderWidth="1px"
                  borderColor="gold.300"
                >
                  <Text color="fg.muted">{chip.label}:</Text>
                  <Text fontWeight="semibold" color="brand.900">
                    {chip.value}
                  </Text>
                  <IconButton
                    aria-label={tx("Remove the filter {name}", { name: chip.label })}
                    size="2xs"
                    variant="ghost"
                    rounded="full"
                    onClick={() => setFilter(chip.key, "")}
                  >
                    <ClearIcon />
                  </IconButton>
                </Flex>
              ))}
              <Button size="xs" variant="plain" color="brand.600" onClick={() => setFilters(NO_FILTERS)}>
                {tx("Clear filters")}
              </Button>
            </Flex>
          )}
        </Stack>

        <ErrorAlert message={list.error ? readApiError(list.error).message : null} />

        {!loaded ? (
          <Stack p="4" gap="3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h="14" rounded="md" />
            ))}
          </Stack>
        ) : participants.length === 0 ? (
          <EmptyState filtered={anyFilter} onReset={resetAll} />
        ) : view === "grid" ? (
          <PhotoGrid participants={participants} />
        ) : (
          <ParticipantList participants={participants} settings={settings} />
        )}

        {loaded && participants.length > 0 && (
          <Text px="5" py="3" fontSize="xs" color="fg.muted" borderTopWidth="1px" bg="bg.subtle">
            {anyFilter && c
              ? tx("{n} of {total} participants", { n: participants.length, total: c.total })
              : participants.length === 1
                ? tx("1 participant")
                : tx("{n} participants", { n: participants.length })}{" "}
            · {tx(SORTS[sort]!.label).toLowerCase()}
          </Text>
        )}
      </Card.Root>
    </>
  );
}

function activeChips(f: Filters, tx: ReturnType<typeof useI18n>["tx"]) {
  const chips: { key: keyof Filters; label: string; value: string }[] = [];
  if (f.province) chips.push({ key: "province", label: tx("Province"), value: f.province });
  if (f.commune) chips.push({ key: "commune", label: tx("Commune"), value: f.commune });
  if (f.institution) chips.push({ key: "institution", label: tx("Halaqa"), value: f.institution });
  if (f.gender) chips.push({ key: "gender", label: tx("Gender"), value: tx(GENDER_LABELS[f.gender]) });
  if (f.age) chips.push({ key: "age", label: tx("Age"), value: tx(AGE_GROUPS.find((g) => g.value === f.age)!.label) });
  return chips;
}

// Computers and tablets: a table. Phones: one row-card per participant.
function ParticipantList({ participants, settings }: { participants: ParticipantRow[]; settings?: Settings }) {
  const router = useRouter();
  const { tx } = useI18n();
  return (
    <>
      <Table.ScrollArea display={{ base: "none", md: "block" }}>
        <Table.Root size="md" interactive>
          <Table.Header>
            <Table.Row bg="white/50">
              <HeaderCell ps="5">{tx("Participant")}</HeaderCell>
              <HeaderCell>{tx("Place")}</HeaderCell>
              <HeaderCell>{tx("Phone")}</HeaderCell>
              <HeaderCell>{tx("Points")}</HeaderCell>
              <HeaderCell>{tx("Result")}</HeaderCell>
              <HeaderCell pe="4" w="12" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {participants.map((p) => {
              const href = `/participants/${p.id}`;
              return (
                <Table.Row key={p.id} cursor="pointer" onClick={() => router.push(href)} _hover={{ bg: "brand.50/60" }}>
                  <Table.Cell ps="5" py="3">
                    <Flex gap="3" align="center">
                      <ParticipantPhoto path={p.photoUrl} size="thumb" />
                      <Box minW="0">
                        <Box asChild fontWeight="semibold" color="brand.900" _hover={{ textDecoration: "underline" }}>
                          <NextLink href={href} onClick={(e) => e.stopPropagation()}>
                            {p.fullName}
                          </NextLink>
                        </Box>
                        <Text fontSize="xs" color="fg.muted">
                          {p.number !== null && `N° ${p.number} · `}
                          {tx(GENDER_LABELS[p.gender])} · {tx("{n} years", { n: ageOf(p.dateOfBirth) })}
                        </Text>
                      </Box>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell maxW="60">
                    <Text fontSize="sm" truncate>
                      {p.institution}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" truncate>
                      {p.commune}, {p.province}
                    </Text>
                  </Table.Cell>
                  <Table.Cell whiteSpace="nowrap" color="fg.muted" fontSize="sm">
                    {formatPhone(reachPhone(p))}
                    {!p.phone && p.contact && (
                      <Text fontSize="xs" truncate maxW="40">
                        {tx("via {name}", { name: p.contact.name })}
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <PointsCell score={p.score} settings={settings} />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={p.status} />
                  </Table.Cell>
                  <Table.Cell pe="4" onClick={(e) => e.stopPropagation()}>
                    <RowMenu participant={p} />
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>

      <Stack display={{ base: "flex", md: "none" }} gap="0">
        {participants.map((p, i) => (
          <Flex key={p.id} gap="3" align="center" px="4" py="3" borderTopWidth={i === 0 ? "0" : "1px"}>
            <Flex asChild gap="3" align="center" flex="1" minW="0">
              <NextLink href={`/participants/${p.id}`}>
                <ParticipantPhoto path={p.photoUrl} size="thumb" />
                <Box flex="1" minW="0">
                  <Text fontWeight="semibold" color="brand.900" truncate>
                    {p.fullName}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" truncate>
                    {p.number !== null && `N° ${p.number} · `}
                    {p.institution} · {p.commune}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {tx(GENDER_LABELS[p.gender])} · {tx("{n} years", { n: ageOf(p.dateOfBirth) })}
                  </Text>
                </Box>
                <Stack align="flex-end" gap="1" flexShrink={0}>
                  <Text fontFamily="display" fontSize="lg" lineHeight="1" color="brand.900">
                    {p.score ?? "—"}
                  </Text>
                  <StatusBadge status={p.status} />
                </Stack>
              </NextLink>
            </Flex>
            <RowMenu participant={p} />
          </Flex>
        ))}
      </Stack>
    </>
  );
}

// Passport photos as cards: handy for recognising participants on the day.
function PhotoGrid({ participants }: { participants: ParticipantRow[] }) {
  const { tx } = useI18n();
  return (
    <SimpleGrid columns={{ base: 2, sm: 3, md: 4, xl: 5 }} gap={{ base: "3", md: "4" }} p={{ base: "3", md: "5" }}>
      {participants.map((p) => (
        <Box
          key={p.id}
          asChild
          position="relative"
          rounded="lg"
          borderWidth="1px"
          bg="white"
          overflow="hidden"
          transition="box-shadow 0.15s, transform 0.15s"
          _hover={{ shadow: "md", transform: "translateY(-2px)" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "brand.500" }}
          _motionReduce={{ transition: "none", _hover: { transform: "none" } }}
        >
          <NextLink href={`/participants/${p.id}`}>
            <Box position="relative" bg="bg.muted" aspectRatio={3 / 4}>
              <Image src={apiUrl(p.photoUrl)} alt="" w="full" h="full" objectFit="cover" loading="lazy" />
              <Box position="absolute" top="2" right="2">
                <StatusBadge status={p.status} />
              </Box>
              {p.score !== null && (
                <Box
                  position="absolute"
                  bottom="2"
                  left="2"
                  bg="brand.900/85"
                  color="white"
                  rounded="md"
                  px="2"
                  py="0.5"
                  fontFamily="display"
                  fontSize="sm"
                >
                  {tx("{n} pts", { n: p.score })}
                </Box>
              )}
            </Box>
            <Box px="3" py="2.5" borderTopWidth="2px" borderTopColor="gold.400">
              <Text fontWeight="semibold" fontSize="sm" color="brand.900" truncate>
                {p.fullName}
              </Text>
              <Text fontSize="xs" color="fg.muted" truncate>
                {p.number !== null && `N° ${p.number} · `}
                {p.institution}
              </Text>
            </Box>
          </NextLink>
        </Box>
      ))}
    </SimpleGrid>
  );
}

// "⋯" on each row: open, copy the phone number, call.
function RowMenu({ participant: p }: { participant: ParticipantRow }) {
  const [copied, setCopied] = useState<boolean | null>(null); // null: not tried yet
  const { tx } = useI18n();
  const phone = reachPhone(p);
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }} onExitComplete={() => setCopied(null)}>
      <Menu.Trigger asChild>
        <IconButton aria-label={tx("More for {name}", { name: p.fullName })} size="sm" variant="ghost" color="fg.muted">
          <MoreIcon />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="52">
            <Menu.Item value="open" asChild>
              <NextLink href={`/participants/${p.id}`}>
                <EyeIcon />
                {tx("Open details")}
              </NextLink>
            </Menu.Item>
            <Menu.Item
              value="copy"
              closeOnSelect={false}
              onSelect={() => {
                void copyText(phone ?? "").then(setCopied);
              }}
            >
              <CopyIcon />
              {copied === null ? tx("Copy phone number") : copied ? tx("Copied!") : tx("Copy failed")}
            </Menu.Item>
            <Menu.Item value="call" asChild>
              <a href={`tel:${phone ?? ""}`}>
                <PhoneIcon />
                {tx("Call {phone}", { phone: formatPhone(phone) })}
              </a>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  placeholder,
  labels,
  children: values,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  labels?: Record<string, string>;
  children: string[];
}) {
  return (
    <Stack gap="1">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
        {label}
      </Text>
      <NativeSelect.Root size="sm">
        <NativeSelect.Field bg="white" value={value} onChange={(e) => onChange(e.currentTarget.value)} aria-label={label}>
          <option value="">{placeholder}</option>
          {values.map((v) => (
            <option key={v} value={v}>
              {labels?.[v] ?? v}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Stack>
  );
}

function ViewButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <IconButton
      aria-label={label}
      aria-pressed={active}
      title={label}
      size="xs"
      variant={active ? "solid" : "ghost"}
      colorPalette={active ? "brand" : "gray"}
      onClick={onClick}
    >
      {children}
    </IconButton>
  );
}

function HeaderCell(props: ComponentProps<typeof Table.ColumnHeader>) {
  return (
    <Table.ColumnHeader
      fontSize="xs"
      letterSpacing="0.08em"
      textTransform="uppercase"
      color="fg.muted"
      fontWeight="semibold"
      py="2.5"
      {...props}
    />
  );
}

// The points, and a small bar against the gold pass-mark tick.
function PointsCell({ score, settings }: { score: number | null; settings?: Settings }) {
  const { tx } = useI18n();
  if (score === null) {
    return (
      <Text color="fg.subtle" fontSize="sm">
        {tx("Not judged")}
      </Text>
    );
  }
  const max = settings?.maxScore ?? 100;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const passed = settings ? score >= settings.passMark : true;
  return (
    <Flex align="center" gap="3">
      <Text fontWeight="semibold" minW="7" textAlign="end">
        {score}
      </Text>
      <Box position="relative" w="20" h="1.5" rounded="full" bg="bg.muted" aria-hidden>
        <Box
          position="absolute"
          insetY="0"
          left="0"
          w={pct(score)}
          rounded="full"
          bg={passed ? RESULT_COLORS.passed : RESULT_COLORS.failed}
        />
        {settings && <Box position="absolute" top="-1" bottom="-1" left={pct(settings.passMark)} w="0.5" bg="gold.500" />}
      </Box>
    </Flex>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  const { tx } = useI18n();
  return (
    <Stack align="center" textAlign="center" gap="2" py="14" px="6">
      <Text color="gold.400" fontSize="4xl" lineHeight="1" aria-hidden>
        ۞
      </Text>
      <Text fontWeight="semibold" color="brand.900">
        {filtered ? tx("Nobody matches these filters") : tx("Nobody has registered yet")}
      </Text>
      <Text fontSize="sm" color="fg.muted" maxW="sm">
        {filtered
          ? tx("Try another name or number, or remove a filter.")
          : tx("Share the registration link with the participants. They appear here once you approve them.")}
      </Text>
      {filtered && (
        <Button size="sm" variant="outline" colorPalette="brand" mt="2" onClick={onReset}>
          {tx("Show everyone")}
        </Button>
      )}
    </Stack>
  );
}

// The value, but only after it stopped changing for `ms` (no request on every key press).
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

// Icons (lucide)
function SearchIcon() {
  return <Search size={16} aria-hidden />;
}
function ClearIcon() {
  return <X size={14} aria-hidden />;
}
function DownloadIcon() {
  return <Download size={16} aria-hidden />;
}
function FilterIcon() {
  return <SlidersHorizontal size={16} aria-hidden />;
}
function ListIcon() {
  return <List size={16} aria-hidden />;
}
function GridIcon() {
  return <LayoutGrid size={16} aria-hidden />;
}
function MoreIcon() {
  return <Ellipsis size={16} aria-hidden />;
}
function EyeIcon() {
  return <Eye size={16} aria-hidden />;
}
function CopyIcon() {
  return <Copy size={16} aria-hidden />;
}
function PhoneIcon() {
  return <Phone size={16} aria-hidden />;
}
