"use client";

import { useState, useEffect } from "react";
import { getReminder, requestPermission, scheduleReminder, type ReminderSettings as Settings } from "@/lib/notifications";
import { KrTip } from "@/components/ui/KrTip";

export function ReminderSettings() {
  const [settings, setSettings] = useState<Settings>({ enabled: false, hour: 20, minute: 0 });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "denied">("idle");

  useEffect(() => {
    setSettings(getReminder());
  }, []);

  const handleToggle = async () => {
    const next = { ...settings, enabled: !settings.enabled };

    if (next.enabled) {
      const granted = await requestPermission();
      if (!granted) {
        setStatus("denied");
        return;
      }
    }

    setStatus("saving");
    await scheduleReminder(next);
    setSettings(next);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const handleTimeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [h, m] = e.target.value.split(":").map(Number);
    const next = { ...settings, hour: h, minute: m };
    setSettings(next);

    if (next.enabled) {
      setStatus("saving");
      await scheduleReminder(next);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      scheduleReminder(next);
    }
  };

  const timeValue = `${String(settings.hour).padStart(2, "0")}:${String(settings.minute).padStart(2, "0")}`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <div>
            <p className="text-sm font-bold">
              <KrTip en="Daily reminder">매일 알림</KrTip>
            </p>
            <p className="text-xs text-muted">
              {status === "denied"
                ? "Notifications blocked — check browser settings"
                : status === "saved"
                  ? "Saved!"
                  : "Korean trivia & study reminders"}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            settings.enabled ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              settings.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {settings.enabled && (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <span className="text-xs text-muted">
            <KrTip en="Remind at">알림 시간</KrTip>
          </span>
          <select
            value={timeValue}
            onChange={handleTimeChange}
            className="text-sm font-semibold bg-transparent border border-border rounded-lg px-2 py-1"
          >
            {Array.from({ length: 24 }, (_, h) =>
              [0, 30].map((m) => {
                const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
                return <option key={v} value={v}>{label}</option>;
              })
            )}
          </select>
        </div>
      )}
    </div>
  );
}
