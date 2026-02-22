"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { logger } from "../utils/logger";
import {
  Download,
  Pause,
  Play,
  Square,
  Trash2,
} from "lucide-react";

interface Aria2Task {
  id: string;
  url: string;
  status: "downloading" | "paused" | "completed" | "error" | "cancelled";
  progress: number;
  speed?: string;
  eta?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  connections: number;
}

type TabType = "active" | "completed" | "cancelled";

export const Aria2Page = ({ embedded = false }: { embedded?: boolean }) => {
  const [url, setUrl] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [connections, setConnections] = useState(4);
  const [isDownloading, setIsDownloading] = useState(false);
  const [tasks, setTasks] = useState<Aria2Task[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabType>("active");
  const [taskLogs, setTaskLogs] = useState<Record<string, string[]>>({});
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [taskLayout, setTaskLayout] = useState<
    "list" | "grid-2" | "grid-3" | "grid-4"
  >("list");
  const [metadata, setMetadata] = useState<{
    url: string;
    filename?: string | null;
    content_type?: string | null;
    size_bytes?: number | null;
  } | null>(null);

  const pendingProgressRef = useRef<
    Map<string, { progress?: number; speed?: string; eta?: string }>
  >(new Map());
  const rafRef = useRef<number | null>(null);

  const loadDefaultDownloadDir = useCallback(async () => {
    try {
      const dir = await invoke<string>("get_download_directory");
      if (dir) {
        setOutputDir(dir);
      }
    } catch (error) {
      logger.error("Failed to load default download directory", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const handleFetchMetadata = async () => {
    if (!url.trim()) {
      logger.error("URL is required");
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const data = await invoke<{
        url: string;
        filename?: string | null;
        content_type?: string | null;
        size_bytes?: number | null;
      }>("aria2_fetch_metadata", { url });
      setMetadata(data);
      setShowDetailsModal(true);
    } catch (error) {
      logger.error("Failed to fetch aria2 metadata", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleStartDownload = async () => {
    if (!metadata?.url) {
      logger.error("Fetch metadata before downloading");
      return;
    }

    if (!outputDir.trim()) {
      logger.error("Output directory is required");
      return;
    }

    setIsDownloading(true);
    try {
      const id = await invoke<string>("aria2_start_download", {
        url: metadata.url,
        outputDir: outputDir,
        filename: metadata.filename ?? undefined,
        connections,
      });
      const newTask: Aria2Task = {
        id,
        url: metadata.url,
        status: "downloading",
        progress: 0,
        connections,
        speed: "0 MB/s",
        eta: "0:00",
      };
      setTasks((prev) => [...prev, newTask]);
      logger.info("Aria2 download started", { taskId: id });
      setMetadata(null);
      setShowDetailsModal(false);
      setUrl("");
    } catch (error) {
      logger.error("Failed to start aria2 download", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const handlePause = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "paused" } : t))
    );
  };

  const handleResume = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "downloading" } : t))
    );
  };

  const handleCancel = async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "cancelled" } : t))
    );
  };

  const handleDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const getFilteredTasks = useCallback(() => {
    switch (selectedTab) {
      case "active":
        return tasks.filter((t) => t.status === "downloading" || t.status === "paused");
      case "completed":
        return tasks.filter((t) => t.status === "completed");
      case "cancelled":
        return tasks.filter((t) => t.status === "cancelled");
      default:
        return tasks;
    }
  }, [selectedTab, tasks]);

  const tabs = [
    { id: "active", label: "Active" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const taskLayoutClasses: Record<typeof taskLayout, string> = {
    list: "space-y-2 pb-2",
    "grid-2": "grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2",
    "grid-3": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-2",
    "grid-4": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 pb-2",
  };

  useEffect(() => {
    void loadDefaultDownloadDir();

    const unlistenProgressPromise = listen("aria2_progress", (event) => {
      const payload = event.payload as {
        taskId?: string;
        progress?: number;
        speed?: string;
        eta?: string;
        downloadedBytes?: number;
        totalBytes?: number;
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

        setTasks((prev) => {
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
              status: task.status === "paused" ? "downloading" : task.status,
            };
            changed = true;
            return updatedTask;
          });
          return changed ? next : prev;
        });
      });
    });

    const unlistenStatusPromise = listen("aria2_status", (event) => {
      const payload = event.payload as {
        taskId?: string;
        status?: string;
      };
      if (!payload?.taskId || !payload?.status) return;

      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== payload.taskId) return task;
          return {
            ...task,
            status: payload.status as Aria2Task["status"],
          };
        })
      );
    });

    const unlistenLogPromise = listen("aria2_log", (event) => {
      const payload = event.payload as {
        taskId?: string;
        line?: string;
        level?: string;
      };
      if (!payload?.taskId || !payload?.line) return;
      const taskId = payload.taskId;
      const line = payload.line;
      setTaskLogs((prev) => {
        const existing = prev[taskId] ?? [];
        const next = [...existing, line].slice(-6);
        return {
          ...prev,
          [taskId]: next,
        };
      });
    });

    return () => {
      void unlistenProgressPromise.then((unlisten) => unlisten());
      void unlistenStatusPromise.then((unlisten) => unlisten());
      void unlistenLogPromise.then((unlisten) => unlisten());
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [loadDefaultDownloadDir]);

  return (
    <div className="flex flex-col h-full">
      {!embedded && (
        <div className="mb-3">
          <h1 className="text-xl font-semibold text-foreground mb-0.5">
            Aria2 Downloader
          </h1>
          <p className="text-xs text-muted-foreground">
            Multi-connection downloads with high-speed parallel connections
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-2xl font-semibold text-foreground mb-0.5">
            {tasks.filter((t) => t.status === "downloading").length}
          </div>
          <div className="text-xs text-muted-foreground">Active Downloads</div>
        </div>
        <div>
          <div className="text-2xl font-semibold text-foreground mb-0.5">
            {tasks.filter((t) => t.status === "completed").length}
          </div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </div>
      </div>

      {/* URL Input */}
      <div className="mb-3">
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/file.zip"
            className="flex-1 px-4 py-2 rounded-lg border border-border bg-transparent focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => e.key === "Enter" && handleFetchMetadata()}
          />
          <button
            onClick={handleFetchMetadata}
            disabled={isFetchingMetadata || !url.trim()}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={18} />
            <span>{isFetchingMetadata ? "Fetching..." : "Download"}</span>
          </button>
        </div>
      </div>
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl p-4 m-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-base font-semibold text-foreground">File details</div>
                <div className="text-xs text-muted-foreground">Review before downloading</div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-2 py-1 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div>
                <div className="uppercase tracking-wide text-[10px]">Filename</div>
                <div className="text-foreground mt-1 truncate">
                  {metadata?.filename || "Unknown"}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wide text-[10px]">Type</div>
                <div className="text-foreground mt-1">
                  {metadata?.content_type || "Unknown"}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wide text-[10px]">Size</div>
                <div className="text-foreground mt-1">
                  {formatFileSize(metadata?.size_bytes)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartDownload}
                disabled={isDownloading}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connections */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            Connections
            <span
              className="text-[11px] text-muted-foreground"
              title="Parallel connections per download. Higher can be faster but may stress servers."
            >
              (what is this?)
            </span>
          </label>
          <span className="text-sm font-semibold text-foreground">{connections}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-2 py-1">
          <button
            type="button"
            onClick={() => setConnections((prev) => Math.max(1, prev - 1))}
            disabled={isDownloading || connections <= 1}
            className="h-7 w-7 rounded-md border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            aria-label="Decrease connections"
            title="Decrease connections"
          >
            -
          </button>
          <span className="w-8 text-center text-sm font-medium text-foreground">
            {connections}
          </span>
          <button
            type="button"
            onClick={() => setConnections((prev) => Math.min(16, prev + 1))}
            disabled={isDownloading || connections >= 16}
            className="h-7 w-7 rounded-md border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            aria-label="Increase connections"
            title="Increase connections"
          >
            +
          </button>
          <span className="text-[11px] text-muted-foreground">1 - 16</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as TabType)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setTaskLayout("list")}
            className={`px-2 py-1 rounded-md font-medium transition-colors ${
              taskLayout === "list"
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
            className={`px-2 py-1 rounded-md font-medium transition-colors ${
              taskLayout === "grid-2"
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
            className={`px-2 py-1 rounded-md font-medium transition-colors ${
              taskLayout === "grid-3"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="3x3 grid"
          >
            3x3
          </button>
          <button
            type="button"
            onClick={() => setTaskLayout("grid-4")}
            className={`px-2 py-1 rounded-md font-medium transition-colors ${
              taskLayout === "grid-4"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="4x4 grid"
          >
            4x4
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={taskLayoutClasses[taskLayout]}>
          {getFilteredTasks().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
              <Download size={48}
                className="text-muted-foreground/30 mb-3"
              />
              <p className="text-sm font-medium text-foreground mb-1">
                {selectedTab === "active" && "No active downloads"}
                {selectedTab === "completed" && "No completed downloads"}
                {selectedTab === "cancelled" && "No cancelled downloads"}
              </p>
              <p className="text-xs text-muted-foreground">
                Start a download to see progress here
              </p>
            </div>
          ) : (
            getFilteredTasks().map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-border bg-card/60 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {task.url}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {task.status}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-2">
                    {task.status === "downloading" && (
                      <button
                        onClick={() => handlePause(task.id)}
                        className="p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
                        title="Pause"
                      >
                        <Pause size={16} />
                      </button>
                    )}
                    {task.status === "paused" && (
                      <button
                        onClick={() => handleResume(task.id)}
                        className="p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
                        title="Resume"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    {task.status === "downloading" || task.status === "paused" ? (
                      <button
                        onClick={() => handleCancel(task.id)}
                        className="p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
                        title="Cancel"
                      >
                        <Square size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {task.status === "downloading" && (
                  <>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{task.progress.toFixed(1)}%</span>
                      <span>{task.speed}</span>
                      <span>{task.eta}</span>
                    </div>
                  </>
                )}

                {(taskLogs[task.id]?.length ?? 0) > 0 && (
                  <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground space-y-1 max-h-48 overflow-auto font-mono">
                    {taskLogs[task.id].map((line, index) => (
                      <div key={`${task.id}-log-${index}`} className="truncate">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
