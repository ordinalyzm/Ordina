// Mesh Store & Forward Offline Packet Queue Manager

import { Message, MeshNode } from '../types';

export interface QueuedMeshPacket {
  id: string;
  message: Message;
  senderId: string;
  targetId: string;
  relayPath: string[];
  attempts: number;
  timestamp: number;
  ttl: number; // TTL in seconds
}

const QUEUE_STORAGE_KEY = 'ordina_mesh_packet_queue';

export function getQueuedMeshPackets(): QueuedMeshPacket[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const packets: QueuedMeshPacket[] = JSON.parse(raw);
    const now = Date.now();
    // Filter out expired packets (TTL expired)
    return packets.filter(p => now - p.timestamp < p.ttl * 1000);
  } catch (e) {
    console.warn('Failed to load mesh packet queue:', e);
    return [];
  }
}

export function saveQueuedMeshPackets(packets: QueuedMeshPacket[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(packets));
  } catch (e) {
    console.warn('Failed to save mesh packet queue:', e);
  }
}

export function enqueueMeshPacket(message: Message, targetId: string, relayPath: string[] = []): QueuedMeshPacket {
  const packets = getQueuedMeshPackets();
  
  const packet: QueuedMeshPacket = {
    id: `mesh_pkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    message,
    senderId: message.senderId,
    targetId,
    relayPath,
    attempts: 0,
    timestamp: Date.now(),
    ttl: 86400, // 24 hours TTL
  };

  // Avoid duplicates
  const existingIdx = packets.findIndex(p => p.message.id === message.id);
  if (existingIdx >= 0) {
    packets[existingIdx] = packet;
  } else {
    packets.push(packet);
  }

  saveQueuedMeshPackets(packets);
  return packet;
}

export function dequeueMeshPacket(packetId: string) {
  const packets = getQueuedMeshPackets();
  const updated = packets.filter(p => p.id !== packetId && p.message.id !== packetId);
  saveQueuedMeshPackets(updated);
}

export function clearMeshQueue() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}

/**
 * Signal strength calculations based on Euclidean/GPS distance in meters
 */
export function calculateSignalQuality(distanceMeters: number): {
  percentage: number;
  dbm: number;
  label: string;
  color: string;
} {
  if (distanceMeters === Infinity || Number.isNaN(distanceMeters)) {
    return { percentage: 0, dbm: -100, label: 'Нет сигнала', color: '#64748b' };
  }

  // Max range ~ 1000m
  const clampedDist = Math.min(1000, Math.max(1, distanceMeters));
  const qualityPct = Math.round(100 - (clampedDist / 1000) * 85);
  
  // Approximate dBm ranging from -50 dBm (very close) to -95 dBm (edge of range)
  const dbm = Math.round(-50 - (clampedDist / 1000) * 45);

  let label = 'Отличный';
  let color = '#10b981'; // Green

  if (qualityPct < 30) {
    label = 'Слабый';
    color = '#ef4444'; // Red
  } else if (qualityPct < 65) {
    label = 'Средний';
    color = '#f59e0b'; // Amber
  }

  return { percentage: qualityPct, dbm, label, color };
}

/**
 * Simulated latency based on hop count and physical distance
 */
export function estimateMeshPing(hopsCount: number, distanceMeters: number): number {
  const baseLatency = 8; // ms per hop
  const distanceLatency = Math.min(150, (distanceMeters / 1000) * 20);
  const jitter = Math.floor(Math.random() * 6);
  return Math.max(12, Math.round(hopsCount * baseLatency + distanceLatency + jitter));
}
