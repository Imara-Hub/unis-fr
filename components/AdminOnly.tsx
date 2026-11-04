"use client";

import { useQuery } from "@apollo/client/react";
import type { ReactNode } from "react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ME, type Role } from "@/lib/graphql/auth";
import { useI18n } from "@/lib/i18n";

// Hides pages from the roles that may not use them. The API checks the role too; this is only for the UI.
export function RoleOnly({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data } = useQuery(ME);
  const { tx } = useI18n();
  const role = data?.me?.role;
  if (!role || !roles.includes(role)) return <ErrorAlert message={tx("You do not have access to this page.")} />;
  return children;
}

export function AdminOnly({ children }: { children: ReactNode }) {
  return <RoleOnly roles={["ADMIN"]}>{children}</RoleOnly>;
}
