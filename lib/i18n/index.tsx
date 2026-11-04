"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { ApiError } from "@/lib/errors";
import {
  dateLocale,
  DEFAULT_LANG,
  DICTIONARIES,
  isLang,
  localizeError,
  setCurrentLang,
  translate,
  type AppKey,
  type Lang,
  type Vars,
} from "./core";
import type { Messages } from "./en";

export { LANGUAGES, translate, type AppKey, type Lang } from "./core";

const STORAGE_KEY = "lang";

// The chosen language lives in localStorage (no URL change, so links shared on WhatsApp keep
// working in every language). In a private window it is only kept in memory.
let memoryLang: Lang | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the language: follow it.
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // private window: fall back to memory
  }
  if (memoryLang) return memoryLang;
  // First visit: the phone's language if we have it ("sw-TZ" → "sw"), else French.
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = tag?.toLowerCase().split("-")[0];
    if (isLang(code)) return code;
  }
  return DEFAULT_LANG;
}

export function setLang(lang: Lang) {
  memoryLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // private window: the choice is only kept until the tab closes
  }
  listeners.forEach((listener) => listener());
}

interface I18n {
  lang: Lang;
  // Public pages: t.login.title, …
  t: Messages;
  // Dashboard: tx("Save"), tx("Edit {name}", { name })
  tx: (key: AppKey, vars?: Vars) => string;
  // For toLocaleDateString / toLocaleString.
  locale: string[];
  setLang: (lang: Lang) => void;
  // An API error in the chosen language: known codes and the server's field messages are translated.
  apiError: (error: ApiError) => ApiError;
}

const I18nContext = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // The server (and the first render in the browser) uses the default; the saved choice then
  // takes over right away, without a hydration mismatch.
  const lang = useSyncExternalStore(subscribe, readLang, () => DEFAULT_LANG);
  // Before the children render, so helpers outside React (errors, dates) use the same language.
  setCurrentLang(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value: I18n = {
    lang,
    t: DICTIONARIES[lang],
    tx: (key, vars) => translate(key, vars, lang),
    locale: dateLocale(lang),
    setLang,
    apiError: (error) => localizeError(error, lang),
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <LanguageProvider>");
  return value;
}

export type { Messages };
