import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, Mic, MicOff, Video, VideoOff, MonitorUp, 
  Hand, PhoneOff, Minimize2, Maximize2, Users, Volume2, VolumeX,
  Sparkles, ShieldCheck, Grid, Pin, RefreshCw, Expand, Shrink
} from 'lucide-react';
import { triggerHapticFeedback, playCallEndTone, playMeshNodeConnectSound } from '../lib/audio';

export interface GroupVoiceParticipant {
  uid: string;
  displayName: string;
  photoURL?: string;
  isMuted: boolean;
  isVideo: boolean;
  isScreenShare: boolean;
  isSpeaking: boolean;
  hasRaisedHand?: boolean;
  isSpeaker?: boolean;
}

interface GroupCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  roomType: 'group' | 'channel';
  currentUser: { uid: string; displayName: string; photoURL?: string };
  isOwnerOrAdmin: boolean;
  socket: any;
  onLeave: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 6
};

export const GroupCallModal: React.FC<GroupCallModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
  roomType,
  currentUser,
  isOwnerOrAdmin,
  socket,
  onLeave
}) => {
  const [participants, setParticipants] = useState<GroupVoiceParticipant[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [isScreenShare, setIsScreenShare] = useState<boolean>(false);
  const [hasRaisedHand, setHasRaisedHand] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [activeStageUid, setActiveStageUid] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(true);
const [screenShareWarningShown, setScreenShareWarningShown] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // WebRTC mesh peer connections & audio elements for all remote users
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Play entrance chime when opening call
  useEffect(() => {
    if (isOpen) {
      playMeshNodeConnectSound();
      triggerHapticFeedback([50, 40, 50]);
    }
  }, [isOpen]);

  // Speaking level detector for local microphone
  const setupLocalAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(128);
      let wasSpeaking = false;

      const checkInterval = setInterval(() => {
        if (!isOpen) {
          clearInterval(checkInterval);
          return;
        }
        if (analyserRef.current && !isMuted) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const isSpeaking = avg > 18;

          if (isSpeaking !== wasSpeaking) {
            wasSpeaking = isSpeaking;
            socket?.emit('voice-room:media-update', {
              roomId,
              uid: currentUser.uid,
              isSpeaking
            });
          }
        }
      }, 150);
    } catch (e) {
      console.warn('Audio analysis setup warning:', e);
    }
  }, [isOpen, isMuted, roomId, currentUser.uid, socket]);

  // Initialize or re-negotiate RTCPeerConnection with a remote participant
  const createPeerConnection = useCallback((targetUid: string, initiateOffer: boolean) => {
    // If peer connection already exists, return it
    if (peersRef.current.has(targetUid)) {
      return peersRef.current.get(targetUid)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(targetUid, pc);

    // Add local tracks
    const activeStream = screenStreamRef.current || localStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        pc.addTrack(track, activeStream);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice-room:signal', {
          roomId,
          targetUid,
          fromUid: currentUser.uid,
          signal: { type: 'candidate', candidate: event.candidate.toJSON() }
        });
      }
    };

    // Track arrived from remote peer
    pc.ontrack = (event) => {
      let stream: MediaStream;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else {
        stream = new MediaStream([event.track]);
      }

      setRemoteStreams(prev => ({ ...prev, [targetUid]: stream }));

      // Attach audio track to persistent audio element
      let audioEl = remoteAudiosRef.current.get(targetUid);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        remoteAudiosRef.current.set(targetUid, audioEl);
      }
      audioEl.srcObject = stream;
      audioEl.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        peersRef.current.delete(targetUid);
      }
    };

    // If caller, create SDP Offer
    if (initiateOffer) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (socket && pc.localDescription) {
            socket.emit('voice-room:signal', {
              roomId,
              targetUid,
              fromUid: currentUser.uid,
              signal: { type: 'offer', sdp: pc.localDescription }
            });
          }
        })
        .catch(err => console.warn('Offer creation error for peer:', targetUid, err));
    }

    return pc;
  }, [roomId, currentUser.uid, socket]);

  // Main room membership & WebRTC signaling effect
  useEffect(() => {
    if (!isOpen || !socket || !roomId) return;

    // Join room on server
    socket.emit('voice-room:join', {
      roomId,
      user: currentUser,
      isMuted: false,
      isVideo: false
    });

    const handleParticipants = (data: { roomId: string; participants: GroupVoiceParticipant[] }) => {
      if (data.roomId === roomId) {
        setParticipants(data.participants);

        // Synchronize WebRTC peer connections with current participant list
        const activeUids = new Set(data.participants.map(p => p.uid));

        // 1. Remove peers who left
        peersRef.current.forEach((pc, uid) => {
          if (!activeUids.has(uid)) {
            pc.close();
            peersRef.current.delete(uid);
            const audio = remoteAudiosRef.current.get(uid);
            if (audio) {
              audio.pause();
              audio.srcObject = null;
              remoteAudiosRef.current.delete(uid);
            }
            setRemoteStreams(prev => {
              const next = { ...prev };
              delete next[uid];
              return next;
            });
          }
        });

        // 2. Connect to new participants
        data.participants.forEach(p => {
          if (p.uid !== currentUser.uid && !peersRef.current.has(p.uid)) {
            // Deterministic polite initiator (the user with alphabetically higher UID sends the offer)
            const shouldInitiate = currentUser.uid > p.uid;
            createPeerConnection(p.uid, shouldInitiate);
          }
        });
      }
    };

    const handleParticipantUpdated = (data: { roomId: string; uid: string; updates: Partial<GroupVoiceParticipant> }) => {
      if (data.roomId === roomId) {
        setParticipants(prev => prev.map(p => p.uid === data.uid ? { ...p, ...data.updates } : p));
      }
    };

    const handleVoiceRoomSignal = async (payload: { roomId: string; targetUid: string; fromUid: string; signal: any }) => {
      if (payload.roomId !== roomId || payload.targetUid !== currentUser.uid) return;
      const { fromUid, signal } = payload;
      let pc = peersRef.current.get(fromUid);

      if (signal.type === 'offer') {
        if (!pc) {
          pc = createPeerConnection(fromUid, false);
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice-room:signal', {
            roomId,
            targetUid: fromUid,
            fromUid: currentUser.uid,
            signal: { type: 'answer', sdp: answer }
          });
        } catch (e) {
          console.warn('Error handling offer in voice room:', e);
        }
      } else if (signal.type === 'answer') {
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } catch (e) {
            console.warn('Error handling answer in voice room:', e);
          }
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        }
      }
    };

    socket.on('voice-room:participants', handleParticipants);
    socket.on('voice-room:participant-updated', handleParticipantUpdated);
    socket.on('voice-room:signal', handleVoiceRoomSignal);

    // Start local audio capture with echo cancellation & noise suppression
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })
      .then(stream => {
        localStreamRef.current = stream;
        setupLocalAudioAnalysis(stream);

        // Add audio track to any existing peer connections
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          peersRef.current.forEach(pc => {
            pc.addTrack(audioTrack, stream);
          });
        }
      })
      .catch(err => {
        console.warn('Microphone permission or capture error:', err);
      });

    return () => {
      socket.off('voice-room:participants', handleParticipants);
      socket.off('voice-room:participant-updated', handleParticipantUpdated);
      socket.off('voice-room:signal', handleVoiceRoomSignal);

      // Close all peer connections & audio
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();

      remoteAudiosRef.current.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
      });
      remoteAudiosRef.current.clear();

      // Cleanup media
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isOpen, roomId, socket, currentUser, createPeerConnection, setupLocalAudioAnalysis]);

  // Update stage video element when spotlighted participant changes
  useEffect(() => {
    if (!stageVideoRef.current) return;
    if (activeStageUid === currentUser.uid) {
      const myStream = screenStreamRef.current || localStreamRef.current;
      if (myStream) {
        stageVideoRef.current.srcObject = myStream;
      }
    } else if (activeStageUid && remoteStreams[activeStageUid]) {
      stageVideoRef.current.srcObject = remoteStreams[activeStageUid];
    }
  }, [activeStageUid, currentUser.uid, remoteStreams]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => (t.enabled = !next));
    }
    socket?.emit('voice-room:media-update', {
      roomId,
      uid: currentUser.uid,
      isMuted: next,
      isSpeaking: false
    });
    triggerHapticFeedback([40]);
  };

  const toggleVideo = async () => {
    if (isVideo) {
      // Turn off video
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });
      }
      setIsVideo(false);
      socket?.emit('voice-room:media-update', { roomId, uid: currentUser.uid, isVideo: false });
      
      // Remove video track from peers
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) pc.removeTrack(sender);
      });
    } else {
      // Turn on camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: isFrontCamera ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        const videoTrack = stream.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = stream;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([videoTrack]);
        }

        // Add or replace track on all peer connections
        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          } else if (localStreamRef.current) {
            pc.addTrack(videoTrack, localStreamRef.current);
          }
        });

        setIsVideo(true);
        setActiveStageUid(currentUser.uid);
        socket?.emit('voice-room:media-update', { roomId, uid: currentUser.uid, isVideo: true });
        triggerHapticFeedback([50]);
      } catch (err) {
        console.warn('Video camera enable error:', err);
      }
    }
  };

  const switchCamera = async () => {
    if (!isVideo || !localStreamRef.current) return;
    const nextFront = !isFrontCamera;
    setIsFrontCamera(nextFront);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFront ? 'user' : 'environment' }
      });
      const newVideoTrack = stream.getVideoTracks()[0];
      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(newVideoTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = new MediaStream([newVideoTrack]);
      }

      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(newVideoTrack);
      });
      triggerHapticFeedback([40]);
    } catch (e) {
      console.warn('Switch camera error:', e);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenShare) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenShare(false);
      setScreenShareWarningShown(false);
      socket?.emit('voice-room:media-update', { roomId, uid: currentUser.uid, isScreenShare: false });
      
      // Restore camera if active
      if (isVideo && localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        if (camTrack) {
          peersRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(camTrack);
          });
        }
      }
    } else {
      // Show warning dialog first before starting screen share
      setScreenShareWarningShown(true);
    }
  };

  const confirmScreenShare = async () => {
    setScreenShareWarningShown(false);
    try {
      if (!navigator.mediaDevices.getDisplayMedia) {
        console.warn('getDisplayMedia not supported');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      const screenTrack = stream.getVideoTracks()[0];

      screenTrack.onended = () => {
        toggleScreenShare();
      };

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        } else if (localStreamRef.current) {
          pc.addTrack(screenTrack, localStreamRef.current);
        }
      });

      setIsScreenShare(true);
      setActiveStageUid(currentUser.uid);
      socket?.emit('voice-room:media-update', { roomId, uid: currentUser.uid, isScreenShare: true });
      triggerHapticFeedback([60]);
    } catch (e) {
      console.warn('Screen share cancelled:', e);
    }
  };

  const toggleRaiseHand = () => {
    const next = !hasRaisedHand;
    setHasRaisedHand(next);
    socket?.emit('voice-room:media-update', {
      roomId,
      uid: currentUser.uid,
      hasRaisedHand: next
    });
    triggerHapticFeedback([60, 40, 60]);
  };

  const handleLeaveRoom = () => {
    socket?.emit('voice-room:leave', { roomId, uid: currentUser.uid });
    playCallEndTone();
    onLeave();
  };

  // ==========================================
  // SCREEN SHARE WARNING DIALOG
  // ==========================================
  if (screenShareWarningShown) {
    return (
      <div className="fixed inset-0 z-[10020] bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <MonitorUp size={28} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">Демонстрация экрана</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Вы собираетесь транслировать содержимое своего экрана всем участникам звонка. Убедитесь, что на экране нет конфиденциальной информации (пароли, личные сообщения, банковские данные).
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setScreenShareWarningShown(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={confirmScreenShare}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 border border-blue-500/50 text-white text-sm font-medium hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                >
                  Начать показ экрана
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  // Active spotlight participant (if any)
  const spotlightUser = activeStageUid 
    ? participants.find(p => p.uid === activeStageUid) || (activeStageUid === currentUser.uid ? {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        isMuted,
        isVideo,
        isScreenShare,
        isSpeaking: false
      } : null)
    : participants.find(p => p.isScreenShare || p.isVideo) || null;

  // ==========================================
  // 1. MINIMIZED FLOATING CALL BAR (Discord / Telegram style)
  // ==========================================
  if (isMinimized) {
    const speakingParticipant = participants.find(p => p.isSpeaking);
    return (
      <div className="fixed bottom-20 left-4 z-[10010] animate-fade-in select-none">
        <div className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 text-white ring-1 ring-white/10">
          <div 
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-blue-600 flex items-center justify-center text-white relative shadow-md shadow-emerald-500/20">
              <Radio size={18} className="animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-ping" />
            </div>
            <div className="min-w-0 pr-1">
              <p className="text-xs font-bold truncate max-w-[130px]">{roomName}</p>
              <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <Users size={11} /> 
                <span>{participants.length} в эфире</span>
                {speakingParticipant && (
                  <span className="truncate max-w-[80px] text-emerald-300">• {speakingParticipant.displayName}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-xl transition-all active:scale-95 ${
                isMuted 
                  ? 'bg-rose-600/30 text-rose-400 border border-rose-500/40' 
                  : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40'
              }`}
              title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Развернуть звонок"
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              onClick={handleLeaveRoom}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm shadow-rose-600/40"
              title="Покинуть эфир"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. FULL SCREEN CALL STAGE (GRID + SPOTLIGHT)
  // ==========================================
  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-[10010] bg-slate-950 flex flex-col text-white select-none overflow-hidden ${
        isFullscreen ? 'p-0' : ''
      }`}
    >
      {/* Top Header */}
      <div className="p-3 sm:p-4 px-4 sm:px-6 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 shrink-0">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                {roomName}
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0">
                {roomType === 'channel' ? 'Прямой эфир' : 'Голосовой чат'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Users size={13} /> {participants.length} {participants.length === 1 ? 'участник' : 'участников'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-400" /> P2P WebRTC HD
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch Grid / Spotlight View */}
          <button
            type="button"
            onClick={() => setActiveStageUid(activeStageUid ? null : currentUser.uid)}
            className={`p-2.5 rounded-xl border transition-all ${
              activeStageUid 
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title={activeStageUid ? "Сетка участников" : "Режим сцены"}
          >
            {activeStageUid ? <Grid size={17} /> : <Pin size={17} />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen().catch(() => {});
                setIsFullscreen(true);
              } else {
                document.exitFullscreen().catch(() => {});
                setIsFullscreen(false);
              }
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors hidden sm:flex"
            title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
          >
            {isFullscreen ? <Shrink size={17} /> : <Expand size={17} />}
          </button>

          {/* Minimize Floating Bar */}
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Свернуть в плавающее окно"
          >
            <Minimize2 size={17} />
          </button>
        </div>
      </div>

      {/* Main Call Stage Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden relative">
        {/* Discord-like layout: 0=grid of avatars, 1=full spotlight + bottom row, 2=split 50/50, 3+=grid of video */}
        {(() => {
          const activeSharers = participants.filter(p => p.isVideo || p.isScreenShare);

          // 0 active sharers — grid of avatars for everyone
          if (activeSharers.length === 0) {
            return (
              <div className="flex-1 p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-w-7xl mx-auto">
                  {participants.map(p => {
                    const isMe = p.uid === currentUser.uid;
                    return (
                      <motion.div
                        key={p.uid}
                        layout
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={() => setActiveStageUid(p.uid)}
                        className={`relative rounded-3xl p-4 flex flex-col items-center justify-center transition-all duration-200 border cursor-pointer group overflow-hidden ${p.isSpeaking ? 'bg-slate-900 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/40' : 'bg-slate-900/70 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'} min-h-[160px] sm:min-h-[180px]`}
                      >
                        <div className="relative my-3 z-10">
                          <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center transition-all ${p.isSpeaking ? 'ring-4 ring-emerald-400 scale-105 shadow-lg shadow-emerald-500/30' : 'border-2 border-slate-700'}`}>
                            {p.photoURL ? (
                              <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-3xl font-black text-slate-300">{p.displayName?.[0] || 'U'}</span>
                            )}
                          </div>
                          {p.isSpeaking && (
                            <div className="absolute -inset-2.5 rounded-full border-2 border-emerald-400/50 animate-ping pointer-events-none" />
                          )}
                          <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ${p.isMuted ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                            {p.isMuted ? <MicOff size={10} className="text-white" /> : <Mic size={10} className="text-white" />}
                          </div>
                        </div>
                        <p className="text-xs font-bold text-white truncate w-full text-center drop-shadow-sm">
                          {p.displayName} {isMe && '(Вы)'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate w-full text-center">
                          {p.isSpeaking ? (
                            <span className="text-emerald-400 font-bold animate-pulse">Говорит...</span>
                          ) : p.isMuted ? (
                            'Без звука'
                          ) : (
                            'Слушает'
                          )}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // 1 active sharer — full-screen spotlight + bottom row of others
          if (activeSharers.length === 1) {
            const [sharer] = activeSharers;
            const stream = sharer.uid === currentUser.uid ? (screenStreamRef.current || localStreamRef.current) : remoteStreams[sharer.uid];
            const others = participants.filter(p => p.uid !== sharer.uid);

            return (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 bg-black relative flex items-center justify-center">
                  {stream ? (
                    <video
                      ref={sharer.uid === currentUser.uid ? localVideoRef : stageVideoRef}
                      autoPlay
                      playsInline
                      muted={sharer.uid === currentUser.uid}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-40 h-40 rounded-full bg-slate-900 border-4 flex items-center justify-center">
                        {sharer.photoURL ? (
                          <img src={sharer.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-6xl font-black text-emerald-400">{sharer.displayName?.[0] || 'U'}</span>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold text-white mt-4">{sharer.displayName}</h3>
                      <p className="text-emerald-400 text-sm">{sharer.isScreenShare ? 'Демонстрация экрана' : 'Видео с камеры'}</p>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="truncate">{sharer.displayName}</span>
                    {sharer.isScreenShare && (
                      <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-mono">ЭКРАН</span>
                    )}
                    {sharer.isVideo && !sharer.isScreenShare && (
                      <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded font-mono">КАМЕРА</span>
                    )}
                  </div>
                </div>
                <div className="h-20 border-t border-slate-800 bg-slate-900/60 p-2 overflow-x-auto custom-scrollbar flex gap-2">
                  {others.map(p => {
                    const isMe = p.uid === currentUser.uid;
                    const hasStream = p.uid === currentUser.uid ? (screenStreamRef.current || localStreamRef.current) : remoteStreams[p.uid];
                    return (
                      <div
                        key={p.uid}
                        onClick={() => setActiveStageUid(p.uid)}
                        className={`rounded-2xl p-1.5 flex items-center gap-2 cursor-pointer transition-all border shrink-0 w-48 ${p.uid === sharer.uid ? 'bg-blue-600/20 border-blue-500 text-white shadow-md' : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-300'}`}
                      >
                        <div className="relative shrink-0">
                          <div className={`w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center ${p.isSpeaking ? 'ring-2 ring-emerald-400' : ''}`}>
                            {hasStream ? (
                              <video autoPlay playsInline muted className="w-full h-full object-cover" />
                            ) : p.photoURL ? (
                              <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-slate-200">{p.displayName?.[0]}</span>
                            )}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ${p.isMuted ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                            {p.isMuted ? <MicOff size={9} className="text-white" /> : <Mic size={9} className="text-white" />}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{p.displayName} {isMe && '(Вы)'}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {p.isSpeaking ? <span className="text-emerald-400">Говорит</span> : p.isMuted ? 'Без звука' : 'Слушает'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // 2 active sharers — split 50/50
          if (activeSharers.length === 2) {
            const [left, right] = activeSharers;
            const leftStream = left.uid === currentUser.uid ? (screenStreamRef.current || localStreamRef.current) : remoteStreams[left.uid];
            const rightStream = right.uid === currentUser.uid ? (screenStreamRef.current || localStreamRef.current) : remoteStreams[right.uid];

            return (
              <div className="flex-1 flex min-h-0 overflow-hidden bg-black">
                <div
                  className="flex-1 relative"
                  onClick={() => setActiveStageUid(left.uid)}
                >
                  {leftStream ? (
                    <video autoPlay playsInline muted={left.uid === currentUser.uid} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 text-sm">
                      {left.displayName}
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold">
                    {left.displayName} {left.isScreenShare ? ' • ЭКРАН' : ' • КАМЕРА'}
                  </div>
                </div>
                <div
                  className="flex-1 relative"
                  onClick={() => setActiveStageUid(right.uid)}
                >
                  {rightStream ? (
                    <video autoPlay playsInline muted={right.uid === currentUser.uid} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 text-sm">
                      {right.displayName}
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-bold">
                    {right.displayName} {right.isScreenShare ? ' • ЭКРАН' : ' • КАМЕРА'}
                  </div>
                </div>
              </div>
            );
          }

          // 3+ active sharers — grid of video streams
          return (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 max-w-7xl mx-auto">
                {activeSharers.map(p => {
                  const isMe = p.uid === currentUser.uid;
                  const stream = isMe ? (screenStreamRef.current || localStreamRef.current) : remoteStreams[p.uid];

                  return (
                    <motion.div
                      key={p.uid}
                      layout
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => setActiveStageUid(p.uid)}
                      className={`relative rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-between transition-all duration-200 border cursor-pointer group overflow-hidden ${p.isSpeaking ? 'bg-slate-900 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/40' : 'bg-slate-900/70 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'} min-h-[160px] sm:min-h-[180px]`}
                    >
                      <div className="absolute inset-0 z-0 bg-black">
                        {stream ? (
                          <video
                            autoPlay
                            playsInline
                            muted={isMe}
                            ref={el => {
                              if (el && el.srcObject !== stream) el.srcObject = stream;
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                            Нет потока
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
                      </div>

                      <div className="w-full flex items-center justify-between gap-1 text-[11px] relative z-10">
                        <div className="flex items-center gap-1">
                          {p.hasRaisedHand && (
                            <span className="p-1 rounded-lg bg-amber-500/30 text-amber-300 border border-amber-500/40 animate-bounce" title="Поднял(а) руку">
                              <Hand size={13} />
                            </span>
                          )}
                          {p.isScreenShare && (
                            <span className="p-1 rounded-lg bg-purple-500/30 text-purple-300 border border-purple-500/40" title="Демонстрация экрана">
                              <MonitorUp size={13} />
                            </span>
                          )}
                          {p.isVideo && !p.isScreenShare && (
                            <span className="p-1 rounded-lg bg-blue-500/30 text-blue-300 border border-blue-500/40" title="Камера включена">
                              <Video size={13} />
                            </span>
                          )}
                        </div>

                        <div className={`p-1 rounded-lg backdrop-blur-md ${p.isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                          {p.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                        </div>
                      </div>

                      <div className="w-full truncate text-center relative z-10 pt-2">
                        <p className="text-xs font-bold text-white truncate drop-shadow-sm">
                          {p.displayName} {isMe && '(Вы)'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {p.isSpeaking ? (
                            <span className="text-emerald-400 font-bold animate-pulse">Говорит...</span>
                          ) : p.isMuted ? (
                            'Без звука'
                          ) : (
                            'Слушает'
                          )}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-3 sm:gap-4 shrink-0 z-30">
        {/* Toggle Microphone */}
        <button
          type="button"
          onClick={toggleMute}
          className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-md ${
            isMuted 
              ? 'bg-rose-600/20 border-2 border-rose-500 text-rose-400' 
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
          }`}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          <span>{isMuted ? 'Вкл. микрофон' : 'Микрофон ВКЛ'}</span>
        </button>

        {/* Toggle Video Camera */}
        <button
          type="button"
          onClick={toggleVideo}
          className={`p-3.5 rounded-2xl transition-all active:scale-95 shadow-md ${
            isVideo 
              ? 'bg-blue-600 text-white shadow-blue-500/30' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
          title={isVideo ? "Выключить видео" : "Включить камеру"}
        >
          {isVideo ? <Video size={18} /> : <VideoOff size={18} />}
        </button>

        {/* Switch Camera (if video active) */}
        {isVideo && (
          <button
            type="button"
            onClick={switchCamera}
            className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95 shadow-md"
            title="Переключить камеру (передняя/задняя)"
          >
            <RefreshCw size={18} />
          </button>
        )}

        {/* Toggle Screen Share */}
        <button
          type="button"
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-2xl transition-all active:scale-95 shadow-md ${
            isScreenShare 
              ? 'bg-purple-600 text-white shadow-purple-500/30' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
          title={isScreenShare ? "Остановить показ" : "Демонстрация экрана"}
        >
          <MonitorUp size={18} />
        </button>

        {/* Raise Hand (for Channel broadcasts or listeners) */}
        {roomType === 'channel' && (
          <button
            type="button"
            onClick={toggleRaiseHand}
            className={`p-3.5 rounded-2xl transition-all active:scale-95 shadow-md ${
              hasRaisedHand 
                ? 'bg-amber-500 text-white shadow-amber-500/30 animate-bounce' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title={hasRaisedHand ? "Опустить руку" : "Поднять руку, чтобы сказать"}
          >
            <Hand size={18} />
          </button>
        )}

        {/* Disconnect / End Call */}
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-rose-600/30"
          title="Покинуть эфир"
        >
          <PhoneOff size={18} />
          <span className="hidden sm:inline">Выйти</span>
        </button>
      </div>
    </div>
  );
};
