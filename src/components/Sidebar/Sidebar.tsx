import type { Playlist, Video } from '../../hooks/useRustCommands';
import { HugeiconsIcon } from '@hugeicons/react';
import { Home01Icon, PlusSignIcon, Cancel02Icon, MusicNote02Icon, MenuCollapseIcon, Playlist01Icon, Menu01Icon, CookieIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PlaylistList } from './PlaylistList';
import { QueueList } from './QueueList';
import { useLanguage } from '../../context/LanguageContext';

// Redesigned Library component
interface LibraryProps {
  playlists: Playlist[];
  onPlaylistSelect: (p: Playlist) => void;
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  onNavigateToCookies?: () => void;
  isLoading?: boolean;
  queue?: Video[];
  currentSongIndex?: number;
  onQueueSelect?: (index: number) => void;
  showQueue?: boolean;
}

const Library = ({
  playlists,
  onPlaylistSelect,
  isCollapsed = false,
  onCollapseChange,
  onNavigateToCookies,
  isLoading = false,
  queue = [],
  currentSongIndex = -1,
  onQueueSelect,
  showQueue = true,
}: LibraryProps) => {
  const { t } = useLanguage();
  const [showAddInput, setShowAddInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleAddPlaylist = () => {
    if (newPlaylistName.trim()) {
      // Create a new playlist object
      const newPlaylist: Playlist = {
        id: Date.now().toString(), // temporary ID
        title: newPlaylistName.trim(),
        videoCount: 0,
        channel: 'Local Playlist',
        thumbnailUrl: undefined
      };

      // Add the playlist (this would normally call a backend function)
      console.log('Adding playlist:', newPlaylist);
      // For now, we'll just log it. In a real implementation, you'd call:
      // await addPlaylist(newPlaylist);

      // Reset and hide input
      setNewPlaylistName('');
      setShowAddInput(false);
    }
  };

  const handleCancelAdd = () => {
    setNewPlaylistName('');
    setShowAddInput(false);
  };

  return (
    <div
      className={`rounded-lg p-1 flex-grow flex flex-col h-full overflow-hidden bg-card border border-border shadow-lg transition-all duration-500 ease-in-out transform ${isCollapsed ? "w-32 cursor-pointer" : "w-full"}`}
      onClick={() => isCollapsed && onCollapseChange?.(!isCollapsed)}
    >
      <div className="p-1">
        <div className="flex items-center justify-between text-muted-foreground font-bold mb-4 px-1">
          <div className="flex items-center gap-2 transition-all duration-300 ease-in-out">
            <HugeiconsIcon icon={Playlist01Icon} size={20} className="transition-transform duration-300 hover:scale-110" />
            {!isCollapsed && <span className="transition-all duration-300 ease-in-out">{t.sidebar.yourLibrary}</span>}
          </div>
          {isCollapsed ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCollapseChange?.(!isCollapsed);
              }}
              className="p-1.5 hover:bg-accent rounded-lg transition-all duration-300 hover:scale-110 transform hover:rotate-180"
              title="Expand sidebar"
              style={{ transitionDuration: '500ms' }}
            >
              <HugeiconsIcon icon={Menu01Icon} size={18} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowAddInput(!showAddInput)}
                className="p-1.5 hover:bg-accent rounded-lg transition-all duration-300 hover:scale-110 transform hover:rotate-90"
                style={{ transitionDuration: '500ms' }}
              >
                <HugeiconsIcon icon={PlusSignIcon} size={18} />
              </button>
              <button
                onClick={() => onCollapseChange?.(!isCollapsed)}
                className="p-1.5 hover:bg-accent rounded-lg transition-all duration-300 hover:scale-110 transform hover:-rotate-90"
                style={{ transitionDuration: '500ms' }}
              >
                <HugeiconsIcon icon={MenuCollapseIcon} size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Add Playlist Input - Dropdown below header */}
        {showAddInput && !isCollapsed && (
          <div className="px-2 mb-4 animate-in slide-in-from-top-2 duration-300 ease-out">
            <div className="flex gap-2 items-center">
              <Input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={t.sidebar.playlistNamePlaceholder}
                className="rounded-lg flex-1 border-0 focus:border-0 focus:ring-0 transition-all duration-300"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPlaylist();
                  } else if (e.key === 'Escape') {
                    handleCancelAdd();
                  }
                }}
              />
              <Button
                onClick={handleAddPlaylist}
                disabled={!newPlaylistName.trim()}
                size="sm"
                className="rounded-lg px-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 transform hover:scale-105"
              >
                {t.sidebar.add}
              </Button>
            </div>
          </div>
        )}
      </div>
      {!isCollapsed ? (
        <>
          {showQueue && queue.length > 0 && (
            <div className="px-1 mb-4 flex-none h-[40vh] min-h-[150px] flex flex-col">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 shrink-0">
                <HugeiconsIcon icon={MusicNote02Icon} size={14} />
                <span>Up Next</span>
              </div>
              <QueueList
                queue={queue}
                currentSongIndex={currentSongIndex}
                onQueueSelect={(video, index) => onQueueSelect?.(index)}
                isCollapsed={false}
              />
            </div>
          )}
          {playlists.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <HugeiconsIcon icon={CookieIcon} size={28} className="text-muted-foreground" />
              </div>
              <p className="text-xs text-center text-muted-foreground mb-3">
                {t.sidebar.noPlaylists}
              </p>
            </div>
          ) : (
            <PlaylistList
              playlists={playlists}
              onPlaylistSelect={onPlaylistSelect}
              isCollapsed={isCollapsed}
              isLoading={isLoading}
            />
          )}
        </>
      ) : (
        <>
          {showQueue && queue.length > 0 && (
            <div className="px-1 mb-3 flex-none h-[40vh] min-h-[150px] flex flex-col">
              <QueueList
                queue={queue}
                currentSongIndex={currentSongIndex}
                onQueueSelect={(video, index) => onQueueSelect?.(index)}
                isCollapsed={true}
              />
            </div>
          )}
          <PlaylistList
            playlists={playlists}
            onPlaylistSelect={onPlaylistSelect}
            isCollapsed={true}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
};

export { Library };

interface SidebarProps {
  playlists: any[];
  onPlaylistSelect: (playlist: any) => void;
  onSync: () => void;
  isSyncing: boolean;
  currentView: 'home' | 'liked' | 'downloads' | 'settings' | 'cookies';
  setCurrentView: (view: 'home' | 'liked' | 'downloads' | 'settings' | 'cookies') => void;
  onCollapseChange?: (collapsed: boolean) => void;
  showQueue?: boolean;
  queue?: Video[];
  currentSongIndex?: number;
  onQueueSelect?: (index: number) => void;
}

export const Sidebar = ({
  playlists,
  onPlaylistSelect,
  onCollapseChange,
  currentView,
  setCurrentView,
  showQueue,
  queue,
  currentSongIndex,
  onQueueSelect,
}: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapseChange = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapseChange?.(collapsed);
  };

  const handleNavigateToCookies = () => {
    setCurrentView('cookies');
  };

  return (
    <aside className={`${isCollapsed ? "w-32" : "w-[200px]"} h-full flex flex-col gap-2 flex-shrink-0 overflow-hidden transition-all duration-500 ease-in-out transform`}>
      <Library
        playlists={playlists}
        onPlaylistSelect={onPlaylistSelect}
        isCollapsed={isCollapsed}
        onCollapseChange={handleCollapseChange}
        onNavigateToCookies={handleNavigateToCookies}
        showQueue={showQueue}
        queue={queue}
        currentSongIndex={currentSongIndex}
        onQueueSelect={onQueueSelect}
      />
    </aside>
  );
};
