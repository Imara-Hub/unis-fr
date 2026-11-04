"use client";

import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { Counts } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// Chart colors for results. Checked with the dataviz palette validator: passed vs failed stay
// apart for red/green colorblind readers. Failed is light on white, so every chart also shows
// labels with the numbers (color is never the only clue).
export const RESULT_COLORS = { passed: "#15803d", failed: "#f87171", pending: "#e4e4e7" } as const;
const GOLD = "#B3832A";
const INK_MUTED = "#71717a";
const GRID = "#ececef";

type Slice = { key: keyof typeof RESULT_COLORS; label: string; value: number };

// Donut: passed / failed / not judged yet. Hovering a part (or its legend row) shows it in the middle.
export function ResultsDonut({ counts }: { counts: Counts }) {
  const [active, setActive] = useState<Slice["key"] | null>(null);
  const { tx } = useI18n();
  const slices: Slice[] = [
    { key: "passed", label: tx("Passed"), value: counts.passed },
    { key: "failed", label: tx("Failed"), value: counts.failed },
    { key: "pending", label: tx("Not judged yet"), value: counts.pending },
  ];
  const total = counts.total;
  const judged = counts.passed + counts.failed;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const size = 200;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const visible = slices.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 3 : 0; // small white gap between parts

  let offset = 0;
  const arcs = slices.map((s) => {
    const len = total ? (s.value / total) * circ : 0;
    const arc = { ...s, dash: Math.max(0, len - gap), offset };
    offset += len;
    return arc;
  });

  const shown = active ? slices.find((s) => s.key === active)! : null;

  return (
    <Flex direction={{ base: "column", sm: "row" }} align="center" gap={{ base: "6", sm: "8" }}>
      <Box position="relative" w={`${size}px`} h={`${size}px`} flexShrink={0}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={tx("{passed} passed, {failed} failed, {pending} not judged yet", { passed: counts.passed, failed: counts.failed, pending: counts.pending })}
        >
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {total === 0 && (
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RESULT_COLORS.pending} strokeWidth={stroke} />
            )}
            {arcs.map(
              (a) =>
                a.value > 0 && (
                  <circle
                    key={a.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={RESULT_COLORS[a.key]}
                    strokeWidth={active === a.key ? stroke + 4 : stroke}
                    strokeDasharray={`${a.dash} ${circ - a.dash}`}
                    strokeDashoffset={-a.offset}
                    opacity={active && active !== a.key ? 0.35 : 1}
                    style={{ transition: "opacity 0.15s, stroke-width 0.15s", cursor: "pointer" }}
                    onMouseEnter={() => setActive(a.key)}
                    onMouseLeave={() => setActive(null)}
                  />
                ),
            )}
          </g>
        </svg>
        {/* Middle: % judged, or the hovered part */}
        <Stack position="absolute" inset="0" align="center" justify="center" gap="0" pointerEvents="none" textAlign="center">
          <Text fontFamily="display" fontSize="4xl" lineHeight="1" color="brand.900">
            {shown ? shown.value : `${pct(judged)}%`}
          </Text>
          <Text fontSize="xs" color="fg.muted" mt="1" maxW="24">
            {shown ? `${shown.label} · ${pct(shown.value)}%` : tx("judged")}
          </Text>
        </Stack>
      </Box>

      {/* Legend with the numbers: also the readable table of the chart */}
      <Stack as="ul" gap="1" flex="1" w="full" listStyleType="none">
        {slices.map((s) => (
          <Flex
            as="li"
            key={s.key}
            align="center"
            gap="3"
            px="3"
            py="2"
            rounded="md"
            bg={active === s.key ? "bg.subtle" : "transparent"}
            tabIndex={0}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.500" }}
          >
            <Box w="3" h="3" rounded="sm" flexShrink={0} bg={RESULT_COLORS[s.key]} borderWidth={s.key === "pending" ? "1px" : 0} borderColor="gray.300" />
            <Text flex="1" fontSize="sm" color="fg.muted">
              {s.label}
            </Text>
            <Text fontSize="sm" fontWeight="semibold">
              {s.value}
            </Text>
            <Text fontSize="xs" color="fg.muted" w="10" textAlign="end">
              {pct(s.value)}%
            </Text>
          </Flex>
        ))}
      </Stack>
    </Flex>
  );
}

// Histogram: how many participants got how many points, in 10 equal ranges, with the gold
// pass-mark line. Each bar is split into passed / failed, so a range that holds the pass mark is right too.
export function ScoreHistogram({
  scores,
  passMark,
  maxScore,
}: {
  scores: number[];
  passMark: number;
  maxScore: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { tx } = useI18n();

  const binCount = 10;
  const binSize = maxScore / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    from: Math.round(i * binSize * 10) / 10,
    to: Math.round((i + 1) * binSize * 10) / 10,
    passed: 0,
    failed: 0,
  }));
  for (const s of scores) {
    const i = Math.min(binCount - 1, Math.floor(s / binSize)); // the top score goes in the last range
    if (s >= passMark) bins[i]!.passed++;
    else bins[i]!.failed++;
  }
  const maxCount = Math.max(1, ...bins.map((b) => b.passed + b.failed));
  const yTop = Math.max(2, Math.ceil(maxCount / 2) * 2); // even number, so the middle gridline is whole

  // Drawing area (viewBox units)
  const W = 640;
  const H = 240;
  const pad = { top: 26, right: 8, bottom: 28, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const slot = plotW / binCount;
  const barW = slot - 6; // gap between bars
  const x = (v: number) => pad.left + (v / maxScore) * plotW;
  const y = (n: number) => pad.top + plotH - (n / yTop) * plotH;
  const baseline = pad.top + plotH;

  // Bar segment path: only the top segment gets 4px rounded corners.
  const seg = (x0: number, yTopPx: number, yBottomPx: number, rounded: boolean) => {
    const h = yBottomPx - yTopPx;
    if (h <= 0) return "";
    const r = rounded ? Math.min(4, h, barW / 2) : 0;
    return `M${x0} ${yBottomPx}V${yTopPx + r}Q${x0} ${yTopPx} ${x0 + r} ${yTopPx}H${x0 + barW - r}Q${x0 + barW} ${yTopPx} ${x0 + barW} ${yTopPx + r}V${yBottomPx}Z`;
  };

  const hovered = hover !== null ? bins[hover]! : null;

  return (
    <Box position="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={tx("Points of {n} judged participants, pass mark {mark}", { n: scores.length, mark: passMark })}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Gridlines and y labels */}
        {[0, yTop / 2, yTop].map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#d4d4d8" : GRID} strokeWidth="1" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={INK_MUTED}>
              {t}
            </text>
          </g>
        ))}

        {/* Bars: failed at the bottom, passed on top, 2px white gap between them */}
        {bins.map((b, i) => {
          const x0 = pad.left + i * slot + 3;
          const total = b.passed + b.failed;
          const yFailedTop = y(b.failed);
          const yPassedTop = y(total);
          return (
            <g key={i} opacity={hover !== null && hover !== i ? 0.45 : 1} style={{ transition: "opacity 0.15s" }}>
              {b.failed > 0 && (
                <path d={seg(x0, yFailedTop, baseline, b.passed === 0)} fill={RESULT_COLORS.failed} />
              )}
              {b.passed > 0 && (
                <path
                  d={seg(x0, yPassedTop, b.failed > 0 ? yFailedTop - 2 : baseline, true)}
                  fill={RESULT_COLORS.passed}
                />
              )}
              {total > 0 && (
                <text x={x0 + barW / 2} y={yPassedTop - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#3f3f46">
                  {total}
                </text>
              )}
              {/* Hit area: the whole column, bigger than the bar */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}

        {/* Pass mark */}
        <line x1={x(passMark)} x2={x(passMark)} y1={pad.top - 14} y2={baseline} stroke={GOLD} strokeWidth="2" strokeDasharray="4 3" pointerEvents="none" />
        <text x={x(passMark)} y={pad.top - 18} textAnchor="middle" fontSize="11" fontWeight="600" fill={GOLD}>
          {tx("Pass mark {n}", { n: passMark })}
        </text>

        {/* x labels: every other range start, and the maximum */}
        {bins.map(
          (b, i) =>
            i % 2 === 0 && (
              <text key={i} x={pad.left + i * slot} y={baseline + 18} textAnchor="middle" fontSize="11" fill={INK_MUTED}>
                {b.from}
              </text>
            ),
        )}
        <text x={W - pad.right} y={baseline + 18} textAnchor="end" fontSize="11" fill={INK_MUTED}>
          {maxScore}
        </text>
      </svg>

      {hovered && (
        <Box
          position="absolute"
          top="0"
          left={`${((pad.left + (hover! + 0.5) * slot) / W) * 100}%`}
          transform={hover! > binCount / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)"}
          bg="white"
          borderWidth="1px"
          rounded="md"
          shadow="md"
          px="3"
          py="2"
          fontSize="xs"
          pointerEvents="none"
          whiteSpace="nowrap"
          zIndex="1"
        >
          <Text fontWeight="semibold" mb="1">
            {tx("{from}–{to} points", { from: hovered.from, to: hovered.to })}
          </Text>
          <TooltipRow color={RESULT_COLORS.passed} label={tx("Passed")} value={hovered.passed} />
          <TooltipRow color={RESULT_COLORS.failed} label={tx("Failed")} value={hovered.failed} />
        </Box>
      )}
    </Box>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <Flex align="center" gap="2">
      <Box w="2" h="2" rounded="sm" bg={color} />
      <Text color="fg.muted" flex="1">
        {label}
      </Text>
      <Text fontWeight="semibold">{value}</Text>
    </Flex>
  );
}
