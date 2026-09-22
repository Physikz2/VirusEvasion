class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private bgAudio: HTMLAudioElement | null = null;
  private introAudio: HTMLAudioElement | null = null; // Stored persistently to prevent garbage collection cut-off
  private playlist: string[] = [
    '/BossMain.wav',
    '/Map.wav',
    '/Mars.wav',
    '/Mercury.wav',
    '/Venus.wav'
  ];

  constructor() {}

  private initContext() {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.initContext();
      this.playIntroStinger();
    } else {
      this.stopBackgroundLoop();
    }
    return this.enabled;
  }

  // Plays BossIntro.wav persistently so it finishes playing through screen transitions
  public playIntroStinger() {
    if (!this.enabled) return;
    try {
      if (this.introAudio) {
        this.introAudio.pause();
        this.introAudio = null;
      }
      this.introAudio = new Audio('/BossIntro.wav');
      this.introAudio.volume = 0.6;
      this.introAudio.play().catch((err) => console.warn("Intro stinger play blocked:", err));
    } catch (e) {}
  }

  // Randomly selects one of the 5 tracks and starts looping it when Defense Grid is clicked
  public startBackgroundLoop() {
    if (!this.enabled) return;
    try {
      this.stopBackgroundLoop();
      const randomTrack = this.playlist[Math.floor(Math.random() * this.playlist.length)];
      this.bgAudio = new Audio(randomTrack);
      this.bgAudio.loop = true;
      this.bgAudio.volume = 0.4;
      this.bgAudio.play().catch((err) => console.warn(`Background music play blocked for ${randomTrack}:`, err));
    } catch (e) {}
  }

  public stopBackgroundLoop() {
    try {
      if (this.bgAudio) {
        this.bgAudio.pause();
        this.bgAudio.currentTime = 0;
        this.bgAudio = null;
      }
    } catch (e) {}
  }

  // Plays LoseJingle.wav on game over
  public playGameOverSound() {
    this.stopBackgroundLoop();
    if (!this.enabled) return;
    try {
      const audio = new Audio('/LoseJingle.wav');
      audio.volume = 0.5;
      audio.play().catch((err) => console.warn("Game over play blocked:", err));
    } catch (e) {}
  }

  // Plays congratulations.mp3 when the player makes the Top 10
  public playTopTenFanfare() {
    if (!this.enabled) return;
    try {
      const audio = new Audio('/congratulations.mp3');
      audio.volume = 0.7;
      audio.play().catch((err) => console.warn('Top 10 fanfare play blocked:', err));
    } catch (e) {}
  }

  // --- PROCEDURAL SFX ---
  public playSpawnWarning() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }

  public playVirusSpawned() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    } catch (e) {}
  }

  public playWallBounce() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.07);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  public playCollisionExplosion() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(180, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.45);
      subGain.gain.setValueAtTime(0.25, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.52);

      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.35);
      filter.Q.setValueAtTime(3, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.36);
    } catch (e) {}
  }

  public playMilestoneChime() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const tones = [660, 990];
      tones.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.001, now + i * 0.09);
        gain.gain.linearRampToValueAtTime(0.16, now + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.32);
      });
    } catch (e) {}
  }

  public playUiTick() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.03);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }
}

export const soundManager = new SoundManager();