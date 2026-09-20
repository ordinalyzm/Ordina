import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Plus, X, Settings2, Trash2, ArrowLeft, Play, Save, Check, Sparkles, Loader2, Coins, CreditCard, AlertTriangle, ShieldCheck, DollarSign } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export interface BotCurrencyConfig {
  enabled: boolean;
  name: string; // e.g. "Звёзды", "Кристаллы", "Монеты"
  symbol: string; // e.g. "⭐", "💎", "🪙"
  initialBalance: number; // e.g. 50
  paymentUrl?: string; // Link to buy currency
  paymentWarningText?: string; // Custom warning message before redirect
}

export interface BotConfig {
  avatarUrl?: string;
  description?: string;
  id: string;
  name: string;
  username?: string;
  isActive: boolean;
  triggers: BotTrigger[];
  conditions: BotCondition[];
  actions: BotAction[];
  rules?: BotRule[];
  usersList?: string[];
  currency?: BotCurrencyConfig;
}

export interface BotTrigger {
  forAdminsOnly?: boolean;
  id: string;
  type: 'command' | 'text' | 'regex' | 'new_member' | 'schedule' | 'file';
  params: any;
}

export interface BotCondition {
  id: string;
  type: 'variable_equals' | 'variable_not_equals' | 'variable_exists' | 'variable_not_exists';
  params: any;
}

export interface BotRule {
  id: string;
  trigger: BotTrigger;
  conditions?: BotCondition[];
  actions: BotAction[];
  rules?: BotRule[];
}

export interface BotAction {
  id: string;
  conditionId?: string; // If undefined, applies to trigger without conditions
  order: number;
  type: 'send_message' | 'set_variable' | 'http_request' | 'moderate' | 'wait_feedback' | 'send_message_to_user' | 'fetch_random_user' | 'charge_currency' | 'reward_currency' | 'check_balance';
  params: any;
}

interface BotConstructorProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  socket: any;
}

export default function BotConstructor({ isOpen, onClose, user, socket }: BotConstructorProps) {
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [editingBot, setEditingBot] = useState<BotConfig | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen || !socket || !user) return;
    
    socket.emit('bots:list', user.uid);
    socket.on('bots:list', (data: BotConfig[]) => {
      setBots(data);
    });

    return () => {
      socket.off('bots:list');
    };
  }, [isOpen, socket, user]);

  const handleSaveBot = (bot: BotConfig) => {
    socket.emit('bot:save', { uid: user.uid, bot });
    setBots(prev => {
      const idx = prev.findIndex(b => b.id === bot.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = bot;
        return next;
      }
      return [...prev, bot];
    });
    setEditingBot(null);
  };

  const handleDeleteBot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('Точно удалить бота?')) {
      socket.emit('bot:delete', { uid: user.uid, botId: id });
      setBots(prev => prev.filter(b => b.id !== id));
    }
  };

  const generateLocalAiBot = (prompt: string, currentBot?: any): any => {
    const p = prompt.toLowerCase();
    const rules: any[] = currentBot?.rules ? [...currentBot.rules] : [];

    if (p.includes('привет') || p.includes('старт') || p.includes('start') || p.includes('помощь')) {
      rules.push({
        id: Date.now().toString() + '1',
        triggerType: 'command',
        triggerValue: '/start',
        actionType: 'text',
        response: 'Здравствуйте! Я ваш авто-помощник. Чем могу помочь?',
        buttons: [{ text: 'ℹ️ Помощь', action: 'text', payload: 'Помощь' }, { text: '📞 Контакты', action: 'text', payload: 'Контакты' }]
      });
    }
    if (p.includes('цена') || p.includes('стоимость') || p.includes('купить') || p.includes('заказ') || p.includes('магазин')) {
      rules.push({
        id: Date.now().toString() + '2',
        triggerType: 'keyword',
        triggerValue: 'цена, стоимость, купить, прайс',
        actionType: 'text',
        response: 'Актуальный прайс-лист и информация о заказах доступны по запросу. Выберите нужный раздел.',
        buttons: [{ text: '📦 Каталог', action: 'text', payload: 'Каталог' }]
      });
    }
    if (p.includes('поддержка') || p.includes('оператор') || p.includes('хелп')) {
      rules.push({
        id: Date.now().toString() + '3',
        triggerType: 'keyword',
        triggerValue: 'поддержка, оператор, помощи',
        actionType: 'text',
        response: 'Соединяю с оператором поддержки... Пожалуйста, опишите вашу проблему в сообщении.',
      });
    }
    if (rules.length === 0 || p.length > 5) {
      rules.push({
        id: Date.now().toString() + '4',
        triggerType: 'contains',
        triggerValue: prompt.slice(0, 15),
        actionType: 'text',
        response: `Авто-ответ: принято сообщение по теме "${prompt.slice(0, 30)}...". Мы вам обязательно ответим!`,
      });
    }

    return {
      id: currentBot?.id || 'bot_' + Date.now(),
      name: currentBot?.name || (prompt.slice(0, 18) + ' Бот'),
      username: currentBot?.username || ('bot_' + Math.floor(Math.random()*10000)),
      avatar: currentBot?.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
      description: currentBot?.description || `Бот для: "${prompt}"`,
      greeting: currentBot?.greeting || `Здравствуйте! Я бота-помощник. Чем могу помочь?`,
      rules: rules,
      isActive: true,
      createdAt: currentBot?.createdAt || new Date().toISOString()
    };
  };

  const handleGenerateBotWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiGenerating(true);
    try {
      const serverUrl = localStorage.getItem('ordina_server_url') || '';
      const endpoint = serverUrl ? `${serverUrl}/api/bot-ai` : '/api/bot-ai';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim(), currentBot: editingBot })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.bot) {
          setEditingBot(data.bot);
          setShowAiModal(false);
          setAiPrompt('');
          if ((window as any).addToast) (window as any).addToast('Бот сгенерирован ИИ!', 'success');
          return;
        }
      }
      throw new Error('API return error');
    } catch (err: any) {
      console.warn('AI generator fallback to local engine:', err);
      const generated = generateLocalAiBot(aiPrompt.trim(), editingBot);
      setEditingBot(generated);
      setShowAiModal(false);
      setAiPrompt('');
      if ((window as any).addToast) (window as any).addToast('Бот умной системы готов!', 'success');
    } finally {
      setIsAiGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[1200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {editingBot && (
              <button 
                onClick={() => setEditingBot(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{editingBot ? 'Редактировать: ' + editingBot.name : 'Мои боты'}</h2>
              <p className="text-xs text-slate-500">Конструктор ботов без кода + Бесплатная ИИ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
            >
              <Sparkles size={14} />
              <span>Написать с ИИ</span>
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {!editingBot ? (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    setEditingBot({
                      id: uuidv4(),
                      name: 'Новый бот',
                      isActive: true,
                      triggers: [],
                      conditions: [],
                      actions: [], rules: [] });
                  }}
                  className="h-28 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-600 transition-all font-medium"
                >
                  <Plus size={24} className="text-blue-600" />
                  <span>Создать бота с нуля</span>
                </button>

                <button 
                  onClick={() => setShowAiModal(true)}
                  className="h-28 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white hover:opacity-95 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all font-bold shadow-lg p-4"
                >
                  <Sparkles size={24} />
                  <span>Написать бота через ИИ</span>
                  <span className="text-[10px] opacity-90 font-normal">Бесплатная автогенерация логики</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bots.map(bot => (
                  <div key={bot.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group" onClick={() => setEditingBot(bot)}>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold">{bot.name}</h3>
                      <button onClick={(e) => handleDeleteBot(bot.id, e)} className="text-slate-300 hover:text-red-500 p-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <div className={`w-2 h-2 rounded-full ${bot.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span className={bot.isActive ? 'text-emerald-600' : ''}>{bot.isActive ? 'Выполняется' : 'Остановлен'}</span>
                      {bot.usersList && <span className="ml-2 font-medium bg-slate-100 px-2 py-0.5 rounded-md">Пользователей: {bot.usersList.length}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <BotEditor bot={editingBot} setBot={setEditingBot} onSave={handleSaveBot} />
          )}
        </div>

        {/* AI Bot Generation Modal */}
        <AnimatePresence>
          {showAiModal && (
            <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAiModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-purple-600">
                    <Sparkles size={22} />
                    <h3 className="font-bold text-lg text-slate-900">Бесплатный ИИ-Конструктор Ботов</h3>
                  </div>
                  <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Опишите логику или задачи бота простыми словами. ИИ бесплатно сгенерирует или отредактирует команды, правила, условия и ответы бота!
                </p>

                {/* Quick Prompts */}
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Быстрые шаблоны:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '👋 Приветственный бот', prompt: 'Создай бота, который приветствует участников и отвечает на /help и /rules' },
                      { label: '🛡️ Модератор чата', prompt: 'Создай бота-модератора, реагирующего на стоп-слова и спам с авто-баном' },
                      { label: '💬 Сбор отзывов', prompt: 'Создай бота для сбора вопросов и обратной связи от пользователей' },
                      { label: '🎯 Помощник с кнопками', prompt: 'Создай бота с командами /info, /about и inline-кнопками ссылок' },
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={() => setAiPrompt(item.prompt)}
                        className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium px-3 py-1.5 rounded-full transition-colors border border-purple-100 text-left"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Например: 'Создай бота, который приветствует участников, а по командам /start и /help выдает кнопки со ссылкой и описанием'..."
                  className="w-full h-32 p-3 text-sm bg-slate-50 border border-slate-200 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white mb-4 transition-all"
                />

                <div className="flex gap-3">
                  <button
                    disabled={isAiGenerating || !aiPrompt.trim()}
                    onClick={handleGenerateBotWithAi}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {isAiGenerating ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        ИИ создает логику бота...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        {editingBot ? 'Отредактировать бота через ИИ' : 'Написать бота через ИИ'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function BotEditor({ bot, setBot, onSave }: { bot: BotConfig, setBot: any, onSave: (b: BotConfig) => void }) {
  // Complex node editor state could go here. For now it's a basic form.
  const [activeTab, setActiveTab] = useState<'flow' | 'currency' | 'settings'>('flow');

  const currencyConfig = bot.currency || {
    enabled: false,
    name: 'Звёзды',
    symbol: '⭐',
    initialBalance: 50,
    paymentUrl: '',
    paymentWarningText: 'Внимание: вы переходите на внешнюю страницу оплаты. Ordina Mesh не хранит данные ваших платежных карт и не несет ответственности за внешние шлюзы.'
  };

  const updateCurrency = (partial: Partial<BotCurrencyConfig>) => {
    const updated = {
      ...bot,
      currency: {
        ...currencyConfig,
        ...partial
      }
    };
    setBot(updated);
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-wrap gap-2">
         <div className="flex gap-2">
           <button onClick={() => setActiveTab('flow')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'flow' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>Flow</button>
           <button onClick={() => setActiveTab('currency')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition ${activeTab === 'currency' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
             <Coins size={16} className={activeTab === 'currency' ? 'text-amber-600' : 'text-slate-400'} />
             <span>Валюта и Платежи</span>
             {currencyConfig.enabled && (
               <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
             )}
           </button>
           <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>Настройки</button>
         </div>
         <div className="flex items-center gap-4">
           <label className="flex items-center gap-2 cursor-pointer">
             <span className="text-sm font-medium text-slate-600">Активен:</span>
             <div className={`w-12 h-6 rounded-full p-1 transition-colors ${bot.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} onClick={() => { const updated = { ...bot, isActive: !bot.isActive }; setBot(updated); onSave(updated); }}>
               <div className={`w-4 h-4 bg-white rounded-full transition-transform ${bot.isActive ? 'translate-x-6' : ''}`} />
             </div>
           </label>
           <button onClick={() => onSave(bot)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">
             <Save size={16} /> Сохранить
           </button>
         </div>
      </div>
      <div className="flex-1 p-6 overflow-y-auto bg-slate-50 custom-scrollbar">
        {activeTab === 'currency' && (
          <div className="max-w-3xl mx-auto space-y-6 pb-20">
            {/* Currency Banner Card */}
            <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-xl">
                    {currencyConfig.symbol || '⭐'}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">Внутренняя валюта бота</h3>
                    <p className="text-amber-100 text-xs">Монетизация действий, покупка валюты и платный функционал</p>
                  </div>
                </div>
              </div>
              <Coins className="absolute -right-6 -bottom-6 w-36 h-36 text-white/10 pointer-events-none" />
            </div>

            {/* Currency Master Switch */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-base">Включить экономику бота</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Позволяет пользователям копить, тратить и покупать валюту за реальные действия</p>
                </div>
                <div 
                  className={`w-14 h-7 rounded-full p-1 transition-colors cursor-pointer ${currencyConfig.enabled ? 'bg-amber-500' : 'bg-slate-300'}`} 
                  onClick={() => updateCurrency({ enabled: !currencyConfig.enabled })}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${currencyConfig.enabled ? 'translate-x-7' : ''}`} />
                </div>
              </div>

              {currencyConfig.enabled && (
                <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Название валюты</label>
                      <input 
                        type="text" 
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition" 
                        value={currencyConfig.name} 
                        onChange={e => updateCurrency({ name: e.target.value })} 
                        placeholder="например: Звёзды, Монеты, Кристаллы" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Символ / Иконка валюты</label>
                      <input 
                        type="text" 
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition" 
                        value={currencyConfig.symbol} 
                        onChange={e => updateCurrency({ symbol: e.target.value })} 
                        placeholder="например: ⭐, 💎, 🪙, 🔥" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Стартовый баланс для новых пользователей</label>
                    <input 
                      type="number" 
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition" 
                      value={currencyConfig.initialBalance} 
                      onChange={e => updateCurrency({ initialBalance: Number(e.target.value) || 0 })} 
                      placeholder="50" 
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Сколько единиц валюты бесплатно получает каждый новый пользователь при первом обращении к боту.</p>
                  </div>

                  {/* Payment link & warning configuration */}
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <CreditCard size={18} className="text-amber-600" />
                      <span>Привязка ссылки на платеж для покупки валюты</span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">URL ссылки на оплату / пополнение</label>
                      <input 
                        type="text" 
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-mono" 
                        value={currencyConfig.paymentUrl || ''} 
                        onChange={e => updateCurrency({ paymentUrl: e.target.value })} 
                        placeholder="https://pay.example.com/checkout?user={user_uid}" 
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Ссылка на ваш сайт, шлюз оплаты (Stripe, CloudPayments, Tinkoff, ЮКасса и др.). Поддерживает макрос <code className="bg-slate-100 px-1 rounded text-slate-700">{'{user_uid}'}</code>.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Текст предупреждения безопасности перед переходом</label>
                      <textarea 
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 mt-1 resize-none h-20 outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition" 
                        value={currencyConfig.paymentWarningText || ''} 
                        onChange={e => updateCurrency({ paymentWarningText: e.target.value })} 
                        placeholder="Внимание: вы переходите на внешнюю страницу оплаты..." 
                      />
                      <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-800 mt-2">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          При нажатии на ссылку покупки валюты пользователю обязательно будет показано модальное окно с этим предупреждением и подтверждением перехода.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-generate helper rules */}
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => {
                        const balanceRule: BotRule = {
                          id: uuidv4(),
                          trigger: { id: uuidv4(), type: 'command', params: { value: '/balance' } },
                          actions: [{
                            id: uuidv4(),
                            order: 0,
                            type: 'check_balance',
                            params: { text: `💰 Ваш текущий баланс: {balance} ${currencyConfig.symbol || '⭐'} (${currencyConfig.name || 'валюты'})` }
                          }]
                        };
                        setBot({
                          ...bot,
                          currency: { ...currencyConfig, enabled: true },
                          rules: [...(bot.rules || []), balanceRule]
                        });
                        alert('Правило /balance успешно добавлено в Flow бота!');
                      }}
                      className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl transition flex items-center gap-2"
                    >
                      <Sparkles size={15} className="text-amber-600" />
                      <span>Добавить в Flow команду проверки баланса (/balance)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
           <div className="max-w-3xl mx-auto space-y-6 pb-20">
             <div className="flex flex-col gap-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="font-bold text-lg text-slate-700">Настройки бота</h3>
               <p className="text-sm text-slate-500">Дополнительные настройки для вашего бота.</p>
               
               <div className="mt-4 flex flex-col gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">URL Аватара</label>
                   <input type="text" className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1 outline-none focus:bg-white" value={bot.avatarUrl || ''} onChange={e => { const updated = {...bot, avatarUrl: e.target.value}; setBot(updated); }} placeholder="https://..." />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Описание бота (about)</label>
                   <textarea className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1 resize-none h-20 outline-none focus:bg-white" value={bot.description || ''} onChange={e => { const updated = {...bot, description: e.target.value}; setBot(updated); }} placeholder="Что умеет этот бот..." />
                 </div>
               </div>
               
               <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                 <h4 className="font-bold text-sm text-blue-800 mb-1">Скрытая рассылка</h4>
                 <p className="text-xs text-blue-600/80 mb-2">Бот автоматически собирает пользователей, которые ему писали (Текущая аудитория: {bot.usersList ? bot.usersList.length : 0} чел).</p>
                 <p className="text-xs text-blue-600/80">
                   Отправьте боту в личные сообщения команду <code className="bg-blue-100 px-1 rounded">/рассылка Ваш текст</code> (или <code>/команда Ваш текст</code>), чтобы бот разослал это сообщение всей своей аудитории. Эта команда работает только для создателя бота.
                 </p>
               </div>
               
               <div className="mt-6 p-4 border border-red-100 bg-red-50 rounded-xl relative overflow-hidden">
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
        {activeTab === 'flow' && (
           <div className="max-w-3xl mx-auto space-y-6 pb-20">
             <div className="flex flex-col gap-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Имя бота</label>
                 <input type="text" className="w-full text-lg font-bold bg-transparent border-b border-slate-100 outline-none pb-1 mt-1" value={bot.name} onChange={e => setBot({...bot, name: e.target.value})} placeholder="Мой Супер Бот" />
               </div>
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Юзернейм (уникальный)</label>
                 <div className="flex items-center text-slate-400 mt-1">
                   <span className="font-bold mr-1">@</span>
                   <input type="text" className="w-full text-sm bg-transparent border-b border-slate-100 outline-none pb-1 text-slate-700" value={bot.username || ''} onChange={e => setBot({...bot, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})} placeholder="my_super_bot" />
                 </div>
               </div>
             </div>
             
             {/* Rules */}
              <div className="space-y-6">
                 {(bot.rules || []).map((rule, ruleIdx) => (
                    <div key={rule.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm relative">
                       <button onClick={() => setBot({...bot, rules: bot.rules?.filter(r => r.id !== rule.id)})} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><X size={16} /></button>
                       <h3 className="font-bold text-sm mb-4 text-slate-700">Правило #{ruleIdx + 1}</h3>
                       
                       <div className="mb-4">
                         <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-700 bg-blue-50 py-1.5 px-3 rounded-lg w-max text-blue-700"><Play size={14} /> ЕСЛИ (Триггер)</div>
                         <select 
                           className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:bg-white"
                           value={rule.trigger.type}
                           onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, trigger: {...r.trigger, type: e.target.value as any}} : r)})}
                         >
                           <option value="command">При команде (начинается с...)</option>
                           <option value="text">Текст содержит фразу/слово</option>
                           <option value="new_member">Новый участник зашел в чат</option>
                         </select>
                         
                         {rule.trigger.type === 'command' && (
                           <input type="text" placeholder="/start" className="w-full mt-2 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-sm" value={rule.trigger.params?.value || ''} onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, trigger: {...r.trigger, params: {value: e.target.value}}} : r)})} />
                         )}
                         {rule.trigger.type === 'text' && (
                           <input type="text" placeholder="Кодовое слово" className="w-full mt-2 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-sm" value={rule.trigger.params?.value || ''} onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, trigger: {...r.trigger, params: {value: e.target.value}}} : r)})} />
                         )}
                       </div>

                       {/* Conditions */}
                       <div className="mb-4 pl-4 border-l-2 border-indigo-100">
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 py-1 px-2 rounded w-max"><Play size={12} /> УСЛОВИЯ (И)</div>
                           <button onClick={() => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, conditions: [...(r.conditions || []), { id: Date.now().toString(), type: 'variable_equals', params: { key: '', value: '' } }]} : r)})} className="text-xs text-indigo-600 font-bold hover:underline">
                             + Добавить условие
                           </button>
                         </div>
                         {(rule.conditions || []).map((cond, cIdx) => (
                           <div key={cond.id} className="flex flex-col gap-2 mb-3 bg-indigo-50/50 p-2 rounded-lg relative">
                             <button onClick={() => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, conditions: r.conditions?.filter(c => c.id !== cond.id)} : r)})} className="absolute top-2 right-2 text-indigo-300 hover:text-red-500"><X size={12} /></button>
                             <select className="w-[90%] bg-white border border-indigo-100 rounded text-xs p-1" value={cond.type} onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, conditions: r.conditions?.map(c => c.id === cond.id ? {...c, type: e.target.value as any} : c)} : r)})}>
                                <option value="variable_equals">Состояние (переменная) РАВНО</option>
                                <option value="variable_not_equals">Состояние (переменная) НЕ РАВНО</option>
                                <option value="variable_exists">Состояние (переменная) УСТАНОВЛЕНО</option>
                                <option value="variable_not_exists">Состояние (переменная) НЕ УСТАНОВЛЕНО</option>
                             </select>
                             <p className="text-[10px] text-indigo-400 mb-1 px-1">Указывайте ключ без <b>`var.`</b> (например: <code>city</code>).</p>
                             <div className="flex gap-2">
                               <input type="text" placeholder="key (назв.)" className="flex-1 bg-white border border-indigo-100 rounded text-xs p-1" value={cond.params.key || ''} onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, conditions: r.conditions?.map(c => c.id === cond.id ? {...c, params: {...c.params, key: e.target.value}} : c)} : r)})} />
                               {(cond.type === 'variable_equals' || cond.type === 'variable_not_equals') && (
                                 <input type="text" placeholder="value (знач.)" className="flex-1 bg-white border border-indigo-100 rounded text-xs p-1" value={cond.params.value || ''} onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, conditions: r.conditions?.map(c => c.id === cond.id ? {...c, params: {...c.params, value: e.target.value}} : c)} : r)})} />
                               )}
                             </div>
                           </div>
                         ))}
                       </div>
                       
                       <div className="mt-2 flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
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
                       <div className="mt-6 border-t border-slate-100 pt-4">
                         <div className="flex items-center gap-2 mb-2 text-sm font-bold text-slate-700 bg-emerald-50 py-1.5 px-3 rounded-lg w-max text-emerald-700"><Check size={14} /> ТО (Действия)</div>
                         
                         <div className="space-y-3">
                           {rule.actions.map((a, actIdx) => (
                              <div key={a.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 relative">
                                <button onClick={() => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.filter(ac => ac.id !== a.id)} : r)})} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X size={14} /></button>
                                <select 
                                  className="w-[90%] bg-white border border-slate-200 rounded-lg p-2 text-sm mb-2 font-medium"
                                  value={a.type}
                                  onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, type: e.target.value as any} : ac)} : r)})}
                                >
                                  <option value="send_message">Отправить сообщение</option>
                                  <option value="charge_currency">💰 Списать валюту бота (платное действие)</option>
                                  <option value="reward_currency">🎉 Начислить валюту бота (награда)</option>
                                  <option value="check_balance">💳 Проверить баланс пользователя</option>
                                  <option value="set_variable">Изменить состояние (переменную)</option>
                                  <option value="fetch_random_user">Найти случайную анкету</option>
                                  <option value="wait_feedback">Запросить ввод (Обратная связь)</option>
                                  <option value="send_message_to_user">Написать пользователю (@ или UID)</option>
                                  <option value="moderate">Удалить / Забанить</option>
                                </select>
                                
                                {a.type === 'set_variable' && (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                      <input 
                                         type="text" placeholder="Название переменной" 
                                         className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" 
                                         value={a.params?.key || ''} 
                                         onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, key: e.target.value}} : ac)} : r)})}
                                      />
                                      <input 
                                         type="text" placeholder="Значение" 
                                         className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" 
                                         value={a.params?.value || ''} 
                                         onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, value: e.target.value}} : ac)} : r)})}
                                      />
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-tight">Подсказка: чтобы сбросить (удалить) состояние, просто оставьте поле «Значение» пустым.</p>
                                  </div>
                                )}

                                {a.type === 'send_message' && (
                                  <div className="flex flex-col gap-2">
                                    <textarea 
                                      placeholder="Текст сообщения..." 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none h-20" 
                                      value={a.params?.text || ''} 
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, text: e.target.value}} : ac)} : r)})}
                                    />
                                    <p className="text-[10px] text-slate-500 bg-slate-100 p-2 rounded-lg leading-tight">
                                      <b>Переменные для текста:</b> <code className="bg-white px-1 rounded">{'{user_name}'}</code> (имя), <code className="bg-white px-1 rounded">{'{user_username}'}</code> (@юзернейм), <code className="bg-white px-1 rounded">{'{user_uid}'}</code> (ID), <code className="bg-white px-1 rounded">{'{message}'}</code> (введенный текст). <br/>
                                      <b>Сохраненные состояния из прошлых шагов:</b> <code className="bg-white px-1 rounded">{'{var.КЛЮЧ}'}</code> (например, <code>{'{var.city}'}</code>).
                                    </p>
                                    <textarea 
                                      placeholder="Inline-кнопки (Кнопка | url: https://...)" 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs resize-none h-14"
                                      value={(() => {
                                        if (!a.params?.inlineButtons) return '';
                                        return a.params.inlineButtons.map((row: any[]) => row.map(btn => {
                                           if (btn.action === 'copy') return `${btn.text} | copy: ${btn.actionData}`;
                                           return `${btn.text} | ${btn.url ? 'url: ' + btn.url : 'cmd: ' + btn.callbackData}`;
                                        }).join(' ;; ')).join('\n');
                                      })()}
                                      onChange={e => {
                                        const text = e.target.value;
                                        const rows = text.split('\n').filter(r => r.trim()).map(r => 
                                          r.split(';;').map(b => b.trim()).filter(b => b).map(b => {
                                            const parts = b.split('|');
                                            const name = parts[0]?.trim();
                                            const act = parts.slice(1).join('|')?.trim();
                                            if (act?.startsWith('url:')) return { text: name, url: act.replace('url:', '').trim() };
                                            if (act?.startsWith('cmd:')) return { text: name, callbackData: act.replace('cmd:', '').trim() };
                                            if (act?.startsWith('copy:')) return { text: name, action: 'copy', actionData: act.replace('copy:', '').trim() };
                                            return { text: name, callbackData: act };
                                          })
                                        );
                                        setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, inlineButtons: rows}} : ac)} : r)});
                                      }}
                                    />
                                    <div className="text-[10px] text-slate-500 bg-blue-50/50 p-2 rounded-lg mt-1 border border-blue-100">
                                      Создавайте кнопки в формате: <b>Текст | действие</b>. Разделитель кнопок на одном ряду: <b>;;</b>. Каждая новая строка — новый ряд.
                                      <ul className="list-disc pl-4 mt-1 space-y-1">
                                        <li><b>url: https://...</b> — открывает ссылку</li>
                                        <li><b>cmd: /название</b> — отправляет команду от имени нажавшего</li>
                                        <li><b>copy: текст</b> — копирует нужный текст в буфер обмена</li>
                                      </ul>
                                    </div>
                                  </div>
                                )}
                                
                                 {a.type === 'fetch_random_user' && (
                                   <div className="flex flex-col gap-2">
                                     <p className="text-[10px] text-slate-500 bg-blue-50/50 p-2 rounded-lg mt-1 border border-blue-100">
                                       Находит случайного пользователя и сохраняет его данные для следующих действий в этом правиле. 
                                       <br/>Используйте переменные в текстах сообщений: <br/>
                                       <b>{'{random.id}'}</b>, <b>{'{random.name}'}</b>, <b>{'{random.about}'}</b>, <b>{'{random.username}'}</b>
                                     </p>
                                   </div>
                                 )}
                                 
                                 {a.type === 'send_message_to_user' && (
                                  <div className="flex flex-col gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="@username или UID пользователя" 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                      value={a.params?.target || ''}
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, target: e.target.value}} : ac)} : r)})}
                                    />
                                    <textarea 
                                      placeholder="Текст сообщения..." 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none h-20" 
                                      value={a.params?.text || ''} 
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, text: e.target.value}} : ac)} : r)})}
                                    />
                                    <p className="text-[10px] text-slate-500 bg-slate-100 p-2 rounded-lg leading-tight mt-1">
                                      <b>Переменные работают в адресате и тексте:</b> <code className="bg-white px-1 rounded">{'{user_name}'}</code>, <code className="bg-white px-1 rounded">{'{user_uid}'}</code>, <code className="bg-white px-1 rounded">{'{var.КЛЮЧ}'}</code>.<br/>
                                      <i>Пример: отправить UID <code>{'{var.target_id}'}</code> текст «Вам пишет {'{user_name}'}».</i>
                                    </p>
                                    <p className="text-[10px] text-slate-400 px-1 italic">Бот отправит это сообщение в личные сообщения указанному адресату.</p>
                                  </div>
                                )}
                                
                                {a.type === 'wait_feedback' && (
                                  <div className="flex flex-col gap-2">
                                    <textarea 
                                      placeholder="Текст запроса..." 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm resize-none h-16" 
                                      value={a.params?.text || ''} 
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, text: e.target.value}} : ac)} : r)})}
                                    />
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide px-1">Кому переслать (UID пользователя)</label>
                                      <input 
                                        type="text" 
                                        placeholder="UID (например: uid_123)" 
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                        value={a.params?.forwardToUid || ''}
                                        onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, forwardToUid: e.target.value}} : ac)} : r)})}
                                      />
                                      <p className="text-[10px] text-slate-400 px-1">Ответ пользователя будет переслан этому ID.</p>
                                    </div>
                                  </div>
                                )}
                                
                                {a.type === 'moderate' && (
                                  <select 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm mt-1"
                                    value={a.params?.action || 'delete'}
                                    onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, action: e.target.value}} : ac)} : r)})}
                                  >
                                    <option value="delete">Удалить это сообщение</option>
                                    <option value="delete_reply">Удалить сообщение (по реплаю)</option>
                                    <option value="mute">Мут (отправителю)</option>
                                    <option value="mute_reply">Мут (по реплаю)</option>
                                    <option value="ban">Забанить (отправителя)</option>
                                    <option value="ban_reply">Забанить (по реплаю)</option>
                                    <option value="warn">Предупреждение (отправителю)</option>
                                    <option value="warn_reply">Предупреждение (по реплаю)</option>
                                    <option value="unmute_reply">Снять мут (по реплаю)</option>
                                    <option value="unban_reply">Снять бан (по реплаю)</option>
                                    
                                  </select>
                                )}

                                {a.type === 'charge_currency' && (
                                  <div className="flex flex-col gap-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                      <Coins size={14} className="text-amber-600" />
                                      <span>Списание валюты за действие</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-slate-600 whitespace-nowrap">Стоимость:</label>
                                      <input 
                                        type="number" 
                                        placeholder="10" 
                                        className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold" 
                                        value={a.params?.amount ?? 10} 
                                        onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, amount: Number(e.target.value) || 0}} : ac)} : r)})}
                                      />
                                      <span className="text-xs text-slate-500 font-medium">{currencyConfig.symbol || '⭐'} ({currencyConfig.name || 'валюты'})</span>
                                    </div>
                                    <textarea 
                                      placeholder="Текст при успешной оплате (например: 'Оплата принята! Вот ваш контент:...')" 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs resize-none h-14 mt-1" 
                                      value={a.params?.text || ''} 
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, text: e.target.value}} : ac)} : r)})}
                                    />
                                    <textarea 
                                      placeholder="Текст при нехватке баланса (если пусто, бот автоматически предложит пополнить баланс по ссылке)" 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs resize-none h-14" 
                                      value={a.params?.insufficientText || ''} 
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, insufficientText: e.target.value}} : ac)} : r)})}
                                    />
                                  </div>
                                )}

                                {a.type === 'reward_currency' && (
                                  <div className="flex flex-col gap-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                                      <Sparkles size={14} className="text-emerald-600" />
                                      <span>Начисление валюты (бонус/награда)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-slate-600 whitespace-nowrap">Сумма начисления:</label>
                                      <input 
                                        type="number" 
                                        placeholder="5" 
                                        className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold" 
                                        value={a.params?.amount ?? 5} 
                                        onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, amount: Number(e.target.value) || 0}} : ac)} : r)})}
                                      />
                                      <span className="text-xs text-slate-500 font-medium">{currencyConfig.symbol || '⭐'}</span>
                                    </div>
                                    <textarea 
                                      placeholder="Текст сообщения о награде (например: 'Поздравляем! Вам начислено {balance}...')" 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs resize-none h-14 mt-1" 
                                      value={a.params?.text || ''} 
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, text: e.target.value}} : ac)} : r)})}
                                    />
                                  </div>
                                )}

                                {a.type === 'check_balance' && (
                                  <div className="flex flex-col gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                                    <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                                      <CreditCard size={14} className="text-blue-600" />
                                      <span>Проверка баланса пользователя</span>
                                    </div>
                                    <textarea 
                                      placeholder="Текст сообщения с балансом (поддерживает {balance})" 
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs resize-none h-14" 
                                      value={a.params?.text || ''} 
                                      onChange={e => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: r.actions.map(ac => ac.id === a.id ? {...ac, params: {...ac.params, text: e.target.value}} : ac)} : r)})}
                                    />
                                    <p className="text-[10px] text-slate-500">
                                      Бот автоматически выведет инлайн-кнопку «Пополнить баланс» со ссылкой на оплату, если она указана во вкладке «Валюта и Платежи».
                                    </p>
                                  </div>
                                )}
                              </div>
                           ))}
                           
                           <button 
                             onClick={() => setBot({...bot, rules: bot.rules?.map(r => r.id === rule.id ? {...r, actions: [...r.actions, { id: uuidv4(), type: 'send_message', params: {}, order: r.actions.length }]} : r)})}
                             className="text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors w-full text-center p-2 rounded-lg hover:bg-emerald-50"
                           >
                             + Добавить действие
                           </button>
                         </div>
                       </div>
                    </div>
                 ))}
                 
                 <button 
                   onClick={() => setBot({...bot, rules: [...(bot.rules || []), { id: uuidv4(), trigger: { id: uuidv4(), type: 'command', params: {} }, actions: [] }]})}
                   className="flex items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-xl py-3 text-blue-500 hover:bg-blue-50 w-full font-bold transition-colors text-sm"
                 >
                   + Новое правило
                 </button>
              </div>
            </div>
         )}

      </div>
    </div>
  );
}
