import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

export interface DiscoveredPeer {
  id: string;             // UID пользователя
  name: string;           // Имя пользователя
  transport: 'ble' | 'lan' | 'relay';
  rssi?: number;
  ip?: string;
  lastSeen: number;
}

const ORDINA_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';

export class MeshTransport {
  private static isScanning = false;
  private static discoveredPeers: Map<string, DiscoveredPeer> = new Map();
  private static onPeersChanged: ((peers: DiscoveredPeer[]) => void) | null = null;
  private static pingInterval: any = null;
  private static broadcastChannel: BroadcastChannel | null = null;

  public static setOnPeersChanged(cb: (peers: DiscoveredPeer[]) => void) {
    this.onPeersChanged = cb;
  }

  /** Запуск гибридного прослушивания по всем каналам связи */
  public static async startOmniListening(myUid: string, myName: string) {
    // 1. Запуск BLE слушателя (только на Native платформах)
    if (Capacitor.isNativePlatform()) {
      await this.startBleScanner(myUid);
    }

    // 2. Запуск локального сканирования подсети (Wi-Fi / Hotspot / Multi-tab)
    this.startSubnetPing(myUid, myName);
  }

  // --- КАНАЛ 1: Bluetooth Low Energy ---
  private static async startBleScanner(myUid: string) {
    if (this.isScanning) return;
    try {
      await BleClient.initialize();
      this.isScanning = true;

      await BleClient.requestLEScan(
        {
          services: [ORDINA_SERVICE_UUID],
          allowDuplicates: true
        },
        (result) => {
          // Имя устройства транслируется в формате: ORD_<UID>_<NAME>
          const deviceName = result.device?.name || result.localName;
          if (deviceName && deviceName.startsWith('ORD_')) {
            const parts = deviceName.split('_');
            if (parts.length >= 3) {
              const peerUid = parts[1];
              const peerName = parts.slice(2).join('_');

              if (peerUid && peerUid !== myUid) {
                this.registerPeer({
                  id: peerUid,
                  name: peerName || `Узел ${peerUid.slice(0, 5)}`,
                  transport: 'ble',
                  rssi: result.rssi,
                  lastSeen: Date.now()
                });
              }
            }
          }
        }
      );
    } catch (err) {
      console.warn('[MeshTransport] BLE Scan error or permission denied:', err);
      this.isScanning = false;
    }
  }

  // --- КАНАЛ 2: Локальная подсеть / Точка доступа (Hotspot / LAN) ---
  // Самый надежный и быстрый канал, если устройства подключены к одной Wi-Fi или раздаче
  private static startSubnetPing(myUid: string, myName: string) {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    if (!this.broadcastChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('ordina_local_mesh');
      this.broadcastChannel.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'PING' && event.data.uid && event.data.uid !== myUid) {
          this.registerPeer({
            id: event.data.uid,
            name: event.data.name || `Узел ${event.data.uid.slice(0, 5)}`,
            transport: 'lan',
            lastSeen: Date.now()
          });
          // Отвечаем со своей стороны (Pong)
          try {
            this.broadcastChannel?.postMessage({
              type: 'PONG',
              uid: myUid,
              name: myName,
              ts: Date.now()
            });
          } catch (e) {}
        } else if (event.data.type === 'PONG' && event.data.uid && event.data.uid !== myUid) {
          this.registerPeer({
            id: event.data.uid,
            name: event.data.name || `Узел ${event.data.uid.slice(0, 5)}`,
            transport: 'lan',
            lastSeen: Date.now()
          });
        }
      };
    }

    const sendPing = () => {
      try {
        this.broadcastChannel?.postMessage({
          type: 'PING',
          uid: myUid,
          name: myName,
          ts: Date.now()
        });
      } catch (e) {}

      // Удаление узлов, не выходивших на связь более 12 секунд
      const now = Date.now();
      let changed = false;
      this.discoveredPeers.forEach((peer, id) => {
        if (now - peer.lastSeen > 12000) {
          this.discoveredPeers.delete(id);
          changed = true;
        }
      });
      if (changed && this.onPeersChanged) {
        this.onPeersChanged(Array.from(this.discoveredPeers.values()));
      }
    };

    // Отправляем первый пинг сразу и затем каждые 3 секунды
    sendPing();
    this.pingInterval = setInterval(sendPing, 3000);
  }

  public static registerPeer(peer: DiscoveredPeer) {
    this.discoveredPeers.set(peer.id, peer);
    if (this.onPeersChanged) {
      this.onPeersChanged(Array.from(this.discoveredPeers.values()));
    }
  }

  public static getPeers(): DiscoveredPeer[] {
    return Array.from(this.discoveredPeers.values());
  }

  public static stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (e) {}
      this.broadcastChannel = null;
    }
    this.isScanning = false;
  }
}
