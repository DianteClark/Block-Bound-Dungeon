/* Combat rules. Every action takes the run, changes run.combat, and returns a list of
 * events ({t: 'clear', ...}) that the UI animates and the balance lab ignores.
 * Nothing in here touches the page. */
import { GRID as N, HAND, LINE_MULT, PURE_BONUS, CAVE_IN_DMG, ENEMY_HP, ENEMY_DMG, SHIELD_FADE } from '../data/rules.js';
import { BLOCKS } from '../data/blocks.js';
import { SHAPES, rotate } from '../data/shapes.js';
import { ENEMIES, ATTACKS, enemiesFor } from '../data/enemies.js';
import { RELICS } from '../data/relics.js';
import { makeRng } from '../core/rng.js';
import { mod, relicsWith, blockValue, specialNeed, streakStep } from './stats.js';
import {
  fits, fitsAnyRotation, fullLines, lineCells, rowCells, colCells, fullestRow, fullestCol,
} from './board.js';

export const STASH = 3;

/** Push an event with a snapshot of the numbers the UI shows, so it can animate step by step. */
function emit(run, ev, e) {
  const c = run.combat, en = c && c.enemy;
  e.s = {
    hp: run.hp, maxHp: run.maxHp, gold: run.gold, charge: run.charge,
    shield: c ? c.shield : 0, streak: c ? c.streak : 0,
    ehp: en ? en.hp : 0, earmor: en ? en.armor : 0, rage: en ? en.rage : 0,
  };
  ev.push(e);
}

/* ---------- setup ---------- */

export function startCombat(run, kind, enemyId) {
  const rng = makeRng(run);
  const id = enemyId || (kind === 'boss' ? run.boss : rng.pick(enemiesFor(run.floor, kind)));
  const E = ENEMIES[id];
  const hp = Math.round(E.hp * ENEMY_HP[E.floor - 1]);
  const enemy = {
    id, hp, maxHp: hp, armor: 0, rage: 0, mi: 0, intent: null, enraged: false,
  };
  const c = {
    kind, enemy, board: Array(N * N).fill(null), hand: [], stash: null, stashUsed: false,
    shield: mod(run, 'startShield'), streak: 0, moves: 0, firstClear: true, doubleNext: false,
    pile: [], over: null,
  };
  run.combat = c;
  run.charge = Math.min(specialNeed(run), run.charge + mod(run, 'startCharge'));
  nextIntent(run);
  dealHand(run);
  return c;
}

function nextIntent(run) {
  const e = run.combat.enemy, moves = ENEMIES[e.id].moves;
  const m = moves[e.mi % moves.length];
  e.mi++;
  e.intent = { ...m, left: m.t + mod(run, 'slowEnemy') };
}

/** The move after the current intent (shown greyed out under it). */
export function peekNext(run) {
  const e = run.combat.enemy, moves = ENEMIES[e.id].moves;
  return moves[e.mi % moves.length];
}

/* ---------- pieces ---------- */

function drawType(run) {
  const c = run.combat, rng = makeRng(run);
  if (!c.pile.length) {
    c.pile = rng.shuffle(Object.entries(run.bag).flatMap(([t, n]) => Array(n).fill(t)));
  }
  return c.pile.pop();
}

function newPiece(run) {
  const rng = makeRng(run), small = mod(run, 'smallPieces');
  let shape = rng.weighted(SHAPES.map(s => [s, s.weight * (small && s.cells.length <= 3 ? 2.2 : 1)]));
  for (let k = rng.int(0, 3); k > 0; k--) shape = rotate(shape);
  return { cells: shape.cells, h: shape.h, w: shape.w, type: drawType(run) };
}

export function dealHand(run) {
  const c = run.combat;
  let hand;
  for (let tries = 0; tries < 25; tries++) {
    hand = Array.from({ length: HAND }, () => newPiece(run));
    if (hand.some(p => fitsAnyRotation(c.board, p))) break;
  }
  c.hand = hand;
}

export const pieceAt = (c, i) => (i === STASH ? c.stash : c.hand[i]);

export function rotatePiece(run, i) {
  const c = run.combat, p = pieceAt(c, i);
  if (!p) return;
  Object.assign(p, rotate(p));
}

/** Move a hand piece into the empty stash (or swap stash into the hand). Free, once per move. */
export function stashPiece(run, i) {
  const c = run.combat;
  if (c.over || c.stashUsed || i === STASH || !c.hand[i]) return false;
  const old = c.stash;
  c.stash = c.hand[i];
  c.hand[i] = old;
  c.stashUsed = true;
  if (c.hand.every(p => !p)) dealHand(run);
  return true;
}

/* ---------- clearing ---------- */

const isPure = (board, cells) => {
  let base = null;
  for (const i of cells) {
    const t = board[i];
    if (!t || BLOCKS[t].junk) return false;
    if (t === 'rainbow') continue;
    if (base && t !== base) return false;
    base = t;
  }
  return true;
};

/** Everything a set of firing cells would do, with the given multiplier. */
function effectsOf(run, board, cells, mult) {
  let dmg = 0, shield = 0, heal = 0, gold = 0;
  for (const i of cells) {
    const t = board[i];
    if (!t) continue;
    const v = blockValue(run, t);
    switch (BLOCKS[t].does) {
      case 'damage': dmg += v; break;
      case 'shield': shield += v; break;
      case 'heal': heal += v; break;
      case 'gold': gold += v; break;
      case 'all': dmg += v; shield += v; heal += v; break;
      case 'none': dmg += mod(run, 'rubbleDmg'); break;
    }
  }
  return {
    dmg: Math.round(dmg * mult), shield: Math.round(shield * mult),
    heal: Math.round(heal * mult), gold,
  };
}

/** What clearing the full lines on `board` would do right now. Pure: used for previews too. */
export function planClear(run, board) {
  const c = run.combat;
  const { rows, cols } = fullLines(board);
  const lines = rows.length + cols.length;
  if (!lines) return null;
  let pure = 0;
  for (const r of rows) if (isPure(board, rowCells(r))) pure++;
  for (const col of cols) if (isPure(board, colCells(col))) pure++;
  let mult = LINE_MULT[Math.min(lines, LINE_MULT.length - 1)]
    + c.streak * streakStep(run)
    + pure * (PURE_BONUS + mod(run, 'pure'))
    + (lines >= 2 ? mod(run, 'multiLine') : 0);
  if (c.firstClear && mod(run, 'firstClear')) mult *= 2;
  if (c.doubleNext) mult *= 2;
  mult = Math.round(mult * 100) / 100;
  const cells = lineCells(rows, cols);
  return { rows, cols, lines, pure, mult, cells, ...effectsOf(run, board, cells, mult) };
}

/** Preview a placement without changing anything. */
export function previewPlace(run, i, r, col) {
  const c = run.combat, p = pieceAt(c, i);
  if (!p || !fits(c.board, p, r, col)) return null;
  const board = c.board.slice();
  for (const [dr, dc] of p.cells) board[(r + dr) * N + col + dc] = p.type;
  return { plan: planClear(run, board) };
}

function applyEffects(run, ev, fx, source) {
  const c = run.combat;
  if (fx.dmg > 0) damageEnemy(run, ev, fx.dmg, source);
  if (fx.shield > 0) { c.shield += fx.shield; emit(run, ev, { t: 'shield', amount: fx.shield }); }
  if (fx.heal > 0) heal(run, ev, fx.heal);
  if (fx.gold > 0) { run.gold += fx.gold; run.stats.gold += fx.gold; emit(run, ev, { t: 'gold', amount: fx.gold }); }
}

/** Tell the UI which relics just made a difference. Passive starters are left out. */
function relicFx(run, ev, key, starters = false) {
  for (const id of relicsWith(run, key)) if (starters || RELICS[id].rarity > 0) emit(run, ev, { t: 'relic', id });
}

function fireClear(run, ev, plan) {
  const c = run.combat;
  const cells = [...plan.cells].map(i => [i, c.board[i]]);
  if (c.firstClear) relicFx(run, ev, 'firstClear');
  if (plan.lines >= 2) relicFx(run, ev, 'multiLine', true);
  if (plan.pure) relicFx(run, ev, 'pure');
  if (c.streak) relicFx(run, ev, 'streakStep');
  if (cells.some(([, t]) => t === 'rubble')) relicFx(run, ev, 'rubbleDmg');
  emit(run, ev, {
    t: 'clear', cells, rows: plan.rows, cols: plan.cols, lines: plan.lines, pure: plan.pure,
    mult: plan.mult, streak: c.streak, dmg: plan.dmg, shield: plan.shield, heal: plan.heal, gold: plan.gold,
  });
  for (const i of plan.cells) c.board[i] = null;
  applyEffects(run, ev, plan, 'clear');
  if (plan.lines >= 2 && mod(run, 'fang')) { relicFx(run, ev, 'fang'); heal(run, ev, mod(run, 'fang')); }
  run.charge = Math.min(specialNeed(run), run.charge + plan.lines);
  c.streak++;
  c.firstClear = false;
  c.doubleNext = false;
  emit(run, ev, { t: 'tally' });
  run.stats.lines += plan.lines;
  run.stats.bestLines = Math.max(run.stats.bestLines, plan.lines);
  run.stats.bestHit = Math.max(run.stats.bestHit, plan.dmg);
}

/* ---------- damage ---------- */

function damageEnemy(run, ev, amount, source) {
  const c = run.combat, e = c.enemy;
  if (e.hp <= 0) return;
  const absorbed = Math.min(e.armor, amount);
  e.armor -= absorbed;
  const dealt = Math.min(e.hp, amount - absorbed);
  e.hp -= dealt;
  run.stats.damage += dealt;
  emit(run, ev, { t: 'hitEnemy', amount: amount - absorbed, absorbed, source });
  const E = ENEMIES[e.id];
  if (E.enrage && !e.enraged && e.hp > 0 && e.hp <= e.maxHp / 2) {
    e.enraged = true;
    e.rage += E.enrage;
    emit(run, ev, { t: 'enrage', v: E.enrage });
  }
  if (e.hp <= 0) endCombat(run, ev, 'win');
}

function heal(run, ev, amount) {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + amount);
  if (run.hp > before) emit(run, ev, { t: 'heal', amount: run.hp - before });
}

/** Enemy hits the hero; shield soaks first. Returns HP actually lost. */
function hitPlayer(run, ev, amount, attack = true) {
  const c = run.combat;
  const blocked = Math.min(c.shield, amount);
  c.shield -= blocked;
  const lost = Math.min(run.hp, amount - blocked);
  run.hp -= lost;
  emit(run, ev, { t: 'hitPlayer', amount: amount - blocked, blocked });
  if (attack && mod(run, 'thorns') && c.enemy.hp > 0) { relicFx(run, ev, 'thorns'); damageEnemy(run, ev, mod(run, 'thorns'), 'thorns'); }
  if (run.hp <= 0) {
    if (mod(run, 'revive') && !run.revived) {
      run.revived = true;
      relicFx(run, ev, 'revive');
      run.hp = Math.ceil(run.maxHp / 2);
      emit(run, ev, { t: 'revive', hp: run.hp });
    } else if (!c.over) endCombat(run, ev, 'lose');
  }
  return lost;
}

function endCombat(run, ev, result) {
  const c = run.combat;
  if (c.over) return;
  c.over = result;
  emit(run, ev, { t: result });
  if (result === 'win') run.stats.kills++;
}

/** Damage the current intent would deal per hit, including rage. */
export function intentDamage(run, it) {
  const e = run.combat.enemy;
  const scale = ENEMY_DMG[ENEMIES[e.id].floor - 1];
  if (it.k === 'breath') return Math.round(5 * scale) + e.rage;
  return ATTACKS.has(it.k) ? Math.round(it.v * scale) + e.rage : 0;
}

/* ---------- enemy moves ---------- */

function emptyCells(board) {
  const out = [];
  board.forEach((t, i) => { if (!t) out.push(i); });
  return out;
}

function enemyAct(run, ev) {
  const c = run.combat, e = c.enemy, it = e.intent, rng = makeRng(run);
  const d = intentDamage(run, it);
  emit(run, ev, { t: 'enemyMove', k: it.k, v: it.v, n: it.n || 1, d });
  switch (it.k) {
    case 'atk': hitPlayer(run, ev, d); break;
    case 'multi':
      for (let k = 0; k < it.n && !c.over; k++) hitPlayer(run, ev, d);
      break;
    case 'drain': {
      const lost = hitPlayer(run, ev, d);
      if (lost > 0 && e.hp > 0) { e.hp = Math.min(e.maxHp, e.hp + lost); emit(run, ev, { t: 'enemyHeal', amount: lost }); }
      break;
    }
    case 'armor': e.armor += it.v; emit(run, ev, { t: 'enemyArmor', amount: it.v }); break;
    case 'heal': {
      const amt = Math.min(it.v, e.maxHp - e.hp);
      e.hp += amt; emit(run, ev, { t: 'enemyHeal', amount: amt });
      break;
    }
    case 'rage': e.rage += it.v; break;
    case 'rubble': {
      const cells = rng.shuffle(emptyCells(c.board)).slice(0, it.v);
      for (const i of cells) c.board[i] = 'rubble';
      emit(run, ev, { t: 'rubble', cells });
      break;
    }
    case 'sap': {
      const amt = Math.min(run.charge, it.v);
      run.charge -= amt; emit(run, ev, { t: 'sap', amount: amt });
      break;
    }
    case 'gnaw': {
      const filled = [];
      c.board.forEach((t, i) => { if (t && t !== 'rubble') filled.push(i); });
      const cells = rng.shuffle(filled).slice(0, it.v);
      emit(run, ev, { t: 'remove', cells: cells.map(i => [i, c.board[i]]) });
      for (const i of cells) c.board[i] = null;
      break;
    }
    case 'hex': {
      const live = c.hand.map((p, i) => (p ? i : -1)).filter(i => i >= 0);
      const hit = rng.shuffle(live).slice(0, it.v);
      for (const i of hit) c.hand[i].type = 'rubble';
      emit(run, ev, { t: 'hex', hand: hit });
      break;
    }
    case 'breath': {
      const col = fullestCol(c.board), cells = colCells(col).filter(i => c.board[i]);
      emit(run, ev, { t: 'remove', cells: cells.map(i => [i, c.board[i]]), fire: true });
      for (const i of cells) c.board[i] = null;
      hitPlayer(run, ev, d + it.v * cells.length);
      break;
    }
    case 'frost': {
      const board = c.board, gap = rng.int(0, N - 1);
      for (let r = 0; r < N - 1; r++) for (let col = 0; col < N; col++) board[r * N + col] = board[(r + 1) * N + col];
      for (let col = 0; col < N; col++) board[(N - 1) * N + col] = col === gap ? null : 'rubble';
      emit(run, ev, { t: 'shiftUp', board: c.board.slice() });
      break;
    }
    case 'flip': {
      const old = c.board.slice();
      for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) c.board[r * N + col] = old[(N - 1 - r) * N + col];
      emit(run, ev, { t: 'flip', board: c.board.slice() });
      break;
    }
  }
  if (!c.over) {
    const fade = Math.floor(c.shield * SHIELD_FADE);
    if (fade > 0) { c.shield -= fade; emit(run, ev, { t: 'shieldFade', amount: fade }); }
    nextIntent(run);
  }
}

function enemyTick(run, ev) {
  const c = run.combat;
  if (c.over) return;
  c.enemy.intent.left--;
  if (c.enemy.intent.left <= 0) enemyAct(run, ev);
}

/* ---------- stuck: cave-in ---------- */

function anyPlayable(c) {
  return [...c.hand, c.stash].some(p => p && fitsAnyRotation(c.board, p));
}

function checkStuck(run, ev) {
  const c = run.combat;
  for (let guard = 0; guard < 4 && !c.over && !anyPlayable(c); guard++) {
    const rows = [];
    const b = c.board.slice();
    for (let k = 0; k < 2; k++) {
      const r = fullestRow(b);
      rows.push(r);
      for (const i of rowCells(r)) b[i] = null;
    }
    const cells = rows.flatMap(rowCells).filter(i => c.board[i]).map(i => [i, c.board[i]]);
    for (const [i] of cells) c.board[i] = null;
    const sapper = mod(run, 'sapper');
    if (sapper) relicFx(run, ev, 'sapper');
    emit(run, ev, { t: 'cavein', rows, cells, dmg: sapper ? 0 : CAVE_IN_DMG(run.floor) });
    if (sapper) damageEnemy(run, ev, 10, 'cavein');
    else hitPlayer(run, ev, CAVE_IN_DMG(run.floor), false);
  }
}

/* ---------- player actions ---------- */

/** Place piece i (0-2 hand, 3 stash) with its top-left at (r, col). */
export function place(run, i, r, col) {
  const c = run.combat, p = pieceAt(c, i), ev = [];
  if (c.over || !p || !fits(c.board, p, r, col)) return null;
  const cells = p.cells.map(([dr, dc]) => (r + dr) * N + col + dc);
  for (const k of cells) c.board[k] = p.type;
  emit(run, ev, { t: 'place', cells, type: p.type });
  if (i === STASH) c.stash = null; else c.hand[i] = null;
  c.stashUsed = false;
  c.moves++;
  run.stats.moves++;

  const plan = planClear(run, c.board);
  if (plan) fireClear(run, ev, plan);
  else if (c.streak) { emit(run, ev, { t: 'streakEnd', streak: c.streak }); c.streak = 0; }

  enemyTick(run, ev);
  if (!c.over && c.hand.every(x => !x)) { dealHand(run); emit(run, ev, { t: 'deal' }); }
  checkStuck(run, ev);
  return ev;
}

export function specialReady(run) {
  return !!run.combat && !run.combat.over && run.charge >= specialNeed(run);
}

export function useSpecial(run) {
  const c = run.combat, ev = [];
  if (!specialReady(run)) return null;
  run.charge = 0;
  emit(run, ev, { t: 'special', hero: run.hero });
  switch (run.hero) {
    case 'knight': {
      const amt = 12 + 3 * run.floor;
      c.shield += amt;
      emit(run, ev, { t: 'shield', amount: amt });
      const cells = [];
      c.board.forEach((t, i) => { if (t === 'rubble') cells.push([i, t]); });
      for (const [i] of cells) c.board[i] = null;
      if (cells.length) emit(run, ev, { t: 'remove', cells });
      break;
    }
    case 'rogue':
      dealHand(run);
      emit(run, ev, { t: 'deal' });
      c.enemy.intent.left += 2;
      emit(run, ev, { t: 'delay', amount: 2 });
      c.doubleNext = true;
      break;
    case 'mage': {
      const row = fullestRow(c.board), col = fullestCol(c.board);
      const set = new Set([...rowCells(row), ...colCells(col)].filter(i => c.board[i]));
      const fx = effectsOf(run, c.board, set, 2.5);
      emit(run, ev, { t: 'clear', cells: [...set].map(i => [i, c.board[i]]), rows: [row], cols: [col], lines: 2, pure: 0,
        mult: 2.5, streak: 0, meteor: true, ...fx });
      for (const i of set) c.board[i] = null;
      applyEffects(run, ev, fx, 'special');
      break;
    }
  }
  checkStuck(run, ev);
  return ev;
}

export function usePotion(run, slot) {
  const id = run.potions[slot], c = run.combat, ev = [];
  if (!id) return null;
  const inFight = c && !c.over;
  if (!inFight && id !== 'health') return null;
  run.potions.splice(slot, 1);
  emit(run, ev, { t: 'potion', id });
  switch (id) {
    case 'health': heal(run, ev, 20); break;
    case 'iron': c.shield += 15; emit(run, ev, { t: 'shield', amount: 15 }); break;
    case 'fire': damageEnemy(run, ev, 15, 'potion'); break;
    case 'smoke': c.enemy.intent.left += 2; emit(run, ev, { t: 'delay', amount: 2 }); break;
    case 'fresh': dealHand(run); emit(run, ev, { t: 'deal' }); checkStuck(run, ev); break;
  }
  return ev;
}

