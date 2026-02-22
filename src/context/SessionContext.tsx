"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { invoke } from "@tauri-apps/api/core"

interface SessionData {
  userId: string
  userName: string
  cookies: string
  expiresAt: string
  createdAt: string
}

interface SessionContextType {
  session: SessionData | null
  isValidating: boolean
  createSession: (cookies: string, userName?: string) => Promise<boolean>
  validateSession: () => Promise<boolean>
  destroySession: () => void
  refreshSession: () => Promise<boolean>
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error("useSession must be used within SessionProvider")
  }
  return context
}

interface SessionProviderProps {
  children: ReactNode
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const [session, setSession] = useState<SessionData | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedSession = localStorage.getItem("userSession")
        if (savedSession) {
          const parsed = JSON.parse(savedSession) as SessionData

          // Check if session is expired
          const expiresAt = new Date(parsed.expiresAt)
          if (expiresAt > new Date()) {
            setSession(parsed)

            // Validate cookies with backend
            const isValid = await validateCookies(parsed.cookies)
            if (!isValid) {
              console.log("Session cookies invalid, clearing session")
              destroySession()
            }
          } else {
            console.log("Session expired, clearing")
            destroySession()
          }
        }
      } catch (error) {
        console.error("Failed to load session:", error)
        destroySession()
      }
    }

    loadSession()
  }, [])

  const validateCookies = async (cookies: string): Promise<boolean> => {
    try {
      const result = await invoke<{ valid: boolean }>("validate_cookies", { cookies })
      return result.valid
    } catch (error) {
      console.error("Cookie validation failed:", error)
      return false
    }
  }

  const createSession = async (cookies: string, userName?: string): Promise<boolean> => {
    try {
      setIsValidating(true)

      // Validate cookies first
      const isValid = await validateCookies(cookies)
      if (!isValid) {
        return false
      }

      // Create session with 30 day expiry
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const sessionData: SessionData = {
        userId: `user_${Date.now()}`,
        userName: userName || "User",
        cookies,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      }

      // Save to state and localStorage
      setSession(sessionData)
      localStorage.setItem("userSession", JSON.stringify(sessionData))

      return true
    } catch (error) {
      console.error("Failed to create session:", error)
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const validateSession = async (): Promise<boolean> => {
    if (!session) return false

    try {
      setIsValidating(true)

      // Check expiry
      const expiresAt = new Date(session.expiresAt)
      if (expiresAt <= new Date()) {
        destroySession()
        return false
      }

      // Validate with backend
      const isValid = await validateCookies(session.cookies)
      if (!isValid) {
        destroySession()
        return false
      }

      return true
    } catch (error) {
      console.error("Session validation failed:", error)
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const refreshSession = async (): Promise<boolean> => {
    if (!session) return false

    try {
      setIsValidating(true)

      // Extend expiry by 30 days
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const refreshedSession: SessionData = {
        ...session,
        expiresAt: expiresAt.toISOString(),
      }

      setSession(refreshedSession)
      localStorage.setItem("userSession", JSON.stringify(refreshedSession))

      return true
    } catch (error) {
      console.error("Failed to refresh session:", error)
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const destroySession = () => {
    setSession(null)
    localStorage.removeItem("userSession")
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        isValidating,
        createSession,
        validateSession,
        destroySession,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
