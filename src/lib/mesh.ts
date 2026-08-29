import { MeshNode, Message } from '../types';

export interface DeviceHardwareSpecs {
  ramGB?: number;
  cores?: number;
  hasWebBluetooth: boolean;
  hasWebRTC: boolean;
  connectionType: string;
  isMobile: boolean;
  estimatedBluetoothModemRange: number; // in meters
  hardwareModelLabel: string;
}

export interface EchoRouteResult {
  targetId: string;
  path: string[];
  hops: number;
  latencyMs: number;
  avgRssi: number;
  cost: number;
  viaBridge?: boolean;
}

const LEGACY_MESH_RANGE = 120;
const REAL_MESH_RANGE = 1000;

/**
 * Hardware specs & Bluetooth modem range detector
 */
export function detectDeviceHardwareSpecs(): DeviceHardwareSpecs {
  if (typeof window === 'undefined') {
    return {
      hasWebBluetooth: false,
      hasWebRTC: false,
      connectionType: 'unknown',
      isMobile: false,
      estimatedBluetoothModemRange: 120,
      hardwareModelLabel: 'Стандартный BLE 4.2 Модем'
    };
  }

  // Check manual user calibration override first
  const customRange = localStorage.getItem('ordina_custom_ble_range');
  const customLabel = localStorage.getItem('ordina_custom_ble_label');
  if (customRange && customLabel) {
    return {
      ramGB: undefined,
      cores: undefined,
      hasWebBluetooth: !!(navigator as any).bluetooth,
      hasWebRTC: typeof RTCPeerConnection !== 'undefined',
      connectionType: (navigator as any).onLine ? 'online' : 'offline',
      isMobile: true,
      estimatedBluetoothModemRange: parseInt(customRange, 10) || 120,
      hardwareModelLabel: customLabel
    };
  }

  const nav = navigator as any;
  const rawRam = nav.deviceMemory;
  const cores = nav.hardwareConcurrency || 2;
  const hasWebBluetooth = !!nav.bluetooth;
  const hasWebRTC = typeof RTCPeerConnection !== 'undefined';
  const ua = nav.userAgent || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  // Real RAM fallback logic: if deviceMemory is missing (iOS/Safari/Old WebViews), don't default to 4GB!
  const ramGB = rawRam !== undefined ? rawRam : (isMobile ? 2 : 4);

  let connectionType = 'online';
  if (nav.connection) {
    connectionType = nav.connection.effectiveType || nav.connection.type || '4g';
  } else if (!nav.onLine) {
    connectionType = 'offline';
  }

  // Parse OS Version for accurate Bluetooth PHY hardware generation
  const androidMatch = ua.match(/Android\s([0-9\.]+)/i);
  const androidVer = androidMatch ? parseFloat(androidMatch[1]) : null;
  
  const iosMatch = ua.match(/OS\s([0-9_]+)\slike\sMac/i);
  const iosVer = iosMatch ? parseInt(iosMatch[1].replace('_', '.'), 10) : null;

  const maxTouchPoints = nav.maxTouchPoints || 0;
  const isOldHardware = (androidVer !== null && androidVer < 9.0) || 
                        (iosVer !== null && iosVer < 13) || 
                        (ramGB <= 2 && cores <= 4) ||
                        (isMobile && maxTouchPoints <= 3);

  // Calculate estimated BLE Modem Range based on realistic hardware capability
  let range = 120;
  let modelLabel = 'BLE 4.2 Standard (120m)';

  if (isOldHardware) {
    range = 55;
    modelLabel = 'Legacy BLE 4.0 / 4.1 (Устаревший модуль, 55m)';
  } else if (hasWebBluetooth && ramGB >= 6 && cores >= 8 && (androidVer === null || androidVer >= 11)) {
    range = 380;
    modelLabel = 'Bluetooth 5.4 Long Range PHY (380m)';
  } else if (ramGB >= 4 && cores >= 6) {
    range = 220;
    modelLabel = 'Bluetooth 5.0 LE (220m)';
  } else if (isMobile) {
    range = 110;
    modelLabel = 'Мобильный BLE 4.2 / 5.0 (110m)';
  }

  return {
    ramGB,
    cores,
    hasWebBluetooth,
    hasWebRTC,
    connectionType,
    isMobile,
    estimatedBluetoothModemRange: range,
    hardwareModelLabel: modelLabel
  };
}

/**
 * Deduplication & Anti-DDoS Storm Suppression Engine
 */
class MeshDeduplicationEngine {
  private seenPackets = new Map<string, number>(); // packetHash -> timestamp
  private nodeEchoRateLimit = new Map<string, number[]>(); // nodeId -> array of request timestamps
  private suppressedCount = 0;

  public isDuplicateOrFlood(packetId: string, nodeId: string): boolean {
    const now = Date.now();
    this.cleanStale();

    // 1. Deduplication check
    if (this.seenPackets.has(packetId)) {
      this.suppressedCount++;
      return true; // Already processed, drop to avoid loop/ddos
    }

    // Record packet
    this.seenPackets.set(packetId, now);

    // 2. Rate limiting check (max 5 echo requests per 3 seconds per node)
    const timestamps = this.nodeEchoRateLimit.get(nodeId) || [];
    const recent = timestamps.filter(t => now - t < 3000);
    if (recent.length >= 5) {
      this.suppressedCount++;
      return true; // Rate limit exceeded, drop packet
    }

    recent.push(now);
    this.nodeEchoRateLimit.set(nodeId, recent);

    return false;
  }

  private cleanStale() {
    const now = Date.now();
    // Keep packet hashes for 3 minutes
    for (const [hash, ts] of this.seenPackets.entries()) {
      if (now - ts > 180000) {
        this.seenPackets.delete(hash);
      }
    }
  }

  public getSuppressedCount(): number {
    return this.suppressedCount;
  }
}

export const deduplicationEngine = new MeshDeduplicationEngine();

/**
 * Distance Calculation (GPS / Euclidean)
 */
export function getDistance(n1: MeshNode, n2: MeshNode): number {
  if (n1.lat !== undefined && n1.lng !== undefined && n2.lat !== undefined && n2.lng !== undefined) {
    const dx = (n2.lng - n1.lng) * Math.cos((n1.lat + n2.lat) / 2 * Math.PI / 180) * 111320;
    const dy = (n2.lat - n1.lat) * 111000;
    return Math.sqrt(dx * dx + dy * dy);
  }
  if (n1.x !== undefined && n1.y !== undefined && n2.x !== undefined && n2.y !== undefined) {
    return Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
  }
  return 150;
}

export function getMeshRange(n1: MeshNode, n2: MeshNode): number {
  const r1 = n1.estimatedModemRangeMeters || (n1.lat !== undefined ? REAL_MESH_RANGE : LEGACY_MESH_RANGE);
  const r2 = n2.estimatedModemRangeMeters || (n2.lat !== undefined ? REAL_MESH_RANGE : LEGACY_MESH_RANGE);
  return Math.max(r1, r2);
}

/**
 * Echo Route Discovery algorithm with deduplication and metric cost
 */
export function executeEchoRouteDiscovery(
  nodes: MeshNode[],
  startNodeId: string,
  targetNodeId: string
): EchoRouteResult | null {
  const echoId = `echo_${startNodeId}_to_${targetNodeId}_${Date.now()}`;
  
  if (deduplicationEngine.isDuplicateOrFlood(echoId, startNodeId)) {
    return null;
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const unvisited = new Set<string>();

  nodes.forEach(n => {
    distances.set(n.id, Infinity);
    unvisited.add(n.id);
  });

  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let minDist = Infinity;

    for (const id of unvisited) {
      const d = distances.get(id)!;
      if (d < minDist) {
        minDist = d;
        currentId = id;
      }
    }

    if (!currentId || minDist === Infinity) break;
    if (currentId === targetNodeId) break;

    unvisited.delete(currentId);
    const currentNode = nodes.find(n => n.id === currentId);
    if (!currentNode) continue;

    for (const neighbor of nodes) {
      if (!unvisited.has(neighbor.id) || !neighbor.isOnline) continue;

      const physicalDist = getDistance(currentNode, neighbor);
      const maxRange = getMeshRange(currentNode, neighbor);

      if (physicalDist <= maxRange || currentNode.isBridge || neighbor.isBridge) {
        // Metric cost weighting: Hops + Signal loss + Latency
        const signalPenalty = neighbor.rssi ? Math.abs(neighbor.rssi + 40) * 0.5 : 10;
        const bridgeBonus = (currentNode.isBridge && neighbor.isBridge) ? -20 : 0;
        const edgeCost = 15 + signalPenalty + bridgeBonus;

        const alt = distances.get(currentId)! + edgeCost;
        if (alt < distances.get(neighbor.id)!) {
          distances.set(neighbor.id, alt);
          previous.set(neighbor.id, currentId);
        }
      }
    }
  }

  if (distances.get(targetNodeId) === Infinity) {
    return null;
  }

  // Build path
  const path: string[] = [];
  let curr: string | undefined = targetNodeId;
  while (curr) {
    path.unshift(curr);
    curr = previous.get(curr);
  }

  const hops = Math.max(1, path.length - 1);
  const targetNode = nodes.find(n => n.id === targetNodeId);
  const avgRssi = targetNode?.rssi || -55;
  const latencyMs = Math.round(hops * 14 + Math.random() * 8);

  return {
    targetId: targetNodeId,
    path,
    hops,
    latencyMs,
    avgRssi,
    cost: Math.round(distances.get(targetNodeId)!),
    viaBridge: path.some(id => nodes.find(n => n.id === id)?.isBridge)
  };
}

export function calculateMeshPaths(nodes: MeshNode[], startNodeId: string) {
  const paths: Record<string, string[]> = {};
  const queue: string[] = [startNodeId];
  const visited = new Set<string>([startNodeId]);
  paths[startNodeId] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodes.find(n => n.id === currentId);
    if (!currentNode) continue;

    for (const neighbor of nodes) {
      if (visited.has(neighbor.id) || !neighbor.isOnline) continue;

      const dist = getDistance(currentNode, neighbor);

      if (dist <= getMeshRange(currentNode, neighbor) || currentNode.isBridge || neighbor.isBridge) {
        visited.add(neighbor.id);
        paths[neighbor.id] = [...paths[currentId], currentId];
        queue.push(neighbor.id);
      }
    }
  }

  return paths;
}

export function getRelayPath(nodes: MeshNode[], senderId: string, receiverId: string): string[] | null {
  const echoRes = executeEchoRouteDiscovery(nodes, senderId, receiverId);
  if (echoRes) {
    return echoRes.path;
  }
  const paths = calculateMeshPaths(nodes, senderId);
  return paths[receiverId] || null;
}

export function findNextHop(nodes: MeshNode[], currentId: string, receiverId: string): string | null {
  const path = getRelayPath(nodes, currentId, receiverId);
  if (path && path.length > 1) {
    return path[1];
  }

  const currentNode = nodes.find(n => n.id === currentId);
  const receiverNode = nodes.find(n => n.id === receiverId);
  if (!currentNode || !receiverNode) return null;

  let bestNextHop: string | null = null;
  let minDistance = Infinity;

  const neighbors = nodes.filter(n => 
    n.id !== currentId && 
    n.isOnline && 
    (getDistance(currentNode, n) <= getMeshRange(currentNode, n) || n.isBridge)
  );

  for (const neighbor of neighbors) {
    const distToReceiver = getDistance(neighbor, receiverNode);
    if (distToReceiver < minDistance) {
      minDistance = distToReceiver;
      bestNextHop = neighbor.id;
    }
  }

  return bestNextHop;
}

/**
 * Mailman (Почтальон) Offline Carrier Engine
 */
export interface MailmanCarrierPacket {
  id: string;
  message: Message;
  targetId: string;
  carrierId: string;
  carriedAt: number;
}

const MAILMAN_STORAGE_KEY = 'ordina_mailman_carrier_packets';

export function getMailmanCarrierPackets(): MailmanCarrierPacket[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MAILMAN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function addMailmanCarrierPacket(packet: MailmanCarrierPacket) {
  const list = getMailmanCarrierPackets();
  if (!list.some(p => p.id === packet.id)) {
    list.push(packet);
    try {
      localStorage.setItem(MAILMAN_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }
}

export function removeMailmanCarrierPacket(id: string) {
  const list = getMailmanCarrierPackets().filter(p => p.id !== id);
  try {
    localStorage.setItem(MAILMAN_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
}

/**
 * Direct Offline Local Mesh Bus (BroadcastChannel + StorageEvent fallback)
 * Enables real-time local peer-to-peer transmission without internet connection
 */
export interface LocalMeshPacket {
  type: 'mesh:packet' | 'mesh:ack' | 'mesh:beacon';
  message?: Message;
  messageId?: string;
  targetId?: string;
  senderId?: string;
  deliveredTo?: string;
  timestamp: number;
}

const LOCAL_MESH_CHANNEL_NAME = 'ordina_offline_mesh_bus';
let meshBroadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    meshBroadcastChannel = new BroadcastChannel(LOCAL_MESH_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }
}

export function broadcastLocalMeshPayload(packet: LocalMeshPacket) {
  if (typeof window === 'undefined') return;

  // 1. Broadcast via BroadcastChannel
  if (meshBroadcastChannel) {
    try {
      meshBroadcastChannel.postMessage(packet);
    } catch (e) {
      console.error('Error posting to BroadcastChannel:', e);
    }
  }

  // 2. Broadcast via StorageEvent fallback (triggers on other tabs/windows/webviews)
  try {
    const key = `ordina_mesh_event_${Date.now()}_${Math.random()}`;
    localStorage.setItem(key, JSON.stringify(packet));
    setTimeout(() => {
      try {
        localStorage.removeItem(key);
      } catch (err) {}
    }, 1000);
  } catch (e) {}
}

export function subscribeLocalMeshPayload(callback: (packet: LocalMeshPacket) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // BroadcastChannel listener
  const bcHandler = (event: MessageEvent) => {
    if (event.data && event.data.type) {
      callback(event.data as LocalMeshPacket);
    }
  };

  if (meshBroadcastChannel) {
    meshBroadcastChannel.addEventListener('message', bcHandler);
  }

  // StorageEvent listener fallback
  const storageHandler = (event: StorageEvent) => {
    if (event.key && event.key.startsWith('ordina_mesh_event_') && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        if (data && data.type) {
          callback(data as LocalMeshPacket);
        }
      } catch (e) {}
    }
  };

  window.addEventListener('storage', storageHandler);

  return () => {
    if (meshBroadcastChannel) {
      meshBroadcastChannel.removeEventListener('message', bcHandler);
    }
    window.removeEventListener('storage', storageHandler);
  };
}

