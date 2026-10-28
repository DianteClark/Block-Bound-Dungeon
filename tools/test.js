/* Engine checks: run with `node tools/test.js`. Exits non-zero on failure. */
import assert from 'node:assert/strict';
import { newRun, availableNodes, enterNode, winFight, claimReward, leaveRoom, buy, rest, train, upgradable } from '../src/engine/run.js';
import { place, previewPlace, stashPiece, useSpecial, usePotion, pieceAt } from '../src/engine/combat.js';
import { fits } from '../src/engine/board.js';
import { playRun } from './bot.js';
import { GRID as N } from '../src/data/rules.js';
import { ART } from '../src/art/index.js';
import { ENEMIES } from '../src/data/enemies.js';
import { RELICS } from '../src/data/relics.js';
import { POTIONS } from '../src/data/potions.js';
import { BLOCKS } from '../src/data/blocks.js';
import { HEROES } from '../src/data/heroes.js';
import { EVENTS } from '../src/data/events.js';

let passed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

test('runs are reproducible from a seed', () => {
  const a = playRun('knight', 42), b = playRun('knight', 42);
  assert.deepEqual(a.stats, b.stats);
  assert.equal(a.floor, b.floor);
});

test('every hero can finish runs without errors or bad numbers', () => {
  for (const h of Object.keys(HEROES)) for (let s = 1; s <= 15; s++) {
    const r = playRun(h, s * 977);
    for (const v of Object.values(r.stats)) assert.ok(Number.isFinite(v), `${h} stat not finite`);
    assert.ok(Number.isFinite(r.hp));
  }
});

test('a fight survives a save and reload mid-move', () => {
  const run = newRun('mage', 7);
  enterNode(run, availableNodes(run)[0]);
  const copy = JSON.parse(JSON.stringify(run));
  const c = copy.combat;
  outer: for (const i of [0, 1, 2]) {
    const p = pieceAt(c, i);
    for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) if (fits(c.board, p, r, col)) {
      const ev = place(copy, i, r, col);
      assert.ok(ev && ev[0].t === 'place');
      assert.ok(ev.every(e => e.s && Number.isFinite(e.s.hp)), 'events carry snapshots');
      break outer;
    }
  }
});

test('preview matches the real clear', () => {
  for (let seed = 1; seed < 40; seed++) {
    const run = newRun('rogue', seed);
    enterNode(run, 0);
    const c = run.combat;
    // fill a row except one cell, then complete it with a single-cell piece
    for (let col = 0; col < N - 1; col++) c.board[col] = 'sword';
    c.hand[0] = { cells: [[0, 0]], h: 1, w: 1, type: 'sword' };
    const pv = previewPlace(run, 0, 0, N - 1).plan;
    const clear = place(run, 0, 0, N - 1).find(e => e.t === 'clear');
    assert.equal(clear.dmg, pv.dmg);
    assert.equal(clear.mult, pv.mult);
  }
});

test('stash works once per move and swaps back', () => {
  const run = newRun('knight', 3);
  enterNode(run, 0);
  const c = run.combat, first = c.hand[0];
  assert.ok(stashPiece(run, 0));
  assert.equal(c.stash, first);
  assert.equal(stashPiece(run, 1), false, 'second stash in one move is blocked');
});

test('specials and potions fire', () => {
  for (const h of Object.keys(HEROES)) {
    const run = newRun(h, 11);
    enterNode(run, 0);
    run.charge = 99;
    const ev = useSpecial(run);
    assert.ok(ev && ev.some(e => e.t === 'special'));
    run.potions = Object.keys(POTIONS);
    while (run.potions.length && !run.combat.over) assert.ok(usePotion(run, 0));
  }
});

test('rewards, shop and campfire keep gold and levels valid', () => {
  const run = newRun('knight', 5);
  enterNode(run, 0);
  run.combat.enemy.hp = 0; run.combat.over = 'win';
  const R = winFight(run);
  assert.ok(R.gold > 0 && R.choices.length >= 2);
  assert.ok(claimReward(run, 0));
  leaveRoom(run);
  run.gold = 0;
  run.room = { t: 'shop', shop: { items: [{ k: 'relic', id: 'whetstone', price: 75 }] } };
  assert.equal(buy(run, 0), false, 'cannot buy without gold');
  run.room = { t: 'rest' };
  const up = upgradable(run)[0];
  assert.ok(train(run, up));
  assert.equal(rest(run), 0, 'only one campfire action');
});

test('dealing enough damage breaks a big attack', () => {
  const run = newRun('knight', 21);
  enterNode(run, 0);
  const c = run.combat, e = c.enemy;
  e.hp = e.maxHp = 999;
  e.intent = { k: 'atk', v: 20, t: 3, left: 3, brk: 30, dealt: 0 };
  for (let col = 0; col < N - 1; col++) c.board[col] = 'sword';
  run.lvl.sword = 3; // 8 swords x 5 = 40 damage, enough to break
  c.hand[0] = { cells: [[0, 0]], h: 1, w: 1, type: 'sword' };
  const ev = place(run, 0, 0, N - 1);
  assert.ok(ev.some(x => x.t === 'break'), 'break event');
  assert.notEqual(e.intent.k === 'atk' && e.intent.v === 20 && e.intent.brk === 30, true, 'a new intent replaced the broken one');
  assert.ok(!ev.some(x => x.t === 'hitPlayer'), 'the broken attack never lands');
});

test('a combo survives one move without a clear, not two', () => {
  const run = newRun('rogue', 22);
  enterNode(run, 0);
  const c = run.combat;
  c.enemy.hp = c.enemy.maxHp = 9999; c.enemy.intent = { k: 'armor', v: 1, t: 9, left: 9, brk: 0, dealt: 0 };
  const single = () => ({ cells: [[0, 0]], h: 1, w: 1, type: 'shield' });
  const clearRow = r => { c.board.fill(null); for (let col = 0; col < N - 1; col++) c.board[r * N + col] = 'shield'; c.hand = [single(), single(), single()]; return place(run, 0, r, N - 1); };
  const miss = () => { c.board.fill(null); c.hand = [single(), single(), single()]; return place(run, 0, 4, 4); };
  clearRow(0); assert.equal(c.streak, 1);
  miss(); assert.equal(c.streak, 1, 'still alive after one miss');
  clearRow(0); assert.equal(c.streak, 2, 'combo continued');
  miss(); miss(); assert.equal(c.streak, 0, 'two misses end it');
});

test('rubble and gnaw hit the cells they telegraphed', () => {
  const run = newRun('mage', 23);
  enterNode(run, 0);
  const c = run.combat, e = c.enemy;
  e.hp = e.maxHp = 9999;
  e.intent = { k: 'rubble', v: 3, t: 1, left: 1, brk: 0, dealt: 0, marks: [10, 20, 30] };
  c.board.fill(null); c.board[20] = 'sword';
  c.hand = [{ cells: [[0, 0]], h: 1, w: 1, type: 'coin' }, null, null];
  const ev = place(run, 0, 7, 7);
  const rub = ev.find(x => x.t === 'rubble');
  assert.deepEqual(rub.cells, [10, 20, 30]);
  assert.deepEqual(rub.crushed, [20], 'a block left on a marked cell is crushed');
  assert.ok([10, 20, 30].every(i => c.board[i] === 'rubble'));
});

test('flawless fights and overkill pay bonus gold', () => {
  const run = newRun('knight', 24);
  enterNode(run, 0);
  run.combat.hpLost = 0; run.combat.overkill = 40; run.combat.over = 'win';
  const R = winFight(run);
  assert.ok(R.flawless > 0 && R.overkill > 0);
});

test('every piece of content has art', () => {
  const need = [
    ...Object.values(HEROES).flatMap(H => [H.art, H.special.art]),
    ...Object.values(ENEMIES).map(E => E.art), ...Object.values(RELICS).map(R => R.art),
    ...Object.values(POTIONS).map(P => P.art), ...Object.values(BLOCKS).map(B => B.art),
    ...Object.values(EVENTS).flatMap(E => [E.art, ...E.options.map(o => o.art)]),
    ...[...new Set(Object.values(ENEMIES).flatMap(E => E.moves.map(m => 'i_' + m.k)))],
  ];
  for (const a of need) assert.ok(ART[a], `missing art ${a}`);
  const owned = [...Object.values(HEROES).flatMap(H => [H.art, H.special.art]), ...Object.values(ENEMIES).map(E => E.art),
    ...Object.values(RELICS).map(R => R.art), ...Object.values(POTIONS).map(P => P.art), ...Object.values(EVENTS).flatMap(E => [E.art, ...E.options.map(o => o.art)])];
  const dup = owned.filter((a, i) => owned.indexOf(a) !== i && a !== 'o_leave');
  assert.deepEqual(dup, [], 'each item has its own art');
});

test('every module is preloaded and cached offline', async () => {
  const fs = await import('node:fs');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => f.isDirectory() ? walk(`${d}/${f.name}`) : [`${d}/${f.name}`]);
  const html = fs.readFileSync('index.html', 'utf8'), sw = fs.readFileSync('sw.js', 'utf8');
  for (const f of walk('src')) {
    assert.ok(html.includes(`href="${f}"`), `${f} missing from modulepreload`);
    assert.ok(sw.includes(`'${f}'`), `${f} missing from the service worker`);
  }
});

test('no unused art', async () => {
  const fs = await import('node:fs');
  const src = ['src/ui/combat.js', 'src/ui/screens.js', 'src/ui/sheets.js', 'src/ui/dom.js', ...fs.readdirSync('src/data').map(f => 'src/data/' + f)]
    .map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const unused = Object.keys(ART).filter(a => !src.includes(`'${a}'`) && !(a.startsWith('i_') && src.includes(`'i_' +`)));
  assert.deepEqual(unused, []);
});

for (const [name, fn] of queue) { await fn(); passed++; console.log('ok', name); }
console.log(`\n${passed} checks passed`);
