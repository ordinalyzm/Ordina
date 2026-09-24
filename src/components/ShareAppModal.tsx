// src/components/ShareAppModal.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, QrCode, Download, Copy, Check, Smartphone, Globe, Shield, RefreshCw } from 'lucide-react';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  isOpen,
  onClose,
  appUrl
}) => {
  const [copied, setCopied] = useState(false);
  const targetUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://ordina.app');
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}&bgcolor=09090b&color=38bdf8&margin=10`;

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ордина — Мессенджер свободы и связи',
          text: 'Скачай или установи актуальную версию защищенного мессенджера Ордина с поддержкой офлайн Mesh-сетей:',
          url: targetUrl,
        });
      } catch (_) {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[10005] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 border border-cyan-800/50 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Share2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Поделиться Ординой</h2>
                <p className="text-xs text-cyan-400 font-mono">Авто-обновляемый дистрибутив</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* QR Code section */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-2xl border border-cyan-900/40 text-center space-y-3">
              <div className="relative p-2 bg-slate-950 rounded-2xl border border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
                <img 
                  src={qrCodeUrl} 
                  alt="QR-код для установки Ордины" 
                  className="w-48 h-48 rounded-xl object-contain mx-auto"
                />
                <div className="absolute inset-0 rounded-2xl border border-cyan-400/20 pointer-events-none" />
              </div>
              
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5">
                  <QrCode size={14} className="text-cyan-400" />
                  Наведите камеру смартфона для установки
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                  Приложение откроется прямо в браузере с возможностью установки в 1 клик на главный экран. Все обновления приходят мгновенно и автоматически!
                </p>
              </div>
            </div>

            {/* Link & Share actions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-2xl">
                <input 
                  type="text" 
                  readOnly 
                  value={targetUrl} 
                  className="flex-1 bg-transparent px-3 py-1 text-xs text-cyan-300 font-mono focus:outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all flex items-center gap-1 text-xs font-bold shrink-0"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Скопировано' : 'Копия'}</span>
                </button>
              </div>

              <button
                onClick={handleNativeShare}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/20"
              >
                <Share2 size={16} />
                Отправить через Telegram / WhatsApp / Bluetooth
              </button>
            </div>

            {/* Smart P2P auto-update explanation */}
            <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/40 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <RefreshCw size={14} className="animate-spin text-cyan-400" />
                <span>Как работает авто-обновление:</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Установленная версия сохраняет весь кэш и базу в SQLite офлайн.</li>
                <li>При появлении интернета приложение подтягивает новейшие патчи без переустановки.</li>
                <li>А в офлайне меш-сеть Bluetooth связывает вас с соседями напрямую.</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
