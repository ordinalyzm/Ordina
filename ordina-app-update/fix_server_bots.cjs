const fs = require('fs');

let s = fs.readFileSync('server.ts', 'utf8');

// 1. Add bot:callback event
const botCallbackCode = `
    socket.on('bot:callback', async (data: { chatId: string, messageId: string, callbackData: string, botId: string, _uid?: string }) => {
       const myUid = (socket as any).uid || data._uid;
       if (!myUid) return;

       const { rowCount: gCount } = await pool.query('SELECT id FROM groups WHERE id = $1', [data.chatId]);
       const isGroup = !!data.chatId && (data.chatId === 'global_channel' || gCount > 0);
       let historyId = data.chatId;
       if (!isGroup && data.chatId !== 'global_channel') {
           historyId = [myUid, data.chatId].sort().join('_');
       }

       const { rows } = await pool.query('SELECT data FROM bots WHERE id = $1', [data.botId]);
       if (!rows[0]) return;
       const bot = JSON.parse(rows[0].data);
       if (!bot.isActive) return;

       let rulesToExecute: any[] = [];
       if (bot.rules && bot.rules.length > 0) {
           for (const rule of bot.rules) {
               const t = rule.trigger;
               let match = false;
               if (t.type === 'message' && t.text && data.callbackData.toLowerCase().includes(t.text.toLowerCase())) match = true;
               if (t.type === 'exact_match' && t.text && data.callbackData.toLowerCase() === t.text.toLowerCase()) match = true;
               if (t.type === 'regex' && t.text) {
                   try {
                       const regex = new RegExp(t.text, 'i');
                       if (regex.test(data.callbackData)) match = true;
                   } catch(e) {}
               }
               
               if (match && t.forAdminsOnly && isGroup) {
                   const { rows: rgRows } = await pool.query('SELECT data FROM groups WHERE id = $1', [data.chatId]);
                   if (rgRows[0]) {
                       const rg = JSON.parse(rgRows[0].data);
                       const isAdmin = ['owner', 'admin'].includes(rg.memberRoles?.[myUid]) || String(myUid) === String(bot.ownerId) || String(myUid) === String(rg.ownerId);
                       if (!isAdmin) match = false;
                   }
               }
               if (match) rulesToExecute.push({ actions: rule.actions });
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
                   if (act.type === 'send_message') {
                       let outText = act.params?.text || '';
                       outText = outText.replace('{user_name}', uName);

                       const { rows: mRows } = await pool.query('SELECT data FROM messages WHERE id = $1', [data.messageId]);
                       if (mRows[0]) {
                           const updatedBotMsg = JSON.parse(mRows[0].data);
                           updatedBotMsg.text = outText;
                           updatedBotMsg.inlineButtons = act.params?.inlineButtons;
                           updatedBotMsg.updatedAt = new Date().toISOString();
                           
                           await pool.query('UPDATE messages SET data = $1 WHERE id = $2', [JSON.stringify(updatedBotMsg), data.messageId]);
                           const room = isGroup ? \`group:\${data.chatId}\` : \`user:\${myUid}\`;
                           io.to(room).emit('message:updated', updatedBotMsg);
                           if (updatedBotMsg.receiverId) io.to(\`user:\${updatedBotMsg.receiverId}\`).emit('message:updated', updatedBotMsg);
                       }
                   } else if (act.type === 'wait_feedback') {
                       userBotStates.set(\`\${bot.id}_\${myUid}\`, { type: 'feedback' });
                       let outText = act.params?.text || '';
                       outText = outText.replace('{user_name}', uName);

                       const botMsg = {
                           id: require('uuid').v4(),
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
                       const room = isGroup ? \`group:\${data.chatId}\` : \`user:\${myUid}\`;
                       io.to(room).emit('message:received', botMsg);
                       if (botMsg.receiverId) io.to(\`user:\${botMsg.receiverId}\`).emit('message:received', botMsg);
                   }
               }
           }
       }
    });
`;

s = s.replace(/socket\.on\('chat:leave',.*?\}\);/g, "socket.on('chat:leave', (chatId: string) => {});\n" + botCallbackCode);

// 2. Fix bot createdAt to be slightly after user's, and forward wait_feedback to bot owner.
s = s.replace(/createdAt: new Date\(\)\.toISOString\(\)/g, "createdAt: new Date(new Date(msg.createdAt).getTime() + 10).toISOString()");

s = s.replace(
  /\/\/ Notify user success[\s\S]*?io\.to\(`user:\$\{myUid\}`\)\.emit\('message:received', botMsg\);/g,
  `\/\/ Notify user success
                        const botMsg = {
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
                        io.to(\`user:\${myUid}\`).emit('message:received', botMsg);

                        // Forward to owner
                        const ownerChatId = [botInfo.owner_id, botInfo.id].sort().join('_');
                        const forwardMsg = {
                            id: uuidv4(),
                            senderId: botInfo.id,
                            receiverId: botInfo.owner_id,
                            chatId: ownerChatId,
                            text: \`📨 Обратная связь от пользователя (ID: \${myUid}):\\n\\n\${msg.text}\`,
                            type: 'text',
                            createdAt: new Date(new Date(msg.createdAt).getTime() + 15).toISOString()
                        };
                        await pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [forwardMsg.id, ownerChatId, JSON.stringify(forwardMsg), forwardMsg.createdAt]);
                        io.to(\`user:\${botInfo.owner_id}\`).emit('message:received', forwardMsg);`
);

fs.writeFileSync('server.ts', s);
