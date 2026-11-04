"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Box, Button, Card, Field, Flex, Heading, Link, Skeleton, Stack, Switch, Text, Textarea } from "@chakra-ui/react";
import NextLink from "next/link";
import { useState } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PageBanner } from "@/components/PageBanner";
import { ShareLink } from "@/components/ShareLink";
import { readApiError } from "@/lib/errors";
import { GREETING } from "@/lib/greeting";
import { formatDateTime } from "@/lib/dates";
import { PARTICIPANT_COUNTS } from "@/lib/graphql/participants";
import {
  REGENERATE_REGISTRATION_LINK,
  REGISTRATION_LINK,
  REGISTRATION_TERMS,
  SET_REGISTRATION_OPEN,
  UPDATE_REGISTRATION_TERMS,
} from "@/lib/graphql/registration";
import { useI18n } from "@/lib/i18n";

const MAX_TERMS_LENGTH = 20_000;

export default function RegistrationLinkPage() {
  const { data, loading, error } = useQuery(REGISTRATION_LINK);
  const terms = useQuery(REGISTRATION_TERMS);
  const counts = useQuery(PARTICIPANT_COUNTS);
  const link = data?.registrationLink;
  const c = counts.data?.participantCounts;
  const noTerms = !terms.loading && !terms.data?.registrationTerms;
  const { tx } = useI18n();

  return (
    <AdminOnly>
      <PageBanner
        eyebrow={tx("Registration")}
        status={
          loading
            ? undefined
            : !link
              ? { label: tx("No link yet"), tone: "neutral" }
              : noTerms
                ? { label: tx("Write the terms first"), tone: "bad" }
                : link.isOpen
                  ? { label: tx("Registration open"), tone: "good" }
                  : { label: tx("Registration closed"), tone: "bad" }
        }
        title={tx("Registration link")}
        description={tx("One link for everyone. Anyone with it can register after accepting your terms and conditions; you then approve or reject each registration.")}
        stats={[
          { label: tx("Awaiting review"), value: c?.awaitingReview ?? undefined },
          { label: tx("Approved"), value: c?.total },
        ]}
      />

      {loading ? (
        <Skeleton h="64" rounded="lg" />
      ) : error ? (
        <ErrorAlert message={readApiError(error).message} />
      ) : (
        <Stack gap={{ base: "6", md: "8" }}>
          <LinkSections hasLink={Boolean(link)} noTerms={noTerms} />
          <TermsCard />
        </Stack>
      )}
    </AdminOnly>
  );
}

function LinkSections({ hasLink, noTerms }: { hasLink: boolean; noTerms: boolean }) {
  const { data } = useQuery(REGISTRATION_LINK);
  const counts = useQuery(PARTICIPANT_COUNTS);
  const [regenerate, regenerateState] = useMutation(REGENERATE_REGISTRATION_LINK, {
    refetchQueries: [{ query: REGISTRATION_LINK }],
  });
  const [setOpen, setOpenState] = useMutation(SET_REGISTRATION_OPEN);
  const [actionError, setActionError] = useState<string | null>(null);
  const link = data?.registrationLink;
  const awaiting = counts.data?.participantCounts.awaitingReview ?? 0;
  const { tx } = useI18n();

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(readApiError(err).message);
    }
  }

  function onRegenerate() {
    const ok = window.confirm(tx("Create a new link? The current link stops working immediately; you will need to share the new one."));
    if (ok) void run(() => regenerate());
  }

  const hint = noTerms ? (
    <Text fontSize="sm" color="red.600">
      {tx("Nobody can register until you write the terms and conditions below.")}
    </Text>
  ) : (
    <Text fontSize="sm" color="fg.muted">
      {awaiting === 0
        ? tx("No registration is waiting for your review.")
        : awaiting === 1
          ? tx("1 registration is waiting for your review.")
          : tx("{n} registrations are waiting for your review.", { n: awaiting })}{" "}
      <Link asChild colorPalette="brand" fontWeight="semibold">
        <NextLink href="/registrations">{tx("Review registrations")}</NextLink>
      </Link>
    </Text>
  );

  if (!hasLink || !link) {
    return (
      <Card.Root>
        <Card.Body p={{ base: "6", md: "8" }}>
          <Stack gap="4" align="center" textAlign="center" py="6">
            <Text color="gold.400" fontSize="4xl" lineHeight="1" aria-hidden>
              ۞
            </Text>
            <Heading size="lg" color="brand.900">
              {tx("No link yet")}
            </Heading>
            <Text color="fg.muted" maxW="md">
              {tx("Create the link, then share it with the participants in their WhatsApp group.")}
            </Text>
            <ErrorAlert message={actionError} />
            <Button colorPalette="brand" size="lg" loading={regenerateState.loading} onClick={() => run(() => regenerate())}>
              {tx("Create the link")}
            </Button>
            {hint}
          </Stack>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <>
      <ErrorAlert message={actionError} />

      {/* The link */}
      <Card.Root>
        <Card.Body p={{ base: "5", md: "7" }}>
          <Stack gap="5">
            <Box>
              <Heading size="md" color="brand.900">
                {tx("Share this link")}
              </Heading>
              <Text fontSize="sm" color="fg.muted">
                {tx("Post it in the WhatsApp group, or let people scan the code with their phone camera.")}
              </Text>
            </Box>
            <ShareLink url={link.url} message={`${GREETING}! ${tx("Register for the Quran competition (Musabaqa) with this link:")}`} qr />
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Open / closed */}
      <Card.Root>
        <Card.Body p={{ base: "5", md: "7" }}>
          <Stack gap="4">
            <Flex justify="space-between" align="center" gap="4">
              <Box>
                <Heading size="md" color="brand.900">
                  {tx("Accept registrations")}
                </Heading>
                <Text fontSize="sm" color="fg.muted">
                  {link.isOpen
                    ? tx("Open: anyone with the link can register now. Close it when you are not expecting registrations.")
                    : tx("Closed: the link shows “Registration is closed”. The link stays the same when you open it again.")}
                </Text>
              </Box>
              <Switch.Root
                colorPalette="green"
                size="lg"
                checked={link.isOpen}
                disabled={setOpenState.loading}
                onCheckedChange={(e) => run(() => setOpen({ variables: { open: e.checked } }))}
              >
                <Switch.HiddenInput aria-label={tx("Accept registrations")} />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </Flex>
            <Box pt="4" borderTopWidth="1px">
              {hint}
            </Box>
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* New link */}
      <Card.Root borderColor="red.200">
        <Card.Body p={{ base: "5", md: "7" }}>
          <Stack gap="3" align="flex-start">
            <Heading size="sm">{tx("Link shared with the wrong people?")}</Heading>
            <Text fontSize="sm" color="fg.muted">
              {tx("Create a new link. The old one stops working immediately. Participants who already registered are not affected.")}
            </Text>
            <Button size="sm" variant="outline" colorPalette="red" loading={regenerateState.loading} onClick={onRegenerate}>
              {tx("Create a new link")}
            </Button>
          </Stack>
        </Card.Body>
      </Card.Root>
    </>
  );
}

// The terms and conditions shown on the form. Registrants must accept them; you check each
// registration against them. Changing the text makes forms opened before ask to accept again.
function TermsCard() {
  const { data, loading } = useQuery(REGISTRATION_TERMS);
  const [save, saveState] = useMutation(UPDATE_REGISTRATION_TERMS, { refetchQueries: [{ query: REGISTRATION_TERMS }] });
  const saved = data?.registrationTerms ?? null;
  // null = not edited yet: show what is saved.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [justSaved, setJustSaved] = useState(false);
  const { tx } = useI18n();

  const text = draft ?? saved?.text ?? "";
  const changed = text.trim() !== (saved?.text ?? "");

  async function onSave() {
    setError(null);
    setFieldError(undefined);
    setJustSaved(false);
    if (!text.trim()) {
      setFieldError(tx("Write the terms first"));
      return;
    }
    try {
      await save({ variables: { text } });
      setDraft(null);
      setJustSaved(true);
    } catch (err) {
      const apiError = readApiError(err);
      setError(apiError.message);
      setFieldError(apiError.fields.text);
    }
  }

  return (
    <Card.Root borderColor={!loading && !saved ? "red.300" : undefined} borderWidth={!loading && !saved ? "2px" : "1px"}>
      <Card.Body p={{ base: "5", md: "7" }}>
        <Stack gap="4">
          <Box>
            <Heading size="md" color="brand.900">
              {tx("Terms and conditions")}
            </Heading>
            <Text fontSize="sm" color="fg.muted">
              {tx("Shown on the registration form; people must accept them to register. Write who may take part (age, documents, behaviour…), then approve or reject each registration against them.")}
            </Text>
          </Box>

          {loading ? (
            <Skeleton h="40" rounded="md" />
          ) : (
            <>
              <ErrorAlert message={error} />
              <Field.Root invalid={Boolean(fieldError)}>
                <Textarea
                  value={text}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setJustSaved(false);
                  }}
                  rows={10}
                  maxLength={MAX_TERMS_LENGTH}
                  placeholder={tx("1. Participants are 29 years old or younger.\n2. A clear passport photo and ID document are required.\n3. …")}
                  bg="white"
                />
                <Field.ErrorText>{fieldError}</Field.ErrorText>
              </Field.Root>
              <Flex gap="3" align="center" wrap="wrap">
                <Button colorPalette="brand" onClick={onSave} loading={saveState.loading} disabled={!changed}>
                  {saved ? tx("Save changes") : tx("Save the terms")}
                </Button>
                {changed && saved && (
                  <Button variant="ghost" onClick={() => setDraft(null)}>
                    {tx("Undo changes")}
                  </Button>
                )}
                <Text fontSize="sm" color={justSaved ? "green.600" : "fg.muted"}>
                  {justSaved
                    ? tx("Saved.")
                    : saved
                      ? saved.updatedAt
                        ? tx("Version {n}, saved {date}.", { n: saved.version, date: formatDateTime(saved.updatedAt) })
                        : tx("Version {n}.", { n: saved.version })
                      : tx("Not written yet: registration is blocked.")}
                </Text>
              </Flex>
              {saved && changed && (
                <Text fontSize="xs" color="fg.muted">
                  {tx("Saving creates version {n}. People who already registered keep the version they accepted; anyone filling in the form right now is asked to accept the new text.", { n: saved.version + 1 })}
                </Text>
              )}
            </>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}
