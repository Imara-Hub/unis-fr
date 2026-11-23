"use client";

import { useBannerReady } from "@/components/brand/YearBanner";
import { useQuery } from "@apollo/client/react";
import { Box, Button, Flex, Input, Text } from "@chakra-ui/react";
import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FullPageSpinner } from "@/components/AuthCard";
import { ErrorAlert } from "@/components/ErrorAlert";
import { rankFinalists } from "@/components/FinalResults";
import { rankParticipants } from "@/components/RankingTable";
import { PrintStyles } from "@/components/RegistrationSheet";
import { ResultsSheet, type SheetTexts } from "@/components/ResultsSheet";
import { readApiError } from "@/lib/errors";
import { ME } from "@/lib/graphql/auth";
import { PARTICIPANT_COUNTS, PARTICIPANTS } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// FINAL: the final's ranking (by the final score), once the admin started the final.
type Who = "FINAL" | "FINALISTS" | "PASSED" | "ALL";

const SAVED_KEY = "results-sheet-texts";
function readSaved(): { place?: string; titles?: Partial<Record<Who, string>>; signer?: string[] } {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const today = () => {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// The official results sheet, on its own page (outside the dashboard, so only the sheet prints).
// Admin only. The admin picks who is listed, may retype the date, title and signature lines on the
// sheet itself, then prints it or saves it as PDF to share.
export default function ResultsSheetPage() {
  const router = useRouter();
  const me = useQuery(ME);
  const bannerReady = useBannerReady(); // print once the banner is in
  const role = me.data?.me?.role;
  const isAdmin = role === "ADMIN";
  const counts = useQuery(PARTICIPANT_COUNTS, { skip: !isAdmin });
  const list = useQuery(PARTICIPANTS, { variables: { status: null, search: null, review: "APPROVED" }, skip: !isAdmin });
  const { tx } = useI18n();

  const settings = counts.data?.settings;
  const hasFinal = (settings?.finalistCount ?? 0) > 0;
  const finalOn = (list.data?.participants ?? []).some((p) => p.inFinal);
  // The final's ranking first once there is one; else the finalists (or who passed, without a final).
  const [picked, setWho] = useState<Who | null>(null);
  const who: Who = picked ?? (finalOn ? "FINAL" : "FINALISTS");
  const shownWho: Who = who === "FINAL" && !finalOn ? "FINALISTS" : who === "FINALISTS" && !hasFinal && settings ? "PASSED" : who;
  const [lineAfter, setLineAfter] = useState(5);

  const year = new Date().getFullYear();
  // The place and date, the title (one per list) and the signature lines, as last typed: kept on
  // this device. Emptied: back to "Bujumbura, <today>".
  const [savedPlace, setSavedPlace] = useState<string>(() => readSaved().place ?? "");
  const place = savedPlace || `Bujumbura, ${today()}`;
  const [titles, setTitles] = useState<Partial<Record<Who, string>>>(() => readSaved().titles ?? {});
  const [signer, setSigner] = useState<string[] | null>(() => readSaved().signer ?? null);
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify({ place: savedPlace, titles, signer }));
    } catch {
      // private window or storage blocked: the texts last until the page is closed
    }
  }, [savedPlace, titles, signer]);

  const rows = useMemo(() => {
    const all = list.data?.participants ?? [];
    // The final: those the judges finished, by the final score (as the final's ranking).
    if (shownWho === "FINAL") return rankFinalists(all).judged.map(({ p, rank }) => ({ p: { ...p, score: p.finalScore! }, rank: rank! }));
    const ranked = rankParticipants(all);
    if (shownWho === "FINALISTS") return ranked.filter((r) => r.p.finalist);
    if (shownWho === "PASSED") return ranked.filter((r) => r.p.status === "PASSED");
    return ranked;
  }, [list.data, shownWho]);

  const defaultTitle =
    shownWho === "FINAL"
      ? tx("FINAL RESULTS {year}", { year })
      : shownWho === "FINALISTS"
      ? tx("FINALISTS {year}", { year })
      : shownWho === "PASSED"
        ? tx("RESULTS {year}: PASSED", { year })
        : tx("RESULTS {year}", { year });
  const texts: SheetTexts = {
    place,
    title: titles[shownWho] || defaultTitle,
    signer: signer ?? [tx("Leader of Association UN.I.S"), "FRÈRES ET SŒURS", "…………………………………"],
    columns: {
      name: tx("Full name").toLocaleUpperCase(),
      score: `${settings?.maxScore ?? 100}%`,
      lives: tx("Where they live").toLocaleUpperCase(),
      institution: tx("Madrassa / Markaz").toLocaleUpperCase(),
    },
  };

  // The PDF is saved under the page title.
  useEffect(() => {
    const before = document.title;
    document.title = `${texts.title} - UNIS`;
    return () => {
      document.title = before;
    };
  }, [texts.title]);

  const loggedOut = !me.loading && !me.error && !me.data?.me;
  useEffect(() => {
    if (loggedOut) router.replace("/login");
  }, [loggedOut, router]);

  if (me.loading || loggedOut || (isAdmin && (list.loading || counts.loading) && !list.data)) return <FullPageSpinner />;

  let problem: string | null = null;
  if (me.error) problem = readApiError(me.error).message;
  else if (!isAdmin) problem = tx("You do not have access to this page.");
  else if (list.error) problem = readApiError(list.error).message;

  const choices: { value: Who; label: string }[] = [
    ...(finalOn ? [{ value: "FINAL" as const, label: tx("Final ranking") }] : []),
    ...(hasFinal ? [{ value: "FINALISTS" as const, label: tx("Finalists") }] : []),
    { value: "PASSED", label: tx("Everyone who passed") },
    { value: "ALL", label: tx("Everyone judged") },
  ];

  return (
    <Box minH="100dvh" bg="#E9EBF2">
      <PrintStyles />
      <Flex className="no-print" position="sticky" top="0" zIndex="docked" bg="white" borderBottomWidth="1px" px={{ base: "4", md: "8" }} py="3" gap="3" align="center" wrap="wrap">
        <Button variant="ghost" size="sm" onClick={() => (history.length <= 1 ? router.push("/ranking") : router.back())}>
          <ArrowLeft size={16} aria-hidden />
          {tx("Back")}
        </Button>
        <Text flex="1" minW="40" fontWeight="semibold" color="brand.900" truncate>
          {tx("Results sheet")}
        </Text>
        {!problem && (
          <>
            <Flex gap="1" p="1" rounded="lg" bg="bg.muted">
              {choices.map((c) => (
                <Button
                  key={c.value}
                  size="xs"
                  variant={shownWho === c.value ? "solid" : "ghost"}
                  colorPalette="brand"
                  onClick={() => setWho(c.value)}
                >
                  {c.label}
                </Button>
              ))}
            </Flex>
            <Flex align="center" gap="2" fontSize="sm">
              <Text color="fg.muted" whiteSpace="nowrap">
                {tx("Thick line after")}
              </Text>
              <Input
                size="xs"
                type="number"
                min={0}
                w="16"
                value={lineAfter}
                onChange={(e) => setLineAfter(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
            </Flex>
            <Button colorPalette="brand" size="sm" onClick={() => window.print()} disabled={rows.length === 0} loading={rows.length > 0 && !bannerReady}>
              <Printer size={16} aria-hidden />
              {tx("Print or save as PDF")}
            </Button>
          </>
        )}
      </Flex>

      {problem ? (
        <Box maxW="lg" mx="auto" p="6">
          <ErrorAlert message={problem} />
        </Box>
      ) : (
        <>
          <Text className="no-print" textAlign="center" fontSize="sm" color="fg.muted" pt="4" px="4">
            {tx("Tap the date, the title or the signature lines on the sheet to change them before printing.")}{" "}
            {tx("To get a PDF, press “Print or save as PDF”, then choose “Save as PDF” as the printer.")}
          </Text>
          {rows.length === 0 ? (
            <Box maxW="lg" mx="auto" p="6">
              <Text textAlign="center" color="fg.muted">
                {tx("No final score yet")}
              </Text>
            </Box>
          ) : (
            <Box className="sheet-frame" overflowX="auto" py={{ base: "4", md: "8" }} px="4">
              <ResultsSheet
                rows={rows}
                texts={texts}
                lineAfter={lineAfter}
                edit={{
                  place: (v) => setSavedPlace(v.trim()),
                  // Emptied: back to the default title of this list.
                  title: (v) => setTitles((t) => ({ ...t, [shownWho]: v.trim() })),
                  signer: (i, v) => setSigner((s) => (s ?? texts.signer).map((line, k) => (k === i ? v : line))),
                }}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
