'use client';

export type AmbientSoundTrack =
  | 'rain'
  | 'white'
  | 'pink'
  | 'brown'
  | 'campfire'
  | 'binaural';

export interface AmbientState {
  isPlaying: boolean;
  masterVolume: number; // 0 to 1
  volumes: Record<AmbientSoundTrack, number>; // 0 to 1
}

type Listener = (state: AmbientState) => void;

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trackGains: Partial<Record<AmbientSoundTrack, GainNode>> = {};
  private trackSources: Partial<Record<AmbientSoundTrack, AudioNode[]>> = {};

  private state: AmbientState = {
    isPlaying: false,
    masterVolume: 0.6,
    volumes: {
      rain: 0.5,
      white: 0.0,
      pink: 0.0,
      brown: 0.4,
      campfire: 0.0,
      binaural: 0.3,
    },
  };

  private listeners = new Set<Listener>();

  constructor() {
    // Lazy initialization on first play to comply with browser autoplay policy
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  public getState(): AmbientState {
    return {
      isPlaying: this.state.isPlaying,
      masterVolume: this.state.masterVolume,
      volumes: { ...this.state.volumes },
    };
  }

  private initAudio() {
    if (this.ctx && this.masterGain) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.state.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.setupTracks();
  }

  private setupTracks() {
    if (!this.ctx || !this.masterGain) return;

    const tracks: AmbientSoundTrack[] = [
      'rain',
      'white',
      'pink',
      'brown',
      'campfire',
      'binaural',
    ];

    tracks.forEach((track) => {
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(this.state.volumes[track], this.ctx!.currentTime);
      gain.connect(this.masterGain!);
      this.trackGains[track] = gain;

      this.createTrackSound(track, gain);
    });
  }

  private createTrackSound(track: AmbientSoundTrack, outGain: GainNode) {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferLength = sampleRate * 5; // 5-second seamless loop buffer

    switch (track) {
      case 'white': {
        const buffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferLength; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(outGain);
        source.start(0);
        this.trackSources[track] = [source];
        break;
      }

      case 'pink': {
        const buffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferLength; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(outGain);
        source.start(0);
        this.trackSources[track] = [source];
        break;
      }

      case 'brown': {
        const buffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferLength; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5; // Gain compensation
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(outGain);
        source.start(0);
        this.trackSources[track] = [source];
        break;
      }

      case 'rain': {
        // Rain: Pink/Brown filtered base + raindrop crackle impulses
        const buffer = this.ctx.createBuffer(2, bufferLength, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);

        let lastL = 0, lastR = 0;
        for (let i = 0; i < bufferLength; i++) {
          const wL = Math.random() * 2 - 1;
          const wR = Math.random() * 2 - 1;
          lastL = (lastL + 0.04 * wL) / 1.04;
          lastR = (lastR + 0.04 * wR) / 1.04;

          // occasional droplet click
          const droplet = Math.random() > 0.996 ? (Math.random() - 0.5) * 0.6 : 0;
          left[i] = lastL * 2.5 + droplet;
          right[i] = lastR * 2.5 + droplet;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

        source.connect(filter);
        filter.connect(outGain);
        source.start(0);
        this.trackSources[track] = [source, filter];
        break;
      }

      case 'campfire': {
        // Campfire: Low rumble + sporadic wood crackle snaps
        const buffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferLength; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.015 * white) / 1.015;
          // sporadic high-energy snap / crackle burst
          const snap = Math.random() > 0.998 ? (Math.random() > 0.5 ? 0.7 : -0.7) : 0;
          data[i] = lastOut * 1.5 + snap;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(650, this.ctx.currentTime);
        filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

        source.connect(filter);
        filter.connect(outGain);
        source.start(0);
        this.trackSources[track] = [source, filter];
        break;
      }

      case 'binaural': {
        // 210 Hz left, 220 Hz right (10 Hz Alpha wave focus tone)
        const oscL = this.ctx.createOscillator();
        const oscR = this.ctx.createOscillator();
        oscL.type = 'sine';
        oscR.type = 'sine';
        oscL.frequency.setValueAtTime(210, this.ctx.currentTime);
        oscR.frequency.setValueAtTime(220, this.ctx.currentTime);

        const panL = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        const panR = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        if (panL && panR) {
          panL.pan.setValueAtTime(-0.85, this.ctx.currentTime);
          panR.pan.setValueAtTime(0.85, this.ctx.currentTime);
          oscL.connect(panL);
          panL.connect(outGain);
          oscR.connect(panR);
          panR.connect(outGain);
          this.trackSources[track] = [oscL, oscR, panL, panR];
        } else {
          oscL.connect(outGain);
          oscR.connect(outGain);
          this.trackSources[track] = [oscL, oscR];
        }

        oscL.start(0);
        oscR.start(0);
        break;
      }
    }
  }

  public async togglePlay(): Promise<boolean> {
    if (this.state.isPlaying) {
      this.pause();
      return false;
    } else {
      await this.play();
      return true;
    }
  }

  public async play(): Promise<void> {
    this.initAudio();
    if (!this.ctx || !this.masterGain) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterGain.gain.setValueAtTime(this.state.masterVolume, this.ctx.currentTime);
    this.state.isPlaying = true;
    this.notify();
  }

  public pause(): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    this.state.isPlaying = false;
    this.notify();
  }

  public setMasterVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.state.masterVolume = clamped;
    if (this.masterGain && this.ctx && this.state.isPlaying) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    this.notify();
  }

  public setTrackVolume(track: AmbientSoundTrack, vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.state.volumes[track] = clamped;
    const gain = this.trackGains[track];
    if (gain && this.ctx) {
      gain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    this.notify();
  }

  public applyPreset(preset: 'deep_focus' | 'rainy_study' | 'campfire_library' | 'brownian_calm' | 'silent'): void {
    switch (preset) {
      case 'deep_focus':
        this.state.volumes = {
          rain: 0.3,
          white: 0.0,
          pink: 0.0,
          brown: 0.4,
          campfire: 0.0,
          binaural: 0.45,
        };
        break;
      case 'rainy_study':
        this.state.volumes = {
          rain: 0.8,
          white: 0.0,
          pink: 0.2,
          brown: 0.3,
          campfire: 0.0,
          binaural: 0.0,
        };
        break;
      case 'campfire_library':
        this.state.volumes = {
          rain: 0.0,
          white: 0.0,
          pink: 0.1,
          brown: 0.3,
          campfire: 0.7,
          binaural: 0.2,
        };
        break;
      case 'brownian_calm':
        this.state.volumes = {
          rain: 0.0,
          white: 0.0,
          pink: 0.0,
          brown: 0.8,
          campfire: 0.0,
          binaural: 0.0,
        };
        break;
      case 'silent':
        this.state.volumes = {
          rain: 0.0,
          white: 0.0,
          pink: 0.0,
          brown: 0.0,
          campfire: 0.0,
          binaural: 0.0,
        };
        break;
    }

    if (this.ctx) {
      (Object.keys(this.state.volumes) as AmbientSoundTrack[]).forEach((t) => {
        const gain = this.trackGains[t];
        if (gain) {
          gain.gain.setValueAtTime(this.state.volumes[t], this.ctx!.currentTime);
        }
      });
    }

    this.notify();
  }
}

// Global browser client singleton
export const ambientSound = typeof window !== 'undefined' ? new AmbientSoundEngine() : (null as unknown as AmbientSoundEngine);
