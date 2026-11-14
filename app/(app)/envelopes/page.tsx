"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Alert, Badge, Box, Button, Card, chakra, Circle, Flex, Heading, IconButton, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Copy, Dices, ExternalLink, MonitorSmartphone, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { RoleOnly } from "@/components/AdminOnly";
import { CopyButton } from "@/components/CopyButton";
import { EditEnvelopeDialog } from "@/components/EditEnvelopeDialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { MushafPage } from "@/components/MushafPage";
import { QuestionPicker } from "@/components/QuestionPicker";
import { PageBanner } from "@/components/PageBanner";
import { isLocalLink } from "@/components/ShareLink";
import { EnvelopeFace } from "@/components/StageEnvelope";
import { toaster } from "@/components/Toaster";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import {
  CREATE_ENVELOPE,
  CREATE_RANDOM_ENVELOPES,
  DELETE_ENVELOPE,
  DELETE_UNUSED_ENVELOPES,
  ENVELOPES,
  REGENERATE_STAGE_SCREEN_LINK,
  STAGE_SCREEN_LINK,
  type Envelope,
} from "@/lib/graphql/judging";
import { useI18n } from "@/lib/i18n";
import { parseRef, QUESTION_JUZ, randomRef, refText } from "@/lib/quran";

const EMPTY = ["", "", ""];

// The admin writes the envelopes here: 3 questions each. On stage, the participant picks one
// closed envelope on the stage screen; it is then used and cannot change any more.
// Judges and staff only see the list, and the questions stay sealed for them until the envelope is drawn.
export default function EnvelopesPage() {
  const { data, loading, error } = useQuery(ENVELOPES);
  const isAdmin = useQuery(ME).data?.me?.role === "ADMIN";
  const envelopes = data?.envelopes ?? [];
  const unused = envelopes.filter((e) => !e.used);
  const [editing, setEditing] = useState<Envelope | null>(null);
  const { tx } = useI18n();

  return (
    <RoleOnly roles={["ADMIN", "JUDGE", "STAFF"]}>
      <PageBanner
        title={tx("Questions")}
        actions={
          isAdmin ? (
            <Button asChild size="lg" bg="gold.400" color="brand.900" _hover={{ bg: "gold.300" }}>
              <a href="#new-envelope">
                <Plus size={18} aria-hidden />
                {tx("Write questions")}
              </a>
            </Button>
          ) : undefined
        }
        rings={[
          { label: tx("Available"), value: data ? unused.length : undefined, total: envelopes.length, color: "#4ADE80" },
          { label: tx("Used"), value: data ? envelopes.length - unused.length : undefined, total: envelopes.length, color: "#E2C06A" },
        ]}
      />
      <Stack gap={{ base: "6", md: "8" }}>
        {isAdmin && <StageScreenCard />}
        {isAdmin && (
          <Box id="new-envelope" scrollMarginTop="24">
            <EnvelopeForm />
          </Box>
        )}
        {isAdmin && <RandomEnvelopesCard />}
        {isAdmin && editing && <EditEnvelopeDialog key={editing.id} envelope={editing} onClose={() => setEditing(null)} />}

        <Card.Root>
          <Card.Body p={{ base: "5", md: "7" }} gap="4">
            <Flex justify="space-between" align="center" gap="3" wrap="wrap">
              <Heading size="md" color="brand.900">
                {tx("All questions")}
              </Heading>
              {isAdmin && unused.length > 0 && <DeleteUnusedButton count={unused.length} />}
            </Flex>
            <ErrorAlert message={error ? readApiError(error).message : null} />
            {loading && !data ? (
              <Text color="fg.muted">{tx("Loading…")}</Text>
            ) : envelopes.length === 0 ? (
              <Text color="fg.muted" fontSize="sm">
                {isAdmin ? tx("No questions yet. Prepare one set per participant.") : tx("The admin has not written any questions yet.")}
              </Text>
            ) : (
              <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} gap={{ base: "4", md: "6" }}>
                {envelopes.map((e) => (
                  <EnvelopeCard key={e.id} envelope={e} canEdit={isAdmin} onEdit={() => setEditing(e)} />
                ))}
              </SimpleGrid>
            )}
          </Card.Body>
        </Card.Root>
      </Stack>
    </RoleOnly>
  );
}

// The secret link for the tablet on stage. Whoever has it sees who is called and the closed
// envelopes, and can pick one: open it only on the stage tablet. A new link cuts off the old one.
function StageScreenCard() {
  const { data, loading } = useQuery(STAGE_SCREEN_LINK);
  const [regenerate, regenerateState] = useMutation(REGENERATE_STAGE_SCREEN_LINK, {
    refetchQueries: [{ query: STAGE_SCREEN_LINK }],
  });
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();
  const link = data?.stageScreenLink ?? null;

  async function onCreate() {
    if (link && !(await confirmDialog({ title: tx("Create a new link"), message: tx("Create a new stage screen link? The tablet holding the current link stops working at once; open the new link on it."), confirmLabel: tx("Create a new link"), destructive: true }))) {
      return;
    }
    setError(null);
    try {
      await regenerate();
      toaster.create(
        link
          ? { type: "success", title: tx("New link created"), description: tx("The old link no longer works. Open the new one on the stage tablet.") }
          : { type: "success", title: tx("Link created"), description: tx("Open it on the stage tablet.") },
      );
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Card.Root overflow="hidden" borderTopWidth="3px" borderTopColor="brand.800">
      <Card.Body p={{ base: "5", md: "7" }} gap="5">
        <Flex align="center" gap="3">
          <Circle size="10" bg="brand.900" color="gold.300" flexShrink={0}>
            <MonitorSmartphone size={20} aria-hidden />
          </Circle>
          <Box>
            <Heading size="md" color="brand.900">
              {tx("Stage screen")}
            </Heading>
            <Text fontSize="sm" color="fg.muted">
              {tx("Open this link on the tablet on stage. The participant picks their envelope there. It never shows any question: only judges, the admin and staff see them.")}
            </Text>
          </Box>
        </Flex>
        <ErrorAlert message={error} />
        {loading && !data ? (
          <Text color="fg.muted">{tx("Loading…")}</Text>
        ) : !link ? (
          <Box>
            <Button colorPalette="brand" loading={regenerateState.loading} onClick={onCreate}>
              <Plus size={16} aria-hidden />
              {tx("Create the stage screen link")}
            </Button>
          </Box>
        ) : (
          <Stack gap="3">
            <Box
              px="4"
              py="3"
              rounded="lg"
              bg="bg.subtle"
              borderWidth="1px"
              fontFamily="mono"
              fontSize="sm"
              color="brand.900"
              wordBreak="break-all"
            >
              {link.url}
            </Box>
            <Flex gap="2" wrap="wrap">
              <CopyButton value={link.url} colorPalette="brand" size="sm" icon={<Copy size={14} aria-hidden />}>
                {tx("Copy link")}
              </CopyButton>
              <Button asChild size="sm" variant="outline" colorPalette="brand">
                <a href={link.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} aria-hidden />
                  {tx("Open the stage screen")}
                </a>
              </Button>
              <Button size="sm" variant="ghost" colorPalette="red" loading={regenerateState.loading} onClick={onCreate}>
                <RefreshCw size={14} aria-hidden />
                {tx("Create a new link")}
              </Button>
            </Flex>
            <Text fontSize="xs" color="fg.muted">
              {tx("Anyone with this link can pick an envelope for the participant on stage. Open it only on the stage tablet. Link seen by the wrong people? Create a new one.")}
            </Text>
            {isLocalLink(link.url) && (
              <Alert.Root status="warning" size="sm" rounded="lg">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{tx("This link works only on this computer")}</Alert.Title>
                  <Alert.Description>
                    {tx("It starts with “localhost”. Phones need the computer’s network address (testing) or your domain (online). Set FRONTEND_URL in the API’s .env file and restart the API.")}
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function EnvelopeForm() {
  // "surah:ayah" each.
  const [questions, setQuestions] = useState<string[]>(EMPTY);
  const [preview, setPreview] = useState<number | null>(null);
  const setQuestion = (i: number, value: string) => setQuestions((all) => all.map((old, j) => (j === i ? value : old)));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [create, { loading }] = useMutation(CREATE_ENVELOPE, { refetchQueries: [{ query: ENVELOPES }] });
  const { tx } = useI18n();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(null);
    try {
      const res = await create({ variables: { questions } });
      setSaved(res.data?.createEnvelope.number ?? null);
      setQuestions(EMPTY);
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setFieldErrors(apiError.fields);
    }
  }

  return (
    <Card.Root borderTopWidth="3px" borderTopColor="gold.400">
      <Card.Body p={{ base: "5", md: "7" }}>
        <form onSubmit={onSubmit} noValidate>
          <Stack gap="5">
            <Flex align="center" gap="3">
              <Circle size="10" bg="brand.900" color="gold.300" flexShrink={0}>
                <Plus size={20} aria-hidden />
              </Circle>
              <Box>
                <Heading size="md" color="brand.900">
                  {tx("Write new questions")}
                </Heading>
                <Text fontSize="sm" color="fg.muted">
                  {tx("Choose the ayah each question starts from. The participant recites the whole page.")}
                </Text>
              </Box>
            </Flex>
            <ErrorAlert message={error} />
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
              {questions.map((q, i) => (
                <QuestionPicker
                  key={i}
                  index={i}
                  value={q}
                  error={fieldErrors[`questions.${i}`]}
                  previewing={preview === i}
                  onChange={(value) => setQuestion(i, value)}
                  onPreview={() => setPreview((p) => (p === i ? null : i))}
                />
              ))}
            </SimpleGrid>
            {preview !== null && parseRef(questions[preview] ?? "") && (
              <MushafPage key={questions[preview]} start={parseRef(questions[preview]!)!} maxH="50vh" />
            )}
            <Flex gap="3" align="center" wrap="wrap">
              <Button variant="outline" colorPalette="brand" onClick={() => setQuestions(QUESTION_JUZ.map((_, i) => refText(randomRef(i))))}>
                <Dices size={16} aria-hidden />
                {tx("Pick all 3 at random")}
              </Button>
              <Button type="submit" colorPalette="brand" loading={loading} disabled={questions.some((q) => !parseRef(q))}>
                {tx("Save the questions")}
              </Button>
              {saved && (
                <Text fontSize="sm" color="green.600">
                  {tx("Questions {n} are ready.", { n: saved })}
                </Text>
              )}
            </Flex>
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  );
}

// Deletes every envelope not drawn yet, after asking. Drawn ones stay (the server keeps them too).
function DeleteUnusedButton({ count }: { count: number }) {
  const [removeAll, { loading }] = useMutation(DELETE_UNUSED_ENVELOPES, { refetchQueries: [{ query: ENVELOPES }] });
  const { tx } = useI18n();

  async function onClick() {
    const ok = await confirmDialog({
      title: tx("Delete all questions"),
      message: tx("Delete the {n} envelopes not drawn yet? Envelopes already drawn on stage are kept. This cannot be undone.", { n: count }),
      confirmLabel: tx("Delete all"),
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await removeAll();
      toaster.create({ type: "success", title: tx("{n} envelopes deleted", { n: res.data?.deleteUnusedEnvelopes ?? 0 }) });
    } catch (err) {
      toaster.create({ type: "error", title: readApiError(err).message });
    }
  }

  return (
    <Button size="sm" variant="outline" colorPalette="red" loading={loading} onClick={onClick}>
      <Trash2 size={15} aria-hidden />
      {tx("Delete all")}
    </Button>
  );
}

const MAX_RANDOM = 200;

// Many envelopes at once: every question picked at random in its own ten juz (the server also
// avoids giving the same page twice for the same question).
function RandomEnvelopesCard() {
  const [count, setCount] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ from: number; to: number } | null>(null);
  const [create, { loading }] = useMutation(CREATE_RANDOM_ENVELOPES, { refetchQueries: [{ query: ENVELOPES }] });
  const { tx } = useI18n();
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_RANDOM;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setMade(null);
    if (!(await confirmDialog({ message: tx("Create {n} envelopes with random questions?", { n }), confirmLabel: tx("Create") }))) return;
    try {
      const res = await create({ variables: { count: n } });
      const list = res.data?.createRandomEnvelopes ?? [];
      if (list.length) setMade({ from: list[0]!.number, to: list[list.length - 1]!.number });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Card.Root>
      <Card.Body p={{ base: "5", md: "7" }}>
        <form onSubmit={onSubmit} noValidate>
          <Stack gap="4">
            <Flex align="center" gap="3">
              <Circle size="10" bg="gold.400" color="brand.900" flexShrink={0}>
                <Dices size={20} aria-hidden />
              </Circle>
              <Box>
                <Heading size="md" color="brand.900">
                  {tx("Create many envelopes at random")}
                </Heading>
                <Text fontSize="sm" color="fg.muted">
                  {tx("Each envelope gets 3 random ayahs: juz 1–10, juz 11–20 and juz 21–30. Pages already used are avoided.")}
                </Text>
              </Box>
            </Flex>
            <ErrorAlert message={error} />
            <Flex gap="3" align="flex-end" wrap="wrap">
              <Box>
                <chakra.label htmlFor="random-count" fontSize="sm" fontWeight="medium" display="block" mb="1.5">
                  {tx("How many envelopes?")}
                </chakra.label>
                <Input
                  id="random-count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_RANDOM}
                  w="32"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </Box>
              <Button type="submit" colorPalette="brand" loading={loading} disabled={!valid}>
                <Dices size={16} aria-hidden />
                {tx("Create at random")}
              </Button>
            </Flex>
            {!valid && count !== "" && (
              <Text fontSize="sm" color="red.600">
                {tx("Between 1 and {max}.", { max: MAX_RANDOM })}
              </Text>
            )}
            {made && (
              <Text fontSize="sm" color="green.600">
                {tx("Envelopes {from}–{to} are ready.", made)}
              </Text>
            )}
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  );
}

function EnvelopeCard({ envelope: e, canEdit, onEdit }: { envelope: Envelope; canEdit: boolean; onEdit: () => void }) {
  const [remove, { loading }] = useMutation(DELETE_ENVELOPE, { refetchQueries: [{ query: ENVELOPES }] });
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();

  async function onDelete() {
    if (!(await confirmDialog({ message: tx("Delete questions {n}?", { n: e.number }), confirmLabel: tx("Delete"), destructive: true }))) return;
    try {
      await remove({ variables: { id: e.id } });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Stack gap="2.5">
      <EnvelopeFace used={e.used} />
      <Flex justify="flex-end" align="center" gap="2" minH="8">
        {e.used ? (
          <Badge variant="subtle" colorPalette="gray">
            {tx("Used")}
          </Badge>
        ) : !canEdit ? (
          <Badge variant="subtle" colorPalette="green">
            {tx("Available")}
          </Badge>
        ) : (
          <Flex gap="1">
            <IconButton aria-label={tx("Change questions {n}", { n: e.number })} size="xs" variant="ghost" onClick={onEdit}>
              <Pencil size={14} />
            </IconButton>
            <IconButton aria-label={tx("Delete questions {n}", { n: e.number })} size="xs" variant="ghost" colorPalette="red" loading={loading} onClick={onDelete}>
              <Trash2 size={14} />
            </IconButton>
          </Flex>
        )}
      </Flex>
      <ErrorAlert message={error} />
    </Stack>
  );
}
