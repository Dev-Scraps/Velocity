// Type definitions for Settings and Download management

export interface DownloadHistoryItem {
  id: string;
  title: string;
  url: string;
  downloadPath: string;
  timestamp: number;
  duration: number;
  status: "success" | "failed" | "partial";
  fileSize?: number;
  format?: string;
  resolution?: string;
  codec?: string;
  error?: string;
}

export interface MetadataConfig {
  includeTitle: boolean;
  includeChannelName: boolean;
  includeDate: boolean;
  includeThumbnail: boolean;
  customFormat?: string;
}

export interface AppSettings {
  downloadDirectory: string;
  audioOnly: boolean;
  videoQuality: "best" | "1080p" | "720p" | "480p" | "360p";
  audioQuality: "best" | "320" | "256" | "192" | "128";
  autoSync: boolean;
  font: string;
  theme: "light" | "dark" | "system";
  primaryColor: string;
  enableNotifications: boolean;
  retryFailedDownloads: boolean;
  maxConcurrentDownloads: number;
}

export interface SettingsPageProps {
  playlists: Playlist[];
  downloadHistory: DownloadHistoryItem[];
}

export interface Playlist {
  id: string;
  title: string;
  videoCount: number;
  thumbnail?: string;
  description?: string;
}
