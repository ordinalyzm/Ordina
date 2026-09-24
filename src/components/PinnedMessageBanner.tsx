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
    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 backdrop-blur-sm z-10 transition-all">
      <div 
        onClick={handleScroll}
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Pin className="w-4 h-4 fill-current" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Закрепленное сообщение
            </span>
            {totalPinnedCount > 1 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
                {totalPinnedCount}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-xl group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {getPreviewText()}
          </p>
        </div>

        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 transition-colors shrink-0" />
      </div>

      {canUnpin && onUnpin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnpin(activeMessage.id);
          }}
          title="Открепить сообщение"
          className="ml-2 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
