"use client";

import type { Song } from "@/lib/types";
import { formatDuration } from "@/lib/metadata";
import { KrTip } from "@/components/ui/KrTip";

interface SongCardProps {
  song: Song;
  lessonCount: number;
  lastStudied?: string;
  onClick: () => void;
}

export default function SongCard({
  song,
  lessonCount,
  lastStudied,
  onClick,
}: SongCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-card border border-border rounded-xl p-4
        hover:border-accent/40 hover:shadow-lg transition-all duration-200
        active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-accent-light flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
          🎵
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="kr font-bold text-sm truncate">{song.title}</h3>
          <p className="text-xs text-muted truncate">{song.artist}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono text-faint">
            {formatDuration(song.duration)}
          </p>
          {lessonCount > 0 && (
            <p className="text-xs text-accent font-semibold">
              {lessonCount}<KrTip en="lessons">개 수업</KrTip>
            </p>
          )}
        </div>
      </div>

      {song.lyrics && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="kr text-xs text-faint line-clamp-1">{song.lyrics.split("\n")[0]}</p>
        </div>
      )}

      {lastStudied && (
        <p className="mt-1 text-[10px] text-faint">
          <KrTip en="Last studied">마지막 공부</KrTip>: {lastStudied}
        </p>
      )}
    </button>
  );
}
