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
const settings = Object.assign({music:0.5, sfx:0.7, amb:0.5, shake:true, flash:true, vibrate:true, motion:false, speed:'normal', lefty:false, contrast:false, dmgnums:true, tips: (store.get('stats',{}).runs||0) <= 1}, store.get('settings', {}));
Sound.setVolume('music', settings.music); Sound.setVolume('sfx', settings.sfx); Sound.setVolume('amb', settings.amb);
/* game-speed aware delay */
const T = ms => settings.speed==='fast' ? Math.round(ms*0.45) : ms;
function applySettings(){
  const b = document.body.classList;
  b.toggle('rm', !!settings.motion); b.toggle('lefty', !!settings.lefty); b.toggle('hc', !!settings.contrast);
}
applySettings();
const sfx = (n,...a) => Sound.play(n,...a);

let toastTimer;
function toast(html, icon, ms=2400){
  const t = $('#toast'); t.innerHTML = (icon?img(icon,36):'') + `<div>${html}</div>`;
  t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('on'), ms);
}
function floatText(el, text, color, big){
  if(!el) return;
  if(!settings.dmgnums && !big && /^[+-]?\d/.test(text)) return;
  const r = el.getBoundingClientRect(); if(!r.width && !r.height) return;
  const f = document.createElement('div');
  f.className = 'float'+(big?' big':''); f.textContent = text; if(color) f.style.color = color;
  f.style.left = (r.left + r.width/2 + rand(-24,24))+'px'; f.style.top = (r.top + r.height/2 + rand(-8,8))+'px';
  document.body.appendChild(f); setTimeout(()=>f.remove(), 1100);
}
function bump(el, cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function shake(){ if(settings.shake && !settings.motion) bump($('#app'),'shake'); }
function flash(color){ if(!settings.flash) return; const f=$('#flash'); f.style.background=color; bump(f,'on'); }
function buzz(ms){ if(settings.vibrate) Sound.vibrate(ms); }
function banner(title, sub, ms=2000){
  const b = $('#banner'); b.hidden = false; b.innerHTML = `<div class="b"><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div>`;
  sfx('whoosh'); clearTimeout(banner.t); banner.t = setTimeout(()=>{ b.hidden = true; }, T(ms));
  b.querySelector('.b').style.animationDuration = T(ms)+'ms';
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
  bomb:   {c:'#4a3a58', d:'#1d1424', l:'#8f7fa6', name:'Bomb'},
  web:    {c:'#b9b2c8', d:'#6f6784', l:'#efeaf6', name:'Web'},
};
const JUNK = t => t==='stone' || t==='ice' || t==='bomb' || t==='web';
const bombDmg = () => 4 + 2*Math.min(run.floor, 8);
const weakBonus = () => 5 + 2*Math.min(run.floor, 8);
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
  knight:{name:'Knight', spr:'knight', hp:66, gold:20, relic:'oath', potions:['iron'], bag:{sword:5, shield:5, heal:2, coin:2},
    desc:'Sturdy and patient. Shields hit harder and every fight starts behind a wall.',
    ult:{name:'Bulwark', need:8, spr:'oath', desc:'Gain a big shield and smash all rubble and ice off the grid.'}},
  rogue:{name:'Rogue', spr:'rogue', hp:62, gold:45, relic:'daggers', potions:['fire','smoke'], bag:{sword:6, shield:2, heal:2, coin:4},
    desc:'Lives on momentum. Combo streaks grow twice as fast and coins pay extra.',
    ult:{name:'Shadowstep', need:7, spr:'daggers', desc:'Fresh hand, the enemy loses a turn, and your next clear is doubled.'}},
  mage:{name:'Mage', spr:'mage', hp:52, gold:20, relic:'orb', potions:['health'], bag:{sword:5, shield:3, heal:2, coin:2},
    desc:'Fragile but explosive. Rainbow blocks appear and big clears detonate.',
    ult:{name:'Meteor', need:9, spr:'potion_fire', desc:'Detonate the fullest row and column at x2.5, even if they are not full.'}},
  berserker:{name:'Berserker', spr:'berserker', hp:80, gold:25, relic:'bloodlust', potions:['fire'], bag:{sword:7, shield:2, heal:2, coin:2},
    desc:'Gets deadlier the more he bleeds. Swords grow stronger as your HP drops.',
    ult:{name:'Rampage', need:7, spr:'bloodaxe', desc:'Smash the two fullest rows at x3, even if they are not full. Costs 5 HP.'},
    unlock:{text:'Reach floor 3', cost:120, ok:s=>s.bestFloor>=3}},
  necromancer:{name:'Necromancer', spr:'necromancer', hp:56, gold:30, relic:'gravetome', potions:['venom'], bag:{sword:5, shield:3, heal:2, coin:2},
    desc:'Rots enemies from the inside. Venom blocks appear and poison never wears off.',
    ult:{name:'Raise Dead', need:7, spr:'gravetome', desc:'Turn all rubble and ice into Venom blocks and poison the enemy.'},
    unlock:{text:'Defeat 60 foes in total', cost:150, ok:s=>s.kills>=60}},
  alchemist:{name:'Alchemist', spr:'alchemist', hp:60, gold:35, relic:'philflask', potions:['health','bomb'], bag:{sword:5, shield:3, heal:3, coin:3},
    desc:'Never short on supplies. An extra potion slot and a fresh brew after every fight.',
    ult:{name:'Transmute', need:6, spr:'philflask', desc:'Turn every block of the most common type on the grid into Rainbow blocks.'},
    unlock:{text:'Drink 10 potions in total', cost:150, ok:s=>s.potions>=10}},
  paladin:{name:'Paladin', spr:'paladin', hp:70, gold:25, relic:'holysymbol', potions:['health'], bag:{sword:4, shield:4, heal:4, coin:2},
    desc:'A holy tank. Hearts also strike the enemy, and overhealing becomes shield.',
    ult:{name:'Smite', need:8, spr:'holy', desc:'Deal damage equal to your shield plus 15. You keep the shield.'},
    unlock:{text:'Win a run with any hero', cost:200, ok:s=>s.wins>=1}},
  ranger:{name:'Ranger', spr:'ranger', hp:60, gold:30, relic:'huntersmark', potions:['fire'], bag:{sword:6, shield:3, heal:2, coin:2},
    desc:'A precise hunter. Pure lines hit much harder and every cleared line adds damage.',
    ult:{name:'Volley', need:7, spr:'mark', desc:'Fire 6 arrows that pierce armor, 5 damage each (more on deeper floors).'},
    unlock:{text:'Clear 15 pure lines in total', cost:180, ok:s=>s.pures>=15}},
  bard:{name:'Bard', spr:'bard', hp:62, gold:35, relic:'lute', potions:['luck'], bag:{sword:5, shield:3, heal:3, coin:3},
    desc:'Plays to the rhythm of combos. Every third clear in a row strikes a chord that shields and heals.',
    ult:{name:'Encore', need:7, spr:'lute', desc:'Replay your last clear: its damage, shield, healing, poison and gold all happen again.'},
    unlock:{text:'Reach Mastery 3 with any hero', cost:160, ok:()=>Object.keys(CLASSES).some(k=>masteryLevel(k)>=3)}},
  monk:{name:'Monk', spr:'monk', hp:64, gold:25, relic:'prayerbeads', potions:['health'], bag:{sword:5, shield:4, heal:3, coin:2},
    desc:'A calm, steady fighter. Missing a clear only lowers your combo streak by 1.',
    ult:{name:'Flurry', need:7, spr:'prayerbeads', desc:'Strike 6 times (more damage on deeper floors) and add +2 to your combo streak.'},
    unlock:{text:'Play 5 runs', cost:120, ok:s=>s.runs>=5}},
  druid:{name:'Druid', spr:'druid', hp:62, gold:25, relic:'seedpod', potions:['health'], bag:{sword:4, shield:3, heal:5, coin:2},
    desc:'Nature heals. Every fight starts with heart blocks already growing on the grid.',
    ult:{name:'Overgrowth', need:7, spr:'seedpod', desc:'Turn all rubble, ice and webs into heart blocks and heal.'},
    unlock:{text:'Defeat 120 foes in total', cost:180, ok:s=>s.kills>=120}},
  samurai:{name:'Samurai', spr:'samurai', hp:60, gold:20, relic:'katana', potions:['fire'], bag:{sword:7, shield:3, heal:2, coin:2},
    desc:'One perfect cut. Clearing exactly one line strikes for bonus damage.',
    ult:{name:'Iaido', need:8, spr:'katana', desc:'A single draw-cut that pierces armor: 10 damage plus 1.5 for every block on your grid.'},
    unlock:{text:'Deal 60 damage in one hit', cost:180, ok:s=>s.bestHit>=60}},
  pirate:{name:'Pirate', spr:'pirate', hp:62, gold:70, relic:'doubloon', potions:['smoke'], bag:{sword:5, shield:2, heal:2, coin:6},
    desc:'Plunder is power. Coin blocks also wound the enemy, and you start rich.',
    ult:{name:'Broadside', need:7, spr:'doubloon', desc:'Fire the cannons: spend up to 30 gold and deal 2 damage per gold (at least 14).'},
    unlock:{text:'Earn 300 Soul Shards in total', cost:200, ok:s=>s.shards>=300}},
  witch:{name:'Witch', spr:'witch', hp:56, gold:30, relic:'hexcharm', potions:['venom'], bag:{sword:4, shield:3, heal:2, coin:2, venom:3},
    desc:'Curses from the first move. Every enemy starts the fight already poisoned.',
    ult:{name:'Hex', need:7, spr:'hexcharm', desc:'Double every enemy\'s poison (at least +6) and delay their next move.'},
    unlock:{text:'Drink 25 potions in total', cost:200, ok:s=>s.potions>=25}},
  tinkerer:{name:'Tinkerer', spr:'tinkerer', hp:58, gold:35, relic:'gearbox', potions:['bomb'], bag:{sword:5, shield:3, heal:2, coin:2, blast:2},
    desc:'Gadgets and gunpowder. Blast blocks come built in and hit harder.',
    ult:{name:'Turret', need:7, spr:'gearbox', desc:'Deploy a turret that shoots the enemy after each of your next 5 moves.'},
    unlock:{text:'Clear 4 lines at once', cost:180, ok:s=>s.bestLines>=4}},
  vampire:{name:'Vampire', spr:'vampire', hp:58, gold:25, relic:'bloodchalice', potions:['health'], bag:{sword:6, shield:2, heal:2, coin:2},
    desc:'Drinks deep. Your clears heal you for part of the damage they deal.',
    ult:{name:'Blood Feast', need:8, spr:'bloodchalice', desc:'A piercing bite that heals you for all the damage it deals.'},
    unlock:{text:'Reach floor 4', cost:200, ok:s=>s.bestFloor>=4}},
  gladiator:{name:'Gladiator', spr:'gladiator', hp:68, gold:20, relic:'laurel', potions:['iron'], bag:{sword:6, shield:4, heal:2, coin:2},
    desc:'Grows with every victory. Each foe you defeat adds 2 max HP for the run.',
    ult:{name:'Showstopper', need:7, spr:'laurel', desc:'Gain 10 shield and strike for 20 plus 6 per combo streak, then +2 streak.'},
    unlock:{text:'Defeat 200 foes in total', cost:220, ok:s=>s.kills>=200}},
  shaman:{name:'Shaman', spr:'shaman', hp:60, gold:30, relic:'totem', potions:['luck'], bag:{sword:5, shield:3, heal:3, coin:2},
    desc:'Speaks with spirits. Every 4 moves a block on your grid turns Rainbow.',
    ult:{name:'Thunder', need:8, spr:'totem', desc:'Lightning strikes 6 random blocks on your grid: each fires its effect at x2.'},
    unlock:{text:'Clear 40 pure lines in total', cost:200, ok:s=>s.pures>=40}},
  cryomancer:{name:'Cryomancer', spr:'cryomancer', hp:58, gold:25, relic:'frostshard', potions:['iron'], bag:{sword:5, shield:4, heal:2, coin:2},
    desc:'At home in the cold. Ice never cracks into rubble and shatters for bonus damage.',
    ult:{name:'Deep Freeze', need:8, spr:'frostshard', desc:'Delay every enemy by 2 moves and gain shield (more for each ice block on your grid).'},
    unlock:{text:'Reach floor 5', cost:220, ok:s=>s.bestFloor>=5}},
  beastmaster:{name:'Beastmaster', spr:'beastmaster', hp:66, gold:25, relic:'whistle', potions:['health'], bag:{sword:5, shield:3, heal:3, coin:3},
    desc:'Never fights alone. Starts with a pet, and your pet acts a move sooner.',
    ult:{name:'Stampede', need:6, spr:'whistle', desc:'Your pet acts 3 times in a row.'},
    unlock:{text:'Play 10 runs', cost:200, ok:s=>s.runs>=10}},
};
function ULT(){ const u = CLASSES[run.cls].ult; return {...u, need: Math.max(3, u.need - (has('spellbook')?2:0) - (run.ultBonus||0))}; }
const isUnlocked = id => !CLASSES[id].unlock || !!(store.get('heroes', {})[id]);
function checkHeroUnlocks(){
  const st = stats(), h = store.get('heroes', {}); let any = null;
  Object.entries(CLASSES).forEach(([id,C])=>{ if(C.unlock && !h[id] && C.unlock.ok(st)){ h[id] = 1; any = id; } });
  if(Object.keys(CLASSES).every(isUnlocked)) unlock('allstar');
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
  holysymbol:{name:'Holy Symbol', spr:'holy', desc:'Heart blocks also deal 2 damage. Healing past full HP becomes shield.', r:0, starter:true},
  huntersmark:{name:'Hunter\'s Mark', spr:'mark', desc:'Pure lines give +1 multiplier instead of +0.5. Clears deal +3 damage per line.', r:0, starter:true},
  glove:{name:'Thief\'s Glove', spr:'glove', desc:'Gain 10 extra gold after every fight. Enemies can\'t steal from you.', r:1},
  boots:{name:'Iron Boots', spr:'boots', desc:'Cave-ins deal half damage and clear 3 rows instead of 2.', r:1},
  spellbook:{name:'Spellbook', spr:'spellbook', desc:'Your hero special needs 2 fewer lines to charge.', r:2},
  bloodgem:{name:'Bloodstone', spr:'bloodgem', desc:'Heal 5 HP after every fight.', r:1},
  tidecharm:{name:'Tide Charm', spr:'tidecharm', desc:'Gain 3 shield whenever you place a piece without clearing a line.', r:1},
  ironfist:{name:'Iron Gauntlet', spr:'ironfist', desc:'Your first damaging clear each fight deals +15 damage.', r:1},
  seerorb:{name:'Seer\'s Orb', spr:'seerorb', desc:'Combo streak bonuses are 50% stronger.', r:2},
  vampcape:{name:'Vampire Cape', spr:'vampcape', desc:'Whenever an enemy attacks you, it loses 2 HP.', r:2},
  warhorn:{name:'War Horn', spr:'warhorn', desc:'Elites and bosses start with 15% less HP.', r:2},
  bluelantern:{name:'Spirit Lantern', spr:'bluelantern', desc:'Earn 2 extra Soul Shards for every room you enter.', r:1},
  packrat:{name:'Packrat\'s Pouch', spr:'packrat', desc:'Placing a piece from your Stash gives 4 shield.', r:1},
  compass:{name:'Hunter\'s Compass', spr:'compass', desc:'Elite and boss rewards offer one more relic to choose from.', r:2},
  goldendice:{name:'Golden Dice', spr:'goldendice', desc:'+1 hand reroll each fight. Every reroll also gives 5 gold.', r:2},
  prayerbeads:{name:'Prayer Beads', spr:'prayerbeads', desc:'Missing a clear only lowers your combo streak by 1 instead of resetting it.', r:0, starter:true},
  seedpod:{name:'Seed Pod', spr:'seedpod', desc:'Start every fight with 3 heart blocks on your grid. Heart blocks heal +1.', r:0, starter:true},
  katana:{name:'Katana', spr:'katana', desc:'Clearing exactly one line deals +8 damage.', r:0, starter:true},
  doubloon:{name:'Cursed Doubloon', spr:'doubloon', desc:'Coin blocks also deal 1 damage each and give +1 gold.', r:0, starter:true},
  hexcharm:{name:'Hex Charm', spr:'hexcharm', desc:'Enemies start every fight with 5 poison.', r:0, starter:true},
  gearbox:{name:'Gearbox', spr:'gearbox', desc:'Blast blocks deal +4 damage.', r:0, starter:true},
  bloodchalice:{name:'Blood Chalice', spr:'bloodchalice', desc:'Heal 1 for every 6 damage your clears deal.', r:0, starter:true},
  laurel:{name:'Victor\'s Laurel', spr:'laurel', desc:'+2 max HP for every foe you defeat.', r:0, starter:true},
  totem:{name:'Spirit Totem', spr:'totem', desc:'Every 4 moves, a random block on your grid turns Rainbow.', r:0, starter:true},
  frostshard:{name:'Frost Shard', spr:'frostshard', desc:'Ice never cracks into rubble, and ice in your clears deals 4 damage each.', r:0, starter:true},
  whistle:{name:'Beast Whistle', spr:'whistle', desc:'Start with a random pet. Your pet acts 1 move sooner.', r:0, starter:true, onGet(){ if(!run.pet) run.pet = pick(Object.keys(PETS)); }},
  lute:{name:'Traveler\'s Lute', spr:'lute', desc:'Every 3rd clear in a row strikes a chord: +8 shield and heal 5.', r:0, starter:true},
  phial:{name:'Bottomless Phial', spr:'phial', desc:'The first potion you drink in each fight is not used up.', r:3},
  emberheart:{name:'Ember Heart', spr:'emberheart', desc:'Clearing 2+ lines at once also poisons the enemy for 3.', r:2},
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
  venom:{name:'Venom Vial', spr:'potion_venom', desc:'Poison the enemy for 8.', use(){ cb.enemy.poison += 8; floatText(eArt(), '+8 poison', '#dcb6ff'); sfx('poison'); }},
  mana:{name:'Mana Potion', spr:'potion_mana', desc:'Fully charge your hero special.', use(){ run.charge = ULT().need; floatText($('#ultBtn'), 'Charged!', '#c8fbff'); sfx('ult'); }},
  chaos:{name:'Chaos Brew', spr:'potion_chaos', desc:'Turn every piece in your hand into Rainbow blocks.', use(){ cb.hand.forEach(p=>{ if(!p.used) p.type='rainbow'; }); floatText($('#board'), 'Chaos!', '#f0d6ff', true); sfx('ult'); }},
  luck:{name:'Liquid Luck', spr:'potion_luck', desc:'Your next clear has its multiplier doubled.', use(){ cb.doubleNext = true; floatText($('#board'), 'Lucky!', '#86e6a8', true); sfx('trophy'); }},
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
  {id:'brew', name:'Potion', spr:'potion_health', desc:'Gain a random potion.', w:2, ok:()=>canPotion(), apply(){ givePotion(); }},
  ...Object.entries(UPGRADES).map(([k,u])=>({id:'up_'+k, name:u.name, spr:u.spr, desc:u.desc+' (permanent)', w:2.5, apply(){ run.lvl[k]++; }})),
  {id:'bag_add', name:'Recruit Blocks', spr:'bagicon', desc:'Add 2 blocks of a type you choose to your bag.', w:2.5, choose:true, apply(done){ chooseBlock('Recruit Blocks', 'Pick a block type to add 2 of.', addableTypes(), t=>{ if(t){ bagAdd(t,2); sfx('relic'); } done(!!t); }); }},
  {id:'bag_cut', name:'Trim the Bag', spr:'bagicon', desc:'Remove 2 blocks of a type you choose from your bag.', w:2, ok:()=>bagSize()-2>=BAG_MIN, choose:true, apply(done){ chooseBlock('Trim the Bag', 'Pick a block type to remove 2 of.', removableTypes(), t=>{ if(t){ bagRemove(t, Math.min(2, run.bag[t])); sfx('anvil'); } done(!!t); }); }},
];

const M = (k,v,t,n) => ({k,v,t,n});
const ENEMIES = [
  { normal:[
      {name:'Cave Rat', spr:'rat', hp:28, moves:[M('atk',5,3),M('atk',5,3),M('curse',2,2)]},
      {name:'Vampire Bat', spr:'bat', hp:22, moves:[M('atk',3,2),M('drain',4,3)]},
      {name:'Gloop', spr:'slime', hp:40, moves:[M('curse',3,3),M('atk',6,3)]},
      {name:'Cave Spider', spr:'spider', hp:30, moves:[M('ice',2,2),M('atk',4,2),M('atk',4,2)]},
      {name:'Kobold Thief', spr:'kobold', hp:26, moves:[M('atk',4,2),M('steal',8,3)]},
    ],
    elite:[
      {name:'Ogre', spr:'ogre', hp:85, moves:[M('armor',10,3),M('atk',15,5)]},
      {name:'Fungal Hulk', spr:'shroom', hp:75, passive:{id:'regen',v:2}, moves:[M('curse',4,3),M('atk',9,3),M('atk',9,3)]},
    ],
    bosses:[
      {name:'The Bone King', spr:'boneking', hp:150, passive:{id:'armor',v:10}, sigd:'Raises Skeleton Minions to fight beside it.', moves:[M('summon',28,2),M('atk',10,3),M('armor',12,2),M('multi',4,4,3)]},
      {name:'The Rat King', spr:'ratking', hp:145, sigd:'Gnaws away your best blocks.', moves:[M('atk',9,2),M('gnaw',4,3),M('multi',3,3,3),M('curse',3,2)]},
      {name:'The Slime Queen', spr:'slimequeen', hp:165, sig:'split', sigd:'At half HP she splits off a Slimeling.', moves:[M('atk',8,2),M('curse',3,2),M('atk',12,3),M('heal',10,3)]},
      {name:'The Spore Mother', spr:'shroomqueen', hp:155, passive:{id:'regen',v:2}, sigd:'Rubble on your grid spreads like mold.', moves:[M('curse',2,2),M('overgrow',4,2),M('atk',10,3)]},
      {name:'The Kobold Chief', spr:'koboldchief', hp:140, sigd:'Snatches pieces right out of your hand.', moves:[M('snatch',1,2),M('atk',9,2),M('steal',12,3),M('multi',4,3,3)]},
      {name:'The Brood Mother', spr:'spidermatron', hp:150, sigd:'Spins webs over your empty cells.', moves:[M('web',5,2),M('atk',8,2),M('multi',3,4,3)]},
    ],
  },
  { normal:[
      {name:'Skeleton', spr:'skeleton', hp:52, moves:[M('armor',8,2),M('atk',12,4)]},
      {name:'Goblin', spr:'goblin', hp:48, moves:[M('atk',8,3),M('bomb',1,2),M('multi',4,4,3)]},
      {name:'Wisp', spr:'ghost', hp:40, passive:{id:'ethereal'}, moves:[M('atk',7,2),M('curse',3,2)]},
      {name:'Shambler', spr:'zombie', hp:62, moves:[M('atk',9,3),M('rage',2,2),M('atk',9,3)]},
      {name:'Banshee', spr:'banshee', hp:46, passive:{id:'ethereal'}, moves:[M('sap',2,2),M('atk',9,2),M('shuffle',0,3)]},
      {name:'Bone Archer', spr:'bonearcher', hp:50, moves:[M('multi',3,3,3),M('chain',3,2),M('armor',6,2)]},
    ],
    elite:[
      {name:'Warlock', spr:'warlock', hp:115, moves:[M('curse',5,3),M('atk',12,2),M('heal',15,3)]},
      {name:'Mimic', spr:'mimic', hp:125, passive:{id:'thorns',v:2}, moves:[M('multi',5,4,3),M('chain',3,2),M('armor',12,2),M('atk',15,4)]},
    ],
    bosses:[
      {name:'The Hydra', spr:'hydra', hp:240, passive:{id:'regen',v:3}, sigd:'Grows new heads: each one adds a hit to its multi-attacks.', moves:[M('multi',5,3,3),M('grow',1,3),M('curse',4,3),M('atk',16,4)]},
      {name:'The Vampire Lord', spr:'vampirelord', hp:230, sigd:'Feasts on your heart blocks to heal.', moves:[M('feast',10,3),M('drain',12,3),M('atk',15,3)]},
      {name:'The Grave Warden', spr:'gravewarden', hp:235, sigd:'Hexes the pieces in your hand into rubble.', moves:[M('hex',2,3),M('atk',14,3),M('armor',12,2),M('curse',3,2)]},
      {name:'The Wailing Bride', spr:'wailingbride', hp:220, passive:{id:'ethereal'}, sigd:'Haunts your grid, swapping your rows around.', moves:[M('haunt',2,2),M('atk',13,2),M('sap',3,3)]},
      {name:'The Pharaoh', spr:'pharaoh', hp:250, passive:{id:'armor',v:10}, sigd:'Pours sand that falls to the bottom of your grid.', moves:[M('sandfall',5,2),M('atk',15,3),M('curse',3,3)]},
      {name:'The Bone Colossus', spr:'bonecolossus', hp:260, passive:{id:'thorns',v:2}, sigd:'Quakes the ground: every block falls to the bottom.', moves:[M('quake',10,3),M('armor',14,2),M('atk',18,4)]},
    ],
  },
  { normal:[
      {name:'Fire Imp', spr:'imp', hp:60, moves:[M('atk',7,2),M('bomb',2,2),M('atk',7,2)]},
      {name:'Cultist', spr:'cultist', hp:68, moves:[M('rage',3,2),M('atk',12,3),M('drain',8,3)]},
      {name:'Wyrmling', spr:'wyrm', hp:78, moves:[M('atk',15,3),M('ice',4,3)]},
      {name:'Gargoyle', spr:'gargoyle', hp:72, passive:{id:'armor',v:15}, moves:[M('armor',10,3),M('atk',13,3)]},
      {name:'Lava Golem', spr:'lavagolem', hp:85, passive:{id:'thorns',v:2}, moves:[M('atk',14,3),M('curse',3,2)]},
    ],
    elite:[
      {name:'Stone Golem', spr:'golem', hp:165, passive:{id:'armor',v:20}, moves:[M('armor',15,3),M('atk',17,3),M('curse',5,3)]},
      {name:'Dark Knight', spr:'darkknight', hp:150, passive:{id:'thorns',v:3}, moves:[M('atk',20,4),M('armor',12,2),M('multi',7,3,2)]},
    ],
    bosses:[
      {name:'Ancient Dragon', spr:'dragon', hp:340, passive:{id:'armor',v:20}, sigd:'Breathes fire down your fullest column, burning every block in it.', moves:[M('breath',3,3),M('atk',22,4),M('rage',3,2),M('multi',6,4,4)]},
      {name:'The Magma Titan', spr:'magmatitan', hp:350, passive:{id:'thorns',v:3}, sigd:'Erupts, turning a 3x3 patch of your grid to rock.', moves:[M('erupt',0,3),M('atk',20,3),M('armor',15,2)]},
      {name:'The Firebird', spr:'firebird', hp:280, sig:'rebirth', sigd:'Rises from its ashes once at half health.', moves:[M('atk',16,2),M('bomb',2,2),M('multi',6,3,3)]},
      {name:'The Fire Giant', spr:'firegiant', hp:360, sigd:'Inferno: hits harder the more blocks sit on your grid.', moves:[M('inferno',1,3),M('atk',20,3),M('rage',3,2)]},
      {name:'The High Priest', spr:'highpriest', hp:320, sigd:'Channels a deadly ritual. Hit it hard enough to break it.', moves:[M('ritual',40,4),M('drain',12,3),M('heal',20,3)]},
      {name:'The Obsidian Golem', spr:'obsidiangolem', hp:360, passive:{id:'armor',v:20}, sigd:'Its ward makes it immune to rows or to columns.', moves:[M('ward',0,2),M('atk',22,3),M('petrify',3,3)]},
    ],
  },
  { normal:[
      {name:'Frost Wisp', spr:'frostwisp', hp:70, passive:{id:'ethereal'}, moves:[M('ice',3,2),M('atk',12,2)]},
      {name:'Ice Spider', spr:'icespider', hp:76, moves:[M('ice',3,2),M('atk',10,2),M('atk',10,2)]},
      {name:'Snow Yeti', spr:'yeti', hp:96, moves:[M('atk',16,3),M('rage',3,2),M('atk',16,3)]},
      {name:'Frozen Skeleton', spr:'frostskel', hp:82, moves:[M('armor',12,2),M('chain',4,2),M('atk',15,3)]},
      {name:'Frost Troll', spr:'frosttroll', hp:105, passive:{id:'regen',v:4}, moves:[M('atk',17,3),M('ice',3,2)]},
    ],
    elite:[
      {name:'Frost Golem', spr:'frostgolem', hp:190, passive:{id:'armor',v:25}, moves:[M('armor',18,3),M('ice',5,3),M('atk',20,3)]},
      {name:'Ice Witch', spr:'icewitch', hp:165, moves:[M('ice',6,3),M('atk',14,2),M('sap',3,3),M('heal',20,3)]},
    ],
    bosses:[
      {name:'The Frost Lich', spr:'lich', hp:380, passive:{id:'regen',v:4}, sigd:'Freezes an entire row of your grid solid.', moves:[M('freezerow',0,3),M('petrify',4,3),M('multi',6,4,4),M('sap',4,3),M('atk',24,4)]},
      {name:'The Glacier Queen', spr:'glacierqueen', hp:390, sigd:'Pushes a wall of ice up from the bottom of your grid.', moves:[M('rise',0,3),M('atk',20,3),M('ice',4,2)]},
      {name:'The Yeti King', spr:'yetiking', hp:400, sigd:'Its roar silences your special for a few moves.', moves:[M('roar',3,3),M('atk',24,3),M('rage',4,2)]},
      {name:'The Frost Wyrm', spr:'frostwyrm', hp:370, sigd:'Shatters every ice block on your grid into shrapnel.', moves:[M('ice',6,2),M('shatter',3,3),M('atk',20,3)]},
      {name:'The Mirror Witch', spr:'mirrorwitch', hp:360, sigd:'Raises a mirror that reflects half of your next hit.', moves:[M('reflect',0,2),M('atk',18,2),M('shuffle',0,3)]},
      {name:'The Frozen Behemoth', spr:'mammoth', hp:420, sig:'shell', sigd:'Its icy hide halves damage unless your clear includes a pure line.', moves:[M('atk',26,4),M('ice',4,2),M('armor',15,3)]},
    ],
  },
  { normal:[
      {name:'Void Imp', spr:'voidimp', hp:86, moves:[M('atk',11,2),M('bomb',2,2),M('shuffle',0,2),M('atk',11,2)]},
      {name:'Abyssal Ooze', spr:'voidslime', hp:112, moves:[M('curse',5,3),M('petrify',3,3),M('atk',14,3)]},
      {name:'Void Eye', spr:'voideye', hp:96, passive:{id:'thorns',v:3}, moves:[M('sap',3,2),M('atk',16,3),M('drain',12,3)]},
      {name:'Shade', spr:'shade', hp:82, passive:{id:'ethereal'}, moves:[M('atk',13,2),M('shuffle',0,2),M('drain',10,3)]},
      {name:'Void Spider', spr:'voidspider', hp:92, moves:[M('petrify',3,2),M('atk',15,2),M('steal',15,3)]},
    ],
    elite:[
      {name:'Abyssal Knight', spr:'abyssknight', hp:220, passive:{id:'thorns',v:4}, moves:[M('atk',26,4),M('chain',4,2),M('armor',18,2),M('multi',9,3,3)]},
      {name:'Chaos Wyrm', spr:'chaoswyrm', hp:205, passive:{id:'enrage',v:6}, moves:[M('atk',22,3),M('ice',5,3),M('petrify',4,3)]},
    ],
    bosses:[
      {name:'The Demon Lord', spr:'demonlord', hp:470, passive:{id:'enrage',v:8}, sigd:'Flips your whole grid like a mirror.', moves:[M('flip',0,3),M('atk',28,4),M('multi',8,4,4),M('petrify',5,3),M('sap',5,3)]},
      {name:'The Leviathan', spr:'leviathan', hp:480, sigd:'Its undertow drags your grid one column sideways.', moves:[M('tide',0,2),M('atk',26,3),M('drain',16,3)]},
      {name:'The Chaos Jester', spr:'jester', hp:440, sigd:'Scrambles the types of every block on your grid.', moves:[M('scramble',0,2),M('multi',7,4,3),M('shuffle',0,2),M('atk',24,3)]},
      {name:'The Chronomancer', spr:'chronomancer', hp:450, sigd:'Rewinds time, undoing the damage you dealt.', moves:[M('atk',26,3),M('sap',5,2),M('rewind',0,4),M('ice',5,3)]},
      {name:'The Doom Watcher', spr:'doomwatcher', hp:460, passive:{id:'thorns',v:3}, sigd:'Marks a line for doom. Clear it in time or take a huge hit.', moves:[M('doom',40,4),M('atk',24,3),M('petrify',4,3)]},
      {name:'The Nameless Maw', spr:'nameless', hp:500, sigd:'Devours a chunk of your grid and heals from it.', moves:[M('devour',0,3),M('atk',28,3),M('curse',5,2),M('multi',8,3,4)]},
    ],
  },
];
const FS = arr => arr[Math.min(run.floor, arr.length)-1];
const floorIdx = () => run.floor<=5 ? run.floor-1 : 2 + ((run.floor-6) % 3);
const floorPool = () => ENEMIES[floorIdx()];
const endlessMul = () => run.floor>5 ? 1 + 0.3*(run.floor-5) : 1;
const floorName = () => run.floor<=5 ? FLOOR_NAMES[run.floor-1] : `Endless Depth ${run.floor-5}`;
const GOBLIN = {name:'Treasure Goblin', spr:'goldgoblin', hp:34, rare:true, moves:[M('flee',0,7)]};
const ALL_ENEMIES = [...ENEMIES.flatMap((f,i)=>[...f.normal.map(e=>({...e,floor:i+1})), ...f.elite.map(e=>({...e,floor:i+1,elite:true})), ...f.bosses.map(b=>({...b,floor:i+1,boss:true}))]), {...GOBLIN, floor:0}];
function bossFor(fl){
  fl = fl || run.floor; run.bossPick = run.bossPick || {};
  const list = (fl<=5 ? ENEMIES[fl-1] : ENEMIES[2 + ((fl-6) % 3)]).bosses;
  if(run.bossPick[fl]==null) run.bossPick[fl] = run.daily ? withSeed(runSeed('boss'+fl), ()=>rand(0, list.length-1)) : rand(0, list.length-1);
  return list[run.bossPick[fl] % list.length];
}
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
  den:{spr:'r_den', name:'Beast Den', desc:'Adopt a pet companion.'},
  forge:{spr:'anvil', name:'Forge', desc:'Temper your blocks or reforge a relic.'},
};
const FLOORS = 5, STEPS = 8;

/* ================= pets ================= */
const PETS = {
  bat:{name:'Bat Familiar', spr:'bat', every:4, desc:'Every 4 moves, bites the enemy for 6 (more on deeper floors).', act(){ damageEnemy(6 + 2*(Math.min(run.floor,8)-1), true); }},
  slime:{name:'Pet Slime', spr:'slime', every:5, desc:'Every 5 moves, heals you for 7.', act(){ const b = run.hp; heal(7); floatText(hpEl(), `+${run.hp-b}`, '#86e6a8'); }},
  turtle:{name:'Shell Buddy', spr:'turtle', every:4, desc:'Every 4 moves, gives you 8 shield.', act(){ cb.shield += 8; floatText($('#shieldStat'), '+8', '#a8ceff'); }},
  wisp:{name:'Friendly Wisp', spr:'ghost', every:5, desc:'Every 5 moves, adds 2 charge to your special.', act(){ run.charge = Math.min(ULT().need, run.charge+2); floatText($('#ultBtn'), '+2', '#c8fbff'); }},
  rat:{name:'Lucky Rat', spr:'rat', every:5, desc:'Every 5 moves, sniffs out 6 gold.', act(){ run.gold += 6; floatText($('#goldWrap'), '+6', '#ffe58a'); questAdd('gold', 6); }},
  spider:{name:'Weaver', spr:'spider', every:4, desc:'Every 4 moves, poisons the enemy for 4.', act(){ cb.enemy.poison += 4; floatText(eArt(), '+4 poison', '#dcb6ff'); }},
  imp:{name:'Ember Imp', spr:'imp', every:6, desc:'Every 6 moves, burns away all rubble and ice for 2 damage each.', act(){
    const now = performance.now(); let n = 0; cb.board.forEach((t,i)=>{ if(JUNK(t)){ shards(i,t,5); cb.fx.push({i,type:t,t0:now}); cb.board[i]=null; n++; } });
    if(n) damageEnemy(2*n, true); else floatText($('#board'), 'Nothing to burn', '#ffb07a'); }},
};
function petTick(){
  if(!run.pet || !PETS[run.pet] || cb.over) return;
  const P = PETS[run.pet]; cb.petT = (cb.petT||0) + 1;
  if(cb.petT >= P.every - (setOn('wild')?1:0) - (has('whistle')?1:0)){ cb.petT = 0; sfx('pet', run.pet); bump($('#petChip'),'petgo'); P.act(); }
}

/* ================= daily quests ================= */
const QUESTS = {
  lines:{text:'Clear 25 lines', goal:25, spr:'r_combat'},
  kills:{text:'Defeat 8 enemies', goal:8, spr:'sword'},
  elites:{text:'Defeat 2 elites', goal:2, spr:'r_elite'},
  pures:{text:'Clear 3 pure lines', goal:3, spr:'gem'},
  ults:{text:'Use your special 3 times', goal:3, spr:'flame'},
  gold:{text:'Collect 150 gold', goal:150, spr:'coin'},
  potions:{text:'Drink 3 potions', goal:3, spr:'potion_health'},
  floor:{text:'Reach floor 3', goal:3, spr:'r_rest', max:true},
  bosses:{text:'Defeat a boss', goal:1, spr:'r_boss'},
  triples:{text:'Clear 3+ lines with one piece', goal:2, spr:'bomb'},
  rooms:{text:'Enter 12 rooms', goal:12, spr:'r_event'},
  pets:{text:'Have your pet act 6 times', goal:6, spr:'r_den'},
};
function todayKey(){ const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function quests(){
  let q = store.get('quests', null);
  if(!q || q.date !== todayKey()){
    let h = 0; for(const ch of todayKey()) h = (h*31 + ch.charCodeAt(0)) >>> 0;
    const ids = Object.keys(QUESTS), pickd = [];
    while(pickd.length<3){ h = (h*1103515245 + 12345) >>> 0; const id = ids[h % ids.length]; if(!pickd.includes(id)) pickd.push(id); }
    q = {date: todayKey(), ids: pickd, prog:{}, claimed:{}, bonus:false};
    store.set('quests', q);
  }
  return q;
}
function questAdd(key, n){
  if(!n) return;
  const q = quests(); if(!q.ids.includes(key)) return;
  const Q = QUESTS[key], before = q.prog[key]||0;
  q.prog[key] = Q.max ? Math.max(before, n) : before + n;
  store.set('quests', q);
  if(before < Q.goal && q.prog[key] >= Q.goal) setTimeout(()=>{ sfx('trophy'); toast(`<b>Quest complete!</b><br>${Q.text}. Claim your reward on the title screen.`, 'scroll', 3000); }, 400);
}
const QUEST_REWARD = 25, QUEST_BONUS = 30;

/* ================= hero mastery ================= */
const MASTERY = [0, 60, 160, 320, 560];
const MASTERY_PERKS = ['', '+5 max HP', 'Start with an extra random potion', 'Start with a random common relic', 'Your special starts fully charged in the first fight'];
function masteryXp(cls){ return +(store.get('mastery', {})[cls] || 0); }
function masteryLevel(cls){ const x = masteryXp(cls); let l = 1; MASTERY.forEach((t,i)=>{ if(x>=t) l = i+1; }); return l; }

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
  relics15:{name:'Hoard of Wonders', desc:'Hold 15 relics in one run.', spr:'holy'},
  stasher:{name:'Saved for Later', desc:'Place a piece from your Stash.', spr:'packrat'},
  daily:{name:'Daily Devotion', desc:'Finish a Daily Challenge run.', spr:'calendar'},
  mutant:{name:'Glutton for Punishment', desc:'Win a run with 3 or more mutators.', spr:'mutator'},
  decorator:{name:'Interior Decorator', desc:'Unlock a new board theme.', spr:'palette'},
  collector:{name:'Window Shopper', desc:'Buy something in the Bazaar.', spr:'shard'},
  level8:{name:'Seasoned', desc:'Reach level 8 in a single run.', spr:'trophy'},
  bossdex:{name:'Boss Hunter', desc:'Defeat 10 different bosses.', spr:'r_boss'},
  minion:{name:'Crowd Control', desc:'Defeat a boss\'s minion.', spr:'skeleton'},
  allstar:{name:'Full Roster', desc:'Unlock all 20 heroes.', spr:'knight'},
  setbonus:{name:'Matching Set', desc:'Complete a relic set (3 relics from one family).', spr:'r_treasure'},
  bard:{name:'Encore!', desc:'Win a run as the Bard.', spr:'bard'},
  endless:{name:'Bottomless', desc:'Reach Endless Depth 3.', spr:'voideye'},
  petpal:{name:'Best Friends', desc:'Adopt a pet companion.', spr:'r_den'},
  questor:{name:'Daily Grind', desc:'Complete all three daily quests in one day.', spr:'scroll'},
  master:{name:'Master Adventurer', desc:'Reach Mastery 5 with any hero.', spr:'paladin'},
  thief:{name:'Sticky Fingers', desc:'Defeat a Kobold Thief or Void Spider.', spr:'glove'},
  duo:{name:'Double Trouble', desc:'Win a fight against two foes at once.', spr:'r_combat'},
  flawless:{name:'Untouchable', desc:'Beat a boss without losing HP in that fight.', spr:'mirror'},
  goblin:{name:'Finders Keepers', desc:'Catch a Treasure Goblin.', spr:'goldgoblin'},
};
function unlock(id){
  const a = store.get('ach', {}); if(a[id]) return;
  a[id] = Date.now(); store.set('ach', a);
  setTimeout(()=>{ sfx('trophy'); toast(`<b>Trophy unlocked</b><br>${ACH[id].name}: ${ACH[id].desc}`, 'trophy', 3200); }, 500);
}

/* ================= mutators ================= */
const MUTS = {
  glass:{name:'Glass Cannon', spr:'sword', desc:'Sword blocks deal +2 damage, but you have 30% less max HP.', bonus:0.25},
  frail:{name:'Frail Shields', spr:'armor', desc:'Shield blocks give half as much shield.', bonus:0.2},
  swarm:{name:'Swarm', spr:'rat', desc:'Regular enemies have 30% more HP.', bonus:0.2},
  hasty:{name:'Hasty Foes', spr:'hourglass', desc:'Enemy actions arrive 1 turn sooner.', bonus:0.3},
  heavy:{name:'Heavy Pieces', spr:'r_combat', desc:'Big pieces show up far more often.', bonus:0.15},
  dry:{name:'Teetotaler', spr:'potion_iron', desc:'No potions at all: you start with none and find none.', bonus:0.2},
  rush:{name:'Gold Rush', spr:'coin', desc:'Fights give double gold, but merchants charge 50% more.', bonus:0},
  blessed:{name:'Blessed Start', spr:'holy', desc:'Start with a random uncommon relic. Earn 25% fewer Soul Shards.', bonus:-0.25},
};
const mut = id => !!run && (run.muts||[]).includes(id);
const mutBonus = list => (list||[]).reduce((m,id)=>m*(1+(MUTS[id]?MUTS[id].bonus:0)), 1);

/* ================= board themes (Bazaar > Boards) ================= */
const THEMES = {
  stone:{name:'Dungeon Stone', board:'#0b080e', edge:'#4a3f58', a:'#1a1520', b:'#1e1825'},
  frost:{name:'Frozen Crypt', board:'#07121a', edge:'#5aa0c8', a:'#0f2230', b:'#132a3a', unlock:{text:'Reach floor 4', ok:s=>s.bestFloor>=4}},
  grove:{name:'Mossy Grove', board:'#08120b', edge:'#3dbb6a', a:'#102016', b:'#15291c', unlock:{text:'Adopt a pet', ok:()=>!!store.get('ach',{}).petpal}},
  ember:{name:'Dragon Ember', board:'#150806', edge:'#e0602a', a:'#26100b', b:'#2f150f', unlock:{text:'Defeat the Ancient Dragon', ok:()=>!!store.get('ach',{}).dragon}},
  void:{name:'The Abyss', board:'#0a0614', edge:'#9d4edd', a:'#170f26', b:'#1d1431', unlock:{text:'Reach floor 5', ok:s=>s.bestFloor>=5}},
  royal:{name:'Royal Velvet', board:'#14060f', edge:'#ef5258', a:'#26101c', b:'#2e1422', unlock:{text:'Complete a Daily Challenge', ok:()=>!!store.get('ach',{}).daily}},
  gold:{name:'Golden Hoard', board:'#141006', edge:'#f7c936', a:'#241c0a', b:'#2c230e', unlock:{text:'Win a run', ok:s=>s.wins>=1}},
  midnight:{name:'Midnight', board:'#05070f', edge:'#3a5a9a', a:'#0c1222', b:'#101830', cost:60},
  ocean:{name:'Sunken Reef', board:'#04100f', edge:'#2ad1c0', a:'#0a201e', b:'#0e2a28', cost:80},
  toxic:{name:'Toxic Sludge', board:'#0a1004', edge:'#9aff3c', a:'#141f0a', b:'#1a280e', cost:80},
  sakura:{name:'Sakura Shrine', board:'#140a10', edge:'#ff9ac8', a:'#24131c', b:'#2c1822', cost:100},
  candy:{name:'Candy Keep', board:'#140b16', edge:'#ffd6f0', a:'#2a1830', b:'#33203a', cost:100},
};
const themeOk = id => { const T = THEMES[id]; if(!T) return false; if(T.cost) return !!cosm().owned['t_'+id]; return !T.unlock || T.unlock.ok(stats()); };
/* ================= Bazaar cosmetics (bought with Soul Shards) ================= */
const COSM = {
  skin:{title:'Block Skins', items:{
    classic:{name:'Classic Gloss', cost:0, desc:'The original glossy sticker blocks.'},
    candy:{name:'Candy Drops', cost:80, desc:'Round, shiny and sweet.'},
    jelly:{name:'Jelly Cubes', cost:90, desc:'Wobbly see-through jelly with bubbles inside.'},
    rune:{name:'Rune Tiles', cost:100, desc:'Carved stone slabs with colored inlays.'},
    gem:{name:'Cut Gems', cost:120, desc:'Faceted jewels that catch the light.'},
    neon:{name:'Neon Glow', cost:150, desc:'Dark tiles with glowing edges.'},
    gilded:{name:'Gilded', cost:200, desc:'Classic blocks trimmed in gold.'},
  }},
  burst:{title:'Clear Bursts', items:{
    shards:{name:'Shards', cost:0, desc:'Chunks of block fly everywhere.'},
    sparks:{name:'Sparks', cost:60, desc:'Bright glowing sparks.'},
    confetti:{name:'Confetti', cost:70, desc:'Every clear is a party.'},
    bubbles:{name:'Bubbles', cost:70, desc:'Blocks pop into floating bubbles.'},
    stars:{name:'Starfall', cost:80, desc:'Spinning little stars.'},
    embers:{name:'Embers', cost:90, desc:'Blocks burn away into rising embers.'},
    petals:{name:'Petals', cost:90, desc:'A drift of flower petals.'},
    coins:{name:'Jackpot', cost:120, desc:'Blocks burst into spinning gold coins.'},
  }},
  trail:{title:'Projectile Trails', items:{
    comet:{name:'Comet', cost:0, desc:'A bright streak.'},
    ribbon:{name:'Ribbon', cost:60, desc:'Long flowing ribbons.'},
    stardust:{name:'Stardust', cost:70, desc:'Leaves a sparkle behind.'},
    orb:{name:'Wisp Orbs', cost:80, desc:'Big soft glowing orbs.'},
    shadow:{name:'Shadow', cost:90, desc:'Smoky shadow bolts.'},
    bolt:{name:'Lightning', cost:100, desc:'Crackling bolts of lightning.'},
  }},
};
function cosm(){ const c = Object.assign({skin:'classic', burst:'shards', trail:'comet', owned:{}}, store.get('cos', {})); if(!c.owned) c.owned = {}; return c; }
const cosOwned = (cat, id) => !COSM[cat].items[id].cost || !!cosm().owned[cat+'_'+id];
let curSkin = 'classic';
function syncCosmetics(){ const c = cosm(); curSkin = COSM.skin.items[c.skin] && cosOwned('skin', c.skin) ? c.skin : 'classic'; for(const k in BLK) delete BLK[k]; }
const theme = () => { const t = store.get('theme','stone'); return THEMES[t] && themeOk(t) ? THEMES[t] : THEMES.stone; };

/* ================= seeded randomness (Daily Challenge) ================= */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1 | a); t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t; return ((t ^ t>>>14) >>> 0) / 4294967296; }; }
function hashStr(s){ let h = 2166136261; for(const ch of s){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function withSeed(seed, fn){ const o = Math.random; Math.random = mulberry32(seed); try{ return fn(); } finally{ Math.random = o; } }
const runSeed = n => hashStr((run.daily||'') + '|' + n);
function dailyInfo(){
  const key = todayKey(), seed = hashStr('daily|' + key);
  return withSeed(seed, ()=>{
    const cls = pick(Object.keys(CLASSES));
    const muts = shuffle(Object.keys(MUTS).filter(k=>k!=='blessed')).slice(0,2);
    return {key, cls, muts};
  });
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
/* The save always describes exactly where you are:
   run.room = the room you're inside (null on the map), with its contents locked in,
   run.room.fight = a full snapshot of an in-progress fight, run.room.reward = a pending reward screen. */
function snapFight(){
  if(!cb || cb.over) return null;
  return {kind:cb.kind, board:cb.board.slice(), hand:cb.hand.map(p=>({cells:p.cells, h:p.h, w:p.w, type:p.type, used:!!p.used})),
    stash: cb.stash ? {cells:cb.stash.cells, h:cb.stash.h, w:cb.stash.w, type:cb.stash.type} : null, stashUsed: !!cb.stashUsed, lastClear: cb.lastClear||null, pile: (cb.pile||[]).slice(),
    shield:cb.shield, streak:cb.streak, rerolls:cb.rerolls, firstClear:cb.firstClear, doubleNext:cb.doubleNext,
    tookDmg:cb.tookDmg, mirror:cb.mirror, moves:cb.moves, phase:cb.phase||0, petT:cb.petT||0, firstHit:cb.firstHit,
    enemies:JSON.parse(JSON.stringify(cb.enemies)), webs:{...(cb.webs||{})}, silence:cb.silence||0, turret:cb.turret||0, windUsed:!!cb.windUsed, bombs:{...(cb.bombs||{})}, chains:(cb.chains||[]).map(c=>({...c})), weak:(cb.weak||[]).slice(), weakT:cb.weakT||0};
}
function saveRun(){
  if(!run) return;
  if(run.room && cb && !cb.over && screenName==='combat') run.room.fight = snapFight();
  store.set('save', run);
}
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) saveRun(); });
addEventListener('pagehide', ()=>saveRun());
function stats(){ return Object.assign({runs:0, wins:0, kills:0, bestFloor:0, bestLines:0, bestHit:0, winsBy:{}, potions:0, shards:0, pures:0}, store.get('stats', {})); }
function bumpStats(fn){ const s = stats(); fn(s); store.set('stats', s); }
function seen(){ return Object.assign({e:{}, r:{}}, store.get('seen', {})); }
function markSeen(kind, key){ const s = seen(); if(kind==='e'){ s.e[key] = s.e[key] || {seen:1, kills:0}; } else s.r[key] = 1; store.set('seen', s); }
function markKill(name){ const s = seen(); s.e[name] = s.e[name] || {seen:1, kills:0}; s.e[name].kills++; store.set('seen', s); }

function newRun(cls, opts){
  opts = opts || {};
  const C = CLASSES[cls], heat = opts.daily ? 0 : clamp(+(store.get('heatSel',0)), 0, store.get('heat',0));
  const hp = C.hp - (heat>=3 ? 10 : 0) + 5*skill('vit');
  run = {cls, heat, hp, maxHp:hp, gold:C.gold + 15*skill('purse'), relics:[C.relic], potions:C.potions.slice(), potionSlots:3, charge:0,
    jid:Date.now(), lvl:{sword:skill('whet'),shield:0,heal:0,coin:0}, floor:1, step:0, map:null, path:[], kills:0, bosses:0, dmg:0, bestLines:0, bestHit:0, phoenixUsed:false};
  if(RELICS[C.relic].onGet) RELICS[C.relic].onGet();
  run.bag = startingBag(cls);
  if(RELIC_BLOCKS[C.relic]){ const [t,n] = RELIC_BLOCKS[C.relic]; bagAdd(t, n); }
  for(let i=0;i<skill('belt');i++) givePotion();
  const ml = masteryLevel(cls);
  if(ml>=2){ run.maxHp += 5; run.hp += 5; }
  if(ml>=3) givePotion();
  if(ml>=4){ const [id] = relicOffers(1); if(id){ run.relics.push(id); markSeen('r', id); } }
  run.daily = opts.daily || null;
  run.muts = opts.daily ? opts.muts.slice() : (opts.muts || []).filter(k=>MUTS[k]);
  if(mut('glass')){ run.maxHp = Math.round(run.maxHp*0.7); run.hp = run.maxHp; }
  if(mut('dry')) run.potions = [];
  if(mut('blessed')){ const [id] = relicOffers(1, 2); if(id){ run.relics.push(id); markSeen('r', id); } }
  run.map = run.daily ? withSeed(runSeed(1), genMap) : genMap();
  bumpStats(s=>s.runs++);
  markSeen('r', C.relic);
  sfx('door');
  banner('Floor 1', FLOOR_NAMES[0]);
  goMap();
}
function validSave(s){
  return !!(s && typeof s==='object' && CLASSES[s.cls] && Array.isArray(s.relics) && Number.isFinite(s.hp) && Number.isFinite(s.floor) && s.floor>=1);
}
function migrate(r){
  if(!validSave(r)) throw new Error('bad save');
  r = Object.assign({heat:0, charge:0, path:[], potionSlots:3, bosses:0, rooms:0, pet:null, room:null, ultBonus:0, muts:[], daily:null, bestHit:0, bestLines:0, dmg:0, kills:0, lvl:{sword:0,shield:0,heal:0,coin:0}, level:1, xp:0, perks:{}, lvUp:0}, r);
  if(!r.map){ r.map = genMap(); r.path = []; r.step = 0; }
  delete r.choices;
  r.relics = r.relics.filter(id=>RELICS[id]);
  if(!r.bag || typeof r.bag!=='object' || !Object.keys(r.bag).length){ r.bag = Object.assign({}, CLASSES[r.cls].bag || DEFAULT_BAG); r.relics.forEach(id=>{ if(RELIC_BLOCKS[id]){ const [t,n] = RELIC_BLOCKS[id]; r.bag[t] = (r.bag[t]||0)+n; } }); }
  Object.keys(r.bag).forEach(t=>{ if(!TYPES[t] || !(r.bag[t]>0)) delete r.bag[t]; });
  r.potions = (r.potions||[]).filter(id=>POTIONS[id]);
  if(!Array.isArray(r.map) || r.map.length!==STEPS){ r.map = genMap(); r.path = []; r.room = null; }
  if(r.room && !r.room.t) r.room = null;
  const f = r.room && r.room.fight;
  if(f && !(Array.isArray(f.board) && f.board.length===N*N && Array.isArray(f.hand) && f.hand.length && (f.enemies||[f.enemy]).every(e=>e && Array.isArray(e.moves) && e.moves.length))) delete r.room.fight;
  if(f && r.room.fight && !f.enemies){ f.enemies = [f.enemy]; delete f.enemy; }
  if(r.room && r.room.tpl && !(Array.isArray(r.room.tpl.moves) && r.room.tpl.moves.length)) { delete r.room.tpl; delete r.room.maxHp; }
  return r;
}
function gainRelic(id){
  const sk = setOf(id), before = sk ? setCount(sk) : 0;
  run.relics.push(id); const R = RELICS[id]; if(R.onGet) R.onGet();
  if(RELIC_BLOCKS[id]){ const [t,n] = RELIC_BLOCKS[id]; bagAdd(t, n); setTimeout(()=>toast(`<b>+${n} ${TYPES[t].name} blocks</b><br>Added to your bag.`, 'bagicon'), 1400); }
  if(sk && before<3 && setCount(sk)>=3) setTimeout(()=>{ sfx('trophy'); toast(`<b>${SETS[sk].name} set complete!</b><br>${SETS[sk].bonus}`, R.spr, 3600); unlock('setbonus'); }, 900);
  markSeen('r', id);
  if(run.relics.length>=10) unlock('relics10');
  if(run.relics.length>=15) unlock('relics15');
  renderRunbar(); toast(`<b>${R.name}</b><br>${R.desc}`, R.spr); sfx('relic');
}
function relicOffers(n, minR=1){
  const free = Object.keys(RELICS).filter(id=>!has(id) && !RELICS[id].starter);
  const pool = free.filter(id=>RELICS[id].r>=minR);
  return shuffle(pool.length>=n?pool:free).slice(0,n);
}
/* ================= relic sets: hold 3 from one family for a bonus ================= */
const SETS = {
  gold:{name:'Gold', col:'#f7c936', relics:['idol','magnet','crown','clover','glove','goldendice'], bonus:'Coin blocks give +2 gold and fight rewards give 20% more gold.'},
  blood:{name:'Blood', col:'#ef5258', relics:['fang','bloodpact','vampcape','bloodgem','leech','emberheart'], bonus:'Heal 1 HP for every line you clear.'},
  arcane:{name:'Arcane', col:'#c77dff', relics:['prism','spellbook','seerorb','battery','ring','purist'], bonus:'Clearing 2+ lines at once adds 1 extra special charge.'},
  iron:{name:'Iron', col:'#a8b4c4', relics:['chainmail','tower','spikes','boots','ironfist','stoneward','thickskin','mirror'], bonus:'Start every fight with 10 extra shield.'},
  blast:{name:'Blast', col:'#ff8a3c', relics:['powder','sledge','satchel','crossed','warhorn','scythe','whetstone'], bonus:'Clearing 3+ lines at once deals 10 extra damage.'},
  wild:{name:'Wild', col:'#45c674', relics:['feather','cauldron','hearth','toxin','warmcloak','tidecharm','packrat','souljar','bluelantern','compass','phial','hourglass','dice','drum','phoenix'], bonus:'Heal 6 HP after every fight, and pets act 1 move sooner.'},
};
const setOf = id => Object.keys(SETS).find(k=>SETS[k].relics.includes(id)) || null;
const setCount = k => !run ? 0 : run.relics.filter(id=>SETS[k].relics.includes(id)).length;
const setOn = k => setCount(k) >= 3;
const canPotion = () => !!run && !mut('dry') && run.potions.length < run.potionSlots;
function givePotion(id){
  if(mut('dry') || run.potions.length >= run.potionSlots) return false;
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
  $('#runbar').hidden = !run || ['title','heroes','codex','trophies','skills','journal','wardrobe'].includes(which);
  selPotion = -1;
  document.querySelectorAll('.coach').forEach(c=>c.remove());
  document.documentElement.classList.toggle('lock', which==='combat');
  if(run) renderRunbar();
  updateDanger();
  Sound.music(['title','heroes','codex','trophies','skills','journal','wardrobe'].includes(which) ? 'menu' : which==='combat' ? (cb&&cb.kind==='boss'?'boss':run&&run.floor>FLOORS?'endless':'combat') : which==='shop' ? 'shop' : which==='rest' ? 'rest' : 'map');
  window.scrollTo(0,0);
}
function updateDanger(){ document.body.classList.toggle('danger', !!run && screenName==='combat' && run.hp>0 && run.hp/run.maxHp<=0.3); }
function renderRunbar(){
  if(!run) return;
  const hi = $('#heroIcon'); hi.innerHTML = img(CLASSES[run.cls].spr, 34) + `<b class="lvb">${run.level||1}</b>`; hi.onclick = openPerks;
  const xf = $('#xpFill'); if(xf) xf.style.width = (100*(run.xp||0)/xpNeed(run.level||1))+'%';
  const pct = (100*Math.max(0,run.hp)/run.maxHp)+'%';
  $('#hpFill').style.width = pct; $('#hpTrail').style.width = pct;
  $('#hpText').textContent = `${Math.max(0,run.hp)} / ${run.maxHp}`;
  if(!$('#coinIcon').firstChild) $('#coinIcon').innerHTML = img('coin', 22);
  tween($('#goldText'), run.gold);
  if(run.gold>=200) unlock('rich');
  $('#floorText').textContent = `F${run.floor}-${Math.min(run.step+1,STEPS)}${run.heat?` H${run.heat}`:''}`;
  const bb = $('#bagBtn'); if(!bb.dataset.k){ bb.innerHTML = img('bagicon',26); bb.dataset.k = '1'; } bb.onclick = openBag;
  const pb = $('#potionBar'); pb.innerHTML = '';
  for(let i=0;i<run.potionSlots;i++){
    const id = run.potions[i]; const b = document.createElement('button');
    b.className = 'slot'+(id?'':' empty')+(i===selPotion?' sel':'');
    b.setAttribute('aria-label', id ? POTIONS[id].name : 'Empty potion slot');
    if(id){ b.innerHTML = img(POTIONS[id].spr, 26); b.onclick = ()=>potionTap(i); }
    pb.appendChild(b);
  }
  const rc = $('#relicCount'); rc.textContent = `${run.relics.length}`; rc.onclick = openRelics;
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
function bagHTML(){
  const n = bagSize();
  return `<div class="bagrows">${BAG_TYPES.filter(t=>run.bag[t]).map(t=>`<div class="bagrow">${blockChip(t)}<b>${TYPES[t].name}</b><span class="bagbar"><i style="width:${100*run.bag[t]/n}%;background:${TYPES[t].c}"></i></span><span class="bagn">${run.bag[t]}</span><small>${Math.round(100*run.bag[t]/n)}%</small></div>`).join('')}</div>`;
}
function openBag(){
  if(!run) return; sfx('click');
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="card" role="dialog" aria-label="Block bag" style="max-height:84vh;overflow:auto">
    <div class="row"><h2 class="title" style="font-size:24px">Block Bag (${bagSize()})</h2>${img('bagicon',36)}</div>
    <p class="muted" style="font-size:13px">Every piece's block type is drawn from this bag. Add blocks you want more of and remove the ones you don't at merchants, forges, campfires and rewards.</p>
    ${bagHTML()}
    <button class="btn" id="closeBtn">Close</button></div>`;
  $('#closeBtn').onclick = closeSettings; m.onclick = e=>{ if(e.target===m) closeSettings(); };
}
/* pick a block type from a list; calls done(type) or done(null) if cancelled */
function chooseBlock(title, sub, types, done, cancelText){
  sfx('click'); const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="card" role="dialog" aria-label="${title}" style="max-height:84vh;overflow:auto">
    <div class="row"><h2 class="title" style="font-size:22px">${title}</h2>${img('bagicon',34)}</div>
    <p class="muted" style="font-size:13px">${sub}</p>
    <div class="blockpick">${types.map(t=>`<button class="bpick" data-t="${t}">${blockChip(t)}<b>${TYPES[t].name}</b><small>${(run.bag[t]||0)} in bag</small></button>`).join('')}</div>
    <button class="btn ghost" id="bpCancel">${cancelText||'Cancel'}</button></div>`;
  let used = false;
  m.querySelectorAll('.bpick').forEach(b=>b.onclick=()=>{ if(used) return; used = true; closeSettings(); done(b.dataset.t); });
  $('#bpCancel').onclick = ()=>{ if(used) return; used = true; closeSettings(); done(null); };
}
const removableTypes = () => BAG_TYPES.filter(t=>run.bag[t]>0);
const addableTypes = () => BAG_TYPES.filter(t=>['sword','shield','heal','coin'].includes(t) || run.bag[t]>0);
function openRelics(){
  if(!run) return; sfx('click');
  const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="card" role="dialog" aria-label="Relics" style="max-height:80vh;overflow:auto">
    <div class="row"><h2 class="title" style="font-size:24px">Relics (${run.relics.length})</h2>${img('r_treasure',34)}</div>
    <div class="setrow">${Object.entries(SETS).map(([k,S])=>{ const n = setCount(k); return n ? `<button class="setpill ${n>=3?'on':''}" style="--sc:${S.col}" data-s="${k}">${S.name} ${Math.min(n,3)}/3</button>` : ''; }).join('')}</div>
    <div id="setInfo">${Object.entries(SETS).filter(([k])=>setOn(k)).map(([k,S])=>`<div class="setinfo" style="--sc:${S.col}"><b>${S.name} set bonus active</b>${S.bonus}</div>`).join('')}</div>
    ${run.relics.map(id=>{ const R = RELICS[id], sk = setOf(id); return `<div class="troph">${img(R.spr,40)}<div><b>${R.name}${sk?` <span class="settag" style="color:${SETS[sk].col};border-color:${SETS[sk].col}">${SETS[sk].name}</span>`:''}</b><small>${R.desc}</small></div></div>`; }).join('')}
    <div class="troph">${img(ULT().spr,40)}<div><b>Special: ${ULT().name}</b><small>${ULT().desc} Needs ${ULT().need} lines.</small></div></div>
    ${run.pet&&PETS[run.pet]?`<div class="troph">${img(PETS[run.pet].spr,40)}<div><b>Pet: ${PETS[run.pet].name}</b><small>${PETS[run.pet].desc}</small></div></div>`:''}
    <button class="btn" id="closeBtn">Close</button></div>`;
  $('#closeBtn').onclick = closeSettings; m.onclick = e=>{ if(e.target===m) closeSettings(); };
  m.querySelectorAll('.setpill').forEach(p=>p.onclick=()=>{ const k = p.dataset.s, S = SETS[k], n = setCount(k); sfx('click');
    $('#setInfo').innerHTML = `<div class="setinfo" style="--sc:${S.col}"><b>${S.name} set ${Math.min(3,n)}/3 ${n>=3?'(active)':`(${3-n} more to activate)`}</b>${S.bonus}<small>${S.relics.map(id=>RELICS[id]?`${RELICS[id].name}${run.relics.includes(id)?' (owned)':''}`:'').filter(Boolean).join(' · ')}</small></div>`; });
}
function potionTap(i){
  const id = run.potions[i], P = POTIONS[id]; if(!P) return;
  const inFight = cb && !cb.over && !$('#combat').hidden;
  if(!inFight && !P.any){ toast(`<b>${P.name}</b><br>${P.desc}<br><span class="muted">Use it during a fight.</span>`, P.spr); return; }
  if(selPotion !== i){ selPotion = i; renderRunbar(); toast(`<b>${P.name}</b><br>${P.desc}<br><span class="muted">Tap again to drink.</span>`, P.spr); return; }
  selPotion = -1;
  if(inFight && has('phial') && !cb.phialUsed){ cb.phialUsed = true; floatText($('#potionBar'), 'Refilled!', '#ffb3e6'); }
  else run.potions.splice(i,1);
  bumpStats(s=>s.potions++); questAdd('potions', 1);
  sfx('potion'); P.use();
  renderRunbar();
  if(inFight){ if(!checkEnd()){ checkStuck(); renderHUD(); } }
  saveRun();
}
function view(html){ const v=$('#view'); v.innerHTML = `<div class="screen">${html}</div>`; return v; }
function choiceBtn({id,spr,name,desc,price,disabled,r,size}){
  let rar = r ? `<span class="rar rar${r}">${['','Common','Uncommon','Rare'][r]}</span>` : '';
  const rid = typeof id==='string' ? id.replace(/^r:/,'') : id, sk = RELICS[rid] && run ? setOf(rid) : null;
  if(sk) rar += ` <span class="settag" style="color:${SETS[sk].col};border-color:${SETS[sk].col}">${SETS[sk].name} set ${Math.min(3,setCount(sk) + (run.relics.includes(rid)?0:1))}/3</span>`;
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
  if(!settings.tips) return;
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
  const tg = (k,label,sub) => `<div class="row"><label>${label}${sub?`<small>${sub}</small>`:''}</label><button class="toggle ${settings[k]?'on':''}" data-k="${k}" aria-label="${label}"></button></div>`;
  const sl = (k,label) => `<div class="row"><label>${label}</label><input type="range" min="0" max="1" step="0.05" value="${settings[k]}" data-v="${k}" aria-label="${label} volume"></div>`;
  m.innerHTML = `<div class="card settings" role="dialog" aria-label="Settings">
    <div class="row"><h2 class="title" style="font-size:26px">Settings</h2>${img('gear',34)}</div>
    <h4>Audio</h4>
    ${sl('music','Music')}${sl('sfx','Sound effects')}${sl('amb','Ambience')}
    <h4>Display</h4>
    ${tg('shake','Screen shake')}${tg('flash','Flashes and particles')}${tg('motion','Reduce motion','Calmer animations')}
    ${tg('contrast','High-contrast blocks','Bolder block symbols')}${tg('dmgnums','Damage numbers')}
    <h4>Gameplay</h4>
    <div class="row"><label>Game speed<small>How fast animations play out</small></label><div class="seg" id="speedSeg"><button data-s="normal" class="${settings.speed==='normal'?'on':''}">Normal</button><button data-s="fast" class="${settings.speed==='fast'?'on':''}">Fast</button></div></div>
    ${tg('lefty','Left-handed layout','Special button on the left')}${tg('vibrate','Vibration')}${tg('tips','Show tips','Tutorial bubbles in fights')}
    <h4>Data</h4>
    <div class="row2"><button class="btn ghost" id="backupBtn" style="font-size:16px">Backup code</button><button class="btn ghost" id="restoreBtn" style="font-size:16px">Restore</button></div>
    ${run && screenName!=='end' ? '<button class="btn ghost" id="abandonBtn" style="font-size:16px">Abandon run</button>' : ''}
    <button class="btn danger" id="resetBtn">Reset all data</button>
    <button class="btn" id="closeBtn">Done</button>
    <p class="center muted" style="font-size:11px">Block Bound Dungeon · your progress is stored on this device</p>
  </div>`;
  m.querySelectorAll('input[type=range]').forEach(r=>{
    r.oninput = ()=>{ const k = r.dataset.v; settings[k] = +r.value; Sound.setVolume(k, settings[k]); store.set('settings', settings); };
    r.onchange = ()=>{ if(r.dataset.v==='sfx') sfx('coin'); };
  });
  m.querySelectorAll('.toggle').forEach(t=>t.onclick=()=>{
    const k = t.dataset.k; settings[k] = !settings[k]; t.classList.toggle('on', settings[k]); store.set('settings', settings); sfx('click');
    applySettings();
    if(k==='shake' && settings.shake) shake(); if(k==='vibrate' && settings.vibrate) buzz(40); if(k==='flash' && settings.flash) flash('rgba(255,255,255,.3)');
    if(k==='contrast'){ for(const key in BLK) delete BLK[key]; }
    if(k==='tips'){ settings.tipsManual = true; store.set('settings', settings); if(settings.tips){ store.set('tut', null); store.set('rotated', null); } }
    if(k==='lefty' || k==='contrast') relayout();
  });
  m.querySelectorAll('#speedSeg button').forEach(b=>b.onclick=()=>{ settings.speed = b.dataset.s; store.set('settings', settings); sfx('click'); m.querySelectorAll('#speedSeg button').forEach(x=>x.classList.toggle('on', x===b)); });
  $('#backupBtn').onclick = ()=>backupScreen(false);
  $('#restoreBtn').onclick = ()=>backupScreen(true);
  let armed = false, armT;
  $('#resetBtn').onclick = ()=>{
    if(!armed){ armed = true; $('#resetBtn').textContent = 'Tap again to erase everything'; sfx('warn'); clearTimeout(armT); armT = setTimeout(()=>{ armed=false; const b=$('#resetBtn'); if(b) b.textContent='Reset all data'; }, 3000); return; }
    ['save','stats','best','runs','seen','ach','heat','heatSel','tut','shards','skills','heroes','quests','mastery','journal','rotated','daily','mutSel','theme','themesSeen'].forEach(k=>store.set(k,null));
    sfx('rubble'); closeSettings(); run = null; cb = null; titleScreen(); toast('<b>Data reset</b><br>Saves, records, codex, trophies, skills and heroes were erased.', 'bones');
  };
  const ab = $('#abandonBtn');
  if(ab){ let a2=false; ab.onclick = ()=>{ if(!a2){ a2=true; ab.textContent='Tap again to abandon this run'; sfx('warn'); return; } store.set('save', null); closeSettings(); run=null; cb=null; titleScreen(); }; }
  $('#closeBtn').onclick = closeSettings;
  m.onclick = e=>{ if(e.target===m) closeSettings(); };
}
/* backup / restore: every bbd_ key packed into one code you can copy somewhere safe */
const BACKUP_KEYS = ['save','stats','seen','ach','heat','heatSel','tut','shards','skills','heroes','quests','mastery','journal','rotated','settings','daily','mutSel','theme','themesSeen'];
function makeBackup(){
  const data = {v:1}; BACKUP_KEYS.forEach(k=>{ const v = store.get(k, null); if(v!=null) data[k] = v; });
  return 'BBD1-' + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function readBackup(code){
  code = (code||'').trim(); if(!code.startsWith('BBD1-')) throw new Error('not a backup code');
  const data = JSON.parse(decodeURIComponent(escape(atob(code.slice(5))))); if(!data || data.v!==1) throw new Error('bad version');
  return data;
}
function backupScreen(restore){
  sfx('click'); const m = $('#modal'); m.hidden = false;
  const code = restore ? '' : makeBackup();
  m.innerHTML = `<div class="card" role="dialog" aria-label="${restore?'Restore':'Backup'}">
    <div class="row"><h2 class="title" style="font-size:24px">${restore?'Restore progress':'Backup code'}</h2>${img('scroll',34)}</div>
    <p class="muted" style="font-size:13px">${restore?'Paste a backup code below. This replaces all progress on this device.':'Copy this code and keep it somewhere safe, like a note. Paste it into Restore on any device to get your progress back.'}</p>
    <textarea id="codeBox" class="codebox" ${restore?'placeholder="BBD1-..."':'readonly'}>${code}</textarea>
    ${restore?'<button class="btn danger" id="doRestore">Restore</button>':'<button class="btn" id="copyBtn">Copy code</button>'}
    <button class="btn ghost" id="backSet">Back</button></div>`;
  $('#backSet').onclick = openSettings;
  if(!restore){
    $('#copyBtn').onclick = async ()=>{ const box = $('#codeBox'); box.select();
      try{ await navigator.clipboard.writeText(code); toast('Backup code copied.', 'scroll'); }
      catch(e){ try{ document.execCommand('copy'); toast('Backup code copied.', 'scroll'); }catch(_){ toast('Select the code and copy it manually.', 'scroll'); } }
      sfx('coin'); };
  } else {
    let armed = false;
    $('#doRestore').onclick = ()=>{
      let data; try{ data = readBackup($('#codeBox').value); }catch(e){ sfx('invalid'); toast('That code is not valid. Check that you copied all of it.', 'bones', 3000); return; }
      if(!armed){ armed = true; $('#doRestore').textContent = 'Tap again to replace your progress'; sfx('warn'); return; }
      BACKUP_KEYS.forEach(k=>store.set(k, data[k]!==undefined ? data[k] : null));
      Object.assign(settings, store.get('settings', {})); applySettings();
      closeSettings(); run = null; cb = null; titleScreen(); sfx('trophy'); toast('<b>Progress restored</b><br>Welcome back, adventurer.', 'trophy', 3000);
    };
  }
}
function closeSettings(){ $('#modal').hidden = true; $('#modal').innerHTML=''; sfx('click'); }
$('#gearBtn').onclick = openSettings;

/* ================= title, hero select, codex, trophies ================= */
function howToHTML(){
  return `<ul class="how">
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
      <li>Clearing lines charges your hero's <b>special move</b>. Pets act on their own every few moves.</li>
      <li>Each piece you place is a turn. Watch the enemy's countdown.</li>
      <li>Your run saves automatically, even mid-fight.</li>
    </ul>`;
}
function openHowTo(){
  sfx('click'); const m = $('#modal'); m.hidden = false;
  m.innerHTML = `<div class="card" role="dialog" aria-label="How to play" style="max-height:82vh;overflow:auto"><div class="row"><h2 class="title" style="font-size:24px">How to Play</h2>${img('book',34)}</div>${howToHTML()}<button class="btn" id="closeBtn">Got it</button></div>`;
  $('#closeBtn').onclick = closeSettings; m.onclick = e=>{ if(e.target===m) closeSettings(); };
}
function questCard(){
  const q = quests(), done = id => (q.prog[id]||0) >= QUESTS[id].goal;
  const allClaimed = q.ids.every(id=>q.claimed[id]);
  return `<div class="card questcard"><div class="row"><h3 class="title" style="font-size:20px">Daily Quests</h3><span class="muted" style="font-size:12px">New quests every day</span></div>
    ${q.ids.map(id=>{ const Q = QUESTS[id], p = Math.min(Q.goal, q.prog[id]||0);
      return `<div class="quest">${img(Q.spr,34)}<div class="qt"><b>${Q.text}</b><div class="qbar"><i style="width:${100*p/Q.goal}%"></i></div><small>${p} / ${Q.goal}</small></div>
        ${q.claimed[id] ? '<span class="qdone">Done</span>' : `<button class="qclaim" data-q="${id}" ${done(id)?'':'disabled'}>${img('shard',18)}${QUEST_REWARD}</button>`}</div>`; }).join('')}
    ${allClaimed && !q.bonus ? `<button class="btn" id="qbonus" style="font-size:17px;margin-top:6px">Claim bonus: ${QUEST_BONUS} Soul Shards</button>` : ''}
  </div>`;
}
function dailyCard(){
  const D = dailyInfo(), rec = store.get('daily', {}), best = rec.key===D.key ? rec.best : 0, C = CLASSES[D.cls];
  return `<div class="card dailycard"><div class="row"><h3 class="title" style="font-size:20px;display:flex;align-items:center;gap:6px">${img('calendar',28)}Daily Challenge</h3><span class="muted" style="font-size:12px">${best?`Best ${best.toLocaleString()}`:'Not played yet'}</span></div>
    <div class="dailyrow">${img(C.spr,48)}<div><b>${C.name}</b>${D.muts.map(k=>`<span class="mchip">${img(MUTS[k].spr,16)}${MUTS[k].name}</span>`).join('')}<small>Same dungeon for everyone today. ${rec.key===D.key&&rec.rewarded?'Bonus claimed.':'First finish: +40 Soul Shards.'}</small></div></div>
    <button class="btn" id="dailyBtn" style="font-size:18px;padding:9px">Play today's challenge</button></div>`;
}
function titleScreen(){
  run = null; cb = null; show('title');
  let save = store.get('save', null);
  if(save && !validSave(save)){ store.set('save', null); save = null; }
  const st = stats(), ach = store.get('ach', {});
  const heroes = Object.keys(CLASSES).filter(isUnlocked);
  view(`
    <div class="titlebar"><button class="iconbtn" id="howBtn" aria-label="How to play">${img('book',28)}</button><button class="iconbtn" id="gear2" aria-label="Settings">${img('gear',28)}</button></div>
    <h1 class="logo"><span>BLOCK BOUND</span><span>DUNGEON</span></h1>
    <div class="heroes">${heroes.slice(0,5).map(k=>img(CLASSES[k].spr, heroes.length>3?60:76)).join('')}</div>
    ${save?`<button class="btn" id="contBtn">Continue: ${CLASSES[save.cls].name}, ${save.floor>FLOORS?`Depth ${save.floor-FLOORS}`:`Floor ${save.floor}`}</button>`:''}
    <button class="btn ${save?'ghost':''}" id="startBtn">${save?'New Run':'Enter the Dungeon'}</button>
    ${dailyCard()}
    ${questCard()}
    <div class="navgrid">
      <button class="navb" id="skillBtn">${img('rune',36)}<b>Skill Tree</b><small>${img('shard',14)} ${soulShards()}</small></button>
      <button class="navb" id="codexBtn">${img('book',36)}<b>Codex</b><small>Monsters &amp; relics</small></button>
      <button class="navb" id="trophyBtn">${img('trophy',36)}<b>Trophies</b><small>${Object.keys(ach).length} / ${Object.keys(ACH).length}</small></button>
      <button class="navb" id="journalBtn">${img('scroll',36)}<b>Journal</b><small>${st.runs} runs</small></button>
      <button class="navb" id="wardBtn">${img('palette',36)}<b>Bazaar</b><small>Skins, bursts, trails and boards</small></button>
      <button class="navb" id="setBtn2">${img('gear',36)}<b>Settings</b><small>Sound, display, data</small></button>
    </div>
    ${st.runs ? '' : `<div class="card">${howToHTML()}</div>`}
  `);
  $('#startBtn').onclick = ()=>{ sfx('click'); heroScreen(); };
  if(save) $('#contBtn').onclick = ()=>{ sfx('door'); resumeRun(save); };
  $('#gear2').onclick = openSettings;
  $('#howBtn').onclick = openHowTo;
  $('#codexBtn').onclick = ()=>{ sfx('click'); codexScreen('e'); };
  $('#skillBtn').onclick = ()=>{ sfx('click'); skillScreen(); };
  $('#trophyBtn').onclick = ()=>{ sfx('click'); trophyScreen(); };
  $('#journalBtn').onclick = ()=>{ sfx('click'); journalScreen(); };
  $('#wardBtn').onclick = ()=>{ sfx('click'); wardrobeScreen(); };
  $('#setBtn2').onclick = openSettings;
  const db = $('#dailyBtn'); if(db) db.onclick = ()=>{
    if(store.get('save', null) && db.dataset.armed!=='1'){ db.dataset.armed = '1'; sfx('warn'); toast('Starting the Daily Challenge replaces your saved run. Tap again to start.', 'calendar', 3000); return; }
    const D = dailyInfo(); sfx('door'); newRun(D.cls, {daily:D.key, muts:D.muts}); };
  checkThemeUnlocks();
  bindQuests();
  checkHeroUnlocks();
}
function refreshQuestCard(){
  const old = $('#view .questcard'); if(!old) return;
  const tmp = document.createElement('div'); tmp.innerHTML = questCard(); old.replaceWith(tmp.firstElementChild);
  const sk = $('#skillBtn small'); if(sk) sk.innerHTML = `${img('shard',14)} ${soulShards()}`;
  bindQuests();
}
function bindQuests(){
  $('#view').querySelectorAll('.qclaim').forEach(b=>b.onclick=()=>{
    const q = quests(), id = b.dataset.q; if(q.claimed[id] || (q.prog[id]||0) < QUESTS[id].goal) return;
    q.claimed[id] = 1; store.set('quests', q); store.set('shards', soulShards()+QUEST_REWARD);
    sfx('claim'); burstAt(b, ['#7ff0ff','#c8fbff','#fff'], 20); floatText(b, `+${QUEST_REWARD}`, '#c8fbff'); refreshQuestCard();
  });
  const qb = $('#qbonus'); if(qb) qb.onclick = ()=>{ const q = quests(); if(q.bonus) return; q.bonus = true; store.set('quests', q); store.set('shards', soulShards()+QUEST_BONUS); unlock('questor'); sfx('trophy'); confetti(50); refreshQuestCard(); };
}
function checkThemeUnlocks(){
  const seenT = store.get('themesSeen', {stone:1}); let fresh = null;
  Object.keys(THEMES).forEach(id=>{ if(!seenT[id] && !THEMES[id].cost && themeOk(id)){ seenT[id] = 1; fresh = id; } });
  if(fresh){ store.set('themesSeen', seenT); unlock('decorator'); setTimeout(()=>toast(`<b>New board theme!</b><br>${THEMES[fresh].name} is now in the Bazaar under Boards.`, 'palette', 3200), 1400); }
}
function wardrobeScreen(tab){
  show('wardrobe'); tab = tab || store.get('bazTab', 'skin'); store.set('bazTab', tab);
  const C = cosm(), cur = store.get('theme','stone');
  const tabs = [['skin','Blocks','r_combat'],['burst','Bursts','blastblock'],['trail','Trails','flame'],['theme','Boards','palette']];
  let body = '';
  if(tab==='theme'){
    body = `<div class="themes">${Object.entries(THEMES).map(([id,T])=>{ const ok = themeOk(id);
      const sub = ok ? (id===cur?'Equipped':'Tap to equip') : T.cost ? `${T.cost} Soul Shards` : T.unlock.text;
      return `<button class="theme ${ok?'':'lockd'} ${id===cur&&ok?'on':''} ${T.cost&&!ok?'buy':''}" data-t="${id}">
        <span class="mini" style="--bd:${T.board};--ed:${T.edge};--a:${T.a};--b:${T.b}">${'<i></i>'.repeat(16)}</span>
        <b>${T.name}</b><small>${sub}</small></button>`; }).join('')}</div>`;
  } else {
    const cat = COSM[tab];
    body = `<div class="themes">${Object.entries(cat.items).map(([id,I])=>{ const own = cosOwned(tab,id), on = C[tab]===id;
      return `<button class="theme cos ${own?'':'buy'} ${on?'on':''}" data-c="${id}">
        ${tab==='skin'?`<canvas class="skinprev" data-s="${id}" width="132" height="66"></canvas>`:`<span class="cosic">${img(tab==='burst'?'blastblock':'flame', 40)}</span>`}
        <b>${I.name}</b><small>${on?'Equipped':own?'Tap to equip':`${I.cost} Soul Shards`}</small><small class="muted cdesc">${I.desc}</small></button>`; }).join('')}</div>`;
  }
  view(`<div class="center"><h2 class="title">Bazaar</h2><p class="muted">Spend Soul Shards on looks. You have <span class="inline" style="white-space:nowrap"><b style="color:#c8fbff">${soulShards()}</b>${img('shard',18)}</span></p></div>
    <div class="tabs baztabs">${tabs.map(([k,n,s])=>`<button class="tab ${k===tab?'on':''}" data-tab="${k}">${img(s,20)}${n}</button>`).join('')}</div>
    ${body}
    <button class="btn ghost" id="backBtn">Back</button>`);
  $('#view').querySelectorAll('.skinprev').forEach(cv2=>{ const c2 = cv2.getContext('2d'), sk = cv2.dataset.s, d = Math.min(2, window.devicePixelRatio||1);
    cv2.width = 132*d; cv2.height = 66*d; c2.scale(d,d); ['sword','shield','heal','coin'].forEach((t,i)=>c2.drawImage(blockCanvas(t, 30*d, sk), 4+i*31, 18, 30, 30)); });
  $('#view').querySelectorAll('.baztabs .tab').forEach(b=>b.onclick=()=>{ sfx('click'); wardrobeScreen(b.dataset.tab); });
  const spend = (cost, key, name, after)=>{
    if(soulShards() < cost){ sfx('invalid'); toast(`<b>${name}</b><br>Costs ${cost} Soul Shards. You have ${soulShards()}.`, 'shard'); return; }
    const c = cosm(); c.owned[key] = 1; store.set('cos', c); store.set('shards', soulShards() - cost); unlock('collector');
    sfx('trophy'); confetti(40); after();
  };
  $('#view').querySelectorAll('.theme[data-t]').forEach(b=>b.onclick=()=>{ const id = b.dataset.t, T = THEMES[id];
    if(!themeOk(id)){
      if(T.cost){ if(b.dataset.armed!=='1'){ b.dataset.armed = '1'; b.querySelector('small').textContent = `Tap again: ${T.cost} Soul Shards`; sfx('warn'); return; } return spend(T.cost, 't_'+id, T.name, ()=>{ store.set('theme', id); wardrobeScreen('theme'); }); }
      sfx('invalid'); toast(`<b>${T.name}</b><br>Unlock: ${T.unlock.text}.`, 'palette'); return; }
    store.set('theme', id); sfx('relic'); wardrobeScreen('theme'); });
  $('#view').querySelectorAll('.theme[data-c]').forEach(b=>b.onclick=()=>{ const id = b.dataset.c, I = COSM[tab].items[id];
    const equip = ()=>{ const c = cosm(); c[tab] = id; store.set('cos', c); syncCosmetics(); sfx('relic'); demoCos(tab, id, b); setTimeout(()=>wardrobeScreen(tab), tab==='skin'?0:650); };
    if(cosOwned(tab, id)) return equip();
    if(b.dataset.armed!=='1'){ b.dataset.armed = '1'; b.querySelector('small').textContent = `Tap again: ${I.cost} Soul Shards`; sfx('warn'); demoCos(tab, id, b); return; }
    spend(I.cost, tab+'_'+id, I.name, equip);
  });
  $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}
function demoCos(cat, id, el){
  if(!settings.flash || settings.motion) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height*0.35;
  if(cat==='burst') burstParts(FXP, id, cx, cy, pick(['#ef5258','#4a98ff','#45c674','#f7c936']), 22, 34);
  if(cat==='trail'){ const now = performance.now(); for(let k=0;k<4;k++) FXP.push({fly:true, trail:id, sx:cx-60+k*40, sy:cy+40, mx:cx, my:cy-90, tx:cx, ty:cy-10, t0:now+k*60, dur:500, col:pick(['#ef5258','#4a98ff','#c77dff']), x:cx, y:cy+40, life:1, s:7}); }
}
function journalScreen(){
  show('journal');
  const st = stats(), jr = store.get('journal', []);
  const ago = t => { const m = Math.round((Date.now()-t)/60000); return m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`; };
  view(`<div class="center"><h2 class="title">Journal</h2></div>
    <div class="card"><div class="records">
      <div>Runs<br><b>${st.runs}</b></div><div>Wins<br><b>${st.wins}</b></div>
      <div>Foes slain<br><b>${st.kills}</b></div><div>Deepest floor<br><b>${st.bestFloor||'-'}</b></div>
      <div>Endless depth<br><b>${st.bestDepth||'-'}</b></div><div>Biggest hit<br><b>${st.bestHit}</b></div>
      <div>Pure lines<br><b>${st.pures||0}</b></div><div>Potions drunk<br><b>${st.potions||0}</b></div>
    </div></div>
    <h3 class="title" style="font-size:20px">Recent runs</h3>
    ${jr.length ? jr.map(e=>`<div class="troph">${img(CLASSES[e.cls]?CLASSES[e.cls].spr:'bones',44)}<div style="flex:1"><b>${CLASSES[e.cls]?CLASSES[e.cls].name:'Hero'} <span class="rar ${e.won?'rar3':'rar1'}">${e.won?(e.depth?`Victory, depth ${e.depth}`:'Victory'):`Fell on floor ${e.floor}`}</span></b><small>${e.daily?'Daily · ':''}${e.kills} foes · +${e.shards} shards${e.heat?` · Heat ${e.heat}`:''}${e.pet&&PETS[e.pet]?` · ${PETS[e.pet].name}`:''} · ${ago(e.date)}</small></div></div>`).join('') : '<p class="center muted">No runs yet. Your adventures will be recorded here.</p>'}
    <button class="btn ghost" id="backBtn">Back</button>`);
  $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}
function resumeRun(save){
  try{
    run = migrate(JSON.parse(JSON.stringify(save)));
    if(run.room) openRoom(); else goMap();
  }catch(err){
    console.error(err);
    store.set('save', null); run = null; cb = null;
    titleScreen();
    toast('<b>Save could not be loaded</b><br>It was damaged, so it was cleared. Sorry about that!', 'bones', 4200);
  }
}
function heroScreen(){
  show('heroes');
  const maxHeat = store.get('heat', 0); let heat = clamp(+store.get('heatSel', 0), 0, maxHeat);
  const hasSave = !!store.get('save', null);
  let msel = (store.get('mutSel', [])||[]).filter(k=>MUTS[k]);
  const mutsOpen = stats().runs >= 1;
  let sel = store.get('heroSel', 'knight'); if(!CLASSES[sel]) sel = 'knight';
  view(`<div class="center"><h2 class="title">Choose your hero</h2>${hasSave?'<p class="muted" style="font-size:13px;color:#ffb07a">Starting a new run will replace your saved run.</p>':''}</div>
    <div class="roster">${Object.entries(CLASSES).map(([id,C])=>`<button class="rpick ${isUnlocked(id)?'':'locked'} ${id===sel?'on':''}" data-h="${id}" aria-label="${C.name}">${img(C.spr,50)}<span>${C.name}</span>${(stats().winsBy||{})[id]?'<i class="rwin"></i>':''}</button>`).join('')}</div>
    <div id="heroDetail"></div>
    ${mutsOpen ? `<div class="card mutcard"><div class="row"><h3 class="title" style="font-size:18px;display:flex;align-items:center;gap:6px">${img('mutator',26)}Mutators</h3><span class="muted" id="mutMul" style="font-size:13px"></span></div>
      <div class="mchips">${Object.entries(MUTS).map(([k,M])=>`<button class="mchip big ${msel.includes(k)?'on':''}" data-m="${k}">${img(M.spr,20)}${M.name}</button>`).join('')}</div>
      <small class="muted" id="mutDesc" style="font-size:12px">Optional twists for your run. Harder mutators earn more Soul Shards.</small></div>` : ''}
    ${maxHeat ? `<div class="card heatsel"><button id="hm" aria-label="Less heat">-</button><div class="mid"><b id="hn"></b><small id="hd"></small></div><button id="hp" aria-label="More heat">+</button></div>` : ''}
    <button class="btn ghost" id="backBtn">Back</button>`);
  const paintM = ()=>{ const el = $('#mutMul'); if(el){ const m = mutBonus(msel); el.textContent = msel.length ? `Soul Shards x${fmt(Math.round(m*100)/100)}` : 'None selected'; } };
  $('#view').querySelectorAll('.mchip.big').forEach(b=>b.onclick=()=>{ const k = b.dataset.m; msel = msel.includes(k) ? msel.filter(x=>x!==k) : [...msel, k]; store.set('mutSel', msel); b.classList.toggle('on'); $('#mutDesc').textContent = `${MUTS[k].name}: ${MUTS[k].desc}`; sfx('click'); paintM(); });
  paintM();
  const paint = ()=>{ if(!maxHeat) return; $('#hn').textContent = HEAT[heat].name; $('#hd').textContent = HEAT[heat].desc; $('#hm').disabled = heat<=0; $('#hp').disabled = heat>=maxHeat; store.set('heatSel', heat); };
  if(maxHeat){ $('#hm').onclick = ()=>{ heat--; sfx('click'); paint(); }; $('#hp').onclick = ()=>{ heat++; sfx('rage'); paint(); }; paint(); }
  const detail = ()=>{
    const id = sel, C = CLASSES[id], R = RELICS[C.relic], wins = (stats().winsBy||{})[id]||0, open = isUnlocked(id);
    const lv = masteryLevel(id), x = masteryXp(id), nx = MASTERY[lv];
    $('#heroDetail').innerHTML = `<div class="card hero hdetail"><div class="hd-top"><span class="ic">${img(C.spr,78)}</span><div>
      <b class="hname">${C.name}${wins?` <span class="rar rar3">${wins} win${wins>1?'s':''}</span>`:''}${open?'':' <span class="rar rar1">Locked</span>'}</b><small class="muted">${C.desc}</small></div></div>
      <span class="bagmini">${Object.entries(C.bag||DEFAULT_BAG).map(([t,n])=>`<span>${blockChip(t)}${n}</span>`).join('')}</span>
      <span class="stats"><span class="inline">${img('heart',20)}${C.hp}</span><span class="inline">${img('coin',20)}${C.gold}</span><span class="inline">${img(R.spr,20)}${R.name}</span><span class="inline">${C.potions.map(p=>img(POTIONS[p].spr,20)).join('')}</span></span>
      <small class="muted" style="font-size:12px">${R.desc}</small>
      <span class="ult">Special: <b style="font-size:13px;display:inline">${C.ult.name}</b> - ${C.ult.desc}</span>
      ${open?`<span class="mastery"><span class="mlv">Mastery ${lv}</span><span class="qbar"><i style="width:${nx?Math.min(100,100*(x-MASTERY[lv-1])/(nx-MASTERY[lv-1])):100}%"></i></span><small>${nx?`Next: ${MASTERY_PERKS[lv]}`:'Max mastery'}</small></span>`
        :`<span class="ult" style="color:#c9b6ff">Unlock: ${C.unlock.text}, or spend ${C.unlock.cost} Soul Shards (you have ${soulShards()}).</span>`}
      <button class="btn" id="goHero">${open?`Start as ${C.name}`:soulShards()>=C.unlock.cost?`Unlock for ${C.unlock.cost} Soul Shards`:`Locked`}</button></div>`;
    $('#goHero').disabled = !open && soulShards() < C.unlock.cost;
    $('#goHero').onclick = ()=>{
      if(!open){
        const b = $('#goHero');
        if(b.dataset.armed!=='1'){ b.dataset.armed='1'; b.textContent = `Tap again to spend ${C.unlock.cost} Soul Shards`; sfx('warn'); return; }
        store.set('shards', soulShards() - C.unlock.cost); const h = store.get('heroes', {}); h[id] = 1; store.set('heroes', h); unlock('roster');
        sfx('trophy'); confetti(60); heroScreen(); return;
      }
      sfx('click'); newRun(id, {muts: mutsOpen ? msel : []});
    };
  };
  detail();
  $('#view').querySelectorAll('.rpick').forEach(b=>b.onclick = ()=>{ sel = b.dataset.h; store.set('heroSel', sel); $('#view').querySelectorAll('.rpick').forEach(x=>x.classList.toggle('on', x===b)); sfx('click'); detail(); });
  $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}
function codexScreen(tab){
  show('codex');
  const s = seen();
  let body = '';
  if(tab==='e'){
    const n = ALL_ENEMIES.filter(e=>s.e[e.name]).length;
    body = `<p class="center muted">${n} / ${ALL_ENEMIES.length} discovered</p><div class="grid">${ALL_ENEMIES.map((e,i)=>{ const k = s.e[e.name]; return `<div class="cell ${k?'':'unk'}" data-i="${i}">${img(e.spr,58)}${k?e.name:'???'}</div>`; }).join('')}</div>`;
  } else if(tab==='b'){
    const bosses = ALL_ENEMIES.filter(e=>e.boss), n = bosses.filter(e=>s.e[e.name]).length;
    body = `<p class="center muted">${n} / ${bosses.length} bosses met. Each floor's guardian is picked at random.</p>${[1,2,3,4,5].map(f=>`<h4 class="codexh">Floor ${f}: ${FLOOR_NAMES[f-1]}</h4>${bosses.filter(e=>e.floor===f).map(e=>{ const k = s.e[e.name]; return `<div class="troph ${k?'':'unk'}">${k?img(e.spr,48):img(e.spr,48,'sil')}<div><b>${k?e.name:'???'}${k&&k.kills?` <span class="muted" style="font-size:12px">${k.kills} defeated</span>`:''}</b><small>${k?e.sigd:'Not yet encountered.'}</small></div></div>`; }).join('')}`).join('')}`;
  } else if(tab==='k'){
    body = `<p class="center muted">Win fights to earn XP. Each level lets you pick 1 of 3 perks for the rest of the run.</p>${Object.values(PERKS).map(P=>`<div class="troph">${img(P.spr,40)}<div><b>${P.name} <span class="muted" style="font-size:12px">max ${P.max}</span></b><small>${P.desc}</small></div></div>`).join('')}`;
  } else if(tab==='p'){
    body = `<p class="center muted">Find pets in Beast Dens and some events.</p>${Object.entries(PETS).map(([k,P])=>`<div class="troph">${img(P.spr,44)}<div><b>${P.name}</b><small>${P.desc}</small></div></div>`).join('')}`;
  } else {
    const ids = Object.keys(RELICS), n = ids.filter(id=>s.r[id]).length;
    body = `<p class="center muted">${n} / ${ids.length} discovered</p><div class="grid">${ids.map(id=>{ const k = s.r[id]; return `<div class="cell ${k?'':'unk'}" data-r="${id}">${img(RELICS[id].spr,50)}${k?RELICS[id].name:'???'}</div>`; }).join('')}</div>`;
  }
  view(`<div class="center"><h2 class="title">Codex</h2></div>
    <div class="tabs codextabs"><button class="${tab==='e'?'on':''}" id="tE">Bestiary</button><button class="${tab==='b'?'on':''}" id="tB">Bosses</button><button class="${tab==='r'?'on':''}" id="tR">Relics</button><button class="${tab==='k'?'on':''}" id="tK">Perks</button><button class="${tab==='p'?'on':''}" id="tP">Pets</button></div>
    ${body}<button class="btn ghost" id="backBtn">Back</button>`);
  $('#tE').onclick = ()=>{ sfx('click'); codexScreen('e'); }; $('#tB').onclick = ()=>{ sfx('click'); codexScreen('b'); }; $('#tK').onclick = ()=>{ sfx('click'); codexScreen('k'); }; $('#tR').onclick = ()=>{ sfx('click'); codexScreen('r'); }; $('#tP').onclick = ()=>{ sfx('click'); codexScreen('p'); };
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
    const w = [['combat',40],['elite',r>=2?14:0],['rest',r>=3?9:0],['shop',r>=2?11:0],['treasure',7],['event',16],['den',r>=1&&r<=5?5:0],['forge',r>=3?6:0]].filter(e=>e[1]>0);
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
  run.room = null;
  if(run.path.length && !availableNodes().length){ const last = run.path[run.path.length-1]; if(last[0]===STEPS-1) return advance(); run.path = []; }
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
    nodesHtml += `<button class="${cls}" style="left:${p.x}%;top:${p.y}px" data-r="${r}" data-i="${i}" aria-label="${ROOMS[n.t].name}" ${isAvail?'':'tabindex="-1"'}>${n.t==='boss'?img(bossFor().spr,58):img(ROOMS[n.t].spr,40)}${here?`<span class="token">${img(CLASSES[run.cls].spr,34)}</span>`:''}</button>`;
  }));
  view(`
    <div class="maphead"><div><h2 class="title">Floor ${run.floor}</h2><div class="muted" style="font-size:14px">${floorName()}</div></div>
      <span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${run.daily?`<span class="heatchip" style="background:#3a2a5a;border-color:#c77dff;color:#f0d6ff">${img('calendar',20)}Daily</span>`:''}${run.heat?`<span class="heatchip">${img('rage',22)}Heat ${run.heat}</span>`:''}${(run.muts||[]).map(k=>`<span class="heatchip mut" title="${MUTS[k].name}">${img(MUTS[k].spr,20)}</span>`).join('')}</span></div>
    <p class="muted center" style="font-size:13px">Descend toward <b style="color:var(--torch2)">${bossFor().name}</b>. Tap a glowing room.<br><span style="font-size:12px">${bossFor().sigd||''}</span></p>
    ${!run.path.length?`<div class="starttoken">${img(CLASSES[run.cls].spr,40)}<span>You are here</span></div>`:''}
    <div class="map" style="height:${H}px"><svg viewBox="0 0 100 ${H}" preserveAspectRatio="none">${lines}</svg>${nodesHtml}</div>
    <div class="legend2">${['combat','elite','rest','shop','treasure','event','den','forge'].map(k=>`<span>${img(ROOMS[k].spr,20)}${ROOMS[k].name}</span>`).join('')}</div>
  `);
  let used = false;
  $('#view').querySelectorAll('.mnode.avail').forEach(b=>b.onclick=()=>{ if(used) return; used = true; sfx('map'); enterRoom(+b.dataset.r, +b.dataset.i); });
  const target = $('#view .mnode.avail');
  if(target && row>1) setTimeout(()=>{ const r = target.getBoundingClientRect(), bar = $('#runbar').getBoundingClientRect().height + 20; const y = window.scrollY + r.top - Math.max(bar + 60, innerHeight*0.45); window.scrollTo({top: Math.max(0, y), behavior:'smooth'}); }, 120);
  if(row===0) coach('map', 'Your path', 'Pick any glowing room. Lines show which rooms connect. The boss waits at the bottom.', $('#view .mnode.avail'), false);
}
function enterRoom(r, i){
  run.path.push([r,i]); run.step = run.path.length - 1;
  let t = run.map[r][i].t;
  if(t==='combat' && (run.daily ? withSeed(runSeed(`g${run.floor}-${r}-${i}`), Math.random) : Math.random()) < 0.1) t = 'goblin';
  run.room = {r, i, t};
  run.rooms = (run.rooms||0) + 1; questAdd('rooms', 1);
  sfx('door');
  saveRun();
  openRoom();
}
function openRoom(){
  const R = run.room;
  if(R.reward) return rewardScreen(R.reward.kind);
  const t = R.t;
  if(t==='combat'||t==='goblin'||t==='elite'||t==='boss') startCombat(t);
  else if(t==='rest') restScreen();
  else if(t==='shop') shopScreen();
  else if(t==='treasure') treasureScreen();
  else if(t==='den') denScreen();
  else if(t==='forge') forgeScreen();
  else eventScreen();
}
function advance(){
  run.room = null;
  const last = run.path[run.path.length-1];
  if(last && last[0]===STEPS-1){
    run.floor++;
    bumpStats(s=>s.bestFloor=Math.max(s.bestFloor, Math.min(run.floor,FLOORS)));
    if(run.floor===FLOORS+1 && !run.won) return endScreen(true);
    questAdd('floor', run.floor);
    if(run.floor>=FLOORS+3) unlock('endless');
    if(run.floor===2) unlock('floor2'); if(run.floor===3) unlock('floor3'); if(run.floor===4) unlock('floor4'); if(run.floor===5) unlock('floor5');
    run.map = run.daily ? withSeed(runSeed(run.floor), genMap) : genMap(); run.path = [];
    heal(Math.round(run.maxHp*0.3));
    banner(`Floor ${run.floor}`, floorName(), 2200);
    setTimeout(()=>toast('You descend deeper and catch your breath. <b>+30% HP</b>', 'r_rest'), 600);
  }
  goMap();
}

/* ================= non-combat rooms ================= */
function restScreen(){
  show('rest');
  const amt = Math.round(run.maxHp*0.35*(has('hearth')?1.5:1));
  const R = run.room; if(!R.up){ R.up = pick(Object.keys(UPGRADES)); saveRun(); }
  const up = R.up; const U = UPGRADES[up], C = ULT();
  view(`${scene('r_rest','Campfire','The fire crackles. You have time for one thing.')}
    ${choiceBtn({id:'heal',spr:'heal_icon',name:'Rest',desc:`Heal ${amt} HP.${has('hearth')?' +4 max HP.':''}`})}
    ${choiceBtn({id:'train',spr:'heart',name:'Train',desc:'+8 max HP.'})}
    ${choiceBtn({id:'up',spr:U.spr,name:U.name,desc:U.desc+' (permanent)'})}
    ${choiceBtn({id:'med',spr:C.spr,name:'Meditate',desc:`Start your next fight with ${C.name} fully charged.`, disabled: run.charge>=C.need})}
    ${choiceBtn({id:'cut',spr:'bagicon',name:'Declutter',desc:'Remove 2 blocks of one type from your bag.', disabled: bagSize()-2 < BAG_MIN})}`);
  bindChoices(id=>{
    if(id==='cut') return chooseBlock('Declutter', 'Pick a block type to remove 2 of.', removableTypes(), t=>{ if(!t) return restScreen(); bagRemove(t, Math.min(2, run.bag[t])); sfx('anvil'); toast(`<b>Removed ${TYPES[t].name} blocks</b><br>${bagSize()} blocks left in your bag.`, 'bagicon'); advance(); });
    if(id==='heal'){ heal(amt); if(has('hearth')){ run.maxHp+=4; run.hp+=4; } sfx('heal'); }
    else if(id==='train'){ run.maxHp+=8; run.hp+=8; sfx('armor'); }
    else if(id==='up'){ run.lvl[up]++; sfx('armor'); }
    else { run.charge = C.need; sfx('ult'); }
    advance();
  });
}
function treasureScreen(){
  show('treasure');
  const R = run.room; if(!R.loot){ R.loot = {id: relicOffers(1)[0]||null, g: rand(10,20)}; saveRun(); }
  const id = R.loot.id, g = R.loot.g;
  view(`${scene('r_treasure','Treasure!',`Inside the chest: ${g} gold and...`)}
    ${id?choiceBtn({id, ...RELICS[id]}):''}
    <button class="btn" id="takeBtn">Take it</button>`);
  let done = false;
  const take = ()=>{ if(done) return; done = true; run.gold+=g; sfx('chest'); if(id) gainRelic(id); burstAt($('#goldWrap'), ['#f7c936','#ffe58a'], 16); advance(); };
  $('#takeBtn').onclick = take; bindChoices(take);
}
function shopScreen(){
  show('shop');
  const disc = (has('clover') ? 0.8 : 1) * (mut('rush') ? 1.5 : 1), P = x => Math.round(x*disc);
  const R = run.room;
  if(!R.shop){ R.shop = {
    stock: relicOffers(3).map(id=>({id, price:P([0,55,80,115][RELICS[id].r]+rand(-5,5)), sold:false})),
    pots: shuffle(Object.keys(POTIONS)).slice(0,2).map(id=>({id, price:P(rand(18,26)), sold:false})),
    up: pick(Object.keys(UPGRADES)), upSold:false, packSold:false, removeSold:false }; saveRun(); }
  const S = R.shop, stock = S.stock, pots = S.pots, up = S.up, upPrice = P(50), packPrice = P(70);
  const rerollPrice = () => P(15 + 10*(S.rerolls||0));
  const render = ()=>{
    const full = run.potions.length>=run.potionSlots;
    view(`${scene('r_shop','The Merchant', has('clover')?'"Lucky you. Everything is marked down."':'"Gold for goods, friend."')}
      ${stock.map(s=>s.sold?'':choiceBtn({id:'r:'+s.id,...RELICS[s.id],price:s.price,disabled:run.gold<s.price})).join('')}
      ${mut('dry')?'':pots.map(s=>s.sold?'':choiceBtn({id:'p:'+s.id,spr:POTIONS[s.id].spr,name:POTIONS[s.id].name,desc:POTIONS[s.id].desc+(full?' (potion slots full)':''),price:s.price,disabled:run.gold<s.price||full})).join('')}
      ${S.upSold?'':choiceBtn({id:'u:'+up,spr:UPGRADES[up].spr,name:UPGRADES[up].name,desc:UPGRADES[up].desc+' (permanent)',price:upPrice,disabled:run.gold<upPrice})}
      ${S.packSold||run.potionSlots>=5||mut('dry')?'':choiceBtn({id:'b:pack',spr:'satchel',name:'Bigger Pack',desc:'+1 potion slot.',price:packPrice,disabled:run.gold<packPrice})}
      ${choiceBtn({id:'a:add',spr:'bagicon',name:'Hire Blocks',desc:'Add 2 blocks of a type you choose to your bag.',price:P(30+10*(S.adds||0)),disabled:run.gold<P(30+10*(S.adds||0))})}
      ${S.cutSold?'':choiceBtn({id:'c:cut',spr:'bagicon',name:'Remove a Block Type',desc:'Remove up to 3 blocks of one type from your bag.',price:P(45),disabled:run.gold<P(45)||bagSize()-1<BAG_MIN})}
      ${S.boxSold?'':choiceBtn({id:'m:box',spr:'r_treasure',name:'Mystery Box',desc:'Could be a relic, potions, a pile of gold... or a pet.',price:P(50),disabled:run.gold<P(50)})}
      ${run.pet||S.petSold?'':choiceBtn({id:'q:pet',spr:PETS[S.pet||(S.pet=pick(Object.keys(PETS)))].spr,name:`Adopt: ${PETS[S.pet].name}`,desc:PETS[S.pet].desc,price:P(65),disabled:run.gold<P(65)})}
      ${S.healSold?'':choiceBtn({id:'h:heal',spr:'heal_icon',name:'Bandages',desc:'Heal 30% of your max HP.',price:P(35),disabled:run.gold<P(35)||run.hp>=run.maxHp})}
      <button class="btn ghost" id="rerollShop" ${run.gold<rerollPrice()?'disabled':''}>Restock relics and potions (${rerollPrice()} gold)</button>
      <button class="btn ghost" id="leaveBtn">Leave</button>`);
    $('#rerollShop').onclick = ()=>{
      const c = rerollPrice(); if(run.gold<c) return; run.gold -= c; S.rerolls = (S.rerolls||0)+1;
      stock.splice(0, stock.length, ...relicOffers(3).map(id=>({id, price:P([0,55,80,115][RELICS[id].r]+rand(-5,5)), sold:false})));
      pots.splice(0, pots.length, ...shuffle(Object.keys(POTIONS)).slice(0,2).map(id=>({id, price:P(rand(18,26)), sold:false})));
      sfx('shuffle'); renderRunbar(); render(); saveRun(); };
    $('#view').querySelectorAll('.choice').forEach((b,i)=>{ b.style.setProperty('--i', i); b.onclick = ()=>{
      const [kind,id] = b.dataset.id.split(':');
      if(kind==='r'){ const s=stock.find(x=>x.id===id); if(run.gold<s.price||s.sold) return; run.gold-=s.price; s.sold=true; gainRelic(id); }
      else if(kind==='p'){ const s=pots.find(x=>x.id===id); if(run.gold<s.price||s.sold) return; run.gold-=s.price; s.sold=true; givePotion(id); sfx('buy'); }
      else if(kind==='u'){ if(run.gold<upPrice||S.upSold) return; run.gold-=upPrice; S.upSold=true; run.lvl[id]++; sfx('buy'); toast(`<b>${UPGRADES[id].name}</b><br>${UPGRADES[id].desc}`, UPGRADES[id].spr); }
      else if(kind==='a'){ const c = P(30+10*(S.adds||0)); if(run.gold<c) return; return chooseBlock('Hire Blocks', 'Pick a block type to add 2 of.', addableTypes(), t=>{ if(!t) return; run.gold -= c; S.adds = (S.adds||0)+1; bagAdd(t,2); sfx('buy'); renderRunbar(); render(); saveRun(); }); }
      else if(kind==='c'){ if(run.gold<P(45)||S.cutSold) return; return chooseBlock('Remove Blocks', 'Pick a block type to remove up to 3 of.', removableTypes(), t=>{ if(!t) return; run.gold -= P(45); S.cutSold = true; let n=0; while(n<3 && bagRemove(t,1)) n++; sfx('anvil'); renderRunbar(); render(); saveRun(); }); }
      else if(kind==='m'){ if(run.gold<P(50)||S.boxSold) return; run.gold -= P(50); S.boxSold = true; sfx('chest');
        const roll = Math.random(), offers = relicOffers(1);
        if(roll<0.4 && offers.length) gainRelic(offers[0]);
        else if(roll<0.65 && canPotion()){ givePotion(); if(canPotion()) givePotion(); toast('<b>Mystery Box</b><br>Potions!', 'potion_health'); }
        else if(roll<0.85 || run.pet){ run.gold += 90; toast('<b>Mystery Box</b><br>90 gold!', 'coin'); questAdd('gold', 90); }
        else { run.pet = pick(Object.keys(PETS)); unlock('petpal'); toast(`<b>Mystery Box</b><br>A ${PETS[run.pet].name} hops out and joins you!`, PETS[run.pet].spr); } }
      else if(kind==='q'){ if(run.gold<P(65)||S.petSold||run.pet) return; run.gold -= P(65); S.petSold = true; run.pet = S.pet; unlock('petpal'); sfx('heal'); confetti(30); toast(`<b>${PETS[S.pet].name}</b> joins you!`, PETS[S.pet].spr); }
      else if(kind==='h'){ if(run.gold<P(35)||S.healSold) return; run.gold-=P(35); S.healSold=true; heal(Math.round(run.maxHp*0.3)); sfx('heal'); }
      else { if(run.gold<packPrice||S.packSold) return; run.gold-=packPrice; S.packSold=true; run.potionSlots++; sfx('buy'); }
      renderRunbar(); render(); saveRun();
    }; });
    $('#leaveBtn').onclick = ()=>{ sfx('click'); advance(); };
  };
  render();
}
function denScreen(){
  show('den');
  const R = run.room; if(!R.pets){ R.pets = shuffle(Object.keys(PETS).filter(k=>k!==run.pet)).slice(0,2); saveRun(); }
  const cur = run.pet && PETS[run.pet];
  view(`${scene('r_den','Beast Den', cur?`Your ${cur.name} sniffs at the newcomers. You can only keep one companion.`:'Creatures peek out from the straw. One of them could join you.')}
    ${R.pets.map(k=>choiceBtn({id:k, spr:PETS[k].spr, name:PETS[k].name, desc:PETS[k].desc})).join('')}
    <button class="btn ghost" id="leaveBtn">${cur?`Keep ${cur.name}`:'Leave'}</button>`);
  bindChoices(k=>{ run.pet = k; unlock('petpal'); sfx('heal'); confetti(30); toast(`<b>${PETS[k].name}</b> joins you!`, PETS[k].spr); advance(); });
  $('#leaveBtn').onclick = ()=>{ sfx('click'); advance(); };
}
function forgeScreen(){
  show('forge');
  const R = run.room; if(!R.forge){ R.forge = {ups: shuffle(Object.keys(UPGRADES)).slice(0,2)}; saveRun(); }
  const mine = run.relics.filter(id=>!RELICS[id].starter), low = mine.slice().sort((a,b)=>RELICS[a].r-RELICS[b].r)[0];
  view(`${scene('anvil','The Forge','The anvil glows white-hot. Choose what to forge.')}
    ${R.forge.ups.map(k=>choiceBtn({id:'t:'+k, spr:UPGRADES[k].spr, name:'Temper: '+UPGRADES[k].name, desc:UPGRADES[k].desc.replace('+1','+2')+' (permanent)'})).join('')}
    ${choiceBtn({id:'r:'+(low||''), spr:low?RELICS[low].spr:'r_treasure', name:'Reforge', desc: low ? `Melt down your ${RELICS[low].name} and forge a relic of higher rarity.` : 'You have no relic to reforge.', disabled:!low})}
    ${choiceBtn({id:'b:bag', spr:'bagicon', name:'Refine', desc:'Remove 3 blocks of one type from your bag.', disabled: bagSize()-1 < BAG_MIN})}
    ${choiceBtn({id:'s:'+(low||''), spr:'coin', name:'Smelt', desc: low ? `Melt down your ${RELICS[low].name} for ${30+25*RELICS[low].r} gold.` : 'You have no relic to smelt.', disabled:!low})}
    <button class="btn ghost" id="leaveBtn">Leave</button>`);
  bindChoices(key=>{
    const [k,id] = key.split(':');
    if(k==='b') return chooseBlock('Refine', 'Pick a block type to remove up to 3 of.', removableTypes(), t=>{ if(!t) return forgeScreen(); let n = 0; while(n<3 && bagRemove(t,1)) n++; sfx('anvil'); toast(`<b>Removed ${n} ${TYPES[t].name} block${n===1?'':'s'}</b>`, 'bagicon'); advance(); });
    if(k==='t'){ run.lvl[id] += 2; sfx('anvil'); toast(`<b>${UPGRADES[id].name} x2</b><br>${UPGRADES[id].desc.replace('+1','+2')}`, UPGRADES[id].spr); }
    else if(k==='r' && id){ const rr = RELICS[id].r; run.relics = run.relics.filter(x=>x!==id); const [nid] = relicOffers(1, Math.min(3, rr+1)); if(nid) gainRelic(nid); sfx('blast'); }
    else if(k==='s' && id){ run.gold += 30+25*RELICS[id].r; run.relics = run.relics.filter(x=>x!==id); sfx('coin'); }
    advance();
  });
  $('#leaveBtn').onclick = ()=>{ sfx('click'); advance(); };
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
    {name:'Buy a brew', spr:'potion_health', desc:'Pay 15 gold for a random potion.', ok:()=>run.gold>=15&&canPotion(), go(){ run.gold-=15; givePotion(); sfx('potion'); }},
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
  ()=>({spr:'pool', title:'Fountain of Youth', text:'Crystal water bubbles up from the stone. It smells of flowers.', opts:[
    {name:'Drink deeply', spr:'heal_icon', desc:'Heal to full HP.', ok:()=>run.hp<run.maxHp, go(){ run.hp = run.maxHp; sfx('heal'); }},
    {name:'Fill a flask', spr:'potion_health', desc:'Gain a Health Potion.', ok:()=>canPotion(), go(){ givePotion('health'); sfx('potion'); }},
    {name:'Toss a coin', spr:'coin', desc:'Pay 10 gold. +4 max HP.', ok:()=>run.gold>=10, go(){ run.gold-=10; run.maxHp+=4; run.hp+=4; sfx('coin'); }},
  ]}),
  ()=>({spr:'mage', title:'Hermit Sage', text:'"I can teach you to focus your power... for a price."', opts:[
    {name:'Study', spr:'spellbook', desc:'Pay 45 gold: your special needs 1 fewer line this run.', ok:()=>run.gold>=45, go(){ run.gold-=45; run.ultBonus = (run.ultBonus||0)+1; sfx('ult'); }},
    {name:'Meditate together', spr:'flame', desc:'Fully charge your special.', go(){ run.charge = ULT().need; sfx('ult'); }},
  ]}),
  ()=>({spr:'skeleton', title:'Bone Dice', text:'A skeleton rattles a pair of bone dice. "Roll with me, mortal."', opts:[
    {name:'Roll', spr:'dice', desc:'1 in 3: a relic. 1 in 3: 35 gold. 1 in 3: lose 10 HP.', ok:()=>run.hp>10, go(){ const r = Math.random(); if(r<1/3){ const [id]=relicOffers(1); if(id) gainRelic(id); } else if(r<2/3){ run.gold+=35; sfx('coin'); toast('Lucky roll! <b>+35 gold</b>','coin'); } else { run.hp-=10; sfx('hurt'); toast('Snake eyes. <b>-10 HP</b>','skeleton'); } }},
    {name:'Walk away', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'r_den', title:'Stray Companion', text:'A small creature follows you out of the shadows, looking hopeful.', opts:[
    {name:'Adopt it', spr:'r_den', desc:'Gain a random pet companion (replaces your current one).', go(){ const k = pick(Object.keys(PETS).filter(k=>k!==run.pet)); run.pet = k; sfx('heal'); toast(`<b>${PETS[k].name}</b> joins you!<br>${PETS[k].desc}`, PETS[k].spr, 3200); }},
    {name:'Shoo it away', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'rock', title:'Collapsing Bridge', text:'The bridge ahead groans. Gold glints in the rubble below.', opts:[
    {name:'Climb down', spr:'coin', desc:'Lose 8 HP. Gain 40 gold.', ok:()=>run.hp>8, go(){ run.hp-=8; run.gold+=40; sfx('rubble'); }},
    {name:'Cross carefully', spr:'r_event', desc:'Move on safely.', go(){} },
  ]}),
  ()=>({spr:'knight', title:'Wounded Adventurer', text:'A knight slumps against the wall, clutching a wound.', opts:[
    {name:'Share a potion', spr:'potion_health', desc:'Give your first potion. Gain 20 gold and a random upgrade.', ok:()=>run.potions.length>0, go(){ run.potions.shift(); run.gold+=20; const k=pick(Object.keys(UPGRADES)); run.lvl[k]++; sfx('heal'); toast(`"Thank you, friend."<br><b>${UPGRADES[k].name}</b>: ${UPGRADES[k].desc}`, UPGRADES[k].spr, 3000); }},
    {name:'Bandage them', spr:'heal_icon', desc:'Lose 5 HP. Gain 15 gold.', ok:()=>run.hp>5, go(){ run.hp-=5; run.gold+=15; sfx('coin'); }},
    {name:'Walk past', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'dummy', title:'Sparring Hall', text:'Straw dummies stand in rows. A sign reads: "Practice makes perfect."', opts:[
    {name:'Spar for an hour', spr:'sword', desc:'Lose 6 HP. Gain 25 XP.', ok:()=>run.hp>6, go(){ run.hp-=6; gainXP(25); sfx('hit'); toast(`<b>+25 XP</b><br>${run.lvUp?'Level up after your next fight!':`${run.xp} / ${xpNeed(run.level)} XP`}`, 'dummy'); }},
    {name:'Stretch', spr:'heal_icon', desc:'Heal 8 HP.', go(){ heal(8); sfx('heal'); }},
  ]}),
  ()=>({spr:'satchel', title:'Abandoned Cart', text:'A merchant\'s cart lies on its side. Nobody is around.', opts:[
    {name:'Search the crates', spr:'potion_health', desc:'Find 2 random potions.', ok:()=>canPotion(), go(){ givePotion(); if(canPotion()) givePotion(); sfx('chest'); }},
    {name:'Take the coin purse', spr:'coin', desc:'+30 gold.', go(){ run.gold+=30; sfx('coin'); }},
  ]}),
  ()=>({spr:'orb', title:'Fortune Teller', text:'"I see the guardian waiting below... but fate can be changed, for a price."', opts:[
    {name:'Change your fate', spr:'r_boss', desc:`Pay 25 gold: replace ${bossFor().name} with a different boss for this floor.`, ok:()=>run.gold>=25, go(){ run.gold-=25; const list = (run.floor<=5 ? ENEMIES[run.floor-1] : ENEMIES[2+((run.floor-6)%3)]).bosses; let k = run.bossPick[run.floor]; let nk = k; while(list.length>1 && nk===k) nk = rand(0, list.length-1); run.bossPick[run.floor] = nk; sfx('phase'); toast(`<b>Fate rewritten</b><br>${bossFor().name} now waits below.`, bossFor().spr, 3200); }},
    {name:'Ask about treasure', spr:'coin', desc:'Pay 10 gold: she points you to a hidden relic.', ok:()=>run.gold>=10, go(){ run.gold-=10; const [id] = relicOffers(1); if(id) gainRelic(id); }},
    {name:'Leave', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'bagicon', title:'Block Peddler', text:'A goblin rattles a sack full of glowing blocks. "Special stock, very rare!"', opts:[
    {name:'Rainbow blocks', spr:'blastblock', desc:'Pay 40 gold: add 2 Rainbow blocks to your bag.', ok:()=>run.gold>=40, go(){ run.gold-=40; bagAdd('rainbow',2); sfx('buy'); }},
    {name:'Blast blocks', spr:'bomb', desc:'Pay 30 gold: add 2 Blast blocks to your bag.', ok:()=>run.gold>=30, go(){ run.gold-=30; bagAdd('blast',2); sfx('buy'); }},
    {name:'No thanks', spr:'r_event', desc:'Move on.', go(){} },
  ]}),
  ()=>({spr:'r_den', title:'Mysterious Egg', text:'A warm, speckled egg sits in a nest of bones. It wobbles.', opts:[
    {name:'Keep it warm', spr:'heart', desc:run.pet?'It hatches... and runs off, leaving 35 gold behind.':'It hatches into a random pet that joins you.', go(){ if(run.pet){ run.gold+=35; sfx('coin'); } else { run.pet = pick(Object.keys(PETS)); unlock('petpal'); sfx('heal'); confetti(30); toast(`<b>${PETS[run.pet].name}</b> hatches and joins you!`, PETS[run.pet].spr); } }},
    {name:'Cook it', spr:'flame', desc:'Heal 15 HP.', go(){ heal(15); sfx('heal'); }},
  ]}),
];
function eventScreen(){
  show('event');
  const R = run.room; if(R.ev==null || !EVENTS[R.ev]){ R.ev = rand(0, EVENTS.length-1); saveRun(); }
  const ev = EVENTS[R.ev]();
  if(!ev.opts.some(o=>!o.ok || o.ok())) ev.opts.push({name:'Move on', spr:'r_event', desc:'Nothing here for you right now.', go(){}});
  view(`${scene(ev.spr, ev.title, ev.text)}
    ${ev.opts.map((o,i)=>choiceBtn({id:i,spr:o.spr,name:o.name,desc:o.desc,disabled:o.ok&&!o.ok()})).join('')}`);
  bindChoices(i=>{
    const res = ev.opts[i].go();
    renderRunbar();
    if(checkDeath()) return endScreen(false);
    if(res==='mimic'){ const mm = ENEMIES[1].elite[1]; run.room = {r:R.r, i:R.i, t:'elite'}; return startCombat('elite', {...mm, hp: Math.round(mm.hp*FS([0.6,1,1.35,1.6,1.9]))}); }
    advance();
  });
}

/* ================= rewards & end ================= */
function rewardScreen(kind){
  if(run.lvUp>0) return levelScreen(()=>rewardScreen(kind));
  show('reward');
  if(!run.room) run.room = {t:kind};
  const RW = run.room.reward = run.room.reward || {kind};
  if(!RW.offers) rollReward(RW, kind);
  const fresh = !RW.shown; RW.shown = true; saveRun();
  if(fresh){ setTimeout(()=>burstAt($('#goldWrap'), ['#f7c936','#ffe58a','#fff'], 22), 150); if(kind==='boss') setTimeout(()=>confetti(80), 100); }
  const offers = RW.offers.map(o=> o.boon ? {...BOONS.find(b=>b.id===o.id)} : {id:o.id, ...RELICS[o.id]}).filter(o=>o.name);
  const title = kind==='boss'?'Boss defeated!':kind==='goblin'?'Caught it!':'Victory!';
  view(`${scene(kind==='boss'?'r_boss':kind==='goblin'?'goldgoblin':'r_treasure', title, `+${RW.g} gold.${RW.extra} Choose a reward:`)}
    ${offers.map(o=>choiceBtn(o)).join('')}
    <button class="btn ghost" id="skipBtn">Skip</button>`);
  bindChoices(id=>{ const b = BOONS.find(x=>x.id===id);
    if(b && b.choose) return b.apply(ok=>{ if(ok) advance(); else rewardScreen(kind); });
    if(b){ b.apply(); sfx('heal'); } else gainRelic(id); advance(); });
  $('#skipBtn').onclick = ()=>{ sfx('click'); advance(); };
}
function rollReward(RW, kind){
  let g = kind==='boss'?rand(55,70):kind==='elite'?rand(25,35):kind==='goblin'?rand(50,70)+20*Math.min(run.floor,FLOORS):rand(10,18);
  if(has('magnet')) g = Math.round(g*1.4);
  if(mut('rush')) g *= 2;
  if(has('glove')) g += 10;
  run.gold += g;
  let extra = '';
  if(has('crown')){ const i = Math.min(15, Math.floor(run.gold/10)); run.gold += i; extra += ` +${i} interest.`; }
  if(Math.random() < (kind==='combat'?0.35:0.5)){ const p = givePotion(); if(p) extra += ` Found a ${POTIONS[p].name}!`; }
  if(has('philflask')){ const p = givePotion(); if(p) extra += ` Brewed a ${POTIONS[p].name}.`; }
  if(skill('mend')){ const h = Math.round(run.maxHp*0.05*skill('mend')); heal(h); extra += ` Recovered ${h} HP.`; }
  if(has('bloodgem')){ heal(5); extra += ' Bloodstone heals 5.'; }
  if(setOn('wild')){ heal(6); extra += ' Wild set heals 6.'; }
  if(setOn('gold')){ const b = Math.round(g*0.2); run.gold += b; g += b; }
  questAdd('gold', g);
  let offers = [];
  if(kind==='combat' || kind==='goblin'){
    const pool = BOONS.filter(b=>!b.ok||b.ok());
    let guard = 0;
    while(offers.length<3 && guard++<50){ const b = weighted(pool.map(x=>[x,x.w])); if(!offers.some(o=>o.id===b.id)) offers.push({id:b.id, boon:true}); }
    if(Math.random()<(kind==='goblin'?1:0.3)){ const [id]=relicOffers(1); if(id) offers[2] = {id}; }
  } else {
    offers = relicOffers(3+(skill('sense')?1:0)+(has('compass')?1:0), kind==='boss'?2:1).map(id=>({id}));
  }
  Object.assign(RW, {g, extra, offers});
  renderRunbar();
}
function endScreen(won){
  cb = null; store.set('save', null);
  const wasEndless = run.floor>FLOORS+1 || run.won;
  if(run.won) won = false;
  let heatMsg = '';
  if(settings.tips && !settings.tipsManual && stats().runs>=1){ settings.tips = false; store.set('settings', settings); }
  bumpStats(s=>{ if(run.floor>FLOORS) s.bestDepth = Math.max(s.bestDepth||0, run.floor-FLOORS); if(won){ s.wins++; s.winsBy = s.winsBy||{}; s.winsBy[run.cls] = (s.winsBy[run.cls]||0)+1; } s.kills+=run.kills-(run.killsCounted||0); s.bestFloor=Math.max(s.bestFloor, Math.min(run.floor,FLOORS)); s.bestLines=Math.max(s.bestLines, run.bestLines); s.bestHit=Math.max(s.bestHit, run.bestHit); });
  if(won){
    unlock('win'); if(run.heat>=1) unlock('heat'); if(run.cls==='bard') unlock('bard');
    const wb = stats().winsBy; if(['knight','rogue','mage'].every(k=>wb[k])) unlock('allheroes');
    const mh = store.get('heat',0);
    if(run.heat>=mh && mh<HEAT.length-1){ store.set('heat', mh+1); heatMsg = `<p class="center" style="color:#ff8a80;font-family:var(--display);font-size:18px">${HEAT[mh+1].name} unlocked!</p>`; }
  }
  let earned = run.kills + (Math.min(run.floor,FLOORS)-1)*10 + (run.bosses||0)*15 + (won?50:0) + Math.max(0, run.floor-FLOORS-1)*20 + (has('bluelantern')?2*(run.rooms||0):0);
  earned = Math.round(earned * (1 + 0.15*(run.heat||0)) * (has('souljar')?1.5:1) * mutBonus(run.muts));
  earned = Math.max(0, earned - (run.awarded||0)); run.awarded = (run.awarded||0) + earned; run.killsCounted = run.kills;
  const mBefore = masteryLevel(run.cls); const mm = store.get('mastery', {}); mm[run.cls] = (mm[run.cls]||0) + earned; store.set('mastery', mm);
  const mAfter = masteryLevel(run.cls);
  let dailyMsg = '';
  if(run.daily){
    const score = Math.min(run.floor,FLOORS+1)*1000 + Math.max(0,run.floor-FLOORS-1)*1500 + run.kills*25 + (run.bosses||0)*400 + (won||wasEndless?3000:0) + Math.round(run.dmg/10);
    const d = store.get('daily', {}); const same = d.key===run.daily; const best = same ? Math.max(d.best||0, score) : score;
    let bonus = 0; if(!same || !d.rewarded){ bonus = 40; store.set('shards', soulShards()+bonus); }
    store.set('daily', {key:run.daily, best, rewarded:true, last:score});
    unlock('daily');
    dailyMsg = `<div class="card center"><div class="title" style="font-size:20px">Daily score: ${score.toLocaleString()}</div><div class="muted" style="font-size:13px">Today's best: ${best.toLocaleString()}${bonus?` · +${bonus} bonus Soul Shards`:''}</div></div>`;
  }
  if((won||wasEndless) && (run.muts||[]).filter(k=>MUTS[k].bonus>0).length>=3) unlock('mutant');
  checkThemeUnlocks();
  if(mAfter>=5) unlock('master');
  if(mAfter>mBefore) setTimeout(()=>sfx('levelup'), 900);
  const jr = store.get('journal', []); if(jr[0] && run.jid && jr[0].jid===run.jid) jr.shift(); jr.unshift({jid:run.jid, cls:run.cls, floor:Math.min(run.floor,FLOORS), depth:Math.max(0,run.floor-FLOORS-1), won: won||wasEndless, kills:run.kills, heat:run.heat||0, date:Date.now(), shards:earned, pet:run.pet||null, daily:!!run.daily}); store.set('journal', jr.slice(0,20));
  store.set('shards', soulShards() + earned); bumpStats(s=>s.shards += earned);
  checkHeroUnlocks();
  show('end'); Sound.music(won?'map':'menu');
  sfx(won?'victory':'defeat');
  if(won){ confetti(160); banner('VICTORY', 'The dungeon is conquered', 2600); }
  view(`${scene(won?'r_boss':'bones', won?'You conquered the dungeon!':wasEndless?'The depths claim you...':'You have fallen...', won?`${run.lastBoss||'The final guardian'} is banished. Legends will be told.`:wasEndless?`${CLASSES[run.cls].name} reached Endless Depth ${run.floor-FLOORS}.`:`${CLASSES[run.cls].name} fell on floor ${Math.min(run.floor,FLOORS)}, room ${run.step+1}.`)}
    ${heatMsg}
    ${dailyMsg}
    ${mAfter>mBefore?`<div class="card center" style="color:#ffcf7a;font-family:var(--display);font-size:18px">${CLASSES[run.cls].name} reached Mastery ${mAfter}!<div class="muted" style="font-family:var(--body);font-size:13px">${MASTERY_PERKS[mAfter-1]}</div></div>`:''}
    ${won && !wasEndless ? `<button class="btn" id="endlessBtn" style="background:linear-gradient(#c77dff,#8a3fd1);color:#fff;text-shadow:0 1px 0 #000">Descend into Endless Depths</button>` : ''}
    <div class="card center" style="display:flex;align-items:center;justify-content:center;gap:8px;font-family:var(--display);font-size:22px">${img('shard',34)}+${earned} Soul Shards<span class="muted" style="font-size:14px;font-family:var(--body)">(${soulShards()} total)</span></div>
    <div class="card"><div class="stats3">
      <div>${run.kills}<small>foes slain</small></div>
      <div>${run.dmg}<small>damage</small></div>
      <div>${run.bestHit}<small>biggest hit</small></div>
      <div>${run.bestLines}<small>best clear</small></div>
    </div></div>
    <div class="card"><p class="center muted" style="font-size:13px;margin-bottom:6px">${CLASSES[run.cls].name}${run.heat?` · Heat ${run.heat}`:''}${run.daily?' · Daily':''}${(run.muts||[]).length?` · ${run.muts.map(k=>MUTS[k].name).join(', ')}`:''} · ${run.relics.length} relics</p><div class="relicrow">${run.relics.map(id=>img(RELICS[id].spr,30)).join('')}</div></div>
    <button class="btn" id="againBtn">New Run</button>
    <button class="btn ghost" id="titleBtn">Title</button>`);
  $('#againBtn').onclick = ()=>{ sfx('click'); heroScreen(); }; $('#titleBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
  const eb = $('#endlessBtn');
  if(eb) eb.onclick = ()=>{ sfx('door'); run.won = true; run.floor = FLOORS+1; run.map = genMap(); run.path = []; run.room = null; heal(Math.round(run.maxHp*0.5)); banner('ENDLESS', floorName(), 2200); goMap(); };
}

/* ================= combat ================= */
/* ---------- the block bag: every piece's type is drawn from your curated bag ---------- */
const BAG_TYPES = ['sword','shield','heal','coin','rainbow','venom','blast'];
const BAG_MIN = 6;
const DEFAULT_BAG = {sword:6, shield:3, heal:2, coin:2};
const RELIC_BLOCKS = {prism:['rainbow',2], orb:['rainbow',2], toxin:['venom',2], gravetome:['venom',2], satchel:['blast',2]};
function startingBag(cls){
  const b = Object.assign({}, CLASSES[cls].bag || DEFAULT_BAG);
  return b;
}
const bagSize = () => Object.values(run.bag||{}).reduce((a,v)=>a+v,0);
function bagAdd(t, n=1){ run.bag[t] = (run.bag[t]||0) + n; }
function bagRemove(t, n=1){ if(!run.bag[t]) return false; if(bagSize()-n < BAG_MIN) return false; run.bag[t] = Math.max(0, run.bag[t]-n); if(!run.bag[t]) delete run.bag[t]; return true; }
function rollType(){
  if(!run.bag || !bagSize()) run.bag = startingBag(run.cls);
  if(cb){
    if(!cb.pile || !cb.pile.length){ cb.pile = shuffle(Object.entries(run.bag).flatMap(([t,n])=>Array(n).fill(t))); }
    return cb.pile.pop();
  }
  return weighted(Object.entries(run.bag));
}
function shapeWeight(s){
  const n = s.cells.length;
  let w = n<=2?0.9 : n<=4?1.3 : n<=5?1.0 : 0.5;
  if(has('feather')){ if(n<=3) w*=2.4; if(n>=6) w*=0.4; }
  if(mut('heavy')){ if(n>=5) w*=2.4; if(n<=2) w*=0.4; }
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
const STASH = 3;
const pieceAt = i => i===STASH ? cb.stash : cb.hand[i];
function rotatePiece(i){
  const p = pieceAt(i); if(!p) return; const r = rotated(p);
  p.cells = r.cells; p.h = r.h; p.w = r.w; p.rotT = performance.now();
  sfx('rotate');
  if(!store.get('rotated', false)){ store.set('rotated', true); const h = $('#hint'); if(h){ h.style.display = 'none'; layout(); } }
}
function dealHand(){
  let hand;
  for(let i=0;i<30;i++){ hand=[newPiece(),newPiece(),newPiece()]; if(hand.some(fitsAnyRot)) break; }
  cb.hand = hand;
}
function startCombat(kind, forced){
  if(!run) return;
  if(!run.room) run.room = {t:kind};
  const RM = run.room;
  if(RM.fight) return resumeFight(RM.fight);
  const F = floorPool();
  const pickTpl = () => kind==='boss' ? bossFor() : kind==='goblin' ? GOBLIN : pick(kind==='elite' ? F.elite : F.normal);
  const rollTpls = () => { const list = [pickTpl()];
    if(kind==='combat' && run.floor>=2 && Math.random() < (run.floor>=4 ? 0.38 : 0.3)){ let t2 = pick(F.normal); if(t2.name===list[0].name) t2 = pick(F.normal); list.push(t2); }
    return list; };
  let tpls = forced ? [forced] : RM.tpls || (RM.tpl ? [RM.tpl] : null) || (run.daily ? withSeed(runSeed(`e${run.floor}-${RM.r}-${RM.i}`), rollTpls) : rollTpls());
  let tpl = tpls[0];
  const heat = run.heat||0;
  let hpMul = FS([1.15,1.4,1.55,1.6,1.7]) * (kind==='boss'?1.1:(0.92+Math.random()*0.16));
  if(heat>=1) hpMul *= 1.15;
  if(mut('swarm') && kind==='combat') hpMul *= 1.3;
  if(heat>=5 && kind==='boss') hpMul *= 1.25;
  if(kind==='goblin') hpMul = FS([1,1.7,2.4,3.1,3.8]);
  if(heat>=4 && kind==='elite' && !tpl.passive && !RM.tpls){ const pid = pick(['regen','armor','thorns']); tpl = {...tpl, passive:{id:pid, v:pid==='regen'?3:pid==='armor'?15:2}}; tpls = [tpl, ...tpls.slice(1)]; }
  if(has('warhorn') && (kind==='elite'||kind==='boss')) hpMul *= 0.85;
  hpMul *= endlessMul();
  const maxHps = RM.maxHps || (RM.maxHp ? [RM.maxHp] : null) || tpls.map(t=>Math.round(t.hp * hpMul * (tpls.length>1 ? 0.58 : 1)));
  RM.tpls = tpls; RM.maxHps = maxHps; RM.t = kind; delete RM.tpl; delete RM.maxHp;
  cb = {
    kind, board:Array(N*N).fill(null), hand:[], stash:null, stashUsed:false, fx:[], parts:[], beams:[], pops:[], over:false, firstClear:true, doubleNext:false, phase:0, petT:0, firstHit:true,
    bombs:{}, chains:[], weak:[], weakT:0, webs:{}, silence:0,
    streak: (has('drum') ? 2 : 0) + skill('momentum'), tookDmg:false, mirror:has('mirror'), moves:0,
    shield: (has('chainmail')?8:0) + (has('oath')?6:0) + 4*skill('fort') + (setOn('iron')?10:0) + 6*pk('guard'),
    rerolls: 1+(has('dice')?1:0)+(has('goldendice')?1:0)+skill('hands')+pk('hands'),
    enemies: tpls.map((t,i)=>makeEnemy(t, maxHps[i])),
  };
  attachEnemy(cb);
  if(has('hexcharm')) cb.enemies.forEach(e=>{ if(!e.rare) e.poison += 5; });
  if(has('seedpod') && kind!=='goblin') addBlocks('heal', 3, true);
  if(pk('charged')) run.charge = Math.min(ULT().need, run.charge + 2*pk('charged'));
  tpls.forEach(t=>markSeen('e', t.name));
  run.charge = Math.min(ULT().need, run.charge + skill('focus'));
  if(run.floor>1 && kind!=='goblin') addBlocks('stone', Math.min(6,(run.floor-1)*2), true);
  cb.enemies.forEach(e=>nextIntent(e)); dealHand();
  if(kind!=='goblin') spawnWeak(kind==='elite'||kind==='boss' ? 2 : 1);
  $('#enemyPanel').dataset.sig = '';
  $('#hint').style.display = (settings.tips && !store.get('rotated', false)) ? '' : 'none';
  show('combat'); renderEnemies(); layout(); renderHUD();
  if(cb.enemies.length>1) setTimeout(()=>toast('<b>Two foes!</b><br>Cleared rows hit the left enemy, cleared columns hit the right one.', 'r_combat', 3200), 500);
  if(kind==='boss'){ flash('rgba(160,20,30,.5)'); sfx('rage'); banner(tpl.name, `Guardian of ${floorName()}`, 1800); }
  if(kind==='goblin'){ sfx('flee'); toast('<b>A Treasure Goblin!</b><br>Catch it before it escapes with its loot.', 'goldgoblin', 2600); }
  if(!run.masteryUsed && masteryLevel(run.cls)>=5){ run.masteryUsed = true; run.charge = ULT().need; }
  saveRun();
  if(run.charge >= ULT().need) setTimeout(()=>coach('ult', 'Special ready!', 'Your special move is charged. Tap it any time.', $('#ultBtn'), true), 900);
  setTimeout(()=>{ const b = cv.getBoundingClientRect(); coach('drag', 'How to play', 'Drag a piece from the tray onto the grid. Tap a piece to rotate it first.', {left:b.left, width:b.width, top:b.top+L.ty, bottom:b.top+L.ty+L.trayH}, true); }, 400);
}
function resumeFight(f){
  $('#hint').style.display = (settings.tips && !store.get('rotated', false)) ? '' : 'none';
  const enemies = f.enemies || (f.enemy ? [f.enemy] : []);
  cb = {...f, enemies, fx:[], parts:[], beams:[], pops:[], over:false, fled:false, hand:f.hand.map(p=>({...p, rotT:0})), stash: f.stash ? {...f.stash, used:false, rotT:0} : null,
    bombs: f.bombs||{}, chains: f.chains||[], weak: f.weak||[], weakT: f.weakT||0, webs: f.webs||{}, silence: f.silence||0};
  enemies.forEach(e=>{ if(!e.uid) e.uid = EUID++; else EUID = Math.max(EUID, e.uid+1); });
  delete cb.enemy; attachEnemy(cb);
  cb.enemies.forEach(e=>{ if(!e.intent) nextIntent(e); });
  $('#enemyPanel').dataset.sig = '';
  show('combat'); renderEnemies(); layout(); renderHUD();
  toast('<b>Fight resumed</b><br>Right where you left off.', cb.enemy.spr, 2000);
}
let EUID = 1;
function makeEnemy(tpl, maxHp){ const pas = tpl.passive || null; return {...tpl, uid:EUID++, maxHp, hp:maxHp, armor: pas&&pas.id==='armor'?pas.v:0, poison:0, rage:0, mi:0, intent:null, enraged:false, dead:false}; }
const MINIONS = {
  skeleton:{name:'Skeleton Minion', spr:'skeleton', minion:true, moves:[M('atk',5,2),M('armor',5,2)]},
  slimeling:{name:'Slimeling', spr:'slime', minion:true, moves:[M('atk',6,2),M('curse',2,2)]},
};
function addMinion(key, hp){
  const alive = cb.enemies[1] && !cb.enemies[1].dead && cb.enemies[1].hp>0;
  if(alive){ const m = cb.enemies[1]; m.hp = m.maxHp; floatText(eArt(m), 'Restored!', '#86e6a8'); return false; }
  const m = makeEnemy(MINIONS[key], Math.max(8, Math.round(hp))); nextIntent(m); m.intent.left++;
  cb.enemies[1] = m; markSeen('e', m.name);
  renderHUD(); const el = eArt(m); if(el){ burstAt(el, ['#c77dff','#fff','#86e6a8'], 18); }
  sfx('phase'); return true;
}
function attachEnemy(c){ Object.defineProperty(c, 'enemy', {get(){ return c.enemies.find(x=>!x.dead && x.hp>0) || c.enemies[0]; }, enumerable:false, configurable:true}); return c; }
const aliveEnemies = () => cb.enemies.filter(e=>!e.dead && e.hp>0);
function eArt(e){ const i = Math.max(0, cb && cb.enemies ? cb.enemies.indexOf(e || cb.enemy) : 0); return document.querySelector(`#enemyPanel .ecard[data-e="${i}"] .eart`) || document.querySelector('#enemyPanel .eart'); }
/* ---------- boss signature moves ---------- */
const BADGE_TXT = {
  ward: e=>`<b>Obsidian Ward</b><br>Immune to damage from cleared ${e.ward==='rows'?'rows':'columns'}. Hit it with ${e.ward==='rows'?'columns':'rows'}.`,
  reflect: ()=>`<b>Mirror</b><br>Half of the damage from your next clear bounces back at you.`,
  shell: ()=>`<b>Icy Hide</b><br>Takes half damage unless your clear includes a pure line (all one block type) or empties the grid.`,
  heads: e=>`<b>${e.heads} heads</b><br>Each head adds a hit to its multi-attacks.`,
};
function permuteBoard(fn){
  const nb = Array(N*N).fill(null), bombs = {}, now = performance.now();
  cb.board.forEach((t,i)=>{ if(!t) return; const j = fn(i); if(j!=null && j>=0 && j<N*N) nb[j] = t; });
  Object.entries(cb.bombs).forEach(([k,v])=>{ const j = fn(+k); if(j!=null && nb[j]==='bomb') bombs[j] = v; });
  cb.chains = cb.chains.map(ch=>({...ch, i:fn(ch.i)})).filter(ch=>ch.i!=null && nb[ch.i]);
  if(cb.webs){ const w = {}; Object.entries(cb.webs).forEach(([k,v])=>{ const j = fn(+k); if(j!=null && nb[j]==='web') w[j] = v; }); cb.webs = w; }
  cb.board = nb; cb.bombs = bombs;
  nb.forEach((t,i)=>{ if(t) cb.pops.push({i, t0:now}); });
}
const rc = i => [Math.floor(i/N), i%N];
const liveCells = () => { const a = []; cb.board.forEach((t,i)=>{ if(t && !JUNK(t)) a.push(i); }); return a; };
const emptyCells = () => { const a = []; cb.board.forEach((t,i)=>{ if(!t) a.push(i); }); return a; };
function zap(i, n){ const t = cb.board[i]; if(!t) return; shards(i, t, n||5); cb.fx.push({i, type:t, t0:performance.now()}); cb.board[i] = null; delete cb.bombs[i]; if(cb.webs) delete cb.webs[i]; }
function setCell(i, t){ if(cb.board[i]===t) return; delete cb.bombs[i]; cb.board[i] = t; cb.fx.push({i, type:t, t0:performance.now(), drop:true}); }
const SIG = {
  summon:{ic:'skeleton', info:(it,e)=>[`Summon`, `Raises a Skeleton Minion (${Math.round(it.v*bossScale())} HP), or restores the one it has`], act(e,it){ addMinion('skeleton', it.v*bossScale()); floatText($('#board'), 'Rise, minion!', '#d08bff', true); }},
  gnaw:{ic:'rat', info:it=>[`x${it.v}`, `Gnaws away ${it.v} of your best blocks`], act(e,it){
    const pri = t=>({rainbow:6,blast:5,sword:4,venom:3,heal:2,shield:2,coin:1}[t]||0);
    shuffle(liveCells()).sort((a,b)=>pri(cb.board[b])-pri(cb.board[a])).slice(0,it.v).forEach(i=>zap(i,6));
    floatText($('#board'), 'Gnawed!', '#ffb07a', true); sfx('steal'); shake(); }},
  overgrow:{ic:'shroom', info:it=>[`x${it.v}`, `Mold spreads: up to ${it.v} rubble blocks grow next to the rubble on your grid`], act(e,it){
    let grown = 0; const stones = shuffle(cb.board.map((t,i)=>t==='stone'?i:-1).filter(i=>i>=0));
    for(const s of stones){ if(grown>=it.v) break; const [r,c] = rc(s); const nb = shuffle([[1,0],[-1,0],[0,1],[0,-1]]).map(([dr,dc])=>[r+dr,c+dc]).find(([rr,cc])=>rr>=0&&cc>=0&&rr<N&&cc<N&&!cb.board[rr*N+cc]); if(nb){ setCell(nb[0]*N+nb[1], 'stone'); grown++; } }
    if(!grown) addBlocks('stone', Math.ceil(it.v/2));
    floatText($('#board'), 'Overgrowth!', '#c8ff8a'); sfx('rubble'); }},
  snatch:{ic:'glove', info:it=>[`x${it.v}`, `Snatches ${it.v} piece${it.v>1?'s':''} out of your hand`], act(e,it){
    if(has('glove')){ floatText($('#board'), 'Guarded!', '#ffe58a'); sfx('block'); return; }
    shuffle(cb.hand.map((p,i)=>p.used?-1:i).filter(i=>i>=0)).slice(0,it.v).forEach(i=>{ cb.hand[i].used = true; });
    if(cb.hand.every(p=>p.used)) dealHand();
    floatText($('#board'), 'Snatched!', '#ffe58a', true); sfx('steal'); }},
  web:{ic:'spider', info:it=>[`x${it.v}`, `Spins ${it.v} webs over empty cells. Webs fill the space and vanish after 3 moves`], act(e,it){
    cb.webs = cb.webs || {}; shuffle(emptyCells()).slice(0,it.v).forEach(i=>{ setCell(i,'web'); cb.webs[i] = 3; });
    floatText($('#board'), 'Webbed!', '#efeaf6'); sfx('rubble'); }},
  grow:{ic:'hydra', info:(it,e)=>[`+1 head`, `Grows another head (multi-attacks hit ${e.heads?e.heads:1} more time${(e.heads||1)>1?'s':''}) and heals ${Math.round(e.maxHp*0.06)}`], act(e){
    e.heads = (e.heads||1)+1; const h = Math.round(e.maxHp*0.06); e.hp = Math.min(e.maxHp, e.hp+h);
    floatText(eArt(e), `${e.heads} heads!`, '#86e6a8', true); sfx('rage'); }},
  feast:{ic:'heart', info:(it,e,d)=>[`${d}`, `Bites for ${d}, then eats your heart blocks (heals 6 each, ${cb?cb.board.filter(t=>t==='heal').length:0} on your grid now)`], act(e,it,d){
    hitPlayer(d); let n = 0; cb.board.forEach((t,i)=>{ if(t==='heal'){ zap(i,4); n++; } });
    if(n){ e.hp = Math.min(e.maxHp, e.hp + 6*n); floatText(eArt(e), `+${6*n}`, '#86e6a8'); } }},
  hex:{ic:'bones', info:it=>[`x${it.v}`, `Hexes ${it.v} piece${it.v>1?'s':''} in your hand into rubble`], act(e,it){
    if(has('stoneward')){ floatText($('#board'), 'Warded!', '#c9c2d4'); sfx('block'); return; }
    shuffle(cb.hand.filter(p=>!p.used && p.type!=='stone')).slice(0,it.v).forEach(p=>{ p.type = 'stone'; p.rotT = performance.now(); });
    floatText($('#board'), 'Hexed!', '#86e6a8', true); sfx('petrify'); }},
  haunt:{ic:'ghost', info:it=>[`x${it.v}`, `Swaps your rows around ${it.v} time${it.v>1?'s':''}`], act(e,it){
    for(let k=0;k<it.v;k++){ const rows = shuffle([...Array(N).keys()]); const a = rows[0], b = rows[1]; permuteBoard(i=>{ const [r,c] = rc(i); return (r===a?b:r===b?a:r)*N+c; }); }
    floatText($('#board'), 'Haunted!', '#e8e0f8', true); sfx('shuffle'); flash('rgba(200,180,255,.3)'); }},
  sandfall:{ic:'hourglass', info:it=>[`x${it.v}`, `Pours ${it.v} sand blocks that fall to the bottom of your grid`], act(e,it){
    for(let k=0;k<it.v;k++){ const cols = shuffle([...Array(N).keys()]).filter(c=>!cb.board[c]); if(!cols.length) break; const c = cols[0]; let r = 0; while(r+1<N && !cb.board[(r+1)*N+c]) r++; setCell(r*N+c, 'stone'); }
    floatText($('#board'), 'Sandfall!', '#ffe7a0'); sfx('rubble'); }},
  quake:{ic:'rock', info:(it,e,d)=>[`${d}`, `Quakes for ${d}: every block on your grid falls to the bottom`], act(e,it,d){
    const map = {}; for(let c=0;c<N;c++){ let w = N-1; for(let r=N-1;r>=0;r--){ const i = r*N+c; if(cb.board[i]){ map[i] = w*N+c; w--; } } }
    permuteBoard(i=>map[i]); hitPlayer(d); shake(); sfx('cavein'); floatText($('#board'), 'Quake!', '#c9c2d4', true); }},
  breath:{ic:'flame', info:(it,e)=>{ const n = fullestCol().n, d = breathDmg(it,e,n); return [`${d}`, `Burns your fullest column: removes its ${n} blocks and deals ${d}`]; }, act(e,it){
    const {c,n} = fullestCol(); for(let r=0;r<N;r++) zap(r*N+c, 7); hitPlayer(breathDmg(it,e,n));
    cb.beams.push({c, t0:performance.now()}); flash('rgba(255,120,30,.45)'); sfx('blast'); shake(); floatText($('#board'), 'Dragon fire!', '#ff8a3c', true); }},
  erupt:{ic:'blastblock', info:()=>[`3x3`, `Erupts: a 3x3 patch of your grid turns to rubble`], act(){
    const r0 = rand(0,N-3), c0 = rand(0,N-3); for(let r=r0;r<r0+3;r++) for(let c=c0;c<c0+3;c++) setCell(r*N+c, 'stone');
    flash('rgba(255,90,20,.4)'); sfx('blast'); shake(); floatText($('#board'), 'Eruption!', '#ff8a3c', true); }},
  inferno:{ic:'potion_fire', info:(it,e)=>{ const d = infernoDmg(it,e); return [`${d}`, `Deals ${it.v} per block on your grid (${d} right now). Clear lines to cool it down`]; }, act(e,it){
    hitPlayer(infernoDmg(it,e)); flash('rgba(255,90,20,.4)'); sfx('blast'); }},
  ritual:{ic:'rune', info:(it,e,d)=>{ const left = e.rit ? Math.max(0, e.rit.need - e.rit.got) : 0; return [`${d}`, `Channels a ritual for ${d}. Deal ${left} more damage to it to break the ritual`]; },
    start(e){ e.rit = {need:Math.round(e.maxHp*0.2), got:0}; },
    act(e,it,d){ if(e.rit && e.rit.got>=e.rit.need){ floatText(eArt(e), 'Ritual broken!', '#ffd23f', true); sfx('kill'); } else { hitPlayer(d); flash('rgba(160,60,255,.45)'); } e.rit = null; }},
  ward:{ic:'stoneward', info:(it,e)=>[`${e.ward==='rows'?'Cols':'Rows'}`, `Shifts its ward: it becomes immune to cleared ${e.ward==='rows'?'columns':'rows'}`], act(e){
    e.ward = e.ward==='rows' ? 'cols' : 'rows'; floatText(eArt(e), `Immune to ${e.ward==='rows'?'rows':'columns'}`, '#c9b6ff', true); sfx('armor'); }},
  freezerow:{ic:'snow', info:()=>[`Row`, `Freezes every empty cell in your emptiest row`], act(){
    let best = -1, bn = 0; for(let r=0;r<N;r++){ let n = 0; for(let c=0;c<N;c++) if(!cb.board[r*N+c]) n++; if(n>bn){ bn = n; best = r; } }
    if(best>=0) for(let c=0;c<N;c++) if(!cb.board[best*N+c]) setCell(best*N+c, 'ice');
    flash('rgba(160,220,255,.4)'); sfx('ice'); floatText($('#board'), 'Frozen solid!', '#c8f0ff', true); }},
  rise:{ic:'i_rise', info:()=>[`+1 row`, `Pushes a row of ice up from the bottom. Blocks in your top row are lost`], act(){
    permuteBoard(i=>i-N>=0 ? i-N : null); const gap = rand(0,N-1); for(let c=0;c<N;c++) if(c!==gap) setCell((N-1)*N+c, 'ice');
    sfx('ice'); shake(); floatText($('#board'), 'The ice rises!', '#c8f0ff', true); }},
  roar:{ic:'i_silence', info:it=>[`${it.v} moves`, `Roars: your special is silenced for ${it.v} moves`], act(e,it){
    cb.silence = Math.max(cb.silence||0, it.v); floatText($('#ultBtn'), 'Silenced!', '#ff8a80', true); sfx('rage'); shake(); renderHUD(); }},
  shatter:{ic:'i_shatter', info:(it,e)=>{ const n = cb ? cb.board.filter(t=>t==='ice').length : 0, d = Math.round(n*it.v*bossScale()) + e.rage; return [`${d}`, `Shatters every ice block on your grid: ${Math.round(it.v*bossScale())} damage each (${d} right now)`]; }, act(e,it){
    let n = 0; cb.board.forEach((t,i)=>{ if(t==='ice'){ zap(i,6); n++; } }); if(n) hitPlayer(Math.round(n*it.v*bossScale()) + e.rage); else floatText($('#board'), 'Nothing to shatter', '#c8f0ff');
    sfx('ice'); shake(); }},
  reflect:{ic:'mirror', info:()=>[`Mirror`, `Raises a mirror: half of your next clear's damage bounces back at you`], act(e){
    e.reflect = true; floatText(eArt(e), 'Mirror up!', '#bfe6ff', true); sfx('armor'); }},
  flip:{ic:'i_flip', info:()=>[`Flip`, `Flips your entire grid left to right`], act(){
    permuteBoard(i=>{ const [r,c] = rc(i); return r*N + (N-1-c); }); sfx('shuffle'); shake(); flash('rgba(200,20,40,.3)'); floatText($('#board'), 'Flipped!', '#ff8a80', true); }},
  tide:{ic:'i_tide', info:()=>[`Shift`, `Its undertow drags every block one column to the left (the left edge wraps around)`], act(){
    permuteBoard(i=>{ const [r,c] = rc(i); return r*N + (c+N-1)%N; }); sfx('whoosh'); floatText($('#board'), 'Undertow!', '#7fd0ff', true); }},
  scramble:{ic:'dice', info:()=>[`Mix`, `Scrambles the types of every block on your grid`], act(){
    const cells = liveCells(), types = shuffle(cells.map(i=>cb.board[i])); cells.forEach((i,k)=>{ cb.board[i] = types[k]; cb.pops.push({i, t0:performance.now()}); });
    sfx('shuffle'); floatText($('#board'), 'Chaos!', '#c77dff', true); }},
  rewind:{ic:'hourglassx', info:(it,e)=>{ const to = rewindTo(e); return [`${to}`, `Rewinds time back to ${to} HP`]; }, act(e){
    const to = rewindTo(e); if(to>e.hp){ floatText(eArt(e), `+${to-e.hp}`, '#86e6a8', true); e.hp = to; } sfx('phase'); flash('rgba(120,200,255,.35)'); }},
  doom:{ic:'i_doom', info:(it,e,d)=>[`${d}`, `Marks a ${e.intent&&e.intent.line&&e.intent.line.r!=null?'row':'column'}. Clear it before the countdown ends or take ${d}`],
    start(e){ const isRow = Math.random()<0.5, idx = rand(0,N-1); e.intent.line = isRow ? {r:idx} : {c:idx}; },
    act(e,it,d){ if(it.broken){ floatText($('#board'), 'Doom averted!', '#ffd23f', true); sfx('relic'); } else { hitPlayer(d); flash('rgba(200,20,40,.5)'); } }},
  devour:{ic:'fang', info:()=>[`3x3`, `Devours a 3x3 chunk of your grid and heals 4 for every block it eats`], act(e){
    let best = null; for(let r0=0;r0<=N-3;r0++) for(let c0=0;c0<=N-3;c0++){ let n = 0; for(let r=r0;r<r0+3;r++) for(let c=c0;c<c0+3;c++) if(cb.board[r*N+c]) n++; if(!best || n>best.n) best = {r0,c0,n}; }
    let n = 0; for(let r=best.r0;r<best.r0+3;r++) for(let c=best.c0;c<best.c0+3;c++) if(cb.board[r*N+c]){ zap(r*N+c,6); n++; }
    if(n){ e.hp = Math.min(e.maxHp, e.hp + 4*n); floatText(eArt(e), `+${4*n}`, '#86e6a8'); }
    sfx('kill'); shake(); floatText($('#board'), 'Devoured!', '#c77dff', true); }},
};
const bossScale = () => FS([1,1.1,1.2,1.3,1.4]) * (run.floor>5 ? 1+0.12*(run.floor-5) : 1);
function fullestCol(){ let c = 0, n = -1; for(let k=0;k<N;k++){ let m = 0; for(let r=0;r<N;r++) if(cb && cb.board[r*N+k]) m++; if(m>n){ n = m; c = k; } } return {c, n:Math.max(0,n)}; }
const breathDmg = (it,e,n) => Math.round((6 + n*it.v)*bossScale()) + (e?e.rage:0);
const infernoDmg = (it,e) => Math.round((4 + (cb?cb.board.filter(Boolean).length:0)*it.v)*bossScale()) + (e?e.rage:0);
const rewindTo = e => { const h = e.hist||[]; return Math.max(e.hp, h.length ? h[Math.max(0, h.length-3)] : e.hp); };
/* ---------- grid hazards ---------- */
function spawnWeak(n){
  const empty = []; cb.board.forEach((v,i)=>{ if(!v && !cb.weak.includes(i)) empty.push(i); });
  shuffle(empty).slice(0,n).forEach(i=>cb.weak.push(i));
}
function hazardTick(){
  const now = performance.now();
  Object.keys(cb.bombs).forEach(k=>{ const i = +k; if(cb.board[i]!=='bomb'){ delete cb.bombs[k]; return; }
    cb.bombs[k]--;
    if(cb.bombs[k]<=0){ delete cb.bombs[k]; cb.board[i] = 'stone'; cb.fx.push({i,type:'bomb',t0:now}); shards(i,'bomb',10);
      const r = Math.floor(i/N), c = i%N; [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{ const rr=r+dr, cc=c+dc; if(rr>=0&&cc>=0&&rr<N&&cc<N&&!cb.board[rr*N+cc]&&Math.random()<0.5){ cb.board[rr*N+cc]='stone'; cb.fx.push({i:rr*N+cc,type:'stone',t0:now,drop:true}); } });
      floatText($('#board'), 'BOOM!', '#ff8a3c', true); sfx('blast'); shake(); hitPlayer(pk('defuse') ? Math.ceil(bombDmg()/2) : bombDmg()); }
  });
  cb.chains = cb.chains.filter(ch=>{ ch.t--; return ch.t>0 && cb.board[ch.i]; });
  if(cb.webs) Object.keys(cb.webs).forEach(k=>{ const i = +k; if(cb.board[i]!=='web'){ delete cb.webs[k]; return; } if(--cb.webs[k]<=0){ delete cb.webs[k]; cb.board[i] = null; cb.fx.push({i,type:'web',t0:now}); } });
  if(cb.silence>0) cb.silence--;
  if(cb.turret>0 && aliveEnemies().length){ cb.turret--; const tg = aliveEnemies()[0]; damageEnemy(5 + 2*Math.min(run.floor,8), true, false, tg); floatText($('#ultBtn'), 'Turret!', '#ffd23f'); sfx('hit'); }
  if(has('totem') && cb.moves && cb.moves%4===0){ const cand = liveCells().filter(i=>cb.board[i]!=='rainbow'); if(cand.length){ const i = pick(cand); cb.board[i] = 'rainbow'; cb.fx.push({i,type:'rainbow',t0:now,drop:true}); floatText($('#board'), 'Spirit!', '#f0d6ff'); } }
  const want = (cb.kind==='elite'||cb.kind==='boss') ? 2 : 1;
  if(cb.kind!=='goblin' && cb.weak.length < want && ++cb.weakT >= 3){ cb.weakT = 0; spawnWeak(1); }
}
const streakStep = () => ((has('daggers') ? 0.5 : 0.25) + 0.1*pk('rhythm')) * (has('seerorb') ? 1.5 : 1);
/* ---------- in-run levels & perks ---------- */
const PERKS = {
  tough:{name:'Toughness', spr:'heart', max:5, desc:'+8 max HP and heal 8.', apply(){ run.maxHp += 8; heal(8); }},
  sharp:{name:'Sharpened Edge', spr:'sword', max:3, desc:'Sword blocks deal +1 damage.'},
  sturdy:{name:'Sturdy Guard', spr:'shield', max:3, desc:'Shield blocks give +1 shield.'},
  mend:{name:'Field Medic', spr:'heal_icon', max:3, desc:'Heart blocks heal +1.'},
  greed:{name:'Greed', spr:'coin', max:3, desc:'Coin blocks give +1 gold.'},
  focus:{name:'Focus', spr:'flame', max:2, desc:'Your special needs 1 fewer line.', apply(){ run.ultBonus = (run.ultBonus||0)+1; }},
  hands:{name:'Quick Hands', spr:'dice', max:2, desc:'+1 hand reroll every fight.'},
  guard:{name:'Ready Stance', spr:'armor', max:3, desc:'Start every fight with +6 shield.'},
  rhythm:{name:'Rhythm', spr:'drum', max:3, desc:'Combo streaks add +0.1 more to your multiplier.'},
  opener:{name:'Opening Strike', spr:'daggers', max:3, desc:'Your first clear each fight deals +10 damage.'},
  wind:{name:'Second Wind', spr:'feather', max:1, desc:'Once per fight, dropping below 30% HP heals you for 15.'},
  satchel:{name:'Deep Pockets', spr:'cauldron', max:1, desc:'+1 potion slot and a random potion.', ok:()=>!mut('dry'), apply(){ run.potionSlots++; givePotion(); }},
  toxic:{name:'Toxic Touch', spr:'poison', max:3, desc:'Every clear also poisons the enemy for 1.'},
  wrecker:{name:'Wrecker', spr:'hammer', max:2, desc:'Rubble, ice and webs in your clears deal 2 damage each.'},
  scav:{name:'Scavenger', spr:'satchel', max:3, desc:'+6 gold after every fight.'},
  medic:{name:'Bandages', spr:'potion_health', max:3, desc:'Heal 5 after every fight.'},
  defuse:{name:'Bomb Squad', spr:'bomb', max:1, desc:'Enemy bombs explode for half damage.'},
  stasher:{name:'Packrat', spr:'bagicon', max:2, desc:'Stashing a piece gives 3 shield.'},
  weak:{name:'Keen Eye', spr:'weakspot', max:2, desc:'Weak spots deal +50% bonus damage.'},
  charged:{name:'Battle Trance', spr:'orb', max:2, desc:'Start every fight with 2 special charge.'},
  purist:{name:'Purist', spr:'gem', max:2, desc:'Pure lines add another +0.25 to the multiplier.'},
  finisher:{name:'Clean Sweep', spr:'trophy', max:2, desc:'Perfect clears deal +25 damage.'},
  thorns:{name:'Spiked Armor', spr:'spikes', max:2, desc:'When an enemy hits your shield, it takes 3 damage.'},
  vigor:{name:'Vigor', spr:'emberheart', max:1, desc:'Heal to full now.', apply(){ run.hp = run.maxHp; }},
};
const pk = id => (run && run.perks && run.perks[id]) || 0;
const xpNeed = lv => 18 + 10*(lv-1);
function gainXP(n){
  run.level = run.level || 1; run.xp = (run.xp||0) + n;
  while(run.xp >= xpNeed(run.level)){ run.xp -= xpNeed(run.level); run.level++; run.lvUp = (run.lvUp||0)+1; }
  if(run.level>=8) unlock('level8');
}
function perkOffers(){
  const pool = Object.keys(PERKS).filter(k=>pk(k) < PERKS[k].max && (!PERKS[k].ok || PERKS[k].ok()));
  return shuffle(pool).slice(0,3);
}
function levelScreen(then){
  show('reward');
  if(!run.lvOffer || !run.lvOffer.length) run.lvOffer = perkOffers();
  saveRun(); sfx('levelup'); setTimeout(()=>confetti(40), 80);
  view(`${scene(CLASSES[run.cls].spr, `Level ${run.level - (run.lvUp-1)}!`, `${CLASSES[run.cls].name} grows stronger. Choose a perk:`)}
    <div class="choices">${run.lvOffer.map(k=>{ const P = PERKS[k]; return `<button class="choice" data-id="${k}">${img(P.spr,46)}<div><b>${P.name}${pk(k)?` <span class="muted" style="font-size:12px">${pk(k)}/${P.max}</span>`:''}</b><small>${P.desc}</small></div></button>`; }).join('')}</div>
    ${run.lvOffer.length?'':`<button class="btn" id="lvSkip">Continue</button>`}`);
  const done = () => { run.lvUp = Math.max(0, (run.lvUp||1)-1); run.lvOffer = null; saveRun(); renderRunbar(); then(); };
  document.querySelectorAll('#view .choice').forEach(b=>b.onclick = ()=>{ const k = b.dataset.id; run.perks = run.perks || {}; run.perks[k] = pk(k)+1; if(PERKS[k].apply) PERKS[k].apply(); sfx('relic'); toast(`<b>${PERKS[k].name}</b><br>${PERKS[k].desc}`, PERKS[k].spr); done(); });
  const s = $('#lvSkip'); if(s) s.onclick = done;
}
function openPerks(){
  sfx('click'); const m = $('#modal'); m.hidden = false;
  const owned = Object.keys(run.perks||{});
  m.innerHTML = `<div class="card" role="dialog" aria-label="Level and perks" style="max-height:84vh;overflow:auto">
    <div class="scene">${img(CLASSES[run.cls].spr,80)}<h2 class="title" style="font-size:24px">Level ${run.level||1}</h2>
    <p class="muted">${run.xp||0} / ${xpNeed(run.level||1)} XP to the next level. Win fights to earn XP.</p></div>
    ${owned.length ? owned.map(k=>`<div class="troph">${img(PERKS[k].spr,34)}<div><b>${PERKS[k].name} ${PERKS[k].max>1?`<span class="muted" style="font-size:12px">${pk(k)}/${PERKS[k].max}</span>`:''}</b><small>${PERKS[k].desc}</small></div></div>`).join('') : '<p class="muted center">No perks yet. Level up to choose one.</p>'}
    <button class="btn" id="closeBtn">Close</button></div>`;
  $('#closeBtn').onclick = closeSettings; m.onclick = ev=>{ if(ev.target===m) closeSettings(); };
}
function nextIntent(e){
  e = e || cb.enemy; const m = e.moves[e.mi % e.moves.length]; e.mi++;
  e.intent = {...m, left: Math.max(1, m.t + (has('hourglass')&&m.k!=='flee'?1:0) - (mut('hasty')&&m.k!=='flee'?1:0))};
  if(SIG[m.k] && SIG[m.k].start) SIG[m.k].start(e);
}
function peekIntent(e){ e = e || cb.enemy; return e.moves[e.mi % e.moves.length]; }
function intentDamage(it, e){ e = e || cb.enemy; return Math.round(it.v*FS([1.1,1.25,1.35,1.45,1.55])*((run.heat||0)>=2?1.15:1)*(run.floor>5?1+0.12*(run.floor-5):1)) + (e ? e.rage : 0); }
function addBlocks(type, n, silent){
  const empty = []; cb.board.forEach((v,i)=>{ if(!v) empty.push(i); });
  shuffle(empty).slice(0,n).forEach(i=>{ cb.board[i]=type; if(!silent) cb.fx.push({i, t0:performance.now(), drop:true, type}); });
}
function place(idx, r, c){
  const p = pieceAt(idx); if(!p) return;
  const fromStash = idx===STASH;
  const now0 = performance.now();
  p.cells.forEach(([dr,dc])=>{ const i = (r+dr)*N + c+dc; cb.board[i] = p.type; cb.pops.push({i, t0:now0}); });
  if(fromStash){ cb.stash = null; run.stashPlays = (run.stashPlays||0)+1; unlock('stasher'); if(has('packrat')){ cb.shield += 4; floatText($('#shieldStat'), '+4', '#a8ceff'); } }
  else p.used = true;
  cb.stashUsed = false; selPotion = -1; cb.moves++;
  sfx('place'); buzz(8);
  document.querySelectorAll('.coach').forEach(c=>c.remove());
  resolveClears();
  if(checkEnd()) return;
  if(run.pet){ petTick(); if(cb.petT===0) questAdd('pets', 1); if(checkEnd()) return; }
  if(!cb.lastCleared && has('tidecharm')){ cb.shield += 3; floatText($('#shieldStat'), '+3', '#a8ceff'); }
  enemyTick();
  if(checkEnd()) return;
  if(cb.hand.every(x=>x.used)) dealHand();
  checkStuck();
  if(checkEnd()) return;
  renderHUD();
  saveRun();
  if(cb.moves===1) setTimeout(()=>{ const b = cv.getBoundingClientRect(); coach('clear', 'Clear lines', 'Fill a whole row or column. Every block in it fires: swords hit, shields block, hearts heal, coins pay. Drag over the grid to preview the result.', {left:b.left, width:b.width, top:b.top+L.ty, bottom:b.top+L.ty+L.trayH}, true); }, 350);
  else if(cb.moves===4) setTimeout(()=>{ const b = cv.getBoundingClientRect(), B = L.stash; coach('stash', 'Stash', 'Drag a piece into the Stash to save it for later. You can stash once per move.', {left:b.left+B.x, width:B.w, top:b.top+B.y, bottom:b.top+B.y+B.h}, true); }, 350);
  else if(cb.moves===2) setTimeout(()=>coach('intent', 'Enemy intent', 'This is what the enemy does next, and how many of your moves until it happens.', $('#enemyPanel .intent'), false), 350);
  if(run.charge >= ULT().need) coach('ult', 'Special ready!', 'Your special move is charged. Tap it any time.', $('#ultBtn'), true);
}
function fullLines(board){
  const rows=[], cols=[], ch = (cb && cb.chains && cb.chains.length) ? new Set(cb.chains.map(x=>x.i)) : null;
  const full = i => board[i] && !(ch && ch.has(i));
  for(let r=0;r<N;r++){ let ok=true; for(let c=0;c<N;c++) if(!full(r*N+c)){ok=false;break;} if(ok) rows.push(r); }
  for(let c=0;c<N;c++){ let ok=true; for(let r=0;r<N;r++) if(!full(r*N+c)){ok=false;break;} if(ok) cols.push(c); }
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
  let mult = MULT[Math.min(lines,8)] + cb.streak*streakStep() + pure*((has('purist')||has('huntersmark'))?1:0.5) + pure*0.25*pk('purist');
  if(cb.firstClear && has('ring')) mult *= 2;
  if(cb.doubleNext) mult *= 2;
  const set = lineCells(rows, cols);
  const blasted = expandBlast(board, set);
  return {set, lines, rows:rows.length, cols:cols.length, rowIdx:rows, colIdx:cols, pure, mult, blasted};
}
function computeEffects(board, set, o){
  const cnt = {sword:0,shield:0,heal:0,coin:0,rainbow:0,venom:0,blast:0,stone:0,ice:0,bomb:0,web:0};
  set.forEach(i=>{ const t = board[i]; if(t) cnt[t]++; });
  const Lv = run.lvl, mult = o.mult, lines = o.lines;
  const swordVal = 2 + Lv.sword + pk('sharp') + (has('whetstone')?1:0) + (has('bloodpact')?2:0) + (mut('glass')?2:0);
  let shieldVal = 2 + Lv.shield + pk('sturdy') + (has('tower')?1:0) + (has('oath')?1:0);
  if(mut('frail')) shieldVal = Math.max(1, Math.floor(shieldVal/2));
  let healVal = 2 + Lv.heal + pk('mend') + (has('seedpod')?1:0);
  let swordBonus = 0;
  if(has('bloodlust')){ swordBonus = Math.floor((1 - Math.max(0,run.hp)/run.maxHp)*5); healVal = Math.max(1, healVal-1); }
  const coinVal = 1 + Lv.coin + pk('greed') + (has('doubloon')?1:0) + (has('idol')?1:0) + (has('daggers')?1:0) + (setOn('gold')?2:0);
  let dmg = Math.round((cnt.sword*(swordVal+swordBonus) + cnt.rainbow*2 + cnt.blast*3) * mult);
  let sh  = Math.round((cnt.shield*shieldVal + cnt.rainbow) * mult);
  let hp  = Math.round((cnt.heal*healVal + cnt.rainbow) * mult);
  const poison = Math.round(cnt.venom * mult) + pk('toxic');
  const gold = cnt.coin*coinVal;
  if(has('sledge')) dmg += (cnt.stone+cnt.ice)*4;
  dmg += (cnt.stone+cnt.ice+cnt.web)*2*pk('wrecker');
  if(has('katana') && lines===1) dmg += 8;
  if(has('doubloon')) dmg += cnt.coin;
  if(has('gearbox')) dmg += cnt.blast*4;
  if(has('frostshard')) dmg += cnt.ice*4;
  if(cb && cb.firstClear && pk('opener')) dmg += 10*pk('opener');
  if(lines>=3){ if(has('powder')) dmg += 12; if(has('orb')) dmg += 8; }
  if(has('crossed') && o.rows && o.cols) dmg += 8;
  if(has('fang')) hp += 2*lines;
  if(setOn('blood')) hp += lines;
  if(setOn('blast') && lines>=3) dmg += 10;
  if(has('huntersmark')) dmg += 3*lines;
  let weakHits = 0; if(cb && cb.weak) set.forEach(i=>{ if(cb.weak.includes(i) && board[i]) weakHits++; });
  dmg += Math.round(weakHits*weakBonus()*(1+0.5*pk('weak'))) + cnt.bomb*5;
  if(has('holysymbol')) dmg += Math.round(cnt.heal*2*mult);
  let perfect = true;
  for(let i=0;i<N*N;i++){ const t = board[i]; if(t && (!set.has(i) || (t==='ice' && !has('warmcloak') && !has('frostshard')))){ perfect = false; break; } }
  if(perfect) dmg += 20 + 10*(run.floor-1) + 25*pk('finisher');
  const e = cb.enemy;
  if(has('scythe') && e.hp < e.maxHp*0.3) dmg = Math.round(dmg*1.5);
  if(e.passive && e.passive.id==='ethereal' && lines===1) dmg = Math.floor(dmg/2);
  return {dmg, sh, hp, poison, gold, perfect, cnt, weakHits};
}
function resolveClears(){
  const plan = planClear(cb.board);
  cb.lastCleared = !!plan;
  if(!plan){ cb.streak = has('prayerbeads') ? Math.max(has('drum')?2:0, cb.streak-1) : has('drum') ? 2 : 0; return; }
  cb.doubleNext = false; cb.firstClear = false;
  fireCells(plan.set, plan);
  cb.streak++;
  if(cb.streak>=2) setTimeout(()=>sfx('combo', cb ? cb.streak : 2), 120);
  if(has('lute') && cb.streak>0 && cb.streak%3===0){ cb.shield += 8; heal(5); floatText($('#shieldStat'), '+8', '#a8ceff'); floatText($('#board'), 'Chord!', '#ffb3e6', true); sfx('relic'); }
  if(setOn('arcane') && plan.lines>=2) run.charge = Math.min(ULT().need, run.charge+1);
}
/* fires every block in `set`, clears them, applies all effects */
function fireCells(set, o){
  const fx = computeEffects(cb.board, set, o);
  const now = performance.now();
  (o.rowIdx||[]).forEach(r=>cb.beams.push({r, t0:now})); (o.colIdx||[]).forEach(c=>cb.beams.push({c, t0:now}));
  const rowS = new Set(o.rowIdx||[]), colS = new Set(o.colIdx||[]);
  let wRow = 0, wCol = 0;
  const DMG_T = {sword:1, rainbow:1, blast:1, venom:0.5};
  const fly = {shield:[], heal:[], coin:[]}, flyL = [], flyR = [];
  set.forEach(i=>{ const t = cb.board[i]; if(!t) return; const inR = rowS.has(Math.floor(i/N)), inC = colS.has(i%N);
    if(DMG_T[t]){ if(inR && !inC) wRow += DMG_T[t]; else if(inC && !inR) wCol += DMG_T[t]; else { wRow += DMG_T[t]/2; wCol += DMG_T[t]/2; } (inC && !inR ? flyR : flyL).push([cellScreen(i), TYPES[t].c]); }
    else if(fly[t]) fly[t].push(cellScreen(i)); });
  if(!wRow && !wCol){ wRow = (o.rowIdx||[]).length; wCol = (o.colIdx||[]).length; if(!wRow && !wCol) wRow = 1; }
  const al = aliveEnemies(), multi = cb.enemies.length>1 && al.length>1;
  const tL = multi ? cb.enemies[0] : cb.enemy, tR = multi ? cb.enemies[1] : cb.enemy;
  flyL.slice(0,10).forEach(([pt,col])=>flyTo([pt], eArt(tL), col)); flyR.slice(0,10).forEach(([pt,col])=>flyTo([pt], eArt(tR), col));
  const tgt = {shield:'#shieldStat', heal:'#hpFill', coin:'#goldWrap'};
  Object.entries(fly).forEach(([t,pts])=>{ if(pts.length) flyTo(pts.slice(0,10), $(tgt[t]), TYPES[t].c); });
  /* hazards touched by this clear */
  const nb = []; set.forEach(i=>{ if(cb.weak.includes(i) && cb.board[i]){ cb.weak = cb.weak.filter(x=>x!==i); nb.push(i); } if(cb.board[i]==='bomb') delete cb.bombs[i]; });
  if(nb.length){ floatText($('#board'), nb.length>1?`Weak spots x${nb.length}!`:'Weak spot!', '#ffd23f', true); sfx('relic'); }
  if(cb.chains.length){ const before = cb.chains.length;
    cb.chains = cb.chains.filter(ch=>{ const r = Math.floor(ch.i/N), c = ch.i%N; return ![[1,0],[-1,0],[0,1],[0,-1],[0,0]].some(([dr,dc])=>{ const rr=r+dr, cc=c+dc; return rr>=0&&cc>=0&&rr<N&&cc<N&&set.has(rr*N+cc); }); });
    if(cb.chains.length<before){ floatText($('#board'), 'Chains broken!', '#c9d2df'); sfx('armor'); } }
  set.forEach(i=>{
    const t = cb.board[i]; if(!t) return;
    shards(i, t, o.lines>=3?7:5);
    if(t==='ice' && !has('warmcloak') && !has('frostshard')){ cb.board[i]='stone'; cb.fx.push({i,type:'ice',t0:now}); }
    else { cb.fx.push({i, type:t, t0:now}); cb.board[i]=null; }
  });
  const lines = o.lines, mult = o.mult;
  run.bestLines = Math.max(run.bestLines, lines);
  questAdd('lines', lines); if(lines>=3) questAdd('triples', 1);
  if(lines>=4) unlock('quad');
  if(o.pure){ unlock('pure'); bumpStats(s=>s.pures=(s.pures||0)+o.pure); questAdd('pures', o.pure); }
  if(fx.perfect) unlock('perfect');
  const C = ULT();
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
  if(cb.firstHit && has('ironfist') && fx.dmg>0){ fx.dmg += 15; }
  if(fx.dmg>0) cb.firstHit = false;
  if(lines>=2 && has('emberheart')){ cb.enemy.poison += 3; }
  cb.enemies.forEach(e=>{ if(e.intent && e.intent.k==='doom' && e.intent.line && !e.intent.broken){ const L2 = e.intent.line; if((L2.r!=null && (o.rowIdx||[]).includes(L2.r)) || (L2.c!=null && (o.colIdx||[]).includes(L2.c))){ e.intent.broken = true; floatText($('#board'), 'Doom line cleared!', '#ffd23f', true); sfx('relic'); } } });
  if(fx.dmg>0){ routeDamage(fx.dmg, wRow, wCol, multi, {pure:o.pure, perfect:fx.perfect}); if(has('leech') && fx.dmg>=8){ const lh = Math.floor(fx.dmg/8); heal(lh); floatText(hpEl(), `+${lh}`, '#86e6a8'); } if(has('bloodchalice') && fx.dmg>=6){ const lh = Math.floor(fx.dmg/6); heal(lh); setTimeout(()=>floatText(hpEl(), `+${lh}`, '#ff8a9a'), 150); } }
  if(fx.poison>0){ cb.enemy.poison += fx.poison; floatText(eArt(), `+${fx.poison} poison`, '#dcb6ff'); sfx('poison'); }
  if(fx.sh>0){ cb.shield += fx.sh; floatText($('#shieldStat'), `+${fx.sh}`, '#a8ceff'); sfx('shield'); }
  if(fx.hp>0){ const before=run.hp; heal(fx.hp); const got=run.hp-before; if(got>0){ floatText(hpEl(), `+${got}`, '#86e6a8'); sfx('heal'); }
    const over = fx.hp - got; if(over>0 && has('holysymbol')){ cb.shield += over; floatText($('#shieldStat'), `+${over}`, '#a8ceff'); } }
  if(!o.noCharge) cb.lastClear = {dmg:fx.dmg, sh:fx.sh, hp:fx.hp, poison:fx.poison, gold:fx.gold};
  if(fx.gold>0){ run.gold += fx.gold; floatText($('#goldWrap'), `+${fx.gold}`, '#ffe58a'); sfx('coin'); burstAt($('#goldWrap'), ['#f7c936','#ffe58a'], 6); }
}
function routeDamage(total, wRow, wCol, multi, ctx){
  const sum = (wRow + wCol) || 1;
  const parts = multi ? [[cb.enemies[0], Math.round(total * wRow / sum), 'rows'], [cb.enemies[1], total - Math.round(total * wRow / sum), 'cols']]
    : [[cb.enemy, total, null]];
  parts.forEach(([e, n, lane])=>{
    if(!e || n<=0) return;
    if(e.ward){ const blockedShare = lane ? (lane===e.ward ? 1 : 0) : (e.ward==='rows' ? wRow/sum : wCol/sum); const cut = Math.round(n*blockedShare); if(cut>0){ n -= cut; setTimeout(()=>floatText(eArt(e), 'Warded!', '#c9b6ff'), 120); } }
    if(e.sig==='shell' && !(ctx && (ctx.pure || ctx.perfect))){ n = Math.ceil(n/2); setTimeout(()=>floatText(eArt(e), 'Icy hide!', '#c8f0ff'), 160); }
    if(n<=0) return;
    if(e.reflect){ e.reflect = false; const back = Math.round(n/2); setTimeout(()=>{ if(cb && !cb.over){ floatText(eArt(e), 'Reflected!', '#bfe6ff', true); hitPlayer(back, true); renderHUD(); } }, 250); }
    damageEnemy(n, false, false, e);
  });
}
function damageEnemy(n, noThorns, pierce, target){
  let e = target || cb.enemy; if(e && (e.dead || e.hp<=0)) e = cb.enemy; let d = n;
  if(e.armor>0 && !pierce){ const a = Math.min(e.armor, d); e.armor -= a; d -= a; }
  e.hp = Math.max(0, e.hp - d); run.dmg += d; run.bestHit = Math.max(run.bestHit, d);
  if(e.rit && e.intent && e.intent.k==='ritual'){ const was = e.rit.got < e.rit.need; e.rit.got += d; if(was && e.rit.got>=e.rit.need){ setTimeout(()=>floatText(eArt(e), 'Ritual broken!', '#ffd23f', true), 200); sfx('relic'); } }
  if(e.sig==='split' && !e.didSplit && e.hp>0 && e.hp<e.maxHp/2){ e.didSplit = true; setTimeout(()=>{ if(cb && !cb.over){ addMinion('slimeling', e.maxHp*0.3); floatText(eArt(e), 'Split!', '#ff8ad0', true); } }, 350); }
  if(cb.kind==='boss' && e===cb.enemies[0] && !cb.phase && e.hp>0 && e.hp<e.maxHp/2){
    cb.phase = 1; e.moves = e.moves.map(m=>({...m, v: m.k==='shuffle'||m.k==='flee' ? m.v : Math.round(m.v*1.2), t: Math.max(2, m.t-1)}));
    e.armor += Math.round(e.maxHp*0.08);
    setTimeout(()=>{ banner('PHASE 2', `${e.name} grows furious`, 1600); flash('rgba(200,20,40,.45)'); sfx('phase'); shake(); buzz(120); renderHUD(); }, 300);
  }
  if(e.passive && e.passive.id==='enrage' && !e.enraged && e.hp>0 && e.hp<e.maxHp/2){ e.enraged = true; e.rage += e.passive.v; setTimeout(()=>{ floatText(eArt(e), `ENRAGED +${e.passive.v}`, '#ff9d3c', true); sfx('rage'); flash('rgba(255,60,20,.35)'); }, 250); }
  if(d>=100) unlock('bighit');
  const el = eArt(e); if(!el){ return; }
  floatText(el, d>0?`-${d}`:'Blocked', d>0?'#ff8a8d':'#c9c2d4', d>=25);
  el.classList.add('hitflash'); setTimeout(()=>el.classList.remove('hitflash'),110);
  sfx(d>0?'hit':'armor', d>=25);
  if(d>=25){ shake(); flash('rgba(255,255,255,.3)'); burstAt(el, ['#fff','#ffcf7a','#ff8a3c'], 14); }
  if(!noThorns && d>0 && e.passive && e.passive.id==='thorns' && e.hp>0) hitPlayer(e.passive.v, true);
}
function hitPlayer(n, small){
  if(cb.mirror && !small){ cb.mirror = false; floatText(hpEl(), 'Reflected!', '#a8ceff'); sfx('block'); return; }
  if(has('vampcape') && !small && cb.enemy.hp>0){ cb.enemy.hp = Math.max(1, cb.enemy.hp-2); }
  let v = n; if(has('thickskin')) v = Math.max(0, v-1);
  const absorbed = Math.min(cb.shield, v); cb.shield -= absorbed; v -= absorbed;
  if(absorbed>0 && has('spikes')) damageEnemy(5, true);
  if(absorbed>0 && pk('thorns') && !small) damageEnemy(3*pk('thorns'), true);
  const wasSafe = run.hp/run.maxHp > 0.3;
  run.hp -= v;
  if(v>0) cb.tookDmg = true;
  if(pk('wind') && !cb.windUsed && run.hp>0 && run.hp < run.maxHp*0.3){ cb.windUsed = true; heal(15); setTimeout(()=>floatText(hpEl(), 'Second wind +15', '#86e6a8', true), 200); }
  floatText(hpEl(), v>0?`-${v}`:'Blocked!', v>0?'#ff6a6f':'#a8ceff');
  if(v>0){ sfx('hurt'); if(!small){ shake(); flash('rgba(200,20,30,.45)'); buzz(60); } if(wasSafe && run.hp>0 && run.hp/run.maxHp<=0.3) sfx('heartbeat'); }
  else sfx('block');
  updateDanger();
}
function enemyTick(){
  hazardTick();
  for(const e of cb.enemies){ if(e.dead || e.hp<=0) continue; enemyAct(e); if(cb.fled || run.hp<=0) break; }
}
function enemyAct(e){
  if(e.poison>0){ const p = e.poison; e.hp = Math.max(0, e.hp - p); run.dmg += p; if(!has('gravetome')) e.poison--; floatText(eArt(e), `-${p}`, '#dcb6ff'); if(e.hp<=0) return; }
  if(e.passive && e.passive.id==='regen' && e.hp<e.maxHp){ e.hp = Math.min(e.maxHp, e.hp+e.passive.v); }
  e.hist = (e.hist||[]).concat(e.hp).slice(-6);
  const it = e.intent;
  it.left--;
  if(it.left===1) sfx('warn');
  if(it.left>0) return;
  const dmg = intentDamage(it, e);
  const art = eArt(e) || $('#board');
  if(['atk','multi','drain','feast','quake','breath','inferno','ritual','doom','shatter'].includes(it.k)){ bump(art,'lunge'); setTimeout(()=>art.classList.remove('lunge'),400); }
  switch(it.k){
    case 'atk': hitPlayer(dmg); break;
    case 'multi': for(let i=0;i<it.n + (e.heads?e.heads-1:0);i++) hitPlayer(dmg, i>0); break;
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
      floatText($('#board'), `Petrify x${it.v}`, '#c9c2d4'); sfx('petrify'); shake(); break; }
    case 'sap': { const lost = Math.min(run.charge, it.v); run.charge -= lost; floatText($('#ultBtn'), `-${lost} charge`, '#c77dff'); sfx('sap'); break; }
    case 'shuffle': cb.hand = cb.hand.map(p=>p.used?p:newPiece()); floatText($('#board'), 'Hand shuffled!', '#c77dff'); sfx('shuffle'); break;
    case 'steal': {
      if(has('glove')){ floatText($('#goldWrap'), 'Guarded!', '#ffe58a'); sfx('block'); break; }
      const took = Math.min(run.gold, it.v); run.gold -= took; floatText($('#goldWrap'), `-${took}`, '#ff8a80'); sfx('steal'); break; }
    case 'bomb': {
      const empty = []; cb.board.forEach((t,i)=>{ if(!t) empty.push(i); });
      shuffle(empty).slice(0, it.v).forEach(i=>{ cb.board[i] = 'bomb'; cb.bombs[i] = 4 + (has('hourglass')?1:0); cb.fx.push({i,type:'bomb',t0:performance.now(),drop:true}); });
      floatText($('#board'), `Bombs x${it.v}!`, '#ff8a3c'); sfx('rubble'); break; }
    case 'chain': {
      const taken = new Set(cb.chains.map(c=>c.i)), filled = []; cb.board.forEach((t,i)=>{ if(t && !JUNK(t) && !taken.has(i)) filled.push(i); });
      const pickd = shuffle(filled).slice(0, it.v); pickd.forEach(i=>cb.chains.push({i, t:6}));
      floatText($('#board'), pickd.length?`Chained x${pickd.length}`:'Nothing to chain', '#c9d2df'); sfx('armor'); break; }
    default: if(SIG[it.k]) SIG[it.k].act(e, it, dmg);
  }
  if(cb.over || e.dead) return;
  nextIntent(e);
}
function checkStuck(){
  let guard = 0;
  while(!cb.over && !cb.hand.some(p=>!p.used && fitsAnyRot(p)) && !(cb.stash && fitsAnyRot(cb.stash)) && guard++<5){
    toast('<b>Cave-in!</b> No room to move. The ceiling collapses.', 'rock');
    sfx('cavein'); flash('rgba(120,100,90,.5)');
    hitPlayer(Math.round((4 + run.floor*2) * (has('boots')?0.5:1)));
    const rows = [...Array(N).keys()].map(r=>[r, cb.board.slice(r*N,r*N+N).filter(Boolean).length]).sort((a,b)=>b[1]-a[1]).slice(0, has('boots')?3:2);
    const now = performance.now();
    rows.forEach(([r])=>{ for(let c=0;c<N;c++){ const i=r*N+c; if(cb.board[i]){ shards(i, cb.board[i], 4); cb.fx.push({i,type:cb.board[i],t0:now}); cb.board[i]=null; delete cb.bombs[i]; } } });
    const cleared = new Set(rows.map(x=>x[0])); cb.chains = cb.chains.filter(ch=>!cleared.has(Math.floor(ch.i/N)));
    cb.streak = 0;
    dealHand();
    if(run.hp<=0) break;
  }
}
function checkEnd(){
  if(!cb || cb.over) return true;
  const fight = cb;
  cb.enemies.forEach(e=>{ if(e.hp<=0 && !e.dead && e.sig==='rebirth' && !e.reborn){ e.reborn = true; e.hp = Math.round(e.maxHp*0.5); e.armor = 0; e.poison = 0; cb.phase = 1;
    setTimeout(()=>{ banner('REBIRTH', `${e.name} rises from the ashes`, 1600); flash('rgba(255,140,40,.5)'); sfx('phase'); const el = eArt(e); if(el){ el.classList.remove('dead'); burstAt(el, ['#ffd23f','#ff8a3c','#ef5258'], 30); } renderHUD(); }, 200); } });
  if(cb.kind==='boss' && cb.enemies[0].hp<=0) cb.enemies.forEach(e=>{ if(e.minion) e.hp = 0; });
  const fresh = cb.enemies.filter(e=>e.hp<=0 && !e.dead);
  fresh.forEach(e=>{ e.dead = true; run.kills++; if(has('laurel')){ run.maxHp += 2; run.hp += 2; } markKill(e.name); unlock('first'); questAdd('kills', 1);
    if(e.moves.some(m=>m.k==='steal')) unlock('thief');
    if(e.minion) unlock('minion');
    const el = eArt(e); if(el){ el.classList.add('dead'); floatText(el, 'Defeated!', '#ffcf7a', true); burstAt(el, ['#ffcf7a','#fff','#ff8a3c','#c77dff'], 30); }
    sfx('kill'); buzz(40); });
  if(fresh.length && cb.enemies.some(e=>!e.dead)){ renderHUD(); }
  if(cb.enemies.every(e=>e.dead)){
    cb.over = true; if(cb.kind==='elite') questAdd('elites', 1); if(cb.kind==='boss') questAdd('bosses', 1);
    if(cb.kind==='goblin') unlock('goblin');
    if(cb.kind==='boss'){ run.bosses = (run.bosses||0)+1; run.lastBoss = cb.enemies[0].name; { const sn = seen(); if(ALL_ENEMIES.filter(x=>x.boss && sn.e[x.name] && sn.e[x.name].kills>0).length>=10) unlock('bossdex'); } if(!cb.tookDmg) unlock('flawless'); if(cb.enemies[0].spr==='dragon') unlock('dragon'); }
    if(cb.enemies.length>1 && cb.kind==='combat') unlock('duo');
    renderHUD();
    const kind = cb.kind;
    const xp = {combat:10, elite:20, boss:32, goblin:8}[kind] || 10;
    gainXP(xp + (cb.enemies.length>1 ? 6 : 0));
    if(pk('scav')) run.gold += 6*pk('scav');
    if(pk('medic')) heal(5*pk('medic'));
    setTimeout(()=>floatText($('#heroIcon'), `+${xp} XP`, '#ffd23f', true), 500);
    run.room = run.room || {t:kind}; run.room.fight = null; run.room.reward = {kind}; saveRun();
    setTimeout(()=>{ if(cb===fight) rewardScreen(kind); }, T(1000)); return true;
  }
  if(run.hp<=0 && checkDeath()){
    cb.over = true; renderHUD(); store.set('save', null);
    setTimeout(()=>{ if(cb===fight) endScreen(false); }, T(1100)); return true;
  }
  if(cb.fled){
    cb.over = true; renderHUD();
    const fa = eArt(); if(fa) fa.classList.add('flee'); sfx('flee');
    toast('The goblin got away with its loot!', 'goldgoblin');
    run.room = null; saveRun();
    setTimeout(()=>{ if(cb===fight) advance(); }, T(1200)); return true;
  }
  return false;
}

/* ---------- hero specials ---------- */
function useUlt(){
  if(!cb || cb.over) return;
  const C = ULT();
  if(cb.silence>0){ toast(`<b>Silenced</b><br>Your special is sealed for ${cb.silence} more move${cb.silence>1?'s':''}.`, 'i_silence'); sfx('block'); return; }
  if(run.charge < C.need){ toast(`<b>${C.name}</b><br>${C.desc}<br><span class="muted">Charge: ${Math.floor(run.charge)}/${C.need} lines cleared.</span>`, C.spr); return; }
  document.querySelectorAll('.coach').forEach(c=>c.remove());
  run.charge = 0; sfx('ult'); flash('rgba(255,200,120,.5)'); buzz(60); questAdd('ults', 1);
  floatText($('#board'), C.name.toUpperCase()+'!', '#ffcf7a', true);
  const now = performance.now();
  if(run.cls==='knight'){
    const s = 18 + 6*(run.floor-1); cb.shield += s; floatText($('#shieldStat'), `+${s}`, '#a8ceff');
    cb.board.forEach((t,i)=>{ if(JUNK(t)){ shards(i,t,6); cb.fx.push({i,type:t,t0:now}); cb.board[i]=null; } });
  } else if(run.cls==='rogue'){
    dealHand(); cb.enemy.intent.left += 1; cb.doubleNext = true;
  } else if(run.cls==='bard'){
    const L2 = cb.lastClear;
    if(!L2){ run.charge = ULT().need; toast('Nothing to replay yet. Clear a line first; your charge is kept.', 'lute'); }
    else {
      floatText($('#board'), 'ENCORE!', '#ffb3e6', true); sfx('levelup');
      if(L2.dmg>0) damageEnemy(L2.dmg);
      if(L2.poison>0) cb.enemy.poison += L2.poison;
      if(L2.sh>0){ cb.shield += L2.sh; floatText($('#shieldStat'), `+${L2.sh}`, '#a8ceff'); }
      if(L2.hp>0){ const b = run.hp; heal(L2.hp); floatText(hpEl(), `+${run.hp-b}`, '#86e6a8'); }
      if(L2.gold>0){ run.gold += L2.gold; floatText($('#goldWrap'), `+${L2.gold}`, '#ffe58a'); }
    }
  } else if(run.cls==='monk'){
    const per = 3 + 2*Math.min(run.floor,8), fight = cb; cb.streak += 2;
    for(let k=0;k<6;k++) setTimeout(()=>{ if(cb!==fight || cb.over) return; damageEnemy(per, true); renderHUD(); if(cb.enemy.hp<=0 || k===5){ if(!checkEnd()) saveRun(); } }, 80*k);
  } else if(run.cls==='druid'){
    let n = 0; cb.board.forEach((t,i)=>{ if(JUNK(t)){ cb.board[i]='heal'; delete cb.bombs[i]; cb.fx.push({i,type:'heal',t0:now,drop:true}); n++; } });
    const h = 8 + 2*run.floor, b = run.hp; heal(h); floatText(hpEl(), `+${run.hp-b}`, '#86e6a8'); if(n) floatText($('#board'), `${n} bloom`, '#86e6a8');
  } else if(run.cls==='samurai'){
    const d = 10 + Math.round(1.5*cb.board.filter(Boolean).length) + 2*run.floor; flash('rgba(255,255,255,.6)'); damageEnemy(d, true, true);
  } else if(run.cls==='pirate'){
    const spend = Math.min(30, run.gold); run.gold -= spend; const d = Math.max(14, spend*2) + 2*run.floor;
    floatText($('#goldWrap'), `-${spend}`, '#ffe58a'); shake(); sfx('blast'); damageEnemy(d, true);
  } else if(run.cls==='witch'){
    aliveEnemies().forEach(e=>{ const add = Math.max(6, e.poison); e.poison += add; if(e.intent && e.intent.k!=='flee') e.intent.left += 1; floatText(eArt(e), `+${add} poison`, '#dcb6ff'); }); sfx('poison');
  } else if(run.cls==='tinkerer'){
    cb.turret = (cb.turret||0) + 5; floatText($('#board'), 'Turret deployed!', '#ffd23f', true); sfx('anvil');
  } else if(run.cls==='vampire'){
    const e = cb.enemy, before = e.hp; damageEnemy(20 + 5*Math.min(run.floor,8), true, true); const got = before - e.hp; const b = run.hp; heal(got); floatText(hpEl(), `+${run.hp-b}`, '#ff8a9a', true); flash('rgba(200,20,40,.4)');
  } else if(run.cls==='gladiator'){
    cb.shield += 10; floatText($('#shieldStat'), '+10', '#a8ceff'); damageEnemy(20 + 6*cb.streak + 2*run.floor, true); cb.streak += 2; shake();
  } else if(run.cls==='shaman'){
    const cells = shuffle(liveCells()).slice(0,6);
    if(!cells.length){ run.charge = ULT().need; toast('No blocks to strike yet. Your charge is kept.', 'totem'); }
    else { flash('rgba(160,220,255,.6)'); const set = new Set(cells); fireCells(set, {lines:1, rows:0, cols:0, rowIdx:[], colIdx:[], mult:2, label:'THUNDER!', noCharge:true, blasted:false}); }
  } else if(run.cls==='cryomancer'){
    const ice = cb.board.filter(t=>t==='ice').length, s = 8 + 3*ice + 2*run.floor;
    aliveEnemies().forEach(e=>{ if(e.intent && e.intent.k!=='flee') e.intent.left += 2; }); cb.shield += s; floatText($('#shieldStat'), `+${s}`, '#a8ceff'); flash('rgba(160,220,255,.5)'); sfx('ice');
  } else if(run.cls==='beastmaster'){
    if(!run.pet) run.pet = pick(Object.keys(PETS));
    const P = PETS[run.pet], fight = cb;
    for(let k=0;k<3;k++) setTimeout(()=>{ if(cb!==fight || cb.over) return; sfx('pet', run.pet); bump($('#petChip'),'petgo'); P.act(); renderHUD(); if(!checkEnd()) saveRun(); }, 220*k);
  } else if(run.cls==='paladin'){
    const d = cb.shield + 15 + 5*(run.floor-1); flash('rgba(255,240,170,.55)'); damageEnemy(d, true);
  } else if(run.cls==='ranger'){
    const per = 5 + 2*(run.floor-1);
    const fight = cb;
    for(let k=0;k<6;k++) setTimeout(()=>{ if(cb!==fight || cb.over) return; damageEnemy(per, true, true); renderHUD(); if(cb.enemy.hp<=0 || k===5){ if(!checkEnd()) saveRun(); } }, 90*k);
  } else if(run.cls==='berserker'){
    const rows = [...Array(N).keys()].map(r=>[r, cb.board.slice(r*N,r*N+N).filter(Boolean).length]).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]);
    run.hp = Math.max(1, run.hp-5); floatText(hpEl(), '-5', '#ff6a6f'); shake();
    const set = lineCells(rows,[]); const blasted = expandBlast(cb.board, set);
    fireCells(set, {lines:2, rows:2, cols:0, mult:3, label:'RAMPAGE!', noCharge:true, blasted});
  } else if(run.cls==='necromancer'){
    let n = 0; cb.board.forEach((t,i)=>{ if(JUNK(t)){ cb.board[i]='venom'; cb.fx.push({i,type:'venom',t0:now,drop:true}); n++; } });
    const pz = 6 + 3*(run.floor-1); cb.enemy.poison += pz; floatText(eArt(), `+${pz} poison`, '#dcb6ff'); sfx('poison');
    if(n) floatText($('#board'), `${n} raised`, '#dcb6ff');
  } else if(run.cls==='alchemist'){
    const cnt = {}; cb.board.forEach(t=>{ if(t && !JUNK(t) && t!=='rainbow') cnt[t]=(cnt[t]||0)+1; });
    const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
    if(top){ cb.board.forEach((t,i)=>{ if(t===top[0]){ cb.board[i]='rainbow'; cb.fx.push({i,type:'rainbow',t0:now,drop:true}); } }); floatText($('#board'), `${top[1]} transmuted`, '#f0d6ff'); }
    else { run.charge = ULT().need; toast('Nothing to transmute yet. Your charge is kept.', 'philflask'); }
  } else {
    let br=0, bc=0, bn=-1, cn=-1;
    for(let r=0;r<N;r++){ const n = cb.board.slice(r*N,r*N+N).filter(Boolean).length; if(n>bn){ bn=n; br=r; } }
    for(let c=0;c<N;c++){ let n=0; for(let r=0;r<N;r++) if(cb.board[r*N+c]) n++; if(n>cn){ cn=n; bc=c; } }
    shake();
    const set = lineCells([br],[bc]); const blasted = expandBlast(cb.board, set);
    fireCells(set, {lines:2, rows:1, cols:1, mult:2.5, label:'METEOR!', noCharge:true, blasted});
  }
  if(!checkEnd()){ checkStuck(); renderHUD(); saveRun(); }
}

/* ---------- HUD ---------- */
function enemySheet(idx){
  if(!cb) return; sfx('click');
  const e = cb.enemies[idx||0] || cb.enemy, m = $('#modal'); m.hidden = false;
  const moves = e.moves.map((mv,i)=>{ const [ic,val,desc] = intentInfo({...mv}, e); const cur = ((e.mi-1+e.moves.length) % e.moves.length)===i;
    return `<div class="troph ${cur?'cur':''}">${img(ic,34)}<div><b>${val} <span class="muted" style="font-size:12px;font-family:var(--body)">${mv.t} turns${cur?' · current':''}</span></b><small>${desc}.</small></div></div>`; }).join('');
  m.innerHTML = `<div class="card" role="dialog" aria-label="${e.name}" style="max-height:84vh;overflow:auto">
    <div class="scene">${img(e.spr,96)}<h2 class="title" style="font-size:24px">${e.name}</h2>
    <p class="muted">${cb.kind==='boss'?'Boss':cb.kind==='elite'?'Elite':cb.kind==='goblin'?'Rare':'Monster'} · ${e.hp} / ${e.maxHp} HP${e.armor?` · ${e.armor} armor`:''}${e.poison?` · ${e.poison} poison`:''}${e.rage?` · +${e.rage} rage`:''}</p></div>
    ${e.sigd?`<div class="troph">${img('r_boss',34)}<div><b>Signature</b><small>${e.sigd}</small></div></div>`:''}
    ${e.passive?`<div class="troph">${img('rage',34)}<div><b>${PASSIVES[e.passive.id].name}</b><small>${PASSIVES[e.passive.id].desc(e.passive.v)}</small></div></div>`:''}
    ${cb.enemies.length>1?`<div class="troph">${img('r_combat',34)}<div><b>${cb.enemies.indexOf(e)===0?'Hit by rows':'Hit by columns'}</b><small>In fights with two foes, cleared rows damage the left one and cleared columns damage the right one.</small></div></div>`:''}
    ${cb.kind==='boss'&&e===cb.enemies[0]?`<div class="troph">${img('r_boss',34)}<div><b>Phase 2</b><small>${cb.phase?'Active: moves are faster and stronger.':'At half HP it gains armor and its moves get faster and stronger.'}</small></div></div>`:''}
    <h4 style="margin:4px 0 0;font-family:var(--display);font-weight:400;color:var(--torch2)">Move pattern (repeats)</h4>${moves}
    <button class="btn" id="closeBtn">Close</button></div>`;
  $('#closeBtn').onclick = closeSettings; m.onclick = ev=>{ if(ev.target===m) closeSettings(); };
}
function intentInfo(it, e){
  const d = it.k==='flee' ? 0 : intentDamage(it, e);
  if(SIG[it.k]){ const [val, desc] = SIG[it.k].info(it, e || cb.enemy, d); return [SIG[it.k].ic, val, desc]; }
  switch(it.k){
    case 'atk': return ['sword', `${d}`, `Attacks for ${d}`];
    case 'multi': { const n = it.n + ((e||cb.enemy).heads ? (e||cb.enemy).heads-1 : 0); return ['r_combat', `${d}x${n}`, `Attacks ${n} times for ${d}`]; }
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
    case 'steal': return ['coin', `-${it.v}`, `Steals up to ${it.v} of your gold`];
    case 'bomb': return ['bomb', `x${it.v}`, `Plants ${it.v} bomb${it.v>1?'s':''} on your grid. Clear them within 4 moves or each explodes for ${bombDmg()}`];
    case 'chain': return ['chainicon', `x${it.v}`, `Chains ${it.v} of your blocks. Chained blocks don't count toward clears until you clear a line next to them`];
  }
}
function renderEnemies(){
  const P = $('#enemyPanel'), list = cb.enemies, multi = list.length>1;
  const sig = list.map(e=>e.spr+':'+e.uid).join('|') + (multi?'|m':'');
  if(P.dataset.sig !== sig){
    const wasMulti = P.classList.contains('multi');
    P.dataset.sig = sig; P.classList.toggle('multi', multi);
    if(wasMulti!==multi && L.cs) requestAnimationFrame(()=>{ if(cb && !$('#combat').hidden) layout(); });
    P.innerHTML = list.map((e,i)=>`<div class="ecard" data-e="${i}">
      <div class="eart">${img(e.spr, multi?44:92)}</div>
      <div class="einfo"><div class="ename"><span class="enm">${e.name}</span><span class="etags"></span></div>
        <div class="erow"><div class="hpbar ebar"><i class="trail etrail"></i><i class="efill"></i><span class="etext"></span></div><span class="ebadges"></span></div>
        <div class="intent"></div>${multi?`<div class="lane">${i===0?'Hit by rows':'Hit by columns'}</div>`:''}</div></div>`).join('');
    P.querySelectorAll('.ecard').forEach(c=>{ const k = +c.dataset.e; c.querySelector('.eart').onclick = ()=>enemySheet(k); c.querySelector('.enm').onclick = ()=>enemySheet(k); });
  }
  list.forEach((e,i)=>{
    const c = P.querySelector(`.ecard[data-e="${i}"]`); if(!c) return;
    const gone = e.dead || e.hp<=0; c.classList.toggle('gone', gone);
    let tags = i===0 ? (cb.kind==='boss'?'<span class="tag boss">Boss</span>':cb.kind==='elite'?'<span class="tag">Elite</span>':cb.kind==='goblin'?'<span class="tag" style="background:#7a5608;color:#ffe58a">Rare</span>':'') : '';
    if(e.passive) tags += `<span class="tag pass">${PASSIVES[e.passive.id].name}</span>`;
    if(i===0 && cb.phase) tags += '<span class="tag phase">Phase 2</span>';
    const et = c.querySelector('.etags'); et.innerHTML = tags;
    const pt = et.querySelector('.pass'); if(pt) pt.onclick = ()=>toast(`<b>${PASSIVES[e.passive.id].name}</b><br>${PASSIVES[e.passive.id].desc(e.passive.v)}`, e.spr);
    const ep = (100*Math.max(0,e.hp)/e.maxHp)+'%';
    c.querySelector('.efill').style.width = ep; c.querySelector('.etrail').style.width = ep;
    c.querySelector('.etext').textContent = `${Math.max(0,e.hp)} / ${e.maxHp}`;
    let badges = '';
    if(e.armor>0) badges += `<span class="badge" data-b="armor">${img('armor',multi?18:22)}${e.armor}</span>`;
    if(e.poison>0) badges += `<span class="badge" data-b="poison" style="color:#dcb6ff">${img('poison',multi?18:22)}${e.poison}</span>`;
    if(e.rage>0) badges += `<span class="badge" data-b="rage" style="color:#ffb07a">${img('rage',multi?18:22)}${e.rage}</span>`;
    if(e.ward) badges += `<span class="badge" data-b="ward" style="color:#c9b6ff">${img('stoneward',multi?18:22)}${e.ward==='rows'?'Rows':'Cols'}</span>`;
    if(e.reflect) badges += `<span class="badge" data-b="reflect" style="color:#bfe6ff">${img('mirror',multi?18:22)}</span>`;
    if(e.sig==='shell') badges += `<span class="badge" data-b="shell" style="color:#c8f0ff">${img('armor',multi?18:22)}Hide</span>`;
    if((e.heads||1)>1) badges += `<span class="badge" data-b="heads" style="color:#86e6a8">${img('hydra',multi?18:22)}${e.heads}</span>`;
    const eb = c.querySelector('.ebadges'); eb.innerHTML = badges;
    eb.querySelectorAll('.badge').forEach(b=>b.onclick=()=>{ const k=b.dataset.b;
      if(BADGE_TXT[k]) return toast(BADGE_TXT[k](e), k==='ward'?'stoneward':k==='reflect'?'mirror':k==='heads'?'hydra':'armor');
      toast(k==='armor'?`<b>Armor</b><br>Absorbs damage before HP.`:k==='poison'?`<b>Poison</b><br>Deals ${e.poison} damage each turn${has('gravetome')?'':', then drops by 1'}.`:`<b>Rage</b><br>Attacks deal +${e.rage} damage.`, k); });
    const intent = c.querySelector('.intent');
    if(gone || !e.intent){ intent.innerHTML = ''; intent.classList.remove('urgent'); return; }
    const [ic,val,desc] = intentInfo(e.intent, e), nx = intentInfo(peekIntent(e), e);
    intent.innerHTML = `${img(ic,multi?22:28)}<span class="val">${val}</span><span class="cd">${e.intent.left===1?'NEXT':`in ${e.intent.left}`}</span>${e.intent.k==='flee'||multi?'':`<span class="then">then ${img(nx[0],18)}${nx[1]}</span>`}`;
    intent.classList.toggle('urgent', e.intent.left===1);
    intent.onclick = ()=>toast(`<b>${e.name}</b><br>${desc} ${e.intent.left===1?'after your next move':`in ${e.intent.left} moves`}.${e.intent.k==='flee'?'':`<br><span class="muted">Then: ${nx[2]}.</span>`}`, ic, 3000);
  });
}
function renderHUD(){
  if(!cb) return;
  renderEnemies();
  $('#shieldText').textContent = cb.shield;
  const m = cb.streak*streakStep();
  $('#streakText').textContent = m ? `+${fmt(m)}` : '-';
  $('#comboStat').classList.toggle('hot', cb.streak>=3);
  $('#rerollText').textContent = cb.rerolls;
  const pc = $('#petChip');
  if(run.pet && PETS[run.pet]){ const P = PETS[run.pet]; pc.hidden = false; if(pc.dataset.k!==run.pet){ pc.innerHTML = `${img(P.spr,28)}<span id="petT"></span>`; pc.dataset.k = run.pet; } $('#petT').textContent = P.every - (cb.petT||0); pc.onclick = ()=>toast(`<b>${P.name}</b><br>${P.desc}<br><span class="muted">Acts in ${P.every-(cb.petT||0)} move(s).</span>`, P.spr); }
  else pc.hidden = true;
  $('#rerollBtn').disabled = cb.rerolls<=0 || cb.over;
  const C = ULT(), pct = Math.min(100, 100*run.charge/C.need);
  const ub = $('#ultBtn'); ub.style.setProperty('--p', pct); ub.classList.toggle('sealed', cb.silence>0);
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
  if(has('goldendice')){ run.gold += 5; floatText($('#goldWrap'), '+5', '#ffe58a'); }
  cb.hand = cb.hand.map(p=>p.used?p:newPiece());
  checkStuck();
  if(!checkEnd()){ renderHUD(); saveRun(); }
};
$('#ultBtn').onclick = useUlt;
$('#comboStat').onclick = ()=>toast(`<b>Combo streak</b><br>Each move in a row that clears a line adds +${streakStep()} to your multiplier. Miss a clear and it resets.`, 'flame');
$('#shieldStat').onclick = ()=>toast('<b>Shield</b><br>Absorbs enemy damage before your HP. Carries over until it\'s used up.', 'shield');

/* ================= block art (glossy sticker blocks) ================= */
const BLK = {};
function blockCanvas(type, px, skinArg){
  px = Math.max(8, Math.round(px));
  const skin = JUNK(type) && type!=='bomb' ? 'classic' : (skinArg || curSkin);
  const key = type+'|'+px+'|'+skin; if(BLK[key]) return BLK[key];
  const t = TYPES[type], c = document.createElement('canvas'); c.width = c.height = px;
  const x = c.getContext('2d');
  const rr = (X,Y,W,H,R)=>{ x.beginPath(); x.moveTo(X+R,Y); x.arcTo(X+W,Y,X+W,Y+H,R); x.arcTo(X+W,Y+H,X,Y+H,R); x.arcTo(X,Y+H,X,Y,R); x.arcTo(X,Y,X+W,Y,R); x.closePath(); };
  const o = Math.max(1.5, px*0.055), g = px*0.035, R = px*(skin==='candy'?0.42:skin==='gem'?0.1:skin==='rune'?0.12:0.22);
  rr(g, g, px-2*g, px-2*g, R); x.fillStyle = '#120c16'; x.fill();
  const ix = g+o, iy = g+o, iw = px-2*(g+o), ih = px-2*(g+o);
  if(skin==='candy'){
    const gr = x.createRadialGradient(ix+iw*0.35, iy+ih*0.3, iw*0.05, ix+iw/2, iy+ih/2, iw*0.7); gr.addColorStop(0, t.l); gr.addColorStop(0.45, t.c); gr.addColorStop(1, t.d);
    rr(ix, iy, iw, ih, R*0.85); x.fillStyle = gr; x.fill();
    x.globalAlpha = 0.75; x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ix+iw*0.33, iy+ih*0.22, iw*0.2, ih*0.09, -0.5, 0, Math.PI*2); x.fill(); x.globalAlpha = 1;
  } else if(skin==='gem'){
    rr(ix, iy, iw, ih, R*0.6); x.fillStyle = t.c; x.fill();
    const m = iw*0.24, cx0 = ix+m, cy0 = iy+m, cw = iw-2*m;
    const poly = (pts, col)=>{ x.beginPath(); pts.forEach(([a,b],i)=>x[i?'lineTo':'moveTo'](a,b)); x.closePath(); x.fillStyle = col; x.fill(); };
    poly([[ix,iy],[ix+iw,iy],[cx0+cw,cy0],[cx0,cy0]], t.l);
    poly([[ix,iy],[cx0,cy0],[cx0,cy0+cw],[ix,iy+ih]], t.c);
    poly([[ix+iw,iy],[ix+iw,iy+ih],[cx0+cw,cy0+cw],[cx0+cw,cy0]], t.d);
    poly([[ix,iy+ih],[cx0,cy0+cw],[cx0+cw,cy0+cw],[ix+iw,iy+ih]], t.d);
    const gr = x.createLinearGradient(cx0, cy0, cx0+cw, cy0+cw); gr.addColorStop(0, t.l); gr.addColorStop(1, t.c); x.fillStyle = gr; x.fillRect(cx0, cy0, cw, cw);
    x.globalAlpha = 0.8; x.fillStyle = '#fff'; x.beginPath(); x.moveTo(ix+iw*0.12, iy+ih*0.1); x.lineTo(ix+iw*0.34, iy+ih*0.1); x.lineTo(ix+iw*0.12, iy+ih*0.3); x.fill(); x.globalAlpha = 1;
  } else if(skin==='rune'){
    rr(ix, iy, iw, ih, R*0.6); x.fillStyle = '#5a5266'; x.fill();
    rr(ix, iy+ih*0.82, iw, ih*0.18, R*0.4); x.fillStyle = '#3a3446'; x.fill();
    const m = iw*0.13; const gr = x.createLinearGradient(0, iy+m, 0, iy+ih-m); gr.addColorStop(0, t.l); gr.addColorStop(0.5, t.c); gr.addColorStop(1, t.d);
    rr(ix+m, iy+m, iw-2*m, ih-2*m-ih*0.06, R*0.4); x.fillStyle = gr; x.fill(); x.lineWidth = Math.max(1, px*0.03); x.strokeStyle = 'rgba(18,12,22,.7)'; x.stroke();
    x.fillStyle = '#8a8296'; [[0.07,0.07],[0.93,0.07],[0.07,0.86],[0.93,0.86]].forEach(([a,b])=>{ x.beginPath(); x.arc(ix+iw*a, iy+ih*b, px*0.03, 0, Math.PI*2); x.fill(); });
  } else if(skin==='neon'){
    rr(ix, iy, iw, ih, R*0.8); x.fillStyle = '#150f1e'; x.fill();
    x.save(); x.shadowColor = t.c; x.shadowBlur = px*0.22; x.lineWidth = Math.max(1.5, px*0.07); x.strokeStyle = t.c; rr(ix+px*0.06, iy+px*0.06, iw-px*0.12, ih-px*0.12, R*0.6); x.stroke(); x.restore();
    x.lineWidth = Math.max(1, px*0.025); x.strokeStyle = t.l; rr(ix+px*0.06, iy+px*0.06, iw-px*0.12, ih-px*0.12, R*0.6); x.stroke();
  } else if(skin==='jelly'){
    rr(ix, iy, iw, ih, R*0.8); x.fillStyle = t.d; x.fill();
    const gr = x.createLinearGradient(0, iy, 0, iy+ih); gr.addColorStop(0, t.l); gr.addColorStop(1, t.c);
    x.globalAlpha = 0.8; rr(ix+px*0.03, iy+px*0.03, iw-px*0.06, ih-px*0.08, R*0.8); x.fillStyle = gr; x.fill(); x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,.45)'; [[0.72,0.7,0.06],[0.8,0.52,0.035],[0.25,0.78,0.04]].forEach(([a,b,r])=>{ x.beginPath(); x.arc(ix+iw*a, iy+ih*b, px*r, 0, Math.PI*2); x.fill(); });
    x.globalAlpha = 0.7; rr(ix+iw*0.1, iy+ih*0.08, iw*0.5, ih*0.14, ih*0.07); x.fillStyle = '#fff'; x.fill(); x.globalAlpha = 1;
  } else {
    rr(ix, iy, iw, ih, R*0.8); x.fillStyle = t.d; x.fill();
    const gr = x.createLinearGradient(0, iy, 0, iy+ih);
    gr.addColorStop(0, t.l); gr.addColorStop(0.35, t.c); gr.addColorStop(1, t.c);
    rr(ix, iy, iw, ih - px*0.11, R*0.8); x.fillStyle = gr; x.fill();
    x.globalAlpha = 0.55; rr(ix+iw*0.12, iy+ih*0.07, iw*0.42, ih*0.12, ih*0.06); x.fillStyle = '#fff'; x.fill(); x.globalAlpha = 1;
    if(skin==='gilded'){ x.lineWidth = Math.max(1.5, px*0.06); x.strokeStyle = '#f7c936'; rr(ix+px*0.02, iy+px*0.02, iw-px*0.04, ih-px*0.04, R*0.75); x.stroke(); x.lineWidth = Math.max(1, px*0.02); x.strokeStyle = '#fff4c2'; rr(ix+px*0.05, iy+px*0.05, iw-px*0.1, ih-px*0.1, R*0.7); x.stroke(); }
  }
  if(px>=12){
    const hc = settings.contrast, gs = px*(hc?0.6:0.5);
    if(hc && type!=='stone'){ x.save(); x.globalAlpha = 0.45; x.fillStyle = '#000'; x.beginPath(); x.arc(px/2, px/2 - px*0.04, gs*0.62, 0, Math.PI*2); x.fill(); x.restore(); }
    drawGlyph(x, type, (px-gs)/2, (px-gs)/2 - px*0.05, gs);
  }
  return (BLK[key] = c);
}

/* ================= canvas rendering ================= */
const cv = $('#board'), ctx = cv.getContext('2d');
let L = {}, dpr = 1;
function setAppH(){ document.documentElement.style.setProperty('--appH', ((window.visualViewport && window.visualViewport.height) || window.innerHeight) + 'px'); }
function layout(){
  setAppH();
  const app = $('#app'); app.scrollTop = 0; if(document.scrollingElement) document.scrollingElement.scrollTop = 0;
  const wrapW = Math.min($('#combat').clientWidth || 360, 440);
  const top = cv.getBoundingClientRect().top - app.getBoundingClientRect().top;
  const pad = 8, gap = 14, trayCells = 2.9;
  const byWidth = (wrapW - pad*2)/N;
  const vh = app.clientHeight || window.innerHeight;
  const appPad = parseFloat(getComputedStyle(app).paddingBottom) || 16;
  const hint = $('#hint'), hintH = hint && hint.style.display!=='none' ? hint.offsetHeight + 4 : 0;
  const byHeight = (vh - top - pad*2 - gap - appPad - hintH - 2)/(N + trayCells);
  const cs = Math.max(20, Math.floor(Math.min(byWidth, byHeight)));
  const bw = cs*N, W = Math.max(bw + pad*2, Math.min(wrapW, bw+pad*2+40));
  const trayH = Math.round(cs*trayCells), H = pad + bw + gap + trayH + pad;
  dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  cv.style.width = W+'px'; cv.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const handW = Math.round(W*0.76), sw = W - handW - 10;
  const hx = settings.lefty ? W - handW : 0, sx = settings.lefty ? 6 : handW + 4;
  L = {W,H,cs,bx:(W-bw)/2,by:pad,bw,ty:pad+bw+gap,trayH,slotW:handW/3,hx, stash:{x:sx, y:pad+bw+gap+4, w:sw, h:trayH-8}};
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
  const p = pieceAt(i); const {slotW, ty, trayH, cs} = L;
  if(i===STASH){ const B = L.stash, s = Math.min(cs*0.5, (B.w-16)/p.w, (B.h-30)/p.h); return {s, x: B.x + (B.w - p.w*s)/2, y: B.y + 18 + (B.h - 18 - p.h*s)/2}; }
  const s = Math.min(cs*0.62, (slotW-22)/p.w, (trayH-22)/p.h);
  return {s, x: L.hx + i*slotW + (slotW - p.w*s)/2, y: ty + (trayH - p.h*s)/2};
}
const inStash = (x,y) => { const B = L.stash; return B && x>=B.x-6 && x<=B.x+B.w+6 && y>=B.y-6 && y<=B.y+B.h+6; };
function stashPiece(i){
  const p = cb.hand[i]; if(!p || p.used) return;
  if(cb.stashUsed){ sfx('invalid'); toast('You can stash once per move. Place a piece first.', 'packrat'); return; }
  const old = cb.stash;
  cb.stash = {...p, used:false, rotT:performance.now()};
  if(old) cb.hand[i] = {...old, used:false, rotT:performance.now()}; else p.used = true;
  cb.stashUsed = true; sfx('pick'); buzz(10);
  if(pk('stasher')){ cb.shield += 3*pk('stasher'); floatText($('#shieldStat'), `+${3*pk('stasher')}`, '#a8ceff'); }
  if(cb.hand.every(x=>x.used)) dealHand();
  checkStuck(); if(!checkEnd()){ renderHUD(); saveRun(); }
}
function shards(i, type, n){
  if(!L.cs || !cb) return;
  const r = Math.floor(i/N), c = i%N, cx = L.bx + c*L.cs + L.cs/2, cy = L.by + r*L.cs + L.cs/2;
  const col = TYPES[type].c;
  burstParts(cb.parts, cosm().burst, cx, cy, col, n, L.cs);
  if(cb.parts.length>500) cb.parts.splice(0, cb.parts.length-500);
}
const BURST_COLS = ['#ef5258','#4a98ff','#45c674','#f7c936','#c77dff','#ff8a3c'];
function burstParts(list, style, cx, cy, col, n, cs){
  for(let k=0;k<n;k++){
    const a = Math.random()*Math.PI*2, sp = 1.5+Math.random()*4.5;
    const q = {x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2.5, life:1, decay:0.018+Math.random()*0.02, size:cs*(0.12+Math.random()*0.16), rot:Math.random()*6, vr:(Math.random()-.5)*0.4, col, kind:style, g:0.28};
    if(style==='sparks'){ q.size *= 0.6; q.g = 0.12; q.decay *= 1.3; }
    else if(style==='confetti'){ q.col = pick(BURST_COLS); q.g = 0.1; q.vx *= 1.2; q.decay *= 0.7; }
    else if(style==='bubbles'){ q.vy = -1 - Math.random()*2; q.vx *= 0.4; q.g = -0.03; q.decay *= 0.8; q.size *= 1.1; }
    else if(style==='stars'){ q.g = 0.16; q.size *= 1.3; }
    else if(style==='embers'){ q.vy = -1.5 - Math.random()*2.5; q.vx *= 0.5; q.g = -0.02; q.col = pick(['#ff8a3c','#ffd23f','#ef5258']); q.size *= 0.55; }
    else if(style==='petals'){ q.col = pick(['#ff9ac8','#ffd6f0','#ff6fae']); q.g = 0.05; q.vy = -1 - Math.random()*2; q.decay *= 0.7; }
    else if(style==='coins'){ q.col = '#f7c936'; q.g = 0.3; q.vy -= 2; q.size *= 1.2; }
    list.push(q);
  }
  if(list.length>500) list.splice(0, list.length-500);
}
function drawPart(c2, q){
  c2.save(); c2.globalAlpha = Math.max(0, Math.min(1, q.life)); c2.translate(q.x, q.y); c2.rotate(q.rot);
  const s = q.size;
  switch(q.kind){
    case 'sparks': case 'embers': c2.globalCompositeOperation = 'lighter'; c2.fillStyle = q.col; c2.beginPath(); c2.arc(0,0,s,0,Math.PI*2); c2.fill(); c2.globalAlpha *= 0.35; c2.beginPath(); c2.arc(0,0,s*2.2,0,Math.PI*2); c2.fill(); break;
    case 'confetti': c2.fillStyle = q.col; c2.fillRect(-s/2, -s*0.25, s, s*0.5); break;
    case 'bubbles': c2.strokeStyle = q.col; c2.lineWidth = Math.max(1.5, s*0.18); c2.beginPath(); c2.arc(0,0,s*0.6,0,Math.PI*2); c2.stroke(); c2.fillStyle = 'rgba(255,255,255,.7)'; c2.beginPath(); c2.arc(-s*0.2,-s*0.2,s*0.14,0,Math.PI*2); c2.fill(); break;
    case 'stars': { c2.fillStyle = q.col; c2.strokeStyle = '#120c16'; c2.lineWidth = 1.5; c2.beginPath(); for(let i=0;i<10;i++){ const a = -Math.PI/2 + i*Math.PI/5, r = i%2 ? s*0.28 : s*0.7; c2[i?'lineTo':'moveTo'](Math.cos(a)*r, Math.sin(a)*r); } c2.closePath(); c2.fill(); c2.stroke(); break; }
    case 'petals': c2.fillStyle = q.col; c2.beginPath(); c2.ellipse(0,0,s*0.6,s*0.3,0,0,Math.PI*2); c2.fill(); break;
    case 'coins': c2.scale(Math.abs(Math.cos(q.rot*2))*0.9+0.1, 1); c2.fillStyle = '#c99a0f'; c2.beginPath(); c2.arc(0,0,s*0.6,0,Math.PI*2); c2.fill(); c2.fillStyle = '#f7c936'; c2.beginPath(); c2.arc(0,0,s*0.45,0,Math.PI*2); c2.fill(); break;
    default: c2.fillStyle = '#120c16'; c2.fillRect(-s/2-1,-s/2-1,s+2,s+2); c2.fillStyle = q.col; c2.fillRect(-s/2,-s/2,s,s);
  }
  c2.restore();
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
  const TH = theme();
  rrect(bx-6, by-6, bw+12, bw+12, 14); ctx.fillStyle = TH.board; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = TH.edge; ctx.stroke();
  for(let r=0;r<N;r++) for(let c=0;c<N;c++){
    const x = bx+c*cs, y = by+r*cs, t = cb.board[r*N+c];
    if(t) drawCell(x,y,cs,t);
    else { rrect(x+2,y+2,cs-4,cs-4,cs*0.18); ctx.fillStyle = (r+c)%2 ? TH.a : TH.b; ctx.fill(); }
  }
  const now = performance.now();
  drawHazards(now);
  if(drag && drag.valid){
    const p = pieceAt(drag.idx);
    const pulse = 0.22 + 0.12*Math.sin(now/90);
    if(drag.plan){
      ctx.fillStyle = `rgba(255,207,122,${pulse})`;
      drag.plan.set.forEach(i=>{ const r=Math.floor(i/N), c=i%N; rrect(bx+c*cs+1, by+r*cs+1, cs-2, cs-2, cs*0.2); ctx.fill(); });
    }
    drawPiece(p, bx+drag.c*cs, by+drag.r*cs, cs, 0.45);
  }
  cb.pops = cb.pops.filter(q=>now-q.t0 < 220);
  cb.pops.forEach(q=>{ const k = (now-q.t0)/220, r = Math.floor(q.i/N), c = q.i%N, t = cb.board[q.i]; if(!t) return;
    const s = cs*(1 + 0.18*Math.sin(k*Math.PI)), x = bx+c*cs-(s-cs)/2, y = by+r*cs-(s-cs)/2;
    drawCell(x, y, s, t, 1, cs); ctx.globalAlpha = (1-k)*0.5; rrect(x,y,s,s,s*0.2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; });
  cb.beams = cb.beams.filter(b=>now-b.t0 < 380);
  cb.beams.forEach(b=>{ const k = (now-b.t0)/380, a = (1-k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if(b.r!=null){ const y = by + b.r*cs + cs/2, h = cs*(0.9 + k*0.8); const gr = ctx.createLinearGradient(0, y-h/2, 0, y+h/2); gr.addColorStop(0,'rgba(255,220,150,0)'); gr.addColorStop(0.5,`rgba(255,240,200,${0.85*a})`); gr.addColorStop(1,'rgba(255,220,150,0)'); ctx.fillStyle = gr; ctx.fillRect(bx-10, y-h/2, bw+20, h); }
    else { const x = bx + b.c*cs + cs/2, w = cs*(0.9 + k*0.8); const gr = ctx.createLinearGradient(x-w/2, 0, x+w/2, 0); gr.addColorStop(0,'rgba(255,220,150,0)'); gr.addColorStop(0.5,`rgba(255,240,200,${0.85*a})`); gr.addColorStop(1,'rgba(255,220,150,0)'); ctx.fillStyle = gr; ctx.fillRect(x-w/2, by-10, w, bw+20); }
    ctx.restore(); });
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
  { const B = L.stash, hot = drag && drag.idx!==STASH && inStash(drag.x, drag.y);
    ctx.save(); rrect(B.x, B.y, B.w, B.h, 12); ctx.fillStyle = hot ? 'rgba(255,207,122,.18)' : 'rgba(0,0,0,.28)'; ctx.fill();
    ctx.setLineDash([6,5]); ctx.lineWidth = 2; ctx.strokeStyle = hot ? '#ffcf7a' : cb.stashUsed ? '#3a3046' : '#5a4c6a'; ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `13px 'Lilita One', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = hot ? '#ffcf7a' : '#8a7f99';
    ctx.fillText('STASH', B.x + B.w/2, B.y + 5); ctx.textAlign = 'left'; ctx.restore();
    if(cb.stash && !(drag && drag.idx===STASH)){ const p = cb.stash, {s,x,y} = trayRect(STASH), ok = fitsAnywhere(p); drawPiece(p, x, y, s, ok?1:fitsAnyRot(p)?0.6:0.25, ok); } }
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
    const p = pieceAt(drag.idx);
    drawPiece(p, drag.x - p.w*cs/2, drag.y - drag.lift - p.h*cs/2, cs, drag.valid?0.97:0.8, true);
    if(drag.valid && drag.plan && drag.fx) drawPreview(drag.plan, drag.fx);
  }
  cb.parts.forEach(q=>{
    q.x+=q.vx; q.y+=q.vy; q.vy+=(q.g==null?0.28:q.g); q.vx*=0.985; q.rot+=q.vr; q.life-=q.decay;
    drawPart(ctx, q);
  });
  cb.parts = cb.parts.filter(q=>q.life>0 && q.y<H+40 && q.y>-60);
}

function drawHazards(now){
  const {cs,bx,by,bw} = L;
  cb.enemies.forEach(e=>{ const it = e.intent; if(e.dead || !it || it.k!=='doom' || !it.line || it.broken) return;
    const a = 0.18 + 0.12*Math.sin(now/160); ctx.save(); ctx.fillStyle = `rgba(255,40,60,${a})`; ctx.strokeStyle = `rgba(255,80,90,${0.6+a})`; ctx.lineWidth = 3;
    if(it.line.r!=null){ rrect(bx-2, by+it.line.r*cs, bw+4, cs, 8); } else { rrect(bx+it.line.c*cs, by-2, cs, bw+4, 8); }
    ctx.fill(); ctx.stroke(); ctx.restore(); });
  cb.weak.forEach(i=>{ const r = Math.floor(i/N), c = i%N, x = bx+c*cs+cs/2, y = by+r*cs+cs/2, pulse = 0.5+0.5*Math.sin(now/220 + i);
    ctx.save(); ctx.lineWidth = Math.max(2, cs*0.07); ctx.strokeStyle = `rgba(255,210,63,${0.55+0.4*pulse})`;
    ctx.beginPath(); ctx.arc(x, y, cs*(0.3+0.04*pulse), 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); [[0,-1],[0,1],[-1,0],[1,0]].forEach(([dx,dy])=>{ ctx.moveTo(x+dx*cs*0.2, y+dy*cs*0.2); ctx.lineTo(x+dx*cs*0.44, y+dy*cs*0.44); }); ctx.stroke();
    if(!cb.board[i]){ ctx.fillStyle = `rgba(255,210,63,${0.12+0.1*pulse})`; ctx.beginPath(); ctx.arc(x,y,cs*0.28,0,Math.PI*2); ctx.fill(); }
    ctx.restore(); });
  cb.chains.forEach(ch=>{ const r = Math.floor(ch.i/N), c = ch.i%N, x = bx+c*cs, y = by+r*cs;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(3, cs*0.12);
    [['#120c16',1.5],['#b8c2cf',0]].forEach(([col,ex])=>{ ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, cs*0.12)+ex*2; ctx.beginPath(); ctx.moveTo(x+cs*0.15,y+cs*0.15); ctx.lineTo(x+cs*0.85,y+cs*0.85); ctx.moveTo(x+cs*0.85,y+cs*0.15); ctx.lineTo(x+cs*0.15,y+cs*0.85); ctx.stroke(); });
    ctx.restore(); });
  Object.entries(cb.bombs).forEach(([k,v])=>{ const i = +k, r = Math.floor(i/N), c = i%N, x = bx+c*cs+cs*0.74, y = by+r*cs+cs*0.26, rad = cs*0.22;
    ctx.save(); ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fillStyle = v<=1 ? (Math.sin(now/90)>0?'#ff3b3b':'#ffd23f') : '#ff8a3c'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#120c16'; ctx.stroke();
    ctx.fillStyle = '#120c16'; ctx.font = `${Math.round(rad*1.4)}px 'Lilita One', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), x, y+1);
    ctx.restore(); });
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
  if(!el || !settings.flash || settings.motion) return;
  const r = el.getBoundingClientRect(); if(!r.width) return;
  const cx = r.left + r.width/2, cy = r.top + r.height/2;
  for(let i=0;i<n;i++){ const a = Math.random()*Math.PI*2, sp = 2+Math.random()*5; FXP.push({x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2, g:0.18, life:1, decay:0.025+Math.random()*0.02, s:3+Math.random()*4, col:pick(colors), rot:0, vr:0, round:true}); }
}
function cellScreen(i){ const r = cv.getBoundingClientRect(); return {x: r.left + L.bx + (i%N)*L.cs + L.cs/2, y: r.top + L.by + Math.floor(i/N)*L.cs + L.cs/2}; }
function flyTo(points, el, col){
  if(!el || !settings.flash || settings.motion) return;
  const t = el.getBoundingClientRect(); if(!t.width) return;
  const tx = t.left + t.width/2, ty = t.top + t.height/2, now = performance.now();
  points.forEach((p,k)=>{ const mx = (p.x+tx)/2 + (Math.random()-.5)*120, my = Math.min(p.y,ty) - 40 - Math.random()*60;
    FXP.push({fly:true, trail:cosm().trail, sx:p.x, sy:p.y, mx, my, tx, ty, t0: now + k*25, dur: T(420) + Math.random()*120, col, x:p.x, y:p.y, life:1, s:7}); });
}
function confetti(n){
  if(!settings.flash || settings.motion) return;
  const cols = ['#ef5258','#4a98ff','#45c674','#f7c936','#c77dff','#ff8a3c','#fff'];
  for(let i=0;i<n;i++) FXP.push({x:Math.random()*innerWidth, y:-20-Math.random()*innerHeight*0.4, vx:(Math.random()-.5)*2, vy:2+Math.random()*3, g:0.04, life:1, decay:0.004+Math.random()*0.004, s:6+Math.random()*6, col:pick(cols), rot:Math.random()*6, vr:(Math.random()-.5)*0.3});
}
function drawTrail(p, x, y){
  const st = p.trail || 'comet', dx = p.x - x, dy = p.y - y, dl = Math.hypot(dx, dy) || 1;
  fx2.save(); fx2.globalCompositeOperation = 'lighter'; fx2.lineCap = 'round'; fx2.lineJoin = 'round';
  if(st==='ribbon'){ p.hist = (p.hist||[]).concat([[x,y]]).slice(-9); fx2.strokeStyle = p.col; fx2.lineWidth = p.s*1.1; fx2.globalAlpha = 0.45; fx2.beginPath(); p.hist.forEach(([hx,hy],i)=>fx2[i?'lineTo':'moveTo'](hx,hy)); fx2.stroke(); }
  else if(st==='bolt'){ const n = 4; fx2.strokeStyle = '#bfe6ff'; fx2.lineWidth = 2.5; fx2.globalAlpha = 0.9; fx2.beginPath(); fx2.moveTo(x, y); for(let i=1;i<=n;i++){ const k = i/n; fx2.lineTo(x + dx/dl*28*k + (Math.random()-.5)*10, y + dy/dl*28*k + (Math.random()-.5)*10); } fx2.stroke(); }
  else if(st==='shadow'){ fx2.globalCompositeOperation = 'source-over'; for(let i=0;i<3;i++){ fx2.globalAlpha = 0.25; fx2.fillStyle = '#2a1440'; fx2.beginPath(); fx2.arc(x + dx/dl*i*7, y + dy/dl*i*7, p.s*(1.1-i*0.2), 0, Math.PI*2); fx2.fill(); } }
  else if(st==='orb'){ fx2.globalAlpha = 0.3; fx2.fillStyle = p.col; fx2.beginPath(); fx2.arc(x, y, p.s*1.8, 0, Math.PI*2); fx2.fill(); }
  else { const tl = Math.min(dl, 22); fx2.strokeStyle = p.col; fx2.globalAlpha = 0.5; fx2.lineWidth = p.s*0.7; fx2.beginPath(); fx2.moveTo(x + dx/dl*tl, y + dy/dl*tl); fx2.lineTo(x, y); fx2.stroke();
    if(st==='stardust' && Math.random()<0.6) FXP.push({kind:'sparks', x, y, vx:(Math.random()-.5), vy:(Math.random()-.5), g:0.02, life:0.8, decay:0.04, size:1.6, rot:0, vr:0, col:'#fff4c2'}); }
  fx2.globalAlpha = 1; fx2.fillStyle = st==='shadow' ? '#c77dff' : '#fff'; fx2.beginPath(); fx2.arc(x, y, p.s*0.45, 0, Math.PI*2); fx2.fill();
  fx2.fillStyle = p.col; fx2.globalAlpha = 0.7; fx2.beginPath(); fx2.arc(x, y, p.s*(st==='orb'?1.1:0.8), 0, Math.PI*2); fx2.fill();
  fx2.restore();
}
function drawFx(){
  fx2.clearRect(0,0,innerWidth,innerHeight);
  if(!FXP.length) return;
  const nowf = performance.now();
  FXP.forEach(p=>{
    if(p.fly){
      const k = (nowf - p.t0)/p.dur; if(k<0) return; if(k>=1){ p.life = 0; return; }
      const e = k*k*(3-2*k), u = 1-e;
      const x = u*u*p.sx + 2*u*e*p.mx + e*e*p.tx, y = u*u*p.sy + 2*u*e*p.my + e*e*p.ty;
      drawTrail(p, x, y); p.x = x; p.y = y; return;
    }
    if(p.kind){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.vx*=0.985; p.rot+=p.vr; p.life-=p.decay; drawPart(fx2, p); return; }
    p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.vx*=0.99; p.rot+=p.vr; p.life-=p.decay;
    fx2.save(); fx2.globalAlpha = Math.max(0, Math.min(1, p.life*1.5)); fx2.translate(p.x,p.y); fx2.rotate(p.rot); fx2.fillStyle = p.col;
    if(p.round){ fx2.beginPath(); fx2.arc(0,0,p.s/2,0,Math.PI*2); fx2.fill(); } else fx2.fillRect(-p.s/2,-p.s*0.3,p.s,p.s*0.6);
    fx2.restore();
  });
  FXP = FXP.filter(p=>p.life>0 && p.y<innerHeight+30 && p.y>-80);
}
requestAnimationFrame(frame);

/* ================= input: tap to rotate, drag to place ================= */
function pt(e){ const r = cv.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; }
function updateDrag(){
  const p = pieceAt(drag.idx), {cs,bx,by} = L;
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
  let i;
  if(inStash(x,y)){ if(!cb.stash){ toast('<b>Stash</b><br>Drag a piece here to save it for later. One stash per move.', 'packrat'); return; } i = STASH; }
  else i = clamp(Math.floor((x - L.hx) / L.slotW), 0, 2);
  const p = pieceAt(i); if(!p || p.used) return;
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
    if(!cb || cb.over) return;
    if(d.idx!==STASH && inStash(d.x, d.y)) return stashPiece(d.idx);
    if(d.valid) place(d.idx, d.r, d.c); else if(d.y < L.ty) sfx('invalid');
    return; }
  if(press){ const i = press.idx; press = null; const p = cb && pieceAt(i); if(cb && !cb.over && p && !p.used) rotatePiece(i); }
});
cv.addEventListener('pointercancel', ()=>{ drag = null; press = null; });
addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('#modal').hidden) closeSettings(); });
document.addEventListener('touchmove', e=>{ if(document.documentElement.classList.contains('lock') && !e.target.closest('#modal')) e.preventDefault(); }, {passive:false});
window.addEventListener('scroll', ()=>{ if(document.documentElement.classList.contains('lock') && window.scrollY) window.scrollTo(0,0); });

/* ================= boot ================= */
let errShown = false;
window.addEventListener('error', e=>{ console.error(e.error||e.message); if(!errShown){ errShown = true; try{ saveRun(); }catch(_){} toast('<b>Something went wrong</b><br>Your run is saved. If anything looks stuck, reopen the game.', 'bones', 4000); setTimeout(()=>errShown=false, 8000); } });
try{ syncCosmetics(); }catch(_){ }
try{ titleScreen(); }
catch(err){ console.error(err); store.set('save', null); try{ titleScreen(); }catch(e2){ console.error(e2); } }
