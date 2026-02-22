import { en } from "./en"
import { fr } from "./fr"
import { de } from "./de"
import { ru } from "./ru"
import { ar } from "./ar"
import { hi } from "./hi"

export const locales = {
  en,
  fr,
  de,
  ru,
  ar,
  hi,
} as const

export type Locale = keyof typeof locales

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  ru: "Русский",
  ar: "العربية",
  hi: "हिन्दी",
}
