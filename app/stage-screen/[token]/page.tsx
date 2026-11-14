"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import {
  Box,
  Button,
  chakra,
  Circle,
  Flex,
  Heading,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, Hourglass, Link2Off, MailOpen } from "lucide-react";
import { useParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";
import { FullPageSpinner } from "@/components/AuthCard";
import { Logo } from "@/components/brand/Logo";
import { StarLattice } from "@/components/brand/Octagram";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { EnvelopeCard } from "@/components/StageEnvelope";
import { API_URL } from "@/lib/api";
import { readApiError } from "@/lib/errors";
import {
  STAGE_SCREEN,
  STAGE_SCREEN_DRAW,
  type StageScreenView,
} from "@/lib/graphql/judging";
import { useI18n } from "@/lib/i18n";


export default function StageScreenPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <StageScreen />
    </Suspense>
  );
}

function StageScreen() {
  const { token } = useParams<{ token: string }>();
  const { data, error, refetch } = useQuery(STAGE_SCREEN, {
    variables: { token },
    fetchPolicy: "network-only",
  });
  useStageScreenLive(token, () => void refetch());
  const { tx } = useI18n();
  useKeepAwake();
  const view = data?.stageScreen;

  return (
    <Flex
      direction="column"
      h="100dvh"
      color="white"
      position="relative"
      overflow="hidden"
      bg="linear-gradient(180deg, #1E2956 0%, #1A234E 55%, #151C42 100%)"
      // A tablet in the participant's hands: no text selection, no long-press menus, no pull-to-refresh,
      // no double-tap zoom. Content stays clear of the notch and rounded corners.
      userSelect="none"
      overscrollBehavior="none"
      touchAction="manipulation"
      css={{
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      pt="env(safe-area-inset-top)"
      pb="env(safe-area-inset-bottom)"
      ps="env(safe-area-inset-left)"
      pe="env(safe-area-inset-right)"
    >
      <Box position="absolute" inset="0" aria-hidden pointerEvents="none">
        <StarLattice color="#C99A35" opacity={0.16} tile={72} />
        <Box
          position="absolute"
          inset="0"
          bg="radial-gradient(ellipse at center, rgba(26,35,78,0.55) 0%, rgba(21,28,66,0.95) 75%)"
        />
      </Box>

      <Flex
        position="relative"
        align="center"
        justify="space-between"
        px={{ base: "4", md: "8" }}
        py={{ base: "3", md: "5" }}
        flexShrink={0}
      >
        <Flex align="center" gap="3">
          <Logo size={44} priority />
          <Box lineHeight="1.1">
            <Text fontFamily="display" fontSize="lg" letterSpacing="0.16em">
              UNIS
            </Text>
            <Flex align="baseline" gap="1.5" fontSize="xs" color="gold.300">
              <Text
                as="span"
                letterSpacing="0.12em"
                textTransform="uppercase"
              >
                Musabaqa
              </Text>
              <Text
                as="span"
                lang="ar"
                dir="rtl"
                fontFamily="arabic"
                fontSize="sm"
              >
                مسابقة
              </Text>
            </Flex>
          </Box>
        </Flex>
        <LanguageSwitcher />
      </Flex>

      <Flex
        position="relative"
        flex="1"
        minH="0"
        overflowY="auto"
        direction="column"
        align="center"
        // "safe": content taller than the screen starts at the top instead of being cut off there.
        justify="safe center"
        px={{ base: "4", md: "10" }}
        pb={{ base: "6", md: "10" }}
      >
        {error && !view ? (
          <Message
            icon={<Link2Off size={36} aria-hidden />}
            title={tx("The stage screen cannot reach the server")}
            text={readApiError(error).message}
            action={
              <Button colorPalette="gold" onClick={() => void refetch()}>
                {tx("Try again")}
              </Button>
            }
          />
        ) : !view ? (
          <Spinner size="xl" color="gold.300" />
        ) : !view.valid ? (
          <Message
            icon={<Link2Off size={36} aria-hidden />}
            title={tx("This stage screen link is not valid")}
            text={tx(
              "Ask the admin to open the new stage screen link on this tablet.",
            )}
          />
        ) : view.participant && view.drawn ? (
          <Message
            icon={<MailOpen size={40} aria-hidden />}
            gold
            title={tx("Envelope {n} chosen", { n: view.envelopeNumber ?? "" })}
            text={tx(
              "Bismillah, {name}. The judges now see your questions. Recite when they are ready.",
              {
                name: firstName(view.participant.fullName),
              },
            )}
          />
        ) : !view.participant ? (
          // Nobody called yet: no envelopes, they appear when the judges call the next participant.
          <Message
            icon={<Hourglass size={38} aria-hidden />}
            title={tx("Waiting for the next participant")}
            text={tx("The envelopes appear here when the judges call the next participant.")}
          />
        ) : (
          <Draw key={view.participant.id} token={token} view={view} />
        )}
      </Flex>
    </Flex>
  );
}

const firstName = (fullName: string) => fullName.split(" ")[0] ?? fullName;

function Message({
  icon,
  title,
  text,
  action,
  gold = false,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
  gold?: boolean;
}) {
  return (
    <Stack align="center" textAlign="center" gap="5" maxW="xl">
      <Circle
        size="24"
        bg={
          gold
            ? "linear-gradient(160deg, #D9B45A 0%, #C99A35 100%)"
            : "whiteAlpha.100"
        }
        color={gold ? "brand.900" : "gold.300"}
        borderWidth="1px"
        borderColor={gold ? "gold.300" : "whiteAlpha.200"}
        boxShadow={gold ? "0 0 60px rgba(217,180,90,0.35)" : undefined}
      >
        {icon}
      </Circle>
      <Heading
        as="h1"
        fontFamily="display"
        fontSize={{ base: "3xl", md: "5xl" }}
        lineHeight="1.15"
      >
        {title}
      </Heading>
      <Text fontSize={{ base: "lg", md: "xl" }} color="whiteAlpha.800">
        {text}
      </Text>
      {action}
    </Stack>
  );
}

// Envelopes per page: two rows of five (20 envelopes = 2 pages), so a page fits the tablet.
const PER_PAGE = 10;

// The called participant taps a closed envelope, then confirms on the same screen.
function Draw({ token, view }: { token: string; view: StageScreenView }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draw, { loading }] = useMutation(STAGE_SCREEN_DRAW, {
    update(cache, { data }) {
      if (!data) return;
      cache.writeQuery({ query: STAGE_SCREEN, variables: { token }, data: { stageScreen: data.stageScreenDraw } });
    },
  });
  const { tx } = useI18n();
  const name = view.participant ? firstName(view.participant.fullName) : "";
  const pages = Math.max(1, Math.ceil(view.slots.length / PER_PAGE));
  const shownPage = Math.min(page, pages - 1); // fewer envelopes now (one was drawn or deleted)
  const shown = view.slots.slice(shownPage * PER_PAGE, (shownPage + 1) * PER_PAGE);
  // The envelope they had chosen was taken by the judges' backup draw, or deleted.
  const stillThere =
    chosen && view.slots.some((s) => s.id === chosen) ? chosen : null;

  async function open() {
    if (!stillThere) return;
    setError(null);
    try {
      await draw({ variables: { token, envelopeId: stillThere } });
    } catch (err) {
      setError(readApiError(err).message);
      setChosen(null);
    }
  }

  return (
    <Stack align="center" gap={{ base: "6", md: "8" }} w="full" maxW="6xl">
      {/* The title, always; the name of who is choosing once a participant is called. */}
      <Stack align="center" textAlign="center" gap="2" animation="fade-in 0.4s ease-out">
        <Text
            fontSize="sm"
            fontWeight="semibold"
            letterSpacing="0.18em"
            textTransform="uppercase"
            color="gold.300"
          >
            {tx("On stage")} · {name}
          </Text>
        <Heading
          as="h1"
          fontFamily="display"
          fontSize={{ base: "3xl", md: "5xl" }}
          lineHeight="1.15"
        >
          {tx("Choose your question")}
        </Heading>
        <Text fontSize={{ base: "md", md: "xl" }} color="whiteAlpha.800">
          {tx("Tap one closed envelope. Its questions go to the judges.")}
        </Text>
      </Stack>

      {error && (
        <Box
          px="4"
          py="3"
          rounded="lg"
          bg="red.900/60"
          borderWidth="1px"
          borderColor="red.400"
          color="white"
          textAlign="center"
        >
          {error}
        </Box>
      )}

      {view.slots.length === 0 ? (
        <Text fontSize="lg" color="whiteAlpha.800" textAlign="center">
          {tx("No envelope is ready. The admin prepares them.")}
        </Text>
      ) : (
        <SimpleGrid
          key={shownPage} // each page fades in
          columns={{ base: 2, md: 5 }}
          gap={{ base: "5", md: "8", xl: "10" }}
          w="full"
          px={{ base: "1", md: "2" }}
          py="2"
        >
          {shown.map((slot, i) => (
            <EnvelopeCard
              key={slot.id}
              index={i}
              label={tx("Envelope")}
              selected={slot.id === stillThere}
              faded={Boolean(stillThere) && slot.id !== stillThere}
              disabled={loading || Boolean(stillThere)}
              onPick={() => setChosen(slot.id)}
            />
          ))}
        </SimpleGrid>
      )}

      {pages > 1 && (
        <Flex align="center" gap={{ base: "3", md: "5" }}>
          <Button
            size="lg"
            variant="outline"
            bg="whiteAlpha.100"
            color="gold.300"
            borderColor="gold.400"
            _hover={{ bg: "whiteAlpha.200" }}
            _disabled={{ opacity: 0.3, cursor: "not-allowed" }}
            disabled={shownPage === 0}
            aria-label={tx("Previous envelopes")}
            onClick={() => setPage(shownPage - 1)}
          >
            <ChevronLeft size={20} aria-hidden />
          </Button>
          <Flex gap="2" align="center">
            {Array.from({ length: pages }, (_, k) => (
              <chakra.button
                key={k}
                type="button"
                aria-label={tx("Page {n}", { n: k + 1 })}
                aria-current={k === shownPage ? "page" : undefined}
                onClick={() => setPage(k)}
                w={k === shownPage ? "8" : "3"}
                h="3"
                rounded="full"
                bg={k === shownPage ? "gold.400" : "whiteAlpha.400"}
                transition="all 0.2s"
                cursor="pointer"
              />
            ))}
          </Flex>
          <Button
            size="lg"
            variant="outline"
            bg="whiteAlpha.100"
            color="gold.300"
            borderColor="gold.400"
            _hover={{ bg: "whiteAlpha.200" }}
            _disabled={{ opacity: 0.3, cursor: "not-allowed" }}
            disabled={shownPage === pages - 1}
            aria-label={tx("More envelopes")}
            onClick={() => setPage(shownPage + 1)}
          >
            <ChevronRight size={20} aria-hidden />
          </Button>
        </Flex>
      )}

      {/* How many are left in the draw. */}
      {view.slots.length > 0 && (
        <Text fontSize={{ base: "md", md: "lg" }} color="gold.300" letterSpacing="0.06em">
          {view.slots.length === 1 ? tx("1 envelope left") : tx("{n} envelopes left", { n: view.slots.length })}
        </Text>
      )}

      {/* Confirm over the whole screen, so the buttons are always in view (the grid can be taller
          than the tablet), and no other envelope can be tapped meanwhile. */}
      {stillThere && (
        <Flex
          position="fixed"
          inset="0"
          zIndex="overlay"
          align="center"
          justify="center"
          p={{ base: "5", md: "10" }}
          bg="rgba(12,16,40,0.82)"
          backdropFilter="blur(6px)"
          animation="fade-in 0.2s ease-out"
          role="dialog"
          aria-modal="true"
          aria-label={tx("{name}, open this envelope?", { name })}
        >
          <Stack align="center" gap={{ base: "6", md: "8" }} w="full" maxW="lg" textAlign="center">
            <Heading as="h2" fontFamily="display" fontSize={{ base: "2xl", md: "4xl" }} lineHeight="1.2">
              {tx("{name}, open this envelope?", { name })}
            </Heading>
            <Box w="full" maxW={{ base: "xs", md: "sm" }}>
              <EnvelopeCard
                index={0}
                label={tx("Envelope")}
                selected
                faded={false}
                disabled
                onPick={() => undefined}
              />
            </Box>
            {error && (
              <Box px="4" py="3" rounded="lg" bg="red.900/60" borderWidth="1px" borderColor="red.400" color="white">
                {error}
              </Box>
            )}
            <Flex gap="3" direction={{ base: "column", sm: "row" }} w={{ base: "full", sm: "auto" }}>
              <Button size="xl" colorPalette="gold" color="brand.900" px="10" loading={loading} onClick={open} autoFocus>
                <MailOpen size={20} aria-hidden />
                {tx("Open this envelope")}
              </Button>
              <Button
                size="xl"
                variant="outline"
                color="white"
                borderColor="whiteAlpha.500"
                _hover={{ bg: "whiteAlpha.200" }}
                disabled={loading}
                onClick={() => setChosen(null)}
              >
                {tx("Choose another")}
              </Button>
            </Flex>
          </Stack>
        </Flex>
      )}
    </Stack>
  );
}

// The tablet stays on during the competition (where the browser allows it).
function useKeepAwake() {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Not allowed (battery saver, old browser): the tablet's own sleep setting applies.
      }
    };
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => {
      document.removeEventListener("visibilitychange", keepAwake);
      void wakeLock?.release();
    };
  }, []);
}

// Live updates for the stage screen (Server-Sent Events), authorised by the secret link only.
// Also reloads every 20 seconds, in case the stream is blocked on the venue's network.
function useStageScreenLive(token: string, onChange: () => void) {
  const changed = useEffectEvent(onChange);

  useEffect(() => {
    const url = new URL(API_URL);
    url.searchParams.set(
      "query",
      "subscription ($token: String!) { stageScreenChanged(token: $token) }",
    );
    url.searchParams.set("variables", JSON.stringify({ token }));
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => changed(), 200);
    };
    const open = () => {
      if (source) return;
      const es = new EventSource(url);
      source = es;
      es.onopen = refresh; // after a reconnect we may have missed a change
      // A failure the browser will not retry by itself (an error status, e.g. while the API
      // restarts): forget this stream so the 20 s poll opens a new one.
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED && source === es) source = null;
      };
      es.addEventListener("next", refresh);
      // The link was replaced: stop listening; the reload shows "link not valid".
      es.addEventListener("complete", () => {
        es.close();
        source = null;
        refresh();
      });
    };
    open();
    // Every 20 s: reload, and listen again if the stream was ended (a passing error must not
    // leave the tablet on the slow reload for the rest of the day).
    const poll = setInterval(() => {
      open();
      refresh();
    }, 20_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      source?.close();
    };
  }, [token]);
}
