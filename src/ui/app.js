/* App core: the live run, settings, saving and screen routing. */
import { store } from '../core/store.js';
import { Sound } from '../audio/audio.js';

export const app = {
  run: null,
  settings: store.settings(),
  screen: null,
};

const screens = {};
export const register = (name, fn) => { screens[name] = fn; };

export function go(name, ...args) {
  app.screen = name;
  document.body.classList.toggle('in-combat', name === 'combat');
  document.getElementById('sheet').hidden = true;
  screens[name](...args);
}

export function save() {
  if (app.run && !app.run.over) store.saveRun(app.run);
}

export function applySettings() {
  const s = app.settings;
  Sound.setVolume('music', s.music);
  Sound.setVolume('sfx', s.sfx);
  Sound.setVibrate(s.vibrate);
  document.body.classList.toggle('reduce-motion', !!s.motion);
  store.saveSettings(s);
}

/** Game speed: animation delays scale with this. */
export const T = ms => Math.round(ms * (app.settings.fast ? 0.55 : 1));

export const sfx = (name, ...a) => Sound.sfx(name, ...a);
export const buzz = ms => Sound.buzz(ms);

/** Record a finished run in lifetime records. */
export function recordRun(run) {
  const r = store.records();
  const h = r.heroes[run.hero] || (r.heroes[run.hero] = { runs: 0, wins: 0, bestFloor: 0 });
  r.runs++; h.runs++;
  if (run.over === 'win') { r.wins++; h.wins++; }
  r.bestFloor = Math.max(r.bestFloor, run.floor);
  h.bestFloor = Math.max(h.bestFloor, run.floor);
  store.saveRecords(r);
  store.clearRun();
}
