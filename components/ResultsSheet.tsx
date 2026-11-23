"use client";

import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import { INK, LetterheadPage, LetterheadTop, paginate as paginateRows, scoreText as score, SignatureBlock, upper } from "@/components/print/Letterhead";
import type { RankedRow, Rankable } from "@/components/RankingTable";

// The official results sheet (A4): the place and date, the competition banner, a title, the ranked
// table, the leader's signature block and the contact footer. Long lists continue on more pages
// (the footer on each one; the title on the first, the signature on the last). Printing it, or "Save as PDF", gives those pages.


export type SheetRow = RankedRow<Rankable & { province: string }>;

export interface SheetTexts {
  place: string; // "Bujumbura, 19/11/2026"
  title: string;
  signer: string[]; // the lines above the signature
  columns: { name: string; score: string; lives: string; institution: string };
}

// Rows per page. One page holds the banner, the title, 20 rows and the signature (the 20
// finalists on a single A4). Longer lists: the first page fills up without the signature, the
// pages after hold more, and the last keeps room for the signature.
const ONLY_PAGE = 20;
const FIRST_PAGE = 26;
const OTHER_PAGE = 34;
const LAST_PAGE = 28;

const paginate = <T,>(rows: T[]) => paginateRows(rows, { only: ONLY_PAGE, first: FIRST_PAGE, other: OTHER_PAGE, last: LAST_PAGE });

export function ResultsSheet({
  rows,
  texts,
  lineAfter,
  edit,
}: {
  rows: SheetRow[];
  texts: SheetTexts;
  lineAfter: number; // a thick line under this many rows (the prize winners); 0 = none
  // On screen the admin can retype the place, title and signature lines before printing.
  edit?: { place: (v: string) => void; title: (v: string) => void; signer: (i: number, v: string) => void };
}) {
  const pages = paginate(rows);
  return (
    <>
      {pages.map((pageRows, i) => (
        <LetterheadPage key={i} number={i + 1} total={pages.length}>
          {i === 0 && <LetterheadTop place={texts.place} title={texts.title} onPlace={edit?.place} onTitle={edit?.title} />}
          {pageRows.length > 0 && (
            <Box mt={i === 0 ? "0" : "8mm"}>
              <Table rows={pageRows} columns={texts.columns} lineAfter={lineAfter} />
            </Box>
          )}
          {i === pages.length - 1 && <SignatureBlock lines={texts.signer} onLine={edit?.signer} />}
        </LetterheadPage>
      ))}
    </>
  );
}

const COLS = "minmax(0, 1.55fr) 23mm minmax(0, 1fr) minmax(0, 1.3fr)";

function Table({ rows, columns, lineAfter }: { rows: SheetRow[]; columns: SheetTexts["columns"]; lineAfter: number }) {
  const cell = { px: "2mm", borderStartWidth: "1.5px", borderColor: INK, display: "flex", alignItems: "center", minW: "0" } as const;
  return (
    <Box position="relative" borderWidth="1.5px" borderColor={INK}>
      <Grid templateColumns={COLS} minH="11mm" fontWeight="bold" fontSize="11.5pt" borderBottomWidth="1.5px" borderColor={INK} textAlign="center">
        <Flex align="center" justify="center" px="2mm">
          {columns.name}
        </Flex>
        <Flex {...cell} justifyContent="center">
          {columns.score}
        </Flex>
        <Flex {...cell} justifyContent="center">
          {columns.lives}
        </Flex>
        <Flex {...cell} justifyContent="center">
          {columns.institution}
        </Flex>
      </Grid>
      {rows.map(({ p, rank }, i) => (
        <Grid
          key={p.id}
          templateColumns={COLS}
          minH="7.6mm"
          borderTopWidth={i === 0 ? "0" : rank === lineAfter + 1 && lineAfter > 0 ? "2.2mm" : "1.5px"}
          borderColor={INK}
        >
          <Flex align="center" gap="3mm" px="3mm" minW="0" fontSize="11.5pt">
            <Text as="span" w="7mm" textAlign="end" flexShrink={0} fontVariantNumeric="tabular-nums">
              {rank}.
            </Text>
            <Text as="span" truncate>
              {upper(p.fullName)}
            </Text>
          </Flex>
          <Flex {...cell} fontWeight="bold" fontSize="11.5pt" fontVariantNumeric="tabular-nums">
            {score(p.score)}
          </Flex>
          <Flex {...cell} fontSize="10pt">
            <Text as="span" truncate>
              {upper(p.commune === p.province ? p.commune : `${p.commune} - ${p.province}`)}
            </Text>
          </Flex>
          <Flex {...cell} fontSize="10pt" fontWeight="bold">
            <Text as="span" truncate>
              {upper(p.institution)}
            </Text>
          </Flex>
        </Grid>
      ))}
    </Box>
  );
}
