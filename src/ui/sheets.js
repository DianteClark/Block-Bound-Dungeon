/* The run bar and every bottom sheet: relics, potions, bag, enemy info, settings, how to play. */
import { img } from '../art/index.js';
import { $, esc, on, openSheet, closeSheet, toast, setHTML } from './dom.js';
import { app, go, save, applySettings, sfx, recordRun } from './app.js';
import { store } from '../core/store.js';
import { HEROES } from '../data/heroes.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { BLOCKS } from '../data/blocks.js';
import { ENEMIES, MOVES, ATTACKS } from '../data/enemies.js';
import { POTION_SLOTS } from '../data/rules.js';
import { blockValue, specialNeed } from '../engine/stats.js';
import { usePotion } from '../engine/combat.js';

export const RARITY = ['Starter', 'Common', 'Uncommon', 'Rare'];
let potionHook = null; // { play(events), busy() } while a fight is on screen
/** Combat registers how to play out a potion's events. */
export const setPotionHook = hook => { potionHook = hook; };

/* ---------- run bar ---------- */
export function renderRunbar() {
  const run = app.run, bar = $('#runbar');
  if (!run) { bar.hidden = true; return; }
  bar.hidden = false;
  document.body.dataset.floor = run.floor;
  const pct = Math.max(0, run.hp / run.maxHp);
  const relics = run.relics.slice(-2).reverse();
  const html = `
    <button class="rb-hero" data-act="bag" aria-label="Your bag and stats">${img(HEROES[run.hero].art, 50)}
      <span class="rb-lv pill" style="height:20px;padding:0 6px;font-size:12px">F${run.floor}</span></button>
    <div class="rb-stats">
      <div class="bar hp" id="hpbar"><i class="trail" style="transform:scaleX(${pct})"></i><i class="fill" style="transform:scaleX(${pct})"></i><span class="num" id="hptext">${Math.max(0, run.hp)} / ${run.maxHp}</span></div>
      <div class="rb-row">
        <span class="pill num" id="goldpill">${img('ui_coin', 24)}<span>${run.gold}</span></span>
        <button class="rb-relics" data-act="relics" aria-label="Relics">${relics.map(id => img(RELICS[id].art, 22)).join('')}${run.relics.length > 2 ? `<span class="more">+${run.relics.length - 2}</span>` : ''}</button>
        <span style="flex:1"></span>
        <div class="pots">${Array.from({ length: POTION_SLOTS }, (_, i) => run.potions[i]
          ? `<button class="pot" data-pot="${i}" aria-label="${esc(POTIONS[run.potions[i]].name)}">${img(POTIONS[run.potions[i]].art, 26)}</button>`
          : `<span class="pot empty"></span>`).join('')}</div>
      </div>
    </div>
    <button class="iconbtn" data-act="settings" aria-label="Settings">${img('ui_gear', 34)}</button>`;
  setHTML(bar, html);
  document.body.classList.toggle('danger', app.screen === 'combat' && run.hp <= run.maxHp * 0.3);
}

/** Update only the numbers (used during combat animations). */
export function setBars({ hp, maxHp, gold }) {
  const run = app.run;
  if (hp != null) {
    const pct = Math.max(0, hp / (maxHp || run.maxHp));
    const bar = $('#hpbar');
    if (bar) {
      bar.querySelector('.fill').style.transform = `scaleX(${pct})`;
      bar.querySelector('.trail').style.transform = `scaleX(${pct})`;
      $('#hptext').textContent = `${Math.max(0, hp)} / ${maxHp || run.maxHp}`;
    }
    document.body.classList.toggle('danger', app.screen === 'combat' && hp <= (maxHp || run.maxHp) * 0.3);
  }
  if (gold != null) { const g = $('#goldpill span'); if (g) g.textContent = gold; }
}

on(document.getElementById('runbar'), '[data-act],[data-pot]', el => {
  sfx('tap');
  if (el.dataset.pot != null) return potionSheet(+el.dataset.pot);
  ({ bag: bagSheet, relics: relicsSheet, settings: settingsSheet })[el.dataset.act]();
});

/* ---------- relics ---------- */
export function relicRow(id, extra = '') {
  const R = RELICS[id];
  return `<div class="info-head">${img(R.art, 56)}<div class="txt"><b>${esc(R.name)} <span class="rtag r${R.rarity}">${RARITY[R.rarity]}</span></b><span class="muted" style="font-size:14px">${esc(R.desc)}</span>${extra}</div></div>`;
}
export function relicSheet(id) { openSheet(relicRow(id) + `<button class="btn ghost block" data-close>Close</button>`); bindClose(); }
function relicsSheet() {
  const run = app.run;
  openSheet(`<h2 class="display">Relics</h2><div class="list">${run.relics.map(id => relicRow(id)).join('')}</div><button class="btn ghost block" data-close>Close</button>`);
  bindClose();
}

/* ---------- potions ---------- */
export function potionSheet(slot) {
  const run = app.run, id = run.potions[slot], P = POTIONS[id];
  const inFight = !!(run.combat && !run.combat.over) && app.screen === 'combat';
  const usable = inFight || id === 'health';
  openSheet(`<div class="info-head">${img(P.art, 64)}<div class="txt"><b style="font-size:20px">${esc(P.name)}</b><span class="muted">${esc(P.desc)}</span></div></div>
    ${usable ? '' : '<p class="muted" style="font-size:14px">Can only be used in a fight.</p>'}
    <div class="row"><button class="btn ghost" data-close>Keep</button>${usable ? '<button class="btn" data-use>Drink</button>' : ''}</div>`);
  bindClose();
  const use = $('#sheet [data-use]');
  if (use) use.onclick = () => {
    if (inFight && potionHook && potionHook.busy()) { sfx('invalid'); return; }
    closeSheet();
    const ev = usePotion(run, slot);
    if (!ev) return;
    sfx('potion');
    save();
    if (inFight && potionHook) potionHook.play(ev);
    else { renderRunbar(); toast(`<b>${esc(P.name)}</b> ${esc(P.desc)}`, P.art); }
  };
}

/* ---------- bag ---------- */
export function blockLine(run, t) {
  const B = BLOCKS[t], v = blockValue(run, t), lv = run.lvl[t] || 0;
  const what = { damage: `${v} damage`, shield: `${v} shield`, heal: `${v} healing`, gold: `${v} gold`, all: `${v} damage, shield and healing`, none: '' }[B.does];
  return `<div class="info-head">${img(B.art, 44)}<div class="txt"><b>${B.name} x${run.bag[t] || 0}${lv ? ` <span class="lv">+${lv}</span>` : ''}</b><span class="muted" style="font-size:14px">Each fires for ${what}.</span></div></div>`;
}
function bagSheet() {
  const run = app.run, H = HEROES[run.hero];
  openSheet(`<div class="info-head">${img(H.art, 64)}<div class="txt"><b style="font-size:20px">${H.name}</b>
      <span class="muted">${run.hp} / ${run.maxHp} HP, ${run.gold} gold</span></div></div>
    <div class="label">Block bag</div>
    <div class="list">${Object.keys(run.bag).map(t => blockLine(run, t)).join('')}</div>
    <div class="label">Special</div>
    <div class="info-head">${img(H.special.art, 48)}<div class="txt"><b>${H.special.name}</b><span class="muted" style="font-size:14px">${esc(H.special.desc)} Charges by clearing ${specialNeed(run)} lines.</span></div></div>
    <button class="btn ghost block" data-close>Close</button>`);
  bindClose();
}

/* ---------- enemy ---------- */
export function enemySheet(run) {
  const e = run.combat.enemy, E = ENEMIES[e.id];
  const moves = E.moves.map(m => {
    const d = ATTACKS.has(m.k) ? (m.k === 'breath' ? '' : m.v + e.rage) : 0;
    return `<div class="info-head">${img('i_' + m.k, 34)}<div class="txt"><b>${MOVES[m.k].name}</b><span class="muted" style="font-size:14px">${esc(MOVES[m.k].desc(m, d || m.v))} Takes ${m.t} moves.</span></div></div>`;
  }).join('');
  openSheet(`<div class="info-head">${img(E.art, 72)}<div class="txt"><b style="font-size:20px">${esc(E.name)}</b><span class="muted">${e.hp} / ${e.maxHp} HP${e.armor ? `, ${e.armor} armor` : ''}${e.rage ? `, +${e.rage} damage` : ''}</span></div></div>
    <div class="label">Moves, in order</div><div class="list">${moves}</div>
    ${E.enrage ? `<p class="muted" style="font-size:14px">At half health it becomes enraged and its attacks deal +${E.enrage}.</p>` : ''}
    <button class="btn ghost block" data-close>Close</button>`);
  bindClose();
}

/* ---------- settings ---------- */
export function settingsSheet() {
  const s = app.settings, inRun = !!app.run;
  const tog = (k, label) => `<div class="setting"><span>${label}</span><button class="toggle ${s[k] ? 'on' : ''}" data-tog="${k}" aria-pressed="${!!s[k]}" aria-label="${label}"></button></div>`;
  const panel = openSheet(`<h2 class="display">Settings</h2>
    <div class="setting"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-vol="music" aria-label="Music volume"></div>
    <div class="setting"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-vol="sfx" aria-label="Sound effects volume"></div>
    ${'vibrate' in navigator ? tog('vibrate', 'Vibration') : ''}${tog('shake', 'Screen shake')}${tog('motion', 'Reduce motion')}${tog('fast', 'Fast animations')}
    <button class="btn ghost block small" data-act="howto">How to play</button>
    ${inRun ? '<button class="btn red block small" data-act="abandon">Abandon run</button>' : ''}
    <button class="btn ghost block small" data-act="reset">Erase all data</button>
    <button class="btn block" data-close>Done</button>`);
  bindClose();
  panel.querySelectorAll('[data-vol]').forEach(r => r.oninput = () => { s[r.dataset.vol] = +r.value; applySettings(); });
  on(panel, '[data-tog]', el => { const k = el.dataset.tog; s[k] = !s[k]; el.classList.toggle('on', s[k]); el.setAttribute('aria-pressed', s[k]); applySettings(); sfx('tap'); });
  on(panel, '[data-act]', el => {
    const a = el.dataset.act;
    if (a === 'howto') return howToSheet();
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Tap again to confirm'; sfx('invalid'); return; }
    closeSheet();
    if (a === 'abandon') { app.run.over = 'lose'; recordRun(app.run); app.run = null; go('title'); }
    if (a === 'reset') { store.reset(); app.run = null; app.settings = store.settings(); applySettings(); go('title'); }
  });
}

export function howToSheet() {
  const step = (art, html) => `<div class="step">${img(art, 40)}<span>${html}</span></div>`;
  openSheet(`<h2 class="display">How to play</h2><div class="howto">
    ${step('b_sword', '<b>Drag pieces onto the grid.</b> Tap a piece to rotate it.')}
    ${step('ui_logo', '<b>Fill a whole row or column</b> to clear it. Every block in it fires: swords deal damage, shields block, hearts heal and coins pay gold.')}
    ${step('ui_charge', '<b>Clear several lines at once</b> to multiply everything, and clear on back-to-back moves to build a combo.')}
    ${step('i_atk', '<b>Enemies act on a countdown.</b> Each piece you place is one move. The pips show how soon the next move lands.')}
    ${step('ui_shield', '<b>Shield soaks damage.</b> Half of any leftover shield fades each time the enemy acts.')}
    ${step('b_rubble', '<b>Stash a piece</b> by dragging it into the Stash slot. If nothing fits, the ceiling caves in and hurts you.')}
    ${step('s_meteor', '<b>Cleared lines charge your special.</b> Tap it when it glows.')}
    </div><button class="btn block" data-close>Got it</button>`);
  bindClose();
}

function bindClose() { document.querySelectorAll('#sheet [data-close]').forEach(b => b.onclick = () => { sfx('tap'); closeSheet(); }); }
