const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

// Inside bot loop in message:new
s = s.replace(
  /for \(const r of rows\) \{\s*const bot = JSON\.parse\(r\.data\);\s*if \(!bot\.isActive\) continue;\s*if \(!isGroup && msg\.receiverId !== bot\.id\) continue;/g,
  `for (const r of rows) {
              const bot = JSON.parse(r.data);
              if (!bot.isActive) continue;
              
              if (!isGroup && msg.receiverId !== bot.id) continue;
              if (isGroup && data.chatId !== 'global_channel') {
                 const { rows: cgRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
                 if (cgRows[0]) {
                    const cg = JSON.parse(cgRows[0].data);
                    if (!cg.members?.includes(bot.id)) continue;
                 }
              }`
);

fs.writeFileSync('server.ts', s);
