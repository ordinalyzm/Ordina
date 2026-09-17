import { Capacitor } from '@capacitor/core';
import { BleClient, BleDevice, numbersToDataView, dataViewToNumbers, dataViewToText, textToDataView } from '@capacitor-community/bluetooth-le';
import { Message } from '../types';
import { saveMessage, updateMessageStatus } from '../utils/localCache';

export interface BLEMeshPacket {
  packetId: string;
  type: 'data' | 'ack' | 'beacon' | 'handshake';
  senderId: string;
  recipientId?: string; // target user ID or groupId
  ttl: number; // hop limit
  hopCount: number;
  relayPath: string[];
  message?: Message;
  timestamp: number;
  encryptedPayload?: string;
}

const ORDINA_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const ORDINA_CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

type PacketCallback = (packet: BLEMeshPacket) => void;

class BLEMeshService {
  private isInitialized = false;
  private isScanning = false;
  private currentUserId: string | null = null;
  private packetListeners: PacketCallback[] = [];
  private seenPacketIds: Set<string> = new Set();
  private nearbyDevices: Map<string, BleDevice> = new Map();
  private scanInterval: any = null;

  public setCurrentUserId(uid: string | null) {
    this.currentUserId = uid;
  }

  /**
   * Initializes Bluetooth LE Central + Peripheral subsystem.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (Capacitor.isNativePlatform()) {
        await BleClient.initialize();
        console.log('[BLE Mesh Service] BleClient initialized');
      }
      this.isInitialized = true;
      this.startContinuousScanning();
    } catch (error) {
      console.warn('[BLE Mesh Service] BLE init fallback to hybrid simulation:', error);
      this.isInitialized = true;
      this.startContinuousScanning();
    }
  }

  /**
   * Subscribes a listener to incoming mesh packets.
   */
  public onPacketReceived(callback: PacketCallback): () => void {
    this.packetListeners.push(callback);
    return () => {
      this.packetListeners = this.packetListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Starts periodic scanning for nearby Ordina BLE nodes.
   */
  public async startContinuousScanning(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    const performScan = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await BleClient.requestLEScan(
            {
              services: [ORDINA_SERVICE_UUID],
              allowDuplicates: false
            },
            (result) => {
              if (result.device) {
                this.nearbyDevices.set(result.device.deviceId, result.device);
                this.tryConnectAndRead(result.device);
              }
            }
          );

          // Stop scan after 8 seconds to preserve battery
          setTimeout(async () => {
            try {
              await BleClient.stopLEScan();
            } catch (e) {}
          }, 8000);
        }
      } catch (err) {
        // BLE scanning might fail if bluetooth is turned off or permissions pending
      }
    };

    performScan();
    this.scanInterval = setInterval(performScan, 20000);
  }

  /**
   * Attempts connection to a discovered peripheral device to exchange mesh packets.
   */
  private async tryConnectAndRead(device: BleDevice) {
    try {
      if (!Capacitor.isNativePlatform()) return;
      await BleClient.connect(device.deviceId);
      
      // Start notifications on Ordina characteristic
      await BleClient.startNotifications(
        device.deviceId,
        ORDINA_SERVICE_UUID,
        ORDINA_CHAR_UUID,
        (value) => {
          try {
            const raw = dataViewToText(value);
            const packet: BLEMeshPacket = JSON.parse(raw);
            this.handleIncomingPacket(packet);
          } catch (e) {}
        }
      );
    } catch (e) {
      // Connect failed or already connected
    }
  }

  /**
   * Core packet routing & Store-and-Forward engine.
   */
  public async handleIncomingPacket(packet: BLEMeshPacket): Promise<void> {
    if (!packet || !packet.packetId) return;

    // Deduplication check: drop if already seen
    if (this.seenPacketIds.has(packet.packetId)) return;
    this.seenPacketIds.add(packet.packetId);
    if (this.seenPacketIds.size > 1000) {
      const first = Array.from(this.seenPacketIds)[0];
      this.seenPacketIds.delete(first);
    }

    // Ignore packets created by myself
    if (this.currentUserId && packet.senderId === this.currentUserId) return;

    const isForMe = !packet.recipientId || 
                    packet.recipientId === 'global_channel' || 
                    packet.recipientId === this.currentUserId ||
                    packet.message?.receiverId === this.currentUserId;

    if (isForMe) {
      console.log('[BLE Mesh Service] Packet delivered to destination:', packet);
      
      if (packet.message) {
        const receivedMsg: Message = {
          ...packet.message,
          deliveryStatus: 'delivered',
          status: 'delivered',
          relayPath: packet.relayPath
        };
        // 1. Save directly to SQLite
        await saveMessage(receivedMsg);
      }

      // Notify in-app subscribers
      this.packetListeners.forEach(cb => {
        try {
          cb(packet);
        } catch (e) {}
      });

      // Send ACK back into the mesh
      if (packet.type === 'data') {
        const ackPacket: BLEMeshPacket = {
          packetId: `ack_${packet.packetId}`,
          type: 'ack',
          senderId: this.currentUserId || 'anonymous',
          recipientId: packet.senderId,
          ttl: 5,
          hopCount: 0,
          relayPath: [this.currentUserId || 'me'],
          timestamp: Date.now()
        };
        this.broadcast(ackPacket);
      }
    } else {
      // Store-and-Forward: Intermediate relay node
      if (packet.ttl > 0) {
        console.log(`[BLE Mesh Service] Retransmitting packet (${packet.packetId}) with TTL ${packet.ttl - 1}`);
        const forwardedPacket: BLEMeshPacket = {
          ...packet,
          ttl: packet.ttl - 1,
          hopCount: packet.hopCount + 1,
          relayPath: [...packet.relayPath, this.currentUserId || 'relay_node']
        };

        // Forward to adjacent BLE peers
        await this.broadcast(forwardedPacket);
      }
    }
  }

  /**
   * Broadcasts a packet to nearby Ordina devices.
   */
  public async broadcast(packet: any): Promise<void> {
    try {
      const rawJson = typeof packet === 'string' ? packet : JSON.stringify(packet);

      // 1. Native BLE transmission to connected/known peripherals
      if (Capacitor.isNativePlatform()) {
        for (const [deviceId] of this.nearbyDevices) {
          try {
            await BleClient.write(
              deviceId,
              ORDINA_SERVICE_UUID,
              ORDINA_CHAR_UUID,
              textToDataView(rawJson)
            );
          } catch (e) {
            // Write failed for this specific peer
          }
        }
      }

      // 2. Local Broadcast Channel for multi-window / local P2P sync
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ordina_ble_mesh_bus');
        bc.postMessage(packet);
        bc.close();
      }
    } catch (err) {
      console.error('[BLE Mesh Service] broadcast error:', err);
    }
  }

  public destroy() {
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (Capacitor.isNativePlatform()) {
      BleClient.stopLEScan().catch(() => {});
    }
  }
}

export const bleMesh = new BLEMeshService();
