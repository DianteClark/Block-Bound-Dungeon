/* Synthesized sound effects and procedural music (Web Audio, no files).
 * Audio starts on the first tap (browser rule) and resumes after the app is backgrounded. */

let ctx = null, master, sfxBus, musicBus, verb, noiseBuf;
let vol = { sfx: 0.8, music: 0.55 };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function impulse(sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  // 'ambient': mix with whatever the player is listening to and stay quiet on silent mode.
  if (navigator.audioSession) { try { navigator.audioSession.type = 'ambient'; } catch (e) { /* older Safari */ } }
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.5; musicBus.connect(master);
  const conv = ctx.createConvolver(); conv.buffer = impulse(2.4, 2.8);
  verb = ctx.createGain(); verb.gain.value = 0.6; verb.connect(conv); conv.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return true;
}

/* ---------- voices ---------- */

function env(g, t, peak, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** One oscillator note. o: {f, f2, type, vol, dur, at, attack, lp, bus, rev, detune} */
function tone(o) {
  if (!ctx) return;
  const t = (o.t != null ? o.t : ctx.currentTime) + (o.at || 0), dur = o.dur || 0.15;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur * (o.glide || 1));
  if (o.detune) osc.detune.value = o.detune;
  env(g, t, o.vol || 0.2, o.attack || 0.005, dur);
  let node = osc;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); node = f; }
  node.connect(g); g.connect(o.bus || sfxBus);
  if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(verb); }
  osc.start(t); osc.stop(t + dur + 0.05);
}

/** Filtered noise burst. o: {f, f2, filter, q, vol, dur, at} */
function noise(o) {
  if (!ctx) return;
  const t = (o.t != null ? o.t : ctx.currentTime) + (o.at || 0), dur = o.dur || 0.2;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.Q.value = o.q || 0.8;
  f.frequency.setValueAtTime(o.f || 1200, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  const g = ctx.createGain(); env(g, t, o.vol || 0.2, o.attack || 0.004, dur);
  src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
  if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(verb); }
  src.start(t); src.stop(t + dur + 0.05);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

/* ---------- sound effects ---------- */
const SFX = {
  tap: () => tone({ f: 880, f2: 620, type: 'triangle', vol: 0.08, dur: 0.06 }),
  pick: () => tone({ f: 520, f2: 760, type: 'triangle', vol: 0.1, dur: 0.07 }),
  rotate: () => { noise({ f: 1800, f2: 4200, filter: 'bandpass', q: 3, vol: 0.12, dur: 0.07 }); tone({ f: 660, type: 'triangle', vol: 0.05, dur: 0.05 }); },
  place: () => { tone({ f: 210, f2: 90, type: 'sine', vol: 0.32, dur: 0.12 }); noise({ f: 900, f2: 300, vol: 0.12, dur: 0.06 }); },
  invalid: () => { tone({ f: 150, type: 'square', vol: 0.05, dur: 0.07, lp: 900 }); tone({ f: 130, type: 'square', vol: 0.05, dur: 0.08, at: 0.09, lp: 900 }); },
  stash: () => { tone({ f: 420, f2: 300, type: 'triangle', vol: 0.12, dur: 0.1 }); noise({ f: 2400, f2: 800, filter: 'bandpass', vol: 0.06, dur: 0.1 }); },
  clear: (lines = 1, streak = 0) => {
    const base = 72 + Math.min(streak, 6) * 2;
    const n = 2 + Math.min(lines, 4);
    for (let i = 0; i < n; i++) tone({ f: mtof(base + PENTA[i + Math.min(streak, 3)]), type: 'triangle', vol: 0.12, dur: 0.22, at: i * 0.045, rev: 0.35 });
    noise({ f: 6000, f2: 2500, filter: 'highpass', vol: 0.06, dur: 0.3, rev: 0.4 });
    tone({ f: 110, f2: 55, type: 'sine', vol: 0.25, dur: 0.18 });
  },
  hit: (big = false) => {
    noise({ f: big ? 2600 : 1800, f2: 200, vol: big ? 0.34 : 0.24, dur: big ? 0.22 : 0.14 });
    tone({ f: big ? 170 : 150, f2: 45, type: 'sine', vol: big ? 0.5 : 0.36, dur: big ? 0.26 : 0.16 });
    if (big) tone({ f: 1320, f2: 660, type: 'square', vol: 0.06, dur: 0.12, lp: 3000 });
  },
  armorHit: () => { tone({ f: 1500, type: 'triangle', vol: 0.12, dur: 0.18 }); tone({ f: 2250, type: 'triangle', vol: 0.06, dur: 0.12 }); noise({ f: 3000, filter: 'bandpass', q: 4, vol: 0.1, dur: 0.08 }); },
  shield: () => { tone({ f: 1046, type: 'triangle', vol: 0.12, dur: 0.25, rev: 0.4 }); tone({ f: 1568, type: 'triangle', vol: 0.07, dur: 0.3, at: 0.04, rev: 0.4 }); },
  heal: () => [60, 64, 67, 72].forEach((m, i) => tone({ f: mtof(m + 12), type: 'sine', vol: 0.09, dur: 0.3, at: i * 0.06, rev: 0.5 })),
  gold: () => { tone({ f: 1568, type: 'square', vol: 0.05, dur: 0.06, lp: 5000 }); tone({ f: 2093, type: 'square', vol: 0.05, dur: 0.14, at: 0.06, lp: 5000 }); },
  enemyAttack: () => { noise({ f: 600, f2: 3200, filter: 'bandpass', q: 1.2, vol: 0.14, dur: 0.16 }); },
  hurt: (big = false) => {
    tone({ f: 120, f2: 40, type: 'sawtooth', vol: big ? 0.3 : 0.22, dur: 0.28, lp: 600 });
    noise({ f: 900, f2: 120, vol: big ? 0.3 : 0.2, dur: 0.22 });
  },
  block: () => { tone({ f: 900, f2: 700, type: 'square', vol: 0.06, dur: 0.1, lp: 2400 }); noise({ f: 2600, filter: 'bandpass', q: 3, vol: 0.12, dur: 0.1 }); },
  enemyBuff: () => { tone({ f: 220, f2: 330, type: 'sawtooth', vol: 0.08, dur: 0.3, lp: 1200 }); tone({ f: 330, f2: 495, type: 'sawtooth', vol: 0.06, dur: 0.3, lp: 1200, at: 0.05 }); },
  enemyHeal: () => [57, 60, 64].forEach((m, i) => tone({ f: mtof(m), type: 'sine', vol: 0.08, dur: 0.3, at: i * 0.07, rev: 0.4 })),
  rubble: () => { for (let i = 0; i < 4; i++) noise({ f: 500 + Math.random() * 600, f2: 120, vol: 0.14, dur: 0.12, at: i * 0.05 + Math.random() * 0.03 }); },
  quake: () => { noise({ f: 300, f2: 60, vol: 0.4, dur: 0.7, attack: 0.05 }); tone({ f: 55, f2: 35, type: 'sine', vol: 0.4, dur: 0.7 }); },
  fire: () => { noise({ f: 1200, f2: 400, filter: 'bandpass', q: 0.6, vol: 0.3, dur: 0.6, attack: 0.08 }); tone({ f: 90, f2: 60, type: 'sawtooth', vol: 0.12, dur: 0.6, lp: 500 }); },
  magic: () => { [0, 4, 7, 11].forEach((s, i) => tone({ f: mtof(76 + s), type: 'sine', vol: 0.07, dur: 0.4, at: i * 0.05, rev: 0.6 })); },
  enrage: () => { tone({ f: 82, f2: 70, type: 'sawtooth', vol: 0.25, dur: 0.6, lp: 700 }); tone({ f: 123, f2: 98, type: 'sawtooth', vol: 0.18, dur: 0.6, lp: 700, at: 0.04 }); noise({ f: 400, vol: 0.12, dur: 0.5, attack: 0.1 }); },
  special: () => {
    tone({ f: 110, f2: 880, type: 'sawtooth', vol: 0.12, dur: 0.45, lp: 2400, glide: 0.9 });
    [60, 64, 67, 72, 76].forEach((m, i) => tone({ f: mtof(m + 12), type: 'triangle', vol: 0.1, dur: 0.5, at: 0.25 + i * 0.04, rev: 0.6 }));
  },
  ready: () => [79, 84, 88].forEach((m, i) => tone({ f: mtof(m), type: 'sine', vol: 0.08, dur: 0.3, at: i * 0.07, rev: 0.6 })),
  potion: () => { for (let i = 0; i < 4; i++) tone({ f: 300 + i * 90, f2: 500 + i * 120, type: 'sine', vol: 0.1, dur: 0.07, at: i * 0.06 }); },
  relic: () => [72, 76, 79, 84, 88, 91].forEach((m, i) => tone({ f: mtof(m), type: 'triangle', vol: 0.08, dur: 0.4, at: i * 0.05, rev: 0.6 })),
  buy: () => { SFX.gold(); tone({ f: 523, type: 'triangle', vol: 0.08, dur: 0.15, at: 0.12 }); tone({ f: 784, type: 'triangle', vol: 0.08, dur: 0.25, at: 0.2 }); },
  step: () => { noise({ f: 700, f2: 200, vol: 0.12, dur: 0.08 }); noise({ f: 700, f2: 200, vol: 0.1, dur: 0.08, at: 0.16 }); },
  door: () => { tone({ f: 140, f2: 110, type: 'sawtooth', vol: 0.06, dur: 0.5, lp: 800 }); noise({ f: 300, vol: 0.06, dur: 0.4 }); },
  cavein: () => { SFX.quake(); SFX.rubble(); },
  win: () => [60, 64, 67, 72, 67, 72, 76].forEach((m, i) => tone({ f: mtof(m + 12), type: i < 4 ? 'triangle' : 'square', vol: 0.09, dur: i === 6 ? 0.6 : 0.16, at: i * 0.1, rev: 0.4, lp: 4000 })),
  lose: () => [64, 62, 60, 55].forEach((m, i) => tone({ f: mtof(m), type: 'triangle', vol: 0.12, dur: i === 3 ? 0.9 : 0.3, at: i * 0.22, rev: 0.6 })),
  boss: () => { tone({ f: 55, type: 'sawtooth', vol: 0.3, dur: 1.2, lp: 500, attack: 0.05 }); tone({ f: 82.4, type: 'sawtooth', vol: 0.2, dur: 1.2, lp: 500, attack: 0.05 }); noise({ f: 200, vol: 0.2, dur: 1, attack: 0.1 }); },
  revive: () => { SFX.special(); SFX.heal(); },
  tick: () => tone({ f: 1320, type: 'triangle', vol: 0.05, dur: 0.05 }),
  comboLost: () => { tone({ f: 660, f2: 330, type: 'triangle', vol: 0.07, dur: 0.22 }); },
  break: () => {
    for (let i = 0; i < 6; i++) tone({ f: 1800 + Math.random() * 2400, type: 'triangle', vol: 0.06, dur: 0.18, at: i * 0.025, rev: 0.4 });
    noise({ f: 5000, f2: 1500, filter: 'highpass', vol: 0.22, dur: 0.3, rev: 0.3 });
    tone({ f: 220, f2: 70, type: 'sine', vol: 0.4, dur: 0.3 });
  },
  heartbeat: () => { tone({ f: 70, f2: 50, type: 'sine', vol: 0.35, dur: 0.12 }); tone({ f: 64, f2: 46, type: 'sine', vol: 0.28, dur: 0.12, at: 0.18 }); },
};

/* ---------- music ---------- */
/* A track: bpm, chord roots (one per bar, semitones from the key), minor/major, and which parts play. */
const TRACKS = {
  title:  { bpm: 72,  key: 50, minor: true, chords: [0, -4, -2, -5], parts: { pad: 1, arp: 0.6, bass: 0.5 } },
  map:    { bpm: 90,  key: 52, minor: true, chords: [0, 3, -2, -4], parts: { pad: 0.7, arp: 1, bass: 0.7, hat: 0.4 } },
  combat: { bpm: 112, key: 52, minor: true, chords: [0, 0, 3, -2, 0, 0, 5, 3], parts: { pad: 0.4, arp: 0.8, bass: 1, kick: 1, hat: 0.7, snare: 0.6 } },
  boss:   { bpm: 124, key: 49, minor: true, chords: [0, 1, 0, -2, 0, 1, 3, 1], parts: { pad: 0.6, arp: 1, bass: 1.2, kick: 1.2, hat: 0.9, snare: 0.9 } },
  camp:   { bpm: 68,  key: 55, minor: false, chords: [0, 5, -3, 7], parts: { pad: 0.8, arp: 0.7, bass: 0.4 } },
  shop:   { bpm: 100, key: 57, minor: false, chords: [0, -3, 5, 7], parts: { pad: 0.5, arp: 0.9, bass: 0.8, hat: 0.5 } },
};
const STEPS = 16;
const ARP = [0, 7, 12, 7, 3, 7, 12, 15, 0, 7, 12, 7, 3, 10, 7, 3];
const BASS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];

const Music = {
  track: null, gain: null, step: 0, bar: 0, next: 0, timer: null, floorShift: 0,
  play(name) {
    if (!ctx || this.track === name) return;
    const old = this.gain;
    if (old) { old.gain.cancelScheduledValues(ctx.currentTime); old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); setTimeout(() => old.disconnect(), 2500); }
    this.track = name;
    if (!name || !TRACKS[name]) { this.gain = null; return; }
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gain.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    this.gain.connect(musicBus);
    this.step = 0; this.bar = 0; this.next = ctx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
  },
  tick() {
    if (!ctx || !this.gain || ctx.state !== 'running') return;
    const T = TRACKS[this.track], spb = 60 / T.bpm / 4;
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05; // resync after a pause
    while (this.next < ctx.currentTime + 0.15) { this.note(T, this.step, this.next, spb); this.step++; if (this.step >= STEPS) { this.step = 0; this.bar++; } this.next += spb; }
  },
  note(T, s, t, spb) {
    const P = T.parts, bus = this.gain, root = T.key + (T.chords[this.bar % T.chords.length]) + this.floorShift;
    const third = T.minor ? 3 : 4;
    if (P.pad && s === 0) [0, third, 7, 12].forEach(iv => tone({ t, f: mtof(root + iv), type: 'sawtooth', vol: 0.022 * P.pad, dur: spb * 16, attack: 0.5, lp: 900, bus, detune: (Math.random() - 0.5) * 10 }));
    if (P.arp && (s % 2 === 0 || T.bpm > 100)) {
      let iv = ARP[s]; if (!T.minor && (iv === 3 || iv === 15)) iv += 1; if (!T.minor && iv === 10) iv = 11;
      tone({ t, f: mtof(root + 12 + iv), type: 'triangle', vol: 0.05 * P.arp, dur: spb * 1.6, lp: 3200, bus, rev: 0.3 });
    }
    if (P.bass && BASS[s]) tone({ t, f: mtof(root - 12), type: 'triangle', vol: 0.16 * P.bass, dur: spb * 2.2, lp: 500, bus });
    if (P.kick && (s % 4 === 0)) tone({ t, f: 120, f2: 40, type: 'sine', vol: 0.34 * P.kick, dur: 0.16, bus });
    if (P.snare && (s % 8 === 4)) noise({ t, f: 1800, filter: 'bandpass', q: 0.7, vol: 0.12 * P.snare, dur: 0.14, bus });
    if (P.hat && s % 2 === 1) noise({ t, f: 8000, filter: 'highpass', vol: 0.035 * P.hat, dur: 0.04, bus });
  },
};

/* ---------- public API ---------- */
let wanted = null, vibrateOn = true;

export const Sound = {
  /** Call from a user gesture. Safe to call often. */
  unlock() {
    if (!init()) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (wanted && Music.track !== wanted) Music.play(wanted);
  },
  sfx(name, ...args) {
    if (!ctx || ctx.state !== 'running' || !vol.sfx) return;
    const fn = SFX[name];
    if (fn) fn(...args);
  },
  music(name, floor = 1) {
    wanted = name;
    if (!ctx) return;
    Music.floorShift = name === 'combat' ? [0, 2, -1, 3, 1][(floor - 1) % 5] : 0;
    Music.play(name);
  },
  setVolume(kind, v) {
    vol[kind] = v;
    if (!ctx) return;
    if (kind === 'sfx') sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    if (kind === 'music') musicBus.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.05);
  },
  setVibrate(on) { vibrateOn = on; },
  buzz(ms = 10) { if (vibrateOn && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } } },
};

/* iOS suspends audio when the app is backgrounded; wake it when we come back. */
function wake() {
  if (!ctx) return;
  if (document.hidden) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); return; }
  if (ctx.state !== 'running') ctx.resume().then(() => { Music.next = ctx.currentTime + 0.05; }).catch(() => {});
}
document.addEventListener('visibilitychange', wake);
window.addEventListener('pageshow', wake);
window.addEventListener('focus', wake);
['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, () => Sound.unlock(), { passive: true }));
