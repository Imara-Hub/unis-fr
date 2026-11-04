// The chosen language outside React: for helpers that are not components (API errors, dates,
// confirm() texts). The LanguageProvider keeps it in step with the picker.
import { appFr } from "./app/fr";
import { appRn } from "./app/rn";
import { appSw } from "./app/sw";
import { en, type Messages } from "./en";
import { fr } from "./fr";
import { rn } from "./rn";
import { sw } from "./sw";

export const LANGUAGES = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
  { code: "sw", name: "Kiswahili" },
  { code: "rn", name: "Ikirundi" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];
// Burundi's administration and most competition papers are in French.
export const DEFAULT_LANG: Lang = "fr";
export const isLang = (value: unknown): value is Lang => LANGUAGES.some((l) => l.code === value);

// Public pages (login, signup, invite, registration): one key per text.
export const DICTIONARIES: Record<Lang, Messages> = { fr, en, sw, rn };

// Dashboard: the English text is the key (`tx("Save")`). The French dictionary lists every key,
// so TypeScript rejects a text that is missing from it, and sw/rn must have the same keys.
export type AppKey = keyof typeof appFr;
const APP: Record<Lang, Record<AppKey, string> | null> = { en: null, fr: appFr, sw: appSw, rn: appRn };

// Dates: Kirundi falls back to French where the browser has no Kirundi names for months.
const DATE_LOCALES: Record<Lang, string[]> = { en: ["en-GB"], fr: ["fr-FR"], sw: ["sw-TZ", "sw"], rn: ["rn-BI", "fr-FR"] };

let current: Lang = DEFAULT_LANG;
export const currentLang = () => current;
export function setCurrentLang(lang: Lang) {
  current = lang;
}

export type Vars = Record<string, string | number>;

// "Edit {name}" + { name: "Ali" } → "Modifier Ali"
export function translate(key: AppKey, vars?: Vars, lang: Lang = current): string {
  const text = APP[lang]?.[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all)) : text;
}

export const dateLocale = (lang: Lang = current) => DATE_LOCALES[lang];

export interface LocalizableError {
  code?: string;
  message: string;
  fields: Record<string, string>;
}

// An API error in the chosen language: by its code, and the server's English field messages by their text.
export function localizeError<E extends LocalizableError>(error: E, lang: Lang = current): E {
  const t = DICTIONARIES[lang];
  const fields: Record<string, string> = {};
  for (const [field, message] of Object.entries(error.fields)) fields[field] = t.server[message] ?? message;
  const byCode = error.code ? t.errors[error.code] : undefined;
  return { ...error, message: byCode ?? t.server[error.message] ?? error.message, fields };
}
