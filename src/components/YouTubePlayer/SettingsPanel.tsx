"use client";

interface SettingsPanelProps {
  selectedQualityLabel: string;
  selectedAudioLabel: string;
  selectedCaptionLabel: string;
  onOpenPanel: (panel: "quality" | "audio" | "captions") => void;
  onOpenSpeed: () => void;
  onOpenDownload: () => void;
}

export const SettingsPanel = ({
  selectedQualityLabel,
  selectedAudioLabel,
  selectedCaptionLabel,
  onOpenPanel,
  onOpenSpeed,
  onOpenDownload,
}: SettingsPanelProps) => (
  <div className="absolute z-50 backdrop-blur-xl bg-black/40 border border-white/20 rounded-3xl shadow-2xl hover:shadow-white/10 transition-all duration-300 bottom-20 sm:bottom-24 lg:bottom-16 right-4 sm:right-6 w-80">
    <div className="grid grid-cols-2 gap-3 p-4">
      <button
        className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
        onClick={() => onOpenPanel("quality")}
      >
        <p className="text-sm text-gray-300">Quality</p>
        <p className="text-white font-medium text-sm truncate">{selectedQualityLabel}</p>
      </button>
      <button
        className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
        onClick={() => onOpenPanel("audio")}
      >
        <p className="text-sm text-gray-300">Audio</p>
        <p className="text-white font-medium text-sm truncate">{selectedAudioLabel}</p>
      </button>
      <button
        className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
        onClick={() => onOpenPanel("captions")}
      >
        <p className="text-sm text-gray-300">Captions</p>
        <p className="text-white font-medium text-sm truncate">{selectedCaptionLabel}</p>
      </button>
      <button
        className="rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 p-3 text-left backdrop-blur-sm border border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-white/10 transform hover:scale-105"
        onClick={onOpenDownload}
      >
        <p className="text-sm text-gray-300">Download</p>
        <p className="text-white font-medium text-sm">Options</p>
      </button>
    </div>
    <div className="px-4 pb-4 space-y-3">
      <button
        className="flex items-center justify-between w-full text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-300"
        type="button"
        onClick={onOpenSpeed}
      >
        <span>Playback speed</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4 text-white/80"
        >
          <path d="M9.75 6.75a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L14.19 12 9.75 7.81a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
    </div>
  </div>
);
