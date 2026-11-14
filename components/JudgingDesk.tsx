"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Box, Button, Card, chakra, Circle, CloseButton, Dialog, Flex, Heading, IconButton, Link, Portal, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { ArrowLeft, BookOpen, Cake, CircleCheck, CloudOff, GraduationCap, Mail, Lock, MapPin, Mic, MonitorSmartphone, Pencil, TriangleAlert, Undo2, User, UserRoundCheck } from "lucide-react";
import NextLink from "next/link";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { toaster } from "@/components/Toaster";
import { ageOf, NAVY_GRADIENT, ParticipantInfo, RulesCard } from "@/components/JudgingParts";
import { StarLattice } from "@/components/brand/Octagram";
import { MushafPage, preloadPages } from "@/components/MushafPage";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { questionInfo, questionLabel } from "@/lib/quran/label";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { isFinalAnswer, openSheets, readSheet, removeSheet, sheetKey, waitingSheets, writeSheet } from "@/lib/sheetOutbox";
import { EMPTY_MARKS, hasMarks, MARK_TYPES, marksOnly, SAUTI, type MarkKind, type MarkType } from "@/lib/marks";
import { MarkName } from "@/components/MarkName";
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
  const outbox = useSheetOutbox(stage.data ? [stage.data.stage.participant?.id ?? null, viewId] : null);

  const onStage = stage.data?.stage.participant ?? null;
  const judgeCount = counts.data?.settings.judgeCount ?? 4;
  const all = useMemo(() => [...(queue.data?.participants ?? [])].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt)), [queue.data]);
  const waiting = all.filter((p) => !p.envelope && p.id !== onStage?.id);
  const recited = all.filter((p) => p.envelope && p.id !== onStage?.id);
  const sealed = envelopes.data ? envelopes.data.envelopes.filter((e) => !e.used).length : undefined;

  const error = stage.error ?? rules.error ?? queue.error;
  // A failed reload keeps what was loaded: the open sheet (and its unsaved taps) must never be
  // swapped for an error. The error replaces the page only when nothing could be loaded at all.
  if (!rules.data || !stage.data) return error ? <ErrorAlert message={readApiError(error).message} /> : <Text color="fg.muted">{tx("Loading…")}</Text>;
  const r = rules.data.scoringRules;

  const correcting = viewId && viewId !== onStage?.id;
  const reciting = !correcting && Boolean(onStage?.envelope); // only the sheet on screen

  return (
    <Stack gap={{ base: "5", md: "6" }}>
      <ErrorAlert message={error ? readApiError(error).message : null} />
      {outbox > 0 && (
        <OfflineNotice>{tx("{n} sheet(s) kept on this tablet, sent by themselves when the connection returns.", { n: outbox })}</OfflineNotice>
      )}
      {/* The header only between participants: once someone recites, the judge sees just the sheet. */}
      {reciting ? null : onStage && !correcting ? (
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
      {showRules && !reciting && <RulesCard rules={r} />}
      {reciting && <RulesDialog open={showRules} rules={r} onClose={() => setShowRules(false)} />}

      {sealed === 0 && !onStage?.envelope && <NoEnvelopes />}

      {correcting ? (
        <PastSheet id={viewId} rules={r} onBack={() => setViewId(null)} />
      ) : !onStage ? (
        <CallNext waiting={waiting} loading={queue.loading && !queue.data} />
      ) : !onStage.envelope ? (
        <DrawCard participant={onStage} />
      ) : (
        <Sheet
          key={onStage.id}
          participant={onStage}
          rules={r}
          fill
          onRules={() => setShowRules(true)}
          finish={<FinishBar participant={onStage} judgeCount={judgeCount} next={waiting[0] ?? null} />}
          panelDone={onStage.sheetsSubmitted >= judgeCount}
        />
      )}

      {!reciting && <Recited recited={recited} viewId={viewId} onOpen={setViewId} judgeCount={judgeCount} />}
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

// After submitting: call the next participant (or end the turn), from the sheet's bottom bar.
function FinishBar({ participant: p, judgeCount, next }: { participant: StageParticipant; judgeCount: number; next: QueueParticipant | null }) {
  const [call, { loading }] = useMutation(CALL_PARTICIPANT, {
    refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }],
  });
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
    try {
      await call({ variables: { participantId: next?.id ?? null } });
      window.scrollTo({ top: 0 });
    } catch (err) {
      toaster.error({ title: readApiError(err).message });
    }
  }

  return (
    <Button
      rounded="xl"
      fontWeight="bold"
      bg={done ? "gold.400" : "whiteAlpha.200"}
      color={done ? "brand.900" : "white"}
      _hover={{ bg: done ? "gold.300" : "whiteAlpha.300" }}
      loading={loading}
      onClick={onNext}
      title={
        done
          ? tx("All {total} judges have submitted. The final score is ready.", { total: judgeCount })
          : tx("Waiting for the other judges ({n} of {total} submitted).", { n: p.sheetsSubmitted, total: judgeCount })
      }
    >
      <Lock size={15} aria-hidden />
      {next ? tx("Next participant: {name}", { name: next.fullName.split(" ")[0]! }) : tx("Finish this turn")}
    </Button>
  );
}

// The marking rules, over the sheet while someone recites.
function RulesDialog({ open, rules, onClose }: { open: boolean; rules: ScoringRules; onClose: () => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="lg" scrollBehavior="inside" placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Body p="0">
              <RulesCard rules={rules} />
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// On stage, on a screen big enough to mark without scrolling (a tablet in landscape, a laptop),
// the sheet ends at the bottom of the screen, under the app's top bar and beside its menu.
// Elsewhere (a phone, a tablet upright) `focus` is false: the page scrolls as usual.
function useFocusScreen(on: boolean) {
  const [big, setBig] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [pull, setPull] = useState(0); // how far it reaches into the page's bottom padding
  useEffect(() => {
    if (!on) return;
    const check = () => setBig(window.innerWidth >= 1024 && window.innerHeight >= 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [on]);
  const focus = on && big;
  useLayoutEffect(() => {
    if (!focus) return;
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const main = el.closest("main");
      const padding = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const bottom = Math.min(12, padding); // a small margin under the sheet, not the full padding
      setPull(padding - bottom);
      setHeight(Math.max(440, Math.floor(window.innerHeight - top - bottom)));
    };
    window.scrollTo({ top: 0 });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [focus]);
  return { focus, ref, height, pull };
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
function Sheet({
  participant,
  rules,
  fill = false,
  aside,
  onRules,
  finish,
  panelDone = false,
}: {
  participant: StageParticipant;
  rules: ScoringRules;
  fill?: boolean; // on stage: fit the screen on a tablet in landscape, nothing to scroll
  aside?: React.ReactNode; // next to the questions
  onRules?: () => void;
  finish?: React.ReactNode; // once submitted: calling the next participant
  // Every judge's sheet is in, this one not among them (e.g. refused as PANEL_COMPLETE): the score
  // is final, so this sheet is closed and the judge gets the finish bar to move the stage on.
  panelDone?: boolean;
}) {
  const texts = participant.envelope?.questions ?? [];
  const initial = participant.mySheet;
  // Marks not yet on the server are kept on the tablet (see lib/sheetOutbox): after a reload or a
  // lost connection the judge finds them back here, and they are sent by themselves.
  const key = sheetKey(useQuery(ME).data?.me?.id ?? "", participant.id);
  const [kept] = useState(() => {
    const stored = initial?.submitted ? null : readSheet(key);
    if (!stored || stored.marks.length !== texts.length) return null;
    // The server's copy changed after these marks were made (fixed from another device or tab):
    // the newer server copy wins, the old one on this tablet is dropped.
    if (stored.base !== undefined && initial && stored.base !== initial.updatedAt) {
      removeSheet(key);
      return null;
    }
    return stored;
  });
  // The server version the marks on screen build on, saved with the copy on the tablet.
  const serverAt = useRef<string | null>(kept?.base ?? initial?.updatedAt ?? null);
  const [marks, setMarks] = useState<Marks[]>(kept?.marks ?? (initial ? initial.questions.map(marksOnly) : texts.map(() => EMPTY_MARKS)));
  const [sauti, setSauti] = useState<number | null>(kept ? kept.sauti : (initial?.sauti ?? null));
  const [submitted, setSubmitted] = useState(Boolean(initial?.submitted));
  // Submit was pressed but the connection was down: it goes in by itself, the sheet is closed meanwhile.
  const [submitWaiting, setSubmitWaiting] = useState(Boolean(kept?.submit));
  // The last send found no connection ("network") or a server that did not answer ("server").
  const [offline, setOffline] = useState<"network" | "server" | null>(null);
  const [active, setActive] = useState(() => firstOpen(marks, rules));
  const [undo, setUndo] = useState<{ q: number; kind: MarkKind }[]>([]);
  const [dirty, setDirty] = useState(Boolean(kept)); // changes not yet sent
  const [reviewing, setReviewing] = useState(false); // the check before submitting
  const [error, setError] = useState<string | null>(null);
  const { focus, ref: fillRef, height: fillHeight, pull } = useFocusScreen(fill);
  const { tx } = useI18n();
  const infos = texts.map(questionInfo);
  // The three pages load now, so switching questions on stage is instant even if the network drops.
  const questionsKey = texts.join("|");
  useEffect(() => {
    preloadPages(questionsKey.split("|").flatMap((q) => questionInfo(q)?.ref ?? []));
  }, [questionsKey]);
  const [save, { loading }] = useMutation(SAVE_SHEET, {
    refetchQueries: [{ query: STAGE }],
  });
  const closed = submitted || submitWaiting || panelDone; // no more changes
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Bumped on every tap. A save only clears "dirty" if nothing changed while it was on its way.
  const version = useRef(0);
  // Saves run one after the other, so an older one can never land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());
  // The sauti the judge had given before every question was deleted (which sets it to 0).
  // Undefined when the 0 was not put there by deletion. Brought back when a question comes back.
  const sautiBeforeGone = useRef<number | null | undefined>(undefined);
  // False once this sheet is closed, so a save failing afterwards does not start retrying again.
  const mounted = useRef(true);

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
    clearTimeout(retry.current);
    if (submit) setSubmitWaiting(true);
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
              presence: null, // always given by itself now
              submit,
            },
          },
        });
        setOffline(null);
        serverAt.current = res.data?.saveSheet.updatedAt ?? serverAt.current;
        if (version.current === v) setDirty(false);
        if (res.data?.saveSheet.submitted) setSubmitted(true);
        if (submit) setSubmitWaiting(false);
      } catch (err) {
        const failure = readApiError(err);
        if (!failure.code || failure.code === "SERVER_UNAVAILABLE") {
          // No connection, or the server (or a proxy before it) is down for a moment: the sheet
          // stays on the tablet and is sent again shortly, a submission too.
          setOffline(failure.code ? "server" : "network");
          // Closed meanwhile: the copy on the tablet is sent by the desk's background sender instead.
          if (mounted.current) retry.current = setTimeout(() => void send(submit), 3000);
        } else if (failure.code === "SHEET_LOCKED") {
          // Already submitted (sent from this tablet in the background, or another tab): it is in.
          setSubmitted(true);
          setSubmitWaiting(false);
          setDirty(false);
        } else {
          setError(failure.message);
          if (submit) setSubmitWaiting(false); // refused: the judge sees why and can try again
        }
      }
    });
    return queue.current;
  }

  // Draft: save quietly a moment after the last tap, so nothing is lost if the tablet dies.
  const autosave = useEffectEvent(() => void send(false));
  useEffect(() => {
    if (!dirty || closed) return;
    timer.current = setTimeout(() => autosave(), 800);
    return () => clearTimeout(timer.current);
  }, [dirty, closed, marks, sauti]);

  // On the tablet: every change until the server has it; gone once it does.
  useEffect(() => {
    if (submitted || (!dirty && !submitWaiting)) removeSheet(key);
    else writeSheet(key, { marks, sauti, submit: submitWaiting, base: serverAt.current });
  }, [key, marks, sauti, dirty, submitWaiting, submitted]);

  // This sheet sends itself; the desk's background sender leaves it alone while it is open.
  // A submission still waiting from before (the tablet was reloaded) goes in now.
  const resume = useEffectEvent(() => {
    if (kept?.submit) void send(true);
  });
  useEffect(() => {
    mounted.current = true;
    openSheets.add(key);
    resume();
    return () => {
      mounted.current = false;
      openSheets.delete(key);
      clearTimeout(retry.current);
    };
  }, [key]);

  // The connection is back: send at once instead of waiting for the next try.
  const reconnected = useEffectEvent(() => {
    if (submitWaiting) void send(true);
    else if (dirty && !submitted) void send(false);
  });
  useEffect(() => {
    const onOnline = () => reconnected();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  function change(q: number, kind: MarkKind, by: 1 | -1) {
    if (closed) return; // final, or waiting to be submitted
    const current = marks[q]!;
    if (by === -1 && current[kind] === 0) return;
    if (by === 1 && current.fath >= rules.fathLimit) return; // question already deleted
    const next = marks.map((m, i) => (i === q ? { ...m, [kind]: m[kind] + by } : m));
    setMarks(next);
    keepSauti(next);
    touch();
    if (by === 1) {
      setUndo((u) => [...u, { q, kind }]);
      // The 3rd Fath deletes the question: move on to the next one, as on paper.
      if (kind === "fath" && next[q]!.fath >= rules.fathLimit && q < texts.length - 1) setActive(q + 1);
    }
  }

  // Every question deleted: no sauti to give (it would add nothing), so it is set to 0 and the sheet
  // can be submitted. A question coming back (undo, take one back) brings the judge's sauti back.
  function keepSauti(next: Marks[]) {
    const gone = next.every((m) => m.fath >= rules.fathLimit);
    if (gone && sautiBeforeGone.current === undefined) {
      sautiBeforeGone.current = sauti;
      setSauti(0);
    } else if (!gone && sautiBeforeGone.current !== undefined) {
      setSauti(sautiBeforeGone.current);
      sautiBeforeGone.current = undefined;
    }
  }

  function undoLast() {
    const last = undo.at(-1);
    if (!last || closed) return;
    setUndo((u) => u.slice(0, -1));
    const next = marks.map((m, i) => (i === last.q ? { ...m, [last.kind]: Math.max(0, m[last.kind] - 1) } : m));
    setMarks(next);
    keepSauti(next);
    setActive(last.q);
    touch();
  }

  const q = marks[active]!;
  const deleted = q.fath >= rules.fathLimit;
  // The sauti is shared by the questions, a third each; a deleted question gets none of it.
  const live = marks.filter((m) => m.fath < rules.fathLimit).length;
  const allGone = live === 0;
  const sautiAdds = sauti === null ? null : round((sauti * live) / rules.questions);

  // 1. Who, which question, the panel.
  const top = (
    <Flex align="center" gap={{ base: "2", md: "3" }} wrap={{ base: "wrap", lg: "nowrap" }} flexShrink={0}>
      <Flex align="center" gap="2.5" minW="0" maxW={{ lg: "60" }} flexShrink={0}>
        <ParticipantPhoto path={participant.photoUrl} size="thumb" />
        <Box minW="0">
          <Text fontWeight="bold" color="brand.900" lineHeight="1.2" truncate>
            {participant.fullName}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {participant.envelope ? tx("Envelope {n}", { n: participant.envelope.number }) : ""}
          </Text>
        </Box>
      </Flex>

      <Flex role="tablist" gap="2" flex="1" minW={{ base: "full", lg: "0" }} order={{ base: 3, lg: 0 }}>
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
              flex="1"
              minW="0"
              display="flex"
              alignItems="center"
              gap="2"
              px="2.5"
              py="1.5"
              rounded="xl"
              textAlign="left"
              cursor="pointer"
              bg={on ? NAVY_GRADIENT : gone ? "red.50" : "white"}
              color={on ? "white" : "brand.900"}
              borderWidth="1px"
              borderColor={on ? "gold.400" : gone ? "red.200" : "border"}
              boxShadow={on ? "0 6px 16px rgba(26,35,78,0.28)" : undefined}
              transition="background 0.2s, box-shadow 0.2s"
              _hover={on ? undefined : { borderColor: gone ? "red.300" : "brand.200" }}
              _focusVisible={{ outline: "3px solid", outlineColor: "gold.400", outlineOffset: "2px" }}
            >
              <Circle size="7" flexShrink={0} fontWeight="bold" fontSize="sm" bg={on ? "gold.400" : gone ? "red.500" : "brand.50"} color={on ? "brand.900" : gone ? "white" : "brand.700"}>
                {i + 1}
              </Circle>
              <Box minW="0">
                <Text fontSize="sm" fontWeight="semibold" lineHeight="1.2" truncate textDecoration={gone ? "line-through" : undefined}>
                  {questionLabel(text)}
                </Text>
                <Text fontSize="2xs" color={on ? "whiteAlpha.700" : gone ? "red.600" : "fg.muted"} truncate>
                  {gone ? tx("Deleted · 0") : infos[i] ? tx("Page {n}", { n: infos[i]!.page }) : ""}
                </Text>
              </Box>
            </chakra.button>
          );
        })}
      </Flex>

      <Flex align="center" gap="2" ms={{ base: "auto", lg: "0" }} flexShrink={0}>
        {aside}
        {onRules && (
          <IconButton size="sm" variant="outline" colorPalette="brand" bg="white" aria-label={tx("Marking rules")} title={tx("Marking rules")} onClick={onRules}>
            <BookOpen size={16} />
          </IconButton>
        )}
      </Flex>
    </Flex>
  );

  // 2. The mistakes in this question: one tap each time it happens.
  const cards = (
    // Beside the book: tiles two by two, growing into the free height of the column (never smaller
    // than what they show), so they are big targets while the sauti and submitting stay in view.
    <SimpleGrid columns={focus ? 2 : { base: 2, md: 4 }} gap={focus ? "2.5" : "2"} flex={focus ? "1 0 auto" : undefined} flexShrink={0} gridAutoRows={focus ? "1fr" : undefined}>
      {MARK_TYPES.map((mark) => (
        <MarkCard
          key={mark.kind}
          mark={mark}
          penalty={mark.penalty(rules)}
          count={q[mark.kind]}
          limit={mark.kind === "fath" ? rules.fathLimit : undefined}
          locked={deleted && mark.kind !== "fath"}
          addDisabled={deleted || closed}
          readOnly={closed}
          tile={focus}
          onAdd={() => change(active, mark.kind, 1)}
          onRemove={() => change(active, mark.kind, -1)}
        />
      ))}
    </SimpleGrid>
  );
  const deletedNote = deleted && (
    <Flex align="center" gap="3" px="3" py="2" rounded="xl" bg="red.50" borderWidth="1px" borderColor="red.200" flexShrink={0} wrap="wrap">
      <Text fontSize="sm" fontWeight="semibold" color="red.700" flex="1">
        {tx("Deleted: {n} reminders", { n: rules.fathLimit })}
      </Text>
      {active < texts.length - 1 && (
        <Button size="xs" colorPalette="brand" onClick={() => setActive(active + 1)}>
          {tx("Go to question {n}", { n: active + 2 })}
        </Button>
      )}
    </Flex>
  );

  // 3. The mushaf, open at the question.
  const book = infos[active] && <MushafPage key={texts[active]} start={infos[active]!.ref} maxH={focus ? "100%" : "80vh"} />;

  const notices = (error || offline) && (
    <Box flexShrink={0}>
      <ErrorAlert message={error} />
      {offline && (
        <OfflineNotice>
          {offline === "server"
            ? submitWaiting
              ? tx("The server is not answering. Your sheet is kept on this tablet and will be submitted by itself as soon as it answers.")
              : tx("The server is not answering. Keep marking: your marks are kept on this tablet and sent again by themselves.")
            : submitWaiting
              ? tx("No connection. Your sheet is kept on this tablet and will be submitted by itself when the connection returns.")
              : tx("No connection. Keep marking: your marks are kept on this tablet and sent by themselves when the connection returns.")}
        </OfflineNotice>
      )}
    </Box>
  );

  // 4. Sauti once at the end, the total, and submitting.
  const sautiLabel = (
    <Flex align="center" gap="2" flexShrink={0}>
      <Mic size={18} color="#E2C06A" aria-hidden />
      <Text fontWeight="semibold" whiteSpace="nowrap">
        <MarkName mark={SAUTI} />
      </Text>
    </Flex>
  );
  // What the sauti really adds, so the judge never thinks a 5 gives 5 points when questions are deleted.
  const sautiNote = (
    <Text fontSize="xs" color={live < texts.length ? "gold.200" : "whiteAlpha.700"} flexBasis={focus ? undefined : "full"}>
      {allGone
        ? tx("All questions deleted: no sauti.")
        : sautiAdds === null
          ? live < texts.length
            ? tx("Sauti counts only for the {live} question(s) not deleted.", { live })
            : tx("Sauti is shared by the {n} questions.", { n: texts.length })
          : tx("Sauti adds {pts} points ({live} of {n} questions)", { pts: sautiAdds, live, n: texts.length })}
    </Text>
  );
  const sautiButtons = (
    <Flex gap="1.5" role="radiogroup" aria-label="Sauti" justify={focus ? "space-between" : undefined}>
      {Array.from({ length: rules.sautiMax + 1 }, (_, v) => {
        const on = sauti === v;
        return (
          <chakra.button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={closed || allGone}
            onClick={() => {
              setSauti(v);
              touch();
            }}
            w={focus ? "9" : "10"}
            h={focus ? "9" : "10"}
            rounded="full"
            fontWeight="bold"
            cursor="pointer"
            bg={on ? "gold.400" : "whiteAlpha.100"}
            color={on ? "brand.900" : "white"}
            borderWidth="1px"
            borderColor={on ? "gold.300" : "whiteAlpha.300"}
            transition="all 0.15s"
            _hover={on || closed ? undefined : { bg: "whiteAlpha.200" }}
            _disabled={{ cursor: "default", opacity: on ? 1 : 0.45 }}
            _focusVisible={{ outline: "3px solid", outlineColor: "gold.400", outlineOffset: "2px" }}
          >
            {v}
          </chakra.button>
        );
      })}
    </Flex>
  );
  const status = (
    <Text fontSize="xs" color="whiteAlpha.700" lineClamp={1} minW="0" textAlign={focus ? "end" : undefined}>
      {submitted
        ? tx("Submitted")
        : submitWaiting
          ? offline === "server"
            ? tx("Waiting for the server to submit.")
            : tx("Waiting for the connection to submit.")
          : loading
            ? tx("Saving draft…")
            : dirty
              ? tx("Draft…")
              : tx("Draft saved")}
    </Text>
  );
  const undoButton = !closed && (
    <IconButton size="sm" variant="ghost" color="whiteAlpha.800" _hover={{ bg: "whiteAlpha.200", color: "white" }} aria-label={tx("Undo last mark")} title={tx("Undo last mark")} disabled={undo.length === 0} onClick={undoLast}>
      <Undo2 size={16} />
    </IconButton>
  );
  const submitArea = panelDone && !submitted ? (
    <Stack gap="2">
      <Text fontSize="xs" color="whiteAlpha.800">
        {tx("Every judge has submitted: the score is final. You can call the next participant.")}
      </Text>
      {finish}
    </Stack>
  ) : submitted ? (
    (finish ?? (
      <Flex align="center" justify="center" gap="2" px="3" py="2" rounded="xl" bg="green.500/20" borderWidth="1px" borderColor="green.400/60" color="green.100" fontWeight="bold">
        <Lock size={15} aria-hidden />
        {tx("Submitted")}
      </Flex>
    ))
  ) : submitWaiting ? (
    <Flex align="center" justify="center" gap="2" px="3" py="2" rounded="xl" bg="orange.500/20" borderWidth="1px" borderColor="orange.300/60" color="orange.100" fontWeight="bold">
      <CloudOff size={15} aria-hidden />
      {tx("Submitting…")}
    </Flex>
  ) : (
    <Button
      rounded="xl"
      fontWeight="bold"
      bg={sauti === null ? "whiteAlpha.200" : "gold.400"}
      color={sauti === null ? "whiteAlpha.800" : "brand.900"}
      _hover={{ bg: sauti === null ? "whiteAlpha.200" : "gold.300" }}
      _disabled={{ opacity: 1, cursor: "not-allowed" }}
      disabled={sauti === null}
      loading={loading}
      onClick={() => setReviewing(true)}
    >
      {sauti === null ? <Mic size={16} aria-hidden /> : <CircleCheck size={18} aria-hidden />}
      {sauti === null ? tx("Give the sauti first") : tx("Check and submit")}
    </Button>
  );

  const review = (
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
  );

  // While reciting, on a tablet in landscape or a laptop: nothing to scroll. The mushaf takes the
  // whole height; marking, the sauti and submitting are beside it.
  if (focus) {
    return (
      <Box ref={fillRef} h={fillHeight ? `${fillHeight}px` : undefined} mb={pull ? `-${pull}px` : undefined}>
        <Flex direction="column" h="full" gap="3">
          {top}
          <Flex flex="1" minH="0" gap="3">
            <Box flex="1" minW="0" h="full">
              {book}
            </Box>
            <Flex direction="column" w={{ base: "96", xl: "28rem", "2xl": "32rem" }} flexShrink={0} gap="2.5" minH="0" overflowY="auto">
              {cards}
              {deletedNote}
              {notices}
              <Stack gap="2" p="3" mt="auto" rounded="2xl" bg={NAVY_GRADIENT} color="white" flexShrink={0}>
                <Flex align="center" justify="space-between" gap="2">
                  {sautiLabel}
                  {status}
                </Flex>
                {sautiButtons}
                {sautiNote}
                <Flex align="flex-end" gap="3" pt="2" borderTopWidth="1px" borderColor="whiteAlpha.200">
                  <Box flex="1" minW="0">
                    <ScoreTotal total={total} compact />
                  </Box>
                  {undoButton}
                </Flex>
                {submitArea}
              </Stack>
            </Flex>
          </Flex>
        </Flex>
        {review}
      </Box>
    );
  }

  // A phone, a tablet upright, or a past sheet: one column, the page scrolls.
  return (
    <Flex direction="column" gap="3">
      {top}
      {cards}
      {deletedNote}
      {book}
      {notices}
      <Flex align="center" gap={{ base: "3", md: "4" }} wrap="wrap" px={{ base: "3", md: "4" }} py="1.5" rounded="2xl" bg={NAVY_GRADIENT} color="white" flexShrink={0}>
        <Flex align="center" gap="2.5" minW="0" wrap="wrap">
          {sautiLabel}
          {sautiButtons}
          {sautiNote}
        </Flex>
        <Flex align="center" gap="3" ms="auto" minW="0">
          {undoButton}
          <ScoreTotal total={total} compact />
          {submitArea}
        </Flex>
      </Flex>
      {review}
    </Flex>
  );
}

// Sheets left on the tablet (lost connection, then the judge moved on or reloaded): sent in the
// background, when the desk opens, when the connection returns, and every 15 seconds.
// `onScreen`: the participants whose sheet the desk shows (they send themselves), or null while the
// desk does not know yet; nothing is sent until it does, so a sheet is never sent twice at once.
// Returns how many are still waiting.
function useSheetOutbox(onScreen: (string | null)[] | null) {
  const client = useApolloClient();
  const judgeId = useQuery(ME).data?.me?.id ?? "";
  const [waiting, setWaiting] = useState(0);
  const ready = onScreen !== null;
  const skip = useRef<(string | null)[]>([]);
  useEffect(() => {
    skip.current = onScreen ?? [];
  });

  useEffect(() => {
    if (!judgeId || !ready) return;
    let busy = false;
    const flush = async () => {
      if (busy) return;
      busy = true;
      try {
        for (const { key, participantId, sheet } of waitingSheets(judgeId)) {
          if (openSheets.has(key) || skip.current.includes(participantId)) continue; // on screen: it sends itself
          try {
            await client.mutate({
              mutation: SAVE_SHEET,
              variables: { input: { participantId, questions: sheet.marks, sauti: sheet.sauti, presence: null, submit: sheet.submit } },
            });
            removeSheet(key);
          } catch (err) {
            // Only a final answer (already in, or can never go in) ends it. A login that ran out or a
            // busy server keeps the marks on the tablet: they go once the judge is logged in again.
            if (isFinalAnswer(readApiError(err).code)) removeSheet(key);
          }
        }
      } finally {
        busy = false;
        setWaiting(waitingSheets(judgeId).filter((w) => !openSheets.has(w.key) && !skip.current.includes(w.participantId)).length);
      }
    };
    void flush();
    const timer = setInterval(() => void flush(), 15_000);
    window.addEventListener("online", flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", flush);
    };
  }, [client, judgeId, ready]);

  return waiting;
}

function OfflineNotice({ children }: { children: React.ReactNode }) {
  return (
    <Flex align="center" gap="3" px="4" py="3" rounded="xl" bg="orange.50" borderWidth="1px" borderColor="orange.200" color="orange.900" role="status">
      <CloudOff size={18} aria-hidden style={{ flexShrink: 0 }} />
      <Text fontSize="sm" fontWeight="medium">
        {children}
      </Text>
    </Flex>
  );
}

// The judge's total out of 100, in a gold ring.
// The judge's total: a large number out of 100, a slim gold bar filling up to it.
// Before the sauti is given there is no total yet: a dash and an empty bar.
function ScoreTotal({ total, compact = false }: { total: number | null; compact?: boolean }) {
  const { tx } = useI18n();
  const part = total === null ? 0 : Math.max(0, Math.min(total / 100, 1));
  return (
    <Box minW={compact ? "24" : undefined} aria-live="polite">
      <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.14em" textTransform="uppercase" color="gold.300">
        {tx("Your total")}
      </Text>
      <Flex align="baseline" gap="1" mt="0.5">
        <Text fontSize={compact ? "2xl" : "3xl"} fontWeight="bold" lineHeight="1" fontVariantNumeric="tabular-nums" color={total === null ? "whiteAlpha.500" : "white"}>
          {total ?? "—"}
        </Text>
        <Text fontSize="sm" color="whiteAlpha.600">
          / 100
        </Text>
      </Flex>
      <Box h="1" mt="1.5" rounded="full" bg="whiteAlpha.200" overflow="hidden">
        <Box h="full" w={`${part * 100}%`} rounded="full" bg="linear-gradient(90deg, #C99A35, #F3DB98)" transition="width 0.4s ease" />
      </Box>
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
  tile = false,
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
  // Beside the book (a narrow column): a small tile, two side by side.
  tile?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { tx } = useI18n();
  const c = mark.palette;
  const lost = round(count * penalty);
  const hit = count > 0;
  const sign = (
    <Circle
      size={tile ? "12" : "10"}
      flexShrink={0}
      fontWeight="bold"
      fontSize={tile ? "xl" : "lg"}
      bg={hit ? `${c}.500` : `${c}.50`}
      color={hit ? "white" : `${c}.600`}
      transition="background 0.2s, color 0.2s"
      aria-hidden
    >
      {mark.sign}
    </Circle>
  );
  const name = (
    <Box minW="0" flex="1">
      <Text fontFamily="display" fontSize={tile ? "lg" : "md"} fontWeight="semibold" color="brand.900" lineHeight="1.2" lineClamp={2} title={`${mark.arabic} (${mark.swahili})`}>
        <MarkName mark={mark} big />
      </Text>
      {/* What one costs; once tapped, what it cost in all. */}
      <Text fontSize={tile ? "sm" : "xs"} fontWeight="semibold" color={`${c}.600`} mt="0.5" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
        {hit ? tx("−{n} points", { n: lost }) : tx("−{n} each", { n: penalty })}
      </Text>
    </Box>
  );
  return (
    <Flex
      direction={tile ? "column" : "row"}
      position="relative"
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
        title={tx(mark.hint)}
        display="flex"
        flexDirection={tile ? "column" : "row"}
        alignItems={tile ? "stretch" : "center"}
        justifyContent={tile ? "center" : undefined}
        gap={tile ? "2" : "3"}
        flex="1"
        minW="0"
        px={tile ? "4" : "3"}
        py={tile ? "3.5" : "2.5"}
        textAlign="left"
        cursor="pointer"
        userSelect="none"
        transition="transform 0.08s"
        _hover={{ bg: hit ? undefined : "bg.subtle" }}
        _active={{ transform: "scale(0.98)" }}
        _disabled={{ cursor: readOnly ? "default" : "not-allowed", _hover: { bg: "transparent" }, _active: { transform: "none" } }}
        _focusVisible={{ outline: "3px solid", outlineColor: `${c}.400`, outlineOffset: "-3px" }}
      >
        {tile ? (
          <>
            <Flex align="center" justify="space-between" gap="2">
              {sign}
              <CountRing count={count} limit={limit} color={c} />
            </Flex>
            {name}
          </>
        ) : (
          <>
            {sign}
            {name}
            <CountRing count={count} limit={limit} color={c} />
          </>
        )}
      </chakra.button>

      {/* Taking back a wrong tap */}
      {hit && !readOnly && (
        <chakra.button
          type="button"
          onClick={onRemove}
          disabled={!hit}
          aria-label={tx("Remove one {name}", { name: mark.name })}
          title={tx("Take one back")}
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap="1"
          w="10"
          h={tile ? "10" : undefined}
          flexShrink={0}
          cursor="pointer"
          color={`${c}.700`}
          {...(tile
            ? { position: "absolute" as const, bottom: "1.5", right: "1.5", rounded: "full", bg: "white", borderWidth: "1px", boxShadow: "sm" }
            : { borderStartWidth: "1px" })}
          borderColor={`${c}.200`}
          _hover={{ bg: `${c}.100` }}
          _focusVisible={{ outline: "3px solid", outlineColor: `${c}.400`, outlineOffset: "-3px" }}
        >
          <Undo2 size={16} aria-hidden />
        </chakra.button>
      )}
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
                              <MarkName mark={t} />
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
                    <MarkName mark={SAUTI} /> {sauti ?? "—"} / {rules.sautiMax}
                    {sauti !== null &&
                      ` → ${tx("+{pts} ({live} of {n} questions)", {
                        pts: round((sauti * marks.filter((m) => m.fath < rules.fathLimit).length) / rules.questions),
                        live: marks.filter((m) => m.fath < rules.fathLimit).length,
                        n: marks.length,
                      })}`}{" "}
                    · {tx("Presence")} +{rules.presencePoints}
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
function Recited({
  recited,
  viewId,
  onOpen,
  judgeCount,
}: {
  recited: QueueParticipant[];
  viewId: string | null;
  onOpen: (id: string | null) => void;
  judgeCount: number;
}) {
  const { tx } = useI18n();
  // Called back on stage: their turn was ended (by mistake) before every judge had submitted.
  const [call, { loading: calling }] = useMutation(CALL_PARTICIPANT, {
    refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }],
  });
  const [callingId, setCallingId] = useState<string | null>(null);
  async function callBack(p: QueueParticipant) {
    if (!(await confirmDialog({ message: tx("Call {name} back on stage? Only {n} of {total} judges have submitted.", { name: p.fullName, n: p.sheetsSubmitted, total: judgeCount }) }))) return;
    setCallingId(p.id);
    try {
      await call({ variables: { participantId: p.id } });
      window.scrollTo({ top: 0 });
    } catch (err) {
      toaster.error({ title: readApiError(err).message });
    } finally {
      setCallingId(null);
    }
  }
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
              {p.sheetsSubmitted < judgeCount && (
                <Button size="sm" variant="outline" colorPalette="orange" loading={calling && callingId === p.id} disabled={calling} onClick={() => void callBack(p)}>
                  {tx("Call back")}
                </Button>
              )}
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
