// src/components/BugReportModal.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bug, Lightbulb, Send, CheckCircle2, MessageSquare } from 'lucide-react';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { uid: string; displayName?: string; email?: string } | null;
  onSubmit: (data: {
    type: 'bug' | 'suggestion';
    title: string;
    description: string;
    contact?: string;
  }) => Promise<void>;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubmit,
}) => {
  const [type, setType] = useState<'bug' | 'suggestion'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        type,
        title: title.trim(),
        description: description.trim(),
        contact: contact.trim() || currentUser?.email || undefined,
      });
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        setContact('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[10005] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                type === 'bug' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {type === 'bug' ? <Bug size={20} /> : <Lightbulb size={20} />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Баги и предложения</h2>
                <p className="text-xs text-slate-400">Прямая связь с разработчиком (админом)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {isSuccess ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <CheckCircle2 size={48} className="text-emerald-400 animate-bounce" />
                <h3 className="text-lg font-bold text-white">Сообщение отправлено!</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Администратор получил ваше обращение и ответит вам в личных сообщениях.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      type === 'bug'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bug size={16} />
                    Сообщить о баге
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('suggestion')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      type === 'suggestion'
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Lightbulb size={16} />
                    Идея / Предложение
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {type === 'bug' ? 'Что пошло не так?' : 'Краткая суть идеи'}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={type === 'bug' ? 'Например: Не отправляются стикеры в оффлайне' : 'Например: Добавить темы оформления'}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    {type === 'bug' ? 'Подробные шаги для воспроизведения' : 'Подробное описание'}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={type === 'bug' ? 'Опишите, как воспроизвести ошибку, какое у вас устройство и что произошло...' : 'Опишите, как эта функция должна работать и почему она полезна...'}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                {/* Contact info */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Контакты для обратной связи (необязательно)
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Ваш ник, Telegram или email"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Note */}
                <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-2xl flex items-start gap-2.5">
                  <MessageSquare size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-cyan-300 leading-relaxed">
                    Админ получит ваше сообщение напрямую. Ответ придёт в чат или на указанные контакты.
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                    type === 'bug'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30'
                      : 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/30'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Send size={18} />
                  {isSubmitting ? 'Отправка...' : 'Отправить админу'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
