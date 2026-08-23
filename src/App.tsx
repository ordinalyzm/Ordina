/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  createBrowserRouter,
  RouterProvider,
  useNavigate,
  useParams,
  Navigate,
  Link
} from 'react-router-dom';
import { 
  auth 
} from './lib/firebase';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, sendPasswordResetEmail, type User 
} from 'firebase/auth';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { io, Socket } from 'socket.io-client';
import { 
  Send, Image as ImageIcon, File as FileIcon, Video as VideoIcon, 
  Search, Menu, MoreVertical, Paperclip, Smile, Reply, Forward, 
  Trash2, Edit2, Copy, Check, CheckCheck, Camera, Radar as RadarIcon, Phone,
  Users, Hash, Settings, LogOut, X, ArrowLeft, Download, Shield, RotateCw,
  ShieldAlert, Lock, UserMinus, UserPlus, Globe, EyeOff, Info, Clock, MessageSquare, MessageSquareOff, AlertTriangle, FileText,
  Sword, Unlink, Play, ChevronLeft, ChevronRight, Gamepad2, Share, Share2, BarChart2, Quote, User as UserIcon, Bot, Smartphone, Monitor, Radio, Bell, BellOff, Subtitles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile, Message, Group, MeshNode, GroupPermissions, StickerPack, UserDevice } from './types';
import { 
  saveMessageToLocalCache, 
  saveMessagesToLocalCache, 
  loadMessagesFromLocalCache, 
  clearChatLocalCache 
} from './utils/localCache';
import { Radar } from './components/Radar';
import { getRelayPath, findNextHop } from './lib/mesh';
import { FirestoreMedia } from './lib/FirestoreMedia';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TicTacToe } from './components/TicTacToe';
import { WordsGame } from './components/WordsGame';
import StickersModal from './components/StickersModal';
import BotConstructor from './components/BotConstructor';

import TitleManagerModal from './components/TitleManagerModal';
import { RenderTitle } from './lib/TitleRenderer';
import ImageCropperModal from './components/ImageCropperModal';
import { useVoicePlayer, VoiceBubbleWidget, GlobalVoiceBanner } from './components/VoiceMessagePlayer';
import { playIncomingMessageSound, playSentMessageSound, triggerHapticFeedback } from './lib/audio';
import { showSystemNotification, openAppSettings } from './lib/notifications';
import { MeshInspectorModal } from './components/MeshInspectorModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full bg-slate-900 flex items-center justify-center p-4 text-white">
          <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl shadow-2xl border border-red-500/30">
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2 text-red-400">
              <Shield className="w-8 h-8" />
              Ошибка запуска
            </h1>
            <p className="text-slate-400 mb-6">
              Произошла критическая ошибка при запуске приложения. Попробуйте перезагрузить страницу или очистить кэш.
            </p>
            <div className="bg-black/30 p-4 rounded-xl mb-6 overflow-x-auto">
              <code className="text-xs text-red-300 font-mono">
                {this.state.error?.message || 'Неизвестная ошибка'}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold transition-all"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Utility to remove undefined values from an object recursively
const cleanObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanObject(item))
      .filter(item => item !== undefined && item !== null);
  }

  if (obj.constructor !== Object) {
    return obj;
  }
  
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== undefined && value !== null) {
      const cleanedValue = cleanObject(value);
      if (cleanedValue !== undefined && cleanedValue !== null) {
        newObj[key] = cleanedValue;
      }
    }
  });
  
  // Final pass to ensure no undefineds leaked in (shouldn't happen with logic above but for safety)
  const finalObj: any = {};
  for (const key in newObj) {
    if (newObj[key] !== undefined && newObj[key] !== null) {
      finalObj[key] = newObj[key];
    }
  }
  
  return finalObj;
};

const formatMessageText = (text: string, searchQuery?: string) => {
  if (!text) return null;
  
  // Basic markdown-like parsing
  // **bold**, *italic*, ~~strikethrough~~, __underline__
  
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|~~.*?~~|__.*?__)/g);
  
  return parts.map((part, index) => {
    let content: React.ReactNode = part;
    let isFormatting = false;
    
    if (part.startsWith('**') && part.endsWith('**')) {
      content = part.slice(2, -2);
      isFormatting = true;
      content = <strong>{highlightText(content as string, searchQuery)}</strong>;
    } else if (part.startsWith('*') && part.endsWith('*')) {
      content = part.slice(1, -1);
      isFormatting = true;
      content = <em>{highlightText(content as string, searchQuery)}</em>;
    } else if (part.startsWith('~~') && part.endsWith('~~')) {
      content = part.slice(2, -2);
      isFormatting = true;
      content = <del>{highlightText(content as string, searchQuery)}</del>;
    } else if (part.startsWith('__') && part.endsWith('__')) {
      content = part.slice(2, -2);
      isFormatting = true;
      content = <u>{highlightText(content as string, searchQuery)}</u>;
    }
    
    if (!isFormatting) {
      content = highlightText(part, searchQuery);
    }
    
    return <span key={index}>{content}</span>;
  });
};

const highlightText = (text: string, query?: string) => {
  let content: React.ReactNode[] = [text];
  
  if (query && query.trim()) {
    const qParts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    content = qParts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={`q_${i}`} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</mark> 
        : part
    );
  }

  // Highlight mentions
  const result: React.ReactNode[] = [];
  content.forEach((item, index) => {
    if (typeof item === 'string') {
      const parts = item.split(/(@[a-zA-Z0-9_\u0400-\u04FF]+)/g);
      parts.forEach((part, i) => {
        if (part.startsWith('@')) {
          result.push(<span key={`m_${index}_${i}`} className="text-blue-500 font-semibold bg-blue-50 px-1 rounded-md">{part}</span>);
        } else if (part) {
          result.push(part);
        }
      });
    } else {
      result.push(item);
    }
  });

  return result;
};

const createMessageId = (uid: string, timestamp: number) => `${uid}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;

export default function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <AppContent />,
    },
    {
      path: "/chat/:chatId",
      element: <AppContent />,
    }
  ]);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

function ToastsContainer({ toasts }: { toasts: { id: string, message: string, type: 'error'|'success'|'info' }[] }) {
  return (
    <div className="fixed top-12 sm:top-14 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4 pt-[env(safe-area-inset-top,0px)]">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto w-full border border-white/20 backdrop-blur-xl",
              toast.type === 'success' ? "bg-emerald-600/95 text-white shadow-emerald-900/40" :
              toast.type === 'error' ? "bg-red-600/95 text-white shadow-red-900/40" : "bg-slate-900/95 text-white shadow-slate-950/50"
            )}
          >
            <div className="shrink-0">
              {toast.type === 'success' ? <Check size={20} /> : 
               toast.type === 'error' ? <X size={20} /> : <Info size={20} />}
            </div>
            <span className="text-sm font-bold leading-tight drop-shadow-sm">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const SERVER_MIRRORS = [
  'https://ordina-zeta.vercel.app',
  'https://ordina-server.onrender.com',
];

export const DEFAULT_CLOUD_SERVER = SERVER_MIRRORS[0];

export const getServerUrl = (customUrl?: string): string => {
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/$/, '');
  }
  const isCapacitor = !!(window as any).Capacitor || (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '5173');
  if (isCapacitor) {
    const activeMirror = localStorage.getItem('ordina_active_mirror');
    if (activeMirror && activeMirror.includes('workers.dev')) {
      localStorage.removeItem('ordina_active_mirror');
      return DEFAULT_CLOUD_SERVER;
    }
    return activeMirror || DEFAULT_CLOUD_SERVER;
  }
  return window.location.origin.replace(/\/$/, '');
};

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const voicePlayer = useVoicePlayer();
  
  // Device registration tracking
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('ordina_device_id_token');
    if (!id) {
      id = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('ordina_device_id_token', id);
    }
    return id;
  });

  const [deviceName, setDeviceName] = useState<string>(() => {
    let name = localStorage.getItem('ordina_device_name');
    const isCapacitor = Boolean((window as any).Capacitor) || window.location.hostname === 'localhost';
    if (!name || (isCapacitor && name === 'Мобильный браузер')) {
      if (isCapacitor) {
        name = 'Приложение Ordina (Android APK)';
      } else if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        name = 'Мобильный браузер';
      } else {
        name = 'Персональный компьютер (ПК)';
      }
      localStorage.setItem('ordina_device_name', name);
    }
    return name;
  });

  const deviceType = useMemo(() => {
    if ((window as any).Capacitor || /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      return 'phone';
    }
    return 'pc';
  }, []);

  // Weekly multi-device review modal state
  const [showWeeklyDeviceCheck, setShowWeeklyDeviceCheck] = useState(false);
  const [weeklyCheckDevices, setWeeklyCheckDevices] = useState<UserDevice[]>([]);
  const [weeklyCheckIndex, setWeeklyCheckIndex] = useState(0);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  const [socketUrl, setSocketUrl] = useState<string | undefined>(() => {
    let saved = localStorage.getItem('ordina_server_url');
    if (saved && (saved.includes('ais-dev') || saved.includes('ais-pre'))) {
      localStorage.removeItem('ordina_server_url');
      saved = null;
    }
    return saved || undefined;
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [groups, setGroups] = useState<Group[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ordina_cached_groups') || '[]');
    } catch { return []; }
  });
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ordina_cached_users') || '[]');
    } catch { return []; }
  });
  const [selectedChat, setSelectedChat] = useState<{ type: 'user' | 'group' | 'channel', id: string } | null>(null);
  const [notifications, setNotifications] = useState<{ [chatId: string]: number }>({});
  const [recentPreviews, setRecentPreviews] = useState<{ [chatId: string]: Message }>({});

  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketPresences, setSocketPresences] = useState<Array<{uid: string, status: string, customStatus?: string}>>([]);

  const isUserOnline = (u: UserProfile | null | undefined): boolean => {
    if (!u) return false;
    if (u.uid === user?.uid) return true;
    if (socketPresences?.some(p => p.uid === u.uid)) return true;
    if ((u as any).isOnline === true) return true;
    if (u.status === 'online') {
      if (!u.lastSeen) return true;
      return (new Date().getTime() - new Date(u.lastSeen).getTime()) < 5 * 60 * 1000;
    }
    if (u.lastSeen) {
      return (new Date().getTime() - new Date(u.lastSeen).getTime()) < 5 * 60 * 1000;
    }
    return false;
  };

  const formatLastSeen = (u: UserProfile | null | undefined): string => {
    if (!u) return 'Оффлайн';
    if (isUserOnline(u)) return 'В сети';
    if (!u.lastSeen) return 'Оффлайн';
    const d = new Date(u.lastSeen);
    if (isNaN(d.getTime())) return 'Оффлайн';

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');

    if (isToday) {
      return `был(а) сегодня в ${hours}:${minutes}`;
    }
    return `был(а) ${d.toLocaleDateString('ru-RU')} в ${hours}:${minutes}`;
  };
  const [inputText, setInputText] = useState('');
  const [mutedChats, setMutedChats] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ordina_muted_chats') || '[]');
    } catch (e) {
      return [];
    }
  });

  const toggleMuteChat = (chatId: string) => {
    setMutedChats(prev => {
      const next = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
      try {
        localStorage.setItem('ordina_muted_chats', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const [showRadar, setShowRadar] = useState(false);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchFilterUser, setChatSearchFilterUser] = useState<string | null>(null);
  
  const [showCreateChatModal, setShowCreateChatModal] = useState(false);
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [deleteTimerDelay, setDeleteTimerDelay] = useState<number>(0);
  const [createChatType, setCreateChatType] = useState<'group' | 'channel'>('group');
  const [createChatName, setCreateChatName] = useState('');
  
  const [isAdminState, setIsAdminState] = useState(false);
  const isGlobalAdmin = isAdminState;

  const [isAdminAssessed, setIsAdminAssessed] = useState(false);
  
  const canDeleteForEveryoneState = (msg: Message) => {
    if (selectedChat?.type === 'user') return msg.senderId === user?.uid;
    const g = groups.find(g => g.id === selectedChat?.id);
    if (!g) return false;
    if (isGlobalAdmin) return true;
    const role = g.memberRoles?.[user?.uid || ''] || 'member';
    if (role === 'owner') return true;
    const perms = g.permissions?.[(role as any) === 'owner' ? 'admin' : role as any];
    return perms?.canDeleteForEveryone === true;
  };
  const [socketTyping, setSocketTyping] = useState<{ [chatId: string]: { [uid: string]: boolean } }>({});
  const messageCacheRef = useRef<{ [chatId: string]: Message[] }>({});
  const selectedChatRef = useRef(selectedChat);
  const usersRef = useRef(users);
  const profileRef = useRef(profile);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    profileRef.current = profile;
    if (profile?.uid) {
      try {
        localStorage.setItem(`ordina_profile_${profile.uid}`, JSON.stringify(profile));
      } catch (e) {}
    }
  }, [profile]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const lastMessages = useMemo(() => {
    const map: Record<string, Message> = { ...recentPreviews };
    messages.forEach(msg => {
      const chatId = msg.groupId || (msg.senderId === user?.uid ? msg.receiverId : msg.senderId);
      if (chatId) {
        if (!map[chatId] || new Date(msg.createdAt) > new Date(map[chatId].createdAt)) {
          map[chatId] = msg;
        }
      }
    });

    // Clean up channel previews: if map[chatId] is a comment from non-admin, try to find a real channel post 
    // This is a bit tricky since we might only have `map` which stores 1 message. We should iterate messages properly.
    const realMap: Record<string, Message> = {};
    const processMsg = (msg: Message, chatId: string) => {
      const g = groups.find(g => g.id === chatId);
      if (g && g.type === 'channel') {
        const role = g.memberRoles?.[msg.senderId] || 'member';
        const isOwner = g.ownerId === msg.senderId;
        if (role !== 'admin' && role !== 'owner' && !isOwner) {
          return; // Skip comments for channel preview
        }
      }
      if (!realMap[chatId] || new Date(msg.createdAt) > new Date(realMap[chatId].createdAt)) {
        realMap[chatId] = msg;
      }
    };

    // Reprocess recentPreviews
    Object.values(recentPreviews).forEach(msg => {
      const chatId = msg.groupId || (msg.senderId === user?.uid ? msg.receiverId : msg.senderId);
      if (chatId) processMsg(msg, chatId);
    });

    // Reprocess all messages
    messages.forEach(msg => {
      const chatId = msg.groupId || (msg.senderId === user?.uid ? msg.receiverId : msg.senderId);
      if (chatId) processMsg(msg, chatId);
    });

    // Fallback: if we filtered out the preview and nothing is left, we can just omit it 
    // or we could show something. Wait, if realMap is empty for a channel, it will just show "Канал". That's fine.
    
    return realMap;
  }, [messages, user?.uid, recentPreviews, groups]);

  const unreadCounts = useMemo(() => {
    const map: Record<string, number> = { ...notifications };
    if (!user) return map;
    // We only rely on notifications state for background chats
    // For the current chat, we assume it's read or being read
    return map;
  }, [notifications, user]);

  useEffect(() => {
    if (!user) return;
    
    // Timeout fallback for profile loading in case socket fails or hangs
    const profileTimeout = setTimeout(() => {
      setProfile(prev => {
        if (!prev) {
          console.warn('auth:synced timed out or failed. Applying fallback profile.');
          setTimeout(() => addToast('Синхронизация профиля... (Сервер просыпается)', 'info'), 0);
          return {
            uid: user.uid,
            displayName: user.displayName || 'Пользователь',
            status: 'online',
            lastSeen: new Date().toISOString(),
            activeChats: ['global_channel']
          } as UserProfile;
        }
        return prev;
      });
    }, 12000);

    return () => clearTimeout(profileTimeout);
  }, [user]);

  // Server wake-up mechanism for cold starts
  const [activeServerUrl, setActiveServerUrl] = useState<string>(() => getServerUrl(socketUrl));
  const [serverWakingUp, setServerWakingUp] = useState(false);

  useEffect(() => {
    const wakeUpServer = async () => {
      const candidates = socketUrl && socketUrl.trim() 
        ? [socketUrl.trim().replace(/\/$/, '')]
        : SERVER_MIRRORS;

      let success = false;
      let attempts = 0;
      const maxAttempts = 12;

      setServerWakingUp(true);

      while (!success && attempts < maxAttempts) {
        attempts++;
        for (const candidate of candidates) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s ping per mirror
            
            const healthUrl = `${candidate}/api/health`;
            const res = await fetch(healthUrl, {
              method: 'GET',
              signal: controller.signal,
              headers: { 'Accept': 'application/json' },
              mode: 'cors'
            });
            clearTimeout(timeoutId);

            if (res.ok) {
              const data = await res.json().catch(() => null);
              if (data && data.status === 'ok' && data.server === 'Ordina Backend') {
                success = true;
                localStorage.setItem('ordina_active_mirror', candidate);
                setActiveServerUrl(candidate);
                console.log('[WakeUp] Backend server is active at', candidate);
                break;
              }
            }
          } catch (err: any) {
            console.log(`[WakeUp] Mirror ${candidate} unreachable (attempt ${attempts}/${maxAttempts}):`, err?.message || err);
          }
        }
        if (!success) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      setServerWakingUp(false);
    };

    wakeUpServer();
  }, [socketUrl]);

  // Initialize Socket.io connection (connects unconditionally to wake up server & establish real-time link)
  useEffect(() => {
    const targetUrl = activeServerUrl || getServerUrl(socketUrl);

    const socketOptions = {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 45000,
      transports: ['polling'], // Pure HTTP long-polling guarantees 100% working connection through Cloudflare Worker proxy without WebSocket DPI blocking
      upgrade: false,
      autoConnect: true,
      withCredentials: true,
    };

    const newSocket = targetUrl ? io(targetUrl, socketOptions) : io(socketOptions);

    setSocket(newSocket);

    const handleConnect = () => {
      console.log('Socket connected:', newSocket.id);
      setSocketConnected(true);
      if (user) {
        let localP: any = profileRef.current;
        if (!localP?.photoURL && user.uid) {
          try {
            const savedStr = localStorage.getItem(`ordina_profile_${user.uid}`);
            if (savedStr) localP = JSON.parse(savedStr);
          } catch (e) {}
        }

        newSocket.emit('auth:sync', {
          uid: user.uid,
          displayName: localP?.displayName || user.displayName || 'Anonymous',
          photoURL: localP?.photoURL || user.photoURL || '',
          bio: localP?.bio || '',
          username: localP?.username || '',
          profileBackgroundURL: localP?.profileBackgroundURL || '',
          customStatus: localP?.customStatus || '',
          status: localP?.status || 'online',
          email: user.email || '',
          device: {
            id: deviceId,
            name: deviceName,
            type: deviceType
          }
        });
      }
      const current = selectedChatRef.current;
      if (current && user) {
        newSocket.emit('chat:join', { ...current, limit: messageLimit, _uid: user?.uid });
      }
    };

    if (newSocket.connected) {
      handleConnect();
    }

    newSocket.on('connect', handleConnect);

    newSocket.on('disconnect', () => {
      setSocketConnected(false);
    });

    newSocket.on('presence:update', (presences: any[]) => {
      setSocketPresences(presences);
    });

     newSocket.on('message:received', async (msg: Message) => {
      const currentChat = selectedChatRef.current;
      const chatId = msg.groupId || (msg.senderId === user?.uid ? msg.receiverId : msg.senderId) || 'global_channel';

      if (!chatId) return;

      const cachedList = messageCacheRef.current[chatId] || [];
      const existingMsgIndex = cachedList.findIndex(m => m.id === msg.id);
      const isNewMessage = existingMsgIndex === -1;

      // Save to local weekly persistent database
      saveMessageToLocalCache(chatId, msg);

      // Send delivery confirmation ONLY if we are the recipient AND our deviceId is NOT already registered as delivered
      if (msg.senderId !== user?.uid && !msg.deliveredDevices?.[deviceId]) {
        newSocket.emit('message:delivered', { id: msg.id, chatId, deviceId });
      }

      setRecentPreviews(prev => ({
        ...prev,
        [chatId]: msg
      }));

      const isCurrentChat = (currentChat?.type !== 'user' && msg.groupId === currentChat?.id) ||
                            (currentChat?.type === 'user' && (
                              (msg.senderId === currentChat.id && msg.receiverId === user.uid) ||
                              (msg.senderId === user.uid && msg.receiverId === currentChat.id)
                            )) ||
                            (currentChat?.id === 'global_channel' && msg.groupId === 'global_channel');

      if (isCurrentChat) {
        setMessages(prev => {
          const index = prev.findIndex(m => m.id === msg.id);
          let newMsgs;
          if (index !== -1) {
            newMsgs = [...prev];
            newMsgs[index] = msg;
          } else {
            newMsgs = [...prev, msg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          }
          // Update memory cache
          messageCacheRef.current[chatId] = newMsgs;
          return newMsgs;
        });
      } else {
        // Update memory cache for background chat
        if (isNewMessage) {
          messageCacheRef.current[chatId] = [...cachedList, msg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else {
          const updatedCached = [...cachedList];
          updatedCached[existingMsgIndex] = msg;
          messageCacheRef.current[chatId] = updatedCached;
        }
      }

      // MESH RELAY LOGIC: If I am the relay target
      if (msg.relayTo === user?.uid && isRelayEnabled) {
        const targetId = msg.receiverId || msg.groupId;
        if (targetId) {
          const targetIsOnline = socketPresences.some(p => p.uid === targetId && p.status === 'online');
          if (targetIsOnline) {
            // Target is online, forward it!
            const forwardedMsg = {
               ...msg,
               relayTo: undefined, // Direct now
               relayPath: [...(msg.relayPath || []), user?.uid]
            };
            newSocket.emit('message:new', { chatId: targetId, message: forwardedMsg });
          } else {
             // Target still offline, find next hop closer to target
             const usersList = usersRef.current;
             const hop = findNextHop(usersList as any, user?.uid || '', targetId);
             if (hop && hop !== user?.uid) {
                const forwardedMsg = {
                   ...msg,
                   relayTo: hop,
                   relayPath: [...(msg.relayPath || []), user?.uid]
                };
                newSocket.emit('message:new', { chatId: targetId, message: forwardedMsg });
             }
          }
        }
      }
      
      if (!isCurrentChat || document.visibilityState !== 'visible') {
        if (!isCurrentChat && isNewMessage) {
          setNotifications(prev => ({
            ...prev,
            [chatId]: (prev[chatId] || 0) + 1
          }));
        }
        
        // ONLY trigger audio, vibration, and system notification for BRAND NEW incoming messages
        if (msg.senderId !== user?.uid && isNewMessage) {
            const usersList = usersRef.current;
            const sender = usersList.find(u => u.uid === msg.senderId)?.displayName || 'Пользователь';
            const profileData = profileRef.current;
            
            const isMuted = profileData?.mutedChats?.[chatId] && (profileData.mutedChats[chatId] === -1 || profileData.mutedChats[chatId] > Date.now());
            const hasMention = msg.text?.includes(`@${profileData?.displayName}`) || msg.text?.includes('@all');

            if (!isMuted || hasMention) {
                playIncomingMessageSound();
                triggerHapticFeedback([100, 50, 100]);
                showSystemNotification(`Новое сообщение от ${sender}`, msg.text || 'Вам прислали файл', {
                  tag: `msg-${chatId}`,
                });
            }
        }
      }

      // Sidebar list update: move chat to top
      setProfile(prev => {
        if (!prev) return prev;
        const activeChats = prev.activeChats || [];
        let newActive = activeChats.filter(id => id !== chatId);
        newActive = [chatId, ...newActive];
        
        const hiddenChats = prev.hiddenChats || [];
        const newHidden = hiddenChats.filter(id => id !== chatId);
        
        const updated = { ...prev, activeChats: newActive, hiddenChats: newHidden };
        // Don't auto-emit every single message arrival if it's already at top
        if (activeChats[0] !== chatId || hiddenChats.includes(chatId)) {
          socket?.emit('profile:update', { uid: user.uid, profile: updated });
        }
        return updated;
      });
    });

    newSocket.on('message:typing:status', (data: { chatId: string, uid: string, isTyping: boolean }) => {
      setSocketTyping(prev => ({
        ...prev,
        [data.chatId]: {
          ...(prev[data.chatId] || {}),
          [data.uid]: data.isTyping
        }
      }));
    });

    newSocket.on('chat:history', ({ chatId, messages: histMsgs }: { chatId: string, messages: Message[] }) => {
      console.log('Received chat history for:', chatId, histMsgs.length, 'messages');
      try {
        const localCached = loadMessagesFromLocalCache(chatId);
        const mergedMap = new Map<string, Message>();
        localCached.forEach(m => mergedMap.set(m.id, m));
        histMsgs.forEach(m => mergedMap.set(m.id, m));
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        saveMessagesToLocalCache(chatId, mergedList);
        messageCacheRef.current[chatId] = mergedList;
        
        const currentChat = selectedChatRef.current;
        if (currentChat?.id === chatId) {
          setMessages(mergedList);
          setIsLoadingMessages(false);
        }
      } catch (e) {
        console.error('Error merging chat history:', e);
        messageCacheRef.current[chatId] = histMsgs;
        const currentChat = selectedChatRef.current;
        if (currentChat?.id === chatId) {
          setMessages(histMsgs);
          setIsLoadingMessages(false);
        }
      }
    });

    newSocket.on('users:list', (uList: UserProfile[]) => {
      setUsers(uList);
      try { localStorage.setItem('ordina_cached_users', JSON.stringify(uList)); } catch (e) {}
    });

    newSocket.on('groups:list', (gList: Group[]) => {
      setGroups(gList);
      try { localStorage.setItem('ordina_cached_groups', JSON.stringify(gList)); } catch (e) {}
    });

    newSocket.on('group:updated', (updatedGroup: Group) => {
      setGroups(prev => {
        const index = prev.findIndex(g => g.id === updatedGroup.id);
        const next = index === -1 ? [...prev, updatedGroup] : [...prev];
        if (index !== -1) next[index] = updatedGroup;
        try { localStorage.setItem('ordina_cached_groups', JSON.stringify(next)); } catch (e) {}
        return next;
      });
    });

    newSocket.on('message:updated', (updatedMsg: Message) => {
      setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });
    newSocket.on('message:deleted', (data: { id: string, chatId?: string }) => {
      // For backwards compatibility or simplified events
      const deletedId = typeof data === 'string' ? data : data.id;
      const chatId = typeof data === 'object' ? data.chatId : undefined;
      
      setMessages(prev => {
        const next = prev.filter(m => m.id !== deletedId);
        // If we know the chatId, update the cache
        if (chatId && messageCacheRef.current[chatId]) {
          messageCacheRef.current[chatId] = messageCacheRef.current[chatId].filter(m => m.id !== deletedId);
        } else {
          // Fallback: try to update the current chat cache
          const current = selectedChatRef.current;
          if (current && messageCacheRef.current[current.id]) {
            messageCacheRef.current[current.id] = messageCacheRef.current[current.id].filter(m => m.id !== deletedId);
          }
        }
        return next;
      });
      setRecentPreviews(prev => {
        const next = { ...prev };
        for (const cid in next) {
          if (next[cid]?.id === deletedId) {
            const cached = messageCacheRef.current[cid || chatId || ''] || [];
            if (cached.length > 0) {
              next[cid] = cached[cached.length - 1];
            } else {
              delete next[cid];
            }
          }
        }
        return next;
      });
    });

    newSocket.on('user:updated', (updatedUser: UserProfile) => {
      setUsers(prev => {
        const index = prev.findIndex(u => u.uid === updatedUser.uid);
        const next = index === -1 ? [...prev, updatedUser] : [...prev];
        if (index !== -1) next[index] = updatedUser;
        try { localStorage.setItem('ordina_cached_users', JSON.stringify(next)); } catch (e) {}
        return next;
      });
      // Use functional update to avoid stale profile closure
      setProfile(prev => {
        if (prev?.uid === updatedUser.uid) {
          // If the server tells us we have new data, we MUST accept it
          return { ...prev, ...updatedUser };
        }
        return prev;
      });
    });

    newSocket.on('auth:synced', (syncedProfile: UserProfile) => {
      console.log('Profile synced:', syncedProfile.uid);
      setProfile(syncedProfile);

      // Weekly multi-device usage check
      try {
        const lastCheck = localStorage.getItem('ordina_last_device_check_time');
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        
        const activeOtherDevices = (syncedProfile.devices || []).filter((d: any) => d.isApproved && d.id !== deviceId);
        if (activeOtherDevices.length > 0) {
          if (!lastCheck || (now - parseInt(lastCheck)) > SEVEN_DAYS) {
            setWeeklyCheckDevices(activeOtherDevices);
            setWeeklyCheckIndex(0);
            setShowWeeklyDeviceCheck(true);
            // Save check time to prevent spamming
            localStorage.setItem('ordina_last_device_check_time', now.toString());
          }
        }
      } catch (e) {
        console.error('Error initiating weekly device check:', e);
      }
      
      // Now that the blocking startup is done, fetch the heavy lists!
      newSocket.emit('users:fetch');
      newSocket.emit('groups:fetch');
      newSocket.emit('stickers:list');
      newSocket.emit('bots:list', syncedProfile.uid);
    });

    newSocket.on('auth:sync_error', (data: any) => {
      console.error('Auth sync error:', data);
      addToast('Ошибка синхронизации профиля', 'error');
      if (user) {
        setProfile({
          uid: user.uid,
          displayName: user.displayName || 'Пользователь',
          status: 'online',
          lastSeen: new Date().toISOString(),
          activeChats: ['global_channel']
        } as UserProfile);
      }
    });

    newSocket.on('sticker:pack:data', (pack: any) => {
      const gThis = window as any;
      if (pack) {
        setViewedStickerPack(pack);
      } else {
        if (gThis.addToast) gThis.addToast('Стикерпак не найден или был удален', 'error');
      }
    });

    newSocket.on('chat:deleted_everyone', (otherUserId: string) => {
      setMessages(prev => prev.filter(m => !(m.senderId === otherUserId && m.receiverId === user.uid) && !(m.senderId === user.uid && m.receiverId === otherUserId)));
      setRecentPreviews(prev => {
        const next = { ...prev };
        delete next[otherUserId];
        return next;
      });
      setProfile(prev => prev ? { ...prev, activeChats: prev.activeChats?.filter(id => id !== otherUserId) } : prev);
      // Try to clear it from selected chat if it is the deleted one
      if (selectedChatRef.current?.id === otherUserId) {
        setSelectedChat(null);
        setMobileView('list');
      }
    });

    newSocket.on('group:deleted', (groupId: string) => {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      setMessages(prev => prev.filter(m => m.groupId !== groupId));
      setRecentPreviews(prev => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      setProfile(prev => prev ? { ...prev, activeChats: prev.activeChats?.filter(id => id !== groupId) } : prev);
      if (selectedChatRef.current?.id === groupId) {
        setSelectedChat(null);
        setMobileView('list');
      }
    });

    newSocket.on('connect_error', (err) => {
      // Use debug log to prevent spamming console errors during cold server wake-up
      if (process.env.NODE_ENV !== 'production') {
        console.debug('Socket connecting...', err?.message || err);
      }
      setIsLoadingMessages(false);
    });

    newSocket.on('users:list', (usersList: UserProfile[]) => {
      setUsers(usersList);
    });

    newSocket.on('groups:list', (groupsList: Group[]) => {
      setGroups(groupsList);
    });

    newSocket.on('group:created', (newGroup: Group) => {
      setGroups(prev => [...prev, newGroup]);
    });

    return () => {
      newSocket.close();
      setSocketConnected(false);
    };
  }, [user, socketUrl, activeServerUrl]);

  // Sync presence to socket
  useEffect(() => {
    if (socket && user && profile) {
      socket.emit('user:online', {
        uid: user.uid,
        status: profile.status,
        customStatus: profile.customStatus
      });
    }
  }, [socket, user, profile?.status, profile?.customStatus]);

  useEffect(() => {
    if (!user || !groups.length) return;
    const global = groups.find(g => g.id === 'global_channel');
    if (global && global.ownerId === user.uid) {
      setIsAdminState(true);
    } else {
      setIsAdminState(false);
    }
    setIsAdminAssessed(true);
  }, [user, groups]);
  useEffect(() => {
    log(`RADAR_VISIBILITY_CHANGED: ${showRadar}`);
  }, [showRadar]);

  const [isRadarActive, setIsRadarActive] = useState(false);
  const [isRelayEnabled, setIsRelayEnabled] = useState(true);
  const [offlinePendingMessages, setOfflinePendingMessages] = useState<Message[]>([]);

  // Offline Caching & Relay Sync
  useEffect(() => {
    if (selectedChat?.id && messages.length > 0) {
      localStorage.setItem(`ordina_cache_${selectedChat.id}`, JSON.stringify(messages.slice(-100)));
    }
  }, [messages, selectedChat]);

  useEffect(() => {
    if (selectedChat?.id && !socketConnected) {
      const cached = localStorage.getItem(`ordina_cache_${selectedChat.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setMessages(parsed);
        } catch (e) {
          console.error('Cache load error', e);
        }
      }
    }
  }, [selectedChat, socketConnected]);
  useEffect(() => {
    log(`RADAR_ACTIVE_CHANGED: ${isRadarActive}`);
    
    let watchId: number | null = null;
    
    if (isRadarActive && user && profile) {
      if ('geolocation' in navigator) {
        // Temporarily frozen to save quota
        // watchId = navigator.geolocation.watchPosition(
        //   async (position) => {
        //     const { latitude, longitude } = position.coords;
        //     try {
        //       await updateDoc(doc(db, 'users', user.uid), {
        //         'meshPosition.lat': latitude,
        //         'meshPosition.lng': longitude,
        //         'meshPosition.x': (longitude + 180) * (400 / 360),
        //         'meshPosition.y': (90 - latitude) * (400 / 180)
        //       });
        //     } catch (error) {
        //       console.error("Error updating location:", error);
        //     }
        //   },
        //   (error) => {
        //     console.error("Geolocation error:", error);
        //   },
        //   { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
        // );
      } else {
        addToast('Геолокация не поддерживается вашим браузером', 'error');
        setIsRadarActive(false);
      }
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isRadarActive, user, profile]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [quotingMessage, setQuotingMessage] = useState<{msg: Message, text: string} | null>(null);
  const [textSelectForQuote, setTextSelectForQuote] = useState<Message | null>(null);
  const [forwardSelectedChats, setForwardSelectedChats] = useState<string[]>([]);
  const [forwardComment, setForwardComment] = useState('');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  
  const mediaMessages = useMemo(() => {
    return messages.filter(m => (m.type === 'image' && m.fileName !== 'sticker.jpg') || m.type === 'video');
  }, [messages]);

  const typingUsersText = useMemo(() => {
    if (!selectedChat || !user) return null;
    
    const chatTyping = socketTyping[selectedChat.id] || {};
    const typingUids = Object.keys(chatTyping).filter(uid => chatTyping[uid] && uid !== user.uid);
    
    if (typingUids.length === 0) return null;
    
    const typingUsersDetails = typingUids.map(uid => users.find(u => u.uid === uid)).filter(Boolean);
    if (typingUsersDetails.length === 0) return null;

    if (typingUsersDetails.length === 1) return `${typingUsersDetails[0]!.displayName} печатает...`;
    if (typingUsersDetails.length === 2) return `${typingUsersDetails[0]!.displayName} и ${typingUsersDetails[1]!.displayName} печатают...`;
    return `${typingUsersDetails[0]!.displayName}, ${typingUsersDetails[1]!.displayName} и еще ${typingUsersDetails.length - 2} печатают...`;
  }, [selectedChat, user, users, socketTyping]);

  const [deleteMenuMsgId, setDeleteMenuMsgId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, msg: Message} | null>(null);
    const [chatContextMenu, setChatContextMenu] = useState<{x: number, y: number, chat: {id: string, type: 'user' | 'group' | 'channel'}} | null>(null);
  const [contextMenuTimer, setContextMenuTimer] = useState(5);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const scrollToMessage = (id: string) => {
    if (!id) return;
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(id);
      setTimeout(() => setHighlightedMsgId(null), 3000);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => { setContextMenu(null); setChatContextMenu(null); };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (contextMenu) {
      setContextMenuTimer(5);
      interval = setInterval(() => {
        setContextMenuTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [contextMenu]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('Текст скопирован', 'success');
    }).catch(() => {
      addToast('Не удалось скопировать текст', 'error');
    });
  };

  const msgTouchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const msgTouchStartPosRef = useRef<{x: number, y: number} | null>(null);

  const startMsgTouchTimer = (e: React.TouchEvent, msg: Message) => {
    const touches = [{ 
      pageX: e.touches[0].pageX, 
      pageY: e.touches[0].pageY,
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY
    }];
    msgTouchStartPosRef.current = { x: e.touches[0].pageX, y: e.touches[0].pageY };
    if (msgTouchTimerRef.current) clearTimeout(msgTouchTimerRef.current);
    msgTouchTimerRef.current = setTimeout(() => {
      handleContextMenu({ preventDefault: () => {}, touches } as any, msg);
      if (typeof window !== 'undefined') window.getSelection()?.removeAllRanges();
    }, 500);
  };
  
  const handleMsgTouchMove = (e: React.TouchEvent) => {
    if (!msgTouchStartPosRef.current) return;
    const dx = Math.abs(e.touches[0].pageX - msgTouchStartPosRef.current.x);
    const dy = Math.abs(e.touches[0].pageY - msgTouchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearMsgTouchTimer();
    }
  };

  const clearMsgTouchTimer = () => {
    if (msgTouchTimerRef.current) {
      clearTimeout(msgTouchTimerRef.current);
      msgTouchTimerRef.current = null;
    }
    msgTouchStartPosRef.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: Message) => {
    e.preventDefault();
    let x = 0;
    let y = 0;
    
    if ('touches' in e) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }
    
    setContextMenu({ msg, x, y });
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'email_login' | 'email_register' | 'forgot_password'>('email_login');
  const [isSending, setIsSending] = useState(false);
  
  useEffect(() => {
    // Process redirect result for both Capacitor and Web/PWA
    setIsLoggingIn(true);
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log('[Auth] Redirect login successful:', result.user.uid);
      }
    }).catch(err => {
      console.error('[Auth] Redirect login error:', err);
    }).finally(() => {
      setIsLoggingIn(false);
    });
  }, []);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  
  const [cropModalInfo, setCropModalInfo] = useState<{ src: string, type: 'user' | 'group', groupId?: string } | null>(null);
  const [showFullAvatar, setShowFullAvatar] = useState<{ src: string } | null>(null);
  const [fullImgScale, setFullImgScale] = useState(1);
  const [fullImgRotation, setFullImgRotation] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingDragX, setRecordingDragX] = useState(0);
  const isRecordingCancelledRef = useRef(false);
  const recordStartPointerXRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const transcribedSpeechRef = useRef<string>('');
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isMultiDragSelecting, setIsMultiDragSelecting] = useState(false);
  const dragSelectingActiveRef = useRef(false);
  const msgLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveMediaToDevice = async (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) return;
    try {
      let finalUrl = fileUrl;
      if (fileUrl.startsWith('firestore://')) {
        const { getFileFromFirestore } = await import('./lib/fileStorage');
        const fileId = fileUrl.replace('firestore://', '');
        const fileData = await getFileFromFirestore(fileId);
        if (fileData) finalUrl = fileData.url;
      }

      const name = fileName || `ordina_${Date.now()}.${fileUrl.includes('image') ? 'jpg' : fileUrl.includes('audio') ? 'webm' : 'bin'}`;
      const link = document.createElement('a');
      link.href = finalUrl;
      link.download = name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`Файл "${name}" загружен`, 'success');
    } catch (e) {
      console.error('Download file error:', e);
      addToast('Ошибка сохранения файла', 'error');
    }
  };
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [isClearingData, setIsClearingData] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [confirmTimer, setConfirmTimer] = useState(0);
  const [dangerousFile, setDangerousFile] = useState<{url: string, name: string} | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaExpected, setCaptchaExpected] = useState(0);
  const [toasts, setToasts] = useState<Array<{ id: string, message: string, type: 'error' | 'success' | 'info' }>>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [debugPassword, setDebugPassword] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showStickersModal, setShowStickersModal] = useState(false);
  const [showBotsModal, setShowBotsModal] = useState(false);
  const [showTitleManager, setShowTitleManager] = useState(false);
  const [showNotificationSettingsModal, setShowNotificationSettingsModal] = useState(false);
  const [showMeshInspectorModal, setShowMeshInspectorModal] = useState(false);
  const [viewedStickerPack, setViewedStickerPack] = useState<any>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<{ url: string, name: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File, type: 'image' | 'video' | 'file', previewUrl: string } | null>(null);
  const [fileComment, setFileComment] = useState('');
  const [imageRotation, setImageRotation] = useState(0);

  const addToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    (window as any).addToast = addToast;
  }, [addToast]);

  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollIsAnonymous, setPollIsAnonymous] = useState(false);
  const [pollIsMultiple, setPollIsMultiple] = useState(false);

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      addToast('Введите вопрос и минимум 2 варианта ответа', 'error');
      return;
    }
    
    const pollData = {
      question: pollQuestion.trim(),
      options: pollOptions.filter(o => o.trim()).map(text => ({
        id: Math.random().toString(36).substr(2, 9),
        text: text.trim(),
        votes: [] as string[]
      })),
      isAnonymous: pollIsAnonymous,
      isMultipleChoice: pollIsMultiple
    };

    const newMessage: Partial<Message> = {
      id: Date.now().toString(),
      senderId: user!.uid,
      text: 'Опрос',
      type: 'poll',
      poll: pollData,
      createdAt: new Date().toISOString(),
      status: 'sent',
      readBy: [user!.uid],
      asChannel: selectedChat?.type === 'channel' && !postAsMe
    };

    if (selectedChat?.type === 'user') {
      newMessage.receiverId = selectedChat.id;
    } else {
      newMessage.groupId = selectedChat?.id;
    }

    try {
      socket?.emit('message:new', { chatId: selectedChat?.id, message: newMessage });
      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollIsAnonymous(false);
      setPollIsMultiple(false);
    } catch (error) {
      addToast('Ошибка при создании опроса', 'error');
    }
  };

  const confirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
    setConfirmTimer(5);
    setShowConfirmModal(true);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showConfirmModal) {
      interval = setInterval(() => {
        setConfirmTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showConfirmModal]);

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState(0);
  const [isDeleteForMeDisabled, setIsDeleteForMeDisabled] = useState(true);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editBackgroundURL, setEditBackgroundURL] = useState('');

  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'radar'>('list');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastChatIdRef = useRef<string | null>(null);
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    // Show button if > ~10 messages up. Assuming ~50px per message.
    if (distanceToBottom > 500) {
      setShowScrollToBottom(true);
    } else {
      setShowScrollToBottom(false);
    }

    // Load more messages if scrolling up
    // In flex-col, scrolling up means scrollTop approaches 0
    if (scrollTop < 300 && messages.length >= messageLimit && !isLoadingMessages) {
       // Cap the history loading to prevent out of quota or performance issues on a huge query 
      if (messageLimit < 200) {
        setIsLoadingMessages(true);
        setMessageLimit(prev => Math.min(prev + 30, 200));
      }
    }
  };

  const handleMessagesUpdate = useCallback((msgs: Message[]) => {
    // legacy, using useEffect instead
  }, []);

  useEffect(() => {
    const isNewChat = lastChatIdRef.current !== (selectedChat?.id || null);
    if (isNewChat) {
      lastChatIdRef.current = selectedChat?.id || null;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    } else {
      const container = messagesContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        setTimeout(() => {
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 400;
          const isMyMessage = messages.length > 0 && messages[messages.length - 1].senderId === user?.uid;
          
          if (isNearBottom || isMyMessage) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }, 50);
      }
    }
  }, [messages, selectedChat?.id, user]);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false);
  const [customStatus, setCustomStatus] = useState('');

  const [postAsMeMap, setPostAsMeMap] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('postAsMeMap') || '{}');
    } catch { return {}; }
  });

  const postAsMe = selectedChat ? (postAsMeMap[selectedChat.id] ?? false) : false;
  const setPostAsMe = (val: boolean) => {
    if (!selectedChat) return;
    setPostAsMeMap(prev => {
      const next = { ...prev, [selectedChat.id]: val };
      localStorage.setItem('postAsMeMap', JSON.stringify(next));
      return next;
    });
  };
  const [userStatus, setUserStatus] = useState<'online' | 'away' | 'busy' | 'dnd' | 'offline'>('online');

  // Removed Firestore connection test

  const cipher = (text: string, key: string = 'ordina-mesh-secret') => {
    return text.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join('');
  };

  const encryptMessage = (text: string) => {
    const encrypted = btoa(cipher(text));
    return `ORD:${encrypted}`;
  };

  const decryptMessage = (text: string) => {
    if (!text.startsWith('ORD:')) return text;
    try {
      const encrypted = text.substring(4);
      return cipher(atob(encrypted));
    } catch (e) {
      return '[Ошибка расшифровки]';
    }
  };

  const radarNodes = useMemo(() => {
    const list: any[] = [];
    const currentUid = user?.uid || profile?.uid || 'local_me';
    const currentName = user?.displayName || profile?.displayName || 'Вы';

    users.forEach(u => {
      list.push({
        id: u.uid,
        displayName: u.displayName || (u as any).name || 'Аноним',
        x: u.meshPosition?.x,
        y: u.meshPosition?.y,
        lat: u.meshPosition?.lat,
        lng: u.meshPosition?.lng,
        isOnline: isUserOnline(u)
      });
    });

    if (!list.some(n => n.id === currentUid)) {
      list.unshift({
        id: currentUid,
        displayName: currentName,
        x: profile?.meshPosition?.x || 200,
        y: profile?.meshPosition?.y || 200,
        lat: profile?.meshPosition?.lat,
        lng: profile?.meshPosition?.lng,
        isOnline: true
      });
    }

    return list;
  }, [users, user, profile, isUserOnline]);

  const handleDatabaseError = (error: any, operationType: string) => {
    console.error(`Database error during ${operationType}:`, error);
  };

  // Internet status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Log function for debug
  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMsg = `[${timestamp}] ${msg}`;
    setDebugLogs(prev => [...prev.slice(-99), formattedMsg]);
    // console.log is already captured, so calling it here would be redundant
    // and potentially cause cycles if not careful.
    // We'll use the original console.log if we really need to bypass capture,
    // but for now, let's just let the capture handle it if we want it in the console.
  }, []);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const attachmentMenuButtonRef = useRef<HTMLButtonElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (showChatMenu) {
        const isOutsideMenu = !menuRef.current || !menuRef.current.contains(target);
        const isOutsideButton = !menuButtonRef.current || !menuButtonRef.current.contains(target);
        if (isOutsideMenu && isOutsideButton) {
          setShowChatMenu(false);
        }
      }

      if (showAttachmentMenu) {
        const isOutsideMenu = !attachmentMenuRef.current || !attachmentMenuRef.current.contains(target);
        const isOutsideButton = !attachmentMenuButtonRef.current || !attachmentMenuButtonRef.current.contains(target);
        if (isOutsideMenu && isOutsideButton) {
          setShowAttachmentMenu(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChatMenu, showAttachmentMenu]);

  // Global log capture
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const capture = (type: string, args: any[]) => {
      const msg = args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch (e) {
          return String(arg);
        }
      }).join(' ');
      const timestamp = new Date().toLocaleTimeString();
      setDebugLogs(prev => [...prev.slice(-99), `[${timestamp}] ${type}: ${msg}`]);
    };

    console.log = (...args) => {
      capture('LOG', args);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      capture('ERR', args);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      capture('WRN', args);
      originalWarn.apply(console, args);
    };

    log('LOG_CAPTURE_READY');

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 1200;
          
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpdateGroupSettings = async (groupId: string, updates: Partial<Group>) => {
    // OPTIMISTIC UPDATE
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
    
    if (socket) {
      socket.emit('group:update', { id: groupId, update: updates });
    }

    if ((window as any).addToast) (window as any).addToast('Настройки группы обновлены', 'success');
  };

  const handleBanUser = async (groupId: string, userId: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const bannedUsers = [...(group.bannedUsers || []), userId];
      const members = group.members.filter(m => m !== userId);
      const memberRoles = { ...group.memberRoles };
      delete memberRoles[userId];

      socket?.emit('group:update', { 
        id: groupId, 
        update: { bannedUsers, members, memberRoles } 
      });
      addToast('Пользователь заблокирован', 'success');
    } catch (error) {
      addToast('Ошибка при блокировке', 'error');
    }
  };

  const handleBanUserFromComments = async (groupId: string, userId: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const bannedFromComments = [...(group.bannedFromComments || []), userId];
      socket?.emit('group:update', { 
        id: groupId, 
        update: { bannedFromComments } 
      });
      addToast('Пользователю запрещено комментировать', 'success');
    } catch (error) {
      addToast('Ошибка при блокировке комментариев', 'error');
    }
  };

  const handleLogout = async () => {
    if (user) {
      socket?.emit('profile:update', { 
        uid: user.uid, 
        profile: { status: 'offline', lastSeen: new Date().toISOString() } 
      });
    }
    localStorage.removeItem('ordina_guest_id');
    localStorage.removeItem('ordina_oauth_user');
    await auth.signOut();
    setShowProfile(false);
    setShowSettings(false);
    window.location.reload();
  };

  // Handle online/offline status on window close
  // Handle online/offline status and heartbeat
  useEffect(() => {
    if (!user) return;

    // Start location watch only if user enables it later, temporarily frozen
    // to save reads/writes quota.

    const handleBeforeUnload = () => {
      // Avoid massive background updates. Status is no longer strictly synced
      // to avoid quota exhaustion.
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Auth listener
  useEffect(() => {
    const loadCachedProfile = (uid: string, fallback?: UserProfile): UserProfile => {
      try {
        const savedStr = localStorage.getItem(`ordina_profile_${uid}`);
        if (savedStr) {
          const parsed = JSON.parse(savedStr);
          return { ...(fallback || {}), ...parsed };
        }
      } catch (e) {}
      return fallback || { uid, displayName: 'Пользователь', status: 'online', lastSeen: new Date().toISOString(), activeChats: ['global_channel'] };
    };

    // 1. Check if there is a saved OAuth user first
    const savedOAuthUser = localStorage.getItem('ordina_oauth_user');
    if (savedOAuthUser) {
      try {
        const u = JSON.parse(savedOAuthUser);
        setUser(u);
        setProfile(loadCachedProfile(u.uid, {
          uid: u.uid,
          displayName: u.displayName || 'Пользователь',
          photoURL: u.photoURL || '',
          status: 'online',
          lastSeen: new Date().toISOString(),
          activeChats: ['global_channel']
        }));
      } catch (e) {
        console.error('Error parsing saved OAuth user:', e);
      }
    } else {
      // 2. Check if there is a saved guest user
      const guestId = localStorage.getItem('ordina_guest_id');
      if (guestId) {
        const guestUser = {
          uid: guestId,
          displayName: 'Гость ' + guestId.substr(6, 4),
          isAnonymous: true
        } as any;
        setUser(guestUser);
        
        const guestProfile: UserProfile = loadCachedProfile(guestId, {
          uid: guestId,
          displayName: guestUser.displayName,
          status: 'online',
          lastSeen: new Date().toISOString(),
          activeChats: ['global_channel']
        });
        setProfile(guestProfile);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      // If we have a local guest user or custom OAuth user, do not override with null from Firebase
      if (!u) {
        if (localStorage.getItem('ordina_guest_id') || localStorage.getItem('ordina_oauth_user')) {
          return;
        }
        setUser(null);
        setProfile(null);
        setSelectedChat(null);
      } else {
        setUser(u);
        setProfile(prev => prev || loadCachedProfile(u.uid, {
          uid: u.uid,
          displayName: u.displayName || 'Пользователь',
          photoURL: u.photoURL || '',
          status: 'online',
          lastSeen: new Date().toISOString(),
          activeChats: ['global_channel']
        }));
      }
    });

    const handleOAuthMessage = (event: MessageEvent) => {
      const backendOrigin = getServerUrl(socketUrl);

      const isTrustedOrigin = 
        event.origin === window.location.origin || 
        event.origin === backendOrigin ||
        backendOrigin.startsWith(event.origin) ||
        event.origin.includes('run.app');

      if (!isTrustedOrigin) return;
      if (event.data && event.data.type === 'auth_success') {
        const oauthUser = event.data.user;
        localStorage.setItem('ordina_oauth_user', JSON.stringify(oauthUser));
        localStorage.removeItem('ordina_guest_id'); // clear guest if any
        setUser(oauthUser);
        addToast(`С возвращением, ${oauthUser.displayName}!`, 'success');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    
    // Check if there is a pending oauth user in localStorage
    const pendingStr = localStorage.getItem('ordina_oauth_pending');
    if (pendingStr) {
      try {
        const u = JSON.parse(pendingStr);
        localStorage.setItem('ordina_oauth_user', JSON.stringify(u));
        localStorage.removeItem('ordina_oauth_pending');
        localStorage.removeItem('ordina_guest_id');
        setUser(u);
        addToast(`С возвращением, ${u.displayName}!`, 'success');
      } catch (e) {}
    }

    return () => {
      unsubscribe();
      window.removeEventListener('message', handleOAuthMessage);
    };
  }, []);

  // Removed duplicate users:fetch useEffect
  
  // Removed duplicate groups:fetch useEffect

  const hiddenChatsRef = useRef<string[]>([]);
  const activeChatsRef = useRef<string[]>([]);
  useEffect(() => {
    hiddenChatsRef.current = profile?.hiddenChats || [];
    activeChatsRef.current = profile?.activeChats || [];
  }, [profile?.hiddenChats, profile?.activeChats]);

  const groupsRef = useRef<Group[]>([]);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  const appLoadTimeRef = useRef(new Date().toISOString());

  // Real-time unhiding is handled via socket message:received events
  useEffect(() => {
    if (!user) return;
  }, [user]);

  const handleUpdateProfile = async () => {
    console.log('handleUpdateProfile clicked');
    if (!profile || !user) {
      log('UPDATE_PROFILE_ERROR: No profile or user found');
      return;
    }
    
    const updatedProfile = {
      ...profile,
      displayName: editName,
      username: editUsername,
      bio: editBio,
      photoURL: editAvatar,
      profileBackgroundURL: editBackgroundURL,
      status: userStatus,
      customStatus: customStatus
    };
    
    // Opt-out of Firestore for high-traffic updates, use Socket
    if (socket) {
      socket.emit('profile:update', { uid: user.uid, profile: updatedProfile });
    }
    
    setProfile(updatedProfile);
    setIsEditingProfile(false);
    
    // Auth profile also needs updating
    try {
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(user, {
        displayName: editName,
        photoURL: editAvatar
      });
      addToast('Профиль сохранен', 'success');
    } catch (e) {
      console.warn('Auth profile sync failed', e);
    }
  };

  const selectChat = async (chat: { type: 'user' | 'group' | 'channel'; id: string }) => {
    if (user?.isAnonymous) {
       if (chat.type === 'user') {
         const userChats = (profile?.activeChats || []).filter(c => c !== 'global_channel' && users.find(u => u.uid === c));
         if (userChats.length >= 1 && !userChats.includes(chat.id)) {
             (window as any).addToast?.('Гости могут общаться только с одним человеком. Чтобы открыть новый чат, удалите текущий.', 'error');
             return;
         }
       } else if (chat.id !== 'global_channel') {
         (window as any).addToast?.('Гости не могут вступать в другие группы.', 'error');
         return;
       }
    }
    
    setMessageLimit(30);
    let cached = messageCacheRef.current[chat.id];
    if (!cached || cached.length === 0) {
      try {
        cached = loadMessagesFromLocalCache(chat.id);
        if (cached && cached.length > 0) {
          messageCacheRef.current[chat.id] = cached;
        }
      } catch (e) {
        console.error('Error loading local cache in selectChat:', e);
      }
    }
    
    // Clear messages and show loading ONLY if not cached to prevent flashing/blinking
    if (!cached || cached.length === 0) {
      setMessages([]);
      setIsLoadingMessages(true);
    } else {
      setMessages(cached);
      setIsLoadingMessages(false);
    }
    
    setActiveThread(null); // Clear active thread too
    
    setSelectedChat(chat as any); // cast for now to avoid extensive type refactoring if needed, but will update types below
    setNotifications(prev => {
      const next = { ...prev };
      delete next[chat.id];
      return next;
    });
    setMobileView('chat');
    setShowChatMenu(false);
    setActiveThread(null);
    setReplyTo(null);
    setEditingMessage(null);
    setInputText('');
    setPendingFile(null);
    setFileComment('');
    
    if ((chat.type === 'user' || chat.type === 'channel') && user) {
      const hiddenChats = profile?.hiddenChats || [];
      if (hiddenChats.includes(chat.id)) {
        const newHidden = hiddenChats.filter(id => id !== chat.id);
        socket?.emit('profile:update', { uid: user.uid, profile: { hiddenChats: newHidden } });
        setProfile(prev => prev ? { ...prev, hiddenChats: newHidden } : null);
      }
    }
  };

  const [messageLimit, setMessageLimit] = useState(30);

  // Sync messages
  useEffect(() => {
    if (!user || !selectedChat) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    let cached = messageCacheRef.current[selectedChat.id];
    if (!cached || cached.length === 0) {
      try {
        cached = loadMessagesFromLocalCache(selectedChat.id);
        if (cached && cached.length > 0) {
          messageCacheRef.current[selectedChat.id] = cached;
        }
      } catch (e) {
        console.error('Error loading local cache in sync useEffect:', e);
      }
    }
    
    // Determine the actual limit we should request. If the user scrolled up previously,
    // we want to honor that cached length.
    let requiredLimit = messageLimit;
    if (cached && requiredLimit < cached.length) {
      requiredLimit = cached.length;
      // Also update the state so next scroll starts from the correct length
      setMessageLimit(requiredLimit);
    }

    if (cached) {
      setMessages(cached);
      setIsLoadingMessages(false);
      // We still join the room to get new messages and real-time updates
      socket?.emit('chat:join', { ...selectedChat, limit: requiredLimit, _uid: user?.uid });
    } else {
      if (messages.length === 0) {
        setIsLoadingMessages(true);
      }
      // Fetch from Socket.io
      socket?.emit('chat:join', { ...selectedChat, limit: requiredLimit, _uid: user?.uid });
    }

    const loaderTimeout = setTimeout(() => {
      setIsLoadingMessages(false);
    }, 8000);

    return () => {
      clearTimeout(loaderTimeout);
      socket?.emit('chat:leave', selectedChat.id);
    };
  }, [user, selectedChat?.id, messageLimit, socket]);

  const markedMessagesRef = useRef<Set<string>>(new Set());

  // Mark messages as read (Optimized: only mark newest message to save writes)
  useEffect(() => {
    if (!user || !messages.length || !selectedChat) return;

    // Only mark the LATEST unread message. 
    // In many UI designs, marking the latest implies reading everything before it.
    const unreadMessages = messages.filter(
      msg => msg.senderId !== user.uid && !(msg.readBy || []).includes(user.uid) && !markedMessagesRef.current.has(msg.id)
    );

    if (unreadMessages.length > 0) {
      // Sort by creation to find the most recent
      const latestUnread = unreadMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      const markAsRead = async (msg: Message) => {
        try {
          markedMessagesRef.current.add(msg.id);
          socket?.emit('message:update', { 
            id: msg.id, 
            chatId: selectedChat?.id, 
            update: { readBy: [...(msg.readBy || []), user.uid] } 
          });
        } catch (error) {
          console.error("Read receipt error:", error);
        }
      };

      markAsRead(latestUnread);
    }
  }, [messages, user, selectedChat]);

  const handleClearAllData = async () => {
    if (!user) return;
    
    confirm(
      'Сброс данных',
      'Вы уверены, что хотите удалить ВСЕ свои сообщения, группы и аккаунт? Это действие необратимо.',
      async () => {
        setIsClearingData(true);
        socket?.emit('user:delete_all_data', user.uid);
        addToast('Данные и аккаунт успешно удалены', 'success');
        await auth.signOut();
        setIsClearingData(false);
      }
    );
  };

  const handleAnonymousLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInAnonymously(auth);
      log('ANON_LOGIN_SUCCESS');
    } catch (error: any) {
      console.error('Anon login error:', error);
      addToast('Ошибка входа анонимно. Проверьте соединение.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = authEmail.trim().toLowerCase();
    if (isLoggingIn || !email || !authPassword) return;
    setIsLoggingIn(true);
    log('EMAIL_LOGIN_START');
    try {
      await signInWithEmailAndPassword(auth, email, authPassword);
      log('EMAIL_LOGIN_SUCCESS');
    } catch (error: any) {
      console.warn('Login attempt failed:', error?.code || error?.message);
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
        addToast('Неверный email или пароль. Если у вас еще нет аккаунта, перейдите на вкладку «Регистрация».', 'error');
      } else if (error?.code === 'auth/too-many-requests') {
        addToast('Слишком много попыток входа. Попробуйте снова чуть позже или сбросьте пароль.', 'error');
      } else {
        addToast(`Ошибка входа: ${error?.message || 'Проверьте данные'}`, 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = authEmail.trim().toLowerCase();
    if (isLoggingIn || !email || !authPassword) return;
    if (authPassword.length < 6) {
      addToast('Пароль должен быть от 6 символов', 'error');
      return;
    }
    setIsLoggingIn(true);
    log('EMAIL_REGISTER_START');
    try {
      await createUserWithEmailAndPassword(auth, email, authPassword);
      log('EMAIL_REGISTER_SUCCESS');
    } catch (error: any) {
      console.error('Register error:', error);
      if (error?.code === 'auth/email-already-in-use') {
        addToast('Пользователь с таким email уже существует. Попробуйте войти.', 'error');
      } else {
        addToast('Ошибка регистрации. Проверьте соединение.', 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = authEmail.trim().toLowerCase();
    if (isLoggingIn || !email) return;
    setIsLoggingIn(true);
    try {
      await sendPasswordResetEmail(auth, email);
      addToast('Ссылка для задания/сброса пароля отправлена на вашу почту! Обязательно проверьте папку "Спам" (Spam), если письмо не пришло в течение минуты.', 'success');
      setAuthMode('email_login');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      addToast(`Ошибка: ${err.message || 'Не удалось отправить ссылку'}`, 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };


  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    log('GOOGLE_LOGIN_START');
    try {
      const provider = new GoogleAuthProvider();
      
      // Detect mobile device or PWA standalone mode
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isPwaStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

      if ((window as any).Capacitor) {
        try {
          // Запрос нативной авторизации Google через плагин
          const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
          const result = await FirebaseAuthentication.signInWithGoogle();
          
          if (result.credential?.idToken) {
            const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
            const credential = GoogleAuthProvider.credential(result.credential.idToken);
            await signInWithCredential(auth, credential);
          } else {
             addToast('Нативный вход выполнен, ожидаем синхронизацию...', 'info');
          }
        } catch (nativeError: any) {
          console.error('Native Google Auth failed:', nativeError);
          console.log('Falling back to redirect-based web login on Capacitor...');
          const { signInWithRedirect } = await import('firebase/auth');
          await signInWithRedirect(auth, provider);
        }
      } else {
        // Web / PWA environment - try popup first to support iframe/sandbox, then fall back to redirect
        try {
          console.log('Attempting popup sign-in...');
          await signInWithPopup(auth, provider);
        } catch (popupError: any) {
          console.warn('Popup login failed, trying redirect fallback...', popupError);
          // If popup is blocked or failed, try redirect-based sign-in as fallback
          try {
            const { signInWithRedirect } = await import('firebase/auth');
            await signInWithRedirect(auth, provider);
          } catch (redirectError: any) {
            console.error('Redirect sign-in failed as well:', redirectError);
            throw popupError; // Throw original popup error or handle accordingly
          }
        }
      }
      log('GOOGLE_LOGIN_SUCCESS');
    } catch (error: any) {
      console.error('Login error:', error);
      const currentHost = window.location.hostname;
      if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
        addToast(`Добавьте ${currentHost} в "Authorized domains" в консоли Firebase (раздел Auth -> Settings)`, 'error');
      } else {
        addToast(`Ошибка: ${error.message || 'Ошибка входа через Google'}`, 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    log('GUEST_LOGIN_START');
    try {
      const savedGuestId = localStorage.getItem('ordina_guest_id');
      const guestId = savedGuestId || 'guest_' + Math.random().toString(36).substr(2, 9);
      if (!savedGuestId) localStorage.setItem('ordina_guest_id', guestId);
      const guestUser = {
        uid: guestId,
        displayName: 'Гость ' + guestId.substr(6, 4),
        isAnonymous: true
      } as any;
      
      const guestProfile: UserProfile = {
        uid: guestId,
        displayName: guestUser.displayName,
        status: 'online',
        lastSeen: new Date().toISOString(),
        activeChats: ['global_channel']
      };
      
      socket?.emit('profile:update', { uid: guestId, profile: guestProfile });
      setUser(guestUser);
      setProfile(guestProfile);
    } catch (error) {
      addToast('Ошибка входа. Проверьте соединение с сервером.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTyping = () => {
    if (!socket || !user || !selectedChat) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    // Emit typing start
    socket.emit('message:typing', {
      chatId: selectedChat.id,
      uid: user.uid,
      isTyping: true
    });

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('message:typing', {
        chatId: selectedChat.id,
        uid: user.uid,
        isTyping: false
      });
    }, 3000);
  };

  const handleSendGame = async (gameType: string) => {
    if (!user || !selectedChat) return;

    try {
      const newMessage: any = {
        senderId: user.uid,
        type: 'game',
        gameType,
        gameState: gameType === 'words' ? {
          status: selectedChat.type === 'user' ? 'playing' : 'waiting',
          creatorId: user.uid,
          opponentId: selectedChat.type === 'user' ? selectedChat.id : null,
          turnId: user.uid,
          words: [],
          lastWord: null
        } : {
          board: Array(9).fill(null),
          xIsNext: true,
          winner: null,
          playerX: user.uid,
          playerO: selectedChat.type === 'user' ? selectedChat.id : null
        },
        createdAt: new Date().toISOString(),
        isEncrypted: false,
        asChannel: selectedChat.type === 'channel' && !postAsMe
      };

      if (selectedChat.type !== 'user') {
        newMessage.groupId = selectedChat.id;
      } else {
        newMessage.receiverId = selectedChat.id;
      }

      socket?.emit('message:new', { chatId: selectedChat?.id, message: newMessage });
    } catch (error) {
      console.error("Error sending game:", error);
      addToast('Ошибка при создании игры', 'error');
    }
  };

  const handleSendSticker = async (url: string, packId?: string) => {
    if (!user || !selectedChat) return;

    if (selectedChat.type === 'user' && selectedChat.id !== user.uid) {
      const chatMessages = messages.filter(m => 
        (m.senderId === user.uid && m.receiverId === selectedChat.id) ||
        (m.senderId === selectedChat.id && m.receiverId === user.uid)
      );
      const theirMessages = chatMessages.filter(m => m.senderId === selectedChat.id);
      if (theirMessages.length === 0) {
        addToast('Вы не можете отправлять стикеры, пока пользователь не ответит.', 'error');
        return;
      }
    }

    if (selectedChat.type !== 'user') {
      const group = groups.find(g => g.id === selectedChat.id);
      if (group) {
        const role = group.memberRoles[user.uid] || 'member';
        const perms = group.permissions[role === 'member' ? 'member' : 'admin'];
        const isBannedFromComments = group.bannedFromComments?.includes(user.uid);

        if (activeThread) {
          if (isBannedFromComments) {
            addToast('Вам запрещено комментировать', 'error');
            return;
          }
          if (!perms.canComment && !isGlobalAdmin) {
            addToast('Комментирование отключено', 'error');
            return;
          }
          if (perms.canSendStickersInComments === false && !isGlobalAdmin) {
            addToast('Отправка стикеров в комментариях запрещена', 'error');
            return;
          }
        } else {
          if (!perms.canSendMedia && role === 'member' && !isGlobalAdmin) {
            addToast('Отправка медиа ограничена', 'error');
            return;
          }
        }
      }
    }

    try {
      setIsSending(true);
      const meshNodes: MeshNode[] = users.map(u => ({
        id: u.uid,
        displayName: u.displayName,
        x: u.meshPosition?.x,
        y: u.meshPosition?.y,
        lat: u.meshPosition?.lat,
        lng: u.meshPosition?.lng,
        isOnline: u.status === 'online'
      }));

      const relayPath = selectedChat.type === 'user' 
        ? getRelayPath(meshNodes, user.uid, selectedChat.id) 
        : null;

      const newMessage: any = {
        senderId: user.uid,
        text: '',
        type: 'image',
        fileUrl: url,
        fileName: 'sticker.jpg',
        createdAt: new Date().toISOString(),
        asChannel: selectedChat.type === 'channel' && !postAsMe
      };
      if (packId) newMessage.stickerPackId = packId;

      if (replyTo && typeof replyTo.id === 'string' && replyTo.id.trim() !== '') {
        newMessage.replyToId = replyTo.id;
      }

      if (relayPath && Array.isArray(relayPath)) {
        newMessage.relayPath = relayPath;
      }

      if (selectedChat.type !== 'user') {
        newMessage.groupId = selectedChat.id;
      } else {
        newMessage.receiverId = selectedChat.id;
      }

      const cleanedMessage = cleanObject(newMessage);
      
      if (socket && !socket.connected) {
        socket.connect();
      }
      
      for (const key in cleanedMessage) {
        if (cleanedMessage[key] === undefined || cleanedMessage[key] === null) {
          delete cleanedMessage[key];
        }
      }

      socket?.emit('message:new', { chatId: selectedChat?.id, message: cleanedMessage });
      
      if (selectedChat.type === 'user' && profile && !(profile.activeChats || []).includes(selectedChat.id)) {
        const newActiveChats = [...(profile.activeChats || []), selectedChat.id];
        socket?.emit('profile:update', { uid: user.uid, profile: { activeChats: newActiveChats } });
      }

      setReplyTo(null);
    } catch (error) {
      addToast('Ошибка при отправке стикера', 'error');
      handleDatabaseError(error, 'create:messages');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, scheduleAt?: string) => {
    e?.preventDefault();

    if (isEncryptionEnabled) {
      addToast('Включена защита от случайной отправки. Нажмите снова на щит для разблокировки', 'info');
      return;
    }

    if (!user || !selectedChat || (!inputText.trim() && !editingMessage)) {
      if (!scheduleAt) return; // if schedule date but no text, allow only if text is provided. Actually need text or editing.
      if (!inputText.trim()) return;
    }

    if (isSending) return;

    try {
      setIsSending(true);
      
      if (editingMessage) {
        const updateData = cleanObject({
          text: inputText,
          updatedAt: new Date().toISOString(),
          isEdited: true
        });

        socket?.emit('message:update', { id: editingMessage.id, chatId: selectedChat.id, update: updateData });
        setEditingMessage(null);
        setInputText('');
        return;
      }
      
      if (selectedChat.type === 'user' && selectedChat.id !== user.uid && !((users.find(u => u.uid === selectedChat.id)) as any)?.isBot) {
        // Count messages sent by me to them in this specific chat
        const myMessagesToThem = messages.filter(m => m.senderId === user.uid && m.receiverId === selectedChat.id);
        const theirMessagesToMe = messages.filter(m => m.senderId === selectedChat.id && m.receiverId === user.uid);
        
        if (theirMessagesToMe.length === 0 && myMessagesToThem.length >= 3) {
          addToast('Вы не можете отправить больше 3-х сообщений, пока пользователь не ответит.', 'error');
          setIsSending(false);
          return;
        }

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(inputText)) {
          if (theirMessagesToMe.length === 0) {
             addToast('Вы не можете отправлять ссылки, пока пользователь не ответит.', 'error');
             setIsSending(false);
             return;
          }
        }
      }

      const isChannelSend = (selectedChat.type === 'channel' || (activeChatData as Group)?.type === 'channel') && !postAsMe;

      const shouldEncrypt = (isEncryptionEnabled && (!((users.find(u => u.uid === selectedChat.id)) as any)?.isBot) && selectedChat.type === 'user') || (isEncryptionEnabled && selectedChat.type === 'group');

      const newMessage: any = {
        id: createMessageId(user.uid, Date.now()),
        senderId: user?.uid || '',
        text: shouldEncrypt ? encryptMessage(inputText) : inputText,
        type: 'text',
        createdAt: new Date().toISOString(),
        isEncrypted: !!shouldEncrypt,
        asChannel: isChannelSend,
      };

      if (replyTo && replyTo.id) newMessage.replyToId = replyTo.id;
      if (activeThread && activeThread.id) newMessage.threadId = activeThread.id;

      if (selectedChat.type !== 'user') {
        newMessage.groupId = selectedChat.id;
      } else {
        newMessage.receiverId = selectedChat.id;
      }

      const cleanedMessage = cleanObject(newMessage);
      
      if (socket && !socket.connected) {
        socket.connect();
      }
      
      const serialized = JSON.stringify(cleanedMessage);
      if (serialized.length > 15 * 1024 * 1024) {
        throw new Error('Файл слишком большой. Максимальный размер 15 МБ.');
      }

      if (scheduleAt) {
        socket?.emit('message:schedule', { chatId: selectedChat.id, message: cleanedMessage, sendAt: scheduleAt });
        addToast(`Запланировано на ${new Date(scheduleAt).toLocaleString()}`, 'success');
      } else {
        // MESH RELAY: Check if recipient is online
        const receiverId = selectedChat.id;
        const isReceiverOnline = socketPresences.some(p => p.uid === receiverId && p.status === 'online');
        
        if (!isReceiverOnline && selectedChat.type === 'user' && isRelayEnabled) {
           const nextHop = findNextHop(users as any, user.uid, receiverId);
           if (nextHop && nextHop !== user.uid) {
              cleanedMessage.relayTo = nextHop;
              cleanedMessage.relayPath = [user.uid];
              addToast('Отправлено через Mesh-узел', 'info');
           }
        }

        socket?.emit('message:new', { chatId: selectedChat.id, message: cleanedMessage });
        
        if (selectedChat.type === 'user' && profile && !(profile.activeChats || []).includes(selectedChat.id)) {
          const newActive = [...(profile.activeChats || []), selectedChat.id];
          setProfile(prev => prev ? { ...prev, activeChats: newActive } : null);
          socket?.emit('profile:update', { uid: user.uid, profile: { activeChats: newActive } });
        }
      }

      setInputText('');
      setReplyTo(null);
    } catch (error: any) {
      addToast(error?.message || 'Ошибка при отправке', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const cancelRecording = () => {
    if (isRecordingCancelledRef.current) return;
    isRecordingCancelledRef.current = true;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch(e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    setRecordingDragX(0);
    recordStartPointerXRef.current = null;
    triggerHapticFeedback();
    addToast('Запись отменена', 'info');
  };

  const startRecording = async (e?: React.PointerEvent | React.TouchEvent) => {
    if (isEncryptionEnabled) {
      addToast('Включена защита от случайной отправки. Нажмите снова на щит для разблокировки', 'info');
      return;
    }

    const startX = e && 'clientX' in e ? e.clientX : (e && 'touches' in e && e.touches[0] ? e.touches[0].clientX : null);
    recordStartPointerXRef.current = startX;
    isRecordingCancelledRef.current = false;
    setRecordingDragX(0);

    // Initialize Web Speech Recognition
    transcribedSpeechRef.current = '';
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.lang = 'ru-RU';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (ev: any) => {
          let fullTranscript = '';
          for (let i = 0; i < ev.results.length; ++i) {
            if (ev.results[i] && ev.results[i][0]) {
              fullTranscript += ev.results[i][0].transcript;
            }
          }
          if (fullTranscript.trim()) {
            transcribedSpeechRef.current = fullTranscript.trim();
          }
        };
        rec.start();
        speechRecognitionRef.current = rec;
      } catch (err) {
        console.warn('SpeechRec error:', err);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      let recSecs = 0;
      mediaRecorder.onstop = async () => {
        if (isRecordingCancelledRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (base64Audio.length > 15 * 1024 * 1024) {
            addToast('Аудио слишком большое (лимит 15 МБ).', 'error');
            return;
          }
          sendAudioMessage(base64Audio, recSecs || 1);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          recSecs = prev + 1;
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      addToast('Нет доступа к микрофону. Открываем настройки...', 'error');
      openAppSettings();
    }
  };

  const handleRecordingPointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!isRecording || recordStartPointerXRef.current === null) return;
    const currentX = 'clientX' in e ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
    if (currentX === null) return;
    const deltaX = currentX - recordStartPointerXRef.current;
    if (deltaX < 0) {
      setRecordingDragX(deltaX);
      if (deltaX < -85) { // Telegram threshold to cancel recording
        cancelRecording();
      }
    }
  };

  const stopRecording = () => {
    if (isRecordingCancelledRef.current) return;
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch(e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingDragX(0);
      recordStartPointerXRef.current = null;
    }
  };

  const sendAudioMessage = (base64Audio: string, durationInSecs?: number) => {
    if (isEncryptionEnabled) {
      addToast('Включена защита от случайной отправки. Нажмите снова на щит для разблокировки', 'info');
      return;
    }
    if (!user || !selectedChat) return;
    try {
      const speechText = transcribedSpeechRef.current.trim();
      const newMessage: any = {
        id: createMessageId(user.uid, Date.now()),
        senderId: user.uid,
        text: '🎤 Голосовое сообщение',
        type: 'audio',
        fileUrl: base64Audio,
        subtitles: speechText || undefined,
        duration: durationInSecs || recordingTime || 1,
        createdAt: new Date().toISOString(),
        isEncrypted: false,
        asChannel: selectedChat.type === 'channel' && !postAsMe,
      };

      if (replyTo && replyTo.id) newMessage.replyToId = replyTo.id;
      if (activeThread && activeThread.id) newMessage.threadId = activeThread.id;

      if (selectedChat.type !== 'user') newMessage.groupId = selectedChat.id;
      else newMessage.receiverId = selectedChat.id;

      socket?.emit('message:new', { chatId: selectedChat.id, message: cleanObject(newMessage) });
      setReplyTo(null);
    } catch (e) {
      console.error(e);
      addToast('Ошибка отправки аудио', 'error');
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!user || !selectedChat) return;

    // Check media permissions
    const activeGroup = selectedChat.type !== 'user' ? groups.find(g => g.id === selectedChat.id) : null;
    const userRole = activeGroup?.memberRoles?.[user?.uid || ''] || 'member';
    const groupPerms = activeGroup?.permissions?.[userRole === 'owner' ? 'admin' : userRole] || { canSendMedia: true };
    const canSendMedia = selectedChat.type === 'user' || groupPerms.canSendMedia || isGlobalAdmin;
    
    if (!canSendMedia) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          // Fake a change event for handleFileUpload
          const event = {
            target: {
              files: [file],
              value: ''
            }
          } as any;
          handleFileUpload(event);
          break; // Only handle first image for now
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedChat) return;

    if (selectedChat.type === 'user' && selectedChat.id !== user.uid && !((users.find(u => u.uid === selectedChat.id)) as any)?.isBot) {
      const chatMessages = messages.filter(m => 
        (m.senderId === user.uid && m.receiverId === selectedChat.id) ||
        (m.senderId === selectedChat.id && m.receiverId === user.uid)
      );
      const theirMessages = chatMessages.filter(m => m.senderId === selectedChat.id);
      if (theirMessages.length === 0) {
        addToast('Вы не можете отправлять медиа и файлы, пока пользователь не ответит.', 'error');
        return;
      }
    }

    if (selectedChat.type !== 'user') {
      const group = groups.find(g => g.id === selectedChat.id);
      if (group) {
        const role = group.memberRoles[user.uid] || 'member';
        const perms = group.permissions[role === 'member' ? 'member' : 'admin'];
        const isBannedFromComments = group.bannedFromComments?.includes(user.uid);

        if (activeThread) {
          if (isBannedFromComments) {
            addToast('Вам запрещено комментировать', 'error');
            return;
          }
          if (!perms.canComment && !isGlobalAdmin) {
            addToast('Комментирование отключено', 'error');
            return;
          }
          
          let type: 'image' | 'video' | 'file' = 'file';
          if (file.type.startsWith('image/')) type = 'image';
          else if (file.type.startsWith('video/')) type = 'video';

          if (type === 'image' && perms.canSendPhotosInComments === false && !isGlobalAdmin) {
            addToast('Отправка фото в комментариях запрещена', 'error');
            return;
          }
          if (type === 'video' && perms.canSendVideosInComments === false && !isGlobalAdmin) {
            addToast('Отправка видео в комментариях запрещена', 'error');
            return;
          }
          if (type === 'file' && perms.canSendFilesInComments === false && !isGlobalAdmin) {
            addToast('Отправка файлов в комментариях запрещена', 'error');
            return;
          }
        } else {
          if (!perms.canSendMedia && role === 'member' && !isGlobalAdmin) {
            addToast('Отправка медиа ограничена', 'error');
            return;
          }
        }
      }
    }

    let type: 'image' | 'video' | 'file' = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';

    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, type, previewUrl });
    setFileComment(editingMessage ? editingMessage.text : '');
    setImageRotation(0);
    e.target.value = ''; // reset input
    setShowAttachmentMenu(false);
  };

  const confirmFileUpload = async () => {
    if (!pendingFile || !user || !selectedChat) return;
    
    // Capture state for background upload
    const currentPendingFile = pendingFile;
    const currentComment = fileComment;
    const currentRotation = imageRotation;
    const currentChat = selectedChat;
    const currentUser = user;
    const currentReplyTo = replyTo;
    const currentProfile = profile;
    const currentEditingMessage = editingMessage;

    // Close modal immediately
    setPendingFile(null);
    setFileComment('');
    setImageRotation(0);
    setReplyTo(null);
    setEditingMessage(null);
    
    setIsSending(true);

    try {
      let finalFile = currentPendingFile.file;

      // If it's an image, apply rotation and compress
      if (currentPendingFile.type === 'image') {
        finalFile = await new Promise<File>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(currentPendingFile.file);

            // Calculate new dimensions with rotation
            const rad = (currentRotation * Math.PI) / 180;
            const sin = Math.abs(Math.sin(rad));
            const cos = Math.abs(Math.cos(rad));
            let newWidth = img.width * cos + img.height * sin;
            let newHeight = img.width * sin + img.height * cos;

            // Scale down if too large (max 1280px to keep size small)
            const MAX_DIMENSION = 1280;
            let scale = 1;
            if (newWidth > MAX_DIMENSION || newHeight > MAX_DIMENSION) {
              scale = Math.min(MAX_DIMENSION / newWidth, MAX_DIMENSION / newHeight);
              newWidth *= scale;
              newHeight *= scale;
            }

            canvas.width = newWidth;
            canvas.height = newHeight;

            ctx.translate(newWidth / 2, newHeight / 2);
            ctx.rotate(rad);
            ctx.scale(scale, scale);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            // Compress to JPEG to save space
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(new File([blob], currentPendingFile.file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
              } else {
                resolve(currentPendingFile.file);
              }
            }, 'image/jpeg', 0.7);
          };
          img.src = currentPendingFile.previewUrl;
        });
      }

      // Check size after compression (limit to 15MB)
      if (finalFile.size > 15 * 1024 * 1024) {
        throw new Error('Файл слишком большой. Максимальный размер 15 МБ.');
      }

      const { uploadFileToFirestore } = await import('./lib/fileStorage');
      setUploadProgress(1); // Set to 1 to start showing the progress UI
      const url = await uploadFileToFirestore(finalFile, currentUser.uid, (p) => setUploadProgress(p));

      if (currentEditingMessage) {
        const updateData = cleanObject({
          text: currentComment,
          type: currentPendingFile.type,
          fileUrl: url,
          fileName: finalFile.name,
          updatedAt: new Date().toISOString(),
          isEdited: true
        });
        
        socket?.emit('message:update', { id: currentEditingMessage.id, chatId: currentChat.id, update: updateData });
      } else {
        const newMessage: any = {
          senderId: currentUser.uid,
          text: currentComment,
          type: currentPendingFile.type,
          fileUrl: url,
          fileName: finalFile.name,
          createdAt: new Date().toISOString(),
          asChannel: currentChat.type === 'channel' && !postAsMe
        };

        if (currentReplyTo && currentReplyTo.id) newMessage.replyToId = currentReplyTo.id;
        if (currentChat.type !== 'user') newMessage.groupId = currentChat.id;
        else newMessage.receiverId = currentChat.id;

        const cleanedMessage = cleanObject(newMessage);
      
      if (socket && !socket.connected) {
        socket.connect();
      }
        socket?.emit('message:new', { chatId: currentChat.id, message: cleanedMessage });
        
        if (currentChat.type === 'user' && currentProfile && !(currentProfile.activeChats || []).includes(currentChat.id)) {
          const newActive = [...(currentProfile.activeChats || []), currentChat.id];
          socket?.emit('profile:update', { uid: currentUser.uid, profile: { activeChats: newActive } });
        }
      }

    } catch (error) {
      addToast('Ошибка при отправке файла', 'error');
      handleDatabaseError(error, 'create:messages');
    } finally {
      setIsSending(false);
      setUploadProgress(0);
      URL.revokeObjectURL(currentPendingFile.previewUrl);
    }
  };

  const deleteMessage = async (id: string, forEveryone: boolean = false, delayMs: number = 0) => {
    if (!user) return;

    const performDelete = async () => {
      if (forEveryone) {
        if (socket) {
          socket.emit('message:delete', { id, chatId: selectedChat?.id });
        }
      } else {
        const currentHidden = profile?.hiddenMessages || [];
        if (!currentHidden.includes(id)) {
          const newHidden = [...currentHidden, id];
          setProfile(prev => prev ? { ...prev, hiddenMessages: newHidden } : null);
          if (socket) socket.emit('profile:update', { uid: user.uid, profile: { hiddenMessages: newHidden } });
        }
      }
    };

    if (delayMs > 0) {
      addToast(`Сообщение будет удалено через ${delayMs / 1000} сек.`, 'info');
      setTimeout(performDelete, delayMs);
    } else {
      await performDelete();
    }
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};

    // Check permissions for groups
    if (msg.groupId) {
      const group = groups.find(g => g.id === msg.groupId);
      if (group) {
        const role = group.memberRoles[user.uid] || 'member';
        const perms = group.permissions[role === 'member' ? 'member' : 'admin'];
        if (perms.canUseReactions === false && !isGlobalAdmin) {
          addToast('Реакции в этой группе отключены', 'error');
          return;
        }
      }
    }

    const newReactions = { ...currentReactions };
    const usersWhoReactedToThisEmoji = currentReactions[emoji] || [];
    const isAdding = !usersWhoReactedToThisEmoji.includes(user.uid);

    if (isAdding) {
      for (const key of Object.keys(newReactions)) {
        newReactions[key] = newReactions[key].filter(id => id !== user.uid);
        if (newReactions[key].length === 0) delete newReactions[key];
      }
      newReactions[emoji] = [...(newReactions[emoji] || []), user.uid];
    } else {
      newReactions[emoji] = usersWhoReactedToThisEmoji.filter(id => id !== user.uid);
      if (newReactions[emoji].length === 0) delete newReactions[emoji];
    }

    if (socket) {
      socket.emit('message:reaction', { id: msgId, chatId: selectedChat?.id, reactions: newReactions });
    }

    setMessages(prev => {
      const next = prev.map(m => m.id === msgId ? { ...m, reactions: newReactions } : m);
      messageCacheRef.current[selectedChat!.id] = next;
      return next;
    });

    try {
      // already emitted message:reaction above, no need to update again via message:update
    } catch (error) {
      handleDatabaseError(error, `update:messages/${msgId}`);
      addToast('Ошибка при добавлении реакции', 'error');
    }
  };

  const deleteChatForMe = async () => {
    if (!user || !selectedChat) return;
    
    if (selectedChat.type !== 'user') {
      const group = groups.find(g => g.id === selectedChat.id);
      if (group) {
        const members = (group.members || []).filter((uid: string) => uid !== user.uid);
        const memberRoles = { ...(group.memberRoles || {}) };
        delete memberRoles[user.uid];
        
        socket?.emit('group:update', {
          id: selectedChat.id,
          update: { members, memberRoles }
        });
      }
      setSelectedChat(null);
      setMobileView('list');
      setShowDeleteModal(false);
    } else {
      const hiddenChats = [...(profile?.hiddenChats || []), selectedChat.id];
      socket?.emit('profile:update', {
        uid: user.uid,
        profile: { hiddenChats }
      });
      setSelectedChat(null);
      setMobileView('list');
      setShowDeleteModal(false);
    }
  };

  const deleteChatForEveryoneById = async (chatId: string, type: string) => {
    if (!user) return;
    if (type !== 'user') {
      const group = groups.find(g => g.id === chatId);
      if (group?.ownerId === user.uid || isGlobalAdmin) {
        socket?.emit('group:delete', { id: chatId });
        if (selectedChat?.id === chatId) { setSelectedChat(null); setMobileView('list'); }
      } else {
        addToast('Только владелец может удалить группу для всех', 'error');
      }
    } else {
      socket?.emit('chat:delete_everyone', { user1: user.uid, user2: chatId });
      if (selectedChat?.id === chatId) { setSelectedChat(null); setMobileView('list'); }
    }
  };

  const deleteChatForMeById = async (chatId: string, type: string) => {
    if (!user) return;
    if (type !== 'user') {
        socket?.emit('group:leave', { id: chatId, uid: user.uid });
        if (selectedChat?.id === chatId) { setSelectedChat(null); setMobileView('list'); }
    } else {
      const hiddenChats = [...(profile?.hiddenChats || []), chatId];
      if (profile) setProfile({...profile, hiddenChats});
      socket?.emit('profile:update', {
        uid: user.uid,
        profile: { hiddenChats }
      });
      if (selectedChat?.id === chatId) { setSelectedChat(null); setMobileView('list'); }
    }
  };

  const handlePinChat = (chatId: string) => {
    if (!user) return;
    const pinnedChats = [...(profile?.pinnedChats || [])];
    const index = pinnedChats.indexOf(chatId);
    if (index > -1) {
       pinnedChats.splice(index, 1);
    } else {
       pinnedChats.push(chatId);
    }
    socket?.emit('profile:update', { uid: user.uid, profile: { pinnedChats } });
    if (profile) setProfile({...profile, pinnedChats});
  };

  const chatListTouchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{x: number, y: number} | null>(null);

  const startChatListTouchTimer = (e: React.TouchEvent, chat: {id: string, type: 'user'|'group'|'channel'}) => {
    const pageX = e.touches[0].pageX;
    const pageY = e.touches[0].pageY;
    touchStartPosRef.current = { x: pageX, y: pageY };
    
    if (chatListTouchTimerRef.current) clearTimeout(chatListTouchTimerRef.current);
    chatListTouchTimerRef.current = setTimeout(() => {
      handleChatContextMenu({ preventDefault: () => {}, pageX, pageY } as any, chat);
    }, 500);
  };
  
  const handleChatListTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const dx = Math.abs(e.touches[0].pageX - touchStartPosRef.current.x);
    const dy = Math.abs(e.touches[0].pageY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearChatListTouchTimer();
    }
  };

  const clearChatListTouchTimer = () => {
    if (chatListTouchTimerRef.current) {
      clearTimeout(chatListTouchTimerRef.current);
      chatListTouchTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  const handleChatContextMenu = (e: React.MouseEvent, chatOrGroup: { id: string, type: 'user' | 'group' | 'channel' }) => {
    e.preventDefault();
    setChatContextMenu({
      x: e.pageX,
      y: e.pageY,
      chat: chatOrGroup
    });
  };

  const deleteChatForEveryone = async () => {
    if (!user || !selectedChat) return;
    
    if (selectedChat.type !== 'user') {
      const group = groups.find(g => g.id === selectedChat.id);
      if (group?.ownerId === user.uid || isGlobalAdmin) {
        socket?.emit('group:delete', { id: selectedChat.id });
        setSelectedChat(null);
        setMobileView('list');
        setShowDeleteModal(false);
      } else {
        addToast('Только владелец может удалить группу для всех', 'error');
      }
    } else {
      socket?.emit('chat:delete_everyone', { 
        user1: user.uid, 
        user2: selectedChat.id 
      });
      setSelectedChat(null);
      setMobileView('list');
      setShowDeleteModal(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showDeleteModal) {
      setDeleteTimer(5);
      setIsDeleteForMeDisabled(true);
      interval = setInterval(() => {
        setDeleteTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsDeleteForMeDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setIsDeleteForMeDisabled(true);
    }
    return () => clearInterval(interval);
  }, [showDeleteModal]);

  const startDeleteTimer = () => {
    setShowDeleteModal(true);
  };

  if (user && !profile) {
    return (
      <div className="h-full w-full bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-white font-medium animate-pulse">Загрузка профиля...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full w-full bg-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center relative overflow-hidden"
        >
          {authMode !== 'email_login' && (
            <button 
              onClick={() => setAuthMode('email_login')}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Reply size={20} />
            </button>
          )}
          <button 
            onClick={() => {
              const currentUrl = getServerUrl(socketUrl);
              const newUrl = prompt('Введите адрес сервера:', currentUrl);
              if (newUrl !== null) {
                const trimmed = newUrl.trim();
                if (trimmed) {
                  localStorage.setItem('ordina_server_url', trimmed);
                  setSocketUrl(trimmed);
                  addToast('Адрес сервера успешно обновлен! Перезапуск...', 'success');
                  setTimeout(() => window.location.reload(), 1500);
                } else {
                  localStorage.removeItem('ordina_server_url');
                  setSocketUrl(undefined);
                  addToast('Сброшено на адрес по умолчанию! Перезапуск...', 'info');
                  setTimeout(() => window.location.reload(), 1500);
                }
              }
            }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors animate-fade-in"
            title="Настройка сервера"
          >
            <Settings size={20} />
          </button>
          <div className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-200 relative overflow-hidden">
            <Unlink className="text-white/40 w-12 h-12 absolute" />
            <Sword className="text-white w-10 h-10 relative z-10 rotate-45" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Ордина</h1>
          


          {(authMode === 'email_login' || authMode === 'email_register') && (
            <form onSubmit={authMode === 'email_login' ? handleEmailLogin : handleEmailRegister} className="text-left">
              <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">
                {authMode === 'email_login' ? 'Вход по Email' : 'Регистрация'}
              </h2>
              <p className="text-xs text-slate-500 text-center mb-6">
                {authMode === 'email_login' 
                  ? 'Введите данные для входа в существующий аккаунт. Если у вас еще нет аккаунта, нажмите кнопку "Создать аккаунт" ниже.' 
                  : 'Создайте новый аккаунт, указав вашу почту и надежный пароль. Пароль должен содержать минимум 6 символов.'}
              </p>
              
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ваш Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="yours@email.com"
                required
              />

              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Пароль</label>
              <input
                type="password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Минимум 6 символов"
                required
              />

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-blue-200 flex justify-center mb-4 transition-all"
              >
                {isLoggingIn ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                  authMode === 'email_login' ? 'Войти' : 'Создать аккаунт'
                )}
              </button>

              <div className="text-center">
                {authMode === 'email_login' ? (
                  <>
                    <p className="text-sm text-slate-500 mb-4">
                      Нет аккаунта? <button type="button" onClick={() => setAuthMode('email_register')} className="text-blue-600 font-bold hover:underline">Зарегистрироваться</button>
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 text-center">
                      Забыли свой пароль? Нажмите{' '}
                      <button 
                        type="button" 
                        onClick={() => setAuthMode('forgot_password')} 
                        className="text-blue-600 font-bold hover:underline"
                      >
                        Забыли пароль
                      </button>
                      , чтобы задать или сбросить пароль для входа по почте.
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Уже есть аккаунт? <button type="button" onClick={() => setAuthMode('email_login')} className="text-blue-600 font-bold hover:underline">Войти</button>
                  </p>
                )}
              </div>
            </form>
          )}

          {authMode === 'forgot_password' && (
            <form onSubmit={handleForgotPassword} className="text-left animate-fade-in">
              <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">Восстановление пароля</h2>
              <p className="text-xs text-slate-500 text-center mb-6">
                Введите вашу электронную почту ниже, чтобы получить ссылку для сброса или восстановления пароля.
              </p>
              
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ваш Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="yours@email.com"
                required
              />

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-blue-200 flex justify-center mb-4 transition-all"
              >
                {isLoggingIn ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Получить ссылку'}
              </button>

              <div className="text-center">
                <button type="button" onClick={() => setAuthMode('email_login')} className="text-sm text-blue-600 font-bold hover:underline">Вернуться к входу</button>
              </div>
            </form>
          )}

        </motion.div>
        <ToastsContainer toasts={toasts} />
      </div>
    );
  }

  const activeChatData = selectedChat 
    ? (selectedChat.type === 'user' 
        ? users.find(u => u.uid === selectedChat.id)
        : groups.find(g => g.id === selectedChat.id))
    : null;

  const isGroupAdmin = selectedChat?.type !== 'user' && activeChatData && (
    (activeChatData as Group).ownerId === user?.uid || 
    (activeChatData as Group).memberRoles?.[user?.uid || ''] === 'admin' ||
    (activeChatData as Group).memberRoles?.[user?.uid || ''] === 'owner' ||
    isGlobalAdmin
  );

  return (
    <div className="flex h-full w-full bg-slate-50 text-slate-900 overflow-hidden flex-col relative">
      {!isOnline && (
        <div className="bg-red-500 text-white py-1 px-4 text-[10px] font-bold text-center uppercase tracking-widest animate-pulse z-[1000]">
          ОТСУТСТВУЕТ ПОДКЛЮЧЕНИЕ К СЕТИ
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={cn(
              "w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col z-20",
              mobileView !== 'list' && "hidden lg:flex"
            )}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                setViewedProfile(profile);
                setShowProfile(true);
              }}>
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    profile?.displayName?.[0] || 'U'
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-sm">{profile?.displayName || 'Пользователь'}</h2>
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-[10px] font-medium",
                      isOnline ? "text-emerald-500" : "text-red-500"
                    )}>
                      {isOnline ? 'Онлайн' : 'Оффлайн'}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <button 
                      onClick={() => {
                        if (!socketConnected) {
                          addToast('Переподключение к серверу...', 'info');
                          if (socket) socket.connect();
                          const targetServerUrl = getServerUrl(socketUrl);
                          fetch(`${targetServerUrl}/api/health`).catch(() => {});
                        }
                      }}
                      className={cn(
                        "text-[10px] font-medium transition-all text-left",
                        socketConnected 
                          ? "text-emerald-500" 
                          : serverWakingUp 
                            ? "text-amber-500 animate-pulse font-semibold" 
                            : "text-amber-500 font-semibold hover:underline"
                      )}
                      title={socketConnected ? "Сервер работает корректно" : "Нажмите для повторной попытки подключения"}
                    >
                      {socketConnected 
                        ? 'Сервер: OK' 
                        : serverWakingUp 
                          ? 'Сервер: просыпается...' 
                          : 'Сервер: подключение...'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    setShowRadar(true);
                    setMobileView('radar');
                  }}
                  className={cn("p-2 rounded-xl transition-colors", showRadar ? "bg-blue-50 text-blue-600" : "hover:bg-slate-100 text-slate-600")}
                  title="Mesh Network (P2P Радар)"
                >
                  <RadarIcon size={20} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(true);
                  }}
                  className="p-2 rounded-xl transition-colors hover:bg-slate-100 active:scale-95 text-slate-600"
                  title="Настройки"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 relative z-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Поиск по имени, @юзернейму или ID..." 
                  className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Search Dropdown */}
              <AnimatePresence>
                {searchQuery.trim().length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-4 right-4 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-[60vh] overflow-y-auto z-[100] py-2"
                  >
                    {/* Global Search Result */}
                    {searchQuery.length > 10 && !users.find(u => u.uid === searchQuery) && (
                      <div className="px-4 py-3 text-center text-xs text-slate-400">
                        Пользователь не найден
                      </div>
                    )}

                    {/* Users Results */}
                    {users.filter(u => {
                      const query = searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery;
                      const q = String(query).toLowerCase().trim();
                      
                      const tr = (str: string) => {
                         const map: Record<string, string> = {
                            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
                            'q': 'q', 'w': 'w', 'x': 'x', 'c': 'c', 'j': 'j'
                         };
                         return str.split('').map(char => map[char] || char).join('');
                      };

                      const matchStart = (target: string, search: string) => {
                          if (!target) return false;
                          const tNum = tr(target.toLowerCase());
                          const sNum = tr(search);
                          return tNum.split(/\s+/).some(word => word.startsWith(sNum));
                      };

                      return u.uid !== user?.uid && (
                        matchStart((u.displayName || (u as any).name || ''), q) || 
                        matchStart((u.username || ''), q) || 
                        u.uid === query
                      );
                    }).map(u => (
                      <button 
                        key={u.uid}
                        onClick={() => {
                          selectChat({ type: 'user', id: u.uid });
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-all select-none"
                      >
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center overflow-hidden">
                            {u.photoURL ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="font-bold">{(u.displayName || (u as any).name || '?')[0]}</span>}
                          </div>
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full",
                            isUserOnline(u) ? "bg-emerald-500" : 
                            u.status === 'busy' ? "bg-red-500" : 
                            u.status === 'away' ? "bg-amber-500" : 
                            u.status === 'dnd' ? "bg-purple-500" : "bg-slate-400"
                          )} />
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-bold text-sm truncate">{u.displayName}</h3>
                          <p className="text-xs text-slate-500 truncate">
                            {u.customStatus || (isUserOnline(u) ? 'В сети' : formatLastSeen(u))}
                          </p>
                        </div>
                      </button>
                    ))}

                    {/* Groups Results */}
                    {groups.filter(g => {
                      const q = (searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery).toLowerCase();
                      return (g.name || '').toLowerCase().includes(q);
                    }).map(g => (
                      <button 
                        key={g.id}
                        onClick={() => {
                          selectChat({ type: (g.type || 'group') as any, id: g.id });
                          setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-all select-none"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          {g.type === 'group' ? <Users size={20} /> : <Hash size={20} />}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-bold text-sm truncate">{g.name}</h3>
                          <p className="text-xs text-slate-500 truncate">
                            {g.type === 'group' ? 'Группа' : 'Канал'}
                          </p>
                        </div>
                      </button>
                    ))}

                    {/* Empty State */}
                    {users.filter(u => {
                      const query = searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery;
                      const q = String(query).toLowerCase().trim();
                      
                      const tr = (str: string) => {
                         const map: Record<string, string> = {
                            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
                         };
                         return str.split('').map(char => map[char] || char).join('');
                      };

                      const matchStart = (target: string, search: string) => {
                          if (!target) return false;
                          const tNum = tr(target.toLowerCase());
                          const sNum = tr(search);
                          return tNum.split(/\s+/).some(word => word.startsWith(sNum));
                      };

                      return u.uid !== user?.uid && (
                        matchStart((u.displayName || (u as any).name || ''), q) || 
                        matchStart((u.username || ''), q) || 
                        u.uid === query
                      );
                    }).length === 0 && 
                     groups.filter(g => {
                       const q = (searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery).toLowerCase();
                       return (g.name || '').toLowerCase().includes(q);
                     }).length === 0 && 
                     searchQuery.length <= 10 && (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        Ничего не найдено
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Чаты</div>
              
              {user && (
                <motion.button 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => selectChat({ type: 'user', id: user.uid })}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl transition-all select-none",
                    selectedChat?.id === user.uid ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "hover:bg-slate-100"
                  )}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 overflow-hidden shrink-0">
                      <FileIcon size={24} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                            <div className="flex justify-between items-baseline mb-1">
                              <h3 className={cn("font-bold truncate", selectedChat?.id === user.uid ? "text-white" : "text-slate-900")}>Мой блокнот</h3>
                              <span className={cn("text-[10px] shrink-0 ml-2", selectedChat?.id === user.uid ? "text-blue-100" : "text-slate-400")}>
                                {lastMessages[user.uid] ? new Date(lastMessages[user.uid].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                              </span>
                            </div>
                            <p className={cn("text-xs truncate", selectedChat?.id === user.uid ? "text-blue-100" : "text-slate-500")}>
                              {lastMessages[user.uid] ? (lastMessages[user.uid].text || '[Вложение]') : 'Заметки и сохраненное'}
                            </p>
                  </div>
                </motion.button>
              )}

              {users.filter(u => u.uid !== user?.uid && 
                (profile?.activeChats || []).includes(u.uid) && 
                !(profile?.hiddenChats || []).includes(u.uid))
                .sort((a,b) => {
                   const aPinned = (profile?.pinnedChats || []).includes(a.uid);
                   const bPinned = (profile?.pinnedChats || []).includes(b.uid);
                   if (aPinned && !bPinned) return -1;
                   if (!aPinned && bPinned) return 1;
                   return 0;
                }).map(u => (
                <motion.button 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={u.uid}
                  onClick={() => selectChat({ type: 'user', id: u.uid })}
                  onContextMenu={(e) => handleChatContextMenu(e, {id: u.uid, type: 'user'})}
                  onTouchStart={(e) => startChatListTouchTimer(e, {id: u.uid, type: 'user'})}
                  onTouchEnd={clearChatListTouchTimer}
                  onTouchMove={handleChatListTouchMove}
                  onTouchCancel={clearChatListTouchTimer}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl transition-all select-none",
                    selectedChat?.id === u.uid ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "hover:bg-slate-100"
                  )}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-bold">{(u.displayName || (u as any).name || '?')[0]}</span>
                      )}
                    </div>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 border-4 border-white rounded-full",
                      isUserOnline(u) ? "bg-emerald-500" : 
                      u.status === 'busy' ? "bg-red-500" : 
                      u.status === 'away' ? "bg-amber-500" : 
                      u.status === 'dnd' ? "bg-purple-500" : "bg-slate-400"
                    )} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-bold text-sm truncate">{u.displayName}</h3>
                        {u.activeTitleId && u.grantedTitles && (
                          <RenderTitle 
                            title={u.grantedTitles.find(t => t.id === u.activeTitleId)!} 
                            className="scale-75 origin-left shrink-0"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {unreadCounts[u.uid] > 0 && (
                          <div className={cn("px-1.5 py-0.5 rounded-lg text-[8px] font-bold", selectedChat?.id === u.uid ? "bg-white text-blue-600" : "bg-blue-500 text-white")}>
                            {unreadCounts[u.uid]}
                          </div>
                        )}
                        <span className={cn("text-[10px]", selectedChat?.id === u.uid ? "text-blue-100" : "text-slate-400")}>
                          {lastMessages[u.uid] ? new Date(lastMessages[u.uid].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '12:45'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {lastMessages[u.uid]?.senderId === user?.uid && (
                        <div className="flex shrink-0">
                          {lastMessages[u.uid]?.readBy?.length ? (
                            <CheckCheck size={12} className={cn(selectedChat?.id === u.uid ? "text-blue-100" : "text-blue-500")} />
                          ) : (
                            <Check size={12} className={cn(selectedChat?.id === u.uid ? "text-blue-200" : "text-slate-400")} />
                          )}
                        </div>
                      )}
                      <p className={cn("text-xs truncate", selectedChat?.id === u.uid ? "text-blue-50" : "text-slate-500")}>
                        {lastMessages[u.uid] ? (
                          lastMessages[u.uid].type === 'sticker' ? '[Стикер]' :
                          lastMessages[u.uid].type === 'image' ? '[Фото]' :
                          lastMessages[u.uid].type === 'video' ? '[Видео]' :
                          lastMessages[u.uid].type === 'audio' ? '[Голос]' :
                          lastMessages[u.uid].type === 'poll' ? '[Опрос]' :
                          (lastMessages[u.uid].text?.slice(-5) || '...')
                        ) : (u.customStatus || (isUserOnline(u) ? 'В сети' : formatLastSeen(u)))}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}

              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4">Каналы и Группы</div>
              {Array.from(new Map(groups.map(g => [g.id, g])).values())
                .sort((a, b) => {
                  if (a.id === 'global_channel') return -1;
                  if (b.id === 'global_channel') return 1;
                  
                  const aPinned = (profile?.pinnedChats || []).includes(a.id);
                  const bPinned = (profile?.pinnedChats || []).includes(b.id);
                   if (aPinned && !bPinned) return -1;
                   if (!aPinned && bPinned) return 1;
                  
                  return 0;
                })
                .map(g => (
                <motion.button 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={`group_btn_${g.id}`}
                  onClick={() => selectChat({ type: g.type as any, id: g.id })}
                  onContextMenu={(e) => handleChatContextMenu(e, {id: g.id, type: (g.type as any) || 'group'})}
                  onTouchStart={(e) => startChatListTouchTimer(e, {id: g.id, type: (g.type as any) || 'group'})}
                  onTouchEnd={clearChatListTouchTimer}
                  onTouchMove={handleChatListTouchMove}
                  onTouchCancel={clearChatListTouchTimer}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-2xl transition-all select-none",
                    selectedChat?.id === g.id ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "hover:bg-slate-100"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden",
                    selectedChat?.id === g.id ? "bg-white/20 text-white" : 
                    g.isGlobal ? "bg-blue-100 text-blue-600 shadow-sm shadow-blue-100" : "bg-indigo-100 text-indigo-600"
                  )}>
                    {g.photoURL ? (
                      <img src={g.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : g.isGlobal ? <Globe size={24} /> : (g.type === 'group' ? <Users size={24} /> : <Hash size={24} />)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <h3 className="font-bold text-sm truncate">{g.name}</h3>
                        {g.isVerified && <Shield size={14} className="text-blue-500 fill-blue-50 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {unreadCounts[g.id] > 0 && (
                          <div className={cn("px-1.5 py-0.5 rounded-lg text-[8px] font-bold", selectedChat?.id === g.id ? "bg-white text-blue-600" : "bg-blue-500 text-white")}>
                            {unreadCounts[g.id]}
                          </div>
                        )}
                        <span className={cn("text-[10px]", selectedChat?.id === g.id ? "text-blue-100" : "text-slate-400")}>
                          {lastMessages[g.id] ? new Date(lastMessages[g.id].createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {lastMessages[g.id]?.senderId === user?.uid && (
                        <div className="flex shrink-0">
                          {lastMessages[g.id]?.readBy?.length && lastMessages[g.id].readBy.length > 1 ? (
                            <CheckCheck size={12} className={cn(selectedChat?.id === g.id ? "text-blue-100" : "text-blue-400")} />
                          ) : (
                            <Check size={12} className={cn(selectedChat?.id === g.id ? "text-blue-200" : "text-slate-400")} />
                          )}
                        </div>
                      )}
                      <p className={cn("text-xs truncate", selectedChat?.id === g.id ? "text-blue-50" : "text-slate-500")}>
                        {lastMessages[g.id] ? (
                          <>
                            <span className="font-medium opacity-80 mr-1">
                              {users.find(u => u.uid === lastMessages[g.id].senderId)?.displayName?.split(' ')[0] || 'Аноним'}:
                            </span>
                            {lastMessages[g.id].type === 'sticker' ? '[Стикер]' :
                             lastMessages[g.id].type === 'image' ? '[Фото]' :
                             lastMessages[g.id].type === 'video' ? '[Видео]' :
                             lastMessages[g.id].type === 'audio' ? '[Голос]' :
                             lastMessages[g.id].type === 'poll' ? '[Опрос]' :
                             (lastMessages[g.id].text || '...')}
                          </>
                        ) : (g.isGlobal ? 'Главный канал мессенджера' : (g.type === 'group' ? 'Группа' : 'Канал'))}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
            
            {!user?.isAnonymous && (
              <button 
                disabled={isCreatingGroup}
                onClick={() => {
                  setCreateChatName('');
                  setCreateChatType('group');
                  setShowCreateChatModal(true);
                }}
                className="absolute bottom-20 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg shadow-blue-200/50 flex flex-col items-center justify-center text-white hover:bg-blue-700 active:scale-95 transition-all z-[100]"
                title="Создать группу или канал"
              >
                <Users size={24} />
              </button>
            )}


          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateChatModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateChatModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Создать</h2>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setCreateChatType('group')}
                  className={cn("flex-1 py-2 font-bold rounded-xl transition-all text-sm", createChatType === 'group' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}
                >
                  Группа
                </button>
                <button
                  onClick={() => setCreateChatType('channel')}
                  className={cn("flex-1 py-2 font-bold rounded-xl transition-all text-sm", createChatType === 'channel' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}
                >
                  Канал
                </button>
              </div>
              
              <div className="mb-4 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl leading-relaxed">
                {createChatType === 'group' 
                  ? 'В группе могут писать все участники. Она создана для общения, дискуссий и совместной работы. Участники видят друг друга.'
                  : 'В канале сообщения могут отправлять только администраторы. Это идеально подходит для новостей и анонсов. Участники могут ставить реакции и (если разрешено) комментировать посты.'
                }
              </div>

              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm"
                placeholder={createChatType === 'group' ? 'Название группы...' : 'Название канала...'}
                value={createChatName}
                onChange={e => setCreateChatName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!createChatName.trim()) return;
                    setShowCreateChatModal(false);
                    setIsCreatingGroup(true);
                    const isChannel = createChatType === 'channel';
                    const groupData = cleanObject({
                      name: createChatName.trim(),
                      type: isChannel ? 'channel' : 'group',
                      ownerId: user?.uid || '',
                      members: [user?.uid || ''],
                      memberRoles: { [user?.uid || '']: 'owner' },
                      createdAt: new Date().toISOString(),
                      isPublic: true,
                      bannedUsers: [],
                      permissions: {
                        member: {
                          canSendMessages: !isChannel,
                          canSendMedia: !isChannel,
                          canAddMembers: true,
                          canDeleteForEveryone: false,
                          canBanUsers: false,
                          canChangeProfile: false,
                          canComment: isChannel,
                          canSendMediaInComments: isChannel,
                          canSendPhotosInComments: isChannel,
                          canSendVideosInComments: isChannel,
                          canSendStickersInComments: isChannel,
                          canSendFilesInComments: isChannel,
                          canUseReactions: true,
                        },
                        admin: {
                          canSendMessages: true,
                          canSendMedia: true,
                          canAddMembers: true,
                          canDeleteForEveryone: true,
                          canBanUsers: true,
                          canChangeProfile: true,
                          canComment: isChannel,
                          canSendMediaInComments: isChannel,
                          canSendPhotosInComments: isChannel,
                          canSendVideosInComments: isChannel,
                          canSendStickersInComments: isChannel,
                          canSendFilesInComments: isChannel,
                          canUseReactions: true,
                        }
                      }
                    });
                    try {
                      socket?.emit('group:create', groupData);
                      if ((window as any).addToast) (window as any).addToast(isChannel ? 'Канал создан' : 'Группа создана', 'success');
                      setShowCreateChatModal(false);
                    } catch (error) {
                      if ((window as any).addToast) (window as any).addToast('Ошибка при создании', 'error');
                    } finally {
                      setIsCreatingGroup(false);
                    }
                  }}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold"
                >
                  Создать
                </button>
                <button
                  onClick={() => setShowCreateChatModal(false)}
                  className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3 font-bold"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
            onClick={() => { setShowProfile(false); setTimeout(() => setViewedProfile(null), 300); }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-40 bg-blue-600 flex items-center justify-center shrink-0">
                {(viewedProfile || profile)?.profileBackgroundURL ? (
                  <div className="absolute inset-0">
                    <img 
                      src={(viewedProfile || profile)?.profileBackgroundURL} 
                      className="w-full h-full object-cover" 
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                  </div>
                ) : (viewedProfile || profile)?.photoURL ? (
                  <div className="absolute inset-0">
                    <img 
                      src={(viewedProfile || profile)?.photoURL} 
                      className="w-full h-full object-cover blur-md scale-110 opacity-50" 
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                  </div>
                ) : null}
                <button 
                  onClick={() => {
                    setShowProfile(false);
                    setTimeout(() => setViewedProfile(null), 300);
                  }}
                  className="absolute top-3 left-3 p-3 pr-4 rounded-r-2xl rounded-l-md bg-black/40 hover:bg-black/60 text-white z-10 transition-all active:scale-95 flex items-center gap-1 backdrop-blur-md text-xs font-bold"
                  title="Назад"
                >
                  <ArrowLeft size={22} />
                  <span>Назад</span>
                </button>
                <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center text-white text-3xl font-bold relative z-10 overflow-hidden group/avatar">
                  {(viewedProfile || profile)?.photoURL ? (
                    <img 
                      src={(viewedProfile || profile)!.photoURL} 
                      className="w-full h-full object-cover cursor-pointer" 
                      onClick={(e) => {
                        const isSelf = !viewedProfile || viewedProfile.uid === user?.uid;
                        if (isSelf && isEditingProfile) {
                          avatarInputRef.current?.click();
                        } else if ((viewedProfile || profile)?.photoURL) {
                          setShowFullAvatar({ src: (viewedProfile || profile)!.photoURL! });
                        }
                      }}
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    (viewedProfile || profile)?.displayName?.[0]
                  )}
                  {(!viewedProfile || viewedProfile?.uid === user?.uid) && isEditingProfile && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click() }}
                      className="absolute bottom-0 right-0 p-1.5 bg-blue-500 rounded-full text-white shadow-lg pointer-events-auto"
                    >
                      <Camera size={16} />
                    </button>
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !user) return;
                      try {
                        const content = await fileToBase64(file);
                        setCropModalInfo({ src: content, type: 'user' });
                        if (e.target) e.target.value = '';
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    {isEditingProfile && viewedProfile?.uid === user?.uid ? (
                      <div className="space-y-3">
                        <input 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Имя"
                          className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                        />
                        <input 
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          placeholder="Никнейм"
                          className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                        />
                        <input 
                          value={editAvatar}
                          onChange={(e) => setEditAvatar(e.target.value)}
                          placeholder="URL Аватарки"
                          className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                        />
                        <input 
                          value={editBackgroundURL}
                          onChange={(e) => setEditBackgroundURL(e.target.value)}
                          placeholder="URL Фона профиля"
                          className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                        />
                        <textarea 
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="О себе"
                          className="w-full p-2 border border-slate-200 rounded-xl text-sm h-20"
                        />
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-slate-400 uppercase">Статус</p>
                          <div className="flex flex-wrap gap-2">
                            {(['online', 'away', 'busy', 'dnd'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => setUserStatus(s)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all",
                                  userStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                                )}
                              >
                                {s === 'online' ? 'В сети' : s === 'away' ? 'Нет на месте' : s === 'busy' ? 'Занят' : 'Не беспокоить'}
                              </button>
                            ))}
                          </div>
                          <input 
                            value={customStatus}
                            onChange={(e) => setCustomStatus(e.target.value)}
                            placeholder="Напишите статус..."
                            className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>

                        {profile?.grantedTitles && profile.grantedTitles.length > 0 && (
                          <div className="space-y-2 mt-4">
                             <p className="text-xs font-bold text-slate-400 uppercase">Активный титул</p>
                             <select 
                               className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                               value={profile.activeTitleId || ''}
                               onChange={async (e) => {
                                  const newId = e.target.value;
                                  if (profile) setProfile({...profile, activeTitleId: newId});
                                  if (viewedProfile) setViewedProfile({...viewedProfile, activeTitleId: newId});
                                  try {
                                    socket?.emit('profile:update', { uid: user!.uid, profile: { activeTitleId: newId } });
                                    addToast('Активный титул изменен', 'success');
                                  } catch (err) {
                                    addToast('Ошибка', 'error');
                                  }
                               }}
                             >
                                <option value="">Скрыть титул</option>
                                {profile.grantedTitles.map(t => (
                                  <option key={t.id} value={t.id}>{t.text}</option>
                                ))}
                             </select>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          {showGroupSettings && (
                             <button 
                               onClick={() => setShowProfile(false)}
                               className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                             >
                               <ArrowLeft size={16} /> Назад к группе
                             </button>
                          )}
                          <button 
                            onClick={async () => {
                              await handleUpdateProfile();
                              if ((window as any).addToast) {
                                (window as any).addToast('Профиль сохранен', 'success');
                              }
                            }}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-200"
                          >
                            Сохранить
                          </button>
                          <button 
                            onClick={() => setIsEditingProfile(false)}
                            className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl text-sm font-bold"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-slate-900">{(viewedProfile || profile)?.displayName}</h2>
                          {(() => {
                             const p = viewedProfile || profile;
                             if (!p || !p.activeTitleId || !p.grantedTitles) return null;
                             const activeT = p.grantedTitles.find(t => t.id === p.activeTitleId);
                             if (!activeT) return null;
                             return (
                               <RenderTitle title={activeT} />
                             );
                          })()}
                        </div>
                        <p className="text-slate-500 text-xs">@{(viewedProfile || profile)?.username}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">UID: {(viewedProfile || profile)?.uid}</p>
                        
                        {isGlobalAdmin && (
                          <button 
                            onClick={() => setShowTitleManager(true)}
                            className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                          >
                            Управление титулами (Admin)
                          </button>
                        )}
                        {(viewedProfile || profile)?.grantedTitles && ((viewedProfile || profile)?.grantedTitles?.length || 0) > 0 && (viewedProfile?.uid === user?.uid || !viewedProfile) && (
                          <div className="mt-2 flex flex-col items-start">
                             <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Активный титул</label>
                             <select 
                               className="bg-slate-100 border-none rounded-lg text-xs py-1 px-2 text-slate-700 outline-none"
                               value={(viewedProfile || profile)?.activeTitleId || ''}
                               onChange={async (e) => {
                                  const newId = e.target.value;
                                  if (profile) setProfile({...profile, activeTitleId: newId});
                                  if (viewedProfile) setViewedProfile({...viewedProfile, activeTitleId: newId});
                                  socket?.emit('profile:update', { uid: user!.uid, profile: { activeTitleId: newId } });
                               }}
                             >
                                <option value="">Скрыть титул</option>
                                {(viewedProfile || profile)?.grantedTitles?.map(t => (
                                  <option key={t.id} value={t.id}>{t.text}</option>
                                ))}
                             </select>
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            (viewedProfile || profile)?.status === 'online' ? "bg-emerald-500" : "bg-slate-300"
                          )} />
                          <span className="text-xs font-medium text-slate-600">
                            {(viewedProfile || profile)?.customStatus || ((viewedProfile || profile)?.status === 'online' ? 'В сети' : formatLastSeen(viewedProfile || profile))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {viewedProfile?.uid === user?.uid && !isEditingProfile && (
                    <button 
                      onClick={() => {
                        setEditName(profile?.displayName || '');
                        setEditUsername(profile?.username || '');
                        setEditAvatar(profile?.photoURL || '');
                        setEditBio(profile?.bio || '');
                        setEditBackgroundURL(profile?.profileBackgroundURL || '');
                        setUserStatus(profile?.status || 'online');
                        setCustomStatus(profile?.customStatus || '');
                        setIsEditingProfile(true);
                      }}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all"
                    >
                      <Edit2 size={20} />
                    </button>
                  )}
                </div>
                
                {!isEditingProfile && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                        <Smartphone className="text-indigo-500" size={32} />
                        <div>
                          <p className="text-xs font-bold text-indigo-700 uppercase">Устройство в Mesh-сети</p>
                          <p className="text-[10px] text-indigo-600">Ordinal Node v1.0.4 (P2P Активен)</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-900 text-emerald-500 rounded-2xl font-mono text-[10px] break-all border border-emerald-900/30">
                        <p className="text-emerald-700 mb-1 uppercase font-bold tracking-widest">Mesh Public Key (Identity)</p>
                        {viewedProfile?.meshKey}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                          <Shield size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-400 uppercase">О себе</p>
                          <p className="text-sm text-slate-700">{viewedProfile?.bio || 'Нет описания'}</p>
                        </div>
                      </div>
                    </div>

                      {/* Removed data safety block */}


                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {previewPdfUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex items-center justify-center p-4"
            onClick={() => setPreviewPdfUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-500 rounded-xl">
                    <FileIcon size={20} />
                  </div>
                  <h3 className="font-bold text-lg truncate max-w-[300px]">{previewPdfUrl.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={previewPdfUrl.url} 
                    download={previewPdfUrl.name}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
                    title="Скачать"
                  >
                    <Download size={20} />
                  </a>
                  <button 
                    onClick={() => setPreviewPdfUrl(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-100 relative">
                <iframe 
                  src={previewPdfUrl.url} 
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stickers Modal */}
      <StickersModal 
        isOpen={showStickersModal} 
        onClose={() => setShowStickersModal(false)} 
        user={user} 
        profile={profile} 
        onSendSticker={handleSendSticker} 
        socket={socket}
      />

      <BotConstructor
        isOpen={showBotsModal}
        onClose={() => setShowBotsModal(false)}
        user={user}
        socket={socket}
      />

      {/* View Sticker Pack Modal */}
      <AnimatePresence>
        {viewedStickerPack && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="font-bold text-lg">{viewedStickerPack.name}</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewedStickerPack(null)} 
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 font-medium text-sm flex items-center gap-1"
                  >
                    Назад
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-4 gap-2">
                  {viewedStickerPack.stickers.map((s: any) => (
                    <div 
                      key={s.id} 
                      className="aspect-square bg-slate-50 rounded-lg overflow-hidden cursor-pointer hover:bg-slate-100 transition-colors p-1"
                      onClick={() => { handleSendSticker(s.url); setViewedStickerPack(null); }}
                    >
                      <FirestoreMedia url={s.url} type="image" className="w-full h-full object-contain pointer-events-none" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-slate-100">
                {profile && profile.savedStickerPacks && profile.savedStickerPacks.includes(viewedStickerPack.id) ? (
                  <button 
                    onClick={async () => {
                      if (!user) return;
                      const newSaved = (profile.savedStickerPacks || []).filter(id => id !== viewedStickerPack.id);
                      socket?.emit('profile:update', { uid: user.uid, profile: { savedStickerPacks: newSaved } });
                      setProfile(prev => prev ? { ...prev, savedStickerPacks: newSaved } : null);
                    }}
                    className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 transition-colors"
                  >
                    Удалить
                  </button>
                ) : (
                  <button 
                    onClick={async () => {
                      if (!user) return;
                      const newSaved = [...(profile?.savedStickerPacks || []), viewedStickerPack.id];
                      socket?.emit('profile:update', { uid: user.uid, profile: { savedStickerPacks: newSaved } });
                      setProfile(prev => prev ? { ...prev, savedStickerPacks: newSaved } : null);
                    }}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                  >
                    Установить
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TitleManagerModal 
        isOpen={showTitleManager}
        onClose={() => setShowTitleManager(false)}
        globalChannel={groups.find(g => g.id === 'global_channel')!}
        users={users}
        onUpdateUser={(uid, updates) => {
          setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
          if (uid === user?.uid && profile) {
            setProfile({ ...profile, ...updates });
          }
        }}
        socket={socket}
      />

      {/* File Preview Modal */}
      <AnimatePresence>
        {pendingFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg">Отправка файла</h3>
                <button 
                  onClick={() => {
                    setPendingFile(null);
                    URL.revokeObjectURL(pendingFile.previewUrl);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>
              
              <div className="p-4 bg-slate-50 flex-1 flex items-center justify-center min-h-[300px] relative overflow-hidden">
                {pendingFile.type === 'image' ? (
                  <img 
                    src={pendingFile.previewUrl} 
                    alt="Preview" 
                    className="max-w-full max-h-[50vh] object-contain rounded-xl transition-transform duration-300"
                    style={{ transform: `rotate(${imageRotation}deg)` }}
                  />
                ) : pendingFile.type === 'video' ? (
                  <video src={pendingFile.previewUrl} controls className="max-w-full max-h-[50vh] rounded-xl" />
                ) : (
                  <div className="flex flex-col items-center text-slate-500">
                    <FileIcon size={64} className="mb-4 text-blue-500" />
                    <p className="font-bold">{pendingFile.file.name}</p>
                    <p className="text-sm">{(pendingFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
                
                {pendingFile.type === 'image' && (
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    <button 
                      onClick={() => setImageRotation(prev => (prev + 90) % 360)}
                      className="p-3 bg-white/90 backdrop-blur shadow-lg rounded-full hover:bg-white transition-colors text-slate-700"
                      title="Повернуть на 90°"
                    >
                      <RotateCw size={20} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 flex gap-3">
                <input 
                  type="text" 
                  placeholder="Добавить комментарий..." 
                  value={fileComment}
                  onChange={(e) => setFileComment(e.target.value)}
                  className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmFileUpload();
                  }}
                />
                <button 
                  onClick={confirmFileUpload}
                  disabled={isSending}
                  className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacyPolicy && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPrivacyPolicy(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900">Политика конфиденциальности</h3>
                <button onClick={() => setShowPrivacyPolicy(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto text-sm text-slate-600 space-y-4">
                <p><strong>1. Сбор данных и Идеология Ординализма</strong></p>
                <p>Ордина: Мессенджер Свободы собирает минимально необходимое количество данных для обеспечения вашей приватной связи: имя пользователя, адрес электронной почты и аватар.</p>
                
                <p><strong>2. Использование данных</strong></p>
                <p>Ваши данные используются исключительно для идентификации в приложении, обеспечения связи с другими пользователями. Мы не передаем ваши данные третьим лицам.</p>
                
                <p><strong>3. Хранение, Безопасность и Медиа</strong></p>
                <p>Все сообщения и медиафайлы хранятся на современных и безопасных серверах с использованием PostgreSQL для надежного хранения. Приложение поддерживает сквозное шифрование (XOR) для приватных сообщений. Мы также внедрили систему цитирования и пересылки сообщений для удобства общения.</p>
                
                <p><strong>4. Права и Ограничения</strong></p>
                <p>Пользователи могут управлять своими правами в группах и каналах. Мы ограничиваем возможность отправки медиа и ссылок от неизвестных собеседников до тех пор, пока вы им не ответите, чтобы защитить вас от спама.</p>

                <p><strong>5. Защита архитектуры</strong></p>
                <p>Мы полностью перешли на выделенную инфраструктуру и отказались от лимитированных сервисов и квот. Вся обработка происходит мгновенно в реальном времени благодаря Socket.IO.</p>

                <p><strong>6. Платформа пользовательских ботов</strong></p>
                <p>Пользователи могут создавать собственных ботов («Конструктор ботов»). Боты могут обрабатывать команды и сохранять локальные сессионные переменные о пользователях (например, текущий выбранный шаг) для обеспечения сложных диалогов. Эти данные хранятся на сервере и не передаются третьим лицам.</p>

                <p><strong>7. Изменения в политике</strong></p>
                <p>Мы оставляем за собой право вносить изменения в данную политику конфиденциальности. Актуальная версия всегда доступна в этом разделе.</p>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end shrink-0">
                <button
                  onClick={() => setShowPrivacyPolicy(false)}
                  className="py-2.5 px-6 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all"
                >
                  Понятно
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Devices Modal */}
      <AnimatePresence>
        {showDevicesModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDevicesModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900">Устройства</h3>
                <button onClick={() => setShowDevicesModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                <p className="text-xs text-slate-500 mb-2">
                  Список сеансов и устройств, с которых вы вошли в ваш аккаунт. Вы можете завершить любой сеанс, кроме текущего.
                </p>

                <div className="space-y-3">
                  {/* Current Device first */}
                  <div className="p-4 rounded-2xl border-2 border-blue-500/20 bg-blue-50/10 flex items-start gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      {deviceType === 'phone' ? <Smartphone size={20} /> : <Monitor size={20} />}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{deviceName}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Текущее</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">ID сеанса: {deviceId.substring(0, 12)}...</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">Расположение: Локально (текущее подключение)</p>
                      <p className="text-xs text-green-600 font-semibold mt-1">● В сети (активно)</p>
                    </div>
                  </div>

                  {/* Other devices */}
                  {(profile?.devices || [])
                    .filter((d: UserDevice) => d.id !== deviceId)
                    .map((d: UserDevice) => (
                      <div key={d.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-start gap-4 hover:bg-slate-50 transition-all">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                          {d.type === 'phone' ? <Smartphone size={20} /> : <Monitor size={20} />}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-slate-900">{d.name}</span>
                            <button
                              onClick={() => {
                                confirm(
                                  'Завершение сеанса',
                                  `Вы уверены, что хотите завершить сеанс на устройстве "${d.name}"?`,
                                  () => {
                                    socket?.emit('device:delete', { deviceId: d.id, uid: profile.uid });
                                    addToast('Сеанс успешно завершен', 'success');
                                  }
                                );
                              }}
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors"
                              title="Завершить сеанс"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">ID сеанса: {d.id.substring(0, 12)}...</p>
                          {d.location && (
                            <p className="text-xs text-slate-500 font-medium mt-1">Регион: {d.location}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            Активность: {format(new Date(d.lastActive), 'dd.MM.yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end shrink-0">
                <button
                  onClick={() => setShowDevicesModal(false)}
                  className="py-2.5 px-6 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-300 transition-all"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Weekly Device Check Modal */}
      <AnimatePresence>
        {showWeeklyDeviceCheck && weeklyCheckDevices[weeklyCheckIndex] && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 shrink-0 bg-amber-50/30 flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0">
                  <Shield size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-900">Еженедельная проверка сессий</h3>
                  <p className="text-xs text-slate-500">Защита вашего аккаунта Ордина</p>
                </div>
              </div>
              <div className="p-6 text-left space-y-4">
                <p className="text-sm text-slate-600 font-medium">
                  Вы по-прежнему используете следующее устройство для входа в мессенджер Ордина?
                </p>

                <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/10 flex items-start gap-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    {weeklyCheckDevices[weeklyCheckIndex].type === 'phone' ? <Smartphone size={20} /> : <Monitor size={20} />}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-sm text-slate-900">
                      {weeklyCheckDevices[weeklyCheckIndex].name}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">ID: {weeklyCheckDevices[weeklyCheckIndex].id.substring(0, 12)}...</p>
                    {weeklyCheckDevices[weeklyCheckIndex].location && (
                      <p className="text-xs text-slate-500 font-semibold mt-1">
                        Регион входа: {weeklyCheckDevices[weeklyCheckIndex].location}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Последняя активность: {format(new Date(weeklyCheckDevices[weeklyCheckIndex].lastActive), 'dd.MM.yyyy HH:mm')}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Если вы не узнаете это устройство или больше им не пользуетесь, завершите сеанс для предотвращения несанкционированного доступа.
                </p>
              </div>
              <div className="p-4 bg-slate-50 flex flex-col sm:flex-row gap-2 justify-end shrink-0 border-t border-slate-100">
                <button
                  onClick={() => {
                    const dev = weeklyCheckDevices[weeklyCheckIndex];
                    socket?.emit('device:delete', { deviceId: dev.id, uid: profile?.uid });
                    (window as any).addToast?.('Сеанс завершен', 'success');
                    
                    if (weeklyCheckIndex + 1 < weeklyCheckDevices.length) {
                      setWeeklyCheckIndex(idx => idx + 1);
                    } else {
                      setShowWeeklyDeviceCheck(false);
                    }
                  }}
                  className="py-2.5 px-4 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Нет, завершить сеанс
                </button>
                <button
                  onClick={() => {
                    if (weeklyCheckIndex + 1 < weeklyCheckDevices.length) {
                      setWeeklyCheckIndex(idx => idx + 1);
                    } else {
                      setShowWeeklyDeviceCheck(false);
                    }
                  }}
                  className="py-2.5 px-5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  Да, это моё устройство
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Poll Modal */}
      <AnimatePresence>
        {showPollModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPollModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900">Новый опрос</h3>
                <button onClick={() => setShowPollModal(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Вопрос</label>
                  <input 
                    type="text" 
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Задайте вопрос..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Варианты ответа</label>
                  <div className="space-y-2">
                    {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...pollOptions];
                            newOpts[idx] = e.target.value;
                            setPollOptions(newOpts);
                          }}
                          placeholder={`Вариант ${idx + 1}`}
                          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {pollOptions.length > 2 && (
                          <button 
                            onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                            className="p-3 text-red-500 hover:bg-red-50 rounded-xl"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 10 && (
                      <button 
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="w-full p-3 text-blue-600 font-bold text-sm hover:bg-blue-50 rounded-xl transition-colors"
                      >
                        + Добавить вариант
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pollIsAnonymous}
                      onChange={(e) => setPollIsAnonymous(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Анонимное голосование</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={pollIsMultiple}
                      onChange={(e) => setPollIsMultiple(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Выбор нескольких вариантов</span>
                  </label>
                </div>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end shrink-0">
                <button
                  onClick={handleCreatePoll}
                  className="py-2.5 px-6 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all"
                >
                  Создать
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold">Настройки</h2>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="p-3 pl-4 -mr-2 rounded-l-2xl rounded-r-md hover:bg-slate-100 active:bg-slate-200 text-slate-600 transition-all active:scale-95 flex items-center justify-center"
                  title="Закрыть"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto">
                <button 
                  onClick={() => {
                    setShowSettings(false);
                    setShowNotificationSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                    <Bell size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm">Уведомления и звуки</p>
                    <p className="text-xs text-slate-500">
                      Звуковые сигналы, вибрация, DND и push-окна
                    </p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setShowSettings(false);
                    setShowMeshInspectorModal(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <Radio size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm">Mesh-сеть & Инспектор P2P</p>
                    <p className="text-xs text-slate-500">
                      Диагностика узлов, пинг, топология и буфер
                    </p>
                  </div>
                </button>
                <div className="h-px w-full bg-slate-100 my-2" />
                


                <button 
                  onClick={() => {
                    if (user?.isAnonymous) {
                      (window as any).addToast?.('Гости не могут создавать или управлять ботами', 'error');
                      return;
                    }
                    setShowSettings(false);
                    setShowBotsModal(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
                    <Bot size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Мои Боты</p>
                    <p className="text-xs text-slate-500">Конструктор ботов без кода</p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setShowSettings(false);
                    setShowDevicesModal(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                    <Smartphone size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm">Устройства</p>
                    <p className="text-xs text-slate-500">
                      {profile?.devices?.length || 1} {((profile?.devices?.length || 1) === 1) ? 'активное устройство' : 'активных устройств'}
                    </p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setShowSettings(false);
                    setShowPrivacyPolicy(true);
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                    <Shield size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Политика конфиденциальности</p>
                    <p className="text-xs text-slate-500">Правила использования</p>
                  </div>
                </button>

                <a 
                  href="mailto:ordinalyzm25@gmail.com?subject=Обратная связь - Приложение Ордина&body=Опишите вашу проблему, вопрос или предложение:%0D%0A%0D%0A"
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <MessageSquare size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Обратная связь</p>
                    <p className="text-xs text-slate-500">Написать разработчику</p>
                  </div>
                </a>

                {(user?.email === 'ordinalyzm25@gmail.com' || profile?.displayName === 'MEGAKPYIIIuTeJIb' || profile?.username === 'MEGAKPYIIIuTeJIb' || isGlobalAdmin) && (
                  <button 
                    onClick={() => {
                      const pass = prompt('Введите пароль разработчика:');
                      if (pass === '02042026') {
                        setShowDebug(true);
                        setShowSettings(false);
                      } else {
                        addToast('Неверный пароль', 'error');
                      }
                    }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      <Settings size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">Панель отладки</p>
                      <p className="text-xs text-slate-500">Только для владельца (разработчика)</p>
                    </div>
                  </button>
                )}
                
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 p-4 hover:bg-red-50 rounded-2xl transition-all text-red-500"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <LogOut size={20} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">Выйти из аккаунта</p>
                    <p className="text-xs text-red-400">Сессия будет завершена</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Forward Modal */}
      <AnimatePresence>
        {(forwardingMessage || quotingMessage) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-lg">{quotingMessage ? 'Цитировать сообщение' : 'Переслать сообщение'}</h3>
                <button 
                  onClick={() => {
                    setForwardingMessage(null);
                    setQuotingMessage(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Выберите чаты</div>
                {users.filter(u => u.uid !== user?.uid && activeChatsRef.current.includes(u.uid)).map(u => (
                  <label key={u.uid} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={forwardSelectedChats.includes(u.uid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForwardSelectedChats(prev => [...prev, u.uid]);
                        } else {
                          setForwardSelectedChats(prev => prev.filter(id => id !== u.uid));
                        }
                      }}
                    />
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {u.photoURL ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" /> : <span className="font-bold text-sm">{(u.displayName || (u as any).name || '?')[0]}</span>}
                    </div>
                    <span className="font-medium text-sm truncate">{u.displayName}</span>
                  </label>
                ))}
                
                {groups.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Группы и Каналы</div>
                    {groups.map(g => (
                      <label key={g.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={forwardSelectedChats.includes(g.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForwardSelectedChats(prev => [...prev, g.id]);
                            } else {
                              setForwardSelectedChats(prev => prev.filter(id => id !== g.id));
                            }
                          }}
                        />
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          {g.type === 'group' ? <Users size={20} /> : <Hash size={20} />}
                        </div>
                        <span className="font-medium text-sm truncate">{g.name}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
                <input 
                  type="text" 
                  placeholder="Добавить комментарий..." 
                  value={forwardComment}
                  onChange={(e) => setForwardComment(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 mb-3"
                />
                <button 
                  onClick={async () => {
                    if (!user || forwardSelectedChats.length === 0) return;
                    
                    for (const chatId of forwardSelectedChats) {
                      const isGroup = groups.some(g => g.id === chatId);
                      const chatType = isGroup ? 'group' : 'user';
                      
                      if (quotingMessage) {
                        const quoteMsg: any = {
                          text: forwardComment.trim(),
                          senderId: user.uid,
                          createdAt: new Date().toISOString(),
                          type: 'text',
                          isEncrypted: false,
                          readBy: [user.uid],
                          quote: {
                            text: quotingMessage.text,
                            originalSenderId: quotingMessage.msg.senderId
                          }
                        };
                        if (chatType === 'group') {
                          quoteMsg.groupId = chatId;
                        } else {
                          quoteMsg.receiverId = chatId;
                        }
                        socket?.emit('message:new', { chatId: selectedChat?.id, message: quoteMsg });
                      } else if (forwardingMessage) {
                        // Send comment if exists
                        if (forwardComment.trim()) {
                          const fwdCmt: any = {
                            id: createMessageId(user.uid, Date.now() + Math.floor(Math.random() * 1000)),
                            text: forwardComment.trim(),
                            senderId: user.uid,
                            createdAt: new Date().toISOString(),
                            type: 'text',
                            isEncrypted: false,
                            readBy: [user.uid]
                          };
                          if (chatType === 'group') {
                            fwdCmt.groupId = chatId;
                          } else {
                            fwdCmt.receiverId = chatId;
                          }
                          socket?.emit('message:new', { chatId, message: cleanObject(fwdCmt) });
                        }
                        
                        // Send forwarded message
                        const forwardedMsg: any = {
                          ...forwardingMessage,
                          id: createMessageId(user.uid, Date.now() + 1000 + Math.floor(Math.random() * 1000)),
                          senderId: user.uid,
                          createdAt: new Date().toISOString(),
                          readBy: [user.uid],
                          forwardedFrom: forwardingMessage.senderId
                        };
                        delete forwardedMsg.chatId;
                        
                        if (chatType === 'group') {
                          forwardedMsg.groupId = chatId;
                          forwardedMsg.receiverId = null;
                        } else {
                          forwardedMsg.receiverId = chatId;
                          forwardedMsg.groupId = null;
                        }
                        
                        const cleanedFwd = cleanObject(forwardedMsg);
                        socket?.emit('message:new', { chatId, message: cleanedFwd });
                      }
                    }
                    
                    addToast(quotingMessage ? `Отправлено в ${forwardSelectedChats.length} чат(ов)` : `Переслано в ${forwardSelectedChats.length} чат(ов)`, 'success');
                    setForwardingMessage(null);
                    setQuotingMessage(null);
                    setForwardSelectedChats([]);
                    setForwardComment('');
                  }}
                  disabled={forwardSelectedChats.length === 0 || (quotingMessage && !forwardComment.trim())}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send size={18} /> {quotingMessage ? 'Отправить' : 'Переслать'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Удаление чата</h2>
              <p className="text-slate-500 text-center text-sm mb-8">
                {selectedChat?.type !== 'user' 
                  ? (groups.find(g => g.id === selectedChat.id)?.ownerId === user?.uid 
                      ? 'Вы действительно хотите покинуть эту группу/канал или удалить ее для всех?' 
                      : `Вы действительно хотите покинуть ${selectedChat.type === 'group' ? 'эту группу' : 'этот канал'}?`)
                  : 'Вы действительно хотите удалить чат для себя или для всех участников?'}
              </p>
              
              <div className="space-y-3">
                <button 
                  disabled={isDeleteForMeDisabled}
                  onClick={deleteChatForMe}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-sm transition-all",
                    isDeleteForMeDisabled 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  {selectedChat?.type !== 'user' && groups.find(g => g.id === selectedChat.id)?.ownerId !== user?.uid 
                    ? `Покинуть ${selectedChat.type === 'group' ? 'группу' : 'канал'} ${isDeleteForMeDisabled ? `(${deleteTimer}с)` : ''}`
                    : `Удалить ${isDeleteForMeDisabled ? `(${deleteTimer}с)` : ''}`}
                </button>
                {(selectedChat?.type === 'user' || groups.find(g => g.id === selectedChat.id)?.ownerId === user?.uid || isGlobalAdmin) && (
                  <button 
                    onClick={deleteChatForEveryone}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-red-100"
                  >
                    Удалить для всех
                  </button>
                )}
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="w-full py-4 text-slate-500 hover:bg-slate-50 rounded-2xl font-bold text-sm transition-all"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showGroupInfo && selectedChat?.type !== 'user' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
            onClick={() => setShowGroupInfo(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-44 sm:h-48 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                {(activeChatData as Group)?.photoURL ? (
                  <img 
                    src={(activeChatData as Group).photoURL} 
                    alt="" 
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                    onClick={() => setShowFullAvatar({ src: (activeChatData as Group).photoURL! })}
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-5xl font-bold">
                    {(activeChatData as Group)?.name?.[0]}
                  </div>
                )}
                <button 
                  onClick={() => setShowGroupInfo(false)}
                  className="absolute top-4 left-4 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white z-10 transition-colors shadow-md active:scale-95"
                  title="Закрыть"
                >
                  <ArrowLeft size={18} />
                </button>

                {((activeChatData as Group)?.memberRoles?.[user?.uid || ''] === 'owner' || (activeChatData as Group)?.memberRoles?.[user?.uid || ''] === 'admin') && (
                  <button 
                    onClick={() => {
                      setShowGroupInfo(false);
                      setShowGroupSettings(true);
                    }}
                    className="absolute top-4 right-4 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white z-10 transition-all shadow-md active:scale-95 flex items-center gap-1 px-3 text-xs font-bold"
                    title="Настройки канала"
                  >
                    <Settings size={16} />
                    <span>Настройки</span>
                  </button>
                )}
              </div>
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{(activeChatData as Group)?.name}</h2>
                  <p className="text-xs font-bold text-blue-600 uppercase">
                    {(activeChatData as Group)?.type === 'group' ? 'Группа' : 'Канал'} • {(activeChatData as Group)?.members?.length || 0} участников
                  </p>
                </div>

                {/* Telegram-style Quick Action Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => {
                      setShowGroupInfo(false);
                      setShowChatSearch(true);
                    }}
                    className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-700 transition-colors active:scale-95"
                  >
                    <Search size={18} className="mb-1 text-blue-600" />
                    <span className="text-[11px] font-bold">Поиск</span>
                  </button>

                  <button 
                    onClick={() => {
                      toggleMuteChat((activeChatData as Group).id);
                      addToast(mutedChats.includes((activeChatData as Group).id) ? 'Уведомления включены' : 'Уведомления отключены', 'info');
                    }}
                    className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-700 transition-colors active:scale-95"
                  >
                    {mutedChats.includes((activeChatData as Group).id) ? (
                      <>
                        <BellOff size={18} className="mb-1 text-amber-500" />
                        <span className="text-[11px] font-bold">Без звука</span>
                      </>
                    ) : (
                      <>
                        <Bell size={18} className="mb-1 text-emerald-600" />
                        <span className="text-[11px] font-bold">Со звуком</span>
                      </>
                    )}
                  </button>

                  {((activeChatData as Group)?.memberRoles?.[user?.uid || ''] === 'owner' || (activeChatData as Group)?.memberRoles?.[user?.uid || ''] === 'admin') ? (
                    <button 
                      onClick={() => {
                        setShowGroupInfo(false);
                        setShowGroupSettings(true);
                      }}
                      className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 rounded-2xl text-blue-700 transition-colors active:scale-95"
                    >
                      <Settings size={18} className="mb-1 text-blue-600" />
                      <span className="text-[11px] font-bold">Настройки</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + '?group=' + (activeChatData as Group).id);
                        addToast('Ссылка на канал скопирована', 'success');
                      }}
                      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-700 transition-colors active:scale-95"
                    >
                      <Share2 size={18} className="mb-1 text-indigo-600" />
                      <span className="text-[11px] font-bold">Ссылка</span>
                    </button>
                  )}
                </div>
                
                <div className="space-y-4">
                  {(activeChatData as Group)?.description && (
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Описание</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{(activeChatData as Group).description}</p>
                    </div>
                  )}
                  {(activeChatData as Group)?.id === 'global_channel' && (activeChatData as Group)?.ownerId === 'system' && (
                    <button
                      onClick={async () => {
                        try {
                          const newRoles = { ...((activeChatData as Group).memberRoles || {}), [user?.uid || '']: 'owner' };
                          socket?.emit('group:update', {
                            id: 'global_channel',
                            update: { ownerId: user?.uid, memberRoles: newRoles }
                          });
                          addToast('Вы стали владельцем глобального канала', 'success');
                        } catch (error) {
                          addToast('Ошибка', 'error');
                        }
                      }}
                      className="w-full p-3 bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-200 transition-colors"
                    >
                      Стать владельцем канала
                    </button>
                  )}
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                    <QRCodeSVG value={(activeChatData as Group)?.id || ''} size={70} />
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">QR-код группы</p>
                      <p className="text-xs text-slate-500">Для приглашения участников</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                    <Users className="text-emerald-500" size={32} />
                    <div>
                      <p className="text-xs font-bold text-emerald-700 uppercase">Точка доступа группы</p>
                      <p className="text-[10px] text-emerald-600">Mesh-рассылка включена для этого канала</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase">Участники ({(activeChatData as Group)?.members?.length})</p>
                      {((activeChatData as Group)?.memberRoles?.[user?.uid || ''] === 'owner' || (activeChatData as Group)?.memberRoles?.[user?.uid || ''] === 'admin') && (
                        <button 
                          onClick={() => setShowInviteModal(true)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                          + Добавить
                        </button>
                      )}
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {(activeChatData as Group)?.members?.map(uid => {
                        const m = users.find(u => u.uid === uid);
                        const role = (activeChatData as Group)?.memberRoles?.[uid] || 'member';
                        const myRole = (activeChatData as Group)?.memberRoles?.[user?.uid || ''] || 'member';
                        const canEditRole = (myRole === 'owner' && uid !== user?.uid) || (myRole === 'admin' && role === 'member');
                        
                        return (
                          <div key={uid} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors group">
                            <button 
                              onClick={() => {
                                if (m) {
                                  setViewedProfile(m);
                                  setShowProfile(true);
                                }
                              }}
                              className="flex items-center gap-3 flex-1 text-left active:scale-[0.98] transition-transform"
                            >
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold overflow-hidden">
                                {m?.photoURL ? <img src={m.photoURL} alt="" /> : (m?.displayName?.[0] || '?')}
                              </div>
                              <div className="flex flex-col">
                                <span className={cn("text-sm font-medium", m?.uid === user?.uid && "text-blue-600")}>
                                  {m?.displayName || 'Загрузка...'} {m?.uid === user?.uid && '(Вы)'}
                                </span>
                                {m?.username && <span className="text-[10px] text-slate-400 italic">@{m.username}</span>}
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              {myRole !== 'member' && role !== 'owner' && uid !== user?.uid && (
                                <>
                                  <button 
                                    onClick={() => handleBanUserFromComments((activeChatData as Group).id, uid)}
                                    className="p-1.5 hover:bg-orange-50 text-orange-500 rounded-lg transition-colors"
                                    title="Запретить комментировать"
                                  >
                                    <MessageSquareOff size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleBanUser((activeChatData as Group).id, uid)}
                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                    title="Заблокировать"
                                  >
                                    <UserMinus size={14} />
                                  </button>
                                </>
                              )}
                              {canEditRole ? (
                              <select 
                                value={role}
                                onChange={async (e) => {
                                  const newRole = e.target.value;
                                  const newRoles = { ...(activeChatData as Group).memberRoles, [uid]: newRole };
                                  socket?.emit('group:update', { id: (activeChatData as Group).id, update: { memberRoles: newRoles } });
                                  addToast('Роль обновлена', 'success');
                                }}
                                className={cn(
                                  "text-[10px] font-bold px-2 py-1 rounded-full border-none cursor-pointer outline-none",
                                  role === 'owner' ? "bg-amber-100 text-amber-600" : 
                                  role === 'admin' ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                                )}
                              >
                                {myRole === 'owner' && <option value="owner">Владелец</option>}
                                <option value="admin">Админ</option>
                                <option value="member">Участник</option>
                              </select>
                            ) : (
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded-full",
                                role === 'owner' ? "bg-amber-100 text-amber-600" : 
                                role === 'admin' ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                              )}>
                                {role === 'owner' ? 'Владелец' : role === 'admin' ? 'Админ' : 'Участник'}
                              </span>
                            )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupSettings && selectedChat?.type !== 'user' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowGroupSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                    <Settings size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">Настройки группы</h3>
                    <p className="text-xs text-slate-500">Управление разрешениями и приватностью</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowGroupSettings(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <section className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Info size={14} /> Основная информация
                  </h4>
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-2xl">
                    <div className="relative group shrink-0">
                      <div className="w-24 h-24 rounded-2xl bg-white shadow-sm flex items-center justify-center overflow-hidden border-2 border-slate-100 relative">
                        {(activeChatData as Group)?.photoURL ? (
                          <img src={(activeChatData as Group).photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-3xl font-bold text-slate-300">{(activeChatData as Group).name[0]}</span>
                        )}
                      </div>
                      {(activeChatData as Group)?.photoURL && (
                        <button
                          type="button"
                          onClick={() => {
                            if ((activeChatData as Group)?.photoURL) {
                              setCropModalInfo({ src: (activeChatData as Group).photoURL!, type: 'group', groupId: (activeChatData as Group).id });
                            }
                          }}
                          className="absolute -bottom-1 -right-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform active:scale-95 z-20 flex items-center justify-center"
                          title="Кадрировать аватар"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-opacity rounded-2xl z-10">
                        <ImageIcon size={20} className="mb-1" />
                        Изменить
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const base64 = await fileToBase64(file);
                              setCropModalInfo({ src: base64, type: 'group', groupId: (activeChatData as Group).id });
                            }
                          }} 
                        />
                      </label>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">Название {(activeChatData as Group).type === 'group' ? 'группы' : 'канала'}</label>
                        <input 
                          key={`name-${(activeChatData as Group).id}-${(activeChatData as Group).name}`}
                          type="text" 
                          defaultValue={(activeChatData as Group).name}
                          onBlur={(e) => handleUpdateGroupSettings((activeChatData as Group).id, { name: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Описание</label>
                    <textarea 
                      key={`desc-${(activeChatData as Group).id}-${(activeChatData as Group).description}`}
                      defaultValue={(activeChatData as Group).description}
                      onBlur={(e) => handleUpdateGroupSettings((activeChatData as Group).id, { description: e.target.value })}
                      placeholder="О чем эта группа?"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                    />
                  </div>
                </section>

                {/* Privacy */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Lock size={14} /> Приватность
                  </h4>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        (activeChatData as Group).isPublic ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                      )}>
                        {(activeChatData as Group).isPublic ? <Globe size={20} /> : <EyeOff size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{(activeChatData as Group).isPublic ? 'Публичная группа' : 'Приватная группа'}</p>
                        <p className="text-[10px] text-slate-500">
                          {(activeChatData as Group).isPublic 
                            ? 'Любой пользователь может найти и вступить' 
                            : 'Вступление только по приглашению'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleUpdateGroupSettings((activeChatData as Group).id, { isPublic: !(activeChatData as Group).isPublic })}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Изменить
                    </button>
                  </div>
                </section>

                {/* Permissions */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <ShieldAlert size={14} /> Разрешения участников
                  </h4>
                  <div className="space-y-3">
                    {[
                      { key: 'canSendMessages', label: 'Отправка сообщений', icon: <Send size={16} /> },
                      { key: 'canSendMedia', label: 'Отправка медиа и файлов', icon: <Paperclip size={16} /> },
                      { key: 'canAddMembers', label: 'Добавление участников', icon: <UserPlus size={16} /> },
                      { key: 'canDeleteForEveryone', label: 'Удаление для всех', icon: <Trash2 size={16} /> },
                      { key: 'canBanUsers', label: 'Блокировка пользователей', icon: <UserMinus size={16} /> },
                      { key: 'canChangeProfile', label: 'Изменение профиля группы', icon: <Edit2 size={16} /> },
                      { key: 'canComment', label: 'Комментирование постов', icon: <MessageSquare size={16} /> },
                      { key: 'canSendPhotosInComments', label: 'Фото в комментариях', icon: <ImageIcon size={16} /> },
                      { key: 'canSendVideosInComments', label: 'Видео в комментариях', icon: <VideoIcon size={16} /> },
                      { key: 'canSendStickersInComments', label: 'Стикеры в комментариях', icon: <Smile size={16} /> },
                      { key: 'canSendFilesInComments', label: 'Файлы в комментариях', icon: <FileIcon size={16} /> },
                      { key: 'canUseReactions', label: 'Реакции на посты', icon: <Smile size={16} /> },
                    ].map((perm) => {
                          const defaultPerms: GroupPermissions = {
                            canSendMessages: true,
                            canSendMedia: true,
                            canAddMembers: true,
                            canDeleteForEveryone: false,
                            canBanUsers: false,
                            canChangeProfile: false,
                            canComment: true,
                            canSendMediaInComments: true,
                            canSendPhotosInComments: true,
                            canSendVideosInComments: true,
                            canSendStickersInComments: true,
                            canSendFilesInComments: true,
                            canUseReactions: true,
                          };
                          const permValue = (activeChatData as Group)?.permissions?.member?.[perm.key as keyof GroupPermissions] ?? defaultPerms[perm.key as keyof GroupPermissions];
                          
                          return (
                      <div key={perm.key} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="text-slate-400 group-hover:text-blue-500 transition-colors">
                            {perm.icon}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{perm.label}</span>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const currentPerms = (activeChatData as Group)?.permissions?.member || defaultPerms;
                            handleUpdateGroupSettings((activeChatData as Group).id, {
                              permissions: {
                                ...((activeChatData as Group)?.permissions || {}),
                                member: {
                                  ...currentPerms,
                                  [perm.key]: !permValue
                                },
                                admin: ((activeChatData as Group)?.permissions?.admin || {
                                  canSendMessages: true,
                                  canSendMedia: true,
                                  canAddMembers: true,
                                  canDeleteForEveryone: true,
                                  canBanUsers: true,
                                  canChangeProfile: true,
                                  canComment: true,
                                  canSendMediaInComments: true,
                                  canSendPhotosInComments: true,
                                  canSendVideosInComments: true,
                                  canSendStickersInComments: true,
                                  canSendFilesInComments: true,
                                  canUseReactions: true,
                                })
                              }
                            });
                          }}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            permValue
                              ? "bg-blue-600" 
                              : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            permValue
                              ? "left-7" 
                              : "left-1"
                          )} />
                        </button>
                      </div>
                    )})}
                  </div>
                </section>

                {/* Banned Users */}
                {((activeChatData as Group).bannedUsers?.length || 0) > 0 && (
                  <section className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <UserMinus size={14} /> Заблокированные пользователи
                    </h4>
                    <div className="space-y-2">
                      {(activeChatData as Group).bannedUsers.map(uid => {
                        const bannedUser = users.find(u => u.uid === uid);
                        return (
                          <div key={uid} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">
                                {bannedUser?.displayName?.[0] || '?'}
                              </div>
                              <span className="text-sm font-medium text-red-900">{bannedUser?.displayName || 'Неизвестный'}</span>
                            </div>
                            <button 
                              onClick={() => {
                                const newBanned = (activeChatData as Group).bannedUsers.filter(u => u !== uid);
                                handleUpdateGroupSettings((activeChatData as Group).id, { bannedUsers: newBanned });
                              }}
                              className="text-[10px] font-bold text-red-600 hover:underline"
                            >
                              Разблокировать
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Banned from Comments */}
                {((activeChatData as Group).bannedFromComments?.length || 0) > 0 && (
                  <section className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquareOff size={14} /> Запрещено комментировать
                    </h4>
                    <div className="space-y-2">
                      {(activeChatData as Group).bannedFromComments!.map(uid => {
                        const bannedUser = users.find(u => u.uid === uid);
                        return (
                          <div key={uid} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">
                                {bannedUser?.displayName?.[0] || '?'}
                              </div>
                              <span className="text-sm font-medium text-orange-900">{bannedUser?.displayName || 'Неизвестный'}</span>
                            </div>
                            <button 
                              onClick={() => {
                                const newBanned = (activeChatData as Group).bannedFromComments!.filter(u => u !== uid);
                                handleUpdateGroupSettings((activeChatData as Group).id, { bannedFromComments: newBanned });
                              }}
                              className="text-[10px] font-bold text-orange-600 hover:underline"
                            >
                              Разрешить
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInviteModal && selectedChat?.type !== 'user' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg">Пригласить участников</h3>
                <button 
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteSearchQuery('');
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Поиск пользователей..." 
                    value={inviteSearchQuery}
                    onChange={(e) => setInviteSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 border-none rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {users
                  .filter(u => u.uid !== user?.uid && !(activeChatData as Group)?.members?.includes(u.uid))
                  .filter(u => (u.displayName || (u as any).name || '').toLowerCase().startsWith(inviteSearchQuery.toLowerCase()))
                  .map(u => (
                    <div key={u.uid} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                          {(u.displayName || (u as any).name || '?')[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{u.displayName}</p>
                          <p className="text-xs text-slate-500">{isUserOnline(u) ? 'В сети' : formatLastSeen(u)}</p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const newMembers = [...((activeChatData as Group).members || []), u.uid];
                            const newRoles = { ...((activeChatData as Group).memberRoles || {}), [u.uid]: 'member' };
                            socket?.emit('group:update', { id: (activeChatData as Group).id, update: { members: newMembers, memberRoles: newRoles } });
                            addToast(`${u.displayName} добавлен в группу`, 'success');
                          } catch (error) {
                            addToast('Ошибка при добавлении', 'error');
                          }
                        }}
                        className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-sm font-bold transition-colors"
                      >
                        Добавить
                      </button>
                    </div>
                  ))}
                {users.filter(u => u.uid !== user?.uid && !(activeChatData as Group)?.members?.includes(u.uid)).length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Нет доступных пользователей для приглашения</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "flex-1 flex flex-col relative bg-white z-10",
        mobileView !== 'chat' && "hidden lg:flex"
      )}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white sticky top-0 z-[100]">
              {showChatSearch ? (
                <div className="flex items-center w-full gap-3 h-full">
                  <button onClick={() => { setShowChatSearch(false); setChatSearchQuery(''); setChatSearchFilterUser(null); }} className="p-2 hover:bg-slate-100 rounded-xl relative z-[120]">
                    <ArrowLeft size={20} className="text-slate-500" />
                  </button>
                  <div className="flex-1 flex items-center bg-slate-100 rounded-xl px-3 py-2">
                    <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Поиск сообщений..." 
                      className="w-full bg-transparent border-none text-sm focus:ring-0 p-0"
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                    />
                  </div>
                  {selectedChat.type !== 'user' && (
                    <select 
                      className="bg-slate-100 border-none rounded-xl text-sm py-2 pl-3 pr-8 focus:ring-0 max-w-[120px] sm:max-w-[150px] truncate"
                      value={chatSearchFilterUser || ''}
                      onChange={(e) => setChatSearchFilterUser(e.target.value || null)}
                    >
                      <option value="">Все авторы</option>
                      {users.filter(u => (activeChatData as Group)?.members?.includes(u.uid)).map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName}</option>
                      ))}
                    </select>
                  )}
                </div>
              ) : selectedMsgIds.length > 0 ? (
                <div className="flex-1 flex items-center justify-between px-2 py-1 bg-slate-900 text-white z-30 rounded-xl shadow-md">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setSelectedMsgIds([]); setIsSelectionMode(false); }}
                      className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                      title="Отмена"
                    >
                      <X size={20} />
                    </button>
                    <span className="font-bold text-sm">Выбрано: {selectedMsgIds.length}</span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const selectedMsgs = messages.filter(m => selectedMsgIds.includes(m.id));
                        const combinedText = selectedMsgs.map(m => m.text).filter(Boolean).join('\n---\n');
                        if (combinedText) {
                          copyToClipboard(combinedText);
                          addToast(`Текст (${selectedMsgs.length} сообщ.) скопирован`, 'success');
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Copy size={14} /> <span className="hidden sm:inline">Копировать</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const firstMsg = messages.find(m => selectedMsgIds.includes(m.id));
                        if (firstMsg) {
                          setForwardingMessage(firstMsg);
                          setForwardSelectedChats([]);
                          setForwardComment('');
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Share size={14} /> <span className="hidden sm:inline">Переслать</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowMultiDeleteModal(true)}
                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 size={14} /> <span className="hidden sm:inline">Удалить</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex items-center gap-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeThread) {
                      setActiveThread(null);
                      setEditingMessage(null);
                      setReplyTo(null);
                      setInputText('');
                    } else {
                      setMobileView('list');
                    }
                  }} 
                  className="p-3 pl-4 -ml-2 rounded-r-2xl rounded-l-md hover:bg-slate-100 active:bg-slate-200 relative z-[120] pointer-events-auto transition-all active:scale-95 text-slate-700 flex items-center justify-center"
                  title="Назад"
                >
                  <ArrowLeft size={22} />
                </button>
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                  if (activeThread) return;
                  if (selectedChat.type !== 'user') {
                    setShowGroupInfo(true);
                  } else {
                    setViewedProfile(activeChatData as UserProfile);
                    setShowProfile(true);
                  }
                }}>
                  {activeThread ? (
                    <div>
                      <h2 className="font-bold text-sm">Комментарии</h2>
                      <p className="text-[10px] font-medium text-slate-400">
                        К сообщению {selectedChat.id === user?.uid ? 'Блокнот' : (users.find(u => u.uid === activeThread.senderId)?.displayName || 'Пользователь')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 overflow-hidden bg-slate-100">
                        {selectedChat.type === 'user' ? (
                          selectedChat.id === user?.uid ? (
                            <FileIcon size={20} className="text-blue-600" />
                          ) : (activeChatData as UserProfile)?.photoURL ? (
                            <img src={(activeChatData as UserProfile).photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (activeChatData as UserProfile)?.displayName?.[0]
                        ) : (activeChatData as Group)?.photoURL ? (
                          <img src={(activeChatData as Group).photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (activeChatData as Group)?.name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="font-bold text-sm truncate">
                            {selectedChat.type === 'user' ? (selectedChat.id === user?.uid ? 'Мой блокнот' : (activeChatData as UserProfile)?.displayName || 'Пользователь') : (activeChatData as Group)?.name || (selectedChat.id === 'global_channel' ? 'Ордина Глобал 🌐' : 'Загрузка...')}
                          </h2>
                          {selectedChat.type !== 'user' && (activeChatData as Group)?.isVerified && (
                             <Shield size={14} className="text-blue-500 fill-blue-50 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "text-[10px] font-medium",
                            typingUsersText ? 'text-blue-500 animate-pulse' :
                            selectedChat.type === 'user' 
                              ? ((activeChatData as UserProfile)?.status === 'online' ? 'text-emerald-500' : 
                                 (activeChatData as UserProfile)?.status === 'busy' ? 'text-red-500' : 
                                 (activeChatData as UserProfile)?.status === 'away' ? 'text-amber-500' : 'text-slate-400')
                              : 'text-slate-400'
                          )}>
                            {typingUsersText ? typingUsersText :
                             selectedChat.type === 'user' 
                              ? ((activeChatData as UserProfile)?.isBot ? `Пользователей: ${(activeChatData as UserProfile).usersList?.length || 0}` :
                                 (activeChatData as UserProfile)?.status === 'online' ? 'В сети' : 
                                 (activeChatData as UserProfile)?.status === 'busy' ? 'Занят' : 
                                 (activeChatData as UserProfile)?.status === 'away' ? 'Нет на месте' : 
                                 (activeChatData as UserProfile)?.status === 'dnd' ? 'Не беспокоить' : formatLastSeen(activeChatData as UserProfile))
                              : (selectedChat.id === 'global_channel' ? 'Глобальный канал Ордины' : 
                                 ((activeChatData as Group)?.members?.length ? `${(activeChatData as Group).members.length} участников` : 'Группа'))}
                          </p>
                          {selectedChat.type === 'user' && (activeChatData as UserProfile)?.customStatus && !typingUsersText && (
                            <span className="text-[10px] text-slate-400 italic truncate max-w-[150px]">
                              — {(activeChatData as UserProfile)?.customStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 relative">
                {selectedChat.type !== 'user' && isGroupAdmin && (
                  <button 
                    onClick={() => setShowGroupSettings(true)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                    title="Настройки канала"
                  >
                    <Settings size={20} />
                  </button>
                )}
                 {selectedChat.type === 'user' && selectedChat.id !== user?.uid && (
                  <button 
                    onClick={() => {
                      if ((window as any).addToast) {
                        (window as any).addToast('Звонки скоро появятся! Мы работаем над качеством.', 'info');
                      }
                    }}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
                  >
                    <Phone size={20} />
                  </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChatSearch(true);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <Search size={20} className="text-slate-400" />
                </button>
                <div className="relative">
                  <button 
                    ref={menuButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChatMenu(!showChatMenu);
                    }}
                    className="p-3 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer active:scale-95"
                    title="Меню чата"
                  >
                    <MoreVertical size={22} className="text-slate-400" />
                  </button>
                  
                  <AnimatePresence>
                    {showChatMenu && (
                        <motion.div 
                          ref={menuRef}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[200] ring-1 ring-black/5"
                        >
                        <div className="p-2 space-y-1">
                          {selectedChat.type !== 'user' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowChatMenu(false);
                                setShowInviteModal(true);
                              }}
                              className="w-full flex items-center gap-3 p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm"
                            >
                              <UserPlus size={18} /> Пригласить участника
                            </button>
                          )}
                          {selectedChat.type === 'user' && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                setShowChatMenu(false);
                                if (!user || !profile) return;
                                
                                const isBlocked = profile.blockedUsers?.includes(selectedChat.id);
                                const newBlocked = isBlocked 
                                  ? (profile.blockedUsers || []).filter(id => id !== selectedChat.id)
                                  : [...(profile.blockedUsers || []), selectedChat.id];
                                
                                try {
                                  socket?.emit('profile:update', { uid: user.uid, profile: { blockedUsers: newBlocked } });
                                  addToast(isBlocked ? 'Пользователь разблокирован' : 'Пользователь заблокирован', 'success');
                                } catch (error) {
                                  addToast('Ошибка при изменении статуса блокировки', 'error');
                                }
                              }}
                              className="w-full flex items-center gap-3 p-3 text-slate-700 hover:bg-slate-50 rounded-xl transition-all font-semibold text-sm"
                            >
                              {profile?.blockedUsers?.includes(selectedChat.id) ? (
                                <><Shield size={18} className="text-emerald-500" /> Разблокировать</>
                              ) : (
                                <><Shield size={18} className="text-red-500" /> Заблокировать</>
                              )}
                            </button>
                          )}
                          {selectedChat.id !== 'global_channel' && selectedChat.id !== user?.uid && (
                            <>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                setShowChatMenu(false);
                                if (!user || !profile) return;
                                
                                const currentMuted = profile.mutedChats?.[selectedChat.id];
                                const isMuted = currentMuted && (currentMuted === -1 || currentMuted > Date.now());
                                
                                const newMuted = { ...(profile.mutedChats || {}) };
                                if (isMuted) {
                                  delete newMuted[selectedChat.id];
                                } else {
                                  newMuted[selectedChat.id] = -1; // -1 for forever. Can add options later if needed.
                                }
                                
                                try {
                                  socket?.emit('profile:update', { uid: user.uid, profile: { mutedChats: newMuted } });
                                  (window as any).addToast?.(isMuted ? 'Звук включен' : 'Уведомления отключены навсегда', 'success');
                                } catch (error) {}
                              }}
                              className="w-full flex items-center gap-3 p-3 text-slate-700 hover:bg-slate-50 rounded-xl transition-all font-semibold text-sm"
                            >
                              {profile?.mutedChats?.[selectedChat.id] && (profile.mutedChats[selectedChat.id] === -1 || profile.mutedChats[selectedChat.id] > Date.now()) ? (
                                <><MessageSquare size={18} className="text-blue-500" /> Включить звук</>
                              ) : (
                                <><MessageSquareOff size={18} className="text-slate-400" /> Отключить уведомления</>
                              )}
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowChatMenu(false);
                                startDeleteTimer();
                              }}
                              className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-semibold text-sm"
                            >
                              <Trash2 size={18} /> {selectedChat.type !== 'user' && groups.find(g => g.id === selectedChat.id)?.ownerId !== user?.uid ? 'Покинуть чат' : 'Удалить чат'}
                            </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              </>
              )}
            </div>

            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              onPointerMove={(e) => {
                if (dragSelectingActiveRef.current || isMultiDragSelecting) {
                  const target = document.elementFromPoint(e.clientX, e.clientY);
                  const msgEl = target?.closest('[data-msg-id]');
                  if (msgEl) {
                    const msgId = msgEl.getAttribute('data-msg-id');
                    if (msgId && !selectedMsgIds.includes(msgId)) {
                      setSelectedMsgIds(prev => [...prev, msgId]);
                    }
                  }
                }
              }}
              onTouchMove={(e) => {
                if ((dragSelectingActiveRef.current || isMultiDragSelecting) && e.touches[0]) {
                  const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
                  const msgEl = target?.closest('[data-msg-id]');
                  if (msgEl) {
                    const msgId = msgEl.getAttribute('data-msg-id');
                    if (msgId && !selectedMsgIds.includes(msgId)) {
                      setSelectedMsgIds(prev => [...prev, msgId]);
                    }
                  }
                }
              }}
              onPointerUp={() => {
                dragSelectingActiveRef.current = false;
                setIsMultiDragSelecting(false);
              }}
              onTouchEnd={() => {
                dragSelectingActiveRef.current = false;
                setIsMultiDragSelecting(false);
              }}
              className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden p-4 sm:p-6 space-y-4 bg-slate-50/50 relative custom-scrollbar w-full"
            >
              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 5 }}
                    className="text-center space-y-3"
                  >
                    <p className="text-xs text-slate-400 max-w-[200px]">
                      Если ваши сообщения пропали, выйдите в список чатов, выключите интернет на 3 секунды и зайдите в чат снова.
                    </p>
                    <button 
                      onClick={() => {
                        socket?.connect();
                        if (selectedChat) {
                          selectChat(selectedChat);
                        }
                      }}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 mx-auto"
                    >
                      <RotateCw size={14} className="text-blue-500" /> Обновить чат
                    </button>
                  </motion.div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                    <Send size={32} className="text-slate-300 ml-2" />
                  </div>
                  <p className="font-medium">Нет сообщений</p>
                  <p className="text-sm text-slate-400">Напишите первое сообщение!</p>
                </div>
              ) : (
                (() => {
                  let displayedMessages = activeThread 
                    ? messages.filter(m => (m.threadId === activeThread.id || m.id === activeThread.id) && !(profile?.hiddenMessages || []).includes(m.id))
                    : messages.filter(m => !m.threadId && !(profile?.hiddenMessages || []).includes(m.id));

                  if (showChatSearch && (chatSearchQuery.trim() || chatSearchFilterUser)) {
                    displayedMessages = displayedMessages.filter(m => {
                      const lowerQuery = chatSearchQuery.trim().toLowerCase();
                      const matchText = lowerQuery ? (m.text || '').toLowerCase().includes(lowerQuery) : true;
                      const matchUser = chatSearchFilterUser ? m.senderId === chatSearchFilterUser : true;
                      return matchText && matchUser;
                    });
                  }

                  if (displayedMessages.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                          <MessageSquare size={32} className="text-slate-300 ml-2" />
                        </div>
                        <p className="font-medium">Нет комментариев</p>
                        <p className="text-sm text-slate-400">Напишите первый комментарий!</p>
                      </div>
                    );
                  }

                  return (
                    <AnimatePresence initial={false}>
                      {displayedMessages.map((msg, idx) => {
                        const isMe = msg.senderId === user?.uid;
                        let sender: any = users.find(u => u.uid === msg.senderId);
                        
                        const msgDate = new Date(msg.createdAt).setHours(0,0,0,0);
                        const prevMsgDate = idx > 0 ? new Date(displayedMessages[idx-1].createdAt).setHours(0,0,0,0) : null;
                        const showDateSeparator = msgDate !== prevMsgDate;
                        
                        let dateLabel = '';
                        if (showDateSeparator) {
                          const diffDays = Math.floor((new Date().setHours(0,0,0,0) - msgDate) / 86400000);
                          if (diffDays === 0) dateLabel = 'Сегодня';
                          else if (diffDays === 1) dateLabel = 'Вчера';
                          else {
                            const d = new Date(msgDate);
                            const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
                            dateLabel = `${d.getDate()} ${months[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
                          }
                        }
                        
                        if (msg.asChannel && msg.groupId && groups.find(g => g.id === msg.groupId)?.type === 'channel') {
                           const channelData = groups.find(g => g.id === msg.groupId);
                           if (channelData) {
                             sender = {
                               uid: channelData.id,
                               displayName: channelData.name,
                               photoURL: channelData.photoURL
                             };
                           }
                        }

                        const isRelayed = msg.relayPath && msg.relayPath.length > 0;
                        const repliesCount = messages.filter(m => m.threadId === msg.id).length;

                        let isRead = false;
                        if (selectedChat.type === 'user') {
                          isRead = msg.readBy?.includes(selectedChat.id) || false;
                        } else {
                          const group = groups.find(g => g.id === selectedChat.id);
                          if (group) {
                            const membersCount = group.members.length;
                            const readCount = msg.readBy?.length || 0;
                            isRead = readCount >= Math.max(1, Math.floor(membersCount / 2));
                          }
                        }

                        return (
                          <React.Fragment key={msg.id}>
                            {showDateSeparator && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex justify-center my-4 sticky top-4 z-10"
                                key={'date-'+msgDate}
                              >
                                <span className="px-3 py-1 bg-slate-100/90 text-slate-500 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm border border-slate-200/50">
                                  {dateLabel}
                                </span>
                              </motion.div>
                            )}
                            <motion.div 
                            key={msg.id}
                            id={`msg-${msg.id}`}
                            data-msg-id={msg.id}
                            drag="x"
                            dragConstraints={{ left: -50, right: 0 }}
                            dragElastic={0.05}
                            dragSnapToOrigin={true}
                            onDragEnd={(event, info) => {
                              if (info.offset.x < -20 || info.velocity.x < -100) {
                                setEditingMessage(null);
                                setReplyTo(msg);
                                triggerHapticFeedback();
                              }
                            }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            onPointerDown={() => {
                              if (msgLongPressTimerRef.current) clearTimeout(msgLongPressTimerRef.current);
                              msgLongPressTimerRef.current = setTimeout(() => {
                                setIsSelectionMode(true);
                                setSelectedMsgIds(prev => prev.includes(msg.id) ? prev : [...prev, msg.id]);
                                dragSelectingActiveRef.current = true;
                                setIsMultiDragSelecting(true);
                                triggerHapticFeedback();
                              }, 350);
                            }}
                            onPointerUp={() => {
                              if (msgLongPressTimerRef.current) {
                                clearTimeout(msgLongPressTimerRef.current);
                                msgLongPressTimerRef.current = null;
                              }
                            }}
                            onPointerCancel={() => {
                              if (msgLongPressTimerRef.current) {
                                clearTimeout(msgLongPressTimerRef.current);
                                msgLongPressTimerRef.current = null;
                              }
                            }}
                            onClick={(e) => {
                              if (isSelectionMode) {
                                e.stopPropagation();
                                if (selectedMsgIds.includes(msg.id)) {
                                  const next = selectedMsgIds.filter(id => id !== msg.id);
                                  setSelectedMsgIds(next);
                                  if (next.length === 0) setIsSelectionMode(false);
                                } else {
                                  setSelectedMsgIds(prev => [...prev, msg.id]);
                                }
                              }
                            }}
                            onPointerEnter={(e) => {
                              if ((isSelectionMode || isMultiDragSelecting || dragSelectingActiveRef.current) && (e.buttons === 1 || e.buttons === 2)) {
                                if (!selectedMsgIds.includes(msg.id)) {
                                  setSelectedMsgIds(prev => [...prev, msg.id]);
                                }
                              }
                            }}
                            className={cn(
                              "flex flex-col transition-all duration-300 w-full relative group min-w-0 touch-pan-y", 
                              isMe ? "items-end" : "items-start",
                              highlightedMsgId === msg.id ? "scale-[1.02] drop-shadow-xl z-10" : "",
                              selectedMsgIds.includes(msg.id) ? "bg-blue-50/70 p-1.5 rounded-2xl border border-blue-300/80 shadow-sm" : ""
                            )}
                            onContextMenu={(e) => handleContextMenu(e, msg)}
                            onTouchStart={(e) => startMsgTouchTimer(e, msg)}
                            onTouchEnd={clearMsgTouchTimer}
                            onTouchMove={handleMsgTouchMove}
                            onTouchCancel={clearMsgTouchTimer}
                          >
                            <div className={cn(
                              "max-w-[85%] sm:max-w-[70%] relative flex items-start gap-2",
                              isMe ? "flex-row-reverse" : "flex-row"
                            )}>
                              {isSelectionMode && (
                                <div className="self-center shrink-0 p-1 cursor-pointer">
                                  <div className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                    selectedMsgIds.includes(msg.id) ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                                  )}>
                                    {selectedMsgIds.includes(msg.id) && <Check size={12} strokeWidth={3} />}
                                  </div>
                                </div>
                              )}
                              {!isMe && selectedChat.type !== 'user' && (
                                <div 
                                  onClick={() => {
                                    setViewedProfile(sender || null);
                                    setShowProfile(true);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-slate-200 shrink-0 cursor-pointer overflow-hidden mt-1 flex items-center justify-center"
                                >
                                  {sender?.photoURL ? (
                                    <img src={sender.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-xs font-bold">{sender?.displayName?.[0]}</span>
                                  )}
                                </div>
                              )}
                              <div className={cn(
                                "flex flex-col min-w-0",
                                isMe ? "items-end" : "items-start"
                              )}>
                      {!isMe && selectedChat.type !== 'user' && (
                        <span 
                          onClick={() => {
                            setViewedProfile(sender || null);
                            setShowProfile(true);
                          }}
                          className="text-[10px] font-bold text-slate-400 ml-2 mb-1 cursor-pointer hover:text-blue-500 transition-colors flex items-center gap-1"
                        >
                          {sender?.displayName}
                          {(() => {
                             if (!sender || !sender.activeTitleId || !sender.grantedTitles) return null;
                             const activeT = sender.grantedTitles.find(t => t.id === sender.activeTitleId);
                             if (!activeT) return null;
                             return (
                               <RenderTitle title={activeT} className="ml-1" />
                             );
                          })()}
                        </span>
                      )}
                      
                      <div 
                        className={cn(
                          "p-2 rounded-2xl shadow-sm relative transition-colors duration-500 max-w-full [word-break:break-word]",
                          isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none border border-slate-100",
                          highlightedMsgId === msg.id ? (isMe ? "bg-blue-500 ring-4 ring-blue-300/50" : "bg-blue-50 ring-4 ring-blue-300/50") : ""
                        )}
                      >
                        {msg.quote && (() => {
                          const originalSender = users.find(u => u.uid === msg.quote?.originalSenderId);
                          return (
                            <div 
                              className={cn(
                                "mb-2 p-2 rounded-lg text-[10px] border-l-4 transition-opacity",
                                isMe ? "bg-blue-700/50 border-blue-300" : "bg-slate-100 border-slate-300"
                              )}
                            >
                              <div className="font-bold mb-1 opacity-70">{originalSender?.displayName || 'Неизвестный'}</div>
                              <div className="italic opacity-90">"{msg.quote.text}"</div>
                            </div>
                          );
                        })()}

                        {msg.replyToId && (() => {
                          const repliedMsg = messages.find(m => m.id === msg.replyToId);
                          return (
                            <div 
                              onClick={(e) => { e.stopPropagation(); repliedMsg && scrollToMessage(msg.replyToId!); }}
                              className={cn(
                                "mb-2 p-2 rounded-lg text-[10px] border-l-4 transition-opacity",
                                repliedMsg ? "cursor-pointer hover:opacity-80" : "opacity-60 italic",
                                isMe ? "bg-blue-700/50 border-blue-300" : "bg-slate-100 border-slate-300"
                              )}
                            >
                              {repliedMsg ? (repliedMsg.text || (repliedMsg.type === 'image' ? 'Фотография' : repliedMsg.type === 'video' ? 'Видео' : repliedMsg.type === 'game' ? 'Игра' : 'Файл')) : 'Удаленное сообщение'}
                            </div>
                          );
                        })()}

                        {msg.forwardedFrom && (() => {
                          const originalSender = users.find(u => u.uid === msg.forwardedFrom);
                          return (
                            <div className="text-[10px] mb-1 font-medium italic opacity-80 flex items-center gap-1">
                              <Forward size={10} />
                              Переслано от: {originalSender?.displayName || 'Пользователь'}
                            </div>
                          );
                        })()}

                        {msg.text && (msg.type !== 'text' || !msg.isEncrypted) && msg.type !== 'audio' && (
                          <p className={cn(
                            "text-sm leading-relaxed mb-2 whitespace-pre-wrap break-words",
                            msg.type === 'text' ? "" : "opacity-90"
                          )}>
                            {formatMessageText(msg.text, showChatSearch ? chatSearchQuery : undefined)}
                          </p>
                        )}

                        {msg.type === 'audio' && (
                          <VoiceBubbleWidget
                            msg={msg}
                            isMe={msg.senderId === user?.uid}
                            activeVoice={voicePlayer.activeVoice}
                            isAccelerated={voicePlayer.isAccelerated}
                            onPlay={() => {
                              const sender = users.find(u => u.uid === msg.senderId);
                              voicePlayer.playVoice({
                                id: msg.id,
                                fileUrl: msg.fileUrl || '',
                                senderName: sender?.displayName || (msg.senderId === user?.uid ? 'Вы' : 'Пользователь'),
                                senderAvatar: sender?.photoURL,
                                createdAt: msg.createdAt,
                              });
                            }}
                            onSeek={(time) => voicePlayer.seekVoice(time)}
                          />
                        )}

                        {msg.type === 'text' && msg.isEncrypted && (
                          <p className="text-sm leading-relaxed italic text-blue-200/80 flex items-center gap-2 whitespace-pre-wrap break-words">
                            <Shield size={12} className="shrink-0" /> {formatMessageText(decryptMessage(msg.text), showChatSearch ? chatSearchQuery : undefined)}
                          </p>
                        )}

                        {msg.type === 'image' && msg.fileUrl && msg.fileName !== 'sticker.jpg' && (
                          <FirestoreMedia 
                            url={msg.fileUrl} 
                            type="image"
                            fileName={msg.fileName}
                            className="rounded-xl max-w-[240px] max-h-[240px] object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                            onClick={(e) => {
                              e.stopPropagation();
                              const mediaOnly = messages.filter(m => m.type === 'image' && m.fileName !== 'sticker.jpg' || m.type === 'video');
                              const index = mediaOnly.findIndex(m => m.id === msg.id);
                              if (index !== -1) setSelectedMediaIndex(index);
                            }}
                          />
                        )}
                        {msg.type === 'image' && msg.fileUrl && msg.fileName === 'sticker.jpg' && (
                          <FirestoreMedia 
                            url={msg.fileUrl} 
                            type="image"
                            fileName={msg.fileName}
                            className="rounded-xl max-w-[120px] max-h-[120px] object-contain" 
                          />
                        )}
                        {msg.type === 'video' && msg.fileUrl && (
                          <div className="relative cursor-pointer group/video" onClick={(e) => {
                            e.stopPropagation();
                            const mediaOnly = messages.filter(m => m.type === 'image' && m.fileName !== 'sticker.jpg' || m.type === 'video');
                            const index = mediaOnly.findIndex(m => m.id === msg.id);
                            if (index !== -1) setSelectedMediaIndex(index);
                          }}>
                            <FirestoreMedia 
                              url={msg.fileUrl} 
                              type="video"
                              fileName={msg.fileName}
                              className="rounded-xl max-w-[240px] max-h-[240px] object-cover pointer-events-none" 
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/30 transition-colors rounded-xl">
                              <Play size={32} className="text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        )}
                        {msg.type === 'file' && (
                          <button 
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const url = msg.fileUrl;
                              if (!url) return;
                              
                              const isPdf = (msg.fileName || '').toLowerCase().endsWith('.pdf');
                              const isDangerous = (msg.fileName || '').toLowerCase().endsWith('.apk') || (msg.fileName || '').toLowerCase().endsWith('.exe') || (msg.fileName || '').toLowerCase().endsWith('.bat') || (msg.fileName || '').toLowerCase().endsWith('.sh');

                              if (isDangerous && !isGlobalAdmin) {
                                setDangerousFile({ url, name: msg.fileName || 'file' });
                                const num1 = Math.floor(Math.random() * 10) + 1;
                                const num2 = Math.floor(Math.random() * 10) + 1;
                                setCaptchaExpected(num1 + num2);
                                setCaptchaAnswer('');
                                return;
                              }

                              if (url.startsWith('firestore://')) {
                                const { getFileFromFirestore } = await import('./lib/fileStorage');
                                const fileId = url.replace('firestore://', '');
                                const fileData = await getFileFromFirestore(fileId);
                                if (fileData) {
                                  if (isPdf) {
                                    setPreviewPdfUrl({ url: fileData.url, name: msg.fileName || 'Document.pdf' });
                                  } else {
                                    const a = document.createElement('a');
                                    a.href = fileData.url;
                                    a.download = msg.fileName || 'file';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                  }
                                }
                              } else {
                                if (isPdf) {
                                  setPreviewPdfUrl({ url, name: msg.fileName || 'Document.pdf' });
                                } else {
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = msg.fileName || 'file';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }
                              }
                            }}
                            className="flex items-center gap-2 p-2 bg-black/5 hover:bg-black/10 transition-colors rounded-lg w-full text-left"
                          >
                            <FileIcon size={20} className="shrink-0" />
                            <span className="text-xs truncate max-w-[150px] flex-1">{msg.fileName || 'Файл'}</span>
                            <Download size={16} className="shrink-0" />
                          </button>
                        )}

                        {msg.type === 'game' && msg.gameType === 'words' && msg.gameState && (
                          <div className={cn(
                            "bg-white rounded-xl overflow-hidden border mt-2 min-w-[200px]",
                            isMe ? "border-blue-400" : "border-slate-200"
                          )}>
                            <WordsGame 
                              gameState={msg.gameState}
                              myUid={user?.uid}
                              myDisplayName={user?.displayName || 'Я'}
                              onUpdate={async (newState) => {
                                 if (!user) return;
                                 socket?.emit('message:update', {
                                   id: msg.id,
                                   chatId: selectedChat.id,
                                   update: { gameState: newState }
                                 });
                              }}
                            />
                          </div>
                        )}

                        {msg.type === 'game' && msg.gameType === 'tictactoe' && msg.gameState && (
                          <div className={cn(
                            "bg-white rounded-xl overflow-hidden border mt-2",
                            isMe ? "border-blue-400" : "border-slate-200"
                          )}>
                            <TicTacToe 
                              gameState={msg.gameState}
                              isMyTurn={
                                (msg.gameState.xIsNext && msg.gameState.playerX === user?.uid) ||
                                (!msg.gameState.xIsNext && msg.gameState.playerO === user?.uid) ||
                                (!msg.gameState.xIsNext && !msg.gameState.playerO) // Anyone can join as O
                              }
                              mySymbol={
                                msg.gameState.playerX === user?.uid ? 'X' : 
                                (msg.gameState.playerO === user?.uid ? 'O' : null)
                              }
                              onMove={async (index) => {
                                if (!user) return;
                                const newBoard = [...msg.gameState.board];
                                const isX = msg.gameState.xIsNext;
                                newBoard[index] = isX ? 'X' : 'O';
                                
                                const calculateWinner = (squares: Array<'X' | 'O' | null>) => {
                                  const lines = [
                                    [0, 1, 2], [3, 4, 5], [6, 7, 8],
                                    [0, 3, 6], [1, 4, 7], [2, 5, 8],
                                    [0, 4, 8], [2, 4, 6]
                                  ];
                                  for (let i = 0; i < lines.length; i++) {
                                    const [a, b, c] = lines[i];
                                    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                                      return squares[a];
                                    }
                                  }
                                  return null;
                                };

                                const winner = calculateWinner(newBoard);
                                
                                const newGameState = {
                                  ...msg.gameState,
                                  board: newBoard,
                                  xIsNext: !isX,
                                  winner,
                                  playerO: msg.gameState.playerO || (!isX ? user.uid : null)
                                };

                                try {
                                  socket?.emit('message:update', { id: msg.id, chatId: selectedChat?.id, update: { gameState: newGameState } });
                                } catch (error) {
                                  console.error("Error updating game state:", error);
                                }
                              }}
                            />
                          </div>
                        )}

                        {msg.type === 'poll' && msg.poll && (
                          <div className="bg-white/5 rounded-xl p-4 mt-2 w-full min-w-[250px]">
                            <h4 className="font-bold mb-3">{msg.poll.question}</h4>
                            <div className="space-y-2">
                              {msg.poll.options.map(option => {
                                const totalVotes = msg.poll!.options.reduce((sum, opt) => sum + opt.votes.length, 0);
                                const percentage = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
                                const hasVoted = msg.poll!.options.some(opt => opt.votes.includes(user!.uid));
                                const hasVotedForThis = option.votes.includes(user!.uid);
                                
                                return (
                                  <div 
                                    key={option.id}
                                    onClick={async () => {
                                      if (!user || msg.poll?.closed) return;
                                      if (!msg.poll!.isMultipleChoice && hasVoted && !hasVotedForThis) return;
                                      
                                      const newPoll = { ...msg.poll! };
                                      const optIndex = newPoll.options.findIndex(o => o.id === option.id);
                                      
                                      if (hasVotedForThis) {
                                        newPoll.options[optIndex].votes = newPoll.options[optIndex].votes.filter(id => id !== user.uid);
                                      } else {
                                        newPoll.options[optIndex].votes.push(user.uid);
                                      }
                                      
                                      try {
                                        socket?.emit('message:update', { id: msg.id, chatId: selectedChat?.id, update: { poll: newPoll } });
                                      } catch (e) {
                                        console.error('Failed to vote', e);
                                      }
                                    }}
                                    className={cn(
                                      "relative overflow-hidden rounded-lg p-3 cursor-pointer transition-colors border flex flex-col gap-2",
                                      hasVotedForThis ? "border-blue-500 bg-blue-500/10" : "border-slate-200/20 hover:bg-slate-50/10",
                                      msg.poll!.closed && "cursor-default opacity-80"
                                    )}
                                  >
                                    <div 
                                      className="absolute left-0 top-0 bottom-0 bg-blue-500/20 transition-all duration-500"
                                      style={{ width: `${hasVoted ? percentage : 0}%` }}
                                    />
                                    <div className="relative flex justify-between items-center z-10">
                                      <span className="text-sm font-medium">{option.text}</span>
                                      {hasVoted && (
                                        <span className="text-xs font-bold opacity-70">{percentage}%</span>
                                      )}
                                    </div>
                                    {!msg.poll!.isAnonymous && option.votes.length > 0 && (
                                      <div className="relative z-10 flex flex-wrap gap-1 mt-1">
                                        {option.votes.map(voterId => {
                                          const voter = users.find(u => u.uid === voterId);
                                          if (!voter) return null;
                                          return (
                                            <img 
                                              key={voterId}
                                              src={voter.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(voter.displayName)}`}
                                              alt={voter.displayName}
                                              title={voter.displayName}
                                              className="w-5 h-5 rounded-full border border-white/20"
                                            />
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-3 text-xs opacity-60 flex justify-between">
                              <span>{msg.poll.options.reduce((sum, opt) => sum + opt.votes.length, 0)} голосов</span>
                              {msg.poll.isAnonymous && <span>Анонимный опрос</span>}
                            </div>
                          </div>
                        )}

                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                              const hasReacted = userIds.includes(user?.uid || '');
                              return (
                                <button
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReaction(msg.id, emoji);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors",
                                    hasReacted 
                                      ? "bg-blue-100 text-blue-700 border border-blue-200" 
                                      : "bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200"
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span>{userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {msg.inlineButtons && msg.inlineButtons.length > 0 && (
                          <div className="flex flex-col gap-1 mt-2 mb-1 w-full relative z-10">
                            {msg.inlineButtons.map((row, rowIdx) => (
                              <div key={rowIdx} className="flex gap-1 w-full">
                                {row.map((btn, btnIdx) => (
                                  <button
                                    key={btnIdx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (btn.url) {
                                        window.open(btn.url, '_blank');
                                      } else if ((btn as any).action === 'copy' && (btn as any).actionData) {
                                        navigator.clipboard.writeText((btn as any).actionData).then(() => {
                                          if ((window as any).addToast) {
                                            (window as any).addToast('Текст скопирован в буфер обмена', 'success');
                                          } else {
                                            alert('Скопировано: ' + (btn as any).actionData);
                                          }
                                        }).catch(() => alert('Не удалось скопировать'));
                                      } else if (btn.callbackData) {
                                        if (socket) {
    socket.emit('bot:callback', {
      chatId: selectedChat.id,
      messageId: msg.id,
      callbackData: btn.callbackData,
      botId: msg.senderId
    });
  }
                                      }
                                    }}
                                    className="flex-1 bg-black/10 hover:bg-black/20 text-xs font-semibold p-2 rounded-lg transition-colors text-center truncate backdrop-blur-sm"
                                  >
                                    {btn.text}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={cn(
                          "flex items-center gap-1 mt-1 justify-end",
                          isMe ? "text-blue-100" : "text-slate-400"
                        )}>
                          <span className="text-[9px]">{format(new Date(msg.createdAt), 'HH:mm')}</span>
                          {msg.isEdited && <span className="text-[9px] ml-1 opacity-70">ред.</span>}
                          {isMe && (isRead ? <CheckCheck size={12} /> : <Check size={12} />)}
                        </div>

                        {/* Comments Button (for channels) */}
                        {!activeThread && selectedChat.type !== 'user' && (groups.find(g => g.id === selectedChat.id)?.type === 'channel') && !msg.threadId && (
                          <button 
                            onClick={() => {
                              setActiveThread(msg);
                              setEditingMessage(null);
                              setReplyTo(null);
                              setInputText('');
                            }}
                            className={cn(
                              "mt-2 w-full py-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 transition-colors",
                              isMe ? "bg-blue-700/30 hover:bg-blue-700/50 text-blue-100" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                            )}
                          >
                            <MessageSquare size={12} />
                            {repliesCount > 0 ? `${repliesCount} комментариев` : 'Прокомментировать'}
                          </button>
                        )}

                        {/* Mesh Relay Badge */}
                        {isRelayed && (
                          <div className="absolute -bottom-5 right-0 flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                            <RadarIcon size={8} /> Передано через {msg.relayPath?.length} узла
                          </div>
                        )}

                          </div>
                        </div>
                    </div>

                    {/* Actions Overlay */}
                        <div className={cn(
                          "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                          isMe ? "right-full mr-2" : "left-full ml-2"
                        )}>
                          <button onClick={() => setReplyTo(msg)} className="p-1.5 bg-white shadow-md rounded-lg hover:bg-slate-50 text-slate-600">
                            <Reply size={14} />
                          </button>
                          {isMe && (
                            <button onClick={() => { setEditingMessage(msg); setInputText(msg.text); }} className="p-1.5 bg-white shadow-md rounded-lg hover:bg-slate-50 text-slate-600">
                              <Edit2 size={14} />
                            </button>
                          )}
                          
                          {(isMe || (selectedChat.type !== 'user' && (groups.find(g => g.id === selectedChat.id)?.memberRoles?.[user?.uid || ''] !== 'member' || isGlobalAdmin))) && (
                            <div className="relative">
                              <button 
                                onClick={() => setDeleteMenuMsgId(deleteMenuMsgId === msg.id ? null : msg.id)} 
                                className="p-1.5 bg-white shadow-md rounded-lg hover:bg-red-50 text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                              
                              {deleteMenuMsgId === msg.id && (
                                <div className="absolute bottom-full right-0 mb-2 bg-white shadow-xl rounded-xl border border-slate-100 p-2 z-50 min-w-[180px]">
                                  <button 
                                    onClick={() => { deleteMessage(msg.id, false); setDeleteMenuMsgId(null); }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-lg flex items-center gap-2"
                                  >
                                    Удалить
                                  </button>
                                  <button 
                                    onClick={() => { deleteMessage(msg.id, false, 5000); setDeleteMenuMsgId(null); }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-lg flex items-center gap-2"
                                  >
                                    Удалить (5 сек)
                                  </button>
                                  {canDeleteForEveryoneState(msg) && (
                                    <button 
                                      onClick={() => { deleteMessage(msg.id, true); setDeleteMenuMsgId(null); }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-2"
                                    >
                                      Удалить для всех
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <button onClick={() => copyToClipboard(msg.text)} className="p-1.5 bg-white shadow-md rounded-lg hover:bg-slate-50 text-slate-600">
                            <Copy size={14} />
                          </button>
                        </div>
                      </motion.div>
                    </React.Fragment>
                );
              })}
              </AnimatePresence>
            );
            })()
          )}
          <div ref={messagesEndRef} />
            </div>

            {/* Context Menu Overlay */}
      <AnimatePresence>
        {chatContextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[9999] bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden w-64"
            style={{ 
              left: Math.min(chatContextMenu.x, window.innerWidth - 260), 
              top: Math.min(chatContextMenu.y, window.innerHeight - 150) 
            }}
          >
            <div className="p-1">
              <button 
                onClick={() => { handlePinChat(chatContextMenu.chat.id); setChatContextMenu(null); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex flex-col transition-colors rounded-lg font-medium"
              >
                {(profile?.pinnedChats || []).includes(chatContextMenu.chat.id) ? 'Открепить' : 'Закрепить'}
              </button>
              
              {(chatContextMenu.chat.type === 'user' || chatContextMenu.chat.id !== 'global_channel') && (
              <button 
                onClick={() => {
                   setChatContextMenu(null);
                   selectChat({ type: chatContextMenu.chat.type as any, id: chatContextMenu.chat.id });
                   setShowDeleteModal(true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors rounded-lg font-medium text-red-500"
              >
                Удалить
              </button>
              )}

              
            </div>
          </motion.div>
        )}
      </AnimatePresence>
            <AnimatePresence>
            {contextMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                className="fixed z-[9999] bg-white shadow-2xl rounded-xl border border-slate-100 py-2 min-w-[200px]"
                style={{ 
                  top: contextMenu.y < window.innerHeight / 2 ? contextMenu.y : 'auto',
                  bottom: contextMenu.y >= window.innerHeight / 2 ? Math.max(10, window.innerHeight - contextMenu.y) : 'auto',
                  left: Math.min(contextMenu.x, window.innerWidth - 220) 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const msg = contextMenu.msg;
                  if (!msg) return null;
                  const chat = msg.groupId ? (groups.find(g => g.id === msg.groupId) || (msg.groupId === 'global_channel' ? groups.find(g => g.id === 'global_channel') : null)) : null;
                  const role = chat ? chat.memberRoles?.[user?.uid || ''] || 'member' : 'member';
                  
                  let perms = { canUseReactions: true };
                  if (chat && chat.permissions) {
                    const foundPerms = chat.permissions[role === 'owner' || role === 'admin' ? 'admin' : 'member'];
                    if (foundPerms) {
                      perms = { 
                        canUseReactions: foundPerms.canUseReactions ?? true 
                      };
                    }
                  }
                  
                  if (perms.canUseReactions === false && !isGlobalAdmin) return null;
                  
                  return (
                    <div className="px-3 py-2 border-b border-slate-50 mb-1 flex items-center gap-2 justify-start overflow-x-auto custom-scrollbar">
                      {['👍', '❤️', '😂', '😮', '😢', '🙏', '👎', '💯'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            if (contextMenu?.msg?.id) {
                              toggleReaction(contextMenu.msg.id, emoji);
                              setContextMenu(null);
                            }
                          }}
                          className="text-xl hover:scale-125 transition-transform p-1 shrink-0"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                
                <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
                  Действия
                </div>
                
                <button 
                  onClick={() => { setEditingMessage(null); setInputText(''); setReplyTo(contextMenu.msg); setContextMenu(null); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                >
                  <Reply size={16} className="text-slate-400" /> Ответить
                </button>
                
                <button 
                  onClick={() => { copyToClipboard(contextMenu.msg.text); setContextMenu(null); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                >
                  <Copy size={16} className="text-slate-400" /> Скопировать
                </button>

                {contextMenu.msg.type === 'image' && contextMenu.msg.fileName === 'sticker.jpg' && (
                  <button 
                    onClick={() => { 
                      if (contextMenu.msg.stickerPackId) {
                        socket?.emit('stickers:pack:get', contextMenu.msg.stickerPackId);
                      } else {
                        addToast('Стикерпак не найден. Возможно, стикер был отправлен из старой версии.', 'info');
                      }
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                  >
                    <div className="flex gap-2 items-center"><Smile size={16} className="text-slate-400" /> Смотреть стикерпак</div>
                  </button>
                )}

                <button 
                  onClick={() => { setForwardingMessage(contextMenu.msg); setForwardSelectedChats([]); setForwardComment(''); setContextMenu(null); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                >
                  <Share size={16} className="text-slate-400" /> Переслать
                </button>

                {contextMenu.msg.text && contextMenu.msg.type !== 'audio' && contextMenu.msg.text !== '🎤 Голосовое сообщение' && !contextMenu.msg.text.includes('Голосовое сообщение') && (
                  <button 
                    onClick={() => { 
                      setTextSelectForQuote(contextMenu.msg);
                      setContextMenu(null); 
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                  >
                    <Quote size={16} className="text-slate-400" /> Цитировать (Выделить текст)
                  </button>
                )}

                {contextMenu.msg.fileUrl && (
                  <button 
                    onClick={() => { 
                      saveMediaToDevice(contextMenu.msg.fileUrl, contextMenu.msg.fileName);
                      setContextMenu(null); 
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 font-medium text-blue-600"
                  >
                    <Download size={16} className="text-blue-500" /> Сохранить в устройство
                  </button>
                )}

                {contextMenu.msg.type === 'audio' && (
                  <button 
                    onClick={() => {
                      const msgEl = document.getElementById(`msg-${contextMenu.msg.id}`);
                      if (msgEl) {
                        const subBtn = msgEl.querySelector('button[title*="Субтитры"]') as HTMLButtonElement;
                        if (subBtn) subBtn.click();
                      }
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                  >
                    <Subtitles size={16} className="text-blue-500" /> Субтитры (Распознать)
                  </button>
                )}

                {contextMenu.msg.senderId === user?.uid && (
                  <button 
                    onClick={() => { setReplyTo(null); setEditingMessage(contextMenu.msg); setInputText(contextMenu.msg.text); setContextMenu(null); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700"
                  >
                    <Edit2 size={16} className="text-slate-400" /> Изменить
                  </button>
                )}

                <div className="h-px bg-slate-100 my-1"></div>

                <button 
                  onClick={() => { deleteMessage(contextMenu.msg.id, false); setContextMenu(null); }}
                  disabled={contextMenuTimer > 0}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors",
                    contextMenuTimer > 0 ? "opacity-50 cursor-not-allowed text-slate-400" : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <Trash2 size={16} className={contextMenuTimer > 0 ? "text-slate-300" : "text-slate-400"} /> 
                  Удалить {contextMenuTimer > 0 && `(${contextMenuTimer})`}
                </button>

                {canDeleteForEveryoneState(contextMenu.msg) && (
                  <button 
                    onClick={() => { deleteMessage(contextMenu.msg.id, true); setContextMenu(null); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 text-red-600 flex items-center gap-3 transition-colors"
                  >
                    <Trash2 size={16} className="text-red-400" /> 
                    Удалить для всех
                  </button>
                )}
              </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
              {showScrollToBottom && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  className="absolute right-6 bottom-24 z-50 flex flex-col gap-2"
                >
                  <button
                    className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors active:scale-95"
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onPointerDown={(e) => {
                      // Trigger top scroll on long press (or simple alternative since long press is tricky)
                      const timer = setTimeout(() => {
                         messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                      }, 500);
                      e.currentTarget.onpointerup = () => clearTimeout(timer);
                      e.currentTarget.onpointerleave = () => clearTimeout(timer);
                    }}
                  >
                    <ArrowLeft size={20} className="-rotate-90" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0 relative z-40">
              {(() => {
                const activeGroup = selectedChat?.type !== 'user' ? groups.find(g => g.id === selectedChat.id) : null;
                const userRole = activeGroup?.memberRoles?.[user?.uid || ''] || 'member';
                const groupPerms = activeGroup?.permissions?.[userRole === 'owner' ? 'admin' : userRole] || {
                  canSendMessages: true,
                  canSendMedia: true,
                  canAddMembers: true,
                  canDeleteForEveryone: false,
                  canBanUsers: false,
                  canChangeProfile: false,
                  canComment: true,
                  canSendMediaInComments: true,
                };

                const isChannel = activeGroup?.type === 'channel';
                
                // Block logic
                const isBlockedByMe = selectedChat.type === 'user' && profile?.blockedUsers?.includes(selectedChat.id);
                const isBlockedByThem = selectedChat.type === 'user' && (activeChatData as UserProfile)?.blockedUsers?.includes(user?.uid || '');
                
                if (isBlockedByMe) {
                  return (
                    <div className="p-3 bg-red-50 rounded-xl text-center text-xs text-red-500 font-medium flex flex-col items-center gap-2">
                      <span>Вы заблокировали этого пользователя</span>
                      <button 
                        onClick={async () => {
                          if (!user || !profile) return;
                          const newBlocked = (profile.blockedUsers || []).filter(id => id !== selectedChat.id);
                          socket?.emit('profile:update', { uid: user.uid, profile: { blockedUsers: newBlocked } });
                          setProfile(prev => prev ? { ...prev, blockedUsers: newBlocked } : null);
                          addToast('Пользователь разблокирован', 'success');
                        }}
                        className="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                      >
                        Разблокировать
                      </button>
                    </div>
                  );
                }

                if (isBlockedByThem) {
                  return (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500 font-medium">
                      Вы уже не можете писать этому пользователю
                    </div>
                  );
                }
                
                // If it's a channel and we are not admin/owner, we can't send messages directly
                // UNLESS we are in a thread (commenting) and canComment is true
                let canSendMessages = selectedChat.type === 'user' || groupPerms.canSendMessages || isGlobalAdmin;
                let canSendMedia = selectedChat.type === 'user' || groupPerms.canSendMedia || isGlobalAdmin;

                const isBannedFromComments = activeGroup?.bannedFromComments?.includes(user?.uid || '');

                if (isChannel && userRole === 'member' && !isGlobalAdmin) {
                  if (activeThread) {
                    canSendMessages = groupPerms.canComment && !isBannedFromComments;
                    canSendMedia = groupPerms.canComment && (
                      groupPerms.canSendPhotosInComments || 
                      groupPerms.canSendVideosInComments || 
                      groupPerms.canSendStickersInComments || 
                      groupPerms.canSendFilesInComments
                    ) && !isBannedFromComments;
                  } else {
                    canSendMessages = false;
                    canSendMedia = false;
                  }
                } else if (selectedChat.type !== 'user' && userRole === 'member' && !isGlobalAdmin) {
                  if (activeThread) {
                    canSendMessages = groupPerms.canComment && !isBannedFromComments;
                    canSendMedia = groupPerms.canComment && (
                      groupPerms.canSendPhotosInComments || 
                      groupPerms.canSendVideosInComments || 
                      groupPerms.canSendStickersInComments || 
                      groupPerms.canSendFilesInComments
                    ) && !isBannedFromComments;
                  }
                }

                if (!canSendMessages && !canSendMedia) {
                  return (
                    <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-500 font-medium">
                      {isChannel && !activeThread ? 'Только администраторы могут публиковать записи' : 
                       isBannedFromComments && activeThread ? 'Вам запрещено комментировать' : 'Отправка сообщений ограничена'}
                    </div>
                  );
                }

                return (
                  <>
                    {uploadProgress > 0 && isSending && (
                      <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-xl">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="10" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="10" strokeDasharray={`${uploadProgress * 2.83} 283`} strokeLinecap="round" className="transition-all duration-300" />
                          </svg>
                          <span className="absolute text-blue-600 font-bold text-sm">{uploadProgress}%</span>
                        </div>
                      </div>
                    )}
                    <AnimatePresence>
                    {replyTo && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="mb-3 p-3 bg-slate-50 rounded-2xl flex items-center justify-between border-l-4 border-blue-500 min-w-0 overflow-hidden"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Reply size={16} className="text-blue-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-blue-600 uppercase">Ответ на</p>
                            <p className="text-xs text-slate-600 truncate">{replyTo.text ? (replyTo.text.length > 35 ? replyTo.text.slice(0, 35) + '...' : replyTo.text) : (replyTo.type === 'image' ? 'Фотография' : replyTo.type === 'video' ? 'Видео' : replyTo.type === 'game' ? 'Игра' : 'Файл')}</p>
                          </div>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-slate-200 rounded-full shrink-0 ml-2">
                          <X size={16} />
                        </button>
                      </motion.div>
                    )}

                    {editingMessage && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="mb-3 p-3 bg-blue-50 rounded-2xl flex items-center justify-between border-l-4 border-blue-500 min-w-0 overflow-hidden"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Edit2 size={16} className="text-blue-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-blue-600 uppercase">Редактирование</p>
                            <p className="text-xs text-slate-600 truncate">{editingMessage.text ? (editingMessage.text.length > 35 ? editingMessage.text.slice(0, 35) + '...' : editingMessage.text) : ''}</p>
                          </div>
                        </div>
                        <button onClick={() => { setEditingMessage(null); setInputText(''); }} className="p-1 hover:bg-slate-200 rounded-full shrink-0 ml-2">
                          <X size={16} />
                        </button>
                      </motion.div>
                    )}
                    </AnimatePresence>

                    <form onSubmit={handleSendMessage} className="flex items-end gap-2 min-w-0 px-2 pb-2">
                      <div 
                        className="flex-1 min-w-0 bg-slate-100 rounded-2xl flex items-end p-3 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 cursor-text min-h-[64px]"
                        onClick={() => messageInputRef.current?.focus()}
                      >
                        <div className="flex flex-col gap-1 items-center shrink-0 mr-1 py-1">
                          <button 
                            type="button"
                            onClick={() => setIsEncryptionEnabled(!isEncryptionEnabled)}
                            className={cn(
                              "p-2 rounded-xl transition-colors",
                              isEncryptionEnabled ? "bg-blue-500 text-white" : "hover:bg-slate-200 text-slate-500"
                            )}
                            title="Шифрование (Cipher)"
                          >
                            <Shield size={20} />
                          </button>
                          
                          {selectedChat.type === 'channel' && ['owner', 'admin'].includes((activeChatData as Group)?.memberRoles?.[user?.uid || ''] || '') && !activeThread && (
                            <button
                              type="button"
                              onClick={() => setPostAsMe(!postAsMe)}
                              className={cn(
                                "p-2 rounded-xl transition-colors",
                                postAsMe ? "bg-indigo-500 text-white" : "hover:bg-slate-200 text-slate-500"
                              )}
                              title={postAsMe ? "Публикация: От моего лица" : "Публикация: От лица канала"}
                            >
                              <UserIcon size={20} />
                            </button>
                          )}

                          {canSendMedia && (
                            <div className="relative">
                              <button 
                                ref={attachmentMenuButtonRef}
                                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                className="p-2 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors text-slate-500"
                                title="Прикрепить"
                              >
                                <Paperclip size={20} />
                              </button>
                              
                              <AnimatePresence>
                                {showAttachmentMenu && (
                                  <motion.div
                                    ref={attachmentMenuRef}
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                                  >
                                    <label className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors text-sm text-slate-700">
                                      <ImageIcon size={18} className="text-blue-500" />
                                      <span>Медиа / Файл</span>
                                      <input type="file" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                    <button 
                                      onClick={() => {
                                        setShowAttachmentMenu(false);
                                        setShowPollModal(true);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors text-sm text-slate-700 text-left"
                                    >
                                      <div className="w-[18px] h-[18px] flex items-center justify-center text-blue-500">📊</div>
                                      <span>Опрос</span>
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setShowAttachmentMenu(false);
                                        handleSendGame('tictactoe');
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors text-sm text-slate-700 text-left"
                                    >
                                      <Gamepad2 size={18} className="text-purple-500" />
                                      <span>Крестики-нолики</span>
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setShowAttachmentMenu(false);
                                        handleSendGame('words');
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors text-sm text-slate-700 text-left border-t border-slate-50"
                                    >
                                      <FileText size={18} className="text-orange-500" />
                                      <span>Игра в слова</span>
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                        <textarea 
                          ref={messageInputRef}
                          rows={1}
                          disabled={!canSendMessages}
                          onPaste={handlePaste}
                          placeholder={canSendMessages ? "Напишите сообщение..." : (((activeChatData as any)?.mutedMembers?.[user?.uid || ''] && Date.now() < (activeChatData as any).mutedMembers[user?.uid || '']) ? "Вы замучены ботом/админом" : "Отправка текста ограничена")} 
                          className="flex-1 w-full min-w-0 bg-transparent border-none focus:ring-0 text-sm py-3 px-2 resize-none max-h-32 overflow-y-auto"
                          value={inputText}
                          onChange={(e) => {
                            setInputText(e.target.value);
                            handleTyping();
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                          }}
                          onKeyDown={(e) => {
                            const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
                            if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />
                        <div className="flex items-center shrink-0 relative">
                          <button 
                            type="button" 
                            onClick={() => setShowStickersModal(true)}
                            className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500"
                            title="Стикеры"
                          >
                            <Smile size={20} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => addToast('Форматирование: **жирный**, *курсив*, ~~зачеркнутый~~, __подчеркнутый__', 'info')}
                            className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500"
                            title="Подсказка по форматированию"
                          >
                            <Info size={20} />
                          </button>
                        </div>
                      </div>
                      {inputText.trim() || editingMessage ? (
                        <div className="flex flex-col gap-1 relative">
                          <button 
                            type="button"
                            onClick={() => {
                              setScheduleDate('');
                              setShowScheduleModal(true);
                            }}
                            className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-2xl transition-all"
                            title="Отложенная отправка"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </button>
                          <button 
                            type="submit"
                            disabled={isSending || !canSendMessages}
                            className={cn(
                              "p-3 text-white rounded-2xl transition-all shadow-lg flex items-center justify-center min-h-[44px]",
                              isSending ? "bg-slate-400 animate-pulse" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                            )}
                          >
                            {isSending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={20} />}
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onPointerDown={(e) => { e.preventDefault(); startRecording(e); }}
                          onPointerMove={(e) => handleRecordingPointerMove(e)}
                          onTouchMove={(e) => handleRecordingPointerMove(e)}
                          onPointerUp={(e) => { e.preventDefault(); stopRecording(); }}
                          onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                          onPointerCancel={(e) => { e.preventDefault(); cancelRecording(); }}
                          disabled={isSending || !canSendMessages}
                          className={cn(
                            "p-4 text-white rounded-2xl transition-all shadow-lg select-none touch-none",
                            isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse scale-110" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                          )}
                          title="Удерживайте для записи. Свайп влево для отмены."
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                        </button>
                      )}
                    </form>
                    
                    {isRecording && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{ transform: `translateX(${Math.min(0, recordingDragX)}px)` }}
                        className="absolute bottom-[80px] left-1/2 -translate-x-1/2 z-[5000] flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl border border-slate-700 font-bold select-none transition-transform pointer-events-none"
                      >
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                        <span className="text-red-400 font-mono text-sm">
                          {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                        </span>
                        <div className="flex items-center gap-1 text-slate-300 text-xs font-normal ml-2 animate-pulse">
                          <ChevronLeft size={16} /> ‹‹‹ Свайп влево для отмены
                        </div>
                      </motion.div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
              <Send size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Выберите чат</h2>
            <p className="text-slate-500 max-w-xs">Выберите контакт или группу из списка слева, чтобы начать общение.</p>
          </div>
        )}
      </div>

      {/* Radar Overlay */}
      {showRadar && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 9999, 
            backgroundColor: '#020617', 
            display: 'flex', 
            flexDirection: 'column', 
            color: 'white' 
          }}
          className={cn(
            "pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]",
            window.innerWidth >= 1024 && "inset-y-0 right-0 left-auto w-[400px] border-l border-slate-800 shadow-2xl pt-0 pb-0"
          )}
        >
          <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setShowRadar(false);
                  setMobileView('list');
                }} 
                className="p-3 pl-4 -ml-3 rounded-r-2xl rounded-l-md hover:bg-white/10 active:bg-white/20 transition-all flex items-center gap-1 active:scale-95 text-white"
                title="Назад"
              >
                <ArrowLeft size={22} />
              </button>
              <h2 className="font-bold tracking-tight">Радар ({profile?.displayName || 'User'})</h2>
            </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(true);
                }}
                className="p-3 hover:bg-white/10 rounded-xl transition-colors active:scale-95"
                title="Настройки"
              >
                <Settings size={22} />
              </button>
          </div>
          
          <div className="p-6 bg-slate-900/50 border-b border-white/5 flex flex-col gap-3">
            <button 
              onClick={() => {
                const nextState = !isRadarActive;
                setIsRadarActive(nextState);
                if (nextState) {
                  if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        addToast(`Геолокация определена: ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`, 'success');
                      },
                      (err) => {
                        console.warn('Geolocation denied:', err);
                        addToast('Доступ к геолокации отклонен. Открываем настройки...', 'error');
                        openAppSettings();
                      },
                      { enableHighAccuracy: true, timeout: 8000 }
                    );
                  } else {
                    addToast('Геолокация не поддерживается устройством', 'error');
                  }
                }
              }}
              className={cn(
                "w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all shadow-lg border",
                isRadarActive 
                  ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" 
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
              )}
            >
              <RadarIcon size={20} className={cn(isRadarActive && "animate-pulse")} />
              {isRadarActive ? "ОСТАНОВИТЬ СКАНИРОВАНИЕ (Гео)" : "ЗАПУСТИТЬ СКАНИРОВАНИЕ (Гео)"}
            </button>

            <button 
              onClick={() => setShowMeshInspectorModal(true)}
              className="w-full py-3 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30"
            >
              <Radio size={18} />
              ИНСПЕКТОР И ДИАГНОСТИКА MESH
            </button>
          </div>
          
          <div className="flex-1 relative bg-[#020617] overflow-hidden">
            {(() => {
              try {
                if (!isRadarActive) {
                  return (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617] text-slate-500 gap-6 p-8 text-center">
                      <div className="relative">
                        <div className="w-32 h-32 rounded-full bg-slate-900/50 flex items-center justify-center border-2 border-dashed border-slate-800">
                          <RadarIcon size={64} className="text-slate-700" />
                        </div>
                        <div className="absolute -inset-4 border border-blue-500/10 rounded-full animate-[ping_4s_linear_infinite]" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-bold text-slate-300 uppercase tracking-[0.2em]">MESH_OFFLINE</p>
                        <p className="text-[10px] text-slate-500 font-mono">Активируйте сканирование для поиска узлов</p>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="w-full h-full relative bg-[#020617]">
                    <Radar 
                      nodes={radarNodes}
                      currentUserNodeId={user?.uid || profile?.uid || 'local_me'}
                      onNodeClick={(node) => {
                        selectChat({ type: 'user', id: node.id });
                        setShowRadar(false);
                      }}
                    />
                  </div>
                );
              } catch (e) {
                return <div className="p-8 text-red-400 text-xs font-mono bg-[#020617] h-full flex items-center justify-center text-center">
                  CRITICAL_UI_ERROR:<br/>{String(e)}
                </div>;
              }
            })()}
          </div>

          <div className="p-6 bg-slate-900 border-t border-white/5 shrink-0">
            <h3 className="font-bold text-blue-400 text-[10px] mb-3 uppercase tracking-widest flex items-center gap-2">
              <Shield size={12} /> СТАТУС ВАШЕГО УЗЛА (NODE_ID: {user?.uid?.substring(0, 8)})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <p className="text-[8px] text-slate-500 uppercase font-bold mb-1">Соседи (Direct)</p>
                <p className="text-lg font-mono text-emerald-400">{users.filter(u => u.status === 'online').length}</p>
              </div>
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <p className="text-[8px] text-slate-500 uppercase font-bold mb-1">Режим работы</p>
                <p className="text-xs font-bold text-blue-400 uppercase">{isRadarActive ? 'Активен' : 'Спящий'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {dangerousFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
            onClick={() => setDangerousFile(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Опасный файл!</h3>
                <p className="text-sm text-slate-600 mb-6">
                  Вы пытаетесь скачать файл ({dangerousFile.name}), который может навредить вашему устройству. 
                  Убедитесь, что вы доверяете отправителю. Мошенники могут использовать такие файлы для кражи данных.
                </p>
                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Проверка на самообладание</p>
                  <p className="text-sm text-slate-700 mb-3">Решите пример, чтобы продолжить:</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-bold text-lg">{captchaExpected - parseInt(captchaAnswer || '0') > 0 ? '?' : captchaExpected}</span>
                    <span className="text-slate-400">=</span>
                    <input 
                      type="number"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Ответ"
                      className="w-20 text-center bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDangerousFile(null)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                  >
                    Отмена
                  </button>
                  <button 
                    onClick={() => {
                      if (parseInt(captchaAnswer) === captchaExpected) {
                        const a = document.createElement('a');
                        a.href = dangerousFile.url;
                        a.download = dangerousFile.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setDangerousFile(null);
                      } else {
                        addToast('Неверный ответ', 'error');
                      }
                    }}
                    disabled={parseInt(captchaAnswer) !== captchaExpected}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Скачать
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConfirmModal && confirmConfig && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmConfig.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{confirmConfig.message}</p>
              </div>
              <div className="flex border-t border-slate-100">
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-6 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors border-r border-slate-100"
                >
                  ОТМЕНА
                </button>
                <button 
                  onClick={() => {
                    confirmConfig.onConfirm();
                    setShowConfirmModal(false);
                  }}
                  disabled={confirmTimer > 0}
                  className={cn(
                    "flex-1 px-6 py-4 text-sm font-bold transition-colors",
                    confirmTimer > 0 ? "text-slate-400 bg-slate-50 cursor-not-allowed" : "text-red-600 hover:bg-red-50"
                  )}
                >
                  ПОДТВЕРДИТЬ {confirmTimer > 0 && `(${confirmTimer})`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {textSelectForQuote && (
          <div 
            className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none"
            onClick={() => setTextSelectForQuote(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-lg">Выделите текст для цитаты</h3>
                <button 
                  onClick={() => setTextSelectForQuote(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar select-text selection:bg-blue-200">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {textSelectForQuote.text}
                </p>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
                <button
                  onClick={() => {
                    const sel = window.getSelection()?.toString();
                    if (!sel) {
                      addToast('Выделите текст!', 'error');
                      return;
                    }
                    setQuotingMessage({ msg: textSelectForQuote, text: sel });
                    setForwardSelectedChats([]);
                    setForwardComment('');
                    setTextSelectForQuote(null);
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Quote size={16} /> Далее (Выбрать чаты)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Media Viewer Modal */}
      <AnimatePresence>
        {selectedMediaIndex !== null && mediaMessages[selectedMediaIndex] && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-8"
              onClick={() => setSelectedMediaIndex(null)}
            >
              <div className="absolute top-4 right-4 flex items-center gap-4 z-10">
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    const url = mediaMessages[selectedMediaIndex].fileUrl;
                    if (!url) return;
                    
                    if (url.startsWith('firestore://')) {
                      const { getFileFromFirestore } = await import('./lib/fileStorage');
                      const fileId = url.replace('firestore://', '');
                      const fileData = await getFileFromFirestore(fileId);
                      if (fileData) {
                        const a = document.createElement('a');
                        a.href = fileData.url;
                        a.download = mediaMessages[selectedMediaIndex].fileName || 'media';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    } else {
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = mediaMessages[selectedMediaIndex].fileName || 'media';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
                >
                  <Download size={24} />
                </button>
                <button 
                  onClick={() => setSelectedMediaIndex(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
                >
                  <X size={24} />
                </button>
              </div>

              {selectedMediaIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMediaIndex(Math.max(0, selectedMediaIndex - 1));
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md z-10"
                >
                  <ChevronLeft size={32} />
                </button>
              )}

              {selectedMediaIndex < mediaMessages.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMediaIndex(Math.min(mediaMessages.length - 1, selectedMediaIndex + 1));
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md z-10"
                >
                  <ChevronRight size={32} />
                </button>
              )}
              
              <div 
                className="relative max-w-full max-h-full flex items-center justify-center cursor-default"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => {
                   if (e.deltaX > 0 && selectedMediaIndex < mediaMessages.length - 1) {
                      setSelectedMediaIndex(selectedMediaIndex + 1);
                   } else if (e.deltaX < 0 && selectedMediaIndex > 0) {
                      setSelectedMediaIndex(selectedMediaIndex - 1);
                   }
                }}
              >
                <FirestoreMedia 
                  url={mediaMessages[selectedMediaIndex].fileUrl!} 
                  type={mediaMessages[selectedMediaIndex].type as 'image' | 'video'}
                  fileName={mediaMessages[selectedMediaIndex].fileName}
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                  controls={true}
                  autoPlay={true}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GlobalVoiceBanner
        activeVoice={voicePlayer.activeVoice}
        isAccelerated={voicePlayer.isAccelerated}
        onPlayPause={() => {
          if (voicePlayer.activeVoice?.isPlaying) {
            voicePlayer.pauseVoice();
          } else {
            voicePlayer.resumeVoice();
          }
        }}
        onSeek={(time) => voicePlayer.seekVoice(time)}
        onClose={() => voicePlayer.closeBanner()}
      />

      <ImageCropperModal
        isOpen={cropModalInfo !== null}
        imageSrc={cropModalInfo?.src || ''}
        onClose={() => setCropModalInfo(null)}
        onCropComplete={(croppedBase64) => {
          if (cropModalInfo?.type === 'user') {
             setProfile(prev => prev ? { ...prev, photoURL: croppedBase64 } : null);
             socket?.emit('profile:update', { uid: user?.uid, profile: { photoURL: croppedBase64 } });
             setEditAvatar(croppedBase64);
             addToast('Аватар обновлен', 'success');
          } else if (cropModalInfo?.type === 'group' && cropModalInfo.groupId) {
             handleUpdateGroupSettings(cropModalInfo.groupId, { photoURL: croppedBase64 });
          }
          setCropModalInfo(null);
        }}
      />

      {showFullAvatar && (
        <div 
          className="fixed inset-0 z-[35000] bg-black/90 flex flex-col items-center justify-between cursor-pointer p-4 overflow-hidden select-none" 
          onClick={() => { setShowFullAvatar(null); setFullImgScale(1); setFullImgRotation(0); }}
        >
          {/* Top bar controls */}
          <div className="w-full flex items-center justify-between z-20 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-white/70 text-xs font-semibold px-2">Просмотр (нажмите вверху/вбоку для выхода)</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setFullImgScale(prev => Math.min(3, prev + 0.5))} 
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                title="Приблизить"
              >
                <Search size={18} />
              </button>
              <button 
                onClick={() => setFullImgScale(1)} 
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-xs font-bold"
                title="Сбросить масштаб"
              >
                1x
              </button>
              <button 
                onClick={() => setFullImgRotation(prev => (prev + 90) % 360)} 
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                title="Повернуть"
              >
                <RotateCw size={18} />
              </button>
              <button 
                onClick={() => saveMediaToDevice(showFullAvatar.src, 'image.jpg')} 
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                title="Скачать на устройство"
              >
                <Download size={18} />
              </button>
              <button 
                onClick={() => { setShowFullAvatar(null); setFullImgScale(1); setFullImgRotation(0); }} 
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                title="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Image */}
          <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden my-4" onClick={() => { setShowFullAvatar(null); setFullImgScale(1); setFullImgRotation(0); }}>
            <img 
              src={showFullAvatar.src} 
              alt="" 
              style={{ 
                transform: `scale(${fullImgScale}) rotate(${fullImgRotation}deg)`,
                transition: 'transform 0.2s ease-out'
              }}
              className="max-w-full max-h-[85vh] object-contain cursor-grab active:cursor-grabbing shadow-2xl rounded-lg" 
              onClick={(e) => e.stopPropagation()} 
              onDoubleClick={(e) => {
                e.stopPropagation();
                setFullImgScale(prev => prev === 1 ? 2.5 : 1);
              }}
              referrerPolicy="no-referrer" 
            />
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4 px-2" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-sm">Запланировать отправку</h2>
              <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-sm">
              <label className="block font-bold text-slate-700 mb-2">Выберите дату и время</label>
              <input 
                type="datetime-local" 
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                max={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-2">До 24 часов вперед. Если прикреплен файл, он должен быть не больше 15 МБ.</p>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button 
                onClick={() => {
                  if (scheduleDate) {
                    setShowScheduleModal(false);
                    // trigger send directly over socket
                    handleSendMessage(undefined, new Date(scheduleDate).toISOString());
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors"
                disabled={!scheduleDate}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {profile && (
        <MeshInspectorModal
          isOpen={showMeshInspectorModal}
          onClose={() => setShowMeshInspectorModal(false)}
          nodes={radarNodes}
          currentUser={profile}
          onSendTestPacket={(targetId) => {
            addToast(`Тестовый Mesh-пакет отправлен узлу ${targetId.substring(0, 8)}`, 'info');
            playSentMessageSound();
          }}
        />
      )}

      <NotificationSettingsModal
        isOpen={showNotificationSettingsModal}
        onClose={() => setShowNotificationSettingsModal(false)}
        addToast={addToast}
      />

      {showMultiDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowMultiDeleteModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Удаление сообщений</h3>
              <button onClick={() => setShowMultiDeleteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Выбрано сообщений: <span className="font-bold text-slate-800">{selectedMsgIds.length}</span>. Выберите действие:
            </p>

            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Отложенный таймер удаления:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Сразу', ms: 0 },
                  { label: '5 сек', ms: 5000 },
                  { label: '10 сек', ms: 10000 },
                  { label: '30 сек', ms: 30000 },
                ].map((opt) => (
                  <button
                    key={opt.ms}
                    type="button"
                    onClick={() => setDeleteTimerDelay(opt.ms)}
                    className={cn(
                      "py-1.5 px-2 rounded-xl text-xs font-bold transition-all border",
                      deleteTimerDelay === opt.ms
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 space-y-2 flex flex-col">
              <button
                type="button"
                onClick={() => {
                  selectedMsgIds.forEach(id => deleteMessage(id, false, deleteTimerDelay));
                  setSelectedMsgIds([]);
                  setIsSelectionMode(false);
                  setShowMultiDeleteModal(false);
                  addToast(deleteTimerDelay > 0 ? `Сообщения будут удалены через ${deleteTimerDelay / 1000} сек` : 'Сообщения удалены у вас', 'info');
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} /> Удалить для себя
              </button>

              {(() => {
                const selectedMsgs = messages.filter(m => selectedMsgIds.includes(m.id));
                const canDeleteAllForEveryone = selectedMsgs.length > 0 && selectedMsgs.every(m => canDeleteForEveryoneState(m));
                if (!canDeleteAllForEveryone) return null;

                return (
                  <button
                    type="button"
                    onClick={() => {
                      selectedMsgIds.forEach(id => deleteMessage(id, true, deleteTimerDelay));
                      setSelectedMsgIds([]);
                      setIsSelectionMode(false);
                      setShowMultiDeleteModal(false);
                      addToast(deleteTimerDelay > 0 ? `Сообщения будут удалены для всех через ${deleteTimerDelay / 1000} сек` : 'Сообщения удалены для всех', 'info');
                    }}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> Удалить для всех
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => setShowMultiDeleteModal(false)}
                className="w-full py-2 px-4 text-slate-500 hover:text-slate-700 font-medium text-xs text-center transition-colors mt-1"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Highest priority Toasts container on top of all modals and overlays */}
      <ToastsContainer toasts={toasts} />

    </div>
  </div>
);
}
