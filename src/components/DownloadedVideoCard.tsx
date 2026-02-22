import { Play, Trash2, FileVideo, HardDrive, Clock, PlayCircle, Share2, Copy, ExternalLink, FolderOpen, Info, MoreVertical } from "lucide-react"
import { open } from "@tauri-apps/plugin-shell"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu"
import { cn } from "../utils"
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts"
import { DeleteVideoDialog } from "./DeleteVideoDialog"
import { useState } from "react"

interface DownloadedVideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnailUrl?: string;
    duration?: string;
    channelName?: string;
    fileSize?: number;
    filePath?: string;
    file_size?: number;
    position?: number;
    completion_percentage?: number;
    youtubeId?: string;
  };
  onPlay: (video: any) => void;
  onDelete: (videoId: string) => void;
  onShare?: (video: any) => void;
  onShowInfo?: (video: any) => void;
  onOpenFolder?: (video: any) => void;
  onDeleteFromFile?: (videoId: string) => void;
  onRemoveFromList?: (videoId: string) => void;
}

export const DownloadedVideoCard = ({
  video,
  onPlay,
  onDelete,
  onShare,
  onShowInfo,
  onOpenFolder,
  onDeleteFromFile,
  onRemoveFromList,
}: DownloadedVideoCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return "Unknown size";
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const getFileExtension = (filePath?: string): string => {
    if (!filePath) return "Unknown";
    const ext = filePath.split('.').pop()?.toUpperCase();
    return ext || "Unknown";
  };

  const handleCopyLink = async () => {
    if (video.youtubeId) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
      try {
        await navigator.clipboard.writeText(youtubeUrl);
      } catch {
        // ignore
      }
    }
  };

  const handleOpenYoutube = async () => {
    if (video.youtubeId) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
      await open(youtubeUrl);
    }
  };

  const handlePlayExternal = async () => {
    // Check if video has filePath as an extra property (might be added by backend)
    const videoWithFilePath = video as any;
    if (videoWithFilePath.filePath) {
      // Open with system default player
      await open(videoWithFilePath.filePath);
    } else {
      // Fallback to original play handler
      onPlay(video);
    }
  };

  const handleDeleteFromFile = () => {
    if (onDeleteFromFile) {
      onDeleteFromFile(video.id);
    } else {
      onDelete(video.id);
    }
  };

  const handleRemoveFromList = () => {
    if (onRemoveFromList) {
      onRemoveFromList(video.id);
    } else {
      onDelete(video.id);
    }
  };

  const handleShare = async () => {
    if (onShare) {
      onShare(video);
    } else if (video.youtubeId) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;
      try {
        if (navigator.share) {
          await navigator.share({
            title: video.title,
            text: `Check out this video: ${video.title}`,
            url: youtubeUrl,
          });
        } else {
          await handleCopyLink();
        }
      } catch {
        // ignore
      }
    }
  };

  const handleShowInfo = () => {
    onShowInfo?.(video);
  };

  const handleOpenFolder = () => {
    onOpenFolder?.(video);
  };

  // Keyboard shortcuts
  const shortcuts = [
    { key: 'Enter', action: () => onPlay(video) },
    { key: ' ', action: () => onPlay(video) }, // Spacebar
    { key: 's', ctrlKey: true, action: () => void handleShare() },
    { key: 'c', ctrlKey: true, action: () => void handleCopyLink() },
    { key: 'i', ctrlKey: true, action: () => handleShowInfo() },
    { key: 'f', ctrlKey: true, action: () => handleOpenFolder() },
    { key: 'y', ctrlKey: true, action: () => handleOpenYoutube() },
    { key: 'Delete', action: () => onDelete(video.id) },
  ]

  useKeyboardShortcuts(shortcuts)

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group relative w-full overflow-hidden rounded-lg bg-secondary text-foreground border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer">
            <div className="p-4 sm:p-5">
              {/* Thumbnail and Content */}
              <div className="flex gap-3 sm:gap-4">
                {/* Thumbnail - Commented out until we implement thumbnail extraction from downloaded videos
          <div className="relative shrink-0">
            <div className="w-24 h-16 sm:w-28 sm:h-18 rounded-lg overflow-hidden bg-background/40 flex items-center justify-center">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FileVideo size={22} className="text-muted-foreground" />
              )}
            </div>
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-lg border-2 border-secondary bg-emerald-500" />
          </div>
          */}

                {/* Content - Now takes full width */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div className="mb-2">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <FileVideo size={10} />
                        Downloaded
                      </span>
                      {video.duration && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock size={10} />
                          {video.duration}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Format Details and Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {/* Format Details */}
                    {video.channelName && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background/40 text-[11px] font-medium text-muted-foreground">
                        {video.channelName}
                      </span>
                    )}
                    {video.filePath && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background/40 text-[11px] font-medium text-muted-foreground">
                        <HardDrive size={10} />
                        {getFileExtension(video.filePath)}
                      </span>
                    )}
                    {(video.fileSize || video.file_size) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background/40 text-[11px] font-medium text-muted-foreground">
                        {formatFileSize(video.fileSize || video.file_size)}
                      </span>
                    )}
                    {video.completion_percentage && video.completion_percentage < 100 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[11px] font-medium">
                        {video.completion_percentage.toFixed(0)}% watched
                      </span>
                    )}

                    {/* Action Buttons */}
                    <button
                      onClick={handlePlayExternal}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-foreground bg-primary/10 hover:bg-primary/20 transition-colors"
                      title="Play in external player"
                    >
                      <Play size={10} />
                      Play
                    </button>
                    <button
                      onClick={() => void handleShare()}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-foreground/80 hover:bg-primary/10 transition-colors"
                      title="Share"
                    >
                      <Share2 size={10} />
                      Share
                    </button>
                    {video.youtubeId && (
                      <button
                        onClick={handleOpenYoutube}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-foreground/80 hover:bg-primary/10 transition-colors"
                        title="Open in YouTube"
                      >
                        <ExternalLink size={10} />
                        YouTube
                      </button>
                    )}
                    <button
                      onClick={handleOpenFolder}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-foreground/80 hover:bg-primary/10 transition-colors"
                      title="Open folder"
                      disabled={!onOpenFolder}
                    >
                      <FolderOpen size={10} />
                      Folder
                    </button>
                    <button
                      onClick={handleShowInfo}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-foreground/80 hover:bg-primary/10 transition-colors"
                      title="Video info"
                      disabled={!onShowInfo}
                    >
                      <Info size={10} />
                      Info
                    </button>
                    <button
                      onClick={() => setShowDeleteDialog(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={10} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground backdrop-blur-xl shadow-lg">
          <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handlePlayExternal}>
            <Play size={16} className="mr-2" />
            Play in external player
          </ContextMenuItem>

          {video.youtubeId && (
            <>
              <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handleOpenYoutube}>
                <ExternalLink size={16} className="mr-2" />
                Open in YouTube
              </ContextMenuItem>
              <ContextMenuSeparator className="my-1 h-px bg-border" />
            </>
          )}

          <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={() => void handleShare()}>
            <Share2 size={16} className="mr-2" />
            Share
          </ContextMenuItem>

          {video.youtubeId && (
            <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={() => void handleCopyLink()}>
              <Copy size={16} className="mr-2" />
              Copy YouTube link
            </ContextMenuItem>
          )}

          <ContextMenuSeparator className="my-1 h-px bg-border" />

          <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handleOpenFolder} disabled={!onOpenFolder}>
            <FolderOpen size={16} className="mr-2" />
            Open folder
          </ContextMenuItem>

          <ContextMenuItem className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer" onClick={handleShowInfo} disabled={!onShowInfo}>
            <Info size={16} className="mr-2" />
            Video info
          </ContextMenuItem>

          <ContextMenuSeparator className="my-1 h-px bg-border" />

          <ContextMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
          >
            <Trash2 size={16} className="mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DeleteVideoDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        videoTitle={video.title}
        onDeleteFromFile={handleDeleteFromFile}
        onRemoveFromList={handleRemoveFromList}
      />
    </>
  );
};
