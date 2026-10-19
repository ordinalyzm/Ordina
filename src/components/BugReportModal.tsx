// src/components/BugReportModal.tsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Bug, Lightbulb, Send, CheckCircle2, Mail, ExternalLink, 
  ShieldCheck, Smartphone, Clock, Filter, AlertTriangle, 
  Check, RefreshCw, MessageSquare, ChevronRight, User, CheckCircle
} from 'lucide-react';
import { UserProfile } from '../types';

export interface BugReportItem {
  id: string;
  type: 'bug' | 'suggestion' | 'complaint';
  title: string;
  description: string;
  contact?: string;
  systemInfo?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'dismissed';
  senderId?: string;
  senderName?: string;
  senderEmail?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolutionNote?: string;
}

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  reports?: BugReportItem[];
  isSuperAdmin?: boolean;
  onSubmit: (data: {
    type: 'bug' | 'suggestion';
    title: string;
    description: string;
    contact?: string;
    systemInfo?: string;
  }) => Promise<void>;
  onUpdateStatus?: (reportId: string, status: 'pending' | 'in_progress' | 'resolved' | 'dismissed', resolutionNote?: string) => Promise<void>;
  onRefresh?: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  reports = [],
  isSuperAdmin = false,
  onSubmit,
  onUpdateStatus,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'submit' | 'list' | 'manage'>(isSuperAdmin ? 'manage' : 'submit');
  const [type, setType] = useState<'bug' | 'suggestion'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState(currentUser?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Filters for reports list
  const [filterType, setFilterType] = useState<'all' | 'bug' | 'suggestion'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'resolved' | 'dismissed'>('all');
  const [selectedItem, setSelectedItem] = useState<BugReportItem | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!isOpen) return null;

  const getSystemInfo = () => {
    return `Устройство: ${navigator.userAgent.includes('Mobile') ? 'Мобильное' : 'Десктоп'} | Платформа: ${navigator.platform} | Разрешение: ${window.innerWidth}x${window.innerHeight} | Язык: ${navigator.language}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        title: title.trim(),
        description: description.trim(),
        contact: contact.trim() || currentUser?.email || 'Не указан',
        systemInfo: getSystemInfo()
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        if (reports.length > 0) {
          setActiveTab('list');
        } else {
          onClose();
        }
      }, 1500);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: 'pending' | 'in_progress' | 'resolved' | 'dismissed') => {
    if (!selectedItem || !onUpdateStatus) return;
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(selectedItem.id, newStatus, adminNote.trim());
      setSelectedItem(prev => prev ? { ...prev, status: newStatus, resolutionNote: adminNote.trim() } : null);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Error updating status:', e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filtered reports for user / admin
  const filteredReports = reports.filter(r => {
    const matchesType = filterType === 'all' || r.type === filterType;
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesType && matchesStatus;
  });

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[10005] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 pt-[max(calc(env(safe-area-inset-top,0px)+8px),16px)] pb-[max(calc(env(safe-area-inset-bottom,0px)+8px),16px)]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-600/20">
                <Bug size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  Баги и предложения
                </h3>
                <p className="text-xs text-slate-400">
                  Внутренняя служба поддержки и рассмотрения обращений в Ордине
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-800 flex items-center gap-2 bg-slate-950/40 shrink-0">
            <button
              onClick={() => { setActiveTab('submit'); setSelectedItem(null); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'submit' 
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25' 
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Send size={14} />
              <span>Отправить</span>
            </button>

            <button
              onClick={() => { setActiveTab('list'); setSelectedItem(null); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'list' 
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25' 
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <MessageSquare size={14} />
              <span>Обращения ({reports.length})</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => { setActiveTab('manage'); setSelectedItem(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'manage' 
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25' 
                    : 'bg-slate-800/80 text-amber-400 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck size={14} />
                <span>Управление (как модерация)</span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="ml-auto p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Обновить"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
            {activeTab === 'submit' && (
              <>
                {isSuccess ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }}
                    className="py-12 flex flex-col items-center justify-center text-center space-y-3"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-white">Обращение успешно отправлено!</h4>
                    <p className="text-sm text-slate-400 max-w-sm">
                      Разработчик уже получил ваше уведомление. Спасибо за помощь в развитии Ordina!
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Selector */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setType('bug')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                          type === 'bug' 
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Bug size={15} />
                        Сообщить о баге
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('suggestion')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                          type === 'suggestion' 
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Lightbulb size={15} />
                        Предложить идею
                      </button>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        {type === 'bug' ? 'Что пошло не так? (Кратко)' : 'Суть вашего предложения'}
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={type === 'bug' ? "Например: не воспроизводится трек в музыке" : "Например: добавить эквалайзер"}
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/80 transition-all"
                        required
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Подробное описание
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        placeholder={type === 'bug' ? "Опишите шаги, чтобы воспроизвести ошибку, и что именно произошло..." : "Опишите подробнее, как эта функция должна работать и чем она полезна..."}
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/80 transition-all resize-none"
                        required
                      />
                    </div>

                    {/* Contact Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Ваш контакт для обратной связи (по желанию)
                      </label>
                      <input
                        type="text"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="Email или Telegram username"
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/80 transition-all"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        Отмена
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting || !title.trim() || !description.trim()}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-rose-600/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <Send size={15} />
                        <span>{isSubmitting ? 'Отправка...' : 'Отправить в Ордину'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {(activeTab === 'list' || activeTab === 'manage') && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Filter size={12} /> Тип:
                    </span>
                    {(['all', 'bug', 'suggestion'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                          filterType === t 
                            ? 'bg-slate-700 text-white' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {t === 'all' ? 'Все' : t === 'bug' ? '🐛 Баги' : '💡 Идеи'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Статус:</span>
                    {(['all', 'pending', 'in_progress', 'resolved'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                          filterStatus === st 
                            ? 'bg-rose-600 text-white' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        {st === 'all' ? 'Все' : st === 'pending' ? 'Ожидает' : st === 'in_progress' ? 'В работе' : 'Решено'}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedItem ? (
                  /* Detail / Action View */
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setSelectedItem(null)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-bold"
                      >
                        ← Назад к списку
                      </button>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        selectedItem.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        selectedItem.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {selectedItem.status === 'resolved' ? 'Решено' : selectedItem.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-xs text-rose-400 font-bold mb-1">
                        {selectedItem.type === 'bug' ? <Bug size={14} /> : <Lightbulb size={14} />}
                        <span>{selectedItem.type === 'bug' ? 'Баг-репорт' : 'Предложение'}</span>
                        <span className="text-slate-500">• {new Date(selectedItem.createdAt).toLocaleString('ru-RU')}</span>
                      </div>
                      <h4 className="text-base font-bold text-white">{selectedItem.title}</h4>
                      <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
                        {selectedItem.description}
                      </p>
                    </div>

                    {selectedItem.contact && (
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <User size={13} className="text-slate-500" />
                        <span>Контакт заявителя: <strong className="text-slate-200">{selectedItem.contact}</strong></span>
                      </div>
                    )}

                    {selectedItem.systemInfo && (
                      <div className="text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                        {selectedItem.systemInfo}
                      </div>
                    )}

                    {selectedItem.resolutionNote && (
                      <div className="bg-emerald-950/30 border border-emerald-800/50 p-3 rounded-xl">
                        <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                          <CheckCircle size={14} />
                          <span>Ответ разработчика / модерации:</span>
                        </div>
                        <p className="text-xs text-slate-200 whitespace-pre-wrap">
                          {selectedItem.resolutionNote}
                        </p>
                      </div>
                    )}

                    {/* Admin Actions (like Moderation) */}
                    {isSuperAdmin && onUpdateStatus && (
                      <div className="pt-3 border-t border-slate-800 space-y-3">
                        <label className="block text-xs font-bold text-amber-400">
                          Действие модерации / ответ разработчика:
                        </label>
                        <input
                          type="text"
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Комментарий к решению (будет виден пользователю)..."
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleStatusChange('in_progress')}
                            disabled={isUpdatingStatus}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95"
                          >
                            В работу
                          </button>
                          <button
                            onClick={() => handleStatusChange('resolved')}
                            disabled={isUpdatingStatus}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95"
                          >
                            Отметить как решено
                          </button>
                          <button
                            onClick={() => handleStatusChange('dismissed')}
                            disabled={isUpdatingStatus}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
                          >
                            Отклонить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Reports List */
                  <div className="space-y-2">
                    {filteredReports.length === 0 ? (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        Обращений не найдено
                      </div>
                    ) : (
                      filteredReports.map(item => (
                        <div
                          key={item.id}
                          onClick={() => { setSelectedItem(item); setAdminNote(item.resolutionNote || ''); }}
                          className="p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.type === 'bug' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {item.type === 'bug' ? '🐛 Баг' : '💡 Идея'}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                item.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 font-bold' :
                                item.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400 font-bold' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {item.status === 'resolved' ? 'Решено' : item.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(item.createdAt).toLocaleDateString('ru-RU')}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-white truncate group-hover:text-rose-400">
                              {item.title}
                            </h5>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-slate-500 group-hover:text-white shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
