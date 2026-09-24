// src/components/MeshRadar.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { MeshTransport } from '../utils/meshTransport';
import { PeerNode } from '../types/mesh';
import { Radio, MessageSquare, ShieldCheck, Zap } from 'lucide-react';

interface MeshRadarProps {
  currentUser: { uid: string; displayName?: string };
  socket?: any;
  onClose?: () => void;
  onOpenChat: (chatId: string, participant: { uid: string; displayName: string }) => void;
}

function getAngle(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export const MeshRadar: React.FC<MeshRadarProps> = ({ currentUser, onOpenChat }) => {
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<PeerNode | null>(null);

  useEffect(() => {
    // Подписываемся на живой список. Сканер уже работает в фоне 24/7!
    MeshTransport.setOnPeersChanged((updated) => {
      setPeers([...updated]);
    });

    // Получаем мгновенный снепшот узлов
    setPeers(MeshTransport.getPeers());

    // ВНИМАНИЕ: Никакого stopLEScan при размонтировании! Меш должен жить непрерывно.
  }, []);

  const handleOpenDirectChat = (peer: PeerNode) => {
    const chatId = [currentUser.uid, peer.uid].sort().join('_');
    onOpenChat(chatId, {
      uid: peer.uid,
      displayName: peer.name
    });
  };

  const nodesOnRadar = useMemo(() => {
    return peers.map((peer) => {
      const angleDeg = getAngle(peer.uid);
      const angleRad = (angleDeg * Math.PI) / 180;

      let radiusPercent = 22; // 1-й круг: Напрямую (1 хоп)
      if (peer.hops === 2) radiusPercent = 33; // 2-й круг: Транзит
      if (peer.hops >= 3) radiusPercent = 42; // 3-й круг: Меш-цепь

      const x = 50 + radiusPercent * Math.cos(angleRad);
      const y = 50 + radiusPercent * Math.sin(angleRad);

      return { ...peer, x, y };
    });
  }, [peers]);

  return (
    <div className="flex flex-col items-center p-4 bg-slate-950 text-slate-100 rounded-3xl border border-cyan-900/40 shadow-2xl max-w-md mx-auto w-full">
      {/* Заголовок */}
      <div className="w-full flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          <div>
            <h3 className="font-bold text-sm tracking-wide text-cyan-200">МЕШ-РАДАР ЦЕПЕЙ</h3>
            <p className="text-[10px] text-cyan-500 font-mono">АКТИВНЫЙ РАДИОЭФИР 24/7</p>
          </div>
        </div>
        <div className="text-xs bg-cyan-950/80 border border-cyan-700/50 px-2.5 py-1 rounded-full text-cyan-300 font-mono">
          РЯДОМ: <span className="font-bold text-cyan-400">{peers.length}</span>
        </div>
      </div>

      {/* Экран радара */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 my-2 rounded-full border border-cyan-500/30 bg-slate-900/90 overflow-hidden shadow-[inset_0_0_50px_rgba(6,182,212,0.15)]">
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[84%] h-[84%] rounded-full border border-cyan-500/20 border-dashed" />
          <span className="absolute top-2 text-[8px] font-mono text-cyan-600/80">3 ХОПА (МЕШ)</span>

          <div className="absolute w-[66%] h-[66%] rounded-full border border-cyan-500/30" />
          <span className="absolute top-11 text-[8px] font-mono text-cyan-500/80">2 ХОПА (ТРАНЗИТ)</span>

          <div className="absolute w-[44%] h-[44%] rounded-full border border-cyan-400/40 bg-cyan-950/20" />
          <span className="absolute top-20 text-[8px] font-mono text-cyan-400">1 ХОП (ПРЯМО)</span>

          <div className="absolute w-3.5 h-3.5 bg-cyan-400 rounded-full shadow-[0_0_12px_#22d3ee] flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-slate-950 rounded-full" />
          </div>
        </div>

        <div 
          className="absolute inset-0 pointer-events-none origin-center"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, transparent 310deg, rgba(6, 182, 212, 0.3) 360deg)',
            animation: 'radar-spin 4s linear infinite',
            borderRadius: '50%'
          }}
        />

        {nodesOnRadar.map((node) => {
          const isSelected = selectedPeer?.uid === node.uid;
          return (
            <button
              key={node.uid}
              onClick={() => setSelectedPeer(node)}
              onDoubleClick={() => handleOpenDirectChat(node)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 z-10 ${
                isSelected ? 'scale-125 z-20' : 'hover:scale-110'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shadow-lg ${
                node.hops === 1 
                  ? 'bg-emerald-500 border-white shadow-emerald-500/50' 
                  : node.hops === 2 
                    ? 'bg-cyan-500 border-cyan-200 shadow-cyan-500/50'
                    : 'bg-indigo-500 border-indigo-200 shadow-indigo-500/50'
              }`}>
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>

              <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-bold text-slate-200 pointer-events-none shadow-md">
                {node.name}
              </span>
            </button>
          );
        })}
      </div>

      {selectedPeer && (
        <div className="w-full mt-3 p-3 bg-slate-900 border border-cyan-500/40 rounded-2xl flex items-center justify-between animate-fadeIn">
          <div>
            <div className="font-bold text-sm text-cyan-200 flex items-center gap-1.5">
              <span>{selectedPeer.name}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Связь: {selectedPeer.hops === 1 ? 'Напрямую (1 хоп)' : `Цепочка (${selectedPeer.hops} хопа)`}
            </div>
          </div>

          <button
            onClick={() => handleOpenDirectChat(selectedPeer)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition active:scale-95 shadow-lg shadow-cyan-500/20"
          >
            <MessageSquare className="w-4 h-4" />
            Открыть чат
          </button>
        </div>
      )}

      {/* Список узлов для быстрого входа в чат */}
      <div className="w-full mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {peers.map((peer) => (
          <div
            key={peer.uid}
            onClick={() => handleOpenDirectChat(peer)}
            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-800/60 cursor-pointer transition"
          >
            <div className="flex items-center gap-2">
              <Zap className={`w-3.5 h-3.5 ${peer.hops === 1 ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span className="font-medium text-xs text-slate-200">{peer.name}</span>
            </div>
            <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {peer.hops === 1 ? '1 хоп' : `${peer.hops} хопа`}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes radar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
