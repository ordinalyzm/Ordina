// src/utils/meshTransport.ts
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { saveMessage } from './localCache';

export const ORDINA_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const ORDINA_CHAR    = '0000ffe1-0000-1000-8000-00805f9b34fb';

export interface DiscoveredPeer {
  id: string;        // UID пользователя (или MAC, пока не разрезолвлен)
  mac: string;       // MAC-адрес узла
  name: string;      // Имя для отображения
  rssi: number;      // Сила сигнала
  isResolved: boolean;
  transport?: 'ble' | 'lan' | 'relay';
  ip?: string;
  lastSeen?: number;
}

export interface MeshPacket {
  id: string;
  senderId: string;
  receiverId: string;
  chatId: string;
  text: string;
  createdAt: string;
  ttl?: number;
  relayPath?: string[];
}

export class MeshTransport {
  public static peers: Map<string, DiscoveredPeer> = new Map();
  public static uidToMac: Map<string, string> = new Map();
  public static macToUid: Map<string, string> = new Map();

  private static myUid: string = '';
  private static onPeersChanged: ((peers: DiscoveredPeer[]) => void) | null = null;
  private static isInitialized = false;

  // Очередь для защиты BLE от параллельных подключений (GATT Error 133 fix)
  private static bleOperationQueue: Promise<any> = Promise.resolve();
  private static resolvingMacs: Set<string> = new Set();
  
  // Кэш дедупликации (последние 500 сообщений)
  private static seenPackets: Set<string> = new Set();

  public static setMyUid(uid: string) {
    this.myUid = uid;
    this.init(uid);
  }

  public static async init(myUid: string) {
    if (myUid) {
      this.myUid = myUid;
      try {
        Preferences.set({ key: 'last_auth_uid', value: myUid }).catch(() => {});
        localStorage.setItem('last_auth_uid', myUid);
      } catch (_) {}
    }

    if (this.isInitialized || !Capacitor.isNativePlatform()) return;
    this.isInitialized = true;

    // Слушаем входящие из Java MainActivity
    if (typeof window !== 'undefined') {
      window.addEventListener('mesh:incoming_raw', async (event: any) => {
        try {
          const raw = event.detail?.raw !== undefined ? event.detail.raw : event.detail;
          if (!raw) return;
          const packet: MeshPacket = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!packet || !packet.id || !packet.text) return;

          await this.handleIncomingPacket(packet);
        } catch (e) {
          console.error('[Mesh] Ошибка разбора incoming_raw:', e);
        }
      });
    }

    // Запускаем сканирование эфира
    await this.startDiscovery();
  }

  public static async startOmniListening(uid: string, _myName: string = 'User') {
    await this.init(uid);
    await this.startDiscovery();
  }

  public static setOnPeersChanged(cb: (peers: DiscoveredPeer[]) => void) {
    this.onPeersChanged = cb;
  }

  /**
   * СТАБИЛЬНОЕ СКАНИРОВАНИЕ БЕЗ ШТОРМА
   */
  public static async startDiscovery() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await BleClient.initialize();
      try { await BleClient.stopLEScan(); } catch (_) {}

      // Фильтруем строго по нашему UUID и выключаем дубликаты!
      await BleClient.requestLEScan(
        {
          services: [ORDINA_SERVICE],
          allowDuplicates: false // ЗАЩИТА: событие стреляет 1 раз при нахождении
        },
        (result) => {
          const mac = result.device?.deviceId;
          if (!mac) return;

          if (!this.peers.has(mac)) {
            const newPeer: DiscoveredPeer = {
              id: mac,
              mac: mac,
              name: `Узел [${mac.slice(-5)}]`,
              rssi: result.rssi || -60,
              isResolved: false,
              transport: 'ble',
              lastSeen: Date.now()
            };
            this.peers.set(mac, newPeer);
            this.notifyPeers();

            // Ставим в очередь на аккуратное тихое рукопожатие
            this.queueResolvePeer(mac);
          } else {
            // Обновляем уровень сигнала
            const existing = this.peers.get(mac)!;
            existing.rssi = result.rssi || existing.rssi;
            existing.lastSeen = Date.now();
          }
        }
      );
      console.log('[Mesh] BLE LE сканирование успешно запущено');
    } catch (e) {
      console.error('[Mesh] Ошибка запуска сканера:', e);
    }
  }

  private static notifyPeers() {
    if (this.onPeersChanged) {
      this.onPeersChanged(Array.from(this.peers.values()));
    }
  }

  /**
   * Очередь на рукопожатие (строго по одному, без перегрузки чипа)
   */
  private static queueResolvePeer(mac: string) {
    if (this.resolvingMacs.has(mac)) return;
    this.resolvingMacs.add(mac);

    this.bleOperationQueue = this.bleOperationQueue.then(async () => {
      try {
        await this.resolvePeerUid(mac);
      } finally {
        this.resolvingMacs.delete(mac);
      }
    });
  }

  /**
   * Тихое рукопожатие по GATT: получаем UID собеседника
   */
  public static async resolvePeerUid(mac: string): Promise<string> {
    try {
      await BleClient.connect(mac);
      const dataView = await BleClient.read(mac, ORDINA_SERVICE, ORDINA_CHAR);
      await BleClient.disconnect(mac);

      const decoder = new TextDecoder();
      const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
      const realUid = decoder.decode(bytes).trim();

      if (realUid && realUid.length > 3 && !realUid.includes('unknown')) {
        this.uidToMac.set(realUid, mac);
        this.macToUid.set(mac, realUid);

        const peer = this.peers.get(mac);
        if (peer) {
          peer.id = realUid;
          peer.name = `Ордина [${realUid.slice(0, 5)}]`;
          peer.isResolved = true;
          peer.lastSeen = Date.now();
          this.notifyPeers();
        }
        console.log(`[Mesh] Успешное рукопожатие: MAC ${mac} -> UID ${realUid}`);
        return realUid;
      }
    } catch (err) {
      // Игнорируем штатные помехи
      try { await BleClient.disconnect(mac); } catch (_) {}
    }
    return mac;
  }

  /**
   * ОБРАБОТКА ВХОДЯЩЕГО ПАКЕТА И РЕТРАНСЛЯЦИЯ (MESH)
   */
  private static async handleIncomingPacket(packet: MeshPacket) {
    // 1. Дедупликация: если пакет уже видели — отбрасываем
    if (this.seenPackets.has(packet.id)) return;
    
    if (this.seenPackets.size > 500) {
      const oldest = this.seenPackets.keys().next().value;
      if (oldest) this.seenPackets.delete(oldest);
    }
    this.seenPackets.add(packet.id);

    console.log('[Mesh] Обработка пакета:', packet);

    // 2. Пакет предназначен МНЕ
    const currentUid = this.myUid || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_auth_uid') : '') || '';
    if (packet.receiverId === currentUid || !packet.receiverId) {
      const chatId = packet.chatId || [packet.senderId, currentUid].sort().join('_');
      const normalized: any = {
        id: packet.id,
        chatId: chatId,
        senderId: packet.senderId,
        receiverId: currentUid,
        text: packet.text,
        content: packet.text,
        createdAt: packet.createdAt || new Date().toISOString(),
        deliveryStatus: 'delivered',
        status: 'delivered',
        isMesh: true,
        type: 'text'
      };

      // Сохраняем в локальный SQLite
      await saveMessage(normalized);

      // Обновляем экран открытого чата
      window.dispatchEvent(new CustomEvent('ordinamsg:new', { detail: normalized }));
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([100, 50, 100]); } catch (_) {}
      }
      return;
    }

    // 3. Пакет НЕ МНЕ: Ретрансляция (Relay Multi-hop)
    const ttl = packet.ttl ?? 3;
    const path = packet.relayPath || [];

    if (ttl > 1 && !path.includes(currentUid)) {
      console.log(`[Mesh] Ретранслируем пакет ${packet.id} дальше...`);
      const relayPacket: MeshPacket = {
        ...packet,
        ttl: ttl - 1,
        relayPath: [...path, currentUid]
      };

      // Случайная пауза (jitter) 100-250мс против коллизий эфира
      setTimeout(() => {
        this.sendMeshMessage(relayPacket.receiverId, relayPacket);
      }, Math.floor(Math.random() * 150) + 100);
    }
  }

  /**
   * ОТПРАВКА СООБЩЕНИЯ В РАДИОЭФИР
   */
  public static async sendMeshMessage(targetUid: string, message: any): Promise<boolean> {
    const currentUid = this.myUid || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_auth_uid') : '') || 'user';
    const packet: MeshPacket = {
      id: message.id || `${currentUid}_${Date.now()}`,
      senderId: currentUid,
      receiverId: targetUid,
      chatId: message.chatId || [currentUid, targetUid].sort().join('_'),
      text: message.text || message.content || '',
      createdAt: message.createdAt || new Date().toISOString(),
      ttl: message.ttl ?? 3,
      relayPath: message.relayPath || [currentUid]
    };

    // Заносим в свой кэш, чтобы не обрабатывать эхо от соседей
    this.seenPackets.add(packet.id);

    return new Promise((resolve) => {
      // Все операции записи выполняются строго последовательно через очередь
      this.bleOperationQueue = this.bleOperationQueue.then(async () => {
        let delivered = false;
        const targetMac = this.uidToMac.get(targetUid);

        // 1. Точечная отправка (если знаем точный MAC)
        if (targetMac) {
          delivered = await this.writeToGatt(targetMac, packet);
        }

        // 2. Если MAC неизвестен или передача сорвалась — веерная отправка (Flooding)
        if (!delivered) {
          const allPeers = Array.from(this.peers.keys());
          for (const mac of allPeers) {
            const ok = await this.writeToGatt(mac, packet);
            if (ok) delivered = true;
          }
        }
        resolve(delivered);
      });
    });
  }

  public static async sendDirectMessage(targetId: string, packet: any): Promise<boolean> {
    return this.sendMeshMessage(targetId, packet);
  }

  private static async writeToGatt(mac: string, packet: MeshPacket): Promise<boolean> {
    try {
      await BleClient.connect(mac);
      const jsonStr = JSON.stringify(packet);
      const encoder = new TextEncoder();
      const dataView = numbersToDataView(Array.from(encoder.encode(jsonStr)));

      await BleClient.write(mac, ORDINA_SERVICE, ORDINA_CHAR, dataView);
      await BleClient.disconnect(mac);
      console.log(`[Mesh] Пакет успешно записан в узел ${mac}`);
      return true;
    } catch (e) {
      try { await BleClient.disconnect(mac); } catch (_) {}
      // Пакет не доставлен на этот узел
      return false;
    }
  }

  public static getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values());
  }

  public static registerPeer(peer: DiscoveredPeer) {
    this.peers.set(peer.mac || peer.id, peer);
    this.notifyPeers();
  }
}
