import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, ShieldCheck, Zap, MessageSquare, Cpu, Sparkles, ChevronRight, ChevronLeft, CheckCircle2, X, Settings, Lock, Search, Heart, CornerUpLeft, ShieldAlert, Bot, FileCode } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRadar?: () => void;
}

const SLIDES = [
  {
    id: 'intro',
    title: 'Добро пожаловать в Ordina',
    subtitle: 'Мессенджер свободного общения и децентрализованной связи',
    icon: Sparkles,
    color: 'from-blue-600 to-indigo-600',
    accentColor: 'text-blue-500',
    bgBadge: 'bg-blue-500/10 text-blue-600',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <p>
          Ordina объединяет быструю связь через интернет и децентрализованную автономную P2P Mesh-сеть для передачи сообщений без интернета и сотовой связи.
        </p>
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wide">
            <Zap className="w-4 h-4 text-blue-500" /> Два основных режима связи:
          </div>
          <ul className="text-xs space-y-1.5 text-slate-600 list-disc pl-4">
            <li><strong>Онлайн Режим:</strong> Мгновенные чаты, группы, каналы, медиафайлы, гифки, стикеры и звонки через интернет.</li>
            <li><strong>Оффлайн Mesh P2P:</strong> Прямая передача сообщений по радиоцепочке устройств через Bluetooth LE & WebRTC.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'mesh_radar',
    title: 'Где находится Радар и Mesh-сеть',
    subtitle: 'Поиск ближайших устройств и эхо-маршрутизация',
    icon: Radio,
    color: 'from-emerald-600 to-teal-600',
    accentColor: 'text-emerald-500',
    bgBadge: 'bg-emerald-500/10 text-emerald-600',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
            <Radio size={20} />
          </div>
          <div className="text-xs text-emerald-950">
            <strong className="block text-slate-900 font-bold">Расположение: Верхняя панель списка чатов</strong>
            Иконка радиоволн/радара расположена рядом со строкой поиска в самом верху меню.
          </div>
        </div>

        <p className="text-xs text-slate-600">
          Нажмите на <strong>Радар</strong>, чтобы активировать сканирование эфира. Вы увидите круговую карту узлов с расстоянием в метрах и уровнем сигнала (dBm).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" /> Эхо-Маршруты
            </span>
            Сообщения передаются по цепочке промежуточных смартфонов (Hops).
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-600" /> Режим Почтальона
            </span>
            Зашифрованный пакет хранится до физического сближения с адресатом.
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'settings_menu',
    title: 'Меню Настройки и Калибровка',
    subtitle: 'Где настраивать профиль и параметры модема',
    icon: Settings,
    color: 'from-slate-700 to-slate-900',
    accentColor: 'text-slate-600',
    bgBadge: 'bg-slate-500/10 text-slate-700',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
            <Settings size={20} />
          </div>
          <div className="text-xs text-slate-800">
            <strong className="block text-slate-900 font-bold">Расположение: Боковая панель или Иконка ⚙️ в шапке</strong>
            В меню Настройки можно изменить ваш профиль, имя, аватар и тему оформления.
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-slate-600">
          <p>• <strong>Калибровка BLE модема:</strong> В окне Радара вы можете вручную указать поколение вашего устройства (от BLE 4.0 55m до Bluetooth 5.4 380m).</p>
          <p>• <strong>Раздел «Для новичков»:</strong> В любой момент вы можете снова запустить этот анимированный гайд из Настроек.</p>
        </div>
      </div>
    )
  },
  {
    id: 'secret_chats',
    title: 'Сквозное шифрование и E2EE',
    subtitle: 'Все сообщения и файлы защищены по умолчанию',
    icon: Lock,
    color: 'from-purple-600 to-indigo-600',
    accentColor: 'text-purple-500',
    bgBadge: 'bg-purple-500/10 text-purple-600',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <div className="p-3 bg-purple-50/80 border border-purple-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/20">
            <Lock size={20} />
          </div>
          <div className="text-xs text-purple-950">
            <strong className="block text-purple-900 font-bold">100% шифрование во всех чатах</strong>
            В Ордине каждый диалог, группа и канал защищены сквозным криптографическим шифрованием. Никаких «обычных» незащищенных чатов нет.
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-600" /> Персональный шифр (Иконка 🛡️ в строке ввода):
          </div>
          <p className="text-slate-600">
            Для сверхсекретных заметок и паролей используйте кнопку шифрования Cipher в строке ввода — текст зашифруется вашим личным паролем.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'gestures',
    title: 'Жесты и Быстрые Действия',
    subtitle: 'Удобное управление в окне переписки',
    icon: MessageSquare,
    color: 'from-amber-600 to-orange-600',
    accentColor: 'text-amber-500',
    bgBadge: 'bg-amber-500/10 text-amber-600',
    content: (
      <div className="space-y-2.5 text-xs text-slate-600">
        <div className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl flex items-center justify-between">
          <span className="font-bold text-amber-900 flex items-center gap-1.5">
            <CornerUpLeft size={14} className="text-amber-600" /> Свайп влево по сообщению
          </span>
          <span className="text-amber-800 font-medium">Быстрый ответ (Цитирование)</span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-blue-600" /> Долгое нажатие
          </span>
          <span className="text-slate-600 font-medium">Режим выделения сообщений</span>
        </div>
        <div className="p-2.5 bg-rose-50/60 border border-rose-200/60 rounded-xl flex items-center justify-between">
          <span className="font-bold text-rose-900 flex items-center gap-1.5">
            <Heart size={14} className="text-rose-600 fill-rose-600" /> Двойной тап по облачку
          </span>
          <span className="text-rose-800 font-medium">Быстрая реакция ❤️</span>
        </div>
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Search size={14} className="text-slate-600" /> Лупа в шапке чата
          </span>
          <span className="text-slate-600 font-medium">Поиск по истории переписки</span>
        </div>
      </div>
    )
  },
  {
    id: 'legal_shield',
    title: 'Правовой Щит Ordina',
    subtitle: 'Локальная защита от случайных нарушений законов РФ',
    icon: ShieldAlert,
    color: 'from-rose-600 to-amber-600',
    accentColor: 'text-rose-500',
    bgBadge: 'bg-rose-500/10 text-rose-600',
    content: (
      <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
        <div className="p-3 bg-rose-50/80 border border-rose-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/20 font-bold">
            <ShieldAlert size={20} />
          </div>
          <div className="text-xs text-rose-950">
            <strong className="block text-slate-900 font-bold">Безопасность вашего общения</strong>
            Правовой советник анализирует набираемый текст на предмет риска нарушения статей УК и КоАП РФ (оскорбления, брань, клевета, доксинг, экстремизм).
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> 100% Локально и Приватно:
          </div>
          <p className="text-slate-600">
            Сканирование происходит исключительно на вашем устройстве в реальном времени. Набранный текст <strong>никогда и никуда не отправляется</strong> на внешние серверы.
          </p>
          <p className="text-slate-500 text-[11px]">
            Вы всегда можете отключить или включить этот режим в Меню ➔ Настройки ➔ «Правовой щит РФ».
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'bots_export',
    title: 'Конструктор Ботов и Telegram',
    subtitle: 'Создание, перенос и экспорт готового кода',
    icon: Bot,
    color: 'from-indigo-600 to-purple-600',
    accentColor: 'text-indigo-500',
    bgBadge: 'bg-indigo-500/10 text-indigo-600',
    content: (
      <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
        <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
            <Bot size={20} />
          </div>
          <div className="text-xs text-indigo-950">
            <strong className="block text-slate-900 font-bold">Умные боты без ограничений</strong>
            Создавайте сценарии, автоответчики и внутреннюю валюту ботов с помощью визуального конструктора или бесплатного ИИ.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <FileCode className="w-3.5 h-3.5 text-blue-600" /> Экспорт кода
            </span>
            Скачивайте исходный код вашего бота на Python (aiogram 3.x), TypeScript или JSON для запуска на любом сервере.
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Импорт из Telegram
            </span>
            Вставьте код существующего TG-бота или список команд BotFather для мгновенного переноса в Ордину!
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'finish',
    title: 'Вы готовы к автономному общению!',
    subtitle: 'Начните прямо сейчас в онлайн или оффлайн режиме',
    icon: CheckCircle2,
    color: 'from-blue-600 to-emerald-600',
    accentColor: 'text-emerald-500',
    bgBadge: 'bg-emerald-500/10 text-emerald-600',
    content: (
      <div className="space-y-4 text-center py-2">
        <p className="text-sm text-slate-600">
          Вы всегда можете снова открыть этот гайд через меню <strong>Настройки ➔ Для новичков (ГАЙД)</strong>.
        </p>
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
          Приятного использования Ordina Messenger! Ваши сообщения и конфиденциальность всегда под надежной защитой.
        </div>
      </div>
    )
  }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onOpenRadar }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  if (!isOpen) return null;

  const currentSlide = SLIDES[currentSlideIndex];
  const IconComponent = currentSlide.icon;
  const isLast = currentSlideIndex === SLIDES.length - 1;
  const isFirst = currentSlideIndex === 0;

  return (
    <div 
      className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header strip */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 font-mono">
              УРОК {currentSlideIndex + 1} ИЗ {SLIDES.length}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentSlide.bgBadge}`}>
              {currentSlide.id.toUpperCase()}
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Animated Slide View */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="w-full flex flex-col items-center text-center space-y-4"
            >
              {/* Animated Icon Avatar Container */}
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${currentSlide.color} text-white flex items-center justify-center shadow-xl shadow-blue-500/10`}>
                <IconComponent className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">
                  {currentSlide.title}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {currentSlide.subtitle}
                </p>
              </div>

              <div className="w-full text-left pt-2">
                {currentSlide.content}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer controls & pagination dots */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlideIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentSlideIndex 
                    ? 'w-6 bg-blue-600' 
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => prev - 1)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition flex items-center gap-1"
              >
                <ChevronLeft size={16} /> Назад
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenRadar) onOpenRadar();
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-md shadow-blue-600/30 transition flex items-center gap-1"
              >
                Понятно, открыть! <CheckCircle2 size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => prev + 1)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-md shadow-blue-600/30 transition flex items-center gap-1"
              >
                Далее <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
