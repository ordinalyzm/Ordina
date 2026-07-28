const { Pool } = require('pg');
const pool = new Pool();
pool.query('SELECT data FROM bots').then(res => {
  res.rows.forEach(r => {
     console.log(r.data.substring(0, 500));
  });
  process.exit();
});
