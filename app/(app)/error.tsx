"use client";

import { useEffect } from "react";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { useI18n } from "@/lib/i18n";

// A page crashed while showing: keep the rest of the app usable and offer a retry
// instead of a blank screen.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const { tx } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ServerUnreachable
      title={tx("Something went wrong on this page")}
      message={tx("Try again. If it keeps happening, reload the page.")}
      onRetry={retry}
    />
  );
}
