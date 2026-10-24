// src/lib/musicLibrary.ts
// Доступ к аудиотеке устройства (Android MediaStore) через нативный плагин MusicLibrary.
// В браузере/на веб-платформе плагин недоступен — функции возвращают пустой результат.
import { registerPlugin, Capacitor } from '@capacitor/core';

export interface DeviceAudioTrack {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  size: number;
  mimeType: string;
  tooLarge: boolean;
}

interface MusicLibraryPlugin {
  getAudioTracks(options: { minDurationMs?: number }): Promise<{ tracks: DeviceAudioTrack[] }>;
  getAudioData(options: { id: string; mimeType?: string }): Promise<{ data: string; mimeType: string }>;
}

const MusicLibrary = registerPlugin<MusicLibraryPlugin>('MusicLibrary');

export const isMusicLibraryAvailable = (): boolean => Capacitor.isNativePlatform();

/**
 * Сканирует аудиотеку телефона и возвращает треки длиннее minDurationMs.
 */
export async function scanDeviceAudio(minDurationMs: number = 25000): Promise<DeviceAudioTrack[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const res = await MusicLibrary.getAudioTracks({ minDurationMs });
  return Array.isArray(res?.tracks) ? res.tracks : [];
}

/**
 * Читает содержимое аудиофайла устройства в base64 (для сохранения трека).
 */
export async function readDeviceAudioData(
  id: string,
  mimeType?: string
): Promise<{ data: string; mimeType: string } | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await MusicLibrary.getAudioData({ id, mimeType });
    if (res && res.data) return res;
    return null;
  } catch {
    return null;
  }
}
