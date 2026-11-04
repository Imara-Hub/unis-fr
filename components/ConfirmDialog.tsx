"use client";

import { Button, CloseButton, Dialog, Portal, Text } from "@chakra-ui/react";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";

// A Chakra dialog in place of the browser's confirm() popup:
//   if (!(await confirmDialog({ message: tx("Delete envelope {n}?", { n }) }))) return;
// One <ConfirmDialogHost /> (in Providers) shows whichever question is asked.

interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  // Red confirm button, for actions that delete or cut something off.
  destructive?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // A question still open is answered "no" before the new one shows.
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

function answer(ok: boolean) {
  if (!pending) return;
  pending.resolve(ok);
  pending = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ConfirmDialogHost() {
  const current = useSyncExternalStore(subscribe, () => pending, () => null);
  const { tx } = useI18n();

  return (
    <Dialog.Root
      role="alertdialog"
      open={Boolean(current)}
      onOpenChange={(e) => !e.open && answer(false)}
      placement="center"
      motionPreset="slide-in-bottom"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner px="4">
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title color="brand.900">{current?.title ?? tx("Are you sure?")}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text color="fg.muted">{current?.message}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => answer(false)}>
                {tx("Cancel")}
              </Button>
              <Button colorPalette={current?.destructive ? "red" : "brand"} onClick={() => answer(true)}>
                {current?.confirmLabel ?? tx("Confirm")}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
