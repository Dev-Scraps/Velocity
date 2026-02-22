"use client";

import type { AudioTrack, SubtitleTrack, StreamMode } from "../../hooks/useRustCommands";

interface BottomControlsProps {
  currentTime: number;
  duration: number;
  onSeek: (value: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  captionTracks: SubtitleTrack[];
  selectedAudioUrl: string | null;
  selectedCaptionUrl: string | null;
  onSelectAudio: (url: string | null) => void;
  onSelectCaption: (url: string | null) => void;
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  streamMode: StreamMode;
  onToggleStreamMode: (mode: StreamMode) => void;
  formatTime: (time: number) => string;
  activePanel: "audio" | "captions" | "quality" | "settings" | "speed" | null;
  onTogglePanel: (panel: "audio" | "captions" | "quality" | "settings") => void;
}

export const BottomControls = ({
  currentTime,
  duration,
  onSeek,
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
  audioTracks,
  subtitleTracks,
  captionTracks,
  selectedAudioUrl,
  selectedCaptionUrl,
  onSelectAudio,
  onSelectCaption,
  isMuted,
  volume,
  onToggleMute,
  onVolumeChange,
  streamMode,
  onToggleStreamMode,
  formatTime,
  activePanel,
  onTogglePanel,
}: BottomControlsProps) => (
  <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-6">
    <div className="flex items-center justify-between text-xs text-white/80 mb-2">
      <span>{formatTime(currentTime)}</span>
      <span>{formatTime(duration)}</span>
    </div>
    <div className="relative h-2 rounded-full bg-white/20 group cursor-pointer">
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={(event) => onSeek(parseFloat(event.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-red-500 to-red-800"
        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-white/30 transform scale-0 group-hover:scale-100 transition-transform duration-200"
        style={{ left: `${(currentTime / (duration || 1)) * 100}%`, transform: "translate(-50%, -50%)" }}
      />
    </div>

    <div className="mt-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className="text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm"
        >
          {isPlaying ? (
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 320 512"
              className="w-6 h-6"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M48 64C21.5 64 0 85.5 0 112V400c0 26.5 21.5 48 48 48H80c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zm192 0c-26.5 0-48 21.5-48 48V400c0 26.5 21.5 48 48 48h32c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H240z"></path>
            </svg>
          ) : (
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 384 512"
              className="w-6 h-6"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"></path>
            </svg>
          )}
        </button>
        <button
          onClick={onPrev}
          className="text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
            ></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
            ></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.324 1.67511C11.4489 1.41526 11.7117 1.25 12 1.25C12.7353 1.25 13.4541 1.32394 14.1492 1.46503C19.0563 2.46112 22.75 6.79837 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12C1.25 7.59065 3.90459 3.80298 7.69972 2.14482C8.07929 1.97898 8.52143 2.15224 8.68726 2.53181C8.8531 2.91137 8.67984 3.35351 8.30028 3.51935C5.03179 4.94742 2.75 8.20808 2.75 12C2.75 17.1086 6.89137 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 7.84953 18.5158 4.33622 14.75 3.16544V4.5C14.75 4.81852 14.5488 5.10229 14.2483 5.20772C13.9477 5.31315 13.6133 5.21724 13.4143 4.96852L11.4143 2.46852C11.2342 2.24339 11.1991 1.93496 11.324 1.67511Z"
            ></path>
          </svg>
        </button>
        <button
          onClick={onNext}
          className="text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.3249 7.82403C10.5848 7.94892 10.75 8.2117 10.75 8.50001V15.5C10.75 15.9142 10.4142 16.25 10 16.25C9.58581 16.25 9.25003 15.9142 9.25003 15.5V10.0605L7.96855 11.0857C7.6451 11.3444 7.17313 11.292 6.91438 10.9685C6.65562 10.6451 6.70806 10.1731 7.03151 9.91436L9.53151 7.91436C9.75663 7.73425 10.0651 7.69914 10.3249 7.82403Z"
            ></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M14.25 9.25001C13.6977 9.25001 13.25 9.69772 13.25 10.25V13.75C13.25 14.3023 13.6977 14.75 14.25 14.75C14.8023 14.75 15.25 14.3023 15.25 13.75V10.25C15.25 9.69772 14.8023 9.25001 14.25 9.25001ZM11.75 10.25C11.75 8.8693 12.8693 7.75001 14.25 7.75001C15.6307 7.75001 16.75 8.8693 16.75 10.25V13.75C16.75 15.1307 15.6307 16.25 14.25 16.25C12.8693 16.25 11.75 15.1307 11.75 13.75V10.25Z"
            ></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12.676 1.67511C12.5511 1.41526 12.2883 1.25 12 1.25C11.2647 1.25 10.5459 1.32394 9.8508 1.46503C4.94367 2.46112 1.25 6.79837 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 7.59065 20.0954 3.80298 16.3003 2.14482C15.9207 1.97898 15.4786 2.15224 15.3127 2.53181C15.1469 2.91137 15.3202 3.35351 15.6997 3.51935C18.9682 4.94742 21.25 8.20808 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12C2.75 7.84953 5.48421 4.33622 9.25 3.16544V4.5C9.25 4.81852 9.45118 5.10229 9.75175 5.20772C10.0523 5.31315 10.3867 5.21724 10.5857 4.96852L12.5857 2.46852C12.7658 2.24339 12.8009 1.93496 12.676 1.67511Z"
            ></path>
          </svg>
        </button>
        <button
          onClick={onToggleMute}
          className="text-white hover:text-gray-300 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm"
        >
          {isMuted || volume === 0 ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="currentColor"
            >
              <path d="M10.9916 3.9756C11.6784 3.44801 12.4957 3.01957 13.367 3.38808C14.2302 3.75318 14.5076 4.63267 14.6274 5.49785C14.7502 6.38459 14.7502 7.60557 14.7502 9.12365V14.8794C14.7502 16.3975 14.7502 17.6185 14.6274 18.5052C14.5076 19.3704 14.2302 20.2499 13.367 20.615C12.4957 20.9835 11.6784 20.5551 10.9916 20.0275C10.2892 19.488 9.3966 18.5765 8.34667 17.5044L8.34663 17.5044C7.80717 16.9535 7.44921 16.6873 7.08663 16.5374C6.72221 16.3868 6.27914 16.3229 5.50619 16.3229C4.83768 16.3229 4.23963 16.3229 3.78679 16.2758C3.31184 16.2265 2.87088 16.1191 2.47421 15.8485C1.7184 15.3328 1.42917 14.5777 1.31957 13.8838C1.23785 13.3663 1.24723 12.7981 1.25479 12.3405V11.6626C1.24723 11.205 1.23785 10.6368 1.31957 10.1193C1.42917 9.42536 1.7184 8.67029 2.47421 8.15462C2.87088 7.88398 3.31184 7.77657 3.78679 7.72723C4.23963 7.68019 4.83768 7.68021 5.50619 7.68023C6.27914 7.68023 6.72221 7.61628 7.08663 7.46563C7.44922 7.31574 7.80717 7.04954 8.34663 6.49869L8.34664 6.49869C9.39659 5.42655 10.2892 4.51511 10.9916 3.9756Z"></path>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.2929 9.29289C17.6834 8.90237 18.3166 8.90237 18.7071 9.29289L20 10.5858L21.2929 9.29289C21.6834 8.90237 22.3166 8.90237 22.7071 9.29289C23.0976 9.68342 23.0976 10.3166 22.7071 10.7071L21.4142 12L22.7071 13.2929C23.0976 13.6834 23.0976 14.3166 22.7071 14.7071C22.3166 15.0976 21.6834 15.0976 21.2929 14.7071L20 13.4142L18.7071 14.7071C18.3166 15.0976 17.6834 15.0976 17.2929 14.7071C16.9024 14.3166 16.9024 13.6834 17.2929 13.2929L18.5858 12L17.2929 10.7071C16.9024 10.3166 16.9024 9.68342 17.2929 9.29289Z"
              ></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-6 h-6"
              fill="currentColor"
            >
              <path d="M10.9916 3.9756C11.6784 3.44801 12.4957 3.01957 13.367 3.38808C14.2302 3.75318 14.5076 4.63267 14.6274 5.49785C14.7502 6.38459 14.7502 7.60557 14.7502 9.12365V14.8794C14.7502 16.3975 14.7502 17.6185 14.6274 18.5052C14.5076 19.3704 14.2302 20.2499 13.367 20.615C12.4957 20.9835 11.6784 20.5551 10.9916 20.0275C10.2892 19.488 9.3966 18.5765 8.34667 17.5044L8.34663 17.5044C7.80717 16.9535 7.44921 16.6873 7.08663 16.5374C6.72221 16.3868 6.27914 16.3229 5.50619 16.3229C4.83768 16.3229 4.23963 16.3229 3.78679 16.2758C3.31184 16.2265 2.87088 16.1191 2.47421 15.8485C1.7184 15.3328 1.42917 14.5777 1.31957 13.8838C1.23785 13.3663 1.24723 12.7981 1.25479 12.3405V11.6626C1.24723 11.205 1.23785 10.6368 1.31957 10.1193C1.42917 9.42536 1.7184 8.67029 2.47421 8.15462C2.87088 7.88398 3.31184 7.77657 3.78679 7.72723C4.23963 7.68019 4.83768 7.68021 5.50619 7.68023C6.27914 7.68023 6.72221 7.61628 7.08663 7.46563C7.44922 7.31574 7.80717 7.04954 8.34663 6.49869L8.34664 6.49869C9.39659 5.42655 10.2892 4.51511 10.9916 3.9756Z"></path>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M16.3935 8.20504C16.8325 7.87003 17.4601 7.95439 17.7951 8.39347C18.5519 9.38539 19.0001 10.6418 19.0001 12.0001C19.0001 13.3583 18.5519 14.6147 17.7951 15.6066C17.4601 16.0457 16.8325 16.1301 16.3935 15.7951C15.9544 15.4601 15.87 14.8325 16.205 14.3935C16.699 13.746 17.0001 12.9149 17.0001 12.0001C17.0001 11.0852 16.699 10.2541 16.205 9.60664C15.87 9.16756 15.9544 8.54004 16.3935 8.20504Z"
              ></path>
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M19.3247 6.26245C19.7321 5.8895 20.3646 5.91738 20.7376 6.32472C22.1408 7.8573 23 9.83247 23 12C23 14.1675 22.1408 16.1427 20.7376 17.6753C20.3646 18.0826 19.7321 18.1105 19.3247 17.7376C18.9174 17.3646 18.8895 16.7321 19.2625 16.3247C20.3609 15.125 21 13.621 21 12C21 10.379 20.3609 8.87497 19.2625 7.6753C18.8895 7.26796 18.9174 6.63541 19.3247 6.26245Z"
              ></path>
            </svg>
          )}
        </button>
        <div className="ml-2 flex items-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(event) => onVolumeChange(parseFloat(event.target.value))}
            className="w-24 h-1 rounded-full appearance-none outline-none backdrop-blur-sm [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
            style={{
              background: isMuted
                ? "linear-gradient(to right, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.3) 100%)"
                : `linear-gradient(to right, #ef4444 0%, #7f1d1d ${volume * 100}%, rgba(255,255,255,0.3) ${volume * 100}%, rgba(255,255,255,0.3) 100%)`,
            }}
          />
        </div>
        {/* <div className="flex items-center gap-4 text-xs ml-4">
          {audioTracks.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="text-white/70">Audio</span>
              <select
                value={selectedAudioUrl || ""}
                onChange={(event) => onSelectAudio(event.target.value || null)}
                className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-white"
              >
                {audioTracks.map((track) => (
                  <option key={track.format_id} value={track.url}>
                    {track.name || track.language || track.format_id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(subtitleTracks.length > 0 || captionTracks.length > 0) && streamMode === "av" && (
            <label className="flex items-center gap-2">
              <span className="text-white/70">Captions</span>
              <select
                value={selectedCaptionUrl || ""}
                onChange={(event) => onSelectCaption(event.target.value || null)}
                className="rounded-md border border-white/20 bg-black/40 px-2 py-1 text-white"
              >
                <option value="">Off</option>
                {subtitleTracks.map((track) => (
                  <option key={`sub-${track.language}-${track.url}`} value={track.url}>
                    {track.name || track.language}
                  </option>
                ))}
                {captionTracks.map((track) => (
                  <option key={`cap-${track.language}-${track.url}`} value={track.url}>
                    Auto: {track.name || track.language}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div> */}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleStreamMode(streamMode === "audio" ? "av" : "audio")}
            className={`p-2 rounded-full border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm ${streamMode === "audio" ? "bg-white/30 text-white shadow-lg shadow-white/20" : "bg-transparent text-white/80 hover:text-white"}`}
            title={streamMode === "audio" ? "Switch to video" : "Switch to audio"}
          >
            {streamMode === "audio" ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M4 5.75C4 4.7835 4.7835 4 5.75 4h12.5C19.2165 4 20 4.7835 20 5.75v12.5c0 .9665-.7835 1.75-1.75 1.75H5.75C4.7835 20 4 19.2165 4 18.25V5.75ZM8 9.25c-.4142 0-.75.3358-.75.75v4c0 .4142.3358.75.75.75h8c.4142 0 .75-.3358.75-.75v-4c0-.4142-.3358-.75-.75-.75H8Z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => onTogglePanel("audio")}
            className={`p-2 rounded-full border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm ${activePanel === "audio" ? "bg-white/30 text-white shadow-lg shadow-white/20" : "bg-transparent text-white/80 hover:text-white"}`}
            title="Audio tracks"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onTogglePanel("captions")}
            className={`p-2 rounded-full border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm ${activePanel === "captions" ? "bg-white/30 text-white shadow-lg shadow-white/20" : "bg-transparent text-white/80 hover:text-white"}`}
            title="Captions"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12ZM6 15.25C5.58579 15.25 5.25 15.5858 5.25 16C5.25 16.4142 5.58579 16.75 6 16.75H10C10.4142 16.75 10.75 16.4142 10.75 16C10.75 15.5858 10.4142 15.25 10 15.25H6ZM7.75 13C7.75 12.5858 7.41421 12.25 7 12.25H6C5.58579 12.25 5.25 12.5858 5.25 13C5.25 13.4142 5.58579 13.75 6 13.75H7C7.41421 13.75 7.75 13.4142 7.75 13ZM11.5 12.25C11.9142 12.25 12.25 12.5858 12.25 13C12.25 13.4142 11.9142 13.75 11.5 13.75H9.5C9.08579 13.75 8.75 13.4142 8.75 13C8.75 12.5858 9.08579 12.25 9.5 12.25H11.5ZM18.75 13C18.75 12.5858 18.4142 12.25 18 12.25H14C13.5858 12.25 13.25 12.5858 13.25 13C13.25 13.4142 13.5858 13.75 14 13.75H18C18.4142 13.75 18.75 13.4142 18.75 13ZM12.5 15.25C12.0858 15.25 11.75 15.5858 11.75 16C11.75 16.4142 12.0858 16.75 12.5 16.75H14C14.4142 16.75 14.75 16.4142 14.75 16C14.75 15.5858 14.4142 15.25 14 15.25H12.5ZM15.75 16C15.75 15.5858 16.0858 15.25 16.5 15.25H18C18.4142 15.25 18.75 15.5858 18.75 16C18.75 16.4142 18.4142 16.75 18 16.75H16.5C16.0858 16.75 15.75 16.4142 15.75 16Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onTogglePanel("quality")}
            className={`p-2 rounded-full border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm ${activePanel === "quality" ? "bg-white/30 text-white shadow-lg shadow-white/20" : "bg-transparent text-white/80 hover:text-white"}`}
            title="Quality"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onTogglePanel("settings")}
            className={`p-2 rounded-full border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 hover:bg-white/20 backdrop-blur-sm ${activePanel === "settings" ? "bg-white/30 text-white shadow-lg shadow-white/20" : "bg-transparent text-white/80 hover:text-white"}`}
            title="Settings"
          >
            <svg
              viewBox="0 0 32 32"
              className="w-4 h-4"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M13.5722 5.33333C13.2429 5.33333 12.9629 5.57382 12.9132 5.89938L12.4063 9.21916C12.4 9.26058 12.3746 9.29655 12.3378 9.31672C12.2387 9.37118 12.1409 9.42779 12.0444 9.48648C12.0086 9.5083 11.9646 9.51242 11.9255 9.49718L8.79572 8.27692C8.48896 8.15732 8.14083 8.27958 7.9762 8.56472L5.5491 12.7686C5.38444 13.0538 5.45271 13.4165 5.70981 13.6223L8.33308 15.7225C8.3658 15.7487 8.38422 15.7887 8.38331 15.8306C8.38209 15.8867 8.38148 15.9429 8.38148 15.9993C8.38148 16.0558 8.3821 16.1121 8.38332 16.1684C8.38423 16.2102 8.36582 16.2503 8.33313 16.2765L5.7103 18.3778C5.45334 18.5836 5.38515 18.9462 5.54978 19.2314L7.97688 23.4352C8.14155 23.7205 8.48981 23.8427 8.79661 23.723L11.926 22.5016C11.9651 22.4864 12.009 22.4905 12.0449 22.5123C12.1412 22.5709 12.2388 22.6274 12.3378 22.6818C12.3745 22.7019 12.4 22.7379 12.4063 22.7793L12.9132 26.0993C12.9629 26.4249 13.2429 26.6654 13.5722 26.6654H18.4264C18.7556 26.6654 19.0356 26.425 19.0854 26.0995L19.5933 22.7801C19.5997 22.7386 19.6252 22.7027 19.6619 22.6825C19.7614 22.6279 19.8596 22.5711 19.9564 22.5121C19.9923 22.4903 20.0362 22.4862 20.0754 22.5015L23.2035 23.7223C23.5103 23.842 23.8585 23.7198 24.0232 23.4346L26.4503 19.2307C26.6149 18.9456 26.5467 18.583 26.2898 18.3771L23.6679 16.2766C23.6352 16.2504 23.6168 16.2104 23.6177 16.1685C23.619 16.1122 23.6196 16.0558 23.6196 15.9993C23.6196 15.9429 23.619 15.8866 23.6177 15.8305C23.6168 15.7886 23.6353 15.7486 23.668 15.7224L26.2903 13.623C26.5474 13.4172 26.6156 13.0544 26.451 12.7692L24.0239 8.56537C23.8592 8.28023 23.5111 8.15797 23.2043 8.27757L20.0758 9.49734C20.0367 9.51258 19.9927 9.50846 19.9569 9.48664C19.8599 9.42762 19.7616 9.37071 19.6618 9.31596C19.6251 9.2958 19.5997 9.25984 19.5933 9.21843L19.0854 5.89915C19.0356 5.57369 18.7556 5.33333 18.4264 5.33333H13.5722ZM16.0001 20.2854C18.3672 20.2854 20.2862 18.3664 20.2862 15.9993C20.2862 13.6322 18.3672 11.7132 16.0001 11.7132C13.6329 11.7132 11.714 13.6322 11.714 15.9993C11.714 18.3664 13.6329 20.2854 16.0001 20.2854Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
);
