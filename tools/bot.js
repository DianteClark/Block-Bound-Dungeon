/* A decent (not perfect) player used by the balance lab. It plays through the same engine
 * calls the UI makes, so whatever it measures is the real game. */
import { GRID as N } from '../src/data/rules.js';
import { rotate } from '../src/data/shapes.js';
import { UPGRADABLE } from '../src/data/blocks.js';
import { RELICS } from '../src/data/relics.js';
import { fits } from '../src/engine/board.js';
import {
  place, planClear, useSpecial, specialReady, usePotion, intentDamage, rotatePiece, STASH, pieceAt, stashPiece,
} from '../src/engine/combat.js';
import {
  newRun, availableNodes, enterNode, leaveRoom, winFight, claimReward, skipReward, openTreasure,
  rest, train, buy, chooseEventOption, eventOptionOk, upgradeBlock, canTakePotion, upgradable,
} from '../src/engine/run.js';
import { EVENTS } from '../src/data/events.js';

/* ---------- board evaluation ---------- */

function quality(board) {
  let score = 0;
  for (let r = 0; r < N; r++) {
    let f = 0; for (let c = 0; c < N; c++) if (board[r * N + c]) f++;
    score += f >= 6 ? f * 0.6 : 0;
  }
  for (let c = 0; c < N; c++) {
    let f = 0; for (let r = 0; r < N; r++) if (board[r * N + c]) f++;
    score += f >= 6 ? f * 0.6 : 0;
  }
  let empty = 0;
  for (let i = 0; i < N * N; i++) {
    if (board[i]) continue;
    empty++;
    const r = Math.floor(i / N), c = i % N;
    let closed = 0;
    if (r === 0 || board[i - N]) closed++;
    if (r === N - 1 || board[i + N]) closed++;
    if (c === 0 || board[i - 1]) closed++;
    if (c === N - 1 || board[i + 1]) closed++;
    if (closed === 4) score -= 5; else if (closed === 3) score -= 1.2;
  }
  return score + empty * 0.35;
}

export function bestMove(run) {
  const c = run.combat;
  const danger = run.hp < run.maxHp * 0.45;
  let best = null;
  for (const i of [0, 1, 2, STASH]) {
    const p0 = pieceAt(c, i);
    if (!p0) continue;
    let p = { ...p0 };
    for (let rot = 0; rot < 4; rot++) {
      for (let r = 0; r <= N - p.h; r++) for (let col = 0; col <= N - p.w; col++) {
        if (!fits(c.board, p, r, col)) continue;
        const b = c.board.slice();
        for (const [dr, dc] of p.cells) b[(r + dr) * N + col + dc] = p.type;
        const plan = planClear(run, b);
        let s = 0;
        if (plan) {
          s += plan.dmg * 1.0 + plan.shield * (danger ? 0.9 : 0.5) + plan.heal * (danger ? 1.0 : 0.3) + plan.gold * 0.2 + plan.lines * 4;
          for (const k of plan.cells) b[k] = null;
        }
        s += quality(b);
        if (!best || s > best.s) best = { s, i, rot, r, col };
      }
      p = { ...p, ...rotate(p) };
    }
  }
  return best;
}

function maybeConsumables(run) {
  const c = run.combat, e = c.enemy, it = e.intent;
  const incoming = intentDamage(run, it) * (it.n || 1);
  const threat = it.left <= 1 && incoming - c.shield >= run.hp;
  run.potions.forEach((id, slot) => {
    if (c.over || run.potions[slot] !== id) return;
    if (id === 'health' && run.hp < run.maxHp * 0.35) usePotion(run, slot);
    else if (id === 'fire' && e.hp <= 15) usePotion(run, slot);
    else if ((id === 'iron' || id === 'smoke') && threat) usePotion(run, slot);
  });
  if (specialReady(run)) useSpecial(run);
}

export function playFight(run) {
  const c = run.combat;
  let guard = 0;
  while (!c.over && guard++ < 600) {
    maybeConsumables(run);
    if (c.over) break;
    const m = bestMove(run);
    if (!m) { // nothing fits even after a cave-in; stash shuffle as a last resort
      if (!stashPiece(run, c.hand.findIndex(Boolean))) break;
      continue;
    }
    for (let k = 0; k < m.rot; k++) rotatePiece(run, m.i);
    place(run, m.i, m.r, m.col);
  }
  return c.over;
}

/* ---------- run decisions ---------- */

function chooseNode(run) {
  const opts = availableNodes(run), row = run.path.length;
  const hpPct = run.hp / run.maxHp;
  const value = t => ({
    combat: 1, elite: hpPct > 0.65 ? 1.3 : 0.15, rest: hpPct < 0.55 ? 2.2 : 0.5,
    shop: run.gold >= 75 ? 1.5 : 0.3, treasure: 1.6, event: 0.9, boss: 1,
  })[t];
  let best = opts[0], bv = -1;
  for (const i of opts) { const v = value(run.map[row][i].t) + i * 0.01; if (v > bv) { bv = v; best = i; } }
  return best;
}

const favType = run => ['sword', 'shield', 'heart', 'coin'].find(t => upgradable(run).includes(t)) || 'sword';

function pickReward(run) {
  const R = run.room.reward;
  const score = ch => ch.k === 'relic' ? 10 + RELICS[ch.id].rarity
    : ch.k === 'upgrade' ? (ch.id === 'sword' ? 6 : ch.id === 'shield' ? 5 : ch.id === 'heart' ? 3 : 1)
    : ch.k === 'vitality' ? 4 : canTakePotion(run) ? 3.5 : -1;
  let bi = -1, bs = 0;
  R.choices.forEach((ch, i) => { const s = score(ch); if (s > bs) { bs = s; bi = i; } });
  if (bi >= 0) claimReward(run, bi); else skipReward(run);
}

function shop(run) {
  const items = run.room.shop.items;
  const order = items.map((it, i) => [it, i]).sort((a, b) => (b[0].k === 'relic') - (a[0].k === 'relic'));
  for (const [it, i] of order) {
    if (it.k === 'potion' && run.gold - it.price < 20) continue;
    buy(run, i);
  }
}

function eventChoice(run) {
  const E = EVENTS[run.room.event];
  const ok = E.options.map((o, i) => [o, i]).filter(([o]) => eventOptionOk(run, o));
  const pref = ok.find(([o]) => o.outcomes.some(x => x.gain.relic) && run.hp > run.maxHp * 0.5)
    || ok.find(([o]) => o.outcomes.some(x => x.gain.healFull || x.gain.heal) && run.hp < run.maxHp * 0.7)
    || ok.find(([o]) => o.outcomes.some(x => x.gain.upgrade || x.gain.maxHp))
    || ok[ok.length - 1];
  const res = chooseEventOption(run, pref[1]);
  if (res && res.choose === 'upgrade') upgradeBlock(run, favType(run));
}

/** Play a whole run. Returns a summary for the lab. */
export function playRun(hero, seed) {
  const run = newRun(hero, seed);
  const log = { hero, seed, fights: [] };
  let guard = 0;
  while (!run.over && guard++ < 200) {
    if (!run.room) { enterNode(run, chooseNode(run)); continue; }
    const t = run.room.t;
    if (t === 'combat' || t === 'elite' || t === 'boss') {
      const hp0 = run.hp, enemy = run.combat.enemy.id, f = run.floor, moves0 = run.stats.moves;
      const res = playFight(run);
      log.fights.push({ enemy, floor: f, kind: t, lost: hp0 - Math.max(0, run.hp), moves: run.stats.moves - moves0, won: res === 'win' });
      if (res !== 'win') { run.over = 'lose'; log.killer = enemy; break; }
      winFight(run);
      pickReward(run);
    } else if (t === 'shop') shop(run);
    else if (t === 'rest') { if (run.hp < run.maxHp * 0.7 || !upgradable(run).length) rest(run); else train(run, favType(run)); }
    else if (t === 'event') eventChoice(run);
    else if (t === 'treasure') openTreasure(run);
    leaveRoom(run);
  }
  return { ...log, won: run.over === 'win', floor: run.floor, relics: run.relics.slice(), stats: run.stats, hp: run.hp, maxHp: run.maxHp, row: run.path.length };
}
