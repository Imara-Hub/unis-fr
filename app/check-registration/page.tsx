"use client";

import { useLazyQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CompetitionBand } from "@/components/brand/CompetitionTitle";
import { FormField } from "@/components/FormField";
import { readApiError } from "@/lib/errors";
import { REGISTRATION_LOOKUP, type PublicRegistration } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

const banner = <CompetitionBand />;

// Public: someone who registered (or their parent / school) types the name to see whether the
// organisers accepted the registration. Never the reason of a refusal.
export default function CheckRegistrationPage() {
  const { t, apiError } = useI18n();
  const tr = t.registration;
  const [name, setName] = useState("");
  const [lookup, { data, loading, error, called }] = useLazyQuery(REGISTRATION_LOOKUP, { fetchPolicy: "network-only" });
  const err = error ? apiError(readApiError(error)) : null;
  const matches = data?.registrationLookup;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) void lookup({ variables: { name: name.trim() } });
  }

  return (
    <AuthCard top={banner} eyebrow={tr.eyebrow} title={tr.title} subtitle={tr.subtitle}>
      <Stack gap="5">
        <form onSubmit={submit} noValidate>
          <Stack gap="3">
            <FormField label={t.results.nameLabel} helper={t.results.nameHelp} error={err?.fields?.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Amina Ndayishimiye" />
            </FormField>
            <Button type="submit" colorPalette="brand" size="lg" loading={loading} disabled={!name.trim()}>
              <Search size={18} aria-hidden />
              {tr.search}
            </Button>
          </Stack>
        </form>

        {err && !err.fields?.name && <ErrorAlert message={err.message} />}

        {called && !loading && matches && (
          <Box animation="fade-in 0.3s ease-out">
            {matches.length === 0 ? (
              <Text color="fg.muted" textAlign="center">
                {tr.noMatch}
              </Text>
            ) : (
              <Stack gap="3">
                {matches.map((m, i) => (
                  <RegistrationCard key={i} registration={m} />
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    </AuthCard>
  );
}

function RegistrationCard({ registration: r }: { registration: PublicRegistration }) {
  const tr = useI18n().t.registration;
  const tone = r.review === "APPROVED" ? "green" : r.review === "REJECTED" ? "red" : "orange";
  return (
    <Card.Root variant="outline" borderLeftWidth="4px" borderLeftColor={`${tone}.500`}>
      <Card.Body p="4" gap="2">
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Box minW="0">
            <Text fontWeight="semibold" color="brand.900">
              {r.fullName}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {r.institution}
            </Text>
          </Box>
          <Badge colorPalette={tone} size="lg">
            {r.review === "APPROVED" ? tr.approved : r.review === "REJECTED" ? tr.rejected : tr.pending}
          </Badge>
        </Flex>
        <Text fontSize="sm" color="fg.muted">
          {r.review === "APPROVED" ? tr.approvedHelp : r.review === "REJECTED" ? tr.rejectedHelp : tr.pendingHelp}
        </Text>
        {r.number !== null && (
          <Text fontSize="sm" fontWeight="semibold" color="brand.900">
            {tr.number(r.number)}
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}
