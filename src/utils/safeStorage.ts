// src/utils/safeStorage.ts
// Robust, quota-safe wrapper for localStorage to completely prevent QuotaExceededError crashes
// ABSOLUTE INVARIANT: NEVER deletes groups, users, profiles, active chats, auth keys, or backups!

const PROTECTED_EXACT_KEYS = new Set([
  'ordina_cached_groups',
  'ordina_cached_users',
  'ordina_guest_id',
  'ordina_oauth_user',
  'ordina_oauth_pending',
  'ordina_installed_app_version',
  'ordina_recent_previews',
  'ordina_muted_chats',
  'ordina_archived_chats',
  'ordina_server_url',
  'ordina_custom_ble_range',
  'ordina_custom_ble_label',
  'ordina_delta_version',
  'ordina_device_id_token',
  'ordina_device_name',
  'ordina_music_tracks',
  'ordina_music_playlists',
  'ordina_notification_settings'
]);

export function isProtectedStorageKey(key: string): boolean {
  if (!key) return false;
  if (PROTECTED_EXACT_KEYS.has(key)) return true;
  if (key.startsWith('ordina_cached_')) return true; // ordina_cached_groups, ordina_cached_users, etc.
  if (key.startsWith('ordina_profile_')) return true; // user profile metadata & activeChats
  if (key.startsWith('ordina_setting_')) return true; // user preferences
  if (key.startsWith('ordina_backup_')) return true;  // persistent backups
  return false;
}

/**
 * Safely writes to localStorage with intelligent, non-destructive quota recovery.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`[SafeStorage] localStorage.setItem failed for key "${key}". Attempting smart quota recovery...`, err);

    // If quota exceeded, clean up ONLY ephemeral non-protected message caches
    try {
      const candidates: { key: string; size: number }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;

        // NEVER touch protected keys (groups, users, profiles, backups)
        if (isProtectedStorageKey(k)) continue;

        // NEVER delete global channel message cache
        if (k === 'ordina_cache_global_channel') continue;

        // Only target ephemeral chat message caches or debug logs
        if (k.startsWith('ordina_cache_') || k.startsWith('ordina_debug_') || k.startsWith('ordina_mesh_packet_')) {
          const val = localStorage.getItem(k) || '';
          candidates.push({ key: k, size: val.length });
        }
      }

      // Sort by size descending to free the largest chunks first
      candidates.sort((a, b) => b.size - a.size);

      // Remove up to 5 largest ephemeral keys
      for (const item of candidates.slice(0, 5)) {
        localStorage.removeItem(item.key);
      }

      // Try setting again
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        // If still failing, trim value if it's an array or large JSON string
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            // Trim to latest 15 items
            const trimmed = JSON.stringify(parsed.slice(-15));
            localStorage.setItem(key, trimmed);
            return true;
          } else if (typeof parsed === 'object' && parsed !== null) {
            // If it's an object with large base64 image (like a profile), sanitize base64
            const sanitized: any = { ...parsed };
            if (typeof sanitized.photoURL === 'string' && sanitized.photoURL.startsWith('data:') && sanitized.photoURL.length > 5000) {
              sanitized.photoURL = '';
            }
            if (typeof sanitized.avatar === 'string' && sanitized.avatar.startsWith('data:') && sanitized.avatar.length > 5000) {
              sanitized.avatar = '';
            }
            localStorage.setItem(key, JSON.stringify(sanitized));
            return true;
          }
        } catch {}
      }
    } catch (cleanErr) {
      console.error('[SafeStorage] Safe storage cleanup failed:', cleanErr);
    }
    return false;
  }
}

export function safeLocalStorageGet(key: string, defaultValue: string = ''): string {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (err) {
    console.warn(`[SafeStorage] localStorage.getItem failed for "${key}":`, err);
    return defaultValue;
  }
}

export function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[SafeStorage] localStorage.removeItem failed for "${key}":`, err);
  }
}

/**
 * Safely purges ephemeral chat history caches when necessary,
 * strictly protecting groups, users, profiles, backups, and settings!
 */
export function purgeAllMessageCaches(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      // DO NOT delete protected keys
      if (isProtectedStorageKey(k)) continue;

      // DO NOT delete global channel
      if (k === 'ordina_cache_global_channel') continue;

      // Only purge ephemeral chat message caches
      if (k.startsWith('ordina_cache_dm_') || k.startsWith('ordina_cache_group_') || k.startsWith('ordina_cache_notebook_') || k.startsWith('ordina_cache_channel_')) {
        keysToRemove.push(k);
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
    console.log(`[SafeStorage] Safely purged ${keysToRemove.length} ephemeral message caches.`);
  } catch (e) {}
}
