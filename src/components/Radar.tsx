import React, { useEffect, useRef } from 'react';
import { MeshNode } from '../types';

interface RadarProps {
  nodes: MeshNode[];
  currentUserNodeId: string;
  onNodeClick?: (node: MeshNode) => void;
}

// 1km range for real geolocation
const REAL_MESH_RANGE = 1000; 
// 120 units for legacy x/y
const LEGACY_MESH_RANGE = 120;

function getDistance(n1: MeshNode, n2: MeshNode): number {
  if (n1.lat !== undefined && n1.lng !== undefined && n2.lat !== undefined && n2.lng !== undefined) {
    const dx = (n2.lng - n1.lng) * Math.cos((n1.lat + n2.lat) / 2 * Math.PI / 180) * 111320;
    const dy = (n2.lat - n1.lat) * 111000;
    return Math.sqrt(dx * dx + dy * dy);
  }
  if (n1.x !== undefined && n1.y !== undefined && n2.x !== undefined && n2.y !== undefined) {
    return Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
  }
  return Infinity;
}

function getMeshRange(n1: MeshNode, n2: MeshNode): number {
  if (n1.lat !== undefined && n1.lng !== undefined && n2.lat !== undefined && n2.lng !== undefined) {
    return REAL_MESH_RANGE;
  }
  return LEGACY_MESH_RANGE;
}

export const Radar: React.FC<RadarProps> = ({ nodes, currentUserNodeId, onNodeClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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

      // Ensure consistent background
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.max(1, Math.min(centerX, centerY) * 0.9);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= 4; i++) {
        ctx.arc(centerX, centerY, (maxRadius / 4) * i, 0, Math.PI * 2);
      }
      ctx.stroke();

      // Horizontal and vertical axis
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius, centerY);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.moveTo(centerX, centerY - maxRadius);
      ctx.lineTo(centerX, centerY + maxRadius);
      ctx.stroke();

      const time = Date.now() / 1000;
      const angle = (time % 4) * (Math.PI / 2);
      
      // Radar beam
      const beamGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
      beamGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
      beamGradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.fillStyle = beamGradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxRadius, -0.4, 0, false);
      ctx.lineTo(0, 0);
      ctx.fill();
      
      // Bright edge of the beam
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(maxRadius, 0);
      ctx.stroke();
      ctx.restore();

      const currentUserNode = nodes.find(n => n.id === currentUserNodeId);
      
      // Calculate positions on canvas
      const nodePositions = new Map<string, { x: number, y: number }>();
      
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
            // Legacy mapping
            const canvasX = (node.x / 400) * canvas.width;
            const canvasY = (node.y / 400) * canvas.height;
            nodePositions.set(node.id, { x: canvasX, y: canvasY });
          }
        });
      } else {
        nodes.forEach(node => {
          if (node.x !== undefined && node.y !== undefined) {
            const canvasX = (node.x / 400) * canvas.width;
            const canvasY = (node.y / 400) * canvas.height;
            nodePositions.set(node.id, { x: canvasX, y: canvasY });
          }
        });
      }

      const directNeighbors = nodes.filter(n => 
        n.id !== currentUserNodeId && 
        n.isOnline && 
        currentUserNode && 
        getDistance(n, currentUserNode) <= getMeshRange(n, currentUserNode)
      );
      
      const visibleNodes = nodes.filter(node => {
        if (node.id === currentUserNodeId) return true;
        if (!currentUserNode) return false;
        
        const distToMe = getDistance(node, currentUserNode);
        if (distToMe <= getMeshRange(node, currentUserNode)) return true;
        
        if (node.isOnline) {
          return directNeighbors.some(neighbor => 
            getDistance(node, neighbor) <= getMeshRange(node, neighbor)
          );
        }
        return false;
      });

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      for (let i = 0; i < visibleNodes.length; i++) {
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const n1 = visibleNodes[i];
          const n2 = visibleNodes[j];
          const dist = getDistance(n1, n2);
          
          if (dist <= getMeshRange(n1, n2) && n1.isOnline && n2.isOnline) {
            const pos1 = nodePositions.get(n1.id);
            const pos2 = nodePositions.get(n2.id);
            if (pos1 && pos2) {
              ctx.beginPath();
              ctx.moveTo(pos1.x, pos1.y);
              ctx.lineTo(pos2.x, pos2.y);
              ctx.stroke();
            }
          }
        }
      }
      ctx.setLineDash([]);

      visibleNodes.forEach(node => {
        const pos = nodePositions.get(node.id);
        if (!pos) return;
        
        const { x: nx, y: ny } = pos;
        const isCurrent = node.id === currentUserNodeId;
        
        let isRelay = false;
        if (!isCurrent && currentUserNode && node.isOnline) {
          const distToMe = getDistance(node, currentUserNode);
          if (distToMe > getMeshRange(node, currentUserNode)) {
            isRelay = true;
          }
        }

        if (isCurrent || node.isOnline) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = isCurrent ? '#3b82f6' : (isRelay ? '#f59e0b' : '#10b981');
        }

        ctx.fillStyle = isCurrent ? '#3b82f6' : (node.isOnline ? (isRelay ? '#f59e0b' : '#10b981') : '#64748b');
        ctx.beginPath();
        ctx.arc(nx, ny, isCurrent ? 8 : 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.displayName, nx, ny + 20);
        
        if (isRelay) {
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText('через соседа', nx, ny + 32);
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);
    
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, currentUserNodeId]);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <div className="text-blue-400 text-sm font-bold animate-pulse uppercase tracking-widest">Поиск узлов...</div>
        </div>
      ) : (
        <canvas 
          ref={canvasRef} 
          className="w-full h-full cursor-crosshair relative z-10 block"
          style={{ display: 'block', width: '100%', height: '100%' }}
          onClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const maxRadius = Math.min(centerX, centerY) * 0.9;
            
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
                nx = (node.x / 400) * rect.width;
                ny = (node.y / 400) * rect.height;
              }
              
              return Math.sqrt(Math.pow(nx - x, 2) + Math.pow(ny - y, 2)) < 20;
            });
            
            if (clickedNode && onNodeClick) onNodeClick(clickedNode);
          }}
        />
      )}
      <div className="absolute top-4 left-4 flex flex-col gap-2 bg-black/40 p-3 rounded-xl backdrop-blur-md border border-white/10 z-20">
        <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-tighter">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" /> Вы
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-tighter">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Прямая связь (до 1км)
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-tighter">
          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" /> Через соседа
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-white uppercase tracking-tighter">
          <div className="w-2 h-2 rounded-full bg-slate-500" /> Оффлайн / Вне зоны
        </div>
      </div>
    </div>
  );
};
