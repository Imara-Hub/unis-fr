"use client";

import { useEffect, useState, type ReactNode } from "react";

// Loading indicators wait a moment before showing: on a fast connection the page goes straight
// to its content instead of flashing a spinner or skeleton for a split second.
export const LOADING_DELAY_MS = 400;

export function useDelayed(ms = LOADING_DELAY_MS) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return show;
}

export function Delayed({ children, ms }: { children: ReactNode; ms?: number }) {
  return useDelayed(ms) ? children : null;
}
