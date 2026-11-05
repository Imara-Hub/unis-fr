"use client";

import { useLazyQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { Search } from "lucide-react";
import NextImage from "next/image";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FormField } from "@/components/FormField";
import { readApiError } from "@/lib/errors";
import { RESULT_LOOKUP, type PublicResult } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

const banner = (
  <Box mx={{ base: "-1", md: "0" }}>
    <NextImage
      src="/form-banner.png"
      alt="Grand concours de mémorisation du Saint Coran au Burundi, 7e édition, 1448 H – 2027 M"
      width={1600}
      height={285}
      priority
      style={{ width: "100%", height: "auto" }}
    />
  </Box>
);

// Public: a participant (or their parent / school) types the name to see if they passed.
export default function ResultsPage() {
  const { t, apiError } = useI18n();
  const tr = t.results;
  const [name, setName] = useState("");
  const [lookup, { data, loading, error, called }] = useLazyQuery(RESULT_LOOKUP, { fetchPolicy: "network-only" });
  const err = error ? apiError(readApiError(error)) : null;
  const result = data?.resultLookup;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) void lookup({ variables: { name: name.trim() } });
  }

  return (
    <AuthCard top={banner} eyebrow={tr.eyebrow} title={tr.title} subtitle={tr.subtitle}>
      <Stack gap="5">
        <form onSubmit={submit} noValidate>
          <Stack gap="3">
            <FormField label={tr.nameLabel} helper={tr.nameHelp} error={err?.fields?.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Amina Ndayishimiye" />
            </FormField>
            <Button type="submit" colorPalette="brand" size="lg" loading={loading} disabled={!name.trim()}>
              <Search size={18} aria-hidden />
              {tr.search}
            </Button>
          </Stack>
        </form>

        {err && !err.fields?.name && <ErrorAlert message={err.message} />}

        {called && !loading && result && (
          <Box animation="fade-in 0.3s ease-out">
            {!result.published ? (
              <Text color="fg.muted" textAlign="center">
                {tr.notPublished}
              </Text>
            ) : result.matches.length === 0 ? (
              <Text color="fg.muted" textAlign="center">
                {tr.noMatch}
              </Text>
            ) : (
              <Stack gap="3">
                {result.matches.map((m, i) => (
                  <ResultCard key={i} result={m} />
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    </AuthCard>
  );
}

function ResultCard({ result: r }: { result: PublicResult }) {
  const tr = useI18n().t.results;
  const tone = r.status === "PASSED" ? "green" : r.status === "FAILED" ? "red" : "gray";
  return (
    <Card.Root variant="outline" borderLeftWidth="4px" borderLeftColor={`${tone}.500`}>
      <Card.Body p="4">
        <Flex justify="space-between" align="center" gap="3" wrap="wrap">
          <Box minW="0">
            <Text fontWeight="semibold" color="brand.900">
              {r.fullName}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {r.institution}
            </Text>
          </Box>
          <Stack gap="1" align="flex-end">
            <Badge colorPalette={tone} size="lg">
              {r.status === "PASSED" ? tr.passed : r.status === "FAILED" ? tr.failed : tr.pending}
            </Badge>
            {r.score !== null && (
              <Text fontSize="sm" color="fg.muted">
                {tr.score(r.score)}
              </Text>
            )}
          </Stack>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}
