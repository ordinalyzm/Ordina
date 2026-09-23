import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertCircle, Scale, X, ExternalLink, Info, CheckCircle2 } from 'lucide-react';
import { LegalScanResult, LegalRiskItem, scanTextForLegalRisks } from '../utils/legalCompliance';

interface LegalShieldInputBarProps {
  scanResult: LegalScanResult;
  onOpenDetails: () => void;
}

export const LegalShieldInputBar: React.FC<LegalShieldInputBarProps> = ({ scanResult, onOpenDetails }) => {
  if (!scanResult.hasRisk || scanResult.risks.length === 0) return null;

  const topRisk = scanResult.risks[0];
  const isHigh = scanResult.maxSeverity === 'high';

  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs rounded-xl border transition-all animate-in fade-in slide-in-from-bottom-1 ${
      isHigh 
        ? 'bg-red-50 text-red-700 border-red-200' 
        : 'bg-amber-50 text-amber-800 border-amber-200'
    }`}>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <ShieldAlert className={`w-4 h-4 shrink-0 ${isHigh ? 'text-red-500' : 'text-amber-500'}`} />
        <span className="font-semibold truncate">
          {topRisk.article}:
        </span>
        <span className="truncate opacity-90">
          {topRisk.title}
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenDetails}
        className={`px-2 py-0.5 text-[11px] font-medium rounded-lg transition-colors shrink-0 underline decoration-dotted underline-offset-2 ${
          isHigh 
            ? 'hover:bg-red-100 text-red-800' 
            : 'hover:bg-amber-100 text-amber-900'
        }`}
      >
        Подробнее
      </button>
    </div>
  );
};

export const LegalShieldInputWarning: React.FC<{ text: string; enabled?: boolean }> = ({ text, enabled = true }) => {
  const [showModal, setShowModal] = useState(false);
  if (!enabled || !text || text.trim().length < 3) return null;

  const result = scanTextForLegalRisks(text);
  if (!result.hasRisk || result.risks.length === 0) return null;

  return (
    <>
      <div className="px-2 pb-1.5">
        <LegalShieldInputBar scanResult={result} onOpenDetails={() => setShowModal(true)} />
      </div>
      <LegalShieldDetailsModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        scanResult={result} 
        text={text} 
      />
    </>
  );
};

interface LegalShieldMessageBadgeProps {
  scanResult?: LegalScanResult;
  text?: string;
  onClick?: () => void;
}

export const LegalShieldMessageBadge: React.FC<LegalShieldMessageBadgeProps> = ({ scanResult: propResult, text, onClick }) => {
  const [showModal, setShowModal] = useState(false);

  const scanResult = propResult || (text ? scanTextForLegalRisks(text) : null);
  if (!scanResult || !scanResult.hasRisk || scanResult.risks.length === 0) return null;

  const isHigh = scanResult.maxSeverity === 'high';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={`Правовой щит: возможное нарушение ${scanResult.risks.map(r => r.article).join(', ')}`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded-md text-[10px] font-semibold border shadow-2xs transition-transform active:scale-95 ${
          isHigh 
            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
        }`}
      >
        <Scale className="w-3 h-3" />
        <span>Правовой риск: {scanResult.risks[0].article}</span>
      </button>

      {!onClick && (
        <LegalShieldDetailsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          scanResult={scanResult}
          text={text}
        />
      )}
    </>
  );
};

interface LegalShieldDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanResult: LegalScanResult;
  text?: string;
}

export const LegalShieldDetailsModal: React.FC<LegalShieldDetailsModalProps> = ({
  isOpen,
  onClose,
  scanResult,
  text
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
              <Scale className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Правовой щит «Соучастник»</h3>
              <p className="text-xs text-slate-500">Автономный правовой советник (100% оффлайн)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              Этот инструмент помогает участникам Ордины вести безопасный диалог и избегать неосторожных высказываний, подпадающих под санкции УК и КоАП РФ. 
              <strong> Все проверки происходят строго на вашем телефоне/компьютере</strong>, текст никуда не сохраняется и не отправляется.
            </div>
          </div>

          {text && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Проверяемый фрагмент</span>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono break-all max-h-24 overflow-y-auto">
                {text}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Обнаруженные правовые риски ({scanResult.risks.length})
            </span>
            {scanResult.risks.map((risk) => (
              <div 
                key={risk.id}
                className={`p-3.5 rounded-xl border space-y-2 ${
                  risk.severity === 'high' 
                    ? 'bg-red-50/60 border-red-200 text-red-950' 
                    : 'bg-amber-50/60 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/80 border border-current shadow-2xs">
                    {risk.article}
                  </span>
                  <span className="text-[11px] font-semibold opacity-75 uppercase">
                    {risk.severity === 'high' ? 'Критический риск' : 'Умеренный риск'}
                  </span>
                </div>

                <div className="font-semibold text-xs leading-snug">
                  {risk.title}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {risk.description}
                </p>

                {risk.matchedKeywords.length > 0 && (
                  <div className="text-[11px] text-slate-500">
                    <span className="font-medium">Сработавшие маркеры: </span>
                    <span className="italic">{risk.matchedKeywords.join(', ')}</span>
                  </div>
                )}

                <div className="p-2.5 bg-white/90 rounded-lg border border-slate-200/80 text-xs text-slate-700 flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-900">Рекомендация: </span>
                    {risk.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            Можно отключить в настройках профиля
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            Понятно, спасибо
          </button>
        </div>
      </div>
    </div>
  );
};
