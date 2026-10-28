/* Local persistence: settings, the current run, and lifetime records. */
const NS = 'bbd2.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}
function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(NS + key);
    else localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (e) { /* storage full or blocked: the game keeps running */ }
}

export const DEFAULT_SETTINGS = { music: 0.55, sfx: 0.8, vibrate: true, motion: false, fast: false };

export const store = {
  settings: () => ({ ...DEFAULT_SETTINGS, ...read('settings', {}) }),
  saveSettings: s => write('settings', s),
  run: () => read('run', null),
  saveRun: run => write('run', run),
  clearRun: () => write('run', null),
  records: () => ({ runs: 0, wins: 0, bestFloor: 0, heroes: {}, ...read('records', {}) }),
  saveRecords: r => write('records', r),
  flag: k => !!read('flag.' + k, false),
  setFlag: k => write('flag.' + k, true),
  get: (k, fallback) => read('pref.' + k, fallback),
  set: (k, v) => write('pref.' + k, v),
  /** Wipe everything this game stored (old version's keys included). */
  reset() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(NS) || k.startsWith('bbd')).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  },
};
