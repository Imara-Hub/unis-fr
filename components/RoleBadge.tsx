"use client";

import { Badge } from "@chakra-ui/react";
import { Crown, Eye, Scale, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/graphql/auth";
import type { AppKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

// One colour and icon per role, used everywhere a role is shown.
export const ROLE_STYLE: Record<Role, { label: AppKey; plural: AppKey; palette: string; icon: LucideIcon; does: AppKey }> = {
  ADMIN: { label: "Admin", plural: "Admin", palette: "gold", icon: Crown, does: "Runs the competition: registrations, team, settings." },
  JUDGE: {
    label: "Judge",
    plural: "Judges",
    palette: "blue",
    icon: Scale,
    does: "Prepare the envelopes, call participants and mark their own sheet.",
  },
  STAFF: { label: "Staff", plural: "Staff", palette: "teal", icon: Eye, does: "Watch the live stage, the list, the sheets and the PDF." },
};

export function RoleBadge({ role, size = "sm" }: { role: Role; size?: "sm" | "md" }) {
  const s = ROLE_STYLE[role];
  const { tx } = useI18n();
  const Icon = s.icon;
  return (
    <Badge colorPalette={s.palette} variant="solid" size={size} gap="1">
      <Icon size={size === "md" ? 13 : 11} aria-hidden />
      {tx(s.label)}
    </Badge>
  );
}
