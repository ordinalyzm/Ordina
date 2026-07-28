const fs = require('fs');
let s = fs.readFileSync('src/components/BotConstructor.tsx', 'utf8');

s = s.replace(
  /'send_message' \| 'set_variable' \| 'http_request' \| 'moderate'/g,
  `'send_message' | 'set_variable' | 'http_request' | 'moderate' | 'wait_feedback'`
);

fs.writeFileSync('src/components/BotConstructor.tsx', s);
