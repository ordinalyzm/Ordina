import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Plus, Flag, Type, Palette } from 'lucide-react';
import { UserTitle, UserProfile, Group } from '../types';
import { RenderTitle, FLAG_GRADIENTS, AVAILABLE_FONTS } from '../lib/TitleRenderer';

interface TitleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalChannel: Group;
  users: UserProfile[];
  onUpdateUser: (uid: string, updates: Partial<UserProfile>) => void;
  socket: any;
}

export default function TitleManagerModal({ isOpen, onClose, globalChannel, users, onUpdateUser, socket }: TitleManagerModalProps) {
  const [titles, setTitles] = useState<UserTitle[]>([]);
  const [newTitleText, setNewTitleText] = useState('');
  const [newTitleColor, setNewTitleColor] = useState('#3b82f6');
  const [newTitleFont, setNewTitleFont] = useState('Inter');
  const [newTitleFlag, setNewTitleFlag] = useState('');
  const [newTitleGlow, setNewTitleGlow] = useState('');
  const [newTitleBg, setNewTitleBg] = useState('');
  const [newTitleBorder, setNewTitleBorder] = useState('');
  const [newTitleBold, setNewTitleBold] = useState(false);
  const [newTitleItalic, setNewTitleItalic] = useState(false);
  const [newTitleAnimation, setNewTitleAnimation] = useState<'none' | 'pulse' | 'rainbow' | 'shimmer' | 'bounce'>('none');
  const [assignMode, setAssignMode] = useState<UserTitle | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuePercent, setIssuePercent] = useState(0);

  useEffect(() => {
    if (globalChannel) {
      setTitles(globalChannel.createdTitles || []);
    }
  }, [globalChannel]);

  const handleCreate = async () => {
    if (!newTitleText.trim() || !socket) return;
    
    const newTitle: UserTitle = {
      id: crypto.randomUUID(),
      text: newTitleText.trim(),
      color: newTitleColor,
      font: newTitleFont,
      background: newTitleBg || undefined,
      border: newTitleBorder || undefined,
      glowColor: newTitleGlow || undefined,
      isBold: newTitleBold,
      isItalic: newTitleItalic,
      animation: newTitleAnimation
    };
    if (newTitleFlag) {
      newTitle.flagId = newTitleFlag;
    }

    const newTitles = [...titles, newTitle];
    try {
      socket.emit('group:update', { id: 'global_channel', update: { createdTitles: newTitles } });
      setTitles(newTitles);
      setNewTitleText('');
      setNewTitleFlag('');
      setNewTitleGlow('');
      setNewTitleBg('');
      setNewTitleBorder('');
      setNewTitleBold(false);
      setNewTitleItalic(false);
      setNewTitleAnimation('none');
      if ((window as any).addToast) (window as any).addToast('Титул успешно создан', 'success');
    } catch (e) {
      console.error(e);
      if ((window as any).addToast) (window as any).addToast('Ошибка при сохранении титула', 'error');
    }
  };

  const handleDelete = async (titleId: string) => {
    if (!confirm('Точно удалить?') || !socket) return;
    const newTitles = titles.filter(t => t.id !== titleId);
    socket.emit('group:update', { id: 'global_channel', update: { createdTitles: newTitles } });
    setTitles(newTitles);
  };

  const handleAssign = async () => {
    if (!assignMode || selectedUsers.length === 0 || !socket) return;

    setIsIssuing(true);
    setIssuePercent(0);

    const total = selectedUsers.length;
    let completed = 0;

    try {
      for (const uid of selectedUsers) {
        const u = users.find(user => user.uid === uid);
        if (u) {
          const grantedTitles = [...(u.grantedTitles || [])];
          if (!grantedTitles.find(t => t.id === assignMode.id)) {
            grantedTitles.push(assignMode);
            socket.emit('profile:update', { uid, profile: { grantedTitles } });
            onUpdateUser(uid, { grantedTitles });
          }
        }
        completed++;
        setIssuePercent(Math.round((completed / total) * 100));
      }

      if ((window as any).addToast) {
        (window as any).addToast('Титулы успешно выданы!', 'success');
      }
      setTimeout(() => {
        setAssignMode(null);
        setSelectedUsers([]);
        setIsIssuing(false);
        setIssuePercent(0);
      }, 1500);
    } catch (e) {
      console.error(e);
      if ((window as any).addToast) {
        (window as any).addToast('Ошибка при выдаче', 'error');
      }
      setIsIssuing(false);
      setIssuePercent(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 relative">
          <h2 className="font-bold text-lg text-slate-800">
            {assignMode ? 'Выдача титула' : 'Управление титулами'}
          </h2>
          <button 
            onClick={() => assignMode ? setAssignMode(null) : onClose()} 
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {assignMode ? (
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <RenderTitle title={assignMode} className="text-xl px-4 py-2" />
              </div>
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <div className="space-y-2">
                {users.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                  <label key={u.uid} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={selectedUsers.includes(u.uid)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedUsers(prev => [...prev, u.uid]);
                        else setSelectedUsers(prev => prev.filter(id => id !== u.uid));
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 shrink-0 min-w-0">
                      <p className="font-bold text-sm truncate">{u.displayName}</p>
                      <p className="text-xs text-slate-500 truncate">@{u.username}</p>
                    </div>
                  </label>
                ))}
              </div>

              {isIssuing && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 relative z-10">
                    <span>Выдача титулов...</span>
                    <span>{issuePercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden relative z-10">
                    <motion.div 
                      className="bg-blue-600 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${issuePercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2"><Plus size={16}/> Создать новый титул</h3>
                
                <input 
                  value={newTitleText}
                  onChange={e => setNewTitleText(e.target.value)}
                  placeholder="Текст титула..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm"
                />

                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Type size={14}/> Шрифт</label>
                    <select 
                      value={newTitleFont} 
                      onChange={e => setNewTitleFont(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                    >
                      {AVAILABLE_FONTS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Palette size={14}/> Цвет текста</label>
                    <input 
                      type="color" 
                      value={newTitleColor}
                      onChange={e => setNewTitleColor(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1">Цвет фона</label>
                    <input 
                      type="color" 
                      value={newTitleBg || '#ffffff'}
                      onChange={e => setNewTitleBg(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer"
                    />
                    <button onClick={() => setNewTitleBg('')} className="text-[10px] text-blue-600 mt-1">Очистить</button>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1">Цвет обводки</label>
                    <input 
                      type="color" 
                      value={newTitleBorder || '#000000'}
                      onChange={e => setNewTitleBorder(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer"
                    />
                    <button onClick={() => setNewTitleBorder('')} className="text-[10px] text-blue-600 mt-1">Очистить</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1">Свечение</label>
                    <input 
                      type="color" 
                      value={newTitleGlow || '#3b82f6'}
                      onChange={e => setNewTitleGlow(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer"
                    />
                    <button onClick={() => setNewTitleGlow('')} className="text-[10px] text-blue-600 mt-1">Очистить</button>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1">Анимация</label>
                    <select 
                      value={newTitleAnimation}
                      onChange={e => setNewTitleAnimation(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="none">Нет</option>
                      <option value="pulse">Пульсация</option>
                      <option value="rainbow">Радуга</option>
                      <option value="shimmer">Мерцание</option>
                      <option value="bounce">Прыжок</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newTitleBold} onChange={e => setNewTitleBold(e.target.checked)} className="rounded" />
                    <span className="text-xs font-bold">Жирный</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newTitleItalic} onChange={e => setNewTitleItalic(e.target.checked)} className="rounded" />
                    <span className="text-xs font-bold">Курсив</span>
                  </label>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Flag size={14}/> Расцветка флага (переопределяет цвет)</label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <button 
                      onClick={() => setNewTitleFlag('')}
                      className={`px-3 py-1 text-sm rounded ${newTitleFlag === '' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                    >
                      Без флага
                    </button>
                    {Object.keys(FLAG_GRADIENTS).map(f => (
                      <button 
                        key={f}
                        onClick={() => setNewTitleFlag(f)}
                        className={`text-xl p-1 rounded-lg ${newTitleFlag === f ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-slate-100'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-slate-200 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Предпросмотр:</span>
                    <RenderTitle title={{ 
                      id: 'preview', 
                      text: newTitleText || 'ПРИМЕР', 
                      color: newTitleColor, 
                      font: newTitleFont, 
                      flagId: newTitleFlag,
                      background: newTitleBg,
                      border: newTitleBorder,
                      glowColor: newTitleGlow,
                      isBold: newTitleBold,
                      isItalic: newTitleItalic,
                      animation: newTitleAnimation
                    }} />
                  </div>
                  <button 
                    onClick={handleCreate}
                    disabled={!newTitleText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save size={16}/> Сохранить
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-600">Сохраненные титулы ({titles.length})</h3>
                {titles.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <RenderTitle title={t} />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAssignMode(t)}
                        className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold"
                      >
                        Выдать
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {assignMode && (
          <div className="p-4 border-t border-slate-100 bg-white">
            <button 
              onClick={handleAssign}
              disabled={selectedUsers.length === 0 || isIssuing}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={18}/> {isIssuing ? 'Сохранение...' : `Сохранить у ${selectedUsers.length} пользователей`}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
