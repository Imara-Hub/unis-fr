"use client";

import { skipToken, useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, CloseButton, Dialog, Flex, Input, Portal, Stack, Text } from "@chakra-ui/react";
import { CalendarDays, CalendarPlus, Eye, History, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dropdown } from "@/components/Dropdown";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { toaster } from "@/components/Toaster";
import { readApiError } from "@/lib/errors";
import { SEASONS, START_SEASON, type Season } from "@/lib/graphql/seasons";
import { useI18n } from "@/lib/i18n";
import { setViewedSeason, useViewedSeason } from "@/lib/season";

// Competition years in the web app: a picker in the top bar (admin and staff) once there is more
// than one year, a band above every page while a past year is open (read-only), and the
// "Competition years" section of Settings where the admin starts the next year.

// Switches the whole app to another year: every loaded list is fetched again for it.
function useSwitchSeason() {
  const client = useApolloClient();
  return async (year: number | null) => {
    setViewedSeason(year);
    await client.resetStore().catch(() => undefined);
  };
}

const dateOf = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : lang, { day: "numeric", month: "long", year: "numeric" });

export function SeasonSwitcher() {
  const { data } = useQuery(SEASONS);
  const viewed = useViewedSeason();
  const switchTo = useSwitchSeason();
  const { tx } = useI18n();
  const seasons = data?.seasons ?? [];
  const current = seasons.find((s) => s.current)?.year ?? null;

  // A year that is the current one again, or no longer listed: back to the current year.
  useEffect(() => {
    if (!data || viewed === null) return;
    if (viewed === current || !data.seasons.some((s) => s.year === viewed)) void switchTo(null);
  }, [data, viewed, current, switchTo]);

  if (seasons.length < 2 || current === null) return null;
  return (
    <Dropdown
      shape="pill"
      size="sm"
      label={tx("Competition year")}
      icon={<CalendarDays size={16} />}
      value={String(viewed ?? current)}
      onChange={(v) => {
        const year = Number(v);
        void switchTo(year === current ? null : year);
      }}
      options={seasons.map((s) => ({
        value: String(s.year),
        label: String(s.year), // short: the picker fits a phone's top bar
        icon: s.current ? <CalendarDays size={14} /> : <History size={14} />,
        detail: [s.name, s.current ? tx("Current year") : tx("{n} participants · read only", { n: s.participantCount })]
          .filter(Boolean)
          .join(" · "),
      }))}
    />
  );
}

// Above every page while a past year is open.
export function SeasonBanner() {
  const viewed = useViewedSeason();
  const { data } = useQuery(SEASONS, viewed === null ? skipToken : {});
  const switchTo = useSwitchSeason();
  const { tx } = useI18n();
  const current = data?.seasons.find((s) => s.current)?.year ?? null;
  if (viewed === null || current === null || viewed === current) return null;
  return (
    <Flex
      align={{ base: "stretch", sm: "center" }}
      direction={{ base: "column", sm: "row" }}
      gap="3"
      mb="5"
      px="4"
      py="3"
      rounded="xl"
      bg="gold.50"
      borderWidth="1px"
      borderColor="gold.200"
      color="gold.900"
    >
      <Flex align="center" gap="2.5" flex="1" minW="0">
        <Box color="gold.600" flexShrink={0}>
          <History size={18} aria-hidden />
        </Box>
        <Text fontSize="sm">
          <Text as="span" fontWeight="bold">
            {tx("You are looking at {year}.", { year: viewed })}
          </Text>{" "}
          {tx("Its results stay as they were: nothing can be changed here.")}
        </Text>
      </Flex>
      <Button size="sm" variant="solid" colorPalette="brand" onClick={() => void switchTo(null)} flexShrink={0}>
        <Undo2 size={15} aria-hidden />
        {tx("Back to {year}", { year: current })}
      </Button>
    </Flex>
  );
}

// Settings → Competition years (admin).
export function CompetitionYears() {
  const { data, loading, error } = useQuery(SEASONS);
  const viewed = useViewedSeason();
  const switchTo = useSwitchSeason();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const { tx, lang } = useI18n();

  if (loading && !data) return <Text color="fg.muted">{tx("Loading…")}</Text>;
  if (!data) return <ErrorAlert message={readApiError(error).message} />;
  const seasons = data.seasons;
  const current = seasons.find((s) => s.current) ?? null;
  const lookingBack = viewed !== null && viewed !== current?.year;

  return (
    <Stack gap="5">
      <Text fontSize="sm" color="fg.muted">
        {tx(
          "Each year keeps its participants, envelopes, judges’ sheets and results for good. Start the next year when this one is over: it begins empty, and the past years stay here to look back at.",
        )}
      </Text>

      <Stack gap="2.5">
        {seasons.map((s) => (
          <Flex
            key={s.year}
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
            gap="3"
            p="4"
            rounded="xl"
            borderWidth="1px"
            borderColor={s.current ? "brand.200" : "border"}
            bg={s.current ? "brand.50" : "bg"}
          >
            <Flex align="center" gap="3" flex="1" minW="0">
              <Flex
                align="center"
                justify="center"
                w="12"
                h="12"
                rounded="lg"
                flexShrink={0}
                bg={s.current ? "brand.600" : "bg.muted"}
                color={s.current ? "white" : "brand.900"}
                fontWeight="bold"
                fontSize="sm"
                fontVariantNumeric="tabular-nums"
              >
                {s.year}
              </Flex>
              <Box minW="0">
                <Flex align="center" gap="2" wrap="wrap">
                  <Text fontWeight="semibold" color="brand.900" truncate>
                    {s.name ?? tx("Competition {year}", { year: s.year })}
                  </Text>
                  {s.current ? (
                    <Badge colorPalette="green" variant="subtle">
                      {tx("Current year")}
                    </Badge>
                  ) : (
                    <Badge colorPalette="gray" variant="subtle">
                      {tx("Closed")}
                    </Badge>
                  )}
                </Flex>
                <Text fontSize="sm" color="fg.muted">
                  {tx("{n} participants · {m} with a final score", { n: s.participantCount, m: s.judgedCount })}
                  {" · "}
                  {s.closedAt
                    ? tx("closed on {date}", { date: dateOf(s.closedAt, lang) })
                    : tx("since {date}", { date: dateOf(s.startedAt, lang) })}
                </Text>
              </Box>
            </Flex>
            {!s.current && (
              <Button
                size="sm"
                variant={viewed === s.year ? "solid" : "outline"}
                colorPalette="brand"
                onClick={async () => {
                  await switchTo(s.year);
                  router.push("/ranking");
                }}
              >
                <Eye size={15} aria-hidden />
                {tx("Open {year}", { year: s.year })}
              </Button>
            )}
          </Flex>
        ))}
      </Stack>

      {current && (
        <Box>
          <Button colorPalette="brand" onClick={() => setStarting(true)} disabled={lookingBack}>
            <CalendarPlus size={16} aria-hidden />
            {tx("Start a new year")}
          </Button>
          {lookingBack && (
            <Text mt="2" fontSize="xs" color="fg.muted">
              {tx("Go back to {year} first.", { year: current.year })}
            </Text>
          )}
        </Box>
      )}
      {starting && current && <StartYearDialog current={current} onClose={() => setStarting(false)} />}
    </Stack>
  );
}

function StartYearDialog({ current, onClose }: { current: Season; onClose: () => void }) {
  const [year, setYear] = useState(String(current.year + 1));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [start, { loading }] = useMutation(START_SEASON);
  const client = useApolloClient();
  const { tx, apiError } = useI18n();
  const next = Number(year);
  const valid = /^\d{4}$/.test(year) && next > current.year;

  async function confirm() {
    setError(null);
    try {
      await start({ variables: { input: { year: next, name: name.trim() || null } } });
      setViewedSeason(null);
      await client.resetStore().catch(() => undefined);
      toaster.create({ type: "success", title: tx("{year} has started", { year: next }) });
      onClose();
    } catch (err) {
      setError(apiError(readApiError(err)).message);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(e) => !e.open && onClose()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title color="brand.900">{tx("Start a new year")}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <ErrorAlert message={error} />
                <Stack gap="1.5" fontSize="sm" color="fg.muted">
                  <Text>{tx("{year} is closed and kept as it is: its participants, sheets and ranking stay readable, with the rules it was judged by.", { year: current.year })}</Text>
                  <Text>{tx("The new year starts with no participants, no envelopes, nobody on stage and the results not published.")}</Text>
                  <Text>{tx("The team, the pass mark, the terms and the registration link stay the same.")}</Text>
                </Stack>
                <FormField label={tx("Year")} error={year && !valid ? tx("A year after {year}", { year: current.year }) : undefined}>
                  <Input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </FormField>
                <FormField label={tx("Name (optional)")} required={false}>
                  <Input value={name} maxLength={80} placeholder={tx("Competition {year}", { year: valid ? next : current.year + 1 })} onChange={(e) => setName(e.target.value)} />
                </FormField>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                {tx("Cancel")}
              </Button>
              <Button colorPalette="brand" onClick={confirm} loading={loading} disabled={!valid}>
                <CalendarPlus size={16} aria-hidden />
                {valid ? tx("Start {year}", { year: next }) : tx("Start a new year")}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
