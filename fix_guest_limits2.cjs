const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');

// 2. Limit bots
s = s.replace(
  /onClick=\{\(\) => \{\s*setShowSettings\(false\);\s*setShowBotsModal\(true\);\s*\}\}/g,
  `onClick={() => {
                    if (user?.isAnonymous) {
                      (window as any).addToast?.('Гости не могут создавать или управлять ботами', 'error');
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
                      (window as any).addToast?.('Гости не могут создавать группы', 'error');
                      return;
                    }
                    setShowCreateChatModal(true);
                    setShowChatMenu(false);
                  }}`
);

// We need to limit guest from joining groups except Ordina Global
// Find group join logic
s = s.replace(
  /const handleJoinGroup = async \(group: Group\) => \{/g,
  `const handleJoinGroup = async (group: Group) => {
    if (user?.isAnonymous && group.id !== 'global_channel') {
      (window as any).addToast('Гости могут состоять только в группе Ордина Глобал', 'error');
      return;
    }`
);

// Guests 1 chat with 1 person
s = s.replace(
  /const handleStartChat = \(otherUserId: string\) => \{/g,
  `const handleStartChat = (otherUserId: string) => {
    if (user?.isAnonymous && profile?.activeChats?.length) {
      if (!profile.activeChats.includes(otherUserId) && profile.activeChats.filter(id => !groups.find(g => g.id === id) && id !== 'global_channel').length >= 1) {
         (window as any).addToast('Гости могут общаться напрямую только с одним человеком', 'error');
         return;
      }
    }`
);

fs.writeFileSync('src/App.tsx', s);
