// Notification Service for System Notifications and Push Alerts

import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

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

export async function openAppSettings() {
  if (typeof window === 'undefined') return;

  try {
    if (typeof NativeSettings.openAndroid === 'function') {
      await NativeSettings.openAndroid({
        option: AndroidSettings.ApplicationDetails,
      });
      return;
    }
  } catch (e) {
    console.warn('NativeSettings openAndroid ApplicationDetails error:', e);
  }

  try {
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
    return;
  } catch (e) {
    console.warn('NativeSettings open error:', e);
  }

  try {
    const plugins = (window as any).Capacitor?.Plugins;
    if (plugins?.App?.openUrl) {
      await plugins.App.openUrl({ url: 'package:com.ordina.app' });
      return;
    }
  } catch (e) {
    console.warn('Capacitor App plugin openUrl error:', e);
  }

  try {
    window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:com.ordina.app;end';
    return;
  } catch (e) {
    console.warn('Intent redirect error:', e);
  }

  alert('Откройте настройки вашего устройства -> Приложения -> Ordina -> Разрешения');
}

export async function requestSystemNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    // Try Capacitor LocalNotifications first
    if (typeof LocalNotifications !== 'undefined' && typeof LocalNotifications.requestPermissions === 'function') {
      try {
        const res = await LocalNotifications.requestPermissions();
        if (res?.display === 'granted') return true;
      } catch (e) {
        console.warn('LocalNotifications.requestPermissions error:', e);
      }
    }

    // Try Capacitor PushNotifications
    if (typeof PushNotifications !== 'undefined' && typeof PushNotifications.requestPermissions === 'function') {
      try {
        const res = await PushNotifications.requestPermissions();
        if (res?.receive === 'granted') return true;
      } catch (e) {
        console.warn('PushNotifications.requestPermissions error:', e);
      }
    }

    // Check window.Capacitor plugins fallback
    if ((window as any).Capacitor?.Plugins) {
      const plugins = (window as any).Capacitor.Plugins;
      if (plugins.LocalNotifications?.requestPermissions) {
        try {
          const res = await plugins.LocalNotifications.requestPermissions();
          if (res?.display === 'granted') return true;
        } catch (e) {}
      }
      if (plugins.PushNotifications?.requestPermissions) {
        try {
          const res = await plugins.PushNotifications.requestPermissions();
          if (res?.receive === 'granted') return true;
        } catch (e) {}
      }
    }

    if ('Notification' in window && typeof Notification.requestPermission === 'function') {
      if (Notification.permission === 'granted') {
        return true;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return true;
      }
    }
  } catch (e) {
    console.warn('Notification permission request error:', e);
  }

  // If permission cannot be requested or was denied, open system settings
  openAppSettings();

  return false;
}

export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return 'Notification' in window && typeof Notification !== 'undefined';
  } catch (e) {
    return false;
  }
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission || 'default';
  } catch (e) {
    return 'unsupported';
  }
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

export async function initLocalNotificationChannels() {
  if (typeof window === 'undefined') return;
  try {
    if (typeof LocalNotifications !== 'undefined' && typeof LocalNotifications.createChannel === 'function') {
      await LocalNotifications.createChannel({
        id: 'ordina_messages',
        name: 'Сообщения Ordina',
        description: 'Уведомления о новых личных сообщениях и публикациях в каналах',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: 'res://raw/notification_sound',
      });
    }
  } catch (e) {
    console.warn('LocalNotifications.createChannel error:', e);
  }
}

// Auto-run channel creation on module import
initLocalNotificationChannels();

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

  let formattedBody = body;
  if (settings.previewMode === 'sender_only') {
    formattedBody = 'Новое сообщение';
  } else if (settings.previewMode === 'hidden') {
    formattedBody = 'У вас новое уведомление';
  }

  // 1. Try Capacitor LocalNotifications for native Android/iOS background push heads-up alerts
  try {
    if (typeof LocalNotifications !== 'undefined' && typeof LocalNotifications.schedule === 'function') {
      LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: formattedBody,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 100) },
            channelId: 'ordina_messages',
            extra: {
              tag: options.tag,
            },
          },
        ],
      }).catch((e) => console.warn('LocalNotifications schedule error:', e));
    }
  } catch (e) {
    console.warn('LocalNotifications schedule catch error:', e);
  }

  // 2. Try standard Web Notification API as fallback
  if (isNotificationSupported()) {
    try {
      if (Notification.permission === 'granted') {
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
      }
    } catch (e) {
      console.warn('System Notification API unavailable or inhibited in this context:', e);
    }
  }
}
