// audio.js — every sound is synthesized with WebAudio: no audio files,
// no network, nothing to load. The context starts on the first user
// gesture (browsers require it); until then every call is a safe no-op.

const MUTE_KEY = 'rootbound-muted';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.padNodes = null;
    this.droneNodes = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch (e) { /* storage may be unavailable; sound still works */ }
  }

  // Create the context on a user gesture. Safe to call often.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* no audio on this machine; the game plays on silent */ }
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) {}
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  _tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise(dur, vol, freq, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // A root drinks: two bright notes rising.
  chime() {
    this._tone(660, 0.22, 'sine', 0.22);
    this._tone(990, 0.3, 'sine', 0.18, 0.07);
  }

  // A grub is squashed: a low thud with a little crunch.
  thud() {
    this._tone(140, 0.16, 'sine', 0.3, 0, 60);
    this._noise(0.08, 0.15, 900);
  }

  // The Worldroot blooms: a rising arpeggio.
  bloom() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this._tone(f, 0.5, 'triangle', 0.16, i * 0.11));
    this._tone(1568, 0.8, 'sine', 0.12, 0.55);
  }

  // A taproot cracks stone.
  crack() {
    this._noise(0.14, 0.25, 2400);
    this._tone(220, 0.1, 'square', 0.06, 0, 110);
  }

  // A flower opens.
  flower() {
    this._tone(880, 0.18, 'sine', 0.14);
    this._tone(1175, 0.25, 'sine', 0.12, 0.06);
  }

  // A grub bites: a soft wet click.
  bite() {
    this._tone(300, 0.07, 'triangle', 0.1, 0, 180);
  }

  // A button or season banner: a warm tick.
  click() {
    this._tone(520, 0.07, 'triangle', 0.12);
  }

  // Something cannot be done (not enough sap, bad anchor).
  error() {
    this._tone(180, 0.18, 'sawtooth', 0.08, 0, 120);
  }

  // The wither: a slow falling line.
  wither() {
    this._tone(392, 0.7, 'triangle', 0.14, 0, 196);
    this._tone(311, 0.9, 'triangle', 0.12, 0.35, 155);
  }

  // Soft ambient pad: two detuned sines under a lowpass, barely there.
  startPad() {
    if (!this.ctx || this.padNodes || this.muted) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.value = 196;
    o2.frequency.value = 196 * 1.5 + 1.5;
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    this.padNodes = { o1, o2, gain };
  }

  stopPad() {
    if (!this.padNodes) return;
    try { this.padNodes.o1.stop(); this.padNodes.o2.stop(); } catch (e) {}
    this.padNodes = null;
  }

  // Drought drone: a low dry hum while the season drains sap.
  startDrone() {
    if (!this.ctx || this.droneNodes) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 82;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.droneNodes = { osc, gain };
  }

  stopDrone() {
    if (!this.droneNodes) return;
    try { this.droneNodes.osc.stop(); } catch (e) {}
    this.droneNodes = null;
  }
}
