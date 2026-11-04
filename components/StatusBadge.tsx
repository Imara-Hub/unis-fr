"use client";

import { Badge } from "@chakra-ui/react";
import type { ParticipantStatus, ReviewStatus } from "@/lib/graphql/participants";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

export const STATUS_LABELS: Record<ParticipantStatus, AppKey> = {
  PENDING: "Not judged",
  PASSED: "Passed",
  FAILED: "Failed",
};

const COLORS: Record<ParticipantStatus, string> = { PENDING: "gray", PASSED: "green", FAILED: "red" };

export function StatusBadge({ status, size = "sm" }: { status: ParticipantStatus; size?: "sm" | "md" | "lg" }) {
  const { tx } = useI18n();
  return (
    <Badge colorPalette={COLORS[status]} size={size} variant={status === "PENDING" ? "outline" : "solid"}>
      {tx(STATUS_LABELS[status])}
    </Badge>
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
