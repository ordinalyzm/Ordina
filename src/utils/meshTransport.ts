// src/utils/meshTransport.ts
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { MeshPacket, PeerNode } from '../types/mesh';
import { Message } from '../types';
import { saveMessage } from './localCache';

export const ORDINA_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const ORDINA_CHAR    = '0000ffe1-0000-1000-8000-00805f9b34fb';

export type DiscoveredPeer = PeerNode;

export class MeshTransport {
  public static peers: Map<string, PeerNode> = new Map();
  public static uidToMac: Map<string, string> = new Map();
  
  private static myUid: string = '';
  private static myName: string = '';
  private static socketRef: any = null;
  private static onPeersChanged: ((peers: PeerNode[]) => void) | null = null;
  
  // Кэш дедупликации (защита от зацикливания)
  private static seenPackets: Set<string> = new Set();
  // Сумка «Почтальона» (Store-and-Forward)
  private static postmanBag: Map<string, MeshPacket> = new Map();
  // Очередь BLE операций (защита от GATT 133)
  private static bleQueue: Promise<any> = Promise.resolve();

  public static setMyUid(uid: string) {
    this.myUid = uid;
  }

  public static async startOmniListening(uid?: string, name?: string) {
    if (uid) this.myUid = uid;
    if (name) this.myName = name;
    await this.startDiscovery();
  }

  public static async init(myUid: string, myName: string, socket?: any) {
    if (!Capacitor.isNativePlatform()) return;
    this.myUid = myUid;
    this.myName = myName || 'Странник';
    this.socketRef = socket;

    await Preferences.set({ key: 'last_auth_uid', value: myUid });
    await Preferences.set({ key: 'last_auth_name', value: this.myName });

    // Прием пакетов из Java
    window.addEventListener('mesh:incoming_raw', async (event: any) => {
      const packet: MeshPacket = event.detail;
      if (packet && packet.id) {
        await this.handleIncomingPacket(packet);
      }
    });

    // Прием пакетов от интернет-шлюза (Гибридный мост)
    if (this.socketRef) {
      this.socketRef.on('mesh:cloud_bridge', (packet: MeshPacket) => {
        this.handleIncomingPacket(packet);
      });
    }

    await this.startDiscovery();
  }

  public static setOnPeersChanged(cb: (peers: PeerNode[]) => void) {
    this.onPeersChanged = cb;
  }

  public static async startDiscovery() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await BleClient.initialize();
      try { await BleClient.stopLEScan(); } catch (_) {}

      await BleClient.requestLEScan(
        { services: [ORDINA_SERVICE], allowDuplicates: false },
        async (result) => {
          const mac = result.device?.deviceId;
          if (mac) this.queueHandshake(mac);
        }
      );
    } catch (e) {
      console.error('[Mesh] BLE Scan error:', e);
    }
  }

  private static queueHandshake(mac: string) {
    this.bleQueue = this.bleQueue.then(async () => {
      try {
        await BleClient.connect(mac);
        const dataView = await BleClient.read(mac, ORDINA_SERVICE, ORDINA_CHAR);
        await BleClient.disconnect(mac);

        const text = new TextDecoder().decode(dataView.buffer).trim();
        const info = JSON.parse(text);

        if (info.uid && info.uid !== this.myUid) {
          const node: PeerNode = {
            uid: info.uid,
            mac: mac,
            name: info.name || `Ордина [${info.uid.slice(0, 4)}]`,
            hops: 1, // Прямой радиососед
            lastSeen: Date.now()
          };

          this.peers.set(info.uid, node);
          this.uidToMac.set(info.uid, mac);
          this.notifyPeers();

          // Почтальон сбрасывает письма при встрече узла
          this.flushPostmanBag(info.uid, mac);
        }
      } catch (_) {
        // Ошибка подключения (узел вне зоны или занят)
      }
    });
  }

  private static notifyPeers() {
    if (this.onPeersChanged) {
      this.onPeersChanged(Array.from(this.peers.values()));
    }
  }

  /**
   * Отправка сообщения в Mesh
   */
  public static async sendMessage(
    targetUid: string | undefined,
    groupId: string | undefined,
    text: string,
    chatId: string
  ): Promise<MeshPacket> {
    const packet: MeshPacket = {
      id: `mesh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: this.myUid,
      senderName: this.myName,
      receiverId: targetUid,
      groupId: groupId,
      chatId: chatId,
      encryptedPayload: this.encryptPayload(text),
      hops: 0,
      maxHops: 7,
      createdAt: new Date().toISOString()
    };

    this.seenPackets.add(packet.id);

    // 1. Попытка прямой отправки, если адресат рядом
    if (targetUid && this.uidToMac.has(targetUid)) {
      const mac = this.uidToMac.get(targetUid)!;
      const sent = await this.writeGatt(mac, packet);
      if (sent) return packet;
    }

    // 2. Если прямой контакт не удался - кладем в сумку Почтальона
    this.postmanBag.set(packet.id, packet);

    // 3. Рассылаем радиоволной всем доступным соседям
    await this.broadcastToNeighbors(packet);

    return packet;
  }

  public static async sendMeshMessage(
    targetUidOrGroupId: string,
    message: any,
    isGroup: boolean = false
  ) {
    const text = message.text || message.content || '';
    const targetUid = isGroup ? undefined : targetUidOrGroupId;
    const groupId = isGroup ? targetUidOrGroupId : undefined;
    return this.sendMessage(targetUid, groupId, text, message.chatId || targetUidOrGroupId);
  }

  public static async sendDirectMessage(peerId: string, packetData: any) {
    const packet: MeshPacket = {
      id: packetData.id || `mesh_${Date.now()}`,
      senderId: packetData.senderId || this.myUid,
      senderName: packetData.senderName || this.myName,
      receiverId: packetData.receiverId || peerId,
      chatId: packetData.chatId || [this.myUid, peerId].sort().join('_'),
      encryptedPayload: this.encryptPayload(packetData.text || packetData.content || ''),
      hops: 0,
      maxHops: 5,
      createdAt: packetData.createdAt || new Date().toISOString()
    };
    return this.sendMessage(peerId, undefined, packetData.text || packetData.content || '', packet.chatId);
  }

  /**
   * Обработка любого входящего пакета (из Java, по BLE или через Мост)
   */
  public static async handleIncomingPacket(packet: MeshPacket) {
    if (!packet || !packet.id) return;

    // Дедупликация: игнорируем уже виденные пакеты
    if (this.seenPackets.has(packet.id)) return;
    this.seenPackets.add(packet.id);

    // Увеличиваем счетчик прыжков
    packet.hops = (packet.hops || 0) + 1;
    if (packet.hops > (packet.maxHops || 7)) return;

    // СЛУЧАЙ 1: Это квитанция о доставке (ACK)
    if (packet.isAck) {
      window.dispatchEvent(new CustomEvent('ordinamsg:ack', { detail: packet }));
      if (packet.senderId !== this.myUid) {
        await this.relayPacket(packet);
      }
      return;
    }

    // СЛУЧАЙ 2: Групповой канал / общий эфир
    if (packet.groupId) {
      const decryptedText = this.decryptPayload(packet.encryptedPayload || '');
      const normalized: Message = {
        id: packet.id,
        chatId: packet.chatId || packet.groupId,
        groupId: packet.groupId,
        senderId: packet.senderId,
        senderName: packet.senderName,
        text: decryptedText,
        content: decryptedText,
        createdAt: packet.createdAt,
        type: 'text',
        deliveryStatus: 'delivered',
        isMesh: true,
        hops: packet.hops
      };

      await saveMessage(normalized);
      window.dispatchEvent(new CustomEvent('ordinamsg:new', { detail: normalized }));
      if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);

      // Групповое сообщение всегда ретранслируется дальше другим узлам
      await this.relayPacket(packet);
      return;
    }

    // СЛУЧАЙ 3: Личное сообщение лично нам
    if (packet.receiverId === this.myUid) {
      const decryptedText = this.decryptPayload(packet.encryptedPayload || '');
      const normalized: Message = {
        id: packet.id,
        chatId: packet.chatId || [packet.senderId, this.myUid].sort().join('_'),
        senderId: packet.senderId,
        senderName: packet.senderName,
        text: decryptedText,
        content: decryptedText,
        createdAt: packet.createdAt,
        type: 'text',
        deliveryStatus: 'delivered',
        isMesh: true,
        hops: packet.hops
      };

      await saveMessage(normalized);
      window.dispatchEvent(new CustomEvent('ordinamsg:new', { detail: normalized }));
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      return;
    }

    // СЛУЧАЙ 4: Транзитный личный пакет для кого-то другого
    await this.relayPacket(packet);
  }

  private static async relayPacket(packet: MeshPacket) {
    // Гибридный интернет-шлюз
    if (this.socketRef && this.socketRef.connected && !packet.isInternetBridge) {
      this.socketRef.emit('mesh:relay_to_cloud', { ...packet, isInternetBridge: true });
    }

    // Если целевой узел среди прямых соседей — отдаем лично ему
    if (packet.receiverId && this.uidToMac.has(packet.receiverId)) {
      const mac = this.uidToMac.get(packet.receiverId)!;
      await this.writeGatt(mac, packet);
      return;
    }

    // Иначе ретранслируем всем доступным узлам
    await this.broadcastToNeighbors(packet);
  }

  private static async broadcastToNeighbors(packet: MeshPacket) {
    for (const [_, node] of this.peers) {
      if (node.mac) {
        this.writeGatt(node.mac, packet).catch(() => {});
      }
    }
  }

  private static async flushPostmanBag(encounteredUid: string, mac: string) {
    for (const [id, packet] of this.postmanBag) {
      if (packet.receiverId === encounteredUid || !packet.receiverId || packet.groupId) {
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
          await BleClient.connect(mac);
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
