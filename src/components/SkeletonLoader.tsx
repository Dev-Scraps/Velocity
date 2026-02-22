import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div 
      className={`animate-pulse rounded-md bg-muted ${className}`}
      role="status"
      aria-label="Loading..."
    />
  );
};

// Playlist Skeleton
export const PlaylistSkeleton: React.FC = () => {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
      <Skeleton className="w-12 h-12 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-8" />
    </div>
  );
};

// Playlist Card Skeleton
export const SkeletonPlaylistCard: React.FC = () => {
  return (
    <div className="rounded-lg overflow-hidden transition-all duration-300 cursor-pointer bg-card border border-border shadow-sm">
      <div className="p-3">
        <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden mb-3">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
};

// Video Card Skeleton
export const VideoCardSkeleton: React.FC = () => {
  return (
    <div className="bg-card rounded-lg  overflow-hidden hover:shadow-md transition-shadow">
      <Skeleton className="w-full aspect-video p-2 rounded-lg" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/6" />
        </div>
      </div>
    </div>
  );
};

// Collapsed Playlist Skeleton
export const CollapsedPlaylistSkeleton: React.FC = () => {
  return (
    <div className="px-1 py-3 space-y-3 overflow-y-auto transition-all duration-500 ease-in-out">
      {Array.from({ length: 5 }, (_, i) => (
        <div 
          key={i}
          className="w-30 h-14 rounded-lg overflow-hidden bg-muted mx-auto border border-border animate-pulse"
        >
          <div className="w-full h-full bg-muted/80" />
        </div>
      ))}
    </div>
  );
};

// Expanded Playlist Skeleton
export const ExpandedPlaylistSkeleton: React.FC = () => {
  return (
    <div className="flex-grow px-1 space-y-2.5 overflow-y-auto transition-all duration-500 ease-in-out">
      {Array.from({ length: 5 }, (_, i) => (
        <div 
          key={i}
          className="flex items-center gap-2.5 p-2 rounded-lg border border-border bg-card animate-pulse"
        >
          <div className="w-30 h-14 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted overflow-hidden">
            <div className="w-full h-full bg-muted/80" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
            <div className="h-3 w-1/4 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};
export const SidebarSkeleton: React.FC = () => {
  return (
    <div className="w-80 h-full bg-background border-r p-4 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      
      <div className="space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <PlaylistSkeleton />
        <PlaylistSkeleton />
        <PlaylistSkeleton />
        <PlaylistSkeleton />
      </div>
    </div>
  );
};

// Main Content Skeleton
export const MainContentSkeleton: React.FC = () => {
  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <VideoCardSkeleton />
        <VideoCardSkeleton />
        <VideoCardSkeleton />
        <VideoCardSkeleton />
        <VideoCardSkeleton />
        <VideoCardSkeleton />
        <VideoCardSkeleton />
        <VideoCardSkeleton />
      </div>
    </div>
  );
};

// Header Skeleton
export const HeaderSkeleton: React.FC = () => {
  return (
    <div className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-64" />
      </div>
      
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
};

// Loading State Component with Skeletons
interface LoadingStateProps {
  type?: 'playlist' | 'video' | 'sidebar' | 'main' | 'header' | 'full' | 'collapsed-playlist' | 'expanded-playlist';
  count?: number;
  children?: React.ReactNode;
  isLoading: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  type = 'full', 
  count = 4, 
  children,
  isLoading 
}) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  const renderSkeleton = () => {
    switch (type) {
      case 'playlist':
        return Array.from({ length: count }, (_, i) => <PlaylistSkeleton key={i} />);
      case 'video':
        return Array.from({ length: count }, (_, i) => <VideoCardSkeleton key={i} />);
      case 'sidebar':
        return <SidebarSkeleton />;
      case 'main':
        return <MainContentSkeleton />;
      case 'header':
        return <HeaderSkeleton />;
      case 'collapsed-playlist':
        return <CollapsedPlaylistSkeleton />;
      case 'expanded-playlist':
        return <ExpandedPlaylistSkeleton />;
      case 'full':
        return (
          <div className="w-full h-screen flex flex-col">
            <HeaderSkeleton />
            <div className="flex flex-1">
              <SidebarSkeleton />
              <MainContentSkeleton />
            </div>
          </div>
        );
      default:
        return <Skeleton className="w-full h-32" />;
    }
  };

  return (
    <div className="animate-fadeIn">
      {renderSkeleton()}
    </div>
  );
};
