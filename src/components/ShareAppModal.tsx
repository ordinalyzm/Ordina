// src/components/ShareAppModal.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Share2, QrCode, Download, Copy, Check, Smartphone, Globe, 
  Shield, Radio, Users, Sparkles, RefreshCw, Send, CheckCircle2, 
  HardDrive, Zap, ExternalLink, ArrowDownToLine
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
}

const PUBLIC_PRODUCTION_URL = 'https://ais-pre-77hjrxhieqxwyomnhghri2-738813665517.europe-west2.run.app';

// Mirror links that work without VPN in RU / CIS
export const APK_DOWNLOAD_MIRRORS = [
  {
    id: 'direct',
    title: 'Прямая загрузка APK (Без VPN)',
    description: 'Официальный билд Ordina v2.6.4 с максимальной скоростью без блокировок',
    url: '/download/ordina-latest.apk',
    isPrimary: true,
    tag: 'Быстро'
  },
  {
    id: 'rustore',
    title: 'RuStore (Российский маркет)',
    description: 'Официальный магазин приложений РФ, доступен без VPN',
    url: 'https://www.rustore.ru/catalog/app/app.ordina.messenger',
    isPrimary: false,
    tag: 'Маркет'
  },
  {
    id: 'telegram',
    title: 'Telegram-канал с APK файлами',
    description: 'Свежие тестовые сборки и APK файлы прямо в мессенджере',
    url: 'https://t.me/ordina_mesh_official',
    isPrimary: false,
    tag: 'Канал'
  },
  {
    id: 'github',
    title: 'GitHub Releases Mirror',
    description: 'Исходный код и скомпилированные APK для разработчиков',
    url: 'https://github.com/ordina-mesh/ordina-releases/releases/latest',
    isPrimary: false,
    tag: 'Зеркало'
  }
];

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  isOpen,
  onClose,
  appUrl
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'apk_download' | 'offline_mesh'>('apk_download');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadCompleted, setDownloadCompleted] = useState(false);

  // Compute the best publicly reachable URL (preventing localhost from breaking on peer devices)
  const getPublicAppUrl = (): string => {
    if (appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1') && !appUrl.includes('capacitor://')) {
      return appUrl;
    }
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('capacitor://')) {
        return origin;
      }
    }
    return PUBLIC_PRODUCTION_URL;
  };

  const targetUrl = getPublicAppUrl();
  const directApkUrl = `${targetUrl}/download/ordina-latest.apk`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(targetUrl)}&bgcolor=000000&color=f59e0b&margin=10`;

  if (!isOpen) return null;

  const handleCopyLink = async (customUrl?: string) => {
    try {
      await navigator.clipboard.writeText(customUrl || targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ордина — Мессенджер свободы и автономной связи',
          text: 'Скачай защищенный мессенджер Ордина с поддержкой офлайн Mesh-сетей без интернета и VPN. Чем больше людей с Ординой, тем лучше связь вокруг!',
          url: targetUrl,
        });
      } catch (_) {}
    } else {
      handleCopyLink();
    }
  };

  // In-app direct APK downloader & self-install trigger (VK/Telegram style)
  const handleStartInAppApkDownload = () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadCompleted(false);

    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 15) + 10;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setDownloadProgress(100);
        setDownloadCompleted(true);
        setIsDownloading(false);

        // Trigger native download/intent
        try {
          const a = document.createElement('a');
          a.href = directApkUrl;
          a.download = 'Ordina-Mesh-v2.6.4.apk';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (e) {
          window.location.href = directApkUrl;
        }
      } else {
        setDownloadProgress(current);
      }
    }, 180);
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[10005] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pt-safe pb-safe"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-amber-500/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-900 flex items-center justify-between shrink-0 bg-black">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <ArrowDownToLine size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Установка и раздача «Ордины»</h2>
                <p className="text-xs text-amber-400 font-mono">Прямая загрузка APK без VPN</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nav Tabs */}
          <div className="flex border-b border-zinc-900 bg-zinc-950 px-3 pt-2 shrink-0">
            <button
              onClick={() => setActiveTab('apk_download')}
              className={`flex-1 py-2.5 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'apk_download'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Download size={14} />
              <span>Скачать APK</span>
            </button>

            <button
              onClick={() => setActiveTab('share')}
              className={`flex-1 py-2.5 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'share'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <QrCode size={14} />
              <span>QR и Ссылка</span>
            </button>

            <button
              onClick={() => setActiveTab('offline_mesh')}
              className={`flex-1 py-2.5 px-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'offline_mesh'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Radio size={14} />
              <span>Офлайн Раздача</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-4 mobile-sheet-scroll bg-black">
            {/* Mesh Community Note */}
            <div className="p-3.5 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-amber-500/5 border border-amber-500/30 rounded-2xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Users size={18} />
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-300">
                  Чем больше людей с «Ординой» — тем мощнее Mesh-сеть без интернета!
                </p>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  Каждый установленный смартфон работает автономным радио-ретранслятором. Связь пересылается по цепочке без сотовых вышек и провайдеров.
                </p>
              </div>
            </div>

            {/* TAB 1: Direct In-App APK Download (VK / RuStore Style) */}
            {activeTab === 'apk_download' && (
              <div className="space-y-3.5">
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-sm">
                        APK
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Ordina Mesh v2.6.4 Release</h4>
                        <p className="text-[11px] text-zinc-400">Android 7.0+ (ARM64 / v7a) • Прямой файл</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                      Без VPN
                    </span>
                  </div>

                  {/* Progress Bar or Action Button */}
                  {isDownloading ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between text-xs text-zinc-300">
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <RefreshCw size={12} className="animate-spin" /> Загрузка APK пакета...
                        </span>
                        <span className="font-mono">{downloadProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-200"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : downloadCompleted ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                        <CheckCircle2 size={16} />
                        <span>Файл загружен! Откройте его для установки.</span>
                      </div>
                      <button
                        onClick={handleStartInAppApkDownload}
                        className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold rounded-lg transition-colors"
                      >
                        Повторить
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartInAppApkDownload}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all text-sm"
                    >
                      <Download size={18} />
                      <span>Скачать и установить APK прямо сейчас</span>
                    </button>
                  )}

                  <p className="text-[11px] text-zinc-400 leading-normal">
                    💡 Как в VK и Telegram: приложение скачивает установочный пакет напрямую без сторонних магазинов и блокировок Google Play.
                  </p>
                </div>

                {/* Additional Mirrors */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-300 px-1">Альтернативные зеркала и маркеты:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {APK_DOWNLOAD_MIRRORS.filter(m => m.id !== 'direct').map((mirror) => (
                      <a
                        key={mirror.id}
                        href={mirror.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-300 group-hover:text-amber-400 flex items-center justify-center">
                            <Globe size={14} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-zinc-200 group-hover:text-white flex items-center gap-1.5">
                              {mirror.title}
                              <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-400 text-[9px] rounded">
                                {mirror.tag}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-400">{mirror.description}</p>
                          </div>
                        </div>
                        <ExternalLink size={14} className="text-zinc-500 group-hover:text-amber-400 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: QR Code & Public Link */}
            {activeTab === 'share' && (
              <div className="space-y-3.5">
                <div className="flex flex-col items-center justify-center p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-center space-y-3">
                  <div className="relative p-2.5 bg-black rounded-2xl border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                    <img 
                      src={qrCodeUrl} 
                      alt="QR-код для установки Ордины" 
                      className="w-48 h-48 rounded-xl object-contain mx-auto"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5">
                      <QrCode size={14} className="text-amber-400" />
                      Наведите камеру смартфона для установки
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-xs leading-relaxed">
                      Работает на любых смартфонах Android и iOS прямо через веб-интерфейс или как независимое PWA-приложение.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-2xl">
                    <input 
                      type="text" 
                      readOnly 
                      value={targetUrl} 
                      className="flex-1 bg-transparent px-3 py-1 text-xs text-amber-300 font-mono focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopyLink(targetUrl)}
                      className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-xl transition-all flex items-center gap-1 text-xs font-bold shrink-0"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copied ? 'Скопировано' : 'Копия'}</span>
                    </button>
                  </div>

                  <button
                    onClick={handleNativeShare}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all text-sm"
                  >
                    <Share2 size={16} />
                    <span>Поделиться ссылкой</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: Offline Peer-to-Peer APK Sharing */}
            {activeTab === 'offline_mesh' && (
              <div className="space-y-3.5">
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Radio size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Офлайн передача APK (Bluetooth / Wi-Fi)</h4>
                      <p className="text-[11px] text-zinc-400">Без подключения к интернету и сотовой сети</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-300">
                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex items-start gap-2">
                      <span className="font-bold text-amber-400 shrink-0">1.</span>
                      <span>Сохраните APK файл на ваш телефон через вкладку «Скачать APK».</span>
                    </div>

                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex items-start gap-2">
                      <span className="font-bold text-amber-400 shrink-0">2.</span>
                      <span>Передайте сохраненный файл <b>Ordina-Mesh.apk</b> через Bluetooth или точку доступа Wi-Fi Direct на телефон соседа.</span>
                    </div>

                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex items-start gap-2">
                      <span className="font-bold text-amber-400 shrink-0">3.</span>
                      <span>После установки оба телефона моментально увидят друг друга на Mesh Радаре и смогут переписываться!</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartInAppApkDownload}
                    className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs"
                  >
                    <Download size={14} />
                    <span>Сохранить APK в память телефона</span>
                  </button>
                </div>
              </div>
            )}

            {/* Features summary footer */}
            <div className="grid grid-cols-2 gap-2 text-left pt-1">
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                  <Radio size={14} className="text-amber-400" />
                  <span>Bluetooth Mesh</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Прямая связь телефон-телефон без интернета
                </p>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                  <Shield size={14} className="text-emerald-400" />
                  <span>Без VPN и блокировок</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Прямые зеркала и локальные протоколы
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
