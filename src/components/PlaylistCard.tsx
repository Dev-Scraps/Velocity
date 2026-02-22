import { HugeiconsIcon } from '@hugeicons/react';
import { PlayIcon, FolderOpenIcon } from '@hugeicons/core-free-icons';
import type { Playlist } from '../hooks/useRustCommands';

interface PlaylistCardProps {
  playlist: Playlist;
  onTap?: () => void;
  onLongPress?: () => void;
  isRearranging?: boolean;
  onClick?: () => void;
}

export const PlaylistCard = ({ playlist, onTap, onLongPress, isRearranging = false, onClick }: PlaylistCardProps) => {
  const formatVideoCountBadge = (count: number | undefined): string => {
    if (!count || count === 0) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (isRearranging) {
    return (
      <div
        className="rounded-lg overflow-hidden bg-muted border-2 border-primary"
      >
        <div className="p-3 flex items-center gap-3">
          <div className="p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </div>
          <div className="w-16 aspect-video relative rounded-lg overflow-hidden">
            <div className="w-full h-full bg-muted">
              {playlist.thumbnailUrl && (
                <img src={playlist.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded flex items-center gap-1 bg-black/85">
              <HugeiconsIcon icon={FolderOpenIcon} size={8} className="text-white" />
              <span className="text-white text-[9px] font-semibold">
                {formatVideoCountBadge(playlist.videoCount)}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight line-clamp-1 text-foreground">
              {playlist.title}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-[28px] bg-card p-2 shadow-sm transition-all duration-300 border border-border/50 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer"
      onClick={onClick || onTap}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress?.();
      }}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[20px] bg-muted/50">
        <div className="h-full w-full overflow-hidden">
          {playlist.thumbnailUrl ? (
            <img
              src={playlist.thumbnailUrl}
              alt={playlist.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <HugeiconsIcon icon={FolderOpenIcon} size={36} className="text-muted-foreground opacity-50" />
            </div>
          )}
        </div>

        {/* Subtly darkened overlay on hover */}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />

        {/* Top-left rounded badge for video count */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
          <HugeiconsIcon icon={FolderOpenIcon} size={10} className="text-white/90" />
          <span className="text-[10px] font-bold text-white/90">
            {formatVideoCountBadge(playlist.videoCount)}
          </span>
        </div>

        {/* Centered Play Button - visible on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-300 hover:scale-110">
            <HugeiconsIcon icon={PlayIcon} size={28} className="ml-1 fill-white text-white shadow-sm" />
          </div>
        </div>
      </div>

      {/* SR Only Title */}
      <div className="sr-only">
        <p>{playlist.title}</p>
      </div>
    </div>
  );
};
