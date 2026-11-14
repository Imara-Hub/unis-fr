"use client";

import { PrintableForm } from "@/components/PrintableForm";

// The empty registration form, to print and fill in by hand (admin only).
export default function BlankFormPage() {
  return <PrintableForm id={null} />;
}
