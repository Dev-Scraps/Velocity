import {
    ModernTvIcon,
    Sun01Icon,
    Moon02Icon,
    LanguageSquareIcon,
    Globe02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { localeNames, type Locale } from "../../i18n/locales";

interface AppearanceSettingsProps {
    font: string;
    onFontChange: (font: string) => void;
    fonts: string[];
}

export const AppearanceSettings = ({
    font,
    onFontChange,
    fonts,
}: AppearanceSettingsProps) => {
    const { themeMode, setThemeMode } = useTheme();
    const { locale, setLocale, t } = useLanguage();

    return (
        <div className="space-y-8">
            {/* Theme Settings */}
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <HugeiconsIcon
                        icon={ModernTvIcon}
                        size={18}
                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                    />
                    <h2 className="text-base font-semibold text-foreground">
                        {t.settings.theme}
                    </h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {(["system", "light", "dark"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setThemeMode(mode)}
                            className={`p-2.5 rounded-lg ${mode === themeMode
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-secondary text-foreground hover:bg-secondary/80"
                                }`}
                        >
                            <div className="flex flex-col items-center gap-1.5">
                                {mode === "system" && (
                                    <HugeiconsIcon
                                        icon={ModernTvIcon}
                                        size={18}
                                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                    />
                                )}
                                {mode === "light" && (
                                    <HugeiconsIcon
                                        icon={Sun01Icon}
                                        size={18}
                                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                    />
                                )}
                                {mode === "dark" && (
                                    <HugeiconsIcon
                                        icon={Moon02Icon}
                                        size={18}
                                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                    />
                                )}
                                <span className="text-xs font-medium capitalize">
                                    {
                                        t.settings[
                                        `theme${mode.charAt(0).toUpperCase() + mode.slice(1)}` as keyof typeof t.settings
                                        ]
                                    }
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Language Settings */}
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <HugeiconsIcon
                        icon={LanguageSquareIcon}
                        size={18}
                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                    />
                    <h2 className="text-base font-semibold text-foreground">
                        {t.settings.language}
                    </h2>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {(Object.keys(localeNames) as Locale[]).map((loc) => (
                        <button
                            key={loc}
                            onClick={() => setLocale(loc)}
                            className={`p-2.5 rounded-lg ${loc === locale
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-secondary text-foreground hover:bg-secondary/80"
                                }`}
                        >
                            <div className="flex flex-col items-center gap-1.5">
                                <HugeiconsIcon
                                    icon={Globe02Icon}
                                    size={18}
                                    className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                />
                                <span className="text-xs font-medium">{localeNames[loc]}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Font Settings */}
            <div>
                <h2 className="text-base font-semibold text-foreground mb-3">
                    {t.settings.font}
                </h2>
                <div className="grid grid-cols-5 gap-2">
                    {fonts.map((fontOption) => (
                        <button
                            key={fontOption}
                            onClick={() => onFontChange(fontOption)}
                            className={`p-2.5 text-left rounded-lg ${font === fontOption
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-secondary text-foreground hover:bg-secondary/80"
                                }`}
                            style={{ fontFamily: `${fontOption}, sans-serif` }}
                        >
                            <div className="font-medium text-xs">{fontOption}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">Aa Bb Cc</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
