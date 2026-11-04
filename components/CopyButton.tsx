"use client";

import { Button, type ButtonProps } from "@chakra-ui/react";
import { useEffect, useState, type ReactNode } from "react";
import { copyText } from "@/lib/clipboard";
import { useI18n } from "@/lib/i18n";

// A button that copies `value` and says "Copied!" for a moment. Works over plain http too.
export function CopyButton({
  value,
  children,
  icon,
  after,
  ...props
}: Omit<ButtonProps, "value" | "children" | "onClick"> & {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  after?: ReactNode;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const { tx } = useI18n();

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <Button {...props} onClick={async () => setState((await copyText(value)) ? "copied" : "failed")}>
      {icon}
      {state === "copied" ? tx("Copied!") : state === "failed" ? tx("Copy failed") : children}
      {after}
    </Button>
  );
}
