"use client";

import type { GuardianRelation, RegisteredBy, RegistrarContact, RegistrarInstitutionType } from "@/lib/graphql/participants";
import { useI18n, type AppKey } from "@/lib/i18n";

const REGISTERED_BY: Record<RegisteredBy, AppKey> = {
  SELF: "Themselves",
  GUARDIAN: "Parent or guardian",
  INSTITUTION: "School, masjid or markaz",
};

const RELATIONS: Record<GuardianRelation, AppKey> = {
  FATHER: "Father",
  MOTHER: "Mother",
  BROTHER: "Brother",
  SISTER: "Sister",
  UNCLE: "Uncle",
  AUNT: "Aunt",
  GRANDPARENT: "Grandparent",
  OTHER: "Other relative",
};

const INSTITUTION_TYPES: Record<RegistrarInstitutionType, AppKey> = {
  SCHOOL: "School",
  MASJID: "Masjid",
  MARKAZ: "Markaz",
};

// Who registered a participant, in words: "Father: Hamisi N." or "Markaz Nour (Markaz): Ustadh Rajab".
export function useRegistrar() {
  const { tx } = useI18n();
  return {
    kind: (by: RegisteredBy) => tx(REGISTERED_BY[by]),
    relation: (r: GuardianRelation) => tx(RELATIONS[r]),
    // Null when the participant registered themselves.
    who: (p: { registeredBy: RegisteredBy; contact: RegistrarContact | null }) => {
      const c = p.contact;
      if (p.registeredBy === "SELF" || !c) return null;
      if (p.registeredBy === "GUARDIAN") {
        return `${c.relation ? tx(RELATIONS[c.relation]) : tx("Parent or guardian")}: ${c.name}`;
      }
      const place = c.institutionName ?? tx("School, masjid or markaz");
      return `${place}${c.institutionType ? ` (${tx(INSTITUTION_TYPES[c.institutionType])})` : ""}: ${c.name}`;
    },
  };
}
