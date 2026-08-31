/**
 * Unified 3-Tier Multi-Transport Router for Ordina Messenger
 *
 * Tier 1: Real P2P Protocols (Direct WebRTC DataChannels + Server Fallback)
 * Tier 2: Anti-DPI Traffic Masking (Polymorphic obfuscation to bypass censorship / firewalls)
 * Tier 3: Zero-Internet Local Mesh (Bluetooth LE + Wi-Fi Direct / Local Bus + Multi-Hop "Прыжки")
 */

import { Message } from '../types';
import { p2pManager } from './p2pWebRTC';
import { obfuscationEngine } from './obfuscation';
import { bleMeshEngine, MultiHopMeshPacket } from './bleMesh';

export type TransportTier = 'tier1_p2p' | 'tier2_obfuscated' | 'tier3_mesh';

export interface DispatchResult {
  tierUsed: TransportTier;
  deliveredDirectly: boolean;
  hopCount?: number;
  relayPath?: string[];
  latencyMs?: number;
  note: string;
}

class MultiTierTransportRouter {
  private forcedTier: TransportTier | null = null;
  private currentUid: string | null = null;
  private socket: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ordina_forced_tier') as TransportTier | null;
      if (saved && ['tier1_p2p', 'tier2_obfuscated', 'tier3_mesh'].includes(saved)) {
        this.forcedTier = saved;
      }
    }
  }

  public init(currentUid: string, socketInstance: any) {
    this.currentUid = currentUid;
    this.socket = socketInstance;

    // Initialize Tier 1 WebRTC
    p2pManager.init(currentUid, (event, payload) => {
      if (this.socket && this.socket.connected) {
        this.socket.emit(event, payload);
      }
    });

    // Initialize Tier 3 BLE Mesh
    bleMeshEngine.init(currentUid);
  }

  public setForcedTier(tier: TransportTier | null) {
    this.forcedTier = tier;
    if (typeof window !== 'undefined') {
      if (tier) {
        localStorage.setItem('ordina_forced_tier', tier);
      } else {
        localStorage.removeItem('ordina_forced_tier');
      }
    }
  }

  public getForcedTier(): TransportTier | null {
    return this.forcedTier;
  }

  /**
   * Determine the current active communication tier based on network availability and user policy
   */
  public determineActiveTier(): TransportTier {
    if (this.forcedTier) return this.forcedTier;

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine !== false && this.socket?.connected;

    if (!isOnline) {
      // Level 3: Offline Blackout
      return 'tier3_mesh';
    }

    if (obfuscationEngine.isObfuscationActive()) {
      // Level 2: Slow/Blocked Internet requiring Anti-DPI
      return 'tier2_obfuscated';
    }

    // Level 1: Standard Internet Available with P2P
    return 'tier1_p2p';
  }

  /**
   * Dispatches a message through the optimal transport tier with automatic failover
   */
  public async dispatchMessage(chatId: string, message: Message): Promise<DispatchResult> {
    const tier = this.determineActiveTier();

    // -------------------------------------------------------------
    // TIER 3: ZERO-INTERNET LOCAL MESH (Bluetooth LE & Local Subnet)
    // -------------------------------------------------------------
    if (tier === 'tier3_mesh') {
      const meshPacket: MultiHopMeshPacket = {
        packetId: message.id,
        type: 'data',
        sourceUid: this.currentUid || message.senderId,
        targetUid: chatId,
        ttl: 7,
        hopCount: 0,
        relayPath: [this.currentUid || message.senderId],
        message,
        timestamp: Date.now()
      };

      bleMeshEngine.broadcastPacket(meshPacket);

      return {
        tierUsed: 'tier3_mesh',
        deliveredDirectly: false,
        hopCount: 0,
        relayPath: meshPacket.relayPath,
        note: 'Передано через Уровень 3: Bluetooth LE и локальную Mesh-сеть'
      };
    }

    // -------------------------------------------------------------
    // TIER 2: ANTI-DPI OBFUSCATED TRANSPORT (Slow / Blocked Internet)
    // -------------------------------------------------------------
    if (tier === 'tier2_obfuscated') {
      const masked = obfuscationEngine.maskPayload({ chatId, message });

      if (this.socket && this.socket.connected) {
        this.socket.emit('obfuscated:packet', masked);
      } else {
        // Fallback to HTTP Anti-DPI tunnel
        await obfuscationEngine.sendViaHttpBypass(chatId, message);
      }

      return {
        tierUsed: 'tier2_obfuscated',
        deliveredDirectly: false,
        note: 'Замаскировано через Уровень 2: Anti-DPI обфускация трафика'
      };
    }

    // -------------------------------------------------------------
    // TIER 1: STANDARD P2P (WebRTC DataChannel -> Server Relay fallback)
    // -------------------------------------------------------------
    // For direct 1-on-1 private chats, attempt direct WebRTC DataChannel first
    const isDirectP2PSent = p2pManager.sendDirectP2P(chatId, message);

    if (isDirectP2PSent) {
      const latency = p2pManager.getPeerPing(chatId) || 5;
      return {
        tierUsed: 'tier1_p2p',
        deliveredDirectly: true,
        latencyMs: latency,
        note: `Доставлено через Уровень 1: Прямой WebRTC DataChannel (P2P, ~${latency}ms)`
      };
    }

    // Fallback to server socket relay (if P2P is establishing or restricted by symmetric NAT)
    if (this.socket && this.socket.connected) {
      this.socket.emit('message:new', { chatId, message });
      return {
        tierUsed: 'tier1_p2p',
        deliveredDirectly: false,
        note: 'Отправлено через Уровень 1: Серверное реле (P2P резерв)'
      };
    }

    // Ultimate fallback if socket unexpectedly dropped: broadcast over local Mesh
    bleMeshEngine.broadcastPacket({
      packetId: message.id,
      type: 'data',
      sourceUid: this.currentUid || message.senderId,
      targetUid: chatId,
      ttl: 7,
      hopCount: 0,
      relayPath: [this.currentUid || message.senderId],
      message,
      timestamp: Date.now()
    });

    return {
      tierUsed: 'tier3_mesh',
      deliveredDirectly: false,
      note: 'Связь прервана: Сообщение перенаправлено в оффлайн Mesh'
    };
  }
}

export const multiTierRouter = new MultiTierTransportRouter();
