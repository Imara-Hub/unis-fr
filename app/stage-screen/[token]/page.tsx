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
import { Link2Off, Mail, MailOpen, Mic } from "lucide-react";
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
import { API_URL } from "@/lib/api";
import { readApiError } from "@/lib/errors";
import {
  STAGE_SCREEN,
  STAGE_SCREEN_DRAW,
  type StageScreenView,
} from "@/lib/graphql/judging";
import { useI18n } from "@/lib/i18n";
import { HoldToUnlock, LockOverlay, useScreenLock } from "./lock";

// The stage screen: a tablet on stage, opened with the secret link the admin creates.
// The participant who was called picks a closed envelope here. This screen never receives any
// question (the server does not send them): only judges, the admin and staff see them.
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
  const lock = useScreenLock();
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
      {(!lock.locked || lock.needsFullscreen) && (
        <LockOverlay
          mode={lock.locked ? "resume" : "start"}
          fullscreenSupported={lock.fullscreenSupported}
          installed={lock.installed}
          onStart={
            lock.locked ? () => void lock.resume() : () => void lock.start()
          }
          languagePicker={<LanguageSwitcher />}
        />
      )}
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
        <HoldToUnlock enabled={lock.locked} onUnlock={() => void lock.unlock()}>
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
        </HoldToUnlock>
        {/* The language is chosen before starting; locked, the participant cannot change it. */}
        {!lock.locked && <LanguageSwitcher />}
      </Flex>

      <Flex
        position="relative"
        flex="1"
        minH="0"
        overflowY="auto"
        direction="column"
        align="center"
        justify="center"
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
        ) : !view.participant ? (
          <Message
            icon={<Mic size={36} aria-hidden />}
            title={tx("Waiting for the next participant")}
            text={tx("The judges call the next participant to the stage.")}
          />
        ) : view.drawn ? (
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

// The participant taps a closed envelope, then confirms on the same screen.
function Draw({ token, view }: { token: string; view: StageScreenView }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draw, { loading }] = useMutation(STAGE_SCREEN_DRAW, {
    refetchQueries: [{ query: STAGE_SCREEN, variables: { token } }],
  });
  const { tx } = useI18n();
  const name = firstName(view.participant!.fullName);
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
    <Stack align="center" gap={{ base: "6", md: "8" }} w="full" maxW="5xl">
      <Stack align="center" textAlign="center" gap="2">
        <Text
          fontSize="sm"
          fontWeight="semibold"
          letterSpacing="0.18em"
          textTransform="uppercase"
          color="gold.300"
        >
          {tx("On stage")}
        </Text>
        <Heading
          as="h1"
          fontFamily="display"
          fontSize={{ base: "3xl", md: "5xl" }}
          lineHeight="1.15"
        >
          {tx("{name}, choose an envelope", { name })}
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
          columns={{ base: 3, md: 4, lg: 5, xl: 6 }}
          gap={{ base: "3", md: "5", lg: "6" }}
          w="full"
        >
          {view.slots.map((slot, i) => {
            const selected = slot.id === stillThere;
            return (
              <chakra.button
                key={slot.id}
                type="button"
                onClick={() => setChosen(slot.id)}
                disabled={loading}
                aria-label={tx("Envelope")}
                aria-pressed={selected}
                aspectRatio={1.45}
                rounded="xl"
                bg="linear-gradient(160deg, #E2C06A 0%, #C99A35 100%)"
                color="brand.900"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                boxShadow={
                  selected
                    ? "0 0 0 4px #1A234E, 0 0 0 7px #E2C06A, 0 18px 40px rgba(0,0,0,0.45)"
                    : "0 8px 20px rgba(0,0,0,0.35)"
                }
                transform={
                  selected ? "translateY(-6px) scale(1.04)" : undefined
                }
                opacity={stillThere && !selected ? 0.55 : 1}
                transition="transform 0.18s, box-shadow 0.18s, opacity 0.18s"
                animation="fade-in 0.4s ease-out both"
                animationDelay={`${Math.min(i, 24) * 30}ms`}
                _hover={{
                  transform: selected ? undefined : "translateY(-3px)",
                }}
                _disabled={{ cursor: "wait" }}
                _focusVisible={{
                  outline: "3px solid",
                  outlineColor: "white",
                  outlineOffset: "3px",
                }}
              >
                <Box
                  as="span"
                  display="inline-flex"
                  boxSize={{ base: "10", md: "14" }}
                  aria-hidden
                >
                  <Mail width="100%" height="100%" strokeWidth={1.4} />
                </Box>
              </chakra.button>
            );
          })}
        </SimpleGrid>
      )}

      {/* Confirm on the screen itself: big buttons, no browser popup. */}
      <Flex
        gap="3"
        direction={{ base: "column", sm: "row" }}
        w={{ base: "full", sm: "auto" }}
        visibility={stillThere ? "visible" : "hidden"}
        aria-hidden={!stillThere}
      >
        <Button
          size="xl"
          colorPalette="gold"
          color="brand.900"
          px="10"
          loading={loading}
          onClick={open}
        >
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
  );
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
      es.addEventListener("next", refresh);
      // The link was replaced: stop listening; the reload shows "link not valid".
      es.addEventListener("complete", () => {
        es.close();
        source = null;
        refresh();
      });
    };
    open();
    const poll = setInterval(refresh, 20_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      source?.close();
    };
  }, [token]);
}
