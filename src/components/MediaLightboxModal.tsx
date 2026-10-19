// src/components/MediaLightboxModal.tsx
// Telegram-grade Media Viewer with pinch-to-zoom, double-tap zoom, swipe-to-dismiss, and horizontal swipe
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Download, ChevronLeft, ChevronRight, Share2, 
  RotateCcw, Play, Pause, Volume2, VolumeX, Maximize2, User
} from 'lucide-react';
import { Message } from '../types';
import { FirestoreMedia } from '../lib/FirestoreMedia';

interface MediaLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaList: Message[];
  currentIndex: number;
  onIndexChange: (newIndex: number) => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  isOpen,
  onClose,
  mediaList,
  currentIndex,
  onIndexChange,
}) => {
  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Swipe to dismiss state (Telegram vertical drag)
  const [dismissOffsetY, setDismissOffsetY] = useState(0);
  const [isSwipingDismiss, setIsSwipingDismiss] = useState(false);

  // Horizontal swipe between items
  const [horizontalSwipeDelta, setHorizontalSwipeDelta] = useState(0);

  // Chrome visibility (Telegram tap to hide header & footer)
  const [showChrome, setShowChrome] = useState(true);

  // Video state
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // References
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const lastTapTimeRef = useRef<number>(0);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMultiTouchRef = useRef(false);

  const currentMsg = mediaList[currentIndex];

  // Reset transforms when item changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setDismissOffsetY(0);
    setHorizontalSwipeDelta(0);
    setIsSwipingDismiss(false);
    setShowChrome(true);
  }, [currentIndex, isOpen]);

  // Keyboard navigation & Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentIndex < mediaList.length - 1) {
        onIndexChange(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
      } else if (e.code === 'Space' && isVideo) {
        e.preventDefault();
        toggleVideoPlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, mediaList.length, onIndexChange, onClose]);

  if (!isOpen || !currentMsg) return null;

  const isVideo = currentMsg.type === 'video' || 
    /\.(mp4|mov|webm)$/i.test(currentMsg.fileUrl || '') || 
    /\.(mp4|mov|webm)$/i.test(currentMsg.fileName || '');

  // Toggle Video Play / Pause
  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  // Double tap to zoom (1x -> 2.5x -> 1x)
  const handleDoubleTap = (clientX: number, clientY: number) => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
      // Center slightly on tapped point
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const offsetX = (centerX - clientX) * 0.8;
      const offsetY = (centerY - clientY) * 0.8;
      setPosition({ x: offsetX, y: offsetY });
    }
  };

  // Touch handlers (Multi-touch pinch, Pan, Swipe-to-dismiss, Horizontal swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers = Pinch zoom
      isMultiTouchRef.current = true;
      setIsSwipingDismiss(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      isMultiTouchRef.current = false;
      const touch = e.touches[0];
      const now = Date.now();

      // Check double tap (< 300ms)
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleTap(touch.clientX, touch.clientY);
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now
      };

      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: touch.clientX - position.x,
          y: touch.clientY - position.y
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Two fingers: Pinch Zoom
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / pinchStartDistRef.current;
      const nextScale = Math.min(Math.max(pinchStartScaleRef.current * factor, 0.85), 5);
      setScale(nextScale);
      return;
    }

    // Single finger:
    if (e.touches.length === 1 && touchStartRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // When zoomed in: Pan around
      if (scale > 1 && isDragging) {
        const maxPanX = (scale - 1) * (window.innerWidth / 2);
        const maxPanY = (scale - 1) * (window.innerHeight / 2);
        const newX = touch.clientX - dragStartRef.current.x;
        const newY = touch.clientY - dragStartRef.current.y;
        setPosition({
          x: Math.min(Math.max(newX, -maxPanX), maxPanX),
          y: Math.min(Math.max(newY, -maxPanY), maxPanY)
        });
        return;
      }

      // When scale === 1: Telegram Swipe-to-dismiss (vertical) or Swipe to next (horizontal)
      if (scale === 1 && !isMultiTouchRef.current) {
        // Decide direction: mostly vertical or horizontal
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
          setIsSwipingDismiss(true);
          setDismissOffsetY(deltaY);
        } else if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
          setHorizontalSwipeDelta(deltaX);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistRef.current = null;
      // Spring back to 1 if pinched smaller
      if (scale < 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    }

    if (e.touches.length === 0) {
      setIsDragging(false);

      // Evaluate Swipe-to-Dismiss
      if (isSwipingDismiss) {
        if (Math.abs(dismissOffsetY) > 90) {
          // Dismiss modal!
          onClose();
        } else {
          // Spring back
          setDismissOffsetY(0);
          setIsSwipingDismiss(false);
        }
      }

      // Evaluate Horizontal Swipe navigation
      if (Math.abs(horizontalSwipeDelta) > 60) {
        if (horizontalSwipeDelta < 0 && currentIndex < mediaList.length - 1) {
          onIndexChange(currentIndex + 1);
        } else if (horizontalSwipeDelta > 0 && currentIndex > 0) {
          onIndexChange(currentIndex - 1);
        }
      }
      setHorizontalSwipeDelta(0);
      touchStartRef.current = null;
    }
  };

  // Mouse wheel zoom or swipe
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || scale > 1) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      setScale(prev => {
        const next = Math.min(Math.max(prev + delta, 1), 5);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    } else {
      if (e.deltaX > 40 && currentIndex < mediaList.length - 1) {
        onIndexChange(currentIndex + 1);
      } else if (e.deltaX < -40 && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
      }
    }
  };

  // Download media
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = currentMsg.fileUrl;
    if (!url) return;

    try {
      if (url.startsWith('firestore://')) {
        const { getFileFromFirestore } = await import('../lib/fileStorage');
        const fileId = url.replace('firestore://', '');
        const fileData = await getFileFromFirestore(fileId);
        if (fileData) {
          const a = document.createElement('a');
          a.href = fileData.url;
          a.download = currentMsg.fileName || (isVideo ? 'video.mp4' : 'photo.jpg');
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = currentMsg.fileName || (isVideo ? 'video.mp4' : 'photo.jpg');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Share media
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share && currentMsg.fileUrl) {
      try {
        await navigator.share({
          title: currentMsg.fileName || 'Медиафайл из Ордина',
          url: currentMsg.fileUrl
        });
      } catch (err) {}
    } else {
      navigator.clipboard?.writeText(currentMsg.fileUrl || '');
    }
  };

  // Calculate dynamic backdrop opacity based on vertical dismiss drag
  const dismissProgress = Math.min(Math.abs(dismissOffsetY) / 300, 1);
  const backdropOpacity = Math.max(0.15, 1 - dismissProgress * 0.85);
  const imageScaleDuringDismiss = Math.max(0.85, 1 - dismissProgress * 0.25);

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[20000] flex flex-col justify-between select-none touch-none overflow-hidden"
        style={{ backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }}
        onWheel={handleWheel}
      >
        {/* ======================================================== */}
        {/* 1. TELEGRAM-STYLE TOP HEADER BAR                         */}
        {/* ======================================================== */}
        <AnimatePresence>
          {showChrome && (
            <motion.div 
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -60, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 pt-[calc(10px+env(safe-area-inset-top,0px))] flex items-center justify-between z-30 bg-gradient-to-b from-black/85 via-black/50 to-transparent"
              onClick={e => e.stopPropagation()}
            >
              {/* Sender Info & Date (Telegram signature header) */}
              <div className="flex items-center gap-3 text-white min-w-0 flex-1">
                <button
                  onClick={onClose}
                  className="p-2 -ml-2 rounded-full hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                  title="Закрыть"
                >
                  <X size={22} />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white truncate">
                      {currentMsg.senderName || 'Пользователь'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 bg-white/10 px-2 py-0.5 rounded-full shrink-0">
                      {currentIndex + 1} из {mediaList.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentMsg.createdAt 
                      ? new Date(currentMsg.createdAt).toLocaleString('ru-RU', { 
                          day: 'numeric', 
                          month: 'long', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) 
                      : ''}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-95"
                  title="Поделиться"
                >
                  <Share2 size={18} />
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-95"
                  title="Скачать на устройство"
                >
                  <Download size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================== */}
        {/* 2. MEDIA CANVAS WITH PINCH, PAN & TELEGRAM DISMISS       */}
        {/* ======================================================== */}
        <div 
          className="relative flex-1 flex items-center justify-center p-0 sm:p-4 overflow-hidden touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setShowChrome(prev => !prev)}
        >
          {/* Arrow Left (Desktop or tablets) */}
          {currentIndex > 0 && scale === 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(currentIndex - 1);
              }}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md z-20 items-center justify-center"
              title="Предыдущее"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Arrow Right (Desktop or tablets) */}
          {currentIndex < mediaList.length - 1 && scale === 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(currentIndex + 1);
              }}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md z-20 items-center justify-center"
              title="Следующее"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* Transformable Media Viewport */}
          <div
            className="flex items-center justify-center max-w-full max-h-full origin-center transition-transform"
            style={{
              transform: `translate(${position.x + horizontalSwipeDelta}px, ${position.y + dismissOffsetY}px) scale(${scale * (isSwipingDismiss ? imageScaleDuringDismiss : 1)})`,
              transition: isDragging || isSwipingDismiss || horizontalSwipeDelta !== 0 || pinchStartDistRef.current !== null 
                ? 'none' 
                : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {isVideo ? (
              <div className="relative group max-h-[85vh] max-w-[100vw] flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={currentMsg.fileUrl ? (currentMsg.fileUrl.startsWith('data:') ? currentMsg.fileUrl : `${currentMsg.fileUrl}#t=0.001`) : undefined}
                  autoPlay
                  playsInline
                  loop
                  muted={isMuted}
                  preload="auto"
                  onClick={toggleVideoPlay}
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  className="max-h-[84vh] max-w-[100vw] sm:rounded-2xl shadow-2xl object-contain"
                />

                {/* Video Play/Pause Overlay indicator */}
                {!isVideoPlaying && (
                  <div 
                    onClick={toggleVideoPlay}
                    className="absolute inset-0 bg-black/35 flex items-center justify-center cursor-pointer sm:rounded-2xl"
                  >
                    <div className="w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-md shadow-2xl">
                      <Play size={32} className="fill-current translate-x-1" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <FirestoreMedia
                url={currentMsg.fileUrl!}
                type="image"
                fileName={currentMsg.fileName}
                className="max-h-[88vh] max-w-[100vw] sm:rounded-2xl shadow-2xl object-contain pointer-events-none"
              />
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. TELEGRAM-STYLE BOTTOM ACTION BAR                      */}
        {/* ======================================================== */}
        <AnimatePresence>
          {showChrome && (
            <motion.div 
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 pb-[calc(10px+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/85 via-black/50 to-transparent flex items-center justify-between text-xs text-slate-300 z-30"
              onClick={e => e.stopPropagation()}
            >
              {/* Left: Video controls or filename */}
              <div className="flex items-center gap-2">
                {isVideo ? (
                  <>
                    <button
                      onClick={toggleVideoPlay}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title={isVideoPlaying ? "Пауза" : "Воспроизведение"}
                    >
                      {isVideoPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title={isMuted ? "Включить звук" : "Выключить звук"}
                    >
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                    {currentMsg.fileName || 'Изображение'}
                  </span>
                )}
              </div>

              {/* Center: Zoom indicator & Reset button */}
              <div className="flex items-center gap-2">
                {scale > 1 && (
                  <button
                    onClick={() => {
                      setScale(1);
                      setPosition({ x: 0, y: 0 });
                    }}
                    className="flex items-center gap-1 font-mono bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-full text-[11px] text-white transition-colors"
                    title="Сбросить масштаб (100%)"
                  >
                    <RotateCcw size={12} />
                    <span>{Math.round(scale * 100)}%</span>
                  </button>
                )}
              </div>

              {/* Right: Swipe hint on mobile */}
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Смахните вниз для закрытия
              </span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AnimatePresence>
  );
};

export default MediaLightboxModal;
