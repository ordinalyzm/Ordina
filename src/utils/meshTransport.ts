// src/utils/meshTransport.ts
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

export const ORDINA_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const ORDINA_CHAR    = '0000ffe1-0000-1000-8000-00805f9b34fb';

export interface DiscoveredPeer {
  id: string;             // UID пользователя или ID устройства
  deviceId?: string;
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
  private static isDirectPacketListenerBound = false;

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
    // Слушаем входящие сообщения от нативного Java GATT-сервера
    if (!this.isDirectPacketListenerBound && typeof window !== 'undefined') {
      this.isDirectPacketListenerBound = true;
      window.addEventListener('mesh:directPacket', (e: any) => {
        try {
          const rawJson = e.detail?.raw || e.data?.raw || (typeof e.detail === 'string' ? e.detail : null);
          if (rawJson) {
            const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            window.dispatchEvent(new CustomEvent('mesh:incoming', { detail: parsed }));
          }
        } catch (err) {
          console.error('[BLE] Ошибка разбора прямого пакета:', err);
        }
      });
    }

    // 1. Запуск BLE слушателя (на Native платформах)
    if (Capacitor.isNativePlatform()) {
      await this.startBleScanner(myUid);
    }

    // 2. Запуск локального сканирования подсети (Wi-Fi / Hotspot / Multi-tab)
    this.startSubnetPing(myUid, myName);

    // 3. Запуск периодической очистки узлов, пропавших из эфира (>12 сек тишины)
    if (!this.pruneInterval) {
      this.pruneInterval = setInterval(() => {
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
      }, 3000);
    }
  }

  // --- КАНАЛ 1: Bluetooth Low Energy ---
  private static async startBleScanner(myUid: string) {
    if (this.isScanning) return;
    try {
      await BleClient.initialize();
      this.isScanning = true;

      // 1. Сбрасываем старое сканирование во избежание конфликта callback
      try {
        await BleClient.stopLEScan();
      } catch (_) {}

      // 2. Сканируем эфир без фильтра в драйвере (принимаем всё, фильтруем в JS по UUID и префиксу)
      await BleClient.requestLEScan(
        {
          services: [],
          allowDuplicates: true
        },
        (result) => {
          // ПРОВЕРЯЕМ: Принадлежит ли маяк нашему приложению Ordina по UUID сервиса
          const isOrdinaUuid = result.uuids && result.uuids.some((u: string) => u.toLowerCase().includes('ffe0'));
          
          // Или по имени маяка ORD_...
          const devName = result.device?.name || result.localName || '';
          const isOrdinaName = devName.startsWith('ORD_');

          if (isOrdinaUuid || isOrdinaName) {
            const deviceId = result.device.deviceId;
            let peerId = deviceId;
            let peerName = `Узел Ордины [${deviceId.slice(-5)}]`;

            if (isOrdinaName) {
              const parts = devName.split('_');
              peerId = parts[1] || deviceId;
              peerName = parts.slice(2).join('_') || `Ордина [${peerId.slice(0, 5)}]`;
            }

            // Исключаем свой собственный узел
            const myShort = myUid ? myUid.slice(0, 5) : '';
            if (!myShort || !peerId.includes(myShort)) {
              this.registerPeer({
                id: peerId,
                deviceId: deviceId,
                name: peerName,
                transport: 'ble',
                rssi: result.rssi || -60,
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

  /** ПРЯМАЯ ОТПРАВКА БАЙТОВ БЕЗ ИНТЕРНЕТА ПО BLE GATT */
  public static async sendDirectMessage(targetDeviceId: string, packet: any): Promise<boolean> {
    try {
      if (!Capacitor.isNativePlatform()) {
        // В браузере транслируем через локальный BroadcastChannel
        this.broadcastChannel?.postMessage({
          type: 'DIRECT_PACKET',
          targetId: targetDeviceId,
          packet
        });
        return true;
      }

      // 1. Подключаемся к соседнему телефону
      await BleClient.connect(targetDeviceId);

      // 2. Кодируем JSON сообщения в байты
      const jsonStr = JSON.stringify(packet);
      const encoder = new TextEncoder();
      const dataView = new DataView(encoder.encode(jsonStr).buffer);

      // 3. Пишем прямо в GATT-характеристику соседа
      await BleClient.write(targetDeviceId, ORDINA_SERVICE, ORDINA_CHAR, dataView);

      // 4. Отключаемся
      await BleClient.disconnect(targetDeviceId);
      return true;
    } catch (err) {
      console.error('[BLE Send] Ошибка прямой передачи:', err);
      return false;
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
            deviceId: event.data.uid,
            name: event.data.name || `Ордина [${event.data.uid.slice(0, 4)}]`,
            transport: 'lan',
            lastSeen: Date.now()
          });
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
            deviceId: event.data.uid,
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
