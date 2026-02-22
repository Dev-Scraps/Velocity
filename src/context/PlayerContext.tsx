import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Video } from '../hooks/useRustCommands';
import { useSettings } from '../hooks/useSettings';
import { logger } from '../utils/logger';

export type StreamMode = "av" | "audio";

interface PlayerContextType {
    currentSong: Video | null;
    isPlaying: boolean;
    queue: Video[];
    currentSongIndex: number;
    streamMode: StreamMode;
    setIsPlaying: (playing: boolean) => void;
    setCurrentSong: (song: Video | null) => void;
    playSong: (song: Video) => void;
    playPlaylist: (videos: Video[], startIndex?: number) => void;
    playNext: () => void;
    playPrev: () => void;
    togglePlay: () => void;
    clearCurrentSong: () => void;
    setStreamMode: (mode: StreamMode) => void;
    playAudioOnly: (video: Video) => void;
    onSongEnd: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { getSettings, setSetting } = useSettings();
    const [currentSong, setCurrentSong] = useState<Video | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [queue, setQueue] = useState<Video[]>([]);
    const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
    const [streamMode, setStreamMode] = useState<StreamMode>("av");

    // Load stream mode preference on mount
    useEffect(() => {
        const loadStreamMode = async () => {
            try {
                const settings = await getSettings();
                setStreamMode(settings.audioOnlyMode ? "audio" : "av");
            } catch (err) {
                logger.warn("Failed to load stream mode preference", err);
            }
        };
        void loadStreamMode();
    }, [getSettings]);

    const handleSetStreamMode = useCallback(async (mode: StreamMode) => {
        setStreamMode(mode);
        try {
            await setSetting("audioOnlyMode", mode === "audio" ? "true" : "false");
        } catch (err) {
            logger.warn("Failed to save stream mode preference", err);
        }
    }, []);

    const playSong = useCallback((song: Video) => {
        handleSetStreamMode("av");
        setQueue([song]);
        setCurrentSongIndex(0);
        setCurrentSong(song);
        setIsPlaying(true);
    }, [handleSetStreamMode]);

    const playPlaylist = useCallback((videos: Video[], startIndex: number = 0) => {
        if (!videos || videos.length === 0) return;
        setQueue(videos);
        setCurrentSongIndex(startIndex);
        setCurrentSong(videos[startIndex]);
        setIsPlaying(true);
    }, []);

    const playNext = useCallback(() => {
        if (queue.length === 0) return;
        const nextIndex = currentSongIndex + 1;
        if (nextIndex < queue.length) {
            setCurrentSongIndex(nextIndex);
            setCurrentSong(queue[nextIndex]);
            setIsPlaying(true);
        } else {
            setIsPlaying(false);
        }
    }, [queue, currentSongIndex]);

    const playPrev = useCallback(() => {
        if (queue.length === 0) return;
        const prevIndex = currentSongIndex - 1;
        if (prevIndex >= 0) {
            setCurrentSongIndex(prevIndex);
            setCurrentSong(queue[prevIndex]);
            setIsPlaying(true);
        }
    }, [queue, currentSongIndex]);

    const togglePlay = useCallback(() => setIsPlaying(prev => !prev), []);

    const clearCurrentSong = useCallback(() => {
        setIsPlaying(false);
        setCurrentSong(null);
        setCurrentSongIndex(-1);
    }, []);

    const playAudioOnly = useCallback((song: Video) => {
        handleSetStreamMode("audio");
        setQueue([song]);
        setCurrentSongIndex(0);
        setCurrentSong(song);
        setIsPlaying(true);
    }, [handleSetStreamMode]);

    const onSongEnd = useCallback(() => {
        playNext();
    }, [playNext]);

    const value: PlayerContextType = {
        currentSong,
        isPlaying,
        queue,
        currentSongIndex,
        streamMode,
        setIsPlaying,
        setCurrentSong,
        playSong,
        playPlaylist,
        playNext,
        playPrev,
        togglePlay,
        clearCurrentSong,
        setStreamMode: handleSetStreamMode,
        playAudioOnly,
        onSongEnd,
    };

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
    const context = useContext(PlayerContext);
    if (context === undefined) {
        throw new Error('usePlayer must be used within a PlayerProvider');
    }
    return context;
};
