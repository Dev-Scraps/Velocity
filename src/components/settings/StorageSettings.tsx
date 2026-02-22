import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { useLanguage } from "../../context/LanguageContext";
import { logger } from "../../utils/logger";

interface StorageSettingsProps {
    downloadDirectory: string;
    onDownloadDirectoryChange: (directory: string) => void;
    autoSync: boolean;
    onAutoSyncChange: (value: boolean) => void;
}

export const StorageSettings = ({
    downloadDirectory,
    onDownloadDirectoryChange,
    autoSync,
    onAutoSyncChange,
}: StorageSettingsProps) => {
    const { t } = useLanguage();

    return (
        <div>
            <div className="flex items-center gap-3 mb-3">
                <HugeiconsIcon
                    icon={Download01Icon}
                    size={18}
                    className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                />
                <h2 className="text-base font-semibold text-foreground">
                    {t.settings.download}
                </h2>
            </div>
            <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-secondary">
                    <label className="text-xs text-foreground font-medium block mb-2">
                        {t.settings.downloadDirectory}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={downloadDirectory}
                            onChange={(e) => onDownloadDirectoryChange(e.target.value)}
                            placeholder={t.settings.downloadDirectoryPlaceholder}
                            className="flex-1 p-1.5 rounded-lg bg-background border border-border text-foreground text-xs"
                        />
                        <button
                            onClick={async () => {
                                try {
                                    const selected = (await invoke<string>(
                                        "open_file_dialog"
                                    )) as string;
                                    if (selected) {
                                        onDownloadDirectoryChange(selected);
                                    }
                                } catch (error) {
                                    logger.error("Failed to select directory", {
                                        error:
                                            error instanceof Error ? error.message : String(error),
                                    });
                                }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium"
                        >
                            {t.settings.browse}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary">
                    <span className="text-xs text-foreground font-medium">
                        {t.settings.autoSync}
                    </span>
                    <button
                        onClick={() => {
                            onAutoSyncChange(!autoSync);
                        }}
                        className={`relative w-10 h-5 rounded-lg transition-colors ${autoSync ? "bg-primary" : "bg-border"
                            }`}
                    >
                        <div
                            className={`absolute top-0.5 w-4 h-4 rounded-lg bg-white shadow-sm transition-all ${autoSync ? "left-5" : "left-0.5"
                                }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};
