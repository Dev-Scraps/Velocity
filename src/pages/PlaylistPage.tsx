"use client"

import { Info, ArrowRight, Cookie, RefreshCw, Download } from "lucide-react"
import { PlaylistCard } from "../components/PlaylistCard"
import { SkeletonPlaylistCard } from "../components/SkeletonLoader"
import type { Playlist } from "../hooks/useRustCommands"
import { useLanguage } from "../context/LanguageContext"

interface HomePageProps {
  playlists: Playlist[]
  isLoading: boolean
  searchQuery?: string
  onPlaylistSelect?: (playlist: Playlist) => void
  onNavigateToCookies?: () => void
}

export const HomePage = ({ playlists, isLoading, searchQuery = "", onPlaylistSelect, onNavigateToCookies }: HomePageProps) => {
  const { t } = useLanguage()
  const displayList = playlists.filter(playlist => 
    searchQuery === "" || 
    playlist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (playlist.channel && playlist.channel.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="p-4 animate-fadeIn h-full">
      <div className="max-w-7xl mx-auto h-full">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-scaleIn" style={{ animationDelay: `${i * 0.05}s` }}>
                <SkeletonPlaylistCard />
              </div>
            ))}
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full w-full animate-fadeIn">
            <div className="w-full max-w-xl text-center px-8">
              <h3 className="text-lg font-semibold text-foreground mb-2">{t.homePage.syncLibrary}</h3>
              <p className="text-sm text-muted-foreground/80 mb-4">
                {t.homePage.importCookiesDescription}
              </p>
              
              <div className="flex flex-col items-center gap-2 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Info size={12} className="text-primary/70" />
                  </div>
                  <p className="text-xs text-muted-foreground/80">{t.homePage.goToCookiesPage}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <Download size={12} className="text-green-500/70" />
                  </div>
                  <p className="text-xs text-muted-foreground/80">{t.homePage.downloadsWorkWithoutCookies}</p>
                </div>
              </div>

              <button
                onClick={onNavigateToCookies}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:from-primary/90 hover:to-primary/80 rounded-lg font-medium transition-all hover:scale-[1.02] shadow-lg shadow-primary/10 text-sm"
              >
                <Cookie size={16} />
                <span>{t.homePage.goToCookiesButton}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
            {displayList.map((playlist, index) => (
              <div key={playlist.id} className="animate-slideUp" style={{ animationDelay: `${index * 0.03}s` }}>
                <PlaylistCard
                  playlist={playlist}
                  onLongPress={() => {}}
                  onClick={() => onPlaylistSelect?.(playlist)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
