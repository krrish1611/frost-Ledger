import { toast } from 'sonner';

// Web Audio API Synthesizer for Zero-Dependency Tactile Sound Design
let audioCtx: AudioContext | null = null;
let isAudioMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const soundEffects = {
  isMuted: () => isAudioMuted,
  setMuted: (muted: boolean) => {
    isAudioMuted = muted;
    try {
      localStorage.setItem('frostledger_audio_muted', muted ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors
    }
  },
  toggleMute: () => {
    const next = !isAudioMuted;
    soundEffects.setMuted(next);
    toast(next ? 'Sound FX Muted' : 'Sound FX Enabled', {
      description: next ? 'Tactile audio feedback disabled' : 'Audio synthesizer active',
      icon: next ? '🔇' : '🔊',
    });
    return next;
  },

  // Soft mechanical click for tabs and navigation
  playClick: () => {
    if (isAudioMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // AudioContext policy suppression fallback
    }
  },

  // Soft blip when copying hash, key, or transaction
  playCopy: () => {
    if (isAudioMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.045);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.045);
    } catch {
      // Silently ignore
    }
  },

  // Dual alert tone when excursion breached
  playExcursionAlert: () => {
    if (isAudioMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [0, 0.1].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520, now + delay);
        osc.frequency.exponentialRampToValueAtTime(840, now + delay + 0.08);
        gain.gain.setValueAtTime(0.06, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.08);
      });
    } catch {
      // Silently ignore
    }
  },

  // Harmonic 3-note chime when cryptographic validation passes 100%
  playSuccessChime: () => {
    if (isAudioMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // F#5 (739.99 Hz), A#5 (932.33 Hz), C#6 (1108.73 Hz)
      const notes = [739.99, 932.33, 1108.73];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.08, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.35);
      });
    } catch {
      // Silently ignore
    }
  },

  // High-frequency scanner chirp for QR/Barcode reading
  playScanBeep: () => {
    if (isAudioMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {
      // Silently ignore
    }
  },
};

// Global Copy Helper with Audio & Toast Feedback
export async function copyToClipboard(text: string, label: string = 'Hash') {
  try {
    await navigator.clipboard.writeText(text);
    soundEffects.playCopy();
    const truncated = text.length > 24 ? `${text.slice(0, 10)}...${text.slice(-8)}` : text;
    toast.success(`Copied ${label}`, {
      description: truncated,
      duration: 2500,
    });
  } catch {
    toast.error(`Failed to copy ${label}`);
  }
}
