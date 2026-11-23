"use client";

import { Box, Flex, Grid, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { INK, LetterheadPage, LetterheadTop, paginate, SignatureBlock } from "@/components/print/Letterhead";

// A list on the association's letterhead: the banner and title on the first page, the table
// running on over as many A4 pages as needed (the column headings again on each), and an optional
// signature on the last.

export interface PrintedColumn<T> {
  header: string;
  width: string; // a CSS grid track, e.g. "12mm" or "minmax(0, 1.5fr)"
  align?: "start" | "center" | "end";
  bold?: boolean;
  cell: (row: T, index: number) => ReactNode;
}

export function PrintedTable<T extends { id: string }>({
  rows,
  columns,
  place,
  title,
  subtitle,
  signer,
  onPlace,
  onTitle,
  onSigner,
}: {
  rows: T[];
  columns: PrintedColumn<T>[];
  place: string;
  title: string;
  subtitle?: ReactNode;
  signer?: string[];
  onPlace?: (v: string) => void;
  onTitle?: (v: string) => void;
  onSigner?: (i: number, v: string) => void;
}) {
  const signed = Boolean(signer && signer.length > 0);
  // One page: banner, title and up to 24 rows (20 with the signature). Longer: 28 on the first
  // page and 36 on the others (with the signature: 26, 34, and 28 on the last).
  const pages = paginate(rows, signed ? { only: 20, first: 26, other: 34, last: 28 } : { only: 24, first: 28, other: 36, last: 36 });
  const template = columns.map((c) => c.width).join(" ");
  const cell = { px: "2mm", borderStartWidth: "1.5px", borderColor: INK, display: "flex", alignItems: "center", minW: "0" } as const;
  // Where each page starts in the whole list (the numbers run on across pages).
  const starts = pages.map((_, i) => pages.slice(0, i).reduce((n, pg) => n + pg.length, 0));

  return (
    <>
      {pages.map((pageRows, i) => {
        const start = starts[i]!;
        return (
          <LetterheadPage key={i} number={i + 1} total={pages.length}>
            {i === 0 && <LetterheadTop place={place} title={title} subtitle={subtitle} onPlace={onPlace} onTitle={onTitle} />}
            {pageRows.length > 0 && (
              <Box mt={i === 0 ? "0" : "8mm"} borderWidth="1.5px" borderColor={INK}>
                <Grid templateColumns={template} minH="10mm" fontWeight="bold" fontSize="10.5pt" borderBottomWidth="1.5px" borderColor={INK} textAlign="center">
                  {columns.map((c, k) => (
                    <Flex key={k} {...(k === 0 ? { px: "2mm", display: "flex", alignItems: "center", minW: "0" } : cell)} justifyContent="center">
                      {c.header}
                    </Flex>
                  ))}
                </Grid>
                {pageRows.map((row, r) => (
                  <Grid key={row.id} templateColumns={template} minH="7.2mm" borderTopWidth={r === 0 ? "0" : "1.5px"} borderColor={INK} fontSize="10pt">
                    {columns.map((c, k) => (
                      <Flex
                        key={k}
                        {...(k === 0 ? { px: "2mm", display: "flex", alignItems: "center", minW: "0" } : cell)}
                        justifyContent={c.align === "end" ? "flex-end" : c.align === "center" ? "center" : "flex-start"}
                        fontWeight={c.bold ? "bold" : "normal"}
                        fontVariantNumeric="tabular-nums"
                      >
                        <Text as="span" truncate>
                          {c.cell(row, start + r)}
                        </Text>
                      </Flex>
                    ))}
                  </Grid>
                ))}
              </Box>
            )}
            {signed && i === pages.length - 1 && <SignatureBlock lines={signer!} onLine={onSigner} />}
          </LetterheadPage>
        );
      })}
    </>
  );
}
