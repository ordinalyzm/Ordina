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

/**
 * Saves a single message to SQLite database and local cache.
 */
export async function saveMessage(msg: Message): Promise<void> {
  if (!msg || !msg.id) return;
  
  // Also keep in localStorage for immediate sync access
  const chatId = msg.groupId || msg.receiverId || msg.senderId;
  if (chatId) {
    saveMessageToLocalStorage(chatId, msg);
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
        msg.id,
        msg.senderId || '',
        msg.receiverId || null,
        msg.groupId || null,
        msg.text || '',
        msg.type || 'text',
        msg.fileUrl || null,
        msg.fileName || null,
        msg.fileSize || 0,
        msg.createdAt || new Date().toISOString(),
        msg.updatedAt || null,
        msg.status || 'pending',
        msg.deliveryStatus || msg.status || 'pending',
        msg.ttl !== undefined ? msg.ttl : 5,
        msg.version || 1,
        JSON.stringify(msg)
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
 * Merges delta sync data (incremental chats and messages from server) into SQLite.
 */
export async function mergeDelta(chats: Chat[] = [], messages: Message[] = []): Promise<void> {
  try {
    await initDatabase();
    let maxVer = await getDeltaSyncVersion();

    // 1. Merge chats
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

    // 2. Merge messages
    for (const msg of messages) {
      if (!msg || !msg.id) continue;
      const ver = msg.version || 1;
      if (ver > maxVer) maxVer = ver;
      await saveMessage(msg);
    }

    localStorage.setItem('ordina_delta_version', maxVer.toString());
    console.log(`[SQLite] Merged delta: ${chats.length} chats, ${messages.length} messages. New max version: ${maxVer}`);
  } catch (err) {
    console.error('[SQLite] mergeDelta error:', err);
  }
}

/**
 * Loads all cached messages for a given chat.
 */
export async function getMessagesForChat(chatId: string): Promise<Message[]> {
  try {
    await initDatabase();
    if (dbInstance) {
      const res = await dbInstance.query(
        `SELECT rawJson FROM messages 
         WHERE groupId = ? OR receiverId = ? OR senderId = ? 
         ORDER BY createdAt ASC;`,
        [chatId, chatId, chatId]
      );
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

function saveMessageToLocalStorage(chatId: string, msg: Message): void {
  try {
    const flatKey = `ordina_cache_${chatId}`;
    const flatRaw = localStorage.getItem(flatKey);
    let flatMsgs: Message[] = flatRaw ? JSON.parse(flatRaw) : [];
    if (!Array.isArray(flatMsgs)) flatMsgs = [];
    const flatIdx = flatMsgs.findIndex(m => m.id === msg.id);
    if (flatIdx !== -1) {
      flatMsgs[flatIdx] = { ...flatMsgs[flatIdx], ...msg };
    } else {
      flatMsgs.push(msg);
    }
    if (flatMsgs.length > 200) flatMsgs = flatMsgs.slice(-200);
    localStorage.setItem(flatKey, JSON.stringify(flatMsgs));
  } catch (e) {}
}

export function saveMessageToLocalCache(chatId: string, msg: Message): void {
  saveMessage(msg).catch(() => {});
}

export function saveMessagesToLocalCache(chatId: string, messages: Message[]): void {
  messages.forEach(msg => saveMessage(msg).catch(() => {}));
}

export function loadMessagesFromLocalCache(chatId: string): Message[] {
  try {
    const flatKey = `ordina_cache_${chatId}`;
    const flatRaw = localStorage.getItem(flatKey);
    if (flatRaw) {
      const flatMsgs = JSON.parse(flatRaw);
      if (Array.isArray(flatMsgs)) {
        return flatMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    }
  } catch (e) {}
  return [];
}

export function clearChatLocalCache(chatId: string): void {
  try {
    localStorage.removeItem(`ordina_cache_${chatId}`);
    if (dbInstance) {
      dbInstance.run('DELETE FROM messages WHERE groupId = ? OR receiverId = ? OR senderId = ?;', [chatId, chatId, chatId]).catch(() => {});
    }
  } catch (e) {}
}
