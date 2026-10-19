import React from 'react';
import { Pin, X, ChevronRight } from 'lucide-react';
import { Message, UserProfile } from '../types';

interface PinnedMessageBannerProps {
  message?: Message | null;
  pinnedMessage?: Message | null;
  totalPinnedCount?: number;
  canUnpin?: boolean;
  onScrollToMessage?: (messageId: string) => void;
  onScrollTo?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  onViewAllPinned?: () => void;
  users?: UserProfile[];
}

export const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  message,
  pinnedMessage,
  totalPinnedCount = 1,
  canUnpin = true,
  onScrollToMessage,
  onScrollTo,
  onUnpin,
  onViewAllPinned
}) => {
  const activeMessage = message || pinnedMessage;
  if (!activeMessage) return null;

  const handleScroll = () => {
    if (onScrollToMessage) {
      onScrollToMessage(activeMessage.id);
    } else if (onScrollTo) {
      onScrollTo(activeMessage.id);
    }
  };

  const getPreviewText = () => {
    if (activeMessage.text) return activeMessage.text;
    if (activeMessage.type === 'sticker' || activeMessage.fileName === 'sticker.jpg') return '🎨 Стикер';
    if (activeMessage.type === 'image') return '📷 Фотография';
    if (activeMessage.type === 'voice' || activeMessage.type === 'audio') return '🎤 Голосовое сообщение';
    if (activeMessage.type === 'file') return `📎 Файл: ${activeMessage.fileName || 'Документ'}`;
    if (activeMessage.type === 'poll') return '📊 Опрос';
    return 'Закрепленное сообщение';
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/95 dark:bg-slate-900 border-b border-amber-300/80 dark:border-slate-800 backdrop-blur-md z-10 transition-all shadow-sm">
      <div 
        onClick={handleScroll}
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Pin className="w-4 h-4 fill-current text-amber-800 dark:text-amber-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Закрепленное сообщение
            </span>
            {totalPinnedCount > 1 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-300 font-bold">
                {totalPinnedCount}
              </span>
            )}
          </div>
          <p className="text-xs font-black text-black dark:text-white truncate max-w-xl group-hover:text-blue-600 transition-colors">
            {getPreviewText()}
          </p>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors shrink-0" />
      </div>

      {canUnpin && onUnpin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnpin(activeMessage.id);
          }}
          title="Открепить сообщение"
          className="ml-2 p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
