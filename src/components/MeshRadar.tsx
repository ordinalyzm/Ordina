// src/components/MeshRadar.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  ShieldCheck, 
  Share2, 
  AlertTriangle, 
  Wifi, 
  Smartphone, 
  QrCode, 
  Network,
  X,
  ArrowLeft,
  Activity,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { MeshNode, Message } from '../types';
import { useMeshNetwork } from '../hooks/useMeshNetwork';

interface MeshRadarProps {
  currentUser: { uid: string; displayName?: string };
  socket?: any;
  onClose?: () => void;
  onOpenInspector?: () => void;
  onMessageReceived?: (msg: Message) => void;
}

export const MeshRadar: React.FC<MeshRadarProps> = ({ 
  currentUser, 
  socket, 
  onClose,
  onOpenInspector,
  onMessageReceived
}) => {
  const { nodes, status, myNode, sendMeshBroadcast, sendDirectMeshMessage, connectToPeer } = useMeshNetwork(
    currentUser, 
    socket, 
    onMessageReceived
  );
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [sosSent, setSosSent] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [directMsgText, setDirectMsgText] = useState('');
  const [sentDirectSuccess, setSentDirectSuccess] = useState(false);

  const handleSosBroadcast = async () => {
    await sendMeshBroadcast('🚨 ВНИМАНИЕ: СИГНАЛ SOS / ЭКСТРЕННАЯ СВЯЗЬ (MESH)');
    setSosSent(true);
    setTimeout(() => setSosSent(false), 4000);
  };

  const copyPublicKey = () => {
    if (myNode.publicKey) {
      navigator.clipboard.writeText(myNode.publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleSendDirect = async () => {
    if (!selectedNode || !directMsgText.trim()) return;
    await sendDirectMeshMessage(selectedNode.id, directMsgText.trim());
    setDirectMsgText('');
    setSentDirectSuccess(true);
    setTimeout(() => setSentDirectSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-4 select-none relative overflow-hidden">
      {/* Шапка статуса */}
      <header className="flex justify-between items-center mb-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 backdrop-blur shrink-0 z-30">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition active:scale-95"
              title="Назад"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="relative">
            <Radio className={`w-6 h-6 ${status === 'connected' ? 'text-emerald-400' : 'text-cyan-400'} animate-pulse`} />
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 ${status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide flex items-center gap-1.5">
              P2P Mesh: Ордина <Network className="w-3.5 h-3.5 text-cyan-400" />
            </h2>
            <p className="text-xs text-slate-400">
              {status === 'connected' ? `Активных узлов: ${nodes.length}` : 'Сканирование эфира и WebRTC...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenInspector && (
            <button
              onClick={onOpenInspector}
              className="p-2 bg-indigo-950/60 border border-indigo-800/60 hover:bg-indigo-900/60 active:scale-95 transition rounded-xl text-indigo-300"
              title="Инспектор Mesh"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => setShowKeyModal(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 transition rounded-xl text-slate-300"
            title="Ключ ECDH"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button
            onClick={handleSosBroadcast}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-lg active:scale-95 ${
              sosSent ? 'bg-emerald-600 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {sosSent ? 'SOS Отправлен!' : 'SOS'}
          </button>
        </div>
      </header>

      {/* Экран кругового радара */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden my-auto w-full min-h-[300px]">
        {/* Концентрические кольца дистанции (Hops) */}
        <div className="absolute w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full border border-slate-800/80 border-dashed" />
        <div className="absolute w-[200px] h-[200px] sm:w-[230px] sm:h-[230px] rounded-full border border-slate-700/60" />
        <div className="absolute w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] rounded-full border border-cyan-500/20" />

        {/* Радиальные линии шкалы */}
        <div className="absolute w-full h-[1px] bg-slate-800/40 pointer-events-none" />
        <div className="absolute h-full w-[1px] bg-slate-800/40 pointer-events-none" />

        {/* Сканирующий световой луч */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
          className="absolute w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full pointer-events-none origin-center"
          style={{
            background: 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.25) 0deg, transparent 60deg, transparent 360deg)'
          }}
        />

        {/* Центр: Мой узел */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-11 h-11 rounded-full bg-cyan-950/80 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            <Smartphone className="w-5 h-5" />
          </div>
          <span className="text-[11px] text-cyan-400 mt-1.5 font-medium tracking-tight bg-slate-950/90 px-2 py-0.5 rounded-md border border-cyan-900/50">
            Я ({myNode.displayName || 'Me'})
          </span>
        </div>

        {/* Динамическое позиционирование найденных узлов */}
        {nodes.map((node, idx) => {
          const hopCount = node.hops || 1;
          const radius = Math.min(hopCount * 45 + 35, 135);
          const angle = (idx * (360 / Math.max(nodes.length, 1))) * (Math.PI / 180);
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={node.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, x, y }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.15 }}
              onClick={() => {
                setSelectedNode(node);
                connectToPeer(node);
              }}
              className="absolute z-20 cursor-pointer flex flex-col items-center group"
            >
              <div className="relative w-9 h-9 rounded-full bg-slate-900 border border-emerald-500/80 flex items-center justify-center text-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.35)]">
                <Wifi className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <span className="text-[10px] font-medium bg-slate-900/95 border border-slate-800 px-2 py-0.5 rounded-md text-slate-200 mt-1 shadow-md whitespace-nowrap">
                {node.displayName || node.id.slice(0, 8)} ({hopCount}h)
              </span>
            </motion.div>
          );
        })}

        {nodes.length === 0 && (
          <div className="absolute bottom-4 text-center px-4 pointer-events-none z-10">
            <p className="text-xs text-slate-500">
              Ожидание соседних пиров по WebRTC и локальной сети...
            </p>
          </div>
        )}
      </div>

      {/* Информационная панель выбранного узла */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="mt-3 p-4 bg-slate-900/95 border border-slate-800 rounded-2xl flex flex-col gap-2.5 z-30 shrink-0 shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-xs text-slate-200">{selectedNode.displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                  {selectedNode.hops || 1} hop(s)
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <p className="text-[11px] text-slate-400 truncate">
              UID: {selectedNode.id} • {selectedNode.publicKey ? 'ECDH P-256 E2EE Защита' : 'Шифрование по умолчанию'}
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={directMsgText}
                onChange={(e) => setDirectMsgText(e.target.value)}
                placeholder="Зашифрованное P2P сообщение..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendDirect()}
                className="flex-1 bg-slate-950 border border-slate-700 text-xs text-white px-3 py-2 rounded-xl focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleSendDirect}
                disabled={!directMsgText.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-3 py-2 rounded-xl text-xs font-semibold text-white shadow active:scale-95 transition"
              >
                Отправить
              </button>
            </div>

            {sentDirectSuccess && (
              <p className="text-[11px] text-emerald-400 font-medium">
                ✓ Пакет успешно направлен в Mesh-маршрутизатор!
              </p>
            )}

            <div className="flex gap-2 mt-0.5">
              <button
                onClick={() => sendMeshBroadcast(`Привет от ${myNode.displayName}!`)}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-white shadow active:scale-95 transition"
              >
                <Share2 className="w-3.5 h-3.5" /> Быстрый P2P пинг
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модальное окно публичного ключа E2EE */}
      <AnimatePresence>
        {showKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full text-slate-100 flex flex-col gap-3 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  E2EE Публичный Ключ (ECDH P-256)
                </h3>
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Используется для создания сквозного симметричного секрета AES-GCM 256-bit при передаче сообщений через сторонние узлы Mesh-сети.
              </p>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 break-all max-h-36 overflow-y-auto">
                {myNode.publicKey || 'Генерация ключа...'}
              </div>
              <button
                onClick={copyPublicKey}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition"
              >
                {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedKey ? 'Скопировано в буфер!' : 'Скопировать открытый ключ'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
