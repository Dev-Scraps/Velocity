// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import Hls from "hls.js";
// import { SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
// import { Video, loadCookies, streamResolve, type AudioTrack, type StreamMode, type SubtitleTrack } from "../hooks/useRustCommands";
// import { logger } from "../utils/logger";
// import { useSettings } from "../hooks/useSettings";

// interface FlowPlayerProps {
//   currentSong: Video | null;
//   isPlaying: boolean;
//   setIsPlaying: (playing: boolean) => void;
//   playNext: () => void;
//   playPrev: () => void;
//   onSongEnd: () => void;
// }

// const isHlsSource = (url: string) => url.includes(".m3u8");

// const formatTime = (time: number) => {
//   if (isNaN(time)) return "0:00";
//   const minutes = Math.floor(time / 60);
//   const seconds = Math.floor(time % 60);
//   return `${minutes}:${seconds.toString().padStart(2, "0")}`;
// };

// export const FlowPlayer = ({
//   currentSong,
//   isPlaying,
//   setIsPlaying,
//   playNext,
//   playPrev,
//   onSongEnd,
// }: FlowPlayerProps) => {
//   const audioRef = useRef<HTMLAudioElement | null>(null);
//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const hlsRef = useRef<Hls | null>(null);
//   const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
//   const [streamUrl, setStreamUrl] = useState<string | null>(null);
//   const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
//   const [streamMode, setStreamMode] = useState<StreamMode>("audio");
//   const [currentTime, setCurrentTime] = useState(0);
//   const [duration, setDuration] = useState(0);
//   const [volume, setVolume] = useState(1);
//   const [isMuted, setIsMuted] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
//   const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
//   const [captionTracks, setCaptionTracks] = useState<SubtitleTrack[]>([]);
//   const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
//   const [selectedCaptionUrl, setSelectedCaptionUrl] = useState<string | null>(null);
//   const [showControls, setShowControls] = useState(true);
//   const { getSettings, setSetting } = useSettings();
//   const isHlsAudio = useMemo(() => Boolean(streamUrl && isHlsSource(streamUrl)), [streamUrl]);
//   const isHlsVideo = useMemo(() => Boolean(videoStreamUrl && isHlsSource(videoStreamUrl)), [videoStreamUrl]);

//   useEffect(() => {
//     const loadPlaybackMode = async () => {
//       try {
//         const settings = await getSettings();
//         setStreamMode(settings.audioOnlyMode ? "audio" : "av");
//       } catch (err) {
//         logger.warn("Failed to load playback settings", err);
//       }
//     };

//     void loadPlaybackMode();
//   }, [getSettings]);

//   useEffect(() => {
//     const fetchStream = async () => {
//       if (!currentSong) return;

//       setIsLoading(true);
//       setError(null);
//       setStreamUrl(null);
//       setVideoStreamUrl(null);
//       setAudioTracks([]);
//       setSubtitleTracks([]);
//       setCaptionTracks([]);
//       setSelectedAudioUrl(null);
//       setSelectedCaptionUrl(null);

//       try {
//         const cookies = await loadCookies();
//         const info = await streamResolve(
//           `https://www.youtube.com/watch?v=${currentSong.id}`,
//           streamMode,
//           cookies,
//         );
//         logger.info("Stream resolved:", info);

//         if (info && (info.audio_url || info.video_url || info.muxed_url)) {
//           const resolvedAudio = info.audio_url || info.muxed_url || info.video_url || null;
//           const resolvedVideo = info.muxed_url || info.video_url || null;
//           setStreamUrl(resolvedAudio);
//           setSelectedAudioUrl(resolvedAudio);
//           setVideoStreamUrl(resolvedVideo);
//           setAudioTracks(info.audio_tracks || []);
//           setSubtitleTracks(info.subtitles || []);
//           setCaptionTracks(info.captions || []);
//           const firstCaption = info.subtitles?.[0]?.url || info.captions?.[0]?.url || null;
//           setSelectedCaptionUrl(firstCaption);
//         } else {
//           logger.error("Stream info missing video_url", info);
//           setError("Failed to resolve audio stream");
//         }
//       } catch (err) {
//         logger.error("Error resolving stream:", err);
//         setError("Error playing video");
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     void fetchStream();
//   }, [currentSong?.id, streamMode]);

//   useEffect(() => {
//     if (selectedAudioUrl && selectedAudioUrl !== streamUrl) {
//       setStreamUrl(selectedAudioUrl);
//     }
//   }, [selectedAudioUrl, streamUrl]);

//   useEffect(() => {
//     const activeElement = streamMode === "audio"
//       ? (isHlsAudio ? videoRef.current : audioRef.current)
//       : videoRef.current;
//     if (!activeElement) return;

//     if (isPlaying) {
//       const playPromise = activeElement.play();
//       if (playPromise !== undefined) {
//         playPromise.catch((playError) => {
//           logger.error("Playback prevented:", playError);
//           setIsPlaying(false);
//         });
//       }
//     } else {
//       activeElement.pause();
//     }
//   }, [isPlaying, streamUrl, videoStreamUrl, setIsPlaying, streamMode, isHlsAudio]);

//   useEffect(() => {
//     if (audioRef.current) {
//       audioRef.current.volume = volume;
//       audioRef.current.muted = isMuted;
//     }
//     if (videoRef.current) {
//       videoRef.current.volume = volume;
//       videoRef.current.muted = isMuted;
//     }
//   }, [volume, isMuted]);

//   useEffect(() => {
//     const activeElement = streamMode === "audio"
//       ? (isHlsAudio ? videoRef.current : audioRef.current)
//       : videoRef.current;
//     const sourceUrl = streamMode === "audio" ? streamUrl : videoStreamUrl;

//     if (!activeElement || !sourceUrl || !isHlsSource(sourceUrl)) {
//       if (hlsRef.current) {
//         hlsRef.current.destroy();
//         hlsRef.current = null;
//       }
//       return undefined;
//     }

//     if (Hls.isSupported()) {
//       if (hlsRef.current) {
//         hlsRef.current.destroy();
//       }
//       const hls = new Hls();
//       hls.loadSource(sourceUrl);
//       hls.attachMedia(activeElement);
//       hlsRef.current = hls;
//     } else if (activeElement instanceof HTMLMediaElement) {
//       activeElement.src = sourceUrl;
//     }

//     return () => {
//       if (hlsRef.current) {
//         hlsRef.current.destroy();
//         hlsRef.current = null;
//       }
//     };
//   }, [streamMode, streamUrl, videoStreamUrl, isHlsAudio, isHlsVideo]);

//   useEffect(() => {
//     if (!currentSong) return;
//     setShowControls(true);
//   }, [currentSong?.id]);

//   const handleTimeUpdate = () => {
//     const activeElement = streamMode === "audio"
//       ? (isHlsAudio ? videoRef.current : audioRef.current)
//       : videoRef.current;
//     if (activeElement) {
//       setCurrentTime(activeElement.currentTime);
//       setDuration(activeElement.duration || 0);
//     }
//   };

//   const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const time = parseFloat(event.target.value);
//     setCurrentTime(time);
//     const activeElement = streamMode === "audio"
//       ? (isHlsAudio ? videoRef.current : audioRef.current)
//       : videoRef.current;
//     if (activeElement) {
//       activeElement.currentTime = time;
//     }
//   };

//   const resetControlsTimeout = () => {
//     if (controlsTimeoutRef.current) {
//       clearTimeout(controlsTimeoutRef.current);
//     }
//     setShowControls(true);
//     controlsTimeoutRef.current = setTimeout(() => {
//       setShowControls(false);
//     }, 2500);
//   };

//   useEffect(() => () => {
//     if (controlsTimeoutRef.current) {
//       clearTimeout(controlsTimeoutRef.current);
//     }
//   }, []);

//   if (!currentSong) return null;

//   return (
//     <div
//       className="relative w-full h-full bg-black overflow-hidden rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.7)]"
//       onMouseMove={resetControlsTimeout}
//       onMouseLeave={() => setShowControls(false)}
//     >
//       <video
//         ref={videoRef}
//         src={streamMode === "av" && !isHlsVideo ? videoStreamUrl || undefined : undefined}
//         className="w-full h-full object-contain bg-black"
//         onTimeUpdate={handleTimeUpdate}
//         onEnded={onSongEnd}
//         onLoadedMetadata={handleTimeUpdate}
//         onError={(event) => {
//           logger.error("Video playback error:", event);
//           setError("Playback error");
//           setIsPlaying(false);
//         }}
//       >
//         {subtitleTracks.map((track) => (
//           <track
//             key={`subtitle-${track.language}-${track.url}`}
//             kind="subtitles"
//             srcLang={track.language}
//             label={track.name || track.language}
//             src={track.url}
//             default={selectedCaptionUrl === track.url}
//           />
//         ))}
//         {captionTracks.map((track) => (
//           <track
//             key={`caption-${track.language}-${track.url}`}
//             kind="captions"
//             srcLang={track.language}
//             label={`Auto: ${track.name || track.language}`}
//             src={track.url}
//             default={selectedCaptionUrl === track.url}
//           />
//         ))}
//       </video>

//       <audio
//         ref={audioRef}
//         src={streamMode === "audio" && !isHlsAudio ? streamUrl || undefined : undefined}
//         onTimeUpdate={handleTimeUpdate}
//         onEnded={onSongEnd}
//         onLoadedMetadata={handleTimeUpdate}
//         onError={(event) => {
//           logger.error("Audio playback error:", event);
//           setError("Playback error");
//           setIsPlaying(false);
//         }}
//       />

//       {streamMode === "audio" && isHlsAudio && (
//         <video
//           ref={videoRef}
//           className="hidden"
//           onTimeUpdate={handleTimeUpdate}
//           onEnded={onSongEnd}
//           onLoadedMetadata={handleTimeUpdate}
//           onError={(event) => {
//             logger.error("Audio playback error:", event);
//             setError("Playback error");
//             setIsPlaying(false);
//           }}
//         />
//       )}

//       {showControls && (
//         <div className="absolute inset-0 flex flex-col justify-between text-white">
//           <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 via-black/40 to-transparent">
//             <div className="flex items-center gap-3">
//               <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10">
//                 {currentSong.thumbnailUrl ? (
//                   <img
//                     src={currentSong.thumbnailUrl}
//                     alt={currentSong.title}
//                     className="w-full h-full object-cover"
//                   />
//                 ) : null}
//               </div>
//               <div className="min-w-0">
//                 <div className="text-lg font-semibold truncate">{currentSong.title}</div>
//                 <div className="text-xs text-white/70 truncate">{currentSong.channelName || "Unknown Artist"}</div>
//               </div>
//             </div>
//             <div className="flex items-center gap-3 text-xs">
//               <button
//                 type="button"
//                 onClick={async () => {
//                   setStreamMode("audio");
//                   await setSetting("audioOnlyMode", "true");
//                 }}
//                 className={`px-3 py-1 rounded-full border border-white/20 ${streamMode === "audio" ? "bg-white/20" : "bg-transparent"}`}
//               >
//                 Audio
//               </button>
//               <button
//                 type="button"
//                 onClick={async () => {
//                   setStreamMode("av");
//                   await setSetting("audioOnlyMode", "false");
//                 }}
//                 className={`px-3 py-1 rounded-full border border-white/20 ${streamMode === "av" ? "bg-white/20" : "bg-transparent"}`}
//               >
//                 Video
//               </button>
//             </div>
//           </div>

//           <div className="flex items-center justify-center gap-10">
//             <button
//               onClick={playPrev}
//               className="p-3 rounded-full bg-black/50 hover:bg-black/70 transition"
//             >
//               <SkipBack className="w-7 h-7" />
//             </button>
//             <button
//               onClick={() => setIsPlaying(!isPlaying)}
//               disabled={isLoading || !!error}
//               className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-105 transition"
//             >
//               {isLoading ? (
//                 <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
//               ) : isPlaying ? (
//                 <svg viewBox="0 0 320 512" className="w-7 h-7" fill="currentColor">
//                   <path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z" />
//                 </svg>
//               ) : (
//                 <svg viewBox="0 0 384 512" className="w-7 h-7" fill="currentColor">
//                   <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
//                 </svg>
//               )}
//             </button>
//             <button
//               onClick={playNext}
//               className="p-3 rounded-full bg-black/50 hover:bg-black/70 transition"
//             >
//               <SkipForward className="w-7 h-7" />
//             </button>
//           </div>

//           <div className="px-6 pb-6">
//             <div className="flex items-center justify-between text-xs text-white/80 mb-2">
//               <span>{formatTime(currentTime)}</span>
//               <span>{formatTime(duration)}</span>
//             </div>
//             <div className="relative h-2 rounded-full bg-white/20">
//               <input
//                 type="range"
//                 min={0}
//                 max={duration || 100}
//                 value={currentTime}
//                 onChange={handleSeek}
//                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
//               />
//               <div
//                 className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-red-500 to-red-800"
//                 style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
//               />
//             </div>

//             <div className="mt-4 flex items-center justify-between">
//               <div className="flex items-center gap-4 text-xs">
//                 {audioTracks.length > 0 && (
//                   <label className="flex items-center gap-2">
//                     <span className="text-white/70">Audio</span>
//                     <select
//                       value={selectedAudioUrl || ""}
//                       onChange={(event) => setSelectedAudioUrl(event.target.value || null)}
//                       className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-white"
//                     >
//                       {audioTracks.map((track) => (
//                         <option key={track.format_id} value={track.url}>
//                           {track.name || track.language || track.format_id}
//                         </option>
//                       ))}
//                     </select>
//                   </label>
//                 )}
//                 {(subtitleTracks.length > 0 || captionTracks.length > 0) && streamMode === "av" && (
//                   <label className="flex items-center gap-2">
//                     <span className="text-white/70">Captions</span>
//                     <select
//                       value={selectedCaptionUrl || ""}
//                       onChange={(event) => setSelectedCaptionUrl(event.target.value || null)}
//                       className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-white"
//                     >
//                       <option value="">Off</option>
//                       {subtitleTracks.map((track) => (
//                         <option key={`sub-${track.language}-${track.url}`} value={track.url}>
//                           {track.name || track.language}
//                         </option>
//                       ))}
//                       {captionTracks.map((track) => (
//                         <option key={`cap-${track.language}-${track.url}`} value={track.url}>
//                           Auto: {track.name || track.language}
//                         </option>
//                       ))}
//                     </select>
//                   </label>
//                 )}
//               </div>
//               <div className="flex items-center gap-3">
//                 <button onClick={() => setIsMuted(!isMuted)} className="text-white/80">
//                   {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
//                 </button>
//                 <div className="w-24 h-1 bg-white/20 rounded-full relative">
//                   <input
//                     type="range"
//                     min={0}
//                     max={1}
//                     step={0.01}
//                     value={isMuted ? 0 : volume}
//                     onChange={(event) => {
//                       setVolume(parseFloat(event.target.value));
//                       setIsMuted(false);
//                     }}
//                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
//                   />
//                   <div
//                     className="absolute left-0 top-0 h-full bg-white rounded-full"
//                     style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
//                   />
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };
//   // ========================================================================================
//   // RENDER - MAIN COMPONENT JSX
//   // ========================================================================================

//   return (
//     <div
//       ref={containerRef}
//       className={cn(
//         "relative w-full h-full bg-black overflow-hidden",
//         "shadow-[0_0_50px_rgba(0,0,0,0.8)]",
//         isMobile && isLandscape && "landscape-mode",
//         orientationChangeInProgress && "rotating-animation"
//       )}
//       onMouseMove={handleMouseMove}
//       onMouseLeave={() => {
//         if (isPlaying && !activePanel) {
//           setShowControls(false);
//           setOverlayVisible(false);
//           setHoveredButton(null);
//           setActivePanel(null);
//           setShowVolumeSlider(false);
//           setShowTouchControls(false);
//           setShowNextEpisodeButton(false);
//         }
//       }}
//       onDoubleClick={handleDoubleClick}
//       onTouchStart={handleTouchStart}
//       onTouchMove={handleTouchMove}
//       onTouchEnd={handleTouchEnd}
//       onClick={(e) => {
//         if (
//           (activePanel || showEpisodeList) &&
//           isPlaying &&
//           !(e.target as HTMLElement).closest(
//             ".z-50, .z-40, .custom-scrollbar, .controls-area"
//           )
//         ) {
//           setActivePanel(null);
//           setShowEpisodeList(false);
//           setShowVolumeSlider(false);
//           setShowTouchControls(false);
//         }
//       }}
//     >
//       {/* ======================================================================================== */}
//       {/* VIDEO ELEMENT */}
//       {/* ======================================================================================== */}
//       <video
//         ref={videoRef}
//         src={getMainUrl() || undefined}
//         preload="metadata"
//         className={cn("w-full h-full", "object-fit")}
//         crossOrigin="anonymous"
//         playsInline
//         onCanPlay={() => setIsLoading(false)}
//         onPlaying={() => setIsLoading(false)}
//         onPause={() => setIsPlaying(false)}
//         onPlay={() => setIsPlaying(true)}
//         onWaiting={() => setIsLoading(true)}
//         onStalled={() => setIsLoading(true)}
//         {...(autoPlay ? { autoPlay: true } : {})}
//       >
//         {/** Native subtitle tracks inserted when user prefers native rendering **/}
//         {prefs.useNativeSubtitles &&
//           streamData?.subtitles &&
//           streamData.subtitles.length > 0
//           ? streamData.subtitles.map((s) => (
//             <track
//               key={s.url}
//               src={s.url}
//               kind="subtitles"
//               srcLang={s.languageCode || s.lang}
//               label={s.lang}
//               default={
//                 !!(
//                   (s.languageCode && s.languageCode === prefs.language) ||
//                   (s.lang && s.lang.toLowerCase().includes(prefs.language))
//                 )
//               }
//             />
//           ))
//           : null}
//       </video>

//       {/* ======================================================================================== */}
//       {/* SUBTITLE OVERLAY */}
//       {/* ======================================================================================== */}
//       {prefs.useNativeSubtitles
//         ? streamData?.subtitles &&
//         streamData.subtitles.length > 0 && (
//           <>
//             {streamData.subtitles.map((s) => (
//               <track
//                 key={s.url}
//                 src={s.url}
//                 kind="subtitles"
//                 srcLang={s.languageCode || s.lang}
//                 label={s.lang}
//                 default={false}
//               />
//             ))}
//           </>
//         )
//         : enableSubtitles &&
//         currentSubtitleText && (
//           <div style={subtitleStyle}>{currentSubtitleText}</div>
//         )}

//       {/* ======================================================================================== */}
//       {/* AUTO-NEXT EPISODE OVERLAY */}
//       {/* ======================================================================================== */}
//       <AnimatePresence>
//         {showAutoNextOverlay && (
//           <motion.div
//             initial={{ opacity: 0, scale: 0.8 }}
//             animate={{ opacity: 1, scale: 1 }}
//             exit={{ opacity: 0, scale: 0.8 }}
//             className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
//           >
//             <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-8 text-center border border-white/20 shadow-2xl max-w-md mx-4">
//               <div className="text-white text-xl font-bold mb-4">
//                 Next Episode
//               </div>
//               {(() => {
//                 const nextEp = getNextEpisode();
//                 return nextEp ? (
//                   <div className="text-white/80 mb-6">
//                     <div className="text-lg font-semibold">{nextEp.title}</div>
//                     <div className="text-sm text-white/60 mt-1">
//                       Season {nextEp.season}, Episode {nextEp.episode}
//                     </div>
//                   </div>
//                 ) : null;
//               })()}
//               <div className="text-white text-3xl font-bold mb-6">
//                 {autoNextCountdown}
//               </div>
//               <div className="flex gap-4 justify-center">
//                 <button
//                   onClick={cancelAutoNext}
//                   className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-all duration-300"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   onClick={handleAutoNext}
//                   className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-300"
//                 >
//                   Play Now
//                 </button>
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* ======================================================================================== */}
//       {/* MOBILE CENTER CONTROLS */}
//       {/* ======================================================================================== */}
//       {showControls && (
//         <div className="absolute inset-0 flex items-center justify-center z-30">
//           <div className="flex items-center justify-center gap-x-6 sm:gap-x-12">
//             {/* Skip Backward Button */}
//             <button
//               onClick={skipBackward}
//               className="flex items-center justify-center text-white p-2 sm:p-3 rounded-full bg-black/40 backdrop-blur-xl hover:bg-black/60 transition-all duration-200 transform hover:scale-105 active:scale-95 border border-white/10 shadow-lg"
//               aria-label="Skip backward"
//             >
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 viewBox="0 0 24 24"
//                 fill="currentColor"
//                 className="w-6 h-6 sm:w-12 sm:h-12"
//               >
//                 {/* paths unchanged */}
//                 <path
//                   fillRule="evenodd"
//                   clipRule="evenodd"
//                   d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
//                 />
//                 <path
//                   fillRule="evenodd"
//                   clipRule="evenodd"
//                   d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
//                 />
//                 <path
//                   fillRule="evenodd"
//                   clipRule="evenodd"
//                   d="M11.324 1.67511C11.4489 1.41526 11.7117 1.25 12 1.25C12.7353 1.25 13.4541 1.32394 14.1492 1.46503C19.0563 2.46112 22.75 6.79837 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12C1.25 7.59065 3.90459 3.80298 7.69972 2.14482C8.07929 1.97898 8.52143 2.15224 8.68726 2.53181C8.8531 2.91137 8.67984 3.35351 8.30028 3.51935C5.03179 4.94742 2.75 8.20808 2.75 12C2.75 17.1086 6.89137 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 7.84953 18.5158 4.33622 14.75 3.16544V4.5C14.75 4.81852 14.5488 5.10229 14.2483 5.20772C13.9477 5.31315 13.6133 5.21724 13.4143 4.96852L11.4143 2.46852C11.2342 2.24339 11.1991 1.93496 11.324 1.67511Z"
//                 />
//               </svg>
//             </button>

//             {/* Center Play/Pause Button */}
//             <button
//               onClick={togglePlay}
//               className={cn(
//                 "flex items-center justify-center text-white p-2 sm:p-3 rounded-full bg-black/40 backdrop-blur-xl transition-all duration-200 transform",
//                 "hover:scale-110 active:scale-95 border border-white/10 shadow-lg"
//               )}
//               aria-label={isPlaying ? "Pause" : "Play"}
//             >
//               {isPlaying ? (
//                 <svg
//                   stroke="currentColor"
//                   fill="currentColor"
//                   strokeWidth="0"
//                   viewBox="0 0 320 512"
//                   className="w-6 h-6 sm:w-12 sm:h-12"
//                   xmlns="http://www.w3.org/2000/svg"
//                 >
//                   <path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"></path>
//                 </svg>
//               ) : (
//                 <svg
//                   stroke="currentColor"
//                   fill="currentColor"
//                   strokeWidth="0"
//                   viewBox="0 0 384 512"
//                   className="w-6 h-6 sm:w-12 sm:h-12"
//                   xmlns="http://www.w3.org/2000/svg"
//                 >
//                   <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"></path>
//                 </svg>
//               )}
//             </button>

//             {/* Skip Forward Button */}
//             <button
//               onClick={skipForward}
//               className="flex items-center justify-center text-white p-2 sm:p-3 rounded-full bg-black/40 backdrop-blur-xl hover:bg-black/60 transition-all duration-200 transform hover:scale-105 active:scale-95 border border-white/10 shadow-lg"
//               aria-label="Skip forward"
//             >
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 viewBox="0 0 24 24"
//                 fill="currentColor"
//                 className="w-6 h-6 sm:w-12 sm:h-12"
//               >
//                 {/* paths unchanged */}
//                 <path
//                   fillRule="evenodd"
//                   clipRule="evenodd"
//                   d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
//                 />
//                 <path
//                   fillRule="evenodd"
//                   clipRule="evenodd"
//                   d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
//                 />
//                 <path
//                   fillRule="evenodd"
//                   clipRule="evenodd"
//                   d="M12.676 1.67511C12.5511 1.41526 12.2883 1.25 12 1.25C11.2647 1.25 10.5459 1.32394 9.8508 1.46503C4.94367 2.46112 1.25 6.79837 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 7.59065 20.0954 3.80298 16.3003 2.14482C15.9207 1.97898 15.4786 2.15224 15.3127 2.53181C15.1469 2.91137 15.3202 3.35351 15.6997 3.51935C18.9682 4.94742 21.25 8.20808 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12C2.75 7.84953 5.48421 4.33622 9.25 3.16544V4.5C9.25 4.81852 9.45118 5.10229 9.75175 5.20772C10.0523 5.31315 10.3867 5.21724 10.5857 4.96852L12.5857 2.46852C12.7658 2.24339 12.8009 1.93496 12.676 1.67511Z"
//                 />
//               </svg>
//             </button>
//           </div>
//         </div>
//       )}

//       {/* ======================================================================================== */}
//       {/* TITLE BAR */}
//       {/* ======================================================================================== */}
//       {showControls && (
//         <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between animate-fadeIn px-4 py-2">
//           {/* Left Section with hover group */}
//           <div className="relative group flex items-center gap-3">
//             {onBack && (
//               <button
//                 onClick={onBack}
//                 className="flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-300"
//               >
//                 <ChevronLeft className="h-6 w-6 hover:-translate-x-1 transition-transform duration-300" />
//                 <span className="text-md font-semibold font-sora tracking-wide">
//                   Back
//                 </span>
//               </button>
//             )}

//             <span className="hidden md:inline text-white/40 text-lg font-sora font-medium">
//               /
//             </span>

//             <span className="hidden md:inline text-white text-lg font-bold font-sora transition-transform duration-300 hover:scale-[1.05]">
//               {title}
//             </span>

//             {/* Bookmark Button - only visible on hover */}
//             <button
//               onClick={handleBookmarkClick}
//               className="relative p-2 text-white"
//             >
//               <Bookmark
//                 className={`w-4 h-4 ${bookmarked ? "fill-white" : ""}`}
//               />
//             </button>
//           </div>
//           <div className="flex items-center gap-2">
//             <button
//               onClick={() => setActivePanel("server")}
//               className="text-white/80 hover:text-white transition-colors duration-300 p-2 rounded-full"
//               title="Change Server"
//             >
//               <Server className="h-6 w-6" />
//             </button>
//           </div>
//         </div>
//       )}

//       {/* ======================================================================================== */}
//       {/* ENHANCED EPISODE NAVIGATION BUTTONS */}
//       {/* ======================================================================================== */}
//       {showControls && type === "tv" && (
//         <>
//           {/* Previous Episode Button - Start of Video */}
//           {showEpisodeNavAtStart && (
//             <motion.div
//               initial={{ opacity: 0, x: -50 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -50 }}
//               className="absolute left-4 top-1/2 -translate-y-1/2 z-30"
//             >
//               <button
//                 onClick={handlePrevEpisodeClick}
//                 className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-black/60 hover:bg-black/80 text-white font-semibold shadow-2xl transition-all duration-300 backdrop-blur-xl border border-white/20 hover:shadow-white/20 hover:scale-105 group"
//                 title="Previous Episode"
//               >
//                 <SkipBack className="w-6 h-6 group-hover:-translate-x-1 transition-transform duration-300" />
//                 <div className="flex flex-col items-start">
//                   <span className="text-sm text-white/70">Previous</span>
//                   <span className="text-base font-bold">
//                     {(() => {
//                       const prevEp = getPrevEpisode();
//                       return prevEp
//                         ? `S${prevEp.season}E${prevEp.episode}`
//                         : "Episode";
//                     })()}
//                   </span>
//                 </div>
//               </button>
//             </motion.div>
//           )}

//           {/* Next Episode Button - End of Video */}
//           {showEpisodeNavAtEnd && (
//             <motion.div
//               initial={{ opacity: 0, x: 50 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: 50 }}
//               className="absolute right-4 top-1/2 -translate-y-1/2 z-40"
//             >
//               <button
//                 onClick={handleNextEpisodeClick}
//                 className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-black/60 hover:bg-black/80 text-white font-semibold shadow-2xl transition-all duration-300 backdrop-blur-xl border border-white/20 hover:shadow-white/20 hover:scale-105 group"
//                 title="Next Episode"
//               >
//                 <div className="flex flex-col items-end">
//                   <span className="text-sm text-white/70">Next</span>
//                   <span className="text-base font-bold">
//                     {(() => {
//                       const nextEp = getNextEpisode();
//                       return nextEp
//                         ? `S${nextEp.season}E${nextEp.episode}`
//                         : "Episode";
//                     })()}
//                   </span>
//                 </div>
//                 <SkipForward className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" />
//               </button>
//             </motion.div>
//           )}
//         </>
//       )}

//       {/* ========================================================================================= */}
//       {/* BOTTOM CONTROLS */}
//       {/* ======================================================================================== */}

//       {(showControls || activePanel || showEpisodeList) && !isEmbed && (
//         <div
//           className={cn(
//             "absolute bottom-0 left-0 right-0 z-30 controls-area ",
//             "animate-fadeIn",
//             isMobile ? (isLandscape ? "bottom-0" : "bottom-24") : "bottom-0"
//           )}
//         >
//           {/* Progress Bar with Time Above */}
//           <div className="relative px-4 group">
//             {/* Time above progress bar */}
//             <div className="flex justify-between items-center mb-2 px-1 select-none">
//               <span className="text-white text-xs sm:text-sm font-medium drop-shadow-lg">
//                 {formatTime(currentTime)}
//               </span>
//               <span className="text-white text-xs sm:text-sm font-medium drop-shadow-lg">
//                 {formatTime(duration)}
//               </span>
//             </div>
//             <div
//               ref={progressBarRef}
//               className={cn(
//                 "progress-bar-wrap relative w-full cursor-pointer group",
//                 isDragging && "z-20"
//               )}
//               onMouseMove={handleMouseMoveOnProgressBar}
//               onMouseDown={(e) => {
//                 dragActiveRef.current = true;
//                 setIsDragging(true);
//                 setShowControls(true);
//                 setOverlayVisible(true);
//                 document.addEventListener("mousemove", handleSeekDrag);
//                 document.addEventListener("mouseup", handleSeekMouseUp);
//                 handleSeekDrag(e.nativeEvent);
//               }}
//               onClick={(e) => {
//                 const progressBar = progressBarRef.current;
//                 const video = videoRef.current;
//                 if (!progressBar || !video) return;

//                 const rect = progressBar.getBoundingClientRect();
//                 const pos = Math.max(
//                   0,
//                   Math.min(1, (e.clientX - rect.left) / rect.width)
//                 );
//                 const newTime = Math.max(
//                   0,
//                   Math.min(video.duration, pos * video.duration)
//                 );

//                 if (
//                   Number.isFinite(newTime) &&
//                   newTime >= 0 &&
//                   newTime <= video.duration
//                 ) {
//                   video.currentTime = newTime;
//                 }
//                 setShowTooltip(false);
//               }}
//             >
//               <div className="relative w-full h-1.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/10 shadow-lg">
//                 {/* Buffer Progress */}
//                 <div
//                   className="absolute top-0 left-0 h-full bg-white/30 rounded-full pointer-events-none"
//                   style={{ width: `${bufferProgress}%` }}
//                 />

//                 <div
//                   className={cn(
//                     "absolute top-0 left-0 h-full rounded-full pointer-events-none",
//                     isDragging ? "remove-transition" : ""
//                   )}
//                   style={{
//                     width: `${progressPercentage}%`,
//                     background: "linear-gradient(to right, #ef4444, #7f1d1d)", // Tailwind's red-500 to red-900
//                     boxShadow: "0 0 10px rgba(239, 68, 68, 0.3)", // red-500 shadow
//                     transition: isDragging ? "none" : "0.2s ease",
//                   }}
//                 />

//                 {/* Slider Handle */}
//                 <div
//                   className={cn(
//                     "absolute w-4 h-4 bg-white rounded-full shadow-lg top-1/2 -translate-y-1/2 -translate-x-1/2 border-2 border-red-500",
//                     isDragging
//                       ? "remove-transition scale-125"
//                       : "scale-0 group-hover:scale-100"
//                   )}
//                   style={{
//                     left: `${progressPercentage}%`,
//                     transition: isDragging ? "none" : "0.2s ease",
//                     zIndex: 1,
//                     cursor: "pointer",
//                   }}
//                   onMouseDown={(e) => {
//                     e.stopPropagation();
//                     dragActiveRef.current = true;
//                     setIsDragging(true);
//                     setShowControls(true);
//                     setOverlayVisible(true);
//                     document.addEventListener("mousemove", handleSeekDrag);
//                     document.addEventListener("mouseup", handleSeekMouseUp);
//                   }}
//                   onTouchStart={handleSeekStart}
//                   onTouchEnd={(e) => {
//                     setIsDragging(false);
//                     setShowTooltip(false);
//                   }}
//                 />
//               </div>
//             </div>

//             {/* Preview Tooltip */}
//             {showTooltip && (
//               <div
//                 ref={tooltipRef}
//                 className="absolute bottom-full transform -translate-x-1/2 mb-2 bg-black/90 backdrop-blur-xl text-white px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border border-red-500/30 shadow-lg pointer-events-none"
//                 style={{ left: `${tooltipPosition}%` }}
//               >
//                 {formatTime(tooltipTime)}
//               </div>
//             )}
//           </div>

//           {/* Controls Layout */}
//           <div
//             className={cn(
//               "flex items-center justify-between px-4 py-2",
//               isMobile && isLandscape && "px-2 py-2"
//             )}
//           >
//             {/* Left Controls */}
//             <div
//               className={cn(
//                 "flex items-center gap-2 sm:gap-4",
//                 isMobile && isLandscape && "gap-1"
//               )}
//             >
//               <button
//                 onClick={togglePlay}
//                 className={cn(
//                   "text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                   isMobile && isLandscape && "p-1"
//                 )}
//               >
//                 {isPlaying ? (
//                   <svg
//                     stroke="currentColor"
//                     fill="currentColor"
//                     strokeWidth="0"
//                     viewBox="0 0 320 512"
//                     className="w-6 h-6"
//                     height="1em"
//                     width="1em"
//                     xmlns="http://www.w3.org/2000/svg"
//                   >
//                     <path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"></path>
//                   </svg>
//                 ) : (
//                   <svg
//                     stroke="currentColor"
//                     fill="currentColor"
//                     strokeWidth="0"
//                     viewBox="0 0 384 512"
//                     className="w-6 h-6"
//                     height="1em"
//                     width="1em"
//                     xmlns="http://www.w3.org/2000/svg"
//                   >
//                     <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"></path>
//                   </svg>
//                 )}
//               </button>

//               {/* Skip buttons - Hidden on mobile */}
//               <button
//                 onClick={skipBackward}
//                 className={cn(
//                   "text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                   isMobile ? "hidden" : ""
//                 )}
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   viewBox="0 0 24 24"
//                   fill="currentColor"
//                   className="w-6 h-6"
//                 >
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
//                   ></path>
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
//                   ></path>
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M11.324 1.67511C11.4489 1.41526 11.7117 1.25 12 1.25C12.7353 1.25 13.4541 1.32394 14.1492 1.46503C19.0563 2.46112 22.75 6.79837 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12C1.25 7.59065 3.90459 3.80298 7.69972 2.14482C8.07929 1.97898 8.52143 2.15224 8.68726 2.53181C8.8531 2.91137 8.67984 3.35351 8.30028 3.51935C5.03179 4.94742 2.75 8.20808 2.75 12C2.75 17.1086 6.89137 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 7.84953 18.5158 4.33622 14.75 3.16544V4.5C14.75 4.81852 14.5488 5.10229 14.2483 5.20772C13.9477 5.31315 13.6133 5.21724 13.4143 4.96852L11.4143 2.46852C11.2342 2.24339 11.1991 1.93496 11.324 1.67511Z"
//                   ></path>
//                 </svg>
//               </button>

//               <button
//                 onClick={skipForward}
//                 className={cn(
//                   "text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                   isMobile ? "hidden" : ""
//                 )}
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   viewBox="0 0 24 24"
//                   fill="currentColor"
//                   className="w-6 h-6"
//                 >
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
//                   ></path>
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
//                   ></path>
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M12.676 1.67511C12.5511 1.41526 12.2883 1.25 12 1.25C11.2647 1.25 10.5459 1.32394 9.8508 1.46503C4.94367 2.46112 1.25 6.79837 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 7.59065 20.0954 3.80298 16.3003 2.14482C15.9207 1.97898 15.4786 2.15224 15.3127 2.53181C15.1469 2.91137 15.3202 3.35351 15.6997 3.51935C18.9682 4.94742 21.25 8.20808 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12C2.75 7.84953 5.48421 4.33622 9.25 3.16544V4.5C9.25 4.81852 9.45118 5.10229 9.75175 5.20772C10.0523 5.31315 10.3867 5.21724 10.5857 4.96852L12.5857 2.46852C12.7658 2.24339 12.8009 1.93496 12.676 1.67511Z"
//                   ></path>
//                 </svg>
//               </button>

//               {/* Volume Control - Always show slider on desktop */}
//               <div className="relative flex items-center">
//                 <button
//                   onClick={toggleMute}
//                   className={cn(
//                     "text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                     isMobile && isLandscape && "p-1"
//                   )}
//                 >
//                   {isMuted ? (
//                     <svg
//                       xmlns="http://www.w3.org/2000/svg"
//                       viewBox="0 0 24 24"
//                       className="w-6 h-6"
//                       fill="currentColor"
//                     >
//                       <path d="M10.9916 3.9756C11.6784 3.44801 12.4957 3.01957 13.367 3.38808C14.2302 3.75318 14.5076 4.63267 14.6274 5.49785C14.7502 6.38459 14.7502 7.60557 14.7502 9.12365V14.8794C14.7502 16.3975 14.7502 17.6185 14.6274 18.5052C14.5076 19.3704 14.2302 20.2499 13.367 20.615C12.4957 20.9835 11.6784 20.5551 10.9916 20.0275C10.2892 19.488 9.3966 18.5765 8.34667 17.5044L8.34663 17.5044C7.80717 16.9535 7.44921 16.6873 7.08663 16.5374C6.72221 16.3868 6.27914 16.3229 5.50619 16.3229C4.83768 16.3229 4.23963 16.3229 3.78679 16.2758C3.31184 16.2265 2.87088 16.1191 2.47421 15.8485C1.7184 15.3328 1.42917 14.5777 1.31957 13.8838C1.23785 13.3663 1.24723 12.7981 1.25479 12.3405V11.6626C1.24723 11.205 1.23785 10.6368 1.31957 10.1193C1.42917 9.42536 1.7184 8.67029 2.47421 8.15462C2.87088 7.88398 3.31184 7.77657 3.78679 7.72723C4.23963 7.68019 4.83768 7.68021 5.50619 7.68023C6.27914 7.68023 6.72221 7.61628 7.08663 7.46563C7.44922 7.31574 7.80717 7.04954 8.34663 6.49869L8.34664 6.49869C9.39659 5.42655 10.2892 4.51511 10.9916 3.9756Z"></path>
//                       <path
//                         fillRule="evenodd"
//                         clipRule="evenodd"
//                         d="M17.2929 9.29289C17.6834 8.90237 18.3166 8.90237 18.7071 9.29289L20 10.5858L21.2929 9.29289C21.6834 8.90237 22.3166 8.90237 22.7071 9.29289C23.0976 9.68342 23.0976 10.3166 22.7071 10.7071L21.4142 12L22.7071 13.2929C23.0976 13.6834 23.0976 14.3166 22.7071 14.7071C22.3166 15.0976 21.6834 15.0976 21.2929 14.7071L20 13.4142L18.7071 14.7071C18.3166 15.0976 17.6834 15.0976 17.2929 14.7071C16.9024 14.3166 16.9024 13.6834 17.2929 13.2929L18.5858 12L17.2929 10.7071C16.9024 10.3166 16.9024 9.68342 17.2929 9.29289Z"
//                       ></path>
//                     </svg>
//                   ) : (
//                     <svg
//                       xmlns="http://www.w3.org/2000/svg"
//                       viewBox="0 0 24 24"
//                       className="w-6 h-6"
//                       fill="currentColor"
//                     >
//                       <path d="M10.9916 3.9756C11.6784 3.44801 12.4957 3.01957 13.367 3.38808C14.2302 3.75318 14.5076 4.63267 14.6274 5.49785C14.7502 6.38459 14.7502 7.60557 14.7502 9.12365V14.8794C14.7502 16.3975 14.7502 17.6185 14.6274 18.5052C14.5076 19.3704 14.2302 20.2499 13.367 20.615C12.4957 20.9835 11.6784 20.5551 10.9916 20.0275C10.2892 19.488 9.3966 18.5765 8.34667 17.5044L8.34663 17.5044C7.80717 16.9535 7.44921 16.6873 7.08663 16.5374C6.72221 16.3868 6.27914 16.3229 5.50619 16.3229C4.83768 16.3229 4.23963 16.3229 3.78679 16.2758C3.31184 16.2265 2.87088 16.1191 2.47421 15.8485C1.7184 15.3328 1.42917 14.5777 1.31957 13.8838C1.23785 13.3663 1.24723 12.7981 1.25479 12.3405V11.6626C1.24723 11.205 1.23785 10.6368 1.31957 10.1193C1.42917 9.42536 1.7184 8.67029 2.47421 8.15462C2.87088 7.88398 3.31184 7.77657 3.78679 7.72723C4.23963 7.68019 4.83768 7.68021 5.50619 7.68023C6.27914 7.68023 6.72221 7.61628 7.08663 7.46563C7.44922 7.31574 7.80717 7.04954 8.34663 6.49869L8.34664 6.49869C9.39659 5.42655 10.2892 4.51511 10.9916 3.9756Z"></path>
//                       <path
//                         fillRule="evenodd"
//                         clipRule="evenodd"
//                         d="M16.3935 8.20504C16.8325 7.87003 17.4601 7.95439 17.7951 8.39347C18.5519 9.38539 19.0001 10.6418 19.0001 12.0001C19.0001 13.3583 18.5519 14.6147 17.7951 15.6066C17.4601 16.0457 16.8325 16.1301 16.3935 15.7951C15.9544 15.4601 15.87 14.8325 16.205 14.3935C16.699 13.746 17.0001 12.9149 17.0001 12.0001C17.0001 11.0852 16.699 10.2541 16.205 9.60664C15.87 9.16756 15.9544 8.54004 16.3935 8.20504Z"
//                       ></path>
//                       <path
//                         fillRule="evenodd"
//                         clipRule="evenodd"
//                         d="M19.3247 6.26245C19.7321 5.8895 20.3646 5.91738 20.7376 6.32472C22.1408 7.8573 23 9.83247 23 12C23 14.1675 22.1408 16.1427 20.7376 17.6753C20.3646 18.0826 19.7321 18.1105 19.3247 17.7376C18.9174 17.3646 18.8895 16.7321 19.2625 16.3247C20.3609 15.125 21 13.621 21 12C21 10.379 20.3609 8.87497 19.2625 7.6753C18.8895 7.26796 18.9174 6.63541 19.3247 6.26245Z"
//                       ></path>
//                     </svg>
//                   )}
//                 </button>
//                 {!isMobile && (
//                   <div className="ml-2 flex items-center">
//                     <input
//                       type="range"
//                       min="0"
//                       max="1"
//                       step="0.01"
//                       value={isMuted ? 0 : volume}
//                       onChange={changeVolume}
//                       className={cn(
//                         "w-24 h-1 rounded-full appearance-none outline-none backdrop-blur-sm",
//                         "[&::-webkit-slider-thumb]:appearance-none",
//                         "[&::-webkit-slider-thumb]:h-3",
//                         "[&::-webkit-slider-thumb]:w-3",
//                         "[&::-webkit-slider-thumb]:rounded-full",
//                         "[&::-webkit-slider-thumb]:bg-white",
//                         "[&::-webkit-slider-thumb]:shadow-md",
//                         "hover:[&::-webkit-slider-thumb]:scale-110",
//                         "transition-all"
//                       )}
//                       style={{
//                         background: isMuted
//                           ? "linear-gradient(to right, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.3) 100%)"
//                           : `linear-gradient(to right, #ef4444 0%, #7f1d1d ${volume * 100
//                           }%, rgba(255,255,255,0.3) ${volume * 100
//                           }%, rgba(255,255,255,0.3) 100%)`,
//                       }}
//                     />
//                   </div>
//                 )}
//               </div>
//             </div>

//             {/* Right Controls */}
//             <div
//               className={cn(
//                 "flex items-center gap-1 sm:gap-3",
//                 isMobile && isLandscape && "gap-0"
//               )}
//             >
//               {/* Episode List Button - Only for TV shows */}
//               {type === "tv" && (
//                 <button
//                   onClick={toggleEpisodeList}
//                   className={cn(
//                     "text-white p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 flex items-center gap-2 hover:bg-white/20 backdrop-blur-sm",
//                     showEpisodeList
//                       ? "bg-white/30 text-white shadow-lg shadow-white/20"
//                       : "hover:text-gray-300",
//                     isMobile && isLandscape && "p-1"
//                   )}
//                   title="Episodes"
//                 >
//                   <svg
//                     xmlns="http://www.w3.org/2000/svg"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                     strokeWidth="1.5"
//                     stroke="currentColor"
//                     className="size-6"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
//                     />
//                   </svg>

//                   {/* Show "Episodes" text only on desktop */}
//                   <span className="hidden md:inline text-base font-medium ml-1">
//                     Episodes
//                   </span>
//                 </button>
//               )}
//               {/* Picture-in-Picture - Hide on mobile portrait */}
//               <button
//                 onClick={togglePictureInPicture}
//                 className={cn(
//                   "text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                   isMobile && "hidden",
//                   isMobile && "p-1"
//                 )}
//               >
//                 <PictureInPicture className="w-6 h-6" />
//               </button>
//               {/* Subtitles Button */}
//               <button
//                 onClick={() => togglePanel("subtitles")}
//                 className={cn(
//                   "text-white p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                   activePanel === "subtitles"
//                     ? "bg-white/30 text-white shadow-lg shadow-white/20"
//                     : "hover:text-gray-300",
//                   isMobile && isLandscape && "p-1"
//                 )}
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   viewBox="0 0 24 24"
//                   className="h-6 w-6 text-[#FFFFFF]"
//                   fill="currentColor"
//                 >
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12ZM6 15.25C5.58579 15.25 5.25 15.5858 5.25 16C5.25 16.4142 5.58579 16.75 6 16.75H10C10.4142 16.75 10.75 16.4142 10.75 16C10.75 15.5858 10.4142 15.25 10 15.25H6ZM7.75 13C7.75 12.5858 7.41421 12.25 7 12.25H6C5.58579 12.25 5.25 12.5858 5.25 13C5.25 13.4142 5.58579 13.75 6 13.75H7C7.41421 13.75 7.75 13.4142 7.75 13ZM11.5 12.25C11.9142 12.25 12.25 12.5858 12.25 13C12.25 13.4142 11.9142 13.75 11.5 13.75H9.5C9.08579 13.75 8.75 13.4142 8.75 13C8.75 12.5858 9.08579 12.25 9.5 12.25H11.5ZM18.75 13C18.75 12.5858 18.4142 12.25 18 12.25H14C13.5858 12.25 13.25 12.5858 13.25 13C13.25 13.4142 13.5858 13.75 14 13.75H18C18.4142 13.75 18.75 13.4142 18.75 13ZM12.5 15.25C12.0858 15.25 11.75 15.5858 11.75 16C11.75 16.4142 12.0858 16.75 12.5 16.75H14C14.4142 16.75 14.75 16.4142 14.75 16C14.75 15.5858 14.4142 15.25 14 15.25H12.5ZM15.75 16C15.75 15.5858 16.0858 15.25 16.5 15.25H18C18.4142 15.25 18.75 15.5858 18.75 16C18.75 16.4142 18.4142 16.75 18 16.75H16.5C16.0858 16.75 15.75 16.4142 15.75 16Z"
//                   ></path>
//                 </svg>
//               </button>

//               {/* Settings */}
//               <button
//                 onClick={() => togglePanel("settings")}
//                 className={cn(
//                   "text-white p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                   activePanel === "settings"
//                     ? "bg-white/30 text-white shadow-lg shadow-white/20"
//                     : "hover:text-gray-300",
//                   isMobile && isLandscape && "p-1"
//                 )}
//               >
//                 <svg
//                   viewBox="0 0 32 32"
//                   className="h-6 w-6 transform transition-transform duration-200 ease-out group-data-[open]:rotate-90 text-[#FFFFFF] vds-icon"
//                   fill="none"
//                   aria-hidden="true"
//                   focusable="false"
//                   xmlns="http://www.w3.org/2000/svg"
//                 >
//                   <path
//                     fillRule="evenodd"
//                     clipRule="evenodd"
//                     d="M13.5722 5.33333C13.2429 5.33333 12.9629 5.57382 12.9132 5.89938L12.4063 9.21916C12.4 9.26058 12.3746 9.29655 12.3378 9.31672C12.2387 9.37118 12.1409 9.42779 12.0444 9.48648C12.0086 9.5083 11.9646 9.51242 11.9255 9.49718L8.79572 8.27692C8.48896 8.15732 8.14083 8.27958 7.9762 8.56472L5.5491 12.7686C5.38444 13.0538 5.45271 13.4165 5.70981 13.6223L8.33308 15.7225C8.3658 15.7487 8.38422 15.7887 8.38331 15.8306C8.38209 15.8867 8.38148 15.9429 8.38148 15.9993C8.38148 16.0558 8.3821 16.1121 8.38332 16.1684C8.38423 16.2102 8.36582 16.2503 8.33313 16.2765L5.7103 18.3778C5.45334 18.5836 5.38515 18.9462 5.54978 19.2314L7.97688 23.4352C8.14155 23.7205 8.48981 23.8427 8.79661 23.723L11.926 22.5016C11.9651 22.4864 12.009 22.4905 12.0449 22.5123C12.1412 22.5709 12.2388 22.6274 12.3378 22.6818C12.3745 22.7019 12.4 22.7379 12.4063 22.7793L12.9132 26.0993C12.9629 26.4249 13.2429 26.6654 13.5722 26.6654H18.4264C18.7556 26.6654 19.0356 26.425 19.0854 26.0995L19.5933 22.7801C19.5997 22.7386 19.6252 22.7027 19.6619 22.6825C19.7614 22.6279 19.8596 22.5711 19.9564 22.5121C19.9923 22.4903 20.0362 22.4862 20.0754 22.5015L23.2035 23.7223C23.5103 23.842 23.8585 23.7198 24.0232 23.4346L26.4503 19.2307C26.6149 18.9456 26.5467 18.583 26.2898 18.3771L23.6679 16.2766C23.6352 16.2504 23.6168 16.2104 23.6177 16.1685C23.619 16.1122 23.6196 16.0558 23.6196 15.9993C23.6196 15.9429 23.619 15.8866 23.6177 15.8305C23.6168 15.7886 23.6353 15.7486 23.668 15.7224L26.2903 13.623C26.5474 13.4172 26.6156 13.0544 26.451 12.7692L24.0239 8.56537C23.8592 8.28023 23.5111 8.15797 23.2043 8.27757L20.0758 9.49734C20.0367 9.51258 19.9927 9.50846 19.9569 9.48664C19.8599 9.42762 19.7616 9.37071 19.6618 9.31596C19.6251 9.2958 19.5997 9.25984 19.5933 9.21843L19.0854 5.89915C19.0356 5.57369 18.7556 5.33333 18.4264 5.33333H13.5722ZM16.0001 20.2854C18.3672 20.2854 20.2862 18.3664 20.2862 15.9993C20.2862 13.6322 18.3672 11.7132 16.0001 11.7132C13.6329 11.7132 11.714 13.6322 11.714 15.9993C11.714 18.3664 13.6329 20.2854 16.0001 20.2854Z"
//                     fill="currentColor"
//                   ></path>
//                 </svg>
//               </button>

//               {/* Fullscreen */}
//               <button
//                 onClick={toggleFullscreen}
//                 className={cn(
//                   "text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm",
//                   isMobile && isLandscape && "p-1"
//                 )}
//               >
//                 {isFullscreen ? (
//                   <svg
//                     className="h-6 w-6"
//                     fill="currentColor"
//                     xmlns="http://www.w3.org/2000/svg"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       fillRule="evenodd"
//                       clipRule="evenodd"
//                       d="M14 1.25C14.4142 1.25 14.75 1.58579 14.75 2C14.75 3.90682 14.7516 5.26149 14.8898 6.28915C15.025 7.29524 15.2787 7.87489 15.7019 8.2981C16.1251 8.72131 16.7048 8.97498 17.7108 9.11024C18.7385 9.24841 20.0932 9.25 22 9.25C22.4142 9.25 22.75 9.58579 22.75 10C22.75 10.4142 22.4142 10.75 22 10.75H21.9436C20.1058 10.75 18.6502 10.75 17.511 10.5969C16.3386 10.4392 15.3896 10.1071 14.6412 9.35876C13.8929 8.61039 13.5608 7.66145 13.4031 6.48902C13.25 5.34981 13.25 3.89417 13.25 2.05641V2C13.25 1.58579 13.5858 1.25 14 1.25ZM10 1.25C10.4142 1.25 10.75 1.58579 10.75 2V2.05641C10.75 3.89417 10.75 5.34981 10.5969 6.48902C10.4392 7.66145 10.1071 8.61039 9.35876 9.35876C8.61039 10.1071 7.66145 10.4392 6.48902 10.5969C5.34981 10.75 3.89417 10.75 2.05641 10.75H2C1.58579 10.75 1.25 10.4142 1.25 10C1.25 9.58579 1.58579 9.25 2 9.25C3.90682 9.25 5.26149 9.24841 6.28915 9.11024C7.29524 8.97498 7.87489 8.72131 8.2981 8.2981C8.72131 7.87489 8.97498 7.29524 9.11024 6.28915C9.24841 5.26149 9.25 3.90682 9.25 2C9.25 1.58579 9.58579 1.25 10 1.25ZM1.25 14C1.25 13.5858 1.58579 13.25 2 13.25H2.05641C3.89417 13.25 5.34981 13.25 6.48902 13.4031C7.66145 13.5608 8.61039 13.8929 9.35876 14.6412C10.1071 15.3896 10.4392 16.3386 10.5969 17.511C10.75 18.6502 10.75 20.1058 10.75 21.9436V22C10.75 22.4142 10.4142 22.75 10 22.75C9.58579 22.75 9.25 22.4142 9.25 22C9.25 20.0932 9.24841 18.7385 9.11024 17.7108C8.97498 16.7048 8.72131 16.1251 8.2981 15.7019C7.87489 15.2787 7.29524 15.025 6.28915 14.8898C5.26149 14.7516 3.90682 14.75 2 14.75C1.58579 14.75 1.25 14.4142 1.25 14ZM21.9436 13.25H22C22.4142 13.25 22.75 13.5858 22.75 14C22.75 14.4142 22.4142 14.75 22 14.75C20.0932 14.75 18.7385 14.7516 17.7108 14.8898C16.7048 15.025 16.1251 15.2787 15.7019 15.7019C15.2787 16.1251 15.025 16.7048 14.8898 17.7108C14.7516 18.7385 14.75 20.0932 14.75 22C14.75 22.4142 14.4142 22.75 14 22.75C13.5858 22.75 13.25 22.4142 13.25 22V21.9436C13.25 20.1058 13.25 18.6502 13.4031 17.511C13.5608 16.3386 13.8929 15.3896 14.6412 14.6412C15.3896 13.8929 16.3386 13.5608 17.511 13.4031C18.6502 13.25 20.1058 13.25 21.9436 13.25Z"
//                     ></path>
//                   </svg>
//                 ) : (
//                   <svg
//                     xmlns="http://www.w3.org/2000/svg"
//                     viewBox="0 0 24 24"
//                     className="h-6 w-6"
//                     fill="currentColor"
//                   >
//                     <path
//                       fillRule="evenodd"
//                       clipRule="evenodd"
//                       d="M9.94358 1.25L10 1.25C10.4142 1.25 10.75 1.58579 10.75 2C10.75 2.41421 10.4142 2.75 10 2.75C8.09318 2.75 6.73851 2.75159 5.71085 2.88976C4.70476 3.02502 4.12511 3.27869 3.7019 3.7019C3.27869 4.12511 3.02502 4.70476 2.88976 5.71085C2.75159 6.73851 2.75 8.09318 2.75 10C2.75 10.4142 2.41421 10.75 2 10.75C1.58579 10.75 1.25 10.4142 1.25 10L1.25 9.94358C1.24998 8.10582 1.24997 6.65019 1.40314 5.51098C1.56076 4.33856 1.89288 3.38961 2.64124 2.64124C3.38961 1.89288 4.33856 1.56076 5.51098 1.40314C6.65019  1.24997 8.10582 1.24998 9.94358 1.25ZM18.2892 2.88976C17.2615 2.75159 15.9068 2.75 14 2.75C13.5858 2.75 13.25 2.41421 13.25 2C13.25 1.58579 13.5858 1.25 14 1.25L14.0564 1.25C15.8942 1.24998 17.3498 1.24997 18.489 1.40314C19.6614 1.56076 20.6104 1.89288 21.3588 2.64124C22.1071 3.38961 22.4392 4.33856 22.5969 5.51098C22.75 6.65019 22.75 8.10583 22.75 9.94359V10C22.75 10.4142 22.4142 10.75 22 10.75C21.5858 10.75 21.25 10.4142 21.25 10C21.25 8.09318 21.2484 6.73851 21.1102 5.71085C20.975 4.70476 20.7213 4.12511 20.2981 3.7019C19.8749 3.27869 19.2952 3.02502 18.2892 2.88976ZM2 13.25C2.41421 13.25 2.75 13.5858 2.75 14C2.75 15.9068 2.75159 17.2615 2.88976 18.2892C3.02502 19.2952 3.27869 19.8749 3.7019 20.2981C4.12511 20.7213 4.70476 20.975 5.71085 21.1102C6.73851 21.2484 8.09318 21.25 10 21.25C10.4142 21.25 10.75 21.5858 10.75 22C10.75 22.4142 10.4142 22.75 10 22.75H9.94359C8.10583 22.75 6.65019 22.75 5.51098 22.5969C4.33856 22.4392 3.38961 22.1071 2.64124 21.3588C1.89288 20.6104 1.56076 19.6614 1.40314 18.489C1.24997 17.3498 1.24998 15.8942 1.25 14.0564L1.25 14C1.25 13.5858 1.58579 13.25 2 13.25ZM22 13.25C22.4142 13.25 22.75 13.5858 22.75 14V14.0564C22.75 15.8942 22.75 17.3498 22.5969 18.489C22.4392 19.6614 22.1071 20.6104 21.3588 21.3588C20.6104 22.1071 19.6614 22.4392 18.489 22.5969C17.3498 22.75 15.8942 22.75 14.0564 22.75H14C13.5858 22.75 13.25 22.4142 13.25 22C13.25 21.5858 13.5858 21.25 14 21.25C15.9068 21.25 17.2615 21.2484 18.2892 21.1102C19.2952 20.975 19.8749 20.7213 20.2981 20.2981C20.7213 19.8749 20.975 19.2952 21.1102 18.2892C21.2484 17.2615 21.25 15.9068 21.25 14C21.25 13.5858 21.5858 13.25 22 13.25Z"
//                     ></path>
//                   </svg>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ======================================================================================== */}
//       {/* ENHANCED PANELS WITH GLASSY EFFECTS */}
//       {/* ======================================================================================== */}

//       {activePanel === "settings" && (
//         <div
//           className={cn(
//             "absolute z-50 backdrop-blur-xl bg-black/40 border border-white/20 rounded-3xl shadow-2xl hover:shadow-white/10 transition-all duration-300",
//             isMobile && isLandscape
//               ? "bottom-16 right-4 w-80 max-h-[80vh] overflow-y-auto"
//               : isMobile
//                 ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                 : "bottom-16 right-4 sm:right-6 w-80"
//           )}
//         >
//           {/* 2x2 Grid */}
//           <div className="grid grid-cols-2 gap-3 p-4">
//             <button
//               className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
//               onClick={() => togglePanel("quality")}
//             >
//               <p className="text-sm text-gray-300">Quality</p>
//               <p className="text-white font-medium text-sm">
//                 {qualityOptions.find((q) => q.value === selectedQuality)
//                   ?.label || selectedQuality}
//               </p>
//             </button>

//             <button
//               className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
//               onClick={() => togglePanel("server")}
//             >
//               <p className="text-sm text-gray-300">Source</p>
//               <p className="text-white font-medium text-sm flex items-center gap-1">
//                 {getCurrentServerName().slice(0, 12)}
//               </p>
//             </button>

//             <button
//               className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
//               onClick={() => togglePanel("subtitles")}
//             >
//               <p className="text-sm text-gray-300">Subtitles</p>
//               <p className="text-white font-medium text-sm">
//                 {getSelectedSubtitleLang()}
//               </p>
//             </button>

//             <button
//               className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
//               onClick={() => togglePanel("language")}
//             >
//               <p className="text-sm text-gray-300">Audio</p>
//               <p className="text-white font-medium text-sm">
//                 {selectedLanguage || "Original"}
//               </p>
//             </button>
//           </div>

//           {/* Actions */}
//           <div className="px-4 pt-2 space-y-3">
//             <button
//               onClick={toggleDownloadPanel}
//               className="flex items-center justify-between w-full text-white hover:text-blue-400 transition-all duration-300 p-2 rounded-lg hover:bg-white/10"
//             >
//               <span>Download</span>
//               <Download className="w-4 h-4 text-white/80" />
//             </button>
//           </div>

//           {/* Divider */}
//           <div className="my-4 mx-4 border-t border-white/20" />

//           {/* Enable Subtitles Toggle */}
//           <div className="px-4 pb-4 space-y-3">
//             <div className="flex  p-2 items-center justify-between">
//               <span className="text-white">Enable Subtitles</span>
//               <div
//                 onClick={() => {
//                   const newValue = !enableSubtitles;
//                   setEnableSubtitles(newValue);

//                   // If enabling subtitles and none are selected, auto-search
//                   if (newValue && !selectedSubtitle) {
//                     autoSearchAndApplySubtitles("en");
//                   } else if (!newValue) {
//                     handleSubtitleChange(null);
//                   }
//                 }}
//                 className={cn(
//                   "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 cursor-pointer backdrop-blur-sm border border-white/20",
//                   enableSubtitles
//                     ? "bg-indigo-500 shadow-lg shadow-indigo-500/30"
//                     : "bg-gray-600"
//                 )}
//               >
//                 <span
//                   className={cn(
//                     "absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-300",
//                     enableSubtitles ? "translate-x-5" : "translate-x-0"
//                   )}
//                 />
//               </div>
//             </div>

//             <button
//               className="flex items-center justify-between w-full text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-300"
//               onClick={() => togglePanel("speed")}
//             >
//               <span>Playback settings</span>
//               <ChevronRight className="w-4 h-4 text-white/80" />
//             </button>
//           </div>
//         </div>
//       )}
//       {/* ======================================================================================== */}
//       {/* LANGUAGE PANEL */}
//       {/* ======================================================================================== */}
//       {activePanel === "language" && (
//         <div
//           className={cn(
//             "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//             isMobile && isLandscape
//               ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//               : isMobile
//                 ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                 : "bottom-16 right-4 sm:right-6 w-80"
//           )}
//         >
//           {/* Header */}
//           <div className="flex items-center justify-between p-4 ">
//             <button
//               onClick={() => setActivePanel("settings")}
//               className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20"
//             >
//               <ChevronLeft className="size-6" />
//             </button>
//             <span className="text-white font-semibold text-base tracking-wide">
//               Audio Languages
//             </span>
//             <div className="w-6" />
//           </div>

//           {/* Language Options */}
//           {/* Language Options */}
//           <div className="p-2 space-y-2">
//             {languageOptions.length === 0 ? (
//               <button
//                 className="flex items-center justify-between w-full px-2 py-2 rounded-xl bg-white/10 text-white border border-white/10 hover:border-white/30 transition-all duration-300"
//                 onClick={() => {
//                   setSelectedLanguage("");
//                   setActivePanel(null);
//                 }}
//               >
//                 <span className="font-medium">Original Audio</span>
//                 <div className="bg-red-500 rounded-full p-1 shadow-lg shadow-red-500/30">
//                   <Check className="w-4 h-4 text-white" />
//                 </div>
//               </button>
//             ) : (
//               languageOptions.map((language) => (
//                 <button
//                   key={language.quality}
//                   className={cn(
//                     "flex items-center justify-between w-full px-2 py-2 rounded-xl transition-all duration-300 backdrop-blur-sm border hover:scale-105 transform",
//                     selectedLanguage === language.quality
//                       ? "bg-white/20 text-white font-medium border-white/30 shadow-lg shadow-white/10"
//                       : "text-gray-300 hover:bg-white/10 border-white/10 hover:border-white/20"
//                   )}
//                   onClick={() => handleLanguageChange(language.quality)}
//                 >
//                   <span>{language.quality}</span>
//                   {selectedLanguage === language.quality && (
//                     <div className="bg-red-500 rounded-full p-1 shadow-lg shadow-red-500/30">
//                       <Check className="w-4 h-4 text-white" />
//                     </div>
//                   )}
//                 </button>
//               ))
//             )}
//           </div>
//         </div>
//       )}
//       {/* ======================================================================================== */}
//       {/* QUALITY SELECTION PANEL */}
//       {/* ======================================================================================== */}

//       {activePanel === "quality" && (
//         <div
//           className={cn(
//             "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//             isMobile && isLandscape
//               ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//               : isMobile
//                 ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                 : "bottom-16 right-4 sm:right-6 w-80"
//           )}
//         >
//           {/* Header */}
//           <div className="flex items-center justify-between p-4 ">
//             <button
//               onClick={() => setActivePanel("settings")}
//               className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20"
//             >
//               <ChevronLeft className="size-6" />
//             </button>
//             <span className="text-white font-semibold text-base tracking-wide">
//               Select Quality
//             </span>
//             <div className="w-6" />
//           </div>
//           <div className="p-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
//             {qualityOptions.map((quality, idx) => (
//               <motion.button
//                 key={`quality-${quality.value}-${idx}`}
//                 onClick={() => {
//                   debouncedQualityChange(quality.value);
//                 }}
//                 className={cn(
//                   "flex items-center justify-between w-full px-2 py-2 text-left rounded-lg bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white hover:text-indigo-400 transition-colors mb-2",
//                   (selectedQuality === quality.value ||
//                     (selectedQuality === "Auto" && quality.value === "auto")) &&
//                   "bg-white/20 text-white font-medium border-white/30 shadow-lg shadow-white/10"
//                 )}
//                 whileHover={{ scale: 1.02 }}
//                 whileTap={{ scale: 0.98 }}
//               >
//                 <span>{quality.label}</span>
//                 {(selectedQuality === quality.value ||
//                   (selectedQuality === "Auto" && quality.value === "auto")) && (
//                     <Check className="size-5 text-white" />
//                   )}
//               </motion.button>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* ======================================================================================== */}
//       {/* ENHANCED EPISODE LIST OVERLAY */}
//       {/* ======================================================================================== */}
//       <AnimatePresence>
//         {showEpisodeList && type === "tv" && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 20 }}
//             transition={{ duration: 0.2 }}
//             className={cn(
//               "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//               isMobile && isLandscape
//                 ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//                 : isMobile
//                   ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                   : "bottom-16 right-4 max-h-[80vh] sm:right-6 w-80"
//             )}
//             style={{ top: "unset", left: "unset" }}
//           >
//             <div className="flex flex-col h-full">
//               {/* Header */}
//               <div className="flex items-center justify-between p-4 ">
//                 <button
//                   onClick={() => {
//                     if (expandedSeason) setExpandedSeason(null);
//                     else setShowEpisodeList(false);
//                   }}
//                   className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20"
//                 >
//                   <ChevronLeft className="size-6" />
//                 </button>
//                 <span className="text-white font-semibold text-base tracking-wide">
//                   {expandedSeason ? "Episodes" : "Seasons"}
//                 </span>
//                 <div className="w-6" />
//               </div>

//               <div className="flex-1 overflow-y-auto p-3 max-h-[60vh] custom-scrollbar">
//                 {/* SEASON LIST PANEL */}
//                 {!expandedSeason && (
//                   <div className="flex flex-col gap-2">
//                     {seasons.length === 0 ? (
//                       <div className="flex items-center justify-center h-32 text-white/50">
//                         No seasons found
//                       </div>
//                     ) : (
//                       seasons.map((season) => {
//                         const seasonNum = season.season_number.toString();
//                         const seasonEpisodes = episodeCache[seasonNum] || [];
//                         const isSeasonLoading =
//                           loadingSeasonNumbers.has(seasonNum);
//                         const isSelected = selectedSeason === seasonNum;

//                         return (
//                           <button
//                             key={season.id}
//                             onClick={() => {
//                               setExpandedSeason(seasonNum);
//                               if (!episodeCache[seasonNum]) {
//                                 fetchEpisodes(tmdbId, seasonNum);
//                               }
//                             }}
//                             className={cn(
//                               "flex items-center justify-between w-full px-2 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 text-white font-medium border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform mb-2",
//                               isSelected &&
//                               "bg-white/20 text-white font-medium border-white/30 shadow-lg shadow-white/10"
//                             )}
//                           >
//                             <div className="flex items-center gap-3">
//                               <span>Season {season.season_number}</span>
//                               {isSeasonLoading && (
//                                 <Loader2 className="w-4 h-4 animate-spin text-white/70" />
//                               )}
//                               {seasonEpisodes.length > 0 &&
//                                 !isSeasonLoading && (
//                                   <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/70">
//                                     {seasonEpisodes.length} episodes
//                                   </span>
//                                 )}
//                             </div>
//                             <ChevronRight className="w-5 h-5" />
//                           </button>
//                         );
//                       })
//                     )}
//                   </div>
//                 )}

//                 {/* EPISODE LIST PANEL */}
//                 {expandedSeason && (
//                   <motion.div
//                     initial={{ opacity: 0, x: 40 }}
//                     animate={{ opacity: 1, x: 0 }}
//                     exit={{ opacity: 0, x: 40 }}
//                     className="flex flex-col gap-1"
//                   >
//                     {loadingSeasonNumbers.has(expandedSeason) &&
//                       (!episodeCache[expandedSeason] ||
//                         episodeCache[expandedSeason].length === 0) ? (
//                       <div className="flex items-center justify-center h-16">
//                         <Loader2 className="w-4 h-4 animate-spin text-white/70" />
//                       </div>
//                     ) : (episodeCache[expandedSeason] || []).length === 0 ? (
//                       <div className="text-white/50 px-2 py-2">
//                         No episodes found
//                       </div>
//                     ) : (
//                       (episodeCache[expandedSeason] || []).map((ep) => {
//                         const isCurrentEpisode =
//                           selectedSeason === expandedSeason &&
//                           selectedEpisode === ep.episode_number.toString();

//                         return (
//                           <button
//                             key={ep.id}
//                             onClick={() => {
//                               handleEpisodeSelect(
//                                 expandedSeason,
//                                 ep.episode_number.toString()
//                               );
//                               setExpandedSeason(null);
//                               setShowEpisodeList(false);
//                             }}
//                             className={cn(
//                               "w-full text-left px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 text-white flex flex-col gap-1 mb-2 border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform",
//                               isCurrentEpisode &&
//                               "bg-white/20 text-white font-bold border-white/30 shadow-lg shadow-white/10"
//                             )}
//                           >
//                             <div className="flex items-center gap-2 justify-between">
//                               <div className="flex items-center gap-2 min-w-0">
//                                 <span className="font-semibold text-sm">
//                                   {ep.episode_number}.
//                                 </span>
//                                 <span className="font-medium text-sm truncate">
//                                   {ep.name}
//                                 </span>
//                               </div>
//                               {isCurrentEpisode && (
//                                 <span className="ml-2 text-green-400 flex items-center">
//                                   <Check className="w-5 h-5" />
//                                 </span>
//                               )}
//                             </div>
//                           </button>
//                         );
//                       })
//                     )}
//                   </motion.div>
//                 )}
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//       {/* ======================================================================================== */}
//       {/* PLAYBACK SPEED PANEL */}
//       {/* ======================================================================================== */}
//       <AnimatePresence>
//         {activePanel === "speed" && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 20 }}
//             transition={{ duration: 0.2 }}
//             className={cn(
//               "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300 custom-scrollbar ",
//               isMobile
//                 ? isLandscape
//                   ? "bottom-16 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                   : "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                 : "bottom-16 right-4 sm:right-6 w-80"
//             )}
//           >
//             {/* Header */}
//             <div className="flex items-center justify-between p-4">
//               <button
//                 onClick={() => setActivePanel(null)}
//                 className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20
//                 custom-scrollbar"
//               >
//                 <ChevronLeft className="size-6" />
//               </button>
//               <span className="text-white font-semibold text-base tracking-wide">
//                 Playback Speed
//               </span>
//               <div className="w-6" />
//             </div>
//             <div className="px-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
//               {PLAYBACK_RATES.map((rate) => (
//                 <button
//                   key={rate}
//                   className={cn(
//                     "flex items-center justify-between w-full px-2 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 text-white font-medium border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform  mb-2",
//                     playbackRate === rate &&
//                     "bg-white/20 text-white font-medium border-white/30 shadow-lg shadow-white/10"
//                   )}
//                   onClick={() => handlePlaybackRateChange(rate)}
//                 >
//                   <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
//                   {playbackRate === rate && (
//                     <div className="bg-red-500 rounded-full p-1">
//                       <Check className="size-4 text-white" />
//                     </div>
//                   )}
//                 </button>
//               ))}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* ======================================================================================== */}
//       {/* SERVER PANEL - FIXED */}
//       {/* ======================================================================================== */}

//       {activePanel === "server" && (
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           exit={{ opacity: 0, y: 20 }}
//           transition={{ duration: 0.2 }}
//           className={cn(
//             "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//             isMobile && isLandscape
//               ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//               : isMobile
//                 ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                 : "bottom-16 right-4 sm:right-6 w-80"
//           )}
//         >
//           {/* Glassy Header */}
//           <div className="flex items-center justify-between p-4">
//             <button
//               onClick={() => setActivePanel(null)}
//               className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20"
//             >
//               <ChevronLeft className="size-6" />
//             </button>
//             <span className="text-white font-semibold text-base tracking-wide">
//               Select Source
//             </span>
//             <div className="w-6" />
//           </div>
//           <div className="px-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
//             {/* Direct Servers Section */}
//             <div className="my-2 mx-0">
//               <div className="px-2 py-2 text-xs font-bold text-white/70 uppercase tracking-widest bg-white/5 rounded-xl">
//                 Direct Servers - No Ads
//               </div>
//               {SERVERS.filter((s) => s.type === "direct").map((server) => {
//                 const serverStatus = serverStatuses.get(server.id);
//                 const isCurrentServer = currentServer === server.id;
//                 const isLoading = serverLoadingId === server.id;
//                 const hasError = serverErrorIds.includes(server.id);

//                 // Only show tick if status is 'success' AND there is a valid mainUrl
//                 const isSuccess =
//                   serverStatus?.status === "success" &&
//                   serverStatus.data &&
//                   typeof serverStatus.data.mainUrl === "string" &&
//                   serverStatus.data.mainUrl.startsWith("http");

//                 return (
//                   <motion.button
//                     key={server.id}
//                     className={cn(
//                       "flex items-center justify-between w-full px-4 py-2 mx-auto my-2 text-left transition-all rounded-xl border border-white/10 shadow-sm group relative",
//                       isCurrentServer
//                         ? "bg-green-500/20 border-green-500 text-green-300"
//                         : "bg-white/5 hover:bg-white/10"
//                     )}
//                     onClick={() => handleDirectServerChange(server.id)}
//                     whileHover={{ scale: 1.01 }}
//                     whileTap={{ scale: 0.98 }}
//                     disabled={server.working === false || isLoading}
//                     style={{ opacity: server.working === false ? 0.5 : 1 }}
//                   >
//                     <div className="flex flex-col items-start">
//                       <span className="font-semibold text-base">
//                         {server.name}
//                       </span>
//                       {server.features && server.features.length > 0 && (
//                         <span className="text-[11px] font-normal mt-0.5 text-green-400">
//                           {server.features.join(" • ")}
//                         </span>
//                       )}
//                     </div>
//                     <span className="flex items-center relative w-8 h-5">
//                       {/* Loading indicator */}
//                       {isLoading && (
//                         <div className="absolute inset-0 flex items-center justify-center">
//                           <Loader2 className="w-4 h-4 animate-spin text-white/70" />
//                         </div>
//                       )}

//                       {/* Status icons */}
//                       {!isLoading && hasError ? (
//                         <X className="h-5 w-5 text-red-500" />
//                       ) : !isLoading && isSuccess ? (
//                         <Check className="h-5 w-5 text-green-400" />
//                       ) : !isLoading && server.working ? (
//                         <Wifi className="h-5 w-5 text-green-400" />
//                       ) : !server.working ? (
//                         <X className="h-5 w-5 text-red-500" />
//                       ) : null}
//                     </span>
//                   </motion.button>
//                 );
//               })}
//             </div>
//             {/* Embed Servers Section */}
//             <div>
//               <div className="px-6 py-3 text-xs font-bold text-white/70 uppercase tracking-widest bg-white/5 rounded-xl">
//                 Embed Servers - Ads Possible
//               </div>
//               {SERVERS.filter((s) => s.type === "embed").map((server) => {
//                 const isCurrentServer = currentServer === server.id;

//                 return (
//                   <motion.button
//                     key={server.id}
//                     className={cn(
//                       "flex items-center justify-between w-full px-4 py-2 mx-auto my-2 text-left transition-all rounded-xl border border-white/10 shadow-sm group",
//                       isCurrentServer
//                         ? "bg-blue-500/20 border-blue-500 text-blue-300"
//                         : "bg-white/5 hover:bg-white/10"
//                     )}
//                     onClick={() => handleEmbedServerChange(server.id)}
//                     whileHover={{ scale: 1.01 }}
//                     whileTap={{ scale: 0.98 }}
//                     disabled={server.working === false}
//                     style={{ opacity: server.working === false ? 0.5 : 1 }}
//                   >
//                     <div className="flex flex-col items-start">
//                       <span className="font-semibold text-base">
//                         {server.name}
//                       </span>
//                       {server.features && server.features.length > 0 && (
//                         <span className="text-[11px] font-normal mt-0.5 text-blue-400">
//                           {server.features.join(" • ")}
//                         </span>
//                       )}
//                     </div>
//                     <span>
//                       {server.working ? (
//                         <Wifi className="h-5 w-5 text-green-400" />
//                       ) : (
//                         <Wifi
//                           className="h-5 w-5 text-red-500"
//                           style={{ transform: "rotate(45deg)" }}
//                         />
//                       )}
//                     </span>
//                   </motion.button>
//                 );
//               })}
//             </div>
//           </div>
//         </motion.div>
//       )}
//       {/* ======================================================================================== */}
//       {/* SUBTITLE PANEL */}
//       {/* ======================================================================================== */}
//       <AnimatePresence>
//         {activePanel === "subtitles" && (
//           <div
//             className={cn(
//               "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//               isMobile && isLandscape
//                 ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//                 : isMobile
//                   ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                   : "bottom-16 right-4 sm:right-6 w-80"
//             )}
//           >
//             <div className="flex items-center justify-between p-4">
//               <button
//                 onClick={() => setActivePanel(null)}
//                 className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20"
//               >
//                 <ChevronLeft className="size-6" />
//               </button>
//               <span className="text-white font-semibold text-base tracking-wide">
//                 Subtitles
//               </span>
//               <button
//                 onClick={() => setActivePanel("subtitleCustomize")}
//                 className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition text-sm"
//               >
//                 <Palette className="size-5" />
//               </button>
//             </div>

//             <div className="p-2 space-y-2">
//               {/* Upload subtitle file */}
//               <label className="flex items-center justify-between w-full px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
//                 <span className="text-white">Upload subtitle file</span>
//                 <CloudUpload className="size-5 text-white" />
//                 <input
//                   ref={fileInputRef}
//                   type="file"
//                   accept=".srt,.vtt,.sub,.sbv,.ass"
//                   className="hidden"
//                   onChange={handleSubtitleUpload}
//                 />
//               </label>

//               {/* Search Wyzie Subtitles Button */}
//               <button
//                 className="flex items-center justify-between w-full px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
//                 onClick={() => {
//                   setCurrentProvider("wyzie");
//                   togglePanel("openSubtitlesLanguages");
//                 }}
//               >
//                 <span className="text-white">Search Wyzie Subtitles</span>
//                 <Search className="size-5 text-white" />
//               </button>

//               {/* Search OpenSubtitles Button */}
//               <button
//                 className="flex items-center justify-between w-full px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
//                 onClick={() => {
//                   setCurrentProvider("opensubtitles");
//                   togglePanel("openSubtitlesLanguages");
//                 }}
//               >
//                 <span className="text-white">Search OpenSubtitles</span>
//                 <Search className="size-5 text-white" />
//               </button>

//               {/* Uploaded Subtitles */}
//               {uploadedSubtitles.length > 0 && (
//                 <div className="mt-2">
//                   <div className="text-[#888] text-xs font-medium uppercase tracking-wider px-4 pb-2">
//                     Your Subtitles
//                   </div>
//                   {uploadedSubtitles.map((subtitle, index) => (
//                     <button
//                       key={`${subtitle.url}-${index}`}
//                       className={cn(
//                         "flex items-center justify-between w-full px-2 py-2 rounded-lg transition-colors",
//                         selectedSubtitle === subtitle.url
//                           ? "bg-white/10 text-white font-medium"
//                           : "text-gray-300 hover:bg-white/5"
//                       )}
//                       onClick={() => handleSubtitleChange(subtitle)}
//                     >
//                       <span
//                         className={cn(
//                           "truncate max-w-[200px]",
//                           selectedSubtitle === subtitle.url ? "font-medium" : ""
//                         )}
//                         title={subtitle.lang}
//                       >
//                         {subtitle.lang}
//                       </span>
//                       {selectedSubtitle === subtitle.url && (
//                         <div className="bg-red-500 rounded-full p-1">
//                           <Check className="size-4 text-white" />
//                         </div>
//                       )}
//                     </button>
//                   ))}
//                 </div>
//               )}

//               {/* Subtitle actions/info */}
//               <div className="px-4 pt-4">
//                 {!isMobile && (
//                   <div className="text-[#888] text-xs mb-2">
//                     You can customize subtitle appearance in the subtitle
//                     settings panel.
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}
//       </AnimatePresence>
//       {/* SUBTITLE CUSTOMIZATION PANEL */}
//       <AnimatePresence>
//         {/* === MAIN SUBTITLE PANEL === */}
//         {activePanel === "subtitleCustomize" && (
//           <div
//             className={cn(
//               "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//               isMobile && isLandscape
//                 ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//                 : isMobile
//                   ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                   : "bottom-16 right-4 sm:right-6 w-80"
//             )}
//           >
//             {/* Header */}
//             <div className="flex items-center justify-between p-4">
//               <button
//                 onClick={() => setActivePanel("subtitles")}
//                 className="text-white hover:text-indigo-400 hover:scale-110 active:scale-90 transition"
//               >
//                 <ChevronLeft className="w-5 h-5" />
//               </button>
//               <span className="text-white font-medium">Subtitle Settings</span>
//               <button onClick={() => setActivePanel(null)}>
//                 <X className="w-5 h-5 text-white hover:text-indigo-400 transition" />
//               </button>
//             </div>

//             {/* Settings Content */}
//             <div className="p-2 space-y-4">
//               {/* Size */}
//               <div className="space-y-1.5">
//                 <div className="flex items-center justify-between">
//                   <span className="text-neutral-400 text-xs">Size</span>
//                   <span className="text-neutral-500 text-xs font-mono">
//                     {prefs.subtitleSize || 20}px
//                   </span>
//                 </div>
//                 <input
//                   type="range"
//                   min="0"
//                   max="100"
//                   step="1"
//                   value={prefs.subtitleSize || 20}
//                   onChange={(e) =>
//                     handlePreferencesChange({
//                       ...preferences,
//                       subtitleSize: Number(e.target.value),
//                     })
//                   }
//                   className="w-full h-1.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/10 shadow-lg"
//                 />
//               </div>

//               {/* Color */}
//               <div className="space-y-1.5">
//                 <span className="text-neutral-400 text-xs">Color</span>
//                 <div className="flex gap-2">
//                   <input
//                     type="color"
//                     value={prefs.subtitleColor || "#ffffff"}
//                     onChange={(e) =>
//                       handlePreferencesChange({
//                         ...preferences,
//                         subtitleColor: e.target.value,
//                       })
//                     }
//                     className="w-14 h-9 bg-transparent  cursor-pointer"
//                   />
//                   <input
//                     type="text"
//                     value={prefs.subtitleColor || "#ffffff"}
//                     onChange={(e) =>
//                       handlePreferencesChange({
//                         ...preferences,
//                         subtitleColor: e.target.value,
//                       })
//                     }
//                     className="flex-1 bg-white/10 border border-neutral-800 text-white px-3 rounded-full text-sm"
//                   />
//                 </div>
//               </div>

//               {/* Position */}
//               <div className="space-y-1.5">
//                 <div className="flex items-center justify-between">
//                   <span className="text-neutral-400 text-xs">
//                     Vertical Position
//                   </span>
//                   <span className="text-neutral-500 text-xs font-mono">
//                     {prefs.subtitlePosition || 0}%
//                   </span>
//                 </div>
//                 <input
//                   type="range"
//                   min="0"
//                   max="100"
//                   value={prefs.subtitlePosition || 0}
//                   onChange={(e) =>
//                     handlePreferencesChange({
//                       ...preferences,
//                       subtitlePosition: Number(e.target.value),
//                     })
//                   }
//                   className="w-full h-1.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/10 shadow-lg"
//                 />
//               </div>

//               {/* === FONT NAVIGATION BUTTON === */}
//               <div className="space-y-1.5">
//                 <span className="text-neutral-400 text-xs">Font</span>
//                 <button
//                   onClick={() => setActivePanel("fontSelection")}
//                   className="w-full flex items-center justify-between  border border-neutral-800 text-white h-9 pl-3 pr-10 rounded-lg hover:bg-neutral-800/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-sm cursor-pointer"
//                   style={{ fontFamily: prefs.subtitleFont || "Roboto" }}
//                 >
//                   <span className="truncate">
//                     {prefs.subtitleFont || "Roboto"}
//                   </span>
//                 </button>
//               </div>

//               {/* Advanced Settings */}
//               <div className="space-y-3">
//                 <h5 className="text-white font-medium text-xs">
//                   Advanced Settings
//                 </h5>
//                 <div className="space-y-3">
//                   {/* Background Opacity */}
//                   <div className="space-y-1.5">
//                     <div className="flex items-center justify-between">
//                       <span className="text-neutral-400 text-xs">
//                         Background Opacity
//                       </span>
//                       <span className="text-neutral-500 text-xs font-mono">
//                         {Math.round(
//                           (prefs.subtitleBackgroundOpacity || 0.0) * 100
//                         )}
//                         %
//                       </span>
//                     </div>
//                     <input
//                       type="range"
//                       min="0"
//                       max="1"
//                       step="0.1"
//                       value={prefs.subtitleBackgroundOpacity || 0.0}
//                       onChange={(e) =>
//                         handlePreferencesChange({
//                           ...preferences,
//                           subtitleBackgroundOpacity: Number(e.target.value),
//                         })
//                       }
//                       className="w-full h-1.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/10 shadow-lg"
//                     />
//                   </div>

//                   {/* Background Blur */}
//                   <div className="space-y-1.5">
//                     <div className="flex items-center justify-between">
//                       <span className="text-neutral-400 text-xs">
//                         Background Blur
//                       </span>
//                       <span className="text-neutral-500 text-xs font-mono">
//                         {prefs.subtitleBackgroundBlur || 0}px
//                       </span>
//                     </div>
//                     <input
//                       type="range"
//                       min="0"
//                       max="10"
//                       value={prefs.subtitleBackgroundBlur || 0}
//                       onChange={(e) =>
//                         handlePreferencesChange({
//                           ...preferences,
//                           subtitleBackgroundBlur: Number(e.target.value),
//                         })
//                       }
//                       className="w-full h-1.5 bg-white/20 rounded-full backdrop-blur-sm border border-white/10 shadow-lg"
//                     />
//                   </div>

//                   {/* Bold Toggle */}
//                   <div className="flex items-center justify-between px-3 py-2 rounded-full">
//                     <div>
//                       <span className="text-white text-xs font-medium">
//                         Bold Text
//                       </span>
//                       <p className="text-neutral-500 text-xs">
//                         Make subtitles bold
//                       </p>
//                     </div>
//                     <button
//                       onClick={() =>
//                         handlePreferencesChange({
//                           ...preferences,
//                           subtitleBold: !prefs.subtitleBold,
//                         })
//                       }
//                       className={`relative w-11 h-6 rounded-full transition-all duration-200 ${prefs.subtitleBold ? "bg-indigo-600" : "bg-neutral-700"
//                         }`}
//                     >
//                       <div
//                         className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-all duration-200 ${prefs.subtitleBold ? "translate-x-5" : "translate-x-0"
//                           }`}
//                       />
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* === FONT SELECTION PANEL – FLAT A-Z LIST, NO OVERFLOW === */}
//         {activePanel === "fontSelection" && (
//           <div
//             className={cn(
//               "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//               isMobile && isLandscape
//                 ? "bottom-16 right-4 w-80"
//                 : isMobile
//                   ? "bottom-40 left-4 right-4"
//                   : "bottom-16 right-4 sm:right-6 w-80"
//             )}
//             style={{ maxHeight: "calc(100vh - 12rem)" }}
//           >
//             {/* Header */}
//             <div className="flex items-center justify-between p-4">
//               <button
//                 onClick={() => setActivePanel("subtitleCustomize")}
//                 className="text-white hover:text-indigo-400 hover:scale-110 active:scale-90 transition"
//               >
//                 <ChevronLeft className="w-5 h-5" />
//               </button>
//               <span className="text-white font-medium">Select Font</span>
//               <button onClick={() => setActivePanel(null)}>
//                 <X className="w-5 h-5 text-white hover:text-indigo-400 transition" />
//               </button>
//             </div>

//             <div className="relative p-3">
//               <input
//                 type="text"
//                 placeholder="Search fonts..."
//                 value={fontSearch}
//                 onChange={(e) => setFontSearch(e.target.value)}
//                 className="w-full pl-8 pr-3 h-8 bg-white/10  border border-white/20 rounded-full text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
//                 autoFocus
//               />
//             </div>

//             {/* Flat A-Z Sorted List */}
//             <div
//               className="overflow-y-auto custom-scrollbar"
//               style={{ maxHeight: "calc(100vh - 16rem)" }}
//             >
//               {fontLoading ? (
//                 <div className="p-8 flex items-center justify-center gap-2 text-neutral-400">
//                   <Loader2 className="w-4 h-4 animate-spin" />
//                   Loading fonts...
//                 </div>
//               ) : fontError ? (
//                 <div className="p-8 text-center text-red-400 text-sm">
//                   {fontError}
//                 </div>
//               ) : filteredFonts.length === 0 ? (
//                 <div className="p-8 text-center text-neutral-500 text-sm">
//                   No fonts found
//                 </div>
//               ) : (
//                 filteredFonts
//                   .sort((a, b) => a.family.localeCompare(b.family))
//                   .map((font, idx) => (
//                     <button
//                       key={`${font.family}-${font.category ?? "unknown"
//                         }-${idx}`}
//                       type="button"
//                       onClick={() => {
//                         handlePreferencesChange({
//                           ...preferences,
//                           subtitleFont: font.family,
//                         });
//                         setActivePanel("subtitleCustomize");
//                       }}
//                       className={cn(
//                         "w-full px-3 py-2 text-left text-sm text-white flex items-center justify-between transition-colors",
//                         prefs.subtitleFont === font.family
//                           ? "bg-indigo-600/30"
//                           : "hover:bg-white/10"
//                       )}
//                       style={{ fontFamily: font.family }}
//                     >
//                       <span className="truncate">{font.family}</span>
//                       {prefs.subtitleFont === font.family && (
//                         <Check className="w-4 h-4 text-indigo-400" />
//                       )}
//                     </button>
//                   ))
//               )}
//             </div>
//           </div>
//         )}
//       </AnimatePresence>
//       {/* ======================================================================================== */}
//       {/* OPENSUBTITLES LANGUAGE SELECTION PANEL */}
//       {/* ======================================================================================== */}
//       <AnimatePresence>
//         {activePanel === "openSubtitlesLanguages" && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 20 }}
//             transition={{ duration: 0.2 }}
//             className={cn(
//               "absolute z-50 rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn",
//               isMobile && isLandscape
//                 ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//                 : isMobile
//                   ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                   : "bottom-16 right-4 sm:right-6 w-80"
//             )}
//           >
//             {/* Glassy Header */}
//             <div className="flex items-center justify-between p-4  ">
//               <button
//                 onClick={() => setActivePanel("subtitles")}
//                 className="text-white hover:text-indigo-400 hover:scale-110 active:scale-90 transition"
//               >
//                 <ChevronLeft className="size-6" />
//               </button>
//               <span className="text-white font-semibold text-base tracking-wide">
//                 Subtitle Language
//               </span>
//               <div className="w-6" />
//             </div>
//             {/* Language List */}
//             <div className="p-3">
//               <div className="flex flex-col gap-2">
//                 {SUBTITLE_LANGUAGES.map((lang) => (
//                   <motion.button
//                     key={lang.code}
//                     onClick={() => {
//                       setOpenSubtitlesLanguage(lang.code);
//                       setActivePanel("openSubtitlesResults");
//                       searchSubtitlesByProvider(lang.code, currentProvider);
//                     }}
//                     className="flex items-center px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white hover:text-indigo-400 transition-colors font-medium"
//                     whileHover={{ scale: 1.03 }}
//                     whileTap={{ scale: 0.97 }}
//                   >
//                     <span className="text-sm">{lang.name}</span>
//                   </motion.button>
//                 ))}
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* ======================================================================================== */}
//       {/* OPENSUBTITLES RESULTS PANEL */}
//       {/* ======================================================================================== */}
//       <AnimatePresence>
//         {activePanel === "openSubtitlesResults" && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 20 }}
//             transition={{ duration: 0.2 }}
//             className={cn(
//               "absolute z-50 rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn",
//               isMobile && isLandscape
//                 ? "bottom-16 right-4 max-h-[80vh] w-80 overflow-y-auto"
//                 : isMobile
//                   ? "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                   : "bottom-16 right-4 sm:right-6 w-80"
//             )}
//           >
//             {/* Glassy Header */}
//             <div className="flex items-center justify-between p-4">
//               <button
//                 onClick={() => setActivePanel("openSubtitlesLanguages")}
//                 className="text-white hover:text-indigo-400 hover:scale-110 active:scale-90 transition"
//               >
//                 <ChevronLeft className="size-6" />
//               </button>
//               <span className="text-white font-semibold text-base tracking-wide">
//                 Subtitles
//               </span>
//               <div className="w-6" />
//             </div>
//             {/* Search Results */}
//             <div className="p-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
//               {isLoadingSubtitles ? (
//                 <div className="flex items-center justify-center">
//                   <Loader2 className="w-4 h-4 animate-spin text-white/70" />
//                 </div>
//               ) : openSubtitlesResults.length > 0 ? (
//                 openSubtitlesResults.map((subtitle) => (
//                   <motion.button
//                     key={subtitle.id}
//                     className="flex items-center gap-3 w-full px-2 py-2 text-left rounded-lg bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white hover:text-indigo-400 transition-colors mb-2"
//                     onClick={() => downloadAndApplySubtitle(subtitle)}
//                     whileHover={{ scale: 1.01 }}
//                     whileTap={{ scale: 0.99 }}
//                   >
//                     {/* Flag (only for Wyzie.ru) */}
//                     {subtitle.source !== "opensubtitles.com" &&
//                       (subtitle as WyzieSubtitle).flagUrl && (
//                         <img
//                           src={(subtitle as WyzieSubtitle).flagUrl}
//                           alt={(subtitle as WyzieSubtitle).language}
//                           className="w-6 h-6 rounded"
//                         />
//                       )}
//                     {/* Info */}
//                     <div className="flex flex-col flex-1 min-w-0">
//                       {subtitle.source === "opensubtitles.com" ? (
//                         <>
//                           <span className="text-white font-medium text-sm truncate">
//                             {(subtitle as OpenSubtitle).attributes.slug}
//                           </span>
//                           <span className="text-[#888] text-xs truncate">
//                             Year:{" "}
//                             {
//                               (subtitle as OpenSubtitle).attributes
//                                 .feature_details.year
//                             }{" "}
//                             • FPS: {(subtitle as OpenSubtitle).attributes.fps} •{" "}
//                             {(
//                               subtitle as OpenSubtitle
//                             ).attributes.language?.toUpperCase()}
//                           </span>
//                         </>
//                       ) : (
//                         <>
//                           <span className="text-white font-medium text-sm truncate">
//                             {(subtitle as WyzieSubtitle).display}{" "}
//                             {(subtitle as WyzieSubtitle).isHearingImpaired
//                               ? "(HI)"
//                               : ""}
//                           </span>
//                           <span className="text-[#888] text-xs truncate">
//                             {(
//                               subtitle as WyzieSubtitle
//                             ).language?.toUpperCase()}{" "}
//                             &middot; {(subtitle as WyzieSubtitle).source}
//                           </span>
//                         </>
//                       )}
//                     </div>
//                   </motion.button>
//                 ))
//               ) : (
//                 <p className="text-[#888] text-sm text-center">
//                   {openSubtitlesError ||
//                     "No subtitles found. Try another search."}
//                 </p>
//               )}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//       {/* ======================================================================================== */}
//       {/* DOWNLOAD PANEL */}
//       {/* ======================================================================================== */}

//       <AnimatePresence>
//         {activePanel === "download" && downloadOptions.length > 0 && (
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 20 }}
//             transition={{ duration: 0.2 }}
//             className={cn(
//               "absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300",
//               isMobile
//                 ? isLandscape
//                   ? "bottom-16 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                   : "bottom-40 left-4 right-4 max-h-[70vh] overflow-y-auto"
//                 : "bottom-16 right-4 sm:right-6 w-80"
//             )}
//           >
//             <div className="flex items-center justify-between p-4 ">
//               <button
//                 onClick={() => setActivePanel(null)}
//                 className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20"
//               >
//                 <ChevronLeft className="size-6" />
//               </button>
//               <span className="text-white font-semibold text-base tracking-wide">
//                 Download
//               </span>
//               <div className="w-6" />
//             </div>
//             <div className="p-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
//               {(() => {
//                 const options = downloadOptions;

//                 const videoOptions = options.filter((o: { isHls?: boolean }) => !o.isHls);
//                 const hlsOptions = options.filter((o: { isHls?: boolean }) => o.isHls);

//                 return (
//                   <>
//                     {videoOptions.length > 0 && (
//                       <>
//                         <div className="text-white flex justify-center font-medium mb-3">
//                           Direct Downloads
//                         </div>
//                         {videoOptions.map((opt: { url: string; label: string; isHls?: boolean; quality?: string }) => (
//                           <motion.button
//                             key={opt.url}
//                             onClick={() => {
//                               // If the URL looks like HLS/manifest, redirect to hlsforge
//                               const isHlsLink =
//                                 /\.m3u8(\?|$)/i.test(opt.url) ||
//                                 /(^|\/)hls(\/|$)/i.test(opt.url) ||
//                                 opt.url.includes("hls");

//                               if (isHlsLink) {
//                                 window.open(
//                                   `https://hlsforge.com/?url=${encodeURIComponent(
//                                     opt.url
//                                   )}`,
//                                   "_blank",
//                                   "noopener"
//                                 );
//                                 return;
//                               }

//                               // Otherwise perform direct download
//                               const link = document.createElement("a");
//                               link.href = opt.url;
//                               const safeName = `${title || "video"}-${opt.quality || "download"
//                                 }`.replace(/[^\w.-]/g, "_");
//                               link.download = `${safeName}.mp4`;
//                               document.body.appendChild(link);
//                               link.click();
//                               document.body.removeChild(link);
//                             }}
//                             className="flex items-center justify-between w-full px-2 py-2 text-left rounded-lg bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white hover:text-indigo-400 transition-colors mb-2"
//                             whileHover={{ scale: 1.02 }}
//                             whileTap={{ scale: 0.98 }}
//                           >
//                             <span>{opt.label}</span>
//                             <Download className="size-5 text-white" />
//                           </motion.button>
//                         ))}
//                       </>
//                     )}
//                     {hlsOptions.length > 0 && (
//                       <>
//                         {hlsOptions.map((opt: { url: string; label: string; isHls?: boolean }) => (
//                           <motion.button
//                             key={opt.url}
//                             onClick={() => {
//                               // Always send HLS/manifest links to hlsforge for processing
//                               window.open(
//                                 `https://hlsforge.com/?url=${encodeURIComponent(
//                                   opt.url
//                                 )}`,
//                                 "_blank",
//                                 "noopener"
//                               );
//                             }}
//                             className="flex items-center justify-between w-full px-2 py-2 text-left rounded-lg bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white hover:text-indigo-400 transition-colors mb-2"
//                             whileHover={{ scale: 1.02 }}
//                             whileTap={{ scale: 0.98 }}
//                           >
//                             <span>{opt.label}</span>
//                             <Download className="size-5 text-white" />
//                           </motion.button>
//                         ))}
//                       </>
//                     )}
//                   </>
//                 );
//               })()}

//               {/* Subtitles Section (Paginated) */}
//               {(() => {
//                 const allSubtitles = [...getSubtitles(), ...uploadedSubtitles];
//                 const totalPages = Math.ceil(
//                   allSubtitles.length / SUBS_PER_PAGE
//                 );
//                 const start = (subtitleDownloadPage - 1) * SUBS_PER_PAGE;
//                 const end = start + SUBS_PER_PAGE;
//                 const visibleSubs = allSubtitles.slice(start, end);

//                 return allSubtitles.length > 0 ? (
//                   <div className="mb-2">
//                     <div className="text-white flex justify-center font-medium mb-3">
//                       Subtitles
//                     </div>
//                     <div className="flex flex-col gap-2">
//                       {visibleSubs.map((subtitle, index) => (
//                         <motion.button
//                           key={`${subtitle.url}-${index}`}
//                           onClick={async () => {
//                             try {
//                               const response = await fetch(subtitle.url);
//                               if (!response.ok)
//                                 throw new Error("Failed to fetch subtitle");
//                               const blob = await response.blob();
//                               const blobUrl = window.URL.createObjectURL(blob);
//                               const link = document.createElement("a");
//                               link.href = blobUrl;
//                               link.download = `${title}-${subtitle.lang}.srt`;
//                               document.body.appendChild(link);
//                               link.click();
//                               document.body.removeChild(link);
//                               window.URL.revokeObjectURL(blobUrl);
//                             } catch (error) {
//                               toast.error("Failed to download subtitle");
//                             }
//                           }}
//                           className="flex items-center justify-between w-full px-2 py-2 text-left rounded-lg bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white hover:text-indigo-400 transition-colors"
//                           whileHover={{ scale: 1.02 }}
//                           whileTap={{ scale: 0.98 }}
//                         >
//                           <span
//                             className="truncate max-w-[200px]"
//                             title={subtitle.lang}
//                           >
//                             {subtitle.lang.length > 20
//                               ? `${subtitle.lang.slice(0, 20)}...`
//                               : subtitle.lang}
//                           </span>
//                           <Download className="size-5 text-white" />
//                         </motion.button>
//                       ))}
//                       {totalPages > 1 && (
//                         <button
//                           className="w-full mt-2 py-2 rounded-lg bg-white/10 text-indigo-400 font-semibold hover:bg-white/20 transition"
//                           onClick={() =>
//                             setSubtitleDownloadPage((p) =>
//                               p < totalPages ? p + 1 : 1
//                             )
//                           }
//                         >
//                           {subtitleDownloadPage < totalPages
//                             ? "Show Less"
//                             : "Show More"}
//                         </button>
//                       )}
//                     </div>
//                   </div>
//                 ) : null;
//               })()}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );


