const fs = require('fs');

// 1. Fix server.ts bot engine
let s = fs.readFileSync('server.ts', 'utf8');

s = s.replace(
  /const trigger = bot\.triggers\?\.find.*?if \(trigger\) \{.*?for \(const act of bot\.actions.*?\)\s*\{\s*(.*?)\s*\}\s*\}/gs,
  (match, innerContent) => {
    return `// Handle rules natively
              let rulesToExecute: any[] = [];
              if (bot.rules && bot.rules.length > 0) {
                  for (const rule of bot.rules) {
                      const t = rule.trigger;
                      let match = false;
                      if (!t) match = true;
                      else if (t.type === 'command') match = msg.text?.trim()?.toLowerCase()?.startsWith(t.params?.value?.toLowerCase());
                      else if (t.type === 'text') match = msg.text?.toLowerCase()?.includes(t.params?.value?.toLowerCase());
                      else if (t.type === 'new_member') match = (msg.type === 'system_join');
                      
                      if (match) rulesToExecute.push({ actions: rule.actions });
                  }
              } else {
                  // Legacy fallback
                  const trigger = bot.triggers?.find((t: any) => {
                     if (t.type === 'command') return msg.text?.trim()?.toLowerCase()?.startsWith(t.params?.value?.toLowerCase());
                     if (t.type === 'text') return msg.text?.toLowerCase()?.includes(t.params?.value?.toLowerCase());
                     return false;
                  });
                  if (trigger) rulesToExecute.push({ actions: bot.actions });
              }

              for (const rule of rulesToExecute) {
                 const acts = rule.actions?.sort((a:any, b:any) => a.order - b.order) || [];
                 for (const act of acts) {
                    ${innerContent}
                 }
              }`;
  }
);

s = s.replace(
  /\} else if \(act\.type === 'moderate' && String\(bot\.ownerId\) !== String\(myUid\)\) \{\s*if \(act\.params\?\.action === 'delete'\) \{\s*await pool\.query\('DELETE FROM messages WHERE id = \$1', \[msg\.id\]\);\s*io\.to\(room\)\.emit\('message:deleted', msg\.id\);\s*if \(msg\.receiverId\) io\.to\(\`user:\$\{msg\.receiverId\}\`\)\.emit\('message:deleted', msg\.id\);\s*\}\s*\}/g,
  `} else if (act.type === 'moderate' && String(bot.ownerId) !== String(myUid)) {
       const actionType = act.params?.action || 'delete';
       if (actionType === 'delete') {
          await pool.query('DELETE FROM messages WHERE id = $1', [msg.id]);
          io.to(room).emit('message:deleted', msg.id);
          if (msg.receiverId) io.to(\`user:\${msg.receiverId}\`).emit('message:deleted', msg.id);
       } else if (actionType === 'ban' && isGroup) {
          const { rows: gRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
          if (gRows[0]) {
             const g = JSON.parse(gRows[0].data);
             g.members = (g.members || []).filter((uid: string) => uid !== msg.senderId);
             await pool.query('UPDATE groups SET data = $1 WHERE id = $2', [JSON.stringify(g), data.chatId]);
             io.emit('group:updated', g);
          }
       }
    }`
);

fs.writeFileSync('server.ts', s);
