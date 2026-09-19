import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

export interface DiscoveredPeer {
  id: string;             // UID пользователя или ID устройства
  name: string;           // Имя пользователя
  transport: 'ble' | 'lan' | 'relay';
  rssi?: number;
  ip?: string;
  lastSeen: number;
}

export class MeshTransport {
  private static isScanning = false;
  private static discoveredPeers: Map<string, DiscoveredPeer> = new Map();
  private static onPeersChanged: ((peers: DiscoveredPeer[]) => void) | null = null;
  private static pingInterval: any = null;
  private static pruneInterval: any = null;
  private static broadcastChannel: BroadcastChannel | null = null;

  public static setOnPeersChanged(cb: (peers: DiscoveredPeer[]) => void) {
    this.onPeersChanged = cb;
  }

  /**
   * Мгновенный запуск сканирования эфира BLE + локальной подсети (LAN/Hotspot)
   */
  public static async startDiscovery(myUid: string, myName: string = 'Пользователь') {
    return this.startOmniListening(myUid, myName);
  }

  /** Запуск гибридного прослушивания по всем каналам связи */
  public static async startOmniListening(myUid: string, myName: string = 'Пользователь') {
    // 1. Запуск BLE слушателя (на Native платформах)
    if (Capacitor.isNativePlatform()) {
      await this.startBleScanner(myUid);
    }

    // 2. Запуск локального сканирования подсети (Wi-Fi / Hotspot / Multi-tab)
    this.startSubnetPing(myUid, myName);

    // 3. Запуск периодической очистки узлов, пропавших из эфира (>10 сек тишины)
    if (!this.pruneInterval) {
      this.pruneInterval = setInterval(() => {
        const now = Date.now();
        let changed = false;
        this.discoveredPeers.forEach((peer, id) => {
          if (now - peer.lastSeen > 10000) {
            this.discoveredPeers.delete(id);
            changed = true;
          }
        });
        if (changed && this.onPeersChanged) {
          this.onPeersChanged(Array.from(this.discoveredPeers.values()));
        }
      }, 3000);
    }
  }

  // --- КАНАЛ 1: Bluetooth Low Energy ---
  private static async startBleScanner(myUid: string) {
    if (this.isScanning) return;
    try {
      await BleClient.initialize();
      this.isScanning = true;

      // 1. Сбрасываем старое сканирование во избежание ошибки "could not find callback wrapper"
      try {
        await BleClient.stopLEScan();
      } catch (_) {}

      // 2. Сканируем эфир без фильтра по UUID (чтобы ловить имя узла из маяка)
      await BleClient.requestLEScan(
        {
          services: [], // ПУСТОЙ МАССИВ! Слушаем весь эфир без ограничений 31-байтного пакета
          allowDuplicates: true // Обязательно true для непрерывного приема маяков
        },
        (result) => {
          // Имя устройства из маяка
          const name = result.device?.name || result.localName || '';

          // Ловим устройства с префиксом ORD_ (наш вещатель из MainActivity)
          if (name.startsWith('ORD_')) {
            const parts = name.split('_');
            const peerId = parts[1] || result.device.deviceId;

            // Если это не наш собственный маяк
            const myShort = myUid ? myUid.slice(0, 5) : '';
            if (!myShort || !peerId.includes(myShort)) {
              const peerName = parts.slice(2).join('_') || `Ордина [${peerId.slice(0, 4)}]`;

              this.registerPeer({
                id: peerId,
                name: peerName,
                transport: 'ble',
                rssi: result.rssi || -70,
                lastSeen: Date.now()
              });
            }
          }
        }
      );
    } catch (err) {
      console.error('[MeshTransport] BLE Scan error or permission denied:', err);
      this.isScanning = false;
    }
  }

  // --- КАНАЛ 2: Локальная подсеть / Точка доступа (Hotspot / LAN) ---
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
            name: event.data.name || `Ордина [${event.data.uid.slice(0, 4)}]`,
            transport: 'lan',
            lastSeen: Date.now()
          });
          // Отвечаем Pong
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
            name: event.data.name || `Ордина [${event.data.uid.slice(0, 4)}]`,
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
    };

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
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
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
