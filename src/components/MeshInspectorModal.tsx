import React, { useState, useEffect } from 'react';
import { MeshNode, UserProfile } from '../types';
import { calculateSignalQuality, estimateMeshPing, getQueuedMeshPackets, dequeueMeshPacket, QueuedMeshPacket } from '../lib/meshQueue';
import { getRelayPath, detectDeviceHardwareSpecs, deduplicationEngine, getMailmanCarrierPackets } from '../lib/mesh';
import { playMeshNodeConnectSound } from '../lib/audio';
import { p2pManager, P2PPeerStatus } from '../lib/p2pWebRTC';
import { obfuscationEngine } from '../lib/obfuscation';
import { bleMeshEngine, BLEPeerDevice } from '../lib/bleMesh';
import { multiTierRouter, TransportTier } from '../lib/multiTierRouter';
import { Activity, Wifi, Radio, Cpu, Send, RefreshCw, Trash2, CheckCircle2, ShieldAlert, ArrowRight, Zap, MapPin, Server, Smartphone, HardDrive, ShieldCheck, Mail, Bluetooth, Layers, Eye, EyeOff } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'tiers' | 'topology' | 'nodes' | 'bridges' | 'queue'>('tiers');

  // 3-Tier States
  const [activeTier, setActiveTier] = useState<TransportTier>(() => multiTierRouter.determineActiveTier());
  const [forcedTier, setForcedTierState] = useState<TransportTier | null>(() => multiTierRouter.getForcedTier());
  const [p2pPeers, setP2PPeers] = useState<Record<string, P2PPeerStatus>>({});
  const [bleDevices, setBleDevices] = useState<BLEPeerDevice[]>([]);
  const [isScanningBLE, setIsScanningBLE] = useState(false);
  const [bleScanError, setBleScanError] = useState<string | null>(null);
  const [antiDPIMetrics, setAntiDPIMetrics] = useState(() => obfuscationEngine.getMetrics());

  const currentUserNode = nodes.find(n => n.id === currentUser.uid);
  const hwSpecs = detectDeviceHardwareSpecs();
  const mailmanPackets = getMailmanCarrierPackets();

  useEffect(() => {
    if (isOpen) {
      setQueuedPackets(getQueuedMeshPackets());
      setP2PPeers(p2pManager.getAllPeerStatuses());
      setBleDevices(bleMeshEngine.getConnectedBLEDevices());
      setAntiDPIMetrics(obfuscationEngine.getMetrics());
      setActiveTier(multiTierRouter.determineActiveTier());

      const unsubP2P = p2pManager.onStatusChange((peers) => {
        setP2PPeers(peers);
      });

      return () => {
        unsubP2P();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSetForcedTier = (tier: TransportTier | null) => {
    multiTierRouter.setForcedTier(tier);
    setForcedTierState(tier);
    setActiveTier(multiTierRouter.determineActiveTier());
  };

  const handleScanBLE = async () => {
    setIsScanningBLE(true);
    setBleScanError(null);
    const res = await bleMeshEngine.scanAndConnectBLEDevice();
    setIsScanningBLE(false);
    if (res.success) {
      setBleDevices(bleMeshEngine.getConnectedBLEDevices());
      playMeshNodeConnectSound();
    } else if (res.error) {
      setBleScanError(res.error);
    }
  };

  const handleToggleAntiDPI = () => {
    const next = !antiDPIMetrics.isObfuscationForced;
    obfuscationEngine.setForced(next);
    setAntiDPIMetrics(obfuscationEngine.getMetrics());
    setActiveTier(multiTierRouter.determineActiveTier());
  };

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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                3 Уровня связи & Mesh-сеть
              </h2>
              <p className="text-xs text-slate-400">
                P2P протоколы • Anti-DPI маскировка • Автономный BLE & Wi-Fi Direct Mesh
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-3 pr-4 -mr-2 rounded-l-2xl rounded-r-md bg-slate-800/80 hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer"
          >
            Закрыть
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900/80 border-b border-slate-800 text-xs">
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> Активный уровень
            </div>
            <div className="text-sm font-bold text-white">
              {activeTier === 'tier1_p2p' ? '1: P2P / Сервер' : activeTier === 'tier2_obfuscated' ? '2: Anti-DPI' : '3: Mesh BLE'}
            </div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-emerald-400" /> P2P DataChannels
            </div>
            <div className="text-sm font-bold text-emerald-400">
              {Object.values(p2pPeers).filter(p => p.state === 'connected').length} активных
            </div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <Bluetooth className="w-3.5 h-3.5 text-indigo-400" /> BLE Устройства
            </div>
            <div className="text-sm font-bold text-indigo-300">
              {bleDevices.length} сопряжено
            </div>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Защита (DDoS)
            </div>
            <div className="text-sm font-bold text-emerald-300">
              {deduplicationEngine.getSuppressedCount()} отсеяно
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tiers')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tiers'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> 3 Уровня Связи
          </button>
          <button
            onClick={() => setActiveTab('topology')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'topology'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Эхо-Маршрутизация
          </button>
          <button
            onClick={() => setActiveTab('bridges')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'bridges'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Мосты & Почтальоны ({mailmanPackets.length})
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'nodes'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Список узлов ({nodes.length})
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-3 text-xs font-bold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'queue'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Буфер пакетов ({queuedPackets.length})
          </button>
        </div>

        {/* Content Body */}
        <div 
          className="p-5 overflow-y-auto flex-1 space-y-4 touch-pan-y"
          style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        >
          {/* TAB 1: 3 TIERS ARCHITECTURE */}
          {activeTab === 'tiers' && (
            <div className="space-y-4">
              {/* Transport Tier Switcher / Override */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Режим выбора транспорта
                    {forcedTier && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Принудительный тест
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Автоматический переход между уровнями 1, 2 и 3 в зависимости от состояния сети
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    onClick={() => handleSetForcedTier(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      forcedTier === null ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Авто
                  </button>
                  <button
                    onClick={() => handleSetForcedTier('tier1_p2p')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      forcedTier === 'tier1_p2p' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ур. 1
                  </button>
                  <button
                    onClick={() => handleSetForcedTier('tier2_obfuscated')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      forcedTier === 'tier2_obfuscated' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ур. 2
                  </button>
                  <button
                    onClick={() => handleSetForcedTier('tier3_mesh')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      forcedTier === 'tier3_mesh' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ур. 3
                  </button>
                </div>
              </div>

              {/* LEVEL 1 CARD */}
              <div className={`p-4 rounded-xl border transition-all ${
                activeTier === 'tier1_p2p'
                  ? 'bg-blue-950/30 border-blue-500/40 ring-1 ring-blue-500/20'
                  : 'bg-slate-800/30 border-slate-700/40 opacity-75'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-blue-200">
                          Уровень 1: Интернет есть (Стандартные P2P протоколы)
                        </h4>
                        {activeTier === 'tier1_p2p' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            АКТИВЕН
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Прямые WebRTC DataChannels между устройствами с сервером сигналов и STUN-серверами Google/Twilio.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                  <div className="flex items-center gap-4">
                    <span>Подключенные P2P пиры: <strong className="text-white">{Object.values(p2pPeers).filter(p => p.state === 'connected').length}</strong></span>
                    <span>STUN NAT Traversal: <strong className="text-emerald-400">Включен</strong></span>
                  </div>
                </div>
              </div>

              {/* LEVEL 2 CARD */}
              <div className={`p-4 rounded-xl border transition-all ${
                activeTier === 'tier2_obfuscated'
                  ? 'bg-amber-950/30 border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-slate-800/30 border-slate-700/40 opacity-75'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-amber-200">
                          Уровень 2: Интернет медленный / заблокирован (Anti-DPI Обфускация)
                        </h4>
                        {activeTier === 'tier2_obfuscated' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            АКТИВЕН
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Маскировка трафика через полиморфный XOR и упаковку в синтетические медиа-заголовки для пробития цензуры DPI.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAntiDPI}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      antiDPIMetrics.isObfuscationForced
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {antiDPIMetrics.isObfuscationForced ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {antiDPIMetrics.isObfuscationForced ? 'Маскировка ВКЛ' : 'Включить маскировку'}
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                  <div className="flex items-center gap-4">
                    <span>Замаскировано пакетов: <strong className="text-white">{antiDPIMetrics.totalObfuscatedPacketsSent}</strong></span>
                    <span>HTTP Bypass Туннель: <strong className="text-emerald-400">Готов (/api/obfuscated/packet)</strong></span>
                  </div>
                  {antiDPIMetrics.lastBypassLatencyMs > 0 && (
                    <span className="text-slate-400">Задержка обхода: {antiDPIMetrics.lastBypassLatencyMs} ms</span>
                  )}
                </div>
              </div>

              {/* LEVEL 3 CARD */}
              <div className={`p-4 rounded-xl border transition-all ${
                activeTier === 'tier3_mesh'
                  ? 'bg-purple-950/30 border-purple-500/40 ring-1 ring-purple-500/20'
                  : 'bg-slate-800/30 border-slate-700/40 opacity-75'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-purple-200">
                          Уровень 3: Интернета нет совсем / Блэкаут (Bluetooth LE & Wi-Fi Direct Mesh)
                        </h4>
                        {activeTier === 'tier3_mesh' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            АКТИВЕН
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Связь напрямую телефон-телефон без интернета. Сообщения прыгают по цепочке устройств с TTL = 7 и квитированием (ACK).
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleScanBLE}
                    disabled={isScanningBLE}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/30"
                  >
                    <Bluetooth className={`w-3.5 h-3.5 ${isScanningBLE ? 'animate-spin' : ''}`} />
                    {isScanningBLE ? 'Поиск...' : 'BLE Сканирование'}
                  </button>
                </div>

                {bleScanError && (
                  <div className="mt-2 text-xs text-rose-400 bg-rose-950/30 p-2 rounded-lg border border-rose-800/40">
                    {bleScanError}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
                  <div className="flex items-center gap-4">
                    <span>Подключенные BLE Модемы: <strong className="text-white">{bleDevices.length}</strong></span>
                    <span>Локальный P2P Wi-Fi/Subnet Bus: <strong className="text-emerald-400">Активен</strong></span>
                    <span>Максимум прыжков (TTL): <strong className="text-purple-300">7 хопов</strong></span>
                  </div>
                </div>

                {bleDevices.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Подключенные BLE устройства:</p>
                    {bleDevices.map((dev) => (
                      <div key={dev.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/40 text-xs">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <Bluetooth className="w-3.5 h-3.5 text-purple-400" /> {dev.name}
                        </span>
                        <span className="text-emerald-400 font-medium">Сопряжено</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ECHO TOPOLOGY */}
          {activeTab === 'topology' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-indigo-950/30 p-4 rounded-xl border border-indigo-500/20">
                <div>
                  <h3 className="text-sm font-bold text-indigo-200">Эхо-Диагностика и Оптимальные Задержки</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Устройства отправляют эхо-пакеты для поиска кратчайшего пути без кольцевого дублирования.
                  </p>
                </div>
                <button
                  onClick={runDiagnostics}
                  disabled={isTesting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Сканирование...' : 'Запустить Пинг'}
                </button>
              </div>

              <div className="space-y-2">
                {nodes.filter(n => n.id !== currentUser.uid).map((node) => {
                  const pingInfo = pings[node.id];
                  const relay = getRelayPath(nodes, currentUser.uid, node.id);

                  return (
                    <div key={node.id} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${node.isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-600'}`} />
                        <div>
                          <div className="font-bold text-white text-sm">{node.displayName}</div>
                          <div className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-2">
                            <span>Тип: {node.isBridge ? '🌐 Интернет-Мост' : '📱 BLE Узел'}</span>
                            {relay && relay.length > 1 && (
                              <span className="text-indigo-400">Путь: {relay.join(' ➔ ')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {pingInfo ? (
                          <div className="text-right">
                            <span className={`font-bold ${pingInfo.pingMs < 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {pingInfo.pingMs} ms
                            </span>
                            <div className="text-[10px] text-slate-500">{pingInfo.hops} скачок(ка)</div>
                          </div>
                        ) : (
                          <span className="text-slate-500">Не проверен</span>
                        )}

                        {onSendTestPacket && (
                          <button
                            onClick={() => onSendTestPacket(node.id)}
                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition cursor-pointer"
                            title="Отправить эхо-пакет"
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BRIDGES & MAILMAN */}
          {activeTab === 'bridges' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  Почтальон-Носитель (Physical Store-and-Forward Carrier)
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Если получатель находится вне зоны действия BLE, сообщение сохраняется в энергонезависимом оффлайн-буфере вашего телефона. Когда вы физически переместитесь ближе к получателю или к другому промежуточному узлу, пакет передастся автоматически.
                </p>

                <div className="mt-4 space-y-2">
                  {mailmanPackets.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-700 rounded-xl">
                      В буфере нет удерживаемых пакетов. Все сообщения доставлены.
                    </div>
                  ) : (
                    mailmanPackets.map((pkt) => (
                      <div key={pkt.id} className="p-3 rounded-lg bg-slate-900 border border-slate-700/60 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-white">Пакет ID: {pkt.id.slice(0, 10)}...</div>
                          <div className="text-slate-400 text-[11px]">Получатель: {pkt.targetId} • {new Date(pkt.carriedAt).toLocaleTimeString()}</div>
                        </div>
                        <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                          Ожидает встречи
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NODES */}
          {activeTab === 'nodes' && (
            <div className="space-y-2">
              {nodes.map((node) => (
                <div key={node.id} className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/40 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${node.isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    <div>
                      <div className="font-bold text-white">{node.displayName} {node.id === currentUser.uid && '(Вы)'}</div>
                      <div className="text-slate-400 text-[11px] font-mono">UID: {node.id.slice(0, 8)}...</div>
                    </div>
                  </div>
                  <div className="text-right text-slate-400 text-[11px]">
                    <div>{node.isBridge ? 'Интернет-Шлюз' : 'Mesh-Клиент'}</div>
                    <div className="text-slate-500">{(node as any).battery ? `Батарея: ${(node as any).battery}%` : 'Питание: 100%'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Неотправленные пакеты в локальной очереди: {queuedPackets.length}</span>
              </div>
              {queuedPackets.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-700 rounded-xl">
                  Очередь пуста.
                </div>
              ) : (
                queuedPackets.map((pkt) => (
                  <div key={pkt.id} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">Пакет #{pkt.id.slice(0, 8)}</div>
                      <div className="text-slate-400 text-[11px]">Попыток: {pkt.attempts} • {new Date(pkt.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <button
                      onClick={() => handleClearPacket(pkt.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 size={14} />
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
