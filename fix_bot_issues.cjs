const fs = require('fs');

// Patch App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  /onContextMenu=\{\(e\) => handleChatContextMenu\(e, \{id: u\.uid, type: 'user'\}\)\}/g,
  `onContextMenu={(e) => handleChatContextMenu(e, {id: u.uid, type: 'user'})}
                  onTouchStart={(e) => {
                    const timer = setTimeout(() => { handleChatContextMenu(e as any, {id: u.uid, type: 'user'}); }, 500);
                    (e.target as any).dataset.timerId = timer.toString();
                  }}
                  onTouchEnd={(e) => { clearTimeout(parseInt((e.target as any).dataset.timerId)); }}
                  onTouchMove={(e) => { clearTimeout(parseInt((e.target as any).dataset.timerId)); }}`
);

app = app.replace(
  /onContextMenu=\{\(e\) => handleChatContextMenu\(e, \{id: g\.id, type: \(g\.type as any\) \|\| 'group'\}\)\}/g,
  `onContextMenu={(e) => handleChatContextMenu(e, {id: g.id, type: (g.type as any) || 'group'})}
                  onTouchStart={(e) => {
                    const timer = setTimeout(() => { handleChatContextMenu(e as any, {id: g.id, type: (g.type as any) || 'group'}); }, 500);
                    (e.target as any).dataset.timerId = timer.toString();
                  }}
                  onTouchEnd={(e) => { clearTimeout(parseInt((e.target as any).dataset.timerId)); }}
                  onTouchMove={(e) => { clearTimeout(parseInt((e.target as any).dataset.timerId)); }}`
);

fs.writeFileSync('src/App.tsx', app);

// Patch BotConstructor.tsx
let bc = fs.readFileSync('src/components/BotConstructor.tsx', 'utf8');

bc = bc.replace(
  /className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"/g,
  `className="text-slate-300 hover:text-red-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity"`
);

bc = bc.replace(
  /<div className=\{`w-12 h-6 rounded-full p-1 transition-colors \$\{bot\.isActive \? 'bg-emerald-500' : 'bg-slate-300'\}`\} onClick=\{\(\) => setBot\(\{ \.\.\.bot, isActive: !bot\.isActive \}\)\}>/g,
  `<div className={\`w-12 h-6 rounded-full p-1 transition-colors \${bot.isActive ? 'bg-emerald-500' : 'bg-slate-300'}\`} onClick={() => { const updated = { ...bot, isActive: !bot.isActive }; setBot(updated); onSave(updated); }}>`
);

if (!bc.includes("Настройки бота")) {
    bc = bc.replace(
      /\{activeTab === 'flow' && \(/g,
      `{activeTab === 'settings' && (
           <div className="max-w-3xl mx-auto space-y-6 pb-20">
             <div className="flex flex-col gap-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="font-bold text-lg text-slate-700">Настройки бота</h3>
               <p className="text-sm text-slate-500">Дополнительные настройки для вашего бота.</p>
               
               <div className="mt-4 p-4 border border-red-100 bg-red-50 rounded-xl relative overflow-hidden">
                 <div className="flex justify-between items-center mb-2">
                   <div>
                     <h4 className="font-bold text-red-600">Опасная зона</h4>
                     <p className="text-xs text-red-500/80">Удаление бота навсегда.</p>
                   </div>
                 </div>
                 <p className="text-xs text-red-400 mb-4">Бот и его настройки будут удалены безвозвратно. Если бот уже был в чатах, он перестанет реагировать, но его прошлые сообщения останутся.</p>
               </div>
             </div>
           </div>
        )}
        {activeTab === 'flow' && (`
    );
}

fs.writeFileSync('src/components/BotConstructor.tsx', bc);
