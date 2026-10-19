import React, { useState } from 'react';
import { DetectedRisk } from '../../types/legalShield';
import { findArticleByNumber } from '../../data/constitutionReference';
import { findCriminalArticle } from '../../data/criminalCodeReference';
import { findAdministrativeArticle } from '../../data/administrativeCodeReference';

interface RiskDetailModalProps {
  detectedRisk: DetectedRisk;
  isOpen: boolean;
  onClose: () => void;
  onApplyReplacement: (risk: DetectedRisk) => void;
}

export const RiskDetailModal: React.FC<RiskDetailModalProps> = ({
  detectedRisk,
  isOpen,
  onClose,
  onApplyReplacement
}) => {
  const [showConstText, setShowConstText] = useState(false);
  const [showUkText, setShowUkText] = useState(false);
  const [showKoapText, setShowKoapText] = useState(false);

  if (!isOpen || !detectedRisk) return null;

  const { rule, matchedText } = detectedRisk;
  const constArticle = rule.constitutionArticle ? findArticleByNumber(rule.constitutionArticle) : undefined;
  const ukArticle = rule.ukArticle ? findCriminalArticle(rule.ukArticle) : undefined;
  const koapArticle = rule.koapArticle ? findAdministrativeArticle(rule.koapArticle) : undefined;

  const badgeColor =
    rule.riskLevel === 'critical'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
      : rule.riskLevel === 'warning'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
      >
        {/* Шапка */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${badgeColor}`}>
              {rule.riskLevel === 'critical'
                ? 'КРИТИЧЕСКИЙ РИСК'
                : rule.riskLevel === 'warning'
                ? 'ПРЕДУПРЕЖДЕНИЕ'
                : 'РЕКОМЕНДАЦИЯ'}
            </span>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base">
              {rule.riskTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Тело */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* Фраза */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Опасная формулировка:
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-700 dark:text-red-300 font-medium">
              «{matchedText}»
            </div>
          </div>

          {/* Объяснение риска */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              В чём правовой риск:
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              {rule.riskDescription}
            </p>
          </div>

          {/* Безопасная альтернатива */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
              Безопасная формулировка (тот же смысл):
            </div>
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 rounded-xl text-emerald-950 dark:text-emerald-200 font-medium leading-relaxed">
              {rule.safeReplacement}
            </div>
          </div>

          {/* Законодательная база */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Квалификация:</span>
              <span>{rule.statutoryReference}</span>
            </div>

            {/* Карточка КоАП РФ */}
            {koapArticle && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowKoapText(!showKoapText)}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>{showKoapText ? '▼ Скрыть' : '▶ Раскрыть'} статью {koapArticle.number} КоАП РФ ({koapArticle.title})</span>
                </button>
                {showKoapText && (
                  <div className="mt-2 p-3.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                    <div className="font-bold text-amber-800 dark:text-amber-300">
                      Статья {koapArticle.number} КоАП РФ. {koapArticle.title}
                    </div>
                    <p className="leading-relaxed">{koapArticle.disposition}</p>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      ⚖️ Ответственность: {koapArticle.sanctionSummary}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Карточка УК РФ */}
            {ukArticle && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowUkText(!showUkText)}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>{showUkText ? '▼ Скрыть' : '▶ Раскрыть'} статью {ukArticle.number} УК РФ ({ukArticle.title})</span>
                </button>
                {showUkText && (
                  <div className="mt-2 p-3.5 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                    <div className="font-bold text-rose-700 dark:text-rose-300">
                      Статья {ukArticle.number} УК РФ. {ukArticle.title}
                    </div>
                    <p className="leading-relaxed">{ukArticle.disposition}</p>
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      ⚠️ Уголовное наказание: {ukArticle.sanctionSummary}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Карточка Конституции РФ */}
            {constArticle && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowConstText(!showConstText)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>{showConstText ? '▼ Скрыть' : '▶ Раскрыть'} {rule.constitutionArticle} Конституции РФ</span>
                </button>
                {showConstText && (
                  <div className="mt-2 p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    <div className="font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                      {constArticle.chapterTitle} • Статья {constArticle.number}
                    </div>
                    {constArticle.text}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Футер */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Оставить как есть
          </button>
          <button
            type="button"
            onClick={() => {
              onApplyReplacement(detectedRisk);
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <span>Заменить в тексте</span>
            <span>✓</span>
          </button>
        </div>
      </div>
    </div>
  );
};
