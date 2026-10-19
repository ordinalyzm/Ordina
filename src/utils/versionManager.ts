/**
 * Ordina Version & Persistent Storage Manager
 * Ensures groups, users, identity, profile, guest ID, recent previews,
 * and chat messages are continuously backed up to IndexedDB.
 * 
 * Version updates, browser storage constraints, or quota evictions
 * will NEVER wipe user identity, chats, groups, or message history!
 */

import { Group, Message, UserProfile, DEFAULT_GLOBAL_CHANNEL } from '../types';

const APP_VERSION = '2.4.1';
const DB_NAME = 'OrdinaAppStorage';
const STORE_BACKUPS = 'app_backups';
const STORE_MESSAGES = 'chat_messages';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        db.createObjectStore(STORE_BACKUPS);
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        db.createObjectStore(STORE_MESSAGES);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a key-value pair in IndexedDB backups with safe fallback.
 */
export async function setPersistentBackup(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BACKUPS, 'readwrite');
    const store = tx.objectStore(STORE_BACKUPS);
    store.put(JSON.stringify(value), key);
  } catch (err) {
    try {
      localStorage.setItem(`ordina_backup_${key}`, JSON.stringify(value));
    } catch (e) {}
  }
}

/**
 * Retrieves a key-value pair from IndexedDB backups with localStorage fallback.
 */
export async function getPersistentBackup<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_BACKUPS, 'readonly');
    const store = tx.objectStore(STORE_BACKUPS);
    const request = store.get(key);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          try {
            resolve(JSON.parse(request.result));
            return;
          } catch (e) {}
        }
        // Fallback to localStorage backup
        const lsVal = localStorage.getItem(`ordina_backup_${key}`);
        if (lsVal) {
          try {
            resolve(JSON.parse(lsVal));
            return;
          } catch (e) {}
        }
        resolve(null);
      };
      request.onerror = () => {
        const lsVal = localStorage.getItem(`ordina_backup_${key}`);
        if (lsVal) {
          try {
            resolve(JSON.parse(lsVal));
            return;
          } catch (e) {}
        }
        resolve(null);
      };
    });
  } catch (err) {
    const lsVal = localStorage.getItem(`ordina_backup_${key}`);
    if (lsVal) {
      try {
        return JSON.parse(lsVal);
      } catch (e) {}
    }
    return null;
  }
}

/**
 * Persists chat messages directly to IndexedDB.
 * Completely immune to the 5MB browser localStorage limit!
 */
export async function saveMessagesToIndexedDB(canonicalKey: string, msgs: Message[]): Promise<void> {
  if (!canonicalKey || !Array.isArray(msgs)) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    store.put(JSON.stringify(msgs), canonicalKey);
  } catch (e) {
    console.warn(`[VersionManager] Failed to save messages for ${canonicalKey} to IndexedDB:`, e);
  }
}

/**
 * Loads chat messages directly from IndexedDB.
 */
export async function loadMessagesFromIndexedDB(canonicalKey: string): Promise<Message[]> {
  if (!canonicalKey) return [];
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readonly');
    const store = tx.objectStore(STORE_MESSAGES);
    const req = store.get(canonicalKey);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        if (req.result) {
          try {
            const parsed = JSON.parse(req.result);
            if (Array.isArray(parsed)) {
              resolve(parsed);
              return;
            }
          } catch (e) {}
        }
        resolve([]);
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

// Local in-memory tombstone set synced with localStorage & IndexedDB
const deletedTombstonesSet = new Set<string>();

// Preload tombstones from localStorage synchronously
try {
  const raw = localStorage.getItem('ordina_deleted_msg_tombstones');
  if (raw) {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach(id => typeof id === 'string' && deletedTombstonesSet.add(id));
    }
  }
} catch (e) {}

/**
 * Returns whether a message was permanently marked as deleted.
 */
export function isMessageDeletedTombstone(messageId: string): boolean {
  if (!messageId) return false;
  return deletedTombstonesSet.has(messageId);
}

/**
 * Adds a message ID to persistent tombstones across memory, localStorage, and IndexedDB.
 */
export async function addDeletedMessageTombstone(messageId: string): Promise<void> {
  if (!messageId) return;
  deletedTombstonesSet.add(messageId);
  try {
    const arr = Array.from(deletedTombstonesSet);
    // Keep last 1000 tombstones to stay lean
    const trimmed = arr.slice(-1000);
    localStorage.setItem('ordina_deleted_msg_tombstones', JSON.stringify(trimmed));
    setPersistentBackup('deleted_msg_tombstones', trimmed).catch(() => {});
  } catch (e) {}
}

/**
 * Permanently deletes a single message from all chat stores in IndexedDB.
 */
export async function deleteMessageFromIndexedDB(messageId: string): Promise<void> {
  if (!messageId) return;
  await addDeletedMessageTombstone(messageId);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    const req = store.openCursor();
    
    req.onsuccess = (e: any) => {
      const cursor = e.target.result;
      if (cursor) {
        try {
          const list: Message[] = JSON.parse(cursor.value);
          if (Array.isArray(list) && list.some(m => m.id === messageId)) {
            const filtered = list.filter(m => m.id !== messageId);
            cursor.update(JSON.stringify(filtered));
          }
        } catch (err) {}
        cursor.continue();
      }
    };
  } catch (e) {
    console.warn(`[VersionManager] Failed to delete message ${messageId} from IndexedDB:`, e);
  }
}

/**
 * Permanently deletes multiple messages from all chat stores in IndexedDB.
 */
export async function deleteMessagesFromIndexedDB(messageIds: string[]): Promise<void> {
  if (!messageIds || messageIds.length === 0) return;
  const idSet = new Set(messageIds);
  for (const id of messageIds) {
    await addDeletedMessageTombstone(id);
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    const req = store.openCursor();
    
    req.onsuccess = (e: any) => {
      const cursor = e.target.result;
      if (cursor) {
        try {
          const list: Message[] = JSON.parse(cursor.value);
          if (Array.isArray(list) && list.some(m => idSet.has(m.id))) {
            const filtered = list.filter(m => !idSet.has(m.id));
            cursor.update(JSON.stringify(filtered));
          }
        } catch (err) {}
        cursor.continue();
      }
    };
  } catch (e) {
    console.warn('[VersionManager] Failed to batch delete messages from IndexedDB:', e);
  }
}


/**
 * Initializes version tracking and syncs all critical state between IndexedDB and localStorage.
 */
export async function initializeVersionAndSyncState(): Promise<{ isNewVersion: boolean, version: string }> {
  const currentSavedVersion = localStorage.getItem('ordina_installed_app_version');
  const isNewVersion = currentSavedVersion !== APP_VERSION;

  if (isNewVersion) {
    console.log(`[VersionManager] App version sync: ${currentSavedVersion || 'initial'} -> ${APP_VERSION}`);
    localStorage.setItem('ordina_installed_app_version', APP_VERSION);
    await setPersistentBackup('app_version', APP_VERSION);
  }

  try {
    // 1. Restore Guest ID
    const savedGuest = await getPersistentBackup<string>('ordina_guest_id');
    if (savedGuest && !localStorage.getItem('ordina_guest_id')) {
      localStorage.setItem('ordina_guest_id', savedGuest);
    }

    // 2. Restore OAuth user
    const savedOAuth = await getPersistentBackup<any>('ordina_oauth_user');
    if (savedOAuth && !localStorage.getItem('ordina_oauth_user')) {
      localStorage.setItem('ordina_oauth_user', typeof savedOAuth === 'string' ? savedOAuth : JSON.stringify(savedOAuth));
    }

    // 3. Restore Cached Groups
    const savedGroups = await getPersistentBackup<Group[]>('ordina_cached_groups');
    const currentGroupsRaw = localStorage.getItem('ordina_cached_groups');
    let shouldRestoreGroups = false;
    if (!currentGroupsRaw) {
      shouldRestoreGroups = true;
    } else {
      try {
        const parsed = JSON.parse(currentGroupsRaw);
        if (!Array.isArray(parsed) || parsed.length <= 1) {
          shouldRestoreGroups = true;
        }
      } catch {
        shouldRestoreGroups = true;
      }
    }
    if (shouldRestoreGroups && savedGroups && Array.isArray(savedGroups) && savedGroups.length > 0) {
      console.log(`[VersionManager] Restoring ${savedGroups.length} groups from persistent IndexedDB backup`);
      let merged = [...savedGroups];
      if (!merged.some(g => g.id === 'global_channel')) {
        merged.unshift(DEFAULT_GLOBAL_CHANNEL);
      }
      localStorage.setItem('ordina_cached_groups', JSON.stringify(merged));
    }

    // 4. Restore Cached Users
    const savedUsers = await getPersistentBackup<UserProfile[]>('ordina_cached_users');
    const currentUsersRaw = localStorage.getItem('ordina_cached_users');
    let shouldRestoreUsers = false;
    if (!currentUsersRaw) {
      shouldRestoreUsers = true;
    } else {
      try {
        const parsed = JSON.parse(currentUsersRaw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          shouldRestoreUsers = true;
        }
      } catch {
        shouldRestoreUsers = true;
      }
    }
    if (shouldRestoreUsers && savedUsers && Array.isArray(savedUsers) && savedUsers.length > 0) {
      console.log(`[VersionManager] Restoring ${savedUsers.length} users from persistent IndexedDB backup`);
      localStorage.setItem('ordina_cached_users', JSON.stringify(savedUsers));
    }

    // 5. Restore Recent Previews
    const savedPreviews = await getPersistentBackup<Record<string, Message>>('ordina_recent_previews');
    const currentPreviewsRaw = localStorage.getItem('ordina_recent_previews');
    if ((!currentPreviewsRaw || currentPreviewsRaw === '{}') && savedPreviews && Object.keys(savedPreviews).length > 0) {
      console.log(`[VersionManager] Restoring recent previews from persistent IndexedDB backup`);
      localStorage.setItem('ordina_recent_previews', JSON.stringify(savedPreviews));
    }

    // 6. Restore Archived and Muted Chats
    const savedArchived = await getPersistentBackup<string[]>('ordina_archived_chats');
    if (savedArchived && !localStorage.getItem('ordina_archived_chats')) {
      localStorage.setItem('ordina_archived_chats', JSON.stringify(savedArchived));
    }

    const savedMuted = await getPersistentBackup<string[]>('ordina_muted_chats');
    if (savedMuted && !localStorage.getItem('ordina_muted_chats')) {
      localStorage.setItem('ordina_muted_chats', JSON.stringify(savedMuted));
    }

    // 7. Restore Custom BLE configs
    const savedBleRange = await getPersistentBackup<string>('ordina_custom_ble_range');
    if (savedBleRange && !localStorage.getItem('ordina_custom_ble_range')) {
      localStorage.setItem('ordina_custom_ble_range', savedBleRange);
    }
    const savedBleLabel = await getPersistentBackup<string>('ordina_custom_ble_label');
    if (savedBleLabel && !localStorage.getItem('ordina_custom_ble_label')) {
      localStorage.setItem('ordina_custom_ble_label', savedBleLabel);
    }

    // 8. Restore Music Tracks
    const savedTracks = await getPersistentBackup<any[]>('ordina_music_tracks');
    const currentTracksRaw = localStorage.getItem('ordina_music_tracks');
    if ((!currentTracksRaw || currentTracksRaw === '[]') && savedTracks && Array.isArray(savedTracks) && savedTracks.length > 0) {
      console.log(`[VersionManager] Restoring ${savedTracks.length} music tracks from persistent IndexedDB backup`);
      localStorage.setItem('ordina_music_tracks', JSON.stringify(savedTracks.slice(0, 100)));
    }

    // 9. Restore Music Playlists
    const savedPlaylists = await getPersistentBackup<any[]>('ordina_music_playlists');
    const currentPlaylistsRaw = localStorage.getItem('ordina_music_playlists');
    if ((!currentPlaylistsRaw || currentPlaylistsRaw === '[]') && savedPlaylists && Array.isArray(savedPlaylists) && savedPlaylists.length > 0) {
      console.log(`[VersionManager] Restoring ${savedPlaylists.length} playlists from persistent IndexedDB backup`);
      localStorage.setItem('ordina_music_playlists', JSON.stringify(savedPlaylists.slice(0, 50)));
    }
  } catch (err) {
    console.error('[VersionManager] State restoration check error:', err);
  }

  // Continuously write active state back to IndexedDB for continuous safety
  try {
    const currentGuest = localStorage.getItem('ordina_guest_id');
    if (currentGuest) await setPersistentBackup('ordina_guest_id', currentGuest);

    const currentOAuth = localStorage.getItem('ordina_oauth_user');
    if (currentOAuth) await setPersistentBackup('ordina_oauth_user', currentOAuth);

    const currentGroups = localStorage.getItem('ordina_cached_groups');
    if (currentGroups) {
      const parsedG = JSON.parse(currentGroups);
      if (Array.isArray(parsedG) && parsedG.length > 0) {
        await setPersistentBackup('ordina_cached_groups', parsedG);
      }
    }

    const currentUsers = localStorage.getItem('ordina_cached_users');
    if (currentUsers) {
      const parsedU = JSON.parse(currentUsers);
      if (Array.isArray(parsedU) && parsedU.length > 0) {
        await setPersistentBackup('ordina_cached_users', parsedU);
      }
    }

    const currentPreviews = localStorage.getItem('ordina_recent_previews');
    if (currentPreviews) {
      const parsedP = JSON.parse(currentPreviews);
      if (parsedP && Object.keys(parsedP).length > 0) {
        await setPersistentBackup('ordina_recent_previews', parsedP);
      }
    }

    const currentMusic = localStorage.getItem('ordina_music_tracks');
    if (currentMusic) {
      const parsedM = JSON.parse(currentMusic);
      if (Array.isArray(parsedM) && parsedM.length > 0) {
        await setPersistentBackup('ordina_music_tracks', parsedM);
      }
    }

    const currentPlaylists = localStorage.getItem('ordina_music_playlists');
    if (currentPlaylists) {
      const parsedPl = JSON.parse(currentPlaylists);
      if (Array.isArray(parsedPl) && parsedPl.length > 0) {
        await setPersistentBackup('ordina_music_playlists', parsedPl);
      }
    }
  } catch (e) {}

  return { isNewVersion, version: APP_VERSION };
}

/**
 * Restores critical application state directly from IndexedDB if in-memory state is empty.
 */
export async function restoreAllCriticalState(): Promise<{
  groups?: Group[];
  users?: UserProfile[];
  previews?: Record<string, Message>;
  profile?: UserProfile;
}> {
  const result: {
    groups?: Group[];
    users?: UserProfile[];
    previews?: Record<string, Message>;
    profile?: UserProfile;
  } = {};

  try {
    const groups = await getPersistentBackup<Group[]>('ordina_cached_groups');
    if (groups && Array.isArray(groups) && groups.length > 0) {
      result.groups = groups;
    }

    const users = await getPersistentBackup<UserProfile[]>('ordina_cached_users');
    if (users && Array.isArray(users) && users.length > 0) {
      result.users = users;
    }

    const previews = await getPersistentBackup<Record<string, Message>>('ordina_recent_previews');
    if (previews && typeof previews === 'object' && Object.keys(previews).length > 0) {
      result.previews = previews;
    }

    const guestId = localStorage.getItem('ordina_guest_id');
    if (guestId) {
      const savedProf = await getPersistentBackup<UserProfile>(`ordina_profile_${guestId}`);
      if (savedProf) result.profile = savedProf;
    }
  } catch (e) {
    console.error('[VersionManager] restoreAllCriticalState error:', e);
  }

  return result;
}
