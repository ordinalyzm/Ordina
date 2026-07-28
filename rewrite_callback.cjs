const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

const targetStr = `               let match = false;
               
               
               if (t.type === 'regex' && t.text) {
                   try {
                       const regex = new RegExp(t.text, 'i');
                       if (regex.test(data.callbackData)) match = true;
                   } catch(e) {}
               }
               
               if (match && t.forAdminsOnly && isGroup) {`;

const repl = `               let match = false;
               if (!t) match = true;
               else if (t.type === 'command') match = data.callbackData?.toLowerCase().startsWith(t.params?.value?.toLowerCase() || '');
               else if (t.type === 'text') match = data.callbackData?.toLowerCase().includes(t.params?.value?.toLowerCase() || '');
               
               if (match && t.forAdminsOnly && isGroup) {`;

s = s.replace(targetStr, repl);
fs.writeFileSync('server.ts', s);
