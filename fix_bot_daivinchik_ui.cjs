const fs = require('fs');
let s = fs.readFileSync('src/components/BotConstructor.tsx', 'utf8');

s = s.replace(
  /<option value="send_message">Отправить сообщение<\/option>/,
  `<option value="send_message">Отправить сообщение</option>
   <option value="daivinchik">Режим знакомств (Дайвинчик)</option>`
);

fs.writeFileSync('src/components/BotConstructor.tsx', s);
