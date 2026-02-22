import { useEffect, useState } from "react";
import { logger } from './utils/logger';
import { LoadingState } from './components/SkeletonLoader';
import { TopNavigation } from "./components/Header/Header";
import { MainContent } from "./components/MainContent/MainContent";
import { Library } from "./components/Sidebar/Sidebar";
import { Player as AudioPlayer } from "./components/Player/AudioPlayer";
import { useAppState } from "./hooks/useAppState";
import { useLibrary } from "./context/LibraryContext";
import { usePlayer } from "./context/PlayerContext";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "./components/ui/context-menu";
import { openDownloadDirectory } from "./hooks/useRustCommands";
import {
  CookieIcon,
  Download01Icon,
  Download as DownloadIcon,
  Playlist01Icon,
  Refresh04Icon,
  Settings01Icon,
  Upload as UploadIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    currentView,
    setCurrentView,
    searchQuery,
    setSearchQuery,
  } = useAppState();

  const {
    playlists,
    selectedPlaylist,
    playlistVideos,
    loadPlaylistVideos,
    clearSelectedPlaylist,
    syncLibrary,
    loading,
    syncProgress,
    closeSyncProgress,
  } = useLibrary();

  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    queue,
    currentSongIndex,
    streamMode,
    setStreamMode,
    playSong,
    playPlaylist,
    playNext,
    playPrev,
    onSongEnd,
    clearCurrentSong,
    playAudioOnly,
  } = usePlayer();


  const handleOpenDownloadsFolder = () => {
    void openDownloadDirectory();
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleNavigate = (view: typeof currentView) => {
    setCurrentView(view);
  };

  const handleExport = () => {
    setCurrentView("settings");
  };

  const handleImport = () => {
    setCurrentView("settings");
  };

  useEffect(() => {
    const savedFont = localStorage.getItem("font") || "Inter";
    document.body.style.fontFamily = `${savedFont}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const shouldCollapse = window.innerWidth < 1024;
      setIsSidebarCollapsed(shouldCollapse);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="w-full h-screen flex flex-col bg-background text-foreground"
          style={{
            fontFamily:
              'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <TopNavigation
            currentView={currentView}
            setCurrentView={setCurrentView}
            isSyncing={loading.syncing}
            onSync={syncLibrary}
            onExport={handleExport}
            onImport={handleImport}
            syncProgress={syncProgress}
          />
          <div className={`flex-1 flex overflow-hidden min-h-0 p-1 gap-1 `}>
            {(playlists.length === 0 && !loading.playlistsLoading) ? null : (
              <div className={`${isSidebarCollapsed ? "w-[128px]" : "w-[320px]"} flex-shrink-0 h-full overflow-hidden transition-all duration-500 ease-in-out transform`}>
                <Library
                  playlists={playlists}
                  onPlaylistSelect={loadPlaylistVideos}
                  isCollapsed={isSidebarCollapsed}
                  onCollapseChange={setIsSidebarCollapsed}
                  isLoading={loading.playlistsLoading}
                  showQueue={Boolean(currentSong)}
                  queue={queue}
                  currentSongIndex={currentSongIndex}
                  onQueueSelect={(index: number) => playPlaylist(queue, index)}
                />
              </div>
            )}
            <MainContent
              selectedPlaylist={selectedPlaylist}
              playlistVideos={playlistVideos}
              playlists={playlists}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              playSong={playSong}
              currentView={currentView}
              isSyncing={loading.syncing}
              onSync={syncLibrary}
              isLoadingVideos={loading.videosLoading}
              onBack={clearSelectedPlaylist}
              isSidebarCollapsed={isSidebarCollapsed}
              onPlaylistSelect={loadPlaylistVideos}
              setCurrentView={setCurrentView}
              onPlaylistPlay={playPlaylist} // Connecting existing handler if MainContent supports it, else need to update MainContent props
              currentSong={currentSong}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playNext={playNext}
              playPrev={playPrev}
              onSongEnd={onSongEnd}
              onPlayerBack={clearCurrentSong}
              streamMode={streamMode}
              setStreamMode={setStreamMode}
              playAudioOnly={playAudioOnly}
            />
          </div>
          {currentSong && streamMode === "audio" && (
            <AudioPlayer
              currentSong={currentSong}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playNext={playNext}
              playPrev={playPrev}
              onSongEnd={onSongEnd}
              onClose={() => {
                clearCurrentSong();
                setStreamMode("av");
              }}
            />
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground backdrop-blur-xl shadow-lg">

        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={() => {
            handleNavigate("downloads");
          }}
        >
          <HugeiconsIcon icon={Download01Icon} size={16} className="mr-2" />
          Downloads
        </ContextMenuItem>
        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={() => {
            handleNavigate("playlist");
          }}
        >
          <HugeiconsIcon icon={Playlist01Icon} size={16} className="mr-2" />
          Playlist
        </ContextMenuItem>
        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={() => {
            handleNavigate("settings");
          }}
        >
          <HugeiconsIcon icon={Settings01Icon} size={16} className="mr-2" />
          Settings
        </ContextMenuItem>
        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={() => {
            handleNavigate("cookies");
          }}
        >
          <HugeiconsIcon icon={CookieIcon} size={16} className="mr-2" />
          Cookies
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 h-px bg-border" />

        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={() => {
            void syncLibrary();
          }}
        >
          <HugeiconsIcon icon={Refresh04Icon} size={16} className="mr-2" />
          Sync Library
        </ContextMenuItem>
        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={handleOpenDownloadsFolder}
        >
          <HugeiconsIcon icon={Download01Icon} size={16} className="mr-2" />
          Downloads Folder
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 h-px bg-border" />

        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={handleExport}
        >
          <HugeiconsIcon icon={UploadIcon} size={16} className="mr-2" />
          Export
        </ContextMenuItem>
        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={handleImport}
        >
          <HugeiconsIcon icon={DownloadIcon} size={16} className="mr-2" />
          Import
        </ContextMenuItem>

        <ContextMenuSeparator className="my-1 h-px bg-border" />

        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
          onSelect={handleReload}
        >
          <HugeiconsIcon icon={Refresh04Icon} size={16} className="mr-2" />
          Reload
          <ContextMenuShortcut>Ctrl+R</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default App;
