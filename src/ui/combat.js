/* The fight screen: enemy stage, canvas board and tray, input, and event playback. */
import { img, loadImage } from '../art/index.js';
import { $, esc, on, mount, toast, floatText, banner, flash, bump, wait } from './dom.js';
import { app, register, go, save, sfx, buzz, T } from './app.js';
import { renderRunbar, setBars, enemySheet, setPotionHook } from './sheets.js';
import { endRun, music } from './screens.js';
import { store } from '../core/store.js';
import { GRID as N } from '../data/rules.js';
import { BLOCKS } from '../data/blocks.js';
import { HEROES } from '../data/heroes.js';
import { ENEMIES, MOVES, ATTACKS } from '../data/enemies.js';
import { fits, fitsAnyRotation } from '../engine/board.js';
import {
  place, previewPlace, rotatePiece, stashPiece, useSpecial, specialReady, intentDamage, peekNext, pieceAt, STASH,
} from '../engine/combat.js';
import { specialNeed } from '../engine/stats.js';
import { winFight } from '../engine/run.js';

const COLORS = { sword: '#f0555b', shield: '#4d9bff', heart: '#4fcf7a', coin: '#ffc93c', rainbow: '#c77dff', rubble: '#8c8698' };
const SLOTS = 4; // three hand pieces and the stash

/* ---------- block tiles: SVG art rasterised once per size ---------- */
const tileImg = {};
export async function preloadTiles() {
  await Promise.all(Object.keys(BLOCKS).map(async t => { tileImg[t] = await loadImage(BLOCKS[t].art, { sticker: false }); }));
}
const tileCache = new Map();
function tile(type, px) {
  px = Math.max(4, Math.round(px));
  const key = type + px;
  let c = tileCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(tileImg[type], 0, 0, px, px);
    tileCache.set(key, c);
  }
  return c;
}

/* ---------- view state ---------- */
const V = {
  run: null, cv: null, ctx: null, dpr: 1, L: null, board: null,
  press: null, drag: null, busy: false, pops: new Map(), fading: new Map(), drops: new Map(), parts: [], raf: 0, shown: null,
};

register('combat', open);
if (new URLSearchParams(location.search).has('test')) window.__combat = V;

function open() {
  const run = V.run = app.run, c = run.combat, E = ENEMIES[c.enemy.id];
  renderRunbar();
  music(c.kind === 'boss' ? 'boss' : 'combat');
  const H = HEROES[run.hero];
  const root = mount(`<div class="combat">
      <div class="stage">
        <button class="foe" id="foe" aria-label="${esc(E.name)}">${img(E.art, c.kind === 'boss' ? 112 : 96)}</button>
        <div class="foe-info">
          <div class="foe-name">${esc(E.name)}${E.boss ? '<span class="tag boss">BOSS</span>' : E.elite ? '<span class="tag">ELITE</span>' : ''}</div>
          <div class="bar ehp" id="ehp"><i class="trail"></i><i class="fill"></i><span class="num"></span></div>
          <div class="badges" id="badges"></div>
          <button class="intent" id="intent" aria-label="Enemy intent"></button>
          <div class="next" id="next"></div>
        </div>
      </div>
      <div class="pbar">
        <button class="shieldv num" id="shield" aria-label="Shield">${img('ui_shield', 28)}<span>0</span></button>
        <div class="combo" id="combo"></div>
        <button class="special" id="special" aria-label="${esc(H.special.name)}">
          <span class="ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="#120d19" stroke-width="5"/><circle id="ring" cx="20" cy="20" r="17" fill="none" stroke="#ffc93c" stroke-width="5" stroke-linecap="round" stroke-dasharray="107" stroke-dashoffset="107"/></svg>${img(H.special.art, 30)}</span>
          <span id="spText">${esc(H.special.name)}</span></button>
      </div>
      <div class="boardwrap" id="bw"><canvas id="board"></canvas><div class="preview" id="preview" hidden></div></div>
    </div>`);
  V.cv = $('#board'); V.ctx = V.cv.getContext('2d');
  sizeWatch.disconnect();
  sizeWatch.observe($('#bw'));
  V.board = c.board.slice();
  V.drag = V.press = null; V.busy = false; V.parts = []; V.pops.clear(); V.fading.clear(); V.drops.clear();
  layout();
  hud();
  setPotionHook(ev => play(ev));
  bindInput();
  on(root, '#foe, #intent', () => { sfx('tap'); enemySheet(run); });
  on(root, '#shield', () => toast('<b>Shield</b> blocks enemy damage. Half of any leftover shield fades each time the enemy acts.', 'ui_shield', 3200));
  on(root, '#special', () => {
    if (V.busy) return;
    if (specialReady(run)) { const ev = useSpecial(run); if (ev) { save(); play(ev); } return; }
    sfx('tap');
    toast(`<b>${esc(H.special.name)}</b> ${esc(H.special.desc)} Charge: ${run.charge} / ${specialNeed(run)} lines.`, H.special.art, 3400);
  });
  cancelAnimationFrame(V.raf);
  V.raf = requestAnimationFrame(frame);
  if (c.moves === 0 && c.kind === 'boss') { sfx('boss'); banner(E.name, 'Boss fight', 1800); }
  else if (c.moves === 0 && c.kind === 'elite') banner(E.name, 'Elite', 1400);
  if (!store.flag('tutorial') && c.moves === 0) setTimeout(() => toast('<b>Drag a piece onto the grid.</b> Tap a piece to rotate it.', 'b_sword', 4200), 600);
}

/* ---------- HUD ---------- */
function hud(s) {
  const run = V.run, c = run.combat, e = c.enemy;
  s = s || { hp: run.hp, maxHp: run.maxHp, gold: run.gold, charge: run.charge, shield: c.shield, ehp: e.hp, earmor: e.armor, rage: e.rage, streak: c.streak };
  const pct = Math.max(0, s.ehp / e.maxHp);
  const bar = $('#ehp');
  if (!bar) return;
  bar.querySelector('.fill').style.transform = `scaleX(${pct})`;
  bar.querySelector('.trail').style.transform = `scaleX(${pct})`;
  bar.querySelector('span').textContent = `${Math.max(0, s.ehp)} / ${e.maxHp}`;
  $('#badges').innerHTML = (s.earmor ? `<span class="badge num">${img('i_armor', 22)}${s.earmor}</span>` : '')
    + (s.rage ? `<span class="badge num" style="color:#ff9aa6">${img('i_rage', 22)}+${s.rage}</span>` : '');
  intentHUD(s.rage);
  const sh = $('#shield');
  sh.querySelector('span').textContent = s.shield;
  sh.classList.toggle('zero', !s.shield);
  const need = specialNeed(run), ring = $('#ring');
  ring.style.strokeDashoffset = 107 * (1 - Math.min(1, s.charge / need));
  $('#special').classList.toggle('ready', s.charge >= need && !c.over);
  $('#spText').textContent = s.charge >= need ? 'Ready!' : `${s.charge} / ${need}`;
  setBars(s);
}

function intentText(it, rage) {
  const run = V.run, d = ATTACKS.has(it.k) ? intentDamage(run, it) - run.combat.enemy.rage + (rage || 0) : 0;
  if (it.k === 'multi') return [`${d} x${it.n}`, MOVES.multi.name];
  if (it.k === 'breath') return [`${d}+`, MOVES.breath.name];
  if (ATTACKS.has(it.k)) return [`${d}`, MOVES[it.k].name];
  if (['armor', 'heal', 'rage'].includes(it.k)) return [`+${it.v}`, MOVES[it.k].name];
  if (['rubble', 'gnaw', 'hex', 'sap'].includes(it.k)) return [`${it.v}`, MOVES[it.k].name];
  return ['', MOVES[it.k].name];
}

function intentHUD(rage) {
  const run = V.run, c = run.combat, it = c.enemy.intent;
  if (!it) return;
  const [val, name] = intentText(it, rage);
  const d = ATTACKS.has(it.k) ? intentDamage(run, it) : 0;
  const box = $('#intent');
  box.classList.toggle('soon', it.left <= 1 && ATTACKS.has(it.k));
  box.innerHTML = `${img('i_' + it.k, 38)}<div class="what"><b class="num">${val || name}</b><small>${val ? name + ', ' : ''}${it.left <= 1 ? 'next move' : `in ${it.left} moves`}</small></div>
    <div class="pips">${Array.from({ length: Math.min(6, Math.max(it.left, it.t)) }, (_, k) => `<i class="${k < it.left ? 'on' : ''}"></i>`).join('')}</div>`;
  box.setAttribute('aria-label', `${MOVES[it.k].name}: ${MOVES[it.k].desc(it, d)} In ${it.left} moves.`);
  const nx = peekNext(run), [nv, nn] = intentText(nx, rage);
  $('#next').innerHTML = `Then: ${img('i_' + nx.k, 18)} ${nn}${nv ? ' ' + nv : ''}`;
}

/* ---------- layout ---------- */
function layout() {
  const bw = $('#bw');
  if (!bw) return;
  const W = bw.clientWidth, H = bw.clientHeight;
  const dpr = V.dpr = Math.min(3, window.devicePixelRatio || 1);
  const cell = Math.floor(Math.min((W - 28) / N, (H - 18) / (N + 3.1)));
  const S = cell * N, bx = Math.round((W - S) / 2), by = 6;
  const ty = by + S + 14, slotW = S / SLOTS, slotH = Math.min(cell * 3, H - ty - 4);
  V.L = { W, H, cell, S, bx, by, ty, slotW, slotH };
  V.cv.width = W * dpr; V.cv.height = H * dpr;
  V.cv.style.width = W + 'px'; V.cv.style.height = H + 'px';
  $('#preview').style.top = Math.max(0, by - 2) + 'px';
}
const sizeWatch = new ResizeObserver(() => { if (app.screen === 'combat') layout(); });

const slotRect = i => { const L = V.L; return { x: L.bx + i * L.slotW, y: L.ty, w: L.slotW, h: L.slotH }; };
const trayCell = p => { const L = V.L; return Math.min(L.cell * 0.6, (L.slotW - 12) / p.w, (L.slotH - 12) / p.h); };

/* ---------- drawing ---------- */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function frame(now) {
  V.raf = requestAnimationFrame(frame);
  if (app.screen !== 'combat' || !V.L) return;
  const { ctx, dpr, L } = V, run = V.run, c = run.combat;
  if (!c) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, L.W, L.H);
  const cs = L.cell;

  // board well
  rr(ctx, L.bx - 7, L.by - 7, L.S + 14, L.S + 14, 16);
  ctx.fillStyle = '#0f0b15'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#21172b'; ctx.stroke();

  // preview data
  const d = V.drag, prev = d && d.valid ? d.plan : null;
  const lit = new Set(prev ? [...prev.cells] : []);
  const ghost = new Set(d && d.valid ? d.cells : []);

  for (let i = 0; i < N * N; i++) {
    const x = L.bx + (i % N) * cs, y = L.by + Math.floor(i / N) * cs;
    const t = V.board[i];
    rr(ctx, x + 2, y + 2, cs - 4, cs - 4, cs * 0.18);
    ctx.fillStyle = (i % N + Math.floor(i / N)) % 2 ? '#211a2c' : '#1d1727'; ctx.fill();
    const fade = V.fading.get(i);
    if (fade) {
      const k = Math.min(1, (now - fade.t0) / fade.dur);
      if (k >= 1) { V.fading.delete(i); continue; }
      const sc = fade.fire ? 1 - k * 0.5 : 1 + 0.18 * Math.sin(k * Math.PI);
      ctx.globalAlpha = 1 - k * k;
      drawTile(fade.type, x, y, cs, sc);
      ctx.globalAlpha = (1 - k) * 0.85;
      rr(ctx, x + 2, y + 2, cs - 4, cs - 4, cs * 0.18);
      ctx.fillStyle = fade.fire ? '#ff7a3d' : '#fff'; ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    if (!t) continue;
    let sc = 1, dy = 0;
    const pop = V.pops.get(i);
    if (pop) { const k = (now - pop) / 220; if (k >= 1) V.pops.delete(i); else sc = 1 + 0.16 * Math.sin(k * Math.PI); }
    const drop = V.drops.get(i);
    if (drop) { const k = (now - drop) / 320; if (k >= 1) V.drops.delete(i); else dy = -(1 - k) * (1 - k) * cs * 3; }
    drawTile(t, x, y + dy, cs, sc);
    if (lit.has(i)) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now / 90);
      rr(ctx, x + 2, y + 2, cs - 4, cs - 4, cs * 0.18); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // ghost of the dragged piece where it would land
  if (d && d.valid) {
    for (const i of ghost) {
      const x = L.bx + (i % N) * cs, y = L.by + Math.floor(i / N) * cs;
      ctx.globalAlpha = lit.has(i) ? 0.85 : 0.45;
      drawTile(d.piece.type, x, y, cs, 1);
      ctx.globalAlpha = 1;
    }
  }

  // tray
  for (let s = 0; s < SLOTS; s++) {
    const R = slotRect(s), p = pieceAt(c, s);
    const isStash = s === STASH;
    if (isStash) {
      rr(ctx, R.x + 5, R.y + 2, R.w - 10, R.h - 4, 14);
      ctx.setLineDash([6, 6]); ctx.lineWidth = 2.5;
      const hot = d && d.i !== STASH && d.overStash;
      ctx.strokeStyle = hot ? '#ffc93c' : c.stashUsed && !p ? '#3c2f4c' : '#5a4b6e'; ctx.stroke(); ctx.setLineDash([]);
      if (hot) { ctx.fillStyle = 'rgba(255,201,60,.12)'; ctx.fill(); }
      if (!p) {
        ctx.fillStyle = '#6f6283'; ctx.font = `600 ${Math.max(11, cs * 0.3)}px Fredoka, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('STASH', R.x + R.w / 2, R.y + R.h / 2);
      }
    }
    if (!p || (d && d.i === s)) continue;
    const tc = trayCell(p);
    const px = R.x + (R.w - p.w * tc) / 2, py = R.y + (R.h - p.h * tc) / 2;
    const ok = fitsAnyRotation(c.board, p);
    ctx.globalAlpha = ok ? 1 : 0.35;
    const press = V.press && V.press.i === s ? 0.94 : 1;
    for (const [r, col] of p.cells) drawTile(p.type, px + col * tc, py + r * tc, tc, press);
    ctx.globalAlpha = 1;
  }

  // the piece under the finger
  if (d) {
    const p = d.piece;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
    for (const [r, col] of p.cells) drawTile(p.type, d.px + col * cs, d.py + r * cs, cs, 1.04);
    ctx.restore();
  }

  // particles
  V.parts = V.parts.filter(q => now - q.t0 < q.life);
  for (const q of V.parts) {
    const k = (now - q.t0) / q.life, t = (now - q.t0) / 1000;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = q.col;
    const x = q.x + q.vx * t, y = q.y + q.vy * t + 420 * t * t;
    rr(ctx, x - q.s / 2, y - q.s / 2, q.s, q.s, q.s * 0.3); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTile(type, x, y, size, scale = 1) {
  const s = size * scale, o = (size - s) / 2;
  V.ctx.drawImage(tile(type, s * V.dpr), x + o, y + o, s, s);
}

function burst(i, type, n = 6) {
  const L = V.L, cs = L.cell;
  const x = L.bx + (i % N) * cs + cs / 2, y = L.by + Math.floor(i / N) * cs + cs / 2;
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 220;
    V.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160, s: 4 + Math.random() * 6, col: COLORS[type] || '#fff', t0: performance.now(), life: 500 + Math.random() * 300 });
  }
}

/** Sparks that fly from cleared cells to a HUD element. */
function flyTo(cells, el, color) {
  if (!el || document.body.classList.contains('reduce-motion')) return;
  const cr = V.cv.getBoundingClientRect(), tr = el.getBoundingClientRect();
  const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2, L = V.L;
  cells.slice(0, 10).forEach((i, k) => {
    const x = cr.left + L.bx + (i % N) * L.cell + L.cell / 2, y = cr.top + L.by + Math.floor(i / N) * L.cell + L.cell / 2;
    const dot = document.createElement('i');
    dot.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:12px;height:12px;margin:-6px;border-radius:4px;background:${color};border:2px solid #21172b`;
    $('#fx').appendChild(dot);
    const anim = dot.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${(tx - x) * 0.5}px,${(ty - y) * 0.5 - 40}px) scale(1.2)`, offset: 0.5 }, { transform: `translate(${tx - x}px,${ty - y}px) scale(.4)`, opacity: 0.6 }],
      { duration: T(420) + k * 25, easing: 'cubic-bezier(.5,0,.6,1)' });
    anim.onfinish = () => dot.remove();
  });
}

function shakeScreen() { if (app.settings.shake && !app.settings.motion) bump($('#app'), 'shake'); }

/* ---------- input ---------- */
function pt(e) { const r = V.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function slotAt(x, y) {
  for (let s = 0; s < SLOTS; s++) { const R = slotRect(s); if (x >= R.x && x <= R.x + R.w && y >= R.y - 10 && y <= R.y + R.h + 10) return s; }
  return -1;
}

function bindInput() {
  const cv = V.cv;
  cv.onpointerdown = e => {
    if (V.busy || V.run.combat.over) return;
    const { x, y } = pt(e), s = slotAt(x, y);
    if (s < 0 || !pieceAt(V.run.combat, s)) return;
    V.press = { i: s, x0: x, y0: y };
    cv.setPointerCapture(e.pointerId);
  };
  cv.onpointermove = e => {
    const { x, y } = pt(e), P = V.press;
    if (P && !V.drag && Math.hypot(x - P.x0, y - P.y0) > 7) {
      V.drag = { i: P.i, piece: pieceAt(V.run.combat, P.i) };
      sfx('pick'); buzz(6);
    }
    if (V.drag) { moveDrag(x, y, e.pointerType === 'mouse'); e.preventDefault(); }
  };
  cv.onpointerup = () => {
    const d = V.drag, P = V.press;
    V.drag = null; V.press = null;
    $('#preview').hidden = true;
    if (d) {
      if (d.overStash && d.i !== STASH) return doStash(d.i);
      if (d.valid) return doPlace(d.i, d.r, d.c);
      if (d.onBoard) sfx('invalid');
      return;
    }
    if (P) { rotatePiece(V.run, P.i); sfx('rotate'); save(); }
  };
  cv.onpointercancel = () => { V.drag = null; V.press = null; $('#preview').hidden = true; };
}

function moveDrag(x, y, mouse) {
  const d = V.drag, L = V.L, cs = L.cell, p = d.piece;
  const lift = mouse ? 0 : cs * 1.25;
  d.px = x - (p.w * cs) / 2; d.py = y - p.h * cs - lift + (mouse ? (p.h * cs) / 2 : 0);
  const r = Math.round((d.py - L.by) / cs), c = Math.round((d.px - L.bx) / cs);
  const S = slotRect(STASH);
  d.overStash = d.i !== STASH && !V.run.combat.stashUsed && x >= S.x && y >= S.y - 6;
  d.onBoard = y < L.ty;
  const was = d.valid ? `${d.r},${d.c}` : '';
  d.valid = !d.overStash && fits(V.run.combat.board, p, r, c);
  if (d.valid) {
    d.r = r; d.c = c;
    d.cells = p.cells.map(([dr, dc]) => (r + dr) * N + c + dc);
    if (was !== `${r},${c}`) { d.plan = previewPlace(V.run, d.i, r, c).plan; showPreview(d.plan); }
  } else { d.plan = null; $('#preview').hidden = true; }
}

function showPreview(plan) {
  const el = $('#preview');
  if (!plan) { el.hidden = true; return; }
  const part = (art, v) => (v ? `<span>${img(art, 20)}${v}</span>` : '');
  el.innerHTML = `<span class="m">x${plan.mult}</span>${part('b_sword', plan.dmg)}${part('b_shield', plan.shield)}${part('b_heart', plan.heal)}${part('b_coin', plan.gold)}`;
  el.hidden = false;
}

/* ---------- actions ---------- */
function doStash(i) {
  if (!stashPiece(V.run, i)) { sfx('invalid'); return; }
  sfx('stash'); save();
}

async function doPlace(i, r, c) {
  const ev = place(V.run, i, r, c);
  if (!ev) { sfx('invalid'); return; }
  save();
  if (!store.flag('tutorial') && V.run.combat.moves === 1) setTimeout(() => toast('<b>Fill a whole row or column.</b> Every block in it fires: swords hit, shields block, hearts heal.', 'ui_logo', 4600), 300);
  await play(ev);
}

/* ---------- event playback ---------- */
async function play(events) {
  V.busy = true;
  const run = V.run, foe = $('#foe');
  for (const e of events) {
    if (app.screen !== 'combat') break;
    const s = e.s;
    switch (e.t) {
      case 'place': {
        const now = performance.now();
        for (const i of e.cells) { V.board[i] = e.type; V.pops.set(i, now); }
        sfx('place'); buzz(6);
        break;
      }
      case 'clear': {
        const now = performance.now();
        for (const [i, t] of e.cells) { V.fading.set(i, { type: t, t0: now, dur: T(320) }); V.board[i] = null; burst(i, t, e.lines > 1 ? 7 : 5); }
        sfx(e.meteor ? 'special' : 'clear', e.lines, e.streak);
        buzz(e.lines > 1 ? 30 : 15);
        const ids = e.cells.map(x => x[0]);
        const by = t => ids.filter((_, k) => e.cells[k][1] === t || e.cells[k][1] === 'rainbow');
        if (e.dmg) flyTo(by('sword').length ? by('sword') : ids, foe, COLORS.sword);
        if (e.shield) flyTo(by('shield'), $('#shield'), COLORS.shield);
        if (e.heal) flyTo(by('heart'), $('#hpbar'), COLORS.heart);
        if (e.gold) flyTo(by('coin'), $('#goldpill'), COLORS.coin);
        const words = ['', '', 'Double!', 'Triple!', 'Quadruple!', 'Incredible!'];
        const combo = $('#combo');
        const label = e.meteor ? 'Meteor!' : e.lines >= 2 ? words[Math.min(5, e.lines)] : e.streak >= 1 ? `Combo ${e.streak + 1}` : '';
        if (label) { combo.textContent = `${label}  x${e.mult}`; combo.classList.add('on'); bump(combo, 'pop'); }
        if (e.lines >= 3) shakeScreen();
        await wait(T(240));
        break;
      }
      case 'tally': hud(s); break;
      case 'streakEnd': $('#combo').classList.remove('on'); break;
      case 'hitEnemy': {
        bump(foe, 'hit');
        if (e.absorbed) floatText(foe, `${e.absorbed} blocked`, '#b4d6ff');
        if (e.amount) floatText(foe, `-${e.amount}`, e.source === 'thorns' ? '#ffcf6a' : '#ff6b72', e.amount >= 25);
        sfx(e.amount ? 'hit' : 'armorHit', e.amount >= 25);
        if (e.amount >= 25) shakeScreen();
        hud(s);
        await wait(T(140));
        break;
      }
      case 'shield': floatText($('#shield'), `+${e.amount}`, '#8fc3ff'); bump($('#shield'), 'pop'); sfx('shield'); hud(s); break;
      case 'heal': floatText($('#hpbar'), `+${e.amount}`, '#7ff0a0'); sfx('heal'); hud(s); break;
      case 'gold': floatText($('#goldpill'), `+${e.amount}`, '#ffd96a'); sfx('gold'); hud(s); break;
      case 'enrage': floatText(foe, 'Enraged!', '#ff6b72', true); sfx('enrage'); shakeScreen(); hud(s); await wait(T(500)); break;
      case 'enemyMove': {
        await wait(T(120));
        bump(foe, 'lunge');
        sfx(ATTACKS.has(e.k) ? 'enemyAttack' : e.k === 'breath' ? 'fire' : 'enemyBuff');
        await wait(T(220));
        break;
      }
      case 'hitPlayer': {
        if (e.blocked) { floatText($('#shield'), `${e.blocked} blocked`, '#b4d6ff'); sfx('block'); }
        if (e.amount) {
          floatText($('#hpbar'), `-${e.amount}`, '#ff6b72', e.amount >= 15);
          sfx('hurt', e.amount >= 15); buzz(40); shakeScreen(); flash('rgba(240,60,70,.35)');
        }
        hud(s);
        await wait(T(180));
        break;
      }
      case 'enemyHeal': if (e.amount) floatText(foe, `+${e.amount}`, '#7ff0a0'); sfx('enemyHeal'); hud(s); await wait(T(200)); break;
      case 'enemyArmor': floatText(foe, `+${e.amount} armor`, '#c9d3e0'); sfx('armorHit'); hud(s); await wait(T(200)); break;
      case 'rubble': {
        const now = performance.now();
        for (const i of e.cells) { V.board[i] = 'rubble'; V.drops.set(i, now); }
        sfx('rubble'); await wait(T(320));
        break;
      }
      case 'sap': floatText($('#special'), `-${e.amount}`, '#d7bcff'); sfx('magic'); hud(s); break;
      case 'remove': {
        const now = performance.now();
        for (const [i, t] of e.cells) { if (!t) continue; V.fading.set(i, { type: t, t0: now, dur: T(380), fire: !!e.fire }); V.board[i] = null; }
        if (!e.fire) sfx('rubble');
        await wait(T(320));
        break;
      }
      case 'hex': sfx('magic'); toast('Your hand was <b>hexed</b> into rubble.', 'i_hex', 1800); break;
      case 'shiftUp': case 'flip': V.board = e.board.slice(); sfx('quake'); shakeScreen(); await wait(T(380)); break;
      case 'shieldFade': hud(s); break;
      case 'deal': sfx('pick'); break;
      case 'cavein': {
        banner('Cave-in!', e.dmg ? `The ceiling crashes down for ${e.dmg}` : 'Your kit turns it on the enemy', 1300);
        const now = performance.now();
        for (const [i, t] of e.cells) { V.fading.set(i, { type: t, t0: now, dur: T(420) }); V.board[i] = null; }
        sfx('cavein'); shakeScreen();
        await wait(T(450));
        break;
      }
      case 'revive': banner('Reborn!', 'The Phoenix Feather burns away', 1600); sfx('revive'); hud(s); await wait(T(600)); break;
      case 'special': {
        const H = HEROES[run.hero];
        banner(H.special.name, '', 1100); sfx('special'); buzz(30);
        await wait(T(300));
        break;
      }
      case 'potion': break;
      case 'delay': floatText($('#intent'), `+${e.amount} moves`, '#d7bcff'); sfx('magic'); break;
      case 'win': {
        foe.classList.add('die'); sfx('win');
        await wait(T(900));
        break;
      }
      case 'lose': sfx('lose'); flash('rgba(120,0,10,.5)'); await wait(T(1100)); break;
    }
  }
  V.board = run.combat.board.slice();
  V.busy = false;
  const c = run.combat;
  if (app.screen !== 'combat') return;
  renderRunbar();
  hud();
  if (c.over === 'win') { store.setFlag('tutorial'); winFight(run); save(); return go('reward'); }
  if (c.over === 'lose') { run.over = 'lose'; return endRun(); }
  if (specialReady(run) && !V.wasReady) { sfx('ready'); bump($('#special'), 'pop'); }
  V.wasReady = specialReady(run);
  if (!store.flag('tutorial') && c.moves === 3) toast('<b>Watch the countdown.</b> The enemy acts when its pips run out. Tap it for details.', 'i_atk', 4200);
}

