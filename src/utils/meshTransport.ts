// src/utils/meshTransport.ts
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { MeshPacket, PeerNode } from '../types/mesh';
import { saveMessage, markMessagesAsReadInDb } from './localCache';

export const ORDINA_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const ORDINA_CHAR    = '0000ffe1-0000-1000-8000-00805f9b34fb';

// Таймаут жизни узла в эфире: если за 12 секунд маяк не прилетал — узел выключен
const PEER_TIMEOUT_MS = 12000;

export type DiscoveredPeer = PeerNode;

export class MeshTransport {
  public static peers: Map<string, PeerNode> = new Map();
  public static uidToMac: Map<string, string> = new Map();
  public static macToUid: Map<string, string> = new Map();
  
  private static myUid: string = '';
  private static myName: string = '';
  private static socketRef: any = null;
  private static onPeersChanged: ((peers: PeerNode[]) => void) | null = null;
  
  private static seenPackets: Set<string> = new Set();
  private static postmanBag: Map<string, MeshPacket> = new Map();
  private static bleQueue: Promise<any> = Promise.resolve();
  
  private static handshakingMacs: Set<string> = new Set();
  private static isScanningActive = false;
  private static heartbeatTimer: any = null;

  public static setMyUid(uid: string) {
    this.myUid = uid;
  }

  public static async startOmniListening(uid?: string, name?: string) {
    if (uid) this.myUid = uid;
    if (name) this.myName = name;
    await this.startContinuousMesh();
  }

  public static async init(myUid: string, myName: string, socket?: any) {
    if (!Capacitor.isNativePlatform()) return;
    this.myUid = myUid;
    this.myName = myName || 'Странник';
    this.socketRef = socket;

    // Сохраняем имя и UID для нативного Java-слоя
    await Preferences.set({ key: 'last_auth_uid', value: myUid });
    await Preferences.set({ key: 'last_auth_name', value: this.myName });

    // Слушатель входящих радиопакетов
    window.addEventListener('mesh:incoming_raw', async (event: any) => {
      const packet: MeshPacket = event.detail;
      if (packet && packet.id) {
        await this.handleIncomingPacket(packet);
      }
    });

    if (this.socketRef) {
      this.socketRef.on('mesh:cloud_bridge', (packet: MeshPacket) => {
        this.handleIncomingPacket(packet);
      });
    }

    // Запускаем фоновый таймер проверки "живых" узлов (каждые 3 сек)
    this.startHeartbeatMonitor();

    // Запускаем непрерывный фоновый меш
    await this.startContinuousMesh();
  }

  public static setOnPeersChanged(cb: (peers: PeerNode[]) => void) {
    this.onPeersChanged = cb;
    // Сразу отдаем текущих живых пиров
    cb(Array.from(this.peers.values()));
  }

  public static getPeers(): PeerNode[] {
    return Array.from(this.peers.values());
  }

  public static async startDiscovery() {
    await this.startContinuousMesh();
  }

  /**
   * СТОРОЖЕВОЙ ТАЙМЕР (Авто-удаление выключенных телефонов с радара)
   */
  private static startHeartbeatMonitor() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      for (const [uid, peer] of this.peers.entries()) {
        // Если узел напрямую (1 хоп) и не подавал сигналов > 12 секунд
        if (peer.hops === 1 && now - peer.lastSeen > PEER_TIMEOUT_MS) {
          console.log(`[Mesh] Узел ${peer.name} (${peer.mac}) пропал из радиоэфира`);
          this.peers.delete(uid);
          this.uidToMac.delete(uid);
          if (peer.mac) {
            this.macToUid.delete(peer.mac);
            this.handshakingMacs.delete(peer.mac);
          }
          hasChanges = true;
        }
      }

      if (hasChanges) {
        this.notifyPeers();
      }
    }, 3000);
  }

  /**
   * НЕПРЕРЫВНЫЙ СКАНИРУЮЩИЙ ДЕМОН (Не глушится никогда)
   */
  public static async startContinuousMesh() {
    if (this.isScanningActive || !Capacitor.isNativePlatform()) return;

    try {
      await BleClient.initialize();
      try { await BleClient.stopLEScan(); } catch (_) {}

      this.isScanningActive = true;

      // allowDuplicates: true КРИТИЧЕН для обновления RSSI и времени жизни (lastSeen)
      await BleClient.requestLEScan(
        {
          services: [ORDINA_SERVICE],
          allowDuplicates: true
        },
        (result) => {
          const mac = result.device?.deviceId;
          if (!mac) return;

          const now = Date.now();
          const rssi = result.rssi || -60;

          // 1. ЕСЛИ УЗЕЛ УЖЕ ИЗВЕСТЕН: Просто обновляем пульс и уровень сигнала (БЕЗ CONNECT)
          const knownUid = this.macToUid.get(mac);
          if (knownUid && this.peers.has(knownUid)) {
            const peer = this.peers.get(knownUid)!;
            peer.lastSeen = now;
            peer.rssi = rssi;
            this.notifyPeers();
            return;
          }

          // 2. ЕСЛИ УЗЕЛ НОВЫЙ: Ставим в очередь рукопожатия ровно 1 раз
          if (!this.handshakingMacs.has(mac)) {
            this.handshakingMacs.add(mac);
            this.queueHandshake(mac, rssi);
          }
        }
      );
      console.log('[Mesh] Непрерывный радиоэфир Ordina активирован');
    } catch (e) {
      console.error('[Mesh] Ошибка непрерывного сканера:', e);
      this.isScanningActive = false;
      // Перезапуск при сбое через 5 секунд
      setTimeout(() => this.startContinuousMesh(), 5000);
    }
  }

  /**
   * Очередь рукопожатия (Узнаем UID и реальный ник)
   */
  private static queueHandshake(mac: string, initialRssi: number) {
    this.bleQueue = this.bleQueue.then(async () => {
      try {
        await BleClient.connect(mac);
        const dataView = await BleClient.read(mac, ORDINA_SERVICE, ORDINA_CHAR);
        await BleClient.disconnect(mac);

        const text = new TextDecoder().decode(dataView.buffer).trim();
        const info = JSON.parse(text); // { uid, name }

        if (info.uid && info.uid !== this.myUid) {
          // Если имя еще дефолтное, даем красивый читаемый идентификатор
          const cleanName = (info.name && info.name !== 'Узел') 
            ? info.name 
            : `Ордина [${info.uid.slice(0, 5)}]`;

          const node: PeerNode = {
            uid: info.uid,
            mac: mac,
            name: cleanName,
            hops: 1,
            rssi: initialRssi,
            lastSeen: Date.now()
          };

          this.peers.set(info.uid, node);
          this.uidToMac.set(info.uid, mac);
          this.macToUid.set(mac, info.uid);
          
          console.log(`[Mesh] Авторизован узел: ${cleanName} (${mac})`);
          this.notifyPeers();

          // Сбрасываем почту, если были письма для него
          this.flushPostmanBag(info.uid, mac);
        }
      } catch (err) {
        // При неудачном подключении дадим шанс попробовать снова через 6 секунд
        setTimeout(() => {
          this.handshakingMacs.delete(mac);
        }, 6000);
      }
    });
  }

  private static notifyPeers() {
    if (this.onPeersChanged) {
      this.onPeersChanged(Array.from(this.peers.values()));
    }
  }

  public static async handleIncomingPacket(packet: MeshPacket) {
    if (!packet || !packet.id) return;
    if (this.seenPackets.has(packet.id)) return;
    if (this.seenPackets.size > 1000) {
      const oldest = this.seenPackets.keys().next().value;
      if (oldest) this.seenPackets.delete(oldest);
    }
    this.seenPackets.add(packet.id);

    // СЛУЧАЙ А: Отчет о прочтении
    if (packet.type === 'ack_read') {
      if (packet.receiverId === this.myUid && packet.readMessageIds) {
        await markMessagesAsReadInDb(packet.readMessageIds);
        window.dispatchEvent(new CustomEvent('ordinamsg:status_update', {
          detail: { messageIds: packet.readMessageIds, status: 'read' }
        }));
        return;
      }
      await this.relayPacket(packet);
      return;
    }

    // СЛУЧАЙ Б: Групповое сообщение
    if (packet.groupId) {
      if (packet.senderId !== this.myUid) {
        const decryptedText = this.decryptPayload(packet.encryptedPayload || '');
        const normalized = {
          id: packet.id,
          chatId: packet.chatId,
          groupId: packet.groupId,
          senderId: packet.senderId,
          senderName: packet.senderName,
          text: decryptedText,
          content: decryptedText,
          createdAt: packet.createdAt,
          type: 'text' as const,
          deliveryStatus: 'delivered',
          isMesh: true,
          hops: packet.hops
        };

        await saveMessage(normalized);
        window.dispatchEvent(new CustomEvent('ordinamsg:new', { detail: normalized }));
        if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
      }
      await this.relayPacket(packet);
      return;
    }

    // СЛУЧАЙ В: Личное сообщение лично нам
    if (packet.receiverId === this.myUid) {
      const decryptedText = this.decryptPayload(packet.encryptedPayload || '');
      const normalized = {
        id: packet.id,
        chatId: packet.chatId,
        senderId: packet.senderId,
        senderName: packet.senderName,
        text: decryptedText,
        content: decryptedText,
        createdAt: packet.createdAt,
        type: 'text' as const,
        deliveryStatus: 'delivered',
        isMesh: true,
        hops: packet.hops
      };

      await saveMessage(normalized);
      window.dispatchEvent(new CustomEvent('ordinamsg:new', { detail: normalized }));
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      return;
    }

    // СЛУЧАЙ Г: Транзит
    await this.relayPacket(packet);
  }

  private static async relayPacket(packet: MeshPacket) {
    if (this.socketRef && this.socketRef.connected && !packet.isInternetBridge) {
      this.socketRef.emit('mesh:relay_to_cloud', { ...packet, isInternetBridge: true });
    }

    const currentTtl = packet.ttl ?? 4;
    if (currentTtl <= 1 || (packet.relayPath && packet.relayPath.includes(this.myUid))) {
      return;
    }

    const nextHop: MeshPacket = {
      ...packet,
      ttl: currentTtl - 1,
      hops: (packet.hops || 0) + 1,
      relayPath: [...(packet.relayPath || []), this.myUid]
    };

    if (!this.peers.has(packet.senderId)) {
      this.peers.set(packet.senderId, {
        uid: packet.senderId,
        mac: '',
        name: packet.senderName || `Узел [${packet.senderId.slice(0, 4)}]`,
        hops: Math.min(3, nextHop.hops),
        lastSeen: Date.now()
      });
      this.notifyPeers();
    }

    setTimeout(() => {
      this.broadcastToNeighbors(nextHop);
    }, Math.floor(Math.random() * 150) + 100);
  }

  public static async sendMeshMessage(
    targetUidOrGroupId: string,
    message: any,
    isGroup: boolean = false
  ): Promise<boolean> {
    const isAck = message.type === 'ack_read';

    const packet: MeshPacket = {
      id: message.id || `${this.myUid}_${Date.now()}`,
      type: message.type || 'text',
      senderId: this.myUid,
      senderName: this.myName,
      receiverId: isGroup ? undefined : targetUidOrGroupId,
      groupId: isGroup ? targetUidOrGroupId : undefined,
      chatId: message.chatId || (isGroup ? targetUidOrGroupId : [this.myUid, targetUidOrGroupId].sort().join('_')),
      encryptedPayload: isAck ? undefined : this.encryptPayload(message.text || message.content || ''),
      readMessageIds: message.readMessageIds,
      createdAt: message.createdAt || new Date().toISOString(),
      ttl: 4,
      hops: 0,
      relayPath: [this.myUid]
    };

    this.seenPackets.add(packet.id);

    if (!isGroup && !isAck) {
      const directMac = this.uidToMac.get(targetUidOrGroupId);
      if (directMac) {
        const ok = await this.writeGatt(directMac, packet);
        if (ok) return true;
      }
    }

    const delivered = await this.broadcastToNeighbors(packet);

    if (!delivered && !isAck) {
      this.postmanBag.set(packet.id, packet);
    }

    return delivered;
  }

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
      ttl: 4,
      createdAt: new Date().toISOString()
    };
    await this.sendMeshMessage(targetUid || groupId || chatId, { ...packet, text }, Boolean(groupId));
    return packet;
  }

  public static async sendDirectMessage(peerId: string, packetData: any) {
    return this.sendMeshMessage(peerId, packetData, false);
  }

  public static async sendReadReceipt(authorUid: string, chatId: string, messageIds: string[]) {
    if (!messageIds || messageIds.length === 0) return;
    await this.sendMeshMessage(authorUid, {
      type: 'ack_read',
      chatId: chatId,
      readMessageIds: messageIds
    }, false);
  }

  private static async broadcastToNeighbors(packet: MeshPacket): Promise<boolean> {
    let anyDelivered = false;
    const neighbors = Array.from(this.uidToMac.values());

    for (const mac of neighbors) {
      const ok = await this.writeGatt(mac, packet);
      if (ok) anyDelivered = true;
    }
    return anyDelivered;
  }

  private static async flushPostmanBag(encounteredUid: string, mac: string) {
    for (const [id, packet] of this.postmanBag.entries()) {
      if (packet.receiverId === encounteredUid || packet.groupId || (packet.ttl && packet.ttl > 1)) {
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
