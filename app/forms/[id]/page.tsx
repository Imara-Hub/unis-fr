"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PrintableForm } from "@/components/PrintableForm";

// A participant's registration form, as on paper: to view, print or save as PDF, and to approve or
// reject (admin only). ?review=1 = reviewing one by one: the next waiting one opens after a decision.
export default function ParticipantFormPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}

function Form() {
  const { id } = useParams<{ id: string }>();
  const queue = useSearchParams().get("review") === "1";
  return <PrintableForm id={id} queue={queue} />;
}
