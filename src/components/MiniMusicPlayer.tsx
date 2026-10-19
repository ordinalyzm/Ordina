import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, Disc, X, Maximize2 } from 'lucide-react';
import { MusicTrack } from '../types';

interface MiniMusicPlayerProps {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onPrevTrack?: () => void;
  onNextTrack: () => void;
  onOpenFullPlayer: () => void;
  onStop: () => void;
}

export const MiniMusicPlayer: React.FC<MiniMusicPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onOpenFullPlayer,
  onStop
}) => {
  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-88 z-[80] bg-slate-900/95 text-white backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 flex items-center justify-between gap-3 select-none"
    >
      {/* Progress line along top border */}
      <div className="absolute top-0 left-3 right-3 h-0.5 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Track Info (clickable to open modal) */}
      <div 
        onClick={onOpenFullPlayer}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center text-white shrink-0 overflow-hidden shadow-md">
          {currentTrack.coverUrl ? (
            <img src={currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Disc size={20} className={isPlaying ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
            {currentTrack.title}
          </h4>
          <p className="text-[10px] text-slate-400 truncate">
            {currentTrack.artist}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {onPrevTrack && (
          <button
            onClick={onPrevTrack}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors hidden xs:block"
            title="Предыдущий трек"
          >
            <SkipBack size={15} />
          </button>
        )}

        <button
          onClick={onTogglePlay}
          className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-red-600/30"
          title={isPlaying ? 'Пауза' : 'Воспроизведение'}
        >
          {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current translate-x-0.5" />}
        </button>

        <button
          onClick={onNextTrack}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          title="Следующий трек"
        >
          <SkipForward size={16} />
        </button>

        <button
          onClick={onOpenFullPlayer}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          title="Развернуть на весь экран"
        >
          <Maximize2 size={15} />
        </button>

        <button
          onClick={onStop}
          className="p-1 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
          title="Остановить и закрыть"
        >
          <X size={15} />
        </button>
      </div>
    </motion.div>
  );
};

export default MiniMusicPlayer;
