const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

// Inside bot:callback
s = s.replace(
  /if \(t\.type === 'message' &&.*?match = true;/g,
  ""
);
s = s.replace(
  /if \(t\.type === 'exact_match' &&.*?match = true;/g,
  ""
);
s = s.replace(
  /if \(t\.type === 'regex' &&.*?\} catch\(e\) \{\}/g,
  ""
);

// and then replace the block that has nothing, well I should just replace the loop
s = s.replace(
  /let match = false;(\s*if \(match && t\.forAdminsOnly)/,
  `let match = false;
               if (!t) match = true;
               else if (t.type === 'command') match = data.callbackData.toLowerCase().startsWith(t.params?.value?.toLowerCase() || '');
               else if (t.type === 'text') match = data.callbackData.toLowerCase().includes(t.params?.value?.toLowerCase() || '');
               
               $1`
);

fs.writeFileSync('server.ts', s);
