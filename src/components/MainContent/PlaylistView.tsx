import { VideoGrid } from './VideoGrid';
import type { Video } from '../../hooks/useRustCommands';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download02Icon, ArrowLeft02Icon, MoreVerticalIcon, Share02Icon, Refresh01Icon, Information, PlayIcon, Shuffle, Favorite, Trash2 } from '@hugeicons/core-free-icons';
import { useEffect, useMemo, useState } from 'react';
import { FormatSelector } from '../FormatSelector';
import {
  getDownloadTasks,
  getDownloadedVideos,
  getVideoFormats,
  getVideoMetadata,
  loadCookies,
  startDownloadTask,
  upsertDownloadTask,
} from '../../hooks/useRustCommands';
import { useDownloadFlow } from '../../hooks/useDownloadFlow';
import { VideoCardSkeleton } from '../SkeletonLoader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu';

interface PlaylistViewProps {
  playlist: any;
  videos: Video[];
  playSong: (song: Video) => void;
  isLoading?: boolean;
  onBack?: () => void;
  searchQuery?: string;
  onShare?: () => void;
  onRefresh?: () => void;
  onShowInfo?: () => void;
  onPlayAll?: () => void;
  onShuffle?: () => void;
  onToggleLike?: () => void;
  onDelete?: () => void;
  onPlayVideo?: (video: Video, index: number) => void;
  onPlayAsAudio?: (video: Video) => void;
}

export const PlaylistView = ({ playlist, videos, playSong, isLoading = false, onBack, searchQuery = "", onShare, onRefresh, onShowInfo, onPlayAll, onShuffle, onToggleLike, onDelete, onPlayVideo, onPlayAsAudio }: PlaylistViewProps) => {
  const { requestDownload, DownloadModal } = useDownloadFlow();

  const [isPlaylistDownloading, setIsPlaylistDownloading] = useState(false);
  const [isPlaylistMetaLoading, setIsPlaylistMetaLoading] = useState(false);
  const [playlistFormatMetadata, setPlaylistFormatMetadata] = useState<any>(null);
  const [layout, setLayout] = useState<"list" | "grid-2" | "grid-3" | "grid-4">("grid-4");

  const firstVideo = useMemo(() => (videos && videos.length > 0 ? videos[0] : null), [videos]);

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const query = searchQuery.toLowerCase();
    return videos.filter(video =>
      video.title.toLowerCase().includes(query) ||
      (video.channel && video.channel.toLowerCase().includes(query))
    );
  }, [videos, searchQuery]);

  useEffect(() => {
    if (!isPlaylistDownloading) {
      setPlaylistFormatMetadata(null);
      setIsPlaylistMetaLoading(false);
    }
  }, [isPlaylistDownloading]);

  const downloadPlaylist = async () => {
    if (!firstVideo) return;

    const shouldStart = window.confirm(
      `Download all videos in this playlist?\n\nPlaylist: ${playlist?.title || 'Playlist'}\nVideos: ${videos.length}`
    );
    if (!shouldStart) return;

    setIsPlaylistDownloading(true);
    setIsPlaylistMetaLoading(true);
    try {
      const cookies = await loadCookies();
      const firstUrl = `https://www.youtube.com/watch?v=${firstVideo.id}`;
      const metadata = await getVideoMetadata(firstUrl, cookies);
      const formats = await getVideoFormats(firstUrl, cookies);
      setPlaylistFormatMetadata({
        title: metadata.title,
        uploader: metadata.channelName || metadata.channel || 'Unknown Channel',
        channel: metadata.channel || metadata.channelName || 'Unknown Channel',
        thumbnail: metadata.thumbnailUrl || '',
        duration: metadata.duration || '',
        view_count: metadata.viewCount || 0,
        formats,
      });
    } catch (e) {
      console.error('[PlaylistView] Failed to prepare playlist download:', e);
      setIsPlaylistDownloading(false);
    } finally {
      setIsPlaylistMetaLoading(false);
    }
  };

  const handleShare = async () => {
    if (onShare) {
      onShare();
    } else {
      try {
        if (navigator.share && playlist?.title) {
          await navigator.share({
            title: playlist.title,
            text: `Check out this playlist: ${playlist.title} (${videos.length} videos)`,
          });
        }
      } catch {
        // ignore
      }
    }
  };

  const handleRefresh = () => {
    onRefresh?.();
  };

  const handleShowInfo = () => {
    onShowInfo?.();
  };

  const handlePlayAll = () => {
    onPlayAll?.();
  };

  const handleShuffle = () => {
    onShuffle?.();
  };

  const handleToggleLike = () => {
    onToggleLike?.();
  };

  const handleDelete = () => {
    if (onDelete && playlist?.title) {
      const shouldDelete = window.confirm(
        `Delete playlist "${playlist.title}"?\n\nThis action cannot be undone.`
      );
      if (shouldDelete) {
        onDelete();
      }
    }
  };

  const handlePlaylistDownloadConfirm = async (formatId: string) => {
    try {
      const tasks = await getDownloadTasks();
      const downloaded = await getDownloadedVideos();
      const downloadedSet = new Set(downloaded.map((v) => v.id));

      for (const v of videos) {
        const existingSame = tasks.find((t: any) => t.videoId === v.id && t.formatId === formatId);
        if (downloadedSet.has(v.id)) continue;
        if (existingSame && ['queued', 'downloading', 'paused', 'completed'].includes(existingSame.status)) continue;

        const taskId = Date.now().toString() + Math.random().toString().slice(2, 8);
        const url = `https://www.youtube.com/watch?v=${v.id}`;
        await upsertDownloadTask({
          id: taskId,
          videoId: v.id,
          title: v.title,
          status: 'pending',
          progress: 0,
          speed: '0 MB/s',
          eta: '0:00',
          formatId,
        });
        await startDownloadTask(taskId, url, formatId);
      }
    } finally {
      setIsPlaylistDownloading(false);
    }
  };

  const playlistFormatSelector = useMemo(() => (
    <FormatSelector
      isOpen={isPlaylistDownloading}
      metadata={playlistFormatMetadata}
      onDownload={handlePlaylistDownloadConfirm}
      onClose={() => setIsPlaylistDownloading(false)}
      isLoading={isPlaylistMetaLoading}
    />
  ), [isPlaylistDownloading, playlistFormatMetadata, handlePlaylistDownloadConfirm, isPlaylistMetaLoading]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {onBack && (
                <button
                  onClick={onBack}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
                >
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={16} className="text-muted-foreground" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Playlist</p>
                <h2 className="text-base font-semibold text-foreground truncate">
                  {playlist?.title || 'Playlist'}
                </h2>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setLayout("list")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${layout === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  1x1
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("grid-2")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${layout === "grid-2"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  2x2
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("grid-3")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${layout === "grid-3"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  3x3
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("grid-4")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${layout === "grid-4"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  4x4
                </button>
              </div>
              <button
                onClick={handlePlayAll}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                title="Play all"
              >
                <HugeiconsIcon icon={PlayIcon} size={12} />
                Play all
              </button>
              <button
                onClick={handleShuffle}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 transition-colors"
                title="Shuffle"
              >
                <HugeiconsIcon icon={Shuffle} size={12} />
                Shuffle
              </button>
              <button
                onClick={() => void downloadPlaylist()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 transition-colors"
                title="Download playlist"
              >
                <HugeiconsIcon icon={Download02Icon} size={12} />
                Download
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors shrink-0"
                    aria-label="More options"
                  >
                    <HugeiconsIcon icon={MoreVerticalIcon} size={14} className="text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground backdrop-blur-xl shadow-lg">
                  <DropdownMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handleShare}>
                    <HugeiconsIcon icon={Share02Icon} size={16} className="mr-2" />
                    Share playlist
                  </DropdownMenuItem>
                  <DropdownMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handleRefresh}>
                    <HugeiconsIcon icon={Refresh01Icon} size={16} className="mr-2" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handleShowInfo}>
                    <HugeiconsIcon icon={Information} size={16} className="mr-2" />
                    Playlist info
                  </DropdownMenuItem>
                  <DropdownMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handleToggleLike}>
                    <HugeiconsIcon icon={Favorite} size={16} className="mr-2" />
                    Like playlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 h-px bg-border" />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                    disabled={!onDelete}
                  >
                    <HugeiconsIcon icon={Trash2} size={16} className="mr-2" />
                    Delete playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <VideoGrid
              videos={filteredVideos}
              playSong={(video) => {
                const index = videos.findIndex(v => v.id === video.id);
                if (onPlayVideo && index !== -1) {
                  onPlayVideo(video, index);
                } else {
                  playSong(video);
                }
              }}
              onDownload={(video) => void requestDownload(video.id)}
              onPlayAsAudio={onPlayAsAudio}
              layout={layout}
            />
          )}

          {DownloadModal}

          {playlistFormatSelector}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground backdrop-blur-xl shadow-lg">
        <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onSelect={handleShare}>
          <HugeiconsIcon icon={Share02Icon} size={16} className="mr-2" />
          Share playlist
        </ContextMenuItem>
        <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onSelect={handleRefresh}>
          <HugeiconsIcon icon={Refresh01Icon} size={16} className="mr-2" />
          Refresh
        </ContextMenuItem>
        <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onSelect={handleShowInfo}>
          <HugeiconsIcon icon={Information} size={16} className="mr-2" />
          Playlist info
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 h-px bg-border" />
        <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onSelect={handlePlayAll}>
          <HugeiconsIcon icon={PlayIcon} size={16} className="mr-2" />
          Play all
        </ContextMenuItem>
        <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onSelect={handleShuffle}>
          <HugeiconsIcon icon={Shuffle} size={16} className="mr-2" />
          Shuffle
        </ContextMenuItem>
        <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onSelect={() => void downloadPlaylist()}>
          <HugeiconsIcon icon={Download02Icon} size={16} className="mr-2" />
          Download playlist
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 h-px bg-border" />
        <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onSelect={handleToggleLike}>
          <HugeiconsIcon icon={Favorite} size={16} className="mr-2" />
          Like playlist
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 h-px bg-border" />
        <ContextMenuItem
          className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
          onSelect={handleDelete}
          disabled={!onDelete}
        >
          <HugeiconsIcon icon={Trash2} size={16} className="mr-2" />
          Delete playlist
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
