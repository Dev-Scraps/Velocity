"use client";

import type { Video } from "../../hooks/useRustCommands";
import type { StreamMode } from "../../hooks/useRustCommands";

interface TopBarProps {
  currentSong: Video;
  streamMode: StreamMode;
  onSetStreamMode?: (mode: StreamMode) => Promise<void> | void;
  onBack?: () => void;
}

export const TopBar = ({ currentSong, streamMode, onSetStreamMode, onBack }: TopBarProps) => (
  <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between animate-fadeIn px-4 py-2">
    <div className="relative group flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors duration-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6 hover:-translate-x-1 transition-transform duration-300"
          >
            <path d="M15.75 19.5a.75.75 0 0 1-.53-1.28L11.03 14l4.19-4.22a.75.75 0 1 1 1.06 1.06l-3.66 3.68 3.66 3.69a.75.75 0 0 1-.53 1.28Z" />
          </svg>
          <span className="text-md font-semibold font-sora tracking-wide">
            Back
          </span>
        </button>
      )}
      <span className="hidden md:inline text-white/40 text-lg font-medium">/</span>
      <span className="hidden md:inline text-white text-lg">
        {currentSong.title}
      </span>
      <span className="md:hidden text-white text-sm font-semibold truncate">
        {currentSong.title}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSetStreamMode?.("audio")}
        className={`text-white/80 hover:text-white transition-colors duration-300 px-3 py-1 rounded-full ${streamMode === "audio" ? "bg-white/30 text-white shadow-lg shadow-white/20" : "hover:bg-white/10"}`}
      >
        Audio
      </button>
      <button
        type="button"
        onClick={() => onSetStreamMode?.("av")}
        className={`text-white/80 hover:text-white transition-colors duration-300 px-3 py-1 rounded-full ${streamMode === "av" ? "bg-white/30 text-white shadow-lg shadow-white/20" : "hover:bg-white/10"}`}
      >
        Video
      </button>
    </div>
  </div>
);
