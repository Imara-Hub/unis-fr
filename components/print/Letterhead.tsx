"use client";

import { useQuery } from "@apollo/client/react";
import { Box, Button, Flex, Grid, Text } from "@chakra-ui/react";
import { ArrowLeft, Mail, MapPin, Phone, Printer } from "lucide-react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FullPageSpinner } from "@/components/AuthCard";
import { useBannerReady, YearBanner } from "@/components/brand/YearBanner";
import { ErrorAlert } from "@/components/ErrorAlert";
import { PrintStyles } from "@/components/RegistrationSheet";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { useI18n } from "@/lib/i18n";

// The association's printed documents (A4, on its letterhead): the results sheet, the judges'
// sheets, the order of passage and the participants list. Each page has the faint logo behind,
// the contact footer and its number; the first one the place and date, the banner and the title.
// Printing the page, or "Save as PDF" in the print window, gives those pages and nothing else.

export const NAVY = "#1F2B5B";
export const GOLD = "#E07F0A";
export const INK = "#14182B";

// 95.625 → "95,625" (as written on the association's sheets).
export const scoreText = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
export const upper = (s: string) => s.toLocaleUpperCase("fr");

export const today = () => {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Rows per page: the first page also holds the banner and the title; the last keeps room for the
// signature when there is one.
export function paginate<T>(rows: T[], { only, first, other, last }: { only: number; first: number; other: number; last: number }): T[][] {
  if (rows.length <= only) return [rows];
  const pages: T[][] = [rows.slice(0, first)];
  let rest = rows.slice(first);
  while (rest.length > last) {
    // Leave at least one row for the last page.
    const take = Math.min(other, rest.length - 1);
    pages.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  if (rest.length > 0) pages.push(rest);
  else pages.push([]); // only the signature left
  return pages;
}

export function LetterheadPage({ number, total, children }: { number: number; total: number; children: ReactNode }) {
  return (
    <Box
      className="sheet"
      position="relative"
      w="210mm"
      h="297mm"
      mx="auto"
      mb="8"
      bg="white"
      color={INK}
      overflow="hidden"
      boxShadow="0 10px 40px rgba(16,22,58,0.18)"
      fontSize="11pt"
      css={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", breakAfter: "page", "&:last-of-type": { breakAfter: "auto" } }}
    >
      {/* The association's mark, faint behind the table */}
      <Box position="absolute" left="50%" top="58%" transform="translate(-50%, -50%)" w="150mm" h="150mm" opacity={0.07} pointerEvents="none" aria-hidden>
        <NextImage src="/logo.png" alt="" width={600} height={600} priority unoptimized style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </Box>

      <Box position="relative" px="10mm" pt="4mm">
        {children}
      </Box>

      {total > 1 && (
        <Text position="absolute" bottom="24mm" right="12mm" fontSize="9pt" color="#6B7087">
          {number} / {total}
        </Text>
      )}

      {/* Footer: how to reach the association */}
      <Grid
        position="absolute"
        insetX="0"
        bottom="0"
        h="20mm"
        px="10mm"
        borderTopWidth="1.5px"
        borderColor={NAVY}
        color={INK}
        templateColumns="0.9fr 1.15fr 1.3fr"
        alignItems="center"
        gap="4mm"
        fontSize="9.5pt"
        fontWeight="semibold"
        lineHeight="1.35"
      >
        <FooterItem icon={<Phone size={16} />}>
          +257 61 83 46 85
          <br />
          +257 79 04 25 29
        </FooterItem>
        <FooterItem icon={<Mail size={16} />}>
          Gmail:
          <br />
          associationunisbu@gmail.com
        </FooterItem>
        <FooterItem icon={<MapPin size={16} />}>
          7ème Avenue N° 46 Kanyosha-Gisyo
          <br />
          Bujumbura - Burundi
        </FooterItem>
      </Grid>
    </Box>
  );
}

// The top of a document's first page: the place and date on the right, the banner, the title.
export function LetterheadTop({
  place,
  title,
  subtitle,
  onPlace,
  onTitle,
}: {
  place: string;
  title: string;
  subtitle?: ReactNode;
  onPlace?: (v: string) => void;
  onTitle?: (v: string) => void;
}) {
  return (
    <>
      <Flex justify="flex-end" mt="5mm" fontSize="12pt" color={INK}>
        <Editable value={place} onChange={onPlace} />
      </Flex>
      <Box w="145mm" mx="auto" mt="3mm">
        <YearBanner w="100%" />
      </Box>
      <Text
        as="h1"
        mt="5mm"
        mb={subtitle ? "2mm" : "5mm"}
        textAlign="center"
        fontSize="19pt"
        fontWeight="bold"
        color={GOLD}
        textDecoration="underline"
        textUnderlineOffset="5px"
        textDecorationThickness="2px"
        letterSpacing="0.01em"
      >
        <Editable value={title} onChange={onTitle} />
      </Text>
      {subtitle && (
        <Text textAlign="center" fontSize="10.5pt" color="#4A4F66" mb="5mm">
          {subtitle}
        </Text>
      )}
    </>
  );
}

// The signature block, bottom right, with room to sign by hand.
export function SignatureBlock({ lines, onLine }: { lines: string[]; onLine?: (i: number, v: string) => void }) {
  return (
    <Box ms="auto" w="95mm" mt="7mm" fontStyle="italic" fontWeight="bold" fontSize="12pt" color={INK} lineHeight="1.45">
      {lines.map((line, k) => (
        <Box key={k}>
          <Editable value={line} onChange={onLine ? (v) => onLine(k, v) : undefined} />
        </Box>
      ))}
      <Box h="16mm" />
    </Box>
  );
}

// Text the admin may retype on screen before printing (printed as plain text).
export function Editable({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  if (!onChange) return <>{value}</>;
  return (
    <Box
      as="span"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      outline="none"
      rounded="sm"
      css={{ "@media screen": { "&:hover, &:focus": { boxShadow: "0 0 0 2px rgba(249,151,29,0.55)", background: "rgba(251,245,230,0.6)" } } }}
    >
      {value}
    </Box>
  );
}

function FooterItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Flex align="center" gap="3mm">
      <Flex w="8.5mm" h="8.5mm" rounded="full" bg={NAVY} color="white" align="center" justify="center" flexShrink={0}>
        {icon}
      </Flex>
      <Box>{children}</Box>
    </Flex>
  );
}

type Role = "ADMIN" | "JUDGE" | "STAFF";

// Who may open a printed document: logged in, with one of `roles`. Logged out: to the login page.
export function usePrintAccess(roles: Role[]) {
  const router = useRouter();
  const me = useQuery(ME);
  const role = me.data?.me?.role as Role | undefined;
  const loggedOut = !me.loading && !me.error && !me.data?.me;
  useEffect(() => {
    if (loggedOut) router.replace("/login");
  }, [loggedOut, router]);
  return {
    loading: me.loading || loggedOut,
    allowed: Boolean(role && roles.includes(role)),
    role,
    error: me.error ? readApiError(me.error).message : null,
  };
}

// A printed document's own page (outside the dashboard, so only the document prints): a toolbar
// (back, the name, the document's choices, the print button) above the A4 pages.
export function PrintShell({
  name,
  pdfName,
  back,
  access,
  loading = false,
  problem = null,
  empty = null,
  controls,
  editableHint = false,
  children,
}: {
  name: string; // in the toolbar
  pdfName: string; // the saved PDF's name (the page title)
  back: string; // where Back goes when the page was opened directly
  access: ReturnType<typeof usePrintAccess>;
  loading?: boolean;
  problem?: string | null;
  empty?: string | null; // nothing to print: this message instead of the pages
  controls?: ReactNode;
  editableHint?: boolean; // the date, title or signature can be retyped on the sheet
  children: ReactNode;
}) {
  const router = useRouter();
  const { tx } = useI18n();
  const bannerReady = useBannerReady(); // print once the banner is in

  // The PDF is saved under the page title.
  useEffect(() => {
    const before = document.title;
    document.title = `${pdfName} - UNIS`;
    return () => {
      document.title = before;
    };
  }, [pdfName]);

  if (access.loading || (access.allowed && loading)) return <FullPageSpinner />;
  const error = access.error ?? (!access.allowed ? tx("You do not have access to this page.") : problem);

  return (
    <Box minH="100dvh" bg="#E9EBF2">
      <PrintStyles />
      <Flex className="no-print" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px" px={{ base: "4", md: "8" }} py="3" gap="3" align="center" wrap="wrap">
        <Button variant="ghost" size="sm" onClick={() => (history.length <= 1 ? router.push(back) : router.back())}>
          <ArrowLeft size={16} aria-hidden />
          {tx("Back")}
        </Button>
        <Text flex="1" minW="40" fontWeight="semibold" color="brand.900" truncate>
          {name}
        </Text>
        {!error && (
          <>
            {controls}
            <Button colorPalette="brand" size="sm" onClick={() => window.print()} disabled={Boolean(empty)} loading={!empty && !bannerReady}>
              <Printer size={16} aria-hidden />
              {tx("Print or save as PDF")}
            </Button>
          </>
        )}
      </Flex>

      {error ? (
        <Box maxW="lg" mx="auto" p="6">
          <ErrorAlert message={error} />
        </Box>
      ) : (
        <>
          <Text className="no-print" textAlign="center" fontSize="sm" color="fg.muted" pt="4" px="4">
            {editableHint && <>{tx("Tap the date, the title or the signature lines on the sheet to change them before printing.")} </>}
            {tx("To get a PDF, press “Print or save as PDF”, then choose “Save as PDF” as the printer.")}
          </Text>
          {empty ? (
            <Box maxW="lg" mx="auto" p="6">
              <Text textAlign="center" color="fg.muted">
                {empty}
              </Text>
            </Box>
          ) : (
            <Box className="sheet-frame" overflowX="auto" py={{ base: "4", md: "8" }} px="4">
              {children}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// A segmented choice in the toolbar (which list, which round).
export function ToolbarChoice<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Flex gap="1" p="1" rounded="lg" bg="bg.muted">
      {options.map((c) => (
        <Button key={c.value} size="xs" variant={value === c.value ? "solid" : "ghost"} colorPalette="brand" onClick={() => onChange(c.value)}>
          {c.label}
        </Button>
      ))}
    </Flex>
  );
}
