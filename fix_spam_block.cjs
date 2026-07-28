const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

s = s.replace(
  /if \(theirMessagesToMe\.length === 0 && myMessagesToThem\.length >= 3\) \{\s*return; \/\/ Block silent spam on server\s*\}/g,
  `
         const isBotReceiver = (await pool.query('SELECT id FROM bots WHERE id = $1', [data.message.receiverId])).rowCount > 0;
         if (!isBotReceiver && theirMessagesToMe.length === 0 && myMessagesToThem.length >= 3) {
           return; // Block silent spam on server
         }
  `
);

fs.writeFileSync('server.ts', s);
