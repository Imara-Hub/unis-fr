"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, DataList, Flex, Heading, Image, Link, SimpleGrid, Stack, Table, Text } from "@chakra-ui/react";
import { FileText, Printer, RotateCcw, TriangleAlert } from "lucide-react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { toaster } from "@/components/Toaster";
import { NumberTag } from "@/components/NumberTag";
import { ReviewCard } from "@/components/ReviewCard";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { FinalScoreCard } from "@/components/FinalScoreCard";
import { ReviewBadge, StatusBadge } from "@/components/StatusBadge";
import { authedUrl } from "@/lib/api";
import { ageOf, formatDateTime, formatDay } from "@/lib/dates";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { PARTICIPANT_SHEETS, REOPEN_SHEET, type JudgeSheet, type Round } from "@/lib/graphql/judging";
import {
  DELETE_PARTICIPANT,
  PARTICIPANT,
  SCORE_HISTORY,
  type ParticipantDetail,
} from "@/lib/graphql/participants";
import { formatPhone } from "@/lib/phone";
import { useRegistrar } from "@/components/Registrar";
import { useI18n } from "@/lib/i18n";
import { questionLabel } from "@/lib/quran/label";
import { MARK_TYPES } from "@/lib/marks";
import { MarkName } from "@/components/MarkName";

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
  // A failed reload keeps the page (and anything being typed in it); see the alert below.
  if (error && !data) return <ErrorAlert message={readApiError(error).message} />;
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
      <ErrorAlert message={error ? readApiError(error).message : null} />
      <Card.Root>
        <Card.Body>
          <Flex gap="6" direction={{ base: "column", sm: "row" }}>
            <ParticipantPhoto path={participant.photoUrl} size="large" />
            <Stack gap="4" flex="1" minW="0">
              <Flex gap="3" align="center" wrap="wrap">
                <NumberTag number={participant.number} size="md" />
                <Heading size="xl">{participant.fullName}</Heading>
                {competing ? (
                  <StatusBadge status={participant.status} finalist={participant.finalist} size="md" />
                ) : (
                  <ReviewBadge review={participant.review} size="md" />
                )}
              </Flex>
              <Details participant={participant} isAdmin={role === "ADMIN"} />
              <Flex gap="2" wrap="wrap">
                {role === "ADMIN" && (
                  <Button asChild size="sm" variant="outline" colorPalette="brand">
                    <NextLink href={`/forms/${participant.id}`}>
                      <FileText size={15} aria-hidden />
                      {tx("Registration form (print / PDF)")}
                    </NextLink>
                  </Button>
                )}
                {competing && (
                  <Button asChild size="sm" variant="outline" colorPalette="brand">
                    <NextLink href={`/print/sheets/${participant.id}`}>
                      <Printer size={15} aria-hidden />
                      {role === "JUDGE" ? tx("My sheet (print / PDF)") : tx("Judges’ sheets (print / PDF)")}
                    </NextLink>
                  </Button>
                )}
              </Flex>
            </Stack>
          </Flex>
        </Card.Body>
      </Card.Root>

      {role === "ADMIN" && <ReviewCard participant={participant} />}

      {participant.idDocumentUrl && <IdDocumentCard path={participant.idDocumentUrl} />}

      {competing && <ScoreCards participant={participant} settings={data.settings} isJudge={role === "JUDGE"} isAdmin={role === "ADMIN"} />}
      {role === "ADMIN" && <DeleteCard participant={participant} />}
    </Stack>
  );
}

// Only for approved participants: the competition part (final score, sheets, history).
function ScoreCards({
  participant,
  settings,
  isJudge,
  isAdmin,
}: {
  participant: ParticipantDetail;
  settings: { judgeCount: number; maxScore: number; passMark: number };
  isJudge: boolean;
  isAdmin: boolean;
}) {
  return (
    <>
      <FinalScoreCard
        score={participant.score}
        sheetsSubmitted={participant.sheetsSubmitted}
        judgeCount={settings.judgeCount}
        maxScore={settings.maxScore}
        passMark={settings.passMark}
      />

      <SheetsCard participantId={participant.id} isJudge={isJudge} isAdmin={isAdmin} round="TASFIA" />
      {participant.inFinal && <SheetsCard participantId={participant.id} isJudge={isJudge} isAdmin={isAdmin} round="FINAL" />}
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
          <Link href={authedUrl(path)} target="_blank" rel="noopener" fontSize="sm" colorPalette="brand">
            {tx("Open full size")}
          </Link>
        </Flex>
        <Image
          // A lighter copy to read on screen; "Open full size" above gives the original.
          src={authedUrl(path, 800)}
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

// Phones and who to call are for the admin only (the API sends them to nobody else).
function Details({ participant: p, isAdmin }: { participant: ParticipantDetail; isAdmin: boolean }) {
  const { tx } = useI18n();
  const registrar = useRegistrar();
  const who = registrar.who(p);
  const items: [string, string][] = [
    ...(isAdmin ? [[tx("Phone"), formatPhone(p.phone)] as [string, string]] : []),
    [tx("Registered by"), who ?? registrar.kind(p.registeredBy)],
    ...(p.contact ? [[tx("Their phone"), formatPhone(p.contact.phone)] as [string, string]] : []),
    [tx("Date of birth"), `${formatDay(p.dateOfBirth)} (${tx("{n} years", { n: ageOf(p.dateOfBirth) })})`],
    [tx("Gender"), p.gender === "MALE" ? tx("Male") : tx("Female")],
    [tx("Province"), p.province],
    [tx("Commune"), p.commune],
    [tx("Halaqa"), p.institution],
    ...(p.institutionLocation ? [[tx("Location"), p.institutionLocation] as [string, string]] : []),
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
// One card per round: the tasfia's, and the final's for a finalist.
function SheetsCard({ participantId, isJudge, isAdmin, round }: { participantId: string; isJudge: boolean; isAdmin: boolean; round: Round }) {
  const { data, error } = useQuery(PARTICIPANT_SHEETS, { variables: { id: participantId, round } });
  const p = data?.participant;
  const { tx } = useI18n();

  return (
    <Card.Root>
      <Card.Body gap="4">
        <Flex align="center" gap="2" wrap="wrap">
          <Heading size="md">{isJudge ? tx("My sheet") : tx("Judges’ sheets")}</Heading>
          <Badge variant="outline" colorPalette={round === "FINAL" ? "orange" : "teal"}>
            {round === "FINAL" ? tx("Final") : tx("Tasfia")}
          </Badge>
        </Flex>
        <ErrorAlert message={error ? readApiError(error).message : null} />
        {!p ? (
          !error && <Text color="fg.muted">{tx("Loading…")}</Text>
        ) : !p.envelope ? (
          <Text color="fg.muted">{tx("Has not drawn an envelope yet.")}</Text>
        ) : (
          <>
            <Text fontSize="sm" color="fg.muted">
              {tx("Envelope {n}", { n: p.envelope.number })}: {p.envelope.questions.map((q, i) => `${i + 1}. ${questionLabel(q)}`).join(" · ")}
            </Text>
            {p.sheets.length === 0 ? (
              <Text color="fg.muted">{tx("No judge has started a sheet yet.")}</Text>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
                {p.sheets.map((s) => (
                  <SheetSummary key={s.id} sheet={s} canReopen={isAdmin} />
                ))}
              </SimpleGrid>
            )}
          </>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function SheetSummary({ sheet: s, canReopen }: { sheet: JudgeSheet; canReopen: boolean }) {
  const { tx } = useI18n();
  const client = useApolloClient();
  const [reopen, { loading: reopening }] = useMutation(REOPEN_SHEET);
  const differs = s.differs ?? [];
  const differsAt = (q: number, kind: string) => differs.some((d) => d.question === q + 1 && d.mark === kind);

  // The admin sends the sheet back to its judge (e.g. they miscounted and the others are refused).
  async function onReopen() {
    const name = s.judge?.name ?? tx("Removed judge");
    if (!(await confirmDialog({ message: tx("Send the sheet of {name} back to correct? Their total leaves the score until they submit again.", { name }) }))) return;
    try {
      await reopen({ variables: { id: s.id } });
      await client.refetchQueries({ include: "active" });
      toaster.create({ type: "success", title: tx("Sent back to {name}", { name }) });
    } catch (err) {
      toaster.create({ type: "error", title: readApiError(err).message });
    }
  }

  return (
    <Stack gap="2" p="4" rounded="xl" borderWidth={differs.length > 0 ? "2px" : "1px"} borderColor={differs.length > 0 ? "red.400" : undefined} bg={s.submitted ? "white" : "bg.subtle"}>
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
      {differs.length > 0 && (
        <Flex align="center" gap="2" fontSize="sm" color="red.700" fontWeight="medium">
          <TriangleAlert size={16} aria-hidden style={{ flexShrink: 0 }} />
          {tx("Differs from the other judges")}
        </Flex>
      )}
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>{tx("Question")}</Table.ColumnHeader>
            {MARK_TYPES.map((t) => (
              <Table.ColumnHeader key={t.kind} textAlign="center" color={`${t.palette}.700`}>
                <MarkName mark={t} />
              </Table.ColumnHeader>
            ))}
            <Table.ColumnHeader textAlign="end">{tx("Points")}</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {s.questions.map((q, i) => (
            <Table.Row key={i}>
              <Table.Cell>{i + 1}</Table.Cell>
              {MARK_TYPES.map((t) => (
                <Table.Cell
                  key={t.kind}
                  textAlign="center"
                  fontVariantNumeric="tabular-nums"
                  color={differsAt(i, t.kind) ? "red.700" : q[t.kind] ? `${t.palette}.700` : "fg.subtle"}
                  bg={differsAt(i, t.kind) ? "red.100" : undefined}
                  fontWeight={differsAt(i, t.kind) ? "bold" : undefined}
                  title={differsAt(i, t.kind) ? tx("Differs from the other judges") : undefined}
                >
                  {q[t.kind] ?? 0}
                </Table.Cell>
              ))}
              <Table.Cell textAlign="end" color={q.deleted ? "red.600" : undefined} fontWeight="semibold">
                {q.deleted ? tx("Deleted") : q.score}
              </Table.Cell>
            </Table.Row>
          ))}
          <Table.Row>
            <Table.Cell colSpan={MARK_TYPES.length + 1}>Sauti</Table.Cell>
            <Table.Cell textAlign="end" fontWeight="semibold">
              {s.sauti ?? "—"}
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
      {canReopen && s.submitted && (
        <Button size="sm" variant="outline" colorPalette={differs.length > 0 ? "red" : "gray"} alignSelf="flex-start" loading={reopening} onClick={() => void onReopen()}>
          <RotateCcw size={14} aria-hidden />
          {tx("Send back to correct")}
        </Button>
      )}
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
            {tx("Every submitted sheet, with the judge’s total.")}
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
                        {h.oldScore === null
                          ? tx("Submitted {n}", { n: h.newScore ?? "—" })
                          : h.newScore === null
                            ? tx("Sent back to correct ({n})", { n: h.oldScore })
                            : `${h.oldScore} → ${h.newScore}`}
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
function DeleteCard({ participant }: { participant: ParticipantDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [remove, { loading }] = useMutation(DELETE_PARTICIPANT);
  const { tx } = useI18n();

  async function onDelete() {
    const ok = await confirmDialog({
      destructive: true,
      confirmLabel: tx("Delete"),
      message: tx("Delete the registration of {name}? The photo, judges’ sheets and history are deleted too. They can then register again.", {
        name: participant.fullName,
      }),
    });
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
