/* The run: map, rooms, rewards, shop, campfire and events. Pure logic like combat.js. */
import { FLOORS, MAP_ROWS, GOLD, PRICES, REST_HEAL, BOSS_HEAL, BAG_MIN, POTION_SLOTS, MAX_BLOCK_LEVEL, FIGHT_RELIC_CHANCE, FLAWLESS_GOLD, OVERKILL_GOLD } from '../data/rules.js';
import { HEROES } from '../data/heroes.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { EVENTS } from '../data/events.js';
import { UPGRADABLE } from '../data/blocks.js';
import { enemiesFor } from '../data/enemies.js';
import { makeRng } from '../core/rng.js';
import { startCombat } from './combat.js';
import { mod } from './stats.js';

export const SAVE_VERSION = 2;

/* ---------- new run ---------- */

export function newRun(heroId, seed) {
  const H = HEROES[heroId];
  const run = {
    v: SAVE_VERSION, seed, rng: seed, hero: heroId,
    hp: H.hp, maxHp: H.hp, gold: H.gold, floor: 1,
    relics: [H.relic], potions: H.potions.slice(), bag: { ...H.bag },
    lvl: { sword: 0, shield: 0, heart: 0, coin: 0 },
    charge: 0, revived: false, removes: 0, seenEvents: [],
    map: null, boss: null, path: [], room: null, combat: null, over: null,
    stats: { kills: 0, damage: 0, lines: 0, bestLines: 0, bestHit: 0, moves: 0, gold: 0, rooms: 0 },
  };
  startFloor(run);
  return run;
}

function startFloor(run) {
  const rng = makeRng(run);
  run.map = genMap(run);
  run.boss = rng.pick(enemiesFor(run.floor, 'boss'));
  run.path = [];
}

/* ---------- map ---------- */

const ROOM_WEIGHTS = row => [
  ['combat', 46], ['event', 18], ['elite', row >= 2 ? 13 : 0], ['shop', row >= 1 ? 10 : 0],
  ['treasure', 7], ['rest', row >= 3 ? 6 : 0],
].filter(e => e[1] > 0);

function genMap(run) {
  const rng = makeRng(run), rows = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const last = r === MAP_ROWS - 1, camp = r === MAP_ROWS - 2;
    const n = last ? 1 : r === 0 ? rng.int(2, 3) : rng.int(2, 4);
    const nodes = [];
    for (let i = 0; i < n; i++) {
      let t;
      if (last) t = 'boss';
      else if (r === 0) t = 'combat';
      else if (camp) t = i === 0 ? 'rest' : rng.weighted([['rest', 1.4], ['shop', 1]]);
      else t = rng.weighted(ROOM_WEIGHTS(r));
      const x = n === 1 ? 0.5 : 0.15 + (0.7 * i) / (n - 1) + (rng.next() - 0.5) * 0.06;
      nodes.push({ t, x, next: [] });
    }
    rows.push(nodes);
  }
  // connect each row to the next so every node is reachable and paths can branch
  for (let r = 0; r < MAP_ROWS - 1; r++) {
    const A = rows[r], B = rows[r + 1], n = A.length, m = B.length;
    A.forEach((a, i) => {
      const j = n === 1 ? Math.floor((m - 1) / 2) : Math.round((i * (m - 1)) / (n - 1));
      a.next.push(j);
      if (m > 1 && rng.chance(0.45)) {
        const k = j + (rng.chance(0.5) ? -1 : 1);
        if (k >= 0 && k < m && !a.next.includes(k)) a.next.push(k);
      }
    });
    B.forEach((b, j) => {
      if (A.some(a => a.next.includes(j))) return;
      let bi = 0, bd = 9;
      A.forEach((a, i) => { const d = Math.abs(a.x - b.x); if (d < bd) { bd = d; bi = i; } });
      A[bi].next.push(j);
    });
    A.forEach(a => a.next.sort((x, y) => x - y));
  }
  return rows;
}

export function availableNodes(run) {
  if (!run.path.length) return run.map[0].map((_, i) => i);
  const [r, i] = run.path[run.path.length - 1];
  return r + 1 < MAP_ROWS ? run.map[r][i].next.slice() : [];
}

/** Step onto node i of the next row and open its room. */
export function enterNode(run, i) {
  if (run.room || !availableNodes(run).includes(i)) return false;
  const row = run.path.length, node = run.map[row][i];
  run.path.push([row, i]);
  run.stats.rooms++;
  const rng = makeRng(run);
  run.room = { t: node.t };
  switch (node.t) {
    case 'combat': case 'elite': case 'boss':
      startCombat(run, node.t);
      break;
    case 'shop': run.room.shop = makeShop(run); break;
    case 'event': {
      const fresh = Object.keys(EVENTS).filter(k => !run.seenEvents.includes(k));
      const id = rng.pick(fresh.length ? fresh : Object.keys(EVENTS));
      run.seenEvents.push(id);
      run.room.event = id;
      break;
    }
    case 'treasure': {
      const [relic] = relicOffers(run, 1, 1);
      run.room.treasure = { relic, gold: rng.int(15, 30) + 5 * run.floor };
      break;
    }
    case 'rest': break;
  }
  return true;
}

/** Leave the current room. After the boss this moves to the next floor or ends the run. */
export function leaveRoom(run) {
  const wasBoss = run.room && run.room.t === 'boss';
  run.room = null;
  run.combat = null;
  if (!wasBoss) return;
  if (run.floor >= FLOORS) { run.over = 'win'; return; }
  run.floor++;
  startFloor(run);
}

/* ---------- relics & potions ---------- */

export function relicOffers(run, n, minRarity = 1, maxRarity = 3) {
  const rng = makeRng(run);
  const pool = Object.keys(RELICS).filter(id => {
    const R = RELICS[id];
    return R.rarity >= minRarity && R.rarity <= maxRarity && !run.relics.includes(id);
  });
  const weight = id => [0, 6, 3, 1][RELICS[id].rarity];
  const out = [];
  while (out.length < n && pool.length) {
    const id = rng.weighted(pool.map(x => [x, weight(x)]));
    out.push(id);
    pool.splice(pool.indexOf(id), 1);
  }
  return out;
}

export function gainRelic(run, id) {
  if (!RELICS[id] || run.relics.includes(id)) return;
  run.relics.push(id);
  const hp = RELICS[id].mod.maxHp || 0;
  if (hp) { run.maxHp += hp; run.hp += hp; }
}

export const canTakePotion = run => run.potions.length < POTION_SLOTS;

export function gainPotion(run, id) {
  if (!canTakePotion(run)) return false;
  run.potions.push(id || makeRng(run).pick(Object.keys(POTIONS)));
  return true;
}

/* ---------- rewards ---------- */

/** Called once a fight is won: pays gold, heals, and rolls the reward choices. */
export function winFight(run) {
  const rng = makeRng(run), kind = run.room.t, f = run.floor;
  const c = run.combat;
  const flawless = c.hpLost === 0 ? FLAWLESS_GOLD(f) : 0;
  const overkill = OVERKILL_GOLD(c.overkill, f);
  const gold = GOLD[kind](f) + rng.int(-3, 3) + flawless + overkill;
  run.gold += gold;
  run.stats.gold += gold;
  const healAmt = mod(run, 'fightHeal') + (kind === 'boss' ? Math.round(run.maxHp * BOSS_HEAL) : 0);
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + healAmt);
  let choices;
  if (kind === 'combat') choices = fightChoices(run);
  else if (kind === 'elite') choices = relicOffers(run, 3, 1, 3).map(id => ({ k: 'relic', id }));
  else choices = relicOffers(run, 3, 2, 3).map(id => ({ k: 'relic', id }));
  run.room.reward = { gold, flawless, overkill, healed: run.hp - before, choices, done: false };
  run.combat = null;
  return run.room.reward;
}

function fightChoices(run) {
  const rng = makeRng(run), out = [];
  const types = rng.shuffle(upgradable(run));
  if (types.length) out.push({ k: 'upgrade', id: types[0] });
  if (rng.chance(FIGHT_RELIC_CHANCE)) {
    const [id] = relicOffers(run, 1, 1, 2);
    if (id) out.push({ k: 'relic', id });
  }
  if (out.length < 3 && rng.chance(0.5)) out.push({ k: 'potion', id: rng.pick(Object.keys(POTIONS)) });
  if (out.length < 3 && types.length > 1) out.push({ k: 'upgrade', id: types[1] });
  if (out.length < 3) out.push({ k: 'vitality', v: 6 });
  if (out.length < 3 && canTakePotion(run)) out.push({ k: 'potion', id: rng.pick(Object.keys(POTIONS)) });
  return out.slice(0, 3);
}

export function claimReward(run, i) {
  const R = run.room && run.room.reward;
  if (!R || R.done) return false;
  const ch = R.choices[i];
  if (!ch) return false;
  if (ch.k === 'potion' && !canTakePotion(run)) return false;
  applyChoice(run, ch);
  R.done = true;
  return true;
}

export function skipReward(run) {
  if (run.room && run.room.reward) run.room.reward.done = true;
}

function applyChoice(run, ch) {
  switch (ch.k) {
    case 'relic': gainRelic(run, ch.id); break;
    case 'upgrade': upgradeBlock(run, ch.id); break;
    case 'potion': gainPotion(run, ch.id); break;
    case 'vitality': run.maxHp += ch.v; run.hp += ch.v; break;
  }
}

/** Block types that can still be upgraded (in the bag and below the level cap). */
export const upgradable = run => UPGRADABLE.filter(t => run.bag[t] > 0 && run.lvl[t] < MAX_BLOCK_LEVEL);

export function upgradeBlock(run, type) {
  if (!upgradable(run).includes(type)) return false;
  run.lvl[type]++;
  return true;
}

/* ---------- treasure ---------- */

export function openTreasure(run) {
  const T = run.room.treasure;
  if (!T || T.done) return;
  if (T.relic) gainRelic(run, T.relic);
  run.gold += T.gold;
  run.stats.gold += T.gold;
  T.done = true;
}

/* ---------- campfire ---------- */

export function rest(run) {
  if (run.room.done) return 0;
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * REST_HEAL));
  run.room.done = true;
  return run.hp - before;
}

export function train(run, type) {
  if (run.room.done || !upgradeBlock(run, type)) return false;
  run.room.done = true;
  return true;
}

/* ---------- shop ---------- */

function makeShop(run) {
  const rng = makeRng(run);
  const relics = relicOffers(run, 3, 1, 3).map(id => ({ k: 'relic', id, price: PRICES.relic[RELICS[id].rarity] + rng.int(-5, 5) }));
  const potions = rng.shuffle(Object.keys(POTIONS)).slice(0, 3).map(id => ({ k: 'potion', id, price: PRICES.potion + rng.int(-3, 3) }));
  return { items: [...relics, ...potions] };
}

export const removePrice = run => PRICES.removeBase + PRICES.removeStep * run.removes;
export const bagSize = run => Object.values(run.bag).reduce((a, b) => a + b, 0);

export function buy(run, i) {
  const item = run.room.shop.items[i];
  if (!item || item.sold || run.gold < item.price) return false;
  if (item.k === 'potion' && !canTakePotion(run)) return false;
  run.gold -= item.price;
  item.sold = true;
  if (item.k === 'relic') gainRelic(run, item.id);
  else gainPotion(run, item.id);
  return true;
}

export function removeBlock(run, type) {
  const price = removePrice(run);
  if (run.gold < price || !run.bag[type] || bagSize(run) <= BAG_MIN || run.room.shop.removed) return false;
  run.gold -= price;
  run.bag[type]--;
  if (!run.bag[type]) delete run.bag[type];
  run.removes++;
  run.room.shop.removed = true;
  return true;
}

/* ---------- events ---------- */

export function eventOptionOk(run, opt) {
  const n = opt.need || {};
  return (!n.gold || run.gold >= n.gold) && (!n.hp || run.hp >= n.hp);
}

/** Resolve an event option. Returns { say, choose } where choose = 'upgrade' asks the UI for a block type. */
export function chooseEventOption(run, i) {
  const ev = EVENTS[run.room.event], opt = ev.options[i];
  if (!opt || run.room.done || !eventOptionOk(run, opt)) return null;
  const rng = makeRng(run);
  const cost = opt.cost || {};
  if (cost.gold) run.gold -= cost.gold;
  if (cost.hp) run.hp = Math.max(1, run.hp - cost.hp);
  const out = rng.weighted(opt.outcomes.map(o => [o, o.w || 1]));
  const result = { say: out.say || '', choose: null, label: opt.label };
  const g = out.gain;
  if (g.heal) run.hp = Math.min(run.maxHp, run.hp + g.heal);
  if (g.healFull) run.hp = run.maxHp;
  if (g.gold) { run.gold = Math.max(0, run.gold + g.gold); if (g.gold > 0) run.stats.gold += g.gold; }
  if (g.hurt) run.hp = Math.max(1, run.hp - g.hurt);
  if (g.maxHp) { run.maxHp += g.maxHp; run.hp += g.maxHp; }
  if (g.potion) { if (!gainPotion(run, g.potion)) result.say = 'Your potion belt is full.'; }
  if (g.relic) { const [id] = relicOffers(run, 1, 1, 3); if (id) { gainRelic(run, id); result.relic = id; } }
  if (g.upgrade && upgradable(run).length) result.choose = 'upgrade';
  run.room.done = true;
  return result;
}
