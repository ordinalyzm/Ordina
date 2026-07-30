import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Volume2, Mic, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface ActiveVoiceState {
  msgId: string;
  fileUrl: string;
  senderName: string;
  senderAvatar?: string;
  title: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isEnded: boolean;
  playbackRate: number;
}

interface VoicePlayerContextType {
  activeVoice: ActiveVoiceState | null;
  playVoice: (msg: { id: string; fileUrl: string; senderName: string; senderAvatar?: string; createdAt: string }) => void;
  pauseVoice: () => void;
  resumeVoice: () => void;
  seekVoice: (time: number) => void;
  closeBanner: () => void;
  isAccelerated: boolean;
}

// Global Audio Controller instance singleton
let globalAudio: HTMLAudioElement | null = null;
let activeSetStateFn: ((updater: (prev: ActiveVoiceState | null) => ActiveVoiceState | null) => void) | null = null;

export function useVoicePlayer() {
  const [activeVoice, setActiveVoice] = useState<ActiveVoiceState | null>(null);
  const [isAccelerated, setIsAccelerated] = useState(false);

  useEffect(() => {
    activeSetStateFn = setActiveVoice;
    return () => {
      activeSetStateFn = null;
    };
  }, []);

  // Global 2x speed press listener on right side of screen or player
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!globalAudio || globalAudio.paused) return;
      const target = e.target as HTMLElement;
      const isRightSide = e.clientX > window.innerWidth * 0.5;
      const isVoiceElement = target.closest('[data-voice-player="true"]');

      if (isRightSide || isVoiceElement) {
        setIsAccelerated(true);
        globalAudio.playbackRate = 2.0;
        setActiveVoice(prev => prev ? { ...prev, playbackRate: 2.0 } : null);
      }
    };

    const handlePointerUp = () => {
      if (!globalAudio) return;
      setIsAccelerated(false);
      globalAudio.playbackRate = 1.0;
      setActiveVoice(prev => prev ? { ...prev, playbackRate: 1.0 } : null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const resolveAudioUrl = async (url: string): Promise<string> => {
    if (url.startsWith('firestore://')) {
      try {
        const { getFileFromFirestore } = await import('../lib/fileStorage');
        const fileId = url.replace('firestore://', '');
        const data = await getFileFromFirestore(fileId);
        if (data && data.url) return data.url;
      } catch (e) {
        console.error('Error resolving firestore audio URL:', e);
      }
    }
    return url;
  };

  const playVoice = async (msg: { id: string; fileUrl: string; senderName: string; senderAvatar?: string; createdAt: string }) => {
    const timeFormatted = msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm', { locale: ru }) : '';
    const titleStr = `Голосовое — ${timeFormatted || 'сейчас'}`;

    if (activeVoice?.msgId === msg.id && globalAudio) {
      if (globalAudio.paused) {
        globalAudio.play().catch(console.error);
        setActiveVoice(prev => prev ? { ...prev, isPlaying: true, isEnded: false } : null);
      } else {
        globalAudio.pause();
        setActiveVoice(prev => prev ? { ...prev, isPlaying: false } : null);
      }
      return;
    }

    if (globalAudio) {
      globalAudio.pause();
      globalAudio.src = '';
    }

    const realUrl = await resolveAudioUrl(msg.fileUrl);
    const audio = new Audio(realUrl);
    globalAudio = audio;

    const initialState: ActiveVoiceState = {
      msgId: msg.id,
      fileUrl: realUrl,
      senderName: msg.senderName,
      senderAvatar: msg.senderAvatar,
      title: titleStr,
      duration: 0,
      currentTime: 0,
      isPlaying: false,
      isEnded: false,
      playbackRate: 1.0,
    };

    setActiveVoice(initialState);

    audio.onloadedmetadata = () => {
      setActiveVoice(prev => prev ? { ...prev, duration: audio.duration || 0 } : null);
    };

    audio.ontimeupdate = () => {
      setActiveVoice(prev => prev ? {
        ...prev,
        currentTime: audio.currentTime || 0,
        duration: audio.duration || prev.duration || 0,
      } : null);
    };

    audio.onended = () => {
      // Keep top banner visible when ended until user clicks cross button ('X')
      setActiveVoice(prev => prev ? {
        ...prev,
        isPlaying: false,
        isEnded: true,
        currentTime: audio.duration || prev.duration || 0,
      } : null);
    };

    audio.onplay = () => {
      setActiveVoice(prev => prev ? { ...prev, isPlaying: true, isEnded: false } : null);
    };

    audio.onpause = () => {
      setActiveVoice(prev => prev ? { ...prev, isPlaying: false } : null);
    };

    try {
      await audio.play();
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  };

  const pauseVoice = () => {
    if (globalAudio) {
      globalAudio.pause();
    }
  };

  const resumeVoice = () => {
    if (globalAudio) {
      if (globalAudio.ended) {
        globalAudio.currentTime = 0;
      }
      globalAudio.play().catch(console.error);
    }
  };

  const seekVoice = (time: number) => {
    if (globalAudio) {
      globalAudio.currentTime = time;
      setActiveVoice(prev => prev ? { ...prev, currentTime: time } : null);
    }
  };

  const closeBanner = () => {
    if (globalAudio) {
      globalAudio.pause();
      globalAudio.src = '';
      globalAudio = null;
    }
    setActiveVoice(null);
  };

  return {
    activeVoice,
    playVoice,
    pauseVoice,
    resumeVoice,
    seekVoice,
    closeBanner,
    isAccelerated,
  };
}

export function VoiceBubbleWidget({
  msg,
  isMe,
  activeVoice,
  onPlay,
  onSeek,
  isAccelerated,
}: {
  msg: { id: string; fileUrl?: string; createdAt: string; text?: string };
  isMe: boolean;
  activeVoice: ActiveVoiceState | null;
  onPlay: () => void;
  onSeek: (time: number) => void;
  isAccelerated?: boolean;
}) {
  const isThisActive = activeVoice?.msgId === msg.id;
  const isPlaying = isThisActive && activeVoice.isPlaying;
  const currentTime = isThisActive ? activeVoice.currentTime : 0;
  const duration = isThisActive ? activeVoice.duration : 0;
  const playbackRate = isThisActive ? (activeVoice.playbackRate || 1) : 1;

  const formatSecs = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      data-voice-player="true"
      className={`my-1 p-3 rounded-2xl flex items-center gap-3 select-none transition-all ${
        isMe ? 'bg-blue-700/60 text-white' : 'bg-slate-100 text-slate-800'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 ${
          isMe ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
      </button>

      <div className="flex-1 min-w-[160px] sm:min-w-[200px]">
        {/* Scrubber & Waveform lines */}
        <div className="relative h-6 flex items-center group cursor-pointer" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(1, clickX / rect.width));
          if (duration > 0) onSeek(pct * duration);
        }}>
          {/* Waveform visual bars */}
          <div className="w-full h-4 flex items-center justify-between gap-[2px]">
            {Array.from({ length: 28 }).map((_, i) => {
              const barHeightPct = Math.sin(i * 0.7 + (isMe ? 2 : 1)) * 35 + 50;
              const barProgressPct = (i / 28) * 100;
              const isFilled = barProgressPct <= progressPercent;
              return (
                <div
                  key={i}
                  style={{ height: `${barHeightPct}%` }}
                  className={`w-[3px] rounded-full transition-all ${
                    isFilled
                      ? isMe ? 'bg-white' : 'bg-blue-600'
                      : isMe ? 'bg-blue-400/50' : 'bg-slate-300'
                  } ${isPlaying ? 'animate-pulse' : ''}`}
                />
              );
            })}
          </div>

          {/* Scrub Range Input overlay */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Time and Speed indicator */}
        <div className="flex items-center justify-between text-[11px] font-medium opacity-80 mt-1">
          <span>{formatSecs(currentTime)} / {duration > 0 ? formatSecs(duration) : '0:00'}</span>
          {(playbackRate > 1 || isAccelerated) && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded-full animate-bounce">
              <Zap size={10} className="fill-current" /> 2X
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function GlobalVoiceBanner({
  activeVoice,
  onPlayPause,
  onSeek,
  onClose,
  isAccelerated,
}: {
  activeVoice: ActiveVoiceState | null;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onClose: () => void;
  isAccelerated?: boolean;
}) {
  if (!activeVoice) return null;

  const formatSecs = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = activeVoice.duration > 0 ? (activeVoice.currentTime / activeVoice.duration) * 100 : 0;
  const rate = activeVoice.playbackRate || 1;

  return (
    <div
      data-voice-player="true"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[9000] w-[92%] max-w-md bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-slate-700/60 transition-all select-none animate-slide-down"
    >
      <div className="flex items-center gap-3">
        {/* Avatar / Voice icon */}
        <div className="relative shrink-0">
          {activeVoice.senderAvatar ? (
            <img src={activeVoice.senderAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-700" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              <Mic size={18} />
            </div>
          )}
          {activeVoice.isPlaying && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-ping" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold truncate text-slate-100">{activeVoice.senderName || 'Голосовое сообщение'}</h4>
            {(rate > 1 || isAccelerated) && (
              <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Zap size={10} className="fill-current" /> 2X
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 truncate">{activeVoice.title}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onPlayPause}
            className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-md"
            title={activeVoice.isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {activeVoice.isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-0.5" />}
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            title="Закрыть плашку"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress timeline scrubber */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{formatSecs(activeVoice.currentTime)}</span>
        <div
          className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            if (activeVoice.duration > 0) onSeek(pct * activeVoice.duration);
          }}
        >
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-blue-500 group-hover:bg-blue-400 transition-all rounded-full"
          />
        </div>
        <span className="text-[10px] font-mono text-slate-400 w-8">{formatSecs(activeVoice.duration)}</span>
      </div>
    </div>
  );
}
