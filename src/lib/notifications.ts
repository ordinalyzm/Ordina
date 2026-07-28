// Notification Service for System Notifications and Push Alerts

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  previewMode: 'full' | 'sender_only' | 'hidden';
  dndEnabled: boolean;
  dndStartTime?: string; // HH:mm
  dndEndTime?: string;   // HH:mm
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  previewMode: 'full',
  dndEnabled: false,
};

const STORAGE_KEY = 'ordina_notification_settings';

export function getStoredNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to parse notification settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveNotificationSettings(settings: NotificationSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save notification settings:', e);
  }
}

export async function requestSystemNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

function isInQuietHours(settings: NotificationSettings): boolean {
  if (!settings.dndEnabled) return false;
  if (!settings.dndStartTime || !settings.dndEndTime) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = settings.dndStartTime.split(':').map(Number);
  const [endH, endM] = settings.dndEndTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight DND (e.g. 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

export function showSystemNotification(
  title: string,
  body: string,
  options: {
    icon?: string;
    tag?: string;
    onClick?: () => void;
  } = {}
) {
  const settings = getStoredNotificationSettings();

  if (!settings.enabled || isInQuietHours(settings)) {
    return;
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  let formattedBody = body;
  if (settings.previewMode === 'sender_only') {
    formattedBody = 'Новое сообщение';
  } else if (settings.previewMode === 'hidden') {
    formattedBody = 'У вас новое уведомление';
  }

  try {
    const notification = new Notification(title, {
      body: formattedBody,
      icon: options.icon || '/icon.png',
      tag: options.tag || 'ordina-msg',
      badge: '/icon.png',
      renotify: true,
    } as NotificationOptions);

    if (options.onClick) {
      notification.onclick = (e) => {
        e.preventDefault();
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }
  } catch (e) {
    console.warn('Failed to dispatch system notification:', e);
  }
}
