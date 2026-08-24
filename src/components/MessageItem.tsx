import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { Reply } from 'lucide-react';
import { Message } from '../types';
import { triggerHapticFeedback } from '../lib/audio';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MessageItemProps {
  msg: Message;
  isMe: boolean;
  highlightedMsgId: string | null;
  selectedMsgIds: string[];
  isSelectionMode: boolean;
  floatingHeartMsgId: string | null;
  onPointerDown: (e: React.PointerEvent, msg: Message) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent, msg: Message) => void;
  onContextMenu: (e: React.MouseEvent, msg: Message) => void;
  onReply: (msg: Message) => void;
  children: React.ReactNode;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  isMe,
  highlightedMsgId,
  selectedMsgIds,
  isSelectionMode,
  floatingHeartMsgId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
  onReply,
  children
}) => {
  const x = useMotionValue(0);
  const hapticFiredRef = useRef(false);

  // Telegram-style Circular Reply Badge transforms
  const badgeScale = useTransform(x, [-45, -15, 0], [1, 0.3, 0]);
  const badgeOpacity = useTransform(x, [-35, -10, 0], [1, 0.4, 0]);
  const badgeRotate = useTransform(x, [-50, 0], [0, -45]);
  const badgeX = useTransform(x, [-70, 0], [-8, 20]);

  return (
    <motion.div
      key={msg.id}
      id={`msg-${msg.id}`}
      data-msg-id={msg.id}
      style={{ x }}
      drag="x"
      dragDirectionLock={true}
      dragConstraints={{ left: -80, right: 0 }}
      dragElastic={{ left: 0.35, right: 0 }}
      dragSnapToOrigin={true}
      onDrag={(e, info) => {
        const dx = info.offset.x;
        // Distance threshold ~45dp/px
        if (dx <= -45) {
          if (!hapticFiredRef.current) {
            hapticFiredRef.current = true;
            triggerHapticFeedback();
          }
        } else if (dx > -25) {
          hapticFiredRef.current = false;
        }
      }}
      onDragEnd={(e, info) => {
        const dx = info.offset.x;
        const vx = info.velocity.x;
        const speed = Math.abs(vx);
        hapticFiredRef.current = false;

        // Telegram Activation criteria: dx <= -40 and (speed >= 100 or dx <= -50)
        if (dx <= -40 && (speed >= 100 || dx <= -50)) {
          onReply(msg);
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      onPointerDown={(e) => onPointerDown(e, msg)}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerUp(e, msg)}
      onPointerCancel={(e) => onPointerUp(e, msg)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, msg);
      }}
      className={cn(
        "flex flex-col transition-all duration-300 w-full relative group min-w-0 touch-pan-y select-none cursor-pointer",
        isMe ? "items-end" : "items-start",
        highlightedMsgId === msg.id ? "scale-[1.02] drop-shadow-xl z-10" : "",
        selectedMsgIds.includes(msg.id) ? "bg-blue-50/70 p-1.5 rounded-2xl border border-blue-300/80 shadow-sm" : ""
      )}
    >
      {/* Telegram-style Circular Reply Badge on the right */}
      <motion.div 
        style={{ scale: badgeScale, opacity: badgeOpacity, x: badgeX }}
        className="absolute -right-12 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-20"
      >
        <motion.div 
          style={{ rotate: badgeRotate }}
          className="w-8 h-8 rounded-full bg-blue-500 text-white shadow-md flex items-center justify-center"
        >
          <Reply size={16} />
        </motion.div>
      </motion.div>

      {/* Heart Animation on Double Tap */}
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

      {children}
    </motion.div>
  );
};
