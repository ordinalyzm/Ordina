const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');
s = s.replace(/require\('uuid'\)\.v4\(\)/g, "uuidv4()");
fs.writeFileSync('server.ts', s);
