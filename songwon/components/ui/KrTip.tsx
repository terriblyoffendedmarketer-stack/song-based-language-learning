"use client";

import { type ReactNode } from "react";

interface KrTipProps {
  en: string;
  children: ReactNode;
  className?: string;
}

export function KrTip({ en, children, className = "" }: KrTipProps) {
  return (
    <span className={`kr-tip ${className}`} data-tip={en}>
      {children}
    </span>
  );
}
