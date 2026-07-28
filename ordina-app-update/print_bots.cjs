const { Pool } = require('pg');
const pool = new Pool();
pool.query('SELECT data FROM bots').then(res => {
  console.log(JSON.stringify(res.rows.map(r => JSON.parse(r.data)), null, 2));
  process.exit();
}).catch(console.error);
