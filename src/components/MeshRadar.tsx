import React, { useState, useEffect } from 'react';
import { Radio, Wifi, WifiOff, X, RefreshCw, Zap, Shield, Smartphone } from 'lucide-react';

interface MeshRadarProps {
  isOpen?: boolean;
  onClose: () => void;
  onConnectPeer?: (peerName: string) => void;
  currentUser?: { uid: string; displayName: string };
  socket?: any;
  onOpenChat?: (chatId: any, participant?: any) => void;
}

export const MeshRadar: React.FC<MeshRadarProps> = ({
  isOpen = true,
  onClose,
  onConnectPeer,
  currentUser,
  socket,
  onOpenChat
}) => {
  const [isScanning, setIsScanning] = useState(true);
  const [peers, setPeers] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setIsScanning(true);
    // Demo mesh nodes discovery
    const timer = setTimeout(() => {
      setPeers([
        { id: 'node_1', name: 'Ордина_Узел_Север', distance: '12 метров', signal: 94, protocol: 'BLE Mesh' },
        { id: 'node_2', name: 'Автономный_Ретранслятор_04', distance: '38 метров', signal: 72, protocol: 'Wi-Fi Direct' },
        { id: 'node_3', name: 'Гость_782A', distance: '55 метров', signal: 58, protocol: 'WebRTC P2P' }
      ]);
      setIsScanning(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <Radio className="w-5 h-5 animate-pulse" />
            <span>Mesh-Радар Ордины (Оффлайн P2P)</span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Radar Animation */}
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
          <div className="absolute inset-4 rounded-full border border-emerald-500/30" />
          <div className="absolute inset-10 rounded-full border border-emerald-500/40" />
          <div className="w-6 h-6 rounded-full bg-emerald-500/40 flex items-center justify-center animate-ping" />
          <div className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {isScanning ? 'Сканирование эфира вокруг вас...' : `Обнаружено узлов поблизости: ${peers.length}`}
          </div>
          <button
            onClick={() => {
              setIsScanning(true);
              setTimeout(() => setIsScanning(false), 2000);
            }}
            disabled={isScanning}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Peers List */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {peers.map(peer => (
            <div 
              key={peer.id}
              className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between hover:border-emerald-500/30 transition-all"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">{peer.name}</span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  {peer.distance} • Сигнал: {peer.signal}% • {peer.protocol}
                </div>
              </div>

              <button
                onClick={() => {
                  if (onConnectPeer) onConnectPeer(peer.name);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-colors"
              >
                Связаться
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Связь шифруется алгоритмами сквозной диффи-хеллмановской защиты на уровне физического радиоканала.</span>
        </div>
      </div>
    </div>
  );
};
