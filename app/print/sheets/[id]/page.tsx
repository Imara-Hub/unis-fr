"use client";

import { skipToken, useQuery } from "@apollo/client/react";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { JudgeSheetsDocument, type RoundSheets } from "@/components/print/JudgeSheetsDocument";
import { PrintShell, today, ToolbarChoice, usePrintAccess } from "@/components/print/Letterhead";
import { readApiError } from "@/lib/errors";
import { PARTICIPANT_SHEETS } from "@/lib/graphql/judging";
import { PARTICIPANT } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// A participant's judges' sheets, on the letterhead: one A4 page for the tasfia and, for a
// finalist, one for the final. Admin and staff get every judge's sheet; a judge only their own
// (the server decides).
export default function JudgeSheetsPrintPage() {
  return (
    <Suspense>
      <SheetsPrint />
    </Suspense>
  );
}

type Which = "BOTH" | "TASFIA" | "FINAL";

function SheetsPrint() {
  const { id } = useParams<{ id: string }>();
  const access = usePrintAccess(["ADMIN", "STAFF", "JUDGE"]);
  const { tx } = useI18n();
  const detail = useQuery(PARTICIPANT, access.allowed ? { variables: { id } } : skipToken);
  const p = detail.data?.participant ?? null;
  const tasfia = useQuery(PARTICIPANT_SHEETS, access.allowed ? { variables: { id, round: "TASFIA" } } : skipToken);
  const final = useQuery(PARTICIPANT_SHEETS, access.allowed && p?.inFinal ? { variables: { id, round: "FINAL" } } : skipToken);
  const [which, setWhich] = useState<Which>("BOTH");
  const [place, setPlace] = useState("");
  const [signer, setSigner] = useState<string[] | null>(null);

  const settings = detail.data?.settings;
  const error = detail.error ?? tasfia.error ?? final.error;
  const rounds: RoundSheets[] = [];
  if (p && tasfia.data?.participant && which !== "FINAL") {
    const t = tasfia.data.participant;
    rounds.push({ round: "TASFIA", envelope: t.envelope, sheets: t.sheets, score: p.score });
  }
  if (p?.inFinal && final.data?.participant && which !== "TASFIA") {
    const f = final.data.participant;
    rounds.push({ round: "FINAL", envelope: f.envelope, sheets: f.sheets, score: p.finalScore });
  }
  const lines = signer ?? [tx("The chief judge"), "…………………………………"];

  return (
    <PrintShell
      name={p ? `${tx("Judges’ sheets")} · ${p.fullName}` : tx("Judges’ sheets")}
      pdfName={p ? `${tx("Judges’ sheets")} - ${p.fullName}` : tx("Judges’ sheets")}
      back={`/participants/${id}`}
      access={access}
      loading={detail.loading || tasfia.loading || final.loading}
      problem={error ? readApiError(error).message : !p && detail.data ? tx("This participant does not exist (anymore).") : null}
      empty={rounds.length === 0 ? tx("Has not drawn an envelope yet.") : null}
      editableHint
      controls={
        p?.inFinal ? (
          <ToolbarChoice
            value={which}
            onChange={setWhich}
            options={[
              { value: "BOTH", label: tx("Tasfia and final") },
              { value: "TASFIA", label: tx("Tasfia") },
              { value: "FINAL", label: tx("Final") },
            ]}
          />
        ) : null
      }
    >
      {p && (
        <JudgeSheetsDocument
          participant={p}
          rounds={rounds}
          judgeCount={settings?.judgeCount ?? 4}
          maxScore={settings?.maxScore ?? 100}
          place={place || `Bujumbura, ${today()}`}
          onPlace={(v) => setPlace(v.trim())}
          signer={lines}
          onSigner={(i, v) => setSigner(lines.map((line, k) => (k === i ? v : line)))}
        />
      )}
    </PrintShell>
  );
}
