"use client";

import { skipToken, useQuery } from "@apollo/client/react";
import { useMemo, useState } from "react";
import { PrintShell, scoreText, today, ToolbarChoice, upper, usePrintAccess } from "@/components/print/Letterhead";
import { PrintedTable } from "@/components/print/PrintedTable";
import { STATUS_LABELS } from "@/components/StatusBadge";
import { readApiError } from "@/lib/errors";
import { PARTICIPANTS, type ParticipantRow } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

type Who = "ALL" | "PASSED" | "FAILED" | "PENDING";

// The approved participants on the letterhead, by name A–Z: number, name, madrassa, where they
// live, the tasfia score and the result. All of them, or only one result.
export default function ParticipantsPrintPage() {
  const access = usePrintAccess(["ADMIN", "STAFF"]);
  const { tx } = useI18n();
  const list = useQuery(PARTICIPANTS, access.allowed ? { variables: { status: null, search: null, review: "APPROVED" } } : skipToken);
  const [who, setWho] = useState<Who>("ALL");
  const rows = useMemo(
    () =>
      (list.data?.participants ?? [])
        .filter((p) => who === "ALL" || p.status === who)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })),
    [list.data, who],
  );
  const [place, setPlace] = useState("");
  const [titles, setTitles] = useState<Partial<Record<Who, string>>>({});

  const year = new Date().getFullYear();
  const defaultTitle = tx("PARTICIPANTS {year}", { year });
  const title = titles[who] || defaultTitle;
  const result = (p: ParticipantRow) => (p.inFinal || p.finalist ? tx("Final") : tx(STATUS_LABELS[p.status]));

  return (
    <PrintShell
      name={tx("Participants list")}
      pdfName={title}
      back="/participants"
      access={access}
      loading={list.loading && !list.data}
      problem={list.error ? readApiError(list.error).message : null}
      empty={rows.length === 0 ? tx("Nobody to list yet.") : null}
      editableHint
      controls={
        <ToolbarChoice
          value={who}
          onChange={setWho}
          options={[
            { value: "ALL", label: tx("All") },
            { value: "PASSED", label: tx("Passed") },
            { value: "FAILED", label: tx("Failed") },
            { value: "PENDING", label: tx("Not judged") },
          ]}
        />
      }
    >
      <PrintedTable<ParticipantRow>
        rows={rows}
        place={place || `Bujumbura, ${today()}`}
        onPlace={(v) => setPlace(v.trim())}
        title={title}
        onTitle={(v) => setTitles((t) => ({ ...t, [who]: v.trim() }))}
        subtitle={tx("{n} participants", { n: rows.length })}
        columns={[
          { header: "#", width: "11mm", align: "center", cell: (_, i) => i + 1 },
          { header: "N°", width: "13mm", align: "center", cell: (p) => p.number ?? "" },
          { header: tx("Full name").toLocaleUpperCase(), width: "minmax(0, 1.5fr)", bold: true, cell: (p) => upper(p.fullName) },
          { header: tx("Madrassa / Markaz").toLocaleUpperCase(), width: "minmax(0, 1.1fr)", cell: (p) => upper(p.institution) },
          { header: tx("Where they live").toLocaleUpperCase(), width: "minmax(0, 0.9fr)", cell: (p) => upper(p.commune) },
          { header: tx("Points"), width: "17mm", align: "end", bold: true, cell: (p) => (p.score === null ? "—" : scoreText(p.score)) },
          { header: tx("Result"), width: "22mm", align: "center", cell: result },
        ]}
      />
    </PrintShell>
  );
}
