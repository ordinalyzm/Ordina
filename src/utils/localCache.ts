import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Message, Chat } from '../types';

const DB_NAME = 'ordina_main.db';
let sqliteConnection: SQLiteConnection | null = null;
let dbInstance: SQLiteDBConnection | null = null;
let isInitialized = false;

/**
 * Helper to compute a canonical, isolated storage key for any chat.
 */
export function getCanonicalChatKey(chatId: string, currentUserId?: string): string {
  if (!chatId) return 'unknown';
  if (chatId === 'global_channel' || chatId.startsWith('group_') || chatId.startsWith('channel_')) {
    return chatId;
  }
  // Direct chat or self-notebook
  if (currentUserId) {
    if (chatId === currentUserId || chatId === 'notebook') {
      return `notebook_${currentUserId}`;
    }
    return `dm_${[currentUserId, chatId].sort().join('_')}`;
  }
  return chatId;
}

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
      isInitialized = true;
      console.log('[SQLite Web Fallback] In-memory & local fallback active');
    }
  } catch (err) {
    console.warn('[SQLite] Init warning, enabling seamless local fallback:', err);
    isInitialized = true;
  }
}

// Auto-trigger init & legacy cleanup
if (typeof window !== 'undefined') {
  initDatabase().then(() => purgeContaminatedLegacyCaches()).catch(e => console.error('[SQLite] Auto-init error:', e));
}

// Write-deduplication map to prevent multiple redundant writes within milliseconds
const recentWritesMap = new Map<string, string>();

/**
 * Saves a single message to SQLite database and local cache.
 */
export async function saveMessage(msg: Message, currentUserId?: string): Promise<void> {
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

  // Check deduplication signature
  const writeSig = `${normalizedMsg.id}:${normalizedMsg.status}:${normalizedMsg.deliveryStatus}:${normalizedMsg.updatedAt || ''}:${(normalizedMsg as any).readBy?.length || 0}`;
  if (recentWritesMap.get(normalizedMsg.id) === writeSig) {
    return;
  }
  recentWritesMap.set(normalizedMsg.id, writeSig);
  if (recentWritesMap.size > 500) {
    const firstKey = recentWritesMap.keys().next().value;
    if (firstKey) recentWritesMap.delete(firstKey);
  }
  
  // Calculate strict canonical chat key
  let canonicalChatId = normalizedMsg.groupId;
  if (!canonicalChatId) {
    if (normalizedMsg.senderId && normalizedMsg.receiverId) {
      if (normalizedMsg.senderId === normalizedMsg.receiverId) {
        canonicalChatId = `notebook_${normalizedMsg.senderId}`;
      } else {
        canonicalChatId = `dm_${[normalizedMsg.senderId, normalizedMsg.receiverId].sort().join('_')}`;
      }
    } else {
      canonicalChatId = normalizedMsg.chatId;
    }
  }

  if (canonicalChatId) {
    saveMessageToLocalStorage(canonicalChatId, normalizedMsg);
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
export async function mergeDelta(chats: Chat[] = [], messages: Message[], currentUserId?: string): Promise<void> {
  try {
    if ((!chats || chats.length === 0) && (!messages || messages.length === 0)) {
      return;
    }

    await initDatabase();
    let maxVer = await getDeltaSyncVersion();

    // 1. Merge chats
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

    // 2. Merge messages (Only save messages that are relevant to current user)
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (!msg || !msg.id) continue;
        const ver = msg.version || 1;
        if (ver > maxVer) maxVer = ver;

        // Strict isolation: if currentUserId is known, only store messages for user's direct chats or groups
        if (currentUserId) {
          const isGlobal = msg.groupId === 'global_channel';
          const isDirect = !msg.groupId && (msg.senderId === currentUserId || msg.receiverId === currentUserId);
          const isGroup = !!msg.groupId;
          if (!isGlobal && !isDirect && !isGroup) {
            continue; // Skip foreign messages
          }
        }

        await saveMessage(msg, currentUserId);
      }
    }

    localStorage.setItem('ordina_delta_version', maxVer.toString());
  } catch (err) {
    console.error('[SQLite] mergeDelta error:', err);
  }
}

/**
 * Loads all cached messages for a given chat with STRICT isolation.
 */
export async function getMessagesForChat(chatId: string, currentUserId?: string): Promise<Message[]> {
  try {
    await initDatabase();
    if (dbInstance) {
      let query = '';
      let params: any[] = [];

      const isGroup = chatId === 'global_channel' || chatId.startsWith('group_') || chatId.startsWith('channel_');

      if (isGroup) {
        query = `SELECT rawJson FROM messages WHERE groupId = ? ORDER BY createdAt ASC;`;
        params = [chatId];
      } else if (currentUserId && (chatId === currentUserId || chatId === 'notebook')) {
        // User's private Notebook: only messages where senderId === receiverId === currentUserId
        query = `SELECT rawJson FROM messages WHERE groupId IS NULL AND senderId = ? AND receiverId = ? ORDER BY createdAt ASC;`;
        params = [currentUserId, currentUserId];
      } else if (currentUserId && chatId !== currentUserId) {
        // Direct chat between currentUserId and chatId: strictly messages between these two
        query = `SELECT rawJson FROM messages 
                 WHERE groupId IS NULL 
                   AND ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?))
                 ORDER BY createdAt ASC;`;
        params = [currentUserId, chatId, chatId, currentUserId];
      } else {
        // Fallback: group or single target
        query = `SELECT rawJson FROM messages WHERE groupId = ? ORDER BY createdAt ASC;`;
        params = [chatId];
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
  return loadMessagesFromLocalCache(chatId, currentUserId);
}

// -------------------------------------------------------------
// Isolated LocalStorage Helpers
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

function saveMessageToLocalStorage(canonicalKey: string, msg: Message): void {
  // Save under isolated canonical key
  appendToStorageKey(`ordina_cache_${canonicalKey}`, msg);
}

export function saveMessageToLocalCache(chatId: string, msg: Message, currentUserId?: string): void {
  saveMessage(msg, currentUserId).catch(() => {});
}

export function saveMessagesToLocalCache(chatId: string, messages: Message[], currentUserId?: string): void {
  messages.forEach(msg => saveMessage(msg, currentUserId).catch(() => {}));
}

/**
 * Loads cached messages from localStorage with STRICT sender/receiver validation.
 * Eliminates bug where foreign chat messages leak into empty chats!
 */
export function loadMessagesFromLocalCache(chatId: string, currentUserId?: string): Message[] {
  try {
    const foundMap = new Map<string, Message>();
    const isGroup = chatId === 'global_channel' || chatId.startsWith('group_') || chatId.startsWith('channel_');

    const canonicalKey = getCanonicalChatKey(chatId, currentUserId);
    const keysToCheck = [`ordina_cache_${canonicalKey}`];
    
    // Also check raw chatId key for groups
    if (isGroup && !keysToCheck.includes(`ordina_cache_${chatId}`)) {
      keysToCheck.push(`ordina_cache_${chatId}`);
    }

    for (const key of keysToCheck) {
      const flatRaw = localStorage.getItem(key);
      if (flatRaw) {
        try {
          const arr = JSON.parse(flatRaw);
          if (Array.isArray(arr)) {
            for (const m of arr) {
              if (!m || !m.id) continue;

              // STRICT ISOLATION FILTER
              if (isGroup) {
                if (m.groupId === chatId) foundMap.set(m.id, m);
              } else if (currentUserId && (chatId === currentUserId || chatId === 'notebook')) {
                // Notebook: sender must be me, receiver must be me, no groupId
                if (!m.groupId && m.senderId === currentUserId && m.receiverId === currentUserId) {
                  foundMap.set(m.id, m);
                }
              } else if (currentUserId && chatId !== currentUserId) {
                // DM: strictly between currentUserId and chatId
                const isBetweenUs = !m.groupId && (
                  (m.senderId === currentUserId && m.receiverId === chatId) ||
                  (m.senderId === chatId && m.receiverId === currentUserId)
                );
                if (isBetweenUs) {
                  foundMap.set(m.id, m);
                }
              } else {
                // If currentUserId not known yet, accept only if message matches chatId exactly
                if (m.groupId === chatId) foundMap.set(m.id, m);
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

/**
 * Purges legacy contaminated caches where messages were incorrectly keyed by single user IDs.
 */
export function purgeContaminatedLegacyCaches(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ordina_cache_')) {
        const suffix = k.replace('ordina_cache_', '');
        // If it's a raw user ID without dm_ or notebook_ prefix and not a group/channel:
        if (!suffix.startsWith('dm_') && !suffix.startsWith('notebook_') && !suffix.startsWith('group_') && !suffix.startsWith('channel_') && suffix !== 'global_channel') {
          // Check if it has contaminated mixed messages
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const msgs: Message[] = JSON.parse(raw);
              if (Array.isArray(msgs)) {
                // If messages have differing receivers or senders, it's contaminated
                const receivers = new Set(msgs.map(m => m.receiverId).filter(Boolean));
                if (receivers.size > 1) {
                  keysToRemove.push(k);
                }
              }
            } catch (e) {}
          }
        }
      }
    }
    keysToRemove.forEach(k => {
      console.log('[SQLite Cache] Purging contaminated legacy key:', k);
      localStorage.removeItem(k);
    });
  } catch (e) {}
}

export function clearChatLocalCache(chatId: string, currentUserId?: string): void {
  try {
    const canonicalKey = getCanonicalChatKey(chatId, currentUserId);
    localStorage.removeItem(`ordina_cache_${canonicalKey}`);
    localStorage.removeItem(`ordina_cache_${chatId}`);

    if (dbInstance) {
      const isGroup = chatId === 'global_channel' || chatId.startsWith('group_') || chatId.startsWith('channel_');
      if (isGroup) {
        dbInstance.run('DELETE FROM messages WHERE groupId = ?;', [chatId]).catch(() => {});
      } else if (currentUserId && (chatId === currentUserId || chatId === 'notebook')) {
        dbInstance.run('DELETE FROM messages WHERE groupId IS NULL AND senderId = ? AND receiverId = ?;', [currentUserId, currentUserId]).catch(() => {});
      } else if (currentUserId && chatId !== currentUserId) {
        dbInstance.run(
          'DELETE FROM messages WHERE groupId IS NULL AND ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?));',
          [currentUserId, chatId, chatId, currentUserId]
        ).catch(() => {});
      }
    }
  } catch (e) {}
}
