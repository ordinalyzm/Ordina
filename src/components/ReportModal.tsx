import React, { useState } from 'react';
import { X, AlertTriangle, ShieldAlert, CheckCircle, Flag, Info } from 'lucide-react';
import { ReportCategory } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'message' | 'user' | 'group';
  targetId: string;
  targetName?: string;
  chatId?: string;
  messageContext?: {
    id?: string;
    text?: string;
    type?: string;
    fileUrl?: string;
    senderId?: string;
    senderName?: string;
    createdAt?: string;
  };
  onSubmitReport?: (data: {
    targetType: 'message' | 'user' | 'group';
    targetId: string;
    targetName?: string;
    chatId?: string;
    messageContext?: any;
    reasonCategory: ReportCategory;
    reasonCategoryTitle: string;
    description: string;
  }) => void;
  onSubmit?: (data: any) => void;
}

interface CategoryOption {
  id: ReportCategory;
  title: string;
  lawReference: string;
  description: string;
}

const REPORT_CATEGORIES: CategoryOption[] = [
  {
    id: 'extremism',
    title: 'Экстремизм, терроризм и разжигание вражды',
    lawReference: 'Ст. 205.2, 280, 282 УК РФ',
    description: 'Публичные призывы к терроризму, возбуждение ненависти либо вражды, экстремистские материалы.'
  },
  {
    id: 'harassment',
    title: 'Оскорбления, угрозы и травля (буллинг)',
    lawReference: 'Ст. 5.61 КоАП РФ, ст. 119 УК РФ',
    description: 'Унижение чести и достоинства, прямые угрозы расправой, систематическая травля.'
  },
  {
    id: 'doxxing',
    title: 'Распространение личных данных (доксинг)',
    lawReference: 'Ст. 137 УК РФ, ФЗ № 152-ФЗ',
    description: 'Публикация персональных данных, адресов, номеров телефонов без согласия субъекта.'
  },
  {
    id: 'fraud',
    title: 'Мошенничество и вымогательство денег',
    lawReference: 'Ст. 159, 163 УК РФ',
    description: 'Обман с целью хищения средств, вымогательство, сбор денег под предлогом фейковых сборов.'
  },
  {
    id: 'spam',
    title: 'Спам, фишинг и вредоносные ссылки',
    lawReference: 'Ст. 273 УК РФ, ст. 18 ФЗ «О рекламе»',
    description: 'Массовая нежелательная рассылка, ссылки на кражу аккаунтов, вредоносное ПО.'
  },
  {
    id: 'csam',
    title: 'Детская порнография и эксплуатация (CSAM)',
    lawReference: 'Ст. 242.1, 242.2 УК РФ, Конвенция ООН',
    description: 'Любые формы материалов сексуального насилия над несовершеннолетними (нулевая терпимость).'
  },
  {
    id: 'violence_suicide',
    title: 'Насилие, жестокость и призывы к суициду',
    lawReference: 'Ст. 110.1, 110.2 УК РФ',
    description: 'Пропаганда членовредительства, склонение к самоубийству, шок-контент с жестокостью.'
  },
  {
    id: 'drugs',
    title: 'Пропаганда и сбыт наркотических средств',
    lawReference: 'Ст. 6.13 КоАП РФ, ст. 228.1 УК РФ',
    description: 'Реклама закладок, магазинов ПАВ, инструкции по изготовлению и потреблению веществ.'
  },
  {
    id: 'copyright',
    title: 'Нарушение авторских и смежных прав',
    lawReference: 'Ст. 146 УК РФ, ч. IV ГК РФ, DMCA',
    description: 'Незаконное распространение чужой интеллектуальной собственности, пиратские базы.'
  },
  {
    id: 'other',
    title: 'Иное грубое нарушение правил',
    lawReference: 'Регламент Ордины',
    description: 'Другие действия, грубо нарушающие безопасность пользователей и порядок в сообществе.'
  }
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetName,
  chatId,
  messageContext,
  onSubmitReport,
  onSubmit
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('harassment');
  const [description, setDescription] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const category = REPORT_CATEGORIES.find(c => c.id === selectedCategory) || REPORT_CATEGORIES[0];
    
    const reportData = {
      targetType,
      targetId,
      targetName,
      chatId,
      messageContext,
      reasonCategory: category.id,
      reasonCategoryTitle: category.title,
      description: description.trim()
    };

    if (onSubmitReport) {
      onSubmitReport(reportData);
    } else if (onSubmit) {
      onSubmit(reportData);
    }

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setDescription('');
      onClose();
    }, 1500);
  };

  const getTargetTitle = () => {
    if (targetType === 'message') return 'Пожаловаться на сообщение';
    if (targetType === 'user') return `Пожаловаться на пользователя ${targetName ? `«${targetName}»` : ''}`;
    return `Пожаловаться на группу/канал ${targetName ? `«${targetName}»` : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{getTargetTitle()}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Жалоба будет направлена администрации и дежурным модераторам</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Жалоба успешно отправлена</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
              Модераторы Ордины проверят контекст и примут меры в соответствии с регламентом и законодательством РФ.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Context preview */}
              {messageContext && (
                <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 mb-1 flex items-center justify-between">
                    <span>Автор сообщения: {messageContext.senderName || 'Пользователь'}</span>
                    {messageContext.createdAt && (
                      <span className="text-zinc-400 text-[11px]">{new Date(messageContext.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  <div className="line-clamp-3 italic text-zinc-600 dark:text-zinc-400">
                    {messageContext.text || (messageContext.fileUrl ? '📷 Прикрепленный медиафайл' : 'Сообщение')}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Причина нарушения (законодательство РФ и регламент)
                </label>
                <div className="space-y-2">
                  {REPORT_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 shadow-sm'
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportCategory"
                          value={cat.id}
                          checked={isSelected}
                          onChange={() => setSelectedCategory(cat.id)}
                          className="mt-0.5 text-red-600 focus:ring-red-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {cat.title}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                              {cat.lawReference}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {cat.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Дополнительные сведения (необязательно)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите подробности нарушения или контекст ситуации..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                />
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Заведомо ложные жалобы и злоупотребление функцией модерации могут повлечь временное ограничение вашей учетной записи.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Flag className="w-4 h-4" />
                Отправить жалобу
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
