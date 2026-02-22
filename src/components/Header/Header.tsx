"use client";

import { useState } from "react";
import { logger } from "../../utils/logger";
import {
  Download01Icon,
  Playlist01Icon,
  Refresh04Icon,
  Remove02Icon,
  Cancel02Icon,
  MinimizeScreenIcon,
  MaximizeScreenIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLanguage } from "../../context/LanguageContext";

interface TopNavigationProps {
  currentView: "playlist" | "downloads";
  setCurrentView: (
    view: "playlist" | "downloads",
  ) => void;
  isSyncing: boolean;
  onSync: () => void;
  onExport: () => void;
  onImport: () => void;
  syncProgress?: {
    stage: 'discovering' | 'fetching_playlists' | 'fetching_videos' | 'complete';
    totalVideos?: number | null;
    fetchedVideos?: number;
    totalPlaylists?: number;
    processedPlaylists?: number;
  };
}

export const TopNavigation = ({
  currentView,
  setCurrentView,
  isSyncing,
  onSync,
  onExport,
  onImport,
  syncProgress,
}: TopNavigationProps) => {
  const { t } = useLanguage();
  const [isMaximized, setIsMaximized] = useState(false);
  const [previousView, setPreviousView] = useState(currentView);

  const minimizeWindow = async () => {
    try {
      const window = getCurrentWindow();
      await window.minimize();
    } catch (error) {
      logger.error("Minimize failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const toggleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      await window.toggleMaximize();
      setIsMaximized(!isMaximized);
    } catch (error) {
      logger.error("Maximize failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const closeWindow = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
    } catch (error) {
      logger.error("Close failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleViewChange = (view: typeof currentView) => {
    setPreviousView(currentView);
    setCurrentView(view);
  };

  const getSyncProgress = () => {
    if (!isSyncing || !syncProgress) return null;
    
    const {
      stage,
      totalVideos,
      fetchedVideos,
      totalPlaylists,
      processedPlaylists,
    } = syncProgress;
    
    if (stage === 'discovering') return 5;
    if (stage === 'fetching_playlists') return 15;
    if (stage === 'fetching_videos') {
      if (totalVideos && totalVideos > 0) {
        return Math.round((fetchedVideos || 0) / totalVideos * 100);
      }
      if (totalPlaylists && totalPlaylists > 0) {
        return Math.round((processedPlaylists || 0) / totalPlaylists * 100);
      }
    }
    if (stage === 'complete') return 100;
    return 0;
  };

  const progress = getSyncProgress();

  const navItems = [
    { id: "downloads" as const, label: "Download", icon: Download01Icon },
    { id: "playlist" as const, label: "Playlist", icon: Playlist01Icon },
  ];

  const getAnimationClass = (itemId: string) => {
    if (itemId === currentView) {
      return "animate-scaleIn bg-primary text-primary-foreground shadow-sm rounded-lg";
    }
    if (itemId === previousView) {
      return "animate-scaleOut text-muted-foreground hover:bg-secondary hover:rounded-lg hover:text-foreground";
    }
    return "text-muted-foreground hover:bg-secondary hover:rounded-lg hover:text-foreground";
  };

  return (
    <div className="rounded-b-lg bg-card/95 backdrop-blur-xl relative animate-slideDown">
      {/* Main drag area covering entire header */}
      <div className="absolute inset-0" data-tauri-drag-region />

      <div className="flex items-center justify-between h-14 px-2 relative z-10">
        {/* Left: Menu Items */}
        <div className="flex items-center gap-5 rounded-lg relative">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleViewChange(item.id)}
              data-tauri-drag-region={false}
              className={`
                fluent-button flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium
                transition-all duration-300 ease-out transform hover:scale-105
                ${getAnimationClass(item.id)}
              `}
            >
              <HugeiconsIcon
                icon={item.icon}
                size={18}
                className={`flex-shrink-0 transition-transform duration-300 ${
                  currentView === item.id ? "animate-bounce-in" : ""
                }`}
              />
              <span className="hidden lg:inline-block whitespace-nowrap transition-all duration-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Right: Actions & Window Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSync}
            disabled={isSyncing}
            data-tauri-drag-region={false}
            className="fluent-button flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out transform hover:scale-105"
          >
            <HugeiconsIcon
              icon={Refresh04Icon}
              size={18}
              className={`transition-all duration-300 ${
                isSyncing ? "animate-spin text-primary" : "hover:animate-pulse"
              }`}
            />
            <span className="hidden lg:inline-block whitespace-nowrap transition-all duration-300">
              Sync
              {progress !== null && (
                <span className="ml-2 text-xs font-semibold text-primary">
                  {progress}%
                </span>
              )}
            </span>
          </button>

          {/* <div className="hidden lg:block w-px h-6 bg-border" />

          <button
            onClick={onExport}
            data-tauri-drag-region={false}
            className="fluent-button flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300 ease-out transform hover:scale-105"
          >
            <HugeiconsIcon icon={UploadIcon} size={18} className="transition-transform duration-300 hover:scale-110" />
            <span className="hidden lg:inline-block whitespace-nowrap transition-all duration-300">
              {t.nav.export}
            </span>
          </button>

          <button
            onClick={onImport}
            data-tauri-drag-region={false}
            className="fluent-button flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300 ease-out transform hover:scale-105"
          >
            <HugeiconsIcon icon={DownloadIcon} size={18} className="transition-transform duration-300 hover:scale-110" />
            <span className="hidden lg:inline-block whitespace-nowrap transition-all duration-300">
              {t.nav.import}
            </span>
          </button> */}

          <div className="hidden lg:block w-px h-6 bg-border mx-1" />

          {/* Window Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={minimizeWindow}
              className="fluent-button flex items-center justify-center text-foreground hover:bg-secondary"
              data-tauri-drag-region={false}
            >
              <HugeiconsIcon icon={Remove02Icon} size={16} />
            </button>
            <button
              onClick={toggleMaximize}
              className="fluent-button flex items-center justify-center text-foreground hover:bg-secondary"
              data-tauri-drag-region={false}
            >
              <HugeiconsIcon
                icon={isMaximized ?   MaximizeScreenIcon : MinimizeScreenIcon}
                size={16}
              />
            </button>
            <button
              onClick={closeWindow}
              className="fluent-button flex items-center justify-center text-foreground hover:bg-destructive/10 hover:text-destructive"
              data-tauri-drag-region={false}
            >
              <HugeiconsIcon icon={Cancel02Icon} size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
