import { useState } from 'react';
import { createPortal } from 'react-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle01Icon, Download02Icon, ArrowLeft02Icon, MoreVerticalIcon, Share02Icon, Refresh01Icon, Information, PlayIcon, Shuffle, Favorite, Trash2, VideoCameraAiIcon, MusicNote01Icon, Cancel02Icon } from '@hugeicons/core-free-icons';

interface Format {
  format_id: string;
  ext: string;
  vcodec: string;
  acodec: string;
  height?: number;
  width?: number;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  abr?: number;
  vbr?: number;
  fps?: number;
  resolution?: string;
}

interface DisplayFormat extends Format {
  isMerged?: boolean;
  audio_format_id?: string;
}

interface VideoMetadata {
  title: string;
  uploader?: string;
  thumbnail?: string;
  duration?: string;
  view_count?: number;
  formats: Format[];
}

interface FormatCardProps {
  format: Format;
  isSelected: boolean;
  onSelect: () => void;
  getResolution: (format: Format) => string;
  formatFileSize: (bytes?: number) => string;
  getBitrate: (format: Format) => string;
  getCodecInfo: (format: Format) => string;
  type: 'combined' | 'video' | 'audio';
}

const FormatCard = ({
  format,
  isSelected,
  onSelect,
  getResolution,
  formatFileSize,
  getBitrate,
  getCodecInfo,
  type,
  isLoading = false,
}: FormatCardProps & { isLoading?: boolean }) => {
  return (
    <div className={`p-2 rounded-lg border-2 ${isLoading
      ? 'border-border bg-card animate-pulse skeleton-shimmer'
      : isSelected
        ? 'border-primary bg-primary/10'
        : 'border-border bg-card hover:border-primary/50'
      } ${!isLoading && 'hover:border-primary/50 cursor-pointer'}`}
      onClick={!isLoading ? onSelect : undefined}
    >
      {isLoading ? (
        <>
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex-1 min-w-0">
              <div className="h-[9px] bg-secondary/50 rounded w-4/5" />
            </div>
            <div className="w-3 h-3 bg-secondary/30 rounded ml-1.5 shrink-0" />
          </div>
          <div className="h-[8px] bg-secondary/40 rounded w-3/4 mb-1" />
          <div className="h-[7px] bg-secondary/30 rounded w-1/2 mb-1.5" />
          <div className="flex items-center justify-end gap-1 mt-1.5">
            <div className="w-[10px] h-[10px] bg-secondary/40 rounded-lg" />
            <div className="w-[10px] h-[10px] bg-secondary/40 rounded-lg" />
            <div className="w-8 h-[6px] bg-secondary/30 rounded-lg" />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold text-foreground truncate">
                {format.format_id} • {getResolution(format)}
              </p>
            </div>
            {isSelected && (
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} className="text-primary shrink-0 ml-1.5" />
            )}
          </div>
          <p className="text-[8px] text-muted-foreground mb-1 truncate">
            {formatFileSize(format.filesize || format.filesize_approx)} {getBitrate(format)}
          </p>
          <p className="text-[7px] text-muted-foreground/70 truncate">
            {getCodecInfo(format)}
          </p>
          <div className="flex items-center justify-end gap-1 mt-1.5">
            {(type === 'combined' || type === 'video') && (
              <HugeiconsIcon icon={VideoCameraAiIcon} size={10} className="text-primary" />
            )}
            {(type === 'combined' || type === 'audio') && (
              <HugeiconsIcon icon={MusicNote01Icon} size={10} className="text-secondary" />
            )}
            {type === 'video' && (
              <span className="text-[6px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-500 font-semibold">
                +Audio
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface FormatSelectorProps {
  isOpen: boolean;
  metadata: VideoMetadata | null;
  onDownload: (formatId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const getBestFormat = (formats: Format[]): Format | null => {
  // Find the best quality combined format
  const combinedFormats = formats.filter(
    (f: Format) => {
      if (f.format_id && f.format_id.includes('+')) {
        return true;
      }
      return f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none';
    }
  );

  if (combinedFormats.length > 0) {
    // Sort by height, then video bitrate, then total bitrate to find best
    return combinedFormats.sort((a: Format, b: Format) => {
      const heightA = a.height || 0;
      const heightB = b.height || 0;
      if (heightA !== heightB) {
        return heightB - heightA;
      }
      
      // Prefer higher video bitrate over total bitrate when available
      const vbrA = a.vbr || 0;
      const vbrB = b.vbr || 0;
      if (vbrA !== vbrB) {
        return vbrB - vbrA;
      }
      
      const tbrA = a.tbr || 0;
      const tbrB = b.tbr || 0;
      return tbrB - tbrA;
    })[0];
  }

  // If no combined formats, find best video and merge with best audio
  const videoFormats = formats.filter(
    (f: Format) => f.vcodec && f.vcodec !== 'none' && (!f.acodec || f.acodec === 'none')
  );
  const audioFormats = formats.filter(
    (f: Format) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
  );

  if (videoFormats.length > 0 && audioFormats.length > 0) {
    // Sort video formats by height, then video bitrate
    const bestVideo = videoFormats.sort((a: Format, b: Format) => {
      const heightA = a.height || 0;
      const heightB = b.height || 0;
      if (heightA !== heightB) {
        return heightB - heightA;
      }
      const vbrA = a.vbr || a.tbr || 0;
      const vbrB = b.vbr || b.tbr || 0;
      return vbrB - vbrA;
    })[0];
    
    // Sort audio formats by audio bitrate
    const bestAudio = audioFormats.sort((a: Format, b: Format) => (b.abr || 0) - (a.abr || 0))[0];

    return {
      ...bestVideo,
      format_id: `${bestVideo.format_id}+${bestAudio.format_id}`,
      acodec: bestAudio.acodec,
      abr: bestAudio.abr,
    };
  }

  return null;
};

export const FormatSelector = ({
  isOpen,
  metadata,
  onDownload,
  onClose,
  isLoading = false,
}: FormatSelectorProps) => {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['combined', 'video', 'audio']));

  console.log("[FormatSelector] Rendered with isOpen:", isOpen, "metadata:", !!metadata, "isLoading:", isLoading);

  if (!isOpen) {
    console.log("[FormatSelector] Not rendering - isOpen:", isOpen);
    return null;
  }

  // Show loading state when fetching metadata
  if (isLoading || !metadata) {
    console.log("[FormatSelector] Showing loading state");
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
        <div className="w-full max-w-lg max-h-[85vh] rounded-lg bg-card shadow-2xl border border-border overflow-hidden flex flex-col m-4 pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-3  shrink-0">
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <HugeiconsIcon icon={Cancel02Icon} size={16} className="text-muted-foreground" />
            </button>
            <h2 className="text-base font-semibold text-foreground">
              Select Format
            </h2>
            <div className="w-16" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* Metadata Card Skeleton */}
            <div className="flex gap-3 mb-6 p-4 rounded-lg bg-secondary/50 animate-pulse">
              <div className="shrink-0 w-24 h-16 rounded-lg bg-secondary/50" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 bg-secondary/50 rounded w-3/4" />
                <div className="h-3 bg-secondary/40 rounded w-1/2" />
                <div className="flex items-center gap-2">
                  <div className="h-6 w-16 bg-secondary/40 rounded-lg" />
                  <div className="h-6 w-20 bg-secondary/40 rounded-lg" />
                  <div className="h-6 w-20 bg-secondary/40 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Best Quality Skeleton */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">
              Best Quality
              </h3>
              <FormatCard
                format={{} as Format}
                isSelected={false}
                onSelect={() => { }}
                getResolution={() => ''}
                formatFileSize={() => ''}
                getBitrate={() => ''}
                getCodecInfo={() => ''}
                type="combined"
                isLoading={true}
              />
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-foreground mb-2">
                  Video + Audio
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <FormatCard
                      key={`combined-${i}`}
                      format={{} as Format}
                      isSelected={false}
                      onSelect={() => { }}
                      getResolution={() => ''}
                      formatFileSize={() => ''}
                      getBitrate={() => ''}
                      getCodecInfo={() => ''}
                      type="combined"
                      isLoading={true}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground mb-2">
                  Video Only (Audio will be added)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <FormatCard
                      key={`video-${i}`}
                      format={{} as Format}
                      isSelected={false}
                      onSelect={() => { }}
                      getResolution={() => ''}
                      formatFileSize={() => ''}
                      getBitrate={() => ''}
                      getCodecInfo={() => ''}
                      type="video"
                      isLoading={true}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground mb-2">
                  Audio Only
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <FormatCard
                      key={`audio-${i}`}
                      format={{} as Format}
                      isSelected={false}
                      onSelect={() => { }}
                      getResolution={() => ''}
                      formatFileSize={() => ''}
                      getBitrate={() => ''}
                      getCodecInfo={() => ''}
                      type="audio"
                      isLoading={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const formats = metadata.formats || [];
  const bestFormat = getBestFormat(formats);

  const combinedFormats = formats.filter(
    (f: Format) => {
      if (f.format_id && f.format_id.includes('+')) {
        return true;
      }
      return f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none';
    }
  );

  const videoOnlyFormats = formats.filter(
    (f: Format) => {
      if (f.format_id && f.format_id.includes('+')) {
        return false;
      }
      return f.vcodec && f.vcodec !== 'none' && (!f.acodec || f.acodec === 'none')
    }
  ).sort((a: Format, b: Format) => {
    const heightA = a.height || 0;
    const heightB = b.height || 0;
    if (heightA !== heightB) {
      return heightB - heightA;
    }
    const bitrateA = a.vbr || a.tbr || 0;
    const bitrateB = b.vbr || b.tbr || 0;
    return bitrateB - bitrateA;
  });

  const audioOnlyFormats = formats
    .filter((f: Format) => {
      if (f.format_id && f.format_id.includes('+')) {
        return false;
      }
      return f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
    })
    .sort((a: Format, b: Format) => (b.abr || 0) - (a.abr || 0));

  const bestAudioFormat = audioOnlyFormats[0];

  const mergedFormats: DisplayFormat[] = bestAudioFormat
    ? videoOnlyFormats.map((videoFormat) => ({
      ...videoFormat,
      format_id: `${videoFormat.format_id}+${bestAudioFormat.format_id}`,
      acodec: bestAudioFormat.acodec,
      abr: bestAudioFormat.abr,
      isMerged: true,
      audio_format_id: bestAudioFormat.format_id,
    }))
    : [];

  const combinedDisplayFormats: DisplayFormat[] = [
    ...combinedFormats.map((format) => ({ ...format, isMerged: false })),
    ...mergedFormats,
  ].sort((a: DisplayFormat, b: DisplayFormat) => {
    const heightA = a.height || 0;
    const heightB = b.height || 0;
    if (heightA !== heightB) {
      return heightB - heightA;
    }
    const bitrateA = a.tbr || 0;
    const bitrateB = b.tbr || 0;
    return bitrateB - bitrateA;
  });

  const maxHeight = formats
    .map((format) => format.height || 0)
    .reduce((max, current) => Math.max(max, current), 0);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return 'N/A';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const getResolution = (format: Format): string => {
    if (format.height) {
      let res = `${format.width || 0}x${format.height}`;
      if (format.height >= 2160) res += ' (4K)';
      else if (format.height >= 1440) res += ' (2K)';
      else if (format.height >= 1080) res += ' (1080p)';
      else if (format.height >= 720) res += ' (720p)';
      else if (format.height >= 480) res += ' (480p)';
      else if (format.height >= 360) res += ' (360p)';
      return res;
    }
    if (format.abr) return `${Math.round(format.abr)} kbps`;
    return 'Unknown';
  };

  const getBitrate = (format: Format): string => {
    if (format.tbr) return `${Math.round(format.tbr)} Kbps`;
    if (format.abr) return `${Math.round(format.abr)} Kbps`;
    if (format.vbr) return `${Math.round(format.vbr)} Kbps`;
    return '';
  };

  const getCodecInfo = (format: Format): string => {
    const ext = format.ext?.toUpperCase() || '';
    let codecs = '';
    if (format.vcodec && format.vcodec !== 'none') {
      codecs += format.vcodec.split('.')[0];
    }
    if (format.acodec && format.acodec !== 'none') {
      if (codecs) codecs += ' ';
      codecs += format.acodec.split('.')[0];
    }
    return codecs ? `${ext} (${codecs})` : ext;
  };

  const formatViewCount = (count?: number): string => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const handleDownload = () => {
    if (selectedFormat) {
      onDownload(selectedFormat);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
      <div className="w-full max-w-lg max-h-[85vh] rounded-lg bg-card shadow-2xl border border-border overflow-hidden flex flex-col m-4 pointer-events-auto">
        <div className="flex items-center justify-between px-4 py-3  shrink-0">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <HugeiconsIcon icon={Cancel02Icon} size={16} className="text-muted-foreground" />
          </button>
          <h2 className="text-base font-semibold text-foreground">
            Select Format
          </h2>
          <button
            onClick={handleDownload}
            disabled={!selectedFormat}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${selectedFormat
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-secondary text-muted-foreground cursor-not-allowed'
              }`}
          >
            Download
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Video Metadata Section */}
          <div className="flex gap-3 mb-6 p-4 rounded-lg bg-secondary/50">
            <div className="shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-black">
              {metadata.thumbnail ? (
                <img
                  src={metadata.thumbnail}
                  alt={metadata.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <HugeiconsIcon icon={VideoCameraAiIcon} size={20} className="text-white/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-2 text-foreground line-clamp-2">
                {metadata.title}
              </h3>
              {metadata.uploader && (
                <p className="text-sm text-muted-foreground mb-2">
                  {metadata.uploader}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {metadata.duration && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-secondary text-foreground">
                    {metadata.duration}
                  </span>
                )}
                {metadata.view_count && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-secondary text-foreground">
                    {formatViewCount(metadata.view_count)} views
                  </span>
                )}
                {formats.length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-secondary text-foreground">
                    {formats.length} formats
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Best Format Option */}
          {bestFormat && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Best Quality
              </h3>
              <FormatCard
                format={bestFormat}
                isSelected={selectedFormat === bestFormat.format_id}
                onSelect={() => setSelectedFormat(bestFormat.format_id)}
                getResolution={getResolution}
                formatFileSize={formatFileSize}
                getBitrate={getBitrate}
                getCodecInfo={getCodecInfo}
                type="combined"
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Format Categories */}
          <div className="space-y-6">
            {/* Video + Audio */}
            {combinedDisplayFormats.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Video + Audio
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(expandedCategories.has('combined') ? combinedDisplayFormats : combinedDisplayFormats.slice(0, 4)).map((format: DisplayFormat) => (
                    <FormatCard
                      key={format.format_id}
                      format={format}
                      isSelected={selectedFormat === format.format_id}
                      onSelect={() => setSelectedFormat(format.format_id)}
                      getResolution={getResolution}
                      formatFileSize={formatFileSize}
                      getBitrate={getBitrate}
                      getCodecInfo={getCodecInfo}
                      type="combined"
                      isLoading={isLoading}
                    />
                  ))}
                </div>
                {combinedDisplayFormats.length > 4 && (
                  <button
                    onClick={() => toggleCategory('combined')}
                    className="text-xs text-primary hover:underline mt-2"
                  >
                    {expandedCategories.has('combined') ? 'Show less' : `Show all ${combinedDisplayFormats.length}`}
                  </button>
                )}
              </div>
            )}

            {/* Video Only */}
            {videoOnlyFormats.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Video Only (Audio will be added)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(expandedCategories.has('video') ? videoOnlyFormats : videoOnlyFormats.slice(0, 4)).map((format: Format) => (
                    <FormatCard
                      key={format.format_id}
                      format={format}
                      isSelected={selectedFormat === format.format_id}
                      onSelect={() => setSelectedFormat(format.format_id)}
                      getResolution={getResolution}
                      formatFileSize={formatFileSize}
                      getBitrate={getBitrate}
                      getCodecInfo={getCodecInfo}
                      type="video"
                      isLoading={isLoading}
                    />
                  ))}
                </div>
                {videoOnlyFormats.length > 4 && (
                  <button
                    onClick={() => toggleCategory('video')}
                    className="text-xs text-primary hover:underline mt-2"
                  >
                    {expandedCategories.has('video') ? 'Show less' : `Show all ${videoOnlyFormats.length}`}
                  </button>
                )}
              </div>
            )}

            {/* Audio Only */}
            {audioOnlyFormats.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                 Audio Only
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(expandedCategories.has('audio') ? audioOnlyFormats : audioOnlyFormats.slice(0, 4)).map((format: Format) => (
                    <FormatCard
                      key={format.format_id}
                      format={format}
                      isSelected={selectedFormat === format.format_id}
                      onSelect={() => setSelectedFormat(format.format_id)}
                      getResolution={getResolution}
                      formatFileSize={formatFileSize}
                      getBitrate={getBitrate}
                      getCodecInfo={getCodecInfo}
                      type="audio"
                      isLoading={isLoading}
                    />
                  ))}
                </div>
                {audioOnlyFormats.length > 4 && (
                  <button
                    onClick={() => toggleCategory('audio')}
                    className="text-xs text-primary hover:underline mt-2"
                  >
                    {expandedCategories.has('audio') ? 'Show less' : `Show all ${audioOnlyFormats.length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
