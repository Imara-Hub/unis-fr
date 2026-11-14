"use client";

import { useMutation } from "@apollo/client/react";
import { Button, CloseButton, Dialog, Field, Flex, Portal, Text, Textarea } from "@chakra-ui/react";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { toaster } from "@/components/Toaster";
import { readApiError } from "@/lib/errors";
import { APPROVE_PARTICIPANT, REJECT_PARTICIPANT, type ParticipantDetail, type ReviewStatus } from "@/lib/graphql/participants";
import { useI18n } from "@/lib/i18n";

// Just the two decision buttons (under the printable form). Reject asks for the reason in a dialog.
// onDecided runs after the server accepted the decision (to open the next registration).
export function ReviewActions({
  participant: p,
  onDecided,
}: {
  participant: ParticipantDetail;
  onDecided?: (decision: ReviewStatus) => void;
}) {
  const { tx } = useI18n();
  const [approve, approving] = useMutation(APPROVE_PARTICIPANT);
  const [reject, rejecting] = useMutation(REJECT_PARTICIPANT);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  // Marked or scored: in the competition, so it can no longer be rejected.
  const locked = p.sheetsSubmitted > 0 || p.status !== "PENDING";

  async function onApprove() {
    setError(null);
    try {
      await approve({ variables: { id: p.id } });
      toaster.create({ type: "success", title: tx("Registration approved"), description: p.fullName });
      onDecided?.("APPROVED");
    } catch (err) {
      setError(readApiError(err).message);
    }
  }

  async function onReject() {
    setReasonError(undefined);
    if (reason.trim().length < 3) {
      setReasonError(tx("Say why, so you can tell the person (at least 3 characters)"));
      return;
    }
    try {
      await reject({ variables: { id: p.id, reason: reason.trim() } });
      setRejectOpen(false);
      setReason("");
      toaster.create({ type: "success", title: tx("Registration rejected"), description: p.fullName });
      onDecided?.("REJECTED");
    } catch (err) {
      const apiError = readApiError(err);
      if (apiError.fields.reason) setReasonError(apiError.fields.reason);
      else {
        setRejectOpen(false);
        setError(apiError.message);
      }
    }
  }

  return (
    <>
      {error && <ErrorAlert message={error} />}
      <Flex gap="3" justify="center" wrap="wrap" mt={error ? "3" : "0"}>
        {p.review !== "REJECTED" && !locked && (
          <Button size="lg" minW="44" variant="outline" colorPalette="red" bg="white" onClick={() => setRejectOpen(true)}>
            <X size={18} aria-hidden />
            {tx("Reject")}
          </Button>
        )}
        {p.review !== "APPROVED" && (
          <Button size="lg" minW="44" colorPalette="green" onClick={onApprove} loading={approving.loading}>
            <Check size={18} aria-hidden />
            {p.review === "REJECTED" ? tx("Approve instead") : tx("Approve")}
          </Button>
        )}
        {p.review === "APPROVED" && locked && (
          <Text fontSize="sm" color="fg.muted">
            {tx("Already in the competition: it can no longer be rejected.")}
          </Text>
        )}
      </Flex>

      <Dialog.Root open={rejectOpen} onOpenChange={(e) => setRejectOpen(e.open)} placement="center" motionPreset="slide-in-bottom">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner px="4">
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title color="brand.900">{tx("Reject registration")}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root invalid={Boolean(reasonError)}>
                  <Field.Label>{tx("Why is this registration rejected?")}</Field.Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={tx("e.g. Older than 29 according to the ID document")}
                    maxLength={500}
                    rows={3}
                    autoFocus
                  />
                  <Field.ErrorText>{reasonError}</Field.ErrorText>
                </Field.Root>
                <Text fontSize="xs" color="fg.muted" mt="3">
                  {tx("This person stays registered and cannot register again. If the name or date of birth is wrong, delete the registration instead, so they can register again.")}
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setRejectOpen(false)}>
                  {tx("Cancel")}
                </Button>
                <Button colorPalette="red" onClick={onReject} loading={rejecting.loading}>
                  {tx("Reject registration")}
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
