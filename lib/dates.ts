import { dateLocale } from "@/lib/i18n/core";

// Dates of birth come from the API as "YYYY-MM-DD" (a calendar day, no time zone).
// new Date("2010-05-04") would be midnight UTC, which is still 3 May in some time zones,
// so the parts are read as they are.
function parts(day: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

export function ageOf(dateOfBirth: string, today = new Date()) {
  const { y, m, d } = parts(dateOfBirth);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

// "4 May 2010", in the chosen language
export function formatDay(day: string) {
  const { y, m, d } = parts(day);
  return new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
}

// A moment ("4 May 2026, 14:05") in the chosen language.
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(dateLocale(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
