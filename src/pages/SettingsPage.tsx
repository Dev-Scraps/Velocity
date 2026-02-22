"use client";

import { useState, useEffect } from "react";
import {
  HardDriveIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "../context/ThemeContext";
import { useAppState } from "../hooks/useAppState";
import { useLanguage } from "../context/LanguageContext";
import { useSettings } from "../hooks/useSettings";
// import { localeNames, type Locale } from "../i18n/locales"; // Not needed here anymore
import { logger } from "../utils/logger";
import type { DownloadHistoryItem, Playlist } from "../types/settings";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AppearanceSettings } from "../components/settings/AppearanceSettings";
import { PlaybackSettings } from "../components/settings/PlaybackSettings";
import { StorageSettings } from "../components/settings/StorageSettings";
import { BackupSettings } from "../components/settings/BackupSettings";
import { AboutSection } from "../components/settings/AboutSection";
import { invoke } from "@tauri-apps/api/core";

interface BackupData {
  version: string;
  exportDate: string;
  themeMode: "light" | "dark" | "system";
  font: string;
  playlists: Playlist[];
  downloadHistory: DownloadHistoryItem[];
}

export const SettingsPage = () => {
  const { themeMode, setThemeMode } = useTheme();
  const { locale, setLocale, t } = useLanguage();

  const { getSettings, saveSettings, getSetting, setSetting } = useSettings();
  const [font, setFont] = useState("Inter");
  const [audioOnlyMode, setAudioOnlyMode] = useState(false);
  const [downloadDirectory, setDownloadDirectory] = useState("");
  const [videoQuality, setVideoQuality] = useState("1080p");
  const [audioQuality, setAudioQuality] = useState("320k");
  const [autoSync, setAutoSync] = useState(true);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);

  const fonts = [
    "Inter",
    "Roboto",
    "Open Sans",
    "Poppins",
    "Lato",
    "Montserrat",
    "Source Sans Pro",
    "Nunito",
  ];
  const videoQualities = [
    "4320p",
    "2160p",
    "1440p",
    "1080p",
    "720p",
    "480p",
    "360p",
  ];
  const audioQualities = ["320k", "256k", "192k", "128k", "96k", "64k"];

  // Load settings on mount
  useEffect(() => {
    const loadSettingsData = async () => {
      try {
        const settings = await getSettings();
        setFont(settings.font);
        setAudioOnlyMode(settings.audioOnlyMode);
        setDownloadDirectory(settings.downloadDirectory);
        setVideoQuality(settings.videoQuality);
        setAudioQuality(settings.audioQuality);
        setAutoSync(settings.autoSync);

        // Apply font to document
        document.body.style.fontFamily = `${settings.font}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      } catch (error) {
        logger.error("Failed to load settings", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    loadSettingsData();
  }, [getSettings]);

  const handleFontChange = async (fontName: string) => {
    setFont(fontName);
    try {
      await setSetting("font", fontName);
      document.body.style.fontFamily = `${fontName}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    } catch (error) {
      logger.error("Failed to save font setting", {
        error: error instanceof Error ? error.message : String(error),
        font: fontName,
      });
    }
  };

  const handleAudioOnlyModeChange = async (value: boolean) => {
    setAudioOnlyMode(value);
    try {
      await setSetting("audioOnlyMode", value.toString());
    } catch (error) {
      logger.error("Failed to save audio only mode", {
        error: error instanceof Error ? error.message : String(error),
        value,
      });
    }
  };

  const handleDownloadDirectoryChange = async (directory: string) => {
    setDownloadDirectory(directory);
    try {
      await setSetting("downloadDirectory", directory);
    } catch (error) {
      logger.error("Failed to save download directory", {
        error: error instanceof Error ? error.message : String(error),
        directory,
      });
    }
  };

  const handleVideoQualityChange = async (quality: string) => {
    setVideoQuality(quality);
    try {
      await setSetting("videoQuality", quality);
    } catch (error) {
      logger.error("Failed to save video quality", {
        error: error instanceof Error ? error.message : String(error),
        quality,
      });
    }
  };

  const handleAudioQualityChange = async (quality: string) => {
    setAudioQuality(quality);
    try {
      await setSetting("audioQuality", quality);
    } catch (error) {
      logger.error("Failed to save audio quality", {
        error: error instanceof Error ? error.message : String(error),
        quality,
      });
    }
  };

  const handleAutoSyncChange = async (value: boolean) => {
    setAutoSync(value);
    try {
      await setSetting("autoSync", value.toString());
    } catch (error) {
      logger.error("Failed to save auto sync", {
        error: error instanceof Error ? error.message : String(error),
        value,
      });
    }
  };

  const handleSaveAllSettings = async () => {
    try {
      await saveSettings({
        themeMode,
        font,
        audioOnlyMode,
        downloadDirectory,
        language: locale,
        autoSync,
        videoQuality,
        audioQuality,
      });
      alert(t.messages.settingsSavedSuccess);
    } catch (error) {
      logger.error("Failed to save settings", {
        error: error instanceof Error ? error.message : String(error),
      });
      alert(t.messages.settingsSavedFailed);
    }
  };

  const handleExportBackup = async () => {
    try {
      // Export JSON backup (localStorage data)
      const backupData: BackupData = {
        version: "1.0.0",
        exportDate: new Date().toISOString(),
        themeMode,
        font,
        playlists: JSON.parse(localStorage.getItem("userPlaylists") || "[]"),
        downloadHistory: JSON.parse(
          localStorage.getItem("downloadHistory") || "[]",
        ),
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `velocity-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Export database
      try {
        const dbPath = await invoke<string>("export_database");
        alert(
          `${t.messages.exportSuccess}\nJSON: velocity-backup-${new Date().toISOString().split("T")[0]}.json\nDatabase: ${dbPath}`,
        );
      } catch (dbError) {
        logger.error("Database export failed", {
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
        alert(`${t.messages.exportSuccess} (JSON only)`);
      }
    } catch (error) {
      logger.error("Export failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      alert(t.messages.exportFailed);
    }
  };

  const handleImportBackup = async () => {
    try {
      // Import JSON backup (localStorage data)
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";

      fileInput.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          const text = await file.text();
          const backupData = JSON.parse(text);

          // Restore theme settings
          setThemeMode(backupData.themeMode);

          // Restore font setting
          await handleFontChange(backupData.font);

          // Restore other settings
          await handleAudioOnlyModeChange(backupData.audioOnlyMode);

          if (backupData.playlists) {
            localStorage.setItem(
              "userPlaylists",
              JSON.stringify(backupData.playlists),
            );
          }

          if (backupData.downloadHistory) {
            localStorage.setItem(
              "downloadHistory",
              JSON.stringify(backupData.downloadHistory),
            );
          }

          alert(t.messages.importSuccess);
        }
      };

      fileInput.click();
    } catch (error) {
      logger.error("Import failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      alert(`${t.messages.importFailed}: ${error}`);
    }
  };

  const handleClearData = async () => {
    logger.info("User confirmed, proceeding to clear data");
    try {
      // Clear localStorage
      localStorage.clear();
      logger.info("localStorage cleared");

      // Clear all backend data (database, history, cookies, yt-dlp cache)
      await invoke("clear_all_data");
      logger.info("Backend data cleared successfully");

      // Show success message and reload
      alert(t.messages.dataClearedSuccess || "All data cleared successfully");
      window.location.reload();
    } catch (error) {
      logger.error("Failed to clear data", {
        error: error instanceof Error ? error.message : String(error),
      });
      alert(t.settings.clearDataFailed);
    }
  };

  return (
    <div className="p-6 animate-fadeIn">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Save Button */}
        <button
          onClick={handleSaveAllSettings}
          className="w-full p-4 flex items-center justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
        >
          <HugeiconsIcon
            icon={HardDriveIcon}
            size={20}
            className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
          />
          <span className="text-sm font-medium">{t.settings.saveAllSettings}</span>
        </button>

        <AppearanceSettings
          font={font}
          onFontChange={handleFontChange}
          fonts={fonts}
        />

        <PlaybackSettings
          audioOnlyMode={audioOnlyMode}
          onAudioOnlyModeChange={handleAudioOnlyModeChange}
          videoQuality={videoQuality}
          onVideoQualityChange={handleVideoQualityChange}
          audioQuality={audioQuality}
          onAudioQualityChange={handleAudioQualityChange}
          videoQualities={videoQualities}
          audioQualities={audioQualities}
        />

        <StorageSettings
          downloadDirectory={downloadDirectory}
          onDownloadDirectoryChange={handleDownloadDirectoryChange}
          autoSync={autoSync}
          onAutoSyncChange={handleAutoSyncChange}
        />

        <BackupSettings
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onClearData={handleClearData}
          showClearDataDialog={showClearDataDialog}
          setShowClearDataDialog={setShowClearDataDialog}
        />

        <AboutSection />
      </div>
    </div>
  );
};

