import React, { useState, useEffect } from 'react';
import { MeshNode, UserProfile } from '../types';
import { calculateSignalQuality, estimateMeshPing, getQueuedMeshPackets, dequeueMeshPacket, QueuedMeshPacket } from '../lib/meshQueue';
import { getRelayPath } from '../lib/mesh';
import { playMeshNodeConnectSound } from '../lib/audio';
import { Activity, Wifi, Radio, Cpu, Send, RefreshCw, Trash2, CheckCircle2, ShieldAlert, ArrowRight, Zap, MapPin } from 'lucide-react';

interface MeshInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: MeshNode[];
  currentUser: UserProfile;
  onSendTestPacket?: (targetNodeId: string) => void;
}

interface PingResult {
  nodeId: string;
  pingMs: number;
  hops: number;
  status: 'ok' | 'timeout';
}

export const MeshInspectorModal: React.FC<MeshInspectorModalProps> = ({
  isOpen,
  onClose,
  nodes,
  currentUser,
  onSendTestPacket,
}) => {
  const [queuedPackets, setQueuedPackets] = useState<QueuedMeshPacket[]>([]);
  const [pings, setPings] = useState<Record<string, PingResult>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'topology' | 'nodes' | 'queue'>('topology');

  const currentUserNode = nodes.find(n => n.id === currentUser.uid);

  useEffect(() => {
    if (isOpen) {
      setQueuedPackets(getQueuedMeshPackets());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runDiagnostics = async () => {
    setIsTesting(true);
    playMeshNodeConnectSound();
    setPings({});

    const newPings: Record<string, PingResult> = {};

    for (const node of nodes) {
      if (node.id === currentUser.uid) continue;

      await new Promise(r => setTimeout(r, 120));

      if (!node.isOnline) {
        newPings[node.id] = { nodeId: node.id, pingMs: 0, hops: 0, status: 'timeout' };
        continue;
      }

      const path = getRelayPath(nodes, currentUser.uid, node.id);
      const hops = path ? path.length : 1;

      // Distance estimation
      let dist = 100;
      if (currentUserNode && currentUserNode.lat !== undefined && node.lat !== undefined) {
        const dx = (node.lng! - currentUserNode.lng!) * Math.cos((currentUserNode.lat! + node.lat!) / 2 * Math.PI / 180) * 111320;
        const dy = (node.lat! - currentUserNode.lat!) * 111000;
        dist = Math.sqrt(dx * dx + dy * dy);
      }

      const pingMs = estimateMeshPing(hops, dist);
      newPings[node.id] = { nodeId: node.id, pingMs, hops, status: 'ok' };
    }

    setPings(newPings);
    setIsTesting(false);
  };

  const handleClearPacket = (packetId: string) => {
    dequeueMeshPacket(packetId);
    setQueuedPackets(getQueuedMeshPackets());
  };

  const directPeersCount = nodes.filter(n => {
    if (n.id === currentUser.uid || !n.isOnline || !currentUserNode) return false;
    let dist = 0;
    if (currentUserNode.lat !== undefined && n.lat !== undefined) {
      const dx = (n.lng! - currentUserNode.lng!) * Math.cos((currentUserNode.lat! + n.lat!) / 2 * Math.PI / 180) * 111320;
      const dy = (n.lat! - currentUserNode.lat!) * 111000;
      dist = Math.sqrt(dx * dx + dy * dy);
    }
    return dist <= 1000;
  }).length;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Mesh Network Diagnostics & Inspector
              </h2>
              <p className="text-xs text-slate-400">
                Децентрализованная Mesh-сеть • Топология P2P и маршрутизация
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-3 pr-4 -mr-2 rounded-l-2xl rounded-r-md bg-slate-800/80 hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1 active:scale-95"
          >
            Закрыть
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900/80 border-b border-slate-800 text-xs">
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Activity className="w-3.5 h-3.5 text-blue-400" /> Всего узлов
            </div>
            <div className="text-lg font-bold text-white">{nodes.length}</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Прямые пиры
            </div>
            <div className="text-lg font-bold text-emerald-400">{directPeersCount}</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> В очереди (Mesh)
            </div>
            <div className="text-lg font-bold text-amber-400">{queuedPackets.length}</div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-purple-400" /> Ваш Mesh ID
            </div>
            <div className="text-xs font-mono font-bold text-indigo-300 truncate">
              {currentUser.meshKey ? currentUser.meshKey.substring(0, 10) + '...' : currentUser.uid.substring(0, 8)}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 gap-2">
          <button
            onClick={() => setActiveTab('topology')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 ${
              activeTab === 'topology'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Топология & Диагностика
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 ${
              activeTab === 'nodes'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Список узлов ({nodes.length})
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 ${
              activeTab === 'queue'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Буфер пакетов ({queuedPackets.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'topology' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-950/30 p-4 rounded-xl border border-indigo-500/20">
                <div>
                  <h3 className="text-sm font-bold text-indigo-200">Тестирование пинга и маршрутизации</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Проверить скорость задержки (Ping) и доступные скачки (Hops) до каждого узла сети.
                  </p>
                </div>
                <button
                  onClick={runDiagnostics}
                  disabled={isTesting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Тестирование...' : 'Запустить Пинг'}
                </button>
              </div>

              {Object.keys(pings).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(pings).map(([nodeId, res]) => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (!node) return null;

                    return (
                      <div
                        key={nodeId}
                        className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              res.status === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-xs text-white">{node.displayName}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>Скачки (Hops): {res.hops}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          {res.status === 'ok' ? (
                            <div className="font-mono font-bold text-xs text-emerald-400">{res.pingMs} ms</div>
                          ) : (
                            <div className="text-[10px] font-bold text-rose-400">Таймаут</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-slate-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" /> Принцип работы Mesh в Ordina
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Когда сервер недоступен, устройства обмениваются сообщениями напрямую по локальной сети или через промежуточные узлы (Store & Forward). Каждое сообщение шифруется ключом получателя и пересылается дальше.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="space-y-3">
              {nodes.map(node => {
                const isMe = node.id === currentUser.uid;

                let distMeters = 0;
                if (currentUserNode && currentUserNode.lat !== undefined && node.lat !== undefined) {
                  const dx = (node.lng! - currentUserNode.lng!) * Math.cos((currentUserNode.lat! + node.lat!) / 2 * Math.PI / 180) * 111320;
                  const dy = (node.lat! - currentUserNode.lat!) * 111000;
                  distMeters = Math.sqrt(dx * dx + dy * dy);
                }

                const signal = calculateSignalQuality(isMe ? 0 : distMeters);

                return (
                  <div
                    key={node.id}
                    className="p-3.5 bg-slate-800/40 hover:bg-slate-800/70 rounded-xl border border-slate-700/60 flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isMe ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : node.isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                        }`}
                      />
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          {node.displayName} {isMe && <span className="text-[10px] text-blue-400 font-medium">(Вы)</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{isMe ? 'Локальный узел' : `${Math.round(distMeters)}м от вас`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {!isMe && (
                        <div className="text-right">
                          <div className="text-[10px] font-bold" style={{ color: signal.color }}>
                            {signal.label} ({signal.dbm} dBm)
                          </div>
                          <div className="text-[10px] text-slate-500">{signal.percentage}% уровень</div>
                        </div>
                      )}

                      {!isMe && onSendTestPacket && (
                        <button
                          onClick={() => onSendTestPacket(node.id)}
                          className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition"
                          title="Отправить тестовый пакет"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-3">
              {queuedPackets.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                  Буфер пуст. Все Mesh-сообщения успешно доставлены.
                </div>
              ) : (
                queuedPackets.map(pkt => (
                  <div key={pkt.id} className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-200 truncate max-w-md">
                        {pkt.message.text || 'Медиа-файл'}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        <span>Цель: {pkt.targetId.substring(0, 8)}</span>
                        <span>•</span>
                        <span>Попыток: {pkt.attempts}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleClearPacket(pkt.id)}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                      title="Удалить из очереди"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
