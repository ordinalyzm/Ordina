import React, { useState } from 'react';
import { Download, Copy, Check, Upload, FileCode, X, Terminal, Code2, Sparkles, FileText } from 'lucide-react';
import { BotConfig } from './BotConstructor';
import { generateBotPython, generateBotTypeScript, generateBotJson, parseBotFromTelegramCode } from '../utils/botCodeTransformer';

interface BotCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  bot: BotConfig | null;
  mode: 'export' | 'import';
  onImport: (importedBot: BotConfig) => void;
}

export const BotCodeModal: React.FC<BotCodeModalProps> = ({
  isOpen,
  onClose,
  bot,
  mode,
  onImport
}) => {
  const [activeTab, setActiveTab] = useState<'python' | 'typescript' | 'json'>('python');
  const [copied, setCopied] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [importPreviewCount, setImportPreviewCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentBot: BotConfig = bot || {
    id: 'new_bot',
    name: 'Новый бот',
    isActive: true,
    triggers: [],
    conditions: [],
    actions: [],
    rules: []
  };

  const getExportCode = () => {
    if (activeTab === 'python') return generateBotPython(currentBot);
    if (activeTab === 'typescript') return generateBotTypeScript(currentBot);
    return generateBotJson(currentBot);
  };

  const handleCopy = () => {
    const code = getExportCode();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = getExportCode();
    const ext = activeTab === 'python' ? 'py' : activeTab === 'typescript' ? 'ts' : 'json';
    const filename = `${(currentBot.name || 'bot').toLowerCase().replace(/\s+/g, '_')}.${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setImportInput(text);
        const parsed = parseBotFromTelegramCode(text, currentBot);
        setImportPreviewCount(parsed.importedRulesCount);
      }
    };
    reader.readAsText(file);
  };

  const handleRunImport = () => {
    if (!importInput.trim()) return;
    const { bot: finalBot, importedRulesCount } = parseBotFromTelegramCode(importInput, currentBot);
    onImport(finalBot);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              {mode === 'export' ? <FileCode className="w-5 h-5 text-blue-600" /> : <Upload className="w-5 h-5 text-indigo-600" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {mode === 'export' ? `Экспорт кода: ${currentBot.name}` : 'Импорт бота из Telegram / Кода'}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === 'export' 
                  ? 'Скачайте готовый код для Telegram или переноса на сервер' 
                  : 'Вставьте код aiogram/telebot, JSON или список команд BotFather'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Export Mode */}
        {mode === 'export' ? (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
            {/* Tab switch */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setActiveTab('python')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    activeTab === 'python' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Python (aiogram 3.x)
                </button>
                <button
                  onClick={() => setActiveTab('typescript')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    activeTab === 'typescript' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  TypeScript / Node.js
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    activeTab === 'json' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  JSON (Ордина)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Скопировано!' : 'Копировать'}
                </button>

                <button
                  onClick={handleDownload}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Скачать .{activeTab === 'python' ? 'py' : activeTab === 'typescript' ? 'ts' : 'json'}
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div className="flex-1 bg-slate-900 rounded-2xl p-4 overflow-auto font-mono text-xs text-slate-200 border border-slate-800 shadow-inner">
              <pre className="whitespace-pre">{getExportCode()}</pre>
            </div>
          </div>
        ) : (
          /* Import Mode */
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Вставьте исходный код бота (Python aiogram / telebot, Node.js или JSON):
              </label>

              <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Загрузить файл</span>
                <input 
                  type="file" 
                  accept=".py,.js,.ts,.json,.txt" 
                  onChange={handleFileUpload}
                  className="hidden" 
                />
              </label>
            </div>

            <textarea
              placeholder={`Пример: вставьте код из Telegram-бота:
@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer("Привет! Чем могу помочь?")

Или список команд BotFather:
start - Главное меню
help - Помощь
price - Прайс-лист`}
              value={importInput}
              onChange={(e) => {
                setImportInput(e.target.value);
                if (e.target.value.trim().length > 10) {
                  const parsed = parseBotFromTelegramCode(e.target.value, currentBot);
                  setImportPreviewCount(parsed.importedRulesCount);
                } else {
                  setImportPreviewCount(null);
                }
              }}
              className="flex-1 min-h-[220px] p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />

            {importPreviewCount !== null && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                <span>Обнаружено команд/правил для переноса: <strong>{importPreviewCount} шт.</strong></span>
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!importInput.trim()}
                onClick={handleRunImport}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Импортировать в Ордину
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
