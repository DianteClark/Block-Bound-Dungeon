/* Every non-combat screen and the flow between rooms. */
import { img } from '../art/index.js';
import { $, esc, on, mount, toast, banner, openSheet, closeSheet } from './dom.js';
import { app, go, register, save, sfx, recordRun } from './app.js';
import { renderRunbar, relicSheet, howToSheet, settingsSheet, blockLine, RARITY } from './sheets.js';
import { store } from '../core/store.js';
import { Sound } from '../audio/audio.js';
import { newSeed } from '../core/rng.js';
import { HEROES, HERO_ORDER } from '../data/heroes.js';
import { RELICS } from '../data/relics.js';
import { POTIONS } from '../data/potions.js';
import { BLOCKS } from '../data/blocks.js';
import { EVENTS } from '../data/events.js';
import { ENEMIES, FLOOR_INFO } from '../data/enemies.js';
import { MAP_ROWS, FLOORS, MAX_BLOCK_LEVEL } from '../data/rules.js';
import { blockValue } from '../engine/stats.js';
import { newRun, availableNodes, enterNode, leaveRoom, claimReward, skipReward, openTreasure, rest, train, buy, removeBlock, removePrice, bagSize, chooseEventOption, eventOptionOk, upgradeBlock, upgradable, canTakePotion } from '../engine/run.js';
import { BAG_MIN, REST_HEAL } from '../data/rules.js';

const ROOM_ART = { combat: 'room_combat', elite: 'room_elite', boss: 'room_boss', rest: 'room_rest', shop: 'room_shop', treasure: 'room_treasure', event: 'room_event' };
const ROOM_NAME = { combat: 'Fight', elite: 'Elite', boss: 'Boss', rest: 'Campfire', shop: 'Merchant', treasure: 'Treasure', event: 'Mystery' };

/* ---------- title ---------- */
register('title', () => {
  app.run = app.run || store.run();
  $('#runbar').hidden = true;
  document.body.dataset.floor = '';
  const run = app.run, rec = store.records();
  const root = mount(`<div class="title">
      <div class="logo">${img('ui_logo', 110)}<h1 class="display">Block Bound<span>Dungeon</span></h1></div>
      <div class="heroes">${HERO_ORDER.map(h => img(HEROES[h].art, 74)).join('')}</div>
      <div class="menu stagger">
        ${run ? `<button class="btn block" data-act="continue">Continue: ${HEROES[run.hero].name}, floor ${run.floor}</button>` : ''}
        <button class="btn block ${run ? 'ghost' : ''}" data-act="new">New Run</button>
        <div class="foot">
          <button class="btn ghost small" data-act="howto">How to play</button>
          <button class="btn ghost small" data-act="settings">Settings</button>
        </div>
        ${rec.runs ? `<p class="sub num">${rec.wins} ${rec.wins === 1 ? 'win' : 'wins'} in ${rec.runs} ${rec.runs === 1 ? 'run' : 'runs'}. Deepest floor: ${rec.bestFloor}.</p>` : ''}
      </div></div>`);
  music('title');
  on(root, '[data-act]', el => {
    sfx('tap');
    const a = el.dataset.act;
    if (a === 'continue') return resume();
    if (a === 'new') return go('heroes');
    if (a === 'howto') return howToSheet();
    if (a === 'settings') return settingsSheet();
  });
});

function resume() {
  const run = app.run;
  if (!run.room) return go('map');
  openRoom();
}

/* ---------- hero select ---------- */
register('heroes', (sel = store.get('hero', 'knight')) => {
  $('#runbar').hidden = true;
  const H = HEROES[sel], rec = store.records().heroes[sel];
  const R = RELICS[H.relic];
  const root = mount(`<div class="scroll">
      <h2 class="display h-screen">Choose your hero</h2>
      ${app.run ? '<p class="sub">Starting a new run replaces your saved one.</p>' : ''}
      <div class="hero-tabs">${HERO_ORDER.map(h => `<button class="hero-tab ${h === sel ? 'on' : ''}" data-hero="${h}">${img(HEROES[h].art, 60)}${HEROES[h].name}</button>`).join('')}</div>
      <div class="card pad hero-card enter" key="${sel}">
        <div class="hero-top">${img(H.art, 86)}<div><h2 class="display">${H.name}</h2>
          <div class="stats"><span class="pill num">${img('ui_heart', 22)}${H.hp}</span><span class="pill num">${img('ui_coin', 22)}${H.gold}</span>
          ${rec ? `<span class="pill num">${img('ui_trophy', 22)}${rec.wins}/${rec.runs}</span>` : ''}</div></div></div>
        <p>${esc(H.blurb)}</p>
        <div class="kit">${img(R.art, 48)}<div class="txt"><b>${esc(R.name)}</b>${esc(R.desc)}</div></div>
        <div class="kit">${img(H.special.art, 48)}<div class="txt"><b>Special: ${esc(H.special.name)}</b>${esc(H.special.desc)} Charges after ${H.special.need} cleared lines.</div></div>
        <div class="label">Block bag</div>
        <div class="bagrow">${Object.entries(H.bag).map(([t, n]) => `<span class="bagchip">${img(BLOCKS[t].art, 30)}x${n}</span>`).join('')}</div>
        <div class="kit">${img(POTIONS[H.potions[0]].art, 40)}<div class="txt"><b>Starts with: ${esc(POTIONS[H.potions[0]].name)}</b>${esc(POTIONS[H.potions[0]].desc)}</div></div>
      </div>
      <button class="btn block" data-act="start">Descend as the ${H.name}</button>
      <button class="btn ghost block small" data-act="back">Back</button>
    </div>`);
  on(root, '[data-hero]', el => { sfx('pick'); go('heroes', el.dataset.hero); });
  on(root, '[data-act]', el => {
    sfx('tap');
    if (el.dataset.act === 'back') return go('title');
    store.set('hero', sel);
    app.run = newRun(sel, newSeed());
    save();
    sfx('door');
    go('map', true);
  });
});

/* ---------- map ---------- */
register('map', (fresh = false) => {
  const run = app.run;
  renderRunbar();
  music('map');
  const rows = run.map, open = availableNodes(run);
  const done = new Set(run.path.map(([r, i]) => `${r}:${i}`));
  const last = run.path[run.path.length - 1];
  const rowH = 96, H = rowH * (MAP_ROWS - 1) + 120;
  const pos = (r, i) => [rows[r][i].x * 100, H - 60 - r * rowH];
  let lines = '';
  rows.forEach((row, r) => row.forEach((n, i) => n.next.forEach(j => {
    const [x1, y1] = pos(r, i), [x2, y2] = pos(r + 1, j);
    const walked = done.has(`${r}:${i}`) && done.has(`${r + 1}:${j}`);
    const live = last ? (last[0] === r && last[1] === i && open.includes(j)) : false;
    lines += `<line x1="${x1}%" y1="${y1}" x2="${x2}%" y2="${y2}" stroke="${walked ? '#ffc93c' : live ? '#e8d5a8' : '#4d3e60'}" stroke-width="${walked ? 6 : 4}" stroke-linecap="round" ${walked ? '' : 'stroke-dasharray="2 12"'}/>`;
  })));
  const nodes = rows.map((row, r) => row.map((n, i) => {
    const [x, y] = pos(r, i);
    const isOpen = r === run.path.length && open.includes(i), isDone = done.has(`${r}:${i}`);
    const here = last && last[0] === r && last[1] === i;
    const art = n.t === 'boss' ? ENEMIES[run.boss].art : ROOM_ART[n.t];
    const cls = ['node', n.t === 'boss' ? 'boss' : '', isOpen ? 'open' : '', isDone ? 'done' : '', here ? 'here' : '', !isOpen && !isDone ? 'locked' : ''].join(' ');
    return `<button class="${cls}" style="left:${x}%;top:${y}px" data-node="${i}" data-row="${r}" aria-label="${ROOM_NAME[n.t]}" ${isOpen ? '' : 'tabindex="-1"'}>${img(art, n.t === 'boss' ? 80 : 44)}</button>`;
  }).join('')).join('');
  const F = FLOOR_INFO[run.floor - 1];
  const root = mount(`<div class="mapwrap" id="mapwrap">
      <div class="maphead"><div class="label">Floor ${run.floor} of ${FLOORS}</div><h2 class="display">${esc(F.name)}</h2></div>
      <div class="map" style="height:${H}px"><svg class="paths" aria-hidden="true">${lines}</svg>${nodes}</div>
      <div class="legend">${['combat', 'elite', 'event', 'shop', 'treasure', 'rest'].map(t => `<span>${img(ROOM_ART[t], 22)}${ROOM_NAME[t]}</span>`).join('')}</div>
    </div>`);
  const wrap = $('#mapwrap');
  requestAnimationFrame(() => {
    const target = root.querySelector('.node.open') || root.querySelector('.node.here');
    if (target) wrap.scrollTop = Math.max(0, target.offsetTop + 60 - wrap.clientHeight / 2);
  });
  if (fresh) banner(`Floor ${run.floor}`, F.name, 1800);
  on(root, '.node.open', el => {
    const i = +el.dataset.node;
    if (!enterNode(run, i)) return;
    sfx('step');
    save();
    openRoom();
  });
  on(root, '.node.locked, .node.done', el => {
    const n = rows[+el.dataset.row][+el.dataset.node];
    if (n.t === 'boss') { const B = ENEMIES[run.boss]; toast(`<b>${esc(B.name)}</b> waits at the bottom of this floor.`, B.art); }
    else toast(`<b>${ROOM_NAME[n.t]}</b>`, ROOM_ART[n.t], 1400);
  });
});

/** Open whatever room the run is standing in. */
export function openRoom() {
  const run = app.run, R = run.room;
  if (!R) return go('map');
  if (R.reward) return go('reward');
  if (run.combat) return go('combat');
  ({ shop: () => go('shop'), rest: () => go('rest'), event: () => go('event'), treasure: () => go('treasure') })[R.t]();
}

/** Finish the room and move on: next floor, victory, or back to the map. */
export function finishRoom() {
  const run = app.run, floor = run.floor;
  leaveRoom(run);
  if (run.over === 'win') return endRun();
  save();
  go('map', run.floor !== floor);
}

export function endRun() {
  recordRun(app.run);
  go('end');
}

/* ---------- reward ---------- */
function choiceHTML(ch, i) {
  if (ch.k === 'relic') {
    const R = RELICS[ch.id];
    return `<button class="choice ${R.rarity === 3 ? 'rare' : ''}" data-pick="${i}">${img(R.art, 56)}<div class="txt"><span class="tag r${R.rarity}">${RARITY[R.rarity]} relic</span><span class="name">${esc(R.name)}</span><span class="desc">${esc(R.desc)}</span></div></button>`;
  }
  if (ch.k === 'upgrade') {
    const B = BLOCKS[ch.id], run = app.run, v = blockValue(run, ch.id);
    return `<button class="choice" data-pick="${i}">${img(B.art, 56)}<div class="txt"><span class="tag" style="color:var(--green)">Upgrade</span><span class="name">${B.name} blocks +1</span><span class="desc">Each ${B.name.toLowerCase()} block fires for ${v + 1} instead of ${v}.</span></div></button>`;
  }
  if (ch.k === 'potion') {
    const P = POTIONS[ch.id], full = !canTakePotion(app.run);
    return `<button class="choice" data-pick="${i}" ${full ? 'disabled' : ''}>${img(P.art, 56)}<div class="txt"><span class="tag" style="color:#ff9fc4">Potion</span><span class="name">${esc(P.name)}</span><span class="desc">${full ? 'Your potion belt is full.' : esc(P.desc)}</span></div></button>`;
  }
  return `<button class="choice" data-pick="${i}">${img('ui_heart', 56)}<div class="txt"><span class="tag" style="color:var(--red)">Vitality</span><span class="name">+${ch.v} max HP</span><span class="desc">Raise your max HP and heal by the same amount.</span></div></button>`;
}

register('reward', () => {
  const run = app.run, R = run.room.reward, kind = run.room.t;
  renderRunbar();
  if (R.done) return finishRoom();
  const title = kind === 'boss' ? 'Boss defeated!' : kind === 'elite' ? 'Elite defeated!' : 'Victory!';
  const root = mount(`<div class="scroll stagger">
      <h2 class="display h-screen">${title}</h2>
      <div class="loot"><span class="pill num">${img('ui_coin', 24)}+${R.gold} gold</span>${R.healed ? `<span class="pill num">${img('ui_heart', 24)}+${R.healed} HP</span>` : ''}</div>
      ${R.flawless || R.overkill ? `<p class="sub">${[R.flawless ? `Flawless, no damage taken: +${R.flawless} gold` : '', R.overkill ? `Overkill: +${R.overkill} gold` : ''].filter(Boolean).join('. ')}</p>` : ''}
      <div class="label" style="text-align:center">Choose one</div>
      ${R.choices.map(choiceHTML).join('')}
      <button class="btn ghost block small" data-skip>Skip</button>
    </div>`);
  on(root, '[data-pick]', el => {
    const ch = R.choices[+el.dataset.pick];
    if (!claimReward(run, +el.dataset.pick)) return sfx('invalid');
    sfx(ch.k === 'relic' ? 'relic' : ch.k === 'potion' ? 'potion' : 'heal');
    if (ch.k === 'relic') toast(`<b>${esc(RELICS[ch.id].name)}</b> ${esc(RELICS[ch.id].desc)}`, RELICS[ch.id].art);
    finishRoom();
  });
  on(root, '[data-skip]', () => { sfx('tap'); skipReward(run); finishRoom(); });
});

/* ---------- treasure ---------- */
register('treasure', () => {
  const run = app.run, T = run.room.treasure;
  renderRunbar();
  music('map');
  const R = T.relic && RELICS[T.relic];
  const root = mount(`<div class="scroll stagger">
      <div class="scene">${img(T.done ? 'o_open' : 'room_treasure', 120)}<h2 class="display h-screen">Treasure</h2><p>${T.done ? 'You pocket everything inside.' : 'An old chest, untouched by the monsters.'}</p></div>
      ${T.done ? `<div class="loot"><span class="pill num">${img('ui_coin', 24)}+${T.gold} gold</span></div>${R ? `<div class="card pad">${relicRowFor(T.relic)}</div>` : ''}
        <button class="btn block" data-act="leave">Continue</button>`
      : `<button class="btn block" data-act="open">Open the chest</button>`}
    </div>`);
  on(root, '[data-act]', el => {
    if (el.dataset.act === 'open') { openTreasure(run); sfx('relic'); save(); go('treasure'); }
    else { sfx('tap'); finishRoom(); }
  });
});
function relicRowFor(id) {
  const R = RELICS[id];
  return `<div class="info-head">${img(R.art, 56)}<div class="txt"><b>${esc(R.name)} <span class="rtag r${R.rarity}">${RARITY[R.rarity]}</span></b><span class="muted" style="font-size:14px">${esc(R.desc)}</span></div></div>`;
}

/* ---------- shop ---------- */
register('shop', () => {
  const run = app.run, S = run.room.shop;
  renderRunbar();
  music('shop');
  const item = (it, i) => {
    const art = it.k === 'relic' ? RELICS[it.id].art : POTIONS[it.id].art;
    const name = it.k === 'relic' ? RELICS[it.id].name : POTIONS[it.id].name;
    const desc = it.k === 'relic' ? RELICS[it.id].desc : POTIONS[it.id].desc;
    const tag = it.k === 'relic' ? `<span class="tag r${RELICS[it.id].rarity}">${RARITY[RELICS[it.id].rarity]} relic</span>` : '<span class="tag" style="color:#ff9fc4">Potion</span>';
    const cant = it.sold || run.gold < it.price || (it.k === 'potion' && !canTakePotion(run));
    return `<button class="choice ${it.sold ? 'sold' : ''}" data-buy="${i}" ${cant && !it.sold ? 'aria-disabled="true"' : ''}>${img(art, 52)}<div class="txt">${tag}<span class="name">${esc(name)}</span><span class="desc">${esc(desc)}</span></div>
      <span class="price num ${!it.sold && run.gold < it.price ? 'short' : ''}">${it.sold ? 'Sold' : img('ui_coin', 20) + it.price}</span></button>`;
  };
  const rp = removePrice(run), canRemove = !S.removed && run.gold >= rp && bagSize(run) > BAG_MIN;
  const root = mount(`<div class="scroll">
      <div class="scene">${img('room_shop', 84)}<h2 class="display h-screen">Merchant</h2><p>"Everything's for sale, adventurer."</p></div>
      <div class="section-title label">Relics</div>
      <div class="list stagger">${S.items.map((it, i) => it.k === 'relic' ? item(it, i) : '').join('')}</div>
      <div class="section-title label">Potions</div>
      <div class="list stagger">${S.items.map((it, i) => it.k === 'potion' ? item(it, i) : '').join('')}</div>
      <div class="section-title label">Services</div>
      <button class="choice ${S.removed ? 'sold' : ''}" data-act="remove">${img('ui_trash', 52)}<div class="txt"><span class="name">Remove a block</span><span class="desc">Take one block out of your bag so the others come up more often.</span></div>
        <span class="price num ${!S.removed && run.gold < rp ? 'short' : ''}">${S.removed ? 'Done' : img('ui_coin', 20) + rp}</span></button>
      <button class="btn block" data-act="leave">Leave</button>
    </div>`);
  on(root, '[data-buy]', el => {
    const it = S.items[+el.dataset.buy];
    if (!buy(run, +el.dataset.buy)) {
      sfx('invalid');
      if (run.gold < it.price) toast('Not enough gold.', 'ui_coin', 1400);
      else if (it.k === 'potion') toast('Your potion belt is full.', 'p_health', 1400);
      return;
    }
    sfx('buy'); save();
    if (it.k === 'relic') toast(`<b>${esc(RELICS[it.id].name)}</b> ${esc(RELICS[it.id].desc)}`, RELICS[it.id].art);
    go('shop');
  });
  on(root, '[data-act]', el => {
    if (el.dataset.act === 'leave') { sfx('door'); return finishRoom(); }
    if (S.removed) return;
    if (!canRemove) { sfx('invalid'); return toast(run.gold < rp ? 'Not enough gold.' : `Your bag needs at least ${BAG_MIN} blocks.`, 'ui_bag', 1600); }
    sfx('tap');
    pickBlock('Remove a block', 'Choose a block type to take one out of your bag.', Object.keys(run.bag), t => {
      if (removeBlock(run, t)) { sfx('buy'); save(); }
      go('shop');
    });
  });
});

/** Bottom sheet listing block types to choose from. */
function pickBlock(title, sub, types, done) {
  const run = app.run;
  const panel = openSheet(`<h2 class="display">${title}</h2><p class="muted">${sub}</p>
    <div class="list">${types.map(t => `<button class="choice" data-type="${t}">${blockLine(run, t).replace('class="info-head"', 'class="info-head" style="flex:1"')}</button>`).join('')}</div>
    <button class="btn ghost block small" data-cancel>Cancel</button>`);
  on(panel, '[data-type]', el => { closeSheet(); done(el.dataset.type); });
  on(panel, '[data-cancel]', () => { sfx('tap'); closeSheet(); });
}

/* ---------- campfire ---------- */
register('rest', () => {
  const run = app.run, R = run.room;
  renderRunbar();
  music('camp');
  const healAmt = Math.min(run.maxHp - run.hp, Math.round(run.maxHp * REST_HEAL));
  const up = upgradable(run);
  const root = mount(`<div class="scroll stagger">
      <div class="scene">${img('room_rest', 120)}<h2 class="display h-screen">Campfire</h2><p>${R.done ? 'You feel ready to move on.' : 'A moment of quiet. Rest, or sharpen your craft.'}</p></div>
      ${R.done ? '<button class="btn block" data-act="leave">Continue</button>' : `
      <button class="choice" data-act="rest">${img('ui_heart', 56)}<div class="txt"><span class="name">Rest</span><span class="desc">Heal ${healAmt} HP (30% of your max).</span></div></button>
      <button class="choice" data-act="train" ${up.length ? '' : 'disabled'}>${img('ui_up', 56)}<div class="txt"><span class="name">Train</span><span class="desc">${up.length ? 'Upgrade a block type: each of those blocks fires for 1 more.' : `All your block types are at the max level (+${MAX_BLOCK_LEVEL}).`}</span></div></button>`}
    </div>`);
  on(root, '[data-act]', el => {
    const a = el.dataset.act;
    if (a === 'leave') { sfx('tap'); return finishRoom(); }
    if (a === 'rest') { const n = rest(run); sfx('heal'); save(); toast(`You rest by the fire. <b>+${n} HP</b>`, 'ui_heart'); return go('rest'); }
    pickBlock('Train', 'Choose a block type to upgrade.', up, t => {
      if (train(run, t)) { sfx('relic'); save(); toast(`<b>${BLOCKS[t].name} blocks</b> now fire for ${blockValue(run, t)}.`, BLOCKS[t].art); }
      go('rest');
    });
  });
});

/* ---------- event ---------- */
register('event', (result) => {
  const run = app.run, E = EVENTS[run.room.event];
  renderRunbar();
  music('map');
  const opts = E.options.map((o, i) => {
    const ok = eventOptionOk(run, o);
    return `<button class="choice" data-opt="${i}" ${ok ? '' : 'disabled'}>${img(o.art, 52)}<div class="txt"><span class="name">${esc(o.label)}</span><span class="desc">${esc(o.text)}</span></div></button>`;
  }).join('');
  const root = mount(`<div class="scroll stagger">
      <div class="scene">${img(E.art, 120)}<h2 class="display h-screen">${esc(E.title)}</h2><p>${esc(E.text)}</p></div>
      ${run.room.done ? `<div class="card pad" style="text-align:center">${esc(result && result.say ? result.say : 'You move on.')}</div>
        ${result && result.relic ? `<div class="card pad">${relicRowFor(result.relic)}</div>` : ''}
        <button class="btn block" data-act="leave">Continue</button>` : opts}
    </div>`);
  on(root, '[data-opt]', el => {
    const res = chooseEventOption(run, +el.dataset.opt);
    if (!res) return sfx('invalid');
    sfx(res.relic ? 'relic' : 'tap');
    save();
    if (res.choose === 'upgrade') {
      return pickBlock('Hone a block', 'Choose a block type to upgrade.', upgradable(run), t => {
        upgradeBlock(run, t); sfx('relic'); save();
        go('event', { say: `${BLOCKS[t].name} blocks now fire for ${blockValue(run, t)}.` });
      });
    }
    go('event', res);
  });
  on(root, '[data-act]', () => { sfx('tap'); finishRoom(); });
});

/* ---------- end of run ---------- */
register('end', () => {
  const run = app.run, won = run.over === 'win', S = run.stats, H = HEROES[run.hero];
  $('#runbar').hidden = true;
  document.body.classList.remove('danger');
  music(null);
  const root = mount(`<div class="scroll stagger">
      <div class="scene">${img(won ? 'ui_trophy' : H.art, 120)}<h2 class="display h-screen" style="color:${won ? 'var(--gold)' : 'var(--red)'}">${won ? 'Victory!' : 'Defeated'}</h2>
        <p>${won ? `The ${H.name} conquered all five floors of the dungeon.` : `The ${H.name} fell on floor ${run.floor}, ${esc(FLOOR_INFO[run.floor - 1].name)}.`}</p></div>
      <div class="end-stats">
        <div class="card stat"><b class="num">${S.kills}</b><small>Monsters slain</small></div>
        <div class="card stat"><b class="num">${S.damage}</b><small>Damage dealt</small></div>
        <div class="card stat"><b class="num">${S.lines}</b><small>Lines cleared</small></div>
        <div class="card stat"><b class="num">${S.bestHit}</b><small>Biggest hit</small></div>
      </div>
      <div class="label" style="text-align:center">Relics</div>
      <div class="relic-grid">${run.relics.map(id => `<button data-relic="${id}" aria-label="${esc(RELICS[id].name)}">${img(RELICS[id].art, 44)}</button>`).join('')}</div>
      <button class="btn block" data-act="again">New Run</button>
      <button class="btn ghost block small" data-act="title">Title screen</button>
    </div>`);
  on(root, '[data-relic]', el => relicSheet(el.dataset.relic));
  on(root, '[data-act]', el => { sfx('tap'); app.run = null; go(el.dataset.act === 'again' ? 'heroes' : 'title'); });
});

export function music(name) { Sound.music(name, app.run ? app.run.floor : 1); }
