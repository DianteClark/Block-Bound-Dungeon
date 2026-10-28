/* Seeded random numbers. All game randomness flows through a run's RNG state,
 * so a run is reproducible from its seed and the balance lab can replay it. */

/** Advance a mulberry32 state; returns [float in 0..1, nextState]. */
function step(state) {
  let a = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** A random source bound to an object holding `rng` (the run). */
export function makeRng(holder) {
  const next = () => { const [v, s] = step(holder.rng); holder.rng = s; return v; };
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));
  const pick = list => list[Math.floor(next() * list.length)];
  const chance = p => next() < p;
  const shuffle = list => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  /** entries: [[value, weight], ...] */
  const weighted = entries => {
    const total = entries.reduce((s, e) => s + e[1], 0);
    let x = next() * total;
    for (const [v, w] of entries) { if ((x -= w) < 0) return v; }
    return entries[entries.length - 1][0];
  };
  return { next, int, pick, chance, shuffle, weighted };
}

export function newSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}
