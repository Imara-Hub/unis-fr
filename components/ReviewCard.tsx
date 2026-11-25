"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Button, Card, Field, Flex, Heading, Stack, Text, Textarea } from "@chakra-ui/react";
import { useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ReviewBadge } from "@/components/StatusBadge";
import { toaster } from "@/components/Toaster";
import { formatDateTime } from "@/lib/dates";
import { readApiError } from "@/lib/errors";
import { APPROVE_PARTICIPANT, REJECT_PARTICIPANT, type ParticipantDetail } from "@/lib/graphql/participants";
import { REGISTRATION_TERMS } from "@/lib/graphql/registration";
import { useI18n } from "@/lib/i18n";

// The admin's decision on a registration: approve it, or reject it with a reason.
// On the participant page and under the printable registration form.
export function ReviewCard({ participant: p }: { participant: ParticipantDetail }) {
  const terms = useQuery(REGISTRATION_TERMS);
  const [approve, approving] = useMutation(APPROVE_PARTICIPANT);
  const [reject, rejecting] = useMutation(REJECT_PARTICIPANT);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | undefined>();
  const { tx } = useI18n();

  const current = terms.data?.registrationTerms;
  // Marked or scored: in the competition, so rejecting is no longer possible. (Being on stage or
  // having drawn locks it too; the server says so with REVIEW_LOCKED.)
  const locked = p.sheetsSubmitted > 0 || p.status !== "PENDING";

  async function onApprove() {
    setError(null);
    try {
      await approve({ variables: { id: p.id } });
      toaster.create({ type: "success", title: tx("Registration approved"), description: p.fullName });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  async function onReject() {
    setError(null);
    setReasonError(undefined);
    if (reason.trim().length < 3) {
      setReasonError(tx("Say why, so you can tell the person (at least 3 characters)"));
      return;
    }
    try {
      await reject({ variables: { id: p.id, reason: reason.trim() } });
      toaster.create({ type: "success", title: tx("Registration rejected"), description: p.fullName });
      setRejectOpen(false);
      setReason("");
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setReasonError(apiError.fields.reason);
    }
  }

  const termsLine =
    p.termsVersion === null
      ? tx("Registered before terms were asked.")
      : tx("Accepted the terms (version {n}) on {date}.", { n: p.termsVersion, date: formatDateTime(p.termsAcceptedAt ?? p.registeredAt) }) +
        (current && current.version !== p.termsVersion ? ` ${tx("The current terms are version {n}.", { n: current.version })}` : "");
  const waiting = p.review === "PENDING_REVIEW";

  return (
    <Card.Root borderColor={waiting ? "orange.300" : undefined} borderWidth={waiting ? "2px" : "1px"}>
      <Card.Body gap="4">
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Heading size="md">{tx("Review")}</Heading>
          <ReviewBadge review={p.review} />
        </Flex>

        <Stack gap="1" fontSize="sm">
          {waiting && (
            <Text>{tx("Check the details, the photo and the ID document against the terms, then decide.")}</Text>
          )}
          <Text color="fg.muted">{termsLine}</Text>
          {p.reviewedAt && !waiting && (
            <Text color="fg.muted">
              {p.reviewedBy
                ? tx(p.review === "APPROVED" ? "Approved by {name} on {date}." : "Rejected by {name} on {date}.", {
                    name: p.reviewedBy.name,
                    date: formatDateTime(p.reviewedAt),
                  })
                : tx(p.review === "APPROVED" ? "Approved on {date}." : "Rejected on {date}.", { date: formatDateTime(p.reviewedAt) })}
            </Text>
          )}
          {p.review === "REJECTED" && p.rejectionReason && (
            <Text>
              <Text as="span" fontWeight="semibold">
                {tx("Reason:")}
              </Text>{" "}
              {p.rejectionReason}
            </Text>
          )}
        </Stack>

        {current && (
          <Stack as="details" gap="2" fontSize="sm">
            <Text as="summary" cursor="pointer" color="brand.600" fontWeight="semibold">
              {tx("Read the terms and conditions")}
            </Text>
            <Text whiteSpace="pre-wrap" color="fg.muted" maxH="60" overflowY="auto" p="3" bg="bg.subtle" rounded="md">
              {current.text}
            </Text>
          </Stack>
        )}

        <ErrorAlert message={error} />

        {rejectOpen ? (
          <Stack gap="3">
            <Field.Root invalid={Boolean(reasonError)}>
              <Field.Label>{tx("Why is this registration rejected?")}</Field.Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tx("e.g. Older than 29 according to the ID document")}
                maxLength={500}
                rows={3}
                autoFocus
              />
              <Field.HelperText>{tx("Once you publish the decisions, anyone who searches this name on the public check page reads this reason: write it for the person.")}</Field.HelperText>
              <Field.ErrorText>{reasonError}</Field.ErrorText>
            </Field.Root>
            <Text fontSize="xs" color="fg.muted">
              {tx("This person stays registered and cannot register again. If the name or date of birth is wrong, delete the registration instead, so they can register again.")}
            </Text>
            <Flex gap="2" wrap="wrap">
              <Button colorPalette="red" onClick={onReject} loading={rejecting.loading}>
                {tx("Reject registration")}
              </Button>
              <Button variant="ghost" onClick={() => setRejectOpen(false)}>
                {tx("Cancel")}
              </Button>
            </Flex>
          </Stack>
        ) : (
          <Flex gap="2" wrap="wrap" align="center">
            {p.review !== "APPROVED" && (
              <Button colorPalette="green" onClick={onApprove} loading={approving.loading}>
                {p.review === "REJECTED" ? tx("Approve instead") : tx("Approve")}
              </Button>
            )}
            {p.review !== "REJECTED" && !locked && (
              <Button variant="outline" colorPalette="red" onClick={() => setRejectOpen(true)}>
                {tx("Reject")}
              </Button>
            )}
            {p.review === "APPROVED" && locked && (
              <Text fontSize="sm" color="fg.muted">
                {tx("Already in the competition: it can no longer be rejected.")}
              </Text>
            )}
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
}
