"use client";

import { Box, Button, chakra, Flex, Spinner, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { indexOf, juzOf, surahArabicName, type AyahRef } from "@/lib/quran";
import { pagesOf, passageRows, type PageData } from "@/lib/quran/passage";
import { useI18n } from "@/lib/i18n";

// The question's passage, drawn as printed in the Madina mushaf (King Fahd Complex print, Hafs):
// only the ayahs from the start to the end, nothing before or after (lib/quran/passage.ts picks
// them). Every page has its own font (public/mushaf/fonts/p{n}.woff2) whose glyphs are the words
// of that page, and public/mushaf/pages/{n}.json says which words are on which line. Only the pages
// the passage is on are loaded (one or two; more only when the admin moved the end further).

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

// The look of a printed mushaf: a dark cover, cream paper, a blue ornamental frame.
const COVER = "#1A2350";
const COVER_PX = 12; // how far the cover shows around the paper
const PAPER = "#FBF6E8";
const INK = "#1B1B1B";
const FRAME_BLUE = "#4F7FB0";
const FRAME_LIGHT = "#DCE8F4";
// The frame's pattern: small blue lozenges, as the printed border.
const FRAME_PATTERN = `repeating-linear-gradient(45deg, ${FRAME_BLUE} 0 1.5px, transparent 1.5px 6px), repeating-linear-gradient(-45deg, ${FRAME_BLUE} 0 1.5px, ${FRAME_LIGHT} 1.5px 6px)`;
const START_MARK = "rgba(226,192,106,0.40)"; // the ayah the question starts from
const END_MARK = "rgba(79,127,176,0.26)"; // the ayah it finishes on
// Below this size the passage scrolls instead of shrinking further: it must stay easy to read.
const READABLE_PX = 20;
const MAX_PX = 46;
// Width ÷ height of the viewer when it hugs its text (`hug`), about a printed page.
const HUG_RATIO = 0.8;

// Pages already loaded stay in memory: switching questions or going back is instant, even offline.
const cache = new Map<number, Promise<PageData>>();
const fontFamily = (page: number) => `qcf-v1-p${page}`;

function loadPage(page: number): Promise<PageData> {
  let p = cache.get(page);
  if (!p) {
    const data = fetch(`/mushaf/pages/${page}.json`).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<PageData>;
    });
    const face = new FontFace(fontFamily(page), `url(/mushaf/fonts/p${page}.woff2)`, { display: "block" });
    const font = face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
    p = Promise.all([data, font]).then(([d]) => d);
    p.catch(() => cache.delete(page)); // a failed load is tried again next time
    cache.set(page, p);
  }
  return p;
}

/** Load the pages of these questions ahead of time (only the pages their passages are on). */
export function preloadPages(questions: { start: AyahRef; end?: AyahRef }[]) {
  for (const q of questions) for (const page of pagesOf(q.start, q.end)) void loadPage(page).catch(() => undefined);
}

const arabicDigits = (n: number) => n.toLocaleString("ar-EG");

// The passage's pages, loaded together. A failed load is tried again when `attempt` changes.
function usePages(pages: number[], attempt: number) {
  const key = pages.join(",");
  const [state, setState] = useState<{ key: string; data: PageData[] | null; failed: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(key.split(",").map((n) => loadPage(Number(n))))
      .then((data) => live && setState({ key, data, failed: false }))
      .catch(() => live && setState({ key, data: null, failed: true }));
    return () => {
      live = false;
    };
  }, [key, attempt]);
  const mine = state?.key === key ? state : null;
  return { data: mine?.data ?? null, failed: Boolean(mine?.failed) };
}

// The question's passage: the ayah it starts from marked in gold, the one it finishes on in blue
// (`end`; none: only the start ayah). `maxH` is the viewer's height ("100%" to fill its box).
// `hug`: about as wide as a printed page for this height, so what is beside it gets the rest
// (the judging desk, next to the mark cards).
export function MushafPage({ start, end, maxH = "82vh", hug = false }: { start: AyahRef; end?: AyahRef; maxH?: string; hug?: boolean }) {
  const { tx } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const pages = pagesOf(start, end);
  const { data, failed } = usePages(pages, attempt);

  return (
    <Box position="relative" h={maxH} aspectRatio={hug ? HUG_RATIO : undefined} maxW="full" title={tx("Madina mushaf, King Fahd Complex")} display="flex" flexDirection="column">
      <Box flex="1" minH="0" h="full">
        {failed ? (
          <Flex direction="column" align="center" justify="center" gap="3" h="full" px="4">
            <Text textAlign="center" color="fg.muted">{tx("Could not load the page. Check the connection.")}</Text>
            <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              {tx("Try again")}
            </Button>
          </Flex>
        ) : !data ? (
          <Flex justify="center" align="center" h="full">
            <Spinner color="gold.500" size="lg" />
          </Flex>
        ) : (
          <Passage key={pages.join(",")} pages={data} start={start} end={end} />
        )}
      </Box>
    </Box>
  );
}

// The passage on its paper, as printed: the blue ornamental frame, the surah and juz in small
// framed labels at the top, each full line stretched to the width, the page numbers at the bottom
// and a small mark where the page turns. The font size makes the widest line fill the width and,
// when it stays readable, the whole passage fit the height; otherwise the passage scrolls.
function Passage({ pages, start, end }: { pages: PageData[]; start: AyahRef; end?: AyahRef }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(24);
  const [frameW, setFrameW] = useState<number | null>(null);
  const [natural, setNatural] = useState<number[]>([]); // each word line's width without stretching
  const from = indexOf(start);
  const to = end ? Math.max(from, indexOf(end)) : from;
  const rows = passageRows(pages, start, end);
  const opening = pages.every((p) => p.page <= 2); // Al-Fatiha and the start of Al-Baqara: short, centred lines
  const share = opening ? 0.62 : 0.985; // how much of the frame's width the longest line takes
  const firstPage = pages[0]!.page;
  const lastPage = pages[pages.length - 1]!.page;

  const fit = useCallback(() => {
    const el = box.current;
    const sc = scroller.current;
    const fr = frame.current;
    if (!el || !sc || !fr) return;
    // All the measuring first, then the writes (each read after a write would lay the page out again).
    const lines = [...el.querySelectorAll<HTMLElement>("[data-line]")];
    const widths = lines.map((line) => [...line.children].reduce((sum, w) => sum + (w as HTMLElement).offsetWidth, 0));
    const widest = Math.max(...widths, 1);
    const current = parseFloat(getComputedStyle(el).fontSize) || 24;
    const pad = getComputedStyle(sc); // room for the cover around the paper
    const padW = parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight);
    const padH = parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom);
    const chromeW = fr.offsetWidth - el.clientWidth; // the paper, the frame, their padding
    const chromeH = fr.offsetHeight - el.offsetHeight; // …plus the labels and the page numbers
    const availW = sc.clientWidth - padW - chromeW;
    const availH = sc.clientHeight - padH - chromeH;
    const byWidth = (current * availW * share) / widest;
    const byHeight = (current * availH) / Math.max(el.scrollHeight, 1);
    const ideal = Math.max(10, Math.min(byWidth, Math.max(byHeight, READABLE_PX), MAX_PX));
    const next = Math.floor(ideal * 10) / 10;
    const scaled = widths.map((w) => (w * next) / current);
    setNatural(scaled);
    // The paper is as wide as its lines at that size, like a printed page.
    setFrameW(Math.min(sc.clientWidth - padW, Math.max(...scaled, 1) / share + chromeW));
    if (Math.abs(next - current) > 0.05) setSize(next);
  }, [share]);

  useLayoutEffect(() => {
    fit();
    const sc = scroller.current;
    if (!sc) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(sc);
    return () => observer.disconnect();
  }, [fit]);

  const widest = Math.max(...natural, 1);
  let lineNo = -1; // position among the word lines, the order `natural` is in
  const label = {
    px: "2",
    py: "0",
    borderWidth: "1px",
    borderColor: FRAME_BLUE,
    rounded: "sm",
    bg: "white",
    fontFamily: "var(--font-arabic), serif",
    color: "#2F5A86",
    fontSize: "xs",
    lineHeight: "1.25",
    whiteSpace: "nowrap" as const,
  };
  const cover = `0 0 0 ${COVER_PX}px ${COVER}, 0 ${COVER_PX + 14}px 30px -8px rgba(10,14,35,0.45)`;

  return (
    <Box ref={scroller} h="full" overflowY="auto" p={`${COVER_PX}px`} ps={`${COVER_PX + 10}px`} pe={`${COVER_PX + 10}px`} display="flex" justifyContent="center" alignItems="safe center">
      <Box ref={frame} w={frameW ? `${frameW}px` : "full"} maxW="full" flexShrink={0} bg={COVER} boxShadow={cover} rounded="sm">
        <Box bg={PAPER} boxShadow="0 2px 0 #EDE4CC, 0 4px 0 #DCD0B2" rounded="sm" px={{ base: "1.5", md: "2" }} py={{ base: "1.5", md: "2" }}>
          {/* The blue ornamental frame */}
          <Box p="4px" rounded="sm" bg={FRAME_PATTERN} borderWidth="1px" borderColor={FRAME_BLUE}>
            <Box bg={PAPER} borderWidth="1px" borderColor={FRAME_BLUE} px={{ base: "1.5", md: "2" }} pt="1" pb="0.5">
              {/* As at the top of a printed page: the surah on the right, the juz on the left. */}
              <Flex dir="rtl" justify="space-between" align="center" mb="0.5">
                <chakra.span {...label}>سورة {surahArabicName(start.surah)}</chakra.span>
                <chakra.span {...label}>الجزء {arabicDigits(juzOf(start))}</chakra.span>
              </Flex>

              <Box ref={box} dir="rtl" lang="ar" fontSize={`${size}px`} color={INK} overflow="hidden">
                {rows.map((row, i) => {
                  if (row.kind === "turn") {
                    // Where the participant's mushaf turns to the next page.
                    return (
                      <Flex key={`p${row.page}`} align="center" gap="0.4em" my="0.2em" color="#2F5A86" aria-hidden>
                        <Box flex="1" borderTopWidth="1px" borderStyle="dashed" borderColor={FRAME_BLUE} />
                        <chakra.span {...label} fontSize="0.4em">
                          {arabicDigits(row.page)}
                        </chakra.span>
                        <Box flex="1" borderTopWidth="1px" borderStyle="dashed" borderColor={FRAME_BLUE} />
                      </Flex>
                    );
                  }
                  if (row.kind === "title") {
                    return (
                      <Flex
                        key={`t${i}`}
                        h="1.9em"
                        my="0.15em"
                        align="center"
                        justify="center"
                        borderWidth="1.5px"
                        borderColor={FRAME_BLUE}
                        rounded="sm"
                        bg={`linear-gradient(180deg, #F1F6FB 0%, ${FRAME_LIGHT} 100%)`}
                        fontFamily="var(--font-arabic), serif"
                        fontSize="0.8em"
                        fontWeight="bold"
                        color="#2F5A86"
                      >
                        سورة {surahArabicName(row.surah)}
                      </Flex>
                    );
                  }
                  if (row.kind === "basmala") {
                    return (
                      <Flex key={`b${i}`} h="1.9em" align="center" justify="center" fontFamily="var(--font-bismillah), serif" fontSize="0.85em">
                        {BASMALA}
                      </Flex>
                    );
                  }
                  // A full line is stretched edge to edge, as printed. A line the passage only takes
                  // part of (where it starts or ends) is set from the right; a short printed line
                  // (end of a surah) is centred.
                  lineNo++;
                  const short = (natural[lineNo] ?? widest) < widest * 0.8;
                  const justify = row.trimmed ? "flex-start" : opening || short ? "center" : "space-between";
                  return (
                    <Flex
                      key={`l${row.page}-${row.line}`}
                      data-line
                      h="1.78em"
                      align="center"
                      justify={justify}
                      whiteSpace="nowrap"
                      fontFamily={`${fontFamily(row.page)}, serif`}
                      lineHeight="1"
                    >
                      {row.words.map(([surah, ayah, glyph, isEnd], k) => {
                        const at = indexOf({ surah, ayah });
                        const first = at === from;
                        const last = end !== undefined && at === to && to !== from;
                        return (
                          <chakra.span
                            key={k}
                            bg={first ? START_MARK : last ? END_MARK : undefined}
                            color={isEnd ? (first ? "gold.800" : last ? "#1F4E7A" : "#2F5A86") : undefined}
                            py="0.12em"
                            aria-label={isEnd ? `${surah}:${ayah}` : undefined}
                          >
                            {glyph}
                          </chakra.span>
                        );
                      })}
                    </Flex>
                  );
                })}
              </Box>

              {/* The page numbers in their small frame, as printed. */}
              <Flex justify="center" mt="0.5">
                <chakra.span {...label} minW="9" textAlign="center">
                  {firstPage === lastPage ? arabicDigits(firstPage) : `${arabicDigits(firstPage)} – ${arabicDigits(lastPage)}`}
                </chakra.span>
              </Flex>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
