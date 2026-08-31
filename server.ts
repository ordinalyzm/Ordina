process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
const { Pool } = pg;
import cors from 'cors';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

// Local storage fallback database
let localDb = {
  users: {} as Record<string, { uid: string, data: string }>,
  messages: {} as Record<string, { id: string, chatId: string, data: string, createdAt: string }>,
  groups: {} as Record<string, { id: string, data: string }>,
  sticker_packs: {} as Record<string, { id: string, data: string }>,
  scheduled_messages: {} as Record<string, { id: string, chatId: string, data: string, sendAt: string }>,
  bots: {} as Record<string, { id: string, owner_id: string, data: string }>
};

const DB_FILE = path.join(process.cwd(), 'local_database.json');

// Load existing database if exists
try {
  if (fs.existsSync(DB_FILE)) {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    localDb = { ...localDb, ...JSON.parse(content) };
    console.log('[LocalDB] Loaded database from local_database.json');
  }
} catch (e) {
  console.error('[LocalDB] Error loading database file, using empty:', e);
}

function saveLocalDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (e) {
    console.error('[LocalDB] Error saving local database:', e);
  }
}

let useLocalFallback = !process.env.DATABASE_URL;

async function queryLocal(sql: string, params: any[] = []): Promise<{ rows: any[], rowCount: number }> {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  
  if (normalized.startsWith('CREATE ')) {
    return { rows: [], rowCount: 0 };
  }
  
  if (normalized.includes('INSERT INTO users')) {
    const uid = params[0];
    const data = params[1];
    localDb.users[uid] = { uid, data };
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }
  
  if (normalized.includes('INSERT INTO messages')) {
    const id = params[0];
    const chatId = params[1];
    const data = params[2];
    const createdAt = params[3];
    localDb.messages[id] = { id, chatId, data, createdAt };
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }
  
  if (normalized.includes('INSERT INTO groups')) {
    const id = params[0];
    const data = params[1];
    localDb.groups[id] = { id, data };
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('INSERT INTO sticker_packs')) {
    const id = params[0];
    const data = params[1];
    localDb.sticker_packs[id] = { id, data };
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('INSERT INTO scheduled_messages')) {
    const id = params[0];
    const chatId = params[1];
    const data = params[2];
    const sendAt = params[3];
    localDb.scheduled_messages[id] = { id, chatId, data, sendAt };
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('INSERT INTO bots')) {
    const id = params[0];
    const owner_id = params[1];
    const data = params[2];
    localDb.bots[id] = { id, owner_id, data };
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('UPDATE users SET data =')) {
    const data = params[0];
    const uid = params[1];
    if (localDb.users[uid]) {
      localDb.users[uid].data = data;
      saveLocalDb();
    }
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('UPDATE groups SET data =')) {
    const data = params[0];
    const id = params[1];
    if (localDb.groups[id]) {
      localDb.groups[id].data = data;
      saveLocalDb();
    }
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('UPDATE messages SET data =')) {
    const data = params[0];
    const id = params[1];
    if (localDb.messages[id]) {
      localDb.messages[id].data = data;
      saveLocalDb();
    }
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('UPDATE sticker_packs SET data =')) {
    const data = params[0];
    const id = params[1];
    if (localDb.sticker_packs[id]) {
      localDb.sticker_packs[id].data = data;
      saveLocalDb();
    }
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('UPDATE bots SET data =')) {
    const data = params[0];
    const id = params[1];
    if (localDb.bots[id]) {
      localDb.bots[id].data = data;
      saveLocalDb();
    }
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('DELETE FROM messages WHERE id =')) {
    const id = params[0];
    delete localDb.messages[id];
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('DELETE FROM messages WHERE "chatId" =')) {
    const chatId = params[0];
    Object.keys(localDb.messages).forEach(id => {
      if (localDb.messages[id].chatId === chatId) {
        delete localDb.messages[id];
      }
    });
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('DELETE FROM groups WHERE id =')) {
    const id = params[0];
    delete localDb.groups[id];
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('DELETE FROM bots WHERE id =')) {
    const id = params[0];
    delete localDb.bots[id];
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('DELETE FROM sticker_packs WHERE id =')) {
    const id = params[0];
    delete localDb.sticker_packs[id];
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('DELETE FROM users WHERE uid =')) {
    const uid = params[0];
    delete localDb.users[uid];
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('SELECT id, length(data)')) {
    const rows = Object.values(localDb.sticker_packs).map(p => ({
      id: p.id,
      size: p.data.length
    }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM groups WHERE id =')) {
    const id = params[0];
    const group = localDb.groups[id];
    const rows = group ? [{ id: group.id, data: group.data }] : [];
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM groups') && !normalized.includes('WHERE')) {
    const rows = Object.values(localDb.groups).map(g => ({ id: g.id, data: g.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM scheduled_messages WHERE "sendAt" <=') || normalized.includes('FROM scheduled_messages WHERE sendAt <=')) {
    const sendAt = params[0];
    const rows = Object.values(localDb.scheduled_messages)
      .filter(m => m.sendAt <= sendAt)
      .map(m => ({ id: m.id, chatId: m.chatId, data: m.data, sendAt: m.sendAt }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM users WHERE uid =')) {
    const uid = params[0];
    const user = localDb.users[uid];
    const rows = user ? [{ data: user.data }] : [];
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM users WHERE uid !=') || normalized.includes('FROM users WHERE uid <>')) {
    const uid = params[0];
    const rows = Object.values(localDb.users)
      .filter(u => u.uid !== uid)
      .map(u => ({ data: u.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('LOWER((data::jsonb)')) {
    const username = params[0]?.toLowerCase();
    const uid = params[1];
    const found = Object.values(localDb.users).find(u => {
      try {
        const d = JSON.parse(u.data);
        return d.username?.toLowerCase() === username || u.uid === uid;
      } catch {
        return u.uid === uid;
      }
    });
    const rows = found ? [{ uid: found.uid }] : [];
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM users') && !normalized.includes('WHERE')) {
    const rows = Object.values(localDb.users).map(u => ({ data: u.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM bots WHERE id =')) {
    const id = params[0];
    const bot = localDb.bots[id];
    const rows = bot ? [{ data: bot.data }] : [];
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM bots WHERE owner_id =')) {
    const owner_id = params[0];
    const rows = Object.values(localDb.bots)
      .filter(b => b.owner_id === owner_id)
      .map(b => ({ data: b.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM bots') && !normalized.includes('WHERE')) {
    const rows = Object.values(localDb.bots).map(b => ({ data: b.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM messages WHERE id =')) {
    const id = params[0];
    const msg = localDb.messages[id];
    const rows = msg ? [{ data: msg.data }] : [];
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM messages WHERE "chatId" IN') || normalized.includes('FROM messages WHERE chatId IN')) {
    const cid1 = params[0];
    const cid2 = params[1];
    const limit = params[2] || 100;
    const rows = Object.values(localDb.messages)
      .filter(m => m.chatId === cid1 || m.chatId === cid2)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(m => ({ data: m.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM messages WHERE "chatId" =') || normalized.includes('FROM messages WHERE chatId =')) {
    const chatId = params[0];
    const limit = params[1] || 100;
    const rows = Object.values(localDb.messages)
      .filter(m => m.chatId === chatId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(m => ({ data: m.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM sticker_packs WHERE id =')) {
    const id = params[0];
    const pack = localDb.sticker_packs[id];
    const rows = pack ? [{ data: pack.data }] : [];
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('FROM sticker_packs') && !normalized.includes('WHERE')) {
    const rows = Object.values(localDb.sticker_packs).map(p => ({ data: p.data }));
    return { rows, rowCount: rows.length };
  }

  if (normalized.includes('DELETE FROM messages WHERE data LIKE')) {
    const p1 = params[0]?.replace(/%/g, '');
    const p2 = params[1]?.replace(/%/g, '');
    Object.keys(localDb.messages).forEach(id => {
      if (localDb.messages[id].data.includes(p1) || localDb.messages[id].data.includes(p2)) {
        delete localDb.messages[id];
      }
    });
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  if (normalized.includes('DELETE FROM groups WHERE data LIKE')) {
    const p1 = params[0]?.replace(/%/g, '');
    Object.keys(localDb.groups).forEach(id => {
      if (localDb.groups[id].data.includes(p1)) {
        delete localDb.groups[id];
      }
    });
    saveLocalDb();
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  query_timeout: 4000,
  connectionTimeoutMillis: 4000
});

pool.on('error', (err) => {
  if (!useLocalFallback) {
    console.log('ℹ️ [Database] Postgres database connection unavailable, using local JSON storage.');
    useLocalFallback = true;
  }
});

const originalQuery = pool.query.bind(pool);
pool.query = async function(this: any, sql: any, params: any) {
  if (useLocalFallback) {
    return queryLocal(sql, params) as any;
  }
  try {
    return await originalQuery(sql, params);
  } catch (err: any) {
    if (!useLocalFallback) {
      console.log('ℹ️ [Database] Postgres database connection unavailable, using local JSON storage.');
      useLocalFallback = true;
    }
    return queryLocal(sql, params) as any;
  }
} as any;

async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        "chatId" TEXT NOT NULL,
        data TEXT NOT NULL,
        "createdAt" TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sticker_packs (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id TEXT PRIMARY KEY,
        "chatId" TEXT NOT NULL,
        data TEXT NOT NULL,
        "sendAt" TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_chatid ON messages ("chatId");
      CREATE INDEX IF NOT EXISTS idx_messages_createdat ON messages ("createdAt");
      CREATE INDEX IF NOT EXISTS idx_sched_sendat ON scheduled_messages ("sendAt");
      CREATE INDEX IF NOT EXISTS idx_messages_chatid_createdat ON messages ("chatId", "createdAt" DESC);
    `);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('[Gemini] Failed to initialize GoogleGenAI client:', e);
    }
  }
  return aiClient;
}

const cleanupStickers = async () => {
  try {
    const { rows } = await pool.query('SELECT id, length(data) as size FROM sticker_packs');
    for (const row of rows) {
      if (row.size > 5000000) { // If a pack is more than 5MB
        console.log(`Deleting large sticker pack ${row.id}`);
        await pool.query('DELETE FROM sticker_packs WHERE id = $1', [row.id]);
      }
    }
  } catch (e) {
    console.error("Cleanup error", e);
  }
};

const seedGlobalChannel = async () => {
  try {
    const globalId = 'global_channel';
    const { rows } = await pool.query('SELECT id, data FROM groups WHERE id = $1', [globalId]);
    const existing = rows[0];
    
    const globalData = {
      id: globalId,
      name: 'Ордина Глобал 🌐',
      description: 'Главный канал мессенджера Ордина. Общайтесь, задавайте вопросы и делитесь идеями!',
      ownerId: 'le6qifgHZsV99qTBzSe3VZpYVlE2',
      createdAt: new Date().toISOString(),
      photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
      type: 'channel',
      isPublic: true,
      isGlobal: true,
      isVerified: true,
      members: ['le6qifgHZsV99qTBzSe3VZpYVlE2'],
      memberRoles: { 'le6qifgHZsV99qTBzSe3VZpYVlE2': 'owner' }
    };

    if (!existing) {
      await pool.query('INSERT INTO groups (id, data) VALUES ($1, $2)', [globalId, JSON.stringify(globalData)]);
      console.log('Global channel seeded.');
    } else {
      const current = JSON.parse(existing.data);
      if (!current.photoURL || current.photoURL.includes('unsplash') || current.photoURL.includes('freepik') || current.photoURL.includes('bird') || !current.description) {
        const updated = { ...current, ...globalData, members: current.members || globalData.members, memberRoles: current.memberRoles || globalData.memberRoles };
        await pool.query('UPDATE groups SET data = $1 WHERE id = $2', [JSON.stringify(updated), globalId]);
        console.log('Global channel data refreshed.');
      }
    }
  } catch (error) {
    console.error('Error seeding global channel:', error);
  }
};

async function startServer() {
  await initDb();
  await cleanupStickers();
  await seedGlobalChannel();

  (global as any).userBotStates = new Map();
  (global as any).userBotVariables = new Map();

  function unmaskAntiDPIPayload(envelope: any): any | null {
    if (!envelope || !envelope.blob || !envelope.nonce) return null;
    try {
      const seed = 'ordina_anti_dpi_salt_2026_' + envelope.nonce;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      const key = Math.abs(hash).toString(16) + '9f8b4e72c01a';
      const scrambled = typeof atob !== 'undefined'
        ? decodeURIComponent(atob(envelope.blob))
        : Buffer.from(envelope.blob, 'base64').toString('utf-8');

      let original = '';
      for (let i = 0; i < scrambled.length; i++) {
        const maskedChar = scrambled.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        const originalChar = String.fromCharCode(maskedChar ^ keyChar ^ ((i + 7) & 0x7f));
        original += originalChar;
      }
      return JSON.parse(original);
    } catch (e) {
      return null;
    }
  }

  const app = express();
  
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-device-id');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health / Keep-alive wake-up endpoints
  app.get(['/api', '/api/', '/api/health'], (req, res) => {
    res.json({ status: 'ok', server: 'Ordina Backend', timestamp: new Date().toISOString() });
  });
  app.get('/api/ping', (req, res) => {
    res.send('pong');
  });

  // REST endpoints for persisted data & stats
  app.get('/api/stats', async (req, res) => {
    try {
      const { rows: uRows } = await pool.query('SELECT data FROM users');
      const { rows: gRows } = await pool.query('SELECT data FROM groups');
      const { rows: mRows } = await pool.query('SELECT count(*) as count FROM messages');
      res.json({
        usersCount: uRows.length,
        channelsCount: gRows.length,
        messagesCount: parseInt(mRows[0]?.count || '0', 10),
        onlineUsersCount: onlineUsers.size,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/users', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT data FROM users');
      const users = rows.map((r: any) => JSON.parse(r.data));
      res.json({ total: users.length, users });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/channels', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT data FROM groups');
      const channels = rows.map((r: any) => JSON.parse(r.data));
      res.json({ total: channels.length, channels });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Anti-DPI Obfuscated Fallback Endpoint
  app.post('/api/obfuscated/packet', async (req, res) => {
    try {
      const envelope = req.body;
      const unmasked = unmaskAntiDPIPayload(envelope);
      if (!unmasked || !unmasked.chatId || !unmasked.payload) {
        return res.status(400).json({ error: 'Invalid obfuscated packet' });
      }

      const { chatId, payload } = unmasked;
      const message = payload;
      const myUid = message.senderId;

      if (!myUid) {
        return res.status(400).json({ error: 'Missing sender' });
      }

      const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [chatId]);
      const isGroup = !!message.groupId || chatId === 'global_channel' || gCount > 0;
      let historyId = chatId;
      let room = `chat:${chatId}`;

      if (!isGroup && chatId !== 'global_channel') {
        const receiverId = message.receiverId || chatId;
        if (myUid === receiverId) historyId = myUid;
        else historyId = [myUid, receiverId].sort().join('_');
        room = `chat:${historyId}`;
        message.receiverId = receiverId;
      }

      const query = 'INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET data = $3';
      await pool.query(query, [message.id, historyId, JSON.stringify(message), message.createdAt || new Date().toISOString()]);

      io.to(room).emit('message:received', message);
      if (message.receiverId && !isGroup) {
        io.to(`user:${message.receiverId}`).emit('message:received', message);
      }

      res.json({ status: 'ok', id: message.id });
    } catch (e: any) {
      console.error('[Anti-DPI API] Error processing obfuscated packet:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/bot-ai', async (req, res) => {
    try {
      const { prompt, currentBot } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Запрос не может быть пустым' });
      }

      let parsedBot: any = null;

      try {
        const systemPrompt = `Ты — экспертный ИИ-разработчик ботов для платформы Ordina Messenger / Telegram.
Твоя задача: по запросу пользователя сгенерировать или отредактировать конфигурацию бота на основе готовой схемы.

Структура конфигурации бота (JSON):
{
  "name": "Название бота",
  "username": "уникальный_юзернейм",
  "description": "Описание назначения бота",
  "isActive": true,
  "rules": [
    {
      "id": "уникальный_id",
      "trigger": {
        "type": "command", // command, text, new_member
        "params": { "value": "/start" },
        "forAdminsOnly": false
      },
      "conditions": [
        {
          "id": "cond_id",
          "type": "variable_equals",
          "params": { "key": "city", "value": "Москва" }
        }
      ],
      "actions": [
        {
          "id": "act_id",
          "type": "send_message", // send_message, set_variable, fetch_random_user, wait_feedback, send_message_to_user, moderate
          "params": {
            "text": "Привет, {user_name}! Заходи в чат.",
            "key": "переменная",
            "value": "значение"
          }
        }
      ]
    }
  ]
}

Инструкция:
1. Если передан currentBot, сохрани существующие работающие правила и дополни или отредактируй их согласно запросу пользователя.
2. Верни ИСКЛЮЧИТЕЛЬНО валидный JSON объект конфигурации бота без каких-либо вводных слов, кодовых блоков markdown или разметки (чистый JSON).`;

        const ai = getAiClient();
        if (!ai) {
          throw new Error('GEMINI_API_KEY environment variable is missing');
        }

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemPrompt },
                { text: `Запрос пользователя: "${prompt}"\n\nТекущая конфигурация бота (если есть):\n${JSON.stringify(currentBot || null, null, 2)}` }
              ]
            }
          ]
        });

        let responseText = response.text || '';
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsedBot = JSON.parse(responseText);
      } catch (geminiErr: any) {
        console.warn('[Bot AI] Gemini call failed/blocked, falling back to local AI engine:', geminiErr?.message || geminiErr);
        
        // Local intelligent fallback generator
        const lowerPrompt = prompt.toLowerCase();
        const existingRules = currentBot?.rules ? [...currentBot.rules] : [];

        let botName = currentBot?.name || 'ИИ-Помощник Бот';
        let botUsername = currentBot?.username || `bot_${Math.floor(1000 + Math.random() * 9000)}`;
        let botDesc = currentBot?.description || 'Автоматически сгенерированный ИИ бот-ассистент';

        if (lowerPrompt.includes('приветст') || lowerPrompt.includes('welcome')) {
          botName = 'Приветственный Бот';
          botDesc = 'Приветствует новых участников и дает справку по командам';
        } else if (lowerPrompt.includes('модера') || lowerPrompt.includes('спам') || lowerPrompt.includes('бан')) {
          botName = 'Ордина Модератор';
          botDesc = 'Автоматическая модерация сообщений и защита чата от спама';
        } else if (lowerPrompt.includes('отзыв') || lowerPrompt.includes('фидбек') || lowerPrompt.includes('вопрос')) {
          botName = 'Бот Сбора Обратной Связи';
          botDesc = 'Принимает вопросы и отзывы участников чата';
        }

        const newRules: any[] = [];

        // Always ensure /start command
        newRules.push({
          id: `rule_start_${Date.now()}`,
          trigger: { type: 'command', params: { value: '/start' }, forAdminsOnly: false },
          conditions: [],
          actions: [
            {
              id: `act_start_${Date.now()}`,
              type: 'send_message',
              params: {
                text: lowerPrompt.includes('модера')
                  ? '🛡️ Привет! Я бот-модератор. Я слежу за порядком в чате и помогаю участникам.'
                  : `👋 Здравствуйте! Я бот «${botName}». Чем я могу вам помочь? Напишите /help для просмотра всех команд.`,
              }
            }
          ]
        });

        // Always add /help command
        newRules.push({
          id: `rule_help_${Date.now()}`,
          trigger: { type: 'command', params: { value: '/help' }, forAdminsOnly: false },
          conditions: [],
          actions: [
            {
              id: `act_help_${Date.now()}`,
              type: 'send_message',
              params: {
                text: '📌 Доступные команды:\n/start — Перезапуск бота\n/help — Справка по командам\n/info — Информация о сообществе\n/rules — Правила поведения',
              }
            }
          ]
        });

        // Add /rules command if requested
        if (lowerPrompt.includes('правил') || lowerPrompt.includes('rules') || lowerPrompt.includes('приветст')) {
          newRules.push({
            id: `rule_rules_${Date.now()}`,
            trigger: { type: 'command', params: { value: '/rules' }, forAdminsOnly: false },
            conditions: [],
            actions: [
              {
                id: `act_rules_${Date.now()}`,
                type: 'send_message',
                params: {
                  text: '📜 Правила чата:\n1. Будьте вежливы\n2. Никакого спама и несанкционированной рекламы\n3. Уважайте участников сообщества',
                }
              }
            ]
          });
        }

        // Add New Member Greeting trigger
        if (lowerPrompt.includes('участник') || lowerPrompt.includes('приветст') || lowerPrompt.includes('вход')) {
          newRules.push({
            id: `rule_new_member_${Date.now()}`,
            trigger: { type: 'new_member', params: {}, forAdminsOnly: false },
            conditions: [],
            actions: [
              {
                id: `act_welcome_${Date.now()}`,
                type: 'send_message',
                params: {
                  text: '🎉 Добро пожаловать в наше сообщество! Пожалуйста, ознакомьтесь с правилами командой /rules.',
                }
              }
            ]
          });
        }

        // Add moderation rule if moderation mentioned
        if (lowerPrompt.includes('модера') || lowerPrompt.includes('спам') || lowerPrompt.includes('бан') || lowerPrompt.includes('мат')) {
          newRules.push({
            id: `rule_mod_${Date.now()}`,
            trigger: { type: 'text', params: { value: 'спам' }, forAdminsOnly: false },
            conditions: [],
            actions: [
              {
                id: `act_mod_${Date.now()}`,
                type: 'moderate',
                params: { text: '⚠️ Сообщение содержит запрещенные слова или спам.' }
              }
            ]
          });
        }

        parsedBot = {
          id: currentBot?.id || uuidv4(),
          name: botName,
          username: botUsername,
          description: botDesc,
          isActive: true,
          rules: existingRules.length > 0 ? [...existingRules, ...newRules] : newRules,
        };
      }

      if (!parsedBot.id) parsedBot.id = currentBot?.id || uuidv4();
      if (!parsedBot.name) parsedBot.name = 'Новый ИИ Бот';
      if (!parsedBot.rules) parsedBot.rules = [];
      parsedBot.rules.forEach((r: any, rIdx: number) => {
        if (!r.id) r.id = `rule_${Date.now()}_${rIdx}`;
        if (!r.trigger) r.trigger = { type: 'command', params: { value: '/start' } };
        if (!r.actions) r.actions = [];
        r.actions.forEach((a: any, aIdx: number) => {
          if (!a.id) a.id = `act_${Date.now()}_${aIdx}`;
        });
      });

      res.json({ success: true, bot: parsedBot });
    } catch (e: any) {
      console.error('[Bot AI Error]:', e);
      res.status(500).json({ error: e.message || 'Ошибка генерации конфигурации бота' });
    }
  });
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 5e7,
    cors: {
      origin: (reqOrigin, callback) => {
        callback(null, true);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true
    },
    transports: ['polling', 'websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true
  });

  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      const { rows: messages } = await pool.query('SELECT * FROM scheduled_messages WHERE "sendAt" <= $1', [now]);
      for (const rawMsg of messages) {
        if (!rawMsg || !rawMsg.data) {
          if (rawMsg?.id) await pool.query('DELETE FROM scheduled_messages WHERE id = $1', [rawMsg.id]);
          continue;
        }
        
        let msgData;
        try {
          msgData = JSON.parse(rawMsg.data);
        } catch (e) {
          await pool.query('DELETE FROM scheduled_messages WHERE id = $1', [rawMsg.id]);
          continue;
        }
        if (!msgData) msgData = {};
        
        msgData.createdAt = now;
        if (!msgData.id) msgData.id = uuidv4();
        
        await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msgData.id, rawMsg.chatId, JSON.stringify(msgData), now]);
        
        const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [rawMsg.chatId]);
        const isGroup = !!msgData.groupId || rawMsg.chatId === 'global_channel' || gCount > 0;
        let room = `chat:${rawMsg.chatId}`;
        if (!isGroup && msgData.receiverId) {
          let historyId;
          if (msgData.senderId === msgData.receiverId) {
            historyId = msgData.senderId;
          } else {
            historyId = [msgData.senderId, msgData.receiverId].sort().join('_');
          }
          room = `chat:${historyId}`;
        }
        
        io.to(room).emit('message:received', msgData);
        await pool.query('DELETE FROM scheduled_messages WHERE id = $1', [rawMsg.id]);
      }
    } catch(e) {
      console.error("Scheduled check error", e);
    }
  }, 60000);

  const PORT = Number(process.env.PORT) || 3000;
  const onlineUsers = new Map<string, { socketId: string, status: string, customStatus?: string }>();

  function getBotAsUser(b: any) {
  return {
    uid: b.id,
    name: b.name + ' 🤖',
    displayName: b.name + ' 🤖',
    username: b.username,
    email: `@${b.username}`,
    isBot: true,
    status: 'online',
    lastSeen: new Date().toISOString(),
    ownerId: b.ownerId,
    avatar: b.avatarUrl || null,
    avatarUrl: b.avatarUrl || null,
    photoURL: b.avatarUrl || null,
    description: b.description || '',
    isActive: b.isActive !== false,
    createdAt: b.createdAt || new Date().toISOString(),
    usersList: b.usersList || []
  };
}

async function checkAndDeleteMessage(msgId: string, msg: any, chatId: string) {
  try {
    if (msg.receiverId && !msg.groupId && chatId !== 'global_channel') {
      const receiverId = msg.receiverId;
      const hasBeenRead = msg.readBy && msg.readBy.includes(receiverId);
      if (!hasBeenRead) return;

      const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [receiverId]);
      if (rows[0]) {
        const receiverProfile = JSON.parse(rows[0].data);
        const activeDevices = (receiverProfile.devices || []).filter((d: any) => d.isApproved);
        
        if (activeDevices.length > 0) {
          const deliveredCount = activeDevices.filter((d: any) => msg.deliveredDevices && msg.deliveredDevices[d.id]).length;
          const allDelivered = deliveredCount === activeDevices.length;
          
          if (allDelivered) {
            console.log(`[Ephemeral] Deleting message ${msgId} from database because it has been read and delivered to all ${activeDevices.length} active devices of the recipient.`);
            await pool.query('DELETE FROM messages WHERE id = $1', [msgId]);
          }
        } else {
          console.log(`[Ephemeral] Deleting message ${msgId} because it has been read (no devices registered for recipient).`);
          await pool.query('DELETE FROM messages WHERE id = $1', [msgId]);
        }
      }
    }
  } catch (err) {
    console.error('[Ephemeral] Error in checkAndDeleteMessage:', err);
  }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('auth:sync', async (userData: any) => {
      try {
        const uid = userData.uid;
        (socket as any).uid = uid;
        
        const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [uid]);
        const row = rows[0];
        
        let finalData = userData;
        const isNewUser = !row;
        
        if (row) {
          const serverData = JSON.parse(row.data);
          finalData = {
            ...serverData,
            ...userData,
            photoURL: userData.photoURL || serverData.photoURL || '',
            bio: userData.bio || serverData.bio || '',
            username: userData.username || serverData.username || '',
            profileBackgroundURL: userData.profileBackgroundURL || serverData.profileBackgroundURL || '',
            customStatus: userData.customStatus || serverData.customStatus || '',
            activeTitleId: userData.activeTitleId || serverData.activeTitleId || '',
            grantedTitles: userData.grantedTitles || serverData.grantedTitles || [],
            uid: uid,
            email: userData.email || serverData.email
          };
        } else {
          if (!finalData.username) {
            finalData.username = userData.displayName?.toLowerCase().replace(/\s+/g, '_') || `user_${uid.slice(0, 5)}`;
          }
          try {
            await pool.query('INSERT INTO users (uid, data) VALUES ($1, $2)', [uid, JSON.stringify(finalData)]);
          } catch (e) { console.error('insert skipped'); }
        }

        // Handle device registration
        if (userData.device) {
          const dev = userData.device;
          finalData.devices = finalData.devices || [];
          const existingDevIdx = finalData.devices.findIndex((d: any) => d.id === dev.id);
          if (existingDevIdx !== -1) {
            finalData.devices[existingDevIdx] = {
              ...finalData.devices[existingDevIdx],
              name: dev.name,
              type: dev.type,
              lastActive: new Date().toISOString(),
              isApproved: finalData.devices[existingDevIdx].isApproved !== false
            };
          } else {
            const russianCities = [
              'Москва, РФ', 'Санкт-Петербург, РФ', 'Новосибирск, РФ', 
              'Екатеринбург, РФ', 'Казань, РФ', 'Нижний Новгород, РФ',
              'Краснодар, РФ', 'Владивосток, РФ', 'Сочи, РФ'
            ];
            const randomCity = russianCities[Math.floor(Math.random() * russianCities.length)];
            finalData.devices.push({
              id: dev.id,
              name: dev.name,
              type: dev.type,
              lastActive: new Date().toISOString(),
              isApproved: true,
              location: randomCity
            });
          }
        }
        
        if (!finalData.activeChats) finalData.activeChats = [];
        if (!finalData.activeChats.includes('global_channel')) {
          finalData.activeChats.unshift('global_channel');
          
          const { rows: gRows } = await pool.query('SELECT data FROM groups WHERE id = $1', ['global_channel']);
          const gRow = gRows[0];
          if (gRow) {
            const gData = JSON.parse(gRow.data);
            if (!gData.members.includes(uid)) {
              gData.members.push(uid);
              await pool.query('UPDATE groups SET data = $1 WHERE id = $2', [JSON.stringify(gData), 'global_channel']);
              io.emit('group:updated', gData);
            }
          }
        }
        
        await pool.query('INSERT INTO users (uid, data) VALUES ($1, $2) ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data', [uid, JSON.stringify(finalData)]);
        
        finalData.status = finalData.status || 'online';
        onlineUsers.set(uid, { socketId: socket.id, status: finalData.status, customStatus: finalData.customStatus });
        socket.join(`user:${uid}`);
        
        // Emit synced early to prevent UI block
        socket.emit('auth:synced', finalData);
        
        const { rows: allGroups } = await pool.query('SELECT id, data FROM groups');
        const userGroups = allGroups.filter((g: any) => {
          try {
            const gData = JSON.parse(g.data);
            return gData.members && gData.members.includes(uid);
          } catch (e) { return false; }
        });
        userGroups.forEach((g: any) => {
          socket.join(`chat:${g.id}`);
        });
        
        // Always broadcast user update so multi-user clients see everyone online
        io.emit('user:updated', finalData);

        // Send latest users list to connecting socket immediately
        try {
          const { rows: uRows } = await pool.query('SELECT data FROM users');
          const allUsersList = uRows.map((r: any) => JSON.parse(r.data));
          const { rows: bRows } = await pool.query('SELECT data FROM bots');
          const botsAsUsers = bRows.map((r: any) => {
             const b = JSON.parse(r.data);
             if (b.isActive === false) return null;
             return getBotAsUser(b);
          }).filter(Boolean);
          socket.emit('users:list', [...allUsersList, ...botsAsUsers]);
        } catch (e) {}

        if (finalData.email === 'ordinalyzm25@gmail.com') {
          const globalId = 'global_channel';
          const { rows: globalRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [globalId]);
          const globalRow = globalRows[0];
          if (globalRow) {
            const gData = JSON.parse(globalRow.data);
            if (gData.ownerId !== finalData.uid) {
              gData.ownerId = finalData.uid;
              await pool.query('UPDATE groups SET data = $1 WHERE id = $2', [JSON.stringify(gData), globalId]);
              io.emit('group:updated', gData);
              console.log('Global channel ownership assigned to', finalData.email);
            }
          }
        }
        
        io.emit('presence:update', Array.from(onlineUsers.entries()).map(([u, info]) => ({
          uid: u,
          status: info.status,
          customStatus: info.customStatus
        })));
      } catch (err) {
        console.error('Error during auth:sync:', err);
        socket.emit('auth:sync_error', { error: 'Failed to sync profile' });
      }
    });

    socket.on('user:online', (data: { uid: string, status: string, customStatus?: string }) => {
      (socket as any).uid = data.uid;
      const info = onlineUsers.get(data.uid);
      if (info) {
        onlineUsers.set(data.uid, { ...info, status: data.status, customStatus: data.customStatus });
      } else {
        onlineUsers.set(data.uid, { socketId: socket.id, status: data.status, customStatus: data.customStatus });
      }
      socket.join(`user:${data.uid}`);
      io.emit('presence:update', Array.from(onlineUsers.entries()).map(([uid, info]) => ({
        uid,
        status: info.status,
        customStatus: info.customStatus
      })));
    });

    socket.on('chat:join', async (data: any) => {
      const chatId = typeof data === 'string' ? data : data.id;
      const limit = (typeof data === 'object' && data.limit) ? data.limit : 100;
      const myUid = (socket as any).uid || (typeof data === 'object' ? data._uid : undefined);

      const { rows: groupRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [chatId]);
      const isGroup = !!groupRows[0] || chatId === 'global_channel' || (typeof data === 'object' && (data.type === 'group' || data.type === 'channel'));
      
      let room = `chat:${chatId}`;
      let historyId = chatId;

      if (!isGroup) {
        const otherUid = chatId;
        if (myUid && otherUid) {
          if (myUid === otherUid) historyId = myUid;
          else historyId = [myUid, otherUid].sort().join('_');
          room = `chat:${historyId}`;
        }
      }

      socket.join(room);
      console.log(`User ${myUid} joined room ${room} (historyID: ${historyId})`);
      
      try {
        let messages = [];
        if (myUid === chatId) {
          const oldId = `${myUid}_${myUid}`;
          const { rows } = await pool.query('SELECT data FROM messages WHERE "chatId" IN ($1, $2) ORDER BY "createdAt" DESC LIMIT $3', [myUid, oldId, limit]);
          messages = rows.map((row: any) => JSON.parse(row.data)).reverse();
        } else {
          const { rows } = await pool.query('SELECT data FROM messages WHERE "chatId" = $1 ORDER BY "createdAt" DESC LIMIT $2', [historyId, limit]);
          messages = rows.map((row: any) => JSON.parse(row.data)).reverse();
        }
        socket.emit('chat:history', { chatId, messages });
      } catch (err) {
        console.error('Failed to get history in chat:join:', err);
        socket.emit('chat:history', { chatId, messages: [] });
      }
    });

    socket.on('messages:fetch', async (data: { chat: any, limit: number, _uid?: string }) => {
      try {
        const chatId = data.chat.id;
        const myUid = (socket as any).uid || data._uid;
        const isGroup = data.chat.type === 'group' || data.chat.type === 'channel' || chatId === 'global_channel';
        let historyId = chatId;

        if (!isGroup && chatId !== 'global_channel') {
          const otherUid = chatId;
          if (myUid) {
            if (myUid === otherUid) historyId = myUid;
            else historyId = [myUid, otherUid].sort().join('_');
          }
        }

        let messages = [];
        if (myUid === chatId) {
          const oldId = `${myUid}_${myUid}`;
          const { rows } = await pool.query('SELECT data FROM messages WHERE "chatId" IN ($1, $2) ORDER BY "createdAt" DESC LIMIT $3', [myUid, oldId, data.limit || 100]);
          messages = rows.map((row: any) => JSON.parse(row.data)).reverse();
        } else {
          const { rows } = await pool.query('SELECT data FROM messages WHERE "chatId" = $1 ORDER BY "createdAt" DESC LIMIT $2', [historyId, data.limit || 100]);
          messages = rows.map((row: any) => JSON.parse(row.data)).reverse();
        }
        socket.emit('chat:history', { chatId, messages });
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        socket.emit('chat:history', { chatId: data.chat.id, messages: [] });
      }
    });

    socket.on('chat:history:fetch', async (chatId: string) => {
      try {
        const myUid = (socket as any).uid;
        let historyId = chatId;
        
        const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [chatId]);
        const isGroup = chatId === 'global_channel' || gCount > 0;
        
        if (!isGroup && myUid) {
          if (myUid === chatId) historyId = myUid;
          else historyId = [myUid, chatId].sort().join('_');
        }

        let messages = [];
        if (myUid === chatId) {
          const oldId = `${myUid}_${myUid}`;
          const { rows } = await pool.query('SELECT data FROM messages WHERE "chatId" IN ($1, $2) ORDER BY "createdAt" DESC LIMIT 100', [myUid, oldId]);
          messages = rows.map((row: any) => JSON.parse(row.data)).reverse();
        } else {
          const { rows } = await pool.query('SELECT data FROM messages WHERE "chatId" = $1 ORDER BY "createdAt" DESC LIMIT 100', [historyId]);
          messages = rows.map((row: any) => JSON.parse(row.data)).reverse();
        }
        socket.emit('chat:history', { chatId, messages });
      } catch (err) {
        console.error('Failed to fetch history:', err);
        socket.emit('chat:history', { chatId, messages: [] });
      }
    });

    socket.on('chat:leave', (chatId: string) => {});

    socket.on('bot:callback', async (data: { chatId: string, messageId: string, callbackData: string, botId: string, _uid?: string }) => {
       const myUid = (socket as any).uid || data._uid;
       if (!myUid) return;

       const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [data.chatId]);
       const isGroup = !!data.chatId && (data.chatId === 'global_channel' || gCount > 0);
       const bot = { id: data.botId };
       let historyId = data.chatId;
       if (!isGroup) {
           if (myUid === data.chatId) historyId = myUid;
           else historyId = [myUid, data.chatId].sort().join('_');
       }

               if (data.callbackData.startsWith('/dv_like_')) {
                   const targetId = data.callbackData.replace('/dv_like_', '');
                   const { rows: meRows } = await pool.query('SELECT data FROM users WHERE uid = $1', [myUid]);
                   const me = meRows[0] ? JSON.parse(meRows[0].data) : null;
                   
                   if (me) {
                       const targetHistoryId = [targetId, bot.id].sort().join('_');
                       const botMsg: any = {
                           id: uuidv4(),
                           senderId: bot.id,
                           receiverId: targetId,
                           chatId: targetHistoryId,
                           text: `❤️ Кому-то понравилась ваша анкета!\n\n${me.name}\n${me.about || ''}`,
                           type: 'text',
                           createdAt: new Date().toISOString(),
                           inlineButtons: [
                               [{ text: '❤️ Взаимно', action: 'callback', callbackData: `/dv_match_${myUid}` },
                                { text: '👎 Нет', action: 'callback', callbackData: '/dv_next' }]
                           ]
                       };
                       if (me.avatar) botMsg.attachment = { type: 'image', url: me.avatar, name: 'avatar.png' };
                       
                       pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, targetHistoryId, JSON.stringify(botMsg), botMsg.createdAt]);
                       io.to(`chat:${targetHistoryId}`).emit('message:received', botMsg);
                       io.to(`user:${targetId}`).emit('message:received', botMsg);
                   }
                   
                   // Show next
                   data.callbackData = '/dv_next';
               }
               if (data.callbackData.startsWith('/dv_match_')) {
                   const matchedUid = data.callbackData.replace('/dv_match_', '');
                   
                   const targetHistoryId1 = [myUid, bot.id].sort().join('_');
                   const msg1 = {
                       id: uuidv4(),
                       senderId: bot.id, receiverId: myUid, chatId: targetHistoryId1,
                       text: `🎉 У вас взаимная симпатия! Начинайте общаться: ` + matchedUid,
                       type: 'text', createdAt: new Date().toISOString()
                   };
                   pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msg1.id, targetHistoryId1, JSON.stringify(msg1), msg1.createdAt]);
                   io.to(`chat:${targetHistoryId1}`).emit('message:received', msg1);
                   io.to(`user:${myUid}`).emit('message:received', msg1);
                   
                   const targetHistoryId2 = [matchedUid, bot.id].sort().join('_');
                   const msg2 = {
                       id: uuidv4(),
                       senderId: bot.id, receiverId: matchedUid, chatId: targetHistoryId2,
                       text: `🎉 У вас взаимная симпатия! Начинайте общаться: ` + myUid,
                       type: 'text', createdAt: new Date().toISOString()
                   };
                   pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msg2.id, targetHistoryId2, JSON.stringify(msg2), msg2.createdAt]);
                   io.to(`chat:${targetHistoryId2}`).emit('message:received', msg2);
                   io.to(`user:${matchedUid}`).emit('message:received', msg2);
                   
                   return; // Stop processing further rules for this callback
               }
               if (data.callbackData === '/dv_next') {
                   const { rows: allUsersRows } = await pool.query('SELECT data FROM users WHERE uid != $1', [myUid]);
                   const otherUsers = allUsersRows.map(r => JSON.parse(r.data)).filter(u => u.name && !u.isBot);
                   if (otherUsers.length > 0) {
                       const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
                       const botMsg: any = {
                           id: uuidv4(),
                           senderId: bot.id,
                           receiverId: !isGroup ? myUid : undefined,
                           groupId: isGroup ? data.chatId : undefined,
                           chatId: historyId,
                           text: `Анкета: ${randomUser.name}\n${randomUser.about || 'Нет описания'}`,
                           type: 'text',
                           createdAt: new Date().toISOString(),
                           inlineButtons: [
                               [{ text: '❤️ Лайк', action: 'callback', callbackData: `/dv_like_${randomUser.uid}` },
                                { text: '👎 Дальше', action: 'callback', callbackData: '/dv_next' }]
                           ]
                       };
                       if (randomUser.avatar) botMsg.attachment = { type: 'image', url: randomUser.avatar, name: 'avatar.jpg' };
                       pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                       
                       const room = isGroup ? `chat:${data.chatId}` : `chat:${historyId}`;
                       io.to(room).emit('message:received', botMsg);
                       io.to(`user:${myUid}`).emit('message:received', botMsg);
                   }
                   return;
               }

       const { rows } = await pool.query('SELECT data FROM bots WHERE id = $1', [data.botId]);
       if (!rows[0]) return;
       const botData = JSON.parse(rows[0].data);
       if (!botData.isActive) return;

       let rulesToExecute: any[] = [];
       if (botData.rules && botData.rules.length > 0) {
           for (const rule of botData.rules) {
               const t = rule.trigger;
               let match = false;
               if (!t) match = true;
               else if (t.type === 'command') match = data.callbackData?.toLowerCase().startsWith(t.params?.value?.toLowerCase() || '');
               else if (t.type === 'text') match = data.callbackData?.toLowerCase().includes(t.params?.value?.toLowerCase() || '');
               
               if (match && t.forAdminsOnly && isGroup) {
                   const { rows: rgRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
                   if (rgRows[0]) {
                       const rg = JSON.parse(rgRows[0].data);
                       const isAdmin = ['owner', 'admin'].includes(rg.memberRoles?.[myUid]) || String(myUid) === String(botData.ownerId) || String(myUid) === String(rg.ownerId);
                       if (!isAdmin) match = false;
                   }
               }
               if (match && rule.conditions && rule.conditions.length > 0) {
                   const botVars = (global as any).userBotVariables?.get(`${botData.id}_${myUid}`) || {};
                   for (const cond of rule.conditions) {
                       const k = cond.params?.key;
                       const v = cond.params?.value;
                       if (cond.type === 'variable_equals' && botVars[k] !== v) match = false;
                       if (cond.type === 'variable_not_equals' && botVars[k] === v) match = false;
                       if (cond.type === 'variable_exists' && botVars[k] === undefined) match = false;
                       if (cond.type === 'variable_not_exists' && botVars[k] !== undefined) match = false;
                   }
               }
               if (match) { rulesToExecute.push({ actions: rule.actions }); break; }
                  }
       }

       if (rulesToExecute.length > 0) {
           let uName = 'Пользователь';
           try {
               const { rows: targetU } = await pool.query('SELECT data FROM users WHERE uid = $1', [myUid]);
               if (targetU[0]) uName = JSON.parse(targetU[0].data).name || uName;
           } catch(e) {}

           for (const rule of rulesToExecute) {
               for (const act of rule.actions) {
                   if (act.type === 'set_variable') {
                       const vars = (global as any).userBotVariables.get(`${botData.id}_${myUid}`) || {};
                       if (act.params?.value) {
                           vars[act.params.key] = act.params.value;
                       } else {
                           delete vars[act.params.key]; // unset if empty
                       }
                       (global as any).userBotVariables.set(`${botData.id}_${myUid}`, vars);
                   } else if (act.type === 'send_message') {
                       let outText = act.params?.text || '';
                       outText = outText.replace('{user_name}', uName);

                       const { rows: mRows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.messageId]);
                       if (mRows[0]) {
                           const updatedBotMsg = JSON.parse(mRows[0].data);
                           updatedBotMsg.text = outText;
                           updatedBotMsg.inlineButtons = act.params?.inlineButtons;
                           updatedBotMsg.updatedAt = new Date().toISOString();
                           
                           await pool.query('UPDATE messages SET data = $1 WHERE id = $2', [JSON.stringify(updatedBotMsg), data.messageId]);
                           const room = isGroup ? `chat:${data.chatId}` : `chat:${historyId}`;
                           io.to(room).emit('message:updated', updatedBotMsg);
                           if (updatedBotMsg.receiverId) io.to(`user:${updatedBotMsg.receiverId}`).emit('message:updated', updatedBotMsg);
                       }
                   } else if (act.type === 'wait_feedback') {
                       (global as any).userBotStates.set(`${bot.id}_${myUid}`, { type: 'feedback' });
                       let outText = act.params?.text || '';
                       outText = outText.replace('{user_name}', uName);

                       const botMsg: any = {
                           id: uuidv4(),
                           senderId: bot.id,
                           receiverId: !isGroup ? myUid : undefined,
                           groupId: isGroup ? data.chatId : undefined,
                           chatId: historyId,
                           text: outText,
                           type: 'text',
                           createdAt: new Date().toISOString(),
                           inlineButtons: act.params?.inlineButtons
                       };
                       await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                       const room = isGroup ? `chat:${data.chatId}` : `chat:${historyId}`;
                       io.to(room).emit('message:received', botMsg);
                       if (botMsg.receiverId) io.to(`user:${botMsg.receiverId}`).emit('message:received', botMsg);
                   }
               }
           }
       }
    });


    socket.on('message:new', async (data: { chatId: string, message: any, _uid?: string }) => {
      const myUid = (socket as any).uid || data._uid;
      if (!myUid) return;
      
      const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [data.chatId]);
      const isGroup = !!data.message.groupId || data.chatId === 'global_channel' || gCount > 0;
      
      if (isGroup && data.chatId !== 'global_channel') {
        const { rows: cgRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
        if (cgRows[0]) {
           const cg = JSON.parse(cgRows[0].data);
           if (cg.mutedMembers && cg.mutedMembers[myUid] && Date.now() < cg.mutedMembers[myUid]) {
              return; // Muted user cannot send messages here
           }
        }
      }
      let historyId = data.chatId;
      let room = `chat:${data.chatId}`;

      if (!isGroup && data.chatId !== 'global_channel') {
        const receiverId = data.message.receiverId || data.chatId;
        if (myUid === receiverId) historyId = myUid;
        else historyId = [myUid, receiverId].sort().join('_');
        room = `chat:${historyId}`;
        data.message.receiverId = receiverId;
      }

      if (!isGroup && data.message.receiverId && data.chatId !== 'global_channel') {
        const { rows } = await pool.query('SELECT data FROM messages WHERE "chatId" = $1 ORDER BY "createdAt" DESC LIMIT 100', [historyId]);
        const msgs = rows.map((r: any) => JSON.parse(r.data));
        
        const myMessagesToThem = msgs.filter((m: any) => m.senderId === myUid && m.receiverId === data.message.receiverId);
        const theirMessagesToMe = msgs.filter((m: any) => m.senderId === data.message.receiverId && m.receiverId === myUid);
        
        
         const isBotReceiver = (await pool.query('SELECT id FROM bots WHERE id = $1', [data.message.receiverId])).rowCount > 0;
         if (!isBotReceiver && theirMessagesToMe.length === 0 && myMessagesToThem.length >= 3) {
           return; // Block silent spam on server
         }
  
      }

      const msg = { ...data.message, senderId: myUid, id: data.message.id || uuidv4(), createdAt: data.message.createdAt || new Date().toISOString(), chatId: historyId };
      console.log('New message for chat:', historyId, 'receiverId:', msg.receiverId, 'senderId:', myUid);

      
      try {
        await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msg.id, historyId, JSON.stringify(msg), msg.createdAt]);
        console.log('Message inserted.');

        io.to(room).emit('message:received', msg);
        io.to(`user:${myUid}`).emit('message:received', msg);
        if (msg.receiverId) {
            io.to(`user:${msg.receiverId}`).emit('message:received', msg);
        }
        
                // Execute Bots
        setTimeout(async () => {
          console.log('Executing bots for message:', msg.id);
          try {
            const { rows } = await pool.query('SELECT data FROM bots');
            console.log('Bots count:', rows.length);
            
            // First, process any wait_feedback state
            // If the user is writing to a bot
            let targetBotId = !isGroup ? msg.receiverId : undefined;
            if (targetBotId) {
               const stateKey = `${targetBotId}_${myUid}`;
               if ((global as any).userBotStates.has(stateKey)) {
                  const state = (global as any).userBotStates.get(stateKey);
                  const botInfoRow = rows.find((r: any) => JSON.parse(r.data).id === targetBotId);
                  
                  if (botInfoRow) {
                     const botInfo = JSON.parse(botInfoRow.data);
                     if ((msg.text || '').trim().toLowerCase() === 'отмена') {
                        (global as any).userBotStates.delete(stateKey);
                        const botMsg: any = {
                            id: uuidv4(),
                            senderId: botInfo.id,
                            receiverId: myUid,
                            chatId: historyId,
                            text: 'Действие отменено.',
                            type: 'text',
                            createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString()
                        };
                        await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                        io.to(room).emit('message:received', botMsg);
                        io.to(`user:${myUid}`).emit('message:received', botMsg);
                        return; // Stop execution
                     } else {
                        (global as any).userBotStates.delete(stateKey);
                        
                        // Notify user success
                        const botMsg: any = {
                            id: uuidv4(),
                            senderId: botInfo.id,
                            receiverId: myUid,
                            chatId: historyId,
                            text: 'Ваше сообщение отправлено.',
                            type: 'text',
                            createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString()
                        };
                        await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                        io.to(room).emit('message:received', botMsg);
                        io.to(`user:${myUid}`).emit('message:received', botMsg);
                        
                        // Send forward to owner
                        let targetUid = state.forwardToUid || botInfo.ownerId;
                        if (targetUid) {
                            const rawSearchStr = targetUid.trim();
                            const searchValue = rawSearchStr.startsWith('@') ? rawSearchStr.substring(1).toLowerCase() : rawSearchStr.toLowerCase();
                            
                            const { rows: uRows } = await pool.query(
                                "SELECT uid FROM users WHERE LOWER((data::jsonb)->>'username') = $1 OR uid = $2", 
                                [searchValue, rawSearchStr]
                            );
                            
                            if (uRows[0]) {
                                targetUid = uRows[0].uid;
                            } else {
                                targetUid = rawSearchStr;
                            }
                        }
                        
                        if (targetUid) {
                            const ownerHistoryId = [targetUid, botInfo.id].sort().join('_');
                            const ownerRoom = `chat:${ownerHistoryId}`;
                            const ownerMsg: any = {
                                id: uuidv4(),
                                senderId: botInfo.id,
                                receiverId: targetUid,
                                chatId: ownerHistoryId,
                                text: `📩 Новое сообщение от пользователя (ID: ${myUid}):\n\n${msg.text || ''}`,
                                type: 'text',
                                createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString(),
                                attachment: msg.attachment,
                                forwardedFrom: msg.forwardedFrom,
                                inlineButtons: [[
                                    { text: 'Скопировать текст', action: 'copy', actionData: msg.text }
                                ]]
                            };
                            await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [ownerMsg.id, ownerHistoryId, JSON.stringify(ownerMsg), ownerMsg.createdAt]);
                            
                            // Ensure owner's activeChats includes this bot
                            try {
                              const { rows: oRows } = await pool.query('SELECT data FROM users WHERE uid = $1', [targetUid]);
                              if (oRows[0]) {
                                const oData = JSON.parse(oRows[0].data);
                                if (!oData.activeChats) oData.activeChats = [];
                                if (!oData.activeChats.includes(botInfo.id)) {
                                  oData.activeChats.unshift(botInfo.id);
                                  await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(oData), targetUid]);
                                  io.to(`user:${targetUid}`).emit('auth:synced', oData);
                                }
                              }
                            } catch(e) {}

                            io.to(`chat:${ownerHistoryId}`).emit('message:received', ownerMsg);
                            io.to(`user:${targetUid}`).emit('message:received', ownerMsg);
                        }
                        
                        return; // Stop execution
                     }
                  }
               }
            }
            
            for (const r of rows) {
              const bot = JSON.parse(r.data);
              if (bot.isActive === false) continue;
              
              if (!isGroup && msg.receiverId !== bot.id) continue;
              if (isGroup && data.chatId !== 'global_channel') {
                 const { rows: cgRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
                 if (cgRows[0]) {
                    const cg = JSON.parse(cgRows[0].data);
                    if (!cg.members?.includes(bot.id)) continue;
                 }
              }
              
              if (!isGroup && msg.receiverId === bot.id) {
                 if (!bot.usersList) bot.usersList = [];
                 if (!bot.usersList.some(u => String(u) === String(myUid))) {
                     bot.usersList.push(myUid);
                     await pool.query('UPDATE bots SET data = $1 WHERE id = $2', [JSON.stringify(bot), bot.id]);
                 }
                 
                 if (String(myUid) === String(bot.ownerId)) {
                     const txt = (msg.text || '').trim();
                     if (txt.toLowerCase().startsWith('/рассылка ') || txt.toLowerCase().startsWith('/команда ')) {
                         const broadcastTxt = txt.replace(/^\/(рассылка|команда)\s+/i, '').trim();
                         if (broadcastTxt) {
                             const uList = bot.usersList || [];
                             console.log('Broadcasting to users count:', uList.length);
                             for (const uId of uList) {
                                 console.log('Sending message to user:', uId);
                                 if (String(uId) === String(myUid)) continue;
                                 const targetHistoryId = [uId, bot.id].sort().join('_');
                                 const botMsg: any = {
                                     id: uuidv4(),
                                     senderId: bot.id,
                                     receiverId: uId,
                                     chatId: targetHistoryId,
                                     text: broadcastTxt,
                                     type: 'text',
                                     createdAt: new Date().toISOString()
                                 };
                                 await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, targetHistoryId, JSON.stringify(botMsg), botMsg.createdAt]);
                                 io.to(`chat:${targetHistoryId}`).emit('message:received', botMsg);
                                 io.to(`user:${uId}`).emit('message:received', botMsg);
                             }
                             
                             const replyMsg: any = {
                                  id: uuidv4(),
                                  senderId: bot.id,
                                  receiverId: myUid,
                                  chatId: historyId,
                                  text: `✅ Рассылка успешно отправлена ${Math.max(0, uList.length - 1)} пользователям!`,
                                  type: 'text',
                                  createdAt: new Date().toISOString()
                             };
                             await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [replyMsg.id, historyId, JSON.stringify(replyMsg), replyMsg.createdAt]);
                             io.to(room).emit('message:received', replyMsg);
                             io.to(`user:${myUid}`).emit('message:received', replyMsg);
                             
                             continue;
                         }
                     }
                 }
              }
              
              // Handle rules natively
              let rulesToExecute: any[] = [];
              if (bot.rules && bot.rules.length > 0) {
                  const cleanedText = (msg.text || '').replace(new RegExp(`^@${bot.username}\\s+`, 'i'), '').trim();
                  
                  for (const rule of bot.rules) {
                      const t = rule.trigger;
                      let match = false;
                      if (!t) match = true;
                      else if (t.type === 'command') {
                         const cmdTrigger = (t.params?.value || '').toLowerCase();
                         match = (msg.text || '').toLowerCase().startsWith(cmdTrigger) || 
                                 cleanedText.toLowerCase().startsWith(cmdTrigger);
                      }
                      else if (t.type === 'text') {
                         const textTrigger = (t.params?.value || '').toLowerCase();
                         match = (msg.text || '').toLowerCase().includes(textTrigger);
                      }
                      else if (t.type === 'new_member') match = (msg.type === 'system_join');
                      
                      if (match && t.forAdminsOnly && isGroup) {
                           const { rows: rgRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
                           if (rgRows[0]) {
                              const rg = JSON.parse(rgRows[0].data);
                              const isAdmin = ['owner', 'admin'].includes(rg.memberRoles?.[myUid]) || String(myUid) === String(bot.ownerId) || String(myUid) === String(rg.ownerId);
                              if (!isAdmin) match = false;
                           }
                       }
                       if (match && rule.conditions && rule.conditions.length > 0) {
                           const botVars = (global as any).userBotVariables?.get(`${bot.id}_${myUid}`) || {};
                           for (const cond of rule.conditions) {
                               const k = cond.params?.key;
                               const v = cond.params?.value;
                               if (cond.type === 'variable_equals' && botVars[k] !== v) match = false;
                               if (cond.type === 'variable_not_equals' && botVars[k] === v) match = false;
                               if (cond.type === 'variable_exists' && botVars[k] === undefined) match = false;
                               if (cond.type === 'variable_not_exists' && botVars[k] !== undefined) match = false;
                           }
                       }
                       if (match) { rulesToExecute.push({ actions: rule.actions }); break; }
                  }
              } else {
                  // Legacy fallback
                  const trigger = bot.triggers?.find((t: any) => {
                     if (t.type === 'command') return msg.text?.trim()?.toLowerCase()?.startsWith(t.params?.value?.toLowerCase() || '');
                     if (t.type === 'text') return msg.text?.toLowerCase()?.includes(t.params?.value?.toLowerCase() || '');
                     return false;
                  });
                  if (trigger) rulesToExecute.push({ actions: bot.actions });
              }

              let actionContext: any = {};
              let totalActionsExecuted = 0;
              let uName = 'Пользователь';
              let uUsername = '';
              try {
                  const { rows: targetU } = await pool.query('SELECT data FROM users WHERE uid = $1', [myUid]);
                  if (targetU[0]) {
                      const uData = JSON.parse(targetU[0].data);
                      uName = uData.name || uData.displayName || uName;
                      uUsername = uData.username || '';
                  }
              } catch(e) {}

              // Add global replacements to actionContext
              actionContext['user_name'] = uName;
              actionContext['user_uid'] = myUid;
              actionContext['user_username'] = uUsername ? `@${uUsername}` : '';
              actionContext['message'] = msg.text || '';

              // Get current bot state
              let botVars = (global as any).userBotVariables?.get(`${bot.id}_${myUid}`) || {};
              for (const k of Object.keys(botVars)) {
                  actionContext[`var.${k}`] = botVars[k];
              }

              for (const rule of rulesToExecute) {
                 const acts = rule.actions?.sort((a:any, b:any) => a.order - b.order) || [];
                 for (const act of acts) {
                    totalActionsExecuted++;
                    if (act.type === 'set_variable') {
                       const vars = (global as any).userBotVariables.get(`${bot.id}_${myUid}`) || {};
                       if (act.params?.value) {
                           vars[act.params.key] = act.params.value;
                       } else {
                           delete vars[act.params.key];
                       }
                       (global as any).userBotVariables.set(`${bot.id}_${myUid}`, vars);
                    } else if (act.type === 'send_message') {
                    let outText = act.params?.text || '';
                    for (const k of Object.keys(actionContext)) {
                       outText = outText.replace(new RegExp(`{${k}}`, 'g'), actionContext[k]);
                    }
                    
                    const botMsg: any = {
                      id: uuidv4(),
                      senderId: bot.id, 
                      receiverId: !isGroup ? myUid : undefined,
                      groupId: isGroup ? data.chatId : undefined,
                      chatId: historyId,
                      text: outText,
                      type: 'text',
                      createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString(),
                      inlineButtons: act.params?.inlineButtons
                    };
                    
                    await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                    io.to(room).emit('message:received', botMsg);
                    if (botMsg.receiverId) io.to(`user:${botMsg.receiverId}`).emit('message:received', botMsg);
                   } else if (act.type === 'fetch_random_user') {
                      const { rows: allUsersRows } = await pool.query('SELECT data FROM users WHERE uid != $1', [myUid]);
                      const otherUsers = allUsersRows.map((r: any) => JSON.parse(r.data)).filter((u: any) => (u.name || u.displayName) && !u.isBot);
                      if (otherUsers.length > 0) {
                          const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
                          actionContext['random.id'] = randomUser.uid || '';
                          actionContext['random.name'] = randomUser.name || randomUser.displayName || 'Без имени';
                          actionContext['random.about'] = randomUser.about || 'Нет описания';
                          actionContext['random.username'] = randomUser.username ? `@${randomUser.username}` : '';
                      }
                   } else if (act.type === 'send_message_to_user') {
                      let targetInput = act.params?.target || '';
                      let outText = act.params?.text || '';
                      
                      for (const k of Object.keys(actionContext)) {
                         targetInput = targetInput.replace(new RegExp(`{${k}}`, 'g'), actionContext[k]);
                         outText = outText.replace(new RegExp(`{${k}}`, 'g'), actionContext[k]);
                      }
                      
                      if (targetInput && outText) {
                          let targetUid: string | null = null;
                          const rawSearchStr = targetInput.trim();
                          const searchValue = rawSearchStr.startsWith('@') ? rawSearchStr.substring(1).toLowerCase() : rawSearchStr.toLowerCase();
                          
                          const { rows: uRows } = await pool.query(
                              "SELECT uid FROM users WHERE LOWER((data::jsonb)->>'username') = $1 OR uid = $2", 
                              [searchValue, rawSearchStr]
                          );
                          
                          if (uRows[0]) {
                              targetUid = uRows[0].uid;
                          } else {
                              targetUid = rawSearchStr;
                          }
                          
                          if (targetUid) {
                              const targetHistoryId = [bot.id, targetUid].sort().join('_');
                              const targetMsg = {
                                  id: uuidv4(),
                                  senderId: bot.id,
                                  receiverId: targetUid,
                                  chatId: targetHistoryId,
                                  text: outText,
                                  type: 'text',
                                  createdAt: new Date().toISOString()
                              };
                              await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [targetMsg.id, targetHistoryId, JSON.stringify(targetMsg), targetMsg.createdAt]);
                              
                              // Ensure receiver's activeChats includes this bot
                              try {
                                const { rows: rRows } = await pool.query('SELECT data FROM users WHERE uid = $1', [targetUid]);
                                if (rRows[0]) {
                                  const rData = JSON.parse(rRows[0].data);
                                  if (!rData.activeChats) rData.activeChats = [];
                                  if (!rData.activeChats.includes(bot.id)) {
                                    rData.activeChats.unshift(bot.id);
                                    await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(rData), targetUid]);
                                    io.to(`user:${targetUid}`).emit('auth:synced', rData); // Force update activeChats list
                                  }
                                }
                              } catch(e) {}
    
                              io.to(`chat:${targetHistoryId}`).emit('message:received', targetMsg);
                              io.to(`user:${targetUid}`).emit('message:received', targetMsg);
                          }
                      }
                   } else if (act.type === 'wait_feedback') {
                     let outText = act.params?.text || '';
                     let forwardTo = act.params?.forwardToUid || '';
                     for (const k of Object.keys(actionContext)) {
                        outText = outText.replace(new RegExp(`{${k}}`, 'g'), actionContext[k]);
                        forwardTo = forwardTo.replace(new RegExp(`{${k}}`, 'g'), actionContext[k]);
                     }

                     (global as any).userBotStates.set(`${bot.id}_${myUid}`, { type: 'feedback', forwardToUid: forwardTo });
                     
                     const botMsg: any = {
                        id: uuidv4(),
                        senderId: bot.id,
                        receiverId: !isGroup ? myUid : undefined,
                        groupId: isGroup ? data.chatId : undefined,
                        chatId: historyId,
                        text: outText || 'Ожидаю ввод...',
                        type: 'text',
                        createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString(),
                     };
                     await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                     io.to(room).emit('message:received', botMsg);
                     if (botMsg.receiverId) io.to(`user:${botMsg.receiverId}`).emit('message:received', botMsg);
                     break; // Stop any subsequent actions, we are in wait mode
                  
                  } else if (act.type === 'daivinchik') {
                     // Daivinchik mode trigger
                     const { rows: allUsersRows } = await pool.query('SELECT data FROM users WHERE uid != $1', [myUid]);
                     const otherUsers = allUsersRows.map(r => JSON.parse(r.data)).filter(u => (u.name || u.displayName) && !u.isBot);

                     if (otherUsers.length === 0) {
                         const botMsg: any = {
                             id: uuidv4(),
                             senderId: bot.id,
                             receiverId: !isGroup ? myUid : undefined,
                             groupId: isGroup ? data.chatId : undefined,
                             chatId: historyId,
                             text: 'К сожалению, пока нет других пользователей.',
                             type: 'text',
                             createdAt: new Date().toISOString()
                         };
                         pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                         io.to(room).emit('message:received', botMsg);
                         if (botMsg.receiverId) io.to(`user:${botMsg.receiverId}`).emit('message:received', botMsg);
                     } else {
                         const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
                         const botMsg: any = {
                             id: uuidv4(),
                             senderId: bot.id,
                             receiverId: !isGroup ? myUid : undefined,
                             groupId: isGroup ? data.chatId : undefined,
                             chatId: historyId,
                             text: `Анкета: ${randomUser.name}\n${randomUser.about || 'Нет описания'}`,
                             type: 'text',
                             createdAt: new Date().toISOString(),
                             inlineButtons: [
                                 [{ text: '❤️ Лайк', action: 'callback', callbackData: `/dv_like_${randomUser.uid}` },
                                  { text: '👎 Дальше', action: 'callback', callbackData: '/dv_next' }]
                             ]
                         };
                         if (randomUser.avatar) {
                             botMsg.attachment = {
                                 type: 'image',
                                 url: randomUser.avatar,
                                 name: 'avatar.jpg'
                             };
                         }
                         pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                         io.to(room).emit('message:received', botMsg);
                         if (botMsg.receiverId) io.to(`user:${botMsg.receiverId}`).emit('message:received', botMsg);
                     }
                  } else if (act.type === 'moderate' && String(bot.ownerId) !== String(myUid)) {
       const actionType = act.params?.action || 'delete';
       let targetUid = msg.senderId;
       let targetMsgId = msg.id;

       if (actionType.includes('_reply') && msg.replyToId) {
           const { rows: mr } = await pool.query('SELECT data FROM messages WHERE id = $1', [msg.replyToId]);
           if (mr[0]) {
              const rMsg = JSON.parse(mr[0].data);
              targetUid = rMsg.senderId;
              targetMsgId = rMsg.id;
           }
       }

       if (actionType.includes('delete')) {
          await pool.query('DELETE FROM messages WHERE id = $1', [targetMsgId]);
          io.to(room).emit('message:deleted', targetMsgId);
       } else if (actionType.includes('mute') && isGroup) {
          let duration = 3600000;
          if (msg.text) {
             const mMatch = msg.text.match(/\b(\d+)\s*(м|ч|д|мин|час|дн)\b/i);
             if (mMatch) {
                 const val = parseInt(mMatch[1]);
                 const t = mMatch[2].toLowerCase();
                 if (t.startsWith('м')) duration = val * 60000;
                 if (t.startsWith('ч')) duration = val * 3600000;
                 if (t.startsWith('д')) duration = val * 86400000;
             }
          }

          const { rows: gRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
          if (gRows[0]) {
             const g = JSON.parse(gRows[0].data);
             g.mutedMembers = g.mutedMembers || {};
             if (actionType.includes('unmute')) {
                delete g.mutedMembers[targetUid];
             } else {
                g.mutedMembers[targetUid] = Date.now() + duration; // mute
             }
             await pool.query('UPDATE groups SET data = $1 WHERE id = $2', [JSON.stringify(g), data.chatId]);
             io.emit('group:updated', g);
          }
       } else if (actionType.includes('warn') && isGroup) {
          const warnMsg = {
             id: uuidv4(),
             senderId: bot.id,
             groupId: data.chatId,
             chatId: historyId,
             text: '⚠️ Пользователь получил предупреждение за нарушение правил.',
             type: 'text',
             createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString(),
          };
          await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [warnMsg.id, historyId, JSON.stringify(warnMsg), warnMsg.createdAt]);
          io.to(room).emit('message:received', warnMsg);
       } else if (actionType.includes('ban') && isGroup) {
          const { rows: gRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
          if (gRows[0]) {
             const g = JSON.parse(gRows[0].data);
             if (actionType.includes('unban')) {
                g.bannedMembers = (g.bannedMembers || []).filter((uid: string) => uid !== targetUid);
             } else {
                g.members = (g.members || []).filter((uid: string) => uid !== targetUid);
                g.bannedMembers = g.bannedMembers || [];
                if (!g.bannedMembers.includes(targetUid)) g.bannedMembers.push(targetUid);
             }
             await pool.query('UPDATE groups SET data = $1 WHERE id = $2', [JSON.stringify(g), data.chatId]);
             io.emit('group:updated', g);
          }
       }
    }
                }
              }
              
              if (totalActionsExecuted === 0 && !isGroup && msg.receiverId === bot.id) {
                 const botMsg: any = {
                    id: uuidv4(),
                    senderId: bot.id,
                    receiverId: myUid,
                    chatId: historyId,
                    text: `👋 Привет! Я бот "${bot.name}"\n\n${bot.description || 'Используйте настроенные команды или слова-триггеры для взаимодействия со мной.'}`,
                    type: 'text',
                    createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString()
                 };
                 await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                 io.to(room).emit('message:received', botMsg);
                 io.to(`user:${myUid}`).emit('message:received', botMsg);
              }
            }
          } catch(e) {
            console.error(e);
          }
        }, 100);

        if (!isGroup && data.chatId !== 'global_channel') {
          if (msg.receiverId && msg.receiverId !== msg.senderId) {
            io.to(`user:${msg.receiverId}`).emit('message:received', msg);
            
            // Add sender to receiver's active chats
            const { rows: rRows } = await pool.query('SELECT data FROM users WHERE uid = $1', [msg.receiverId]);
            if (rRows[0]) {
              let rData = JSON.parse(rRows[0].data);
              rData.activeChats = rData.activeChats || [];
              let newActive = rData.activeChats.filter((id: string) => id !== msg.senderId);
              newActive = [msg.senderId, ...newActive];
              rData.activeChats = newActive;
              await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(rData), msg.receiverId]);
              io.emit('user:updated', rData);
            }
          }
          
          io.to(`user:${msg.senderId}`).emit('message:received', msg);
          
          // Add receiver to sender's active chats
          const { rows: sRows } = await pool.query('SELECT data FROM users WHERE uid = $1', [msg.senderId]);
          if (sRows[0]) {
            let sData = JSON.parse(sRows[0].data);
            sData.activeChats = sData.activeChats || [];
            const rId = msg.receiverId || data.chatId;
            let newActive = sData.activeChats.filter((id: string) => id !== rId);
            newActive = [rId, ...newActive];
            sData.activeChats = newActive;
            await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(sData), msg.senderId]);
            io.emit('user:updated', sData);
          }
        }
      } catch (err) {
        console.error('Failed to process new message:', err);
      }
    });

    socket.on('message:update', async (data: { id: string, chatId: string, update: any }) => {
      const { rows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.id]);
      const row = rows[0];
      if (row) {
        const existing = JSON.parse(row.data);
        const updated = { ...existing, ...data.update, updatedAt: new Date().toISOString() };
        await pool.query('UPDATE messages SET data = $1 WHERE id = $2', [JSON.stringify(updated), data.id]);
        
        let room = `chat:${data.chatId}`;
        if (!updated.groupId && data.chatId !== 'global_channel' && updated.receiverId) {
          let historyId;
          if (updated.senderId === updated.receiverId) historyId = updated.senderId;
          else historyId = [updated.senderId, updated.receiverId].sort().join('_');
          room = `chat:${historyId}`;
        }

        io.to(room).emit('message:received', updated);
        if (updated.receiverId && updated.receiverId !== updated.senderId) {
          io.to(`user:${updated.receiverId}`).emit('message:received', updated);
        }
        if (updated.senderId) {
           io.to(`user:${updated.senderId}`).emit('message:received', updated);
        }

        // Trigger Ephemeral message deletion check
        await checkAndDeleteMessage(data.id, updated, data.chatId);
      }
    });

    socket.on('message:delivered', async (data: { id: string, chatId: string, deviceId: string }) => {
      try {
        const { rows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.id]);
        const row = rows[0];
        if (row) {
          const msg = JSON.parse(row.data);
          msg.deliveredDevices = msg.deliveredDevices || {};
          msg.deliveredDevices[data.deviceId] = true;
          msg.status = 'delivered';

          await pool.query('UPDATE messages SET data = $1 WHERE id = $2', [JSON.stringify(msg), data.id]);

          let room = `chat:${data.chatId}`;
          if (!msg.groupId && data.chatId !== 'global_channel' && msg.receiverId) {
            let historyId;
            if (msg.senderId === msg.receiverId) historyId = msg.senderId;
            else historyId = [msg.senderId, msg.receiverId].sort().join('_');
            room = `chat:${historyId}`;
          }

          io.to(room).emit('message:received', msg);
          if (msg.receiverId && msg.receiverId !== msg.senderId) {
            io.to(`user:${msg.receiverId}`).emit('message:received', msg);
          }
          if (msg.senderId) {
             io.to(`user:${msg.senderId}`).emit('message:received', msg);
          }

          // Trigger Ephemeral message deletion check
          await checkAndDeleteMessage(data.id, msg, data.chatId);
        }
      } catch (err) {
        console.error('Error in message:delivered:', err);
      }
    });

    socket.on('device:delete', async (data: { deviceId: string, uid: string }) => {
      try {
        const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [data.uid]);
        const row = rows[0];
        if (row) {
          const userProfile = JSON.parse(row.data);
          userProfile.devices = (userProfile.devices || []).filter((d: any) => d.id !== data.deviceId);
          await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(userProfile), data.uid]);
          
          io.to(`user:${data.uid}`).emit('device:terminated', { deviceId: data.deviceId });
          socket.emit('auth:synced', userProfile);
          io.emit('user:updated', userProfile);
        }
      } catch (err) {
        console.error('Error in device:delete:', err);
      }
    });

    socket.on('device:terminate_all_others', async (data: { currentDeviceId: string, uid: string }) => {
      try {
        const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [data.uid]);
        const row = rows[0];
        if (row) {
          const userProfile = JSON.parse(row.data);
          const otherDevices = (userProfile.devices || []).filter((d: any) => d.id !== data.currentDeviceId);
          userProfile.devices = (userProfile.devices || []).filter((d: any) => d.id === data.currentDeviceId);
          await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(userProfile), data.uid]);
          
          otherDevices.forEach((d: any) => {
            io.to(`user:${data.uid}`).emit('device:terminated', { deviceId: d.id });
          });

          socket.emit('auth:synced', userProfile);
          io.emit('user:updated', userProfile);
        }
      } catch (err) {
        console.error('Error in device:terminate_all_others:', err);
      }
    });

    socket.on('message:delete', async (data: { id: string, chatId: string }) => {
      const { rows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.id]);
      const row = rows[0];
      let msg: any = null;
      if (row) msg = JSON.parse(row.data);

      await pool.query('DELETE FROM messages WHERE id = $1', [data.id]);
      
      let room = `chat:${data.chatId}`;
      if (msg && !msg.groupId && data.chatId !== 'global_channel' && msg.receiverId) {
        let historyId;
        if (msg.senderId === msg.receiverId) historyId = msg.senderId;
        else historyId = [msg.senderId, msg.receiverId].sort().join('_');
        room = `chat:${historyId}`;
      }

      io.to(room).emit('message:deleted', data.id);
      if (msg && msg.receiverId) io.to(`user:${msg.receiverId}`).emit('message:deleted', data.id);
      if (msg && msg.senderId) io.to(`user:${msg.senderId}`).emit('message:deleted', data.id);
    });

    socket.on('chat:delete_everyone', async (data: { user1: string, user2: string }) => {
      try {
        const historyId = data.user1 === data.user2 ? data.user1 : [data.user1, data.user2].sort().join('_');
        await pool.query('DELETE FROM messages WHERE "chatId" = $1 OR ("chatId" = $2 AND "groupId" IS NULL)', [historyId, data.user1]);
        await pool.query('DELETE FROM messages WHERE ("senderId" = $1 AND "receiverId" = $2) OR ("senderId" = $2 AND "receiverId" = $1)', [data.user1, data.user2]);
        
        for (const [u1, u2] of [[data.user1, data.user2], [data.user2, data.user1]]) {
           const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [u1]);
           if (rows[0]) {
             let uData = JSON.parse(rows[0].data);
             uData.activeChats = (uData.activeChats || []).filter((id: any) => id !== u2);
             await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(uData), u1]);
             io.to(`user:${u1}`).emit('auth:synced', uData);
             io.emit('user:updated', uData);
           }
        }

        io.to(`user:${data.user1}`).emit('chat:deleted_everyone', data.user2);
        io.to(`user:${data.user2}`).emit('chat:deleted_everyone', data.user1);
        io.emit('chat:purged', { user1: data.user1, user2: data.user2 });
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('group:delete', async (data: { id: string }) => {
      try {
        await pool.query('DELETE FROM messages WHERE "chatId" = $1', [data.id]);
        await pool.query('DELETE FROM groups WHERE id = $1', [data.id]);
        io.emit('group:deleted', data.id);
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('message:schedule', async (data: { chatId: string, message: any, sendAt: string }) => {
      try {
        if (!data || !data.message) return;
        if (!data.message.id) data.message.id = uuidv4();
        await pool.query('INSERT INTO scheduled_messages (id, "chatId", data, "sendAt") VALUES ($1, $2, $3, $4)', [data.message.id, data.chatId, JSON.stringify(data.message), data.sendAt]);
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('message:transcribe', async (data: { id: string, chatId: string, fileUrl: string }) => {
      try {
        const parts = data.fileUrl.split(',');
        if (parts.length < 2) return;
        const mimePattern = /data:(.+);base64/;
        const match = data.fileUrl.match(mimePattern);
        const mimeType = match ? match[1] : 'audio/webm';
        
        const ai = getAiClient();
        if (!ai) {
          console.warn('[Transcribe] Gemini API key not available.');
          return;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: parts[1] } },
              { text: 'Please transcribe this Russian audio exactly as it is spoken. Do not add any extra text or commentary.' }
            ]
          }]
        });
        
        const transcription = response.text || '(Не удалось распознать)';
        const { rows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.id]);
        const row = rows[0];
        if (row) {
          const existing = JSON.parse(row.data);
          const updated = { ...existing, text: transcription };
          await pool.query('UPDATE messages SET data = $1 WHERE id = $2', [JSON.stringify(updated), data.id]);
          
          let room = `chat:${data.chatId}`;
          if (!updated.groupId && data.chatId !== 'global_channel' && updated.receiverId) {
             let historyId;
             if (updated.senderId === updated.receiverId) historyId = updated.senderId;
             else historyId = [updated.senderId, updated.receiverId].sort().join('_');
             room = `chat:${historyId}`;
          }
          io.to(room).emit('message:received', updated);
        }
      } catch (e) {
        console.error("Transcription error: ", e);
      }
    });

    socket.on('message:reaction', async (data: { id: string, chatId: string, reactions: any }) => {
      const { rows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.id]);
      const row = rows[0];
      if (row) {
        const existing = JSON.parse(row.data);
        const updated = { ...existing, reactions: data.reactions };
        await pool.query('UPDATE messages SET data = $1 WHERE id = $2', [JSON.stringify(updated), data.id]);
        
        let room = `chat:${data.chatId}`;
        if (!updated.groupId && data.chatId !== 'global_channel' && updated.receiverId) {
          let historyId;
          if (updated.senderId === updated.receiverId) historyId = updated.senderId;
          else historyId = [updated.senderId, updated.receiverId].sort().join('_');
          room = `chat:${historyId}`;
        }

        io.to(room).emit('message:received', updated);
        if (updated.receiverId) io.to(`user:${updated.receiverId}`).emit('message:received', updated);
        if (updated.senderId) io.to(`user:${updated.senderId}`).emit('message:received', updated);
      }
    });

    socket.on('profile:update', async (data: { uid: string, profile: any }) => {
      try {
        const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [data.uid]);
        const row = rows[0];
        
        let finalProfile = data.profile;
        if (row) {
          const existing = JSON.parse(row.data);
          finalProfile = { ...existing, ...data.profile, uid: data.uid };
        }
        
        await pool.query('INSERT INTO users (uid, data) VALUES ($1, $2) ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data', [data.uid, JSON.stringify(finalProfile)]);
        
        io.emit('user:updated', finalProfile);
        socket.emit('auth:synced', finalProfile);
      } catch (err) {
        console.error('Failed to update profile:', err);
      }
    });

    socket.on('group:update', async (data: { id: string, update: any }) => {
      const { rows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.id]);
      const row = rows[0];
      if (row) {
        const existing = JSON.parse(row.data);
        const updated = { ...existing, ...data.update };
        await pool.query('UPDATE groups SET data = $1 WHERE id = $2', [JSON.stringify(updated), data.id]);
        io.emit('group:updated', updated);
      }
    });

    socket.on('group:create', async (group: any) => {
      try {
        const id = group.id || uuidv4();
        group.id = id;
        await pool.query('INSERT INTO groups (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [id, JSON.stringify(group)]);
        io.emit('group:created', group);
      } catch (err) {
        console.error('group:create error', err);
      }
    });

    socket.on('stickers:list', async () => {
      const { rows } = await pool.query('SELECT data FROM sticker_packs');
      const packs = rows.map((row: any) => JSON.parse(row.data));
      socket.emit('stickers:list', packs);
    });

    socket.on('sticker:pack:create', async (pack: any) => {
      try {
        const newPack = { ...pack, id: pack.id || uuidv4(), createdAt: pack.createdAt || new Date().toISOString() };
        await pool.query('INSERT INTO sticker_packs (id, data) VALUES ($1, $2)', [newPack.id, JSON.stringify(newPack)]);
        io.emit('sticker:pack:created', newPack);
      } catch (err) {
        console.error('ERROR creating sticker pack:', err);
      }
    });

    socket.on('sticker:pack:update', async (pack: any) => {
      try {
        const updatedPack = { ...pack };
        await pool.query('UPDATE sticker_packs SET data = $1 WHERE id = $2', [JSON.stringify(updatedPack), updatedPack.id]);
        io.emit('sticker:pack:updated', updatedPack);
      } catch (err) {
        console.error('ERROR updating sticker pack:', err);
      }
    });

    socket.on('sticker:pack:delete', async (id: string) => {
      await pool.query('DELETE FROM sticker_packs WHERE id = $1', [id]);
      io.emit('sticker:pack:deleted', id);
    });

    socket.on('stickers:pack:get', async (id: string) => {
      try {
        const { rows } = await pool.query('SELECT data FROM sticker_packs WHERE id = $1', [id]);
        if (rows.length > 0) {
          socket.emit('sticker:pack:data', JSON.parse(rows[0].data));
        } else {
          socket.emit('sticker:pack:data', null);
        }
      } catch (e) {
        socket.emit('sticker:pack:data', null);
      }
    });

    socket.on('bots:list', async (uid: string) => {
      try {
        const { rows } = await pool.query('SELECT data FROM bots WHERE owner_id = $1', [uid]);
        socket.emit('bots:list', rows.map(r => JSON.parse(r.data)));
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('bot:save', async (payload: { uid: string, bot: any }, callback) => {
      try {
        const { uid, bot } = payload;
        if (!bot.username || bot.username.trim() === '') {
           if (typeof callback === 'function') callback({ error: 'Юзернейм обязателен' });
           return;
        }
        bot.username = bot.username.trim().toLowerCase().replace('@', '');
        
        const { rows: uRows } = await pool.query('SELECT data FROM users');
        const usernameTakenUser = uRows.find(r => {
           let u = JSON.parse(r.data);
           return u.username?.toLowerCase() === bot.username && u.uid !== bot.id;
        });
        const { rows: bRows } = await pool.query('SELECT data FROM bots');
        const usernameTakenBot = bRows.find(r => {
           let b = JSON.parse(r.data);
           return b.username?.toLowerCase() === bot.username && b.id !== bot.id;
        });

        if (usernameTakenUser || usernameTakenBot) {
           if (typeof callback === 'function') callback({ error: 'Этот юзернейм уже занят.' });
           return;
        }

        bot.ownerId = uid;
        await pool.query('INSERT INTO bots (id, owner_id, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [bot.id, uid, JSON.stringify(bot)]);
        if (typeof callback === 'function') callback({ success: true });
        
        // Broadcast new bot logic
        const { rows: newURows } = await pool.query('SELECT data FROM users');
        const { rows: newBRows } = await pool.query('SELECT data FROM bots');
        const botsAsUsers = newBRows.map((r: any) => {
           const b = JSON.parse(r.data);
           if (b.isActive === false) return null;
           return getBotAsUser(b);
        }).filter(Boolean);
        io.emit('users:list', [...newURows.map((r: any) => JSON.parse(r.data)), ...botsAsUsers]);
        
        // Also emit specific user updated for the bot to refresh its UI profile if open
        io.emit('user:updated', getBotAsUser(bot));

      } catch (e) {
        console.error(e);
        if (typeof callback === 'function') callback({ error: 'Ошибка сервера' });
      }
    });

    socket.on('bot:delete', async (payload: { uid: string, botId: string }) => {
      try {
        await pool.query('DELETE FROM bots WHERE id = $1 AND owner_id = $2', [payload.botId, payload.uid]);
        const { rows: newURows } = await pool.query('SELECT data FROM users');
        const { rows: newBRows } = await pool.query('SELECT data FROM bots');
        const botsAsUsers = newBRows.map((r: any) => {
           const b = JSON.parse(r.data);
           if (b.isActive === false) return null;
           return getBotAsUser(b);
        }).filter(Boolean);
        io.emit('users:list', [...newURows.map((r: any) => JSON.parse(r.data)), ...botsAsUsers]);
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('message:typing', (data: { chatId: string, uid: string, isTyping: boolean }) => {
      socket.to(`chat:${data.chatId}`).emit('message:typing:status', data);
    });

    socket.on('users:fetch', async () => {
      const { rows } = await pool.query('SELECT data FROM users');
      const users = rows.map((r: any) => JSON.parse(r.data));
      const { rows: bRows } = await pool.query('SELECT data FROM bots');
      const botsAsUsers = bRows.map((r: any) => {
         const b = JSON.parse(r.data);
         if (b.isActive === false) return null;
         return getBotAsUser(b);
      }).filter(Boolean);
      socket.emit('users:list', [...users, ...botsAsUsers]);
    });

    socket.on('groups:fetch', async () => {
      const { rows } = await pool.query('SELECT data FROM groups');
      const groups = rows.map((r: any) => JSON.parse(r.data));
      socket.emit('groups:list', groups);
    });

    socket.on('user:delete_all_data', async (uid: string) => {
      await pool.query('DELETE FROM messages WHERE data LIKE $1 OR data LIKE $2', [`%${uid}%`, `%${uid}%`]);
      await pool.query('DELETE FROM groups WHERE data LIKE $1', [`%${uid}%`]);
      await pool.query('DELETE FROM users WHERE uid = $1', [uid]);
      io.emit('user:deleted_completely', uid);
    });

    // Tier 1: Real WebRTC P2P Signaling Relay
    socket.on('p2p:signal', (data: { type: string; callerUid: string; targetUid: string; offer?: any; answer?: any; candidate?: any }) => {
      if (data && data.targetUid) {
        io.to(`user:${data.targetUid}`).emit('p2p:signal', data);
      }
    });

    // Tier 2: Anti-DPI Obfuscated Socket Relay
    socket.on('obfuscated:packet', async (envelope: any) => {
      try {
        const unmasked = unmaskAntiDPIPayload(envelope);
        if (!unmasked || !unmasked.chatId || !unmasked.message) return;

        const { chatId, message } = unmasked;
        const myUid = (socket as any).uid || message.senderId;
        if (!myUid) return;

        const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [chatId]);
        const isGroup = !!message.groupId || chatId === 'global_channel' || gCount > 0;
        let historyId = chatId;
        let room = `chat:${chatId}`;

        if (!isGroup && chatId !== 'global_channel') {
          const receiverId = message.receiverId || chatId;
          if (myUid === receiverId) historyId = myUid;
          else historyId = [myUid, receiverId].sort().join('_');
          room = `chat:${historyId}`;
          message.receiverId = receiverId;
        }

        const query = 'INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET data = $3';
        await pool.query(query, [message.id, historyId, JSON.stringify(message), message.createdAt || new Date().toISOString()]);

        io.to(room).emit('message:received', message);
        if (message.receiverId && !isGroup) {
          io.to(`user:${message.receiverId}`).emit('message:received', message);
        }
      } catch (e) {
        console.error('[Anti-DPI Socket] Error:', e);
      }
    });

    socket.on('disconnect', async () => {
      let disconnectedUid: string | null = null;
      for (const [uid, info] of onlineUsers.entries()) {
        if (info.socketId === socket.id) {
          disconnectedUid = uid;
          break;
        }
      }

      if (disconnectedUid) {
        onlineUsers.delete(disconnectedUid);
        io.emit('presence:update', Array.from(onlineUsers.entries()).map(([uid, info]) => ({
          uid,
          status: info.status,
          customStatus: info.customStatus
        })));
        try {
          const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [disconnectedUid]);
          if (rows[0]) {
             const u = JSON.parse(rows[0].data);
             u.lastSeen = new Date().toISOString();
             await pool.query('UPDATE users SET data = $1 WHERE uid = $2', [JSON.stringify(u), disconnectedUid]);
             io.emit('user:updated', u);
          }
        } catch(e) {}
      }
      console.log('User disconnected:', socket.id);
    });
  });

  // OAuth Simulator UI

  // OAuth Polling Store
  const oauthSessions = new Map<string, any>();

  // AI Bot Generation Endpoint
  app.post('/api/bot-ai', async (req, res) => {
    try {
      const { prompt, currentBot } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const ai = getAiClient();
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Вы — эксперт по проектированию чат-ботов. Создайте конфигурацию бота на основе промпта пользователя.
Промпт: "${prompt}"
${currentBot ? `Текущий бот: ${JSON.stringify(currentBot)}` : ''}

Ответьте СТРОГО в формате JSON без кавычек markdown:
{
  "id": "${currentBot?.id || 'bot_' + Date.now()}",
  "name": "Имя бота",
  "username": "bot_username",
  "avatar": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150",
  "description": "Краткое описание назначения бота",
  "greeting": "Приветственное сообщение при /start",
  "rules": [
    {
      "id": "1",
      "triggerType": "command",
      "triggerValue": "/start",
      "actionType": "text",
      "response": "Приветственный текст",
      "buttons": [{"text": "Кнопка 1", "action": "text", "payload": "Информация"}]
    }
  ],
  "isActive": true
}`
          });

          const rawText = response.text || '';
          const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsedBot = JSON.parse(cleanedText);
          return res.json({ success: true, bot: parsedBot });
        } catch (genAiError) {
          console.warn('[Gemini AI] Call failed or quota exceeded, using smart rule generator:', genAiError);
        }
      }

      // Fallback smart rule generator
      const p = prompt.toLowerCase();
      const rules: any[] = currentBot?.rules ? [...currentBot.rules] : [];

      rules.push({
        id: Date.now().toString() + '1',
        triggerType: 'command',
        triggerValue: '/start',
        actionType: 'text',
        response: `Здравствуйте! Я ваш авто-помощник "${prompt.slice(0, 20)}". Чем могу помочь?`,
        buttons: [{ text: 'ℹ️ Помощь', action: 'text', payload: 'Помощь' }, { text: '📞 Контакты', action: 'text', payload: 'Контакты' }]
      });

      if (p.includes('цена') || p.includes('купить') || p.includes('заказ') || p.includes('магазин') || p.includes('прайс')) {
        rules.push({
          id: Date.now().toString() + '2',
          triggerType: 'keyword',
          triggerValue: 'цена, стоимость, купить, прайс',
          actionType: 'text',
          response: 'Актуальный прайс-лист и информация о заказах доступны по запросу.',
          buttons: [{ text: '📦 Каталог', action: 'text', payload: 'Каталог' }]
        });
      }

      const generatedBot = {
        id: currentBot?.id || 'bot_' + Date.now(),
        name: currentBot?.name || (prompt.slice(0, 18) + ' Бот'),
        username: currentBot?.username || ('bot_' + Math.floor(Math.random() * 10000)),
        avatar: currentBot?.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
        description: currentBot?.description || `Бот: ${prompt}`,
        greeting: `Здравствуйте! На связи ваш бот-помощник.`,
        rules,
        isActive: true,
        createdAt: currentBot?.createdAt || new Date().toISOString()
      };

      return res.json({ success: true, bot: generatedBot });
    } catch (e: any) {
      console.error('/api/bot-ai error:', e);
      return res.status(500).json({ error: 'Failed to generate bot configuration' });
    }
  });

  app.get('/api/auth/status/:nonce', (req, res) => {
    const nonce = req.params.nonce;
    if (oauthSessions.has(nonce)) {
      const user = oauthSessions.get(nonce);
      oauthSessions.delete(nonce);
      res.json({ success: true, user });
    } else {
      res.json({ success: false });
    }
  });

  // OAuth Redirect Entry Point
  app.get('/api/auth/:provider', (req, res) => {
    const provider = req.params.provider;
    const nonce = (req.query.nonce as string) || '';
    if (provider !== 'yandex' && provider !== 'vk' && provider !== 'mailru') {
      return res.status(404).send('Not Found');
    }
    const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    if (!clientId) {
      return res.redirect(`${appUrl}/api/auth/simulator/${provider}?nonce=${encodeURIComponent(nonce)}`);
    }
    
    let redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/callback/${provider}`;
    let authUrl = '';
    if (provider === 'yandex') {
      authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(nonce)}`;
    } else if (provider === 'vk') {
      authUrl = `https://oauth.vk.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&display=popup&scope=email&response_type=code&state=${encodeURIComponent(nonce)}`;
    } else if (provider === 'mailru') {
      authUrl = `https://oauth.mail.ru/login?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=userinfo&state=${encodeURIComponent(nonce)}`;
    }
    res.redirect(authUrl);
  });

  // OAuth Callback Handler
  app.all('/api/auth/callback/:provider', async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'yandex' && provider !== 'vk' && provider !== 'mailru') {
      return res.status(404).send('Not Found');
    }
    let email = '';
    let name = '';
    let uid = '';
    let photoURL = '';

    if (req.method === 'POST') {
      email = req.body.email || `simulated_${provider}@user.com`;
      name = req.body.name || `Simulated ${provider.toUpperCase()}`;
      uid = `${provider}_sim_${Math.random().toString(36).substr(2, 9)}`;
      photoURL = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}`;
    } else {
      const code = req.query.code;
      const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
      const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
      let redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/callback/${provider}`;

      try {
        if (provider === 'yandex') {
          const tokenRes = await fetch('https://oauth.yandex.ru/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=authorization_code&code=${code}&client_id=${clientId}&client_secret=${clientSecret}`
          });
          const tokenData: any = await tokenRes.json();
          
          const userRes = await fetch('https://login.yandex.ru/info?format=json', {
            headers: { 'Authorization': `OAuth ${tokenData.access_token}` }
          });
          const userData: any = await userRes.json();
          email = userData.default_email || userData.emails?.[0] || `${userData.id}@yandex.ru`;
          name = userData.real_name || userData.first_name || userData.login;
          uid = `yandex_${userData.id}`;
          photoURL = userData.is_avatar_empty ? '' : `https://avatars.yandex.net/get-yapic/${userData.default_avatar_id}/islands-200`;
        } else if (provider === 'vk') {
          const tokenRes = await fetch(`https://oauth.vk.com/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`);
          const tokenData: any = await tokenRes.json();
          email = tokenData.email || `vk_${tokenData.user_id}@vk.com`;
          
          const userRes = await fetch(`https://api.vk.com/method/users.get?user_ids=${tokenData.user_id}&fields=photo_200&access_token=${tokenData.access_token}&v=5.131`);
          const userData: any = await userRes.json();
          const u = userData.response?.[0];
          name = u ? `${u.first_name} ${u.last_name}` : `VK User ${tokenData.user_id}`;
          uid = `vk_${tokenData.user_id}`;
          photoURL = u?.photo_200 || '';
        } else if (provider === 'mailru') {
          const tokenRes = await fetch('https://oauth.mail.ru/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=authorization_code&code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}`
          });
          const tokenData: any = await tokenRes.json();
          
          const userRes = await fetch(`https://oauth.mail.ru/userinfo?access_token=${tokenData.access_token}`);
          const userData: any = await userRes.json();
          email = userData.email || `${userData.id}@mail.ru`;
          name = userData.name || `${userData.first_name} ${userData.last_name}`;
          uid = `mailru_${userData.id}`;
          photoURL = userData.image || '';
        }
      } catch (err) {
        console.error(`OAuth callback error for ${provider}:`, err);
        return res.send(`
          <html>
            <body>
              <h3>Ошибка входа через ${provider}</h3>
              <p>${String(err)}</p>
              <button onclick="window.close()">Закрыть</button>
            </body>
          </html>
        `);
      }
    }

    const state = req.method === 'POST' ? req.body.nonce : req.query.state as string;
    const userPayload = {
      uid,
      displayName: name,
      email,
      photoURL,
      providerId: provider
    };

    if (state) {
      oauthSessions.set(state, userPayload);
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Успешная авторизация</title>
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; }
          .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 320px; }
          .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 16px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <h3>Авторизация успешна!</h3>
          <p>Синхронизируем профиль, пожалуйста подождите...<br><br>Вы можете закрыть это окно.</p>
          <div class="spinner"></div>
        </div>
        <script>
          const payload = {
            type: 'auth_success',
            user: ${JSON.stringify(userPayload)}
          };
          
          if (window.opener) {
            window.opener.postMessage(payload, '*');
          } else {
            localStorage.setItem('ordina_oauth_pending', JSON.stringify(payload.user));
          }
          
          setTimeout(() => {
            window.close();
          }, 1000);
        </script>
      </body>
      </html>
    `);
  });

  // Catch-all for undefined API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
