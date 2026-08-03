"use client";

import { type ReactNode, useState, useCallback } from "react";

interface KrTipProps {
  en: string;
  children: ReactNode;
  className?: string;
}

export function KrTip({ en, children, className = "" }: KrTipProps) {
  const [showTip, setShowTip] = useState(false);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // On touch devices, toggle the tooltip on tap
    if ("ontouchstart" in window) {
      e.preventDefault();
      setShowTip((prev) => !prev);
      if (!showTip) {
        setTimeout(() => setShowTip(false), 2500);
      }
    }
  }, [showTip]);

  return (
    <span
      className={`kr-tip ${showTip ? "show-tip" : ""} ${className}`}
      data-tip={en}
      onClick={handleTap}
      role="note"
      tabIndex={0}
    >
      {children}
    </span>
  );
}
