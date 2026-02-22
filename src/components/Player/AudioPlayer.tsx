"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import Hls from "hls.js";
import {
    PlayIcon,
    PauseIcon,
    PreviousIcon,
    NextIcon,
    VolumeHighIcon,
    VolumeLowIcon,
    VolumeMute01Icon,
    Image01Icon,
    Loading03Icon,
    RepeatIcon,
    GoForward10SecIcon,
    GoBackward10SecIcon,
    Cancel01Icon
} from "@hugeicons/core-free-icons";
import { Video, loadCookies, streamResolve, type AudioTrack, type StreamMode, type SubtitleTrack } from "../../hooks/useRustCommands";
import { logger } from "../../utils/logger";
import { useSettings } from "../../hooks/useSettings";

const isHlsSource = (url: string) => url.includes(".m3u8");

interface PlayerProps {
    currentSong: Video | null;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    playNext: () => void;
    playPrev: () => void;
    onSongEnd: () => void;
    onClose?: () => void;
}

export const Player = ({
    currentSong,
    isPlaying,
    setIsPlaying,
    playNext,
    playPrev,
    onSongEnd,
    onClose,
}: PlayerProps) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamMode, setStreamMode] = useState<StreamMode>("audio");
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
    const { getSettings, setSetting } = useSettings();
    const isHlsAudio = useMemo(() => Boolean(streamUrl && isHlsSource(streamUrl)), [streamUrl]);
    const abortControllerRef = useRef<AbortController | null>(null);
    
    // Cloudflare Worker proxy configuration
    const PROXY_BASE = 'https://velocity.wavesync.workers.dev/proxy?url=';
    const useProxy = false; // Proxy disabled: use direct URLs
    
    // Transform URL through proxy if enabled
    const getProxiedUrl = useCallback((url: string | null) => {
        if (!url || !useProxy) return url;
        return `${PROXY_BASE}${encodeURIComponent(url)}`;
    }, [useProxy]);

    useEffect(() => {
        const loadPlaybackMode = async () => {
            try {
                const settings = await getSettings();
                setStreamMode(settings.audioOnlyMode ? "audio" : "av");
            } catch (err) {
                logger.warn("Failed to load playback settings", err);
            }
        };

        void loadPlaybackMode();
    }, [getSettings]);

    // Load stream when song changes
    useEffect(() => {
        const fetchStream = async () => {
            if (!currentSong) return;

            // Cancel previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            const controller = new AbortController();
            abortControllerRef.current = controller;

            setIsLoading(true);
            setError(null);
            setStreamUrl(null);
            setAudioTracks([]);
            setSelectedAudioUrl(null);

            try {
                const cookies = await loadCookies();
                const info = await streamResolve(
                    `https://www.youtube.com/watch?v=${currentSong.id}`,
                    streamMode,
                    cookies,
                );
                logger.info("Stream resolved:", info);

                if (info && (info.audio_url || info.muxed_url || info.video_url)) {
                    const resolvedAudio = info.audio_url || info.muxed_url || info.video_url || null;
                    setStreamUrl(resolvedAudio);
                    setSelectedAudioUrl(resolvedAudio);
                    setAudioTracks(info.audio_tracks || []);
                } else {
                    logger.error("Stream info missing audio_url", info);
                    // Try video mode as fallback for audio-only streams
                    if (streamMode === "audio") {
                        logger.info("Attempting video mode fallback for audio-only stream");
                        // This will trigger a retry with video mode
                        setTimeout(() => {
                            setStreamMode("av");
                        }, 1000);
                        setError("Switching to video mode...");
                    } else {
                        setError("Failed to resolve audio stream. The video may be unavailable or region-restricted.");
                    }
                }
            } catch (err) {
                if (controller.signal.aborted) {
                    logger.info("Stream request aborted");
                    return;
                }
                logger.error("Error resolving stream:", err);
                setError("Error playing audio. Please try again.");
            } finally {
                setIsLoading(false);
                abortControllerRef.current = null;
            }
        };

        fetchStream();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [currentSong?.id, streamMode]);

    useEffect(() => {
        if (selectedAudioUrl && selectedAudioUrl !== streamUrl) {
            setStreamUrl(selectedAudioUrl);
        }
    }, [selectedAudioUrl, streamUrl]);

    // Handle Play/Pause
    useEffect(() => {
        const activeElement = audioRef.current;
        if (!activeElement) return;

        if (isPlaying) {
            const playPromise = activeElement.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    if (error.name !== 'AbortError') {
                        logger.error("Playback prevented:", error);
                        setIsPlaying(false);
                    }
                });
            }
        } else {
            activeElement.pause();
        }

        return () => {
            if (activeElement) {
                activeElement.pause();
            }
        };
    }, [isPlaying, streamUrl, setIsPlaying]);

    // Sync volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
            audioRef.current.muted = isMuted;
        }
    }, [volume, isMuted]);

    const handleTimeUpdate = () => {
        const activeElement = audioRef.current;
        if (activeElement) {
            setCurrentTime(activeElement.currentTime);
            setDuration(activeElement.duration || 0);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        const activeElement = audioRef.current;
        if (activeElement) {
            activeElement.currentTime = time;
        }
    };

    const handleSkip = (delta: number) => {
        const activeElement = audioRef.current;
        if (!activeElement) return;
        const nextTime = Math.min(
            Math.max(activeElement.currentTime + delta, 0),
            activeElement.duration || activeElement.currentTime + delta,
        );
        activeElement.currentTime = nextTime;
        setCurrentTime(nextTime);
    };

    useEffect(() => {
        const activeElement = audioRef.current;
        const sourceUrl = getProxiedUrl(streamUrl);

        if (!activeElement || !sourceUrl || !isHlsSource(sourceUrl)) {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            return;
        }

        if (Hls.isSupported()) {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
            const hls = new Hls({
                enableWorker: true,
                xhrSetup: (xhr, url) => {
                    xhr.withCredentials = false;
                    // Apply proxy to all HLS segment requests
                    if (useProxy && !url.includes('velocity.wavesync.workers.dev')) {
                        const proxiedUrl = getProxiedUrl(url);
                        if (proxiedUrl) {
                            xhr.open('GET', proxiedUrl, true);
                        }
                    }
                },
            });
            hls.loadSource(sourceUrl);
            hls.attachMedia(activeElement);
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            logger.error("HLS network error:", data);
                            // Try multiple fallback strategies
                            if (streamUrl) {
                                // Strategy 1: Try without proxy if proxy failed
                                if (useProxy) {
                                    logger.info("Attempting fallback without proxy");
                                    const hlsWithoutProxy = new Hls({
                                        enableWorker: true,
                                        xhrSetup: (xhr, url) => {
                                            xhr.withCredentials = false;
                                            // Don't use proxy for fallback
                                            if (url.includes('velocity.wavesync.workers.dev')) {
                                                // Extract original URL from proxy URL
                                                const originalUrl = new URL(url).searchParams.get('url');
                                                if (originalUrl) {
                                                    xhr.open('GET', originalUrl, true);
                                                }
                                            }
                                        },
                                    });
                                    hlsWithoutProxy.loadSource(streamUrl);
                                    hlsWithoutProxy.attachMedia(activeElement);
                                    hlsRef.current = hlsWithoutProxy;
                                    return;
                                }
                                
                                // Strategy 2: Try direct audio URL from HLS manifest
                                if (streamUrl.includes('.m3u8')) {
                                    const directUrl = streamUrl.replace('/playlist/index.m3u8', '');
                                    logger.info("Attempting fallback to direct URL:", directUrl);
                                    if (activeElement instanceof HTMLMediaElement) {
                                        const proxiedDirectUrl = useProxy ? getProxiedUrl(directUrl) : directUrl;
                                        if (proxiedDirectUrl) {
                                            activeElement.src = proxiedDirectUrl;
                                            return;
                                        }
                                    }
                                }
                            }
                            setError("Network error loading stream. Please try again.");
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            logger.error("HLS media error:", data);
                            hls.recoverMediaError();
                            break;
                        default:
                            logger.error("HLS fatal error:", data);
                            hls.destroy();
                            break;
                    }
                }
            });
            hlsRef.current = hls;
        } else if (activeElement instanceof HTMLMediaElement && sourceUrl) {
            activeElement.src = sourceUrl;
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamMode, streamUrl, isHlsAudio, getProxiedUrl, useProxy]);

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    if (!currentSong) return null;

    return (
        <div className="border border-border bg-card/95 backdrop-blur-xl shadow-[0_-10px_30px_rgba(15,23,42,0.25)] rounded-lg">
            <div className="relative flex items-center gap-4 px-4 py-3">
            {/* Hidden Audio Element */}
            <audio
                ref={audioRef}
                src={isHlsAudio ? undefined : streamUrl || undefined}
                onTimeUpdate={handleTimeUpdate}
                onEnded={onSongEnd}
                onLoadedMetadata={handleTimeUpdate}
                loop={isLooping}
                onError={(e) => {
                    logger.error("Audio playback error:", e);
                    setError("Playback error");
                    setIsPlaying(false);
                }}
            />

            {/* Track Info */}
            <div className="flex items-center gap-3 w-[28%] min-w-0">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                    {currentSong.thumbnailUrl ? (
                        <img
                            src={currentSong.thumbnailUrl}
                            alt={currentSong.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <HugeiconsIcon icon={Image01Icon} size={20} className="text-muted-foreground" />
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium truncate text-foreground">
                        {currentSong.title}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                        {currentSong.channelName || "Unknown Artist"}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center flex-1 max-w-[44%] gap-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleSkip(-10)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2"
                        title="Back 10s"
                    >
                        <HugeiconsIcon icon={GoBackward10SecIcon} size={18} />
                    </button>
                    <button
                        onClick={playPrev}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2"
                    >
                        <HugeiconsIcon icon={PreviousIcon} size={20} />
                    </button>

                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        disabled={isLoading || !!error}
                        className="text-foreground hover:text-muted-foreground transition-colors p-3 rounded-full bg-primary hover:bg-primary/90 shadow-lg"
                    >
                        {isLoading ? (
                            <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin" />
                        ) : isPlaying ? (
                            <HugeiconsIcon icon={PauseIcon} size={24} />
                        ) : (
                            <HugeiconsIcon icon={PlayIcon} size={24} />
                        )}
                    </button>

                    <button
                        onClick={playNext}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2"
                    >
                        <HugeiconsIcon icon={NextIcon} size={20} />
                    </button>
                    <button
                        onClick={() => handleSkip(10)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2"
                        title="Forward 10s"
                    >
                        <HugeiconsIcon icon={GoForward10SecIcon} size={18} />
                    </button>
                </div>
                <div className="flex items-center gap-2 w-full">
                    <span className="text-[10px] text-muted-foreground w-8 font-mono">
                        {formatTime(currentTime)}
                    </span>
                    <div className="flex-1 h-1 bg-secondary rounded-full relative overflow-hidden">
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div
                            className="absolute left-0 top-0 h-full bg-primary rounded-full"
                            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 font-mono">
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            {/* Volume & Extras */}
            <div className="flex items-center justify-end gap-3 w-[28%] min-w-0">
                <button
                    onClick={() => setIsLooping((prev) => !prev)}
                    className={`p-2 rounded-full border border-border/60 transition-colors ${isLooping ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    title={isLooping ? "Loop on" : "Loop off"}
                    type="button"
                >
                    <HugeiconsIcon icon={RepeatIcon} size={18} />
                </button>
                <div className="hidden lg:flex flex-col gap-1 text-[10px] text-muted-foreground">
                    {audioTracks.length > 0 && (
                        <label className="flex items-center gap-1">
                            <span className="whitespace-nowrap">Audio</span>
                            <select
                                value={selectedAudioUrl || ""}
                                onChange={(e) => setSelectedAudioUrl(e.target.value || null)}
                                className="rounded-md border border-border bg-secondary/60 px-1 py-0.5 text-[10px]"
                            >
                                {audioTracks.map((track) => (
                                    <option key={track.format_id} value={track.url}>
                                        {track.name || track.language || track.format_id}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>
                <div className="flex items-center gap-2 group">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-full border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                            title="Close"
                        >
                            <HugeiconsIcon icon={Cancel01Icon} size={16} />
                        </button>
                    )}
                    <button onClick={() => setIsMuted(!isMuted)}>
                        <HugeiconsIcon
                            icon={isMuted || volume === 0 ? VolumeMute01Icon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon}
                            size={18}
                            className="text-muted-foreground"
                        />
                    </button>
                    <div className="w-20 h-1 bg-secondary rounded-full relative overflow-hidden">
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={isMuted ? 0 : volume}
                            onChange={(e) => {
                                setVolume(parseFloat(e.target.value));
                                setIsMuted(false);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div
                            className="absolute left-0 top-0 h-full bg-primary rounded-full"
                            style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};
