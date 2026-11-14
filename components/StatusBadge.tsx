"use client";

import { Badge, HStack } from "@chakra-ui/react";
import type { ParticipantStatus, ReviewStatus } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

export const STATUS_LABELS: Record<ParticipantStatus, AppKey> = {
  PENDING: "Not judged",
  PASSED: "Passed",
  FAILED: "Failed",
};

const COLORS: Record<ParticipantStatus, string> = { PENDING: "gray", PASSED: "green", FAILED: "red" };

// Passed / Failed / Not judged, and a gold "Final" next to it for those going to the final.
export function StatusBadge({
  status,
  finalist = false,
  size = "sm",
}: {
  status: ParticipantStatus;
  finalist?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const { tx } = useI18n();
  const badge = (
    <Badge colorPalette={COLORS[status]} size={size} variant={status === "PENDING" ? "outline" : "solid"}>
      {tx(STATUS_LABELS[status])}
    </Badge>
  );
  if (!finalist) return badge;
  return (
    <HStack gap="1" display="inline-flex">
      {badge}
      <Badge colorPalette="yellow" bg="gold.400" color="brand.900" size={size} variant="solid">
        {tx("Final")}
      </Badge>
    </HStack>
  );
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
