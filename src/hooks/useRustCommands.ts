import { invoke } from "@tauri-apps/api/core";

// Cookie Management
export const saveCookies = async (cookies: string): Promise<void> => {
  return invoke("save_cookies", { cookies });
};

// Download Tasks
export const getDownloadTasks = async (): Promise<DownloadTask[]> => {
  return invoke("get_download_tasks");
};

export const getDownloadedVideos = async (): Promise<Video[]> => {
  return invoke("get_downloaded_videos");
};

export const deleteDownloadedVideo = async (videoId: string): Promise<void> => {
  return invoke("delete_downloaded_video", { videoId });
};

export const removeDownloadedVideoFromList = async (
  videoId: string,
): Promise<void> => {
  return invoke("remove_downloaded_video_from_list", { videoId });
};

export const upsertDownloadTask = async (task: DownloadTask): Promise<void> => {
  await invoke("upsert_download_task", { task });
};

export const deleteDownloadTask = async (taskId: string): Promise<void> => {
  await invoke("delete_download_task", { taskId });
};

export const startDownloadTask = async (
  taskId: string,
  url: string,
  formatId?: string,
  uniqueFilename?: boolean,
): Promise<void> => {
  await invoke("start_download_task", {
    taskId,
    url,
    formatId,
    uniqueFilename,
  });
};

export const streamResolve = async (
  url: string,
  mode: StreamMode,
  cookies: string,
  quality?: string,
): Promise<StreamResolveResponse> => {
  return invoke("stream_resolve", {
    url,
    mode,
    cookies,
    quality,
  });
};

export const pauseDownloadTask = async (taskId: string): Promise<void> => {
  await invoke("pause_download_task", { taskId });
};

export const resumeDownloadTask = async (taskId: string): Promise<void> => {
  await invoke("resume_download_task", { taskId });
};

export const cancelDownloadTask = async (taskId: string): Promise<void> => {
  await invoke("cancel_download_task", { taskId });
};

export const loadCookies = async (): Promise<string> => {
  console.log("[useRustCommands] Loading cookies...");
  try {
    // First try to load from the Rust backend (persistent storage)
    try {
      console.log("[useRustCommands] Attempting to load from Rust backend...");
      const backendCookies = await invoke<string>("load_cookies");
      if (backendCookies && backendCookies.length > 0) {
        console.log(
          "[useRustCommands] Loaded cookies from backend, length:",
          backendCookies.length,
        );
        return backendCookies;
      }
    } catch (backendError) {
      const backendErrorMsg =
        backendError instanceof Error
          ? backendError.message
          : String(backendError);
      console.warn(
        "[useRustCommands] Failed to load from backend:",
        backendErrorMsg,
      );
    }

    // Check userSession in localStorage (single session storage)
    console.log("[useRustCommands] Checking userSession in localStorage...");
    const userSession = localStorage.getItem("userSession");
    if (userSession) {
      try {
        const parsed = JSON.parse(userSession) as { cookies?: string };
        if (parsed.cookies && parsed.cookies.length > 0) {
          console.log(
            "[useRustCommands] Found cookies in userSession, length:",
            parsed.cookies.length,
          );
          // Save to backend for persistence BEFORE returning
          try {
            await invoke("save_cookies", { cookies: parsed.cookies });
            console.log(
              "[useRustCommands] Saved userSession cookies to backend for persistence",
            );
          } catch (e) {
            console.warn("[useRustCommands] Could not save to backend:", e);
          }
          return parsed.cookies;
        }
      } catch (e) {
        console.error("[useRustCommands] Failed to parse userSession:", e);
      }
    }

    // Fallback to localStorage for profiles (legacy support)
    console.log("[useRustCommands] Trying localStorage profiles...");
    const selectedProfileId = localStorage.getItem("selectedCookieProfileId");
    console.log(
      "[useRustCommands] selectedCookieProfileId:",
      selectedProfileId,
    );

    if (selectedProfileId) {
      const profiles = JSON.parse(
        localStorage.getItem("cookieProfiles") || "[]",
      );
      console.log(
        "[useRustCommands] Found profiles in localStorage:",
        profiles.length,
      );
      const selectedProfile = profiles.find(
        (p: { id: string }) => p.id === selectedProfileId,
      );
      if (selectedProfile && selectedProfile.cookies) {
        console.log(
          "[useRustCommands] Loaded cookies from localStorage profile:",
          selectedProfile.name,
          "length:",
          selectedProfile.cookies.length,
        );
        // Save to backend for persistence BEFORE returning
        try {
          await invoke("save_cookies", { cookies: selectedProfile.cookies });
          console.log(
            "[useRustCommands] Saved profile cookies to backend for persistence",
          );
        } catch (e) {
          console.warn("[useRustCommands] Could not save to backend:", e);
        }
        return selectedProfile.cookies;
      } else {
        // Clear invalid selected profile ID
        localStorage.removeItem("selectedCookieProfileId");
        console.log(
          "[useRustCommands] Selected profile not found in localStorage",
        );
      }
    }

    // No cookies found
    console.log("[useRustCommands] No cookies found anywhere");
    return "";
  } catch (error) {
    console.error("[useRustCommands] Failed to load cookies:", error);
    throw error;
  }
};

export const validateCookies = async (cookies: string): Promise<boolean> => {
  console.log("[useRustCommands] Validating cookies...");
  try {
    const result = await invoke<boolean>("validate_cookies", { cookies });
    console.log("[useRustCommands] Validation result:", result);
    return result;
  } catch (error) {
    console.error("[useRustCommands] validateCookies error:", error);
    throw error;
  }
};

// Manual Cookie Import
export const importCookiesFromFile = async (): Promise<{
  success: boolean;
  message: string;
  count: number;
}> => {
  console.log("[useRustCommands] Opening file picker for cookie import...");
  try {
    const result = await invoke<{
      success: boolean;
      message: string;
      count: number;
    }>("import_cookies_from_file");
    console.log(
      "[useRustCommands] Cookies imported successfully, count:",
      result.count,
    );
    return result;
  } catch (error) {
    console.error("[useRustCommands] importCookiesFromFile error:", error);
    throw error;
  }
};

// Playlists - using yt-dlp for all playlist operations
export const getUserPlaylists = async (
  cookies: string,
): Promise<Playlist[]> => {
  console.log(
    "[useRustCommands] Calling getUserPlaylists with yt-dlp and cookies...",
  );
  try {
    const result = await invoke<{
      playlists: Playlist[];
      count: number;
      message: string;
      status: string;
    }>("get_user_playlists", { cookies });
    console.log("[useRustCommands] getUserPlaylists result:", result);
    console.log("[Sync Debug] Backend returned playlists:", result.playlists);
    return result.playlists; // Extract just the playlists array
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[useRustCommands] getUserPlaylists error:", errorMsg, error);
    console.error("[Sync Debug] getUserPlaylists failed with error:", error);
    throw error;
  }
};

export const getLikedVideosWithCookies = async (
  cookies: string,
): Promise<Video[]> => {
  console.log(
    "[useRustCommands] Calling getLikedVideosWithCookies with yt-dlp and cookies...",
  );
  try {
    const result = await invoke<Video[]>("get_liked_videos_with_cookies", {
      cookies,
    });
    console.log("[useRustCommands] getLikedVideosWithCookies result:", result);
    return result;
  } catch (error) {
    console.error("[useRustCommands] getLikedVideosWithCookies error:", error);
    throw error;
  }
};

export const getPlaylist = async (
  playlistId: string,
  cookies: string,
): Promise<Video[]> => {
  return invoke("get_playlist", {
    url: `https://www.youtube.com/playlist?list=${playlistId}`,
    cookies,
  });
};

export const getVideosByPlaylist = async (
  playlistId: string,
): Promise<Video[]> => {
  return invoke("get_videos_by_playlist", { playlistId });
};

// Videos - using yt-dlp for all video operations
export const getVideoMetadata = async (
  url: string,
  cookies?: string,
): Promise<VideoMetadata> => {
  try {
    const result = await invoke<VideoMetadata>("get_video_metadata", {
      url,
      cookies,
    });
    return result;
  } catch (error) {
    console.error("[useRustCommands] getVideoMetadata error:", error);
    throw error;
  }
};

export const searchVideos = async (query: string): Promise<Video[]> => {
  console.log("[useRustCommands] Calling searchVideos with yt-dlp...");
  try {
    const result = await invoke<Video[]>("search_videos", {
      query,
      maxResults: 20,
      cookies: "",
    });
    console.log("[useRustCommands] searchVideos result:", result);
    return result;
  } catch (error) {
    console.error("[useRustCommands] searchVideos error:", error);
    throw error;
  }
};

export const resolveStream = async (
  videoId: string,
  cookies: string,
): Promise<StreamInfo> => {
  return invoke("resolve_stream", {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    quality: "1080p",
    cookies,
  });
};

export const getVideoFormats = async (
  url: string,
  cookies: string,
): Promise<VideoFormat[]> => {
  console.log("[useRustCommands] Calling get_video_formats...");
  try {
    const result = await invoke<{ formats: VideoFormat[] }>("get_video_formats", {
      url,
      cookies,
    });
    console.log("[useRustCommands] get_video_formats result:", result);
    return result.formats; // Extract just the formats array
  } catch (error) {
    console.error("[useRustCommands] get_video_formats error:", error);
    throw error;
  }
};

// Downloads
export const downloadVideo = async (
  videoId: string,
  quality?: string,
  taskId?: string,
): Promise<void> => {
  console.log(
    "[useRustCommands] Calling downloadVideo with videoId:",
    videoId,
    "quality:",
    quality,
    "taskId:",
    taskId,
  );
  try {
    return invoke("download_video", {
      url: `https://www.youtube.com/watch?v=${videoId}`,
      outputPath: "%(title)s.%(ext)s",
      formatId: quality || "best",
      taskId,
    });
  } catch (error) {
    console.error("[useRustCommands] downloadVideo error:", error);
    throw error;
  }
};

// Download History
export const getDownloadHistory = async (): Promise<DownloadHistoryItem[]> => {
  return invoke("get_download_history");
};

export const addToHistory = async (
  item: DownloadHistoryItem,
): Promise<void> => {
  return invoke("add_to_history", { item });
};

export const clearHistory = async (): Promise<void> => {
  return invoke("clear_history");
};

// File Dialog
export const openFileDialog = async (): Promise<string | null> => {
  return invoke("open_file_dialog");
};

// Database Queries
export const getAllPlaylists = async (): Promise<Playlist[]> => {
  try {
    const result = await invoke<Playlist[]>("get_all_playlists");
    return result;
  } catch (error) {
    console.error("[useRustCommands] getAllPlaylists error:", error);
    throw error;
  }
};

export const getLikedVideos = async (): Promise<Video[]> => {
  try {
    const result = await invoke<Video[]>("get_liked_videos");
    return result;
  } catch (error) {
    console.error("[useRustCommands] getLikedVideos error:", error);
    throw error;
  }
};

export const getPlaylistVideos = async (
  playlistId: string,
): Promise<Video[]> => {
  try {
    const result = await invoke<Video[]>("get_playlist_videos", { playlistId });
    return result;
  } catch (error) {
    console.error("[useRustCommands] getPlaylistVideos error:", error);
    throw error;
  }
};

export const searchDatabaseVideos = async (query: string): Promise<Video[]> => {
  return invoke("search_database_videos", { query });
};

// Download Directory Management
export const getDownloadDirectory = async (): Promise<string> => {
  console.log("[useRustCommands] Calling getDownloadDirectory...");
  try {
    const result = await invoke<string>("get_download_directory");
    console.log("[useRustCommands] Download directory:", result);
    return result;
  } catch (error) {
    console.error("[useRustCommands] getDownloadDirectory error:", error);
    throw error;
  }
};

export const setDownloadDirectory = async (path: string): Promise<void> => {
  console.log("[useRustCommands] Calling setDownloadDirectory:", path);
  try {
    await invoke("set_download_directory", { path });
    console.log("[useRustCommands] Download directory set successfully");
  } catch (error) {
    console.error("[useRustCommands] setDownloadDirectory error:", error);
    throw error;
  }
};

export const openDownloadDirectory = async (): Promise<void> => {
  console.log("[useRustCommands] Calling openDownloadDirectory...");
  try {
    await invoke("open_download_directory");
    console.log("[useRustCommands] Download directory opened");
  } catch (error) {
    console.error("[useRustCommands] openDownloadDirectory error:", error);
    throw error;
  }
};

// Types
export interface Playlist {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  videoCount: number;
  uploader?: string;
  channel?: string;
  channelId?: string;
  viewCount?: number;
}

export interface Video {
  id: string;
  title: string;
  channelName?: string;
  channel?: string;
  thumbnailUrl?: string;
  duration?: string;
  viewCount?: number;
  uploadDate?: string;
  isDownloaded: boolean;
  isLiked?: boolean;
  completionPercentage?: number;
}

export interface StreamInfo {
  video_url: string;
  audio_url: string;
  subtitle_urls: string[];
  expiry: number;
}

export type StreamMode = "audio" | "av";

export interface SubtitleTrack {
  language: string;
  name?: string | null;
  url: string;
  ext?: string | null;
  automatic: boolean;
}

export interface AudioTrack {
  format_id: string;
  language?: string | null;
  name?: string | null;
  abr?: number | null;
  url: string;
  ext?: string | null;
  acodec?: string | null;
}

export interface StreamResolveResponse {
  video_url?: string | null;
  audio_url?: string | null;
  muxed_url?: string | null;
  subtitles: SubtitleTrack[];
  captions: SubtitleTrack[];
  audio_tracks: AudioTrack[];
  selected_format_id?: string | null;
  selected_video_format_id?: string | null;
  selected_audio_format_id?: string | null;
}

export interface DownloadHistoryItem {
  id: string;
  videoId: string;
  title: string;
  downloadDate: string;
  status: "completed" | "failed";
}

export interface DownloadTask {
  id: string;
  videoId?: string;
  url?: string;
  outputDir?: string;
  uniqueFilename?: boolean;
  title: string;
  status:
    | "pending"
    | "downloading"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled"
    | "queued"
    | "merging"
    | "extracting"
    | "retrying"
    | "error";
  progress: number;
  speed?: string;
  eta?: string;
  formatId?: string;
  resolution?: string;
  codecInfo?: string;
  fileSize?: number | string;
  fps?: number;
  thumbnailUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VideoMetadata {
  id: string;
  title: string;
  channelName?: string;
  channel?: string;
  thumbnailUrl?: string;
  duration?: string;
  viewCount?: number;
  uploadDate?: string;
  isDownloaded?: boolean;
}

export interface VideoFormat {
  formatId: string;
  extension: string;
  resolution?: string;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  quality?: string;
  formatNote?: string;
}

// ============================================================
// Website Cookies - Multi-site cookie storage
// ============================================================

export interface WebsiteCookie {
  id: string;
  name: string;
  websiteUrl: string;
  domainPattern: string;
  content: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const getWebsiteCookies = async (): Promise<WebsiteCookie[]> => {
  return invoke<WebsiteCookie[]>("get_website_cookies");
};

export const saveWebsiteCookie = async (
  name: string,
  websiteUrl: string,
  content: string,
  isDefault?: boolean,
  id?: string,
): Promise<WebsiteCookie> => {
  return invoke<WebsiteCookie>("save_website_cookie", {
    id,
    name,
    websiteUrl,
    content,
    isDefault,
  });
};

export const deleteWebsiteCookieById = async (id: string): Promise<void> => {
  return invoke("delete_website_cookie", { id });
};

export const getCookiesForUrl = async (url: string): Promise<WebsiteCookie | null> => {
  return invoke<WebsiteCookie | null>("get_cookies_for_url", { url });
};

export const setDefaultWebsiteCookie = async (
  id: string,
  domainPattern: string,
): Promise<void> => {
  return invoke("set_default_website_cookie", { id, domainPattern });
};

export const detectCookieDomains = async (content: string): Promise<string[]> => {
  return invoke<string[]>("detect_cookie_domains", { content });
};

