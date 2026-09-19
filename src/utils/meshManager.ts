// src/utils/meshManager.ts
import { Message, MeshNode } from '../types';
import { MeshCrypto } from './meshCrypto';
import { saveMessage } from './localCache';
import { normalizeIncomingMeshMessage } from './messageAdapter';
import { Socket } from 'socket.io-client';

import { MeshRouter } from './meshRouter';

type EventCallback<T = any> = (data: T) => void;

interface PeerConnectionState {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  node: MeshNode;
}

interface MeshPacket {
  type: 'MESSAGE' | 'PING' | 'PONG' | 'PEER_ANNOUNCE';
  payload: any;
  originNodeId: string;
}

export class MeshManager {
  private static instance: MeshManager;
  private myNode: MeshNode;
  private peers: Map<string, PeerConnectionState> = new Map();
  private knownNodes: Map<string, MeshNode> = new Map();
  private seenMessageIds: Set<string> = new Set();
  private outboxStore: Message[] = []; // Store-and-Forward
  private socket: Socket | null = null;
  private isGateway: boolean = false;

  private listeners: Map<string, Set<EventCallback>> = new Map();
  private heartbeatTimer: any = null;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  private constructor() {
    this.myNode = {
      id: 'node_' + Math.random().toString(36).substring(2, 9),
      displayName: 'Anonymous Peer',
      status: 'active',
      isOnline: true,
      hops: 0,
      lastSeen: new Date().toISOString(),
      capabilities: ['relay', 'storage']
    };
    this.initCrypto();
  }

  public static getInstance(): MeshManager {
    if (!MeshManager.instance) {
      MeshManager.instance = new MeshManager();
    }
    return MeshManager.instance;
  }

  public async init(user: { uid: string; displayName?: string }, socketInstance?: Socket) {
    this.myNode.id = user.uid;
    this.myNode.displayName = user.displayName || 'Anonymous Peer';
    this.myNode.isOnline = true;
    try {
      this.myNode.publicKey = await MeshCrypto.exportPublicKey();
    } catch (e) {
      console.warn('[MeshManager] Crypto init error:', e);
    }
    this.socket = socketInstance || null;

    if (this.socket) {
      this.bindSocketSignaling();
    }

    this.startHeartbeat();
    this.emit('statusChange', 'scanning');
  }

  private async initCrypto() {
    try {
      this.myNode.publicKey = await MeshCrypto.exportPublicKey();
    } catch (e) {
      console.warn('[MeshManager] Key pair init error:', e);
    }
  }

  // --- WebRTC Signaling & DataChannels ---

  private bindSocketSignaling() {
    if (!this.socket) return;

    if (this.socket.connected) {
      this.isGateway = true;
      this.myNode.capabilities = ['relay', 'storage', 'gateway'];
      this.flushOutboxToGateway();
    }

    this.socket.on('connect', () => {
      this.isGateway = true;
      this.myNode.capabilities = ['relay', 'storage', 'gateway'];
      this.flushOutboxToGateway();
    });

    this.socket.on('disconnect', () => {
      this.isGateway = false;
      this.myNode.capabilities = ['relay', 'storage'];
    });

    this.socket.on('mesh:signal', async ({ from, signal }: { from: string; signal: any }) => {
      await this.handleIncomingSignal(from, signal);
    });
  }

  public async connectToPeer(targetNode: MeshNode) {
    if (this.peers.has(targetNode.id)) return;

    try {
      const pc = new RTCPeerConnection(this.rtcConfig);
      const dc = pc.createDataChannel('mesh-data', { ordered: true });
      
      this.peers.set(targetNode.id, { pc, dc, node: targetNode });
      this.setupDataChannel(dc, targetNode.id);
      this.setupPeerConnectionEvents(pc, targetNode.id);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignaling(targetNode.id, { type: 'offer', sdp: offer });
    } catch (err) {
      console.warn('[MeshManager] connectToPeer error:', err);
    }
  }

  private async handleIncomingSignal(senderId: string, signal: any) {
    try {
      let peer = this.peers.get(senderId);

      if (signal.type === 'offer') {
        const pc = new RTCPeerConnection(this.rtcConfig);
        const nodePlaceholder: MeshNode = {
          id: senderId,
          displayName: 'Connecting...',
          status: 'active',
          isOnline: true,
          hops: 1,
          lastSeen: new Date().toISOString()
        };
        
        this.peers.set(senderId, { pc, node: nodePlaceholder });
        this.setupPeerConnectionEvents(pc, senderId);

        pc.ondatachannel = (e) => {
          const state = this.peers.get(senderId);
          if (state) {
            state.dc = e.channel;
            this.setupDataChannel(e.channel, senderId);
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.sendSignaling(senderId, { type: 'answer', sdp: answer });
      } else if (signal.type === 'answer') {
        if (peer) {
          await peer.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.candidate && peer) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn('[MeshManager] handleIncomingSignal error:', err);
    }
  }

  private setupPeerConnectionEvents(pc: RTCPeerConnection, peerId: string) {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling(peerId, { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.peers.delete(peerId);
        this.knownNodes.delete(peerId);
        this.broadcastNodesUpdate();
      }
    };
  }

  private setupDataChannel(dc: RTCDataChannel, peerId: string) {
    dc.onopen = () => {
      this.broadcastNodesUpdate();
      this.flushOutboxToPeer(peerId);
      // Приветственный анонс узла
      this.sendRawPacket(dc, {
        type: 'PEER_ANNOUNCE',
        originNodeId: this.myNode.id,
        payload: this.myNode
      });
    };

    dc.onmessage = (event) => {
      try {
        const packet: MeshPacket = JSON.parse(event.data);
        this.handlePacket(packet, peerId);
      } catch (err) {
        console.error('[MeshManager] DataChannel JSON parse error', err);
      }
    };
  }

  private sendSignaling(targetUid: string, signal: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('mesh:signal', { to: targetUid, signal, from: this.myNode.id });
    }
  }

  // --- Маршрутизация (Epidemic / Gossip Protocol) ---

  private async handlePacket(packet: MeshPacket, viaPeerId: string) {
    switch (packet.type) {
      case 'PEER_ANNOUNCE': {
        const remoteNode: MeshNode = packet.payload;
        remoteNode.hops = 1; // Прямое соединение
        remoteNode.isOnline = true;
        remoteNode.lastSeen = new Date().toISOString();
        this.knownNodes.set(remoteNode.id, remoteNode);
        const p = this.peers.get(viaPeerId);
        if (p) p.node = remoteNode;
        this.broadcastNodesUpdate();
        break;
      }

      case 'PING': {
        const targetPeer = this.peers.get(viaPeerId);
        if (targetPeer?.dc) {
          this.sendRawPacket(targetPeer.dc, {
            type: 'PONG',
            originNodeId: this.myNode.id,
            payload: { timestamp: Date.now() }
          });
        }
        break;
      }

      case 'MESSAGE': {
        const msg: Message = packet.payload;
        await this.routeIncomingMessage(msg);
        break;
      }
    }
  }

  /** Маршрутизация пакета данных и Store-and-Forward */
  public async routeIncomingMessage(rawMsg: any) {
    if (!rawMsg || !rawMsg.id) return;

    // 1. Дедупликация
    if (this.seenMessageIds.has(rawMsg.id)) return;
    this.seenMessageIds.add(rawMsg.id);

    // Нормализация входящего Mesh-сообщения
    const msg = normalizeIncomingMeshMessage(rawMsg, this.myNode.id);

    // 2. Защита от циклов (Loop Prevention)
    const route = msg.meshRoute || [];
    if (route.includes(this.myNode.id)) return;

    // 3. Добавляем себя в цепочку
    const updatedRoute = [...route, this.myNode.id];
    const currentHops = (msg.meshHops || 0) + 1;
    const currentTtl = (msg.ttl !== undefined ? msg.ttl : 5) - 1;

    const routedMessage: Message = {
      ...msg,
      meshRoute: updatedRoute,
      meshHops: currentHops,
      ttl: currentTtl,
      isMesh: true
    };

    // 4. Проверяем, нам ли предназначено сообщение
    const isForMe = routedMessage.receiverId === this.myNode.id || !routedMessage.receiverId;

    if (isForMe) {
      let finalMessage = { ...routedMessage };
      // Если было E2EE шифрование — расшифровываем
      if (routedMessage.encryptedPayload) {
        try {
          const senderNode = this.knownNodes.get(routedMessage.senderId);
          if (senderNode?.publicKey) {
            const decrypted = await MeshCrypto.decrypt(
              routedMessage.encryptedPayload,
              senderNode.publicKey
            );
            finalMessage.text = decrypted;
            finalMessage.content = decrypted;
            finalMessage.deliveryStatus = 'delivered';
          }
        } catch (e) {
          console.warn('[MeshManager] Decryption failed or sender key missing', e);
        }
      }

      // Сохраняем в локальный SQLite/кэш
      try {
        await saveMessage(finalMessage);
      } catch (err) {
        console.warn('[MeshManager] Error caching message:', err);
      }

      this.emit('messageReceived', finalMessage);
    }

    // 5. Если мы шлюз (Gateway) и подключены к серверу — отправляем наверх
    if (this.isGateway && this.socket?.connected && !routedMessage.receiverId) {
      this.socket.emit('chat:broadcast', routedMessage);
    }

    // 6. Ретрансляция (Forwarding) соседним узлам, если жив TTL
    if (currentTtl > 0) {
      this.broadcastToActiveDataChannels({
        type: 'MESSAGE',
        originNodeId: this.myNode.id,
        payload: routedMessage
      }, updatedRoute);
    } else {
      // TTL истек, сохраняем в Store-and-Forward outbox
      this.outboxStore.push(routedMessage);
    }
  }

  /** Публичная отправка сообщения (Broadcast или P2P E2EE) */
  public async sendMessage(msg: Partial<Message>): Promise<Message> {
    const textContent = (typeof msg.text === 'string' && msg.text.length > 0)
      ? msg.text
      : (typeof msg.content === 'string' && msg.content.length > 0)
        ? msg.content
        : (typeof msg.text === 'string' ? msg.text : (typeof msg.content === 'string' ? msg.content : ''));

    let chatId = msg.chatId || msg.groupId;
    if (!chatId && msg.receiverId) {
      chatId = [this.myNode.id, msg.receiverId].sort().join('_');
    }

    const prepared: Message = {
      id: msg.id || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'mesh_' + Date.now()),
      senderId: this.myNode.id,
      receiverId: msg.receiverId,
      groupId: msg.groupId,
      chatId: chatId || 'mesh_broadcast',
      text: textContent,
      content: textContent,
      type: msg.fileUrl ? (msg.type || 'file') : (['sticker', 'poll', 'system', 'audio', 'voice', 'video', 'image', 'game'].includes(msg.type as any) ? (msg.type as any) : 'text'),
      createdAt: msg.createdAt || new Date().toISOString(),
      isMesh: true,
      meshHops: 0,
      ttl: msg.ttl ?? 5,
      meshRoute: [this.myNode.id],
      deliveryStatus: 'sending'
    };

    // Если есть конкретный адресат и известен его публичный ключ — шифруем
    if (prepared.receiverId) {
      const recipientNode = this.knownNodes.get(prepared.receiverId);
      if (recipientNode?.publicKey) {
        try {
          prepared.encryptedPayload = await MeshCrypto.encrypt(
            textContent,
            recipientNode.publicKey
          );
          prepared.text = '[Зашифрованный пакет Mesh]';
          prepared.content = '[Зашифрованный пакет Mesh]';
        } catch (e) {
          console.warn('[MeshManager] Encryption error:', e);
        }
      }
    }

    this.seenMessageIds.add(prepared.id);

    // Доставка активным узлам
    this.broadcastToActiveDataChannels({
      type: 'MESSAGE',
      originNodeId: this.myNode.id,
      payload: prepared
    }, prepared.meshRoute);

    // Сохраняем локально
    try {
      await saveMessage(prepared);
    } catch (e) {}

    // Сохраняем в Outbox для узлов, которые появятся позже
    this.outboxStore.push(prepared);

    return prepared;
  }

  // --- Вспомогательные методы отправки пакетов ---

  private broadcastToActiveDataChannels(packet: MeshPacket, excludeNodeIds: string[] = []) {
    const payloadStr = JSON.stringify(packet);
    this.peers.forEach((peer, peerId) => {
      if (!excludeNodeIds.includes(peerId) && peer.dc?.readyState === 'open') {
        try {
          peer.dc.send(payloadStr);
        } catch (e) {
          console.warn('[MeshManager] Error sending packet to peer:', peerId, e);
        }
      }
    });
  }

  private sendRawPacket(dc: RTCDataChannel, packet: MeshPacket) {
    if (dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify(packet));
      } catch (e) {
        console.warn('[MeshManager] Error sending raw packet:', e);
      }
    }
  }

  private flushOutboxToPeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer?.dc || peer.dc.readyState !== 'open') return;

    this.outboxStore = this.outboxStore.filter((msg) => {
      if (msg.receiverId === peerId || !msg.receiverId) {
        this.sendRawPacket(peer.dc!, {
          type: 'MESSAGE',
          originNodeId: this.myNode.id,
          payload: msg
        });
        return false; // удаляем доставленное
      }
      return true;
    });
  }

  private flushOutboxToGateway() {
    if (!this.isGateway || !this.socket) return;
    while (this.outboxStore.length > 0) {
      const msg = this.outboxStore.shift();
      if (msg) this.socket.emit('chat:broadcast', msg);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      // Отправка ping активным соседям
      this.broadcastToActiveDataChannels({
        type: 'PING',
        originNodeId: this.myNode.id,
        payload: { timestamp: now }
      });

      // Удаление протухших узлов (> 20 секунд молчания)
      this.knownNodes.forEach((node, id) => {
        if (node.lastSeen && now - new Date(node.lastSeen).getTime() > 20000) {
          this.knownNodes.delete(id);
        }
      });
      this.broadcastNodesUpdate();
    }, 4000);
  }

  private broadcastNodesUpdate() {
    const nodesList = Array.from(this.knownNodes.values());
    this.emit('nodesUpdated', nodesList);
  }

  // --- Подписка на события EventEmitter ---

  public on(event: 'messageReceived' | 'nodesUpdated' | 'statusChange', cb: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  public off(event: string, cb: EventCallback) {
    this.listeners.get(event)?.delete(cb);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[MeshManager] Event handler error:', e);
      }
    });
  }

  public getMyNode(): MeshNode {
    return this.myNode;
  }
}
