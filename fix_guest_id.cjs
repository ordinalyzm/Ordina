const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');

s = s.replace(
  /const guestId = 'guest_' \+ Math\.random\(\)\.toString\(36\)\.substr\(2, 9\);/g,
  `const savedGuestId = localStorage.getItem('ordina_guest_id');
      const guestId = savedGuestId || 'guest_' + Math.random().toString(36).substr(2, 9);
      if (!savedGuestId) localStorage.setItem('ordina_guest_id', guestId);`
);

fs.writeFileSync('src/App.tsx', s);
