"use client";

import { Badge, Circle, HStack } from "@chakra-ui/react";
import { Check, Clock, Trophy, X } from "lucide-react";
import type { ParticipantStatus, ReviewStatus } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

export const STATUS_LABELS: Record<ParticipantStatus, AppKey> = {
  PENDING: "Not judged",
  PASSED: "Passed",
  FAILED: "Failed",
};

const COLORS: Record<ParticipantStatus, string> = { PENDING: "gray", PASSED: "green", FAILED: "red" };

// Passed / Failed / Not judged, and the final: shown everywhere as round icons (a check, a cross,
// a clock, a gold trophy), the words kept as the tooltip and for screen readers.
export function StatusBadge({
  status,
  finalist = false,
  size = "sm",
  stacked = false,
}: {
  status: ParticipantStatus;
  finalist?: boolean;
  size?: "sm" | "md" | "lg";
  /** The two icons one above the other (narrow table cells). */
  stacked?: boolean;
}) {
  return <StatusIcons status={status} finalist={finalist} size={size} stacked={stacked} />;
}

export const REVIEW_LABELS: Record<ReviewStatus, AppKey> = {
  PENDING_REVIEW: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const REVIEW_COLORS: Record<ReviewStatus, string> = { PENDING_REVIEW: "orange", APPROVED: "green", REJECTED: "red" };

// The admin's decision on a registration (only the admin ever sees anything but APPROVED).
export function ReviewBadge({ review, size = "sm" }: { review: ReviewStatus; size?: "sm" | "md" | "lg" }) {
  const { tx } = useI18n();
  return (
    <Badge colorPalette={REVIEW_COLORS[review]} size={size} variant={review === "APPROVED" ? "outline" : "solid"}>
      {tx(REVIEW_LABELS[review])}
    </Badge>
  );
}

// The same as StatusBadge, as round icons only (tables short of room): a check for passed, a cross
// for did not pass, a clock for not judged, and a trophy for the final. The words stay as the
// tooltip and for screen readers.
const CIRCLE = { sm: { box: "7", icon: 15 }, md: { box: "8", icon: 17 }, lg: { box: "10", icon: 20 } } as const;

export function StatusIcons({
  status,
  finalist = false,
  size = "sm",
  stacked = false,
}: {
  status: ParticipantStatus;
  finalist?: boolean;
  size?: "sm" | "md" | "lg";
  stacked?: boolean;
}) {
  const { tx } = useI18n();
  const { box, icon } = CIRCLE[size];
  const label = tx(STATUS_LABELS[status]);
  const look =
    status === "PASSED"
      ? { bg: "green.500", color: "white", icon: <Check size={icon} strokeWidth={3} aria-hidden /> }
      : status === "FAILED"
        ? { bg: "red.500", color: "white", icon: <X size={icon} strokeWidth={3} aria-hidden /> }
        : { bg: "gray.100", color: "gray.600", icon: <Clock size={icon - 1} strokeWidth={2.5} aria-hidden /> };
  return (
    <HStack gap="1.5" display="inline-flex" flexDirection={stacked ? "column" : "row"}>
      <Circle size={box} bg={look.bg} color={look.color} title={label} role="img" aria-label={label}>
        {look.icon}
      </Circle>
      {finalist && (
        <Circle
          size={box}
          bg="linear-gradient(160deg, #FDD199 0%, #FBB75E 50%, #E07F0A 100%)"
          color="brand.900"
          boxShadow="inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 4px rgba(224,127,10,0.45)"
          title={tx("Final")}
          role="img"
          aria-label={tx("Final")}
        >
          <Trophy size={icon - 1} strokeWidth={2.5} aria-hidden />
        </Circle>
      )}
    </HStack>
  );
}
