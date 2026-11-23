"use client";

import { Box, Button, chakra, Flex, IconButton, Spinner, Text, useBreakpointValue } from "@chakra-ui/react";
import { BookOpenText, ChevronLeft, ChevronRight, LocateFixed, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { indexOf, juzOf, PAGES, pageOf, surahArabicName, type AyahRef } from "@/lib/quran";
import { useI18n } from "@/lib/i18n";

// One page of the Madina mushaf (King Fahd Complex print, Hafs, 604 pages of 15 lines), drawn
// exactly as printed: every page has its own font (public/mushaf/fonts/p{n}.woff2) whose glyphs
// are the words of that page, and public/mushaf/pages/{n}.json says which words are on which line.
// [surah, ayah, glyph, 1 when the glyph is the ayah's end number]
type Word = [number, number, string, number];
interface PageData {
  page: number;
  lines: [number, Word[]][];
}

// What is drawn on each of the 15 lines: words, or a surah title / the basmala in the gaps.
type Row = { kind: "words"; line: number; words: Word[] } | { kind: "title"; surah: number } | { kind: "basmala" };

const LINES = 15;
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

// The look of a printed mushaf: a dark cover, cream paper, a blue ornamental frame.
const COVER = "#1A2350";
const COVER_PX = 12; // how far the cover shows around the pages
const PAPER = "#FBF6E8";
const INK = "#1B1B1B";
const FRAME_BLUE = "#4F7FB0";
const FRAME_LIGHT = "#DCE8F4";
// The frame's pattern: small blue lozenges, as the printed border.
const FRAME_PATTERN = `repeating-linear-gradient(45deg, ${FRAME_BLUE} 0 1.5px, transparent 1.5px 6px), repeating-linear-gradient(-45deg, ${FRAME_BLUE} 0 1.5px, ${FRAME_LIGHT} 1.5px 6px)`;
const AYAH_MARK = "rgba(226,192,106,0.40)"; // the ayah the question starts from
const RANGE_MARK = "rgba(226,192,106,0.14)"; // the ayahs recited, start to end
const END_MARK = "rgba(79,127,176,0.26)"; // the ayah it finishes on

// Turning a page. The mushaf reads right to left: going on, the left page is lifted over to the
// right, so the new right page falls into place from the spine ("turn-r") while the new left page
// is uncovered ("reveal"); going back is the mirror. The paper turns, the cover stays.
type Motion = "turn-r" | "turn-l" | "reveal" | "appear";
const KEYFRAMES = `
@keyframes mushaf-turn-r {
  0% { transform: perspective(1800px) rotateY(-100deg); filter: brightness(0.7); }
  70% { filter: brightness(0.96); }
  100% { transform: perspective(1800px) rotateY(0deg); filter: none; }
}
@keyframes mushaf-turn-l {
  0% { transform: perspective(1800px) rotateY(100deg); filter: brightness(0.7); }
  70% { filter: brightness(0.96); }
  100% { transform: perspective(1800px) rotateY(0deg); filter: none; }
}
@keyframes mushaf-reveal {
  0% { filter: brightness(0.82); }
  100% { filter: none; }
}
@keyframes mushaf-appear {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  [data-mushaf-paper] { animation: none !important; }
}`;
const MOTION: Record<Motion, { animation: string; origin?: string }> = {
  "turn-r": { animation: "mushaf-turn-r 0.55s cubic-bezier(0.22, 0.8, 0.3, 1)", origin: "left center" },
  "turn-l": { animation: "mushaf-turn-l 0.55s cubic-bezier(0.22, 0.8, 0.3, 1)", origin: "right center" },
  reveal: { animation: "mushaf-reveal 0.55s ease-out" },
  appear: { animation: "mushaf-appear 0.25s ease-out" },
};

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

/** Load the pages of these questions ahead of time, so they show at once (and offline) later. */
export function preloadPages(refs: AyahRef[]) {
  for (const ref of refs) void loadPage(pageOf(ref)).catch(() => undefined);
}

// The lines with no words are a surah's title, and its basmala (except At-Tawba, and Al-Fatiha
// whose basmala is its first ayah). A title at the bottom of a page has its basmala on the next.
function rowsOf(data: PageData): Row[] {
  const rows: Row[] = [];
  const byLine = new Map(data.lines);
  const last = data.page <= 2 ? Math.max(...data.lines.map(([n]) => n)) : LINES;
  let gap = 0;
  const fill = (count: number, surah: number, atTop: boolean) => {
    const basmala = surah !== 1 && surah !== 9;
    if (count >= 2) rows.push({ kind: "title", surah }, ...(basmala ? [{ kind: "basmala" } as Row] : []));
    else if (count === 1) rows.push(atTop && basmala ? { kind: "basmala" } : { kind: "title", surah });
  };
  for (let line = 1; line <= last; line++) {
    const words = byLine.get(line);
    if (!words) {
      gap++;
      continue;
    }
    if (gap) fill(gap, words[0]![0], rows.length === 0 && line === gap + 1 && data.page > 2);
    gap = 0;
    rows.push({ kind: "words", line, words });
  }
  if (gap) {
    const lastWords = data.lines[data.lines.length - 1]![1];
    fill(gap, lastWords[lastWords.length - 1]![0] + 1, false);
  }
  return rows;
}

const arabicDigits = (n: number) => n.toLocaleString("ar-EG");
const juzOfPage = (data: PageData) => {
  const w = data.lines[0]?.[1][0];
  return w ? juzOf({ surah: w[0], ayah: w[1] }) : 1;
};

// "book": the mushaf open on two facing pages (the default; one whole page on a narrow screen).
// "large": one page, its text filling the width, scrolling.
type View = "book" | "large";
const VIEW_KEY = "unis.mushafView";
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "large" ? "large" : "book";
  } catch {
    return "book";
  }
}

// The two facing pages around page n: the odd page on the right, the next (even) one on the left,
// as printed (Al-Fatiha, page 1, faces page 2).
const spreadOf = (n: number) => {
  const right = n % 2 === 1 ? n : n - 1;
  return { right, left: Math.min(PAGES, right + 1) };
};

// One page's data, loaded (and kept) by loadPage. A failed load is tried again when `attempt` changes.
function usePageData(page: number, attempt: number) {
  const [state, setState] = useState<{ page: number; data: PageData | null; failed: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    loadPage(page)
      .then((data) => live && setState({ page, data, failed: false }))
      .catch(() => live && setState({ page, data: null, failed: true }));
    return () => {
      live = false;
    };
  }, [page, attempt]);
  const mine = state?.page === page ? state : null;
  return { data: mine?.data ?? null, failed: Boolean(mine?.failed) };
}

// The question's pages as an open mushaf, the ayah it starts from marked in gold, the ayahs to
// recite lightly tinted and the one it finishes on in blue (`end`; none: only the start). The judge turns
// the pages (the participant may go on) with the arrows at the sides or a swipe, and comes back
// to the question in one tap. `maxH` is the book's height ("100%" to fill its box).
// `hug`: as wide as the pages need for this height (not the whole width), so what is beside it
// gets the rest. Used on the judging desk next to the mark cards.
// Width ÷ height of the whole viewer (pages, cover and the turning arrows) when it hugs the pages.
// A little generous: the pages fit the height first, so they never come out smaller than the room allows.
const HUG_BOOK = 1.42;
const HUG_PAGE = 0.8;
const HUG_LARGE = 1;

export function MushafPage({ start, end, maxH = "82vh", hug = false }: { start: AyahRef; end?: AyahRef; maxH?: string; hug?: boolean }) {
  const { tx } = useI18n();
  const home = pageOf(start);
  const [page, setPage] = useState(home); // the page in focus (in a book: one of the two shown)
  const [attempt, setAttempt] = useState(0);
  const [turned, setTurned] = useState<"next" | "prev" | null>(null); // how the last page change went
  // Only rendered in the browser (after the participant's data loads), so the saved choice is read at once.
  const [view, setView] = useState<View>(() => (typeof window === "undefined" ? "book" : readView()));
  const wide = useBreakpointValue({ base: false, lg: true }) ?? false; // room for two pages side by side
  const book = view === "book" && wide;

  const spread = spreadOf(page);
  const shownPages = book ? [spread.right, spread.left] : [page];
  const right = usePageData(book ? spread.right : page, attempt);
  const left = usePageData(book ? spread.left : page, attempt);
  // Two facing pages are printed at one size: each says the size that fits it, both use the smaller.
  const [fits, setFits] = useState<{ l?: number; r?: number }>({});
  const fitLeft = useCallback((n: number) => setFits((f) => (f.l === n ? f : { ...f, l: n })), []);
  const fitRight = useCallback((n: number) => setFits((f) => (f.r === n ? f : { ...f, r: n })), []);
  const cap = fits.l && fits.r ? Math.min(fits.l, fits.r) : undefined;
  const failed = right.failed || (book && left.failed);
  const loaded = book ? Boolean(right.data && left.data) : Boolean(right.data);
  const atHome = shownPages.includes(home);

  // The next pages, ready before they are turned to.
  useEffect(() => {
    const next = book ? spreadOf(page).left + 1 : page + 1;
    for (const n of [next, next + 1]) if (n <= PAGES) void loadPage(n).catch(() => undefined);
  }, [page, book]);

  const step = book ? 2 : 1;
  const canNext = (book ? spread.left : page) < PAGES;
  const canPrev = (book ? spread.right : page) > 1;
  const go = (by: number) => {
    setTurned(by > 0 ? "next" : "prev");
    setPage((p) => Math.min(PAGES, Math.max(1, (book ? spreadOf(p).right : p) + by)));
  };
  const goHome = () => {
    setTurned(home > page ? "next" : "prev");
    setPage(home);
  };
  // In a book: the page that falls into place and the one uncovered; one page alone simply turns.
  const motionRight: Motion = turned === "next" ? "turn-r" : turned === "prev" ? "reveal" : "appear";
  const motionLeft: Motion = turned === "next" ? "reveal" : turned === "prev" ? "turn-l" : "appear";
  const motionSingle: Motion = turned === "next" ? "turn-r" : turned === "prev" ? "turn-l" : "appear";
  function toggleView() {
    const next: View = view === "book" ? "large" : "book";
    setView(next);
    if (next === "large" && book && !shownPages.includes(page)) setPage(spread.right);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // private window: the choice lasts until the page is reloaded
    }
  }

  // A swipe turns the page as in a mushaf: pulling the page to the right shows the next one.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) {
      if (dx > 0 && canNext) go(step);
      if (dx < 0 && canPrev) go(-step);
    }
  };

  const toggleLabel = view === "book" ? tx("Larger text") : wide ? tx("Two pages") : tx("Whole page");
  const sideArrow = {
    position: "absolute" as const,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1,
    size: "md" as const,
    rounded: "full",
    bg: "whiteAlpha.900",
    color: "brand.900",
    borderWidth: "1px",
    borderColor: "gold.300",
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    _hover: { bg: "white" },
    _disabled: { opacity: 0, pointerEvents: "none" },
  };

  return (
    <Box
      position="relative"
      h={maxH}
      // Width from the height: two facing pages, one page, or the larger text (a reading column).
      aspectRatio={hug ? (book ? HUG_BOOK : view === "large" ? HUG_LARGE : HUG_PAGE) : undefined}
      maxW="full"
      title={tx("Madina mushaf, King Fahd Complex")}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipe.current = null)}
      touchAction="pan-y"
      display="flex"
      flexDirection="column"
    >
      <style>{KEYFRAMES}</style>
      {/* Beside the book (the page numbers are printed on the pages): back to the question. */}
      {!atHome && (
        <Button position="absolute" top="0" left="0" zIndex={1} size="xs" bg="gold.400" color="brand.900" _hover={{ bg: "gold.300" }} rounded="full" onClick={goHome} title={tx("Question page")}>
          <LocateFixed size={13} aria-hidden />
          <chakra.span display={{ base: "none", xl: "inline" }}>{tx("Question page")}</chakra.span>
        </Button>
      )}
      <IconButton
        position="absolute"
        top="0"
        right="0"
        zIndex={1}
        size="xs"
        variant="outline"
        bg="white"
        color="brand.900"
        borderColor="gold.300"
        _hover={{ bg: "gold.50" }}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={toggleView}
      >
        {view === "book" ? <Maximize2 size={14} /> : <BookOpenText size={15} />}
      </IconButton>

      {/* Next page on the left, as in a mushaf; previous on the right. */}
      <IconButton {...sideArrow} left="0" disabled={!canNext} aria-label={tx("Next page")} title={tx("Next page")} onClick={() => go(step)}>
        <ChevronLeft size={22} />
      </IconButton>
      <IconButton {...sideArrow} right="0" disabled={!canPrev} aria-label={tx("Previous page")} title={tx("Previous page")} onClick={() => go(-step)}>
        <ChevronRight size={22} />
      </IconButton>

      <Box flex="1" minH="0" h="full" px={{ base: "8", md: "11" }}>
        {failed ? (
          <Flex direction="column" align="center" justify="center" gap="3" h="full" px="4">
            <Text textAlign="center" color="fg.muted">{tx("Could not load the page. Check the connection.")}</Text>
            <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              {tx("Try again")}
            </Button>
          </Flex>
        ) : !loaded ? (
          <Flex justify="center" align="center" h="full">
            <Spinner color="gold.500" size="lg" />
          </Flex>
        ) : book ? (
          // The open book: the left (even) page and the right (odd) page meet at the spine.
          <Flex h="full" justify="center">
            <Box flex="1" minW="0" h="full">
              <PrintedPage key={`l${spread.left}`} data={left.data!} start={start} end={end} view="page" side="left" cap={cap} onFit={fitLeft} motion={motionLeft} />
            </Box>
            <Box flex="1" minW="0" h="full">
              <PrintedPage key={`r${spread.right}`} data={right.data!} start={start} end={end} view="page" side="right" cap={cap} onFit={fitRight} motion={motionRight} />
            </Box>
          </Flex>
        ) : (
          <PrintedPage key={`${page}-${view}`} data={right.data!} start={start} end={end} view={view === "large" ? "large" : "page"} motion={motionSingle} />
        )}
      </Box>

      {/* The ribbon bookmark, hanging from the spine. */}
      {book && loaded && (
        <Box
          position="absolute"
          left="50%"
          bottom="-3"
          w="2.5"
          h="12"
          ms="-1.5"
          bg="linear-gradient(90deg, #121833, #2A356B 50%, #121833)"
          clipPath="polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)"
          aria-hidden
        />
      )}
    </Box>
  );
}

// The page itself, as printed: cream paper with its blue ornamental frame, the surah and juz in
// small framed labels at the top, 15 lines each stretched to the full width, the page number at
// the bottom. The font size is worked out so the whole page fits its box ("page"), or the lines
// fill its width ("large"). In a book (`side`), the page curves into the spine.
function PrintedPage({
  data,
  start,
  end,
  view,
  side,
  cap,
  onFit,
  motion = "appear",
}: {
  data: PageData;
  start: AyahRef;
  end?: AyahRef;
  view: "page" | "large";
  side?: "left" | "right";
  cap?: number; // in a book: the size the facing page needs, so both pages match
  onFit?: (size: number) => void; // the size that fits this page
  motion?: Motion; // how it comes in
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(24);
  const [frameW, setFrameW] = useState<number | null>(null);
  const [natural, setNatural] = useState<number[]>([]); // each line's width without stretching
  const rows = rowsOf(data);
  const opening = data.page <= 2; // Al-Fatiha and the start of Al-Baqara: short, centred lines
  const share = opening ? 0.62 : 0.985; // how much of the frame's width the longest line takes
  const firstSurah = data.lines[0]?.[1][0]?.[0] ?? start.surah;
  const juz = juzOfPage(data);
  const scrolled = useRef(false);
  const from = indexOf(start);
  const to = end ? Math.max(from, indexOf(end)) : from;

  const fit = useCallback(() => {
    const el = box.current;
    const sc = scroller.current;
    const fr = frame.current;
    if (!el || !sc || !fr) return;
    const lines = [...el.querySelectorAll<HTMLElement>("[data-line]")];
    const widths = lines.map((line) => [...line.children].reduce((sum, w) => sum + (w as HTMLElement).offsetWidth, 0));
    const widest = Math.max(...widths, 1);
    const current = parseFloat(getComputedStyle(el).fontSize) || 24;
    const pad = getComputedStyle(sc); // room for the cover around the page
    const padW = parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight);
    const padH = parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom);
    const chromeW = fr.offsetWidth - el.clientWidth; // the paper, the frame, their padding
    const chromeH = fr.offsetHeight - el.offsetHeight; // …plus the labels and the page number
    const availW = sc.clientWidth - padW - chromeW;
    const availH = sc.clientHeight - padH - chromeH;
    const byWidth = (current * availW * share) / widest;
    const byHeight = (current * availH) / Math.max(el.scrollHeight, 1);
    const ideal = Math.max(10, Math.min(view === "page" ? Math.min(byWidth, byHeight) : byWidth, view === "page" ? 46 : 56));
    // In tenths of a pixel, so two facing pages land on exactly the same size.
    const fitted = Math.floor(ideal * 10) / 10;
    onFit?.(fitted);
    const next = cap ? Math.min(fitted, cap) : fitted;
    const scaled = widths.map((w) => (w * next) / current);
    setNatural(scaled);
    // The page is as wide as its lines at that size: it keeps the proportions of a printed page.
    setFrameW(Math.min(sc.clientWidth - padW, Math.max(...scaled, 1) / share + chromeW));
    if (Math.abs(next - current) > 0.05) setSize(next);
  }, [share, view, cap, onFit]);

  useLayoutEffect(() => {
    fit();
    const sc = scroller.current;
    if (!sc) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(sc);
    return () => observer.disconnect();
  }, [fit]);

  // Large text: bring the question's ayah into view once the size is settled.
  useEffect(() => {
    if (view !== "large" || scrolled.current) return;
    const sc = scroller.current;
    const marked = sc?.querySelector<HTMLElement>("[data-marked]");
    if (!sc || !marked) return;
    const t = setTimeout(() => {
      scrolled.current = true;
      const top = marked.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      sc.scrollTo({ top: Math.max(0, top - sc.clientHeight / 3), behavior: "smooth" });
    }, 250);
    return () => clearTimeout(t);
  }, [view, size]);

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
  // The paper darkens into the spine, and the stack of pages shows on the outer edge.
  const paper =
    side === "left"
      ? `linear-gradient(to left, rgba(80,60,20,0.22) 0%, rgba(80,60,20,0.06) 5%, transparent 12%), ${PAPER}`
      : side === "right"
        ? `linear-gradient(to right, rgba(80,60,20,0.22) 0%, rgba(80,60,20,0.06) 5%, transparent 12%), ${PAPER}`
        : PAPER;
  const pageEdges =
    side === "left"
      ? "-2px 1px 0 #EDE4CC, -4px 2px 0 #DCD0B2, -6px 3px 0 #EFE7D2, -8px 4px 0 #D5C8A8"
      : side === "right"
        ? "2px 1px 0 #EDE4CC, 4px 2px 0 #DCD0B2, 6px 3px 0 #EFE7D2, 8px 4px 0 #D5C8A8"
        : "0 2px 0 #EDE4CC, 0 4px 0 #DCD0B2";
  // The cover, drawn as a band around the page: two facing pages share one cover.
  const cover = `0 0 0 ${COVER_PX}px ${COVER}, 0 ${COVER_PX + 14}px 30px -8px rgba(10,14,35,0.45)`;

  return (
    <Box
      ref={scroller}
      h="full"
      overflowY={view === "large" ? "auto" : "hidden"}
      py={`${COVER_PX}px`}
      ps={side === "right" ? "0" : `${COVER_PX + 10}px`}
      pe={side === "left" ? "0" : `${COVER_PX + 10}px`}
      display="flex"
      // In a book each page hugs the spine.
      justifyContent={side === "left" ? "flex-end" : side === "right" ? "flex-start" : "center"}
      alignItems={view === "page" ? "center" : "flex-start"}
    >
      <Box
        ref={frame}
        w={frameW ? `${frameW}px` : "full"}
        maxW="full"
        flexShrink={0}
        bg={COVER}
        boxShadow={cover}
        borderStartRadius={side === "right" ? "0" : "sm"}
        borderEndRadius={side === "left" ? "0" : "sm"}
      >
      <Box
        data-mushaf-paper=""
        bg={paper}
        boxShadow={pageEdges}
        borderStartRadius={side === "right" ? "0" : "sm"}
        borderEndRadius={side === "left" ? "0" : "sm"}
        px={{ base: "1.5", md: "2" }}
        py={{ base: "1.5", md: "2" }}
        animation={MOTION[motion].animation}
        transformOrigin={MOTION[motion].origin}
        style={{ backfaceVisibility: "hidden" }}
      >
        {/* The blue ornamental frame */}
        <Box p="4px" rounded="sm" bg={FRAME_PATTERN} borderWidth="1px" borderColor={FRAME_BLUE}>
          <Box bg={PAPER} borderWidth="1px" borderColor={FRAME_BLUE} px={{ base: "1.5", md: "2" }} pt="1" pb="0.5">
            {/* As at the top of a printed page: the surah on the right, the juz on the left. */}
            <Flex dir="rtl" justify="space-between" align="center" mb="0.5">
              <chakra.span {...label}>سورة {surahArabicName(firstSurah)}</chakra.span>
              <chakra.span {...label}>الجزء {arabicDigits(juz)}</chakra.span>
            </Flex>

            <Box ref={box} dir="rtl" lang="ar" fontSize={`${size}px`} color={INK} overflow="hidden">
              {rows.map((row, i) => {
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
                // A short line (end of a surah) is centred; a full line is stretched edge to edge.
                lineNo++;
                const short = opening || (natural[lineNo] ?? widest) < widest * 0.8;
                return (
                  <Flex
                    key={`l${row.line}`}
                    data-line
                    h="1.78em"
                    align="center"
                    justify={short ? "center" : "space-between"}
                    whiteSpace="nowrap"
                    fontFamily={`${fontFamily(data.page)}, serif`}
                    lineHeight="1"
                  >
                    {row.words.map(([surah, ayah, glyph, isEnd], k) => {
                      const at = indexOf({ surah, ayah });
                      const marked = at === from;
                      const last = end !== undefined && at === to && to !== from;
                      const inside = at >= from && at <= to;
                      return (
                        <chakra.span
                          key={k}
                          data-marked={marked ? "" : undefined}
                          bg={marked ? AYAH_MARK : last ? END_MARK : inside ? RANGE_MARK : undefined}
                          color={isEnd ? (marked ? "gold.800" : last ? "#1F4E7A" : "#2F5A86") : undefined}
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

            {/* The page number in its small frame, as printed. */}
            <Flex justify="center" mt="0.5">
              <chakra.span {...label} minW="9" textAlign="center">
                {arabicDigits(data.page)}
              </chakra.span>
            </Flex>
          </Box>
        </Box>
      </Box>
      </Box>
    </Box>
  );
}
