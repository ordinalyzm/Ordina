const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  /handleChatContextMenu\(e as any/g,
  `handleChatContextMenu({ preventDefault: () => {}, pageX: (e as any).touches[0].pageX, pageY: (e as any).touches[0].pageY } as any`
);

fs.writeFileSync('src/App.tsx', app);
