import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  loadCookies,
  validateCookies,
} from "./useRustCommands";

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useAuthState() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<string | null>(null);

  // Check existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const loadedCookies = await loadCookies();
        if (loadedCookies) {
          const isValid = await validateCookies(loadedCookies);
          if (isValid) {
            setCookies(loadedCookies);
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  return { isAuthenticated, isLoading, error, cookies };
}
