import React, { useState, useEffect } from 'react';
import {
  NotificationSettings,
  getStoredNotificationSettings,
  saveNotificationSettings,
  requestSystemNotificationPermission,
  showSystemNotification,
  getNotificationPermissionState,
  openAppSettings,
} from '../lib/notifications';
import { playIncomingMessageSound, triggerHapticFeedback } from '../lib/audio';
import { Bell, Volume2, VolumeX, Smartphone, Eye, Moon, Check, Sparkles, ShieldCheck, AlertCircle, Settings } from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  addToast?: (msg: string, type?: 'info' | 'error' | 'success') => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  addToast,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(getStoredNotificationSettings);
  const [permState, setPermState] = useState<string>('default');

  useEffect(() => {
    if (isOpen) {
      setSettings(getStoredNotificationSettings());
      setPermState(getNotificationPermissionState());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const handleRequestPermission = async () => {
    const granted = await requestSystemNotificationPermission();
    setPermState(getNotificationPermissionState());
    if (granted) {
      if (addToast) addToast('Уведомления разрешены системой!', 'success');
      playIncomingMessageSound();
    } else {
      openAppSettings();
      if (addToast) {
        addToast(
          'Открываем настройки приложения. Включите разрешения (Уведомления) вручную',
          'info'
        );
      }
    }
  };

  const handleTestNotification = () => {
    if (settings.soundEnabled) {
      playIncomingMessageSound();
    }
    if (settings.vibrationEnabled) {
      triggerHapticFeedback([100, 50, 100]);
    }

    showSystemNotification('Ordina Messenger', 'Тестовое системное уведомление доставлено!', {
      tag: 'test-notification',
    });

    if (addToast) addToast('Тестовый сигнал и уведомление отправлены', 'info');
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Настройки уведомлений</h2>
              <p className="text-xs text-slate-400">Звуки, вибрация и системные всплывающие push-окна</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-3 pr-4 -mr-2 rounded-l-2xl rounded-r-md bg-slate-800/80 hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1 active:scale-95"
          >
            Закрыть
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Permission Card */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-white flex items-center justify-between gap-2 flex-wrap">
                <span>Системный доступ OS</span>
                {permState === 'granted' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Включено
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Требуется настройка
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Позволяет получать push-уведомления и фоновые сигналы сообщений.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              {permState !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-blue-600/20 whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" /> Запросить диалог
                </button>
              )}
              <button
                type="button"
                onClick={openAppSettings}
                className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center justify-center gap-1.5"
                title="Перейти в системные настройки приложения Android"
              >
                <Settings className="w-3.5 h-3.5" /> Настройки OS
              </button>
            </div>

            {permState !== 'granted' && (
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1">
                  💡 Если тумблеры не появляются или запросы блокируются:
                </div>
                <ol className="list-decimal list-inside space-y-0.5 pl-1 text-slate-400">
                  <li>Нажмите кнопку <strong>«Настройки OS»</strong> выше</li>
                  <li>В открывшемся меню выберите <strong>«Разрешения»</strong> или <strong>«Уведомления»</strong></li>
                  <li>Разрешите приложения <strong>Ordina</strong> отправку уведомлений</li>
                </ol>
              </div>
            )}
          </div>

          {/* Main Toggles */}
          <div className="space-y-3">
            {/* Enable all notifications */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/40">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-xs font-bold text-slate-200">Показывать уведомления</div>
                  <div className="text-[11px] text-slate-400">Всплывающие карточки и push</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => updateSetting('enabled', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
              />
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/40">
              <div className="flex items-center gap-3">
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-200">Звуковые сигналы</div>
                  <div className="text-[11px] text-slate-400">Воспроизводить синтезированный чим</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
              />
            </div>

            {/* Vibration Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/40">
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-xs font-bold text-slate-200">Вибрация (Haptic)</div>
                  <div className="text-[11px] text-slate-400">Тактильная отдача на смартфонах</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.vibrationEnabled}
                onChange={(e) => updateSetting('vibrationEnabled', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Preview Mode */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-3">
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" /> Предпросмотр текста в уведомлениях
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateSetting('previewMode', 'full')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                  settings.previewMode === 'full'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Полный текст</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting('previewMode', 'sender_only')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                  settings.previewMode === 'sender_only'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Только автор</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting('previewMode', 'hidden')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                  settings.previewMode === 'hidden'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Скрытый</span>
              </button>
            </div>
          </div>

          {/* Quiet Hours / DND */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" /> Режим тишины (Не беспокоить)
              </div>
              <input
                type="checkbox"
                checked={settings.dndEnabled}
                onChange={(e) => updateSetting('dndEnabled', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
              />
            </div>

            {settings.dndEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Начало тишины</label>
                  <input
                    type="time"
                    value={settings.dndStartTime || '22:00'}
                    onChange={(e) => updateSetting('dndStartTime', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Конец тишины</label>
                  <input
                    type="time"
                    value={settings.dndEndTime || '07:00'}
                    onChange={(e) => updateSetting('dndEndTime', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Button */}
          <div className="pt-2">
            <button
              onClick={handleTestNotification}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition"
            >
              <Sparkles className="w-4 h-4" />
              Проверить звук и тестовое уведомление
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
