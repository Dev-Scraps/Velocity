import { useState, useMemo } from 'react';
import {
    getVideoMetadata,
    getVideoFormats,
    loadCookies,
    startDownloadTask,
    upsertDownloadTask,
    type Video,
    VideoFormat
} from './useRustCommands';
import { FormatSelector } from '../components/FormatSelector';

interface DownloadFlowOptions {
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
}

export function useDownloadFlow({ onSuccess, onError }: DownloadFlowOptions = {}) {
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [configureMetadata, setConfigureMetadata] = useState<any>(null);
    const [targetVideoUrl, setTargetVideoUrl] = useState<string>('');
    const [targetVideoId, setTargetVideoId] = useState<string>('');

    const requestDownload = async (videoUrlOrId: string) => {
        // If it's just an ID, construct URL. Ideally we support both.
        // Assuming simple YouTube URL for now if it looks like one, or constructing one.
        const url = videoUrlOrId.startsWith('http')
            ? videoUrlOrId
            : `https://www.youtube.com/watch?v=${videoUrlOrId}`;

        setTargetVideoUrl(url);
        setIsConfiguring(true);
        setIsLoadingMetadata(true);

        try {
            const cookies = await loadCookies();

            // Fetch metadata and formats
            let metadata;
            let formats: VideoFormat[];
            try {
                metadata = await getVideoMetadata(url, cookies);
                formats = await getVideoFormats(url, cookies);
            } catch (err) {
                console.warn("Retrying fetch or falling back...", err);
                // Basic fallback if fetch fails (e.g. network or yt-dlp issue)
                // We might want to just let it fail or use what we have.
                // For now, let's extract some basic info if we can't get full metadata
                metadata = {
                    id: url.split('v=')[1] || 'unknown',
                    title: 'Unknown Title',
                    channelName: 'Unknown Channel',
                    thumbnailUrl: '',
                    duration: '',
                    viewCount: 0
                };
                formats = [];
            }

            setTargetVideoId(metadata.id);
            setConfigureMetadata({
                title: metadata.title,
                uploader: metadata.channelName || 'Unknown',
                channel: metadata.channelName || 'Unknown',
                thumbnail: metadata.thumbnailUrl,
                duration: metadata.duration,
                view_count: metadata.viewCount,
                formats: formats
            });

        } catch (error) {
            console.error("Failed to initiate download flow:", error);
            onError?.(error);
            setIsConfiguring(false); // Close if we failed completely
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    const handleDownloadConfirm = async (formatId: string) => {
        try {
            if (!targetVideoId) throw new Error("No target video ID");

            const taskId = Date.now().toString();

            await upsertDownloadTask({
                id: taskId,
                videoId: targetVideoId,
                title: configureMetadata?.title || targetVideoId,
                status: "queued",
                progress: 0,
                speed: "0 MB/s",
                eta: "0:00",
                formatId,
                resolution: undefined,
                codecInfo: undefined,
                fileSize: undefined,
                fps: undefined,
                thumbnailUrl: configureMetadata?.thumbnail || null,
            });

            await startDownloadTask(taskId, targetVideoUrl, formatId);

            setIsConfiguring(false);
            onSuccess?.();
        } catch (error) {
            console.error("Download confirmation failed:", error);
            onError?.(error);
        }
    };

    const DownloadModal = useMemo(() => (
        <FormatSelector
            isOpen={isConfiguring}
            metadata={configureMetadata}
            onDownload={handleDownloadConfirm}
            onClose={() => setIsConfiguring(false)}
            isLoading={isLoadingMetadata}
        />
    ), [isConfiguring, configureMetadata, handleDownloadConfirm, isLoadingMetadata]);

    return {
        requestDownload,
        DownloadModal
    };
}
