import type { Video } from '../../hooks/useRustCommands';
import { HugeiconsIcon } from '@hugeicons/react';
import { MusicNote02Icon } from '@hugeicons/core-free-icons';
import { LoadingState } from '../SkeletonLoader';
// @ts-ignore
import { FixedSizeList as List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

interface QueueListProps {
  queue: Video[];
  onQueueSelect: (video: Video, index: number) => void;
  currentSongIndex?: number;
  isCollapsed?: boolean;
  isLoading?: boolean;
}

export const QueueList = ({
  queue,
  onQueueSelect,
  currentSongIndex = -1,
  isCollapsed = false,
  isLoading = false,
}: QueueListProps) => {
  if (isLoading) {
    return (
      <LoadingState
        isLoading={true}
        type={isCollapsed ? "collapsed-playlist" : "expanded-playlist"}
      />
    );
  }

  // Row component for react-window
  const QueueRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const video = queue[index];

    if (isCollapsed) {
      return (
        <div style={style} className="w-full flex justify-center py-1.5">
          <button
            title={video.title}
            onClick={(e) => {
              e.stopPropagation();
              onQueueSelect(video, index);
            }}
            className="w-30 h-14 rounded-lg overflow-hidden bg-muted hover:bg-accent/60 transition-all duration-300 ease-in-out relative block mx-auto border border-border transform hover:scale-110 hover:rotate-6"
          >
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover transition-all duration-300"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center">
              <HugeiconsIcon
                icon={MusicNote02Icon}
                className={video.thumbnailUrl ? "text-muted-foreground hidden" : "text-muted-foreground transition-all duration-300 hover:scale-110"}
                size={20}
              />
            </div>
          </button>
        </div>
      );
    }

    return (
      <div style={style} className="px-1 py-1.5">
        <div
          onClick={() => onQueueSelect(video, index)}
          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all duration-300 ease-in-out group border border-border bg-card hover:bg-accent/60 hover:scale-[1.02] hover:shadow-md transform h-full ${index === currentSongIndex ? "ring-1 ring-primary/50 bg-primary/10" : ""}`}
        >
          <div className="w-30 h-14 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted overflow-hidden">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
              />
            ) : (
              <HugeiconsIcon icon={MusicNote02Icon} className="text-muted-foreground group-hover:text-foreground transition-all duration-300 hover:scale-110" size={26} />
            )}
            <HugeiconsIcon icon={MusicNote02Icon} className="text-muted-foreground group-hover:text-foreground transition-all duration-300 hidden absolute" size={26} />
          </div>
          <div className="flex-1 min-w-0 transition-all duration-300">
            <p className="text-foreground font-semibold text-sm truncate transition-all duration-300 leading-tight group-hover:text-primary">{video.title}</p>
            {video.channel && (
              <p className="text-xs text-muted-foreground truncate mt-1 transition-all duration-300 group-hover:text-foreground">{video.channel}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="transition-all duration-300 group-hover:text-foreground">{video.duration || ""}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-grow transition-all duration-500 ease-in-out">
      {/* @ts-ignore */}
      <AutoSizer>
        {({ height, width }: { height: number; width: number }) => (
          <List
            height={height}
            itemCount={queue.length}
            itemSize={isCollapsed ? 70 : 88} // Adjusted height based on content + padding
            width={width}
            className="scrollbar-hide"
          >
            {QueueRow}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};
