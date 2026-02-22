import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { ThemeProvider } from "./context/ThemeContext"
import { LanguageProvider } from "./context/LanguageContext"
import { SessionProvider } from "./context/SessionContext"
import { LibraryProvider } from "./context/LibraryContext"
import { PlayerProvider } from "./context/PlayerContext"

// Suppress Tauri callback ID errors during HMR reload
const suppressTauriCallback = (args: unknown[]) => {
  const message = args[0];
  return (
    typeof message === "string" &&
    message.includes("[TAURI] Couldn't find callback id")
  );
};

const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

console.error = (...args) => {
  if (suppressTauriCallback(args)) return;
  originalError.apply(console, args);
};

console.warn = (...args) => {
  if (suppressTauriCallback(args)) return;
  originalWarn.apply(console, args);
};

console.log = (...args) => {
  if (suppressTauriCallback(args)) return;
  originalLog.apply(console, args);
};

window.addEventListener("error", (event) => {
  const message = event.message || "";
  if (message.includes("[TAURI] Couldn't find callback id")) {
    event.preventDefault();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  if (typeof reason === "string" && reason.includes("[TAURI] Couldn't find callback id")) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <SessionProvider>
            <LibraryProvider>
              <PlayerProvider>
                <App />
              </PlayerProvider>
            </LibraryProvider>
          </SessionProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
