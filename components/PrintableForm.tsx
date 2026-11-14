"use client";

import { useQuery } from "@apollo/client/react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { ArrowLeft, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PrintStyles, RegistrationSheet } from "@/components/RegistrationSheet";
import { ReviewActions } from "@/components/ReviewActions";
import { toaster } from "@/components/Toaster";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { PARTICIPANT, PARTICIPANTS } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// The registration form on its own page, outside the dashboard so only the form is printed.
// id = a participant's form, filled in; null = a blank form to print and fill in by hand.
// queue = reviewing one by one: after a decision the next waiting registration opens by itself.
export function PrintableForm({ id, queue = false }: { id: string | null; queue?: boolean }) {
  const router = useRouter();
  const me = useQuery(ME);
  const role = me.data?.me?.role;
  const { data, loading, error } = useQuery(PARTICIPANT, { variables: { id: id ?? "" }, skip: !id || role !== "ADMIN" });
  const { tx } = useI18n();
  const participant = data?.participant ?? null;

  // The registrations waiting for review, oldest first (the order of the review list).
  const waiting = useQuery(PARTICIPANTS, {
    variables: { review: "PENDING_REVIEW" },
    skip: !queue || role !== "ADMIN",
    fetchPolicy: "cache-and-network",
  });
  const ids = useMemo(
    () =>
      [...(waiting.data?.participants ?? waiting.previousData?.participants ?? [])]
        .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
        .map((p) => p.id),
    [waiting.data, waiting.previousData],
  );
  const position = id ? ids.indexOf(id) : -1;
  const open = (next: string) => router.replace(`/forms/${next}?review=1`);

  // Decided: on to the next one waiting (after this one, else the first left), or back to the list.
  function next() {
    const after = ids.slice(position + 1).find((x) => x !== id) ?? ids.find((x) => x !== id);
    void waiting.refetch();
    if (after) open(after);
    else {
      toaster.create({ type: "success", title: tx("All registrations are reviewed") });
      router.replace("/registrations");
    }
  }

  // The PDF is saved under the page title: "Registration form - Amina Ndayishimiye".
  useEffect(() => {
    const before = document.title;
    document.title = participant
      ? `${tx("Registration form")} - ${participant.number !== null ? `N° ${participant.number} - ` : ""}${participant.fullName}`
      : tx("Registration form");
    return () => {
      document.title = before;
    };
  }, [participant, tx]);

  const loggedOut = !me.loading && !me.error && !me.data?.me;
  useEffect(() => {
    if (loggedOut) router.replace("/login");
  }, [loggedOut, router]);

  if (me.loading || loggedOut || (id && loading && !data)) return <FullPageSpinner />;

  let problem: string | null = null;
  if (me.error) problem = readApiError(me.error).message;
  else if (role !== "ADMIN") problem = tx("You do not have access to this page.");
  else if (error) problem = readApiError(error).message;
  else if (id && !participant) problem = tx("This participant does not exist (anymore).");

  return (
    <Box minH="100dvh" bg="#E9EBF2">
      <PrintStyles />
      <Flex
        className="no-print"
        position="sticky"
        top="0"
        zIndex="docked"
        bg="white"
        borderBottomWidth="1px"
        px={{ base: "4", md: "8" }}
        py="3"
        gap="3"
        align="center"
        wrap="wrap"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (queue || history.length <= 1 ? router.push("/registrations") : router.back())}
        >
          <ArrowLeft size={16} aria-hidden />
          {tx("Back")}
        </Button>
        <Text flex="1" minW="40" fontWeight="semibold" color="brand.900" truncate>
          {participant
            ? `${tx("Registration form")} · ${participant.number !== null ? `N° ${participant.number} · ` : ""}${participant.fullName}`
            : tx("Blank registration form")}
        </Text>
        {/* One by one: where we are in the queue, and the way back and forth. */}
        {queue && ids.length > 0 && (
          <Flex align="center" gap="1">
            <Button variant="outline" size="sm" aria-label={tx("Previous")} disabled={position <= 0} onClick={() => open(ids[position - 1])}>
              <ChevronLeft size={16} aria-hidden />
            </Button>
            <Text fontSize="sm" color="fg.muted" px="2" whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
              {position >= 0
                ? tx("{n} of {total} waiting", { n: position + 1, total: ids.length })
                : tx("{total} waiting", { total: ids.length })}
            </Text>
            <Button
              variant="outline"
              size="sm"
              aria-label={tx("Next")}
              disabled={position === ids.length - 1}
              onClick={() => open(ids[position + 1] ?? ids[0])}
            >
              <ChevronRight size={16} aria-hidden />
            </Button>
          </Flex>
        )}
        {!problem && (
          <Button colorPalette="brand" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={16} aria-hidden />
            {tx("Print or save as PDF")}
          </Button>
        )}
      </Flex>

      {problem ? (
        <Box maxW="lg" mx="auto" p="6">
          <ErrorAlert message={problem} />
        </Box>
      ) : (
        <>
          <Text className="no-print" textAlign="center" fontSize="sm" color="fg.muted" pt="4" px="4">
            {tx("To get a PDF, press “Print or save as PDF”, then choose “Save as PDF” as the printer.")}
          </Text>
          {/* A4 at its real size; on a phone, scroll sideways. */}
          <Box className="sheet-frame" overflowX="auto" py={{ base: "4", md: "8" }} px="4">
            <RegistrationSheet participant={participant} />
          </Box>
          {/* After reading the form: approve or reject it right here (not printed). */}
          {participant && (
            <Box className="no-print" px="4" pb="10">
              <ReviewActions key={participant.id} participant={participant} onDecided={queue ? next : undefined} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
