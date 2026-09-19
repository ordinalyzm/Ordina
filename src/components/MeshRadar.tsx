// src/components/MeshRadar.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Radio, Wifi, Bluetooth, MessageSquare, Briefcase, Zap, X, Shield, RefreshCw, Send, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { MeshRouter } from '../utils/meshRouter';
import { MeshTransport } from '../utils/meshTransport';
import { MeshNode } from '../types';

interface MeshRadarProps {
  currentUser: { uid: string; displayName?: string };
  socket?: any;
  onClose?: () => void;
  onOpenInspector?: () => void;
  onOpenChat?: (chatId: string, participant: { uid: string; displayName: string }) => void;
  onMessageReceived?: (msg: any) => void;
}

export const MeshRadar: React.FC<MeshRadarProps> = ({ 
  currentUser, 
  onClose,
  onOpenInspector,
  onOpenChat,
  onMessageReceived 
}) => {
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [muleCount, setMuleCount] = useState(0);
  const [testText, setTestText] = useState('');
  const [activeTestNodeId, setActiveTestNodeId] = useState<string | null>(null);
  const [sendingNodeId, setSendingNodeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = MeshRouter.getInstance();

  const handleSendDirect = async (node: MeshNode) => {
    if (!testText.trim()) return;

    setSendingNodeId(node.id);
    const packet = {
      id: `${currentUser.uid}_${Date.now()}`,
      senderId: currentUser.uid,
      receiverId: node.id,
      text: testText.trim(),
      createdAt: new Date().toISOString()
    };

    const success = await MeshTransport.sendDirectMessage(node.id, packet);
    setSendingNodeId(null);
    if (success) {
      setFeedback({ type: 'success', text: 'Сообщение передано напрямую по Bluetooth!' });
      setTestText('');
      setActiveTestNodeId(null);
    } else {
      setFeedback({ type: 'error', text: 'Сбой передачи по радиоканалу' });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    if (!currentUser?.uid) return;
    router.init(currentUser.uid, currentUser.displayName || 'Пользователь', navigator.onLine);
    
    let lastUpdate = 0;
    let pendingTimer: any = null;

    const unsubscribeNodes = router.subscribe((updatedNodes) => {
      const now = Date.now();
      // Обновляем радар НЕ чаще, чем раз в 800 миллисекунд для устранения фризов (Choreographer)
      if (now - lastUpdate > 800) {
        lastUpdate = now;
        setNodes(updatedNodes);
        setMuleCount(router.getMuleCount());
      } else if (!pendingTimer) {
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          lastUpdate = Date.now();
          setNodes(router.getNodes());
          setMuleCount(router.getMuleCount());
        }, Math.max(50, 800 - (now - lastUpdate)));
      }
    });

    const unsubscribeMsg = router.onMessage((msg) => {
      if (onMessageReceived) {
        onMessageReceived(msg);
      }
    });

    return () => {
      if (pendingTimer) clearTimeout(pendingTimer);
      unsubscribeNodes();
      unsubscribeMsg();
    };
  }, [currentUser?.uid, currentUser?.displayName, onMessageReceived]);

  const handleOpenDirectChat = async (peerId: string, peerName: string) => {
    let targetUid = peerId;
    // Если это MAC адрес — запрашиваем реальный UID собеседника по BLE рукопожатию
    if (peerId.includes(':')) {
      try {
        setFeedback({ type: 'success', text: 'Связывание с узлом по радиоканалу BLE...' });
        targetUid = await MeshTransport.resolvePeerUid(peerId);
      } catch (e) {
        console.error('UID resolve error:', e);
      }
    }

    const chatId = [currentUser.uid, targetUid].sort().join('_');
    const cleanName = peerName && !peerName.includes(peerId)
      ? peerName
      : `Узел [${targetUid.slice(0, 5)}]`;

    const participant = { uid: targetUid, displayName: cleanName };
    if (onOpenChat) {
      onOpenChat(chatId, participant);
    } else {
      // Dispatch custom event for App.tsx navigation
      window.dispatchEvent(new CustomEvent('ordina:open_chat', {
        detail: { chatId, participant }
      }));
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Шапка эфира */}
      <header className="p-4 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition active:scale-95"
            >
              <X size={20} />
            </button>
          )}
          <div className="relative">
            <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-slate-200">
              Mesh-Эфир (Офлайн)
            </h2>
            <p className="text-[11px] text-slate-400">
              BLE + Wi-Fi Direct + Шлюз цепочек
            </p>
          </div>
        </div>

        {/* Индикатор почтальона без бага с размножением */}
        <div className="flex items-center gap-2">
          {onOpenInspector && (
            <button
              onClick={onOpenInspector}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs transition active:scale-95"
              title="Инспектор пакетов"
            >
              <Shield className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono text-cyan-300">
            <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
            <span>Сумка: {muleCount}</span>
          </div>
        </div>
      </header>

      {/* Верхняя половина: Радар эфира */}
      <div className="relative h-64 flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 shrink-0">
        {/* Кольца дальности радиосигнала */}
        <div className="absolute w-56 h-56 rounded-full border border-slate-800 border-dashed" />
        <div className="absolute w-40 h-40 rounded-full border border-cyan-500/20" />
        <div className="absolute w-24 h-24 rounded-full border border-cyan-500/40" />

        {/* Сканирующий световой луч */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
          className="absolute w-56 h-56 rounded-full pointer-events-none origin-center"
          style={{
            background: 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.25) 0deg, transparent 60deg, transparent 360deg)'
          }}
        />

        {/* Центр: Мой узел */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <Zap className="w-5 h-5" />
          </div>
          <span className="text-[10px] text-cyan-400 mt-1 font-mono font-bold">Я</span>
        </div>

        {/* Точки устройств на радаре */}
        {nodes.map((node, idx) => {
          const angle = (idx * (360 / Math.max(nodes.length, 1))) * (Math.PI / 180);
          const radius = node.rssi ? Math.min(Math.max((-node.rssi - 30) * 1.5, 45), 105) : 75;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={node.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1, x, y }}
              className="absolute z-20 flex flex-col items-center cursor-pointer group"
              onClick={() => handleOpenDirectChat(node.id, node.displayName)}
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform">
                <Bluetooth className="w-4 h-4" />
              </div>
              <span className="text-[9px] bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-800 text-slate-200 mt-1 font-mono max-w-[80px] truncate shadow">
                {node.displayName}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Нижняя половина: Список обнаруженных узлов и вход в чат */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
        <div className="flex justify-between items-center mb-2 shrink-0">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            В зоне радиовидимости ({nodes.length})
          </h3>
          <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Сканирование активно
          </span>
        </div>

        {/* Уведомление о передаче */}
        {feedback && (
          <div className={`mb-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-950/70 border-rose-500/40 text-rose-300'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {nodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-8">
              <Radio className="w-8 h-8 mb-2 opacity-30 animate-pulse text-cyan-400" />
              <p className="font-medium text-slate-400">Нет устройств в зоне радиовидимости.</p>
              <p className="text-[11px] text-slate-500 mt-1 text-center max-w-xs leading-relaxed">
                Убедитесь, что на втором устройстве включен Bluetooth или подключитесь к одной сети Wi-Fi / раздаче точки доступа.
              </p>
            </div>
          ) : (
            nodes.map((node) => (
              <div
                key={node.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 p-3 rounded-2xl flex flex-col gap-2 transition group shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shrink-0">
                      <Wifi className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition truncate">
                        {node.displayName}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        ID: {node.id.slice(0, 8)}... | {node.rssi ? `${node.rssi} dBm` : 'Прямой эфир'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button
                      onClick={() => setActiveTestNodeId(activeTestNodeId === node.id ? null : node.id)}
                      className="bg-slate-800 hover:bg-slate-700 text-cyan-300 active:scale-95 px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-cyan-500/30 transition"
                      title="Тест прямой передачи по BLE"
                    >
                      <Zap className="w-3.5 h-3.5" /> BLE
                    </button>
                    <button
                      onClick={() => handleOpenDirectChat(node.id, node.displayName)}
                      className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-white shadow-lg shadow-cyan-900/20"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Написать
                    </button>
                  </div>
                </div>

                {/* Раскрывающийся блок прямой отправки по Bluetooth без интернета */}
                {activeTestNodeId === node.id && (
                  <div className="mt-1 pt-2 border-t border-slate-800/80 flex items-center gap-2">
                    <input
                      type="text"
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendDirect(node);
                      }}
                      placeholder="Тестовое сообщение в эфир..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => handleSendDirect(node)}
                      disabled={!testText.trim() || sendingNodeId === node.id}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-95 px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 shadow"
                    >
                      {sendingNodeId === node.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Передать
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
