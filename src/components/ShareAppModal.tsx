// src/components/ShareAppModal.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Share2, QrCode, Download, Copy, Check, Smartphone, Globe, 
  Shield, Radio, Users, Sparkles, RefreshCw, Send, CheckCircle2, 
  HardDrive, Zap, ExternalLink, ArrowDownToLine, Github
} from 'lucide-react';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
}

// GitHub repository and distribution URLs (fully accessible in Russia without VPN)
export const GITHUB_REPO_URL = 'https://github.com/ordinalyzm/Ordina';
export const GITHUB_RELEASES_URL = 'https://github.com/ordinalyzm/Ordina/releases/latest';

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
  const [releaseInfo, setReleaseInfo] = useState<{ version: string; apkUrl: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch latest release metadata from server / github
      fetch('/api/github/latest-release')
        .then(res => res.json())
        .then(data => {
          if (data && data.version) {
            setReleaseInfo({
              version: data.version,
              apkUrl: data.apkUrl || GITHUB_RELEASES_URL
            });
          }
        })
        .catch(() => {
          setReleaseInfo({
            version: 'v2.6.4',
            apkUrl: GITHUB_RELEASES_URL
          });
        });
    }
  }, [isOpen]);

  // Primary sharing link for Russia / CIS without VPN
  const shareTargetUrl = GITHUB_REPO_URL;
  const directApkDownloadUrl = releaseInfo?.apkUrl || '/api/download-apk';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(shareTargetUrl)}&bgcolor=000000&color=f59e0b&margin=10`;

  if (!isOpen) return null;

  const handleCopyLink = async (customUrl?: string) => {
    try {
      await navigator.clipboard.writeText(customUrl || shareTargetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ордина — Защищенный мессенджер с автономной связью',
          text: 'Скачай защищенный мессенджер Ордина с поддержкой офлайн Mesh-сетей без интернета и VPN: ' + shareTargetUrl,
          url: shareTargetUrl,
        });
      } catch (_) {}
    } else {
      handleCopyLink(shareTargetUrl);
    }
  };

  // Direct APK download action
  const handleStartInAppApkDownload = () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadCompleted(false);

    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 20) + 15;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setDownloadProgress(100);
        setDownloadCompleted(true);
        setIsDownloading(false);

        // Trigger download
        try {
          const a = document.createElement('a');
          a.href = directApkDownloadUrl;
          a.target = '_blank';
          a.download = 'Ordina-Mesh.apk';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (e) {
          window.location.href = directApkDownloadUrl;
        }
      } else {
        setDownloadProgress(current);
      }
    }, 120);
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
                <h2 className="text-base font-bold text-white">Установка и распространение</h2>
                <p className="text-xs text-amber-400 font-mono">Прямой доступ в РФ без VPN</p>
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
                  Чем больше людей с «Ординой» — тем надежнее Mesh-связь без интернета!
                </p>
                <p className="text-zinc-300 leading-relaxed text-[11px]">
                  Каждый установленный смартфон становится автономным P2P-узлом. Сообщения передаются по радио-цепочке напрямую.
                </p>
              </div>
            </div>

            {/* TAB 1: Direct APK Download via GitHub Releases / Server */}
            {activeTab === 'apk_download' && (
              <div className="space-y-3.5">
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-sm">
                        APK
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Ordina Mesh {releaseInfo?.version || 'v2.6.4'}</h4>
                        <p className="text-[11px] text-zinc-400">Android 7.0+ (ARM64 / v7a) • Прямой билд</p>
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
                          <RefreshCw size={12} className="animate-spin" /> Получение актуального файла...
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
                      <span>Скачать актуальный APK прямо сейчас</span>
                    </button>
                  )}

                  <p className="text-[11px] text-zinc-400 leading-normal">
                    💡 Приложение загружает установочный файл напрямую с репозитория без блокировок и без необходимости включать VPN.
                  </p>
                </div>

                {/* GitHub Releases & Source Link */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-300 px-1">Официальные источники без VPN:</p>
                  <div className="grid grid-cols-1 gap-2">
                    <a
                      href={GITHUB_RELEASES_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-300 group-hover:text-amber-400 flex items-center justify-center">
                          <Github size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-200 group-hover:text-white flex items-center gap-1.5">
                            GitHub Releases (Релизы Ordina)
                            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded">
                              Прямой файл
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono">github.com/ordinalyzm/Ordina/releases</p>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-zinc-500 group-hover:text-amber-400 shrink-0" />
                    </a>

                    <a
                      href={GITHUB_REPO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 rounded-xl flex items-center justify-between transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-300 group-hover:text-amber-400 flex items-center justify-center">
                          <Globe size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-200 group-hover:text-white flex items-center gap-1.5">
                            Страница проекта Ordina
                            <span className="px-1.5 py-0.2 bg-zinc-800 text-zinc-400 text-[9px] rounded">
                              Open Source
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono">github.com/ordinalyzm/Ordina</p>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-zinc-500 group-hover:text-amber-400 shrink-0" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: QR Code & Non-VPN Share Link */}
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
                      Наведите камеру смартфона для скачивания
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-xs leading-relaxed">
                      Ссылка открывается напрямую в России без необходимости включать VPN.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-2xl">
                    <input 
                      type="text" 
                      readOnly 
                      value={shareTargetUrl} 
                      className="flex-1 bg-transparent px-3 py-1 text-xs text-amber-300 font-mono focus:outline-none truncate"
                    />
                    <button
                      onClick={() => handleCopyLink(shareTargetUrl)}
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
                      <span>Скачайте APK файл на смартфон через вкладку «Скачать APK».</span>
                    </div>

                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex items-start gap-2">
                      <span className="font-bold text-amber-400 shrink-0">2.</span>
                      <span>Отправьте сохраненный файл через Bluetooth, Quick Share или точку доступа на смартфон собеседника.</span>
                    </div>

                    <div className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex items-start gap-2">
                      <span className="font-bold text-amber-400 shrink-0">3.</span>
                      <span>После установки смартфоны сразу соединяются по Mesh Радару и могут обмениваться сообщениями без сотовой сети.</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartInAppApkDownload}
                    className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs"
                  >
                    <Download size={14} />
                    <span>Скачать APK для офлайн-раздачи</span>
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
                  Прямая связь смартфон-смартфон без интернета
                </p>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                  <Shield size={14} className="text-emerald-400" />
                  <span>Без VPN в РФ</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Прямые зеркала и открытый репозиторий
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
