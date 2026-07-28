import fs from 'fs';

const content = `import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:zqW9elT7ZPVWk0jk@db.pykhcxdanexuhjtkuxdq.supabase.co:5432/postgres'
});

async function initDb() {
  try {
    await pool.query(\`
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
    \`);
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }
}

import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
      photoURL: 'https://img.freepik.com/free-vector/bird-colorful-logo-gradient-vector_343694-1365.jpg',
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
      if (!current.photoURL || current.photoURL.includes('unsplash') || !current.description) {
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
  await seedGlobalChannel();

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 5e7,
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      const { rows: messages } = await pool.query('SELECT * FROM scheduled_messages WHERE "sendAt" <= $1', [now]);
      for (const rawMsg of messages) {
        const msgData = JSON.parse(rawMsg.data);
        msgData.createdAt = now;
        await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msgData.id, rawMsg.chatId, JSON.stringify(msgData), now]);
        
        const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [rawMsg.chatId]);
        const isGroup = !!msgData.groupId || rawMsg.chatId === 'global_channel' || gCount > 0;
        let room = \`chat:\${rawMsg.chatId}\`;
        if (!isGroup && msgData.receiverId) {
          let historyId;
          if (msgData.senderId === msgData.receiverId) {
            historyId = msgData.senderId;
          } else {
            historyId = [msgData.senderId, msgData.receiverId].sort().join('_');
          }
          room = \`chat:\${historyId}\`;
        }
        
        io.to(room).emit('message:received', msgData);
        await pool.query('DELETE FROM scheduled_messages WHERE id = $1', [rawMsg.id]);
      }
    } catch(e) {
      console.error("Scheduled check error", e);
    }
  }, 60000);

  const PORT = 3000;
  const onlineUsers = new Map<string, { socketId: string, status: string, customStatus?: string }>();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('auth:sync', async (userData: any) => {
      const uid = userData.uid;
      (socket as any).uid = uid;
      
      const { rows } = await pool.query('SELECT data FROM users WHERE uid = $1', [uid]);
      const row = rows[0];
      
      let finalData = userData;
      const isNewUser = !row;
      
      if (row) {
        const serverData = JSON.parse(row.data);
        finalData = {
          ...userData,
          ...serverData,
          uid: uid,
          email: serverData.email || userData.email
        };
      } else {
        if (!finalData.username) {
          finalData.username = userData.displayName?.toLowerCase().replace(/\\s+/g, '_') || \`user_\${uid.slice(0, 5)}\`;
        }
        await pool.query('INSERT INTO users (uid, data) VALUES ($1, $2)', [uid, JSON.stringify(finalData)]);
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
      
      const { rows: allGroups } = await pool.query('SELECT id, data FROM groups');
      const userGroups = allGroups.filter((g: any) => {
        try {
          const gData = JSON.parse(g.data);
          return gData.members && gData.members.includes(uid);
        } catch (e) { return false; }
      });
      userGroups.forEach((g: any) => {
        socket.join(\`chat:\${g.id}\`);
      });
      
      onlineUsers.set(uid, { socketId: socket.id, status: finalData.status || 'offline', customStatus: finalData.customStatus });
      socket.join(\`user:\${uid}\`);
      
      socket.emit('auth:synced', finalData);
      
      const { rows: allUsers } = await pool.query('SELECT data FROM users');
      socket.emit('users:list', allUsers.map((u: any) => JSON.parse(u.data)));
      
      socket.emit('groups:list', allGroups.map((g: any) => JSON.parse(g.data)));
      
      if (isNewUser) {
        io.emit('user:updated', finalData);
      }

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
    });

    socket.on('user:online', (data: { uid: string, status: string, customStatus?: string }) => {
      (socket as any).uid = data.uid;
      const info = onlineUsers.get(data.uid);
      if (info) {
        onlineUsers.set(data.uid, { ...info, status: data.status, customStatus: data.customStatus });
      } else {
        onlineUsers.set(data.uid, { socketId: socket.id, status: data.status, customStatus: data.customStatus });
      }
      socket.join(\`user:\${data.uid}\`);
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
      
      let room = \`chat:\${chatId}\`;
      let historyId = chatId;

      if (!isGroup) {
        const otherUid = chatId;
        if (myUid && otherUid) {
          if (myUid === otherUid) historyId = myUid;
          else historyId = [myUid, otherUid].sort().join('_');
          room = \`chat:\${historyId}\`;
        }
      }

      socket.join(room);
      console.log(\`User \${myUid} joined room \${room} (historyID: \${historyId})\`);
      
      try {
        let messages = [];
        if (myUid === chatId) {
          const oldId = \`\${myUid}_\${myUid}\`;
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
          const oldId = \`\${myUid}_\${myUid}\`;
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
          const oldId = \`\${myUid}_\${myUid}\`;
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

    socket.on('message:new', async (data: { chatId: string, message: any, _uid?: string }) => {
      const myUid = (socket as any).uid || data._uid;
      if (!myUid) return;
      
      const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [data.chatId]);
      const isGroup = !!data.message.groupId || data.chatId === 'global_channel' || gCount > 0;
      let historyId = data.chatId;
      let room = \`chat:\${data.chatId}\`;

      if (!isGroup && data.chatId !== 'global_channel') {
        const receiverId = data.message.receiverId || data.chatId;
        if (myUid === receiverId) historyId = myUid;
        else historyId = [myUid, receiverId].sort().join('_');
        room = \`chat:\${historyId}\`;
        data.message.receiverId = receiverId;
      }

      const msg = { ...data.message, senderId: myUid, id: data.message.id || uuidv4(), createdAt: data.message.createdAt || new Date().toISOString(), chatId: historyId };
      
      try {
        await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msg.id, historyId, JSON.stringify(msg), msg.createdAt]);

        io.to(room).emit('message:received', msg);

        if (!isGroup && data.chatId !== 'global_channel') {
          if (msg.receiverId && msg.receiverId !== msg.senderId) {
            io.to(\`user:\${msg.receiverId}\`).emit('message:received', msg);
          }
          io.to(\`user:\${msg.senderId}\`).emit('message:received', msg);
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
        
        let room = \`chat:\${data.chatId}\`;
        if (!updated.groupId && data.chatId !== 'global_channel' && updated.receiverId) {
          let historyId;
          if (updated.senderId === updated.receiverId) historyId = updated.senderId;
          else historyId = [updated.senderId, updated.receiverId].sort().join('_');
          room = \`chat:\${historyId}\`;
        }

        io.to(room).emit('message:received', updated);
        if (updated.receiverId && updated.receiverId !== updated.senderId) {
          io.to(\`user:\${updated.receiverId}\`).emit('message:received', updated);
        }
        if (updated.senderId) {
           io.to(\`user:\${updated.senderId}\`).emit('message:received', updated);
        }
      }
    });

    socket.on('message:delete', async (data: { id: string, chatId: string }) => {
      const { rows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.id]);
      const row = rows[0];
      let msg: any = null;
      if (row) msg = JSON.parse(row.data);

      await pool.query('DELETE FROM messages WHERE id = $1', [data.id]);
      
      let room = \`chat:\${data.chatId}\`;
      if (msg && !msg.groupId && data.chatId !== 'global_channel' && msg.receiverId) {
        let historyId;
        if (msg.senderId === msg.receiverId) historyId = msg.senderId;
        else historyId = [msg.senderId, msg.receiverId].sort().join('_');
        room = \`chat:\${historyId}\`;
      }

      io.to(room).emit('message:deleted', data.id);
      if (msg && msg.receiverId) io.to(\`user:\${msg.receiverId}\`).emit('message:deleted', data.id);
      if (msg && msg.senderId) io.to(\`user:\${msg.senderId}\`).emit('message:deleted', data.id);
    });

    socket.on('message:schedule', async (data: { chatId: string, message: any, sendAt: string }) => {
      try {
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
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-pro',
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
          
          let room = \`chat:\${data.chatId}\`;
          if (!updated.groupId && data.chatId !== 'global_channel' && updated.receiverId) {
             let historyId;
             if (updated.senderId === updated.receiverId) historyId = updated.senderId;
             else historyId = [updated.senderId, updated.receiverId].sort().join('_');
             room = \`chat:\${historyId}\`;
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
        
        let room = \`chat:\${data.chatId}\`;
        if (!updated.groupId && data.chatId !== 'global_channel' && updated.receiverId) {
          let historyId;
          if (updated.senderId === updated.receiverId) historyId = updated.senderId;
          else historyId = [updated.senderId, updated.receiverId].sort().join('_');
          room = \`chat:\${historyId}\`;
        }

        io.to(room).emit('message:received', updated);
        if (updated.receiverId) io.to(\`user:\${updated.receiverId}\`).emit('message:received', updated);
        if (updated.senderId) io.to(\`user:\${updated.senderId}\`).emit('message:received', updated);
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
      await pool.query('INSERT INTO groups (id, data) VALUES ($1, $2)', [group.id, JSON.stringify(group)]);
      io.emit('group:created', group);
    });

    socket.on('stickers:list', async () => {
      const { rows } = await pool.query('SELECT data FROM sticker_packs');
      const packs = rows.map((row: any) => JSON.parse(row.data));
      socket.emit('stickers:list', packs);
    });

    socket.on('sticker:pack:create', async (pack: any) => {
      const newPack = { ...pack, id: uuidv4(), createdAt: new Date().toISOString() };
      await pool.query('INSERT INTO sticker_packs (id, data) VALUES ($1, $2)', [newPack.id, JSON.stringify(newPack)]);
      io.emit('sticker:pack:created', newPack);
    });

    socket.on('sticker:pack:delete', async (id: string) => {
      await pool.query('DELETE FROM sticker_packs WHERE id = $1', [id]);
      io.emit('sticker:pack:deleted', id);
    });

    socket.on('message:typing', (data: { chatId: string, uid: string, isTyping: boolean }) => {
      socket.to(\`chat:\${data.chatId}\`).emit('message:typing:status', data);
    });

    socket.on('users:fetch', async () => {
      const { rows } = await pool.query('SELECT data FROM users');
      const users = rows.map((r: any) => JSON.parse(r.data));
      socket.emit('users:list', users);
    });

    socket.on('groups:fetch', async () => {
      const { rows } = await pool.query('SELECT data FROM groups');
      const groups = rows.map((r: any) => JSON.parse(r.data));
      socket.emit('groups:list', groups);
    });

    socket.on('user:delete_all_data', async (uid: string) => {
      await pool.query('DELETE FROM messages WHERE data LIKE $1 OR data LIKE $2', [\`%\${uid}%\`, \`%\${uid}%\`]);
      await pool.query('DELETE FROM groups WHERE data LIKE $1', [\`%\${uid}%\`]);
      await pool.query('DELETE FROM users WHERE uid = $1', [uid]);
      io.emit('user:deleted_completely', uid);
    });

    socket.on('disconnect', () => {
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
      }
      console.log('User disconnected:', socket.id);
    });
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
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
`

fs.writeFileSync('server.ts', content);
