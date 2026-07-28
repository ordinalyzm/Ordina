const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

s = s.replace(
  /else if \(t.type === 'command'\) match = msg.text\?\.trim\(\)\?\.toLowerCase\(\)\?\.startsWith\(t\.params\?\.value\?\.toLowerCase\(\)\);/g,
  `else if (t.type === 'command') match = msg.text?.trim()?.toLowerCase()?.startsWith(t.params?.value?.toLowerCase() || '');`
);

s = s.replace(
  /else if \(t.type === 'text'\) match = msg.text\?\.toLowerCase\(\)\?\.includes\(t\.params\?\.value\?\.toLowerCase\(\)\);/g,
  `else if (t.type === 'text') match = msg.text?.toLowerCase()?.includes(t.params?.value?.toLowerCase() || '');`
);

// Do the same for legacy fallback just to be safe
s = s.replace(
  /if \(t.type === 'command'\) return msg.text\?\.trim\(\)\?\.toLowerCase\(\)\?\.startsWith\(t\.params\?\.value\?\.toLowerCase\(\)\);/g,
  `if (t.type === 'command') return msg.text?.trim()?.toLowerCase()?.startsWith(t.params?.value?.toLowerCase() || '');`
);

s = s.replace(
  /if \(t.type === 'text'\) return msg.text\?\.toLowerCase\(\)\?\.includes\(t\.params\?\.value\?\.toLowerCase\(\)\);/g,
  `if (t.type === 'text') return msg.text?.toLowerCase()?.includes(t.params?.value?.toLowerCase() || '');`
);

fs.writeFileSync('server.ts', s);
