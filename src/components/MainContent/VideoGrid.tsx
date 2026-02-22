import type { Video } from '../../hooks/useRustCommands';
 import { VideoCard } from '../VideoCard';

interface VideoGridProps {
  videos: Video[];
  playSong: (song: Video) => void;
  onDownload?: (video: Video) => void;
  onPlayAsAudio?: (video: Video) => void;
  layout?: "list" | "grid-2" | "grid-3" | "grid-4";
}

const layoutClasses: Record<NonNullable<VideoGridProps["layout"]>, string> = {
  list: "grid grid-cols-1 gap-3",
  "grid-2": "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",
  "grid-3": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4",
  "grid-4": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4",
};

export const VideoGrid = ({ videos, playSong, onDownload, onPlayAsAudio, layout = "grid-4" }: VideoGridProps) => {
  return (
    <div className={layoutClasses[layout]}>
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onTap={() => playSong(video)}
          onDownload={onDownload ? () => onDownload(video) : undefined}
          onPlayAsAudio={onPlayAsAudio ? () => onPlayAsAudio(video) : undefined}
        />
      ))}
    </div>
  );
};
