"use client";

import { Button, Stack, Text, type ButtonProps } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/api";
import { NETWORK_ERROR } from "@/lib/errors";
import { localizeError } from "@/lib/i18n/core";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

const STATUS_MESSAGES: Record<number, AppKey> = {
  401: "Your session has ended. Log in again, then download the PDF.",
  403: "You do not have access to the results.",
};

// Downloads the results PDF. Fetched first (with the login cookie), so an ended session shows
// a message here instead of saving an error file as "results.pdf".
export function ExportResultsButton({ children, ...props }: Omit<ButtonProps, "onClick"> & { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const { tx } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/exports/results.pdf"), { credentials: "include" });
      if (!res.ok) {
        setError(tx(STATUS_MESSAGES[res.status] ?? "The PDF could not be made. Try again."));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `musabaqa-results-${new Date().toLocaleDateString("en-CA")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(localizeError(NETWORK_ERROR).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="1" align="flex-end">
      <Button {...props} loading={loading} onClick={download}>
        {children}
      </Button>
      {error && (
        <Text fontSize="xs" color="red.500" bg="white" px="2" py="0.5" rounded="sm" role="alert" maxW="xs" textAlign="end">
          {error}
        </Text>
      )}
    </Stack>
  );
}
