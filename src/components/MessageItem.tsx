import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, useAnimate, AnimatePresence } from 'motion/react';
import { Reply } from 'lucide-react';
import { Message } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface MessageItemProps {
  msg: Message;
  isMe: boolean;
  highlightedMsgId: string | null;
  selectedMsgIds: string[];
  isSelectionMode: boolean;
  floatingHeartMsgId: string | null;
  onContextMenu: (e: React.MouseEvent | React.TouchEvent | React.PointerEvent, msg: Message) => void;
  onToggleSelect: (msgId: string) => void;
  onReply: (msg: Message) => void;
  onDoubleTapReact?: (msg: Message) => void;
  onSingleTap?: (e: React.PointerEvent | React.MouseEvent, msg: Message) => void;
  children: React.ReactNode;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  isMe,
  highlightedMsgId,
  selectedMsgIds,
  isSelectionMode,
  floatingHeartMsgId,
  onContextMenu,
  onToggleSelect,
  onReply,
  onDoubleTapReact,
  onSingleTap,
  children,
}) => {
  const [scope, animate] = useAnimate();
  const x = useMotionValue(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startPosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const isMovedRef = useRef(false);

  // Telegram parameters for left swipe
  const SWIPE_THRESHOLD = -60; // Activation threshold in pixels
  const MAX_DRAG = -100;       // Max visual displacement

  // Transformations for reply icon (appears and scales up during swipe)
  const iconScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1.2]);
  const iconOpacity = useTransform(x, [0, SWIPE_THRESHOLD / 2], [0, 1]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isLongPressTriggered.current = false;
    isMovedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Telegram standard 500ms long press -> Message selection mode
    longPressTimer.current = setTimeout(() => {
      if (!isMovedRef.current) {
        isLongPressTriggered.current = true;
        if ('vibrate' in navigator) {
          navigator.vibrate(15);
        }
        onToggleSelect(msg.id);
      }
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current.time) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);

    if (dx > 8 || dy > 8) {
      isMovedRef.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const pressDuration = Date.now() - startPosRef.current.time;

    // Do NOT open single-tap menu if longpress fired, or if finger moved (swipe/scroll), or if held > 250ms
    if (!isLongPressTriggered.current && !isMovedRef.current && pressDuration <= 250) {
      if (isSelectionMode) {
        onToggleSelect(msg.id);
      } else {
        const now = Date.now();
        const isDoubleTap = now - lastTapRef.current < 300;

        if (isDoubleTap) {
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
          lastTapRef.current = 0;
          if (onDoubleTapReact) {
            onDoubleTapReact(msg);
          }
        } else {
          lastTapRef.current = now;
          singleTapTimerRef.current = setTimeout(() => {
            singleTapTimerRef.current = null;
            if (onSingleTap) {
              onSingleTap(e, msg);
            }
          }, 200);
        }
      }
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  };

  const isSelected = selectedMsgIds.includes(msg.id);

  return (
    <div
      ref={scope}
      className={cn(
        "relative w-full select-none touch-pan-y flex flex-col my-1 transition-colors duration-200",
        isMe ? "items-end pr-2" : "items-start pl-2",
        highlightedMsgId === msg.id ? "scale-[1.02] drop-shadow-xl z-10" : "",
        isSelected ? "bg-blue-500/10 rounded-2xl border border-blue-300/80 p-1" : ""
      )}
    >
      {/* Icon reply hidden behind right edge */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-0 pointer-events-none flex items-center justify-center">
        <motion.div
          style={{ scale: iconScale, opacity: iconOpacity }}
          className="w-8 h-8 rounded-full bg-blue-500 text-white shadow-md flex items-center justify-center"
        >
          <Reply size={16} />
        </motion.div>
      </div>

      {/* Floating Heart animation on double tap */}
      <AnimatePresence>
        {floatingHeartMsgId === msg.id && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 0 }}
            animate={{ opacity: 1, scale: 1.4, y: -30 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute inset-0 m-auto flex items-center justify-center z-50 pointer-events-none"
          >
            <span className="text-4xl drop-shadow-lg">❤️</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message cloud (swipable) */}
      <motion.div
        drag={isSelectionMode ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: MAX_DRAG, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        dragMomentum={false}
        style={{ x, touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < SWIPE_THRESHOLD || info.velocity.x < -150) {
            if ('vibrate' in navigator) {
              navigator.vibrate(10);
            }
            onReply(msg);
          }
          animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
        }}
        className="w-full flex flex-col cursor-pointer z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};
