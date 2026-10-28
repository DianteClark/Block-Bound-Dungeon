/* Balance lab: plays many runs per hero with the bot and reports where runs end.
 *   node tools/lab.js [runsPerHero=150] [heroes=knight,rogue,mage] [seedBase=1] */
import { playRun } from './bot.js';
import { HERO_ORDER } from '../src/data/heroes.js';
import { ENEMIES } from '../src/data/enemies.js';
import { RELICS } from '../src/data/relics.js';
import { ENEMY_HP, ENEMY_DMG } from '../src/data/rules.js';

// optional sweeps: LAB_HP=1,1.1,1.2,1.3,1.4 LAB_DMG=2 node tools/lab.js
const knob = (arr, env) => { if (!env) return; const v = env.split(',').map(Number); arr.forEach((_, i) => { arr[i] = v[Math.min(i, v.length - 1)]; }); };
knob(ENEMY_HP, process.env.LAB_HP);
knob(ENEMY_DMG, process.env.LAB_DMG);

const runs = +(process.argv[2] || 150);
const heroes = (process.argv[3] || HERO_ORDER.join(',')).split(',');
const seedBase = +(process.argv[4] || 1);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + '%';
const pad = (s, n) => String(s).padEnd(n);

const quiet = !!process.env.LAB_QUIET;
const all = [];
for (const hero of heroes) {
  const res = [];
  for (let k = 0; k < runs; k++) res.push(playRun(hero, (seedBase * 100003 + k * 7919) >>> 0));
  all.push(...res);
  const wins = res.filter(r => r.won).length;
  const byFloor = [1, 2, 3, 4, 5].map(f => res.filter(r => !r.won && r.floor === f).length);
  const avgLines = Math.round(res.reduce((a, r) => a + r.stats.lines, 0) / runs);
  const killers = {};
  res.filter(r => !r.won).forEach(r => { killers[r.killer] = (killers[r.killer] || 0) + 1; });
  const top = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${ENEMIES[k].name} ${n}`).join(', ');
  console.log(`\n${pad(hero.toUpperCase(), 8)} win ${pct(wins, runs)}  deaths by floor ${byFloor.join(' / ')}  avg lines ${avgLines}  avg best hit ${Math.round(res.reduce((a, r) => a + r.stats.bestHit, 0) / runs)}${top ? `\n         killers: ${top}` : ''}`);
}

if (quiet) process.exit(0);
// per-enemy: average HP lost and how often it ended a run
const fights = {};
for (const r of all) for (const f of r.fights) {
  const s = fights[f.enemy] || (fights[f.enemy] = { n: 0, lost: 0, moves: 0, kills: 0 });
  s.n++; s.lost += f.lost; s.moves += f.moves; if (!f.won) s.kills++;
}
console.log('\nENEMY            fights  avg HP lost  avg moves  run-ends');
for (const [id, s] of Object.entries(fights).sort((a, b) => ENEMIES[a[0]].floor - ENEMIES[b[0]].floor)) {
  console.log(`${pad(ENEMIES[id].name, 18)} ${pad(s.n, 7)} ${pad((s.lost / s.n).toFixed(1), 12)} ${pad((s.moves / s.n).toFixed(1), 10)} ${s.kills}`);
}

// relic impact: win rate of runs that ended holding it vs overall
const overall = all.filter(r => r.won).length / all.length;
console.log(`\nRELIC            held  win rate (overall ${pct(overall * all.length, all.length)})`);
for (const id of Object.keys(RELICS).filter(id => RELICS[id].rarity > 0)) {
  const held = all.filter(r => r.relics.includes(id));
  if (!held.length) continue;
  console.log(`${pad(RELICS[id].name, 18)} ${pad(held.length, 5)} ${pct(held.filter(r => r.won).length, held.length)}`);
}
