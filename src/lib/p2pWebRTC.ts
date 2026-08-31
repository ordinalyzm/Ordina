/**
 * Tier 1: Real P2P Protocol Engine (WebRTC DataChannels)
 * Establishes direct peer-to-peer data channels between online clients.
 * Uses public STUN servers for NAT traversal and socket signaling for SDP exchange.
 */

export interface P2PPeerStatus {
  targetUid: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'failed';
  pingMs?: number;
  lastActive: number;
  isDirectDataChannel: boolean;
}

export type P2PMessageCallback = (senderUid: string, data: any) => void;
export type P2PStatusCallback = (peers: Record<string, P2PPeerStatus>) => void;

class WebRTCP2PManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private peerStatuses: Map<string, P2PPeerStatus> = new Map();
  private messageListeners: Set<P2PMessageCallback> = new Set();
  private statusListeners: Set<P2PStatusCallback> = new Set();
  private currentUid: string | null = null;
  private signalSender: ((event: string, payload: any) => void) | null = null;

  // Standard Google and Twilio public STUN servers for robust NAT traversal
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 4
  };

  public init(currentUid: string, signalSender: (event: string, payload: any) => void) {
    this.currentUid = currentUid;
    this.signalSender = signalSender;
  }

  public onMessage(callback: P2PMessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  public onStatusChange(callback: P2PStatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.getAllPeerStatuses());
    return () => this.statusListeners.delete(callback);
  }

  public getAllPeerStatuses(): Record<string, P2PPeerStatus> {
    const statuses: Record<string, P2PPeerStatus> = {};
    this.peerStatuses.forEach((status, uid) => {
      statuses[uid] = status;
    });
    return statuses;
  }

  public isPeerDirectlyConnected(targetUid: string): boolean {
    const channel = this.dataChannels.get(targetUid);
    return !!channel && channel.readyState === 'open';
  }

  public getPeerPing(targetUid: string): number | undefined {
    return this.peerStatuses.get(targetUid)?.pingMs;
  }

  /**
   * Connect to a remote peer via WebRTC DataChannel (Caller initiates)
   */
  public async connectToPeer(targetUid: string): Promise<boolean> {
    if (!this.currentUid || !this.signalSender || targetUid === this.currentUid) return false;
    if (typeof RTCPeerConnection === 'undefined') return false;

    // Return true if already connected
    if (this.isPeerDirectlyConnected(targetUid)) return true;

    try {
      this.closePeer(targetUid);

      const pc = new RTCPeerConnection(this.rtcConfig);
      this.peerConnections.set(targetUid, pc);

      this.updateStatus(targetUid, 'connecting', false);

      // Create DataChannel (Reliable unordered/ordered mode for instant chat & ACK)
      const dc = pc.createDataChannel('ordina-p2p-mesh', {
        ordered: true
      });
      this.setupDataChannel(targetUid, dc);

      pc.onicecandidate = (event) => {
        if (event.candidate && this.signalSender) {
          this.signalSender('p2p:signal', {
            type: 'candidate',
            callerUid: this.currentUid,
            targetUid,
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          this.updateStatus(targetUid, 'connected', true);
        } else if (state === 'disconnected' || state === 'closed') {
          this.updateStatus(targetUid, 'disconnected', false);
        } else if (state === 'failed') {
          this.updateStatus(targetUid, 'failed', false);
        }
      };

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.signalSender) {
        this.signalSender('p2p:signal', {
          type: 'offer',
          callerUid: this.currentUid,
          targetUid,
          offer
        });
      }

      return true;
    } catch (e) {
      console.warn(`[P2P WebRTC] Failed to initiate connection to ${targetUid}:`, e);
      this.updateStatus(targetUid, 'failed', false);
      return false;
    }
  }

  /**
   * Handle incoming signaling packets from socket server
   */
  public async handleSignal(signal: { type: string; callerUid: string; targetUid: string; offer?: any; answer?: any; candidate?: any }) {
    if (!this.currentUid || signal.targetUid !== this.currentUid) return;
    const peerUid = signal.callerUid;

    try {
      if (signal.type === 'offer' && signal.offer) {
        // Callee receives offer
        this.closePeer(peerUid);

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(peerUid, pc);
        this.updateStatus(peerUid, 'connecting', false);

        pc.ondatachannel = (event) => {
          this.setupDataChannel(peerUid, event.channel);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && this.signalSender) {
            this.signalSender('p2p:signal', {
              type: 'candidate',
              callerUid: this.currentUid,
              targetUid: peerUid,
              candidate: event.candidate
            });
          }
        };

        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === 'connected') {
            this.updateStatus(peerUid, 'connected', true);
          } else if (state === 'disconnected' || state === 'closed' || state === 'failed') {
            this.updateStatus(peerUid, state === 'failed' ? 'failed' : 'disconnected', false);
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (this.signalSender) {
          this.signalSender('p2p:signal', {
            type: 'answer',
            callerUid: this.currentUid,
            targetUid: peerUid,
            answer
          });
        }
      } else if (signal.type === 'answer' && signal.answer) {
        const pc = this.peerConnections.get(peerUid);
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        const pc = this.peerConnections.get(peerUid);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (candErr) {
            console.warn('[P2P WebRTC] Error adding ICE candidate:', candErr);
          }
        }
      }
    } catch (e) {
      console.warn(`[P2P WebRTC] Error handling signal from ${peerUid}:`, e);
    }
  }

  /**
   * Send data directly through P2P DataChannel (Level 1 Transport)
   * Returns true if sent directly via WebRTC DataChannel, false if fallback needed.
   */
  public sendDirectP2P(targetUid: string, payload: any): boolean {
    const dc = this.dataChannels.get(targetUid);
    if (!dc || dc.readyState !== 'open') {
      // If not yet connected, trigger background connect attempt for future messages
      this.connectToPeer(targetUid).catch(() => {});
      return false;
    }

    try {
      const serialized = JSON.stringify({
        sourceUid: this.currentUid,
        targetUid,
        timestamp: Date.now(),
        data: payload
      });
      dc.send(serialized);
      return true;
    } catch (e) {
      console.warn(`[P2P WebRTC] Failed to send via DataChannel to ${targetUid}:`, e);
      return false;
    }
  }

  private setupDataChannel(peerUid: string, dc: RTCDataChannel) {
    this.dataChannels.set(peerUid, dc);

    dc.onopen = () => {
      this.updateStatus(peerUid, 'connected', true);
      // Measure real round-trip latency
      this.sendPing(peerUid);
    };

    dc.onclose = () => {
      this.updateStatus(peerUid, 'disconnected', false);
    };

    dc.onerror = () => {
      this.updateStatus(peerUid, 'failed', false);
    };

    dc.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        if (packet.type === 'p2p:ping') {
          dc.send(JSON.stringify({ type: 'p2p:pong', timestamp: packet.timestamp }));
          return;
        }
        if (packet.type === 'p2p:pong') {
          const rtt = Date.now() - packet.timestamp;
          const curr = this.peerStatuses.get(peerUid);
          if (curr) {
            curr.pingMs = Math.max(1, Math.round(rtt));
            this.notifyStatusListeners();
          }
          return;
        }

        // Deliver message to listeners
        if (packet.data) {
          this.messageListeners.forEach((listener) => {
            try {
              listener(peerUid, packet.data);
            } catch (err) {
              console.error('[P2P WebRTC] Message callback error:', err);
            }
          });
        }
      } catch (e) {
        console.warn('[P2P WebRTC] Invalid packet received:', e);
      }
    };
  }

  private sendPing(peerUid: string) {
    const dc = this.dataChannels.get(peerUid);
    if (dc && dc.readyState === 'open') {
      try {
        dc.send(JSON.stringify({ type: 'p2p:ping', timestamp: Date.now() }));
      } catch (e) {}
    }
  }

  private updateStatus(targetUid: string, state: P2PPeerStatus['state'], isDirect: boolean) {
    const existing = this.peerStatuses.get(targetUid) || {
      targetUid,
      state,
      lastActive: Date.now(),
      isDirectDataChannel: isDirect
    };

    existing.state = state;
    existing.isDirectDataChannel = isDirect;
    existing.lastActive = Date.now();
    this.peerStatuses.set(targetUid, existing);
    this.notifyStatusListeners();
  }

  private notifyStatusListeners() {
    const statuses = this.getAllPeerStatuses();
    this.statusListeners.forEach((listener) => {
      try {
        listener(statuses);
      } catch (e) {}
    });
  }

  public getPeerStatus(peerUid: string): P2PPeerStatus | undefined {
    return this.peerStatuses.get(peerUid);
  }

  public closePeer(targetUid: string) {
    const dc = this.dataChannels.get(targetUid);
    if (dc) {
      try {
        dc.close();
      } catch (e) {}
      this.dataChannels.delete(targetUid);
    }

    const pc = this.peerConnections.get(targetUid);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(targetUid);
    }
  }

  public closeAll() {
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.peerStatuses.clear();
    this.notifyStatusListeners();
  }
}

export const p2pManager = new WebRTCP2PManager();
