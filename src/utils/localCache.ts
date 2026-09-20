import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Message, Chat } from '../types';

const DB_NAME = 'ordina_main.db';
let sqliteConnection: SQLiteConnection | null = null;
let dbInstance: SQLiteDBConnection | null = null;
let isInitialized = false;

/**
 * Initializes the SQLite Database and creates tables if they don't exist.
 * Safe across APK updates with CREATE TABLE IF NOT EXISTS.
 */
export async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  try {
    const isNative = Capacitor.isNativePlatform();

    if (isNative || typeof CapacitorSQLite !== 'undefined') {
      sqliteConnection = new SQLiteConnection(CapacitorSQLite);
      
      const isConn = (await sqliteConnection.isConnection(DB_NAME, false)).result;
      if (isConn) {
        dbInstance = await sqliteConnection.retrieveConnection(DB_NAME, false);
      } else {
        dbInstance = await sqliteConnection.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }

      await dbInstance.open();

      const schema = `
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY NOT NULL,
          senderId TEXT NOT NULL,
          receiverId TEXT,
          groupId TEXT,
          text TEXT,
          type TEXT,
          fileUrl TEXT,
          fileName TEXT,
          fileSize INTEGER,
          createdAt TEXT,
          updatedAt TEXT,
          status TEXT,
          deliveryStatus TEXT,
          ttl INTEGER DEFAULT 5,
          version INTEGER DEFAULT 1,
          rawJson TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chats (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT,
          name TEXT,
          photoURL TEXT,
          version INTEGER DEFAULT 1,
          rawJson TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(groupId, receiverId, senderId);
        CREATE INDEX IF NOT EXISTS idx_messages_version ON messages(version);
        CREATE INDEX IF NOT EXISTS idx_chats_version ON chats(version);
      `;

      await dbInstance.execute(schema);
      isInitialized = true;
      console.log('[SQLite] ordina_main.db initialized successfully');
    } else {
      // Web fallback
      isInitialized = true;
      console.log('[SQLite Web Fallback] In-memory & local fallback active');
    }
  } catch (err) {
    console.warn('[SQLite] Init warning, enabling seamless local fallback:', err);
    isInitialized = true;
  }
}

// Auto-trigger init
if (typeof window !== 'undefined') {
  initDatabase().catch(e => console.error('[SQLite] Auto-init error:', e));
}

// Write-deduplication map to prevent multiple redundant writes within milliseconds
const recentWritesMap = new Map<string, string>();

/**
 * Saves a single message to SQLite database and local cache.
 */
export async function saveMessage(msg: Message): Promise<void> {
  if (!msg || !msg.id) return;

  const textValue = (typeof msg.text === 'string' && msg.text.length > 0)
    ? msg.text
    : (typeof msg.content === 'string' && msg.content.length > 0)
      ? msg.content
      : (typeof msg.text === 'string' ? msg.text : (typeof msg.content === 'string' ? msg.content : ''));

  const fileUrlValue = msg.fileUrl || null;
  const fileNameValue = msg.fileName || null;
  const typeValue = fileUrlValue 
    ? (msg.type || 'file') 
    : (['sticker', 'poll', 'system', 'audio', 'voice', 'video', 'image', 'game'].includes(msg.type) ? msg.type : 'text');

  const normalizedMsg: Message = {
    ...msg,
    text: textValue,
    content: textValue,
    type: typeValue as any,
    fileUrl: fileUrlValue || undefined,
    fileName: fileNameValue || undefined
  };

  // Check deduplication signature to eliminate 8+ duplicate SQLite operations within milliseconds
  const writeSig = `${normalizedMsg.id}:${normalizedMsg.status}:${normalizedMsg.deliveryStatus}:${normalizedMsg.updatedAt || ''}:${(normalizedMsg as any).readBy?.length || 0}`;
  if (recentWritesMap.get(normalizedMsg.id) === writeSig) {
    return; // Already written with identical state
  }
  recentWritesMap.set(normalizedMsg.id, writeSig);
  if (recentWritesMap.size > 500) {
    const firstKey = recentWritesMap.keys().next().value;
    if (firstKey) recentWritesMap.delete(firstKey);
  }
  
  // Also keep in localStorage for immediate sync access
  let chatId = normalizedMsg.groupId || normalizedMsg.chatId;
  if (!chatId && normalizedMsg.senderId && normalizedMsg.receiverId) {
    chatId = [normalizedMsg.senderId, normalizedMsg.receiverId].sort().join('_');
  } else if (!chatId) {
    chatId = normalizedMsg.receiverId || normalizedMsg.senderId;
  }
  if (chatId) {
    saveMessageToLocalStorage(chatId, normalizedMsg);
  }

  try {
    await initDatabase();
    if (dbInstance) {
      const statement = `
        INSERT OR REPLACE INTO messages (
          id, senderId, receiverId, groupId, text, type, fileUrl, fileName, fileSize,
          createdAt, updatedAt, status, deliveryStatus, ttl, version, rawJson
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;
      const values = [
        normalizedMsg.id,
        normalizedMsg.senderId || '',
        normalizedMsg.receiverId || null,
        normalizedMsg.groupId || null,
        textValue,
        typeValue,
        fileUrlValue,
        fileNameValue,
        normalizedMsg.fileSize || 0,
        normalizedMsg.createdAt || new Date().toISOString(),
        normalizedMsg.updatedAt || null,
        normalizedMsg.status || 'pending',
        normalizedMsg.deliveryStatus || normalizedMsg.status || 'pending',
        normalizedMsg.ttl !== undefined ? normalizedMsg.ttl : 5,
        normalizedMsg.version || 1,
        JSON.stringify(normalizedMsg)
      ];
      await dbInstance.run(statement, values);
    }
  } catch (err) {
    console.error('[SQLite] saveMessage error:', err);
  }
}

/**
 * Updates message delivery or read status in SQLite.
 */
export async function updateMessageStatus(id: string, status: string): Promise<void> {
  if (!id) return;

  try {
    await initDatabase();
    if (dbInstance) {
      const res = await dbInstance.query('SELECT rawJson FROM messages WHERE id = ?;', [id]);
      if (res.values && res.values.length > 0) {
        const raw = JSON.parse(res.values[0].rawJson);
        raw.status = status;
        raw.deliveryStatus = status;
        await dbInstance.run(
          'UPDATE messages SET status = ?, deliveryStatus = ?, rawJson = ? WHERE id = ?;',
          [status, status, JSON.stringify(raw), id]
        );
      }
    }
  } catch (err) {
    console.error('[SQLite] updateMessageStatus error:', err);
  }

  // Update in localStorage as well
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ordina_cache_')) {
        const raw = localStorage.getItem(k);
        if (raw && raw.includes(id)) {
          const list: Message[] = JSON.parse(raw);
          const found = list.find(m => m.id === id);
          if (found) {
            found.status = status as any;
            found.deliveryStatus = status as any;
            localStorage.setItem(k, JSON.stringify(list));
          }
        }
      }
    }
  } catch (e) {}
}

/**
 * Returns the highest delta version stored locally (for incremental delta sync).
 */
export async function getDeltaSyncVersion(): Promise<number> {
  let maxMsgVersion = 0;
  let maxChatVersion = 0;

  try {
    await initDatabase();
    if (dbInstance) {
      const msgRes = await dbInstance.query('SELECT MAX(version) as maxVer FROM messages;');
      if (msgRes.values && msgRes.values[0]?.maxVer) {
        maxMsgVersion = Number(msgRes.values[0].maxVer) || 0;
      }

      const chatRes = await dbInstance.query('SELECT MAX(version) as maxVer FROM chats;');
      if (chatRes.values && chatRes.values[0]?.maxVer) {
        maxChatVersion = Number(chatRes.values[0].maxVer) || 0;
      }
    }
  } catch (err) {
    console.error('[SQLite] getDeltaSyncVersion error:', err);
  }

  // Check localStorage delta marker
  const localSavedVer = parseInt(localStorage.getItem('ordina_delta_version') || '0', 10);
  return Math.max(maxMsgVersion, maxChatVersion, localSavedVer, 0);
}

/**
 * Saves a key-value pair in SQLite settings and localStorage.
 */
export async function saveLocalSetting(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(`ordina_setting_${key}`, value);
    await initDatabase();
    if (dbInstance) {
      await dbInstance.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
        [key, value]
      );
    }
  } catch (err) {
    console.error('[SQLite] saveLocalSetting error:', err);
  }
}

/**
 * Gets a key-value pair from SQLite settings or localStorage.
 */
export async function getLocalSetting(key: string): Promise<string | null> {
  try {
    const local = localStorage.getItem(`ordina_setting_${key}`);
    if (local !== null) return local;

    await initDatabase();
    if (dbInstance) {
      const res = await dbInstance.query('SELECT value FROM settings WHERE key = ?;', [key]);
      if (res.values && res.values.length > 0) {
        return res.values[0].value;
      }
    }
  } catch (err) {
    console.error('[SQLite] getLocalSetting error:', err);
  }
  return null;
}

/**
 * Merges delta sync data (incremental chats and messages from server) into SQLite.
 */
export async function mergeDelta(chats: Chat[] = [], messages: Message[] = []): Promise<void> {
  try {
    // ЗАЩИТА: Если с сервера пришел пустой массив — 
    // НИ В КОЕМ СЛУЧАЕ НЕ ОЧИЩАЙТЕ И НЕ ПЕРЕЗАПИСЫВАЙТЕ ПУСТОТОЙ ЛОКАЛЬНУЮ БАЗУ!
    if ((!chats || chats.length === 0) && (!messages || messages.length === 0)) {
      console.log('[DeltaSync] Сервер вернул 0 обновлений. Локальная база сохранена.');
      return;
    }

    await initDatabase();
    let maxVer = await getDeltaSyncVersion();

    // 1. Merge chats (UPSERT only - never delete existing chats)
    if (Array.isArray(chats)) {
      for (const chat of chats) {
        if (!chat || !chat.id) continue;
        const ver = chat.version || 1;
        if (ver > maxVer) maxVer = ver;

        if (dbInstance) {
          await dbInstance.run(
            'INSERT OR REPLACE INTO chats (id, type, name, photoURL, version, rawJson) VALUES (?, ?, ?, ?, ?, ?);',
            [chat.id, chat.type, chat.name || '', chat.photoURL || '', ver, JSON.stringify(chat)]
          );
        }
      }
    }

    // 2. Merge messages (UPSERT only)
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (!msg || !msg.id) continue;
        const ver = msg.version || 1;
        if (ver > maxVer) maxVer = ver;
        await saveMessage(msg);
      }
    }

    localStorage.setItem('ordina_delta_version', maxVer.toString());
    console.log(`[SQLite] Merged delta: ${chats?.length || 0} chats, ${messages?.length || 0} messages. New max version: ${maxVer}`);
  } catch (err) {
    console.error('[SQLite] mergeDelta error:', err);
  }
}

/**
 * Loads all cached messages for a given chat.
 */
export async function getMessagesForChat(chatId: string, currentUserId?: string): Promise<Message[]> {
  try {
    await initDatabase();
    if (dbInstance) {
      let query = '';
      let params: any[] = [];
      if (currentUserId && currentUserId !== chatId) {
        query = `SELECT rawJson FROM messages 
                 WHERE groupId = ? 
                    OR (senderId = ? AND receiverId = ?) 
                    OR (senderId = ? AND receiverId = ?)
                 ORDER BY createdAt ASC;`;
        params = [chatId, currentUserId, chatId, chatId, currentUserId];
      } else {
        query = `SELECT rawJson FROM messages 
                 WHERE groupId = ? OR receiverId = ? OR senderId = ? 
                 ORDER BY createdAt ASC;`;
        params = [chatId, chatId, chatId];
      }
      const res = await dbInstance.query(query, params);
      if (res.values && res.values.length > 0) {
        return res.values.map(v => JSON.parse(v.rawJson));
      }
    }
  } catch (err) {
    console.error('[SQLite] getMessagesForChat error:', err);
  }

  // Fallback to localStorage
  return loadMessagesFromLocalCache(chatId);
}

// -------------------------------------------------------------
// Legacy & Flat LocalStorage Helpers (for backwards compatibility)
// -------------------------------------------------------------

function appendToStorageKey(key: string, msg: Message): void {
  try {
    const flatRaw = localStorage.getItem(key);
    let flatMsgs: Message[] = flatRaw ? JSON.parse(flatRaw) : [];
    if (!Array.isArray(flatMsgs)) flatMsgs = [];
    const flatIdx = flatMsgs.findIndex(m => m.id === msg.id);
    if (flatIdx !== -1) {
      flatMsgs[flatIdx] = { ...flatMsgs[flatIdx], ...msg };
    } else {
      flatMsgs.push(msg);
    }
    if (flatMsgs.length > 300) flatMsgs = flatMsgs.slice(-300);
    localStorage.setItem(key, JSON.stringify(flatMsgs));
  } catch (e) {}
}

function saveMessageToLocalStorage(chatId: string, msg: Message): void {
  appendToStorageKey(`ordina_cache_${chatId}`, msg);

  // If this is a direct 1-on-1 message, cross-index under both participants so it always loads
  if (!msg.groupId && msg.senderId && msg.receiverId) {
    appendToStorageKey(`ordina_cache_${msg.senderId}`, msg);
    appendToStorageKey(`ordina_cache_${msg.receiverId}`, msg);
    const compoundKey = [msg.senderId, msg.receiverId].sort().join('_');
    if (compoundKey !== chatId) {
      appendToStorageKey(`ordina_cache_${compoundKey}`, msg);
    }
  }
}

export function saveMessageToLocalCache(chatId: string, msg: Message): void {
  saveMessage(msg).catch(() => {});
}

export function saveMessagesToLocalCache(chatId: string, messages: Message[]): void {
  messages.forEach(msg => saveMessage(msg).catch(() => {}));
}

export function loadMessagesFromLocalCache(chatId: string): Message[] {
  try {
    const foundMap = new Map<string, Message>();
    const keysToCheck = [`ordina_cache_${chatId}`];

    // Check all related keys for this chat or peer
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ordina_cache_') && k.includes(chatId)) {
          if (!keysToCheck.includes(k)) {
            keysToCheck.push(k);
          }
        }
      }
    }

    for (const key of keysToCheck) {
      const flatRaw = localStorage.getItem(key);
      if (flatRaw) {
        try {
          const arr = JSON.parse(flatRaw);
          if (Array.isArray(arr)) {
            for (const m of arr) {
              if (m && m.id) {
                if (chatId.startsWith('group_') || chatId.startsWith('channel_') || chatId === 'global_channel') {
                  if (m.groupId === chatId) foundMap.set(m.id, m);
                } else {
                  if (m.groupId === chatId || m.senderId === chatId || m.receiverId === chatId) {
                    foundMap.set(m.id, m);
                  }
                }
              }
            }
          }
        } catch (e) {}
      }
    }

    if (foundMap.size > 0) {
      return Array.from(foundMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
  } catch (e) {}
  return [];
}

export function clearChatLocalCache(chatId: string, currentUserId?: string): void {
  try {
    localStorage.removeItem(`ordina_cache_${chatId}`);
    if (dbInstance) {
      if (currentUserId && currentUserId !== chatId) {
        dbInstance.run(
          'DELETE FROM messages WHERE groupId = ? OR (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?);',
          [chatId, chatId, currentUserId, currentUserId, chatId]
        ).catch(() => {});
      } else {
        dbInstance.run(
          'DELETE FROM messages WHERE groupId = ? OR (receiverId = ? AND groupId IS NULL);',
          [chatId, chatId]
        ).catch(() => {});
      }
    }
  } catch (e) {}
}
