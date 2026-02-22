"use client";

interface SpeedPanelProps {
  playbackRate: number;
  onSelectRate: (rate: number) => void;
  onBack: () => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const SpeedPanel = ({ playbackRate, onSelectRate, onBack }: SpeedPanelProps) => (
  <div className="absolute z-50 rounded-3xl overflow-hidden border border-white/20 bg-black/40 backdrop-blur-xl shadow-2xl animate-fadeIn hover:shadow-white/10 transition-all duration-300 bottom-20 sm:bottom-24 lg:bottom-16 right-4 sm:right-6 w-80">
    <div className="flex items-center justify-between p-4">
      <button
        onClick={onBack}
        className="text-white hover:scale-110 active:scale-90 transition-transform duration-300 p-1 rounded-full hover:bg-white/20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path d="M15.75 19.5a.75.75 0 0 1-.53-1.28L11.03 14l4.19-4.22a.75.75 0 1 1 1.06 1.06l-3.66 3.68 3.66 3.69a.75.75 0 0 1-.53 1.28Z" />
        </svg>
      </button>
      <span className="text-white font-semibold text-base tracking-wide">Playback Speed</span>
      <div className="w-6" />
    </div>
    <div className="px-4 pb-4 space-y-2">
      {PLAYBACK_RATES.map((rate) => (
        <button
          key={rate}
          onClick={() => onSelectRate(rate)}
          className={`w-full text-left px-3 py-2 rounded-lg border border-white/10 transition-all duration-300 hover:scale-105 active:scale-95 backdrop-blur-sm ${playbackRate === rate ? "bg-white/20 text-white shadow-lg shadow-white/20" : "bg-white/5 text-white/80 hover:bg-white/10"}`}
        >
          {rate === 1 ? "Normal" : `${rate}x`}
        </button>
      ))}
    </div>
  </div>
);
