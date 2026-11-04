"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Badge, Button, Card, DataList, Field, Flex, Heading, Image, Link, SimpleGrid, Stack, Table, Text, Textarea } from "@chakra-ui/react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { ScoreScale } from "@/components/ScoreScale";
import { ReviewBadge, StatusBadge } from "@/components/StatusBadge";
import { apiUrl } from "@/lib/api";
import { ageOf, formatDateTime, formatDay } from "@/lib/dates";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { PARTICIPANT_SHEETS, type JudgeSheet } from "@/lib/graphql/judging";
import { REGISTRATION_TERMS } from "@/lib/graphql/registration";
import {
  APPROVE_PARTICIPANT,
  DELETE_PARTICIPANT,
  PARTICIPANT,
  REJECT_PARTICIPANT,
  SCORE_HISTORY,
  type ParticipantDetail,
} from "@/lib/graphql/participants";
import { formatPhone } from "@/lib/phone";
import { useI18n } from "@/lib/i18n";

export default function ParticipantPage() {
  return (
    <Suspense>
      <Participant />
    </Suspense>
  );
}

function Participant() {
  const { id } = useParams<{ id: string }>();
  const me = useQuery(ME);
  const { data, loading, error } = useQuery(PARTICIPANT, { variables: { id } });
  const { tx } = useI18n();

  const role = me.data?.me?.role;
  const participant = data?.participant;
  // Not approved yet (or rejected): only the admin gets here, from the review queue.
  const competing = participant?.review === "APPROVED";

  const back = (
    <Link asChild color="fg.muted" fontSize="sm" mb="4">
      {participant && !competing ? (
        <NextLink href="/registrations">← {tx("All registrations")}</NextLink>
      ) : (
        <NextLink href="/participants">← {tx("All participants")}</NextLink>
      )}
    </Link>
  );

  if (loading && !data) return <Text color="fg.muted">{tx("Loading…")}</Text>;
  if (error) return <ErrorAlert message={readApiError(error).message} />;
  if (!participant || !data) {
    return (
      <Stack align="flex-start">
        {back}
        <Text>{tx("This participant does not exist (anymore).")}</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="6">
      {back}
      <Card.Root>
        <Card.Body>
          <Flex gap="6" direction={{ base: "column", sm: "row" }}>
            <ParticipantPhoto path={participant.photoUrl} size="large" />
            <Stack gap="4" flex="1" minW="0">
              <Flex gap="3" align="center" wrap="wrap">
                <Heading size="xl">{participant.fullName}</Heading>
                {competing ? (
                  <StatusBadge status={participant.status} size="md" />
                ) : (
                  <ReviewBadge review={participant.review} size="md" />
                )}
              </Flex>
              <Details participant={participant} />
            </Stack>
          </Flex>
        </Card.Body>
      </Card.Root>

      {role === "ADMIN" && <ReviewCard participant={participant} />}

      {participant.idDocumentUrl && <IdDocumentCard path={participant.idDocumentUrl} />}

      {competing && <ScoreCards participant={participant} settings={data.settings} isJudge={role === "JUDGE"} />}
      {role === "ADMIN" && <DeleteCard participant={participant} />}
    </Stack>
  );
}

// Only for approved participants: the competition part (final score, sheets, history).
function ScoreCards({
  participant,
  settings,
  isJudge,
}: {
  participant: ParticipantDetail;
  settings: { judgeCount: number; maxScore: number; passMark: number };
  isJudge: boolean;
}) {
  const { tx } = useI18n();
  return (
    <>
      <Card.Root>
        <Card.Body gap="4">
          <Flex justify="space-between" align="baseline" gap="3" wrap="wrap">
            <Stack gap="0">
              <Heading size="md">{tx("Final score")}</Heading>
              <Text fontSize="sm" color="fg.muted">
                {tx("Average of the {total} judges · {n} of {total} submitted", {
                  total: settings.judgeCount,
                  n: participant.sheetsSubmitted,
                })}
              </Text>
            </Stack>
            <Text fontFamily="display" fontSize="3xl" lineHeight="1" color="brand.900">
              {participant.score ?? "—"}
              <Text as="span" fontFamily="body" fontSize="md" color="fg.muted">
                {" "}
                / {settings.maxScore}
              </Text>
            </Text>
          </Flex>
          <ScoreScale score={participant.score} passMark={settings.passMark} maxScore={settings.maxScore} />
        </Card.Body>
      </Card.Root>

      <SheetsCard participantId={participant.id} isJudge={isJudge} />
      <History participantId={participant.id} />
    </>
  );
}

// The ID card or passport photo sent at registration. Opens full size in a new tab to read it.
function IdDocumentCard({ path }: { path: string }) {
  const { tx } = useI18n();
  return (
    <Card.Root>
      <Card.Body gap="4">
        <Flex justify="space-between" align="baseline" gap="3" wrap="wrap">
          <Heading size="md">{tx("ID document")}</Heading>
          <Link href={apiUrl(path)} target="_blank" rel="noopener" fontSize="sm" colorPalette="brand">
            {tx("Open full size")}
          </Link>
        </Flex>
        <Image
          src={apiUrl(path)}
          alt={tx("ID card or passport")}
          maxW="md"
          w="full"
          rounded="md"
          borderWidth="1px"
          bg="bg.muted"
          loading="lazy"
        />
      </Card.Body>
    </Card.Root>
  );
}

function Details({ participant: p }: { participant: ParticipantDetail }) {
  const { tx } = useI18n();
  const items: [string, string][] = [
    [tx("Phone"), formatPhone(p.phone)],
    [tx("Date of birth"), `${formatDay(p.dateOfBirth)} (${tx("{n} years", { n: ageOf(p.dateOfBirth) })})`],
    [tx("Gender"), p.gender === "MALE" ? tx("Male") : tx("Female")],
    [tx("Province"), p.province],
    [tx("Commune"), p.commune],
    [tx("Halaqa"), p.institution],
    // Only people registered before the guardian was dropped from the form have one.
    ...(p.guardianName ? [[tx("Guardian"), p.guardianName] as [string, string]] : []),
    ...(p.guardianPhone ? [[tx("Guardian’s phone"), formatPhone(p.guardianPhone)] as [string, string]] : []),
    [tx("Registered"), formatDateTime(p.registeredAt)],
  ];
  return (
    <DataList.Root orientation="horizontal" size="sm">
      {items.map(([label, value]) => (
        <DataList.Item key={label}>
          <DataList.ItemLabel minW="36">{label}</DataList.ItemLabel>
          <DataList.ItemValue>{value}</DataList.ItemValue>
        </DataList.Item>
      ))}
    </DataList.Root>
  );
}

// The envelope that was drawn and every judge's sheet (a judge only sees their own).
function SheetsCard({ participantId, isJudge }: { participantId: string; isJudge: boolean }) {
  const { data, error } = useQuery(PARTICIPANT_SHEETS, { variables: { id: participantId } });
  const p = data?.participant;
  const { tx } = useI18n();

  return (
    <Card.Root>
      <Card.Body gap="4">
        <Heading size="md">{isJudge ? tx("My sheet") : tx("Judges’ sheets")}</Heading>
        <ErrorAlert message={error ? readApiError(error).message : null} />
        {!p ? (
          !error && <Text color="fg.muted">{tx("Loading…")}</Text>
        ) : !p.envelope ? (
          <Text color="fg.muted">{tx("Has not drawn an envelope yet.")}</Text>
        ) : (
          <>
            <Text fontSize="sm" color="fg.muted">
              {tx("Envelope {n}", { n: p.envelope.number })}: {p.envelope.questions.map((q, i) => `${i + 1}. ${q}`).join(" · ")}
            </Text>
            {p.sheets.length === 0 ? (
              <Text color="fg.muted">{tx("No judge has started a sheet yet.")}</Text>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
                {p.sheets.map((s) => (
                  <SheetSummary key={s.id} sheet={s} />
                ))}
              </SimpleGrid>
            )}
          </>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function SheetSummary({ sheet: s }: { sheet: JudgeSheet }) {
  const { tx } = useI18n();
  return (
    <Stack gap="2" p="4" rounded="xl" borderWidth="1px" bg={s.submitted ? "white" : "bg.subtle"}>
      <Flex justify="space-between" align="center" gap="2">
        <Text fontWeight="semibold" color="brand.900" truncate>
          {s.judge?.name ?? tx("Removed judge")}
        </Text>
        {s.submitted ? (
          <Text fontWeight="bold" fontSize="lg" color="brand.900" fontVariantNumeric="tabular-nums">
            {s.total} <Text as="span" fontSize="sm" color="fg.muted" fontWeight="normal">/ 100</Text>
          </Text>
        ) : (
          <Badge colorPalette="gray">{tx("Still marking")}</Badge>
        )}
      </Flex>
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>{tx("Question")}</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="center">X</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="center">I</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="center">●</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">{tx("Points")}</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {s.questions.map((q, i) => (
            <Table.Row key={i}>
              <Table.Cell>{i + 1}</Table.Cell>
              <Table.Cell textAlign="center">{q.tajweed}</Table.Cell>
              <Table.Cell textAlign="center">{q.tanbih}</Table.Cell>
              <Table.Cell textAlign="center">{q.fath}</Table.Cell>
              <Table.Cell textAlign="end" color={q.deleted ? "red.600" : undefined} fontWeight="semibold">
                {q.deleted ? tx("Deleted") : q.score}
              </Table.Cell>
            </Table.Row>
          ))}
          <Table.Row>
            <Table.Cell colSpan={4}>Sauti</Table.Cell>
            <Table.Cell textAlign="end" fontWeight="semibold">
              {s.sauti ?? "—"}
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </Stack>
  );
}

function History({ participantId }: { participantId: string }) {
  const { data, error } = useQuery(SCORE_HISTORY, { variables: { participantId } });
  const history = data?.scoreHistory ?? [];
  const { tx } = useI18n();

  return (
    <Card.Root>
      <Card.Body>
        <Stack gap="3">
          <Heading size="md">{tx("History")}</Heading>
          <Text fontSize="sm" color="fg.muted" mt="-2">
            {tx("Every submitted sheet and every correction, with the judge’s total.")}
          </Text>
          <ErrorAlert message={error ? readApiError(error).message : null} />
          {history.length === 0 ? (
            <Text color="fg.muted">{tx("No sheet submitted yet.")}</Text>
          ) : (
            <Table.ScrollArea>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>{tx("When")}</Table.ColumnHeader>
                    <Table.ColumnHeader>{tx("Judge")}</Table.ColumnHeader>
                    <Table.ColumnHeader>{tx("Change")}</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {history.map((h) => (
                    <Table.Row key={h.id}>
                      <Table.Cell whiteSpace="nowrap">{formatDateTime(h.createdAt)}</Table.Cell>
                      <Table.Cell>{h.changedBy?.name ?? "—"}</Table.Cell>
                      <Table.Cell whiteSpace="nowrap">
                        {h.oldScore === null ? tx("Submitted {n}", { n: h.newScore ?? "—" }) : `${h.oldScore} → ${h.newScore}`}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Table.ScrollArea>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

// The admin's decision: check the details, photo and ID document against the terms, then
// approve (they compete) or reject with a reason. A rejected registration can still be approved.
function ReviewCard({ participant: p }: { participant: ParticipantDetail }) {
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
              <Field.ErrorText>{reasonError}</Field.ErrorText>
            </Field.Root>
            <Text fontSize="xs" color="fg.muted">
              {tx("The phone number stays taken. If someone registered with a number that is not theirs, delete the registration instead, so the real owner can register.")}
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

function DeleteCard({ participant }: { participant: ParticipantDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [remove, { loading }] = useMutation(DELETE_PARTICIPANT);
  const { tx } = useI18n();

  async function onDelete() {
    const ok = window.confirm(
      tx("Delete the registration of {name}? The photo, judges’ sheets and history are deleted too. Their phone number can then register again.", {
        name: participant.fullName,
      }),
    );
    if (!ok) return;
    try {
      await remove({ variables: { id: participant.id } });
      router.replace(participant.review === "APPROVED" ? "/participants" : "/registrations");
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Card.Root borderColor="red.muted">
      <Card.Body>
        <Stack gap="3" align="flex-start">
          <Heading size="sm">{tx("Wrong or duplicate registration?")}</Heading>
          <ErrorAlert message={error} />
          <Button size="sm" variant="outline" colorPalette="red" onClick={onDelete} loading={loading}>
            {tx("Delete registration")}
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
