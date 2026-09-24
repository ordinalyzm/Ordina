import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle } from 'lucide-react';
import { ReportCategory } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'message' | 'user' | 'group';
  targetId: string;
  targetName?: string;
  chatId?: string;
  messageContext?: {
    messageId?: string;
    text?: string;
    senderId?: string;
    senderName?: string;
    fileUrl?: string;
    chatId?: string;
    createdAt?: string;
    [key: string]: any;
  };
  onSubmit: (report: any) => void;
}

const CATEGORIES: { id: ReportCategory; title: string; law: string }[] = [
  { id: 'extremism', title: 'Экстремизм и призывы к насилию', law: 'Ст. 280, 205.2 УК РФ' },
  { id: 'insult', title: 'Оскорбления и травля', law: 'Ст. 5.61 КоАП РФ' },
  { id: 'doxing', title: 'Публикация личных данных (Деанон)', law: 'Ст. 137 УК РФ' },
  { id: 'fraud', title: 'Мошенничество и вымогательство', law: 'Ст. 159 УК РФ' },
  { id: 'spam', title: 'Спам и вредоносные рассылки', law: 'Правила платформы Ордина' },
  { id: 'violence', title: 'Угроза причинения вреда', law: 'Ст. 119 УК РФ' },
  { id: 'drugs', title: 'Запрещенные вещества', law: 'Ст. 228.1 УК РФ' },
  { id: 'other', title: 'Иное нарушение', law: 'Правила сообщества' }
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetName,
  messageContext,
  onSubmit
}) => {
  const [selectedCat, setSelectedCat] = useState<ReportCategory>('insult');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const catObj = CATEGORIES.find(c => c.id === selectedCat) || CATEGORIES[0];
    onSubmit({
      targetType,
      targetId,
      targetName,
      reasonCategory: selectedCat,
      reasonCategoryTitle: catObj.title,
      legalBasis: catObj.law,
      description: description.trim(),
      messageContext
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>Подать жалобу модераторам</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {targetName && (
          <div className="text-xs text-zinc-400">
            Объект жалобы: <strong className="text-zinc-200">{targetName}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Причина нарушения</label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value as ReportCategory)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-red-500"
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.law})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Дополнительные сведения</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Укажите подробности нарушения..."
              rows={3}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md shadow-red-600/20"
            >
              Отправить жалобу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
