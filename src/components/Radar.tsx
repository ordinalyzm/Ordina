import React, { useEffect, useRef, useState } from 'react';
import { MeshNode } from '../types';
import { detectDeviceHardwareSpecs, executeEchoRouteDiscovery, EchoRouteResult, getDistance } from '../lib/mesh';
import { Radio, Wifi, Zap, MessageSquare, Activity, ShieldCheck, Cpu, Share2, Server, Package } from 'lucide-react';

interface RadarProps {
  nodes: MeshNode[];
  currentUserNodeId: string;
  onNodeClick?: (node: MeshNode) => void;
}

const REAL_MESH_RANGE = 1000;

export const Radar: React.FC<RadarProps> = ({ nodes, currentUserNodeId, onNodeClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [echoPingTarget, setEchoPingTarget] = useState<string | null>(null);
  const [activeEchoRoute, setActiveEchoRoute] = useState<EchoRouteResult | null>(null);
  const [pingToast, setPingToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);

  const hwSpecs = detectDeviceHardwareSpecs();

  const triggerEchoPing = (node: MeshNode) => {
    setEchoPingTarget(node.id);
    const route = executeEchoRouteDiscovery(nodes, currentUserNodeId, node.id);
    setActiveEchoRoute(route);

    const latency = route?.latencyMs || node.ping || Math.floor(12 + Math.random() * 35);
    const hops = route?.hops || node.hops || 1;
    const bridgeText = route?.viaBridge ? ' [через Интернет-Bluetooth Мост]' : '';

    setPingToast({
      msg: `Эхо-маршрут до [${node.displayName}]: ${hops} скачка(ов), ${latency} ms${bridgeText} (Анти-DDoS активен)`,
      type: 'success'
    });

    setTimeout(() => {
      setEchoPingTarget(null);
    }, 3000);
    setTimeout(() => {
      setPingToast(null);
    }, 5500);
  };
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
        }
      }
    });

    if (canvas.parentElement) {
      const rect = canvas.parentElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
      resizeObserver.observe(canvas.parentElement);
    }

    const draw = () => {
      if (!canvas.width || !canvas.height) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.max(1, Math.min(centerX, centerY) * 0.88);

      // Radial grid rings
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= 4; i++) {
        const ringR = (maxRadius / 4) * i;
        ctx.arc(centerX, centerY, ringR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.font = '8px monospace';
        ctx.fillText(`${i * 250}m`, centerX + ringR - 20, centerY - 4);
      }
      ctx.stroke();

      // Estimated Hardware Bluetooth Modem Range Circle
      const modemRangeR = (hwSpecs.estimatedBluetoothModemRange / REAL_MESH_RANGE) * maxRadius;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, modemRangeR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.font = '9px sans-serif';
      ctx.fillText(`Зона BLE Модема (${hwSpecs.estimatedBluetoothModemRange}m)`, centerX - 60, centerY - modemRangeR + 12);

      // Axis lines
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius, centerY);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.moveTo(centerX, centerY - maxRadius);
      ctx.lineTo(centerX, centerY + maxRadius);
      ctx.stroke();

      const time = Date.now() / 1000;
      const angle = (time % 4) * (Math.PI / 2);
      
      // Radar sweep beam
      const beamGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
      beamGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
      beamGradient.addColorStop(1, 'rgba(59, 130, 246, 0.15)');
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxRadius, -0.45, 0, false);
      ctx.lineTo(0, 0);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(maxRadius, 0);
      ctx.stroke();
      ctx.restore();

      const currentUserNode = nodes.find(n => n.id === currentUserNodeId);
      const nodePositions = new Map<string, { x: number; y: number }>();
      
      if (currentUserNode) {
        nodePositions.set(currentUserNode.id, { x: centerX, y: centerY });
        
        nodes.forEach(node => {
          if (node.id === currentUserNodeId) return;
          
          if (node.lat !== undefined && node.lng !== undefined && currentUserNode.lat !== undefined && currentUserNode.lng !== undefined) {
            const dx = (node.lng - currentUserNode.lng) * Math.cos((currentUserNode.lat + node.lat) / 2 * Math.PI / 180) * 111320;
            const dy = (node.lat - currentUserNode.lat) * 111000;
            
            const canvasX = centerX + (dx / REAL_MESH_RANGE) * maxRadius;
            const canvasY = centerY - (dy / REAL_MESH_RANGE) * maxRadius;
            
            nodePositions.set(node.id, { x: canvasX, y: canvasY });
          } else if (node.x !== undefined && node.y !== undefined) {
            const canvasX = (node.x / 400) * canvas.width;
            const canvasY = (node.y / 400) * canvas.height;
            nodePositions.set(node.id, { x: canvasX, y: canvasY });
          }
        });
      }

      const visibleNodes = nodes.filter(n => nodePositions.has(n.id));

      // Draw standard connection links between online nodes
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      
      for (let i = 0; i < visibleNodes.length; i++) {
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const n1 = visibleNodes[i];
          const n2 = visibleNodes[j];
          if (n1.isOnline && n2.isOnline) {
            const pos1 = nodePositions.get(n1.id);
            const pos2 = nodePositions.get(n2.id);
            if (pos1 && pos2) {
              ctx.beginPath();
              ctx.moveTo(pos1.x, pos1.y);
              ctx.lineTo(pos2.x, pos2.y);
              ctx.stroke();

              // Animated P2P Packet Blip moving along link
              const progress = (time * 0.8 + i) % 1;
              const packetX = pos1.x + (pos2.x - pos1.x) * progress;
              const packetY = pos1.y + (pos2.y - pos1.y) * progress;

              ctx.fillStyle = '#38bdf8';
              ctx.shadowBlur = 8;
              ctx.shadowColor = '#38bdf8';
              ctx.beginPath();
              ctx.arc(packetX, packetY, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }
      }
      ctx.setLineDash([]);

      // Draw Active Echo Routing Path if selected
      if (activeEchoRoute && activeEchoRoute.path.length > 1) {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3;
        ctx.beginPath();
        activeEchoRoute.path.forEach((nodeId, idx) => {
          const pos = nodePositions.get(nodeId);
          if (pos) {
            if (idx === 0) ctx.moveTo(pos.x, pos.y);
            else ctx.lineTo(pos.x, pos.y);
          }
        });
        ctx.stroke();
      }

      // Draw echo ping animation if active
      if (echoPingTarget) {
        const targetPos = nodePositions.get(echoPingTarget);
        if (targetPos) {
          const pingProgress = (time * 2) % 1;
          const pingR = pingProgress * 44;
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(targetPos.x, targetPos.y, pingR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw Nodes
      visibleNodes.forEach(node => {
        const pos = nodePositions.get(node.id);
        if (!pos) return;
        
        const { x: nx, y: ny } = pos;
        const isCurrent = node.id === currentUserNodeId;
        const isSelected = selectedNode?.id === node.id;
        let isRelay = node.nodeType === 'relay' || (node.hops && node.hops > 1);

        if (isCurrent || node.isOnline) {
          ctx.shadowBlur = isSelected ? 20 : 12;
          ctx.shadowColor = isCurrent ? '#3b82f6' : (isRelay ? '#f59e0b' : '#10b981');
        }

        ctx.fillStyle = isCurrent ? '#3b82f6' : (node.isOnline ? (isRelay ? '#f59e0b' : '#10b981') : '#64748b');
        ctx.beginPath();
        ctx.arc(nx, ny, isCurrent ? 9 : (isSelected ? 8 : 6), 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isSelected ? '#ec4899' : 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.displayName, nx, ny + 18);

        if (node.rssi) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
          ctx.font = '9px monospace';
          ctx.fillText(`${node.rssi} dBm`, nx, ny + 29);
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);
    
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, currentUserNodeId, selectedNode, echoPingTarget, activeEchoRoute, hwSpecs]);

  const otherNodes = nodes.filter(n => n.id !== currentUserNodeId);

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col overflow-hidden">
      {/* Radar Canvas Container */}
      <div className="relative flex-1 min-h-[280px] bg-slate-900 overflow-hidden flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full cursor-pointer relative z-10 block"
          style={{ display: 'block', width: '100%', height: '100%' }}
          onClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const maxRadius = Math.min(centerX, centerY) * 0.88;
            
            const currentUserNode = nodes.find(n => n.id === currentUserNodeId);
            
            const clickedNode = nodes.find(node => {
              let nx, ny;
              if (currentUserNode && node.lat !== undefined && node.lng !== undefined && currentUserNode.lat !== undefined && currentUserNode.lng !== undefined) {
                if (node.id === currentUserNodeId) {
                  nx = centerX;
                  ny = centerY;
                } else {
                  const dx = (node.lng - currentUserNode.lng) * Math.cos((currentUserNode.lat + node.lat) / 2 * Math.PI / 180) * 111320;
                  const dy = (node.lat - currentUserNode.lat) * 111000;
                  nx = centerX + (dx / REAL_MESH_RANGE) * maxRadius;
                  ny = centerY - (dy / REAL_MESH_RANGE) * maxRadius;
                }
              } else {
                nx = ((node.x || 200) / 400) * rect.width;
                ny = ((node.y || 200) / 400) * rect.height;
              }
              
              return Math.sqrt(Math.pow(nx - x, 2) + Math.pow(ny - y, 2)) < 24;
            });
            
            if (clickedNode) {
              setSelectedNode(clickedNode);
              triggerEchoPing(clickedNode);
            }
          }}
        />

        {/* Top-Left Legend Overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 bg-black/60 p-2.5 rounded-xl backdrop-blur-md border border-white/10 z-20 text-[10px] font-bold text-white uppercase tracking-tight">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" /> Вы (Центр)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Прямой P2P / BLE
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" /> Ретранслятор / Почтальон
          </div>
        </div>

        {/* Top-Right Hardware Spec Status Badge */}
        <div className="absolute top-3 right-3 bg-black/70 border border-slate-700/80 p-2 rounded-xl backdrop-blur-md z-20 text-[10px] text-slate-300 font-mono hidden sm:flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>{hwSpecs.hardwareModelLabel}</span>
        </div>

        {/* Echo Ping Toast */}
        {pingToast && (
          <div className="absolute top-12 right-3 max-w-[280px] bg-emerald-950/95 text-emerald-100 border border-emerald-500/50 p-3 rounded-xl text-xs font-semibold backdrop-blur-md shadow-2xl z-30 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Zap size={18} className="text-emerald-400 shrink-0 animate-pulse" />
            <p className="text-[11px] leading-snug">{pingToast.msg}</p>
          </div>
        )}
      </div>

      {/* Discovered Mesh Peers Drawer / List */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 max-h-[220px] overflow-y-auto space-y-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Radio size={14} className="text-blue-400 animate-pulse" />
            <span>Обнаруженные узлы Mesh ({otherNodes.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 flex items-center gap-1">
              <Share2 size={10} /> Эхо-маршрутизатор
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              P2P Активен
            </span>
          </div>
        </div>

        {otherNodes.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Сканирование эфира... Поиск узлов</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {otherNodes.map((n) => {
              const myNode = nodes.find(x => x.id === currentUserNodeId);
              const distMeters = myNode ? Math.round(getDistance(n, myNode) * (n.lat ? 1 : 2.5)) : 120;
              return (
                <div 
                  key={n.id}
                  onClick={() => {
                    setSelectedNode(n);
                    triggerEchoPing(n);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    selectedNode?.id === n.id 
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg' 
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-xs shrink-0 text-slate-200 overflow-hidden">
                      {n.photoURL ? (
                        <img src={n.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        n.nodeType === 'relay' ? <Cpu size={16} className="text-amber-400" /> : n.displayName[0]
                      )}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold truncate leading-snug flex items-center gap-1.5">
                        {n.displayName}
                        {n.isBridge && <span title="Меш-Мост"><Server size={11} className="text-indigo-400 shrink-0" /></span>}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>{distMeters} м</span>
                        <span>•</span>
                        <span className="text-emerald-400">{n.rssi || -50} dBm</span>
                        <span>•</span>
                        <span>{n.ping || 18} ms</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerEchoPing(n);
                      }}
                      className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 transition-colors"
                      title="Тест Эхо (Пинг & Маршрут)"
                    >
                      <Zap size={14} />
                    </button>
                    {onNodeClick && n.nodeType !== 'relay' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNodeClick(n);
                        }}
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors"
                        title="Написать в P2P"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
