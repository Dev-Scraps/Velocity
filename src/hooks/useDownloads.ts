import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Video } from '../types'

export interface DownloadItem {
  id: string
  title: string
  channel: string
  thumbnail_url: string
  progress: number
  status: 'pending' | 'downloading' | 'completed' | 'error'
  speed?: string
  eta?: string
  error?: string
}

export function useDownloads() {
  const [queue, setQueue] = useState<DownloadItem[]>([])
  const [loading, setLoading] = useState(false)
  const [cookies, setCookies] = useState<string | null>(null)

  useEffect(() => {
    // Load cookies on init - try backend first, then fallback to localStorage
    const loadCookies = async () => {
      try {
        console.log("[useDownloads] Loading cookies...")
        // Try to load from backend (database)
        const c = await invoke<string>('load_cookies')
        console.log("[useDownloads] Backend cookies:", c ? `found (${c.length} bytes)` : "not found")
        if (c && c.length > 0) {
          setCookies(c)
        } else {
          // Fallback to localStorage and save to database for next time
          console.log("[useDownloads] Backend empty, checking localStorage...")
          const selectedProfileId = localStorage.getItem('selectedCookieProfileId')
          console.log("[useDownloads] Selected profile ID:", selectedProfileId)
          if (selectedProfileId) {
            const profiles = JSON.parse(localStorage.getItem('cookieProfiles') || '[]')
            console.log("[useDownloads] Profiles in localStorage:", profiles.length)
            const selectedProfile = profiles.find((p: any) => p.id === selectedProfileId)
            console.log("[useDownloads] Selected profile:", selectedProfile ? selectedProfile.name : "not found")
            if (selectedProfile && selectedProfile.cookies) {
              console.log("[useDownloads] Found cookies in profile, saving to database...")
              // Save to database for persistence
              await invoke('save_cookies', { cookies: selectedProfile.cookies })
              console.log("[useDownloads] Cookies saved to database successfully")
              setCookies(selectedProfile.cookies)
            }
          }
        }
      } catch (e) {
        console.error('[useDownloads] Failed to load cookies:', e)
      }
    }
    loadCookies()

    // Listen for progress events from the backend
    const unlistenProgress = listen('progress', (event: any) => {
       const payload = event.payload as { progress: number, speed: string, eta: string, status: string }
       
       setQueue(currentQueue => {
         // Assuming single active download for now, update the 'downloading' item
         return currentQueue.map(item => {
           if (item.status === 'downloading') {
             return {
               ...item,
               progress: payload.progress,
               speed: payload.speed,
               eta: payload.eta,
               status: payload.progress >= 100 ? 'completed' : 'downloading'
             }
           }
           return item
         })
       })
    })

    return () => {
      unlistenProgress.then(f => f())
    }
  }, [])

  const addToQueue = async (video: Video) => {
    const newItem: DownloadItem = {
      id: video.id,
      title: video.title,
      channel: video.channel,
      thumbnail_url: video.thumbnail_url,
      progress: 0,
      status: 'pending'
    }

    setQueue(prev => [...prev, newItem])
    processQueue([...queue, newItem])
  }

  const processQueue = async (currentQueue: DownloadItem[]) => {
    const pendingItem = currentQueue.find(item => item.status === 'pending')
    
    // If there's a pending item and nothing is crucial downloading (simplification for now)
    if (pendingItem && !currentQueue.some(i => i.status === 'downloading')) {
       await startDownload(pendingItem)
    }
  }

  const startDownload = async (item: DownloadItem) => {
    setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'downloading' } : i))
    setLoading(true)
    
    try {
        // Default download path to creating a folder in User's Downloads for now
        // Ideally we pick this from settings
        const downloadDir = await invoke('get_download_history').then(() => "C:\\Users\\ABHISHEK SINGH\\Downloads\\velocity") // Placeholder
        
        // Ensure directory exists (this should be handled by backend or user selection, simpler to rely on python or tauri fs)
        // For now, let's pass a safe default path pattern
        // The python backend takes `output_path` template
        // We'll use a hardcoded safe path for testing first
        const downloadPath = `${downloadDir}\\${item.title}.%(ext)s`

        await invoke('download_video', {
            url: `https://www.youtube.com/watch?v=${item.id}`,
            outputPath: downloadPath,
            cookies: cookies
        })
        
        // Success handled by progress listener eventually reaching 100%
    } catch (error) {
        console.error("Download failed", error)
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: String(error) } : i))
    } finally {
        setLoading(false)
    }
  }

  return {
    queue,
    addToQueue,
    loading
  }
}
