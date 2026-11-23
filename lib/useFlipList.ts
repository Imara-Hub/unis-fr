import { useLayoutEffect, useRef, type RefObject } from "react";

// Smooth reordering for a list: when the order changes, each row glides from where it was to its
// new place instead of jumping (the "FLIP" technique: measure, move back with a transform, then
// let the transform ease to zero). Rows are the container's elements with a `data-flip-id`.
//
// `orderKey` changes whenever the order changes (e.g. the ids joined); other renders (a search
// filter, a typed letter) only re-measure. `skipId` is a row moved by hand (being dragged): it is
// left alone. `afterLayout` runs after each layout, e.g. to keep a dragged row under the pointer.
const DURATION_MS = 240;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function currentOffset(el: HTMLElement) {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === "none") return 0;
  return new DOMMatrixReadOnly(transform).m42;
}

export function useFlipList(
  container: RefObject<HTMLElement | null>,
  orderKey: string,
  { skipId = null, afterLayout }: { skipId?: string | null; afterLayout?: () => void } = {},
) {
  const tops = useRef(new Map<string, number>());
  const lastKey = useRef(orderKey);

  useLayoutEffect(() => {
    const list = container.current;
    if (!list) return;
    const animate = lastKey.current !== orderKey && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    lastKey.current = orderKey;

    const next = new Map<string, number>();
    for (const row of list.querySelectorAll<HTMLElement>("[data-flip-id]")) {
      const id = row.dataset.flipId!;
      const top = row.offsetTop; // the layout position: transforms do not change it
      next.set(id, top);
      const before = tops.current.get(id);
      if (!animate || id === skipId || before === undefined || before === top) continue;
      // Put the row back where it is seen now (old place, plus any glide still running)…
      const from = before - top + currentOffset(row);
      row.style.transition = "none";
      row.style.transform = `translateY(${from}px)`;
      row.getBoundingClientRect(); // apply it before the transition starts
      // …then let it glide to its new place.
      row.style.transition = `transform ${DURATION_MS}ms ${EASING}`;
      row.style.transform = "";
    }
    tops.current = next;
    afterLayout?.();
  });
}
