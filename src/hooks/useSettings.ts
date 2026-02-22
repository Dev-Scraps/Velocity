import { invoke } from "@tauri-apps/api/core"
import { useCallback } from "react"

export interface AppSettings {
  themeMode: string
  colorTheme: string
  font: string
  audioOnlyMode: boolean
  downloadDirectory: string
  language: string
  autoSync: boolean
  videoQuality: string
  audioQuality: string
}

const defaultSettings: AppSettings = {
  themeMode: "system",
  colorTheme: "blue",
  font: "Inter",
  audioOnlyMode: false,
  downloadDirectory: "",
  language: "en",
  autoSync: true,
  videoQuality: "1080p",
  audioQuality: "320k",
}

export const useSettings = () => {
  const getSettings = useCallback(async (): Promise<AppSettings> => {
    try {
      const settings = await invoke<AppSettings>("get_settings")
      return { ...defaultSettings, ...settings }
    } catch (error) {
      console.error("Failed to get settings:", error)
      return defaultSettings
    }
  }, [])

  const saveSettings = useCallback(async (settings: Partial<AppSettings>): Promise<void> => {
    try {
      const currentSettings = await getSettings()
      const updatedSettings = { ...currentSettings, ...settings }
      await invoke("save_settings", { settings: updatedSettings })
    } catch (error) {
      console.error("Failed to save settings:", error)
      throw error
    }
  }, [getSettings])

  const getSetting = useCallback(async (key: keyof AppSettings): Promise<string | null> => {
    try {
      const value = await invoke<string>("get_setting", { key })
      return value
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error)
      return null
    }
  }, [])

  const setSetting = useCallback(async (key: keyof AppSettings, value: string): Promise<void> => {
    try {
      await invoke("set_setting", { key, value })
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error)
      throw error
    }
  }, [])

  const resetSettings = useCallback(async (): Promise<void> => {
    try {
      await invoke("reset_settings")
    } catch (error) {
      console.error("Failed to reset settings:", error)
      throw error
    }
  }, [])

  return {
    getSettings,
    saveSettings,
    getSetting,
    setSetting,
    resetSettings,
    defaultSettings,
  }
}
