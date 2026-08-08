import trivia from "./notification-trivia.json";

const REMINDER_KEY = "songwon-reminder";
const LAST_NOTIFIED_KEY = "songwon-last-notified";

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export function getReminder(): ReminderSettings {
  if (typeof window === "undefined") return { enabled: false, hour: 20, minute: 0 };
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, hour: 20, minute: 0 };
}

export function saveReminder(settings: ReminderSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
}

function getRandomTrivia(): string {
  return trivia[Math.floor(Math.random() * trivia.length)];
}

function isCapacitor(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).Capacitor;
}

async function requestWebPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function requestPermission(): Promise<boolean> {
  if (isCapacitor()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const result = await LocalNotifications.requestPermissions();
      return result.display === "granted";
    } catch {
      return requestWebPermission();
    }
  }
  return requestWebPermission();
}

export async function scheduleReminder(settings: ReminderSettings): Promise<void> {
  saveReminder(settings);

  if (!settings.enabled) {
    await cancelReminder();
    return;
  }

  if (isCapacitor()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] });

      const now = new Date();
      const next = new Date();
      next.setHours(settings.hour, settings.minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1,
            title: "Songwon Korean",
            body: getRandomTrivia(),
            schedule: {
              at: next,
              repeats: true,
              every: "day",
            },
            sound: undefined,
            smallIcon: "ic_stat_icon_config_sample",
            iconColor: "#6C63FF",
          },
        ],
      });
      return;
    } catch {
      // Fall through to web approach
    }
  }

  // Web/PWA: register service worker check
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Use periodicSync if available (Chrome only, limited)
      if ("periodicSync" in reg) {
        try {
          await (reg as unknown as { periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } })
            .periodicSync.register("songwon-reminder", { minInterval: 24 * 60 * 60 * 1000 });
        } catch {
          // periodicSync denied or unavailable
        }
      }
    } catch {}
  }
}

export async function cancelReminder(): Promise<void> {
  saveReminder({ enabled: false, hour: 20, minute: 0 });

  if (isCapacitor()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    } catch {}
  }
}

export function checkAndShowWebNotification(): void {
  const settings = getReminder();
  if (!settings.enabled) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY);
  const today = new Date().toDateString();
  if (lastNotified === today) return;

  const now = new Date();
  if (now.getHours() >= settings.hour) {
    localStorage.setItem(LAST_NOTIFIED_KEY, today);
    new Notification("Songwon Korean", {
      body: getRandomTrivia(),
      icon: "/icon-192.png",
      tag: "songwon-reminder",
    });
  }
}
