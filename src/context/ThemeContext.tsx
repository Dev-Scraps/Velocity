"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { invoke } from "@tauri-apps/api/core"

interface ThemeContextType {
  themeMode: "light" | "dark" | "system"
  isDark: boolean
  setThemeMode: (mode: "light" | "dark" | "system") => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeMode, setThemeModeState] = useState<"light" | "dark" | "system">(() => {
    const saved = localStorage.getItem("themeMode") as "light" | "dark" | "system" | null
    console.log("Initial themeMode from localStorage:", saved)
    return saved || "system"
  })
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const updateTheme = () => {
      let dark = false
      if (themeMode === "system") {
        dark = window.matchMedia("(prefers-color-scheme: dark)").matches
      } else {
        dark = themeMode === "dark"
      }
      setIsDark(dark)

      if (dark) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }

    updateTheme()

    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => updateTheme()
      mediaQuery.addEventListener("change", handler)
      return () => mediaQuery.removeEventListener("change", handler)
    }
  }, [themeMode])

  const setThemeMode = (mode: "light" | "dark" | "system") => {
    console.log("setThemeMode called with:", mode)
    setThemeModeState(mode)
    try {
      localStorage.setItem("themeMode", mode)
      console.log("Saved themeMode to localStorage:", mode)
      void invoke("set_setting", { key: "themeMode", value: mode }).catch((error) => {
        console.error("Failed to persist themeMode to database:", error)
      })
    } catch (error) {
      console.error("Failed to save themeMode to localStorage:", error)
    }
  }

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
