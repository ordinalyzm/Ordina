const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

// Inside server.ts, we find the legacy fallback or the loop for rulesToExecute
const daivinchikBotCode = `
                  } else if (act.type === 'daivinchik') {
                     // Daivinchik mode trigger
                     const { rows: allUsersRows } = await pool.query('SELECT data FROM users WHERE uid != $1', [myUid]);
                     const otherUsers = allUsersRows.map(r => JSON.parse(r.data)).filter(u => u.name && !u.isBot);

                     if (otherUsers.length === 0) {
                         const botMsg = {
                             id: require('uuid').v4(),
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
                         if (botMsg.receiverId) io.to(\`user:\${botMsg.receiverId}\`).emit('message:received', botMsg);
                     } else {
                         const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
                         const botMsg = {
                             id: require('uuid').v4(),
                             senderId: bot.id,
                             receiverId: !isGroup ? myUid : undefined,
                             groupId: isGroup ? data.chatId : undefined,
                             chatId: historyId,
                             text: \`Анкета: \${randomUser.name}\\n\${randomUser.about || 'Нет описания'}\`,
                             type: 'text',
                             createdAt: new Date().toISOString(),
                             inlineButtons: [
                                 [{ text: '❤️ Лайк', action: 'callback', callbackData: \`/dv_like_\${randomUser.uid}\` },
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
                         if (botMsg.receiverId) io.to(\`user:\${botMsg.receiverId}\`).emit('message:received', botMsg);
                     }
                  }
`;

s = s.replace(/} else if \(act\.type === 'moderate' && String\(bot\.ownerId\) !== String\(myUid\)\) \{/g, daivinchikBotCode + `} else if (act.type === 'moderate' && String(bot.ownerId) !== String(myUid)) {`);

// Also in bot:callback we need to handle /dv_like_ and /dv_next
const daivinchikCallbackCode = `
               if (data.callbackData.startsWith('/dv_like_')) {
                   const targetId = data.callbackData.replace('/dv_like_', '');
                   const { rows: meRows } = await pool.query('SELECT data FROM users WHERE uid = $1', [myUid]);
                   const me = meRows[0] ? JSON.parse(meRows[0].data) : null;
                   
                   if (me) {
                       const targetHistoryId = [targetId, bot.id].sort().join('_');
                       const botMsg = {
                           id: require('uuid').v4(),
                           senderId: bot.id,
                           receiverId: targetId,
                           chatId: targetHistoryId,
                           text: \`❤️ Кому-то понравилась ваша анкета!\\n\\n\${me.name}\\n\${me.about || ''}\`,
                           type: 'text',
                           createdAt: new Date().toISOString(),
                           inlineButtons: [
                               [{ text: '❤️ Взаимно', action: 'callback', callbackData: \`/dv_match_\${myUid}\` },
                                { text: '👎 Нет', action: 'callback', callbackData: '/dv_next' }]
                           ]
                       };
                       if (me.avatar) botMsg.attachment = { type: 'image', url: me.avatar, name: 'avatar.png' };
                       
                       pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, targetHistoryId, JSON.stringify(botMsg), botMsg.createdAt]);
                       io.to(\`chat:\${targetHistoryId}\`).emit('message:received', botMsg);
                       io.to(\`user:\${targetId}\`).emit('message:received', botMsg);
                   }
                   
                   // Show next
                   data.callbackData = '/dv_next';
               }
               if (data.callbackData.startsWith('/dv_match_')) {
                   const matchedUid = data.callbackData.replace('/dv_match_', '');
                   
                   const targetHistoryId1 = [myUid, bot.id].sort().join('_');
                   const msg1 = {
                       id: require('uuid').v4(),
                       senderId: bot.id, receiverId: myUid, chatId: targetHistoryId1,
                       text: \`🎉 У вас взаимная симпатия! Начинайте общаться: \` + matchedUid,
                       type: 'text', createdAt: new Date().toISOString()
                   };
                   pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msg1.id, targetHistoryId1, JSON.stringify(msg1), msg1.createdAt]);
                   io.to(\`chat:\${targetHistoryId1}\`).emit('message:received', msg1);
                   io.to(\`user:\${myUid}\`).emit('message:received', msg1);
                   
                   const targetHistoryId2 = [matchedUid, bot.id].sort().join('_');
                   const msg2 = {
                       id: require('uuid').v4(),
                       senderId: bot.id, receiverId: matchedUid, chatId: targetHistoryId2,
                       text: \`🎉 У вас взаимная симпатия! Начинайте общаться: \` + myUid,
                       type: 'text', createdAt: new Date().toISOString()
                   };
                   pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [msg2.id, targetHistoryId2, JSON.stringify(msg2), msg2.createdAt]);
                   io.to(\`chat:\${targetHistoryId2}\`).emit('message:received', msg2);
                   io.to(\`user:\${matchedUid}\`).emit('message:received', msg2);
                   
                   return; // Stop processing further rules for this callback
               }
               if (data.callbackData === '/dv_next') {
                   const { rows: allUsersRows } = await pool.query('SELECT data FROM users WHERE uid != $1', [myUid]);
                   const otherUsers = allUsersRows.map(r => JSON.parse(r.data)).filter(u => u.name && !u.isBot);
                   if (otherUsers.length > 0) {
                       const randomUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
                       const botMsg = {
                           id: require('uuid').v4(),
                           senderId: bot.id,
                           receiverId: !isGroup ? myUid : undefined,
                           groupId: isGroup ? data.chatId : undefined,
                           chatId: historyId,
                           text: \`Анкета: \${randomUser.name}\\n\${randomUser.about || 'Нет описания'}\`,
                           type: 'text',
                           createdAt: new Date().toISOString(),
                           inlineButtons: [
                               [{ text: '❤️ Лайк', action: 'callback', callbackData: \`/dv_like_\${randomUser.uid}\` },
                                { text: '👎 Дальше', action: 'callback', callbackData: '/dv_next' }]
                           ]
                       };
                       if (randomUser.avatar) botMsg.attachment = { type: 'image', url: randomUser.avatar, name: 'avatar.jpg' };
                       pool.query('INSERT INTO messages (id, "chatId", data, "createdAt") VALUES ($1, $2, $3, $4)', [botMsg.id, historyId, JSON.stringify(botMsg), botMsg.createdAt]);
                       
                       const room = isGroup ? \`chat:\${data.chatId}\` : \`chat:\${historyId}\`;
                       io.to(room).emit('message:received', botMsg);
                       io.to(\`user:\${myUid}\`).emit('message:received', botMsg);
                   }
                   return;
               }
`;

s = s.replace(/const isGroup = !!data\.chatId && \(data\.chatId === 'global_channel' \|\| gCount > 0\);/g, `const isGroup = !!data.chatId && (data.chatId === 'global_channel' || gCount > 0);\n` + daivinchikCallbackCode);

fs.writeFileSync('server.ts', s);
