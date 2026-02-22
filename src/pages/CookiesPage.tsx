"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Refresh01Icon, CookieIcon, PlusSignIcon, StarIcon, Cancel01Icon, Tick01Icon, Upload04Icon, ExternalLink, IncognitoIcon } from "@hugeicons/core-free-icons"
import { getWebsiteCookies, saveWebsiteCookie, deleteWebsiteCookieById, setDefaultWebsiteCookie, WebsiteCookie, openFileDialog } from "../hooks/useRustCommands"
import { useSession } from "../context/SessionContext"
import { useLanguage } from "../context/LanguageContext"
import { open } from "@tauri-apps/plugin-shell"

interface CookieFormRow {
  id: string
  name: string
  url: string
  cookies: string
}

export const CookiesPage = () => {
  const { t } = useLanguage()
  const { createSession, destroySession } = useSession()
  const [savedCookies, setSavedCookies] = useState<WebsiteCookie[]>([])
  const [formRows, setFormRows] = useState<CookieFormRow[]>([])
  const [selectedCookieId, setSelectedCookieId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState<string | null>(null)

  const loadCookies = useCallback(async () => {
    try {
      setIsLoading(true)
      const websiteCookies = await getWebsiteCookies()
      setSavedCookies(websiteCookies)
      const defaultCookie = websiteCookies.find(c => c.isDefault) || websiteCookies[0]
      if (defaultCookie && !selectedCookieId) setSelectedCookieId(defaultCookie.id)
    } catch (e) {
      console.error("Failed to load cookies:", e)
    } finally {
      setIsLoading(false)
    }
  }, [selectedCookieId])

  useEffect(() => { loadCookies() }, [loadCookies])

  const handleOpenExtensionLink = async () => {
    await open("https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc")
  }

  const handleOpenIncognito = async () => {
    await open("https://www.youtube.com")
  }

  const addNewRow = () => {
    setFormRows(prev => [...prev, { id: `new-${Date.now()}`, name: "", url: "", cookies: "" }])
  }

  const updateFormRow = (id: string, field: keyof CookieFormRow, value: string) => {
    setFormRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  const handleImportFile = async (rowId: string) => {
    setIsImporting(rowId)
    try {
      const content = await openFileDialog()
      if (content) updateFormRow(rowId, "cookies", content)
    } catch (err) {
      setError(`Import failed: ${err}`)
    }
    setIsImporting(null)
  }

  const saveFormRow = async (row: CookieFormRow) => {
    if (!row.name.trim() || !row.url.trim() || !row.cookies.trim()) {
      setError("Please fill all fields")
      return
    }
    setIsSaving(row.id)
    setError(null)
    try {
      const isFirst = !savedCookies.some(c => c.websiteUrl.includes(row.url))
      const newCookie = await saveWebsiteCookie(row.name.trim(), row.url.trim(), row.cookies.trim(), isFirst)
      setSavedCookies(prev => [...prev, newCookie])
      setFormRows(prev => prev.filter(r => r.id !== row.id))
      if (row.url.includes("youtube")) await createSession(row.cookies, row.name)
    } catch (err) {
      setError(`Save failed: ${err}`)
    }
    setIsSaving(null)
  }

  const handleDelete = async (id: string) => {
    await deleteWebsiteCookieById(id)
    setSavedCookies(prev => prev.filter(c => c.id !== id))
    if (selectedCookieId === id) destroySession()
  }

  const handleSelect = async (cookie: WebsiteCookie) => {
    setSelectedCookieId(cookie.id)
    if (cookie.websiteUrl.includes("youtube")) await createSession(cookie.content, cookie.name)
  }

  const handleSetDefault = async (cookie: WebsiteCookie) => {
    await setDefaultWebsiteCookie(cookie.id, cookie.domainPattern)
    await loadCookies()
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">{t.cookiesPage.title}</h1>
        <p className="text-xs text-muted-foreground">{t.cookiesPage.subtitle}</p>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">{t.cookiesPage.howToGetCookies}</p>
        <p>1. {t.cookiesPage.step1}</p>
        <p>2. {t.cookiesPage.step2}</p>
        <p>3. {t.cookiesPage.step3}</p>
        <p>4. {t.cookiesPage.step4}</p>
        <p>5. {t.cookiesPage.step5}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={handleOpenIncognito} className="text-xs text-primary hover:underline flex items-center gap-1">
            <HugeiconsIcon icon={IncognitoIcon} size={12} /> {t.cookiesPage.openIncognitoButton}
          </button>
          <button onClick={handleOpenExtensionLink} className="text-xs text-primary hover:underline flex items-center gap-1">
            <HugeiconsIcon icon={ExternalLink} size={12} /> {t.cookiesPage.getExtension}
          </button>
        </div>
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* Error */}
      {error && (
        <div className="text-xs text-destructive flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><HugeiconsIcon icon={Cancel01Icon} size={12} /></button>
        </div>
      )}

      {/* Add Button */}
      <button onClick={addNewRow} className="text-sm text-primary hover:underline flex items-center gap-1">
        <HugeiconsIcon icon={PlusSignIcon} size={14} /> Add Cookie
      </button>

      {/* New Cookie Forms */}
      {formRows.map(row => (
        <div key={row.id} className="space-y-3 border-b border-border pb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">New Cookie</span>
            <button onClick={() => setFormRows(prev => prev.filter(r => r.id !== row.id))} className="text-muted-foreground hover:text-destructive">
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Name</label>
              <input
                type="text"
                placeholder="YouTube Main"
                value={row.name}
                onChange={e => updateFormRow(row.id, "name", e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">URL</label>
              <input
                type="text"
                placeholder="youtube.com"
                value={row.url}
                onChange={e => updateFormRow(row.id, "url", e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Cookies</label>
            <textarea
              placeholder="Paste Netscape cookies here..."
              value={row.cookies}
              onChange={e => updateFormRow(row.id, "cookies", e.target.value)}
              rows={3}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-transparent border border-border rounded focus:outline-none focus:border-primary font-mono resize-none"
            />
            <div className="flex items-center gap-4 mt-1">
              <button
                onClick={() => handleImportFile(row.id)}
                disabled={isImporting === row.id}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {isImporting === row.id ? <HugeiconsIcon icon={Refresh01Icon} size={12} className="animate-spin" /> : <HugeiconsIcon icon={Upload04Icon} size={12} />}
                Import .txt/.json
              </button>
              <button
                onClick={() => saveFormRow(row)}
                disabled={isSaving === row.id || !row.name || !row.url || !row.cookies}
                className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {isSaving === row.id ? <HugeiconsIcon icon={Refresh01Icon} size={12} className="animate-spin" /> : <HugeiconsIcon icon={Tick01Icon} size={12} />}
                Save
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Saved Cookies */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{t.cookiesPage.profiles} ({savedCookies.length})</p>

        {isLoading ? (
          <div className="py-4 text-center">
            <HugeiconsIcon icon={Refresh01Icon} size={16} className="animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : savedCookies.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">{t.cookiesPage.noProfiles}</p>
        ) : (
          savedCookies.map(cookie => (
            <div
              key={cookie.id}
              onClick={() => handleSelect(cookie)}
              className={`flex items-center justify-between py-2 px-2 -mx-2 cursor-pointer hover:bg-muted/50 rounded transition-colors ${selectedCookieId === cookie.id ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <HugeiconsIcon icon={CookieIcon} size={14} className={selectedCookieId === cookie.id ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-medium truncate">{cookie.name}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{cookie.websiteUrl}</span>
                {cookie.isDefault && <span className="text-[9px] px-1 py-0.5 bg-primary/10 text-primary rounded">default</span>}
                {selectedCookieId === cookie.id && <span className="text-[9px] px-1 py-0.5 bg-green-500/10 text-green-600 rounded">active</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground hidden md:inline">{cookie.content.length.toLocaleString()} {t.cookiesPage.chars}</span>
                {!cookie.isDefault && (
                  <button onClick={e => { e.stopPropagation(); handleSetDefault(cookie) }} className="p-1 text-muted-foreground hover:text-primary">
                    <HugeiconsIcon icon={StarIcon} size={12} />
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); handleDelete(cookie.id) }} className="p-1 text-muted-foreground hover:text-destructive">
                  <HugeiconsIcon icon={Delete02Icon} size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
