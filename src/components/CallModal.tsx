import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, 
  Maximize2, Minimize2, MonitorUp, RefreshCw, Shield, 
  Volume2, VolumeX, Radio
} from 'lucide-react';
import { CallService, CallSession, CallState } from '../services/callService';
import { startIncomingRingtone, startOutgoingRingtone, playCallEndTone, triggerHapticFeedback } from '../lib/audio';

interface CallModalProps {
  callService: CallService;
  onEndCall: () => void;
  onAcceptCall: () => void;
  onRejectCall: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  callService,
  onEndCall,
  onAcceptCall,
  onRejectCall
}) => {
  const [callState, setCallState] = useState<CallState>(callService.state);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(callService.isMuted);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(callService.isVideoEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(callService.isScreenSharing);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState<boolean>(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Subscribe to CallService state changes
  useEffect(() => {
    callService.onStateChange = (newState) => {
      setCallState(newState);
      setIsMuted(callService.isMuted);
      setIsVideoEnabled(callService.isVideoEnabled);
      setIsScreenSharing(callService.isScreenSharing);
    };

    callService.onDurationTick = (secs) => {
      setDuration(secs);
    };

    callService.onSpeakingChange = (localSpeaking, remoteSpeaking) => {
      setIsLocalSpeaking(localSpeaking);
      setIsRemoteSpeaking(remoteSpeaking);
    };

    callService.onLocalStream = (stream) => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    };

    callService.onRemoteStream = (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };

    // Attach any existing active streams
    const existingLocal = callService.getLocalStream();
    if (existingLocal && localVideoRef.current) {
      localVideoRef.current.srcObject = existingLocal;
    }
    const existingRemote = callService.getRemoteStream();
    if (existingRemote) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = existingRemote;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = existingRemote;
    }

    return () => {
      callService.onStateChange = undefined;
      callService.onDurationTick = undefined;
      callService.onSpeakingChange = undefined;
      callService.onLocalStream = undefined;
      callService.onRemoteStream = undefined;
    };
  }, [callService]);

  // Handle ringtones for outgoing and incoming states
  useEffect(() => {
    let stopRingtone: (() => void) | null = null;

    if (callState === 'incoming_ringing') {
      stopRingtone = startIncomingRingtone();
      triggerHapticFeedback([120, 80, 120, 80, 200]);
    } else if (callState === 'outgoing_calling') {
      stopRingtone = startOutgoingRingtone();
    }

    return () => {
      if (stopRingtone) {
        stopRingtone();
      }
    };
  }, [callState]);

  const call = callService.currentCall;
  if (!call || callState === 'idle') return null;

  const partner = call.partner;
  const isVideoCall = call.isVideo || isVideoEnabled;

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // 1. INCOMING CALL BANNER / DIALOG
  // ==========================================
  if (callState === 'incoming_ringing') {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-[10010] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center text-white relative overflow-hidden"
          >
            {/* Background pulsating glow */}
            <div className="absolute -top-12 -left-12 w-44 h-44 bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-12 -right-12 w-44 h-44 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

            <div className="relative mb-5 mt-2">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-800 border-2 border-emerald-500 shadow-xl relative z-10 flex items-center justify-center">
                {partner.photoURL ? (
                  <img src={partner.photoURL} alt={partner.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-emerald-400">
                    {partner.displayName?.[0] || 'U'}
                  </span>
                )}
              </div>
              {/* Expanding ring waves */}
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/50 animate-ping pointer-events-none" />
              <div className="absolute -inset-3 rounded-full border border-emerald-400/30 animate-pulse pointer-events-none" />
            </div>

            <h3 className="text-xl font-bold text-white mb-1 truncate max-w-full">
              {partner.displayName}
            </h3>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-6">
              <Radio size={14} className="animate-pulse" />
              {call.isVideo ? 'Входящий видеовызов' : 'Входящий аудиовызов'}
            </p>

            <div className="flex items-center justify-center gap-6 w-full pt-2">
              {/* Decline Call Button */}
              <button
                type="button"
                onClick={() => {
                  playCallEndTone();
                  onRejectCall();
                }}
                className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-14 h-14 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-colors">
                  <PhoneOff size={24} />
                </div>
                <span className="text-xs font-medium text-slate-400 group-hover:text-rose-400">Отклонить</span>
              </button>

              {/* Accept Call Button */}
              <button
                type="button"
                onClick={onAcceptCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-600 group-hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/50 transition-colors animate-bounce">
                  <Phone size={28} />
                </div>
                <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">Принять</span>
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // ==========================================
  // 2. MINIMIZED FLOATING CALL BUBBLE / BAR
  // ==========================================
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-[10010] animate-fade-in">
        {/* Hidden audio element ensuring remote audio keeps playing */}
        <audio ref={remoteAudioRef} autoPlay playsInline />
        
        <div className="bg-slate-900/95 border border-slate-700/80 backdrop-blur-md rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 text-white">
          <div 
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center">
                {partner.photoURL ? (
                  <img src={partner.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-emerald-400">{partner.displayName?.[0]}</span>
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${isRemoteSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
            </div>
            <div className="min-w-0 pr-1">
              <p className="text-xs font-bold truncate max-w-[110px]">{partner.displayName}</p>
              <p className="text-[10px] font-mono text-emerald-400">
                {callState === 'connected' ? formatDuration(duration) : 'Вызов...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <button
              type="button"
              onClick={() => setIsMuted(callService.toggleMute())}
              className={`p-2 rounded-xl transition-colors ${isMuted ? 'bg-rose-600/30 text-rose-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
              title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Развернуть звонок"
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                playCallEndTone();
                onEndCall();
              }}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              title="Завершить вызов"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. FULL CALL SCREEN (OUTGOING, CONNECTING, CONNECTED)
  // ==========================================
  return (
    <div className="fixed inset-0 z-[10010] bg-slate-950 flex flex-col justify-between text-white overflow-hidden select-none">
      {/* Remote Audio output */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Video Background / Stream Display */}
      {isVideoCall ? (
        <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center">
          {/* Remote Video (Full Screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local Camera Preview (Picture in Picture) */}
          <div className="absolute top-20 right-4 w-28 sm:w-36 h-40 sm:h-48 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700/80 shadow-2xl z-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {isMuted && (
              <div className="absolute bottom-2 left-2 p-1 rounded-md bg-rose-600 text-white">
                <MicOff size={12} />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Audio Call Center Stage */
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
          {/* Background Ambient Glow */}
          <div className="absolute w-72 h-72 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

          <div className="relative mb-6">
            <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-slate-900 border-4 transition-all duration-300 shadow-2xl flex items-center justify-center ${
              isRemoteSpeaking ? 'border-emerald-400 ring-8 ring-emerald-500/20 scale-105' : 'border-slate-800'
            }`}>
              {partner.photoURL ? (
                <img src={partner.photoURL} alt={partner.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl sm:text-5xl font-black text-emerald-400">
                  {partner.displayName?.[0] || 'U'}
                </span>
              )}
            </div>

            {/* Speaking Halo Animation */}
            {isRemoteSpeaking && (
              <div className="absolute -inset-4 rounded-full border border-emerald-400/40 animate-ping pointer-events-none" />
            )}
            {callState === 'outgoing_calling' && (
              <div className="absolute -inset-4 rounded-full border-2 border-blue-500/50 animate-ping pointer-events-none" />
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
            {partner.displayName}
          </h2>

          <div className="flex items-center gap-2 text-sm font-medium">
            {callState === 'outgoing_calling' && (
              <span className="text-blue-400 flex items-center gap-1.5 animate-pulse">
                <Radio size={16} /> Идет вызов...
              </span>
            )}
            {callState === 'connecting' && (
              <span className="text-amber-400 flex items-center gap-1.5">
                <RefreshCw size={16} className="animate-spin" /> Подключение P2P...
              </span>
            )}
            {callState === 'connected' && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-emerald-400 font-bold text-base">
                  {formatDuration(duration)}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Shield size={12} className="text-emerald-400" /> E2E Защищено
                </span>
              </div>
            )}
            {callState === 'reconnecting' && (
              <span className="text-rose-400 animate-pulse">Переподключение...</span>
            )}
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="relative z-20 flex items-center justify-between p-4 pt-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Shield size={18} />
          </div>
          <div>
            <p className="text-xs font-bold leading-none">Ордина Direct Voice</p>
            <p className="text-[10px] text-emerald-400 font-mono">P2P DTLS-SRTP</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all active:scale-95"
          title="Свернуть звонок в фоновый режим"
        >
          <Minimize2 size={18} />
        </button>
      </div>

      {/* Bottom Control Dock */}
      <div className="relative z-20 p-6 pb-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center gap-6">
        {/* Speaking visual meter */}
        {callState === 'connected' && (
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isLocalSpeaking || isRemoteSpeaking 
                    ? 'h-4 bg-emerald-400' 
                    : 'h-1.5 bg-slate-700'
                }`}
                style={{
                  height: isLocalSpeaking || isRemoteSpeaking ? `${8 + (i % 3) * 6}px` : '4px'
                }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
          {/* Mute Microphone */}
          <button
            type="button"
            onClick={() => setIsMuted(callService.toggleMute())}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg ${
              isMuted 
                ? 'bg-rose-600/20 border-2 border-rose-500 text-rose-400' 
                : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
            }`}
            title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Toggle Video Camera */}
          <button
            type="button"
            onClick={async () => {
              const active = await callService.toggleVideo();
              setIsVideoEnabled(active);
            }}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg ${
              isVideoEnabled 
                ? 'bg-blue-600 text-white shadow-blue-500/30' 
                : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
            }`}
            title={isVideoEnabled ? "Выключить камеру" : "Включить камеру"}
          >
            {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          </button>

          {/* Switch Camera (if video active) */}
          {isVideoEnabled && (
            <button
              type="button"
              onClick={() => callService.switchCamera()}
              className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg"
              title="Переключить камеру (передняя/задняя)"
            >
              <RefreshCw size={20} />
            </button>
          )}

          {/* Share Screen */}
          <button
            type="button"
            onClick={async () => {
              const active = await callService.toggleScreenShare();
              setIsScreenSharing(active);
            }}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg ${
              isScreenSharing 
                ? 'bg-purple-600 text-white shadow-purple-500/30' 
                : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
            }`}
            title={isScreenSharing ? "Остановить показ экрана" : "Демонстрация экрана"}
          >
            <MonitorUp size={22} />
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={() => {
              playCallEndTone();
              onEndCall();
            }}
            className="w-16 h-16 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/50 transition-all active:scale-90"
            title="Завершить звонок"
          >
            <PhoneOff size={26} />
          </button>
        </div>
      </div>
    </div>
  );
};
