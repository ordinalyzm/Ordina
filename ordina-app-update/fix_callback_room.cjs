const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

// Fix bot:callback room emission
s = s.replace(
  /const room = isGroup \? `group:\$\{data\.chatId\}` : `user:\$\{myUid\}`;/g,
  `const room = isGroup ? \`chat:\${data.chatId}\` : \`chat:\${historyId}\`;`
);

// We should also look for other places where `group:` or `user:` is used incorrectly
// wait, myUid room is joined: socket.join(\`user:\${uid}\`);
// but chat room is usually joined. For a direct message chat, the user is joined to chat:historyId when they open the chat!
// so \`chat:\${historyId}\` is perfect. And we still emit to user:myUid additionally just in case, but let's change group: to chat: and user: to chat:historyId where it implies the chat context.

fs.writeFileSync('server.ts', s);
