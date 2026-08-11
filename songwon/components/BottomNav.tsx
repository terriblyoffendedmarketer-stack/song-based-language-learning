"use client";

import Link from "next/link";
import { KrTip } from "@/components/ui/KrTip";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", label: "홈", en: "Home", key: "home" },
  { href: "/browse", icon: "📚", label: "레슨", en: "Lessons", key: "browse" },
  { href: "/songs", icon: "🎵", label: "노래", en: "Songs", key: "songs" },
  { href: "/practice", icon: "✏️", label: "연습", en: "Practice", key: "practice" },
  { href: "/progress", icon: "📊", label: "기록", en: "Progress", key: "progress" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav className="border-t border-border bg-card px-4 py-2">
      <div className="max-w-lg mx-auto flex justify-around">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors ${
              active === item.key
                ? "text-accent"
                : "text-faint hover:text-muted"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] font-semibold kr">
              <KrTip en={item.en}>{item.label}</KrTip>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
