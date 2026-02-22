import { HeadphonesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLanguage } from "../../context/LanguageContext";

interface PlaybackSettingsProps {
    audioOnlyMode: boolean;
    onAudioOnlyModeChange: (value: boolean) => void;
    videoQuality: string;
    onVideoQualityChange: (value: string) => void;
    audioQuality: string;
    onAudioQualityChange: (value: string) => void;
    videoQualities: string[];
    audioQualities: string[];
}

export const PlaybackSettings = ({
    audioOnlyMode,
    onAudioOnlyModeChange,
    videoQuality,
    onVideoQualityChange,
    audioQuality,
    onAudioQualityChange,
    videoQualities,
    audioQualities,
}: PlaybackSettingsProps) => {
    const { t } = useLanguage();

    return (
        <div>
            <div className="flex items-center gap-3 mb-3">
                <HugeiconsIcon
                    icon={HeadphonesIcon}
                    size={18}
                    className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                />
                <h2 className="text-base font-semibold text-foreground">
                    {t.settings.playback}
                </h2>
            </div>
            <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary">
                    <span className="text-xs text-foreground font-medium">
                        {t.settings.audioOnlyMode}
                    </span>
                    <button
                        onClick={() => {
                            onAudioOnlyModeChange(!audioOnlyMode);
                        }}
                        className={`relative w-10 h-5 rounded-lg transition-colors ${audioOnlyMode ? "bg-primary" : "bg-border"
                            }`}
                    >
                        <div
                            className={`absolute top-0.5 w-4 h-4 rounded-lg bg-white shadow-sm transition-all ${audioOnlyMode ? "left-5" : "left-0.5"
                                }`}
                        />
                    </button>
                </div>

                <div className="p-2.5 rounded-lg bg-secondary">
                    <label className="text-xs text-foreground font-medium block mb-2">
                        {t.settings.videoQuality}
                    </label>
                    <select
                        value={videoQuality}
                        onChange={(e) => onVideoQualityChange(e.target.value)}
                        className="w-full p-1.5 rounded-lg bg-background border border-border text-foreground text-xs"
                    >
                        {videoQualities.map((quality) => (
                            <option key={quality} value={quality}>
                                {quality}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="p-2.5 rounded-lg bg-secondary">
                    <label className="text-xs text-foreground font-medium block mb-2">
                        {t.settings.audioQuality}
                    </label>
                    <select
                        value={audioQuality}
                        onChange={(e) => onAudioQualityChange(e.target.value)}
                        className="w-full p-1.5 rounded-lg bg-background border border-border text-foreground text-xs"
                    >
                        {audioQualities.map((quality) => (
                            <option key={quality} value={quality}>
                                {quality}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};
