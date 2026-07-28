const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

s = s.replace(
  /type: 'bot'/g,
  `type: 'bot', avatar: b.avatarUrl, about: b.description`
);

fs.writeFileSync('server.ts', s);
