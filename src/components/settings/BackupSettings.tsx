import {
    HardDriveIcon,
    CleanIcon,
    DatabaseExportIcon,
    DatabaseImportIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLanguage } from "../../context/LanguageContext";
import { logger } from "../../utils/logger";
import { ConfirmDialog } from "../../components/ConfirmDialog";

interface BackupSettingsProps {
    onExportBackup: () => void;
    onImportBackup: () => void;
    onClearData: () => void;
    showClearDataDialog: boolean;
    setShowClearDataDialog: (show: boolean) => void;
}

export const BackupSettings = ({
    onExportBackup,
    onImportBackup,
    onClearData,
    showClearDataDialog,
    setShowClearDataDialog,
}: BackupSettingsProps) => {
    const { t } = useLanguage();

    return (
        <div>
            <div className="flex items-center gap-3 mb-3">
                <HugeiconsIcon
                    icon={HardDriveIcon}
                    size={18}
                    className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                />
                <h2 className="text-base font-semibold text-foreground">
                    {t.settings.data}
                </h2>
            </div>
            <div className="space-y-2">
                <button
                    onClick={() => {
                        logger.info("Clear data button clicked");
                        setShowClearDataDialog(true);
                    }}
                    className="w-full p-2.5 flex items-center gap-2.5 bg-secondary hover:bg-destructive/10 hover:text-destructive text-left rounded-lg"
                >
                    <HugeiconsIcon
                        icon={CleanIcon}
                        size={18}
                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                    />
                    <span className="text-xs font-medium">{t.settings.clearData}</span>
                </button>
                <button
                    onClick={onExportBackup}
                    className="w-full p-2.5 flex items-center gap-2.5 bg-secondary hover:bg-secondary/80 text-left rounded-lg"
                >
                    <HugeiconsIcon
                        icon={DatabaseExportIcon}
                        size={18}
                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                    />
                    <span className="text-xs font-medium">
                        {t.settings.exportBackup}
                    </span>
                </button>
                <button
                    onClick={onImportBackup}
                    className="w-full p-2.5 flex items-center gap-2.5 bg-secondary hover:bg-secondary/80 text-left rounded-lg"
                >
                    <HugeiconsIcon
                        icon={DatabaseImportIcon}
                        size={18}
                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                    />
                    <span className="text-xs font-medium">
                        {t.settings.importBackup}
                    </span>
                </button>
            </div>

            {/* Clear Data Confirmation Dialog */}
            <ConfirmDialog
                open={showClearDataDialog}
                onOpenChange={setShowClearDataDialog}
                title={t.settings.clearData || "Clear All Data"}
                description={t.settings.clearDataConfirm}
                confirmText={t.dialog?.confirm || "Clear Data"}
                cancelText={t.dialog?.cancel || "Cancel"}
                onConfirm={onClearData}
                variant="destructive"
            />
        </div>
    );
};
