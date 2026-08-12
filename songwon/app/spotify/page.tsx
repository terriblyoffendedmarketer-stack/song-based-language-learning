"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KrTip } from "@/components/ui/KrTip";
import { BottomNav } from "@/components/BottomNav";

interface SpotifyTrack {
  artist: string;
  title: string;
  spotifyId: string;
  spotifyUrl: string;
  albumArt: string | null;
}

interface SpotifyData {
  tracks: SpotifyTrack[];
  totalFound: number;
  totalSongs: number;
}

export default function SpotifyPage() {
  const router = useRouter();
  const [data, setData] = useState<SpotifyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/spotify_tracks.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-2xl animate-pulse">🎧</div>
      </div>
    );
  }

  if (!data || data.tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg"><KrTip en="No tracks available">트랙 없음</KrTip></p>
        <button onClick={() => router.push("/")} className="text-accent text-sm">
          ← <KrTip en="Home">홈</KrTip>
        </button>
      </div>
    );
  }

  const grouped: Record<string, SpotifyTrack[]> = {};
  for (const t of data.tracks) {
    (grouped[t.artist] ??= []).push(t);
  }
  const artists = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-20">
      <header className="px-4 py-4 border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black">
                <KrTip en="Study Playlist">학습 플레이리스트</KrTip>
              </h1>
              <p className="text-xs text-muted">
                {data.totalFound}<KrTip en=" songs on Spotify">곡 · Spotify에서 듣기</KrTip>
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="text-xs text-accent hover:text-accent-hover"
            >
              <KrTip en="Home">홈</KrTip>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {artists.map(([artist, tracks]) => (
            <div key={artist}>
              <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-2">
                {artist}
              </p>
              <div className="space-y-2">
                {tracks.map((track) => (
                  <a
                    key={track.spotifyId}
                    href={track.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-green-500/40 transition-all active:scale-[0.98]"
                  >
                    {track.albumArt ? (
                      <img
                        src={track.albumArt}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-border flex items-center justify-center text-sm flex-shrink-0">
                        🎵
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{track.title}</p>
                      <p className="text-xs text-muted">{track.artist}</p>
                    </div>
                    <span className="text-green-500 text-sm flex-shrink-0">▶</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav active="songs" />
    </div>
  );
}
