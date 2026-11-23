"use client";

import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, chakra, Circle, CloseButton, Dialog, Flex, Heading, IconButton, Link, Portal, SimpleGrid, Spinner, Stack, Text } from "@chakra-ui/react";
import { ArrowLeft, BookOpen, Cake, Check, ChevronRight, CircleCheck, CircleX, Download, Trophy, CloudOff, Crown, GraduationCap, Mail, Lock, MapPin, Mic, MonitorSmartphone, Pencil, TriangleAlert, Undo2, User, UserRoundCheck } from "lucide-react";
import NextLink from "next/link";
import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ExportResultsButton } from "@/components/ExportResultsButton";
import { FinalResults } from "@/components/FinalResults";
import { rankParticipants, ResultSections } from "@/components/RankingTable";
import { ErrorAlert } from "@/components/ErrorAlert";
import { toaster } from "@/components/Toaster";
import { ageOf, NAVY_GRADIENT, ParticipantInfo, RulesCard } from "@/components/JudgingParts";
import { StarLattice } from "@/components/brand/Octagram";
import { MushafPage, preloadPages } from "@/components/MushafPage";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { questionInfo, questionLabel } from "@/lib/quran/label";
import { readApiError, type MarkDifference } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { isFinalAnswer, openSheets, readSheet, removeSheet, sheetKey, waitingSheets, writeSheet } from "@/lib/sheetOutbox";
import { EMPTY_MARKS, hasMarks, MARK_TYPES, marksOnly, SAUTI, type MarkKind, type MarkType } from "@/lib/marks";
import { MarkName } from "@/components/MarkName";
import {
  CALL_PARTICIPANT,
  DRAW_ENVELOPE,
  ENVELOPE_SLOTS,
  ENVELOPES,
  FINISH_QUESTION,
  JUDGING_PARTICIPANT,
  SAVE_SHEET,
  SCORING_RULES,
  STAGE,
  STAGE_QUEUE,
  byPassageOrder,
  questionScore,
  sheetTotal,
  type Marks,
  type QueueParticipant,
  type Round,
  type ScoringRules,
  type StageParticipant,
} from "@/lib/graphql/judging";
import { PARTICIPANT_COUNTS } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

// The judge's desk, the whole competition on one screen:
// 1. call the next participant, 2. hand them the tablet to pick an envelope, 3. listen and mark
// your own sheet, 4. call the next one. Every judge's screen follows the same stage live.
// With a chief judge, only they call participants (and send them back or end a turn); the other
// judges see who will. No chief judge: every judge may call.
const CallRights = createContext<{ canCall: boolean; chief: string | null }>({ canCall: true, chief: null });
// The round on stage: every sheet opened on the desk belongs to it.
const StageRound = createContext<Round>("TASFIA");

export function JudgingDesk() {
  const stage = useQuery(STAGE);
  const me = useQuery(ME);
  const rules = useQuery(SCORING_RULES);
  const queue = useQuery(STAGE_QUEUE);
  const envelopes = useQuery(ENVELOPES);
  const counts = useQuery(PARTICIPANT_COUNTS);
  const [viewId, setViewId] = useState<string | null>(null); // a past participant, to see your sheet
  const [showRules, setShowRules] = useState(false);
  const { tx } = useI18n();
  const outbox = useSheetOutbox(stage.data ? [stage.data.stage.participant?.id ?? null, viewId] : null);

  const onStage = stage.data?.stage.participant ?? null;
  // The tasfia, then the final once the admin starts it: only the finalists, only final envelopes.
  const round = stage.data?.stage.round ?? "TASFIA";
  const final = round === "FINAL";
  const judgeCount = counts.data?.settings.judgeCount ?? 4;
  const chiefId = counts.data?.settings.chiefJudgeId ?? null;
  const rights = useMemo(
    () => ({ canCall: !chiefId || chiefId === me.data?.me?.id, chief: counts.data?.settings.chiefJudgeName ?? null }),
    [chiefId, me.data, counts.data],
  );
  // The order of passage: the admin's numbers (N° 1 first), the unnumbered after by registration.
  const all = useMemo(
    () => byPassageOrder((queue.data?.participants ?? []).filter((p) => round === "TASFIA" || p.inFinal)),
    [queue.data, round],
  );
  const waiting = all.filter((p) => !p.envelope && p.id !== onStage?.id);
  const recited = all.filter((p) => p.envelope && p.id !== onStage?.id);
  const sealed = envelopes.data ? envelopes.data.envelopes.filter((e) => !e.used && e.round === round).length : undefined;

  const error = stage.error ?? rules.error ?? queue.error;
  // A failed reload keeps what was loaded: the open sheet (and its unsaved taps) must never be
  // swapped for an error. The error replaces the page only when nothing could be loaded at all.
  if (!rules.data || !stage.data) return error ? <ErrorAlert message={readApiError(error).message} /> : <Text color="fg.muted">{tx("Loading…")}</Text>;
  const r = rules.data.scoringRules;

  const correcting = viewId && viewId !== onStage?.id;
  // Everyone has recited and the last one on stage has every judge's sheet: the competition is
  // over. The desk then shows the results instead of the last participant's sheet (they stay
  // "on stage" until someone is called, which nobody will be).
  const finished =
    queue.data !== undefined &&
    counts.data !== undefined && // the panel size, not a guess
    all.length > 0 &&
    waiting.length === 0 &&
    // A turn ended "anyway" before every judge submitted leaves that participant without a final
    // score: not finished until they are called back and every sheet is in.
    recited.every((p) => p.sheetsSubmitted >= judgeCount) &&
    (!onStage || (Boolean(onStage.envelope) && onStage.sheetsSubmitted >= judgeCount));
  const reciting = !correcting && !finished && Boolean(onStage?.envelope); // only the sheet on screen

  return (
    <CallRights.Provider value={rights}>
    <StageRound.Provider value={round}>
    <Stack gap={{ base: "5", md: "6" }}>
      <ErrorAlert message={error ? readApiError(error).message : null} />
      {outbox > 0 && (
        <OfflineNotice>{tx("{n} sheet(s) kept on this tablet, sent by themselves when the connection returns.", { n: outbox })}</OfflineNotice>
      )}
      {/* The header only between participants: once someone recites, the judge sees just the sheet. */}
      {reciting ? null : onStage && !correcting && !finished ? (
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
          final={final}
        />
      )}
      {showRules && !reciting && <RulesCard rules={r} />}
      {reciting && <RulesDialog open={showRules} rules={r} onClose={() => setShowRules(false)} />}

      {sealed === 0 && !onStage?.envelope && !finished && <NoEnvelopes final={final} />}

      {correcting ? (
        <PastSheet id={viewId} rules={r} onBack={() => setViewId(null)} />
      ) : finished && final ? (
        <FinalDone participants={all} maxScore={counts.data?.settings.maxScore ?? 100} />
      ) : finished ? (
        <CompetitionDone participants={all} settings={counts.data?.settings ?? null} />
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

      {!reciting && (
        <Recited
          // Finished: the last participant (still "on stage") is with the others, to look back at.
          recited={finished && onStage ? all.filter((p) => p.envelope) : recited}
          viewId={viewId}
          onOpen={setViewId}
          judgeCount={judgeCount}
          final={final}
        />
      )}
    </Stack>
    </StageRound.Provider>
    </CallRights.Provider>
  );
}

// For the judges who do not call: who calls the participants.
function ChiefCalls({ dark = false }: { dark?: boolean }) {
  const { chief } = useContext(CallRights);
  const { tx } = useI18n();
  return (
    <Flex
      align="center"
      gap="2"
      px="3.5"
      py="2"
      rounded="xl"
      bg={dark ? "whiteAlpha.100" : "gold.50"}
      borderWidth="1px"
      borderColor={dark ? "gold.400/50" : "gold.200"}
      color={dark ? "gold.200" : "gold.800"}
      fontSize="sm"
      fontWeight="medium"
    >
      <Crown size={16} aria-hidden />
      <Text>{chief ? tx("{name}, the chief judge, calls the participants.", { name: chief }) : tx("The chief judge calls the participants.")}</Text>
    </Flex>
  );
}

// Every participant has recited and every panel is complete: the final results, best first,
// as on the Ranking page. The judge's own sheets stay below (Recited) to look back at.
function CompetitionDone({
  participants,
  settings,
}: {
  participants: QueueParticipant[];
  settings: { passMark: number; maxScore: number; finalistCount: number } | null;
}) {
  const { tx } = useI18n();
  const maxScore = settings?.maxScore ?? 100;
  const rows = rankParticipants(participants);
  const passed = rows.filter((r) => r.p.status === "PASSED");
  const failed = rows.filter((r) => r.p.status !== "PASSED");
  // Only the best of those who passed go to the final (the server picks them: the top
  // `finalistCount`, ties by name).
  const finalists = passed.filter((r) => r.p.finalist);
  const hasFinal = (settings?.finalistCount ?? 0) > 0;

  return (
    <Stack gap={{ base: "5", md: "6" }}>
      <Box position="relative" overflow="hidden" rounded="2xl" bg={NAVY_GRADIENT} color="white" px={{ base: "5", md: "7" }} py={{ base: "5", md: "6" }}>
        <Box position="absolute" insetY="0" right="0" w={{ base: "full", md: "50%" }} aria-hidden>
          <StarLattice color="#F9971D" opacity={0.18} />
        </Box>
        <Flex position="relative" align="center" gap="4" wrap="wrap">
          <Circle size="14" flexShrink={0} bg="linear-gradient(160deg, #FDD199 0%, #F9971D 100%)" color="brand.900" boxShadow="0 0 36px rgba(251,183,94,0.4)">
            <Trophy size={26} aria-hidden />
          </Circle>
          <Box flex="1" minW="0">
            <Heading fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }} lineHeight="1.15">
              {tx("The competition is finished")}
            </Heading>
            <Text color="whiteAlpha.800" fontSize="sm" mt="1">
              {tx("Every participant has recited and every judge has submitted. Here are the final results.")}
            </Text>
          </Box>
          <ExportResultsButton file="ranking" colorPalette="gold" color="brand.900" disabled={rows.length === 0}>
            <Download size={16} aria-hidden />
            {tx("Ranking PDF")}
          </ExportResultsButton>
        </Flex>
        <Flex position="relative" gap={{ base: "5", md: "8" }} mt="5" wrap="wrap">
          {[
            { label: tx("Judged"), value: rows.length },
            ...(hasFinal ? [{ label: tx("Go to the final"), value: finalists.length }] : []),
            { label: tx("Passed"), value: passed.length },
            { label: tx("Did not pass"), value: failed.length },
            ...(settings ? [{ label: tx("Pass mark"), value: `${settings.passMark} / ${maxScore}` }] : []),
          ].map((s) => (
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

      <ResultSections rows={rows} maxScore={maxScore} finalistCount={settings?.finalistCount ?? 0} />
    </Stack>
  );
}

// Every finalist has recited and every panel is complete: the final's ranking, the winner first.
function FinalDone({ participants, maxScore }: { participants: QueueParticipant[]; maxScore: number }) {
  const { tx } = useI18n();
  return (
    <Stack gap={{ base: "5", md: "6" }}>
      <Box position="relative" overflow="hidden" rounded="2xl" bg={NAVY_GRADIENT} color="white" px={{ base: "5", md: "7" }} py={{ base: "5", md: "6" }}>
        <Box position="absolute" insetY="0" right="0" w={{ base: "full", md: "50%" }} aria-hidden>
          <StarLattice color="#F9971D" opacity={0.18} />
        </Box>
        <Flex position="relative" align="center" gap="4" wrap="wrap">
          <Circle size="14" flexShrink={0} bg="linear-gradient(160deg, #FDD199 0%, #F9971D 100%)" color="brand.900" boxShadow="0 0 36px rgba(251,183,94,0.4)">
            <Trophy size={26} aria-hidden />
          </Circle>
          <Box flex="1" minW="0">
            <Heading fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }} lineHeight="1.15">
              {tx("The final is finished")}
            </Heading>
            <Text color="whiteAlpha.800" fontSize="sm" mt="1">
              {tx("Every finalist has recited and every judge's sheet is in. Here is the final ranking.")}
            </Text>
          </Box>
        </Flex>
      </Box>
      <FinalResults participants={participants} maxScore={maxScore} />
    </Stack>
  );
}

function DeskHeader({
  stats,
  showRules,
  onRules,
  final = false,
}: {
  stats: { label: string; value: number | string }[];
  showRules: boolean;
  onRules: () => void;
  final?: boolean;
}) {
  const { tx } = useI18n();
  return (
    <Box rounded="2xl" bg={NAVY_GRADIENT} color="white" px={{ base: "5", md: "7" }} py={{ base: "5", md: "6" }}>
      <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
        <Box>
          <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.18em" textTransform="uppercase" color="gold.300">
            {tx("Judging desk")}
          </Text>
          <Flex align="center" gap="3" wrap="wrap">
            <Heading fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }}>
              Musabaqa
            </Heading>
            <Badge colorPalette={final ? "orange" : "teal"} variant="solid" size="md">
              {final ? tx("Final") : tx("Tasfia")}
            </Badge>
          </Flex>
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

function NoEnvelopes({ final = false }: { final?: boolean }) {
  const { tx } = useI18n();
  return (
    <Flex gap="3" align="center" p="4" rounded="xl" bg="orange.50" borderWidth="1px" borderColor="orange.200" wrap="wrap">
      <Box color="orange.600">
        <TriangleAlert size={20} aria-hidden />
      </Box>
      <Text flex="1" minW="48" color="orange.900" fontSize="sm">
        <b>{final ? tx("No final envelope is ready.") : tx("No envelope is ready.")}</b>{" "}
        {final
          ? tx("Ask the admin to prepare the final envelopes (3 questions, half a page each) before calling a finalist.")
          : tx("Ask the admin to prepare the envelopes (3 questions each) before calling a participant.")}
      </Text>
    </Flex>
  );
}

// Step 1: nobody on stage. The next in line is shown big; anyone in the list can be called.
function CallNext({ waiting, loading }: { waiting: QueueParticipant[]; loading: boolean }) {
  const [call, { loading: calling }] = useMutation(CALL_PARTICIPANT, {
    refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }],
  });
  const [callingId, setCallingId] = useState<string | null>(null); // only that button spins
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const { canCall } = useContext(CallRights);
  // In the order of passage (the admin's numbers): the first one waiting is called next.
  // If they are not here, the judge calls someone further down; the absent one stays on this
  // list and can be called when they arrive.
  const next = waiting[0];
  const after = waiting[1];
  const rest = waiting.slice(1);

  async function onCall(id: string, opts?: { skipName?: string }) {
    if (opts?.skipName) {
      const ok = await confirmDialog({
        message: tx("{absent} has not arrived. Call {name} now? {absent} stays on the waiting list and can recite later.", {
          absent: opts.skipName,
          name: waiting.find((p) => p.id === id)?.fullName ?? "",
        }),
        confirmLabel: tx("Call to the stage"),
      });
      if (!ok) return;
    }
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
          <StarLattice color="#F9971D" opacity={0.22} />
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
          <Box p="1.5" rounded="xl" bg="linear-gradient(160deg, #FDD199, #F9971D)" boxShadow="0 10px 24px rgba(0,0,0,0.35)" flexShrink={0}>
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
              {next.number !== null && (
                <Text as="span" color="gold.300" fontFamily="body" fontWeight="semibold" fontSize={{ base: "xl", md: "2xl" }} me="3" verticalAlign="middle">
                  N° {next.number}
                </Text>
              )}
              {next.fullName}
            </Heading>
            <Flex gap="2" wrap="wrap" justify={{ base: "center", md: "flex-start" }}>
              {facts.map(({ icon: Icon, text }) => (
                <Flex key={text} align="center" gap="1.5" px="3" py="1.5" rounded="full" bg="whiteAlpha.100" borderWidth="1px" borderColor="whiteAlpha.200" fontSize="sm">
                  <Icon size={14} color="#FBB75E" aria-hidden />
                  <Text>{text}</Text>
                </Flex>
              ))}
            </Flex>
            {!canCall ? (
              <Box mt="2">
                <ChiefCalls dark />
              </Box>
            ) : (
            <Flex gap="3" wrap="wrap" justify={{ base: "center", md: "flex-start" }} w="full">
              <Button
                mt="2"
                size="xl"
                px="8"
                rounded="xl"
                bg="gold.400"
                color="brand.900"
                fontWeight="bold"
                boxShadow="0 8px 22px rgba(249,151,29,0.45)"
                _hover={{ bg: "gold.300", transform: "translateY(-1px)" }}
                transition="all 0.15s"
                loading={calling && callingId === next.id}
                disabled={calling}
                onClick={() => void onCall(next.id)}
                w={{ base: "full", sm: "auto" }}
              >
                <UserRoundCheck size={20} aria-hidden />
                {tx("Call to the stage")}
              </Button>
              {after && (
                <Button
                  mt="2"
                  size="xl"
                  px="6"
                  rounded="xl"
                  variant="outline"
                  borderColor="whiteAlpha.600"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                  loading={calling && callingId === after.id}
                  disabled={calling}
                  onClick={() => void onCall(after.id, { skipName: next.fullName })}
                  w={{ base: "full", sm: "auto" }}
                >
                  {tx("Not arrived — call next")}
                </Button>
              )}
            </Flex>
            )}
          </Stack>
        </Flex>
      </Box>
      <ErrorAlert message={error} />

      {/* Everyone still waiting. The absent ones stay here: when they arrive, tap Call. */}
      {rest.length > 0 && (
        <Card.Root>
          <Card.Body p={{ base: "4", md: "5" }} gap="3">
            <Box>
              <Heading size="sm" color="brand.900">
                {tx("Waiting list ({n})", { n: waiting.length })}
              </Heading>
              <Text fontSize="sm" color="fg.muted">
                {tx("If someone has not arrived, call another. When they come, call them from this list.")}
              </Text>
            </Box>
            <Stack gap="0">
              {waiting.map((p, i) => (
                <Flex key={p.id} align="center" gap="3" py="2.5" borderTopWidth={i === 0 ? "0" : "1px"}>
                  <Text w="8" fontVariantNumeric="tabular-nums" fontSize="sm" color="fg.muted" textAlign="end">
                    {p.number !== null ? `N° ${p.number}` : "—"}
                  </Text>
                  <ParticipantPhoto path={p.photoUrl} size="thumb" />
                  <Box flex="1" minW="0">
                    <Text fontWeight="semibold" color="brand.900" truncate>
                      {p.fullName}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" truncate>
                      {p.institution}
                    </Text>
                  </Box>
                  {i === 0 ? (
                    <Badge colorPalette="green" variant="subtle">
                      {tx("Next")}
                    </Badge>
                  ) : !canCall ? null : (
                    <Button
                      size="sm"
                      variant="outline"
                      colorPalette="brand"
                      loading={calling && callingId === p.id}
                      disabled={calling}
                      onClick={() => void onCall(p.id, { skipName: next.fullName })}
                    >
                      {tx("Call")}
                    </Button>
                  )}
                </Flex>
              ))}
            </Stack>
          </Card.Body>
        </Card.Root>
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
  const { canCall } = useContext(CallRights);
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
          canCall ? (
            <Button size="sm" variant="outline" color="white" borderColor="whiteAlpha.500" _hover={{ bg: "whiteAlpha.200" }} loading={callState.loading} onClick={sendBack}>
              {tx("Not ready, send back")}
            </Button>
          ) : undefined
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
                bg="linear-gradient(160deg, #FBB75E 0%, #F9971D 100%)"
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
  const { canCall } = useContext(CallRights);
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

  if (!canCall) return <ChiefCalls dark />;

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
    // A notice appearing or leaving above the sheet moves it: measure again when anything
    // in the page's main area changes size.
    const main = ref.current?.closest("main") ?? null;
    const observer = main && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (main && observer) observer.observe(main);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
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
  const stageRound = useContext(StageRound);
  const [kept] = useState(() => {
    const stored = initial?.submitted ? null : readSheet(key);
    if (!stored || stored.marks.length !== texts.length) return null;
    // Marked in the other round (a tasfia copy still waiting once the final is on): not this sheet.
    if ((stored.round ?? "TASFIA") !== stageRound) return null;
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
  // One page per question, then the sauti page (sauti, total, submitting). The judge moves on
  // with "Done" (or the 3rd Fath, which deletes the question); a page opens once the one before is
  // done. `reached` is the furthest page opened: those before it can be visited again.
  const sautiStep = texts.length;
  const [reached, setReached] = useState(() =>
    startStep(marks, sauti, rules, Boolean(initial?.submitted || kept?.submit || panelDone)),
  );
  const [active, setActive] = useState(reached);
  // Which way the last page change went: the new page slides in from that side.
  const [direction, setDirection] = useState<"next" | "previous" | null>(null);
  function show(step: number) {
    if (step === active) return;
    setDirection(step > active ? "next" : "previous");
    setActive(step);
  }
  function finishQuestion(q: number) {
    setReached((r) => Math.max(r, q + 1));
    setDirection("next");
    setActive(q + 1);
  }
  // The panel completed while this judge was still on a question: the sheet is closed, so every
  // page opens and the sauti page comes up, where the finish bar moves the stage on.
  const [panelSeen, setPanelSeen] = useState(panelDone);
  if (panelDone && !panelSeen) {
    setPanelSeen(true);
    setReached(sautiStep);
    setDirection("next");
    setActive(sautiStep);
  }
  const [undo, setUndo] = useState<{ q: number; kind: MarkKind }[]>([]);
  const [dirty, setDirty] = useState(Boolean(kept)); // changes not yet sent
  const [reviewing, setReviewing] = useState(false); // the check before submitting
  const [error, setError] = useState<string | null>(null);
  // "Done" or Submit refused: these Fath, Tanbih or Kusita counts are not the other judges'. Each
  // goes away once the judge changes that mark on that question.
  const [refused, setRefused] = useState<MarkDifference[]>([]);
  // And what the server finds on this judge's sheet, live: a judge who finished a question later
  // counted it differently, so this judge (who already moved on) is told too.
  const differences = [
    ...refused,
    ...(submitted ? [] : (participant.mySheet?.differs ?? [])).filter(
      (d) => !refused.some((r) => r.question === d.question && r.mark === d.mark),
    ),
  ];
  const flagged = (q: number, kind: MarkKind) => differences.some((d) => d.question === q + 1 && d.mark === kind);
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
              round: stageRound,
            },
          },
        });
        setOffline(null);
        serverAt.current = res.data?.saveSheet.updatedAt ?? serverAt.current;
        if (version.current === v) setDirty(false);
        if (res.data?.saveSheet.submitted) {
          setSubmitted(true);
          setRefused([]);
        }
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
        } else if (failure.code === "MARKS_DIFFER") {
          // Counted differently from the judges who already submitted: the sheet stays open (a
          // draft, still saved) and the judge is shown where to recount.
          setRefused(failure.differences ?? []);
          setError(null);
          setSubmitWaiting(false);
          setReviewing(false);
          touch(); // the refused submission wrote nothing: the marks go in as a draft
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
    else writeSheet(key, { marks, sauti, submit: submitWaiting, base: serverAt.current, round: stageRound });
  }, [key, marks, sauti, dirty, submitWaiting, submitted, stageRound]);

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
    setRefused((d) => d.filter((x) => !(x.question === q + 1 && x.mark === kind)));
    if (by === 1) {
      setUndo((u) => [...u, { q, kind }]);
      // The 3rd Fath deletes the question: it is done, the next page comes (after the last
      // question, the sauti page), as on paper. Any other mark keeps the judge on this question:
      // they move on themselves with "Done", however many kinds of mark they gave.
      if (kind === "fath" && next[q]!.fath >= rules.fathLimit) void doneWith(q, next);
    }
  }

  // "Done" on question q: the server first checks the Fath, Tanbih and Kusita counts (this question
  // and those before) against the judges who finished them too. Different: the judge stays and
  // recounts. No connection: the judge goes on (the counts are checked again at Submit).
  const [finishOnServer, { loading: finishing }] = useMutation(FINISH_QUESTION);
  async function doneWith(q: number, current: Marks[] = marks) {
    try {
      await finishOnServer({
        variables: { input: { participantId: participant.id, questions: current, sauti, question: q + 1, round: stageRound } },
      });
      setRefused([]);
      setError(null);
      finishQuestion(q);
    } catch (err) {
      const failure = readApiError(err);
      if (failure.code === "MARKS_DIFFER") {
        setRefused(failure.differences ?? []);
        setError(null);
      } else if (failure.code === "SHEET_LOCKED") {
        setSubmitted(true);
      } else if (!failure.code || failure.code === "SERVER_UNAVAILABLE") {
        finishQuestion(q);
      } else {
        setError(failure.message);
      }
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
    show(last.q);
    touch();
    setRefused((d) => d.filter((x) => !(x.question === last.q + 1 && x.mark === last.kind)));
  }

  const onSauti = active >= sautiStep;
  const q = marks[Math.min(active, sautiStep - 1)]!;
  const deleted = q.fath >= rules.fathLimit;
  // The sauti is shared by the questions, a third each; a deleted question gets none of it.
  const live = marks.filter((m) => m.fath < rules.fathLimit).length;
  const allGone = live === 0;
  const sautiAdds = sauti === null ? null : round((sauti * live) / rules.questions);

  // 1. One glassy row: who is reciting, then the pages (questions, then sauti) as small steps,
  // then the rules. Kept low so the mushaf gets the room.
  const top = (
    <Flex
      align="center"
      gap={{ base: "2", md: "3" }}
      wrap={{ base: "wrap", lg: "nowrap" }}
      flexShrink={0}
      px="2"
      py="1.5"
      rounded={{ base: "2xl", lg: "full" }}
      bg="whiteAlpha.700"
      backdropFilter="blur(14px) saturate(160%)"
      borderWidth="1px"
      borderColor="whiteAlpha.800"
      boxShadow="0 4px 16px rgba(26,35,78,0.08), inset 0 1px 0 rgba(255,255,255,0.9)"
    >
      {/* Who is reciting */}
      <Flex align="center" gap="2" minW="0" maxW={{ lg: "60" }} flexShrink={{ base: 1, lg: 0 }}>
        <Flex
          boxSize="7"
          rounded="full"
          overflow="hidden"
          flexShrink={0}
          align="center"
          justify="center"
          borderWidth="1.5px"
          borderColor="gold.400"
          css={{ "& > *": { flexShrink: 0, transform: "scale(1.1)" } }}
        >
          <ParticipantPhoto path={participant.photoUrl} size="thumb" />
        </Flex>
        <Heading as="h2" fontFamily="display" fontSize={{ base: "sm", md: "md" }} fontWeight="bold" color="brand.900" lineHeight="1.15" truncate minW="0">
          {participant.fullName}
        </Heading>
      </Flex>

      {/* The pages, small steps */}
      <Box w="1px" h="6" bg="blackAlpha.200" flexShrink={0} display={{ base: "none", lg: "block" }} />
      <Flex role="tablist" align="center" gap="1.5" flex="1" minW={{ base: "full", lg: "0" }} order={{ base: 3, lg: 0 }}>
        {[...texts, null].map((text, i) => {
          const isSauti = text === null;
          const gone = !isSauti && marks[i]!.fath >= rules.fathLimit;
          const on = i === active;
          const locked = i > reached; // opens once the page before is done
          const done = !isSauti && !gone && i < reached;
          return (
            <chakra.button
              key={i}
              type="button"
              role="tab"
              aria-selected={on}
              aria-disabled={locked || undefined}
              disabled={locked}
              onClick={() => show(i)}
              flex={isSauti ? "0.7" : "1"}
              minW="0"
              h="8"
              display="flex"
              alignItems="center"
              gap="2"
              ps="1"
              pe="3"
              rounded="full"
              textAlign="left"
              cursor={locked ? "not-allowed" : "pointer"}
              opacity={locked ? 0.5 : 1}
              outline={!isSauti && differences.some((d) => d.question === i + 1) ? "2px solid" : undefined}
              outlineColor="red.500"
              bg={
                on
                  ? "linear-gradient(160deg, #FBF1D6 0%, #F4E1A8 100%)"
                  : gone
                    ? "red.50"
                    : done
                      ? "green.50"
                      : "transparent"
              }
              color={on ? "brand.900" : gone ? "red.700" : done ? "green.800" : "brand.800"}
              boxShadow={on ? "0 2px 10px rgba(249,151,29,0.28), inset 0 0 0 1px rgba(249,151,29,0.45)" : undefined}
              transition="background 0.2s, box-shadow 0.2s, opacity 0.2s"
              _hover={on || locked ? undefined : { bg: gone ? "red.100" : done ? "green.100" : "blackAlpha.50" }}
              _focusVisible={{ outline: "3px solid", outlineColor: "gold.400", outlineOffset: "2px" }}
            >
              <Circle
                size="6"
                flexShrink={0}
                fontWeight="bold"
                fontSize="xs"
                boxShadow={on ? "0 2px 6px rgba(26,35,78,0.3)" : undefined}
                bg={on ? "brand.900" : gone ? "red.500" : done ? "green.500" : isSauti ? "gold.100" : "brand.50"}
                color={on ? "gold.300" : gone || done ? "white" : isSauti ? "gold.700" : "brand.700"}
              >
                {locked ? <Lock size={11} aria-hidden /> : isSauti ? <Mic size={13} aria-hidden /> : done && !on ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
              </Circle>
              <Text
                fontFamily="display"
                fontSize={{ base: "xs", md: "sm" }}
                fontWeight={on ? "bold" : "semibold"}
                letterSpacing="0.01em"
                lineHeight="1.1"
                truncate
                textDecoration={gone ? "line-through" : undefined}
              >
                {isSauti ? (
                  <>
                    <MarkName mark={SAUTI} />
                    {sauti !== null && ` · ${sauti}`}
                  </>
                ) : (
                  questionLabel(text)
                )}
              </Text>
            </chakra.button>
          );
        })}
      </Flex>

      <Flex align="center" gap="1" ms={{ base: "auto", lg: "0" }} flexShrink={0}>
        {aside}
        {onRules && (
          <IconButton size="xs" variant="ghost" rounded="full" color="brand.700" _hover={{ bg: "brand.50" }} aria-label={tx("Marking rules")} title={tx("Marking rules")} onClick={onRules}>
            <BookOpen size={15} />
          </IconButton>
        )}
      </Flex>
    </Flex>
  );

  // Over the marks: which question this page is, and where it is in the mushaf.
  const lostHere = round(MARK_TYPES.reduce((sum, t) => sum + q[t.kind] * t.penalty(rules), 0));
  const questionHead = !onSauti && (
    <Flex
      align="center"
      gap="3"
      flexShrink={0}
      px="3"
      py="2.5"
      rounded="2xl"
      bg="whiteAlpha.700"
      backdropFilter="blur(14px) saturate(160%)"
      borderWidth="1px"
      borderColor="whiteAlpha.800"
      boxShadow="0 4px 16px rgba(26,35,78,0.08), inset 0 1px 0 rgba(255,255,255,0.9)"
    >
      <Circle
        size="11"
        flexShrink={0}
        fontFamily="display"
        fontSize="xl"
        fontWeight="bold"
        bg={deleted ? "red.500" : "linear-gradient(160deg, #FDD199 0%, #FBB75E 55%, #F9971D 100%)"}
        color={deleted ? "white" : "brand.900"}
        boxShadow={deleted ? undefined : "0 4px 12px rgba(249,151,29,0.35)"}
      >
        {active + 1}
      </Circle>
      <Box minW="0" flex="1">
        <Flex align="center" gap="1.5" fontSize="2xs" fontWeight="semibold" letterSpacing="0.14em" textTransform="uppercase" color="gold.700">
          <Text>{tx("Question {n}", { n: active + 1 })}</Text>
          <Text color="fg.subtle">·</Text>
          <Text color="fg.muted">
            {active + 1}/{texts.length}
          </Text>
          {infos[active] && (
            <>
              <Text color="fg.subtle">·</Text>
              <Flex align="center" gap="1" color="fg.muted">
                <BookOpen size={11} aria-hidden />
                {tx("Page {n}", { n: infos[active]!.page })}
              </Flex>
            </>
          )}
        </Flex>
        <Text
          fontFamily="display"
          fontSize={{ base: "lg", md: "xl" }}
          fontWeight="semibold"
          color={deleted ? "red.700" : "brand.900"}
          lineHeight="1.2"
          truncate
          textDecoration={deleted ? "line-through" : undefined}
        >
          {questionLabel(texts[active]!)}
        </Text>
      </Box>
      {/* What this question has lost so far */}
      <Box textAlign="end" flexShrink={0}>
        <Text
          key={lostHere}
          fontSize="lg"
          fontWeight="bold"
          lineHeight="1"
          fontVariantNumeric="tabular-nums"
          color={deleted ? "red.600" : lostHere ? "red.600" : "green.600"}
          animation={lostHere ? "scale-in 0.2s ease-out" : undefined}
        >
          {deleted ? "0" : lostHere ? `−${lostHere}` : "✓"}
        </Text>
        <Text fontSize="2xs" color="fg.muted" mt="1" whiteSpace="nowrap">
          {deleted ? tx("Deleted · 0") : lostHere ? tx("Points") : tx("No mistakes yet")}
        </Text>
      </Box>
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
          flagged={flagged(active, mark.kind)}
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
    </Flex>
  );
  // The judge is done with this question (whatever marks it got, even none): the next page.
  // After the last question comes the sauti page. A closed sheet just pages through.
  const lastQuestion = active === sautiStep - 1;
  const nextButton = !onSauti && (
    <Button
      size="lg"
      rounded="xl"
      fontWeight="bold"
      flexShrink={0}
      bg={NAVY_GRADIENT}
      color="white"
      borderWidth="1px"
      borderColor="gold.400"
      _hover={{ boxShadow: "0 6px 16px rgba(26,35,78,0.28)" }}
      loading={finishing}
      onClick={() => (closed ? show(active + 1) : void doneWith(active))}
    >
      {closed
        ? lastQuestion
          ? tx("Go to the sauti")
          : tx("Go to question {n}", { n: active + 2 })
        : lastQuestion
          ? tx("Done, go to the sauti")
          : tx("Done, go to question {n}", { n: active + 2 })}
      <ChevronRight size={18} aria-hidden />
    </Button>
  );

  // 3. The mushaf, open at the question.
  const book = infos[active] && <MushafPage key={texts[active]} start={infos[active]!.ref} end={infos[active]!.end} maxH={focus ? "100%" : "80vh"} hug={focus} />;

  const notices = (error || offline || differences.length > 0) && (
    <Box flexShrink={0}>
      <ErrorAlert message={error} />
      {differences.length > 0 && (
        <Box role="alert" px="4" py="3" rounded="xl" bg="red.50" borderWidth="1px" borderColor="red.300" color="red.900">
          <Flex align="center" gap="2" fontWeight="bold">
            <TriangleAlert size={18} aria-hidden style={{ flexShrink: 0 }} />
            {tx("Recount these marks")}
          </Flex>
          <Stack gap="1.5" mt="2">
            {differences.map((d) => {
              const type = MARK_TYPES.find((t) => t.kind === d.mark)!;
              return (
                <chakra.button
                  key={`${d.question}-${d.mark}`}
                  type="button"
                  onClick={() => show(d.question - 1)}
                  display="flex"
                  alignItems="center"
                  gap="2"
                  px="3"
                  py="1.5"
                  rounded="lg"
                  bg="white"
                  borderWidth="1px"
                  borderColor="red.200"
                  textAlign="left"
                  cursor="pointer"
                  _hover={{ borderColor: "red.400" }}
                >
                  <Box flex="1" minW="0">
                    <Text fontSize="xs" fontWeight="semibold" color="red.700">
                      {tx("Question {n}", { n: d.question })} · <MarkName mark={type} />
                    </Text>
                    <Text fontWeight="semibold">{whatHappened(d, participant.fullName, tx)}</Text>
                  </Box>
                  <ChevronRight size={16} aria-hidden style={{ flexShrink: 0 }} />
                </chakra.button>
              );
            })}
          </Stack>
        </Box>
      )}
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
  // What the sauti really adds, so the judge never thinks a 5 gives 5 points when questions are deleted.
  const sautiNote = (
    <Text fontSize="sm" color={live < texts.length ? "gold.200" : "whiteAlpha.700"}>
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
    <Box>
      <SimpleGrid columns={rules.sautiMax + 1} gap={{ base: "1.5", md: "2.5" }} role="radiogroup" aria-label="Sauti">
        {Array.from({ length: rules.sautiMax + 1 }, (_, v) => {
          const on = sauti === v;
          const below = sauti !== null && v < sauti;
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
              h={{ base: "14", md: "16" }}
              rounded="xl"
              fontFamily="display"
              fontSize={{ base: "2xl", md: "3xl" }}
              fontWeight="bold"
              fontVariantNumeric="tabular-nums"
              cursor="pointer"
              bg={on ? "linear-gradient(160deg, #FDD199 0%, #FBB75E 45%, #F9971D 100%)" : below ? "gold.400/20" : "whiteAlpha.100"}
              color={on ? "brand.900" : "white"}
              borderWidth="1px"
              borderColor={on ? "gold.200" : below ? "gold.400/50" : "whiteAlpha.200"}
              boxShadow={on ? "0 10px 28px rgba(251,183,94,0.45)" : undefined}
              transform={on ? "translateY(-2px)" : undefined}
              transition="all 0.18s"
              _hover={on || closed ? undefined : { bg: "whiteAlpha.200", borderColor: "gold.400/60" }}
              _active={closed ? undefined : { transform: "scale(0.97)" }}
              _disabled={{ cursor: "default", opacity: on ? 1 : 0.45 }}
              _focusVisible={{ outline: "3px solid", outlineColor: "gold.300", outlineOffset: "2px" }}
            >
              {v}
            </chakra.button>
          );
        })}
      </SimpleGrid>
      {/* How much of the sauti was given, as a gold line under the scale. */}
      <Box h="1.5" mt="3" rounded="full" bg="whiteAlpha.200" overflow="hidden">
        <Box
          h="full"
          w={`${sauti === null ? 0 : (sauti / rules.sautiMax) * 100}%`}
          rounded="full"
          bg="linear-gradient(90deg, #F9971D, #FDD199)"
          transition="width 0.3s ease"
        />
      </Box>
    </Box>
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
        show(i);
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
  // Each page slides in from the side it comes from (none when the sheet first opens).
  const slide = direction
    ? `${direction === "next" ? "page-from-right" : "page-from-left"} 0.35s cubic-bezier(0.22, 1, 0.36, 1) both`
    : undefined;

  // The last page: the sauti scale, every question's points (tap one to go back to it), the total
  // and submitting.
  const sautiPage = (
    <Box
      position="relative"
      overflow="hidden"
      w="full"
      maxW="3xl"
      mx="auto"
      rounded="3xl"
      bg={NAVY_GRADIENT}
      color="white"
      boxShadow="0 24px 60px rgba(26,35,78,0.35)"
      borderWidth="1px"
      borderColor="gold.400/40"
    >
      <Box position="absolute" inset="0" pointerEvents="none" aria-hidden>
        <StarLattice color="#F9971D" opacity={0.08} tile={64} />
      </Box>
      <Stack position="relative" gap={{ base: "5", md: "6" }} p={{ base: "5", md: "8" }}>
        <Flex align="center" gap="4">
          <Circle size={{ base: "12", md: "14" }} flexShrink={0} bg="linear-gradient(160deg, #FDD199 0%, #F9971D 100%)" color="brand.900" boxShadow="0 0 36px rgba(251,183,94,0.4)">
            <Mic size={24} aria-hidden />
          </Circle>
          <Box flex="1" minW="0">
            <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.18em" textTransform="uppercase" color="gold.300">
              {tx("Last step")}
            </Text>
            <Heading as="h2" fontFamily="display" fontSize={{ base: "2xl", md: "3xl" }} lineHeight="1.15">
              <MarkName mark={SAUTI} />
            </Heading>
          </Box>
          <Box maxW="40">{status}</Box>
        </Flex>

        <Stack gap="2">
          {sautiButtons}
          {sautiNote}
        </Stack>

        <Stack gap="2">
          <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.16em" textTransform="uppercase" color="whiteAlpha.700">
            {tx("Questions")}
          </Text>
          <SimpleGrid columns={{ base: 1, sm: texts.length }} gap="2">
            {marks.map((m, i) => {
              const gone = m.fath >= rules.fathLimit;
              return (
                <chakra.button
                  key={i}
                  type="button"
                  onClick={() => show(i)}
                  display="flex"
                  alignItems="center"
                  gap="2.5"
                  textAlign="left"
                  px="3"
                  py="2.5"
                  rounded="xl"
                  cursor="pointer"
                  bg="whiteAlpha.100"
                  borderWidth="1px"
                  borderColor={gone ? "red.300/60" : "whiteAlpha.200"}
                  _hover={{ bg: "whiteAlpha.200" }}
                  _focusVisible={{ outline: "3px solid", outlineColor: "gold.400", outlineOffset: "2px" }}
                >
                  <Circle size="7" flexShrink={0} fontSize="xs" fontWeight="bold" bg={gone ? "red.500" : "whiteAlpha.200"}>
                    {i + 1}
                  </Circle>
                  <Box minW="0">
                    <Text fontSize="xs" color="whiteAlpha.700" truncate>
                      {questionLabel(texts[i]!)}
                    </Text>
                    <Text fontWeight="bold" color={gone ? "red.200" : "white"} fontVariantNumeric="tabular-nums">
                      {gone ? tx("Deleted · 0") : `${questionScore(m, sauti, rules)} / ${rules.questionPoints}`}
                    </Text>
                  </Box>
                </chakra.button>
              );
            })}
          </SimpleGrid>
        </Stack>

        <Flex align={{ base: "stretch", sm: "flex-end" }} direction={{ base: "column", sm: "row" }} gap="4" pt="5" borderTopWidth="1px" borderColor="whiteAlpha.200">
          <Box flex="1" minW="0">
            <ScoreTotal total={total} />
          </Box>
          <Flex align="center" gap="2" justify="flex-end">
            {undoButton}
            <Box flex={{ base: "1", sm: "initial" }} css={{ "& > button": { width: "100%" } }}>
              {submitArea}
            </Box>
          </Flex>
        </Flex>
      </Stack>
    </Box>
  );

  // Under a question's marks: where the draft is, undo, and "Done".
  const questionBar = (
    <Flex align="center" gap="2" ps="3" pe="1.5" py="1.5" rounded="2xl" bg={NAVY_GRADIENT} color="white" flexShrink={0} wrap="wrap" boxShadow="0 8px 24px rgba(26,35,78,0.18)">
      <Box flex="1" minW="0">
        {status}
      </Box>
      {undoButton}
      {nextButton}
    </Flex>
  );

  if (focus) {
    return (
      <Box ref={fillRef} h={fillHeight ? `${fillHeight}px` : undefined} mb={pull ? `-${pull}px` : undefined}>
        <Flex direction="column" h="full" gap="2">
          {top}
          <Box flex="1" minH="0" overflow="hidden">
            {onSauti ? (
              <Flex key="sauti" h="full" direction="column" gap="3" overflowY="auto" justify="safe center" animation={slide}>
                {notices}
                {sautiPage}
              </Flex>
            ) : (
              <Flex key={active} h="full" gap="3" animation={slide}>
                {/* The mushaf starts at the left edge and is only as wide as its pages; the mark
                    cards take all the width that is left. */}
                <Box flex="0 1 auto" minW="0" h="full" display="flex">
                  {book}
                </Box>
                <Flex direction="column" flex="1" minW="72" gap="2" minH="0" overflowY="auto">
                  {questionHead}
                  {cards}
                  {deletedNote}
                  {notices}
                  <Box mt="auto">{questionBar}</Box>
                </Flex>
              </Flex>
            )}
          </Box>
        </Flex>
        {review}
      </Box>
    );
  }

  // A phone, a tablet upright, or a past sheet: one column, the page scrolls.
  return (
    <Flex direction="column" gap="3" overflowX="hidden">
      {top}
      {onSauti ? (
        <Stack key="sauti" gap="3" animation={slide}>
          {notices}
          {sautiPage}
        </Stack>
      ) : (
        <Stack key={active} gap="3" animation={slide}>
          {questionHead}
          {cards}
          {deletedNote}
          {questionBar}
          {book}
          {notices}
        </Stack>
      )}
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
              variables: {
                input: { participantId, questions: sheet.marks, sauti: sheet.sauti, presence: null, submit: sheet.submit, round: sheet.round ?? "TASFIA" },
              },
            });
            removeSheet(key);
          } catch (err) {
            // Only a final answer (already in, or can never go in) ends it. A login that ran out or a
            // busy server keeps the marks on the tablet: they go once the judge is logged in again.
            const code = readApiError(err).code;
            // Counted differently from the judges who already submitted: kept as a draft (sent as
            // one next time) for the judge to correct; the list shows it as not submitted.
            if (code === "MARKS_DIFFER") writeSheet(key, { marks: sheet.marks, sauti: sheet.sauti, submit: false, base: sheet.base, round: sheet.round });
            else if (isFinalAnswer(code)) removeSheet(key);
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
        <Box h="full" w={`${part * 100}%`} rounded="full" bg="linear-gradient(90deg, #F9971D, #FDD199)" transition="width 0.4s ease" />
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
  flagged = false,
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
  // Submit was refused: this count is not the other judges' on this question.
  flagged?: boolean;
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
      borderWidth={flagged ? "3px" : "1px"}
      borderColor={flagged ? "red.500" : hit ? `${c}.300` : "border"}
      boxShadow={flagged ? "0 0 0 4px rgba(229,62,62,0.18)" : hit ? "0 8px 20px rgba(26,35,78,0.10)" : "0 1px 2px rgba(26,35,78,0.06)"}
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
  final = false,
}: {
  recited: QueueParticipant[];
  viewId: string | null;
  onOpen: (id: string | null) => void;
  judgeCount: number;
  final?: boolean;
}) {
  const { tx } = useI18n();
  // Called back on stage: their turn was ended (by mistake) before every judge had submitted.
  const [call, { loading: calling }] = useMutation(CALL_PARTICIPANT, {
    refetchQueries: [{ query: STAGE }, { query: STAGE_QUEUE }],
  });
  const [callingId, setCallingId] = useState<string | null>(null);
  const { canCall } = useContext(CallRights);
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
                <Flex align="center" gap="2" minW="0">
                  <Text fontWeight="semibold" color="brand.900" truncate>
                    {p.fullName}
                  </Text>
                  {/* Refused (counted differently) or sent back by the admin: still to correct. */}
                  {p.mySheet && !p.mySheet.submitted && p.sheetsSubmitted < judgeCount && (
                    <Badge colorPalette="red" variant="solid" size="sm" flexShrink={0}>
                      {tx("Not submitted")}
                    </Badge>
                  )}
                </Flex>
                <Text fontSize="xs" color="fg.muted">
                  {tx("Envelope {n}", { n: p.envelope!.number })} · {p.sheetsSubmitted === 1 ? tx("1 judge submitted") : tx("{n} judges submitted", { n: p.sheetsSubmitted })}
                  {(final ? p.finalScore : p.score) !== null && ` · ${tx("final {n}", { n: (final ? p.finalScore : p.score)! })}`}
                </Text>
              </Box>
              {canCall && p.sheetsSubmitted < judgeCount && (
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

// The page a sheet opens on, also after a reload: the sauti page once the sheet is closed or the
// sauti was given; otherwise the last question with marks (the one after it if that one is deleted).
// Nothing marked yet: question 1.
function startStep(marks: Marks[], sauti: number | null, r: ScoringRules, closed: boolean) {
  if (closed || sauti !== null) return marks.length;
  let last = -1;
  marks.forEach((m, i) => {
    if (hasMarks(m)) last = i;
  });
  if (last === -1) return 0;
  return marks[last]!.fath >= r.fathLimit ? last + 1 : last;
}

const round = (n: number) => Math.round(n * 100) / 100;

// What happened to the participant, as the other judges all counted it, e.g. "Amuri Nsabimana
// was reminded once". When the other judges do not agree among themselves: check that mark.
function whatHappened(d: MarkDifference, name: string, tx: ReturnType<typeof useI18n>["tx"]) {
  const v = { name, n: d.count ?? 0 };
  const n = d.count;
  switch (d.mark) {
    case "fath":
      if (n === null) return tx("Check how many times {name} was reminded.", v);
      if (n === 0) return tx("{name} was not reminded.", v);
      if (n === 1) return tx("{name} was reminded once.", v);
      if (n === 2) return tx("{name} was reminded twice.", v);
      return tx("{name} was reminded {n} times.", v);
    case "tanbih":
      if (n === null) return tx("Check how many times the table was tapped for {name}.", v);
      if (n === 0) return tx("The table was not tapped for {name}.", v);
      if (n === 1) return tx("The table was tapped for {name} once.", v);
      if (n === 2) return tx("The table was tapped for {name} twice.", v);
      return tx("The table was tapped for {name} {n} times.", v);
    case "kusita":
      if (n === null) return tx("Check how many times {name} hesitated.", v);
      if (n === 0) return tx("{name} did not hesitate.", v);
      if (n === 1) return tx("{name} hesitated once.", v);
      if (n === 2) return tx("{name} hesitated twice.", v);
      return tx("{name} hesitated {n} times.", v);
  }
}
