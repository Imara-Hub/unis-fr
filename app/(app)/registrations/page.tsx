"use client";

import { useQuery } from "@apollo/client/react";
import { Box, Button, Card, Flex, Input, InputGroup, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Search } from "lucide-react";
import NextLink from "next/link";
import { useMemo, useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { Delayed } from "@/components/Delayed";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PageHeader } from "@/components/PageHeader";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { ReviewBadge } from "@/components/StatusBadge";
import { ageOf, formatDateTime } from "@/lib/dates";
import { readApiError } from "@/lib/errors";
import { PARTICIPANT_COUNTS, PARTICIPANTS, type ParticipantRow, type ReviewStatus } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";
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
  const list = useQuery(PARTICIPANTS, { variables: { review } });
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
        (digits.length >= 3 && p.phone.includes(digits)),
    );
    // The queue in arrival order (first come, first reviewed); the decided lists newest first.
    return review === "PENDING_REVIEW"
      ? [...all].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
      : [...all].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }, [loaded, searchText, review]);

  return (
    <>
      <PageHeader
        title={tx("Registrations")}
        description={tx("Check each registration against the terms and conditions, then approve or reject it. Only approved people appear for the judges and staff and can be called on stage.")}
      />

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
              placeholder={tx("Search name, phone, halaqa, commune")}
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
          {formatPhone(p.phone)} · {tx("registered {date}", { date: formatDateTime(p.registeredAt) })}
        </Text>
      </Stack>
      <Button asChild size="sm" colorPalette="brand" variant={p.review === "PENDING_REVIEW" ? "solid" : "outline"}>
        <NextLink href={`/participants/${p.id}`}>{p.review === "PENDING_REVIEW" ? tx("Review") : tx("Open")}</NextLink>
      </Button>
    </Flex>
  );
}
