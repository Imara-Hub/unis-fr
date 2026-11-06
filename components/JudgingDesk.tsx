"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, chakra, Circle, CloseButton, Dialog, Flex, Grid, Heading, Link, Portal, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { ArrowLeft, BookOpen, Cake, CircleCheck, GraduationCap, Mail, Lock, MapPin, Mic, MonitorSmartphone, Pencil, TriangleAlert, Undo2, User, UserRoundCheck } from "lucide-react";
import NextLink from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ageOf, NAVY_GRADIENT, ParticipantInfo, RulesCard } from "@/components/JudgingParts";
import { Octagram, StarLattice } from "@/components/brand/Octagram";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { readApiError } from "@/lib/errors";
import { EMPTY_MARKS, hasMarks, MARK_TYPES, marksOnly, type MarkKind, type MarkType } from "@/lib/marks";
import {
  CALL_PARTICIPANT,
  DRAW_ENVELOPE,
  ENVELOPE_SLOTS,
  ENVELOPES,
  JUDGING_PARTICIPANT,
  SAVE_SHEET,
  SCORING_RULES,
  STAGE,
  STAGE_QUEUE,
  questionScore,
  sheetTotal,
  type Marks,
  type QueueParticipant,
  type ScoringRules,
  type StageParticipant,
} from "@/lib/graphql/judging";
import { PARTICIPANT_COUNTS } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

// The judge's desk, the whole competition on one screen:
// 1. call the next participant, 2. hand them the tablet to pick an envelope, 3. listen and mark
// your own sheet, 4. call the next one. Every judge's screen follows the same stage live.
export function JudgingDesk() {
  const stage = useQuery(STAGE);
  const rules = useQuery(SCORING_RULES);
  const queue = useQuery(STAGE_QUEUE);
  const envelopes = useQuery(ENVELOPES);
  const counts = useQuery(PARTICIPANT_COUNTS);
  const [viewId, setViewId] = useState<string | null>(null); // a past participant, to see your sheet
  const [showRules, setShowRules] = useState(false);
  const { tx } = useI18n();

  const onStage = stage.data?.stage.participant ?? null;
  const judgeCount = counts.data?.settings.judgeCount ?? 4;
  const all = useMemo(() => [...(queue.data?.participants ?? [])].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt)), [queue.data]);
  const waiting = all.filter((p) => !p.envelope && p.id !== onStage?.id);
  const recited = all.filter((p) => p.envelope && p.id !== onStage?.id);
  const sealed = envelopes.data ? envelopes.data.envelopes.filter((e) => !e.used).length : undefined;

  const error = stage.error ?? rules.error ?? queue.error;
  if (error) return <ErrorAlert message={readApiError(error).message} />;
  if (!rules.data || !stage.data) return <Text color="fg.muted">{tx("Loading…")}</Text>;
  const r = rules.data.scoringRules;

  const correcting = viewId && viewId !== onStage?.id;

  return (
    <Stack gap={{ base: "5", md: "6" }}>
      {/* The header only between participants: once someone is on stage, the judge sees just them. */}
      {onStage && !correcting ? (
        <Flex justify="flex-end">
          <Button size="sm" variant="outline" colorPalette="brand" onClick={() => setShowRules((v) => !v)}>
            <BookOpen size={15} aria-hidden />
            {showRules ? tx("Hide the rules") : tx("Marking rules")}
          </Button>
        </Flex>
      ) : (
        <DeskHeader
          stats={[
            { label: tx("Waiting"), value: waiting.length },
            { label: tx("Recited"), value: recited.length },
            { label: tx("Envelopes left"), value: sealed ?? "…" },
          ]}
          showRules={showRules}
          onRules={() => setShowRules((v) => !v)}
        />
      )}
      {showRules && <RulesCard rules={r} />}

      {sealed === 0 && !onStage?.envelope && <NoEnvelopes />}

      {correcting ? (
        <PastSheet id={viewId} rules={r} onBack={() => setViewId(null)} />
      ) : !onStage ? (
        <CallNext waiting={waiting} loading={queue.loading && !queue.data} />
      ) : !onStage.envelope ? (
        <DrawCard participant={onStage} />
      ) : (
        <Card.Root overflow="clip">
          <ParticipantInfo
            compact
            participant={onStage}
            label={tx("Reciting now")}
            right={<PanelProgress submitted={onStage.sheetsSubmitted} judgeCount={judgeCount} />}
          />
          <Card.Body p={{ base: "4", md: "7" }} gap="6">
            <Sheet key={onStage.id} participant={onStage} rules={r} />
            <FinishBar participant={onStage} judgeCount={judgeCount} next={waiting[0] ?? null} />
          </Card.Body>
        </Card.Root>
      )}

      <Recited recited={recited} viewId={viewId} onOpen={setViewId} />
    </Stack>
  );
}

function DeskHeader({ stats, showRules, onRules }: { stats: { label: string; value: number | string }[]; showRules: boolean; onRules: () => void }) {
  const { tx } = useI18n();
  return (
    <Box rounded="2xl" bg={NAVY_GRADIENT} color="white" px={{ base: "5", md: "7" }} py={{ base: "5", md: "6" }}>
      <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
        <Box>
          <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.18em" textTransform="uppercase" color="gold.300">
            {tx("Judging desk")}
          </Text>
          <Heading fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }}>
            Musabaqa
          </Heading>
        </Box>
        <Button size="sm" variant="outline" color="white" borderColor="whiteAlpha.500" _hover={{ bg: "whiteAlpha.200" }} onClick={onRules}>
          <BookOpen size={15} aria-hidden />
          {showRules ? tx("Hide the rules") : tx("Marking rules")}
        </Button>
      </Flex>

      <Flex gap={{ base: "5", md: "8" }} mt="5" wrap="wrap">
        {stats.map((s) => (
          <Box key={s.label}>
            <Text fontSize="2xl" fontWeight="bold" lineHeight="1" fontVariantNumeric="tabular-nums">
              {s.value}
            </Text>
            <Text fontSize="xs" color="whiteAlpha.700" mt="1">
              {s.label}
            </Text>
          </Box>
        ))}
      </Flex>
    </Box>
  );
}

function NoEnvelopes() {
  const { tx } = useI18n();
  return (
    <Flex gap="3" align="center" p="4" rounded="xl" bg="orange.50" borderWidth="1px" borderColor="orange.200" wrap="wrap">
      <Box color="orange.600">
        <TriangleAlert size={20} aria-hidden />
      </Box>
      <Text flex="1" minW="48" color="orange.900" fontSize="sm">
        <b>{tx("No envelope is ready.")}</b> {tx("Ask the admin to prepare the envelopes (3 questions each) before calling a participant.")}
      </Text>
    </Flex>
  );
}

// Step 1: nobody on stage. The next in line is shown big; anyone in the list can be called.
function CallNext({ waiting, loading }: { waiting: QueueParticipant[]; loading: boolean }) {
  const [call, { loading: calling }] = useMutation(CALL_PARTICIPANT, {
    refetchQueries: [{ query: STAGE }],
  });
  const [callingId, setCallingId] = useState<string | null>(null); // only that button spins
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  // In registration order: the first one waiting is called next, automatically.
  const next = waiting[0];
  const after = waiting[1];

  async function onCall(id: string) {
    setError(null);
    setCallingId(id);
    try {
      await call({ variables: { participantId: id } });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(readApiError(err).message);
    } finally {
      setCallingId(null);
    }
  }

  if (loading) return <Text color="fg.muted">{tx("Loading…")}</Text>;

  if (!next) {
    return (
      <Card.Root>
        <Card.Body alignItems="center" textAlign="center" py="12" gap="2">
          <Circle size="14" bg="green.50" color="green.600">
            <CircleCheck size={26} aria-hidden />
          </Circle>
          <Heading size="md" color="brand.900">
            {tx("Nobody is waiting")}
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            {tx("Every registered participant has recited. Your sheets are below.")}
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  const facts = [
    { icon: Cake, text: tx("{n} years", { n: ageOf(next.dateOfBirth) }) },
    { icon: User, text: next.gender === "MALE" ? tx("Boy") : tx("Girl") },
    { icon: GraduationCap, text: next.institution },
    { icon: MapPin, text: `${next.commune}, ${next.province}` },
  ];

  return (
    <Stack gap="4">
      {/* The one to call now */}
      <Box position="relative" overflow="hidden" rounded="2xl" bg={NAVY_GRADIENT} color="white" boxShadow="0 18px 40px rgba(26,35,78,0.28)">
        <Box position="absolute" insetY="0" right="0" w={{ base: "full", md: "55%" }} aria-hidden>
          <StarLattice color="#C99A35" opacity={0.22} />
          <Box position="absolute" inset="0" bg="linear-gradient(to right, #1A234E 0%, rgba(26,35,78,0.55) 50%, rgba(26,35,78,0.1) 100%)" />
        </Box>
        <Box position="absolute" inset="2.5" rounded="xl" borderWidth="1px" borderColor="gold.400/40" pointerEvents="none" />

        <Flex
          position="relative"
          direction={{ base: "column", md: "row" }}
          align={{ base: "center", md: "center" }}
          gap={{ base: "5", md: "8" }}
          px={{ base: "5", md: "10" }}
          py={{ base: "7", md: "9" }}
          textAlign={{ base: "center", md: "left" }}
        >
          {/* Photo in a gold frame */}
          <Box p="1.5" rounded="xl" bg="linear-gradient(160deg, #F3DB98, #C99A35)" boxShadow="0 10px 24px rgba(0,0,0,0.35)" flexShrink={0}>
            <ParticipantPhoto path={next.photoUrl} size="large" />
          </Box>

          <Stack gap="4" flex="1" minW="0" align={{ base: "center", md: "flex-start" }}>
            <Flex align="center" gap="2" px="3" py="1" rounded="full" bg="whiteAlpha.100" borderWidth="1px" borderColor="gold.400/50">
              <Box w="2" h="2" rounded="full" bg="gold.400" animation="pulse 1.8s ease-in-out infinite" />
              <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.16em" textTransform="uppercase" color="gold.300">
                {tx("Next in line")}
              </Text>
            </Flex>
            <Heading as="h1" fontFamily="display" fontSize={{ base: "3xl", md: "5xl" }} lineHeight="1.05" letterSpacing="-0.01em">
              {next.fullName}
            </Heading>
            <Flex gap="2" wrap="wrap" justify={{ base: "center", md: "flex-start" }}>
              {facts.map(({ icon: Icon, text }) => (
                <Flex key={text} align="center" gap="1.5" px="3" py="1.5" rounded="full" bg="whiteAlpha.100" borderWidth="1px" borderColor="whiteAlpha.200" fontSize="sm">
                  <Icon size={14} color="#E2C06A" aria-hidden />
                  <Text>{text}</Text>
                </Flex>
              ))}
            </Flex>
            <Button
              mt="2"
              size="xl"
              px="8"
              rounded="xl"
              bg="gold.400"
              color="brand.900"
              fontWeight="bold"
              boxShadow="0 8px 22px rgba(201,154,53,0.45)"
              _hover={{ bg: "gold.300", transform: "translateY(-1px)" }}
              transition="all 0.15s"
              loading={calling && callingId === next.id}
              disabled={calling}
              onClick={() => onCall(next.id)}
              w={{ base: "full", sm: "auto" }}
            >
              <UserRoundCheck size={20} aria-hidden />
              {tx("Call to the stage")}
            </Button>
          </Stack>
        </Flex>
      </Box>
      <ErrorAlert message={error} />

      {/* Who comes after. If the one in line is not here, the next one can go first:
          the absent one stays first in line for the following turn. */}
      {after && (
        <Flex align="center" gap="3" wrap="wrap" p="3" pe="4" rounded="xl" bg="white" borderWidth="1px">
          <ParticipantPhoto path={after.photoUrl} size="thumb" />
          <Box flex="1" minW="40">
            <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="0.1em">
              {tx("Then:")}
            </Text>
            <Text fontWeight="semibold" color="brand.900" truncate>
              {after.fullName}
            </Text>
          </Box>
          <Button size="sm" variant="outline" colorPalette="brand" loading={calling && callingId === after.id} disabled={calling} onClick={() => onCall(after.id)}>
            {tx("{name} not here? Call {next} first", { name: next.fullName.split(" ")[0]!, next: after.fullName.split(" ")[0]! })}
          </Button>
        </Flex>
      )}
    </Stack>
  );
}

// Step 2: the participant is on stage and picks a closed envelope on the stage screen; its questions
// then appear on every judge's screen. Backup when the stage screen is off: the judge hands over
// their own tablet and the participant picks here (shuffled, no numbers).
function DrawCard({ participant: p }: { participant: StageParticipant }) {
  const [backup, setBackup] = useState(false);
  const slots = useQuery(ENVELOPE_SLOTS, {
    fetchPolicy: "network-only",
    skip: !backup,
  });
  const [draw, { loading }] = useMutation(DRAW_ENVELOPE, {
    refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }, { query: ENVELOPES }],
  });
  const [call, callState] = useMutation(CALL_PARTICIPANT, {
    refetchQueries: [{ query: STAGE }],
  });
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const envelopes = slots.data?.envelopeSlots ?? [];

  async function sendBack() {
    if (
      !(await confirmDialog({
        message: tx("Send {name} back to the waiting list?", {
          name: p.fullName,
        }),
      }))
    )
      return;
    setError(null);
    try {
      await call({ variables: { participantId: null } });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  async function pick(id: string) {
    if (
      !(await confirmDialog({
        message: tx("{name}, open this envelope?", { name: p.fullName }),
        confirmLabel: tx("Open this envelope"),
      }))
    )
      return;
    setError(null);
    try {
      await draw({ variables: { envelopeId: id } });
    } catch (err) {
      setError(readApiError(err).message);
      void slots.refetch();
    }
  }

  return (
    <Card.Root overflow="hidden">
      <ParticipantInfo
        participant={p}
        label={tx("On stage")}
        right={
          <Button size="sm" variant="outline" color="white" borderColor="whiteAlpha.500" _hover={{ bg: "whiteAlpha.200" }} loading={callState.loading} onClick={sendBack}>
            {tx("Not ready, send back")}
          </Button>
        }
      />
      <Card.Body p={{ base: "4", md: "7" }} gap="5">
        {!backup ? (
          <Stack align="center" textAlign="center" gap="3" py={{ base: "4", md: "6" }}>
            <Circle size="16" bg="brand.50" color="brand.700">
              <MonitorSmartphone size={28} aria-hidden />
            </Circle>
            <Heading size="lg" color="brand.900">
              {tx("{name} is choosing an envelope on the stage screen", {
                name: p.fullName.split(" ")[0]!,
              })}
            </Heading>
            <Flex align="center" gap="2" color="fg.muted">
              <Spinner size="xs" />
              <Text>{tx("The questions appear here as soon as they pick one.")}</Text>
            </Flex>
            <Button size="xs" variant="plain" color="fg.muted" textDecoration="underline" mt="2" onClick={() => setBackup(true)}>
              {tx("Stage screen not working? Draw here instead")}
            </Button>
          </Stack>
        ) : (
          <Box textAlign="center">
            <Heading size="lg" color="brand.900">
              {tx("Hand the tablet to {name}", {
                name: p.fullName.split(" ")[0]!,
              })}
            </Heading>
            <Text color="fg.muted">{tx("Tap one envelope. Its 3 questions appear on every judge’s screen.")}</Text>
            <Button size="xs" variant="plain" color="fg.muted" textDecoration="underline" mt="1" onClick={() => setBackup(false)}>
              {tx("Back to the stage screen")}
            </Button>
          </Box>
        )}
        <ErrorAlert message={error ?? (slots.error ? readApiError(slots.error).message : null)} />
        {!backup ? null : slots.loading && !slots.data ? (
          <Text color="fg.muted" textAlign="center">
            {tx("Loading…")}
          </Text>
        ) : envelopes.length === 0 ? (
          <NoEnvelopes />
        ) : (
          <SimpleGrid columns={{ base: 3, sm: 4, md: 6 }} gap={{ base: "3", md: "4" }}>
            {envelopes.map((e) => (
              <chakra.button
                key={e.id}
                type="button"
                onClick={() => pick(e.id)}
                disabled={loading}
                aria-label={tx("Envelope")}
                aspectRatio={1.45}
                rounded="lg"
                bg="linear-gradient(160deg, #D9B45A 0%, #C99A35 100%)"
                color="brand.900"
                display="flex"
                alignItems="center"
                justifyContent="center"
                shadow="md"
                cursor="pointer"
                transition="transform 0.15s, box-shadow 0.15s"
                _hover={{ transform: "translateY(-3px)", shadow: "lg" }}
                _active={{ transform: "translateY(0)" }}
                _disabled={{ opacity: 0.6, cursor: "wait" }}
                _focusVisible={{
                  outline: "3px solid",
                  outlineColor: "brand.500",
                  outlineOffset: "2px",
                }}
              >
                <Mail size={32} strokeWidth={1.5} aria-hidden />
              </chakra.button>
            ))}
          </SimpleGrid>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function PanelProgress({ submitted, judgeCount }: { submitted: number; judgeCount: number }) {
  const { tx } = useI18n();
  return (
    <Stack
      gap="3"
      flexShrink={0}
      w={{ base: "full", sm: "auto" }}
      px="4"
      py="3"
      rounded="xl"
      bg="whiteAlpha.100"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      backdropFilter="blur(10px)"
    >
      {/* The panel: one seat per judge, gold once their sheet is in */}
      <Box>
        <Flex gap="1.5" aria-hidden>
          {Array.from({ length: judgeCount }, (_, i) => (
            <Circle
              key={i}
              size="7"
              fontSize="xs"
              fontWeight="bold"
              bg={i < submitted ? "gold.400" : "whiteAlpha.100"}
              color={i < submitted ? "brand.900" : "whiteAlpha.600"}
              borderWidth="1px"
              borderColor={i < submitted ? "gold.300" : "whiteAlpha.300"}
              transition="all 0.25s"
            >
              {i < submitted ? <CircleCheck size={14} /> : i + 1}
            </Circle>
          ))}
        </Flex>
        <Text fontSize="xs" color="whiteAlpha.700" mt="1.5" whiteSpace="nowrap">
          {tx("Judges submitted {n} / {total}", { n: submitted, total: judgeCount })}
        </Text>
      </Box>
    </Stack>
  );
}

function FinishBar({ participant: p, judgeCount, next }: { participant: StageParticipant; judgeCount: number; next: QueueParticipant | null }) {
  const [call, { loading }] = useMutation(CALL_PARTICIPANT, {
    refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }],
  });
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const done = p.sheetsSubmitted >= judgeCount;

  async function onNext() {
    if (
      !done &&
      !(await confirmDialog({
        message: tx("Only {n} of {total} judges have submitted. Finish the turn of {name} anyway?", { n: p.sheetsSubmitted, total: judgeCount, name: p.fullName }),
      }))
    )
      return;
    setError(null);
    try {
      await call({ variables: { participantId: next?.id ?? null } });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Stack gap="3">
      <ErrorAlert message={error} />
      <Flex align="center" justify="space-between" gap="3" p="4" rounded="xl" borderWidth="1px" bg={done ? "green.50" : "bg.subtle"} borderColor={done ? "green.200" : "border"} wrap="wrap">
        <Text fontSize="sm" color={done ? "green.800" : "fg.muted"} flex="1" minW="48">
          {done
            ? tx("All {total} judges have submitted. The final score is ready.", { total: judgeCount })
            : tx("Waiting for the other judges ({n} of {total} submitted).", {
                n: p.sheetsSubmitted,
                total: judgeCount,
              })}
        </Text>
        <Button colorPalette="brand" variant={done ? "solid" : "outline"} loading={loading} onClick={onNext}>
          {next
            ? tx("Next participant: {name}", {
                name: next.fullName.split(" ")[0]!,
              })
            : tx("Finish this turn")}
        </Button>
      </Flex>
    </Stack>
  );
}

function PastSheet({ id, rules, onBack }: { id: string; rules: ScoringRules; onBack: () => void }) {
  const { data, error } = useQuery(JUDGING_PARTICIPANT, {
    variables: { id },
    fetchPolicy: "network-only",
  });
  const p = data?.participant;
  const { tx } = useI18n();
  return (
    <Stack gap="3">
      <Button alignSelf="flex-start" size="sm" variant="ghost" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden />
        {tx("Back to the stage")}
      </Button>
      <ErrorAlert message={error ? readApiError(error).message : null} />
      {p?.envelope ? (
        <Card.Root overflow="clip">
          <ParticipantInfo
            compact
            participant={p}
            label={tx("Your sheet · envelope {n}", {
              n: p.envelope.number,
            })}
          />
          <Card.Body p={{ base: "4", md: "7" }}>
            <Sheet key={p.id} participant={p} rules={rules} />
          </Card.Body>
        </Card.Root>
      ) : (
        !error && <Text color="fg.muted">{tx("Loading…")}</Text>
      )}
    </Stack>
  );
}

// Step 3: the judge's own sheet. While it is a draft every tap is saved quietly. Once submitted it is
// final: it can only be read, never changed (the server refuses it too).
function Sheet({ participant, rules }: { participant: StageParticipant; rules: ScoringRules }) {
  const texts = participant.envelope?.questions ?? [];
  const initial = participant.mySheet;
  const [marks, setMarks] = useState<Marks[]>(initial ? initial.questions.map(marksOnly) : texts.map(() => EMPTY_MARKS));
  const [sauti, setSauti] = useState<number | null>(initial?.sauti ?? null);
  const [submitted, setSubmitted] = useState(Boolean(initial?.submitted));
  const [active, setActive] = useState(() => firstOpen(marks, rules));
  const [undo, setUndo] = useState<{ q: number; kind: MarkKind }[]>([]);
  const [dirty, setDirty] = useState(false); // changes not yet sent
  const [reviewing, setReviewing] = useState(false); // the check before submitting
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const [save, { loading }] = useMutation(SAVE_SHEET, {
    refetchQueries: [{ query: STAGE }],
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Bumped on every tap. A save only clears "dirty" if nothing changed while it was on its way.
  const version = useRef(0);
  // Saves run one after the other, so an older one can never land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const total = sheetTotal(marks, sauti, rules);

  function touch() {
    version.current += 1;
    setDirty(true);
  }

  // What is on screen now, read when a save's turn comes (not when it was asked for).
  const latest = useRef({ marks, sauti });
  useEffect(() => {
    latest.current = { marks, sauti };
  }, [marks, sauti]);

  function send(submit: boolean) {
    clearTimeout(timer.current);
    queue.current = queue.current.then(async () => {
      const v = version.current;
      setError(null);
      try {
        const { marks: questions, sauti: voice } = latest.current;
        const res = await save({
          variables: {
            input: {
              participantId: participant.id,
              questions,
              sauti: voice,
              submit,
            },
          },
        });
        if (version.current === v) setDirty(false);
        if (res.data?.saveSheet.submitted) setSubmitted(true);
      } catch (err) {
        setError(readApiError(err).message);
      }
    });
    return queue.current;
  }

  // Draft: save quietly a moment after the last tap, so nothing is lost if the tablet dies.
  const autosave = useEffectEvent(() => void send(false));
  useEffect(() => {
    if (!dirty || submitted) return;
    timer.current = setTimeout(() => autosave(), 800);
    return () => clearTimeout(timer.current);
  }, [dirty, submitted, marks, sauti]);

  function change(q: number, kind: MarkKind, by: 1 | -1) {
    if (submitted) return; // final
    const current = marks[q]!;
    if (by === -1 && current[kind] === 0) return;
    if (by === 1 && current.fath >= rules.fathLimit) return; // question already deleted
    const next = marks.map((m, i) => (i === q ? { ...m, [kind]: m[kind] + by } : m));
    setMarks(next);
    touch();
    if (by === 1) {
      setUndo((u) => [...u, { q, kind }]);
      // The 3rd Fath deletes the question: move on to the next one, as on paper.
      if (kind === "fath" && next[q]!.fath >= rules.fathLimit && q < texts.length - 1) setActive(q + 1);
    }
  }

  function undoLast() {
    const last = undo.at(-1);
    if (!last || submitted) return;
    setUndo((u) => u.slice(0, -1));
    setMarks((all) => all.map((m, i) => (i === last.q ? { ...m, [last.kind]: Math.max(0, m[last.kind] - 1) } : m)));
    setActive(last.q);
    touch();
  }

  const q = marks[active]!;
  const deleted = q.fath >= rules.fathLimit;

  return (
    <Stack gap={{ base: "5", md: "6" }}>
      {/* Which question is being recited: tap to switch. The current one is shown in full. */}
      <Box>
        <SimpleGrid columns={{ base: 1, md: texts.length }} gap={{ base: "2.5", md: "4" }} role="tablist">
          {texts.map((text, i) => {
            const gone = marks[i]!.fath >= rules.fathLimit;
            const on = i === active;
            return (
              <chakra.button
                key={i}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(i)}
                position="relative"
                overflow="hidden"
                display="flex"
                flexDirection={{ base: "row", md: "column" }}
                alignItems={{ base: "center", md: "flex-start" }}
                gap={{ base: "4", md: "3" }}
                minH={{ md: "36" }}
                p={{ base: "4", md: "5" }}
                rounded="2xl"
                textAlign="left"
                cursor="pointer"
                bg={on ? NAVY_GRADIENT : gone ? "red.50" : "white"}
                color={on ? "white" : "brand.900"}
                borderWidth="1px"
                borderColor={on ? "transparent" : gone ? "red.200" : "border"}
                boxShadow={on ? "0 14px 30px rgba(26,35,78,0.35), 0 0 0 3px #E2C06A" : "0 1px 2px rgba(26,35,78,0.06)"}
                transform={on ? { md: "translateY(-3px)" } : undefined}
                transition="background 0.2s, box-shadow 0.2s, transform 0.2s"
                _hover={
                  on
                    ? undefined
                    : {
                        borderColor: gone ? "red.300" : "brand.200",
                        boxShadow: "0 6px 16px rgba(26,35,78,0.12)",
                      }
                }
                _focusVisible={{
                  outline: "3px solid",
                  outlineColor: "gold.400",
                  outlineOffset: "3px",
                }}
              >
                {/* The star pattern on the one being recited */}
                {on && (
                  <Box position="absolute" top="-6" right="-6" w="28" h="28" color="gold.400" opacity={0.18} aria-hidden>
                    <Octagram size="100%" strokeWidth={1.6} />
                  </Box>
                )}
                <Flex align="center" justify="space-between" gap="2" w={{ md: "full" }} flexShrink={0}>
                  <Circle size={{ base: "10", md: "11" }} fontWeight="bold" fontSize="lg" bg={on ? "gold.400" : gone ? "red.500" : "brand.50"} color={on ? "brand.900" : gone ? "white" : "brand.700"}>
                    {i + 1}
                  </Circle>
                  {gone ? (
                    <Badge display={{ base: "none", md: "inline-flex" }} colorPalette="red" variant="solid" rounded="full">
                      {tx("Deleted · 0")}
                    </Badge>
                  ) : null}
                </Flex>
                <Box position="relative" minW="0" flex="1">
                  <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.14em" textTransform="uppercase" color={on ? "gold.300" : gone ? "red.600" : "fg.muted"}>
                    {tx("Question {n}", { n: i + 1 })}
                    {gone && <chakra.span display={{ md: "none" }}> · {tx("Deleted · 0")}</chakra.span>}
                  </Text>
                  <Text
                    fontFamily="display"
                    fontSize={{ base: "lg", md: "xl" }}
                    fontWeight="semibold"
                    lineHeight="1.3"
                    mt="1"
                    textDecoration={gone ? "line-through" : undefined}
                    opacity={gone && !on ? 0.75 : 1}
                  >
                    {text}
                  </Text>
                </Box>
              </chakra.button>
            );
          })}
        </SimpleGrid>
        {deleted && (
          <Badge mt="3" colorPalette="red" variant="solid">
            {tx("Deleted: {n} reminders", { n: rules.fathLimit })}
          </Badge>
        )}
      </Box>

      {/* The mistakes in this question */}
      <Box>
        <Flex justify="space-between" align="center" gap="2" mb="3" wrap="wrap">
          <Text fontSize="sm" color="fg.muted">
            {tx("Tap a card each time the mistake happens.")}
          </Text>
          <Button size="xs" variant="ghost" onClick={undoLast} disabled={undo.length === 0} flexShrink={0} display={submitted ? "none" : undefined}>
            <Undo2 size={14} aria-hidden />
            {tx("Undo last mark")}
          </Button>
        </Flex>
        <SimpleGrid columns={{ base: 2, xl: 4 }} gap="3">
          {MARK_TYPES.map((mark) => (
            <MarkCard
              key={mark.kind}
              mark={mark}
              penalty={mark.penalty(rules)}
              count={q[mark.kind]}
              limit={mark.kind === "fath" ? rules.fathLimit : undefined}
              locked={deleted && mark.kind !== "fath"}
              addDisabled={deleted || submitted}
              readOnly={submitted}
              onAdd={() => change(active, mark.kind, 1)}
              onRemove={() => change(active, mark.kind, -1)}
            />
          ))}
        </SimpleGrid>
        {deleted && active < texts.length - 1 && (
          <Button mt="4" size="sm" colorPalette="brand" onClick={() => setActive(active + 1)}>
            {tx("Go to question {n}", { n: active + 2 })}
          </Button>
        )}
      </Box>

      {/* Voice, once, at the end: a card like the question cards */}
      <Box
        rounded="2xl"
        borderWidth="1px"
        borderColor={sauti === null ? "border" : "gold.300"}
        bg={sauti === null ? "white" : "gold.50"}
        p={{ base: "4", md: "5" }}
        boxShadow="0 1px 2px rgba(26,35,78,0.06)"
        transition="background 0.2s, border-color 0.2s"
      >
        <Flex align="center" justify="space-between" gap="4" wrap="wrap">
          <Flex align="center" gap="3" minW="0">
            <Circle size={{ base: "10", md: "11" }} bg={sauti === null ? "gold.50" : "gold.400"} color={sauti === null ? "gold.600" : "brand.900"} transition="background 0.2s" flexShrink={0}>
              <Mic size={20} aria-hidden />
            </Circle>
            <Text fontFamily="display" fontSize={{ base: "lg", md: "xl" }} fontWeight="semibold" color="brand.900" lineHeight="1.25">
              Sauti
            </Text>
          </Flex>
          <Flex gap={{ base: "1.5", md: "2" }} role="radiogroup" aria-label="Sauti" w={{ base: "full", md: "auto" }} justify={{ base: "space-between", md: "flex-end" }}>
            {Array.from({ length: rules.sautiMax + 1 }, (_, v) => {
              const on = sauti === v;
              return (
                <chakra.button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={submitted}
                  onClick={() => {
                    setSauti(v);
                    touch();
                  }}
                  w={{ base: "11", md: "12" }}
                  h={{ base: "11", md: "12" }}
                  rounded="full"
                  fontWeight="bold"
                  fontSize="lg"
                  cursor="pointer"
                  bg={on ? "brand.900" : "white"}
                  color={on ? "gold.300" : "brand.900"}
                  borderWidth="2px"
                  borderColor={on ? "gold.400" : "border"}
                  boxShadow={on ? "0 6px 14px rgba(26,35,78,0.25)" : undefined}
                  transform={on ? "scale(1.08)" : undefined}
                  transition="all 0.15s"
                  _hover={on || submitted ? undefined : { borderColor: "gold.400", bg: "gold.50" }}
                  _disabled={{ cursor: "default", opacity: on ? 1 : 0.5 }}
                  _focusVisible={{ outline: "3px solid", outlineColor: "gold.400", outlineOffset: "2px" }}
                >
                  {v}
                </chakra.button>
              );
            })}
          </Flex>
        </Flex>
      </Box>

      <ErrorAlert message={error} />

      {/* The total, always in view at the bottom of the screen */}
      <Flex
        position="sticky"
        bottom={{ base: "2", md: "4" }}
        zIndex="docked"
        align="center"
        justify="space-between"
        gap="4"
        wrap="wrap"
        px={{ base: "4", md: "5" }}
        py="3"
        rounded="2xl"
        bg={NAVY_GRADIENT}
        color="white"
        boxShadow="0 16px 36px rgba(26,35,78,0.35)"
        borderWidth="1px"
        borderColor="gold.400/40"
      >
        <Flex align="center" gap="3.5" minW="0" flex="1">
          <TotalRing total={total} />
          <Box minW="0">
            <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.14em" textTransform="uppercase" color="gold.300">
              {tx("Your total")}
            </Text>
            <Text fontSize="xs" color="whiteAlpha.800" mt="0.5" lineClamp={2}>
              {sauti === null && !submitted
                ? tx("Give the sauti to see the total.")
                : submitted
                  ? tx("Submitted. Your sheet is final and can no longer be changed.")
                  : loading
                    ? tx("Saving draft…")
                    : dirty
                      ? tx("Draft…")
                      : tx("Draft saved. The other judges never see your sheet.")}
            </Text>
          </Box>
        </Flex>
        {submitted ? (
          <Flex align="center" gap="2" px="4" py="2.5" rounded="xl" bg="green.500/20" borderWidth="1px" borderColor="green.400/60" color="green.100" fontWeight="bold" w={{ base: "full", sm: "auto" }} justify="center">
            <Lock size={16} aria-hidden />
            {tx("Submitted")}
          </Flex>
        ) : (
          <Button
            size="lg"
            rounded="xl"
            fontWeight="bold"
            bg={sauti === null ? "whiteAlpha.200" : "gold.400"}
            color={sauti === null ? "whiteAlpha.800" : "brand.900"}
            boxShadow={sauti === null ? undefined : "0 8px 20px rgba(201,154,53,0.4)"}
            _hover={{ bg: sauti === null ? "whiteAlpha.200" : "gold.300" }}
            _disabled={{ opacity: 1, cursor: "not-allowed" }}
            disabled={sauti === null}
            loading={loading}
            onClick={() => setReviewing(true)}
            w={{ base: "full", sm: "auto" }}
          >
            {sauti === null ? <Mic size={16} aria-hidden /> : <CircleCheck size={18} aria-hidden />}
            {sauti === null ? tx("Give the sauti first") : tx("Check and submit")}
          </Button>
        )}
      </Flex>

      <SheetReview
        open={reviewing}
        participantName={participant.fullName}
        marks={marks}
        sauti={sauti}
        total={total}
        rules={rules}
        loading={loading}
        onEdit={(i) => {
          setReviewing(false);
          setActive(i);
        }}
        onClose={() => setReviewing(false)}
        onSubmit={async () => {
          await send(true);
          setReviewing(false);
        }}
      />
    </Stack>
  );
}

// The judge's total out of 100, in a gold ring.
function TotalRing({ total }: { total: number | null }) {
  const r = 26;
  const len = 2 * Math.PI * r;
  const part = total === null ? 0 : Math.max(0, Math.min(total / 100, 1));
  return (
    <Box position="relative" w="16" h="16" flexShrink={0}>
      <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden style={{ transform: "rotate(-90deg)" }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#E2C06A"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - part)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <Flex position="absolute" inset="0" direction="column" align="center" justify="center">
        <Text fontSize="md" fontWeight="bold" lineHeight="1" fontVariantNumeric="tabular-nums">
          {total ?? "—"}
        </Text>
        <Text fontSize="2xs" color="whiteAlpha.600" lineHeight="1" mt="0.5">
          / 100
        </Text>
      </Flex>
    </Box>
  );
}

// The count inside a ring. Fath fills by thirds toward deletion; the others fill a fifth per mark.
function CountRing({ count, limit, color }: { count: number; limit?: number; color: string }) {
  const r = 20;
  const len = 2 * Math.PI * r;
  const part = Math.min(count / (limit ?? 5), 1);
  return (
    <Box position="relative" w={{ base: "11", md: "12" }} h={{ base: "11", md: "12" }} flexShrink={0} aria-live="polite">
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden style={{ transform: "rotate(-90deg)" }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--chakra-colors-gray-200)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={`var(--chakra-colors-${color}-500)`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - part)}
          style={{ transition: "stroke-dashoffset 0.35s ease" }}
        />
      </svg>
      <Flex position="absolute" inset="0" align="center" justify="center">
        <Text
          key={count}
          fontSize={{ base: "md", md: "lg" }}
          fontWeight="bold"
          lineHeight="1"
          color={count ? `${color}.600` : "fg.subtle"}
          fontVariantNumeric="tabular-nums"
          animation={count ? "scale-in 0.2s ease-out" : undefined}
        >
          {count}
        </Text>
      </Flex>
    </Box>
  );
}

// One kind of mistake on the active question, in the same style as the question cards. The whole
// card is one button: the judge taps it each time the mistake happens (it only takes points off).
// A wrong tap? "Take one back".
function MarkCard({
  mark,
  penalty,
  count,
  limit,
  locked,
  addDisabled,
  readOnly = false,
  onAdd,
  onRemove,
}: {
  mark: MarkType;
  penalty: number;
  count: number;
  limit?: number;
  locked: boolean;
  addDisabled: boolean;
  // Submitted: shown as it is, nothing can be changed.
  readOnly?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { tx } = useI18n();
  const c = mark.palette;
  const lost = round(count * penalty);
  const hit = count > 0;
  return (
    <Flex
      direction="column"
      minW="0"
      rounded="2xl"
      bg={hit ? `${c}.50` : "white"}
      borderWidth="1px"
      borderColor={hit ? `${c}.300` : "border"}
      boxShadow={hit ? "0 8px 20px rgba(26,35,78,0.10)" : "0 1px 2px rgba(26,35,78,0.06)"}
      overflow="hidden"
      opacity={locked ? 0.45 : 1}
      transition="background 0.2s, border-color 0.2s, box-shadow 0.2s"
    >
      <chakra.button
        type="button"
        onClick={onAdd}
        disabled={addDisabled}
        aria-label={tx("{name}: {hint}, minus {n}", { name: mark.name, hint: tx(mark.hint), n: penalty })}
        display="flex"
        flexDirection="column"
        gap="3"
        flex="1"
        p={{ base: "4", md: "5" }}
        textAlign="left"
        cursor="pointer"
        userSelect="none"
        transition="transform 0.08s"
        _hover={{ bg: hit ? undefined : "bg.subtle" }}
        _active={{ transform: "scale(0.98)" }}
        _disabled={{ cursor: readOnly ? "default" : "not-allowed", _hover: { bg: "transparent" }, _active: { transform: "none" } }}
        _focusVisible={{ outline: "3px solid", outlineColor: `${c}.400`, outlineOffset: "-3px" }}
      >
        <Flex align="center" justify="space-between" gap="2">
          <Circle
            size={{ base: "10", md: "11" }}
            fontWeight="bold"
            fontSize="lg"
            bg={hit ? `${c}.500` : `${c}.50`}
            color={hit ? "white" : `${c}.600`}
            transition="background 0.2s, color 0.2s"
            aria-hidden
          >
            {mark.sign}
          </Circle>
          <CountRing count={count} limit={limit} color={c} />
        </Flex>
        <Box minW="0">
          <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.14em" textTransform="uppercase" color={`${c}.600`}>
            {tx("−{n} each", { n: penalty })}
          </Text>
          <Text fontFamily="display" fontSize={{ base: "lg", md: "xl" }} fontWeight="semibold" color="brand.900" lineHeight="1.25" mt="0.5" whiteSpace="nowrap">
            {mark.name}
          </Text>
          <Text fontSize="sm" color="fg.muted" lineHeight="1.35" mt="1" lineClamp={2}>
            {tx(mark.hint)}
          </Text>
        </Box>
      </chakra.button>

      {/* What it cost, and taking back a wrong tap */}
      <Flex
        align="center"
        justify="space-between"
        wrap="wrap"
        columnGap="2"
        px={{ base: "4", md: "5" }}
        py="1.5"
        minH="9"
        borderTopWidth="1px"
        borderColor={hit ? `${c}.200` : "border.muted"}
      >
        <Text fontSize="sm" fontWeight="semibold" color={hit ? `${c}.700` : "fg.subtle"} fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
          {hit ? tx("−{n} points", { n: lost }) : tx("No mistake")}
        </Text>
        <Button size="xs" variant="ghost" colorPalette={c} onClick={onRemove} visibility={hit && !readOnly ? "visible" : "hidden"} aria-label={tx("Remove one {name}", { name: mark.name })}>
          <Undo2 size={13} aria-hidden />
          {tx("Take one back")}
        </Button>
      </Flex>
    </Flex>
  );
}

// The check before submitting: every question with its marks by name, the sauti and the total.
// A mistake? "Edit" goes back to that question. Nothing is sent until "Submit my sheet".
function SheetReview({
  open,
  participantName,
  marks,
  sauti,
  total,
  rules,
  loading,
  onEdit,
  onClose,
  onSubmit,
}: {
  open: boolean;
  participantName: string;
  marks: Marks[];
  sauti: number | null;
  total: number | null;
  rules: ScoringRules;
  loading: boolean;
  onEdit: (question: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { tx } = useI18n();
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center" size="lg" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content>
            <Dialog.Header flexDirection="column" alignItems="flex-start" gap="1">
              <Dialog.Title color="brand.900">{tx("Check your sheet for {name}", { name: participantName })}</Dialog.Title>
              <Text fontSize="sm" color="fg.muted">
                {tx("Make sure every mark is right. Tap Edit to fix a question before you submit.")}
              </Text>
              <Flex align="center" gap="2" mt="1" px="3" py="2" rounded="lg" bg="orange.50" borderWidth="1px" borderColor="orange.200" color="orange.800" fontSize="sm" fontWeight="semibold">
                <Lock size={15} aria-hidden />
                {tx("Once submitted, your sheet can no longer be changed.")}
              </Flex>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="3">
                {marks.map((m, i) => {
                  const gone = m.fath >= rules.fathLimit;
                  return (
                    <Box key={i} p="3" rounded="lg" borderWidth="1px" bg={gone ? "red.50" : "white"}>
                      <Flex justify="space-between" align="center" gap="2" mb="2">
                        <Text fontWeight="semibold" color="brand.900">
                          {tx("Question {n}", { n: i + 1 })}
                        </Text>
                        <Flex align="center" gap="2">
                          <Text fontWeight="bold" color={gone ? "red.600" : "brand.900"} fontVariantNumeric="tabular-nums">
                            {gone ? tx("Deleted · 0") : `${questionScore(m, sauti, rules)} / ${rules.questionPoints}`}
                          </Text>
                          <Button size="xs" variant="outline" onClick={() => onEdit(i)}>
                            <Pencil size={13} aria-hidden />
                            {tx("Edit")}
                          </Button>
                        </Flex>
                      </Flex>
                      <SimpleGrid columns={4} gap="2">
                        {MARK_TYPES.map((t) => (
                          <Box key={t.kind} textAlign="center" py="1.5" rounded="md" bg={m[t.kind] ? `${t.palette}.50` : "bg.subtle"}>
                            <Text fontSize="xs" color="fg.muted">
                              {t.name}
                            </Text>
                            <Text fontWeight="bold" color={m[t.kind] ? `${t.palette}.700` : "fg.subtle"} fontVariantNumeric="tabular-nums">
                              {m[t.kind]}
                            </Text>
                          </Box>
                        ))}
                      </SimpleGrid>
                    </Box>
                  );
                })}
                <Flex justify="space-between" px="1" color="fg.muted" fontSize="sm">
                  <Text>
                    Sauti {sauti ?? "—"} / {rules.sautiMax} · {tx("Presence")} +{rules.presencePoints}
                  </Text>
                  <Text fontWeight="bold" fontSize="lg" color="brand.900" fontVariantNumeric="tabular-nums">
                    {total ?? "—"} / 100
                  </Text>
                </Flex>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                {tx("Back to marking")}
              </Button>
              <Button colorPalette="brand" loading={loading} disabled={sauti === null} onClick={onSubmit}>
                {tx("Submit my sheet")}
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

// Everyone who already drew an envelope: open one to see your sheet.
function Recited({ recited, viewId, onOpen }: { recited: QueueParticipant[]; viewId: string | null; onOpen: (id: string | null) => void }) {
  const { tx } = useI18n();
  if (recited.length === 0) return null;
  const latest = [...recited].reverse();

  return (
    <Card.Root>
      <Card.Body p={{ base: "4", md: "6" }} gap="3">
        <Box>
          <Heading size="sm" color="brand.900">
            {tx("Already recited ({n})", { n: recited.length })}
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            {tx("Open one to see your sheet.")}{" "}
            <Link asChild colorPalette="brand">
              <NextLink href="/participants">{tx("See all results")}</NextLink>
            </Link>
          </Text>
        </Box>
        <Stack gap="0">
          {latest.map((p, i) => (
            <Flex key={p.id} align="center" gap="3" py="2" borderTopWidth={i === 0 ? "0" : "1px"}>
              <ParticipantPhoto path={p.photoUrl} size="thumb" />
              <Box flex="1" minW="0">
                <Text fontWeight="semibold" color="brand.900" truncate>
                  {p.fullName}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {tx("Envelope {n}", { n: p.envelope!.number })} · {p.sheetsSubmitted === 1 ? tx("1 judge submitted") : tx("{n} judges submitted", { n: p.sheetsSubmitted })}
                  {p.score !== null && ` · ${tx("final {n}", { n: p.score })}`}
                </Text>
              </Box>
              <Button size="sm" variant={viewId === p.id ? "solid" : "outline"} colorPalette="brand" onClick={() => onOpen(p.id)}>
                {tx("My sheet")}
              </Button>
            </Flex>
          ))}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

function firstOpen(marks: Marks[], r: ScoringRules) {
  const i = marks.findIndex((m) => m.fath < r.fathLimit);
  return i === -1 ? 0 : i;
}

const round = (n: number) => Math.round(n * 100) / 100;
