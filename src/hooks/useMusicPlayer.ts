import { useState, useEffect, useRef, useCallback } from 'react';
import { MusicTrack } from '../types';
import { getFileFromFirestore } from '../lib/fileStorage';
import { safeLocalStorageSet } from '../utils/safeStorage';

// Fisher-Yates Shuffle
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function useMusicPlayer() {
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [playlist, setPlaylist] = useState<MusicTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'sequential' | 'shuffle'>('sequential');
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [volume, setVolumeState] = useState(() => {
    try {
      const saved = localStorage.getItem('ordina_music_volume');
      return saved ? parseFloat(saved) : 0.85;
    } catch {
      return 0.85;
    }
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1.0);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);

  // "Моя волна" (My Wave) state
  const [isWaveMode, setIsWaveMode] = useState(false);
  const [waveMood, setWaveMood] = useState<string>('all');
  const wavePoolRef = useRef<MusicTrack[]>([]);

  // Strict non-repeating shuffle queue
  const shuffleQueueRef = useRef<string[]>([]);
  const shuffleIndexRef = useRef<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Change playback speed
  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  // Sleep timer helper
  const setSleepTimer = useCallback((minutes: number | null) => {
    if (minutes === null || minutes <= 0) {
      setSleepTimerRemaining(null);
      return;
    }
    setSleepTimerRemaining(Math.round(minutes * 60));
  }, []);

  useEffect(() => {
    if (sleepTimerRemaining === null) return;
    if (sleepTimerRemaining <= 0) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      setSleepTimerRemaining(null);
      return;
    }
    const timer = setInterval(() => {
      setSleepTimerRemaining(prev => {
        if (prev === null || prev <= 1) {
          if (audioRef.current) audioRef.current.pause();
          setIsPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sleepTimerRemaining]);

  // Initialize Audio element once and attach to DOM
  useEffect(() => {
    let audio = document.getElementById('ordina-music-audio') as HTMLAudioElement | null;
    let created = false;
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'ordina-music-audio';
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      (audio as any).preservesPitch = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      created = true;
    }
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio) setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      if (audio) setDuration(audio.duration || 0);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const onError = (e: any) => {
      console.warn('Audio playback error on track:', audio?.src, e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    // Keep background audio active when screen turns off or user switches apps
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (audio && !audio.paused) {
          // Keep active
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (audio) {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('error', onError);
        audio.pause();
        audio.src = '';
        if (created && audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      }
    };
  }, []);

  // Update volume
  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    safeLocalStorageSet('ordina_music_volume', clamped.toString());
  }, []);

  // Seek
  const seek = useCallback((time: number) => {
    if (audioRef.current && !isNaN(time)) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Generate non-repeating shuffle queue for current playlist
  const regenerateShuffleQueue = useCallback((tracks: MusicTrack[], currentId?: string) => {
    if (tracks.length === 0) {
      shuffleQueueRef.current = [];
      shuffleIndexRef.current = 0;
      return;
    }

    const ids = tracks.map(t => t.id);
    let shuffled = shuffleArray(ids);

    // If currentId is provided, place it at the front so it doesn't replay immediately
    if (currentId && shuffled.includes(currentId)) {
      shuffled = shuffled.filter(id => id !== currentId);
      shuffled.unshift(currentId);
    }

    shuffleQueueRef.current = shuffled;
    shuffleIndexRef.current = 0;
  }, []);

  // Play a specific track
  const playTrack = useCallback(async (track: MusicTrack, newPlaylist?: MusicTrack[]) => {
    const activePlaylist = newPlaylist && newPlaylist.length > 0 ? newPlaylist : playlist.length > 0 ? playlist : [track];
    setPlaylist(activePlaylist);
    setCurrentTrack(track);

    if (playbackMode === 'shuffle') {
      regenerateShuffleQueue(activePlaylist, track.id);
    }

    // Safely extract audio URL
    const rawUrl = track.fileUrl || (track as any).url || (track as any).audioUrl || (track as any).audio || '';
    let resolvedUrl = typeof rawUrl === 'string' ? rawUrl : '';

    if (resolvedUrl) {
      if (resolvedUrl.startsWith('firestore://')) {
        const fileId = resolvedUrl.replace('firestore://', '');
        const fileData = await getFileFromFirestore(fileId);
        if (fileData) {
          resolvedUrl = fileData.url;
        }
      } else if (!resolvedUrl.includes('/') && !resolvedUrl.startsWith('http') && !resolvedUrl.startsWith('data:') && !resolvedUrl.startsWith('blob:')) {
        const fileData = await getFileFromFirestore(resolvedUrl);
        if (fileData) {
          resolvedUrl = fileData.url;
        }
      }
    }

    if (resolvedUrl && audioRef.current) {
      audioRef.current.src = resolvedUrl;
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().catch(e => {
        console.warn('Audio play error (user gesture may be required):', e);
      });
    }
  }, [playbackMode, playlist, regenerateShuffleQueue, volume, playbackSpeed]);

  // Next Track logic
  const nextTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return;

    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    // "Моя волна" mode: infinite flow of vibe matching tracks
    if (isWaveMode && wavePoolRef.current.length > 0) {
      const pool = wavePoolRef.current.filter(t => t.id !== currentTrack.id);
      const candidates = pool.length > 0 ? pool : wavePoolRef.current;
      const randomIdx = Math.floor(Math.random() * candidates.length);
      const nextT = candidates[randomIdx];
      if (nextT) {
        playTrack(nextT, playlist);
        return;
      }
    }

    if (playbackMode === 'shuffle') {
      const queue = shuffleQueueRef.current;
      let nextIdx = shuffleIndexRef.current + 1;

      if (nextIdx >= queue.length) {
        if (repeatMode === 'off') {
          if (audioRef.current) audioRef.current.pause();
          setIsPlaying(false);
          return;
        }
        regenerateShuffleQueue(playlist);
        nextIdx = 0;
      }

      shuffleIndexRef.current = nextIdx;
      const nextId = shuffleQueueRef.current[nextIdx];
      const nextT = playlist.find(t => t.id === nextId);
      if (nextT) {
        playTrack(nextT, playlist);
      }
    } else {
      // Sequential mode
      const currentIdx = playlist.findIndex(t => t.id === currentTrack.id);
      let nextIdx = currentIdx + 1;

      if (nextIdx >= playlist.length) {
        if (repeatMode === 'off') {
          if (audioRef.current) audioRef.current.pause();
          setIsPlaying(false);
          return;
        }
        nextIdx = 0;
      }

      const nextT = playlist[nextIdx];
      if (nextT) {
        playTrack(nextT, playlist);
      }
    }
  }, [currentTrack, playlist, repeatMode, playbackMode, playTrack, regenerateShuffleQueue, isWaveMode]);

  // Previous Track logic
  const prevTrack = useCallback(() => {
    if (!currentTrack || playlist.length === 0) return;

    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (playbackMode === 'shuffle') {
      const queue = shuffleQueueRef.current;
      let prevIdx = shuffleIndexRef.current - 1;
      if (prevIdx < 0) prevIdx = Math.max(0, queue.length - 1);
      shuffleIndexRef.current = prevIdx;

      const prevId = queue[prevIdx];
      const prevT = playlist.find(t => t.id === prevId);
      if (prevT) playTrack(prevT, playlist);
    } else {
      const currentIdx = playlist.findIndex(t => t.id === currentTrack.id);
      let prevIdx = currentIdx - 1;
      if (prevIdx < 0) prevIdx = playlist.length - 1;

      const prevT = playlist[prevIdx];
      if (prevT) playTrack(prevT, playlist);
    }
  }, [currentTrack, currentTime, playbackMode, playlist, playTrack]);

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTrack) {
        audioRef.current.play().catch(e => {
          console.warn('Audio play failed:', e);
        });
      } else if (playlist.length > 0) {
        playTrack(playlist[0], playlist);
      }
    }
  }, [isPlaying, currentTrack, playlist, playTrack]);

  // Stop & clear
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // Queue manipulation functions
  const addToQueue = useCallback((track: MusicTrack, playNext: boolean = false) => {
    setPlaylist(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      if (playNext && currentTrack) {
        const curIdx = filtered.findIndex(t => t.id === currentTrack.id);
        if (curIdx !== -1) {
          const next = [...filtered];
          next.splice(curIdx + 1, 0, track);
          return next;
        }
      }
      return [...filtered, track];
    });
  }, [currentTrack]);

  const removeFromQueue = useCallback((trackId: string) => {
    setPlaylist(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const reorderQueue = useCallback((newTracks: MusicTrack[]) => {
    setPlaylist(newTracks);
  }, []);

  const clearQueue = useCallback(() => {
    if (currentTrack) {
      setPlaylist([currentTrack]);
    } else {
      setPlaylist([]);
    }
  }, [currentTrack]);

  // Start "Моя волна"
  const startMyWave = useCallback((allAvailableTracks: MusicTrack[], mood: string = 'all') => {
    setIsWaveMode(true);
    setWaveMood(mood);

    let filtered = [...allAvailableTracks];
    if (mood === 'relax') {
      filtered = filtered.filter(t => t.genre === 'Lo-Fi' || t.genre === 'Инди' || t.genre === 'Классика');
    } else if (mood === 'energy') {
      filtered = filtered.filter(t => t.genre === 'Рок' || t.genre === 'Электроника' || t.genre === 'Фонк');
    } else if (mood === 'drive') {
      filtered = filtered.filter(t => t.genre === 'Электроника' || t.genre === 'Фонк');
    }

    if (filtered.length === 0) filtered = allAvailableTracks;

    wavePoolRef.current = filtered;
    setPlaybackMode('shuffle');

    const randomIdx = Math.floor(Math.random() * filtered.length);
    const startT = filtered[randomIdx] || allAvailableTracks[0];
    if (startT) {
      playTrack(startT, filtered);
    }
  }, [playTrack]);

  const stopMyWave = useCallback(() => {
    setIsWaveMode(false);
  }, []);

  // Automatically advance to next track when playback ends
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      nextTrack();
    };

    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
    };
  }, [nextTrack]);

  return {
    currentTrack,
    playlist,
    isPlaying,
    playbackMode,
    repeatMode,
    volume,
    currentTime,
    duration,
    playbackSpeed,
    sleepTimerRemaining,
    isWaveMode,
    waveMood,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    setPlaybackMode,
    setRepeatMode,
    setPlaybackSpeed,
    setSleepTimer,
    stop,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    startMyWave,
    stopMyWave
  };
}
