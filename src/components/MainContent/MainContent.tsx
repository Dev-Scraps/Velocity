import { PlaylistView } from "./PlaylistView"
import { SearchBar } from "../Header/SearchBar"
import { HomePage } from "../../pages/PlaylistPage"
import { DownloadsPage } from "../../pages/DownloadsPage"
import { SettingsPage } from "../../pages/SettingsPage"
import { CookiesPage } from "../../pages/CookiesPage"
import { YouTubePlayer } from "../YouTubePlayer"
import type { Playlist, Video } from "../../hooks/useRustCommands"


interface MainContentProps {
  selectedPlaylist: any
  playlistVideos: Video[]
  playlists: Playlist[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  playSong: (song: Video) => void
  currentView: "playlist" | "downloads" | "settings" | "cookies"
  isSyncing: boolean
  onSync?: () => void
  isLoadingVideos?: boolean
  onBack?: () => void
  isSidebarCollapsed?: boolean
  onPlaylistSelect?: (playlist: Playlist) => void
  setCurrentView?: (view: "playlist" | "downloads" | "settings" | "cookies") => void
  onPlaylistPlay?: (videos: Video[], startIndex?: number) => void
  currentSong: Video | null
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  playNext: () => void
  playPrev: () => void
  onSongEnd: () => void
  onPlayerBack: () => void
  streamMode: any
  setStreamMode: any
  playAudioOnly: (video: Video) => void
}

export const MainContent = ({
  selectedPlaylist,
  playlistVideos,
  playlists,
  searchQuery,
  setSearchQuery,
  playSong,
  currentView,
  isSyncing,
  isLoadingVideos = false,
  onBack,
  isSidebarCollapsed = false,
  onPlaylistSelect,
  setCurrentView,
  onPlaylistPlay,
  currentSong,
  isPlaying,
  setIsPlaying,
  playNext,
  playPrev,
  onSongEnd,
  onPlayerBack,
  streamMode,
  setStreamMode,
  playAudioOnly,
}: MainContentProps) => {
  const handleNavigateToCookies = () => {
    setCurrentView?.("cookies");
  };

  const renderContent = () => {
    if (currentSong && streamMode !== "audio") {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 shadow-sm">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Now Playing</p>
              <h2 className="text-lg font-semibold text-foreground truncate">{currentSong.title}</h2>
            </div>
            <button
              type="button"
              onClick={onPlayerBack}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors border border-border/60 rounded-full px-2.5 py-1 hover:bg-accent/60"
            >
              Back
            </button>
          </div>
          <div className="rounded-xl overflow-hidden w-full h-[62vh] md:h-[73vh]">
            <YouTubePlayer
              currentSong={currentSong}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playNext={playNext}
              playPrev={playPrev}
              onSongEnd={onSongEnd}
              onBack={onPlayerBack}
              streamMode={streamMode}
              setStreamMode={setStreamMode}
              showTopBar={false}
            />
          </div>
        </div>
      );
    }
    if (currentView === "playlist") {
      if (selectedPlaylist) {
        if (selectedPlaylist) {
          return <PlaylistView
            playlist={selectedPlaylist}
            videos={playlistVideos}
            playSong={playSong}
            isLoading={isLoadingVideos}
            onBack={onBack}
            searchQuery={searchQuery}
            onPlayAll={() => onPlaylistPlay?.(playlistVideos, 0)}
            onPlayVideo={(video: Video, index: number) => onPlaylistPlay?.(playlistVideos, index)}
            onPlayAsAudio={(video: Video) => {
              // Set stream mode to audio and play the video
              playAudioOnly(video);
            }}
          />
        }
      }
      return <HomePage playlists={playlists} isLoading={isSyncing} searchQuery={searchQuery} onPlaylistSelect={onPlaylistSelect} onNavigateToCookies={handleNavigateToCookies} />
    } else if (currentView === "downloads") {
      return <DownloadsPage searchQuery={searchQuery} />
    } else if (currentView === "settings") {
      return <SettingsPage />
    } else if (currentView === "cookies") {
      return <CookiesPage />
    }

  }

  return (
    <main className={`fluent-card rounded-lg flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-500 ease-in-out transform`}>
      <div className="sticky top-0 z-50 p-4 flex items-center  shrink-0" data-tauri-drag-region>
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>

      <div
        className={`flex-1 overflow-y-auto transition-all duration-500 ease-in-out ${currentSong ? "p-3" : "p-6"}`}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {renderContent()}
      </div>
    </main>
  )
}
