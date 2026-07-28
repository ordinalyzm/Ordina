const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Guest login persistence
s = s.replace(
  /const guestId = 'guest_' \+ Math\.random\(\)\.toString\(36\)\.substr\(2, 9\);\s*await signInWithCustomToken\(auth, guestId\);/g,
  `const savedGuestId = localStorage.getItem('ordina_guest_id');
      const guestId = savedGuestId || 'guest_' + Math.random().toString(36).substr(2, 9);
      if (!savedGuestId) localStorage.setItem('ordina_guest_id', guestId);
      await signInWithCustomToken(auth, guestId);`
);

// 2. Limit bots
s = s.replace(
  /onClick=\{\(\) => \{\s*setShowSettings\(false\);\s*setShowBotsModal\(true\);\s*\}\}/g,
  `onClick={() => {
                    if (user?.isAnonymous) {
                      addToast('Гости не могут создавать или управлять ботами', 'error');
                      return;
                    }
                    setShowSettings(false);
                    setShowBotsModal(true);
                  }}`
);

// 3. Limit Group Creation
s = s.replace(
  /onClick=\{\(\) => \{\s*setShowCreateChatModal\(true\);\s*setShowChatMenu\(false\);\s*\}\}/g,
  `onClick={() => {
                    if (user?.isAnonymous) {
                      addToast('Гости не могут создавать группы', 'error');
                      return;
                    }
                    setShowCreateChatModal(true);
                    setShowChatMenu(false);
                  }}`
);

// We need to find how users search and join groups
fs.writeFileSync('src/App.tsx', s);
