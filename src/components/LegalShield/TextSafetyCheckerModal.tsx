import React, { useState, useMemo, useEffect } from 'react';
import { CONSTITUTION_DATA } from '../../data/constitutionReference';
import { CRIMINAL_CODE_DATA } from '../../data/criminalCodeReference';
import { ADMINISTRATIVE_CODE_DATA } from '../../data/administrativeCodeReference';
import { DetectedRisk } from '../../types/legalShield';
import { RiskDetailModal } from './RiskDetailModal';
import { 
  Shield, 
  ShieldCheck, 
  BookOpen, 
  Search, 
  X, 
  Scale, 
  AlertTriangle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TextSafetyCheckerModalProps {
  initialText: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyAndInsert: (safeText: string) => void;
}

export const TextSafetyCheckerModal: React.FC<TextSafetyCheckerModalProps> = ({
  initialText,
  isOpen,
  onClose,
  onApplyAndInsert
}) => {
  const [activeTab, setActiveTab] = useState<'koap' | 'uk' | 'constitution' | 'recommendations'>('koap');
  const [text, setText] = useState<string>(initialText || '');
  const [activeRiskDetail, setActiveRiskDetail] = useState<DetectedRisk | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
    }
  }, [isOpen, initialText]);

  const filteredKoap = useMemo(() => {
    if (!searchQuery.trim()) return ADMINISTRATIVE_CODE_DATA;
    const q = searchQuery.toLowerCase();
    return ADMINISTRATIVE_CODE_DATA.filter(
      (item) =>
        item.number.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.disposition.toLowerCase().includes(q) ||
        item.chapter.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredUk = useMemo(() => {
    if (!searchQuery.trim()) return CRIMINAL_CODE_DATA;
    const q = searchQuery.toLowerCase();
    return CRIMINAL_CODE_DATA.filter(
      (item) =>
        item.number.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.disposition.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const filteredConstitution = useMemo(() => {
    if (!searchQuery.trim()) return CONSTITUTION_DATA;
    const q = searchQuery.toLowerCase();
    return CONSTITUTION_DATA.filter(
      (item) =>
        item.number.toString().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        item.text.toLowerCase().includes(q) ||
        item.chapterTitle.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleCopy = (str: string) => {
    navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh] max-h-[850px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Shield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Правовой щит
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/30 text-indigo-300 rounded-full border border-indigo-500/40">
                  Юридический фильтр и кодексы РФ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Проверка переписки на риски КоАП, УК РФ и конституционные права граждан
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 pt-3 border-b border-slate-100 bg-slate-50/80 overflow-x-auto">

          <button
            type="button"
            onClick={() => setActiveTab('koap')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'koap'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale size={16} />
            <span>КоАП РФ</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md font-medium">
              {ADMINISTRATIVE_CODE_DATA.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('uk')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'uk'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle size={16} />
            <span>УК РФ</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md font-medium">
              {CRIMINAL_CODE_DATA.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('constitution')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'constitution'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen size={16} />
            <span>Конституция РФ</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-md font-medium">
              {CONSTITUTION_DATA.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'recommendations'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Правовые рекомендации</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {/* TAB: ПРАВОВЫЕ РЕКОМЕНДАЦИИ */}
          {activeTab === "recommendations" && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm mb-1">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  Памятка цифровой безопасности и правовой защиты в РФ
                </div>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Суверенный мессенджер Ордина обеспечивает конфиденциальность переписки согласно ст. 23 Конституции РФ. Ниже собраны официальные рекомендации по защите ваших прав в цифровом пространстве.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <Scale size={16} className="text-blue-600" />
                    Тайна переписки (ст. 23 Конституции РФ)
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Каждый гражданин имеет право на тайну переписки, телефонных переговоров, почтовых и иных сообщений. Ограничение этого права допускается только на основании судебного решения.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <AlertTriangle size={16} className="text-amber-600" />
                    Защита от провокаций и фишинга
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Никогда не передавайте одноразовые SMS-коды, пароли или данные банковских карт в сообщениях. Администрация Ордины никогда не запрашивает ваши пароли в личных сообщениях.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <BookOpen size={16} className="text-emerald-600" />
                    Публичные каналы и блоги
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    При ведении публичных каналов проверяйте достоверность публикуемой информации. Заведомо ложные сведения могут повлечь ответственность по ст. 128.1 УК РФ (Клевета).
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <Shield size={16} className="text-purple-600" />
                    Сквозное шифрование в Ордине
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    При общении в защищенных чатах включайте иконку «Щит» (Шифрование). Ключи шифрования хранятся исключительно на ваших устройствах.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: КОАП РФ */}
          {activeTab === 'koap' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по номеру статьи (например 5.61, 14.57), названию или санкциям..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredKoap.map((item) => (
                  <div
                    key={item.number}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2 hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-700 font-bold text-xs rounded-xl border border-amber-500/20">
                            КоАП РФ ст. {item.number}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {item.chapter}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {item.disposition}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-rose-700 font-semibold">
                        Санкции: {item.sanctionSummary}
                      </span>
                    </div>

                    {item.practicalAdvice && (
                      <p className="text-xs text-indigo-900 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 italic">
                        Совет юриста: {item.practicalAdvice}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: УК РФ */}
          {activeTab === 'uk' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по статьям УК РФ (128.1, 137, 159, 163, 272)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredUk.map((item) => (
                  <div
                    key={item.number}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2 hover:border-red-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-700 font-bold text-xs rounded-xl border border-rose-500/20">
                            УК РФ ст. {item.number}
                          </span>
                          {item.chapter && (
                            <span className="text-xs text-slate-400 font-medium">
                              {item.chapter}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {item.disposition}
                    </p>

                    <div className="pt-2 border-t border-slate-100 text-xs">
                      <span className="text-rose-700 font-semibold">
                        Наказание: {item.sanctionSummary}
                      </span>
                    </div>

                    {item.practicalAdvice && (
                      <p className="text-xs text-amber-900 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 italic">
                        Правовой совет: {item.practicalAdvice}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: КОНСТИТУЦИЯ РФ */}
          {activeTab === 'constitution' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по Конституции РФ (ст. 15, 23, 29, 37, 51, переписка, частная жизнь)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredConstitution.map((item) => (
                  <div
                    key={item.number.toString()}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-700 font-bold text-xs rounded-xl border border-blue-500/20">
                            Конституция РФ ст. {item.number}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {item.chapterTitle}
                          </span>
                        </div>
                        {item.title && (
                          <h4 className="text-sm font-bold text-slate-900 mt-1">
                            {item.title}
                          </h4>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                      {item.text}
                    </p>

                    {item.practicalMeaning && (
                      <p className="text-xs text-blue-900 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 italic">
                        Значение для граждан: {item.practicalMeaning}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 font-medium">
            Правовой щит суверенного мессенджера Ордина • Защита прав граждан
          </p>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Закрыть
          </button>
        </div>
      </div>


    </div>
  );
};
