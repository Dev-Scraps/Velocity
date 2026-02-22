import { useCallback, useEffect, useState } from "react";
import { loadCookies } from "../hooks/useRustCommands";
import { invoke } from "@tauri-apps/api/core";

interface PlaylistItem {
  id: string;
  title: string;
  uploader?: string;
  thumbnail?: string;
}

interface UsePlaylists {
  playlists: PlaylistItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export const usePlaylists = (): UsePlaylists => {
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const cookies = await loadCookies();

      const result = await invoke<any>("get_user_playlists", { cookies });

      if (result.error) {
        throw new Error(result.message || "Failed to fetch playlists");
      }

      const playlistItems: PlaylistItem[] = (result.playlists || []).map(
        (pl: any) => ({
          id: pl.id,
          title: pl.title,
          uploader: pl.uploader,
          thumbnail: pl.thumbnail,
        })
      );

      // Add special playlists
      if (result.special_playlists) {
        result.special_playlists.forEach((sp: any) => {
          playlistItems.push({
            id: sp.id,
            title: sp.title,
            uploader: "YouTube",
            thumbnail: sp.thumbnail,
          });
        });
      }

      setPlaylists(playlistItems);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load playlists";
      setError(msg);
      console.error("Playlist fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  return {
    playlists,
    isLoading,
    error,
    refresh: fetchPlaylists,
  };
};

export const usePlaylistVideos = (playlistId: string) => {
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    if (!playlistId) return;

    try {
      setIsLoading(true);
      setError(null);

      const cookies = await loadCookies();

      const result = await invoke<any>("get_playlist_videos", {
        playlist_id: playlistId,
        cookies,
      });

      if (result.error) {
        throw new Error(result.message || "Failed to fetch videos");
      }

      setVideos(result.entries || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load videos";
      setError(msg);
      console.error("Video fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return {
    videos,
    isLoading,
    error,
    refresh: fetchVideos,
  };
};
