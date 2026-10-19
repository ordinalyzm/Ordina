import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mic, 
  Image as ImageIcon, 
  Video as VideoIcon,
  FileText, 
  Music, 
  Link as LinkIcon, 
  StickyNote, 
  Search, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  Play, 
  Pause, 
  Users, 
  ShieldCheck,
  Eye,
  FileSpreadsheet,
  BarChart2
} from 'lucide-react';
import { Message } from '../types';
import { MediaLightboxModal } from './MediaLightboxModal';
import { VideoPreview } from './VideoPreview';

export interface ChatMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  photoURL?: string;
  isVerified?: boolean;
  isGroup?: boolean;
  messages: Message[];
  onSelectMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onOpenEditProfile?: () => void;
}

export type MediaTabType = 'photos' | 'videos' | 'files' | 'voice' | 'audio' | 'polls' | 'links' | 'notes';

export const ChatMediaModal: React.FC<ChatMediaModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  photoURL,
  isVerified,
  isGroup,
  messages,
  onSelectMessage,
  onOpenEditProfile,
}) => {
  const [activeTab, setActiveTab] = useState<MediaTabType>('photos');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<{ [id: string]: HTMLAudioElement }>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Categorize messages of this chat
  const categorized = useMemo(() => {
    const photos: Message[] = [];
    const videos: Message[] = [];
    const voice: Message[] = [];
    const files: Message[] = [];
    const audio: Message[] = [];
    const polls: Message[] = [];
    const links: { msg: Message; url: string; domain: string }[] = [];
    const notes: Message[] = [];

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    messages.forEach(msg => {
      // Voice messages
      if (
        msg.type === 'voice' || 
        (msg.fileUrl && (msg.fileUrl.includes('audio/ogg') || msg.fileUrl.includes('audio/webm') || msg.fileName?.endsWith('.ogg') || msg.fileName?.endsWith('.webm')))
      ) {
        voice.push(msg);
      }
      // Videos
      else if (
        msg.type === 'video' || 
        (msg.fileUrl && /\.(mp4|mov|webm)$/i.test(msg.fileUrl || '')) || 
        (msg.fileName && /\.(mp4|mov|webm)$/i.test(msg.fileName || ''))
      ) {
        videos.push(msg);
      }
      // Photos & Images
      else if (
        msg.type === 'image' || 
        (msg.fileUrl && /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(msg.fileUrl || '')) || 
        (msg.fileName && /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(msg.fileName || ''))
      ) {
        photos.push(msg);
      }
      // Audio tracks
      else if (
        msg.type === 'audio' || 
        (msg.fileUrl && /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(msg.fileUrl || '')) || 
        (msg.fileName && /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(msg.fileName || ''))
      ) {
        audio.push(msg);
      }
      // Polls
      else if (msg.type === 'poll' || (msg as any).poll || msg.pollQuestion) {
        polls.push(msg);
      }
      // Files & documents
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

      // Text notes
      if (msg.text && !msg.fileUrl && msg.type !== 'voice' && msg.type !== 'poll') {
        notes.push(msg);
      }
    });

    return {
      photos: photos.reverse(),
      videos: videos.reverse(),
      files: files.reverse(),
      voice: voice.reverse(),
      audio: audio.reverse(),
      polls: polls.reverse(),
      links: links.reverse(),
      notes: notes.reverse(),
    };
  }, [messages]);

  // Combined media list for lightbox
  const combinedMediaList = useMemo(() => {
    return [...categorized.photos, ...categorized.videos];
  }, [categorized.photos, categorized.videos]);

  // Filtered by search query
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categorized;

    return {
      photos: categorized.photos.filter(m => (m.fileName || m.text || '').toLowerCase().includes(q)),
      videos: categorized.videos.filter(m => (m.fileName || m.text || '').toLowerCase().includes(q)),
      files: categorized.files.filter(m => (m.fileName || m.text || '').toLowerCase().includes(q)),
      voice: categorized.voice.filter(m => (m.text || m.fileName || '').toLowerCase().includes(q)),
      audio: categorized.audio.filter(m => (m.fileName || m.text || '').toLowerCase().includes(q)),
      polls: categorized.polls.filter(m => ((m as any).poll?.question || m.pollQuestion || m.text || '').toLowerCase().includes(q)),
      links: categorized.links.filter(l => l.url.toLowerCase().includes(q) || (l.msg.text || '').toLowerCase().includes(q)),
      notes: categorized.notes.filter(m => (m.text || '').toLowerCase().includes(q)),
    };
  }, [categorized, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleAudio = (msgId: string, url: string) => {
    let currentAudio = audioElements[msgId];

    if (!currentAudio) {
      currentAudio = new Audio(url);
      currentAudio.onended = () => setPlayingAudioId(null);
      currentAudio.onpause = () => setPlayingAudioId(null);
      setAudioElements(prev => ({ ...prev, [msgId]: currentAudio }));
    }

    if (playingAudioId === msgId) {
      currentAudio.pause();
      setPlayingAudioId(null);
    } else {
      // Pause other audio
      Object.values(audioElements).forEach(a => a.pause());
      currentAudio.play().catch(() => {});
      setPlayingAudioId(msgId);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
          {/* Header Card (Telegram-style) */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white p-5 relative shrink-0">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors active:scale-95 text-white"
              title="Закрыть"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center font-bold text-2xl overflow-hidden shadow-inner shrink-0">
                {photoURL ? (
                  <img src={photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : isGroup ? (
                  <Users size={28} className="text-white" />
                ) : (
                  title?.[0] || '💬'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{title}</h2>
                  {isVerified && (
                    <ShieldCheck size={18} className="text-blue-200 fill-white shrink-0" />
                  )}
                </div>
                <p className="text-blue-100 text-sm font-medium truncate">
                  {subtitle || 'Медиа, файлы, опросы и ссылки'}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-blue-200 mt-1 flex-wrap">
                  <span>{categorized.photos.length} фото</span>
                  <span>•</span>
                  <span>{categorized.videos.length} видео</span>
                  <span>•</span>
                  <span>{categorized.files.length} файлов</span>
                  <span>•</span>
                  <span>{categorized.polls.length} опросов</span>
                </div>
              </div>
              {onOpenEditProfile && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenEditProfile();
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-md transition-all shrink-0"
                >
                  Изменить
                </button>
              )}
            </div>
          </div>

          {/* Search bar inside media */}
          <div className="p-3 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Поиск по вложениям..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-10 pr-9 py-2 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
              { key: 'photos', label: 'Фото', icon: ImageIcon, count: filteredItems.photos.length },
              { key: 'videos', label: 'Видео', icon: VideoIcon, count: filteredItems.videos.length },
              { key: 'files', label: 'Файлы', icon: FileText, count: filteredItems.files.length },
              { key: 'voice', label: 'Голосовые', icon: Mic, count: filteredItems.voice.length },
              { key: 'audio', label: 'Аудио', icon: Music, count: filteredItems.audio.length },
              { key: 'polls', label: 'Опросы', icon: BarChart2, count: filteredItems.polls.length },
              { key: 'links', label: 'Ссылки', icon: LinkIcon, count: filteredItems.links.length },
              { key: 'notes', label: 'Заметки', icon: StickyNote, count: filteredItems.notes.length },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as MediaTabType)}
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
            {/* 1. PHOTOS TAB */}
            {activeTab === 'photos' && (
              filteredItems.photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <ImageIcon size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет фотографий в этом чате</p>
                  <p className="text-xs text-slate-400">Отправленные фото отобразятся здесь</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredItems.photos.map(msg => (
                    <div 
                      key={msg.id}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        const idx = combinedMediaList.findIndex(m => m.id === msg.id);
                        if (idx !== -1) setLightboxIndex(idx);
                      }}
                    >
                      <img 
                        src={msg.fileUrl} 
                        alt={msg.fileName || 'Фото'} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 text-white flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-medium truncate max-w-[80%]">
                          {formatDate(msg.createdAt)}
                        </span>
                        {msg.fileUrl && (
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName || 'photo'} 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 hover:bg-white/20 rounded-md transition"
                            title="Скачать"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 2. VIDEOS TAB */}
            {activeTab === 'videos' && (
              filteredItems.videos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <VideoIcon size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет видео в этом чате</p>
                  <p className="text-xs text-slate-400">Отправленные видеозаписи отобразятся здесь</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredItems.videos.map(msg => (
                    <div 
                      key={msg.id}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer"
                      onClick={() => {
                        const idx = combinedMediaList.findIndex(m => m.id === msg.id);
                        if (idx !== -1) setLightboxIndex(idx);
                      }}
                    >
                      <VideoPreview
                        url={msg.fileUrl || ''}
                        fileName={msg.fileName}
                        className="w-full h-full object-cover"
                        showPlayOverlay={true}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 text-white flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <span className="text-[10px] font-medium truncate max-w-[80%]">
                          {formatDate(msg.createdAt)}
                        </span>
                        {msg.fileUrl && (
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName || 'video'} 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 hover:bg-white/20 rounded-md transition"
                            title="Скачать"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 3. FILES TAB */}
            {activeTab === 'files' && (
              filteredItems.files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <FileText size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет файлов</p>
                  <p className="text-xs text-slate-400">Документы, архивы и таблицы появятся здесь</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.files.map(msg => (
                    <div 
                      key={msg.id}
                      className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          {msg.fileName?.endsWith('.xlsx') || msg.fileName?.endsWith('.csv') ? (
                            <FileSpreadsheet size={22} />
                          ) : (
                            <FileText size={22} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {msg.fileName || 'Безымянный файл'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>{formatBytes(msg.fileSize)}</span>
                            <span>•</span>
                            <span>{formatDate(msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {msg.fileUrl && (
                          <a 
                            href={msg.fileUrl} 
                            download={msg.fileName || 'file'}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
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
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="Показать в чате"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 4. VOICE TAB */}
            {activeTab === 'voice' && (
              filteredItems.voice.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <Mic size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет голосовых сообщений</p>
                  <p className="text-xs text-slate-400">Голосовые заметки будут отсортированы здесь</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredItems.voice.map(msg => {
                    const isPlaying = playingAudioId === msg.id;
                    return (
                      <div 
                        key={msg.id}
                        className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            onClick={() => msg.fileUrl && handleToggleAudio(msg.id, msg.fileUrl)}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                              isPlaying ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                            }`}
                          >
                            {isPlaying ? <Pause size={20} /> : <Play size={20} className="translate-x-0.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                {isPlaying ? 'Воспроизведение...' : 'Голосовое сообщение'}
                              </span>
                              {(msg.voiceDuration || msg.audioDuration) ? (
                                <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md font-semibold">
                                  {Math.floor((msg.voiceDuration || msg.audioDuration || 0) / 60)}:{((msg.voiceDuration || msg.audioDuration || 0) % 60).toString().padStart(2, '0')}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {formatDate(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {onSelectMessage && (
                            <button
                              onClick={() => {
                                onSelectMessage(msg.id);
                                onClose();
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                              title="Перейти к сообщению"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* 5. AUDIO TAB */}
            {activeTab === 'audio' && (
              filteredItems.audio.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <Music size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет аудиофайлов</p>
                  <p className="text-xs text-slate-400">Музыка и треки появятся здесь</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredItems.audio.map(msg => {
                    const isPlaying = playingAudioId === msg.id;
                    return (
                      <div 
                        key={msg.id}
                        className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            onClick={() => msg.fileUrl && handleToggleAudio(msg.id, msg.fileUrl)}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                              isPlaying ? 'bg-blue-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                          >
                            {isPlaying ? <Pause size={20} /> : <Play size={20} className="translate-x-0.5" />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {msg.fileName || 'Аудиозапись'}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span>{formatBytes(msg.fileSize)}</span>
                              <span>•</span>
                              <span>{formatDate(msg.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {msg.fileUrl && (
                            <a 
                              href={msg.fileUrl} 
                              download={msg.fileName || 'audio.mp3'}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                              title="Скачать"
                            >
                              <Download size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* 6. POLLS TAB */}
            {activeTab === 'polls' && (
              filteredItems.polls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <BarChart2 size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет опросов в этом чате</p>
                  <p className="text-xs text-slate-400">Созданные опросы и голосования отобразятся здесь</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.polls.map(msg => {
                    const poll = (msg as any).poll || { question: msg.pollQuestion || msg.text, options: msg.pollOptions || [] };
                    const totalVotes = (poll.options || []).reduce((sum: number, opt: any) => sum + (opt.votes?.length || 0), 0);
                    return (
                      <div 
                        key={msg.id}
                        className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            Опрос • {totalVotes} голосов
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDate(msg.createdAt)}</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mb-3">{poll.question}</h4>
                        <div className="space-y-2 mb-3">
                          {(poll.options || []).map((opt: any, idx: number) => {
                            const optVotes = opt.votes?.length || 0;
                            const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                            return (
                              <div key={idx} className="relative bg-slate-50 rounded-xl p-2.5 overflow-hidden border border-slate-100">
                                <div 
                                  className="absolute inset-y-0 left-0 bg-blue-100/60 transition-all duration-500 rounded-xl"
                                  style={{ width: `${percentage}%` }}
                                />
                                <div className="relative flex justify-between items-center text-xs font-medium z-10 text-slate-800">
                                  <span>{opt.text}</span>
                                  <span className="text-slate-500 font-bold">{percentage}% ({optVotes})</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {onSelectMessage && (
                          <button
                            onClick={() => {
                              onSelectMessage(msg.id);
                              onClose();
                            }}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Eye size={13} /> Перейти к опросу в чате
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* 7. LINKS TAB */}
            {activeTab === 'links' && (
              filteredItems.links.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <LinkIcon size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет ссылок</p>
                  <p className="text-xs text-slate-400">Ссылки из переписки будут найдены здесь</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredItems.links.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:shadow-sm transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                          <LinkIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs font-bold text-blue-600 hover:underline truncate block"
                          >
                            {item.url}
                          </a>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {item.domain} • {formatDate(item.msg.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopy(item.url, `link-${idx}`)}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                          title="Скопировать ссылку"
                        >
                          {copiedId === `link-${idx}` ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        </button>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
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

            {/* 8. NOTES / TEXT TAB */}
            {activeTab === 'notes' && (
              filteredItems.notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <StickyNote size={40} className="text-slate-300" />
                  <p className="text-sm font-medium">Нет текстовых сообщений</p>
                  <p className="text-xs text-slate-400">История сообщений чата</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredItems.notes.map(msg => (
                    <div 
                      key={msg.id}
                      className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-slate-400">{formatDate(msg.createdAt)}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopy(msg.text || '', msg.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Скопировать"
                          >
                            {copiedId === msg.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                          {onSelectMessage && (
                            <button
                              onClick={() => {
                                onSelectMessage(msg.id);
                                onClose();
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Перейти к сообщению"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
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

      {/* Interactive Media Lightbox Modal with Zoom & Pan */}
      {lightboxIndex !== null && combinedMediaList[lightboxIndex] && (
        <MediaLightboxModal
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          mediaList={combinedMediaList}
          currentIndex={lightboxIndex}
          onIndexChange={(newIdx) => setLightboxIndex(newIdx)}
        />
      )}
    </AnimatePresence>
  );
};
export default ChatMediaModal;
