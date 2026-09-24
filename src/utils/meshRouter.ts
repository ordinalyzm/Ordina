// src/utils/meshRouter.ts
import { Message, MeshNode } from '../types';
import { MeshTransport, DiscoveredPeer } from './meshTransport';
import { saveMessage } from './localCache';

export class MeshRouter {
  private static instance: MeshRouter;
  public myUid: string = '';
  public myName: string = '';
  public isOnlineWithServer: boolean = false; // Есть ли выход в интернет

  // Очередь "Почтальона" - строго уникальные ID сообщений
  private muleOutbox: Map<string, Message> = new Map();
  private knownNodes: Map<string, MeshNode> = new Map();
  private seenMessageIds: Set<string> = new Set();

  private onNodesChangedCallbacks: Set<(nodes: MeshNode[]) => void> = new Set();
  private onMessageCallbacks: Set<(msg: Message) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;

  public static getInstance(): MeshRouter {
    if (!MeshRouter.instance) {
      MeshRouter.instance = new MeshRouter();
    }
    return MeshRouter.instance;
  }

  public init(uid: string, name: string, isServerConnected: boolean = false) {
    if (!uid) return;
    this.myUid = uid;
    this.myName = name || 'Пользователь';
    this.isOnlineWithServer = isServerConnected;

    // Включаем прием по ВСЕМ физическим каналам связи
    MeshTransport.setOnPeersChanged((peers) => this.handleDiscoveredPeers(peers));
    MeshTransport.startOmniListening(uid, this.myName);

    // Подключаем локальный канал для приема сообщений
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window && !this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel('ordina_local_mesh');
      this.broadcastChannel.onmessage = (event) => {
        this.handleIncomingBroadcast(event.data);
      };
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mesh:incoming', (e: any) => {
        if (e.detail) {
          this.handleIncomingDirectPacket(e.detail);
        }
      });
    }
  }

  /** Прием входящего прямого пакета по BLE GATT */
  private async handleIncomingDirectPacket(packet: any) {
    if (!packet) return;
    const msgId = packet.id || `ble_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (this.seenMessageIds.has(msgId)) return;
    this.seenMessageIds.add(msgId);

    const msg: Message = {
      id: msgId,
      chatId: [this.myUid, packet.senderId || 'peer'].sort().join('_'),
      senderId: packet.senderId || 'peer',
      receiverId: packet.receiverId || this.myUid,
      text: packet.text || packet.content || '',
      content: packet.text || packet.content || '',
      type: 'text',
      createdAt: packet.createdAt || new Date().toISOString(),
      deliveryStatus: 'delivered',
      isMesh: true,
      meshHops: 1
    };

    await saveMessage(msg);
    this.notifyMessage(msg);

    // Если у нас есть интернет — шлюзуем на сервер
    if (this.isOnlineWithServer) {
      window.dispatchEvent(new CustomEvent('mesh:gateway:send', { detail: msg }));
    }
  }

  public setServerOnlineStatus(online: boolean) {
    this.isOnlineWithServer = online;
    if (online) {
      // Если появился интернет — шлюз немедленно выгружает всю сумку почтальона в облако!
      this.flushMuleToCloud();
    }
  }

  /** Обработка устройств, найденных эфирным сканером */
  private handleDiscoveredPeers(peers: DiscoveredPeer[]) {
    peers.forEach(peer => {
      const peerId = peer.uid || peer.id || peer.mac || 'unknown';
      this.knownNodes.set(peerId, {
        id: peerId,
        displayName: peer.name || `Узел ${peerId.slice(0, 5)}`,
        status: 'active',
        hops: peer.hops || 1,
        lastSeen: new Date(peer.lastSeen).toISOString(),
        address: peer.mac || peer.ip,
        rssi: peer.rssi
      });

      // При встрече с узлом — проверяем, не несем ли мы для него сообщения
      this.deliverMulePacketsToPeer(peerId);
    });

    // Очистка устаревших узлов
    const now = Date.now();
    this.knownNodes.forEach((node, id) => {
      const diff = now - new Date(node.lastSeen).getTime();
      if (diff > 15000) {
        this.knownNodes.delete(id);
      }
    });

    this.notifyUI();
  }

  /** Прием входящих сообщений из локального эфира */
  private async handleIncomingBroadcast(data: any) {
    if (!data) return;

    if (data.type === 'DIRECT_MSG' && data.payload) {
      const msg: Message = data.payload;
      if (data.targetUid === this.myUid || msg.receiverId === this.myUid) {
        if (!this.seenMessageIds.has(msg.id)) {
          this.seenMessageIds.add(msg.id);
          msg.deliveryStatus = 'delivered';
          await saveMessage(msg);
          this.notifyMessage(msg);

          // Если у нас есть интернет — шлюзуем на сервер
          if (this.isOnlineWithServer) {
            window.dispatchEvent(new CustomEvent('mesh:gateway:send', { detail: msg }));
          }
        }
      }
    } else if (data.type === 'RELAY_MSG' && data.payload) {
      const msg: Message = data.payload;
      if (!this.seenMessageIds.has(msg.id)) {
        this.seenMessageIds.add(msg.id);
        
        if (msg.receiverId === this.myUid) {
          msg.deliveryStatus = 'delivered';
          await saveMessage(msg);
          this.notifyMessage(msg);
        } else {
          // Мы посредник (Mule) - сохраняем в сумку и несем дальше
          if ((msg.ttl || 5) > 1) {
            msg.ttl = (msg.ttl || 5) - 1;
            msg.meshHops = (msg.meshHops || 0) + 1;
            this.muleOutbox.set(msg.id, msg);
            this.notifyUI();
          }
        }

        // Если у нас есть интернет — шлюзуем на сервер
        if (this.isOnlineWithServer) {
          window.dispatchEvent(new CustomEvent('mesh:gateway:send', { detail: msg }));
        }
      }
    }
  }

  /** Отправка сообщения (офлайн или через цепочку) */
  public async sendMessage(receiverId: string, text: string): Promise<Message> {
    const msgId = `${this.myUid}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const message: Message = {
      id: msgId,
      chatId: [this.myUid, receiverId].sort().join('_'),
      senderId: this.myUid,
      receiverId: receiverId,
      text: text,
      content: text,
      type: 'text',
      createdAt: new Date().toISOString(),
      deliveryStatus: 'pending',
      isMesh: true,
      meshHops: 0,
      ttl: 5
    };

    // 1. Сохраняем в локальную базу данных SQLite
    await saveMessage(message);

    // 2. Кладём в сумку "Почтальона" (строго по msgId, без дубликатов!)
    this.muleOutbox.set(message.id, message);

    // 3. Если адресат прямо сейчас в зоне радиовидимости — передаем мгновенно
    if (this.knownNodes.has(receiverId)) {
      this.transmitDirectly(receiverId, message);
    } else {
      // Иначе вещаем всем соседям в надежде, что они передадут дальше по цепочке
      this.broadcastToNeighbors(message);
    }

    // 4. Если у нас самих есть интернет — отправляем копию на сервер
    if (this.isOnlineWithServer) {
      window.dispatchEvent(new CustomEvent('mesh:gateway:send', { detail: message }));
    }

    this.notifyUI();
    return message;
  }

  public async transmitDirectly(peerId: string, msg: Message) {
    try {
      this.broadcastChannel?.postMessage({
        type: 'DIRECT_MSG',
        targetUid: peerId,
        payload: msg
      });
    } catch (e) {}
    
    // Физическая передача пакета в радиоэфир по BLE GATT
    try {
      const packet = {
        id: msg.id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        text: msg.text || msg.content || '',
        createdAt: msg.createdAt
      };
      await MeshTransport.sendDirectMessage(peerId, packet);
    } catch (err) {
      console.warn('[MeshRouter] Прямая BLE передача не удалась:', err);
    }

    // Помечаем как доставленное
    msg.deliveryStatus = 'delivered';
    saveMessage(msg);
  }

  public broadcastToNeighbors(msg: Message) {
    try {
      this.broadcastChannel?.postMessage({
        type: 'RELAY_MSG',
        payload: msg
      });
    } catch (e) {}
  }

  /** Отправка писем адресату при встрече (Почтальон) */
  private deliverMulePacketsToPeer(peerId: string) {
    this.muleOutbox.forEach((msg, msgId) => {
      if (msg.receiverId === peerId) {
        this.transmitDirectly(peerId, msg);
        this.muleOutbox.delete(msgId); // Доставлено адресату
      }
    });
  }

  /** Шлюз: сброс почтальона на облачный сервер при появлении интернета */
  private flushMuleToCloud() {
    if (this.muleOutbox.size === 0) return;
    this.muleOutbox.forEach((msg) => {
      window.dispatchEvent(new CustomEvent('mesh:gateway:send', { detail: msg }));
    });
  }

  public getMuleCount(): number {
    return this.muleOutbox.size;
  }

  public getNodes(): MeshNode[] {
    return Array.from(this.knownNodes.values());
  }

  public subscribe(cb: (nodes: MeshNode[]) => void) {
    this.onNodesChangedCallbacks.add(cb);
    cb(this.getNodes());
    return () => {
      this.onNodesChangedCallbacks.delete(cb);
    };
  }

  public onMessage(cb: (msg: Message) => void) {
    this.onMessageCallbacks.add(cb);
    return () => {
      this.onMessageCallbacks.delete(cb);
    };
  }

  private lastNotifyTime: number = 0;
  private notifyThrottleTimer: any = null;

  private notifyUI() {
    const now = Date.now();
    if (now - this.lastNotifyTime > 800) {
      this.lastNotifyTime = now;
      const nodes = this.getNodes();
      this.onNodesChangedCallbacks.forEach(cb => cb(nodes));
    } else if (!this.notifyThrottleTimer) {
      this.notifyThrottleTimer = setTimeout(() => {
        this.notifyThrottleTimer = null;
        this.lastNotifyTime = Date.now();
        const nodes = this.getNodes();
        this.onNodesChangedCallbacks.forEach(cb => cb(nodes));
      }, Math.max(50, 800 - (now - this.lastNotifyTime)));
    }
  }

  private notifyMessage(msg: Message) {
    this.onMessageCallbacks.forEach(cb => cb(msg));
  }
}
