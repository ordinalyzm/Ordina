const fs = require('fs');

let s = fs.readFileSync('src/components/BotConstructor.tsx', 'utf8');

// Add forAdminsOnly to Trigger interface mock
s = s.replace(
  /export interface BotTrigger \{/g,
  `export interface BotTrigger {\n  forAdminsOnly?: boolean;`
);

// Add UI for forAdminsOnly
s = s.replace(
  /\{rule\.trigger\.type === 'new_member' && \(\s*<div\s*className="mt-2 text-sm text-slate-500">/g,
  `{rule.trigger.type === 'new_member' && (\n                           <div className="mt-2 text-xs text-slate-500">`
);

s = s.replace(
  /<div className="mt-6 border-t border-slate-100 pt-4">/g,
  `<div className="mt-2 flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                           <span className="text-xs font-medium text-slate-600">Кто может использовать?</span>
                           <select 
                             className="bg-white border border-slate-200 py-1 px-2 text-xs rounded"
                             value={rule.trigger.forAdminsOnly ? 'admins' : 'all'}
                             onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, trigger: {...r.trigger, forAdminsOnly: e.target.value === 'admins'}} : r)})}
                           >
                             <option value="all">Все пользователи</option>
                             <option value="admins">Только админы/владельцы группы</option>
                           </select>
                         </div>
                       <div className="mt-6 border-t border-slate-100 pt-4">`
);

// Add moderate options
s = s.replace(
  /<option value="delete">Удалить сообщение<\/option>\s*<option value="ban">Забанить участника<\/option>/g,
  `<option value="delete">Удалить это сообщение</option>
                                    <option value="delete_reply">Удалить сообщение (по реплаю)</option>
                                    <option value="mute">Мут (отправителю)</option>
                                    <option value="mute_reply">Мут (по реплаю)</option>
                                    <option value="ban">Забанить (отправителя)</option>
                                    <option value="ban_reply">Забанить (по реплаю)</option>
                                    <option value="warn">Предупреждение (отправителю)</option>
                                    <option value="warn_reply">Предупреждение (по реплаю)</option>
                                    <option value="unmute_reply">Снять мут (по реплаю)</option>
                                    <option value="unban_reply">Снять бан (по реплаю)</option>
                                    `
);

fs.writeFileSync('src/components/BotConstructor.tsx', s);
