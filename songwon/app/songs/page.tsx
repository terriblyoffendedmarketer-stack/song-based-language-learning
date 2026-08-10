"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { loadSongIndex, type SongIndex, type SongIndexEntry } from "@/lib/seed-loader";
import { KrTip } from "@/components/ui/KrTip";
import { BottomNav } from "@/components/BottomNav";

export default function SongsPage() {
  const [index, setIndex] = useState<SongIndex | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "in-lessons" | "extra">("all");

  useEffect(() => {
    loadSongIndex().then(setIndex).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!index) return [];
    let songs = index.songs;

    if (filter === "in-lessons") {
      songs = songs.filter((s) => s.lessons && s.lessons.length > 0);
    } else if (filter === "extra") {
      songs = songs.filter((s) => !s.lessons || s.lessons.length === 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      songs = songs.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
      );
    }

    return songs;
  }, [index, search, filter]);

  const artists = useMemo(() => {
    const grouped: Record<string, SongIndexEntry[]> = {};
    for (const song of filtered) {
      (grouped[song.artist] ??= []).push(song);
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (!index) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-2xl animate-pulse">🎵</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="px-4 py-4 border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-black">
                <KrTip en="Song Library">노래 도서관</KrTip>
              </h1>
              <p className="text-xs text-muted">
                {index.totalSongs} songs · learn any song
              </p>
            </div>
            <Link
              href="/"
              className="text-xs text-accent hover:text-accent-hover"
            >
              <KrTip en="Home">홈</KrTip>
            </Link>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs or artists..."
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm placeholder:text-faint focus:outline-none focus:border-accent"
          />

          <div className="flex gap-2 mt-3">
            {(
              [
                { key: "all", label: "전체", en: "All" },
                { key: "in-lessons", label: "레슨", en: "In Lessons" },
                { key: "extra", label: "추가", en: "Extra" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  filter === f.key
                    ? "bg-accent text-white border-accent"
                    : "bg-card text-muted border-border hover:border-faint"
                }`}
              >
                <KrTip en={f.en}>{f.label}</KrTip>
                {f.key === "all" && (
                  <span className="ml-1 opacity-70">{index.totalSongs}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {artists.map(([artist, songs]) => (
            <div key={artist}>
              <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-2">
                {artist}
              </p>
              <div className="space-y-2">
                {songs.map((song) => (
                  <SongCard key={song.id} song={song} />
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm text-muted">No songs found</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav active="home" />
    </div>
  );
}

function SongCard({ song }: { song: SongIndexEntry }) {
  const hasLessons = song.lessons && song.lessons.length > 0;
  const practiceLines = Math.min(song.uniqueKoreanLines, 15);

  return (
    <Link
      href={`/songs/${song.id}/practice`}
      className="block bg-card border border-border rounded-xl p-4 hover:shadow-md hover:border-accent/40 transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate">{song.title}</h3>
          <p className="text-xs text-muted mt-0.5">{song.artist}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-faint">
            ~{practiceLines} lines
          </span>
          {hasLessons && (
            <span className="text-[9px] bg-accent-light text-accent px-1.5 py-0.5 rounded-md font-semibold">
              L{song.lessons!.map((l) => l.lessonNumber).join(",")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
