import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const DB_FILE = path.join(process.cwd(), 'local_database.json');

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not defined!');
    console.error('Please configure DATABASE_URL in your environment secrets or .env file.');
    process.exit(1);
  }

  console.log('🔄 Loading local database content from local_database.json...');
  if (!fs.existsSync(DB_FILE)) {
    console.log('⚠️ No local_database.json found. Nothing to migrate!');
    return;
  }

  let localDb;
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    localDb = JSON.parse(content);
  } catch (err) {
    console.error('❌ Failed to read or parse local_database.json:', err);
    process.exit(1);
  }

  console.log('🔌 Connecting to destination PostgreSQL database...');
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Postgres successfully!');

    console.log('🏗️ Creating database tables if they do not exist...');
    await client.query(`
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
    console.log('✅ Tables and indices verified/created.');

    // 1. Migrate users
    const users = Object.values(localDb.users || {});
    if (users.length > 0) {
      console.log(`👤 Migrating ${users.length} users...`);
      for (const u of users as any) {
        await client.query(
          `INSERT INTO users (uid, data) VALUES ($1, $2) ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data`,
          [u.uid, u.data]
        );
      }
    }

    // 2. Migrate groups
    const groups = Object.values(localDb.groups || {});
    if (groups.length > 0) {
      console.log(`👥 Migrating ${groups.length} groups...`);
      for (const g of groups as any) {
        await client.query(
          `INSERT INTO groups (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [g.id, g.data]
        );
      }
    }

    // 3. Migrate messages
    const messages = Object.values(localDb.messages || {});
    if (messages.length > 0) {
      console.log(`💬 Migrating ${messages.length} messages...`);
      for (const m of messages as any) {
        await client.query(
          `INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET "chatId" = EXCLUDED."chatId", data = EXCLUDED.data, "createdAt" = EXCLUDED."createdAt"`,
          [m.id, m.chatId, m.data, m.createdAt]
        );
      }
    }

    // 4. Migrate sticker_packs
    const packs = Object.values(localDb.sticker_packs || {});
    if (packs.length > 0) {
      console.log(`🎨 Migrating ${packs.length} sticker packs...`);
      for (const p of packs as any) {
        await client.query(
          `INSERT INTO sticker_packs (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
          [p.id, p.data]
        );
      }
    }

    // 5. Migrate scheduled_messages
    const scheds = Object.values(localDb.scheduled_messages || {});
    if (scheds.length > 0) {
      console.log(`⏰ Migrating ${scheds.length} scheduled messages...`);
      for (const s of scheds as any) {
        await client.query(
          `INSERT INTO scheduled_messages (id, "chatId", data, "sendAt") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET "chatId" = EXCLUDED."chatId", data = EXCLUDED.data, "sendAt" = EXCLUDED."sendAt"`,
          [s.id, s.chatId, s.data, s.sendAt]
        );
      }
    }

    // 6. Migrate bots
    const bots = Object.values(localDb.bots || {});
    if (bots.length > 0) {
      console.log(`🤖 Migrating ${bots.length} bots...`);
      for (const b of bots as any) {
        await client.query(
          `INSERT INTO bots (id, owner_id, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, data = EXCLUDED.data`,
          [b.id, b.owner_id, b.data]
        );
      }
    }

    console.log('🎉 Database migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    await client.end();
    console.log('🔌 Connection closed.');
  }
}

migrate();
