export interface Video {
  id: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: string;
  viewCount: number;
  uploadDate: string;
  url?: string;
  filePath?: string;
  isDownloaded: boolean;
  completionPercentage?: number;
}
