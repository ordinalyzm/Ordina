const fs = require('fs');

let s = fs.readFileSync('src/components/BotConstructor.tsx', 'utf8');

// Add avatarUrl and description
s = s.replace(
  /export interface BotConfig \{/,
  `export interface BotConfig {\n  avatarUrl?: string;\n  description?: string;`
);

s = s.replace(
  /\{activeTab === 'settings' && \(\s*<div className="space-y-6">/,
  `{activeTab === 'settings' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Ссылка на аватар <span className="text-slate-400 font-normal">(необязательно)</span></label>
                  <input
                    type="url"
                    value={bot.avatarUrl || ''}
                    onChange={(e) => { const updated = { ...bot, avatarUrl: e.target.value }; setBot(updated); onSave(updated); }}
                    placeholder="https://example.com/avatar.png"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Описание бота</label>
                  <textarea
                    value={bot.description || ''}
                    onChange={(e) => { const updated = { ...bot, description: e.target.value }; setBot(updated); onSave(updated); }}
                    placeholder="Бот для модерации и отправки смешных картинок..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium resize-none h-24 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>`
);

fs.writeFileSync('src/components/BotConstructor.tsx', s);
