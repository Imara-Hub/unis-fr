"use client";

import { useMutation, useQuery } from "@apollo/client/react";
import { Badge, Box, Button, Card, Flex, IconButton, Input, InputGroup, Menu, Portal, Skeleton, Stack, Text } from "@chakra-ui/react";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, ListOrdered, Printer, Search, Eraser, Shuffle } from "lucide-react";
import NextLink from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AdminOnly } from "@/components/AdminOnly";
import { confirmDialog } from "@/components/ConfirmDialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { NumberTag } from "@/components/NumberTag";
import { PageHeader } from "@/components/PageHeader";
import { ParticipantPhoto } from "@/components/ParticipantPhoto";
import { toaster } from "@/components/Toaster";
import { readApiError } from "@/lib/errors";
import { byPassageOrder } from "@/lib/graphql/judging";
import { NUMBER_PARTICIPANTS, PARTICIPANTS, type ParticipantRow } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { useFlipList } from "@/lib/useFlipList";
import { DropdownCard, dropdownItemStyle, ItemBadge } from "@/components/Dropdown";

export default function OrderPage() {
  return (
    <AdminOnly>
      <Order />
    </AdminOnly>
  );
}

type Arrangement = "registration" | "name" | "institution" | "shuffle";
const ARRANGEMENTS: { id: Arrangement; label: AppKey }[] = [
  { id: "registration", label: "By registration date" },
  { id: "name", label: "By name A–Z" },
  { id: "institution", label: "By halaqa" },
  { id: "shuffle", label: "At random" },
];

const VARIABLES = { status: null, search: null, review: "APPROVED" as const };

// The order of passage. The admin arranges the approved participants (drag, arrows, or a
// position typed in) and saves: the first gets N° 1, the second N° 2… Judges call participants
// in this order. Changes stay on this screen until "Save the order".
function Order() {
  const list = useQuery(PARTICIPANTS, { variables: VARIABLES });
  const [save, { loading: saving }] = useMutation(NUMBER_PARTICIPANTS, { refetchQueries: [{ query: PARTICIPANTS, variables: VARIABLES }] });
  const [draft, setDraft] = useState<string[] | null>(null); // ids in the new order; null = as saved
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { tx } = useI18n();

  const participants = list.data?.participants ?? list.previousData?.participants;
  const byId = useMemo(() => new Map((participants ?? []).map((p) => [p.id, p])), [participants]);
  const savedOrder = useMemo(() => byPassageOrder(participants ?? []).map((p) => p.id), [participants]);

  // The order on screen: the draft, plus anyone approved since it started (at the end), minus anyone gone.
  const order = useMemo(() => {
    if (!draft) return savedOrder;
    const kept = draft.filter((id) => byId.has(id));
    const known = new Set(kept);
    return [...kept, ...savedOrder.filter((id) => !known.has(id))];
  }, [draft, savedOrder, byId]);

  const dirty = draft !== null && order.some((id, i) => savedOrder[i] !== id || byId.get(id)?.number !== i + 1);
  const unnumbered = (participants ?? []).filter((p) => p.number === null).length;
  const notInSequence = !dirty && (participants ?? []).some((p, _, all) => p.number !== null && p.number > all.length);

  const q = search.trim().toLowerCase();
  const shown = q
    ? order.filter((id) => {
        const p = byId.get(id)!;
        return p.fullName.toLowerCase().includes(q) || p.institution.toLowerCase().includes(q) || p.commune.toLowerCase().includes(q) || String(p.number ?? "") === q;
      })
    : order;

  function move(id: string, to: number) {
    const from = order.indexOf(id);
    const target = Math.max(0, Math.min(order.length - 1, to));
    if (from === -1 || from === target) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(target, 0, id);
    setDraft(next);
  }

  function arrange(how: Arrangement) {
    const rows = order.map((id) => byId.get(id)!);
    const sorted =
      how === "registration"
        ? [...rows].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
        : how === "name"
          ? [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }))
          : how === "institution"
            ? [...rows].sort((a, b) => a.institution.localeCompare(b.institution, undefined, { sensitivity: "base" }) || a.fullName.localeCompare(b.fullName))
            : shuffle(rows);
    setDraft(sorted.map((p) => p.id));
  }

  async function onSave() {
    setError(null);
    try {
      await save({ variables: { ids: order } });
      setDraft(null);
      toaster.create({ type: "success", title: tx("Order saved: N° 1 to N° {n}", { n: order.length }) });
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  async function onClear() {
    if (!(await confirmDialog({ message: tx("Take every number away? The judges then call participants in the order they registered, until you save a new order."), destructive: true }))) return;
    setError(null);
    try {
      await save({ variables: { ids: [] } });
      setDraft(null);
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  // Drag by the handle (mouse, finger or pen): the row follows the pointer, the others slide out of
  // its way (useFlipList), and the list scrolls by itself near the top and bottom of the screen.
  // Escape (or the system cancelling the touch) puts everything back.
  const drag = useRef<{ id: string; el: HTMLElement; grab: number; y: number; before: string[] | null; frame: number } | null>(null);
  // The order as last shown, for the pointer handlers (they outlive the render that made them).
  const latest = useRef({ order, shown });
  useLayoutEffect(() => {
    latest.current = { order, shown };
  });

  // Keeps the dragged row under the pointer, wherever its place in the list is now.
  function followPointer() {
    const d = drag.current;
    const list = listRef.current;
    if (!d || !list) return;
    const top = d.y - list.getBoundingClientRect().top - d.grab;
    d.el.style.transform = `translateY(${top - d.el.offsetTop}px) scale(1.02)`;
    return top;
  }

  // Moves the dragged participant to the place under the pointer (among the rows shown).
  function reorderUnderPointer() {
    const d = drag.current;
    const list = listRef.current;
    const top = followPointer();
    if (!d || !list || top === undefined) return;
    const center = top + d.el.offsetHeight / 2;
    const others = [...list.querySelectorAll<HTMLElement>("[data-flip-id]")].filter((r) => r.dataset.flipId !== d.id);
    const before = others.findIndex((r) => r.offsetTop + r.offsetHeight / 2 > center);
    const { order: current } = latest.current;
    const rest = current.filter((id) => id !== d.id);
    const at = before === -1 ? rest.indexOf(others[others.length - 1]!.dataset.flipId!) + 1 : rest.indexOf(others[before]!.dataset.flipId!);
    if (at < 0) return;
    const next = [...rest.slice(0, at), d.id, ...rest.slice(at)];
    if (next.some((id, i) => id !== current[i])) setDraft(next);
  }

  function startDrag(e: ReactPointerEvent<HTMLElement>, id: string) {
    if (e.button !== 0 || latest.current.shown.length < 2) return;
    const el = e.currentTarget.closest<HTMLElement>("[data-flip-id]");
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    el.style.transition = "box-shadow 150ms";
    drag.current = { id, el, grab: e.clientY - el.getBoundingClientRect().top, y: e.clientY, before: draft, frame: 0 };
    setDragging(id);
    // Scrolls while the pointer stays near the top or bottom edge.
    const edge = 72;
    const tick = () => {
      const d = drag.current;
      if (!d) return;
      const speed = d.y < edge ? -(edge - d.y) / 3 : d.y > window.innerHeight - edge ? (d.y - (window.innerHeight - edge)) / 3 : 0;
      if (speed) {
        window.scrollBy(0, speed);
        reorderUnderPointer();
      }
      d.frame = requestAnimationFrame(tick);
    };
    drag.current.frame = requestAnimationFrame(tick);
  }

  function dragMove(e: ReactPointerEvent<HTMLElement>) {
    if (!drag.current) return;
    drag.current.y = e.clientY;
    reorderUnderPointer();
  }

  function endDrag(cancel = false) {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.frame);
    drag.current = null;
    if (cancel) setDraft(d.before);
    // Settles into its place.
    d.el.style.transition = "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 200ms";
    d.el.style.transform = "";
    setDragging(null);
  }

  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && endDrag(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Rows glide to their new place on every change of order (arrange, arrows, typed position, drag).
  useFlipList(listRef, order.join(","), { skipId: dragging, afterLayout: followPointer });

  return (
    <>
      <PageHeader
        title={tx("Order of passage")}
        description={tx("Arrange the approved participants in the order they will recite. The first gets N° 1, the next N° 2… The judges call them in this order.")}
        actions={
          <Flex gap="2" wrap="wrap" justify="flex-end">
            <Button asChild variant="outline" colorPalette="brand">
              <NextLink href="/print/order">
                <Printer size={16} aria-hidden />
                {tx("Print / PDF")}
              </NextLink>
            </Button>
            <Menu.Root positioning={{ placement: "bottom-end" }}>
              <Menu.Trigger asChild>
                <Button variant="outline" colorPalette="brand" disabled={!participants?.length}>
                  <ListOrdered size={16} aria-hidden />
                  {tx("Arrange")}
                  <ChevronDown size={14} aria-hidden />
                </Button>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <DropdownCard title={tx("Arrange")} icon={<ListOrdered />} minW="64">
                    {ARRANGEMENTS.map((a, i) => (
                      <Menu.Item key={a.id} value={a.id} onSelect={() => arrange(a.id)} {...dropdownItemStyle()}>
                        <ItemBadge>{a.id === "shuffle" ? <Shuffle size={14} aria-hidden /> : i + 1}</ItemBadge>
                        {tx(a.label)}
                      </Menu.Item>
                    ))}
                    <Menu.Separator my="1.5" />
                    <Menu.Item value="clear" onSelect={onClear} disabled={unnumbered === participants?.length} {...dropdownItemStyle(false, "danger")}>
                      <ItemBadge tone="danger">
                        <Eraser size={14} aria-hidden />
                      </ItemBadge>
                      {tx("Take every number away")}
                    </Menu.Item>
                  </DropdownCard>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
            {dirty && (
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                {tx("Discard")}
              </Button>
            )}
            <Button colorPalette="brand" onClick={onSave} loading={saving} disabled={!dirty && unnumbered === 0 && !notInSequence}>
              {tx("Save the order")}
            </Button>
          </Flex>
        }
      />

      <ErrorAlert message={error ?? (list.error ? readApiError(list.error).message : null)} />

      {participants && participants.length > 0 && (dirty || unnumbered > 0 || notInSequence) && (
        <Box mb="4" px="4" py="3" rounded="lg" bg={dirty ? "gold.50" : "orange.50"} borderWidth="1px" borderColor={dirty ? "gold.200" : "orange.200"} fontSize="sm">
          {dirty
            ? tx("The order has changed. Save it to give the numbers: the judges see the new order at once.")
            : unnumbered > 0
              ? tx("{n} participants have no number yet. Arrange them, then save: everyone gets a number.", { n: unnumbered })
              : tx("The numbers have gaps. Save to number everyone again from 1, in this order.")}
        </Box>
      )}

      <Card.Root overflow="hidden">
        <Flex p="3" borderBottomWidth="1px" gap="3" align="center" wrap="wrap" bg="bg.subtle">
          <InputGroup startElement={<Search size={16} />} flex="1" minW="56">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx("Find someone to move")} bg="white" />
          </InputGroup>
          <Text fontSize="sm" color="fg.muted">
            {tx("{n} approved participants", { n: participants?.length ?? 0 })}
          </Text>
        </Flex>

        {!participants ? (
          <Stack p="4" gap="2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} h="14" rounded="md" />
            ))}
          </Stack>
        ) : participants.length === 0 ? (
          <Text p="8" textAlign="center" color="fg.muted" fontSize="sm">
            {tx("No approved participant yet. Approve registrations first.")}
          </Text>
        ) : shown.length === 0 ? (
          <Text p="8" textAlign="center" color="fg.muted" fontSize="sm">
            {tx("Nobody matches.")}
          </Text>
        ) : (
          <Stack gap="0" role="list" ref={listRef} position="relative" userSelect={dragging ? "none" : undefined}>
            {shown.map((id) => (
              <Row
                key={id}
                participant={byId.get(id)!}
                position={order.indexOf(id)}
                total={order.length}
                changed={dirty && byId.get(id)!.number !== order.indexOf(id) + 1}
                dragging={dragging === id}
                onMove={(to) => move(id, to)}
                grip={{
                  onPointerDown: (e) => startDrag(e, id),
                  onPointerMove: dragMove,
                  onPointerUp: () => endDrag(),
                  onPointerCancel: () => endDrag(true),
                }}
              />
            ))}
          </Stack>
        )}
      </Card.Root>
    </>
  );
}

function Row({
  participant: p,
  position,
  total,
  changed,
  dragging,
  onMove,
  grip,
}: {
  participant: ParticipantRow;
  position: number;
  total: number;
  changed: boolean;
  dragging: boolean;
  onMove: (to: number) => void;
  grip: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const { tx } = useI18n();
  const recited = p.sheetsSubmitted > 0 || p.score !== null;

  function commit() {
    if (typed !== null) {
      const n = Number(typed);
      if (Number.isInteger(n) && n >= 1) onMove(n - 1);
    }
    setTyped(null);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setTyped(null);
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <Flex
      role="listitem"
      data-flip-id={p.id}
      position="relative"
      zIndex={dragging ? 2 : undefined}
      align="center"
      gap={{ base: "2", md: "3" }}
      px={{ base: "2", md: "3" }}
      py="2"
      borderTopWidth="1px"
      bg={dragging ? "white" : changed ? "gold.50" : "white"}
      shadow={dragging ? "lg" : undefined}
      rounded={dragging ? "md" : undefined}
    >
      {/* The handle: press and move to drag the row (touch too). */}
      <Box
        color={dragging ? "brand.600" : "fg.subtle"}
        cursor={dragging ? "grabbing" : "grab"}
        touchAction="none"
        p="1"
        mx="-1"
        rounded="sm"
        _hover={{ color: "brand.600", bg: "bg.subtle" }}
        aria-hidden
        {...grip}
      >
        <GripVertical size={18} />
      </Box>

      {/* The position: the number this participant gets when the order is saved. Type to move. */}
      <Input
        aria-label={tx("Position of {name}", { name: p.fullName })}
        value={typed ?? String(position + 1)}
        onFocus={(e) => {
          setTyped(String(position + 1));
          e.target.select();
        }}
        onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={onKey}
        inputMode="numeric"
        w="14"
        textAlign="center"
        fontWeight="bold"
        color="brand.900"
        fontVariantNumeric="tabular-nums"
        bg={changed ? "white" : "bg.subtle"}
        flexShrink={0}
      />

      <ParticipantPhoto path={p.photoUrl} size="thumb" />
      <Box flex="1" minW="0">
        <Flex align="center" gap="2" minW="0" wrap="wrap">
          <Text fontWeight="semibold" color="brand.900" truncate>
            {p.fullName}
          </Text>
          {p.number !== position + 1 && <NumberTag number={p.number} />}
          {recited && (
            <Badge colorPalette="green" variant="subtle" size="sm">
              {tx("Recited")}
            </Badge>
          )}
        </Flex>
        <Text fontSize="xs" color="fg.muted" truncate>
          {p.institution} · {p.commune}
        </Text>
      </Box>

      <Flex gap="1" flexShrink={0}>
        <IconButton aria-label={tx("Move up")} size="sm" variant="ghost" onClick={() => onMove(position - 1)} disabled={position === 0}>
          <ArrowUp size={16} />
        </IconButton>
        <IconButton aria-label={tx("Move down")} size="sm" variant="ghost" onClick={() => onMove(position + 1)} disabled={position === total - 1}>
          <ArrowDown size={16} />
        </IconButton>
      </Flex>
    </Flex>
  );
}

function shuffle<T>(list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
