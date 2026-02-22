import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download02Icon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { logger } from "../utils/logger";
import {
  getVideoMetadata,
  loadCookies,
  getVideoFormats,
  getDownloadTasks,
  getDownloadedVideos,
  deleteDownloadedVideo,
  removeDownloadedVideoFromList,
  upsertDownloadTask,
  deleteDownloadTask,
  startDownloadTask,
  pauseDownloadTask,
  resumeDownloadTask,
  cancelDownloadTask,
} from "../hooks/useRustCommands";
import type { Video, VideoFormat } from "../hooks/useRustCommands";
import { FormatSelector } from "../components/FormatSelector";
import { DownloadTaskCard } from "../components/DownloadTaskCard";
import { DownloadedVideoCard } from "../components/DownloadedVideoCard";
import { useLanguage } from "../context/LanguageContext";
import { Aria2Page } from "./Aria2Page";

interface DownloadTask {
  id: string;
  videoId?: string;
  url?: string;
  outputDir?: string;
  uniqueFilename?: boolean;
  title: string;
  formatId?: string;
  formatLabel?: string;
  resolution?: string;
  codecInfo?: string;
  fileSize?: string;
  fps?: number;
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
  error?: string;
}

type TabType = "active" | "paused" | "cancelled" | "downloaded";
type DownloadEngine = "ytdlp" | "aria2";

export const DownloadsPage = ({
  searchQuery = "",
}: {
  searchQuery?: string;
}) => {
  const { t } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<TabType>("active");
  const [downloadEngine, setDownloadEngine] = useState<DownloadEngine>("ytdlp");
  const [taskLayout, setTaskLayout] = useState<
    "list" | "grid-2" | "grid-3" | "grid-4"
  >("list");
  const [urlInput, setUrlInput] = useState("");
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [downloadedVideos, setDownloadedVideos] = useState<Video[]>([]);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [configureMetadata, setConfigureMetadata] = useState<any>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>("");
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  const pendingProgressRef = useRef(
    new Map<
      string,
      {
        progress?: number;
        speed?: string;
        eta?: string;
      }
    >(),
  );
  const rafRef = useRef<number | null>(null);
  const lastDbWriteRef = useRef(new Map<string, number>());

  const syncDownloadedVideos = async () => {
    try {
      const videos = await getDownloadedVideos();
      setDownloadedVideos(videos);
    } catch (error) {
      logger.error("Failed to sync downloaded videos", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await getDownloadTasks();
      const mappedTasks: DownloadTask[] = tasks.map((task: any) => ({
        id: task.id,
        videoId: task.videoId ?? undefined,
        url: task.url ?? undefined,
        outputDir: task.outputDir ?? undefined,
        uniqueFilename: task.uniqueFilename ?? undefined,
        title: task.title,
        formatId: task.formatId,
        formatLabel: task.formatLabel,
        resolution: task.resolution,
        codecInfo: task.codecInfo,
        fileSize: task.fileSize,
        fps: task.fps,
        progress: task.progress || 0,
        status: task.status,
        speed: task.speed || "0 MB/s",
        eta: task.eta || "0:00",
        thumbnailUrl: task.thumbnailUrl,
      }));

      setDownloadTasks((prev) => {
        if (mappedTasks.length === 0 && prev.length > 0) return prev;

        const byId = new Map<string, DownloadTask>(
          mappedTasks.map((task) => [task.id, task]),
        );
        prev.forEach((task) => {
          if (!byId.has(task.id) &&
            ["downloading", "queued", "paused", "merging", "extracting", "retrying"].includes(
              task.status,
            )) {
            byId.set(task.id, task);
          }
        });

        return Array.from(byId.values());
      });
    } catch (error) {
      console.error("Failed to load download tasks:", error);
    }
  }, []);

  useEffect(() => {

    void syncDownloadedVideos();

    const unlistenPromise = listen("download_status", (event) => {
      const payload = event.payload as {
        taskId?: string;
        status?: string;
        error?: string;
      };
      if (!payload?.taskId || !payload?.status) return;
      console.log("[DownloadsPage] download_status event:", payload);
      setDownloadTasks((prev) => {
        const taskId = payload.taskId as string;
        const exists = prev.some((task) => task.id === taskId);
        if (!exists) {
          const placeholder: DownloadTask = {
            id: taskId,
            title: "Downloading…",
            progress: 0,
            status: (payload.status as DownloadTask["status"]) || "downloading",
            speed: "0 MB/s",
            eta: "0:00",
          };
          void loadTasks();
          return [...prev, placeholder];
        }

        return prev.map((task) => {
          if (task.id !== taskId) return task;
          const updatedTask = {
            ...task,
            status: payload.status as DownloadTask["status"],
            error: payload.error || task.error,
          };
          void upsertDownloadTask({
            id: updatedTask.id,
            videoId: updatedTask.videoId ?? undefined,
            url: updatedTask.url ?? undefined,
            outputDir: updatedTask.outputDir ?? undefined,
            uniqueFilename: updatedTask.uniqueFilename ?? undefined,
            title: updatedTask.title,
            status: updatedTask.status,
            progress: updatedTask.progress,
            speed: updatedTask.speed,
            eta: updatedTask.eta,
            formatId: updatedTask.formatId,
            resolution: updatedTask.resolution,
            codecInfo: updatedTask.codecInfo,
            fileSize: updatedTask.fileSize,
            fps: updatedTask.fps ?? undefined,
            thumbnailUrl: updatedTask.thumbnailUrl,
          });
          return updatedTask;
        });
      });
    });

    // Listen for download warnings (e.g., stuck at 99%)
    const unlistenWarningPromise = listen("download_warning", (event) => {
      const payload = event.payload as {
        taskId?: string;
        warning?: string;
        elapsed_seconds?: number;
      };
      if (!payload?.taskId) return;
      console.warn("[DownloadsPage] download_warning event:", payload);
      // Show warning in UI or toast notification
      // For now, update the task to show a warning indicator
    });

    // Listen for merging events
    const unlistenMergingPromise = listen("download_merging", (event) => {
      const payload = event.payload as { taskId?: string };
      if (!payload?.taskId) return;
      console.log("[DownloadsPage] download_merging event:", payload);
      setDownloadTasks((prev) => {
        const taskId = payload.taskId as string;
        const exists = prev.some((task) => task.id === taskId);
        if (!exists) {
          const placeholder: DownloadTask = {
            id: taskId,
            title: "Processing…",
            progress: 99,
            status: "merging",
            speed: "0 MB/s",
            eta: "0:00",
          };
          void loadTasks();
          return [...prev, placeholder];
        }

        return prev.map((task) => {
          if (task.id !== payload.taskId) return task;
          const updatedTask = {
            ...task,
            status: "merging" as const,
            progress: 99,
          };
          void upsertDownloadTask({
            id: updatedTask.id,
            videoId: updatedTask.videoId ?? undefined,
            title: updatedTask.title,
            status: updatedTask.status,
            progress: updatedTask.progress,
            speed: updatedTask.speed,
            eta: updatedTask.eta,
            formatId: updatedTask.formatId,
            resolution: updatedTask.resolution,
            codecInfo: updatedTask.codecInfo,
            fileSize: updatedTask.fileSize,
            fps: updatedTask.fps ?? undefined,
            thumbnailUrl: updatedTask.thumbnailUrl,
          });
          return updatedTask;
        });
      });
    });

    const unlistenProgressPromise = listen("download_progress", (event) => {
      const payload = event.payload as {
        taskId?: string;
        progress?: number;
        speed?: string;
        eta?: string;
      };
      if (!payload?.taskId) return;

      pendingProgressRef.current.set(payload.taskId, {
        progress: payload.progress,
        speed: payload.speed,
        eta: payload.eta,
      });

      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingProgressRef.current;
        if (pending.size === 0) return;
        pendingProgressRef.current = new Map();

        setDownloadTasks((prev) => {
          let changed = false;
          const next = prev.map((task) => {
            const p = pending.get(task.id);
            if (!p) return task;
            const progressValue = p.progress ?? 0;
            const normalizedProgress =
              progressValue <= 1 ? progressValue * 100 : progressValue;
            const updatedTask = {
              ...task,
              progress: normalizedProgress,
              speed: p.speed ?? task.speed,
              eta: p.eta ?? task.eta,
              status: task.status === "queued" ? "downloading" : task.status,
            };

            const now = Date.now();
            const last = lastDbWriteRef.current.get(updatedTask.id) ?? 0;
            if (now - last > 800) {
              lastDbWriteRef.current.set(updatedTask.id, now);
              void upsertDownloadTask({
                id: updatedTask.id,
                videoId: updatedTask.videoId ?? undefined,
                url: updatedTask.url ?? undefined,
                outputDir: updatedTask.outputDir ?? undefined,
                uniqueFilename: updatedTask.uniqueFilename ?? undefined,
                title: updatedTask.title,
                status: updatedTask.status,
                progress: updatedTask.progress,
                speed: updatedTask.speed,
                eta: updatedTask.eta,
                formatId: updatedTask.formatId,
                resolution: updatedTask.resolution,
                codecInfo: updatedTask.codecInfo,
                fileSize: updatedTask.fileSize,
                fps: updatedTask.fps ?? undefined,
                thumbnailUrl: updatedTask.thumbnailUrl,
              });
            }

            changed = true;
            return updatedTask;
          });

          // If any task completed, refresh downloaded videos
          const hasCompleted = next.some(
            (task) =>
              task.status === "completed" &&
              !prev.some((p) => p.id === task.id && p.status === "completed"),
          );
          if (hasCompleted) {
            void syncDownloadedVideos();
          }

          const unknownIds = Array.from(pending.keys()).filter(
            (taskId) => !prev.some((task) => task.id === taskId),
          );
          if (unknownIds.length > 0) {
            const placeholders = unknownIds.map((taskId) => {
              const p = pending.get(taskId);
              const progressValue = p?.progress ?? 0;
              const normalizedProgress =
                progressValue <= 1 ? progressValue * 100 : progressValue;
              return {
                id: taskId,
                title: "Downloading…",
                progress: normalizedProgress,
                status: "downloading" as const,
                speed: p?.speed ?? "0 MB/s",
                eta: p?.eta ?? "0:00",
              } as DownloadTask;
            });
            void loadTasks();
            return [...next, ...placeholders];
          }

          return changed ? next : prev;
        });
      });
    });

    void loadTasks();

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
      void unlistenWarningPromise.then((unlisten) => unlisten());
      void unlistenMergingPromise.then((unlisten) => unlisten());
      void unlistenProgressPromise.then((unlisten) => unlisten());
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [loadTasks]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      void loadTasks();
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadTasks]);

  useEffect(() => {
    const persistTasks = async () => {
      try {
        await Promise.all(
          downloadTasks.map((task) =>
            upsertDownloadTask({
              id: task.id,
              videoId: task.videoId ?? undefined,
              url: task.url ?? undefined,
              outputDir: task.outputDir ?? undefined,
              uniqueFilename: task.uniqueFilename ?? undefined,
              title: task.title,
              status: task.status,
              progress: task.progress,
              speed: task.speed,
              eta: task.eta,
              formatId: task.formatId,
              resolution: task.resolution,
              codecInfo: task.codecInfo,
              fileSize: task.fileSize,
              fps: task.fps ?? undefined,
              thumbnailUrl: task.thumbnailUrl,
            }),
          ),
        );
      } catch (error) {
        console.error("Failed to sync download tasks:", error);
      }
    };

    void persistTasks();
  }, [downloadTasks]);

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab as TabType);
  };

  const handleDownload = async () => {
    if (!urlInput.trim()) return;

    setIsFetchingMetadata(true);
    setShowConfigureModal(true);
    console.log("[DownloadsPage] Starting download, showing modal immediately");
    try {
      const loadedCookies = await loadCookies();

      let metadata;
      let formats: VideoFormat[];

      try {
        metadata = await getVideoMetadata(urlInput, loadedCookies);
        formats = await getVideoFormats(urlInput, loadedCookies);
      } catch (metadataError) {
        console.warn(
          "Failed to fetch full metadata, using fallback:",
          metadataError,
        );
        metadata = {
          id: urlInput,
          title: urlInput.split("/").pop() || "Unknown Video",
          channelName: "Unknown Channel",
          channel: "Unknown Channel",
          thumbnailUrl: "",
          duration: "",
          viewCount: 0,
          isDownloaded: false,
        };
        formats = [];
      }

      setConfigureMetadata({
        title: metadata.title,
        uploader: metadata.channelName || metadata.channel || "Unknown Channel",
        channel: metadata.channel || metadata.channelName || "Unknown Channel",
        thumbnail: metadata.thumbnailUrl || "",
        duration: metadata.duration || "",
        view_count: metadata.viewCount || 0,
        formats: formats,
      });
      setSelectedVideoId(metadata.id);
      setSelectedVideoUrl(urlInput);
      setUrlInput("");

      console.log("[DownloadsPage] Metadata fetched successfully");
    } catch (error) {
      console.error("Failed to fetch video info:", error);
      alert(
        t.downloadsPage.fetchFailed,
      );
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const formatFileSize = (bytes?: number): string | undefined => {
    if (!bytes || bytes === 0) return undefined;
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const getCodecInfo = (format?: any): string | undefined => {
    if (!format) return undefined;
    const ext = format.ext?.toUpperCase() || "";
    const codecs: string[] = [];
    if (format.vcodec && format.vcodec !== "none") {
      codecs.push(format.vcodec.split(".")[0]);
    }
    if (format.acodec && format.acodec !== "none") {
      codecs.push(format.acodec.split(".")[0]);
    }
    if (!ext && codecs.length === 0) return undefined;
    return codecs.length ? `${ext} (${codecs.join("+")})` : ext;
  };

  const getResolutionLabel = (format?: any): string | undefined => {
    if (!format) return undefined;
    if (format.height) {
      if (format.height >= 2160) return "4K";
      if (format.height >= 1440) return "2K";
      return `${format.height}p`;
    }
    return undefined;
  };

  const getFormatDetails = (formatId: string) => {
    const formats = (configureMetadata?.formats || []) as VideoFormat[];
    const directMatch = formats.find(
      (format) => format.formatId === formatId,
    );
    if (directMatch) {
      return {
        formatLabel: formatId,
        resolution: getResolutionLabel(directMatch),
        codecInfo: getCodecInfo(directMatch),
        fileSize: formatFileSize(
          directMatch.filesize || directMatch.filesize_approx,
        ),
        fps: directMatch.fps,
      };
    }

    if (formatId.includes("+")) {
      const [videoId, audioId] = formatId.split("+");
      const videoFormat = formats.find(
        (format) => format.formatId === videoId,
      );
      const audioFormat = formats.find(
        (format) => format.formatId === audioId,
      );
      return {
        formatLabel: formatId,
        resolution: getResolutionLabel(videoFormat),
        codecInfo: getCodecInfo({
          ...videoFormat,
          acodec: audioFormat?.acodec,
        }),
        fileSize: formatFileSize(
          ((videoFormat?.filesize || videoFormat?.filesize_approx || 0) +
            (audioFormat?.filesize || audioFormat?.filesize_approx || 0)) || undefined,
        ),
        fps: videoFormat?.fps,
      };
    }

    return {
      formatLabel: formatId,
    };
  };

  const handleConfiguredDownload = async (formatId: string) => {
    try {
      console.log("[DownloadsPage] Starting download with formatId:", formatId);
      const formatDetails = getFormatDetails(formatId);

      const existingSameTask = downloadTasks.find(
        (t) => t.videoId === selectedVideoId && t.formatId === formatId,
      );

      const alreadyDownloaded = downloadedVideos.some(
        (v) => v.id === selectedVideoId,
      );

      if (alreadyDownloaded) {
        const shouldRedownload = window.confirm(
          t.downloadsPage.alreadyDownloaded,
        );
        if (!shouldRedownload) {
          setShowConfigureModal(false);
          return;
        }
      }

      if (
        existingSameTask &&
        ["queued", "downloading", "paused"].includes(existingSameTask.status)
      ) {
        window.alert(
          t.downloadsPage.alreadyQueued,
        );
        setShowConfigureModal(false);
        return;
      }

      const existingTask = downloadTasks.find(
        (t) =>
          t.videoId === selectedVideoId &&
          t.formatId === formatId &&
          (t.status === "cancelled" || t.status === "error"),
      );

      let taskId: string;
      let isNewTask = false;

      if (existingTask) {
        taskId = existingTask.id;
        console.log(
          "[DownloadsPage] Found existing task, reusing:",
          existingTask,
        );
        const updatedTask = {
          ...existingTask,
          status: "queued" as const,
          progress: 0,
          speed: "0 MB/s",
          eta: "0:00",
        };
        setDownloadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t)),
        );
        await upsertDownloadTask(updatedTask);
        console.log("[DownloadsPage] Reusing existing task:", taskId);
      } else {
        taskId = Date.now().toString();
        isNewTask = true;
        console.log("[DownloadsPage] Creating new task:", taskId);
        const newTask: DownloadTask = {
          id: taskId,
          videoId: selectedVideoId,
          url: selectedVideoUrl,
          title: configureMetadata.title,
          formatId,
          ...formatDetails,
          progress: 0,
          status: "queued",
          speed: "0 MB/s",
          eta: "0:00",
          thumbnailUrl: configureMetadata.thumbnail,
        };
        setDownloadTasks((prev) => [...prev, newTask]);
        await upsertDownloadTask(newTask);
        console.log("[DownloadsPage] Added new task:", newTask);
      }

      setShowConfigureModal(false);

      console.log(
        "[DownloadsPage] Calling startDownloadTask with videoId:",
        selectedVideoId,
        "and formatId:",
        formatId,
      );
      await startDownloadTask(
        taskId,
        selectedVideoUrl,
        formatId,
        alreadyDownloaded,
      );
      console.log("[DownloadsPage] downloadVideo completed successfully");
    } catch (error) {
      console.error("Download failed:", error);
      alert(t.downloadsPage.downloadFailed);
    }
  };

  const handleDelete = (taskId: string) => {
    setDownloadTasks((prev) => prev.filter((t) => t.id !== taskId));
    void deleteDownloadTask(taskId);
  };

  const handlePause = async (taskId: string) => {
    setDownloadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "paused" } : t)),
    );
    try {
      await pauseDownloadTask(taskId);
    } catch (error) {
      console.error("Failed to pause task", error);
      void loadTasks();
    }
  };

  const handleResume = async (taskId: string) => {
    setDownloadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "queued" } : t)),
    );
    try {
      await resumeDownloadTask(taskId);
    } catch (error) {
      console.error("Failed to resume task", error);
      void loadTasks();
    }
  };

  const handleCancel = async (taskId: string) => {
    setDownloadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "cancelled" } : t)),
    );
    try {
      await cancelDownloadTask(taskId);
    } catch (error) {
      console.error("Failed to cancel task", error);
      void loadTasks();
    }
  };

  const handleOpenFolder = (videoId: string) => {
    console.log("Open folder for video:", videoId);
  };

  const handleShowInfo = (videoId: string) => {
    console.log("Show info for video:", videoId);
  };

  const handleDeleteDownloaded = (videoId: string) => {
    console.log("Delete downloaded video:", videoId);
  };

  const handleDeleteFromFile = (videoId: string) => {
    console.log("Delete from file:", videoId);
  };

  const handleRemoveFromList = (videoId: string) => {
    console.log("Remove from list:", videoId);
  };

  const handleRetry = (taskId: string) => {
    const task = downloadTasks.find((t) => t.id === taskId);
    if (!task?.videoId) return;
    console.log("Retry task:", taskId);
  };

  const getFilteredTasks = useCallback(() => {
    switch (selectedTab) {
      case "active":
        return downloadTasks.filter(
          (task) =>
            task.status === "downloading" || task.status === "queued"
        );
      case "paused":
        return downloadTasks.filter((task) => task.status === "paused");
      case "cancelled":
        return downloadTasks.filter((task) => task.status === "cancelled");
      case "downloaded":
        return downloadedVideos;
      default:
        return downloadTasks;
    }
  }, [selectedTab, downloadTasks, downloadedVideos]);

  const tabs = [
    { id: "active", label: t.downloadsPage.active ?? "Active" },
    { id: "paused", label: t.downloadsPage.paused ?? "Paused" },
    { id: "cancelled", label: "Cancelled" },
    { id: "downloaded", label: t.downloadsPage.downloaded ?? "Downloaded" },
  ];

  const taskLayoutClasses: Record<typeof taskLayout, string> = {
    list: "space-y-2 pb-2",
    "grid-2": "grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2",
    "grid-3": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-2",
    "grid-4": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 pb-2",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-foreground mb-0.5">
          {t.nav.downloads}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t.downloadsPage.subtitle}
        </p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-muted-foreground">
          Download Engine
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-secondary/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setDownloadEngine("ytdlp")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${downloadEngine === "ytdlp"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            yt-dlp
          </button>
          <button
            type="button"
            onClick={() => setDownloadEngine("aria2")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${downloadEngine === "aria2"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            aria2
          </button>
        </div>
      </div>

      {downloadEngine === "aria2" ? (
        <Aria2Page embedded />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-2xl font-semibold text-foreground mb-0.5">
                {
                  downloadTasks.filter(
                    (t) => t.status === "downloading" || t.status === "queued",
                  ).length
                }
              </div>
              <div className="text-xs text-muted-foreground">{t.downloadsPage.activeDownloads}</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-foreground mb-0.5">
                {downloadedVideos.length}
              </div>
              <div className="text-xs text-muted-foreground">{t.downloadsPage.completed}</div>
            </div>
          </div>

          {/* URL Input */}
          <div className="mb-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t.downloadsPage.urlPlaceholder}
                className="flex-1 px-4 py-2 rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                onKeyDown={(e) => e.key === "Enter" && handleDownload()}
              />
              <button
                onClick={handleDownload}
                disabled={isFetchingMetadata || !urlInput.trim()}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isFetchingMetadata ? (
                  <>
                    <HugeiconsIcon
                      icon={Refresh01Icon}
                      size={18}
                      className="animate-spin"
                    />
                    <span>{t.downloadsPage.fetching}</span>
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Download02Icon} size={18} />
                    <span>{t.common.download}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTaskLayout("list")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${taskLayout === "list"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  title="List view"
                >
                  1x1
                </button>
                <button
                  type="button"
                  onClick={() => setTaskLayout("grid-2")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${taskLayout === "grid-2"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  title="2x2 grid"
                >
                  2x2
                </button>
                <button
                  type="button"
                  onClick={() => setTaskLayout("grid-3")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${taskLayout === "grid-3"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  title="2x3 grid"
                >
                  3x3
                </button>
                <button
                  type="button"
                  onClick={() => setTaskLayout("grid-4")}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${taskLayout === "grid-4"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  title="3x3 grid"
                >
                  4x4
                </button>
              </div>
              {selectedTab === "downloaded" && (
                <button
                  onClick={() => void syncDownloadedVideos()}
                  className="p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
                  title={t.downloadsPage.refreshDownloaded}
                >
                  <HugeiconsIcon icon={Refresh01Icon} size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className={taskLayoutClasses[taskLayout]}>
              {getFilteredTasks().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                  <HugeiconsIcon
                    icon={Download02Icon}
                    size={48}
                    className="text-muted-foreground/30 mb-3"
                  />
                  <p className="text-sm font-medium text-foreground mb-1">
                    {selectedTab === "active" && t.downloadsPage.noActiveDownloads}
                    {selectedTab === "paused" && "No paused downloads"}
                    {selectedTab === "cancelled" && "No cancelled downloads"}
                    {selectedTab === "downloaded" && t.downloadsPage.noCompletedDownloads}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.downloadsPage.noDownloadsHint}
                  </p>
                </div>
              ) : (
                selectedTab === "downloaded" ? (
                  downloadedVideos.map((video) => (
                    <DownloadedVideoCard
                      key={video.id}
                      video={video}
                      onPlay={(video) => {
                        console.log("Play video:", video);
                      }}
                      onOpenFolder={handleOpenFolder}
                      onShowInfo={handleShowInfo}
                      onDelete={handleDeleteDownloaded}
                      onDeleteFromFile={handleDeleteFromFile}
                      onRemoveFromList={handleRemoveFromList}
                    />
                  ))
                ) : (
                  (getFilteredTasks() as DownloadTask[]).map((task) => (
                    <DownloadTaskCard
                      key={task.id}
                      task={task}
                      onDelete={handleDelete}
                      onPause={handlePause}
                      onResume={handleResume}
                      onCancel={handleCancel}
                    />
                  ))
                )
              )}
            </div>
          </div>

          {showConfigureModal && (
            <FormatSelector
              isOpen={showConfigureModal}
              metadata={configureMetadata}
              onDownload={handleConfiguredDownload}
              onClose={() => setShowConfigureModal(false)}
              isLoading={isFetchingMetadata}
            />
          )}
        </>
      )}
    </div>
  );
};
