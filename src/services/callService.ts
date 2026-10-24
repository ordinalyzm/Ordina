// Real-time WebRTC Peer-to-Peer Calling Engine for Ordina Messenger
// Supports end-to-end encrypted audio, video, and screen sharing via WebRTC & Google STUN servers

export interface CallParticipant {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export type CallState = 
  | 'idle'
  | 'outgoing_calling'   // Dialing, waiting for recipient to pick up
  | 'incoming_ringing'   // Incoming call alert
  | 'connecting'         // Exchanging WebRTC SDP offer/answer
  | 'connected'          // Active call with audio/video flowing
  | 'reconnecting'       // Temporary network hiccup
  | 'ended';             // Call closed

export interface CallSession {
  callId: string;
  partner: CallParticipant;
  isVideo: boolean;
  isIncoming: boolean;
  chatId: string;
  startTime?: number;
  durationSec: number;
}

// ICE-серверы: STUN помогает узнать внешний адрес, TURN — обязателен для связи
// через мобильный интернет и сложные сети (симметричный NAT).
// TURN задаётся при сборке: VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL
const buildIceServers = (): RTCIceServer[] => {
  const env = ((import.meta as any)?.env || {}) as Record<string, string | undefined>;
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];

  const turnUrl = env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map(u => u.trim()).filter(Boolean),
      username: env.VITE_TURN_USERNAME,
      credential: env.VITE_TURN_CREDENTIAL
    });
  }
  return servers;
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 6
};

export class CallService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isFrontCamera: boolean = true;
  private durationInterval: any = null;
  private iceRestartAttempts: number = 0;

  // Event callbacks
  public onStateChange?: (state: CallState) => void;
  public onLocalStream?: (stream: MediaStream) => void;
  public onRemoteStream?: (stream: MediaStream) => void;
  public onDurationTick?: (seconds: number) => void;
  public onSpeakingChange?: (isLocalSpeaking: boolean, isRemoteSpeaking: boolean) => void;
  public onSignal?: (targetUid: string, data: any) => void;
  public onError?: (message: string) => void;

  public state: CallState = 'idle';
  public currentCall: CallSession | null = null;
  public isMuted: boolean = false;
  public isVideoEnabled: boolean = false;
  public isScreenSharing: boolean = false;

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private setState(newState: CallState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  }

  /**
   * Initializes media capture and establishes WebRTC peer connection
   */
  public async startOutgoingCall(
    callId: string,
    partner: CallParticipant,
    isVideo: boolean,
    chatId: string
  ): Promise<boolean> {
    try {
      this.cleanup();
      this.currentCall = {
        callId,
        partner,
        isVideo,
        isIncoming: false,
        chatId,
        durationSec: 0
      };
      this.isVideoEnabled = isVideo;
      this.isMuted = false;
      this.setState('outgoing_calling');

      // Request microphone and optional camera
      await this.initLocalMedia(isVideo);
      return true;
    } catch (err: any) {
      console.error('Failed to start outgoing call:', err);
      this.cleanup();
      return false;
    }
  }

  /**
   * Handles incoming call alert
   */
  public handleIncomingCall(
    callId: string,
    caller: CallParticipant,
    isVideo: boolean,
    chatId: string
  ) {
    this.cleanup();
    this.currentCall = {
      callId,
      partner: caller,
      isVideo,
      isIncoming: true,
      chatId,
      durationSec: 0
    };
    this.isVideoEnabled = isVideo;
    this.isMuted = false;
    this.setState('incoming_ringing');
  }

  /**
   * User accepts incoming call
   */
  public async acceptCall(): Promise<boolean> {
    if (!this.currentCall) return false;
    try {
      this.setState('connecting');
      await this.initLocalMedia(this.currentCall.isVideo);
      this.createPeerConnection();

      // If we already received offer while ringing, process pending candidates
      if (this.pendingCandidates.length > 0) {
        for (const c of this.pendingCandidates) {
          await this.pc?.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        this.pendingCandidates = [];
      }
      return true;
    } catch (err) {
      console.error('Failed to accept call:', err);
      this.cleanup();
      return false;
    }
  }

  /**
   * Initializes local user microphone and camera
   */
  private async initLocalMedia(video: boolean): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'На этом устройстве нет доступа к микрофону и камере';
      this.onError?.(msg);
      throw new Error(msg);
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: video ? {
        facingMode: this.isFrontCamera ? 'user' : 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } : false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      if (this.onLocalStream) {
        this.onLocalStream(stream);
      }
      this.setupAudioAnalysis(stream, true);
      return stream;
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
        ? 'Разрешите доступ к микрофону и камере в настройках приложения'
        : err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError'
          ? 'Микрофон или камера не найдены на устройстве'
          : 'Не удалось получить доступ к микрофону и камере';
      this.onError?.(msg);
      throw err;
    }
  }

  /**
   * Sets up RTCPeerConnection with STUN servers and audio/video tracks
   */
  private createPeerConnection() {
    if (this.pc) return;

    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    if (this.onRemoteStream) {
      this.onRemoteStream(this.remoteStream);
    }

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.pc && this.localStream) {
          this.pc.addTrack(track, this.localStream);
        }
      });
    }

    // ICE Candidate generation
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.currentCall && this.onSignal) {
        this.onSignal(this.currentCall.partner.uid, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
          callId: this.currentCall.callId
        });
      }
    };

    // Remote track arrived
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream?.addTrack(track);
        });
      } else if (event.track) {
        this.remoteStream?.addTrack(event.track);
      }
      if (this.remoteStream) {
        this.setupAudioAnalysis(this.remoteStream, false);
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        this.iceRestartAttempts = 0;
        this.startCallDurationTimer();
        this.setState('connected');
      } else if (state === 'connecting') {
        this.setState('connecting');
      } else if (state === 'disconnected') {
        // Короткий обрыв сети — не завершаем звонок, а пробуем восстановить соединение
        this.setState('reconnecting');
        void this.tryIceRestart();
      } else if (state === 'failed') {
        void this.tryIceRestart().then((recovered) => {
          if (!recovered) {
            this.onError?.('Соединение прервано. Проверьте интернет и попробуйте позвонить снова.');
            this.cleanup();
          }
        });
      } else if (state === 'closed') {
        this.cleanup();
      }
    };
  }

  /**
   * Пытается восстановить оборвавшееся соединение (ICE restart).
   * Возвращает true, если попытка перезапуска была отправлена партнёру.
   */
  private async tryIceRestart(): Promise<boolean> {
    if (!this.pc || !this.currentCall) return false;
    if (this.pc.connectionState === 'connected') return true;
    if (this.iceRestartAttempts >= 2) return false;
    this.iceRestartAttempts++;

    try {
      const offer = await this.pc.createOffer({
        iceRestart: true,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.pc.setLocalDescription(offer);

      if (this.onSignal) {
        this.onSignal(this.currentCall.partner.uid, {
          type: 'offer',
          sdp: offer,
          callId: this.currentCall.callId,
          iceRestart: true
        });
      }
      return true;
    } catch (e) {
      console.warn('ICE restart failed:', e);
      return false;
    }
  }

  /**
   * Called when partner accepts call: creates and transmits SDP Offer
   */
  public async handleCallAccepted() {
    this.setState('connecting');
    this.createPeerConnection();

    if (!this.pc || !this.currentCall) return;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.pc.setLocalDescription(offer);

      if (this.onSignal) {
        this.onSignal(this.currentCall.partner.uid, {
          type: 'offer',
          sdp: offer,
          callId: this.currentCall.callId
        });
      }
    } catch (e) {
      console.error('Error creating WebRTC offer:', e);
    }
  }

  /**
   * Handles incoming signaling messages (offer, answer, candidate)
   */
  public async handleSignal(data: any) {
    if (!this.currentCall) return;

    if (data.type === 'offer') {
      this.createPeerConnection();
      if (!this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // Flush any queued ICE candidates
        while (this.pendingCandidates.length > 0) {
          const c = this.pendingCandidates.shift();
          if (c) await this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        if (this.onSignal) {
          this.onSignal(this.currentCall.partner.uid, {
            type: 'answer',
            sdp: answer,
            callId: this.currentCall.callId
          });
        }
      } catch (e) {
        console.error('Error handling WebRTC offer:', e);
      }
    } else if (data.type === 'answer') {
      if (!this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        while (this.pendingCandidates.length > 0) {
          const c = this.pendingCandidates.shift();
          if (c) await this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
      } catch (e) {
        console.error('Error handling WebRTC answer:', e);
      }
    } else if (data.type === 'candidate' && data.candidate) {
      if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
        await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      } else {
        this.pendingCandidates.push(data.candidate);
      }
    }
  }

  /**
   * Toggles microphone mute state
   */
  public toggleMute(): boolean {
    if (!this.localStream) return this.isMuted;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
    return this.isMuted;
  }

  /**
   * Toggles video camera on / off
   */
  public async toggleVideo(): Promise<boolean> {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();

    if (videoTracks.length > 0) {
      // Toggle existing track
      const next = !videoTracks[0].enabled;
      videoTracks.forEach(t => (t.enabled = next));
      this.isVideoEnabled = next;
      return next;
    } else {
      // Request new video track
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.isFrontCamera ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        const newTrack = stream.getVideoTracks()[0];
        this.localStream.addTrack(newTrack);
        if (this.pc) {
          this.pc.addTrack(newTrack, this.localStream);
          // Renegotiate offer
          const offer = await this.pc.createOffer();
          await this.pc.setLocalDescription(offer);
          if (this.currentCall && this.onSignal) {
            this.onSignal(this.currentCall.partner.uid, {
              type: 'offer',
              sdp: offer,
              callId: this.currentCall.callId
            });
          }
        }
        this.isVideoEnabled = true;
        if (this.onLocalStream) this.onLocalStream(this.localStream);
        return true;
      } catch (err) {
        console.warn('Could not enable video:', err);
        return false;
      }
    }
  }

  /**
   * Flips between front & back camera on mobile
   */
  public async switchCamera(): Promise<boolean> {
    if (!this.isVideoEnabled || !this.localStream) return false;
    this.isFrontCamera = !this.isFrontCamera;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.isFrontCamera ? 'user' : 'environment' }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      const oldVideoTrack = this.localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        this.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      this.localStream.addTrack(newVideoTrack);

      if (this.pc) {
        const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }
      if (this.onLocalStream) this.onLocalStream(this.localStream);
      return true;
    } catch (e) {
      console.warn('Switch camera error:', e);
      return false;
    }
  }

  /**
   * Toggles screen sharing
   */
  public async toggleScreenShare(): Promise<boolean> {
    if (this.isScreenSharing) {
      // Stop screen share, restore camera
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(t => t.stop());
        this.screenStream = null;
      }
      if (this.localStream && this.pc) {
        const camTrack = this.localStream.getVideoTracks()[0];
        const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && camTrack) {
          await sender.replaceTrack(camTrack);
        }
      }
      this.isScreenSharing = false;
      return false;
    } else {
      try {
        if (!navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing not supported on this device');
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        this.screenStream = stream;
        const screenTrack = stream.getVideoTracks()[0];

        screenTrack.onended = () => {
          this.toggleScreenShare();
        };

        if (this.pc) {
          const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenTrack);
          } else if (this.localStream) {
            this.pc.addTrack(screenTrack, this.localStream);
          }
        }
        this.isScreenSharing = true;
        return true;
      } catch (e) {
        console.warn('Screen share cancelled or failed:', e);
        return false;
      }
    }
  }

  /**
   * Audio Analyser setup to detect speaking amplitude
   */
  private setupAudioAnalysis(stream: MediaStream, isLocal: boolean) {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (!this.audioContext) return;
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      if (isLocal) {
        this.localAnalyser = analyser;
      } else {
        this.remoteAnalyser = analyser;
      }

      this.startSpeakingDetection();
    } catch (e) {}
  }

  private speakingInterval: any = null;
  private startSpeakingDetection() {
    if (this.speakingInterval) return;

    const dataArrayLocal = new Uint8Array(128);
    const dataArrayRemote = new Uint8Array(128);

    this.speakingInterval = setInterval(() => {
      let isLocalSpeaking = false;
      let isRemoteSpeaking = false;

      if (this.localAnalyser && !this.isMuted) {
        this.localAnalyser.getByteFrequencyData(dataArrayLocal);
        const avg = dataArrayLocal.reduce((a, b) => a + b, 0) / dataArrayLocal.length;
        isLocalSpeaking = avg > 18;
      }

      if (this.remoteAnalyser) {
        this.remoteAnalyser.getByteFrequencyData(dataArrayRemote);
        const avg = dataArrayRemote.reduce((a, b) => a + b, 0) / dataArrayRemote.length;
        isRemoteSpeaking = avg > 18;
      }

      if (this.onSpeakingChange) {
        this.onSpeakingChange(isLocalSpeaking, isRemoteSpeaking);
      }
    }, 120);
  }

  private startCallDurationTimer() {
    if (this.durationInterval) clearInterval(this.durationInterval);
    if (this.currentCall) this.currentCall.startTime = Date.now();

    this.durationInterval = setInterval(() => {
      if (this.currentCall && this.currentCall.startTime) {
        this.currentCall.durationSec = Math.floor((Date.now() - this.currentCall.startTime) / 1000);
        if (this.onDurationTick) {
          this.onDurationTick(this.currentCall.durationSec);
        }
      }
    }, 1000);
  }

  /**
   * Fully releases camera, microphone, and WebRTC peer connection
   */
  public cleanup() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.remoteStream = null;
    this.pendingCandidates = [];
    this.iceRestartAttempts = 0;
    this.currentCall = null;
    this.isMuted = false;
    this.isVideoEnabled = false;
    this.isScreenSharing = false;
    this.setState('idle');
  }
}

// Global Singleton for easy app-wide calling
export const callService = new CallService();
