"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, Flex, Input, InputGroup, Skeleton, Stack, Text } from "@chakra-ui/react";
import { FileText, ListChecks, Search } from "lucide-react";
import NextLink from "next/link";
import { useMemo, useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { PublishReviews } from "@/components/PublishReviews";
import { Delayed } from "@/components/Delayed";
import { ErrorAlert } from "@/components/ErrorAlert";
import { NumberTag } from "@/components/NumberTag";
import { PageHeader } from "@/components/PageHeader";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { ReviewBadge } from "@/components/StatusBadge";
import { ageOf, formatDateTime } from "@/lib/dates";
import { readApiError } from "@/lib/errors";
import { PARTICIPANT_COUNTS, PARTICIPANTS, type ParticipantRow, type ReviewStatus } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { formatPhone, reachPhone } from "@/lib/phone";
import { useRegistrar } from "@/components/Registrar";
import { useI18n } from "@/lib/i18n";

const TABS: { review: ReviewStatus; label: AppKey; count: "awaitingReview" | "rejected" | "total"; dot: string }[] = [
  { review: "PENDING_REVIEW", label: "Awaiting review", count: "awaitingReview", dot: "#DD6B20" },
  { review: "REJECTED", label: "Rejected", count: "rejected", dot: "#C53030" },
  { review: "APPROVED", label: "Approved", count: "total", dot: "#2F855A" },
];

export default function RegistrationsPage() {
  return (
    <AdminOnly>
      <Registrations />
    </AdminOnly>
  );
}

// The admin's review queue: everyone who registered through the link, until approved or rejected.
function Registrations() {
  const [review, setReview] = useState<ReviewStatus>("PENDING_REVIEW");
  const [searchText, setSearchText] = useState("");
  const counts = useQuery(PARTICIPANT_COUNTS);
  // The same variable shape as the other pages, so one cache entry per view is shared.
  const list = useQuery(PARTICIPANTS, { variables: { status: null, search: null, review } });
  const { tx } = useI18n();

  const loaded = list.data?.participants ?? list.previousData?.participants;
  const c = counts.data?.participantCounts;

  const shown = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const all = (loaded ?? []).filter(
      (p) =>
        !q ||
        p.fullName.toLowerCase().includes(q) ||
        p.institution.toLowerCase().includes(q) ||
        p.commune.toLowerCase().includes(q) ||
        // Everyone a parent or a markaz registered: by its name or phone.
        Boolean(p.contact?.name.toLowerCase().includes(q)) ||
        Boolean(p.contact?.institutionName?.toLowerCase().includes(q)) ||
        (digits.length >= 3 && [p.phone, p.contact?.phone].some((phone) => phone?.includes(digits))),
    );
    // The queue in arrival order (first come, first reviewed); the decided lists newest first.
    return review === "PENDING_REVIEW"
      ? [...all].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
      : [...all].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }, [loaded, searchText, review]);
  // The oldest waiting registration: where "Review one by one" starts.
  const firstWaiting = review === "PENDING_REVIEW" && !searchText.trim() ? (shown[0]?.id ?? null) : null;

  return (
    <>
      <PageHeader
        title={tx("Registrations")}
        description={tx("Check each registration against the terms and conditions, then approve or reject it. Only approved people appear for the judges and staff and can be called on stage.")}
      />

      <PublishReviews />

      {/* The quickest way through the queue: each form in turn, oldest first, the next opens after a decision. */}
      {firstWaiting && (
        <Flex
          mb="4"
          p={{ base: "4", md: "5" }}
          gap="4"
          align={{ base: "stretch", sm: "center" }}
          direction={{ base: "column", sm: "row" }}
          rounded="xl"
          bg="orange.50"
          borderWidth="1px"
          borderColor="orange.200"
        >
          <Box flex="1">
            <Text fontWeight="semibold" color="brand.900">
              {(c?.awaitingReview ?? shown.length) === 1
                ? tx("1 registration is waiting for review")
                : tx("{n} registrations are waiting for review", { n: c?.awaitingReview ?? shown.length })}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {tx("Read each form and approve or reject it: the next one opens by itself.")}
            </Text>
          </Box>
          <Button asChild colorPalette="brand" size="lg" flexShrink={0}>
            <NextLink href={`/forms/${firstWaiting}?review=1`}>
              <ListChecks size={18} aria-hidden />
              {tx("Review one by one")}
            </NextLink>
          </Button>
        </Flex>
      )}

      <Card.Root overflow="hidden">
        <Flex gap="1" overflowX="auto" role="tablist" aria-label={tx("Review status")} px={{ base: "2", md: "4" }} borderBottomWidth="1px">
          {TABS.map((t) => {
            const active = review === t.review;
            return (
              <Flex
                as="button"
                key={t.review}
                role="tab"
                aria-selected={active}
                onClick={() => setReview(t.review)}
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
                  {c ? (c[t.count] ?? 0) : "·"}
                </Text>
              </Flex>
            );
          })}
        </Flex>

        <Box px={{ base: "3", md: "4" }} py="3" bg="bg.subtle" borderBottomWidth="1px">
          <InputGroup startElement={<Search size={16} />}>
            <Input
              size="sm"
              bg="white"
              placeholder={tx("Search name, phone, halaqa, commune, who registered")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </InputGroup>
        </Box>

        <ErrorAlert message={list.error ? readApiError(list.error).message : null} />

        {!loaded ? (
          // Same height as the placeholders, which only show if the list is slow to come.
          <Stack p="4" gap="3" minH="248px">
            <Delayed>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} h="16" rounded="md" />
              ))}
            </Delayed>
          </Stack>
        ) : shown.length === 0 ? (
          <Text p="8" textAlign="center" color="fg.muted">
            {searchText
              ? tx("Nobody matches this search.")
              : review === "PENDING_REVIEW"
                ? tx("No registration is waiting for review. New ones appear here by themselves.")
                : review === "REJECTED"
                  ? tx("No registration was rejected.")
                  : tx("No registration was approved yet.")}
          </Text>
        ) : (
          <Stack gap="0" key={review} animation="fade-in 0.3s ease-out" _motionReduce={{ animation: "none" }}>
            {shown.map((p) => (
              <RegistrationRow key={p.id} participant={p} />
            ))}
          </Stack>
        )}
      </Card.Root>
    </>
  );
}

function RegistrationRow({ participant: p }: { participant: ParticipantRow }) {
  const { tx } = useI18n();
  const registrar = useRegistrar().who(p);
  return (
    <Flex
      gap="3"
      align="center"
      px={{ base: "3", md: "4" }}
      py="3"
      borderBottomWidth="1px"
      _last={{ borderBottomWidth: "0" }}
      wrap={{ base: "wrap", sm: "nowrap" }}
    >
      <ParticipantPhoto path={p.photoUrl} size="thumb" />
      <Stack gap="0.5" flex="1" minW="0">
        <Flex gap="2" align="center" wrap="wrap">
          <NumberTag number={p.number} />
          <Text fontWeight="semibold" color="brand.900" truncate>
            {p.fullName}
          </Text>
          <ReviewBadge review={p.review} />
        </Flex>
        <Text fontSize="sm" color="fg.muted" truncate>
          {tx("{n} years", { n: ageOf(p.dateOfBirth) })} · {p.gender === "MALE" ? tx("Boy") : tx("Girl")} · {p.institution} ·{" "}
          {p.commune}, {p.province}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {formatPhone(reachPhone(p))} · {tx("registered {date}", { date: formatDateTime(p.registeredAt) })}
        </Text>
        {registrar && (
          <Text fontSize="xs" color="brand.700" truncate>
            {tx("Registered by {who}", { who: registrar })}
          </Text>
        )}
      </Stack>
      <Flex gap="2" flexShrink={0}>
        {/* The registration as the paper form: to read it as on paper, print it or save it as PDF. */}
        <Button asChild size="sm" variant="outline" colorPalette="brand">
          <NextLink href={p.review === "PENDING_REVIEW" ? `/forms/${p.id}?review=1` : `/forms/${p.id}`}>
            <FileText size={15} aria-hidden />
            {tx("Form")}
          </NextLink>
        </Button>
        <Button asChild size="sm" colorPalette="brand" variant={p.review === "PENDING_REVIEW" ? "solid" : "outline"}>
          <NextLink href={`/participants/${p.id}`}>{p.review === "PENDING_REVIEW" ? tx("Review") : tx("Open")}</NextLink>
        </Button>
      </Flex>
    </Flex>
  );
}
