import {
  Pause,
  Play,
  Trash2,
  X,
  Download,
  FileVideo,
  Clock,
  Gauge,
  AlertCircle,
  CheckCircle2,
  Zap,
  RefreshCw,
} from "lucide-react";
import React from "react";

interface DownloadTaskCardProps {
  task: {
    id: string;
    title: string;
    progress: number;
    status:
    | "downloading"
    | "paused"
    | "completed"
    | "error"
    | "queued"
    | "cancelled"
    | "merging"
    | "extracting"
    | "retrying";
    speed?: string;
    eta?: string;
    thumbnailUrl?: string;
    formatLabel?: string;
    resolution?: string;
    codecInfo?: string;
    fileSize?: string;
    fps?: number;
    error?: string;
  };
  onDelete: (taskId: string) => void;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
}

const statusStyles: Record<
  DownloadTaskCardProps["task"]["status"],
  { label: string; className: string; icon: React.ReactNode; bgColor: string }
> = {
  downloading: {
    label: "Downloading",
    className: "text-blue-400",
    icon: <Download size={14} />,
    bgColor: "bg-blue-500",
  },
  paused: {
    label: "Paused",
    className: "text-yellow-400",
    icon: <Pause size={14} />,
    bgColor: "bg-yellow-500",
  },
  queued: {
    label: "Queued",
    className: "text-gray-400",
    icon: <Clock size={14} />,
    bgColor: "bg-gray-500",
  },
  cancelled: {
    label: "Cancelled",
    className: "text-red-400",
    icon: <X size={14} />,
    bgColor: "bg-red-500",
  },
  error: {
    label: "Error",
    className: "text-destructive",
    icon: <AlertCircle size={14} />,
    bgColor: "bg-destructive",
  },
  completed: {
    label: "Completed",
    className: "text-emerald-400",
    icon: <CheckCircle2 size={14} />,
    bgColor: "bg-emerald-500",
  },
  merging: {
    label: "Merging",
    className: "text-purple-400",
    icon: <Zap size={14} />,
    bgColor: "bg-purple-500",
  },
  extracting: {
    label: "Processing",
    className: "text-indigo-400",
    icon: <Zap size={14} />,
    bgColor: "bg-indigo-500",
  },
  retrying: {
    label: "Retrying",
    className: "text-orange-400",
    icon: <Download size={14} />,
    bgColor: "bg-orange-500",
  },
};

const getProgressBarColor = (
  status: DownloadTaskCardProps["task"]["status"],
  progress: number,
) => {
  if (status === "completed") return "from-emerald-500/70 to-emerald-500";
  if (status === "error" || status === "cancelled")
    return "from-destructive/70 to-destructive";
  if (status === "paused") return "from-yellow-500/70 to-yellow-500";
  if (status === "merging" || status === "extracting")
    return "from-purple-500/70 to-purple-500 animate-pulse";
  if (status === "retrying")
    return "from-orange-500/70 to-orange-500 animate-pulse";
  return "from-primary/70 to-primary";
};

export const DownloadTaskCard = React.memo(
  ({
    task,
    onDelete,
    onPause,
    onResume,
    onCancel,
  }: DownloadTaskCardProps) => {
    const status = statusStyles[task.status];
    const isActive =
      task.status === "downloading" ||
      task.status === "merging" ||
      task.status === "extracting";
    const isPaused = task.status === "paused";
    const canCancel =
      task.status === "downloading" ||
      task.status === "queued" ||
      task.status === "paused" ||
      task.status === "merging" ||
      task.status === "extracting" ||
      task.status === "retrying";
    const isStuck =
      task.status === "downloading" &&
      task.progress >= 99 &&
      (!task.eta || task.eta === "0:00");

    const calculateDownloadedSize = (
      progress: number,
      totalSize?: string,
    ): string => {
      if (!totalSize) return "";
      const match = totalSize.match(/^([\d.]+)\s*(GB|MB|KB|B)$/i);
      if (!match) return "";

      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      const downloadedValue = (value * progress) / 100;

      return `${downloadedValue.toFixed(2)} ${unit}`;
    };

    return (
      <div
        className={`group relative w-full overflow-hidden rounded-lg bg-secondary text-foreground border shadow-sm hover:shadow-md transition-all duration-200 ${isStuck ? "border-orange-500/50 bg-orange-500/5" : "border-border"
          }`}
      >
        <div className="p-3 sm:p-4">
          <div className="flex gap-3 sm:gap-4 items-center">
            {/* Thumbnail */}
            <div className="relative shrink-0">
              <div className="w-32 h-18 sm:w-36 sm:h-20 rounded-lg overflow-hidden bg-background/40 flex items-center justify-center">
                {task.thumbnailUrl ? (
                  <img
                    src={task.thumbnailUrl}
                    alt={task.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileVideo size={22} className="text-muted-foreground" />
                )}
              </div>
              {/* Status indicator */}
              <div
                className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-lg border-2 border-secondary ${status.bgColor} ${isActive ? "animate-pulse" : ""
                  }`}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Title */}
              <div className="mb-2">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                  {task.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border ${task.status === "downloading"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : task.status === "merging" ||
                        task.status === "extracting"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : task.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : task.status === "error" ||
                            task.status === "cancelled"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : task.status === "paused"
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                              : task.status === "retrying"
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                : "bg-muted/20 text-muted-foreground border-border"
                      }`}
                  >
                    {status.icon}
                    {status.label}
                  </span>
                  {isStuck && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      <AlertCircle size={11} />
                      Stuck at {task.progress.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Section */}
              {(isActive || task.status === "paused") && (
                <div className="space-y-2">
                  {/* Progress Bar */}
                  <div className="relative">
                    <div className="h-2 bg-muted/40 rounded-lg overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getProgressBarColor(task.status, task.progress)} rounded-lg transition-all duration-500 ease-out`}
                        style={{
                          width: `${Math.min(Math.max(task.progress, 0), 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Progress Details */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <Gauge size={11} />
                        {task.speed || "0 MB/s"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {task.eta || "calculating..."}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {task.progress.toFixed(1)}%
                    </span>
                  </div>

                  {/* File Size */}
                  {task.fileSize && (
                    <div className="text-[11px] text-muted-foreground">
                      {calculateDownloadedSize(task.progress, task.fileSize)} /{" "}
                      {task.fileSize}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {task.status === "error" && task.error && (
                <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
                  {task.error}
                </div>
              )}

              {/* Format Details */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {task.formatLabel && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background/40 text-[11px] font-medium text-muted-foreground">
                    {task.formatLabel}
                  </span>
                )}
                {task.resolution && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background/40 text-[11px] font-medium text-muted-foreground">
                    {task.resolution}
                  </span>
                )}
                {task.fileSize &&
                  task.status !== "downloading" &&
                  task.status !== "paused" &&
                  task.status !== "merging" &&
                  task.status !== "extracting" && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background/40 text-[11px] font-medium text-muted-foreground">
                      {task.fileSize}
                    </span>
                  )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-1.5">
              {isActive && (
                <button
                  onClick={() => onPause(task.id)}
                  aria-label="Pause download"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
                  title="Pause"
                >
                  <Pause size={16} />
                </button>
              )}
              {isPaused && (
                <button
                  onClick={() => onResume(task.id)}
                  aria-label="Resume download"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
                  title="Resume"
                >
                  <Play size={16} />
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => onCancel(task.id)}
                  aria-label="Cancel download"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              )}
              <button
                onClick={() => onDelete(task.id)}
                aria-label="Delete download from history"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete (Del)"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.progress === nextProps.task.progress &&
      prevProps.task.status === nextProps.task.status &&
      prevProps.task.error === nextProps.task.error
    );
  },
);

DownloadTaskCard.displayName = "DownloadTaskCard";
