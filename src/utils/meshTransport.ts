// src/utils/meshTransport.ts
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { saveMessage } from './localCache';
import { Message } from '../types';

export const ORDINA_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const ORDINA_CHAR    = '0000ffe1-0000-1000-8000-00805f9b34fb';

export interface DiscoveredPeer {
  id: string;             // UID пользователя или MAC устройства
  mac: string;            // Bluetooth MAC адрес устройства
  deviceId?: string;      // Совместимость с deviceId
  name: string;           // Имя пользователя или узла
  transport?: 'ble' | 'lan' | 'relay';
  rssi?: number;
  ip?: string;
  lastSeen?: number;
}

export class MeshTransport {
  public static peers: Map<string, DiscoveredPeer> = new Map(); // MAC -> Peer
  public static uidToMac: Map<string, string> = new Map();       // UID -> MAC
  public static macToUid: Map<string, string> = new Map();       // MAC -> UID
  
  private static myUid = '';
  private static isScanning = false;
  private static isInitialized = false;
  private static onPeersChanged: ((peers: DiscoveredPeer[]) => void) | null = null;
  private static pingInterval: any = null;
  private static pruneInterval: any = null;
  private static broadcastChannel: BroadcastChannel | null = null;

  public static setOnPeersChanged(cb: (peers: DiscoveredPeer[]) => void) {
    this.onPeersChanged = cb;
  }

  public static setMyUid(uid: string) {
    this.myUid = uid;
    this.init(uid);
  }

  public static init(myUid: string) {
    if (myUid) {
      this.myUid = myUid;
      try {
        localStorage.setItem('last_auth_uid', myUid);
      } catch (_) {}
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      // Прием входящих сырых сообщений из Java GATT-сервера
      window.addEventListener('mesh:incoming_raw', async (event: any) => {
        const raw = event.detail?.raw !== undefined ? event.detail.raw : event.detail;
        if (!raw) return;
        await this.handleIncomingRawPacket(raw);
      });

      window.addEventListener('mesh:directPacket', async (event: any) => {
        const raw = event.detail?.raw !== undefined ? event.detail.raw : (event.data?.raw || event.detail);
        if (!raw) return;
        await this.handleIncomingRawPacket(raw);
      });
    }

    // Запуск сканирования и фонового рукопожатия
    this.startDiscovery(myUid);
  }

  /** Запуск гибридного прослушивания по всем каналам связи (для обратной совместимости) */
  public static async startOmniListening(myUid: string, myName: string = 'Пользователь') {
    this.init(myUid);
    this.startSubnetPing(myUid, myName);
  }

  /**
   * Запуск BLE сканирования эфира с мгновенным тихим рукопожатием (Silent Handshake)
   */
  public static async startDiscovery(myUid?: string, myName?: string) {
    if (myUid) this.myUid = myUid;

    if (!Capacitor.isNativePlatform()) {
      this.startSubnetPing(this.myUid, myName || 'Пользователь');
      return;
    }

    if (this.isScanning) return;

    try {
      await BleClient.initialize();
      this.isScanning = true;

      try {
        await BleClient.stopLEScan();
      } catch (_) {}

      await BleClient.requestLEScan(
        { services: [], allowDuplicates: true },
        async (result) => {
          const isOrdinaUuid = result.uuids && result.uuids.some((u: string) => u.toLowerCase().includes('ffe0'));
          const devName = result.device?.name || result.localName || '';
          const isOrdinaName = devName.startsWith('ORD_') || devName.toLowerCase().includes('ordina');

          if (isOrdinaUuid || isOrdinaName) {
            const mac = result.device.deviceId;
            let existing = this.peers.get(mac);

            if (!existing) {
              const newPeer: DiscoveredPeer = {
                id: mac,
                mac: mac,
                deviceId: mac,
                name: devName || `Узел [${mac.slice(-5)}]`,
                transport: 'ble',
                rssi: result.rssi || -50,
                lastSeen: Date.now()
              };
              this.peers.set(mac, newPeer);

              if (this.onPeersChanged) {
                this.onPeersChanged(Array.from(this.peers.values()));
              }

              // Фоновое тихое рукопожатие: узнаем настоящий UID сразу при обнаружении в эфире!
              this.resolvePeerUid(mac);
            } else {
              existing.rssi = result.rssi || existing.rssi;
              existing.lastSeen = Date.now();
            }
          }
        }
      );

      // Периодическая проверка узлов
      if (!this.pruneInterval) {
        this.pruneInterval = setInterval(() => {
          const now = Date.now();
          let changed = false;
          this.peers.forEach((peer, mac) => {
            if (peer.lastSeen && now - peer.lastSeen > 20000) {
              this.peers.delete(mac);
              changed = true;
            }
          });
          if (changed && this.onPeersChanged) {
            this.onPeersChanged(Array.from(this.peers.values()));
          }
        }, 5000);
      }
    } catch (e) {
      console.error('[BLE Scan] Ошибка запуска сканера:', e);
      this.isScanning = false;
    }
  }

  /**
   * Считывание реального UID соседа по BLE и связывание его с MAC-адресом
   */
  public static async resolvePeerUid(mac: string): Promise<string> {
    if (!mac) return mac;

    // Если уже не MAC, а готовый UID
    if (!mac.includes(':') && mac.length > 8) {
      return mac;
    }

    if (this.macToUid.has(mac)) {
      return this.macToUid.get(mac)!;
    }

    if (!Capacitor.isNativePlatform()) {
      return mac;
    }

    try {
      console.log(`[MeshTransport] Запрос реального UID у узла по BLE MAC: ${mac}...`);
      await BleClient.connect(mac);
      const dataView = await BleClient.read(mac, ORDINA_SERVICE, ORDINA_CHAR);
      const realUid = new TextDecoder('utf-8').decode(dataView);
      await BleClient.disconnect(mac);

      const cleanUid = realUid ? realUid.trim() : '';
      if (cleanUid && cleanUid.length > 4 && !cleanUid.includes('unknown')) {
        console.log(`[MeshTransport] Успешно получен реальный UID: ${cleanUid} вместо MAC ${mac}`);
        this.uidToMac.set(cleanUid, mac);
        this.macToUid.set(mac, cleanUid);

        const peer = this.peers.get(mac);
        if (peer) {
          peer.id = cleanUid;
          peer.name = `Ордина [${cleanUid.slice(0, 5)}]`;
          peer.lastSeen = Date.now();
        }

        if (this.onPeersChanged) {
          this.onPeersChanged(Array.from(this.peers.values()));
        }

        return cleanUid;
      }
    } catch (err) {
      console.warn(`[MeshTransport] Не удалось считать UID по BLE у ${mac}:`, err);
      try {
        await BleClient.disconnect(mac);
      } catch (_) {}
    }

    return this.macToUid.get(mac) || mac;
  }

  /**
   * УМНАЯ ОТПРАВКА: Прицельно по MAC или вещание всем соседям в эфир (Mesh Flooding)
   */
  public static async sendMeshMessage(targetUid: string, message: any): Promise<boolean> {
    let targetMac = targetUid.includes(':') ? targetUid : this.uidToMac.get(targetUid);

    if (!targetMac) {
      // Проверяем сохраненные пиры
      for (const [mac, peer] of this.peers.entries()) {
        if (peer.id === targetUid || peer.mac === targetUid || peer.deviceId === targetUid) {
          targetMac = mac;
          this.uidToMac.set(targetUid, mac);
          break;
        }
      }
    }

    // 1. Если знаем точный MAC-адрес собеседника — шлем прямо ему
    if (targetMac) {
      console.log(`[Mesh] Найден точный MAC ${targetMac} для UID ${targetUid}, прямая передача в GATT...`);
      return await this.writeToGatt(targetMac, message);
    }

    // 2. Если точный MAC неизвестен (мы в сети, а он офлайн) — 
    // РАССЫЛАЕМ ВО ВСЕ НАЙДЕННЫЕ В ЭФИРЕ ТЕЛЕФОНЫ (Mesh Flooding)!
    console.log(`[Mesh] Точный MAC не найден для ${targetUid}, транслируем во все узлы эфира (Flooding)...`);
    
    // В браузере транслируем в broadcastChannel
    if (!Capacitor.isNativePlatform()) {
      this.broadcastChannel?.postMessage({
        type: 'DIRECT_PACKET',
        targetId: targetUid,
        packet: message
      });
      return true;
    }

    const allMacs = Array.from(this.peers.keys()).filter(m => m && m.includes(':'));
    if (allMacs.length === 0) {
      console.warn('[Mesh] В эфире нет доступных BLE-узлов для рассылки');
      return false;
    }

    let delivered = false;
    for (const mac of allMacs) {
      const ok = await this.writeToGatt(mac, message);
      if (ok) delivered = true;
    }

    return delivered;
  }

  /** Совместимость со старыми вызовами */
  public static async sendDirectMessage(targetDeviceIdOrUid: string, packet: any): Promise<boolean> {
    return this.sendMeshMessage(targetDeviceIdOrUid, packet);
  }

  /** Запись пакета в GATT-характеристику устройства */
  public static async writeToGatt(mac: string, message: any): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      this.broadcastChannel?.postMessage({
        type: 'DIRECT_PACKET',
        targetId: mac,
        packet: message
      });
      return true;
    }

    try {
      console.log(`[BLE Send] Подключение к MAC ${mac} для передачи пакета...`);
      await BleClient.connect(mac);
      
      const jsonStr = typeof message === 'string' ? message : JSON.stringify(message);
      const dataView = new DataView(new TextEncoder().encode(jsonStr).buffer);

      await BleClient.write(mac, ORDINA_SERVICE, ORDINA_CHAR, dataView);
      await BleClient.disconnect(mac);
      console.log(`[BLE Send] Пакет успешно передан в GATT ${mac}`);
      return true;
    } catch (e) {
      console.warn(`[BLE Send] Не удалось передать на ${mac}:`, e);
      try {
        await BleClient.disconnect(mac);
      } catch (_) {}
      return false;
    }
  }

  /**
   * Обработка входящего пакета из Java или прямого BLE соединения
   */
  public static async handleIncomingRawPacket(rawData: any) {
    try {
      const packet = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      if (!packet || (!packet.text && !packet.content)) return;

      console.log('[MeshTransport] Входящий пакет принят:', packet);

      // Запоминаем отправителя в таблицу маршрутов
      if (packet.senderId && packet.senderMac) {
        this.uidToMac.set(packet.senderId, packet.senderMac);
        this.macToUid.set(packet.senderMac, packet.senderId);
      }

      const myUid = this.myUid || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_auth_uid') : '') || '';
      const senderId = packet.senderId || 'peer';
      const receiverId = (packet.receiverId && !packet.receiverId.includes(':')) ? packet.receiverId : myUid;
      const chatId = packet.chatId || [senderId, myUid].sort().join('_');
      const text = packet.text || packet.content || '';

      const normalized: Message = {
        id: packet.id || `ble_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        chatId: chatId,
        senderId: senderId,
        receiverId: receiverId,
        text: text,
        content: text,
        type: packet.type || 'text',
        createdAt: packet.createdAt || new Date().toISOString(),
        deliveryStatus: 'delivered',
        status: 'delivered',
        isMesh: true,
        meshHops: 1
      };

      // 1. Сохраняем в локальную базу данных SQLite
      await saveMessage(normalized);
      console.log('[MeshTransport] Сообщение успешно сохранено в SQLite базу:', normalized.id);

      // 2. Оповещаем UI для мгновенного обновления открытого чата
      window.dispatchEvent(new CustomEvent('ordinamsg:new', { detail: normalized }));
      window.dispatchEvent(new CustomEvent('mesh:incoming', { detail: normalized }));

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch (_) {}
      }
    } catch (err) {
      console.error('[MeshTransport] Ошибка обработки входящего BLE пакета:', err);
    }
  }

  // --- КАНАЛ 2: Локальная подсеть (Hotspot / Wi-Fi / Browser Tabs) ---
  private static startSubnetPing(myUid: string, myName: string) {
    if (this.pingInterval) clearInterval(this.pingInterval);

    if (!this.broadcastChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('ordina_local_mesh');
      this.broadcastChannel.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'PING' && event.data.uid && event.data.uid !== myUid) {
          this.registerPeer({
            id: event.data.uid,
            mac: event.data.uid,
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
            mac: event.data.uid,
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
    this.peers.set(peer.mac || peer.id, peer);
    if (this.onPeersChanged) {
      this.onPeersChanged(Array.from(this.peers.values()));
    }
  }

  public static getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values());
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
