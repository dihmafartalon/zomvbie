import type { WeaponModel } from '../weapons/WeaponDefs';

interface NoiseOpts {
  duration: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  delay?: number;
}

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  duration: number;
  gain: number;
  type: OscillatorType;
  delay?: number;
}

/**
 * Procedurally synthesised sound effects (no audio assets yet). The context is
 * created lazily on the first user gesture to satisfy browser autoplay rules.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.8;

  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.volume;
      master.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = buffer;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  // ---- Game sounds -----------------------------------------------------------

  gunshot(model: WeaponModel): void {
    switch (model) {
      case 'pistol':
        this.noise({ duration: 0.18, gain: 0.55, filter: 'lowpass', freq: 2600, freqEnd: 600 });
        this.tone({ freq: 170, freqEnd: 50, duration: 0.12, gain: 0.5, type: 'sine' });
        break;
      case 'smg':
        this.noise({ duration: 0.1, gain: 0.42, filter: 'lowpass', freq: 3200, freqEnd: 900 });
        this.tone({ freq: 140, freqEnd: 60, duration: 0.08, gain: 0.35, type: 'sine' });
        break;
      case 'rifle':
        this.noise({ duration: 0.22, gain: 0.6, filter: 'lowpass', freq: 2200, freqEnd: 400 });
        this.tone({ freq: 120, freqEnd: 40, duration: 0.16, gain: 0.55, type: 'sine' });
        break;
      case 'shotgun':
        this.noise({ duration: 0.38, gain: 0.9, filter: 'lowpass', freq: 1500, freqEnd: 250 });
        this.tone({ freq: 90, freqEnd: 30, duration: 0.28, gain: 0.8, type: 'sine' });
        break;
    }
  }

  dryFire(): void {
    this.tone({ freq: 1300, duration: 0.03, gain: 0.08, type: 'square' });
  }

  reload(reloadTime: number): void {
    this.noise({ duration: 0.05, gain: 0.3, filter: 'highpass', freq: 2500, delay: 0.1 });
    this.noise({ duration: 0.06, gain: 0.35, filter: 'highpass', freq: 1800, delay: Math.max(0.2, reloadTime - 0.2) });
  }

  hitmarker(kill: boolean): void {
    this.tone({ freq: 1800, duration: 0.04, gain: 0.12, type: 'triangle' });
    if (kill) this.tone({ freq: 2500, duration: 0.06, gain: 0.1, type: 'triangle', delay: 0.04 });
  }

  zombieGroan(volume: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || volume <= 0.01) return;
    const t = ctx.currentTime;
    const dur = 0.7 + Math.random() * 0.6;
    const base = 70 + Math.random() * 50;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 1.3, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.8, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6 + Math.random() * 5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain).connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 + Math.random() * 300;
    filter.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25 * volume, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  zombieAttack(): void {
    this.noise({ duration: 0.25, gain: 0.35, filter: 'bandpass', freq: 900, q: 1.5 });
    this.zombieGroan(0.9);
  }

  playerHurt(): void {
    this.tone({ freq: 240, freqEnd: 100, duration: 0.25, gain: 0.35, type: 'sine' });
    this.noise({ duration: 0.2, gain: 0.3, filter: 'lowpass', freq: 600 });
  }

  purchase(): void {
    this.tone({ freq: 880, duration: 0.08, gain: 0.15, type: 'triangle' });
    this.tone({ freq: 1320, duration: 0.14, gain: 0.15, type: 'triangle', delay: 0.08 });
  }

  denied(): void {
    this.tone({ freq: 150, duration: 0.2, gain: 0.15, type: 'square' });
  }

  roundStart(): void {
    this.tone({ freq: 55, duration: 2.2, gain: 0.35, type: 'sine' });
    this.tone({ freq: 110, freqEnd: 104, duration: 1.8, gain: 0.12, type: 'triangle' });
    this.tone({ freq: 165, freqEnd: 155, duration: 1.6, gain: 0.08, type: 'triangle', delay: 0.4 });
  }

  roundEnd(): void {
    this.tone({ freq: 220, freqEnd: 110, duration: 1.4, gain: 0.15, type: 'triangle' });
    this.tone({ freq: 330, freqEnd: 165, duration: 1.4, gain: 0.08, type: 'triangle', delay: 0.2 });
  }

  gameOver(): void {
    this.tone({ freq: 196, freqEnd: 49, duration: 2.5, gain: 0.25, type: 'sawtooth' });
    this.tone({ freq: 55, duration: 2.5, gain: 0.35, type: 'sine' });
  }

  // ---- Synth primitives -------------------------------------------------------

  private noise(o: NoiseOpts): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) filter.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.duration);
    filter.Q.value = o.q ?? 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.duration + 0.02);
  }

  private tone(o: ToneOpts): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + o.duration + 0.02);
  }
}
