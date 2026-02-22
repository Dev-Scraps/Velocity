"use client";

import React from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  Copy,
  Download,
  MoreVertical,
  VideoIcon,
  Heart,
  Plus,
  Play,
  Eye,
  RefreshCw,
  Share2,
  ExternalLink,
  Info,
  Trash2,
  Headphones,
} from "lucide-react";
import type { Video } from "../hooks/useRustCommands";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download02Icon,
  ExternalLink as ExternalLinkIcon,
  Favorite,
  Information,
  PlayIcon,
  PlusSignIcon,
  Refresh01Icon,
  Share02Icon,
  Trash2 as Trash2Icon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { cn } from "../utils";

interface VideoCardProps {
  video: Video;
  onTap?: () => void;
  onDownload?: () => void;
  onMenuTap?: () => void;
  onDelete?: () => void;
  isDownloadLoading?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  aiEnabled?: boolean;
  onShare?: () => void;
  onToggleLike?: () => void;
  onAddToPlaylist?: () => void;
  onShowInfo?: () => void;
  onMarkAsWatched?: () => void;
  onRefresh?: () => void;
  onPlayAsAudio?: () => void;
}

export const VideoCard = React.memo(
  ({
    video,
    onTap,
    onDownload,
    onDelete,
    isSelectionMode = false,
    isSelected = false,
    onSelect,
    onShare,
    onToggleLike,
    onAddToPlaylist,
    onShowInfo,
    onMarkAsWatched,
    onRefresh,
    onPlayAsAudio,
  }: VideoCardProps) => {
    const effectiveSelectionMode = isSelectionMode || (!!onSelect && !onTap);

    const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;

    const formatDuration = (duration: string): string => duration;

    const formatUploadDate = (uploadDate?: string): string | undefined => {
      if (!uploadDate) return undefined;
      const trimmed = uploadDate.trim();
      if (/^\d{8}$/.test(trimmed)) {
        const y = trimmed.slice(0, 4);
        const m = trimmed.slice(4, 6);
        const d = trimmed.slice(6, 8);
        return `${y}-${m}-${d}`;
      }
      return trimmed;
    };

    const formatCompactNumber = (value?: number): string | undefined => {
      if (value === null || value === undefined) return undefined;
      const abs = Math.abs(value);
      if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return `${value}`;
    };

    const handleCopyLink = async () => {
      try {
        await navigator.clipboard.writeText(youtubeUrl);
      } catch {
        // ignore
      }
    };

    const handleOpenYoutube = async () => {
      await open(youtubeUrl);
    };

    const handleShare = async () => {
      if (onShare) {
        onShare();
      } else {
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

    const handleToggleLike = () => {
      onToggleLike?.();
    };

    const handleAddToPlaylist = () => {
      onAddToPlaylist?.();
    };

    const handleShowInfo = () => {
      onShowInfo?.();
    };

    const handleMarkAsWatched = () => {
      onMarkAsWatched?.();
    };

    const handleRefresh = () => {
      onRefresh?.();
    };

    // Keyboard shortcuts
    const shortcuts = [
      { key: "Enter", action: () => onTap?.() },
      { key: " ", action: () => onTap?.() }, // Spacebar
      { key: "d", ctrlKey: true, action: () => onDownload?.() },
      { key: "l", ctrlKey: true, action: () => handleToggleLike() },
      { key: "s", ctrlKey: true, action: () => void handleShare() },
      { key: "c", ctrlKey: true, action: () => void handleCopyLink() },
      { key: "i", ctrlKey: true, action: () => handleShowInfo() },
      { key: "p", ctrlKey: true, action: () => handleAddToPlaylist() },
      { key: "w", ctrlKey: true, action: () => handleMarkAsWatched() },
      { key: "r", ctrlKey: true, action: () => handleRefresh() },
      { key: "Delete", action: () => onDelete?.() },
    ];

    useKeyboardShortcuts(shortcuts, !effectiveSelectionMode);

    const metaParts = [
      video.channelName || video.channel,
      formatCompactNumber(video.viewCount),
      formatUploadDate(video.uploadDate),
    ].filter(Boolean) as string[];

    const channelLabel = (video.channelName || video.channel || "").trim();
    const channelInitial = channelLabel
      ? channelLabel.charAt(0).toUpperCase()
      : "";

    const menu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-black/60 backdrop-blur-md",
              "text-white/90 transition-all hover:scale-110 hover:bg-black/80",
              "focus:outline-none focus:ring-2 focus:ring-white/20",
            )}
            aria-label="Video options"
            type="button"
          >
            <MoreVertical size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground backdrop-blur-xl shadow-lg">
          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onTap?.();
            }}
            disabled={!onTap}
          >
            <Play size={14} className="mr-2" />
            Play
          </DropdownMenuItem>

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenYoutube();
            }}
          >
            <ExternalLink size={14} className="mr-2" />
            Open in YouTube
          </DropdownMenuItem>

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onPlayAsAudio?.();
            }}
            disabled={!onPlayAsAudio}
          >
            <Headphones size={14} className="mr-2" />
            Play as Audio
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 h-px bg-border" />

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              void handleShare();
            }}
          >
            <Share2 size={14} className="mr-2" />
            Share
          </DropdownMenuItem>

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopyLink();
            }}
          >
            <Copy size={14} className="mr-2" />
            Copy link
          </DropdownMenuItem>

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleLike();
            }}
          >
            <Heart size={14} className={cn("mr-2", video.isLiked && "fill-current text-pink-500")} />
            {video.isLiked ? "Unlike" : "Like"}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 h-px bg-border" />

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleAddToPlaylist();
            }}
          >
            <Plus size={14} className="mr-2" />
            Add to playlist
          </DropdownMenuItem>

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleMarkAsWatched();
            }}
          >
            <Eye size={14} className="mr-2" />
            Mark as{" "}
            {video.completionPercentage === 100 ? "unwatched" : "watched"}
          </DropdownMenuItem>

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleShowInfo();
            }}
          >
            <Info size={14} className="mr-2" />
            Video info
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 h-px bg-border" />

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
          >
            <RefreshCw size={14} className="mr-2" />
            Refresh
          </DropdownMenuItem>

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.();
            }}
            disabled={!onDownload}
          >
            <Download size={14} className="mr-2" />
            Download
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 h-px bg-border" />

          <DropdownMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            disabled={!onDelete}
          >
            <Trash2 size={14} className="mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={() =>
              effectiveSelectionMode ? onSelect?.(!isSelected) : onTap?.()
            }
            className={cn(
              "group relative rounded-xl bg-card p-0.5 shadow-lg transition-all duration-300",
              "border border-border/50",
              "cursor-pointer",
              isSelected ? "ring-2 ring-primary" : "",
            )}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted/50">
              {video.thumbnailUrl ? (
                <div className="h-full w-full overflow-hidden">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="h-full w-full object-cover"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <VideoIcon
                    size={36}
                    className="text-muted-foreground opacity-50"
                  />
                </div>
              )}

              {/* Subtly darkened overlay on hover */}
              <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />

              {/* Centered Play Button - visible on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100 pointer-events-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-300 hover:scale-110">
                  <Play size={24} className="ml-1 fill-white text-white shadow-sm" />
                </div>
              </div>

              {/* Title Overlay - visible on hover */}
              <div className="absolute bottom-0 left-0 right-0  opacity-0 transition-all duration-300 group-hover:opacity-100 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-sm rounded-xl p-1">
                  <p className="text-xs font-medium text-white line-clamp-2 leading-tight">
                    {video.title}
                  </p>
                </div>
              </div>

              {/* Selection Checkbox */}
              {effectiveSelectionMode && (
                <div className="absolute left-4 top-4 z-10">
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onSelect?.(e.target.checked);
                    }}
                    className="h-6 w-6 cursor-pointer rounded-full border-2 border-white/50 bg-black/20 accent-primary backdrop-blur-sm transition-colors checked:border-primary checked:bg-primary"
                  />
                </div>
              )}

              {/* Duration Badge - Top Left */}
              {video.duration && (
                <div className="absolute top-3 left-3 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
                  <span className="text-[11px] font-bold text-white/90">
                    {formatDuration(video.duration)}
                  </span>
                </div>
              )}

              {/* Status Badges - Below Duration */}
              <div className="absolute left-3 top-11 flex flex-col gap-1.5">
                {video.isDownloaded && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/90 shadow-sm backdrop-blur-sm">
                    <Download size={14} className="text-white" />
                  </div>
                )}
                {video.isLiked && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-500/90 shadow-sm backdrop-blur-sm">
                    <Heart size={14} className="fill-white text-white" />
                  </div>
                )}
              </div>

              {/* Menu Button - Top Right */}
              {!effectiveSelectionMode && (
                <div className="absolute top-3 right-3 z-20">
                  {menu}
                </div>
              )}

              {/* Progress Bar */}
              {video.completionPercentage && video.completionPercentage > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${video.completionPercentage}%`,
                      backgroundColor:
                        video.completionPercentage === 100
                          ? "hsl(var(--success))"
                          : "hsl(var(--primary))",
                    }}
                  />
                </div>
              )}
            </div>

            <div className="sr-only">
              <h3>{video.title}</h3>
              <p>{video.channelName}</p>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground backdrop-blur-xl shadow-lg">
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              onTap?.();
            }}
            disabled={!onTap}
          >
            <HugeiconsIcon icon={PlayIcon} size={16} className="mr-2" />
            Play
          </ContextMenuItem>
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              handleOpenYoutube();
            }}
          >
            <HugeiconsIcon icon={ExternalLinkIcon} size={16} className="mr-2" />
            Open in YouTube
          </ContextMenuItem>
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              onPlayAsAudio?.();
            }}
            disabled={!onPlayAsAudio}
          >
            <Headphones size={16} className="mr-2" />
            Play as Audio
          </ContextMenuItem>

          <ContextMenuSeparator className="my-1 h-px bg-border" />
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              void handleShare();
            }}
          >
            <HugeiconsIcon icon={Share02Icon} size={16} className="mr-2" />
            Share
          </ContextMenuItem>
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              void handleCopyLink();
            }}
          >
            <Copy size={16} className="mr-2" />
            Copy link
          </ContextMenuItem>
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              handleToggleLike();
            }}
          >
            <HugeiconsIcon icon={Favorite} size={16} className={cn("mr-2", video.isLiked && "text-pink-500 fill-current")} />
            {video.isLiked ? "Unlike" : "Like"}
          </ContextMenuItem>
          <ContextMenuSeparator className="my-1 h-px bg-border" />
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              handleAddToPlaylist();
            }}
          >
            <HugeiconsIcon icon={PlusSignIcon} size={16} className="mr-2" />
            Add to playlist
          </ContextMenuItem>
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              handleMarkAsWatched();
            }}
          >
            <Eye size={16} className="mr-2" />
            Mark as{" "}
            {video.completionPercentage === 100 ? "unwatched" : "watched"}
          </ContextMenuItem>
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              handleShowInfo();
            }}
          >
            <HugeiconsIcon icon={Information} size={16} className="mr-2" />
            Video info
          </ContextMenuItem>
          <ContextMenuSeparator className="my-1 h-px bg-border" />
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              handleRefresh();
            }}
          >
            <HugeiconsIcon icon={Refresh01Icon} size={16} className="mr-2" />
            Refresh
          </ContextMenuItem>
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium focus:bg-accent focus:text-accent-foreground cursor-pointer"
            onSelect={() => {
              onDownload?.();
            }}
            disabled={!onDownload}
          >
            <HugeiconsIcon icon={Download02Icon} size={16} className="mr-2" />
            Download
          </ContextMenuItem>
          <ContextMenuSeparator className="my-1 h-px bg-border" />
          <ContextMenuItem
            className="my-0.5 rounded-[8px] px-2 py-1.5 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
            onSelect={() => {
              onDelete?.();
            }}
            disabled={!onDelete}
          >
            <HugeiconsIcon icon={Trash2Icon} size={16} className="mr-2" />
            Remove
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.video.id === nextProps.video.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isSelectionMode === nextProps.isSelectionMode
    );
  },
);

VideoCard.displayName = "VideoCard";
