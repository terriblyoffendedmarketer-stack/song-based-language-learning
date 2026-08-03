"use client";

import { useAudioPlayer } from "@/hooks/useAudioPlayer";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ songName, autoPlay }: { songName: string; autoPlay?: boolean }) {
  const { isPlaying, isLoaded, duration, currentTime, toggle, seek } =
    useAudioPlayer({ songName, autoPlay });

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={!isLoaded}
          className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center
            hover:bg-accent-hover transition-colors active:scale-95 disabled:opacity-40"
        >
          {!isLoaded ? (
            <span className="text-sm animate-pulse">...</span>
          ) : isPlaying ? (
            <span className="text-sm">⏸</span>
          ) : (
            <span className="text-sm ml-0.5">▶</span>
          )}
        </button>

        <div className="flex-1 space-y-1">
          <div
            className="h-1.5 bg-border rounded-full cursor-pointer relative overflow-hidden"
            onClick={(e) => {
              if (!duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seek(pct * duration);
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-accent rounded-full transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-faint font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MiniPlayButton({
  songName,
  label,
}: {
  songName: string;
  label?: string;
}) {
  const { isPlaying, isLoaded, toggle } = useAudioPlayer({ songName });

  return (
    <button
      onClick={toggle}
      disabled={!isLoaded}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-light
        text-accent text-xs font-semibold hover:bg-accent/20 transition-colors
        disabled:opacity-40"
    >
      <span>{isPlaying ? "⏸" : "▶"}</span>
      {label && <span>{label}</span>}
    </button>
  );
}
