"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SongUploader, { type UploadedSong } from "@/components/song/SongUploader";
import MetadataEditor from "@/components/song/MetadataEditor";
import { addSong, saveAudioBlob } from "@/lib/storage";
import type { Song } from "@/lib/types";
import { KrTip } from "@/components/ui/KrTip";

type Step = "upload" | "confirm" | "saving";

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [uploadedSongs, setUploadedSongs] = useState<UploadedSong[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  const handleSongsSelected = useCallback((songs: UploadedSong[]) => {
    setUploadedSongs(songs);
    setStep("confirm");
  }, []);

  const handleConfirm = useCallback(
    async (songs: UploadedSong[]) => {
      setStep("saving");
      setSavedCount(0);

      for (const uploaded of songs) {
        const song: Song = {
          id: crypto.randomUUID(),
          title: uploaded.metadata.title,
          artist: uploaded.metadata.artist,
          album: uploaded.metadata.album,
          duration: uploaded.metadata.duration,
          createdAt: new Date().toISOString(),
        };

        addSong(song);
        await saveAudioBlob(song.id, uploaded.file);
        setSavedCount((c) => c + 1);
      }

      router.push("/");
    },
    [router]
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (step === "confirm") setStep("upload");
              else router.push("/");
            }}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            ← <KrTip en="Back">뒤로</KrTip>
          </button>
          <h1 className="kr font-bold"><KrTip en="Add songs">노래 추가</KrTip></h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Steps indicator */}
      <div className="px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          {[{kr: "올리기", en: "Upload"}, {kr: "확인", en: "Confirm"}, {kr: "저장", en: "Save"}].map((item, i) => {
            const stepIndex =
              step === "upload" ? 0 : step === "confirm" ? 1 : 2;
            const isActive = i <= stepIndex;
            return (
              <div key={item.kr} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    isActive ? "bg-accent" : "bg-border"
                  }`}
                />
                <span
                  className={`text-[10px] font-semibold transition-colors ${
                    isActive ? "text-accent" : "text-faint"
                  }`}
                >
                  <KrTip en={item.en}>{item.kr}</KrTip>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-lg mx-auto page-enter">
          {step === "upload" && (
            <SongUploader onSongsSelected={handleSongsSelected} />
          )}

          {step === "confirm" && (
            <MetadataEditor
              songs={uploadedSongs}
              onConfirm={handleConfirm}
              onBack={() => setStep("upload")}
            />
          )}

          {step === "saving" && (
            <div className="text-center py-16 space-y-4">
              <div className="text-5xl animate-pulse">💾</div>
              <p className="kr text-lg font-bold"><KrTip en="Saving...">저장하고 있어요...</KrTip></p>
              <p className="text-sm text-muted">
                Saving {savedCount} / {uploadedSongs.length}
              </p>
              <div className="mx-auto h-1.5 w-48 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      uploadedSongs.length > 0
                        ? (savedCount / uploadedSongs.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
