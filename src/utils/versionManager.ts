/**
 * Ordina Version & Persistent Storage Manager
 * Ensures identity, profile, guest ID, and chat cache are backed up to IndexedDB
 * so version updates/rebuilds never wipe user identity or chat history.
 */

const APP_VERSION = '2.4.0';
const DB_NAME = 'OrdinaAppStorage';
const STORE_NAME = 'app_backups';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setPersistentBackup(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(JSON.stringify(value), key);
  } catch (err) {
    // Fallback to localStorage
    try {
      localStorage.setItem(`ordina_backup_${key}`, JSON.stringify(value));
    } catch (e) {}
  }
}

export async function getPersistentBackup<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
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
 * Initializes and checks app version update logic
 */
export async function initializeVersionAndSyncState(): Promise<{ isNewVersion: boolean, version: string }> {
  const currentSavedVersion = localStorage.getItem('ordina_installed_app_version');
  const isNewVersion = currentSavedVersion !== APP_VERSION;

  if (isNewVersion) {
    console.log(`[VersionManager] App update detected: ${currentSavedVersion || 'initial'} -> ${APP_VERSION}`);
    localStorage.setItem('ordina_installed_app_version', APP_VERSION);
    await setPersistentBackup('app_version', APP_VERSION);

    // Sync guest ID & user backups from IndexedDB if missing in localStorage
    const savedGuest = await getPersistentBackup<string>('ordina_guest_id');
    if (savedGuest && !localStorage.getItem('ordina_guest_id')) {
      localStorage.setItem('ordina_guest_id', savedGuest);
    }
    const savedOAuth = await getPersistentBackup<any>('ordina_oauth_user');
    if (savedOAuth && !localStorage.getItem('ordina_oauth_user')) {
      localStorage.setItem('ordina_oauth_user', typeof savedOAuth === 'string' ? savedOAuth : JSON.stringify(savedOAuth));
    }
    const savedUsers = await getPersistentBackup<any>('ordina_cached_users');
    if (savedUsers && !localStorage.getItem('ordina_cached_users')) {
      localStorage.setItem('ordina_cached_users', typeof savedUsers === 'string' ? savedUsers : JSON.stringify(savedUsers));
    }
    const savedBleRange = await getPersistentBackup<string>('ordina_custom_ble_range');
    if (savedBleRange && !localStorage.getItem('ordina_custom_ble_range')) {
      localStorage.setItem('ordina_custom_ble_range', savedBleRange);
    }
    const savedBleLabel = await getPersistentBackup<string>('ordina_custom_ble_label');
    if (savedBleLabel && !localStorage.getItem('ordina_custom_ble_label')) {
      localStorage.setItem('ordina_custom_ble_label', savedBleLabel);
    }
  }

  // Backup active state to IndexedDB for continuous safety
  const currentGuest = localStorage.getItem('ordina_guest_id');
  if (currentGuest) {
    await setPersistentBackup('ordina_guest_id', currentGuest);
  }
  const currentOAuth = localStorage.getItem('ordina_oauth_user');
  if (currentOAuth) {
    await setPersistentBackup('ordina_oauth_user', currentOAuth);
  }
  const currentUsers = localStorage.getItem('ordina_cached_users');
  if (currentUsers) {
    await setPersistentBackup('ordina_cached_users', currentUsers);
  }
  const currentBleRange = localStorage.getItem('ordina_custom_ble_range');
  if (currentBleRange) {
    await setPersistentBackup('ordina_custom_ble_range', currentBleRange);
  }
  const currentBleLabel = localStorage.getItem('ordina_custom_ble_label');
  if (currentBleLabel) {
    await setPersistentBackup('ordina_custom_ble_label', currentBleLabel);
  }

  return { isNewVersion, version: APP_VERSION };
}
