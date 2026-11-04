"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Alert, Badge, Box, Button, Card, Circle, Flex, Heading, IconButton, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Copy, ExternalLink, Lock, Mail, MailOpen, MonitorSmartphone, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RoleOnly } from "@/components/AdminOnly";
import { CopyButton } from "@/components/CopyButton";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { PageBanner } from "@/components/PageBanner";
import { isLocalLink } from "@/components/ShareLink";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import {
  CREATE_ENVELOPE,
  DELETE_ENVELOPE,
  ENVELOPES,
  REGENERATE_STAGE_SCREEN_LINK,
  STAGE_SCREEN_LINK,
  UPDATE_ENVELOPE,
  type Envelope,
} from "@/lib/graphql/judging";
import { useI18n } from "@/lib/i18n";

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
        eyebrow={tx("Questions")}
        title={tx("Envelopes")}
        description={
          isAdmin
            ? tx("Write the envelopes here: 3 questions each. On stage, the participant picks one closed envelope on the stage screen; it is then used and leaves the draw.")
            : tx("The admin prepares the envelopes. Their questions stay sealed until a participant draws one.")
        }
        stats={[
          { label: tx("Envelopes"), value: data ? envelopes.length : undefined },
          { label: tx("Still in the draw"), value: data ? unused.length : undefined },
          { label: tx("Drawn"), value: data ? envelopes.length - unused.length : undefined },
        ]}
      />
      <Stack gap={{ base: "6", md: "8" }}>
        {isAdmin && <StageScreenCard />}
        {isAdmin && <EnvelopeForm key={editing?.id ?? "new"} editing={editing} onDone={() => setEditing(null)} />}

        <Card.Root>
          <Card.Body p={{ base: "5", md: "7" }} gap="4">
            <Heading size="md" color="brand.900">
              {tx("All envelopes")}
            </Heading>
            <ErrorAlert message={error ? readApiError(error).message : null} />
            {loading && !data ? (
              <Text color="fg.muted">{tx("Loading…")}</Text>
            ) : envelopes.length === 0 ? (
              <Text color="fg.muted" fontSize="sm">
                {isAdmin ? tx("No envelopes yet. Prepare at least one per participant.") : tx("The admin has not prepared any envelope yet.")}
              </Text>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="4">
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
    if (link && !window.confirm(tx("Create a new stage screen link? The tablet holding the current link stops working at once; open the new link on it."))) {
      return;
    }
    setError(null);
    try {
      await regenerate();
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

function EnvelopeForm({ editing, onDone }: { editing: Envelope | null; onDone: () => void }) {
  const [questions, setQuestions] = useState<string[]>(editing ? [...editing.questions] : EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [create, createState] = useMutation(CREATE_ENVELOPE, { refetchQueries: [{ query: ENVELOPES }] });
  const [update, updateState] = useMutation(UPDATE_ENVELOPE);
  const { tx } = useI18n();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(null);
    try {
      if (editing) {
        await update({ variables: { id: editing.id, questions } });
        onDone();
      } else {
        const res = await create({ variables: { questions } });
        setSaved(res.data?.createEnvelope.number ?? null);
        setQuestions(EMPTY);
      }
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
                {editing ? <Pencil size={18} aria-hidden /> : <Plus size={20} aria-hidden />}
              </Circle>
              <Box>
                <Heading size="md" color="brand.900">
                  {editing ? tx("Change envelope {n}", { n: editing.number }) : tx("Prepare a new envelope")}
                </Heading>
                <Text fontSize="sm" color="fg.muted">
                  {tx("Write where each question starts, e.g. “An-Naba 1–10”.")}
                </Text>
              </Box>
            </Flex>
            <ErrorAlert message={error} />
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
              {questions.map((q, i) => (
                <FormField key={i} label={tx("Question {n}", { n: i + 1 })} error={fieldErrors[`questions.${i}`]}>
                  <Input
                    value={q}
                    placeholder={["An-Naba 1–10", "Abasa 1–16", "At-Takwir 1–14"][i]}
                    onChange={(e) => setQuestions((all) => all.map((old, j) => (j === i ? e.target.value : old)))}
                  />
                </FormField>
              ))}
            </SimpleGrid>
            <Flex gap="3" align="center" wrap="wrap">
              <Button
                type="submit"
                colorPalette="brand"
                loading={createState.loading || updateState.loading}
                disabled={questions.some((q) => q.trim().length < 2)}
              >
                {editing ? tx("Save changes") : tx("Seal the envelope")}
              </Button>
              {editing && (
                <Button variant="ghost" onClick={onDone}>
                  {tx("Cancel")}
                </Button>
              )}
              {saved && (
                <Text fontSize="sm" color="green.600">
                  {tx("Envelope {n} is ready.", { n: saved })}
                </Text>
              )}
            </Flex>
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
    if (!window.confirm(tx("Delete envelope {n}?", { n: e.number }))) return;
    try {
      await remove({ variables: { id: e.id } });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  return (
    <Box rounded="xl" borderWidth="1px" p="4" bg={e.used ? "bg.subtle" : "white"} opacity={e.used ? 0.8 : 1}>
      <Flex justify="space-between" align="center" mb="3" gap="2">
        <Flex align="center" gap="2">
          <Box color={e.used ? "fg.muted" : "gold.600"}>{e.used ? <MailOpen size={18} aria-hidden /> : <Mail size={18} aria-hidden />}</Box>
          <Text fontWeight="semibold" color="brand.900">
            {tx("Envelope {n}", { n: e.number })}
          </Text>
        </Flex>
        {e.used ? (
          <Badge variant="subtle" colorPalette="gray">
            {tx("Drawn")}
          </Badge>
        ) : !canEdit ? (
          <Badge variant="subtle" colorPalette="gold">
            {tx("Sealed")}
          </Badge>
        ) : (
          <Flex gap="1">
            <IconButton aria-label={tx("Change envelope {n}", { n: e.number })} size="xs" variant="ghost" onClick={onEdit}>
              <Pencil size={14} />
            </IconButton>
            <IconButton aria-label={tx("Delete envelope {n}", { n: e.number })} size="xs" variant="ghost" colorPalette="red" loading={loading} onClick={onDelete}>
              <Trash2 size={14} />
            </IconButton>
          </Flex>
        )}
      </Flex>
      {e.questions.length === 0 && (
        <Flex align="center" gap="2" color="fg.muted" fontSize="sm">
          <Lock size={14} aria-hidden />
          {tx("Questions hidden until drawn")}
        </Flex>
      )}
      <Stack gap="1.5" as="ol">
        {e.questions.map((q, i) => (
          <Flex as="li" key={i} gap="2" fontSize="sm">
            <Text color="fg.subtle" w="4">
              {i + 1}.
            </Text>
            <Text>{q}</Text>
          </Flex>
        ))}
      </Stack>
      {e.usedBy && (
        <Text fontSize="xs" color="fg.muted" mt="3">
          {tx("Drawn by {name}", { name: e.usedBy.fullName })}
        </Text>
      )}
      <ErrorAlert message={error} />
    </Box>
  );
}
