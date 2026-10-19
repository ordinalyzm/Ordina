// Web Audio API Sound Synthesizer for Ordina Messenger
// Modern high-fidelity notification sounds & chimes

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch (e) {
    console.warn('AudioContext init error:', e);
  }
  return audioCtx;
}

// Auto-resume AudioContext on first user interaction anywhere
if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', resumeAudio, { once: false, passive: true });
  window.addEventListener('touchstart', resumeAudio, { once: false, passive: true });
  window.addEventListener('keydown', resumeAudio, { once: false, passive: true });
}

/**
 * Plays a clean, pleasant notification chime for incoming messages (Telegram/iOS style)
 */
export function playIncomingMessageSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // First bell tone (gentle pure sine with overtone)
    const osc1 = ctx.createOscillator();
    const osc1Harmonic = ctx.createOscillator();
    const gain1 = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    
    osc1Harmonic.type = 'triangle';
    osc1Harmonic.frequency.setValueAtTime(1318.5, now); // E6
    
    gain1.gain.setValueAtTime(0.14, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    
    osc1.connect(gain1);
    osc1Harmonic.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(now);
    osc1Harmonic.start(now);
    osc1.stop(now + 0.28);
    osc1Harmonic.stop(now + 0.28);

    // Second chime (higher harmonic note, uplifting)
    const osc2 = ctx.createOscillator();
    const osc2Harmonic = ctx.createOscillator();
    const gain2 = ctx.createGain();
    
    const startTime2 = now + 0.07;
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, startTime2); // A5
    
    osc2Harmonic.type = 'sine';
    osc2Harmonic.frequency.setValueAtTime(1760, startTime2); // A6
    
    gain2.gain.setValueAtTime(0.18, startTime2);
    gain2.gain.exponentialRampToValueAtTime(0.0008, startTime2 + 0.38);

    osc2.connect(gain2);
    osc2Harmonic.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(startTime2);
    osc2Harmonic.start(startTime2);
    osc2.stop(startTime2 + 0.38);
    osc2Harmonic.stop(startTime2 + 0.38);
  } catch (e) {
    console.warn('Audio playback inhibited or not supported:', e);
  }
}

/**
 * Plays a subtle pop sound when sending a message
 */
export function playSentMessageSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch (e) {
    console.warn('Audio playback error:', e);
  }
}

/**
 * Plays an ascending chirp when a new Mesh Node or Peer connects
 */
export function playMeshNodeConnectSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.linearRampToValueAtTime(880, now + 0.15); // A5

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {
    console.warn('Audio playback error:', e);
  }
}

/**
 * Vibrates device if supported (haptic feedback)
 */
export function triggerHapticFeedback(pattern: number[] = [80, 50, 80]) {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Ignore vibration failures
  }
}
