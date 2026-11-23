"use client";

import { skipToken, useQuery } from "@apollo/client/react";
import { useMemo, useState } from "react";
import { PrintShell, today, ToolbarChoice, upper, usePrintAccess } from "@/components/print/Letterhead";
import { PrintedTable } from "@/components/print/PrintedTable";
import { readApiError } from "@/lib/errors";
import { byPassageOrder } from "@/lib/graphql/judging";
import { PARTICIPANTS, type ParticipantRow } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// The order of passage on the letterhead, to post or hand out on the day: N° 1 first (the admin's
// numbers), the unnumbered after by registration. The tasfia's (every approved participant) or,
// once the admin started the final, the finalists'.
export default function OrderPrintPage() {
  const access = usePrintAccess(["ADMIN", "STAFF", "JUDGE"]);
  const { tx } = useI18n();
  const list = useQuery(PARTICIPANTS, access.allowed ? { variables: { status: null, search: null, review: "APPROVED" } } : skipToken);
  const all = useMemo(() => list.data?.participants ?? [], [list.data]);
  const finalOn = all.some((p) => p.inFinal);
  const [picked, setRound] = useState<"TASFIA" | "FINAL" | null>(null);
  const round = picked ?? (finalOn ? "FINAL" : "TASFIA");
  const rows = useMemo(() => byPassageOrder(round === "FINAL" ? all.filter((p) => p.inFinal) : all), [all, round]);
  const [place, setPlace] = useState("");
  const [title, setTitle] = useState<Partial<Record<string, string>>>({});

  const year = new Date().getFullYear();
  const defaultTitle = round === "FINAL" ? tx("ORDER OF PASSAGE {year}: FINAL", { year }) : tx("ORDER OF PASSAGE {year}: TASFIA", { year });

  return (
    <PrintShell
      name={tx("Order of passage")}
      pdfName={title[round] || defaultTitle}
      back="/order"
      access={access}
      loading={list.loading && !list.data}
      problem={list.error ? readApiError(list.error).message : null}
      empty={rows.length === 0 ? tx("Nobody to list yet.") : null}
      editableHint
      controls={
        finalOn ? (
          <ToolbarChoice
            value={round}
            onChange={setRound}
            options={[
              { value: "TASFIA", label: tx("Tasfia") },
              { value: "FINAL", label: tx("Final") },
            ]}
          />
        ) : null
      }
    >
      <PrintedTable<ParticipantRow>
        rows={rows}
        place={place || `Bujumbura, ${today()}`}
        onPlace={(v) => setPlace(v.trim())}
        title={title[round] || defaultTitle}
        onTitle={(v) => setTitle((t) => ({ ...t, [round]: v.trim() }))}
        subtitle={tx("{n} participants", { n: rows.length })}
        columns={[
          { header: tx("Passage"), width: "16mm", align: "center", bold: true, cell: (_, i) => i + 1 },
          { header: "N°", width: "14mm", align: "center", cell: (p) => p.number ?? "" },
          { header: tx("Full name").toLocaleUpperCase(), width: "minmax(0, 1.6fr)", bold: true, cell: (p) => upper(p.fullName) },
          { header: tx("Madrassa / Markaz").toLocaleUpperCase(), width: "minmax(0, 1.2fr)", cell: (p) => upper(p.institution) },
          { header: tx("Where they live").toLocaleUpperCase(), width: "minmax(0, 1fr)", cell: (p) => upper(p.commune) },
        ]}
      />
    </PrintShell>
  );
}
