"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import {
  Badge,
  Box,
  Button,
  Card,
  chakra,
  Circle,
  Flex,
  Grid,
  Heading,
  Input,
  InputGroup,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ArrowLeft, BookOpen, CircleCheck, Mail, MonitorSmartphone, Minus, Search, TriangleAlert, Undo2, UserRoundCheck } from "lucide-react";
import NextLink from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { NAVY_GRADIENT, ParticipantInfo, RulesCard } from "@/components/JudgingParts";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { readApiError } from "@/lib/errors";
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

type MarkKind = keyof Marks;
const EMPTY: Marks = { fath: 0, tanbih: 0, tajweed: 0 };

// The three marks of the paper sheet, in the order the judges use them.
// The names are the Arabic terms the judges use in every language; the hints are translated.
const MARKS: { kind: MarkKind; sign: string; name: string; hint: AppKey; penalty: (r: ScoringRules) => number }[] = [
  { kind: "tajweed", sign: "X", name: "Tajweed", hint: "Tajweed, waqf or ibtida mistake", penalty: (r) => r.tajweedPenalty },
  { kind: "tanbih", sign: "I", name: "Tanbih", hint: "Judge tapped the table", penalty: (r) => r.tanbihPenalty },
  { kind: "fath", sign: "●", name: "Fath", hint: "Judge reminded the participant", penalty: (r) => r.fathPenalty },
];

const STEPS: AppKey[] = ["Call the participant", "They pick an envelope", "Listen and mark", "Next participant"];

// The judge's desk, the whole competition on one screen:
// 1. call the next participant, 2. hand them the tablet to pick an envelope, 3. listen and mark
// your own sheet, 4. call the next one. Every judge's screen follows the same stage live.
export function JudgingDesk() {
  const stage = useQuery(STAGE);
  const rules = useQuery(SCORING_RULES);
  const queue = useQuery(STAGE_QUEUE);
  const envelopes = useQuery(ENVELOPES);
  const counts = useQuery(PARTICIPANT_COUNTS);
  const [viewId, setViewId] = useState<string | null>(null); // a past participant, for a correction
  const [showRules, setShowRules] = useState(false);
  const { tx } = useI18n();

  const onStage = stage.data?.stage.participant ?? null;
  const judgeCount = counts.data?.settings.judgeCount ?? 4;
  const all = useMemo(
    () => [...(queue.data?.participants ?? [])].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt)),
    [queue.data],
  );
  const waiting = all.filter((p) => !p.envelope && p.id !== onStage?.id);
  const recited = all.filter((p) => p.envelope && p.id !== onStage?.id);
  const sealed = envelopes.data ? envelopes.data.envelopes.filter((e) => !e.used).length : undefined;

  const error = stage.error ?? rules.error ?? queue.error;
  if (error) return <ErrorAlert message={readApiError(error).message} />;
  if (!rules.data || !stage.data) return <Text color="fg.muted">{tx("Loading…")}</Text>;
  const r = rules.data.scoringRules;

  const step = !onStage ? 0 : !onStage.envelope ? 1 : onStage.sheetsSubmitted >= judgeCount ? 3 : 2;
  const correcting = viewId && viewId !== onStage?.id;

  return (
    <Stack gap={{ base: "5", md: "6" }}>
      <DeskHeader
        step={correcting ? null : step}
        stats={[
          { label: tx("Waiting"), value: waiting.length },
          { label: tx("Recited"), value: recited.length },
          { label: tx("Envelopes left"), value: sealed ?? "…" },
          { label: tx("Judges"), value: judgeCount },
        ]}
        showRules={showRules}
        onRules={() => setShowRules((v) => !v)}
      />
      {showRules && <RulesCard rules={r} />}

      {sealed === 0 && !onStage?.envelope && <NoEnvelopes />}

      {correcting ? (
        <PastSheet id={viewId} rules={r} onBack={() => setViewId(null)} />
      ) : !onStage ? (
        <CallNext waiting={waiting} loading={queue.loading && !queue.data} />
      ) : !onStage.envelope ? (
        <DrawCard participant={onStage} />
      ) : (
        <Card.Root overflow="hidden">
          <ParticipantInfo
            participant={onStage}
            label={tx("Reciting now")}
            right={<PanelProgress submitted={onStage.sheetsSubmitted} judgeCount={judgeCount} mine={Boolean(onStage.mySheet?.submitted)} />}
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

function DeskHeader({
  step,
  stats,
  showRules,
  onRules,
}: {
  step: number | null;
  stats: { label: string; value: number | string }[];
  showRules: boolean;
  onRules: () => void;
}) {
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

      {/* Where we are in the turn */}
      {step !== null && (
        <SimpleGrid columns={{ base: 2, md: 4 }} gap="2" mt="5">
          {STEPS.map((label, i) => (
            <Flex
              key={label}
              align="center"
              gap="2"
              px="3"
              py="2"
              rounded="lg"
              bg={i === step ? "gold.400" : "whiteAlpha.100"}
              color={i === step ? "brand.900" : i < step ? "whiteAlpha.900" : "whiteAlpha.600"}
              fontSize="sm"
              fontWeight={i === step ? "bold" : "medium"}
            >
              <Circle size="6" bg={i === step ? "brand.900" : "whiteAlpha.200"} color={i === step ? "gold.300" : "white"} fontSize="xs" flexShrink={0}>
                {i < step ? <CircleCheck size={14} /> : i + 1}
              </Circle>
              {tx(label)}
            </Flex>
          ))}
        </SimpleGrid>
      )}

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
  const [call, { loading: calling }] = useMutation(CALL_PARTICIPANT, { refetchQueries: [{ query: STAGE }] });
  const [callingId, setCallingId] = useState<string | null>(null); // only that button spins
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const next = waiting[0];
  const q = search.trim().toLowerCase();
  const shown = waiting.filter((p) => !q || p.fullName.toLowerCase().includes(q) || p.institution.toLowerCase().includes(q));

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
            {tx("Every registered participant has recited. You can still correct your sheets below.")}
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Stack gap="5">
      <Card.Root overflow="hidden">
        <ParticipantInfo
          participant={next}
          label={tx("Next in line")}
          right={
            <Button size="lg" bg="gold.400" color="brand.900" _hover={{ bg: "gold.300" }} loading={calling && callingId === next.id} disabled={calling} onClick={() => onCall(next.id)} alignSelf={{ base: "stretch", sm: "center" }}>
              <UserRoundCheck size={18} aria-hidden />
              {tx("Call to the stage")}
            </Button>
          }
        />
        <ErrorAlert message={error} />
      </Card.Root>

      <Card.Root>
        <Card.Body p={{ base: "4", md: "6" }} gap="4">
          <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} gap="3" direction={{ base: "column", md: "row" }}>
            <Box>
              <Heading size="md" color="brand.900">
                {tx("Waiting to recite ({n})", { n: waiting.length })}
              </Heading>
              <Text fontSize="sm" color="fg.muted">
                {tx("In registration order. You can call someone else if they are not ready.")}
              </Text>
            </Box>
            <InputGroup startElement={<Search size={16} aria-hidden />} maxW={{ md: "xs" }}>
              <Input placeholder={tx("Search name or halaqa")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </InputGroup>
          </Flex>
          {shown.length === 0 ? (
            <Text color="fg.muted" fontSize="sm">
              {tx("Nobody matches this search.")}
            </Text>
          ) : (
            <Stack gap="0">
              {shown.map((p, i) => (
                <Flex key={p.id} align="center" gap="3" py="2.5" borderTopWidth={i === 0 ? "0" : "1px"}>
                  <Text w="7" textAlign="right" color="fg.subtle" fontSize="sm" fontVariantNumeric="tabular-nums">
                    {waiting.indexOf(p) + 1}
                  </Text>
                  <ParticipantPhoto path={p.photoUrl} size="thumb" />
                  <Box flex="1" minW="0">
                    <Text fontWeight="semibold" color="brand.900" truncate>
                      {p.fullName}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" truncate>
                      {p.institution} · {p.commune}
                    </Text>
                  </Box>
                  <Button size="sm" variant="outline" colorPalette="brand" loading={calling && callingId === p.id} disabled={calling} onClick={() => onCall(p.id)}>
                    {tx("Call")}
                  </Button>
                </Flex>
              ))}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}

// Step 2: the participant is on stage and picks a closed envelope on the stage screen; its questions
// then appear on every judge's screen. Backup when the stage screen is off: the judge hands over
// their own tablet and the participant picks here (shuffled, no numbers).
function DrawCard({ participant: p }: { participant: StageParticipant }) {
  const [backup, setBackup] = useState(false);
  const slots = useQuery(ENVELOPE_SLOTS, { fetchPolicy: "network-only", skip: !backup });
  const [draw, { loading }] = useMutation(DRAW_ENVELOPE, {
    refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }, { query: ENVELOPES }],
  });
  const [call, callState] = useMutation(CALL_PARTICIPANT, { refetchQueries: [{ query: STAGE }] });
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const envelopes = slots.data?.envelopeSlots ?? [];

  async function sendBack() {
    if (!(await confirmDialog({ message: tx("Send {name} back to the waiting list?", { name: p.fullName }) }))) return;
    setError(null);
    try {
      await call({ variables: { participantId: null } });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  async function pick(id: string) {
    if (!(await confirmDialog({ message: tx("{name}, open this envelope?", { name: p.fullName }), confirmLabel: tx("Open this envelope") }))) return;
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
          <Button
            size="sm"
            variant="outline"
            color="white"
            borderColor="whiteAlpha.500"
            _hover={{ bg: "whiteAlpha.200" }}
            loading={callState.loading}
            onClick={sendBack}
          >
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
              {tx("{name} is choosing an envelope on the stage screen", { name: p.fullName.split(" ")[0]! })}
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
              {tx("Hand the tablet to {name}", { name: p.fullName.split(" ")[0]! })}
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
                _focusVisible={{ outline: "3px solid", outlineColor: "brand.500", outlineOffset: "2px" }}
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

function PanelProgress({ submitted, judgeCount, mine }: { submitted: number; judgeCount: number; mine: boolean }) {
  const { tx } = useI18n();
  return (
    <Stack gap="2" align={{ base: "flex-start", sm: "flex-end" }} flexShrink={0}>
      <Badge colorPalette={mine ? "green" : "gold"} variant={mine ? "solid" : "outline"} color={mine ? undefined : "gold.300"} size="md">
        {mine ? tx("Your sheet: submitted") : tx("Your sheet: not submitted")}
      </Badge>
      <Text fontSize="sm" color="whiteAlpha.800">
        {tx("Judges submitted {n} / {total}", { n: submitted, total: judgeCount })}
      </Text>
      <Flex gap="1">
        {Array.from({ length: judgeCount }, (_, i) => (
          <Box key={i} w="6" h="1.5" rounded="full" bg={i < submitted ? "gold.400" : "whiteAlpha.300"} />
        ))}
      </Flex>
    </Stack>
  );
}

// Step 4: when everyone has submitted, any judge calls the next participant.
function FinishBar({ participant: p, judgeCount, next }: { participant: StageParticipant; judgeCount: number; next: QueueParticipant | null }) {
  const [call, { loading }] = useMutation(CALL_PARTICIPANT, { refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }] });
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const done = p.sheetsSubmitted >= judgeCount;

  async function onNext() {
    if (!done && !(await confirmDialog({ message: tx("Only {n} of {total} judges have submitted. Finish the turn of {name} anyway?", { n: p.sheetsSubmitted, total: judgeCount, name: p.fullName }) }))) return;
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
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      p="4"
      rounded="xl"
      borderWidth="1px"
      bg={done ? "green.50" : "bg.subtle"}
      borderColor={done ? "green.200" : "border"}
      wrap="wrap"
    >
      <Text fontSize="sm" color={done ? "green.800" : "fg.muted"} flex="1" minW="48">
        {done
          ? tx("All {total} judges have submitted. The final score is ready.", { total: judgeCount })
          : tx("Waiting for the other judges ({n} of {total} submitted).", { n: p.sheetsSubmitted, total: judgeCount })}
      </Text>
      <Button colorPalette="brand" variant={done ? "solid" : "outline"} loading={loading} onClick={onNext}>
        {next ? tx("Next participant: {name}", { name: next.fullName.split(" ")[0]! }) : tx("Finish this turn")}
      </Button>
    </Flex>
    </Stack>
  );
}

function PastSheet({ id, rules, onBack }: { id: string; rules: ScoringRules; onBack: () => void }) {
  const { data, error } = useQuery(JUDGING_PARTICIPANT, { variables: { id }, fetchPolicy: "network-only" });
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
        <Card.Root overflow="hidden">
          <ParticipantInfo participant={p} label={tx("Correcting your sheet · envelope {n}", { n: p.envelope.number })} />
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

// Step 3: the judge's own sheet. While it is a draft every tap is saved quietly; after submitting,
// changes are a correction and are saved only when the judge confirms (each one goes to the history).
function Sheet({ participant, rules }: { participant: StageParticipant; rules: ScoringRules }) {
  const texts = participant.envelope?.questions ?? [];
  const initial = participant.mySheet;
  const [marks, setMarks] = useState<Marks[]>(
    initial ? initial.questions.map(({ fath, tanbih, tajweed }) => ({ fath, tanbih, tajweed })) : texts.map(() => EMPTY),
  );
  const [sauti, setSauti] = useState<number | null>(initial?.sauti ?? null);
  const [submitted, setSubmitted] = useState(Boolean(initial?.submitted));
  const [active, setActive] = useState(() => firstOpen(marks, rules));
  const [undo, setUndo] = useState<{ q: number; kind: MarkKind }[]>([]);
  const [dirty, setDirty] = useState(false); // changes not yet sent
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const [save, { loading }] = useMutation(SAVE_SHEET, { refetchQueries: [{ query: STAGE }] });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Bumped on every tap. A save only clears "dirty" if nothing changed while it was on its way.
  const version = useRef(0);
  // Saves run one after the other, so an older one can never land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const total = sheetTotal(marks, sauti, rules);
  // The 3 questions together (out of 99), sauti inside.
  const raw = marks.reduce((sum, q) => sum + questionScore(q, sauti, rules), 0);

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
        const res = await save({ variables: { input: { participantId: participant.id, questions, sauti: voice, submit } } });
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
    if (!last) return;
    setUndo((u) => u.slice(0, -1));
    setMarks((all) => all.map((m, i) => (i === last.q ? { ...m, [last.kind]: Math.max(0, m[last.kind] - 1) } : m)));
    setActive(last.q);
    touch();
  }

  const q = marks[active]!;
  const deleted = q.fath >= rules.fathLimit;

  return (
    <Stack gap="5">
      {/* The 3 questions of the envelope: tap one to mark it */}
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color="gold.700" letterSpacing="0.12em" textTransform="uppercase" mb="2">
          {tx("Envelope {n} · tap the question being recited", { n: participant.envelope?.number ?? "" })}
        </Text>
        <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
          {texts.map((text, i) => {
            const m = marks[i]!;
            const gone = m.fath >= rules.fathLimit;
            const on = i === active;
            return (
              <chakra.button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={on}
                textAlign="left"
                p="3.5"
                rounded="xl"
                borderWidth="2px"
                borderColor={on ? "brand.600" : "border"}
                bg={gone ? "red.50" : on ? "brand.50" : "white"}
                cursor="pointer"
                transition="border-color 0.15s, background 0.15s"
                _focusVisible={{ outline: "3px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
              >
                <Flex justify="space-between" align="center" gap="2">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="0.08em">
                    {tx("Question {n}", { n: i + 1 })}
                  </Text>
                  <Text fontWeight="bold" color={gone ? "red.600" : "brand.900"} fontVariantNumeric="tabular-nums">
                    {gone ? tx("Deleted · 0") : `${questionScore(m, sauti, rules)} / ${rules.questionPoints}`}
                  </Text>
                </Flex>
                <Text fontFamily="display" fontSize="xl" color="brand.900" mt="1" lineClamp={2}>
                  {text}
                </Text>
                <MarkSummary marks={m} />
              </chakra.button>
            );
          })}
        </SimpleGrid>
      </Box>

      {/* Marking the active question */}
      <Box rounded="2xl" borderWidth="1px" p={{ base: "4", md: "5" }} bg="bg.subtle">
        <Flex justify="space-between" align="center" mb="4" gap="3" wrap="wrap">
          <Box>
            <Heading size="md" color="brand.900">
              {tx("Marking question {n}", { n: active + 1 })}
              {deleted && (
                <Badge ml="2" colorPalette="red" variant="solid">
                  {tx("Deleted: {n} reminders", { n: rules.fathLimit })}
                </Badge>
              )}
            </Heading>
            <Text fontSize="sm" color="fg.muted" lineClamp={1}>
              {texts[active]}
            </Text>
          </Box>
          <Button size="sm" variant="outline" onClick={undoLast} disabled={undo.length === 0}>
            <Undo2 size={15} aria-hidden />
            {tx("Undo last mark")}
          </Button>
        </Flex>
        <SimpleGrid columns={3} gap={{ base: "2", md: "4" }}>
          {MARKS.map((mark) => (
            <MarkButton
              key={mark.kind}
              sign={mark.sign}
              name={mark.name}
              hint={tx(mark.hint)}
              penalty={mark.penalty(rules)}
              count={q[mark.kind]}
              limit={mark.kind === "fath" ? rules.fathLimit : undefined}
              disabled={deleted}
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

      {/* Voice */}
      <Box>
        <Text fontWeight="semibold" color="brand.900">
          {tx("Sauti (voice), out of {n}", { n: rules.sautiMax })}
        </Text>
        <Text fontSize="sm" color="fg.muted" mb="2">
          {tx("Give it at the end of the recitation.")}
        </Text>
        <Flex gap="2" wrap="wrap">
          {Array.from({ length: rules.sautiMax + 1 }, (_, v) => (
            <Button
              key={v}
              size="lg"
              minW="14"
              variant={sauti === v ? "solid" : "outline"}
              colorPalette={sauti === v ? "brand" : "gray"}
              aria-pressed={sauti === v}
              onClick={() => {
                setSauti(v);
                touch();
              }}
            >
              {v}
            </Button>
          ))}
        </Flex>
      </Box>

      <ErrorAlert message={error} />

      {/* Total and sending */}
      <Grid
        templateColumns={{ base: "1fr", md: "1fr auto" }}
        gap="4"
        alignItems="center"
        p={{ base: "4", md: "5" }}
        rounded="2xl"
        bg="brand.900"
        color="white"
      >
        <Box>
          <Text fontSize="sm" color="whiteAlpha.800">
            {tx("Questions")} {round(raw)} / {rules.questions * rules.questionPoints} ({tx("sauti inside")}: {sauti ?? "—"} /{" "}
            {rules.sautiMax}) · {tx("Presence")} +{rules.presencePoints}
          </Text>
          <Text fontSize="3xl" fontWeight="bold" fontVariantNumeric="tabular-nums" lineHeight="1.2">
            {total ?? "—"}{" "}
            <Text as="span" fontSize="lg" color="whiteAlpha.700" fontWeight="normal">
              / 100
            </Text>
          </Text>
          <Text fontSize="xs" color="whiteAlpha.700">
            {submitted
              ? dirty
                ? tx("Changes not saved yet. Save them as a correction.")
                : tx("Submitted. You can still correct it; every correction is kept in the history.")
              : loading
                ? tx("Saving draft…")
                : dirty
                  ? tx("Draft…")
                  : tx("Draft saved. The other judges never see your sheet.")}
          </Text>
        </Box>
        {submitted ? (
          <Button size="lg" bg="gold.400" color="brand.900" _hover={{ bg: "gold.300" }} disabled={!dirty || sauti === null} loading={loading} onClick={() => send(false)}>
            {tx("Save correction")}
          </Button>
        ) : (
          <Button
            size="lg"
            bg="gold.400"
            color="brand.900"
            _hover={{ bg: "gold.300" }}
            disabled={sauti === null}
            loading={loading}
            onClick={async () => {
              if (await confirmDialog({ message: tx("Submit your sheet for {name}: {total} / 100?", { name: participant.fullName, total: total ?? "—" }), confirmLabel: tx("Submit my sheet") })) void send(true);
            }}
          >
            {sauti === null ? tx("Give the sauti first") : tx("Submit my sheet")}
          </Button>
        )}
      </Grid>
    </Stack>
  );
}

function MarkButton({
  sign,
  name,
  hint,
  penalty,
  count,
  limit,
  disabled,
  onAdd,
  onRemove,
}: {
  sign: string;
  name: string;
  hint: string;
  penalty: number;
  count: number;
  limit?: number;
  disabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { tx } = useI18n();
  return (
    <Stack gap="1.5">
      <chakra.button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={tx("{name}: {hint}, minus {n}", { name, hint, n: penalty })}
        title={hint}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap="1"
        py={{ base: "4", md: "5" }}
        px="2"
        rounded="xl"
        bg="white"
        borderWidth="1px"
        shadow="sm"
        cursor="pointer"
        userSelect="none"
        transition="transform 0.08s, box-shadow 0.15s"
        _hover={{ shadow: "md" }}
        _active={{ transform: "scale(0.96)" }}
        _disabled={{ opacity: 0.45, cursor: "not-allowed", shadow: "none" }}
        _focusVisible={{ outline: "3px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
      >
        <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="bold" color="brand.900" lineHeight="1">
          {sign}
        </Text>
        <Text fontSize="sm" fontWeight="semibold" color="brand.900">
          {name}
        </Text>
        <Text fontSize="xs" color="fg.muted" textAlign="center" display={{ base: "none", md: "block" }}>
          {hint}
        </Text>
        <Text fontSize="xs" color="red.600" fontWeight="semibold">
          −{penalty}
        </Text>
      </chakra.button>
      <Flex align="center" justify="space-between" px="1">
        <Text fontSize="sm" fontVariantNumeric="tabular-nums" color={count ? "brand.900" : "fg.muted"} fontWeight={count ? "bold" : "normal"}>
          {count}
          {limit ? ` / ${limit}` : "×"}
        </Text>
        <chakra.button
          type="button"
          onClick={onRemove}
          disabled={count === 0}
          aria-label={tx("Remove one {name}", { name })}
          p="1"
          rounded="md"
          color="fg.muted"
          cursor="pointer"
          _hover={{ bg: "bg.muted" }}
          _disabled={{ opacity: 0.3, cursor: "default" }}
        >
          <Minus size={14} />
        </chakra.button>
      </Flex>
    </Stack>
  );
}

function MarkSummary({ marks: m }: { marks: Marks }) {
  const { tx } = useI18n();
  if (!m.fath && !m.tanbih && !m.tajweed) {
    return (
      <Text fontSize="xs" color="fg.subtle" mt="1">
        {tx("No marks")}
      </Text>
    );
  }
  return (
    <Text fontSize="xs" color="fg.muted" mt="1" fontVariantNumeric="tabular-nums">
      X {m.tajweed} · I {m.tanbih} · ● {m.fath}
    </Text>
  );
}

// Everyone who already drew an envelope: open one to check or correct your sheet.
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
            {tx("Open one to check or correct your sheet.")}{" "}
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
                  {tx("Envelope {n}", { n: p.envelope!.number })} ·{" "}
                  {p.sheetsSubmitted === 1 ? tx("1 judge submitted") : tx("{n} judges submitted", { n: p.sheetsSubmitted })}
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
