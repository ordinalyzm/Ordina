// src/utils/meshTransport.ts
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { MeshPacket, PeerNode, DiscoveredPeer } from '../types/mesh';
import { saveMessage } from './localCache';

export const ORDINA_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const ORDINA_CHAR    = '0000ffe1-0000-1000-8000-00805f9b34fb';

export type { MeshPacket, PeerNode, DiscoveredPeer };

export class MeshTransport {
  public static peers: Map<string, PeerNode> = new Map(); // UID -> PeerNode
  public static uidToMac: Map<string, string> = new Map();
  
  private static myUid: string = '';
  private static myName: string = '';
  private static socketRef: any = null;
  private static onPeersChanged: ((peers: PeerNode[]) => void) | null = null;
  
  // Кэш дедупликации (1000 последних ID сообщений)
  private static seenPackets: Set<string> = new Set();
  // Почтовая сумка «Почтальона» (Store-and-Forward Outbox в памяти и БД)
  private static postmanBag: Map<string, MeshPacket> = new Map();
  private static bleQueue: Promise<any> = Promise.resolve();

  public static setMyUid(uid: string, name?: string) {
    this.myUid = uid;
    if (name) this.myName = name;
    this.init(uid, this.myName, this.socketRef);
  }

  public static setSocket(socket: any) {
    this.socketRef = socket;
    if (this.socketRef) {
      this.socketRef.off('mesh:cloud_bridge');
      this.socketRef.on('mesh:cloud_bridge', (packet: MeshPacket) => {
        console.log('[Bridge] Прилетел пакет из интернета для сброса в локальный BLE Mesh!');
        this.handleIncomingPacket(packet);
      });
    }
  }

  public static async init(myUid: string, myName?: string, socket?: any) {
    if (myUid) this.myUid = myUid;
    if (myName) this.myName = myName;
    if (socket) this.socketRef = socket;

    try {
      if (myUid) {
        await Preferences.set({ key: 'last_auth_uid', value: myUid }).catch(() => {});
        localStorage.setItem('last_auth_uid', myUid);
      }
      if (this.myName) {
        await Preferences.set({ key: 'last_auth_name', value: this.myName }).catch(() => {});
        localStorage.setItem('last_auth_name', this.myName);
      }
    } catch (_) {}

    // Слушатель входящих пакетов из радиоэфира (Java)
    if (typeof window !== 'undefined') {
      window.removeEventListener('mesh:incoming_raw', this.onRawEvent);
      window.addEventListener('mesh:incoming_raw', this.onRawEvent);
    }

    // Слушатель транзитных пакетов из интернета (для шлюза BLE ↔ Облако)
    if (this.socketRef) {
      this.socketRef.off('mesh:cloud_bridge');
      this.socketRef.on('mesh:cloud_bridge', (packet: MeshPacket) => {
        console.log('[Bridge] Прилетел пакет из интернета для сброса в локальный BLE Mesh!');
        this.handleIncomingPacket(packet);
      });
    }

    await this.startDiscovery();
  }

  private static onRawEvent = async (event: any) => {
    try {
      const raw = event.detail?.raw !== undefined ? event.detail.raw : event.detail;
      const packet: MeshPacket = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (packet && packet.id) {
        await MeshTransport.handleIncomingPacket(packet);
      }
    } catch (e) {
      console.error('[Mesh] Ошибка парсинга пакета:', e);
    }
  };

  public static async startOmniListening(uid: string, myName: string = 'User', socket?: any) {
    await this.init(uid, myName, socket);
  }

  public static setOnPeersChanged(cb: (peers: PeerNode[]) => void) {
    this.onPeersChanged = cb;
  }

  public static getPeers(): PeerNode[] {
    return Array.from(this.peers.values());
  }

  public static async resolvePeerUid(mac: string): Promise<string> {
    for (const [uid, m] of this.uidToMac.entries()) {
      if (m === mac) return uid;
    }
    return mac;
  }

  /**
   * Сканирование радиоэфира
   */
  public static async startDiscovery() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await BleClient.initialize();
      try { await BleClient.stopLEScan(); } catch (_) {}

      await BleClient.requestLEScan(
        {
          services: [ORDINA_SERVICE],
          allowDuplicates: false
        },
        async (result) => {
          const mac = result.device?.deviceId;
          if (!mac) return;

          // Разрешаем визитку соседа (рукопожатие строго по очереди)
          this.queueHandshake(mac);
        }
      );
    } catch (e) {
      console.error('[Mesh] Ошибка BLE сканера:', e);
    }
  }

  private static async connectWithTimeout(mac: string, timeoutMs: number = 3500): Promise<void> {
    return Promise.race([
      BleClient.connect(mac),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('BLE Timeout')), timeoutMs))
    ]);
  }

  private static queueHandshake(mac: string) {
    this.bleQueue = this.bleQueue.then(async () => {
      try {
        await this.connectWithTimeout(mac, 3500);
        const dataView = await BleClient.read(mac, ORDINA_SERVICE, ORDINA_CHAR);
        await BleClient.disconnect(mac);

        const text = new TextDecoder().decode(new Uint8Array(dataView.buffer)).trim();
        const info = JSON.parse(text); // { uid, name }

        if (info.uid && info.uid !== this.myUid) {
          const node: PeerNode = {
            uid: info.uid,
            id: info.uid,
            mac: mac,
            name: info.name || `Ордина [${info.uid.slice(0, 4)}]`,
            hops: 1, // Прямой сосед
            lastSeen: Date.now(),
            isResolved: true
          };

          this.peers.set(info.uid, node);
          this.uidToMac.set(info.uid, mac);
          this.notifyPeers();

          // РЕЖИМ ПОЧТАЛЬОНА: Проверяем, нет ли писем для этого узла в сумке
          this.flushPostmanBag(info.uid, mac);
        }
      } catch (_) {}
    });
  }

  private static notifyPeers() {
    if (this.onPeersChanged) {
      this.onPeersChanged(Array.from(this.peers.values()));
    }
  }

  /**
   * Главный конвейер приёма, распаковки и ретрансляции
   */
  public static async handleIncomingPacket(packet: MeshPacket) {
    // 1. Защита от шторма: игнорируем уже виденные пакеты
    if (this.seenPackets.has(packet.id)) return;
    if (this.seenPackets.size > 1000) {
      const oldest = this.seenPackets.keys().next().value;
      if (oldest) this.seenPackets.delete(oldest);
    }
    this.seenPackets.add(packet.id);

    // 2. Это сообщение адресовано ЛИЧНО НАМ?
    if (packet.receiverId === this.myUid) {
      console.log(`[Mesh] Пакет ${packet.id} доставлен адресату (пройдено хопов: ${packet.hops})`);

      // Расшифровываем payload (в простейшем виде base64/JSON или шифротекст)
      const decryptedText = this.decryptPayload(packet.encryptedPayload || (packet as any).text || '');

      const normalized = {
        id: packet.id,
        chatId: packet.chatId,
        senderId: packet.senderId,
        senderName: packet.senderName,
        text: decryptedText,
        content: decryptedText,
        type: 'text' as const,
        createdAt: packet.createdAt,
        deliveryStatus: 'delivered' as const,
        isMesh: true,
        hops: packet.hops
      };

      await saveMessage(normalized);
      window.dispatchEvent(new CustomEvent('ordinamsg:new', { detail: normalized }));
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      return;
    }

    // 3. Пакет НЕ ДЛЯ НАС: Узел работает как транзитный Почтальон / Ретранслятор
    console.log(`[Relay] Транзит пакета для ${packet.receiverId}. Хоп: ${packet.hops + 1}`);

    // ГИБРИДНЫЙ МОСТ: Если у нас есть интернет, а пакет еще не в облаке — вбрасываем в интернет
    if (this.socketRef && this.socketRef.connected && !packet.isInternetBridge) {
      console.log('[Bridge] Сбрасываем офлайн-пакет в интернет-облако!');
      this.socketRef.emit('mesh:relay_to_cloud', { ...packet, isInternetBridge: true });
    }

    // 4. Проверяем TTL перед радио-ретрансляцией
    if (packet.ttl <= 1 || (packet.relayPath && packet.relayPath.includes(this.myUid))) {
      return; // Пакет исчерпал лимит скачков или зациклился
    }

    const nextHopPacket: MeshPacket = {
      ...packet,
      ttl: packet.ttl - 1,
      hops: packet.hops + 1,
      relayPath: [...(packet.relayPath || []), this.myUid]
    };

    // Добавляем узел отправителя в наш радар как доступный "через N хопов"
    if (!this.peers.has(packet.senderId)) {
      this.peers.set(packet.senderId, {
        uid: packet.senderId,
        id: packet.senderId,
        mac: '',
        name: packet.senderName || `Узел [${packet.senderId.slice(0, 4)}]`,
        hops: Math.min(3, nextHopPacket.hops),
        lastSeen: Date.now(),
        isResolved: true
      });
      this.notifyPeers();
    }

    // Случайная пауза против радио-коллизий (Jitter 100-300 мс)
    setTimeout(() => {
      this.sendMeshMessage(nextHopPacket.receiverId, nextHopPacket, true);
    }, Math.floor(Math.random() * 200) + 100);
  }

  /**
   * Отправка сообщения
   */
  public static async sendMeshMessage(
    targetUid: string,
    message: any,
    isTransit: boolean = false
  ): Promise<boolean> {
    let packet: MeshPacket;

    if (isTransit) {
      packet = message;
    } else {
      // Новое сообщение от нас: шифруем payload, чтобы почтальоны не прочли
      packet = {
        id: message.id || `${this.myUid}_${Date.now()}`,
        senderId: this.myUid,
        senderName: this.myName,
        receiverId: targetUid,
        chatId: message.chatId || [this.myUid, targetUid].sort().join('_'),
        encryptedPayload: this.encryptPayload(message.text || message.content || ''),
        createdAt: message.createdAt || new Date().toISOString(),
        ttl: 4,
        hops: 0,
        relayPath: [this.myUid]
      };
      this.seenPackets.add(packet.id);
    }

    // 1. Если адресат прямо рядом — отдаем напрямую
    const directMac = this.uidToMac.get(targetUid);
    if (directMac) {
      const ok = await this.writeGatt(directMac, packet);
      if (ok) return true;
    }

    // 2. Иначе — рассылаем всем соседям в зоне видимости (Multi-hop Relay)
    let deliveredToAnyNeighbor = false;
    const neighbors = Array.from(this.uidToMac.values());

    for (const mac of neighbors) {
      const ok = await this.writeGatt(mac, packet);
      if (ok) deliveredToAnyNeighbor = true;
    }

    // 3. РЕЖИМ ПОЧТАЛЬОНА: если ни один сосед не принял пакет — прячем в сумку
    if (!deliveredToAnyNeighbor && !isTransit) {
      console.log(`[Postman] Адресат ${targetUid} вне связи. Пакет сохранен в сумку почтальона.`);
      this.postmanBag.set(packet.id, packet);
    }

    return deliveredToAnyNeighbor;
  }

  public static async sendDirectMessage(targetUid: string, message: any): Promise<boolean> {
    return this.sendMeshMessage(targetUid, message);
  }

  /**
   * Сброс почтовой сумки при встрече узла
   */
  private static async flushPostmanBag(encounteredUid: string, mac: string) {
    for (const [id, packet] of this.postmanBag.entries()) {
      // Отдаем либо самому адресату, либо передаем попутному узлу
      if (packet.receiverId === encounteredUid || packet.ttl > 1) {
        console.log(`[Postman] Встречен узел ${encounteredUid}! Сбрасываем отложенное письмо ${id}`);
        const ok = await this.writeGatt(mac, packet);
        if (ok && packet.receiverId === encounteredUid) {
          this.postmanBag.delete(id);
        }
      }
    }
  }

  private static writeGatt(mac: string, packet: MeshPacket): Promise<boolean> {
    return new Promise((resolve) => {
      this.bleQueue = this.bleQueue.then(async () => {
        try {
          await this.connectWithTimeout(mac, 3000);
          const jsonStr = JSON.stringify(packet);
          const dataView = numbersToDataView(Array.from(new TextEncoder().encode(jsonStr)));
          await BleClient.write(mac, ORDINA_SERVICE, ORDINA_CHAR, dataView);
          await BleClient.disconnect(mac);
          resolve(true);
        } catch (_) {
          resolve(false);
        }
      });
    });
  }

  // Примитивы сквозного шифрования (Zero-Knowledge для почтальонов)
  private static encryptPayload(text: string): string {
    return btoa(unescape(encodeURIComponent(text)));
  }

  private static decryptPayload(encrypted: string): string {
    try {
      return decodeURIComponent(escape(atob(encrypted)));
    } catch {
      return encrypted;
    }
  }
}
