"use client";

import { useCallback, useState, useRef } from "react";
import { extractMetadata, type ExtractedMetadata } from "@/lib/metadata";
import { KrTip } from "@/components/ui/KrTip";

interface UploadedSong {
  file: File;
  metadata: ExtractedMetadata;
  objectUrl: string;
}

interface SongUploaderProps {
  onSongsSelected: (songs: UploadedSong[]) => void;
}

export default function SongUploader({ onSongsSelected }: SongUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const mp3Files = Array.from(files).filter(
        (f) => f.type === "audio/mpeg" || f.name.endsWith(".mp3")
      );
      if (mp3Files.length === 0) return;

      setIsProcessing(true);
      setTotalCount(mp3Files.length);
      setProcessedCount(0);

      const results: UploadedSong[] = [];
      for (const file of mp3Files) {
        try {
          const metadata = await extractMetadata(file);
          const objectUrl = URL.createObjectURL(file);
          results.push({ file, metadata, objectUrl });
        } catch {
          const objectUrl = URL.createObjectURL(file);
          results.push({
            file,
            metadata: {
              title: file.name.replace(/\.[^/.]+$/, ""),
              artist: "알 수 없음",
              duration: 0,
            },
            objectUrl,
          });
        }
        setProcessedCount((c) => c + 1);
      }

      setIsProcessing(false);
      onSongsSelected(results);
    },
    [onSongsSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-12
        transition-all duration-200 text-center
        ${
          isDragging
            ? "border-accent bg-accent-light scale-[1.01]"
            : "border-border hover:border-accent/50 hover:bg-card"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,.mp3"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {isProcessing ? (
        <div className="space-y-3">
          <div className="text-4xl">🎵</div>
          <p className="kr text-lg font-bold"><KrTip en="Reading your songs...">노래를 읽고 있어요...</KrTip></p>
          <p className="text-sm text-muted">
            Processing {processedCount} / {totalCount}
          </p>
          <div className="mx-auto h-1.5 w-48 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (processedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-5xl">🎶</div>
          <p className="kr text-xl font-bold"><KrTip en="Upload your songs">노래를 올려주세요</KrTip></p>
          <p className="text-sm text-muted">
            Drop MP3 files here or tap to browse
          </p>
          <p className="text-xs text-faint">
            <KrTip en="You can upload multiple songs at once">여러 곡을 한 번에 올릴 수 있어요</KrTip> — Upload multiple songs at once
          </p>
        </div>
      )}
    </div>
  );
}

export type { UploadedSong };
