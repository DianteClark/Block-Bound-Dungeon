/* Block Bound Dungeon — game logic. Art: art.js. Audio: audio.js. */
'use strict';

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick = a => a[Math.floor(Math.random()*a.length)];
const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const fmt = x => (Math.round(x*100)/100).toString();
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
function weighted(entries){
  const total = entries.reduce((s,e)=>s+e[1],0); let r = Math.random()*total;
  for(const [it,w] of entries){ if((r-=w) < 0) return it; }
  return entries[entries.length-1][0];
}
const store = {
  get(k,d){ try{ const v = localStorage.getItem('bbd_'+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ if(v==null) localStorage.removeItem('bbd_'+k); else localStorage.setItem('bbd_'+k, JSON.stringify(v)); }catch(e){} },
};
const settings = Object.assign({music:0.5, sfx:0.7, shake:true, flash:true, vibrate:true}, store.get('settings', {}));
Sound.setVolume('music', settings.music); Sound.setVolume('sfx', settings.sfx);
const sfx = (n,...a) => Sound.play(n,...a);

let toastTimer;
function toast(html, icon, ms=2400){
  const t = $('#toast'); t.innerHTML = (icon?img(icon,36):'') + `<div>${html}</div>`;
  t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('on'), ms);
}
function floatText(el, text, color, big){
  if(!el) return;
  const r = el.getBoundingClientRect(); if(!r.width && !r.height) return;
  const f = document.createElement('div');
  f.className = 'float'+(big?' big':''); f.textContent = text; if(color) f.style.color = color;
  f.style.left = (r.left + r.width/2 + rand(-24,24))+'px'; f.style.top = (r.top + r.height/2 + rand(-8,8))+'px';
  document.body.appendChild(f); setTimeout(()=>f.remove(), 1100);
}
function bump(el, cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function shake(){ if(settings.shake) bump($('#app'),'shake'); }
function flash(color){ if(!settings.flash) return; const f=$('#flash'); f.style.background=color; bump(f,'on'); }
function buzz(ms){ if(settings.vibrate) Sound.vibrate(ms); }
function banner(title, sub, ms=2000){
  const b = $('#banner'); b.hidden = false; b.innerHTML = `<div class="b"><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div>`;
  sfx('whoosh'); clearTimeout(banner.t); banner.t = setTimeout(()=>{ b.hidden = true; }, ms);
}
/* animated number text */
function tween(el, to){
  if(!el) return; const from = +(el.dataset.v ?? to); el.dataset.v = to;
  if(from===to){ el.textContent = to; return; }
  const t0 = performance.now(), dur = 420;
  const step = now => { const k = Math.min(1,(now-t0)/dur), e = 1-Math.pow(1-k,3); el.textContent = Math.round(from+(to-from)*e); if(k<1 && +el.dataset.v===to) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ================= data ================= */
const N = 8;
const TYPES = {
  sword:  {c:'#ef5258', d:'#8f2227', l:'#ffa3a6', name:'Sword'},
  shield: {c:'#4a98ff', d:'#1c4c99', l:'#a8ceff', name:'Shield'},
  heal:   {c:'#45c674', d:'#1d6b3a', l:'#9cf0b9', name:'Heart'},
  coin:   {c:'#f7c936', d:'#9a740a', l:'#fff0a8', name:'Coin'},
  rainbow:{c:'#c77dff', d:'#6a2c9e', l:'#f0d6ff', name:'Rainbow'},
  venom:  {c:'#a259e6', d:'#4f1f78', l:'#dcb6ff', name:'Venom'},
  blast:  {c:'#ff7a2f', d:'#a8400a', l:'#ffc49a', name:'Blast'},
  stone:  {c:'#736b7f', d:'#38333f', l:'#a69eb2', name:'Rubble'},
  ice:    {c:'#a6def4', d:'#4f8fb0', l:'#f0fbff', name:'Ice'},
};
const JUNK = t => t==='stone' || t==='ice';
const SHAPE_SRC = [
  ['#'], ['##'], ['###'], ['####'], ['#####'],
  ['##','##'], ['###','###','###'], ['###','###'],
  ['##','#.'], ['###','#..','#..'],
  ['###','.#.'], ['##.','.##'], ['.##','##.'],
  ['#..','###'], ['..#','###'],
  ['.#.','###','.#.'],
];
function mkShape(rows){
  const cells=[]; rows.forEach((row,r)=>[...row].forEach((ch,c)=>{ if(ch==='#') cells.push([r,c]); }));
  return {cells, h:rows.length, w:Math.max(...rows.map(r=>r.length))};
}
const SHAPES = SHAPE_SRC.map(mkShape);
function rotated(p){ return {cells: p.cells.map(([r,c])=>[c, p.h-1-r]), h:p.w, w:p.h}; }

const CLASSES = {
  knight:{name:'Knight', spr:'knight', hp:66, gold:20, relic:'oath', potions:['iron'],
    desc:'Sturdy and patient. Shields hit harder and every fight starts behind a wall.',
    ult:{name:'Bulwark', need:8, spr:'oath', desc:'Gain a big shield and smash all rubble and ice off the grid.'}},
  rogue:{name:'Rogue', spr:'rogue', hp:62, gold:45, relic:'daggers', potions:['fire','smoke'],
    desc:'Lives on momentum. Combo streaks grow twice as fast and coins pay extra.',
    ult:{name:'Shadowstep', need:7, spr:'daggers', desc:'Fresh hand, the enemy loses a turn, and your next clear is doubled.'}},
  mage:{name:'Mage', spr:'mage', hp:52, gold:20, relic:'orb', potions:['health'],
    desc:'Fragile but explosive. Rainbow blocks appear and big clears detonate.',
    ult:{name:'Meteor', need:9, spr:'potion_fire', desc:'Detonate the fullest row and column at x2.5, even if they are not full.'}},
  berserker:{name:'Berserker', spr:'berserker', hp:80, gold:25, relic:'bloodlust', potions:['fire'],
    desc:'Gets deadlier the more he bleeds. Swords grow stronger as your HP drops.',
    ult:{name:'Rampage', need:7, spr:'bloodaxe', desc:'Smash the two fullest rows at x3, even if they are not full. Costs 5 HP.'},
    unlock:{text:'Reach floor 3', cost:120, ok:s=>s.bestFloor>=3}},
  necromancer:{name:'Necromancer', spr:'necromancer', hp:56, gold:30, relic:'gravetome', potions:['venom'],
    desc:'Rots enemies from the inside. Venom blocks appear and poison never wears off.',
    ult:{name:'Raise Dead', need:7, spr:'gravetome', desc:'Turn all rubble and ice into Venom blocks and poison the enemy.'},
    unlock:{text:'Defeat 60 foes in total', cost:150, ok:s=>s.kills>=60}},
  alchemist:{name:'Alchemist', spr:'alchemist', hp:60, gold:35, relic:'philflask', potions:['health','bomb'],
    desc:'Never short on supplies. An extra potion slot and a fresh brew after every fight.',
    ult:{name:'Transmute', need:6, spr:'philflask', desc:'Turn every block of the most common type on the grid into Rainbow blocks.'},
    unlock:{text:'Drink 10 potions in total', cost:150, ok:s=>s.potions>=10}},
};
const isUnlocked = id => !CLASSES[id].unlock || !!(store.get('heroes', {})[id]);
function checkHeroUnlocks(){
  const st = stats(), h = store.get('heroes', {}); let any = null;
  Object.entries(CLASSES).forEach(([id,C])=>{ if(C.unlock && !h[id] && C.unlock.ok(st)){ h[id] = 1; any = id; } });
  if(any){ store.set('heroes', h); unlock('roster'); setTimeout(()=>{ sfx('trophy'); toast(`<b>New hero unlocked!</b><br>The ${CLASSES[any].name} joins your party.`, CLASSES[any].spr, 3500); }, 900); }
}
const HEAT = [
  {name:'Normal', desc:'The standard dungeon.'},
  {name:'Heat 1', desc:'Enemies have 15% more HP.'},
  {name:'Heat 2', desc:'Enemies also deal 15% more damage.'},
  {name:'Heat 3', desc:'You also start with 10 less max HP.'},
  {name:'Heat 4', desc:'Elites also gain a random passive.'},
  {name:'Heat 5', desc:'Bosses also have 25% more HP.'},
];

const RELICS = {
  oath:{name:'Oath Shield', spr:'oath', desc:'Shield blocks give +1. Start every fight with 6 shield.', r:0, starter:true},
  daggers:{name:'Twin Daggers', spr:'daggers', desc:'Combo streaks build twice as fast. Coin blocks give +1 gold.', r:0, starter:true},
  orb:{name:'Arcane Orb', spr:'orb', desc:'Rainbow blocks appear. Clearing 3+ lines at once deals +8 damage.', r:0, starter:true},
  whetstone:{name:'Whetstone', spr:'whetstone', desc:'Sword blocks deal +1 damage.', r:1},
  tower:{name:'Tower Shield', spr:'shield', desc:'Shield blocks give +1 shield.', r:1},
  fang:{name:'Vampire Fang', spr:'fang', desc:'Heal 2 for every line you clear.', r:1},
  idol:{name:'Golden Idol', spr:'idol', desc:'Coin blocks give +1 extra gold.', r:1},
  chainmail:{name:'Chainmail', spr:'chainmail', desc:'Start every fight with 8 shield.', r:1},
  thickskin:{name:'Turtle Shell', spr:'turtle', desc:'Take 1 less damage from every hit.', r:1},
  feather:{name:'Feather Charm', spr:'feather', desc:'Small pieces show up far more often.', r:1},
  magnet:{name:'Gold Magnet', spr:'magnet', desc:'+40% gold from fight rewards.', r:1},
  cauldron:{name:'Witch\'s Cauldron', spr:'cauldron', desc:'+1 potion slot. Gain a random potion now.', r:1, onGet(){ run.potionSlots++; givePotion(); }},
  clover:{name:'Lucky Clover', spr:'clover', desc:'Merchant prices are 20% lower.', r:1},
  hearth:{name:'Hearthstone', spr:'r_rest', desc:'Campfires heal 50% more and also give +4 max HP.', r:1},
  powder:{name:'Black Powder', spr:'bomb', desc:'Clearing 3+ lines at once deals +12 damage.', r:2},
  hourglass:{name:'Hourglass', spr:'hourglass', desc:'Enemy actions take 1 extra turn to arrive.', r:2},
  sledge:{name:'Sledgehammer', spr:'hammer', desc:'Cleared rubble and ice deal 4 damage each.', r:2},
  spikes:{name:'Spiked Pauldrons', spr:'spikes', desc:'When an attack hits your shield, deal 5 damage back.', r:2},
  drum:{name:'War Drum', spr:'drum', desc:'Your combo streak never drops below 2 stacks.', r:2},
  crossed:{name:'Crossed Blades', spr:'r_combat', desc:'Clearing a row and a column together deals +8 damage.', r:2},
  dice:{name:'Loaded Dice', spr:'dice', desc:'+1 hand reroll each fight.', r:2},
  toxin:{name:'Toxic Gland', spr:'potion_venom', desc:'Venom blocks appear. Each one poisons the enemy when cleared.', r:2},
  ring:{name:'Ring of Echoes', spr:'ring', desc:'Your first clear each fight has its multiplier doubled.', r:2},
  battery:{name:'Soul Lantern', spr:'flame', desc:'Your hero special charges 50% faster.', r:2},
  satchel:{name:'Bomb Satchel', spr:'satchel', desc:'Blast blocks appear. When cleared they also fire every block around them.', r:2},
  mirror:{name:'Mirror Shield', spr:'mirror', desc:'The first enemy attack each fight is fully blocked.', r:2},
  leech:{name:'Leech Blade', spr:'leech', desc:'Heal 1 HP for every 8 damage you deal with clears.', r:2},
  prism:{name:'Prism Shard', spr:'gem', desc:'Rainbow blocks appear: they slash, block and heal at once.', r:3},
  phoenix:{name:'Phoenix Feather', spr:'phoenix', desc:'The first time you would die, revive at 50% HP.', r:3},
  bloodpact:{name:'Blood Pact', spr:'drop', desc:'Sword blocks deal +2 damage. Lose 10 max HP on pickup.', r:3, onGet(){ run.maxHp=Math.max(10,run.maxHp-10); run.hp=Math.min(run.hp,run.maxHp); }},
  crown:{name:'Miser\'s Crown', spr:'crown', desc:'After each fight, gain 10% interest on your gold (max 15).', r:3},
  purist:{name:'Purity Sigil', spr:'gem', desc:'Pure lines (all one block type) give +1 multiplier instead of +0.5.', r:3},
  scythe:{name:'Reaper\'s Scythe', spr:'axe', desc:'Clears deal 50% more damage to enemies below 30% HP.', r:3},
  bloodlust:{name:'Bloodlust', spr:'bloodaxe', desc:'Sword blocks deal +1 damage for every 20% HP you are missing. Hearts heal 1 less.', r:0, starter:true},
  gravetome:{name:'Grave Tome', spr:'gravetome', desc:'Venom blocks appear. Poison on enemies never wears off.', r:0, starter:true},
  philflask:{name:'Philosopher\'s Flask', spr:'philflask', desc:'+1 potion slot. Brew a random potion after every fight.', r:0, starter:true, onGet(){ run.potionSlots++; }},
  warmcloak:{name:'Warm Cloak', spr:'warmcloak', desc:'Ice shatters completely when cleared instead of leaving rubble.', r:1},
  stoneward:{name:'Stone Ward', spr:'stoneward', desc:'Immune to Petrify: enemies can\'t turn your blocks to stone.', r:2},
  souljar:{name:'Soul Jar', spr:'souljar', desc:'Earn 50% more Soul Shards this run.', r:1},
};

const POTIONS = {
  health:{name:'Health Potion', spr:'potion_health', desc:'Heal 20 HP.', any:true, use(){ const b=run.hp; heal(20); floatText(hpEl(), `+${run.hp-b}`, '#86e6a8'); sfx('heal'); }},
  fire:{name:'Fire Flask', spr:'potion_fire', desc:'Deal 20 damage to the enemy (more on deeper floors).', use(){ flash('rgba(255,120,40,.6)'); damageEnemy(20 + 6*(run.floor-1), true); }},
  iron:{name:'Iron Tonic', spr:'potion_iron', desc:'Gain 15 shield.', use(){ cb.shield += 15; floatText($('#shieldStat'), '+15', '#a8ceff'); sfx('shield'); }},
  smoke:{name:'Smoke Bomb', spr:'potion_smoke', desc:'Draw a fresh hand and delay the enemy by 2 turns.', use(){ dealHand(); cb.enemy.intent.left += 2; }},
  bomb:{name:'Rubble Bomb', spr:'bomb', desc:'Blast every rubble and ice block off the grid. 3 damage each.', use(){
    const set = []; cb.board.forEach((t,i)=>{ if(JUNK(t)) set.push(i); });
    if(!set.length){ toast('No rubble to blast. The fuse fizzles.', 'bomb'); return; }
    const now = performance.now();
    set.forEach(i=>{ shards(i, cb.board[i], 6); cb.fx.push({i,type:cb.board[i],t0:now}); cb.board[i]=null; });
    sfx('blast'); shake(); damageEnemy(3*set.length, true);
  }},
  venom:{name:'Venom Vial', spr:'potion_venom', desc:'Poison the enemy for 8.', use(){ cb.enemy.poison += 8; floatText($('#eArt'), '+8 poison', '#dcb6ff'); sfx('poison'); }},
};

const UPGRADES = {
  sword:{name:'Sharpen', spr:'sword', desc:'Sword blocks deal +1 damage.'},
  shield:{name:'Reinforce', spr:'shield', desc:'Shield blocks give +1 shield.'},
  heal:{name:'Bless', spr:'heart', desc:'Heart blocks heal +1.'},
  coin:{name:'Gild', spr:'coin', desc:'Coin blocks give +1 gold.'},
};
const BOONS = [
  {id:'vital', name:'Vitality', spr:'heart', desc:'+6 max HP and heal 6.', w:3, apply(){ run.maxHp+=6; heal(6); }},
  {id:'mend', name:'Mend', spr:'heal_icon', desc:'Heal 15 HP.', w:3, apply(){ heal(15); }},
  {id:'purse', name:'Coin Purse', spr:'coin', desc:'+25 gold.', w:2, apply(){ run.gold+=25; }},
  {id:'brew', name:'Potion', spr:'potion_health', desc:'Gain a random potion.', w:2, ok:()=>run.potions.length<run.potionSlots, apply(){ givePotion(); }},
  ...Object.entries(UPGRADES).map(([k,u])=>({id:'up_'+k, name:u.name, spr:u.spr, desc:u.desc+' (permanent)', w:2.5, apply(){ run.lvl[k]++; }})),
];

const M = (k,v,t,n) => ({k,v,t,n});
const ENEMIES = [
  { normal:[
      {name:'Cave Rat', spr:'rat', hp:28, moves:[M('atk',5,3),M('atk',5,3),M('curse',2,2)]},
      {name:'Vampire Bat', spr:'bat', hp:22, moves:[M('atk',3,2),M('drain',4,3)]},
      {name:'Gloop', spr:'slime', hp:40, moves:[M('curse',3,3),M('atk',6,3)]},
      {name:'Cave Spider', spr:'spider', hp:30, moves:[M('ice',2,2),M('atk',4,2),M('atk',4,2)]},
    ],
    elite:[
      {name:'Ogre', spr:'ogre', hp:85, moves:[M('armor',10,3),M('atk',15,5)]},
      {name:'Fungal Hulk', spr:'shroom', hp:75, passive:{id:'regen',v:2}, moves:[M('curse',4,3),M('atk',9,3),M('atk',9,3)]},
    ],
    boss:{name:'The Bone King', spr:'boneking', hp:150, passive:{id:'armor',v:10}, moves:[M('atk',10,3),M('curse',4,2),M('armor',15,2),M('multi',4,4,3)]},
  },
  { normal:[
      {name:'Skeleton', spr:'skeleton', hp:52, moves:[M('armor',8,2),M('atk',12,4)]},
      {name:'Goblin', spr:'goblin', hp:48, moves:[M('atk',8,3),M('multi',4,4,3)]},
      {name:'Wisp', spr:'ghost', hp:40, passive:{id:'ethereal'}, moves:[M('atk',7,2),M('curse',3,2)]},
      {name:'Shambler', spr:'zombie', hp:62, moves:[M('atk',9,3),M('rage',2,2),M('atk',9,3)]},
    ],
    elite:[
      {name:'Warlock', spr:'warlock', hp:115, moves:[M('curse',5,3),M('atk',12,2),M('heal',15,3)]},
      {name:'Mimic', spr:'mimic', hp:125, passive:{id:'thorns',v:2}, moves:[M('multi',5,4,3),M('armor',12,2),M('atk',15,4)]},
    ],
    boss:{name:'The Hydra', spr:'hydra', hp:240, passive:{id:'regen',v:3}, moves:[M('multi',5,3,3),M('curse',5,3),M('atk',18,4),M('ice',4,2)]},
  },
  { normal:[
      {name:'Fire Imp', spr:'imp', hp:60, moves:[M('atk',7,2),M('atk',7,2),M('curse',3,2)]},
      {name:'Cultist', spr:'cultist', hp:68, moves:[M('rage',3,2),M('atk',12,3),M('drain',8,3)]},
      {name:'Wyrmling', spr:'wyrm', hp:78, moves:[M('atk',15,3),M('ice',4,3)]},
      {name:'Gargoyle', spr:'gargoyle', hp:72, passive:{id:'armor',v:15}, moves:[M('armor',10,3),M('atk',13,3)]},
    ],
    elite:[
      {name:'Stone Golem', spr:'golem', hp:165, passive:{id:'armor',v:20}, moves:[M('armor',15,3),M('atk',17,3),M('curse',5,3)]},
      {name:'Dark Knight', spr:'darkknight', hp:150, passive:{id:'thorns',v:3}, moves:[M('atk',20,4),M('armor',12,2),M('multi',7,3,2)]},
    ],
    boss:{name:'Ancient Dragon', spr:'dragon', hp:340, passive:{id:'armor',v:20}, moves:[M('curse',6,3),M('atk',22,4),M('rage',3,2),M('multi',6,4,4),M('ice',5,3)]},
  },
  { normal:[
      {name:'Frost Wisp', spr:'frostwisp', hp:70, passive:{id:'ethereal'}, moves:[M('ice',3,2),M('atk',12,2)]},
      {name:'Ice Spider', spr:'icespider', hp:76, moves:[M('ice',3,2),M('atk',10,2),M('atk',10,2)]},
      {name:'Snow Yeti', spr:'yeti', hp:96, moves:[M('atk',16,3),M('rage',3,2),M('atk',16,3)]},
      {name:'Frozen Skeleton', spr:'frostskel', hp:82, moves:[M('armor',12,2),M('petrify',3,3),M('atk',15,3)]},
    ],
    elite:[
      {name:'Frost Golem', spr:'frostgolem', hp:190, passive:{id:'armor',v:25}, moves:[M('armor',18,3),M('ice',5,3),M('atk',20,3)]},
      {name:'Ice Witch', spr:'icewitch', hp:165, moves:[M('ice',6,3),M('atk',14,2),M('sap',3,3),M('heal',20,3)]},
    ],
    boss:{name:'The Frost Lich', spr:'lich', hp:380, passive:{id:'regen',v:4}, moves:[M('ice',6,3),M('petrify',4,3),M('multi',6,4,4),M('sap',4,3),M('atk',24,4)]},
  },
  { normal:[
      {name:'Void Imp', spr:'voidimp', hp:86, moves:[M('atk',11,2),M('shuffle',0,2),M('atk',11,2)]},
      {name:'Abyssal Ooze', spr:'voidslime', hp:112, moves:[M('curse',5,3),M('petrify',3,3),M('atk',14,3)]},
      {name:'Void Eye', spr:'voideye', hp:96, passive:{id:'thorns',v:3}, moves:[M('sap',3,2),M('atk',16,3),M('drain',12,3)]},
      {name:'Shade', spr:'shade', hp:82, passive:{id:'ethereal'}, moves:[M('atk',13,2),M('shuffle',0,2),M('drain',10,3)]},
    ],
    elite:[
      {name:'Abyssal Knight', spr:'abyssknight', hp:220, passive:{id:'thorns',v:4}, moves:[M('atk',26,4),M('armor',18,2),M('multi',9,3,3)]},
      {name:'Chaos Wyrm', spr:'chaoswyrm', hp:205, passive:{id:'enrage',v:6}, moves:[M('atk',22,3),M('ice',5,3),M('petrify',4,3)]},
    ],
    boss:{name:'The Demon Lord', spr:'demonlord', hp:470, passive:{id:'enrage',v:8}, moves:[M('curse',6,3),M('atk',28,4),M('shuffle',0,2),M('multi',8,4,4),M('petrify',5,3),M('sap',5,3),M('rage',4,2)]},
  },
];
const FS = arr => arr[Math.min(run.floor, arr.length)-1];
const GOBLIN = {name:'Treasure Goblin', spr:'goldgoblin', hp:34, rare:true, moves:[M('flee',0,7)]};
const ALL_ENEMIES = [...ENEMIES.flatMap((f,i)=>[...f.normal.map(e=>({...e,floor:i+1})), ...f.elite.map(e=>({...e,floor:i+1,elite:true})), {...f.boss,floor:i+1,boss:true}]), {...GOBLIN, floor:0}];
const PASSIVES = {
  regen:{name:'Regenerates', desc:v=>`Heals ${v} HP every turn.`},
  armor:{name:'Armored', desc:v=>`Starts the fight with ${v} armor.`},
  ethereal:{name:'Ethereal', desc:()=>'Single-line clears deal half damage. Clear two or more at once.'},
  thorns:{name:'Thorns', desc:v=>`You take ${v} damage every time you hurt it.`},
  enrage:{name:'Enrages', desc:v=>`Below half HP it flies into a rage: +${v} damage on all attacks.`},
};
const FLOOR_NAMES = ['The Damp Cellars','The Bone Halls','The Dragon\'s Depths','The Frozen Crypt','The Abyss'];
const ROOMS = {
  combat:{spr:'r_combat', name:'Monster', desc:'A regular fight. Gold and a boon.'},
  elite:{spr:'r_elite', name:'Elite', desc:'A tough fight. Pick a relic.'},
  rest:{spr:'r_rest', name:'Campfire', desc:'Heal, train, sharpen or meditate.'},
  shop:{spr:'r_shop', name:'Merchant', desc:'Relics, potions and upgrades for gold.'},
  treasure:{spr:'r_treasure', name:'Treasure', desc:'A free relic, no strings.'},
  event:{spr:'r_event', name:'Mystery', desc:'Something strange lies ahead.'},
  boss:{spr:'r_boss', name:'Boss', desc:'The floor guardian.'},
};
const FLOORS = 5, STEPS = 8;

/* ================= trophies ================= */
const ACH = {
  first:{name:'First Blood', desc:'Defeat your first enemy.', spr:'sword'},
  floor2:{name:'Going Deeper', desc:'Reach floor 2.', spr:'r_rest'},
  floor3:{name:'Into the Depths', desc:'Reach floor 3.', spr:'flame'},
  floor4:{name:'Cold Feet', desc:'Reach floor 4.', spr:'snow'},
  floor5:{name:'Into the Abyss', desc:'Reach floor 5.', spr:'voideye'},
  dragon:{name:'Dragonslayer', desc:'Defeat the Ancient Dragon.', spr:'dragon'},
  win:{name:'Lord of the Dungeon', desc:'Defeat the Demon Lord and conquer all 5 floors.', spr:'demonlord'},
  roster:{name:'Fresh Recruit', desc:'Unlock a new hero.', spr:'berserker'},
  skilled:{name:'Well Trained', desc:'Buy 10 skill ranks.', spr:'rune'},
  allheroes:{name:'Full Party', desc:'Win with the Knight, Rogue and Mage.', spr:'knight'},
  heat:{name:'Feel the Heat', desc:'Win on Heat 1 or higher.', spr:'rage'},
  quad:{name:'Quadruple', desc:'Clear 4 lines with one piece.', spr:'r_combat'},
  pure:{name:'Purist', desc:'Clear a pure line.', spr:'gem'},
  perfect:{name:'Clean Slate', desc:'Get a perfect clear.', spr:'snow'},
  bighit:{name:'Overkill', desc:'Deal 100 damage in a single hit.', spr:'bomb'},
  rich:{name:'Hoarder', desc:'Hold 200 gold at once.', spr:'coin'},
  relics10:{name:'Collector', desc:'Hold 10 relics in one run.', spr:'r_treasure'},
  flawless:{name:'Untouchable', desc:'Beat a boss without losing HP in that fight.', spr:'mirror'},
  goblin:{name:'Finders Keepers', desc:'Catch a Treasure Goblin.', spr:'goldgoblin'},
};
function unlock(id){
  const a = store.get('ach', {}); if(a[id]) return;
  a[id] = Date.now(); store.set('ach', a);
  setTimeout(()=>{ sfx('trophy'); toast(`<b>Trophy unlocked</b><br>${ACH[id].name}: ${ACH[id].desc}`, 'trophy', 3200); }, 500);
}

/* ================= skill tree (permanent upgrades bought with Soul Shards) ================= */
const SKILLS = {
  vit:{name:'Vitality', spr:'heart', desc:'+5 max HP per rank.', cost:[20,40,70]},
  purse:{name:'Deep Pockets', spr:'coin', desc:'+15 starting gold per rank.', cost:[15,30,50]},
  fort:{name:'Fortified', spr:'shield', desc:'Start every fight with +4 shield per rank.', cost:[25,45,70]},
  hands:{name:'Quick Hands', spr:'dice', desc:'+1 hand reroll every fight per rank.', cost:[40,90]},
  belt:{name:'Potion Belt', spr:'potion_health', desc:'Start each run with an extra random potion per rank.', cost:[30,60]},
  mend:{name:'Second Wind', spr:'heal_icon', desc:'Heal 5% max HP after every fight per rank.', cost:[35,70]},
  momentum:{name:'Momentum', spr:'drum', desc:'Start every fight with +1 combo streak per rank.', cost:[40,80]},
  focus:{name:'Focus', spr:'flame', desc:'Start every fight with +1 special charge per rank.', cost:[30,50,80]},
  whet:{name:'Whetted Edge', spr:'sword', desc:'Sword blocks deal +1 damage.', cost:[90]},
  sense:{name:'Treasure Sense', spr:'r_treasure', desc:'Relic rewards offer 4 choices instead of 3.', cost:[100]},
};
const skill = id => +(store.get('skills', {})[id] || 0);
const soulShards = () => +store.get('shards', 0);

/* ================= run state & persistence ================= */
let run = null, cb = null, drag = null, press = null, selPotion = -1, screenName = 'title';
const has = id => !!run && run.relics.includes(id);
const hpEl = () => $('#hpFill').parentElement;
function heal(n){ run.hp = Math.min(run.maxHp, run.hp + n); }
function saveRun(){ if(run) store.set('save', run); }
function stats(){ return Object.assign({runs:0, wins:0, kills:0, bestFloor:0, bestLines:0, bestHit:0, winsBy:{}, potions:0, shards:0}, store.get('stats', {})); }
function bumpStats(fn){ const s = stats(); fn(s); store.set('stats', s); }
function seen(){ return Object.assign({e:{}, r:{}}, store.get('seen', {})); }
function markSeen(kind, key){ const s = seen(); if(kind==='e'){ s.e[key] = s.e[key] || {seen:1, kills:0}; } else s.r[key] = 1; store.set('seen', s); }
function markKill(name){ const s = seen(); s.e[name] = s.e[name] || {seen:1, kills:0}; s.e[name].kills++; store.set('seen', s); }

function newRun(cls){
  const C = CLASSES[cls], heat = clamp(+(store.get('heatSel',0)), 0, store.get('heat',0));
  const hp = C.hp - (heat>=3 ? 10 : 0) + 5*skill('vit');
  run = {cls, heat, hp, maxHp:hp, gold:C.gold + 15*skill('purse'), relics:[C.relic], potions:C.potions.slice(), potionSlots:3, charge:0,
    lvl:{sword:skill('whet'),shield:0,heal:0,coin:0}, floor:1, step:0, map:null, path:[], kills:0, bosses:0, dmg:0, bestLines:0, bestHit:0, phoenixUsed:false};
  if(RELICS[C.relic].onGet) RELICS[C.relic].onGet();
  for(let i=0;i<skill('belt');i++) givePotion();
  run.map = genMap();
  bumpStats(s=>s.runs++);
  markSeen('r', C.relic);
  sfx('door');
  banner('Floor 1', FLOOR_NAMES[0]);
  goMap();
}
function migrate(r){
  r = Object.assign({heat:0, charge:0, path:[], potionSlots:3, bosses:0, bestHit:0, bestLines:0, dmg:0, kills:0, lvl:{sword:0,shield:0,heal:0,coin:0}}, r);
  if(!r.map){ r.map = genMap(); r.path = []; r.step = 0; }
  delete r.choices;
  return r;
}
function gainRelic(id){
  run.relics.push(id); const R = RELICS[id]; if(R.onGet) R.onGet();
  markSeen('r', id);
  if(run.relics.length>=10) unlock('relics10');
  renderRunbar(); toast(`<b>${R.name}</b><br>${R.desc}`, R.spr); sfx('buy');
}
function relicOffers(n, minR=1){
  const free = Object.keys(RELICS).filter(id=>!has(id) && !RELICS[id].starter);
  const pool = free.filter(id=>RELICS[id].r>=minR);
  return shuffle(pool.length>=n?pool:free).slice(0,n);
}
function givePotion(id){
  if(run.potions.length >= run.potionSlots) return false;
  id = id || pick(Object.keys(POTIONS));
  run.potions.push(id); renderRunbar(); return id;
}
/* returns true if the run ended */
function checkDeath(){
  if(run.hp > 0) return false;
  if(has('phoenix') && !run.phoenixUsed){
    run.phoenixUsed = true; run.hp = Math.round(run.maxHp/2);
    flash('rgba(255,180,60,.6)'); sfx('ult');
    toast('<b>Phoenix Feather</b><br>You rise from the ashes!', 'phoenix');
    renderRunbar(); return false;
  }
  return true;
}

/* ================= UI shell ================= */
function show(which){
  screenName = which;
  $('#combat').hidden = which!=='combat';
  $('#view').hidden = which==='combat';
  if(which==='combat'){ $('#view').innerHTML = ''; bump($('#combat'),'enter'); }
  $('#runbar').hidden = !run || ['title','heroes','codex','trophies','skills'].includes(which);
  selPotion = -1;
  document.querySelectorAll('.coach').forEach(c=>c.remove());
  document.documentElement.classList.toggle('lock', which==='combat');
  if(run) renderRunbar();
  updateDanger();
  Sound.music(['title','heroes','codex','trophies','skills'].includes(which) ? 'menu' : which==='combat' ? (cb&&cb.kind==='boss'?'boss':'combat') : 'map');
  window.scrollTo(0,0);
}
function updateDanger(){ document.body.classList.toggle('danger', !!run && screenName==='combat' && run.hp>0 && run.hp/run.maxHp<=0.3); }
function renderRunbar(){
  if(!run) return;
  $('#heroIcon').innerHTML = img(CLASSES[run.cls].spr, 34);
  const pct = (100*Math.max(0,run.hp)/run.maxHp)+'%';
  $('#hpFill').style.width = pct; $('#hpTrail').style.width = pct;
  $('#hpText').textContent = `${Math.max(0,run.hp)} / ${run.maxHp}`;
  if(!$('#coinIcon').firstChild) $('#coinIcon').innerHTML = img('coin', 22);
  tween($('#goldText'), run.gold);
  if(run.gold>=200) unlock('rich');
  $('#floorText').textContent = `F${run.floor}-${Math.min(run.step+1,STEPS)}${run.heat?` H${run.heat}`:''}`;
  const pb = $('#potionBar'); pb.innerHTML = '';
  for(let i=0;i<run.potionSlots;i++){
    const id = run.potions[i]; const b = document.createElement('button');
    b.className = 'slot'+(id?'':' empty')+(i===selPotion?' sel':'');
    b.setAttribute('aria-label', id ? POTIONS[id].name : 'Empty potion slot');
    if(id){ b.innerHTML = img(POTIONS[id].spr, 26); b.onclick = ()=>potionTap(i); }
    pb.appendChild(b);
  }
  const bar = $('#relicBar'); bar.innerHTML = '';
  run.relics.forEach(id=>{
    const R = RELICS[id]; const b = document.createElement('button');
    b.className = 'relic'+(id==='phoenix'&&run.phoenixUsed?' used':'');
    b.innerHTML = img(R.spr, 26); b.setAttribute('aria-label', R.name);
    b.onclick = ()=>toast(`<b>${R.name}</b><br>${R.desc}`, R.spr);
    bar.appendChild(b);
  });
  updateDanger();
}
function potionTap(i){
  const id = run.potions[i], P = POTIONS[id]; if(!P) return;
  const inFight = cb && !cb.over && !$('#combat').hidden;
  if(!inFight && !P.any){ toast(`<b>${P.name}</b><br>${P.desc}<br><span class="muted">Use it during a fight.</span>`, P.spr); return; }
  if(selPotion !== i){ selPotion = i; renderRunbar(); toast(`<b>${P.name}</b><br>${P.desc}<br><span class="muted">Tap again to drink.</span>`, P.spr); return; }
  selPotion = -1; run.potions.splice(i,1);
  bumpStats(s=>s.potions++);
  sfx('potion'); P.use();
  renderRunbar();
  if(inFight){ if(!checkEnd()){ checkStuck(); renderHUD(); } }
  else saveRun();
}
function view(html){ const v=$('#view'); v.innerHTML = `<div class="screen">${html}</div>`; return v; }
function choiceBtn({id,spr,name,desc,price,disabled,r,size}){
  const rar = r ? `<span class="rar rar${r}">${['','Common','Uncommon','Rare'][r]}</span>` : '';
  return `<button class="choice" data-id="${id}" ${disabled?'disabled':''}><span class="ic">${img(spr, size||44)}</span><span><b>${name}</b>${rar}<small>${desc}</small></span>${price!=null?`<span class="price">${img('coin',18)}${price}</span>`:''}</button>`;
}
function bindChoices(fn){
  let used = false;
  $('#view').querySelectorAll('.choice').forEach((b,i)=>{ b.style.setProperty('--i', i); b.onclick=()=>{ if(used && !b.dataset.multi) return; used = true; sfx('click'); fn(b.dataset.id); }; });
}
function scene(spr, title, text){ return `<div class="scene"><div class="art">${img(spr, 112)}</div><h2 class="title">${title}</h2>${text?`<p class="muted">${text}</p>`:''}</div>`; }
function blockChip(type){ return `<img class="blk" src="${blockCanvas(type, 44).toDataURL()}" alt="">`; }
document.addEventListener('pointerdown', ()=>Sound.unlock(), {capture:true});

/* ---------- coach marks (first-time tips) ---------- */
function coach(id, title, text, el, above){
  const done = store.get('tut', {}); if(done[id] || !el) return;
  document.querySelectorAll('.coach').forEach(c=>c.remove());
  const r = el.getBoundingClientRect ? el.getBoundingClientRect() : el, d = document.createElement('div');
  d.className = 'coach ' + (above?'above':'below');
  d.innerHTML = `<b>${title}</b>${text}<small>Tap to dismiss</small>`;
  document.body.appendChild(d);
  const w = d.offsetWidth, x = clamp(r.left + r.width/2 - w/2, 10, innerWidth - w - 10);
  d.style.left = x+'px';
  d.style.top = clamp(above ? r.top - d.offsetHeight - 12 : r.bottom + 12, 8, innerHeight - d.offsetHeight - 8) + 'px';
  d.style.setProperty('--ax', clamp(r.left + r.width/2 - x, 16, w-16)+'px');
  const t = store.get('tut', {}); t[id] = 1; store.set('tut', t);
  d.onclick = ()=>d.remove();
  setTimeout(()=>d.remove(), 9000);
}

/* ================= settings ================= */
function openSettings(){
  sfx('click');
  const m = $('#modal'); m.hidden = false;
  const st = stats();
  const tg = (k,label) => `<div class="row"><label>${label}</label><button class="toggle ${settings[k]?'on':''}" data-k="${k}" aria-label="${label}"></button></div>`;
  m.innerHTML = `<div class="card" role="dialog" aria-label="Settings">
    <div class="row"><h2 class="title" style="font-size:26px">Settings</h2>${img('gear',34)}</div>
    <div class="row"><label>Music</label><input type="range" min="0" max="1" step="0.05" value="${settings.music}" data-v="music" aria-label="Music volume"></div>
    <div class="row"><label>Sound</label><input type="range" min="0" max="1" step="0.05" value="${settings.sfx}" data-v="sfx" aria-label="Sound volume"></div>
    ${tg('shake','Screen shake')}${tg('flash','Screen flashes')}${tg('vibrate','Vibration')}
    <div class="records">
      <div>Runs<br><b>${st.runs}</b></div><div>Wins<br><b>${st.wins}</b></div>
      <div>Foes slain<br><b>${st.kills}</b></div><div>Deepest floor<br><b>${st.bestFloor||'-'}</b></div>
      <div>Best clear<br><b>${st.bestLines} lines</b></div><div>Biggest hit<br><b>${st.bestHit}</b></div>
    </div>
    <div class="row2"><button class="btn ghost" id="tutBtn" style="font-size:16px">Replay tips</button>${run && screenName!=='end' ? '<button class="btn ghost" id="abandonBtn" style="font-size:16px">Abandon run</button>' : ''}</div>
    <button class="btn danger" id="resetBtn">Reset all data</button>
    <button class="btn" id="closeBtn">Done</button>
  </div>`;
  m.querySelectorAll('input[type=range]').forEach(r=>{
    r.oninput = ()=>{ const k = r.dataset.v; settings[k] = +r.value; Sound.setVolume(k, settings[k]); store.set('settings', settings); };
    r.onchange = ()=>{ if(r.dataset.v==='sfx') sfx('coin'); };
  });
  m.querySelectorAll('.toggle').forEach(t=>t.onclick=()=>{
    const k = t.dataset.k; settings[k] = !settings[k]; t.classList.toggle('on', settings[k]); store.set('settings', settings); sfx('click');
    if(k==='shake' && settings.shake) shake(); if(k==='vibrate' && settings.vibrate) buzz(40); if(k==='flash' && settings.flash) flash('rgba(255,255,255,.3)');
  });
  $('#tutBtn').onclick = ()=>{ store.set('tut', null); toast('Tips will show again in your next fight.', 'book'); };
  let armed = false, armT;
  $('#resetBtn').onclick = ()=>{
    if(!armed){ armed = true; $('#resetBtn').textContent = 'Tap again to erase everything'; sfx('warn'); clearTimeout(armT); armT = setTimeout(()=>{ armed=false; const b=$('#resetBtn'); if(b) b.textContent='Reset all data'; }, 3000); return; }
    ['save','stats','best','runs','seen','ach','heat','heatSel','tut','shards','skills','heroes'].forEach(k=>store.set(k,null));
    sfx('rubble'); closeSettings(); run = null; cb = null; titleScreen(); toast('<b>Data reset</b><br>Saves, records, codex, trophies, skills and heroes were erased.', 'bones');
  };
  const ab = $('#abandonBtn');
  if(ab){ let a2=false; ab.onclick = ()=>{ if(!a2){ a2=true; ab.textContent='Tap again'; sfx('warn'); return; } store.set('save', null); closeSettings(); run=null; cb=null; titleScreen(); }; }
  $('#closeBtn').onclick = closeSettings;
  m.onclick = e=>{ if(e.target===m) closeSettings(); };
}
function closeSettings(){ $('#modal').hidden = true; $('#modal').innerHTML=''; sfx('click'); }
$('#gearBtn').onclick = openSettings;

/* ================= title, hero select, codex, trophies ================= */
function titleScreen(){
  run = null; cb = null; show('title');
  const save = store.get('save', null), st = stats(), ach = store.get('ach', {});
  view(`
    <div class="titlebar"><button class="iconbtn" id="gear2" aria-label="Settings">${img('gear',28)}</button></div>
    <h1 class="logo"><span>BLOCK BOUND</span><span>DUNGEON</span></h1>
    <div class="heroes">${img('knight',76)}${img('rogue',76)}${img('mage',76)}</div>
    ${save?`<button class="btn" id="contBtn">Continue: ${CLASSES[save.cls].name}, Floor ${save.floor}</button>`:''}
    <button class="btn ${save?'ghost':''}" id="startBtn">${save?'New Run':'Enter the Dungeon'}</button>
    <button class="btn ghost" id="skillBtn"><span class="inline" style="justify-content:center">${img('rune',28)} Skill Tree <span class="muted" style="font-size:15px;margin-left:6px">${img('shard',22)}${soulShards()}</span></span></button>
    <div class="row2">
      <button class="btn ghost" id="codexBtn"><span class="inline" style="justify-content:center">${img('book',26)} Codex</span></button>
      <button class="btn ghost" id="trophyBtn"><span class="inline" style="justify-content:center">${img('trophy',26)} ${Object.keys(ach).length}/${Object.keys(ACH).length}</span></button>
    </div>
    <div class="card">
      <ul class="how">
        <li>Drag pieces onto the grid. <b>Tap a piece to rotate it.</b> Fill a full row or column to clear it.</li>
        <li>Every cleared block fires its effect:</li>
      </ul>
      <div class="legend">
        <span>${blockChip('sword')} Sword: damage</span>
        <span>${blockChip('shield')} Shield: block</span>
        <span>${blockChip('heal')} Heart: heal</span>
        <span>${blockChip('coin')} Coin: gold</span>
        <span>${blockChip('stone')} Rubble: junk</span>
        <span>${blockChip('ice')} Ice: cracks to rubble</span>
      </div>
      <ul class="how" style="margin-top:8px">
        <li>Clear several lines at once or back-to-back for a <b>combo multiplier</b>. Lines of a single block type are <b>Pure</b>. Empty the grid for a <b>Perfect</b> clear.</li>
        <li>Clearing lines charges your hero's <b>special move</b>.</li>
        <li>Each piece you place is a turn. Watch the enemy's countdown.</li>
      </ul>
    </div>
    ${st.runs?`<p class="center muted" style="font-size:13px">${st.wins} wins in ${st.runs} runs · deepest floor ${st.bestFloor||1}</p>`:''}
  `);
  $('#startBtn').onclick = ()=>{ sfx('click'); if(save) store.set('save', null); heroScreen(); };
  if(save) $('#contBtn').onclick = ()=>{ sfx('door'); run = migrate(save); goMap(); };
  $('#gear2').onclick = openSettings;
  $('#codexBtn').onclick = ()=>{ sfx('click'); codexScreen('e'); };
  $('#skillBtn').onclick = ()=>{ sfx('click'); skillScreen(); };
  checkHeroUnlocks();
  $('#trophyBtn').onclick = ()=>{ sfx('click'); trophyScreen(); };
}
function heroScreen(){
  show('heroes');
  const maxHeat = store.get('heat', 0); let heat = clamp(+store.get('heatSel', 0), 0, maxHeat);
  view(`<div class="center"><h2 class="title">Choose your hero</h2></div>
    ${maxHeat ? `<div class="card heatsel"><button id="hm" aria-label="Less heat">-</button><div class="mid"><b id="hn"></b><small id="hd"></small></div><button id="hp" aria-label="More heat">+</button></div>` : ''}
    ${Object.entries(CLASSES).map(([id,C])=>{
      const R = RELICS[C.relic], wins = (stats().winsBy||{})[id]||0;
      if(!isUnlocked(id)) return `<button class="choice hero locked" data-id="lock:${id}"><span class="ic">${img(C.spr,70)}</span><span>
        <b>${C.name} <span class="rar rar1">Locked</span></b><small>${C.desc}</small>
        <span class="ult">Unlock: ${C.unlock.text}, or spend <b style="display:inline;font-size:13px">${C.unlock.cost} Soul Shards</b> (you have ${soulShards()}).</span></span></button>`;
      return `<button class="choice hero" data-id="${id}"><span class="ic">${img(C.spr,70)}</span><span>
        <b>${C.name}${wins?` <span class="rar rar3">${wins} win${wins>1?'s':''}</span>`:''}</b><small>${C.desc}</small>
        <span class="stats"><span class="inline">${img('heart',20)}${C.hp}</span><span class="inline">${img('coin',20)}${C.gold}</span><span class="inline">${img(R.spr,20)}${R.name}</span><span class="inline">${C.potions.map(p=>img(POTIONS[p].spr,20)).join('')}</span></span>
        <span class="ult">Special: <b style="font-size:13px;display:inline">${C.ult.name}</b> - ${C.ult.desc}</span>
      </span></button>`; }).join('')}
    <button class="btn ghost" id="backBtn">Back</button>`);
  const paint = ()=>{ if(!maxHeat) return; $('#hn').textContent = HEAT[heat].name; $('#hd').textContent = HEAT[heat].desc; $('#hm').disabled = heat<=0; $('#hp').disabled = heat>=maxHeat; store.set('heatSel', heat); };
  if(maxHeat){ $('#hm').onclick = ()=>{ heat--; sfx('click'); paint(); }; $('#hp').onclick = ()=>{ heat++; sfx('rage'); paint(); }; paint(); }
  $('#view').querySelectorAll('.choice').forEach((b,i)=>{ b.style.setProperty('--i', i); b.onclick = ()=>{
    const id = b.dataset.id;
    if(id.startsWith('lock:')){
      const k = id.slice(5), C = CLASSES[k];
      if(soulShards() < C.unlock.cost){ sfx('invalid'); toast(`<b>${C.name}</b><br>${C.unlock.text} to unlock, or collect ${C.unlock.cost} Soul Shards.`, C.spr); return; }
      if(b.dataset.armed!=='1'){ b.dataset.armed='1'; sfx('warn'); toast(`Tap again to unlock the ${C.name} for ${C.unlock.cost} Soul Shards.`, 'shard'); return; }
      store.set('shards', soulShards() - C.unlock.cost); const h = store.get('heroes', {}); h[k] = 1; store.set('heroes', h); unlock('roster');
      sfx('trophy'); confetti(60); heroScreen(); return;
    }
    sfx('click'); newRun(id);
  }; });
  $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}
function codexScreen(tab){
  show('codex');
  const s = seen();
  let body = '';
  if(tab==='e'){
    const n = ALL_ENEMIES.filter(e=>s.e[e.name]).length;
    body = `<p class="center muted">${n} / ${ALL_ENEMIES.length} discovered</p><div class="grid">${ALL_ENEMIES.map((e,i)=>{ const k = s.e[e.name]; return `<div class="cell ${k?'':'unk'}" data-i="${i}">${img(e.spr,58)}${k?e.name:'???'}</div>`; }).join('')}</div>`;
  } else {
    const ids = Object.keys(RELICS), n = ids.filter(id=>s.r[id]).length;
    body = `<p class="center muted">${n} / ${ids.length} discovered</p><div class="grid">${ids.map(id=>{ const k = s.r[id]; return `<div class="cell ${k?'':'unk'}" data-r="${id}">${img(RELICS[id].spr,50)}${k?RELICS[id].name:'???'}</div>`; }).join('')}</div>`;
  }
  view(`<div class="center"><h2 class="title">Codex</h2></div>
    <div class="tabs"><button class="${tab==='e'?'on':''}" id="tE">Bestiary</button><button class="${tab==='r'?'on':''}" id="tR">Relics</button></div>
    ${body}<button class="btn ghost" id="backBtn">Back</button>`);
  $('#tE').onclick = ()=>{ sfx('click'); codexScreen('e'); }; $('#tR').onclick = ()=>{ sfx('click'); codexScreen('r'); };
  $('#view').querySelectorAll('.cell').forEach(c=>c.onclick=()=>{
    sfx('click');
    if(c.dataset.i!=null){
      const e = ALL_ENEMIES[+c.dataset.i], k = s.e[e.name];
      if(!k) return toast('Not yet encountered.', e.spr);
      const tag = e.boss?'Boss':e.elite?'Elite':e.rare?'Rare':'Monster';
      toast(`<b>${e.name}</b><br>${tag}${e.floor?`, floor ${e.floor}`:''} · ${e.hp} HP${e.passive?` · ${PASSIVES[e.passive.id].name}`:''}<br><span class="muted">Defeated ${k.kills} time${k.kills===1?'':'s'}</span>`, e.spr, 3200);
    } else {
      const R = RELICS[c.dataset.r];
      if(!s.r[c.dataset.r]) return toast('Not yet found.', R.spr);
      toast(`<b>${R.name}</b><br>${R.desc}`, R.spr, 3200);
    }
  });
  $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}
function skillScreen(){
  show('skills');
  const sk = store.get('skills', {});
  view(`<div class="center"><h2 class="title">Skill Tree</h2><p class="muted">Permanent upgrades for every hero. Earn Soul Shards by playing runs.</p></div>
    <div class="card center" style="display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--display);font-size:24px">${img('shard',36)}${soulShards()} Soul Shards</div>
    ${Object.entries(SKILLS).map(([id,S])=>{
      const lv = sk[id]||0, max = S.cost.length, cost = S.cost[lv];
      const pips = `<span class="pips">${S.cost.map((_,i)=>`<i class="${i<lv?'on':''}"></i>`).join('')}</span>`;
      return `<button class="choice" data-id="${id}" data-multi="1" ${lv>=max||soulShards()<cost?'disabled':''}><span class="ic">${img(S.spr,44)}</span><span><b>${S.name}</b>${pips}<small>${S.desc}</small></span>${lv>=max?'<span class="price" style="color:#86e6a8">MAX</span>':`<span class="price">${img('shard',18)}${cost}</span>`}</button>`;
    }).join('')}
    <button class="btn ghost" id="backBtn">Back</button>`);
  $('#view').querySelectorAll('.choice').forEach((b,i)=>{ b.style.setProperty('--i', i); b.onclick = ()=>{
    const id = b.dataset.id, S = SKILLS[id], s = store.get('skills', {}), lv = s[id]||0, cost = S.cost[lv];
    if(lv>=S.cost.length || soulShards()<cost) return;
    store.set('shards', soulShards()-cost); s[id] = lv+1; store.set('skills', s);
    sfx('buy'); burstAt(b, ['#7ff0ff','#c8fbff','#fff'], 18);
    if(Object.values(s).reduce((a,v)=>a+v,0)>=10) unlock('skilled');
    skillScreen();
  }; });
  $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}
function trophyScreen(){
  show('trophies');
  const a = store.get('ach', {});
  view(`<div class="center"><h2 class="title">Trophies</h2><p class="muted">${Object.keys(a).length} / ${Object.keys(ACH).length} unlocked</p></div>
    ${Object.entries(ACH).map(([id,t])=>`<div class="troph ${a[id]?'':'lock'}">${img(t.spr,44)}<div><b>${t.name}</b><small>${t.desc}</small></div></div>`).join('')}
    <button class="btn ghost" id="backBtn">Back</button>`);
  $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}

/* ================= branching map ================= */
function genMap(){
  const rows = [];
  for(let r=0;r<STEPS;r++){
    const n = r===STEPS-1 ? 1 : r===0 ? rand(2,3) : rand(2,4);
    const w = [['combat',40],['elite',r>=2?14:0],['rest',r>=3?9:0],['shop',r>=2?11:0],['treasure',7],['event',16]].filter(e=>e[1]>0);
    const nodes = [];
    for(let i=0;i<n;i++){
      let t;
      if(r===0) t = 'combat';
      else if(r===STEPS-1) t = 'boss';
      else if(r===STEPS-2) t = i===0 ? 'rest' : weighted([['rest',1.2],['shop',1],['event',1],['treasure',0.5]]);
      else t = weighted(w);
      nodes.push({t, x: n===1 ? 0.5 : 0.14 + 0.72*i/(n-1) + (Math.random()-.5)*0.06, next:[]});
    }
    rows.push(nodes);
  }
  if(!rows[STEPS-2].some(n=>n.t==='rest')) rows[STEPS-2][0].t = 'rest';
  for(let r=0;r<STEPS-1;r++){
    const A = rows[r], B = rows[r+1], n = A.length, m = B.length;
    A.forEach((a,i)=>{
      const j = n===1 ? Math.floor((m-1)/2) : Math.round(i*(m-1)/(n-1));
      a.next.push(j);
      if(m>1 && Math.random()<0.45){ const k = j + (Math.random()<0.5?-1:1); if(k>=0 && k<m && !a.next.includes(k)) a.next.push(k); }
    });
    B.forEach((b,j)=>{
      if(!A.some(a=>a.next.includes(j))){ let bi=0, bd=9; A.forEach((a,i)=>{ const d=Math.abs(a.x-b.x); if(d<bd){ bd=d; bi=i; } }); A[bi].next.push(j); }
    });
  }
  return rows;
}
function availableNodes(){
  if(!run.path.length) return run.map[0].map((_,i)=>i);
  const [r,i] = run.path[run.path.length-1];
  return r+1 < STEPS ? run.map[r][i].next.slice() : [];
}
function goMap(){
  cb = null;
  run.step = run.path.length;
  saveRun();
  show('map');
  const RH = 84, H = RH*STEPS, avail = availableNodes(), row = run.step;
  const pos = (r,i)=>({x: run.map[r][i].x*100, y: RH/2 + r*RH});
  const onPath = (r,i)=> run.path.some(([a,b])=>a===r&&b===i);
  let lines = '';
  run.map.forEach((nodes,r)=>nodes.forEach((n,i)=>n.next.forEach(j=>{
    const a = pos(r,i), b = pos(r+1,j), trav = onPath(r,i) && onPath(r+1,j);
    const live = (r===row-1 && onPath(r,i)) || (row===0 && false);
    lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${trav?'#ffcf7a':live?'#ffffff':'#4a3f58'}" stroke-width="${trav?4:3}" stroke-dasharray="${trav?'0':'6 7'}" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="${trav||live?1:.8}"/>`;
  })));
  let nodesHtml = '';
  run.map.forEach((nodes,r)=>nodes.forEach((n,i)=>{
    const p = pos(r,i), done = onPath(r,i), isAvail = r===row && avail.includes(i);
    const here = done && run.path.length && run.path[run.path.length-1][0]===r && run.path[run.path.length-1][1]===i;
    const cls = ['mnode', n.t==='boss'?'boss':'', done?'done':'', here?'here':'', isAvail?'avail':'', (!done && !isAvail && r<=row)?'locked':''].join(' ');
    nodesHtml += `<button class="${cls}" style="left:${p.x}%;top:${p.y}px" data-r="${r}" data-i="${i}" aria-label="${ROOMS[n.t].name}" ${isAvail?'':'tabindex="-1"'}>${img(ROOMS[n.t].spr, n.t==='boss'?54:40)}</button>`;
  }));
  view(`
    <div class="maphead"><div><h2 class="title">Floor ${run.floor}</h2><div class="muted" style="font-size:14px">${FLOOR_NAMES[run.floor-1]}</div></div>
      ${run.heat?`<span class="heatchip">${img('rage',22)}Heat ${run.heat}</span>`:''}</div>
    <p class="muted center" style="font-size:13px">Descend toward the boss. Tap a glowing room.</p>
    <div class="map" style="height:${H}px"><svg viewBox="0 0 100 ${H}" preserveAspectRatio="none">${lines}</svg>${nodesHtml}</div>
    <div class="legend2">${['combat','elite','rest','shop','treasure','event'].map(k=>`<span>${img(ROOMS[k].spr,20)}${ROOMS[k].name}</span>`).join('')}</div>
  `);
  let used = false;
  $('#view').querySelectorAll('.mnode.avail').forEach(b=>b.onclick=()=>{ if(used) return; used = true; sfx('map'); enterRoom(+b.dataset.r, +b.dataset.i); });
  const target = $('#view .mnode.avail');
  if(target && row>1) setTimeout(()=>{ const r = target.getBoundingClientRect(), bar = $('#runbar').getBoundingClientRect().height + 20; const y = window.scrollY + r.top - Math.max(bar + 60, innerHeight*0.45); window.scrollTo({top: Math.max(0, y), behavior:'smooth'}); }, 120);
  if(row===0) coach('map', 'Your path', 'Pick any glowing room. Lines show which rooms connect. The boss waits at the bottom.', $('#view .mnode.avail'), false);
}
function enterRoom(r, i){
  run.path.push([r,i]); run.step = run.path.length - 1;
  const k = run.map[r][i].t;
  sfx('door');
  if(k==='combat') startCombat(Math.random()<0.1 ? 'goblin' : 'combat');
  else if(k==='elite'||k==='boss') startCombat(k);
  else if(k==='rest') restScreen();
  else if(k==='shop') shopScreen();
  else if(k==='treasure') treasureScreen();
  else eventScreen();
}
function advance(){
  const last = run.path[run.path.length-1];
  if(last && last[0]===STEPS-1){
    run.floor++;
    bumpStats(s=>s.bestFloor=Math.max(s.bestFloor, Math.min(run.floor,FLOORS)));
    if(run.floor>FLOORS) return endScreen(true);
    if(run.floor===2) unlock('floor2'); if(run.floor===3) unlock('floor3'); if(run.floor===4) unlock('floor4'); if(run.floor===5) unlock('floor5');
    run.map = genMap(); run.path = [];
    heal(Math.round(run.maxHp*0.3));
    banner(`Floor ${run.floor}`, FLOOR_NAMES[run.floor-1], 2200);
    setTimeout(()=>toast('You descend deeper and catch your breath. <b>+30% HP</b>', 'r_rest'), 600);
  }
  goMap();
}

/* ================= non-combat rooms ================= */
function restScreen(){
  show('rest');
  const amt = Math.round(run.maxHp*0.35*(has('hearth')?1.5:1));
  const up = pick(Object.keys(UPGRADES)); const U = UPGRADES[up], C = CLASSES[run.cls].ult;
  view(`${scene('r_rest','Campfire','The fire crackles. You have time for one thing.')}
    ${choiceBtn({id:'heal',spr:'heal_icon',name:'Rest',desc:`Heal ${amt} HP.${has('hearth')?' +4 max HP.':''}`})}
    ${choiceBtn({id:'train',spr:'heart',name:'Train',desc:'+8 max HP.'})}
    ${choiceBtn({id:'up',spr:U.spr,name:U.name,desc:U.desc+' (permanent)'})}
    ${choiceBtn({id:'med',spr:C.spr,name:'Meditate',desc:`Start your next fight with ${C.name} fully charged.`, disabled: run.charge>=C.need})}`);
  bindChoices(id=>{
    if(id==='heal'){ heal(amt); if(has('hearth')){ run.maxHp+=4; run.hp+=4; } sfx('heal'); }
    else if(id==='train'){ run.maxHp+=8; run.hp+=8; sfx('armor'); }
    else if(id==='up'){ run.lvl[up]++; sfx('armor'); }
    else { run.charge = C.need; sfx('ult'); }
    advance();
  });
}
function treasureScreen(){
  show('treasure');
  const [id] = relicOffers(1); const g = rand(10,20);
  view(`${scene('r_treasure','Treasure!',`Inside the chest: ${g} gold and...`)}
    ${id?choiceBtn({id, ...RELICS[id]}):''}
    <button class="btn" id="takeBtn">Take it</button>`);
  let done = false;
  const take = ()=>{ if(done) return; done = true; run.gold+=g; sfx('coin'); if(id) gainRelic(id); burstAt($('#goldWrap'), ['#f7c936','#ffe58a'], 16); advance(); };
  $('#takeBtn').onclick = take; bindChoices(take);
}
function shopScreen(){
  show('shop');
  const disc = has('clover') ? 0.8 : 1, P = x => Math.round(x*disc);
  const stock = relicOffers(3).map(id=>({id, price:P([0,55,80,115][RELICS[id].r]+rand(-5,5)), sold:false}));
  const pots = shuffle(Object.keys(POTIONS)).slice(0,2).map(id=>({id, price:P(rand(18,26)), sold:false}));
  const up = pick(Object.keys(UPGRADES)); const upPrice = P(50), packPrice = P(70); let upSold=false, packSold=false;
  const render = ()=>{
    const full = run.potions.length>=run.potionSlots;
    view(`${scene('r_shop','The Merchant', has('clover')?'"Lucky you. Everything is marked down."':'"Gold for goods, friend."')}
      ${stock.map(s=>s.sold?'':choiceBtn({id:'r:'+s.id,...RELICS[s.id],price:s.price,disabled:run.gold<s.price})).join('')}
      ${pots.map(s=>s.sold?'':choiceBtn({id:'p:'+s.id,spr:POTIONS[s.id].spr,name:POTIONS[s.id].name,desc:POTIONS[s.id].desc+(full?' (potion slots full)':''),price:s.price,disabled:run.gold<s.price||full})).join('')}
      ${upSold?'':choiceBtn({id:'u:'+up,spr:UPGRADES[up].spr,name:UPGRADES[up].name,desc:UPGRADES[up].desc+' (permanent)',price:upPrice,disabled:run.gold<upPrice})}
      ${packSold||run.potionSlots>=5?'':choiceBtn({id:'b:pack',spr:'satchel',name:'Bigger Pack',desc:'+1 potion slot.',price:packPrice,disabled:run.gold<packPrice})}
      <button class="btn ghost" id="leaveBtn">Leave</button>`);
    $('#view').querySelectorAll('.choice').forEach((b,i)=>{ b.style.setProperty('--i', i); b.onclick = ()=>{
      const [kind,id] = b.dataset.id.split(':');
      if(kind==='r'){ const s=stock.find(x=>x.id===id); if(run.gold<s.price||s.sold) return; run.gold-=s.price; s.sold=true; gainRelic(id); }
      else if(kind==='p'){ const s=pots.find(x=>x.id===id); if(run.gold<s.price||s.sold) return; run.gold-=s.price; s.sold=true; givePotion(id); sfx('buy'); }
      else if(kind==='u'){ if(run.gold<upPrice||upSold) return; run.gold-=upPrice; upSold=true; run.lvl[id]++; sfx('buy'); toast(`<b>${UPGRADES[id].name}</b><br>${UPGRADES[id].desc}`, UPGRADES[id].spr); }
      else { if(run.gold<packPrice||packSold) return; run.gold-=packPrice; packSold=true; run.potionSlots++; sfx('buy'); }
      renderRunbar(); render(); saveRun();
    }; });
    $('#leaveBtn').onclick = ()=>{ sfx('click'); advance(); };
  };
  render();
}
const EVENTS = [
  ()=>({spr:'shrine', title:'Ancient Shrine', text:'A blood-stained altar hums with old power.', opts:[
    {name:'Offer blood', spr:'drop', desc:'Lose 10 HP. Gain a relic.', ok:()=>run.hp>10, go(){ run.hp-=10; sfx('hurt'); const [id]=relicOffers(1); if(id) gainRelic(id); }},
    {name:'Pray', spr:'heal_icon', desc:'Heal 10 HP.', go(){ heal(10); sfx('heal'); }},
  ]}),
  ()=>({spr:'pool', title:'Glittering Pool', text:'Coins shimmer at the bottom of a black pool. Something moves below.', opts:[
    {name:'Reach in', spr:'coin', desc:'60%: +45 gold. 40%: lose 9 HP.', go(){ if(Math.random()<0.6){ run.gold+=45; sfx('coin'); toast('You grab a fistful of gold! <b>+45</b>','coin'); } else { run.hp-=9; sfx('hurt'); toast('Something bites! <b>-9 HP</b>','fang'); } }},
    {name:'Walk away', spr:'r_event', desc:'Nothing happens.', go(){} },
  ]}),
  ()=>({spr:'anvil', title:'Wandering Smith', text:'A dwarf with a portable anvil offers his services.', opts:[
    {name:'Reforge armor', spr:'chainmail', desc:'Pay 30 gold: +8 max HP.', ok:()=>run.gold>=30, go(){ run.gold-=30; run.maxHp+=8; run.hp+=8; sfx('armor'); }},
    {name:'Hone blades', spr:'sword', desc:'Pay 40 gold: Sword blocks +1 damage.', ok:()=>run.gold>=40, go(){ run.gold-=40; run.lvl.sword++; sfx('armor'); }},
    {name:'No thanks', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'bones', title:'Pile of Bones', text:'A fallen adventurer. Their pack looks heavy.', opts:[
    {name:'Search', spr:'r_shop', desc:'+30 gold and a potion, but lose 6 HP to a trap.', ok:()=>run.hp>6, go(){ run.gold+=30; run.hp-=6; sfx('hurt'); givePotion(); }},
    {name:'Pay respects', spr:'heal_icon', desc:'Heal 6 HP.', go(){ heal(6); sfx('heal'); }},
  ]}),
  ()=>({spr:'goblin', title:'Goblin Gambler', text:'"Double or nothing, eh? Gimme 25 gold."', opts:[
    {name:'Gamble', spr:'dice', desc:'50%: win 50 gold back. 50%: lose it.', ok:()=>run.gold>=25, go(){ if(Math.random()<0.5){ run.gold+=25; sfx('coin'); toast('You win! <b>+25 gold</b>','coin'); } else { run.gold-=25; sfx('defeat'); toast('The goblin cackles. <b>-25 gold</b>','goblin'); } }},
    {name:'Decline', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'mimic', title:'Suspicious Chest', text:'A chest sits alone in the corridor. Did it just breathe?', opts:[
    {name:'Open it', spr:'r_treasure', desc:'50%: a relic. 50%: it bites for 12.', go(){ if(Math.random()<0.5){ const [id]=relicOffers(1); if(id) gainRelic(id); } else { run.hp-=12; sfx('hurt'); toast('It was a mimic! <b>-12 HP</b>','mimic'); } }},
    {name:'Kick it', spr:'r_combat', desc:'Fight it for a guaranteed relic.', go(){ return 'mimic'; }},
    {name:'Leave it', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'potion_venom', title:'Bubbling Alchemist', text:'A hooded figure stirs a cauldron of glowing liquid.', opts:[
    {name:'Buy a brew', spr:'potion_health', desc:'Pay 15 gold for a random potion.', ok:()=>run.gold>=15&&run.potions.length<run.potionSlots, go(){ run.gold-=15; givePotion(); sfx('potion'); }},
    {name:'Drink from the pot', spr:'potion_venom', desc:'Heal to full, but lose 5 max HP.', go(){ run.maxHp=Math.max(10,run.maxHp-5); run.hp=run.maxHp; sfx('heal'); }},
    {name:'Leave', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'dummy', title:'Training Dummy', text:'An old practice dummy, still standing.', opts:[
    {name:'Train hard', spr:'r_combat', desc:'Lose 7 HP. Upgrade a random block type.', ok:()=>run.hp>7, go(){ run.hp-=7; sfx('hit'); const k=pick(Object.keys(UPGRADES)); run.lvl[k]++; toast(`<b>${UPGRADES[k].name}</b><br>${UPGRADES[k].desc}`, UPGRADES[k].spr); }},
    {name:'Stretch', spr:'heal_icon', desc:'Heal 8 HP.', go(){ heal(8); sfx('heal'); }},
  ]}),
  ()=>({spr:'idol', title:'Cursed Idol', text:'A golden idol grins from a pedestal. The air feels heavy.', opts:[
    {name:'Take it', spr:'idol', desc:'Gain a rare relic. Lose 8 max HP.', ok:()=>run.maxHp>20, go(){ run.maxHp-=8; run.hp=Math.min(run.hp,run.maxHp); const [id]=relicOffers(1,3); if(id) gainRelic(id); sfx('rage'); }},
    {name:'Leave it', spr:'r_event', desc:'Some things are better left alone.', go(){} },
  ]}),
  ()=>({spr:'knight', title:'Wounded Adventurer', text:'A knight slumps against the wall, clutching a wound.', opts:[
    {name:'Share a potion', spr:'potion_health', desc:'Give your first potion. Gain 20 gold and a random upgrade.', ok:()=>run.potions.length>0, go(){ run.potions.shift(); run.gold+=20; const k=pick(Object.keys(UPGRADES)); run.lvl[k]++; sfx('heal'); toast(`"Thank you, friend."<br><b>${UPGRADES[k].name}</b>: ${UPGRADES[k].desc}`, UPGRADES[k].spr, 3000); }},
    {name:'Bandage them', spr:'heal_icon', desc:'Lose 5 HP. Gain 15 gold.', ok:()=>run.hp>5, go(){ run.hp-=5; run.gold+=15; sfx('coin'); }},
    {name:'Walk past', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
];
function eventScreen(){
  show('event');
  const ev = pick(EVENTS)();
  view(`${scene(ev.spr, ev.title, ev.text)}
    ${ev.opts.map((o,i)=>choiceBtn({id:i,spr:o.spr,name:o.name,desc:o.desc,disabled:o.ok&&!o.ok()})).join('')}`);
  bindChoices(i=>{
    const res = ev.opts[i].go();
    renderRunbar();
    if(checkDeath()) return endScreen(false);
    if(res==='mimic'){ const mm = ENEMIES[1].elite[1]; return startCombat('elite', {...mm, hp: Math.round(mm.hp*FS([0.6,1,1.35,1.6,1.9]))}); }
    advance();
  });
}

/* ================= rewards & end ================= */
function rewardScreen(kind){
  show('reward');
  let g = kind==='boss'?rand(55,70):kind==='elite'?rand(25,35):kind==='goblin'?rand(50,70)+20*run.floor:rand(10,18);
  if(has('magnet')) g = Math.round(g*1.4);
  run.gold += g;
  let extra = '';
  if(has('crown')){ const i = Math.min(15, Math.floor(run.gold/10)); run.gold += i; extra += ` +${i} interest.`; }
  if(Math.random() < (kind==='combat'?0.35:0.5)){ const p = givePotion(); if(p) extra += ` Found a ${POTIONS[p].name}!`; }
  if(has('philflask')){ const p = givePotion(); if(p) extra += ` Brewed a ${POTIONS[p].name}.`; }
  if(skill('mend')){ const h = Math.round(run.maxHp*0.05*skill('mend')); heal(h); extra += ` Recovered ${h} HP.`; }
  renderRunbar(); saveRun();
  setTimeout(()=>burstAt($('#goldWrap'), ['#f7c936','#ffe58a','#fff'], 22), 150);
  if(kind==='boss') setTimeout(()=>confetti(80), 100);
  let offers;
  if(kind==='combat'){
    const pool = BOONS.filter(b=>!b.ok||b.ok());
    offers = [];
    while(offers.length<3){ const b = weighted(pool.map(x=>[x,x.w])); if(!offers.includes(b)) offers.push(b); }
    if(Math.random()<0.3){ const [id]=relicOffers(1); if(id) offers[2] = {id,...RELICS[id]}; }
  } else {
    offers = relicOffers(3+(skill('sense')?1:0), kind==='boss'?2:1).map(id=>({id,...RELICS[id]}));
  }
  const title = kind==='boss'?'Boss defeated!':kind==='goblin'?'Caught it!':'Victory!';
  view(`${scene(kind==='boss'?'r_boss':kind==='goblin'?'goldgoblin':'r_treasure', title, `+${g} gold.${extra} Choose a reward:`)}
    ${offers.map(o=>choiceBtn(o)).join('')}
    <button class="btn ghost" id="skipBtn">Skip</button>`);
  bindChoices(id=>{ const b = BOONS.find(x=>x.id===id); if(b){ b.apply(); sfx('heal'); } else gainRelic(id); advance(); });
  $('#skipBtn').onclick = ()=>{ sfx('click'); advance(); };
}
function endScreen(won){
  cb = null; store.set('save', null);
  let heatMsg = '';
  bumpStats(s=>{ if(won){ s.wins++; s.winsBy = s.winsBy||{}; s.winsBy[run.cls] = (s.winsBy[run.cls]||0)+1; } s.kills+=run.kills; s.bestFloor=Math.max(s.bestFloor, Math.min(run.floor,FLOORS)); s.bestLines=Math.max(s.bestLines, run.bestLines); s.bestHit=Math.max(s.bestHit, run.bestHit); });
  if(won){
    unlock('win'); if(run.heat>=1) unlock('heat');
    const wb = stats().winsBy; if(['knight','rogue','mage'].every(k=>wb[k])) unlock('allheroes');
    const mh = store.get('heat',0);
    if(run.heat>=mh && mh<HEAT.length-1){ store.set('heat', mh+1); heatMsg = `<p class="center" style="color:#ff8a80;font-family:var(--display);font-size:18px">${HEAT[mh+1].name} unlocked!</p>`; }
  }
  let earned = run.kills + (Math.min(run.floor,FLOORS)-1)*10 + (run.bosses||0)*15 + (won?50:0);
  earned = Math.round(earned * (1 + 0.15*(run.heat||0)) * (has('souljar')?1.5:1));
  store.set('shards', soulShards() + earned); bumpStats(s=>s.shards += earned);
  checkHeroUnlocks();
  show('end'); Sound.music(won?'map':'menu');
  sfx(won?'victory':'defeat');
  if(won){ confetti(160); banner('VICTORY', 'The dungeon is conquered', 2600); }
  view(`${scene(won?'r_boss':'bones', won?'You conquered the dungeon!':'You have fallen...', won?'The Demon Lord is banished. Legends will be told.':`${CLASSES[run.cls].name} fell on floor ${Math.min(run.floor,FLOORS)}, room ${run.step+1}.`)}
    ${heatMsg}
    <div class="card center" style="display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--display);font-size:22px">${img('shard',34)}+${earned} Soul Shards<span class="muted" style="font-size:14px;font-family:var(--body)">(${soulShards()} total)</span></div>
    <div class="card"><div class="stats3">
      <div>${run.kills}<small>foes slain</small></div>
      <div>${run.dmg}<small>damage</small></div>
      <div>${run.bestHit}<small>biggest hit</small></div>
      <div>${run.bestLines}<small>best clear</small></div>
    </div></div>
    <div class="card"><p class="center muted" style="font-size:13px;margin-bottom:6px">${CLASSES[run.cls].name}${run.heat?` · Heat ${run.heat}`:''} · ${run.relics.length} relics</p><div class="relicrow">${run.relics.map(id=>img(RELICS[id].spr,30)).join('')}</div></div>
    <button class="btn" id="againBtn">New Run</button>
    <button class="btn ghost" id="titleBtn">Title</button>`);
  $('#againBtn').onclick = ()=>{ sfx('click'); heroScreen(); }; $('#titleBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}

/* ================= combat ================= */
function rollType(){
  const e = [['sword',46],['shield',22],['heal',13],['coin',10]];
  if(has('prism')||has('orb')) e.push(['rainbow',has('prism')&&has('orb')?20:12]);
  if(has('toxin')||has('gravetome')) e.push(['venom',has('toxin')&&has('gravetome')?20:12]);
  if(has('satchel')) e.push(['blast',7]);
  return weighted(e);
}
function shapeWeight(s){
  const n = s.cells.length;
  let w = n<=2?0.9 : n<=4?1.3 : n<=5?1.0 : 0.5;
  if(has('feather')){ if(n<=3) w*=2.4; if(n>=6) w*=0.4; }
  return w;
}
function newPiece(){
  let s = weighted(SHAPES.map(x=>[x,shapeWeight(x)]));
  for(let k=rand(0,3); k>0; k--) s = rotated(s);
  return {...s, type:rollType(), used:false, rotT:0};
}
function fits(p,r,c,board){
  board = board || cb.board;
  for(const [dr,dc] of p.cells){ const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N||board[rr*N+cc]) return false; }
  return true;
}
function fitsAnywhere(p){ for(let r=0;r<=N-p.h;r++) for(let c=0;c<=N-p.w;c++) if(fits(p,r,c)) return true; return false; }
function fitsAnyRot(p){ let q = p; for(let k=0;k<4;k++){ if(fitsAnywhere(q)) return true; q = rotated(q); } return false; }
function rotatePiece(i){
  const p = cb.hand[i]; const r = rotated(p);
  p.cells = r.cells; p.h = r.h; p.w = r.w; p.rotT = performance.now();
  sfx('rotate');
  const h = $('#hint'); if(h) h.style.opacity = 0;
}
function dealHand(){
  let hand;
  for(let i=0;i<30;i++){ hand=[newPiece(),newPiece(),newPiece()]; if(hand.some(fitsAnyRot)) break; }
  cb.hand = hand;
}
function startCombat(kind, forced){
  if(!run || run.floor>FLOORS) return;
  const F = ENEMIES[run.floor-1];
  let tpl = forced || (kind==='boss' ? F.boss : kind==='goblin' ? GOBLIN : pick(kind==='elite' ? F.elite : F.normal));
  const heat = run.heat||0;
  let hpMul = FS([1.15,1.4,1.55,1.6,1.7]) * (kind==='boss'?1.1:(0.92+Math.random()*0.16));
  if(heat>=1) hpMul *= 1.15;
  if(heat>=5 && kind==='boss') hpMul *= 1.25;
  if(kind==='goblin') hpMul = FS([1,1.7,2.4,3.1,3.8]);
  if(heat>=4 && kind==='elite' && !tpl.passive){ const pid = pick(['regen','armor','thorns']); tpl = {...tpl, passive:{id:pid, v:pid==='regen'?3:pid==='armor'?15:2}}; }
  const maxHp = Math.round(tpl.hp * hpMul);
  const pas = tpl.passive || null;
  cb = {
    kind, board:Array(N*N).fill(null), hand:[], fx:[], parts:[], over:false, firstClear:true, doubleNext:false,
    streak: (has('drum') ? 2 : 0) + skill('momentum'), tookDmg:false, mirror:has('mirror'), moves:0, enraged:false,
    shield: (has('chainmail')?8:0) + (has('oath')?6:0) + 4*skill('fort'),
    rerolls: 1+(has('dice')?1:0)+skill('hands'),
    enemy:{...tpl, maxHp, hp:maxHp, armor: pas&&pas.id==='armor'?pas.v:0, poison:0, rage:0, mi:0, intent:null},
  };
  markSeen('e', tpl.name);
  run.charge = Math.min(CLASSES[run.cls].ult.need, run.charge + skill('focus'));
  if(run.floor>1 && kind!=='goblin') addBlocks('stone', Math.min(6,(run.floor-1)*2), true);
  nextIntent(); dealHand();
  lastEnemySpr = null;
  show('combat'); layout(); renderHUD();
  $('#eArt').className = '';
  if(kind==='boss'){ flash('rgba(160,20,30,.5)'); sfx('rage'); banner(tpl.name, `Guardian of ${FLOOR_NAMES[run.floor-1]}`, 1800); }
  if(kind==='goblin'){ sfx('flee'); toast('<b>A Treasure Goblin!</b><br>Catch it before it escapes with its loot.', 'goldgoblin', 2600); }
  if(run.charge >= CLASSES[run.cls].ult.need) setTimeout(()=>coach('ult', 'Special ready!', 'Your special move is charged. Tap it any time.', $('#ultBtn'), true), 900);
  setTimeout(()=>{ const b = cv.getBoundingClientRect(); coach('drag', 'How to play', 'Drag a piece from the tray onto the grid. Tap a piece to rotate it first.', {left:b.left, width:b.width, top:b.top+L.ty, bottom:b.top+L.ty+L.trayH}, true); }, 400);
}
const streakStep = () => has('daggers') ? 0.5 : 0.25;
function nextIntent(){
  const e = cb.enemy, m = e.moves[e.mi % e.moves.length]; e.mi++;
  e.intent = {...m, left: m.t + (has('hourglass')&&m.k!=='flee'?1:0)};
}
function peekIntent(){ const e = cb.enemy; return e.moves[e.mi % e.moves.length]; }
function intentDamage(it){ return Math.round(it.v*FS([1.1,1.25,1.35,1.45,1.55])*((run.heat||0)>=2?1.15:1)) + cb.enemy.rage; }
function addBlocks(type, n, silent){
  const empty = []; cb.board.forEach((v,i)=>{ if(!v) empty.push(i); });
  shuffle(empty).slice(0,n).forEach(i=>{ cb.board[i]=type; if(!silent) cb.fx.push({i, t0:performance.now(), drop:true, type}); });
}
function place(idx, r, c){
  const p = cb.hand[idx];
  p.cells.forEach(([dr,dc])=>{ cb.board[(r+dr)*N + c+dc] = p.type; });
  p.used = true; selPotion = -1; cb.moves++;
  sfx('place'); buzz(8);
  document.querySelectorAll('.coach').forEach(c=>c.remove());
  resolveClears();
  if(checkEnd()) return;
  enemyTick();
  if(checkEnd()) return;
  if(cb.hand.every(x=>x.used)) dealHand();
  checkStuck();
  if(checkEnd()) return;
  renderHUD();
  if(cb.moves===1) setTimeout(()=>{ const b = cv.getBoundingClientRect(); coach('clear', 'Clear lines', 'Fill a whole row or column. Every block in it fires: swords hit, shields block, hearts heal, coins pay. Drag over the grid to preview the result.', {left:b.left, width:b.width, top:b.top+L.ty, bottom:b.top+L.ty+L.trayH}, true); }, 350);
  else if(cb.moves===2) setTimeout(()=>coach('intent', 'Enemy intent', 'This is what the enemy does next, and how many of your moves until it happens.', $('#intent'), false), 350);
  if(run.charge >= CLASSES[run.cls].ult.need) coach('ult', 'Special ready!', 'Your special move is charged. Tap it any time.', $('#ultBtn'), true);
}
function fullLines(board){
  const rows=[], cols=[];
  for(let r=0;r<N;r++){ let ok=true; for(let c=0;c<N;c++) if(!board[r*N+c]){ok=false;break;} if(ok) rows.push(r); }
  for(let c=0;c<N;c++){ let ok=true; for(let r=0;r<N;r++) if(!board[r*N+c]){ok=false;break;} if(ok) cols.push(c); }
  return {rows, cols};
}
const MULT = [0,1,1.5,2,3,3.5,4,4.5,5];
function lineCells(rows, cols){
  const set = new Set();
  rows.forEach(r=>{ for(let c=0;c<N;c++) set.add(r*N+c); });
  cols.forEach(c=>{ for(let r=0;r<N;r++) set.add(r*N+c); });
  return set;
}
function isPure(board, idxs){
  const t = board[idxs[0]];
  return !!t && !JUNK(t) && idxs.every(i=>board[i]===t);
}
/* blast blocks also fire everything around them (chains) */
function expandBlast(board, set){
  const q = [...set].filter(i=>board[i]==='blast'), extra = new Set();
  while(q.length){
    const i = q.pop(), r = Math.floor(i/N), c = i%N;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N) continue;
      const j = rr*N+cc; if(!board[j] || set.has(j)) continue;
      set.add(j); extra.add(j); if(board[j]==='blast') q.push(j);
    }
  }
  return extra.size;
}
/* work out what a clear on `board` would do, without changing anything */
function planClear(board){
  const {rows, cols} = fullLines(board);
  const lines = rows.length + cols.length;
  if(!lines) return null;
  let pure = 0;
  rows.forEach(r=>{ if(isPure(board, [...Array(N).keys()].map(c=>r*N+c))) pure++; });
  cols.forEach(c=>{ if(isPure(board, [...Array(N).keys()].map(r=>r*N+c))) pure++; });
  let mult = MULT[Math.min(lines,8)] + cb.streak*streakStep() + pure*(has('purist')?1:0.5);
  if(cb.firstClear && has('ring')) mult *= 2;
  if(cb.doubleNext) mult *= 2;
  const set = lineCells(rows, cols);
  const blasted = expandBlast(board, set);
  return {set, lines, rows:rows.length, cols:cols.length, pure, mult, blasted};
}
function computeEffects(board, set, o){
  const cnt = {sword:0,shield:0,heal:0,coin:0,rainbow:0,venom:0,blast:0,stone:0,ice:0};
  set.forEach(i=>{ const t = board[i]; if(t) cnt[t]++; });
  const Lv = run.lvl, mult = o.mult, lines = o.lines;
  const swordVal = 2 + Lv.sword + (has('whetstone')?1:0) + (has('bloodpact')?2:0);
  const shieldVal = 2 + Lv.shield + (has('tower')?1:0) + (has('oath')?1:0);
  let healVal = 2 + Lv.heal;
  let swordBonus = 0;
  if(has('bloodlust')){ swordBonus = Math.floor((1 - Math.max(0,run.hp)/run.maxHp)*5); healVal = Math.max(1, healVal-1); }
  const coinVal = 1 + Lv.coin + (has('idol')?1:0) + (has('daggers')?1:0);
  let dmg = Math.round((cnt.sword*(swordVal+swordBonus) + cnt.rainbow*2 + cnt.blast*3) * mult);
  let sh  = Math.round((cnt.shield*shieldVal + cnt.rainbow) * mult);
  let hp  = Math.round((cnt.heal*healVal + cnt.rainbow) * mult);
  const poison = Math.round(cnt.venom * mult);
  const gold = cnt.coin*coinVal;
  if(has('sledge')) dmg += (cnt.stone+cnt.ice)*4;
  if(lines>=3){ if(has('powder')) dmg += 12; if(has('orb')) dmg += 8; }
  if(has('crossed') && o.rows && o.cols) dmg += 8;
  if(has('fang')) hp += 2*lines;
  let perfect = true;
  for(let i=0;i<N*N;i++){ const t = board[i]; if(t && (!set.has(i) || (t==='ice' && !has('warmcloak')))){ perfect = false; break; } }
  if(perfect) dmg += 20 + 10*(run.floor-1);
  const e = cb.enemy;
  if(has('scythe') && e.hp < e.maxHp*0.3) dmg = Math.round(dmg*1.5);
  if(e.passive && e.passive.id==='ethereal' && lines===1) dmg = Math.floor(dmg/2);
  return {dmg, sh, hp, poison, gold, perfect, cnt};
}
function resolveClears(){
  const plan = planClear(cb.board);
  if(!plan){ cb.streak = has('drum') ? 2 : 0; return; }
  cb.doubleNext = false; cb.firstClear = false;
  fireCells(plan.set, plan);
  cb.streak++;
}
/* fires every block in `set`, clears them, applies all effects */
function fireCells(set, o){
  const fx = computeEffects(cb.board, set, o);
  const now = performance.now();
  set.forEach(i=>{
    const t = cb.board[i]; if(!t) return;
    shards(i, t, o.lines>=3?7:5);
    if(t==='ice' && !has('warmcloak')){ cb.board[i]='stone'; cb.fx.push({i,type:'ice',t0:now}); }
    else { cb.fx.push({i, type:t, t0:now}); cb.board[i]=null; }
  });
  const lines = o.lines, mult = o.mult;
  run.bestLines = Math.max(run.bestLines, lines);
  if(lines>=4) unlock('quad');
  if(o.pure) unlock('pure');
  if(fx.perfect) unlock('perfect');
  const C = CLASSES[run.cls].ult;
  if(!o.noCharge) run.charge = Math.min(C.need, run.charge + lines*(has('battery')?1.5:1));

  const boardEl = $('#board');
  sfx('clear', lines, mult); buzz(lines>=2?30:15);
  if(o.blasted){ sfx('blast'); shake(); flash('rgba(255,140,40,.4)'); }
  if(fx.perfect){ floatText(boardEl, 'PERFECT!', '#ffffff', true); sfx('perfect'); flash('rgba(255,255,255,.45)'); confetti(40); }
  else if(o.label) floatText(boardEl, o.label, null, true);
  else if(lines>=2 || mult>1 || o.pure){
    const label = ['','','DOUBLE! ','TRIPLE! ','QUAD! ','PENTA! '][Math.min(lines,5)] || 'MEGA! ';
    floatText(boardEl, `${o.pure?'PURE! ':''}${lines>=2?label:''}x${fmt(mult)}`, null, true);
  }
  if(o.pure) sfx('pure');
  if(lines>=3 || mult>=3){ shake(); flash('rgba(255,180,80,.35)'); }
  if(fx.dmg>0){ damageEnemy(fx.dmg); if(has('leech') && fx.dmg>=8){ const lh = Math.floor(fx.dmg/8); heal(lh); floatText(hpEl(), `+${lh}`, '#86e6a8'); } }
  if(fx.poison>0){ cb.enemy.poison += fx.poison; floatText($('#eArt'), `+${fx.poison} poison`, '#dcb6ff'); sfx('poison'); }
  if(fx.sh>0){ cb.shield += fx.sh; floatText($('#shieldStat'), `+${fx.sh}`, '#a8ceff'); sfx('shield'); }
  if(fx.hp>0){ const before=run.hp; heal(fx.hp); const got=run.hp-before; if(got>0){ floatText(hpEl(), `+${got}`, '#86e6a8'); sfx('heal'); } }
  if(fx.gold>0){ run.gold += fx.gold; floatText($('#goldWrap'), `+${fx.gold}`, '#ffe58a'); sfx('coin'); burstAt($('#goldWrap'), ['#f7c936','#ffe58a'], 6); }
}
function damageEnemy(n, noThorns){
  const e = cb.enemy; let d = n;
  if(e.armor>0){ const a = Math.min(e.armor, d); e.armor -= a; d -= a; }
  e.hp = Math.max(0, e.hp - d); run.dmg += d; run.bestHit = Math.max(run.bestHit, d);
  if(e.passive && e.passive.id==='enrage' && !cb.enraged && e.hp>0 && e.hp<e.maxHp/2){ cb.enraged = true; e.rage += e.passive.v; setTimeout(()=>{ floatText($('#eArt'), `ENRAGED +${e.passive.v}`, '#ff9d3c', true); sfx('rage'); flash('rgba(255,60,20,.35)'); }, 250); }
  if(d>=100) unlock('bighit');
  const el = $('#eArt');
  floatText(el, d>0?`-${d}`:'Blocked', d>0?'#ff8a8d':'#c9c2d4', d>=25);
  el.classList.add('hitflash'); setTimeout(()=>el.classList.remove('hitflash'),110);
  sfx(d>0?'hit':'armor', d>=25);
  if(d>=25){ shake(); flash('rgba(255,255,255,.3)'); burstAt(el, ['#fff','#ffcf7a','#ff8a3c'], 14); }
  if(!noThorns && d>0 && e.passive && e.passive.id==='thorns' && e.hp>0) hitPlayer(e.passive.v, true);
}
function hitPlayer(n, small){
  if(cb.mirror && !small){ cb.mirror = false; floatText(hpEl(), 'Reflected!', '#a8ceff'); sfx('block'); return; }
  let v = n; if(has('thickskin')) v = Math.max(0, v-1);
  const absorbed = Math.min(cb.shield, v); cb.shield -= absorbed; v -= absorbed;
  if(absorbed>0 && has('spikes')) damageEnemy(5, true);
  const wasSafe = run.hp/run.maxHp > 0.3;
  run.hp -= v;
  if(v>0) cb.tookDmg = true;
  floatText(hpEl(), v>0?`-${v}`:'Blocked!', v>0?'#ff6a6f':'#a8ceff');
  if(v>0){ sfx('hurt'); if(!small){ shake(); flash('rgba(200,20,30,.45)'); buzz(60); } if(wasSafe && run.hp>0 && run.hp/run.maxHp<=0.3) sfx('heartbeat'); }
  else sfx('block');
  updateDanger();
}
function enemyTick(){
  const e = cb.enemy;
  if(e.poison>0){ const p = e.poison; e.hp = Math.max(0, e.hp - p); run.dmg += p; if(!has('gravetome')) e.poison--; floatText($('#eArt'), `-${p}`, '#dcb6ff'); if(e.hp<=0) return; }
  if(e.passive && e.passive.id==='regen' && e.hp<e.maxHp){ e.hp = Math.min(e.maxHp, e.hp+e.passive.v); }
  const it = e.intent;
  it.left--;
  if(it.left===1) sfx('warn');
  if(it.left>0) return;
  const dmg = intentDamage(it);
  const art = $('#eArt');
  if(['atk','multi','drain'].includes(it.k)){ bump(art,'lunge'); setTimeout(()=>art.classList.remove('lunge'),400); }
  switch(it.k){
    case 'atk': hitPlayer(dmg); break;
    case 'multi': for(let i=0;i<it.n;i++) hitPlayer(dmg, i>0); break;
    case 'drain': { const before = run.hp; hitPlayer(dmg); const took = Math.max(0, before-run.hp); if(took){ e.hp = Math.min(e.maxHp, e.hp+took); floatText(art, `+${took}`, '#86e6a8'); } break; }
    case 'curse': addBlocks('stone', it.v); floatText($('#board'), `Rubble x${it.v}`, '#c9c2d4'); sfx('rubble'); shake(); break;
    case 'ice': addBlocks('ice', it.v); floatText($('#board'), `Ice x${it.v}`, '#c8f0ff'); sfx('ice'); break;
    case 'armor': e.armor += it.v; floatText(art, `+${it.v} armor`, '#c9c2d4'); sfx('armor'); break;
    case 'heal': e.hp = Math.min(e.maxHp, e.hp+it.v); floatText(art, `+${it.v}`, '#86e6a8'); sfx('heal'); break;
    case 'rage': e.rage += it.v; floatText(art, `Rage +${it.v}`, '#ff9d3c'); sfx('rage'); flash('rgba(255,90,20,.3)'); break;
    case 'flee': cb.fled = true; return;
    case 'petrify': {
      if(has('stoneward')){ floatText($('#board'), 'Warded!', '#c9c2d4'); sfx('block'); break; }
      const live = []; cb.board.forEach((t,i)=>{ if(t && !JUNK(t)) live.push(i); });
      shuffle(live).slice(0,it.v).forEach(i=>{ cb.board[i]='stone'; cb.fx.push({i,type:'stone',t0:performance.now(),drop:true}); });
      floatText($('#board'), `Petrify x${it.v}`, '#c9c2d4'); sfx('rubble'); break; }
    case 'sap': { const lost = Math.min(run.charge, it.v); run.charge -= lost; floatText($('#ultBtn'), `-${lost} charge`, '#c77dff'); sfx('poison'); break; }
    case 'shuffle': cb.hand = cb.hand.map(p=>p.used?p:newPiece()); floatText($('#board'), 'Hand shuffled!', '#c77dff'); sfx('whoosh'); break;
  }
  nextIntent();
}
function checkStuck(){
  let guard = 0;
  while(!cb.over && !cb.hand.some(p=>!p.used && fitsAnyRot(p)) && guard++<5){
    toast('<b>Cave-in!</b> No room to move. The ceiling collapses.', 'rock');
    sfx('cavein'); flash('rgba(120,100,90,.5)');
    hitPlayer(4 + run.floor*2);
    const rows = [...Array(N).keys()].map(r=>[r, cb.board.slice(r*N,r*N+N).filter(Boolean).length]).sort((a,b)=>b[1]-a[1]).slice(0,2);
    const now = performance.now();
    rows.forEach(([r])=>{ for(let c=0;c<N;c++){ const i=r*N+c; if(cb.board[i]){ shards(i, cb.board[i], 4); cb.fx.push({i,type:cb.board[i],t0:now}); cb.board[i]=null; } } });
    cb.streak = 0;
    dealHand();
    if(run.hp<=0) break;
  }
}
function checkEnd(){
  if(!cb || cb.over) return true;
  const fight = cb;
  if(cb.enemy.hp<=0){
    cb.over = true; run.kills++; markKill(cb.enemy.name); unlock('first');
    if(cb.kind==='goblin') unlock('goblin');
    if(cb.kind==='boss'){ run.bosses = (run.bosses||0)+1; if(!cb.tookDmg) unlock('flawless'); if(cb.enemy.spr==='dragon') unlock('dragon'); }
    renderHUD();
    $('#eArt').classList.add('dead');
    floatText($('#eArt'), 'Defeated!', '#ffcf7a', true); sfx('kill'); buzz(40); burstAt($('#eArt'), ['#ffcf7a','#fff','#ff8a3c','#c77dff'], 30);
    const kind = cb.kind;
    setTimeout(()=>{ if(cb===fight) rewardScreen(kind); }, 1000); return true;
  }
  if(run.hp<=0 && checkDeath()){
    cb.over = true; renderHUD();
    setTimeout(()=>{ if(cb===fight) endScreen(false); }, 1000); return true;
  }
  if(cb.fled){
    cb.over = true; renderHUD();
    $('#eArt').classList.add('flee'); sfx('flee');
    toast('The goblin got away with its loot!', 'goldgoblin');
    setTimeout(()=>{ if(cb===fight) advance(); }, 1200); return true;
  }
  return false;
}

/* ---------- hero specials ---------- */
function useUlt(){
  if(!cb || cb.over) return;
  const C = CLASSES[run.cls].ult;
  if(run.charge < C.need){ toast(`<b>${C.name}</b><br>${C.desc}<br><span class="muted">Charge: ${Math.floor(run.charge)}/${C.need} lines cleared.</span>`, C.spr); return; }
  document.querySelectorAll('.coach').forEach(c=>c.remove());
  run.charge = 0; sfx('ult'); flash('rgba(255,200,120,.5)'); buzz(60);
  floatText($('#board'), C.name.toUpperCase()+'!', '#ffcf7a', true);
  const now = performance.now();
  if(run.cls==='knight'){
    const s = 18 + 6*(run.floor-1); cb.shield += s; floatText($('#shieldStat'), `+${s}`, '#a8ceff');
    cb.board.forEach((t,i)=>{ if(JUNK(t)){ shards(i,t,6); cb.fx.push({i,type:t,t0:now}); cb.board[i]=null; } });
  } else if(run.cls==='rogue'){
    dealHand(); cb.enemy.intent.left += 1; cb.doubleNext = true;
  } else if(run.cls==='berserker'){
    const rows = [...Array(N).keys()].map(r=>[r, cb.board.slice(r*N,r*N+N).filter(Boolean).length]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);
    run.hp = Math.max(1, run.hp-5); floatText(hpEl(), '-5', '#ff6a6f'); shake();
    const set = lineCells(rows,[]); const blasted = expandBlast(cb.board, set);
    fireCells(set, {lines:2, rows:2, cols:0, mult:3, label:'RAMPAGE!', noCharge:true, blasted});
  } else if(run.cls==='necromancer'){
    let n = 0; cb.board.forEach((t,i)=>{ if(JUNK(t)){ cb.board[i]='venom'; cb.fx.push({i,type:'venom',t0:now,drop:true}); n++; } });
    const pz = 6 + 3*(run.floor-1); cb.enemy.poison += pz; floatText($('#eArt'), `+${pz} poison`, '#dcb6ff'); sfx('poison');
    if(n) floatText($('#board'), `${n} raised`, '#dcb6ff');
  } else if(run.cls==='alchemist'){
    const cnt = {}; cb.board.forEach(t=>{ if(t && !JUNK(t) && t!=='rainbow') cnt[t]=(cnt[t]||0)+1; });
    const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
    if(top){ cb.board.forEach((t,i)=>{ if(t===top[0]){ cb.board[i]='rainbow'; cb.fx.push({i,type:'rainbow',t0:now,drop:true}); } }); floatText($('#board'), `${top[1]} transmuted`, '#f0d6ff'); }
    else { run.charge = CLASSES[run.cls].ult.need; toast('Nothing to transmute yet. Your charge is kept.', 'philflask'); }
  } else {
    let br=0, bc=0, bn=-1, cn=-1;
    for(let r=0;r<N;r++){ const n = cb.board.slice(r*N,r*N+N).filter(Boolean).length; if(n>bn){ bn=n; br=r; } }
    for(let c=0;c<N;c++){ let n=0; for(let r=0;r<N;r++) if(cb.board[r*N+c]) n++; if(n>cn){ cn=n; bc=c; } }
    shake();
    const set = lineCells([br],[bc]); const blasted = expandBlast(cb.board, set);
    fireCells(set, {lines:2, rows:1, cols:1, mult:2.5, label:'METEOR!', noCharge:true, blasted});
  }
  if(!checkEnd()){ checkStuck(); renderHUD(); }
}

/* ---------- HUD ---------- */
function intentInfo(it){
  const d = it.k==='flee' ? 0 : intentDamage(it);
  switch(it.k){
    case 'atk': return ['sword', `${d}`, `Attacks for ${d}`];
    case 'multi': return ['r_combat', `${d}x${it.n}`, `Attacks ${it.n} times for ${d}`];
    case 'drain': return ['drop', `${d}`, `Drains up to ${d} HP from you and heals itself by what it takes`];
    case 'curse': return ['rock', `x${it.v}`, `Drops ${it.v} rubble blocks on your grid`];
    case 'ice': return ['snow', `x${it.v}`, `Freezes ${it.v} empty cells. Ice cracks into rubble when cleared`];
    case 'armor': return ['armor', `+${it.v}`, `Gains ${it.v} armor`];
    case 'heal': return ['heal_icon', `+${it.v}`, `Heals ${it.v}`];
    case 'rage': return ['rage', `+${it.v}`, `Enrages: all its attacks deal +${it.v} for the rest of the fight`];
    case 'flee': return ['r_shop', 'Flee', `Escapes with its loot`];
    case 'petrify': return ['rock', `x${it.v}`, `Turns ${it.v} of your blocks on the grid to stone`];
    case 'sap': return ['flame', `-${it.v}`, `Drains ${it.v} charge from your special`];
    case 'shuffle': return ['dice', 'Mix', `Shuffles the pieces in your hand`];
  }
}
let lastEnemySpr = null;
function renderHUD(){
  if(!cb) return;
  const e = cb.enemy;
  if(lastEnemySpr !== e.spr){ $('#eArt').innerHTML = img(e.spr, 92); lastEnemySpr = e.spr; }
  $('#eName').textContent = e.name;
  let tags = cb.kind==='boss'?'<span class="tag boss">Boss</span>':cb.kind==='elite'?'<span class="tag">Elite</span>':cb.kind==='goblin'?'<span class="tag" style="background:#7a5608;color:#ffe58a">Rare</span>':'';
  if(e.passive) tags += `<span class="tag pass" id="passTag">${PASSIVES[e.passive.id].name}</span>`;
  $('#eTags').innerHTML = tags;
  if(e.passive) $('#passTag').onclick = ()=>toast(`<b>${PASSIVES[e.passive.id].name}</b><br>${PASSIVES[e.passive.id].desc(e.passive.v)}`, e.spr);
  const ep = (100*e.hp/e.maxHp)+'%';
  $('#eHpFill').style.width = ep; $('#eHpTrail').style.width = ep;
  $('#eHpText').textContent = `${e.hp} / ${e.maxHp}`;
  let badges = '';
  if(e.armor>0) badges += `<span class="badge" data-b="armor">${img('armor',22)}${e.armor}</span>`;
  if(e.poison>0) badges += `<span class="badge" data-b="poison" style="color:#dcb6ff">${img('poison',22)}${e.poison}</span>`;
  if(e.rage>0) badges += `<span class="badge" data-b="rage" style="color:#ffb07a">${img('rage',22)}${e.rage}</span>`;
  $('#eBadges').innerHTML = badges;
  $('#eBadges').querySelectorAll('.badge').forEach(b=>b.onclick=()=>{
    const k=b.dataset.b;
    toast(k==='armor'?`<b>Armor</b><br>Absorbs damage before HP.`:k==='poison'?`<b>Poison</b><br>Deals ${e.poison} damage each turn, then drops by 1.`:`<b>Rage</b><br>Attacks deal +${e.rage} damage.`, k);
  });
  const [ic,val,desc] = intentInfo(e.intent);
  const nx = intentInfo(peekIntent());
  const intent = $('#intent');
  intent.innerHTML = `${img(ic,28)}<span class="val">${val}</span><span class="cd">${e.intent.left===1?'NEXT TURN':`in ${e.intent.left}`}</span>${e.intent.k==='flee'?'':`<span class="then">then ${img(nx[0],18)}${nx[1]}</span>`}`;
  intent.classList.toggle('urgent', e.intent.left===1);
  intent.onclick = ()=>toast(`<b>${e.name}</b><br>${desc} ${e.intent.left===1?'after your next move':`in ${e.intent.left} moves`}.${e.intent.k==='flee'?'':`<br><span class="muted">Then: ${nx[2]}.</span>`}`, ic, 3000);
  $('#shieldText').textContent = cb.shield;
  const m = cb.streak*streakStep();
  $('#streakText').textContent = m ? `+${fmt(m)}` : '-';
  $('#rerollText').textContent = cb.rerolls;
  $('#rerollBtn').disabled = cb.rerolls<=0 || cb.over;
  const C = CLASSES[run.cls].ult, pct = Math.min(100, 100*run.charge/C.need);
  const ub = $('#ultBtn'); ub.style.setProperty('--p', pct);
  ub.classList.toggle('ready', pct>=100);
  if(!$('#ultIcon').dataset.k || $('#ultIcon').dataset.k!==run.cls){ $('#ultIcon').innerHTML = img(C.spr, 30); $('#ultIcon').dataset.k = run.cls; }
  $('#ultText').textContent = pct>=100 ? C.name : `${Math.floor(run.charge)}/${C.need}`;
  renderRunbar();
}
$('#shieldIcon').innerHTML = img('shield',28);
$('#flameIcon').innerHTML = img('flame',28);
$('#diceIcon').innerHTML = img('dice',28);
$('#gearBtn').innerHTML = img('gear',26);
$('#rerollBtn').onclick = ()=>{
  if(!cb || cb.rerolls<=0 || cb.over) return;
  cb.rerolls--; sfx('rotate');
  cb.hand = cb.hand.map(p=>p.used?p:newPiece());
  checkStuck();
  if(!checkEnd()) renderHUD();
};
$('#ultBtn').onclick = useUlt;
$('#comboStat').onclick = ()=>toast(`<b>Combo streak</b><br>Each move in a row that clears a line adds +${streakStep()} to your multiplier. Miss a clear and it resets.`, 'flame');
$('#shieldStat').onclick = ()=>toast('<b>Shield</b><br>Absorbs enemy damage before your HP. Carries over until it\'s used up.', 'shield');

/* ================= block art (glossy sticker blocks) ================= */
const BLK = {};
function blockCanvas(type, px){
  px = Math.max(8, Math.round(px));
  const key = type+'|'+px; if(BLK[key]) return BLK[key];
  const t = TYPES[type], c = document.createElement('canvas'); c.width = c.height = px;
  const x = c.getContext('2d');
  const rr = (X,Y,W,H,R)=>{ x.beginPath(); x.moveTo(X+R,Y); x.arcTo(X+W,Y,X+W,Y+H,R); x.arcTo(X+W,Y+H,X,Y+H,R); x.arcTo(X,Y+H,X,Y,R); x.arcTo(X,Y,X+W,Y,R); x.closePath(); };
  const o = Math.max(1.5, px*0.055), g = px*0.035, R = px*0.22;
  rr(g, g, px-2*g, px-2*g, R); x.fillStyle = '#120c16'; x.fill();
  const ix = g+o, iy = g+o, iw = px-2*(g+o), ih = px-2*(g+o);
  rr(ix, iy, iw, ih, R*0.8); x.fillStyle = t.d; x.fill();
  const gr = x.createLinearGradient(0, iy, 0, iy+ih);
  gr.addColorStop(0, t.l); gr.addColorStop(0.35, t.c); gr.addColorStop(1, t.c);
  rr(ix, iy, iw, ih - px*0.11, R*0.8); x.fillStyle = gr; x.fill();
  x.globalAlpha = 0.55; rr(ix+iw*0.12, iy+ih*0.07, iw*0.42, ih*0.12, ih*0.06); x.fillStyle = '#fff'; x.fill(); x.globalAlpha = 1;
  if(px>=12){ const gs = px*0.5; drawGlyph(x, type, (px-gs)/2, (px-gs)/2 - px*0.05, gs); }
  return (BLK[key] = c);
}

/* ================= canvas rendering ================= */
const cv = $('#board'), ctx = cv.getContext('2d');
let L = {}, dpr = 1;
function layout(){
  const wrapW = Math.min($('#combat').clientWidth || 360, 440);
  const top = cv.getBoundingClientRect().top + window.scrollY;
  const pad = 8, gap = 14, trayCells = 2.9;
  const byWidth = (wrapW - pad*2)/N;
  const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  const byHeight = (vh - top - pad*2 - gap - 34)/(N + trayCells);
  const cs = Math.max(28, Math.floor(Math.min(byWidth, byHeight)));
  const bw = cs*N, W = Math.max(bw + pad*2, Math.min(wrapW, bw+pad*2+40));
  const trayH = Math.round(cs*trayCells), H = pad + bw + gap + trayH + pad;
  dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  cv.style.width = W+'px'; cv.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  L = {W,H,cs,bx:(W-bw)/2,by:pad,bw,ty:pad+bw+gap,trayH,slotW:W/3};
}
function relayout(){ if(cb && !$('#combat').hidden){ window.scrollTo(0,0); layout(); } sizeFx(); }
window.addEventListener('resize', relayout);
if(window.visualViewport) window.visualViewport.addEventListener('resize', relayout);

function rrect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawCell(x, y, s, type, alpha=1, baseSize){
  ctx.globalAlpha = alpha;
  ctx.drawImage(blockCanvas(type, (baseSize||s)*dpr), x, y, s, s);
  ctx.globalAlpha = 1;
}
function drawSticker(p, x, y, s, alpha){
  const b = Math.max(3, s*0.14);
  ctx.globalAlpha = 0.45*alpha; ctx.fillStyle = '#000';
  p.cells.forEach(([r,c])=>{ rrect(x+c*s-b, y+r*s-b+b*0.9, s+2*b, s+2*b, s*0.3); ctx.fill(); });
  ctx.globalAlpha = alpha; ctx.fillStyle = '#fff';
  p.cells.forEach(([r,c])=>{ rrect(x+c*s-b, y+r*s-b, s+2*b, s+2*b, s*0.3); ctx.fill(); });
  ctx.globalAlpha = 1;
}
function drawPiece(p, x, y, s, alpha, sticker){
  if(sticker) drawSticker(p, x, y, s, alpha);
  p.cells.forEach(([r,c])=>drawCell(x+c*s, y+r*s, s, p.type, alpha));
}
function trayRect(i){
  const p = cb.hand[i]; const {slotW, ty, trayH, cs} = L;
  const s = Math.min(cs*0.62, (slotW-22)/p.w, (trayH-22)/p.h);
  return {s, x: i*slotW + (slotW - p.w*s)/2, y: ty + (trayH - p.h*s)/2};
}
function shards(i, type, n){
  if(!L.cs || !cb) return;
  const r = Math.floor(i/N), c = i%N, cx = L.bx + c*L.cs + L.cs/2, cy = L.by + r*L.cs + L.cs/2;
  const col = TYPES[type].c;
  for(let k=0;k<n;k++){
    const a = Math.random()*Math.PI*2, sp = 1.5+Math.random()*4.5;
    cb.parts.push({x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2.5, life:1, decay:0.018+Math.random()*0.02, size:L.cs*(0.12+Math.random()*0.16), rot:Math.random()*6, vr:(Math.random()-.5)*0.4, col});
  }
  if(cb.parts.length>500) cb.parts.splice(0, cb.parts.length-500);
}
/* the damage preview pill shown while dragging */
function drawPreview(plan, fx){
  const items = [['sword',fx.dmg,'#ff8a8d'],['shield',fx.sh,'#a8ceff'],['heal',fx.hp,'#86e6a8'],['coin',fx.gold,'#ffe58a'],['venom',fx.poison,'#dcb6ff']].filter(i=>i[1]>0);
  const label = (fx.perfect?'PERFECT ':'') + (plan.pure?'PURE ':'') + 'x'+fmt(plan.mult);
  ctx.font = `20px 'Lilita One', system-ui, sans-serif`;
  const gs = 20, gap = 6;
  let w = 16 + ctx.measureText(label).width;
  items.forEach(i=>{ w += gs + 4 + ctx.measureText(String(i[1])).width + gap; });
  const x0 = L.W/2 - w/2, y0 = L.by + 6, h = 32;
  ctx.globalAlpha = 0.92; rrect(x0, y0, w, h, 16); ctx.fillStyle = '#120c16'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.globalAlpha = 1;
  let x = x0 + 10; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffcf7a'; ctx.fillText(label, x, y0+h/2+1); x += ctx.measureText(label).width + gap;
  items.forEach(([t,v,col])=>{ drawGlyph(ctx, t, x, y0+(h-gs)/2, gs); x += gs+4; ctx.fillStyle = col; ctx.fillText(String(v), x, y0+h/2+1); x += ctx.measureText(String(v)).width + gap; });
}
function frame(){
  requestAnimationFrame(frame);
  embers(); drawFx();
  if(!cb || $('#combat').hidden || !L.cs) return;
  const {W,H,cs,bx,by,bw,ty,trayH} = L;
  ctx.clearRect(0,0,W,H);
  rrect(bx-6, by-6, bw+12, bw+12, 14); ctx.fillStyle = '#0b080e'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#4a3f58'; ctx.stroke();
  for(let r=0;r<N;r++) for(let c=0;c<N;c++){
    const x = bx+c*cs, y = by+r*cs, t = cb.board[r*N+c];
    if(t) drawCell(x,y,cs,t);
    else { rrect(x+2,y+2,cs-4,cs-4,cs*0.18); ctx.fillStyle = (r+c)%2 ? '#1a1520' : '#1e1825'; ctx.fill(); }
  }
  const now = performance.now();
  if(drag && drag.valid){
    const p = cb.hand[drag.idx];
    const pulse = 0.22 + 0.12*Math.sin(now/90);
    if(drag.plan){
      ctx.fillStyle = `rgba(255,207,122,${pulse})`;
      drag.plan.set.forEach(i=>{ const r=Math.floor(i/N), c=i%N; rrect(bx+c*cs+1, by+r*cs+1, cs-2, cs-2, cs*0.2); ctx.fill(); });
    }
    drawPiece(p, bx+drag.c*cs, by+drag.r*cs, cs, 0.45);
  }
  cb.fx = cb.fx.filter(f=>now-f.t0 < 420);
  cb.fx.forEach(f=>{
    const k = (now-f.t0)/420, r = Math.floor(f.i/N), c = f.i%N;
    if(f.drop){
      drawCell(bx+c*cs, by + r*cs - (1-k)*cs*1.5, cs, f.type, Math.min(1,k*2), cs);
    } else {
      const s = cs*(1+k*0.4), x = bx+c*cs - (s-cs)/2, y = by+r*cs - (s-cs)/2;
      drawCell(x, y, s, f.type, 1-k, cs);
      ctx.globalAlpha = (1-k)*0.7; rrect(x,y,s,s,s*0.2); ctx.fillStyle='#fff'; ctx.fill(); ctx.globalAlpha=1;
    }
  });
  rrect(4, ty-2, W-8, trayH+4, 14); ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fill();
  cb.hand.forEach((p,i)=>{
    if(p.used || (drag && drag.idx===i)) return;
    const {s,x,y} = trayRect(i);
    const ok = fitsAnywhere(p), okRot = ok || fitsAnyRot(p);
    const k = Math.min(1, (now - (p.rotT||0))/160);
    ctx.save();
    if(k<1){ const cx = x+p.w*s/2, cy = y+p.h*s/2; ctx.translate(cx,cy); ctx.rotate(-(1-k)*Math.PI/2); ctx.translate(-cx,-cy); }
    drawPiece(p, x, y, s, ok ? 1 : okRot ? 0.6 : 0.25, ok);
    ctx.restore();
  });
  if(drag){
    const p = cb.hand[drag.idx];
    drawPiece(p, drag.x - p.w*cs/2, drag.y - drag.lift - p.h*cs/2, cs, drag.valid?0.97:0.8, true);
    if(drag.valid && drag.plan && drag.fx) drawPreview(drag.plan, drag.fx);
  }
  cb.parts.forEach(q=>{
    q.x+=q.vx; q.y+=q.vy; q.vy+=0.28; q.vx*=0.985; q.rot+=q.vr; q.life-=q.decay;
    ctx.save(); ctx.globalAlpha=Math.max(0,q.life); ctx.translate(q.x,q.y); ctx.rotate(q.rot);
    ctx.fillStyle='#120c16'; ctx.fillRect(-q.size/2-1,-q.size/2-1,q.size+2,q.size+2);
    ctx.fillStyle=q.col; ctx.fillRect(-q.size/2,-q.size/2,q.size,q.size);
    ctx.restore();
  });
  cb.parts = cb.parts.filter(q=>q.life>0 && q.y<H+40);
}

/* ================= dungeon atmosphere & screen effects ================= */
(function wall(){
  const c = document.createElement('canvas'); c.width = 160; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#0d0a11'; x.fillRect(0,0,160,96);
  for(let row=0; row<4; row++){
    let px = row%2 ? -20 : 0; const y = row*24;
    while(px < 160){
      const w = 34 + Math.floor(Math.random()*20), l = 16 + Math.floor(Math.random()*9);
      const col = `rgb(${l+10},${l+3},${l+18})`;
      const brick = X=>{
        x.fillStyle = col; x.fillRect(X+2, y+2, w-3, 21);
        x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(X+2, y+2, w-3, 2);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(X+2, y+20, w-3, 3);
      };
      brick(px); if(px+w>160) brick(px-160); if(px<0) brick(px+160);
      if(Math.random()<0.3){ x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(px+8+Math.random()*(w-16), y+6, 1, 8); }
      px += w;
    }
  }
  document.body.style.backgroundImage = `url(${c.toDataURL()})`;
})();
const emb = $('#embers'), ex = emb.getContext('2d'); let EMB = [];
const fxc = $('#fxc'), fx2 = fxc.getContext('2d'); let FXP = [];
function sizeFx(){ emb.width = innerWidth; emb.height = innerHeight; const d = Math.min(2, devicePixelRatio||1); fxc.width = innerWidth*d; fxc.height = innerHeight*d; fx2.setTransform(d,0,0,d,0,0); }
sizeFx();
function embers(){
  if(EMB.length < 34 && Math.random()<0.25){
    EMB.push({x: Math.random()<0.5 ? Math.random()*innerWidth*0.25 : innerWidth*(0.75+Math.random()*0.25), y: innerHeight+10, vy: -(0.4+Math.random()*0.9), vx:(Math.random()-.5)*0.3, s: 1+Math.random()*2.2, life:1, ph:Math.random()*6});
  }
  ex.clearRect(0,0,emb.width,emb.height);
  EMB.forEach(e=>{
    e.ph += 0.05; e.x += e.vx + Math.sin(e.ph)*0.4; e.y += e.vy; e.life -= 0.003;
    ex.globalAlpha = Math.max(0, e.life)*0.85;
    ex.fillStyle = e.s>2.4 ? '#ffcf7a' : '#ff8a3c';
    ex.fillRect(e.x, e.y, e.s, e.s);
  });
  ex.globalAlpha = 1;
  EMB = EMB.filter(e=>e.life>0 && e.y>-10);
}
function burstAt(el, colors, n){
  if(!el || !settings.flash) return;
  const r = el.getBoundingClientRect(); if(!r.width) return;
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  for(let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, sp = 2+Math.random()*5; FXP.push({x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2, g:0.18, life:1, decay:0.025+Math.random()*0.02, s:3+Math.random()*4, col:pick(colors), rot:0, vr:0, round:true}); }
}
function confetti(n){
  if(!settings.flash) return;
  const cols = ['#ef5258','#4a98ff','#45c674','#f7c936','#c77dff','#ff8a3c','#fff'];
  for(let i=0;i<n;i++) FXP.push({x:Math.random()*innerWidth, y:-20-Math.random()*innerHeight*0.4, vx:(Math.random()-.5)*2, vy:2+Math.random()*3, g:0.04, life:1, decay:0.004+Math.random()*0.004, s:6+Math.random()*6, col:pick(cols), rot:Math.random()*6, vr:(Math.random()-.5)*0.3});
}
function drawFx(){
  fx2.clearRect(0,0,innerWidth,innerHeight);
  if(!FXP.length) return;
  FXP.forEach(p=>{
    p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.vx*=0.99; p.rot+=p.vr; p.life-=p.decay;
    fx2.save(); fx2.globalAlpha = Math.max(0, Math.min(1, p.life*1.5)); fx2.translate(p.x,p.y); fx2.rotate(p.rot); fx2.fillStyle = p.col;
    if(p.round){ fx2.beginPath(); fx2.arc(0,0,p.s/2,0,Math.PI*2); fx2.fill(); } else fx2.fillRect(-p.s/2,-p.s*0.3,p.s,p.s*0.6);
    fx2.restore();
  });
  FXP = FXP.filter(p=>p.life>0 && p.y<innerHeight+30);
}
requestAnimationFrame(frame);

/* ================= input: tap to rotate, drag to place ================= */
function pt(e){ const r = cv.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; }
function updateDrag(){
  const p = cb.hand[drag.idx], {cs,bx,by} = L;
  const ox = drag.x - p.w*cs/2, oy = drag.y - drag.lift - p.h*cs/2;
  const c = Math.round((ox-bx)/cs), r = Math.round((oy-by)/cs);
  if(r===drag.r && c===drag.c) return;
  drag.c = c; drag.r = r;
  drag.valid = fits(p, r, c);
  drag.plan = null; drag.fx = null;
  if(drag.valid){
    const sim = cb.board.slice(); p.cells.forEach(([dr,dc])=>{ sim[(r+dr)*N + c+dc] = p.type; });
    drag.plan = planClear(sim);
    if(drag.plan) drag.fx = computeEffects(sim, drag.plan.set, drag.plan);
  }
}
cv.addEventListener('pointerdown', e=>{
  if(!cb || cb.over) return;
  const {x,y} = pt(e);
  if(y < L.ty - 10) return;
  const i = clamp(Math.floor(x / L.slotW), 0, 2);
  const p = cb.hand[i]; if(!p || p.used) return;
  press = {idx:i, x0:x, y0:y, mouse:e.pointerType==='mouse'};
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  e.preventDefault();
});
cv.addEventListener('pointermove', e=>{
  if(!cb) return;
  const {x,y} = pt(e);
  if(press && !drag && Math.hypot(x-press.x0, y-press.y0) > 8){
    drag = {idx:press.idx, x, y, lift: press.mouse ? 0 : L.cs*1.8, valid:false, r:null, c:null};
    sfx('pick');
    document.querySelectorAll('.coach').forEach(c=>c.remove());
  }
  if(!drag) return;
  drag.x=x; drag.y=y; updateDrag(); e.preventDefault();
});
cv.addEventListener('pointerup', ()=>{
  if(drag){ const d = drag; drag = null; press = null;
    if(d.valid && cb && !cb.over) place(d.idx, d.r, d.c); else if(d.y < L.ty) sfx('invalid');
    return; }
  if(press){ const i = press.idx; press = null; if(cb && !cb.over && cb.hand[i] && !cb.hand[i].used) rotatePiece(i); }
});
cv.addEventListener('pointercancel', ()=>{ drag = null; press = null; });
addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('#modal').hidden) closeSettings(); });

/* ================= boot ================= */
titleScreen();
