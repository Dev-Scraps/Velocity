"use client"

import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import { useSession } from "./SessionContext"

interface AuthContextType {
  isLoggedIn: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session } = useSession()
  const isLoggedIn = !!session

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
