const fs = require('fs');

let s = fs.readFileSync('src/App.tsx', 'utf8');

s = s.replace(
  /newSocket\.on\('message:deleted',/g,
  `newSocket.on('message:updated', (updatedMsg: Message) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });
    newSocket.on('message:deleted',`
);

s = s.replace(
  /if \(socket\) socket\.emit\('message:new', \{\s*chatId: selectedChat\.id,\s*message: \{\s*text: btn\.callbackData,\s*type: 'text'\s*\}\s*\}\);/g,
  `if (socket) {
    socket.emit('bot:callback', {
      chatId: selectedChat.id,
      messageId: msg.id,
      callbackData: btn.callbackData,
      botId: msg.senderId
    });
  }`
);

fs.writeFileSync('src/App.tsx', s);
