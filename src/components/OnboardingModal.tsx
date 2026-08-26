import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, ShieldCheck, Zap, MessageSquare, Cpu, Sparkles, ChevronRight, ChevronLeft, CheckCircle2, X, Smartphone, Server } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRadar?: () => void;
}

const SLIDES = [
  {
    id: 'intro',
    title: 'Добро пожаловать в Ordina自由',
    subtitle: 'Мессенджер Свободного Общения и Децентрализации',
    icon: Sparkles,
    color: 'from-blue-600 to-indigo-600',
    accentColor: 'text-blue-500',
    bgBadge: 'bg-blue-500/10 text-blue-600',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <p>
          Ordina объединяет традиционную быструю связь через интернет и **автономную P2P Mesh-сеть** для передачи сообщений без интернета и сотовой связи.
        </p>
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs uppercase tracking-wide">
            <Zap className="w-4 h-4 text-blue-500" /> Два ключевых режима:
          </div>
          <ul className="text-xs space-y-1.5 text-slate-600 list-disc pl-4">
            <li><strong>Онлайн Режим:</strong> Мгновенные чаты, группы, каналы, гифки, стикеры и звонки.</li>
            <li><strong>Оффлайн Mesh P2P:</strong> Передача сообщений по цепочке устройств через Bluetooth LE & WebRTC.</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'mesh_radar',
    title: 'Радар и Радио-связь',
    subtitle: 'Как работает обнаружение узлов и ретрансляция',
    icon: Radio,
    color: 'from-emerald-600 to-teal-600',
    accentColor: 'text-emerald-500',
    bgBadge: 'bg-emerald-500/10 text-emerald-600',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <p>
          В меню чатов вы найдете иконку <strong>Радара</strong>. На нем отображаются находящиеся рядом устройства и уровень сигнала (dBm).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-xl">
            <span className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" /> Эхо-Маршрутизация
            </span>
            Сообщения сами ищут кратчайший путь от одного смартфона к другому (Hops).
          </div>
          <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
            <span className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
              <Server className="w-3.5 h-3.5 text-amber-600" /> Режим Почтальона
            </span>
            Если адресат далеко, близлежащее устройство временно сохраняет пакет до встречи.
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'security',
    title: 'Безопасность & Шифрование',
    subtitle: 'Секретные чаты и защита от прослушивания',
    icon: ShieldCheck,
    color: 'from-purple-600 to-indigo-600',
    accentColor: 'text-purple-500',
    bgBadge: 'bg-purple-500/10 text-purple-600',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <p>
          Все личные чаты и секретные сообщения шифруются прямо на вашем устройстве.
        </p>
        <div className="p-3.5 bg-purple-50/70 border border-purple-200/60 rounded-2xl space-y-2 text-xs">
          <div className="font-bold text-purple-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-purple-600" /> Свойства защиты:
          </div>
          <p className="text-slate-700">
            • <strong>Анти-DDoS Шторм:</strong> Повторные эхо-пакеты автоматически отсекаются.<br/>
            • <strong>Локальное Хранение:</strong> Ваши ключи и диалоги сохраняются в зашифрованном виде на вашем устройстве.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'features',
    title: 'Полезные Жесты и Выделение',
    subtitle: 'Как быстро управлять сообщениями',
    icon: MessageSquare,
    color: 'from-amber-600 to-orange-600',
    accentColor: 'text-amber-500',
    bgBadge: 'bg-amber-500/10 text-amber-600',
    content: (
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        <div className="space-y-2 text-xs">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="font-bold text-slate-700">Свайп влево по сообщению</span>
            <span className="text-slate-500">Быстрый ответ</span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="font-bold text-slate-700">Долгое нажатие</span>
            <span className="text-slate-500">Режим выделения сообщений</span>
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="font-bold text-slate-700">Двойной тап</span>
            <span className="text-slate-500">Быстрая реакция ❤️</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'finish',
    title: 'Вы готовы к работе!',
    subtitle: 'Начните прямо сейчас в онлайн или оффлайн режиме',
    icon: CheckCircle2,
    color: 'from-blue-600 to-emerald-600',
    accentColor: 'text-emerald-500',
    bgBadge: 'bg-emerald-500/10 text-emerald-600',
    content: (
      <div className="space-y-4 text-center py-2">
        <p className="text-sm text-slate-600">
          Вы всегда можете снова открыть этот гайд через меню <strong>Настройки ➔ Мастер-класс для новичков</strong>.
        </p>
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-medium">
          Приятного использования Ordina自由! Все ваши данные надежно защищены.
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
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 font-mono">
              УРОК {currentSlideIndex + 1} ИЗ {SLIDES.length}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentSlide.bgBadge}`}>
              {currentSlide.id.toUpperCase()}
            </span>
          </div>
          <button 
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
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 shadow-md shadow-blue-600/30 transition flex items-center gap-1"
              >
                Понятно, начать! <CheckCircle2 size={16} />
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
