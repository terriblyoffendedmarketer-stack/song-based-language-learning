"use client";

import { useEffect, useState } from "react";
import Confetti from "./Confetti";
import { KrTip } from "@/components/ui/KrTip";

interface LevelUpModalProps {
  level: string;
  onClose: () => void;
}

export default function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Confetti active={true} duration={3000} />

      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative bg-card border border-border rounded-2xl p-8 max-w-xs w-full mx-4
          text-center space-y-4 shadow-xl transition-all duration-500 ${
            show ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
      >
        <div className="text-6xl">🎊</div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-accent font-bold">
            LEVEL UP
          </p>
          <p className="kr text-3xl font-black">{level}</p>
        </div>
        <p className="text-sm text-muted kr">
          <KrTip en="Congrats! You leveled up!">축하해요! 다음 단계로 올라갔어요!</KrTip>
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-accent text-white font-semibold
            hover:bg-accent-hover transition-colors active:scale-[0.98]"
        >
          <KrTip en="Continue">계속하기</KrTip> Continue
        </button>
      </div>
    </div>
  );
}
