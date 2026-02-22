import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Playlist, Video } from '../hooks/useRustCommands';
import {
    getAllPlaylists,
    getUserPlaylists,
    getPlaylist,
    getVideosByPlaylist,
    loadCookies
} from '../hooks/useRustCommands';
import { logger } from '../utils/logger';

interface LoadingStates {
    playlistsLoading: boolean;
    videosLoading: boolean;
    syncing: boolean;
}

interface SyncProgress {
    isOpen: boolean;
    stage: "discovering" | "fetching_playlists" | "fetching_videos" | "complete";
    currentPlaylist?: string;
    foundCount?: number;
    totalVideos?: number | null;
    fetchedVideos?: number;
    totalPlaylists?: number;
    processedPlaylists?: number;
}

interface LibraryContextType {
    playlists: Playlist[];
    selectedPlaylist: Playlist | null;
    playlistVideos: Video[];
    loading: LoadingStates;
    syncProgress: SyncProgress;
    syncLibrary: () => Promise<void>;
    loadLocalPlaylists: () => Promise<void>;
    loadPlaylistVideos: (playlist: Playlist) => Promise<void>;
    clearSelectedPlaylist: () => void;
    closeSyncProgress: () => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
    const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState<LoadingStates>({
        playlistsLoading: false,
        videosLoading: false,
        syncing: false,
    });
    const [syncProgress, setSyncProgress] = useState<SyncProgress>({
        isOpen: false,
        stage: "discovering",
    });

    const loadLocalPlaylists = useCallback(async () => {
        setLoading(prev => ({ ...prev, playlistsLoading: true }));
        logger.debug("Loading playlists from local database...");
        try {
            const localPlaylists = await getAllPlaylists();
            setPlaylists(localPlaylists);
        } catch (error) {
            logger.error("Failed to load local playlists:", error);
        } finally {
            setLoading(prev => ({ ...prev, playlistsLoading: false }));
        }
    }, []);

    useEffect(() => {
        void loadLocalPlaylists();
    }, [loadLocalPlaylists]);

    const syncLibrary = async () => {
        setLoading(prev => ({ ...prev, syncing: true }));
        setSyncProgress({ isOpen: true, stage: "discovering" });
        try {
            const cookies = await loadCookies();
            if (!cookies || cookies.length === 0) {
                logger.error("No cookies found for sync");
                setSyncProgress(prev => ({ ...prev, stage: "complete", isOpen: false }));
                setLoading(prev => ({ ...prev, syncing: false }));
                return;
            }

            setSyncProgress(prev => ({ ...prev, stage: "fetching_playlists" }));
            const youtubePlaylists = await getUserPlaylists(cookies);
            setPlaylists(youtubePlaylists);

            let totalVideos = youtubePlaylists.reduce((acc, pl) => acc + (pl.videoCount || 0), 0);
            setSyncProgress(prev => ({
                ...prev,
                foundCount: youtubePlaylists.length,
                totalPlaylists: youtubePlaylists.length,
                processedPlaylists: 0,
                totalVideos: totalVideos || null,
            }));

            let fetchedVideos = 0;
            for (let index = 0; index < youtubePlaylists.length; index++) {
                const pl = youtubePlaylists[index];
                try {
                    setSyncProgress(prev => ({
                        ...prev,
                        stage: "fetching_videos",
                        currentPlaylist: pl.title || pl.id,
                        fetchedVideos,
                        processedPlaylists: index,
                    }));
                    const videos = await getPlaylist(pl.id, cookies);
                    fetchedVideos += videos.length;
                    setSyncProgress(prev => ({ ...prev, fetchedVideos, processedPlaylists: index + 1 }));
                } catch (error) {
                    logger.warn("Prefetch failed for playlist:", pl.id, error);
                }
            }

            setSyncProgress(prev => ({ ...prev, stage: "complete" }));
            await loadLocalPlaylists();
            setTimeout(() => setSyncProgress(prev => ({ ...prev, isOpen: false })), 3000);
        } catch (error) {
            logger.error("Sync failed:", error);
            setSyncProgress(prev => ({ ...prev, isOpen: false }));
        } finally {
            setLoading(prev => ({ ...prev, syncing: false }));
        }
    };

    const loadPlaylistVideos = async (playlist: Playlist) => {
        setLoading(prev => ({ ...prev, videosLoading: true }));
        setSelectedPlaylist(playlist);
        setPlaylistVideos([]);
        try {
            const cached = await getVideosByPlaylist(playlist.id);
            if (cached && cached.length > 0) {
                setPlaylistVideos(cached);
                return;
            }
            const cookies = await loadCookies();
            const videos = await getPlaylist(playlist.id, cookies);
            setPlaylistVideos(videos);
        } catch (error) {
            logger.error("Failed to load playlist videos:", error);
        } finally {
            setLoading(prev => ({ ...prev, videosLoading: false }));
        }
    };

    const clearSelectedPlaylist = useCallback(() => {
        setSelectedPlaylist(null);
        setPlaylistVideos([]);
    }, []);

    const closeSyncProgress = useCallback(() => {
        setSyncProgress(prev => ({ ...prev, isOpen: false }));
    }, []);

    const value: LibraryContextType = {
        playlists,
        selectedPlaylist,
        playlistVideos,
        loading,
        syncProgress,
        syncLibrary,
        loadLocalPlaylists,
        loadPlaylistVideos,
        clearSelectedPlaylist,
        closeSyncProgress,
    };

    return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useLibrary = () => {
    const context = useContext(LibraryContext);
    if (context === undefined) {
        throw new Error('useLibrary must be used within a LibraryProvider');
    }
    return context;
};
