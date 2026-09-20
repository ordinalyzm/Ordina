import React, { useEffect, useState, useMemo } from 'react';
import { MeshTransport, DiscoveredPeer } from '../utils/meshTransport';
import { MessageSquare, Radio, X, RefreshCw, Shield, Wifi, WifiOff } from 'lucide-react';

interface MeshRadarProps {
  currentUser: { uid: string; displayName?: string };
  socket?: any;
  onClose?: () => void;
  onOpenInspector?: () => void;
  onOpenChat?: (chatId: string, participant: { uid: string; displayName: string }) => void;
  onMessageReceived?: (msg: any) => void;
}

// Deterministic angle from peer ID/MAC (0 to 2*PI)
function getStableAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash) % 360;
  return (normalized * Math.PI) / 180;
}

// Convert RSSI (-30 dBm to -95 dBm) to radius percent (15% to 45% of radar circle)
function rssiToRadiusPercent(rssi: number): number {
  const clamped = Math.max(-95, Math.min(-35, rssi));
  // -35 dBm is very close (~15%), -95 dBm is outer edge (~44%)
  const ratio = (clamped - (-35)) / (-95 - (-35));
  return 15 + ratio * 29;
}

// Rough distance approximation from RSSI
function rssiToDistanceLabel(rssi: number): string {
  if (rssi >= -50) return '~1-3 м';
  if (rssi >= -65) return '~4-8 м';
  if (rssi >= -80) return '~10-20 м';
  return '~25+ м';
}

export const MeshRadar: React.FC<MeshRadarProps> = ({ 
  currentUser, 
  onClose,
  onOpenInspector,
  onOpenChat 
}) => {
  const [peers, setPeers] = useState<DiscoveredPeer[]>(() => MeshTransport.getPeers());
  const [resolvingMac, setResolvingMac] = useState<string | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<DiscoveredPeer | null>(null);

  useEffect(() => {
    MeshTransport.setOnPeersChanged((updatedPeers) => {
      setPeers([...updatedPeers]);
    });

    MeshTransport.startDiscovery();
  }, []);

  const handleConnect = async (peer: DiscoveredPeer) => {
    setResolvingMac(peer.mac);
    try {
      const realUid = peer.isResolved ? peer.id : await MeshTransport.resolvePeerUid(peer.mac);
      const chatId = [currentUser.uid, realUid].sort().join('_');

      if (onOpenChat) {
        onOpenChat(chatId, {
          uid: realUid,
          displayName: peer.name
        });
      } else {
        window.dispatchEvent(new CustomEvent('ordina:open_chat', {
          detail: { chatId, participant: { uid: realUid, displayName: peer.name } }
        }));
      }
      if (onClose) onClose();
    } finally {
      setResolvingMac(null);
    }
  };

  // Calculate peer positions on the radar circle
  const radarNodes = useMemo(() => {
    return peers.map(peer => {
      const angle = getStableAngle(peer.mac || peer.id);
      const radiusPercent = rssiToRadiusPercent(peer.rssi || -75);
      // Center is at 50%, 50%
      const x = 50 + radiusPercent * Math.cos(angle);
      const y = 50 + radiusPercent * Math.sin(angle);
      return {
        peer,
        x,
        y,
        distance: rssiToDistanceLabel(peer.rssi || -75)
      };
    });
  }, [peers]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white select-none overflow-hidden">
      {/* CSS for rotating sweep beam */}
      <style>{`
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .radar-sweep-beam {
          animation: radarSweep 4s linear infinite;
          transform-origin: center center;
        }
      `}</style>

      {/* Header bar */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-2.5">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition active:scale-95 md:hidden"
              title="Закрыть"
            >
              <X size={18} />
            </button>
          )}
          <div className="relative">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              Тактический Радиоэфир
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/80 px-2 py-0.5 rounded-full font-mono">
                BLE MESH
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Офлайн обнаружение узлов поблизости (RSSI)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenInspector && (
            <button
              onClick={onOpenInspector}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 text-xs transition active:scale-95"
              title="Инспектор связи"
            >
              <Shield size={16} />
            </button>
          )}
          <button
            onClick={() => MeshTransport.startDiscovery()}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-800 text-xs transition active:scale-95"
            title="Обновить эфир"
          >
            <RefreshCw size={16} />
          </button>
          <span className="text-xs bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 px-3 py-1 rounded-xl font-mono font-bold">
            {peers.length} {peers.length === 1 ? 'узел' : 'узлов'}
          </span>
        </div>
      </div>

      {/* Main Radar Display Viewport */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-3 space-y-3">
        {/* Circular Tactical Radar Screen */}
        <div className="relative w-full max-w-sm mx-auto aspect-square rounded-3xl bg-[#030712] border border-cyan-900/30 overflow-hidden shadow-2xl flex items-center justify-center p-4 shrink-0">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:20px_20px] opacity-10" />

          {/* Coordinate Axes */}
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/20" />
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/20" />

          {/* Concentric Range Rings */}
          {/* Ring 1 - Inner (Near) */}
          <div className="absolute w-[30%] h-[30%] rounded-full border border-dashed border-cyan-500/30 pointer-events-none" />
          {/* Ring 2 - Mid */}
          <div className="absolute w-[60%] h-[60%] rounded-full border border-cyan-500/25 pointer-events-none" />
          {/* Ring 3 - Outer Edge */}
          <div className="absolute w-[90%] h-[90%] rounded-full border border-cyan-500/40 pointer-events-none shadow-[0_0_20px_rgba(6,182,212,0.1)]" />

          {/* Range Distance Labels */}
          <span className="absolute top-[36%] right-[52%] text-[8px] font-mono text-cyan-600/70 select-none">3m</span>
          <span className="absolute top-[21%] right-[52%] text-[8px] font-mono text-cyan-600/70 select-none">10m</span>
          <span className="absolute top-[6%] right-[52%] text-[8px] font-mono text-cyan-600/70 select-none">25m</span>

          {/* Rotating Radar Sweep Beam */}
          <div 
            className="absolute inset-[5%] rounded-full radar-sweep-beam pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.25) 0deg, rgba(6, 182, 212, 0.05) 45deg, transparent 90deg, transparent 360deg)'
            }}
          />

          {/* Center User Dot (YOU) */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_12px_#06b6d4] border-2 border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
            <span className="text-[9px] font-mono font-bold text-cyan-300 mt-1 uppercase tracking-wider">
              ВЫ
            </span>
          </div>

          {/* Detected Peer Markers on Radar */}
          {radarNodes.map(({ peer, x, y, distance }) => {
            const isSelected = selectedPeer?.mac === peer.mac;
            return (
              <div
                key={peer.mac}
                onClick={() => setSelectedPeer(peer)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              >
                {/* Ping pulse */}
                <span className="absolute -inset-1.5 rounded-full bg-emerald-400/40 animate-ping" />
                {/* Node blip dot */}
                <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${
                  isSelected 
                    ? 'bg-amber-400 border-white shadow-[0_0_15px_#f59e0b] scale-125' 
                    : peer.isResolved 
                    ? 'bg-emerald-400 border-emerald-200 shadow-[0_0_10px_#10b981]' 
                    : 'bg-cyan-400 border-cyan-200 shadow-[0_0_10px_#06b6d4]'
                }`}>
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
                {/* Node callsign label */}
                <div className="absolute left-1/2 -translate-x-1/2 top-4 px-1.5 py-0.5 bg-slate-900/90 border border-slate-700/80 rounded text-[9px] font-mono text-slate-200 whitespace-nowrap pointer-events-none group-hover:scale-105 transition">
                  {peer.name || peer.mac.slice(-5)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Peer Action Card (if any selected on radar) */}
        {selectedPeer && (
          <div className="p-3.5 bg-cyan-950/40 border border-cyan-700/50 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-sm text-cyan-200 truncate">{selectedPeer.name}</span>
                {selectedPeer.isResolved && (
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                    UID
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                MAC: {selectedPeer.mac} • RSSI: {selectedPeer.rssi} dBm ({rssiToDistanceLabel(selectedPeer.rssi)})
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedPeer(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              >
                <X size={16} />
              </button>
              <button
                onClick={() => handleConnect(selectedPeer)}
                disabled={resolvingMac === selectedPeer.mac}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
              >
                <MessageSquare size={14} />
                {resolvingMac === selectedPeer.mac ? 'Связь...' : 'Чат'}
              </button>
            </div>
          </div>
        )}

        {/* List of Detected Nodes in Air */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Узлы в радиусе действия
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Обновление в реальном времени
            </span>
          </div>

          {peers.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/50 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mb-3">
                <WifiOff size={22} className="animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-slate-200">Поиск радиомаяков Ordina...</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Включите Bluetooth. Устройства с приложением Ordina Mesh обнаружатся автоматически даже без интернета.
              </p>
            </div>
          ) : (
            peers.map((peer) => {
              const isConnecting = resolvingMac === peer.mac;
              const isSelected = selectedPeer?.mac === peer.mac;
              return (
                <div
                  key={peer.mac}
                  onClick={() => setSelectedPeer(peer)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-500/80 shadow-md'
                      : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        {peer.name}
                      </span>
                      {peer.isResolved && (
                        <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded shrink-0 font-mono">
                          UID READY
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-2">
                      <span>{peer.mac}</span>
                      <span>•</span>
                      <span className="text-cyan-400 font-semibold">{peer.rssi} dBm</span>
                      <span>({rssiToDistanceLabel(peer.rssi)})</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnect(peer);
                    }}
                    disabled={isConnecting}
                    className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition active:scale-95 shrink-0 shadow-md shadow-cyan-600/20"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {isConnecting ? 'Связь...' : 'Написать'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MeshRadar;
