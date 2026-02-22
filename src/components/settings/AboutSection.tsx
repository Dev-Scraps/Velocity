import {
    File02Icon,
    Download01Icon,
    HeadphonesIcon,
    PlayIcon,
    HardDriveIcon,
    Globe02Icon,
    FavouriteIcon,
    Coffee01Icon,
    BitcoinCreditCardIcon,
    Bitcoin03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLanguage } from "../../context/LanguageContext";

export const AboutSection = () => {
    const { t } = useLanguage();

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <HugeiconsIcon
                    icon={File02Icon}
                    size={20}
                    className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                />
                <h2 className="text-lg font-semibold text-foreground">
                    {t.settings.about}
                </h2>
            </div>

            <div className="space-y-6">
                {/* App Info */}
                <div className="text-center">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Velocity</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Advanced Video Downloader & Media Manager
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 text-primary">
                        <span className="text-xs font-medium">Version 2.0.0-beta</span>
                    </div>
                </div>

                {/* Features */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        {t.settings.keyFeatures}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                            <HugeiconsIcon
                                icon={Download01Icon}
                                size={16}
                                className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">
                                    {t.settings.multiPlatform}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.multiPlatformDesc}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                            <HugeiconsIcon
                                icon={HeadphonesIcon}
                                size={16}
                                className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">
                                    {t.settings.highQuality}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.highQualityDesc}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                            <HugeiconsIcon
                                icon={PlayIcon}
                                size={16}
                                className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">
                                    {t.settings.builtInPlayer}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.builtInPlayerDesc}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                            <HugeiconsIcon
                                icon={HardDriveIcon}
                                size={16}
                                className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">
                                    {t.settings.playlistManagement}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.playlistManagementDesc}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Open Source */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        {t.settings.openSource}
                    </h4>
                    <div className="p-4 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-3 mb-3">
                            <HugeiconsIcon
                                icon={Globe02Icon}
                                size={16}
                                className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">
                                    {t.settings.openSourceDesc}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.license}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t.settings.openSourceText}
                        </p>
                    </div>
                </div>

                {/* Repository */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        {t.settings.repository}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <button className="p-4 rounded-lg bg-card border border-border hover:bg-accent/50 text-left transition-colors group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                        <HugeiconsIcon
                                            icon={Globe02Icon}
                                            size={18}
                                            className="text-current"
                                        />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">
                                            {t.settings.githubRepo}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.settings.githubRepoDesc}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary">
                                        <span className="w-2 h-2 rounded-lg bg-green-500"></span>
                                        {t.settings.active}
                                    </span>
                                </div>
                            </div>
                        </button>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="p-3 rounded-lg bg-card border border-border text-center">
                                <div className="text-lg font-bold text-foreground">1.2k</div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.stars}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-card border border-border text-center">
                                <div className="text-lg font-bold text-foreground">89</div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.forks}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-card border border-border text-center">
                                <div className="text-lg font-bold text-foreground">24</div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.contributors}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support & Donation */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        {t.settings.supportDevelopment}
                    </h4>
                    <div className="p-4 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-3 mb-3">
                            <HugeiconsIcon
                                icon={FavouriteIcon}
                                size={16}
                                className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                            />
                            <div>
                                <div className="text-sm font-medium text-foreground">
                                    {t.settings.helpKeepFree}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {t.settings.supportDesc}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                            {t.settings.teamDesc}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <button className="p-3 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <HugeiconsIcon
                                        icon={Coffee01Icon}
                                        size={16}
                                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                    />
                                    <div className="text-left">
                                        <div className="text-sm font-medium text-foreground">
                                            {t.settings.buyMeACoffee}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.settings.oneTimeSupport}
                                        </div>
                                    </div>
                                </div>
                            </button>
                            <button className="p-3 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <HugeiconsIcon
                                        icon={FavouriteIcon}
                                        size={16}
                                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                    />
                                    <div className="text-left">
                                        <div className="text-sm font-medium text-foreground">
                                            {t.settings.githubSponsors}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.settings.monthlySupport}
                                        </div>
                                    </div>
                                </div>
                            </button>
                            <button className="p-3 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <HugeiconsIcon
                                        icon={BitcoinCreditCardIcon}
                                        size={16}
                                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                    />
                                    <div className="text-left">
                                        <div className="text-sm font-medium text-foreground">
                                            {t.settings.patreon}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.settings.exclusivePerks}
                                        </div>
                                    </div>
                                </div>
                            </button>
                            <button className="p-3 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <HugeiconsIcon
                                        icon={Bitcoin03Icon}
                                        size={16}
                                        className="text-current transition-transform duration-300 hover:scale-110 hover:animate-bounce-in"
                                    />
                                    <div className="text-left">
                                        <div className="text-sm font-medium text-foreground">
                                            {t.settings.crypto}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {t.settings.cryptoDesc}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Contributors */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        {t.settings.amazingContributors}
                    </h4>
                    <div className="p-4 rounded-lg bg-card border border-border">
                        <p className="text-xs text-muted-foreground mb-3">
                            {t.settings.contributorsDesc}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 rounded-lg bg-secondary text-foreground text-xs font-medium">
                                @777abhishek
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-secondary text-foreground text-xs font-medium">
                                @contributor1
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-secondary text-foreground text-xs font-medium">
                                @contributor2
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-secondary text-foreground text-xs font-medium">
                                @contributor3
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                                {t.settings.moreContributors}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Links */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground mb-3">
                        {t.settings.resources}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <button className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors">
                            <div className="text-sm font-medium text-foreground">
                                {t.settings.documentation}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t.settings.documentationDesc}
                            </div>
                        </button>
                        <button className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors">
                            <div className="text-sm font-medium text-foreground">
                                {t.settings.github}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t.settings.githubDesc}
                            </div>
                        </button>
                        <button className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors">
                            <div className="text-sm font-medium text-foreground">
                                {t.settings.reportIssues}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t.settings.reportIssuesDesc}
                            </div>
                        </button>
                        <button className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left transition-colors">
                            <div className="text-sm font-medium text-foreground">
                                {t.settings.community}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t.settings.communityDesc}
                            </div>
                        </button>
                    </div>
                </div>

                {/* Credits */}
                <div className="pt-4 border-t border-border">
                    <div className="text-center text-xs text-muted-foreground">
                        <p>{t.settings.credits}</p>
                        <p className="mt-1">{t.settings.copyright}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
