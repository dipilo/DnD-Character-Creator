const IMPACT_THROTTLE_MS = 32;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

const parseDiceCount = (notation: string) => {
  let total = 0;

  for (const match of notation.matchAll(/(\d*)d\d+/gi)) {
    const count = Number.parseInt(match[1] || '1', 10);
    total += Number.isNaN(count) ? 1 : count;
  }

  return clamp(total || 1, 1, 48);
};

const getAudioContextConstructor = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
};

interface ToneOptions {
  startFrequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
  delay?: number;
}

interface NoiseOptions {
  duration: number;
  gain: number;
  bandFrequency: number;
  q?: number;
  delay?: number;
}

export class DiceAudioController {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = true;
  private lastImpactAt = 0;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;

    if (!enabled && this.context?.state === 'running') {
      void this.context.suspend().catch(() => undefined);
    }
  }

  async playRollStart(notation: string) {
    const context = await this.resumeContext();
    if (!context) {
      return;
    }

    const diceCount = parseDiceCount(notation);
    const gain = clamp(0.018 + (diceCount * 0.0007), 0.018, 0.042);
    const duration = clamp(0.12 + (diceCount * 0.002), 0.12, 0.2);

    this.playNoiseBurst(context, {
      duration: duration * 0.9,
      gain: gain * 0.85,
      bandFrequency: 420,
      q: 0.8
    });
    this.playTone(context, {
      startFrequency: 220,
      endFrequency: 108,
      duration,
      gain,
      type: 'triangle'
    });
  }

  playImpact(sides?: number) {
    if (!this.enabled || !this.context || this.context.state !== 'running') {
      return;
    }

    const now = performance.now();
    if (now - this.lastImpactAt < IMPACT_THROTTLE_MS) {
      return;
    }

    this.lastImpactAt = now;

    const sideCount = clamp(sides ?? 20, 4, 20);
    const gain = clamp(0.012 + (sideCount * 0.00035), 0.012, 0.022);
    const pitch = clamp(560 - (sideCount * 11), 220, 560);

    this.playNoiseBurst(this.context, {
      duration: 0.06,
      gain,
      bandFrequency: 1600,
      q: 2.4
    });
    this.playTone(this.context, {
      startFrequency: pitch,
      endFrequency: pitch * 0.68,
      duration: 0.07,
      gain: gain * 0.75,
      type: 'square'
    });
  }

  playRollComplete(resultCount: number) {
    if (!this.enabled || !this.context || this.context.state !== 'running') {
      return;
    }

    const gain = clamp(0.012 + (resultCount * 0.0004), 0.012, 0.024);

    this.playTone(this.context, {
      startFrequency: 660,
      endFrequency: 840,
      duration: 0.12,
      gain,
      type: 'sine'
    });
    this.playTone(this.context, {
      startFrequency: 880,
      endFrequency: 1040,
      duration: 0.1,
      gain: gain * 0.8,
      type: 'sine',
      delay: 0.045
    });
  }

  private async resumeContext() {
    if (!this.enabled) {
      return null;
    }

    const context = this.getContext();
    if (!context) {
      return null;
    }

    if (context.state !== 'running') {
      await context.resume().catch(() => undefined);
    }

    return context.state === 'running' ? context : null;
  }

  private getContext() {
    if (this.context) {
      return this.context;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }

    this.context = new AudioContextConstructor();
    return this.context;
  }

  private getNoiseBuffer(context: AudioContext) {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === context.sampleRate) {
      return this.noiseBuffer;
    }

    const frameCount = Math.floor(context.sampleRate * 0.18);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      channel[index] = (Math.random() * 2) - 1;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  private playTone(context: AudioContext, options: ToneOptions) {
    const startTime = context.currentTime + (options.delay ?? 0);
    const endTime = startTime + options.duration;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), endTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain), startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
  }

  private playNoiseBurst(context: AudioContext, options: NoiseOptions) {
    const startTime = context.currentTime + (options.delay ?? 0);
    const endTime = startTime + options.duration;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gainNode = context.createGain();

    source.buffer = this.getNoiseBuffer(context);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(options.bandFrequency, startTime);
    filter.Q.setValueAtTime(options.q ?? 1.2, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain), startTime + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(startTime);
    source.stop(endTime + 0.01);
  }
}