"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { locales, type Locale } from "../i18n/locales"
import type { Translations } from "../i18n/locales/en"

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}

interface LanguageProviderProps {
  children: ReactNode
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem("locale")
    return (saved as Locale) || "en"
  })

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem("locale", newLocale)
  }

  const t = locales[locale]

  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>
}
