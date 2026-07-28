const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');

s = s.replace(
  /\{unreadCounts\[u\.uid\] > 0 && \(\s*<div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-sm shadow-blue-200" title="Новое сообщение" \/>\s*\)\}/g,
  `{unreadCounts[u.uid] > 0 && (
                          <div className={cn("px-1.5 py-0.5 rounded-lg text-[8px] font-bold", selectedChat?.id === u.uid ? "bg-white text-blue-600" : "bg-blue-500 text-white")}>
                            {unreadCounts[u.uid]}
                          </div>
                        )}`
);

fs.writeFileSync('src/App.tsx', s);
