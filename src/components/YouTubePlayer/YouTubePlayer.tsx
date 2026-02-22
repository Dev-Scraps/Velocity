"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Video, loadCookies, streamResolve, resolveStream, getVideoFormats, type AudioTrack, type StreamMode, type SubtitleTrack, type VideoFormat } from "../../hooks/useRustCommands";
import { logger } from "../../utils/logger";
import { useSettings } from "../../hooks/useSettings";
import { TopBar } from "./TopBar";
import { BottomControls } from "./BottomControls";
import { AudioPanel } from "./AudioPanel";
import { CaptionsPanel } from "./CaptionsPanel";
import { QualityPanel } from "./QualityPanel";
import { SettingsPanel } from "./SettingsPanel";
import { SpeedPanel } from "./SpeedPanel";

interface YouTubePlayerProps {
  currentSong: Video | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playNext: () => void;
  playPrev: () => void;
  onSongEnd: () => void;
  onBack?: () => void;
  showTopBar?: boolean;
  streamMode?: StreamMode;
  setStreamMode?: (mode: StreamMode) => void;
}

const isHlsSource = (url: string) => url.includes(".m3u8");

const formatTime = (time: number) => {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const YouTubePlayer = ({
  currentSong,
  isPlaying,
  setIsPlaying,
  playNext,
  playPrev,
  onSongEnd,
  onBack,
  showTopBar = true,
  streamMode = "av",
  setStreamMode,
}: YouTubePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [captionTracks, setCaptionTracks] = useState<SubtitleTrack[]>([]);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
  const [selectedCaptionUrl, setSelectedCaptionUrl] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [activePanel, setActivePanel] = useState<"audio" | "captions" | "quality" | "settings" | "speed" | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedQualityUrl, setSelectedQualityUrl] = useState<string | null>(null);
  const [videoFormats, setVideoFormats] = useState<VideoFormat[]>([]);
  const { getSettings, setSetting } = useSettings();
  const isStreamLoadingRef = useRef(false);
  const isHlsAudio = useMemo(() => Boolean(streamUrl && isHlsSource(streamUrl)), [streamUrl]);
  const isHlsVideo = useMemo(() => Boolean(videoStreamUrl && isHlsSource(videoStreamUrl)), [videoStreamUrl]);

  useEffect(() => {
    const fetchStream = async () => {
      if (!currentSong) return;

      setIsLoading(true);
      isStreamLoadingRef.current = true;
      setError(null);
      setStreamUrl(null);
      setVideoStreamUrl(null);
      setAudioTracks([]);
      setSubtitleTracks([]);
      setCaptionTracks([]);
      setSelectedAudioUrl(null);
      setSelectedCaptionUrl(null);

      try {
        const cookies = await loadCookies();
        const info = await streamResolve(
          `https://www.youtube.com/watch?v=${currentSong.id}`,
          streamMode,
          cookies,
        );
        logger.info("Stream resolved:", info);

        if (info && (info.audio_url || info.video_url || info.muxed_url)) {
          const resolvedAudio = info.audio_url || info.muxed_url || info.video_url || null;
          const resolvedVideo = info.muxed_url || info.video_url || null;
          setStreamUrl(resolvedAudio);
          setSelectedAudioUrl(resolvedAudio);
          setVideoStreamUrl(resolvedVideo);
          setAudioTracks(info.audio_tracks || []);
          setSubtitleTracks(info.subtitles || []);
          setCaptionTracks(info.captions || []);
          const firstCaption = info.subtitles?.[0]?.url || info.captions?.[0]?.url || null;
          setSelectedCaptionUrl(firstCaption);

          // Fetch video formats for quality options
          try {
            const formats = await getVideoFormats(
              `https://www.youtube.com/watch?v=${currentSong.id}`,
              cookies,
            );
            logger.info("Video formats:", formats);
            setVideoFormats(formats);
          } catch (formatErr) {
            logger.warn("Failed to fetch video formats:", formatErr);
          }
        } else {
          logger.error("Stream info missing video_url", info);
          setError("Failed to resolve audio stream");
        }
      } catch (err) {
        logger.error("Error resolving stream:", err);
        setError("Error playing video");
      } finally {
        setIsLoading(false);
        isStreamLoadingRef.current = false;
      }
    };

    void fetchStream();
  }, [currentSong?.id, streamMode]);

  useEffect(() => {
    if (selectedAudioUrl && selectedAudioUrl !== streamUrl) {
      setStreamUrl(selectedAudioUrl);
    }
  }, [selectedAudioUrl, streamUrl]);

  useEffect(() => {
    const activeElement = streamMode === "audio"
      ? (isHlsAudio ? videoRef.current : audioRef.current)
      : videoRef.current;
    if (activeElement) {
      activeElement.playbackRate = playbackRate;
    }
  }, [playbackRate, streamMode, isHlsAudio]);

  useEffect(() => {
    const activeElement = streamMode === "audio"
      ? (isHlsAudio ? videoRef.current : audioRef.current)
      : videoRef.current;
    if (!activeElement) return;

    // Don't attempt playback if stream is loading
    if (isStreamLoadingRef.current) return;

    if (isPlaying) {
      const playPromise = activeElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((playError) => {
          logger.error("Playback prevented:", playError);
          setIsPlaying(false);
        });
      }
    } else {
      activeElement.pause();
    }
  }, [isPlaying, streamUrl, videoStreamUrl, setIsPlaying, streamMode, isHlsAudio]);

  useEffect(() => {
    const activeElement = streamMode === "audio"
      ? (isHlsAudio ? videoRef.current : audioRef.current)
      : videoRef.current;
    if (activeElement) {
      activeElement.playbackRate = playbackRate;
    }
  }, [playbackRate, streamMode, isHlsAudio]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const activeElement = streamMode === "audio"
      ? (isHlsAudio ? videoRef.current : audioRef.current)
      : videoRef.current;
    const sourceUrl = streamMode === "audio" ? streamUrl : videoStreamUrl;

    if (!activeElement || !sourceUrl || !isHlsSource(sourceUrl)) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return undefined;
    }

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 600,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: Infinity,
        preferManagedMediaSource: true,
        fetchSetup: (context, init) => {
          const url = context.url;
          if (url.includes("manifest.googlevideo.com")) {
            context.url = url.replace(
              "https://manifest.googlevideo.com",
              "http://localhost:5173",
            );
          } else if (url.includes("videoplayback") && url.includes("googlevideo.com")) {
            context.url = url.replace(
              /https:\/\/[\w.-]*\.googlevideo\.com/,
              "http://localhost:5173",
            );
          }
          return new Request(context.url, init);
        },
        xhrSetup: (xhr, url) => {
          // Rewrite Google Video CDN URLs to use proxy
          if (url.includes('manifest.googlevideo.com')) {
            const proxyUrl = url.replace('https://manifest.googlevideo.com', 'http://localhost:5173');
            xhr.open('GET', proxyUrl, true);
          } else if (url.includes('videoplayback') && url.includes('googlevideo.com')) {
            // Handle all videoplayback URLs from any Google Video CDN subdomain
            const proxyUrl = url.replace(/https:\/\/[\w.-]*\.googlevideo\.com/, 'http://localhost:5173');
            xhr.open('GET', proxyUrl, true);
          }
        },
      });
      hls.loadSource(sourceUrl);
      hls.attachMedia(activeElement);
      hlsRef.current = hls;
    } else if (activeElement instanceof HTMLMediaElement) {
      activeElement.src = sourceUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamMode, streamUrl, videoStreamUrl, isHlsAudio, isHlsVideo]);

  useEffect(() => {
    if (streamMode === "av") {
      setSelectedQualityUrl(videoStreamUrl || null);
    }
  }, [streamMode, videoStreamUrl]);

  // Fetch stream when quality is selected
  useEffect(() => {
    const fetchStreamWithQuality = async () => {
      if (!currentSong || !selectedQualityUrl) return;
      
      // Only fetch if selectedQualityUrl is a formatId (not the current videoStreamUrl)
      if (selectedQualityUrl === videoStreamUrl) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const cookies = await loadCookies();
        const info = await streamResolve(
          `https://www.youtube.com/watch?v=${currentSong.id}`,
          streamMode,
          cookies,
          selectedQualityUrl,
        );
        logger.info("Stream resolved with quality:", info);
        
        if (info && (info.audio_url || info.video_url || info.muxed_url)) {
          const resolvedVideo = info.muxed_url || info.video_url || null;
          setVideoStreamUrl(resolvedVideo);
          setSelectedQualityUrl(resolvedVideo);
        }
      } catch (err) {
        logger.error("Error resolving stream with quality:", err);
        setError("Error changing quality");
      } finally {
        setIsLoading(false);
      }
    };
    
    void fetchStreamWithQuality();
  }, [selectedQualityUrl, currentSong?.id, streamMode]);

  useEffect(() => {
    if (!currentSong) return;
    setShowControls(true);
  }, [currentSong?.id]);

  const handleTimeUpdate = () => {
    const activeElement = streamMode === "audio"
      ? (isHlsAudio ? videoRef.current : audioRef.current)
      : videoRef.current;
    if (activeElement) {
      setCurrentTime(activeElement.currentTime);
      setDuration(activeElement.duration || 0);
    }
  };

  const handleSeek = (value: number) => {
    setCurrentTime(value);
    const activeElement = streamMode === "audio"
      ? (isHlsAudio ? videoRef.current : audioRef.current)
      : videoRef.current;
    if (activeElement) {
      activeElement.currentTime = value;
    }
  };

  const qualityOptions = useMemo(() => {
    const options: { label: string; url: string | null }[] = [];
    if (streamMode === "av" && videoStreamUrl) {
      options.push({ label: "Auto", url: videoStreamUrl });
      // Add quality options from video formats
      const uniqueFormats = videoFormats.filter((format) => format.resolution);
      const seenResolutions = new Set<string>();
      uniqueFormats.forEach((format) => {
        const resolution = format.resolution || "Unknown";
        if (!seenResolutions.has(resolution)) {
          seenResolutions.add(resolution);
          options.push({ label: resolution, url: format.formatId });
        }
      });
    }
    if (streamMode === "audio" && streamUrl) {
      options.push({ label: "Audio", url: streamUrl });
    }
    return options;
  }, [streamMode, videoStreamUrl, streamUrl, videoFormats]);

  const selectedQualityLabel = useMemo(() => {
    const match = qualityOptions.find((option) => option.url === selectedQualityUrl);
    return match?.label || (streamMode === "audio" ? "Audio" : "Auto");
  }, [qualityOptions, selectedQualityUrl, streamMode]);

  const selectedAudioLabel = useMemo(() => {
    const match = audioTracks.find((track) => track.url === selectedAudioUrl);
    return match?.name || match?.language || match?.format_id || "Default";
  }, [audioTracks, selectedAudioUrl]);

  const selectedCaptionLabel = useMemo(() => {
    if (!selectedCaptionUrl) return "Off";
    const subtitleMatch = subtitleTracks.find((track) => track.url === selectedCaptionUrl);
    if (subtitleMatch) return subtitleMatch.name || subtitleMatch.language || "Subtitles";
    const captionMatch = captionTracks.find((track) => track.url === selectedCaptionUrl);
    return captionMatch?.name || captionMatch?.language || "Captions";
  }, [selectedCaptionUrl, subtitleTracks, captionTracks]);

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  useEffect(() => () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  }, []);

  if (!currentSong) return null;

  return (
    <div
      className="relative w-full h-full bg-black overflow-hidden rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.7)]"
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={streamMode === "av" && !isHlsVideo ? videoStreamUrl || undefined : undefined}
        className="w-full h-full object-contain bg-black"
        onTimeUpdate={handleTimeUpdate}
        onEnded={onSongEnd}
        onLoadedMetadata={handleTimeUpdate}
        onError={(event) => {
          logger.error("Video playback error:", event);
          setError("Playback error");
          setIsPlaying(false);
        }}
      >
        {subtitleTracks.map((track) => (
          <track
            key={`subtitle-${track.language}-${track.url}`}
            kind="subtitles"
            srcLang={track.language}
            label={track.name || track.language}
            src={track.url}
            default={selectedCaptionUrl === track.url}
          />
        ))}
        {captionTracks.map((track) => (
          <track
            key={`caption-${track.language}-${track.url}`}
            kind="captions"
            srcLang={track.language}
            label={`Auto: ${track.name || track.language}`}
            src={track.url}
            default={selectedCaptionUrl === track.url}
          />
        ))}
      </video>

      <audio
        ref={audioRef}
        src={!isHlsAudio ? streamUrl || undefined : undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onSongEnd}
        onLoadedMetadata={handleTimeUpdate}
        onError={(event) => {
          logger.error("Audio playback error:", event);
          setError("Playback error");
          setIsPlaying(false);
        }}
      />

      {isHlsAudio && (
        <video
          ref={videoRef}
          className="hidden"
          onTimeUpdate={handleTimeUpdate}
          onEnded={onSongEnd}
          onLoadedMetadata={handleTimeUpdate}
          onError={(event) => {
            logger.error("Audio playback error:", event);
            setError("Playback error");
            setIsPlaying(false);
          }}
        />
      )}

      {showControls && (
        <div className="absolute inset-0 flex flex-col justify-between text-white">
          {showTopBar && (
            <TopBar
              currentSong={currentSong}
              streamMode={streamMode}
              onSetStreamMode={async (mode) => {
                setStreamMode?.(mode);
                await setSetting("audioOnlyMode", mode === "audio" ? "true" : "false");
              }}
              onBack={onBack}
            />
          )}

          <BottomControls
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onPrev={playPrev}
            onNext={playNext}
            audioTracks={audioTracks}
            subtitleTracks={subtitleTracks}
            captionTracks={captionTracks}
            selectedAudioUrl={selectedAudioUrl}
            selectedCaptionUrl={selectedCaptionUrl}
            onSelectAudio={setSelectedAudioUrl}
            onSelectCaption={setSelectedCaptionUrl}
            isMuted={isMuted}
            volume={volume}
            onToggleMute={() => setIsMuted(!isMuted)}
            onVolumeChange={(value) => {
              setVolume(value);
              setIsMuted(false);
            }}
            streamMode={streamMode}
            onToggleStreamMode={async (mode) => {
              setStreamMode?.(mode);
              await setSetting("audioOnlyMode", mode === "audio" ? "true" : "false");
              if (mode === "audio" && onBack) {
                onBack();
              }
            }}
            formatTime={formatTime}
            activePanel={activePanel}
            onTogglePanel={(panel) =>
              setActivePanel((prev) => (prev === panel ? null : panel))
            }
          />
        </div>
      )}

      {activePanel === "audio" && (
        <AudioPanel
          audioTracks={audioTracks}
          selectedAudioUrl={selectedAudioUrl}
          onSelectAudio={setSelectedAudioUrl}
          onBack={() => setActivePanel("settings")}
        />
      )}
      {activePanel === "captions" && (
        <CaptionsPanel
          subtitleTracks={subtitleTracks}
          captionTracks={captionTracks}
          selectedCaptionUrl={selectedCaptionUrl}
          onSelectCaption={setSelectedCaptionUrl}
          onBack={() => setActivePanel("settings")}
        />
      )}
      {activePanel === "quality" && (
        <QualityPanel
          options={qualityOptions}
          selectedQualityUrl={selectedQualityUrl}
          onSelectQuality={(url) => {
            setSelectedQualityUrl(url);
            if (url && streamMode === "av") {
              setVideoStreamUrl(url);
            }
          }}
          onBack={() => setActivePanel("settings")}
        />
      )}
      {activePanel === "settings" && (
        <SettingsPanel
          selectedQualityLabel={selectedQualityLabel}
          selectedAudioLabel={selectedAudioLabel}
          selectedCaptionLabel={selectedCaptionLabel}
          onOpenPanel={(panel) => setActivePanel(panel)}
          onOpenSpeed={() => setActivePanel("speed")}
          onOpenDownload={() => {
            // TODO: Hook into download panel if needed.
          }}
        />
      )}
      {activePanel === "speed" && (
        <SpeedPanel
          playbackRate={playbackRate}
          onSelectRate={(rate) => setPlaybackRate(rate)}
          onBack={() => setActivePanel("settings")}
        />
      )}
    </div>
  );
};
