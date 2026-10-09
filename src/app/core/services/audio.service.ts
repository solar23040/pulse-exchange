import { Injectable, signal } from '@angular/core';

interface ToneConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  ramp?: number;
}

/**
 * Synthesizes audio feedback using the Web Audio API.
 * No external audio files needed — all sounds are generated in real-time.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  readonly enabled = signal(true);
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(config: ToneConfig): void {
    if (!this.enabled()) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = config.type;
      osc.frequency.setValueAtTime(config.frequency, ctx.currentTime);
      gain.gain.setValueAtTime(config.gain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + config.duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + config.duration);
    } catch {
      // Audio context not available — fail silently
    }
  }

  private playChord(tones: ToneConfig[], stagger = 0): void {
    tones.forEach((tone, i) => {
      setTimeout(() => this.playTone(tone), i * stagger);
    });
  }

  /** Short blip for price tick changes */
  playTick(): void {
    this.playTone({ frequency: 880, duration: 0.06, type: 'sine', gain: 0.05 });
  }

  /** Success chime for order fill */
  playOrderFill(): void {
    this.playChord(
      [
        { frequency: 523, duration: 0.15, type: 'sine', gain: 0.12 },
        { frequency: 659, duration: 0.15, type: 'sine', gain: 0.10 },
        { frequency: 784, duration: 0.25, type: 'sine', gain: 0.08 },
      ],
      80
    );
  }

  /** Attention-grabbing alert tone */
  playAlert(): void {
    this.playChord(
      [
        { frequency: 1200, duration: 0.12, type: 'square', gain: 0.08 },
        { frequency: 1600, duration: 0.12, type: 'square', gain: 0.06 },
        { frequency: 1200, duration: 0.20, type: 'square', gain: 0.08 },
      ],
      120
    );
  }

  /** Celebration sound for confetti / take-profit hits */
  playConfetti(): void {
    this.playChord(
      [
        { frequency: 523, duration: 0.12, type: 'sine', gain: 0.10 },
        { frequency: 659, duration: 0.12, type: 'sine', gain: 0.10 },
        { frequency: 784, duration: 0.12, type: 'sine', gain: 0.10 },
        { frequency: 1047, duration: 0.30, type: 'sine', gain: 0.12 },
      ],
      70
    );
  }

  /** Error / rejection buzz */
  playError(): void {
    this.playChord(
      [
        { frequency: 200, duration: 0.15, type: 'sawtooth', gain: 0.06 },
        { frequency: 180, duration: 0.20, type: 'sawtooth', gain: 0.06 },
      ],
      100
    );
  }

  /** Toggle sound on/off */
  toggle(): void {
    this.enabled.update(v => !v);
  }
}
