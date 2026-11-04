// "+25779123456" → "+257 79 123 456" (display only; the API stores the compact form).
export function formatPhone(phone: string) {
  const m = /^\+257(\d{2})(\d{3})(\d{3})$/.exec(phone);
  return m ? `+257 ${m[1]} ${m[2]} ${m[3]}` : phone;
}

// Splits pasted text into numbers: one per line, or separated by commas/semicolons.
export function splitPhones(text: string) {
  return text
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
