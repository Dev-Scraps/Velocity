import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Playlist, Video } from '../hooks/useRustCommands'
import type { DownloadProgress } from '../types'

interface PlaylistsContextType {
    playlists: Playlist[]
    videos: Video[]
    selectedVideos: Set<string>
    loading: boolean
    error: string | null
    downloadProgress: DownloadProgress[]
    fetchUserPlaylists: (userCookies: string) => Promise<void>
    fetchPlaylist: (playlistUrl: string) => Promise<void>
    fetchLocalPlaylists: () => Promise<void>
    toggleVideoSelection: (videoId: string) => void
    downloadVideos: () => Promise<void>
    setPlaylists: (playlists: Playlist[]) => void
    setError: (error: string | null) => void
    setDownloadProgress: (progress: DownloadProgress[] | ((prev: DownloadProgress[]) => DownloadProgress[])) => void
}

const PlaylistsContext = createContext<PlaylistsContextType | undefined>(undefined)

export function PlaylistsProvider({ children }: { children: ReactNode }) {
    const [playlists, setPlaylists] = useState<Playlist[]>([])
    const [videos, setVideos] = useState<Video[]>([])
    const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress[]>([])

    const fetchUserPlaylists = async (userCookies: string) => {
        try {
            setLoading(true)
            setError(null)

            const result = await invoke('get_user_playlists', {
                cookies: userCookies
            })

            const fetchedPlaylists = result as Playlist[]
            setPlaylists(fetchedPlaylists)

            if (fetchedPlaylists.length === 0) {
                setError('No playlists found. Make sure your cookies are valid and you have saved playlists.')
            }
        } catch (err) {
            const errorMsg = err as string
            console.error('Failed to fetch playlists:', err)
            setError(`Failed to fetch playlists: ${errorMsg}`)
        } finally {
            setLoading(false)
        }
    }

    const fetchLocalPlaylists = async () => {
        try {
            setLoading(true)
            setError(null)

            const result = await invoke('get_all_playlists')
            const fetchedPlaylists = result as Playlist[]
            setPlaylists(fetchedPlaylists)

            if (fetchedPlaylists.length === 0) {
                setError('No playlists found in local database.')
            }
        } catch (err) {
            const errorMsg = err as string
            console.error('Failed to fetch local playlists:', err)
            setError(`Failed to fetch local playlists: ${errorMsg}`)
        } finally {
            setLoading(false)
        }
    }

    const fetchPlaylist = async (playlistUrl: string) => {
        if (!playlistUrl.trim()) return

        setLoading(true)
        setError(null)

        try {
            const result = await invoke('get_playlist', { url: playlistUrl, cookies: null })
            setVideos(result as Video[])
            setSelectedVideos(new Set())
        } catch (err) {
            setError(err as string)
        } finally {
            setLoading(false)
        }
    }

    const toggleVideoSelection = (videoId: string) => {
        const newSelected = new Set(selectedVideos)
        if (newSelected.has(videoId)) {
            newSelected.delete(videoId)
        } else {
            newSelected.add(videoId)
        }
        setSelectedVideos(newSelected)
    }

    const downloadVideos = async () => {
        if (selectedVideos.size === 0) return

        const selectedVideosList = videos.filter(v => selectedVideos.has(v.id))

        for (const video of selectedVideosList) {
            try {
                setDownloadProgress(prev => [...prev, {
                    videoId: video.id,
                    title: video.title,
                    progress: 0,
                    speed: '',
                    status: 'downloading'
                }])

                await invoke('download_video', {
                    url: `https://www.youtube.com/watch?v=${video.id}`,
                    // cookies are handled by backend global state or passed if needed. 
                    // ideally backend uses stored cookies.
                })

                setDownloadProgress(prev => prev.map(p =>
                    p.videoId === video.id
                        ? { ...p, progress: 100, status: 'completed' }
                        : p
                ))
            } catch (err) {
                console.error("Download failed", err)
                setDownloadProgress(prev => prev.map(p =>
                    p.videoId === video.id
                        ? { ...p, status: 'error' }
                        : p
                ))
            }
        }
    }

    return (
        <PlaylistsContext.Provider value={{
            playlists,
            videos,
            selectedVideos,
            loading,
            error,
            downloadProgress,
            fetchUserPlaylists,
            fetchPlaylist,
            fetchLocalPlaylists,
            toggleVideoSelection,
            downloadVideos,
            setPlaylists,
            setError,
            setDownloadProgress
        }}>
            {children}
        </PlaylistsContext.Provider>
    )
}

export function usePlaylists() {
    const context = useContext(PlaylistsContext)
    if (context === undefined) {
        throw new Error('usePlaylists must be used within a PlaylistsProvider')
    }
    return context
}
