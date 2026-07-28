import fs from 'fs';

let c = fs.readFileSync('server.ts', 'utf8');

// Replace standard imports
c = c.replace("import Database from 'better-sqlite3';", "import pg from 'pg';\nconst { Pool } = pg;");

// Replace DB init
c = c.replace(/let db: Database\.Database;[\s\S]*?console\.error\('Failed to create tables:', error\);\n}/, `const pool = new Pool({
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
        chat_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
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
        chat_id TEXT NOT NULL,
        data TEXT NOT NULL,
        send_at TEXT NOT NULL
      );
    \`);
    console.log('Database connected & tables ready.');
  } catch (error) {
    console.error('Failed to init DB:', error);
  }
}`);

// We need to rewrite all queries inside server.ts manually to be async. 
// It's much easier if I write a codemod script for all common patterns, or just replace all db.prepare().
c = c.replace(/const seedGlobalChannel = \(\) => {/g, 'const seedGlobalChannel = async () => {');
c = c.replace(/seedGlobalChannel\(\);/g, ''); // we will call this inside startServer

// .get(...)
c = c.replace(/const stmt = db\.prepare\('SELECT (.+?) FROM (.+?) WHERE id = \?'\);\s*const existing = stmt\.get\((.+?)\) as any;/g, 
  "const existing = (await pool.query('SELECT $1 FROM $2 WHERE id = $$1', [$3])).rows[0] as any;".replace('$1', '$1').replace('$2', '$2'));

fs.writeFileSync('server_new.ts', c);
