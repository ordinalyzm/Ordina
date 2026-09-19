import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  Image as ImageIcon, 
  FileText, 
  Music, 
  Link as LinkIcon, 
  StickyNote, 
  Search, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  Calendar,
  Play,
  Pause,
  User as UserIcon,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { Message, UserProfile } from '../types';

interface SavedNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  messages: Message[];
  onSelectMessage?: (messageId: string) => void;
  onOpenEditProfile?: () => void;
}

type TabType = 'media' | 'voice' | 'files' | 'audio' | 'links' | 'notes';

export const SavedNotebookModal: React.FC<SavedNotebookModalProps> = ({
  isOpen,
  onClose,
  profile,
  messages,
  onSelectMessage,
  onOpenEditProfile,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('media');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<{ [id: string]: HTMLAudioElement }>({});

  // Categorize messages
  const categorized = useMemo(() => {
    const media: Message[] = [];
    const voice: Message[] = [];
    const files: Message[] = [];
    const audio: Message[] = [];
    const links: { msg: Message; url: string; domain: string }[] = [];
    const notes: Message[] = [];

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    messages.forEach(msg => {
      // Voice
      if (msg.type === 'voice' || (msg.fileUrl && (msg.fileUrl.includes('audio/ogg') || msg.fileUrl.includes('audio/webm') || msg.fileName?.endsWith('.ogg') || msg.fileName?.endsWith('.webm')))) {
        voice.push(msg);
      }
      // Media (images & video)
      else if (msg.type === 'image' || msg.type === 'video' || (msg.fileUrl && /\.(jpeg|jpg|png|gif|webp|mp4|mov|webm)$/i.test(msg.fileUrl || '')) || (msg.fileName && /\.(jpeg|jpg|png|gif|webp|mp4|mov|webm)$/i.test(msg.fileName || ''))) {
        media.push(msg);
      }
      // Audio
      else if (msg.type === 'audio' || (msg.fileUrl && /\.(mp3|wav|m4a|aac|flac)$/i.test(msg.fileUrl || '')) || (msg.fileName && /\.(mp3|wav|m4a|aac|flac)$/i.test(msg.fileName || ''))) {
        audio.push(msg);
      }
      // Files
      else if (msg.type === 'file' || msg.fileUrl) {
        files.push(msg);
      }

      // Check for links in text
      if (msg.text) {
        const matches = msg.text.match(urlRegex);
        if (matches) {
          matches.forEach(url => {
            try {
              const domain = new URL(url).hostname;
              links.push({ msg, url, domain });
            } catch (e) {
              links.push({ msg, url, domain: url });
            }
          });
        }
      }

      // Notes (text without heavy files)
      if (msg.text && !msg.fileUrl && msg.type !== 'voice') {
        notes.push(msg);
      }
    });

    return {
      media: media.reverse(),
      voice: voice.reverse(),
      files: files.reverse(),
      audio: audio.reverse(),
      links: links.reverse(),
      notes: notes.reverse(),
    };
  }, [messages]);

  // Filtered by search
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categorized;

    return {
      media: categorized.media.filter(m => (m.fileName || m.text || '').toLowerCase().includes(q)),
      voice: categorized.voice.filter(m => (m.text || m.fileName || '').toLowerCase().includes(q)),
      files: categorized.files.filter(m => (m.fileName || m.text || '').toLowerCase().includes(q)),
      audio: categorized.audio.filter(m => (m.fileName || m.text || '').toLowerCase().includes(q)),
      links: categorized.links.filter(l => l.url.toLowerCase().includes(q) || (l.msg.text || '').toLowerCase().includes(q)),
      notes: categorized.notes.filter(m => (m.text || '').toLowerCase().includes(q)),
    };
  }, [categorized, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleAudio = (id: string, url: string) => {
    if (playingAudioId === id) {
      audioElements[id]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioElements[playingAudioId]) {
        audioElements[playingAudioId].pause();
      }
      let audio = audioElements[id];
      if (!audio) {
        audio = new Audio(url);
        audio.onended = () => setPlayingAudioId(null);
        setAudioElements(prev => ({ ...prev, [id]: audio }));
      }
      audio.play().catch(() => {});
      setPlayingAudioId(id);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[14000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & User Profile Header Card */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 relative shrink-0">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95"
              title="Закрыть"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center font-bold text-2xl overflow-hidden shadow-inner shrink-0">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile?.displayName?.[0] || 'Я'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{profile?.displayName || 'Мой профиль'}</h2>
                  {profile?.isVerified && (
                    <ShieldCheck size={18} className="text-blue-200 fill-white shrink-0" />
                  )}
                </div>
                <p className="text-blue-100 text-sm font-medium truncate">
                  {profile?.username ? `@${profile.username}` : 'Личный блокнот и хранилище'}
                </p>
                {profile?.bio && (
                  <p className="text-blue-200 text-xs mt-0.5 line-clamp-1 opacity-90">{profile.bio}</p>
                )}
              </div>
              {onOpenEditProfile && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenEditProfile();
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-xs font-semibold rounded-xl transition-all active:scale-95 shrink-0"
                >
                  Редактировать
                </button>
              )}
            </div>
          </div>

          {/* Search bar inside Notebook */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="Поиск по заметкам, файлам, ссылкам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Telegram-style Tab Bar */}
          <div className="flex border-b border-slate-100 px-2 bg-white overflow-x-auto custom-scrollbar shrink-0">
            {[
              { key: 'media', label: 'Медиа', icon: ImageIcon, count: filteredItems.media.length },
              { key: 'voice', label: 'Голосовые', icon: Mic, count: filteredItems.voice.length },
              { key: 'files', label: 'Файлы', icon: FileText, count: filteredItems.files.length },
              { key: 'audio', label: 'Аудио', icon: Music, count: filteredItems.audio.length },
              { key: 'links', label: 'Ссылки', icon: LinkIcon, count: filteredItems.links.length },
              { key: 'notes', label: 'Заметки', icon: StickyNote, count: filteredItems.notes.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabType)}
                  className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    isActive 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/40">
            {/* 1. MEDIA TAB */}
            {activeTab === 'media' && (
              filteredItems.media.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <ImageIcon size={36} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет сохраненных фото и видео</p>
                  <p className="text-xs text-slate-400">Отправляйте медиафайлы в блокнот, чтобы сохранить их</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredItems.media.map(msg => (
                    <div 
                      key={msg.id}
                      onClick={() => {
                        if (onSelectMessage) {
                          onSelectMessage(msg.id);
                          onClose();
                        }
                      }}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-200 border border-slate-100 cursor-pointer shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
                    >
                      {msg.type === 'video' || (msg.fileUrl && /\.(mp4|mov|webm)$/i.test(msg.fileUrl)) ? (
                        <video src={msg.fileUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img src={msg.fileUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2 text-white">
                        <span className="text-[10px] font-medium">{formatDate(msg.createdAt)}</span>
                        {msg.fileUrl && (
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName || 'media'} 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                          >
                            <Download size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 2. VOICE TAB */}
            {activeTab === 'voice' && (
              filteredItems.voice.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <Mic size={36} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет сохраненных голосовых сообщений</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.voice.map(msg => (
                    <div 
                      key={msg.id}
                      className="p-3 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm hover:shadow transition-all"
                    >
                      <button 
                        onClick={() => msg.fileUrl && handleToggleAudio(msg.id, msg.fileUrl)}
                        className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors shrink-0"
                      >
                        {playingAudioId === msg.id ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            Голосовая заметка {msg.audioDuration ? `(${Math.round(msg.audioDuration)}с)` : ''}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDate(msg.createdAt)}</span>
                        </div>
                        {msg.text && (
                          <p className="text-xs text-slate-600 mt-0.5 truncate">{msg.text}</p>
                        )}
                      </div>
                      {onSelectMessage && (
                        <button 
                          onClick={() => {
                            onSelectMessage(msg.id);
                            onClose();
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"
                          title="Перейти к сообщению"
                        >
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 3. FILES TAB */}
            {activeTab === 'files' && (
              filteredItems.files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <FileText size={36} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет сохраненных файлов</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.files.map(msg => (
                    <div 
                      key={msg.id}
                      className="p-3 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm hover:shadow transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{msg.fileName || 'Документ'}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatDate(msg.createdAt)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatBytes(msg.fileSize)} {msg.text ? `• ${msg.text}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {msg.fileUrl && (
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName || 'file'}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-colors"
                            title="Скачать файл"
                          >
                            <Download size={16} />
                          </a>
                        )}
                        {onSelectMessage && (
                          <button 
                            onClick={() => {
                              onSelectMessage(msg.id);
                              onClose();
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-colors"
                            title="Перейти к сообщению"
                          >
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 4. AUDIO TAB */}
            {activeTab === 'audio' && (
              filteredItems.audio.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <Music size={36} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет сохраненной музыки</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.audio.map(msg => (
                    <div 
                      key={msg.id}
                      className="p-3 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm hover:shadow transition-all"
                    >
                      <button 
                        onClick={() => msg.fileUrl && handleToggleAudio(msg.id, msg.fileUrl)}
                        className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-colors shrink-0"
                      >
                        {playingAudioId === msg.id ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{msg.fileName || 'Аудиозапись'}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatDate(msg.createdAt)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatBytes(msg.fileSize)}</p>
                      </div>
                      {msg.fileUrl && (
                        <a 
                          href={msg.fileUrl} 
                          download={msg.fileName || 'audio'} 
                          className="p-2 text-slate-400 hover:text-purple-600 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          <Download size={16} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 5. LINKS TAB */}
            {activeTab === 'links' && (
              filteredItems.links.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <LinkIcon size={36} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет сохраненных ссылок</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.links.map((item, idx) => (
                    <div 
                      key={item.msg.id + '-' + idx}
                      className="p-3 bg-white rounded-2xl border border-slate-100 flex items-center gap-3 shadow-sm hover:shadow transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <LinkIcon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{item.domain}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatDate(item.msg.createdAt)}</span>
                        </div>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-blue-600 hover:underline truncate block mt-0.5"
                        >
                          {item.url}
                        </a>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => handleCopy(item.url, item.msg.id + '-' + idx)}
                          className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors"
                          title="Скопировать ссылку"
                        >
                          {copiedId === item.msg.id + '-' + idx ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-colors"
                          title="Открыть"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 6. NOTES TAB */}
            {activeTab === 'notes' && (
              filteredItems.notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <StickyNote size={36} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет текстовых заметок</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.notes.map(msg => (
                    <div 
                      key={msg.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar size={12} /> {formatDate(msg.createdAt)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleCopy(msg.text || '', msg.id)}
                            className="p-1 hover:text-slate-700 rounded-md transition-colors"
                            title="Скопировать текст"
                          >
                            {copiedId === msg.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                          {onSelectMessage && (
                            <button 
                              onClick={() => {
                                onSelectMessage(msg.id);
                                onClose();
                              }}
                              className="p-1 hover:text-blue-600 rounded-md transition-colors"
                              title="Перейти к сообщению"
                            >
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
