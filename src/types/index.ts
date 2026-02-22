export interface Video {
  id: string
  title: string
  channel: string
  duration: number
  thumbnail_url: string
  view_count: number
}

export interface Playlist {
  id: string
  title: string
  channel: string
  video_count: number
  thumbnail_url: string
  is_private: boolean
}

export interface DownloadProgress {
  videoId: string
  title: string
  progress: number
  speed: string
  status: 'downloading' | 'completed' | 'error'
}
