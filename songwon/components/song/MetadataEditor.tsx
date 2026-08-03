"use client";

import { useState } from "react";
import type { UploadedSong } from "./SongUploader";
import { formatDuration } from "@/lib/metadata";
import { KrTip } from "@/components/ui/KrTip";

interface MetadataEditorProps {
  songs: UploadedSong[];
  onConfirm: (songs: UploadedSong[]) => void;
  onBack: () => void;
}

export default function MetadataEditor({
  songs,
  onConfirm,
  onBack,
}: MetadataEditorProps) {
  const [edited, setEdited] = useState(songs);

  const updateSong = (index: number, field: "title" | "artist", value: string) => {
    setEdited((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, metadata: { ...s.metadata, [field]: value } }
          : s
      )
    );
  };

  const removeSong = (index: number) => {
    setEdited((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="kr text-xl font-bold"><KrTip en="Confirm song info">노래 정보 확인</KrTip></h2>
        <p className="text-sm text-muted">
          Check song details — edit if needed
        </p>
      </div>

      <div className="space-y-3">
        {edited.map((song, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center text-lg shrink-0">
                  🎵
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-faint font-mono">
                    {formatDuration(song.metadata.duration)} ·{" "}
                    {(song.file.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeSong(i)}
                className="text-faint hover:text-coral text-sm shrink-0 p-1"
                aria-label="Remove song"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-faint font-semibold mb-1">
                  <KrTip en="Title">제목</KrTip> Title
                </label>
                <input
                  type="text"
                  value={song.metadata.title}
                  onChange={(e) => updateSong(i, "title", e.target.value)}
                  className="w-full kr bg-background border border-border rounded-lg px-3 py-2
                    text-sm font-semibold focus:outline-none focus:border-accent
                    transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-faint font-semibold mb-1">
                  <KrTip en="Artist">가수</KrTip> Artist
                </label>
                <input
                  type="text"
                  value={song.metadata.artist}
                  onChange={(e) => updateSong(i, "artist", e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2
                    text-sm focus:outline-none focus:border-accent
                    transition-colors"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {edited.length === 0 && (
        <div className="text-center py-8 text-muted">
          <p className="kr"><KrTip en="No songs">노래가 없어요</KrTip></p>
          <p className="text-sm">No songs — go back and upload some</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold
            hover:bg-card transition-colors"
        >
          <KrTip en="Back">뒤로</KrTip> Back
        </button>
        <button
          onClick={() => onConfirm(edited)}
          disabled={edited.length === 0}
          className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-semibold
            hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <KrTip en="Confirm">확인</KrTip> ({edited.length}<KrTip en="songs">곡</KrTip>) Confirm
        </button>
      </div>
    </div>
  );
}
