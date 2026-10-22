/* Block Bound Dungeon — game logic. Sprites: sprites.js. Audio: audio.js. */
'use strict';

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const pick = a => a[Math.floor(Math.random()*a.length)];
const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const fmt = x => (Math.round(x*100)/100).toString();
function weighted(entries){
  const total = entries.reduce((s,e)=>s+e[1],0); let r = Math.random()*total;
  for(const [it,w] of entries){ if((r-=w) < 0) return it; }
  return entries[entries.length-1][0];
}
const store = {
  get(k,d){ try{ const v = localStorage.getItem('bbd_'+k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ if(v==null) localStorage.removeItem('bbd_'+k); else localStorage.setItem('bbd_'+k, JSON.stringify(v)); }catch(e){} },
};
const settings = Object.assign({music:0.5, sfx:0.7, shake:true, vibrate:true}, store.get('settings', {}));
Sound.setVolume('music', settings.music); Sound.setVolume('sfx', settings.sfx);
const sfx = (n,...a) => Sound.play(n,...a);

let toastTimer;
function toast(html, icon, ms=2400){
  const t = $('#toast'); t.innerHTML = (icon?img(icon,34):'') + `<div>${html}</div>`;
  t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('on'), ms);
}
function floatText(el, text, color, big){
  if(!el) return;
  const r = el.getBoundingClientRect(); const f = document.createElement('div');
  f.className = 'float'+(big?' big':''); f.textContent = text; if(color) f.style.color = color;
  f.style.left = (r.left + r.width/2 + rand(-24,24))+'px'; f.style.top = (r.top + r.height/2 + rand(-8,8))+'px';
  document.body.appendChild(f); setTimeout(()=>f.remove(), 1100);
}
function bump(el, cls){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function shake(){ if(settings.shake) bump($('#app'),'shake'); }
function flash(color){ const f=$('#flash'); f.style.background=color; bump(f,'on'); }
function buzz(ms){ if(settings.vibrate) Sound.vibrate(ms); }

/* ================= data ================= */
const N = 8;
const TYPES = {
  sword:  {c:'#ef5258', d:'#8f2227', l:'#ffa3a6', name:'Sword'},
  shield: {c:'#4a98ff', d:'#1c4c99', l:'#a8ceff', name:'Shield'},
  heal:   {c:'#45c674', d:'#1d6b3a', l:'#9cf0b9', name:'Heart'},
  coin:   {c:'#f7c936', d:'#9a740a', l:'#fff0a8', name:'Coin'},
  rainbow:{c:'#c77dff', d:'#6a2c9e', l:'#f0d6ff', name:'Rainbow'},
  venom:  {c:'#a259e6', d:'#4f1f78', l:'#dcb6ff', name:'Venom'},
  stone:  {c:'#736b7f', d:'#38333f', l:'#a69eb2', name:'Rubble'},
  ice:    {c:'#a6def4', d:'#4f8fb0', l:'#f0fbff', name:'Ice'},
};
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
};

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
  prism:{name:'Prism Shard', spr:'gem', desc:'Rainbow blocks appear: they slash, block and heal at once.', r:3},
  phoenix:{name:'Phoenix Feather', spr:'phoenix', desc:'The first time you would die, revive at 50% HP.', r:3},
  bloodpact:{name:'Blood Pact', spr:'drop', desc:'Sword blocks deal +2 damage. Lose 10 max HP on pickup.', r:3, onGet(){ run.maxHp=Math.max(10,run.maxHp-10); run.hp=Math.min(run.hp,run.maxHp); }},
  crown:{name:'Miser\'s Crown', spr:'crown', desc:'After each fight, gain 10% interest on your gold (max 15).', r:3},
  purist:{name:'Purity Sigil', spr:'gem', desc:'Pure lines (all one block type) give +1 multiplier instead of +0.5.', r:3},
};

const POTIONS = {
  health:{name:'Health Potion', spr:'potion_health', desc:'Heal 20 HP.', any:true, use(){ const b=run.hp; heal(20); floatText($('#hpFill').parentElement, `+${run.hp-b}`, '#86e6a8'); sfx('heal'); }},
  fire:{name:'Fire Flask', spr:'potion_fire', desc:'Deal 20 damage to the enemy (more on deeper floors).', use(){ flash('rgba(255,120,40,.6)'); damageEnemy(20 + 6*(run.floor-1), true); }},
  iron:{name:'Iron Tonic', spr:'potion_iron', desc:'Gain 15 shield.', use(){ cb.shield += 15; floatText($('#shieldStat'), '+15', '#a8ceff'); sfx('shield'); }},
  smoke:{name:'Smoke Bomb', spr:'potion_smoke', desc:'Draw a fresh hand and delay the enemy by 2 turns.', use(){ dealHand(); cb.enemy.intent.left += 2; }},
  bomb:{name:'Rubble Bomb', spr:'bomb', desc:'Blast every rubble and ice block off the grid. 3 damage each.', use(){
    const set = []; cb.board.forEach((t,i)=>{ if(t==='stone'||t==='ice') set.push(i); });
    if(!set.length){ toast('No rubble to blast. The fuse fizzles.', 'bomb'); return; }
    set.forEach(i=>{ shards(i, cb.board[i], 6); cb.board[i]=null; });
    sfx('rubble'); shake(); damageEnemy(3*set.length, true);
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
];
const PASSIVES = {
  regen:{name:'Regenerates', desc:v=>`Heals ${v} HP every turn.`},
  armor:{name:'Armored', desc:v=>`Starts the fight with ${v} armor.`},
  ethereal:{name:'Ethereal', desc:()=>'Single-line clears deal half damage. Clear two or more at once.'},
  thorns:{name:'Thorns', desc:v=>`You take ${v} damage every time you hurt it.`},
};
const FLOOR_NAMES = ['The Damp Cellars','The Bone Halls','The Dragon\'s Depths'];
const ROOMS = {
  combat:{spr:'r_combat', name:'Monster', desc:'A regular fight. Gold and a boon.'},
  elite:{spr:'r_elite', name:'Elite', desc:'A tough fight. Pick a relic.'},
  rest:{spr:'r_rest', name:'Campfire', desc:'Heal, train or sharpen your blocks.'},
  shop:{spr:'r_shop', name:'Merchant', desc:'Relics, potions and upgrades for gold.'},
  treasure:{spr:'r_treasure', name:'Treasure', desc:'A free relic, no strings.'},
  event:{spr:'r_event', name:'Mystery', desc:'Something strange lies ahead.'},
  boss:{spr:'r_boss', name:'Boss', desc:'The floor guardian.'},
};
const FLOORS = 3, STEPS = 8;

/* ================= run state & persistence ================= */
let run = null, cb = null, drag = null, press = null, selPotion = -1, screenName = 'title';
const has = id => !!run && run.relics.includes(id);
function heal(n){ run.hp = Math.min(run.maxHp, run.hp + n); }
function saveRun(){ if(run) store.set('save', run); }
function stats(){ return Object.assign({runs:0, wins:0, kills:0, bestFloor:0, bestLines:0, bestHit:0}, store.get('stats', {})); }
function bumpStats(fn){ const s = stats(); fn(s); store.set('stats', s); }

function newRun(cls){
  const C = CLASSES[cls];
  run = {cls, hp:C.hp, maxHp:C.hp, gold:C.gold, relics:[C.relic], potions:C.potions.slice(), potionSlots:3, charge:0,
    lvl:{sword:0,shield:0,heal:0,coin:0}, floor:1, step:0, kills:0, dmg:0, bestLines:0, bestHit:0, phoenixUsed:false, choices:null};
  bumpStats(s=>s.runs++);
  sfx('door');
  goMap();
}
function gainRelic(id){
  run.relics.push(id); const R = RELICS[id]; if(R.onGet) R.onGet();
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

/* ================= UI shell ================= */
function show(which){
  screenName = which;
  $('#combat').hidden = which!=='combat';
  $('#view').hidden = which==='combat';
  if(which==='combat') $('#view').innerHTML = '';
  $('#runbar').hidden = !run || which==='title' || which==='heroes';
  selPotion = -1;
  if(run) renderRunbar();
  Sound.music(which==='title'||which==='heroes' ? 'menu' : which==='combat' ? (cb&&cb.kind==='boss'?'boss':'combat') : 'map');
  window.scrollTo(0,0);
}
function renderRunbar(){
  if(!run) return;
  $('#heroIcon').innerHTML = img(CLASSES[run.cls].spr, 34);
  $('#hpFill').style.width = (100*Math.max(0,run.hp)/run.maxHp)+'%';
  $('#hpText').textContent = `${Math.max(0,run.hp)} / ${run.maxHp}`;
  $('#coinIcon').innerHTML = img('coin', 22);
  $('#goldText').textContent = run.gold;
  $('#floorText').textContent = `F${run.floor}-${Math.min(run.step+1,STEPS)}`;
  const pb = $('#potionBar'); pb.innerHTML = '';
  for(let i=0;i<run.potionSlots;i++){
    const id = run.potions[i]; const b = document.createElement('button');
    b.className = 'slot'+(id?'':' empty')+(i===selPotion?' sel':'');
    if(id){ b.innerHTML = img(POTIONS[id].spr, 26); b.onclick = ()=>potionTap(i); }
    pb.appendChild(b);
  }
  const bar = $('#relicBar'); bar.innerHTML = '';
  run.relics.forEach(id=>{
    const R = RELICS[id]; const b = document.createElement('button');
    b.className = 'relic'+(id==='phoenix'&&run.phoenixUsed?' used':'');
    b.innerHTML = img(R.spr, 26); b.title = R.name;
    b.onclick = ()=>toast(`<b>${R.name}</b><br>${R.desc}`, R.spr);
    bar.appendChild(b);
  });
}
function potionTap(i){
  const id = run.potions[i], P = POTIONS[id];
  const inFight = cb && !cb.over && !$('#combat').hidden;
  if(!inFight && !P.any){ toast(`<b>${P.name}</b><br>${P.desc}<br><span class="muted">Use it during a fight.</span>`, P.spr); return; }
  if(selPotion !== i){ selPotion = i; renderRunbar(); toast(`<b>${P.name}</b><br>${P.desc}<br><span class="muted">Tap again to drink.</span>`, P.spr); return; }
  selPotion = -1; run.potions.splice(i,1);
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
function bindChoices(fn){ $('#view').querySelectorAll('.choice').forEach(b=>b.onclick=()=>{ sfx('click'); fn(b.dataset.id); }); }
function scene(spr, title, text){ return `<div class="scene"><div class="art">${img(spr, sprCanvas(spr).width>=16 ? 104 : 84)}</div><h2 class="title">${title}</h2>${text?`<p class="muted">${text}</p>`:''}</div>`; }
function blockChip(type){ return `<img class="blk" src="${blockCanvas(type, 44).toDataURL()}" alt="">`; }
document.addEventListener('pointerdown', ()=>Sound.unlock(), {capture:true});

/* ================= settings ================= */
function openSettings(){
  sfx('click');
  const m = $('#modal'); m.hidden = false;
  const st = stats();
  const tg = (k,label) => `<div class="row"><label>${label}</label><button class="toggle ${settings[k]?'on':''}" data-k="${k}"></button></div>`;
  m.innerHTML = `<div class="card">
    <div class="row"><h2 class="title" style="font-size:26px">Settings</h2>${img('gear',34)}</div>
    <div class="row"><label>Music</label><input type="range" min="0" max="1" step="0.05" value="${settings.music}" data-v="music"></div>
    <div class="row"><label>Sound</label><input type="range" min="0" max="1" step="0.05" value="${settings.sfx}" data-v="sfx"></div>
    ${tg('shake','Screen shake')}
    ${tg('vibrate','Vibration')}
    <div class="records">
      <div>Runs<br><b>${st.runs}</b></div><div>Wins<br><b>${st.wins}</b></div>
      <div>Foes slain<br><b>${st.kills}</b></div><div>Deepest floor<br><b>${st.bestFloor||'-'}</b></div>
      <div>Best clear<br><b>${st.bestLines} lines</b></div><div>Biggest hit<br><b>${st.bestHit}</b></div>
    </div>
    ${run && screenName!=='end' ? '<button class="btn ghost" id="abandonBtn">Abandon run</button>' : ''}
    <button class="btn danger" id="resetBtn">Reset all data</button>
    <button class="btn" id="closeBtn">Done</button>
  </div>`;
  m.querySelectorAll('input[type=range]').forEach(r=>{
    r.oninput = ()=>{ const k = r.dataset.v; settings[k] = +r.value; Sound.setVolume(k, settings[k]); store.set('settings', settings); };
    r.onchange = ()=>{ if(r.dataset.v==='sfx') sfx('coin'); };
  });
  m.querySelectorAll('.toggle').forEach(t=>t.onclick=()=>{
    const k = t.dataset.k; settings[k] = !settings[k]; t.classList.toggle('on', settings[k]); store.set('settings', settings); sfx('click');
    if(k==='shake' && settings.shake) shake(); if(k==='vibrate' && settings.vibrate) buzz(40);
  });
  let armed = false, armT;
  $('#resetBtn').onclick = ()=>{
    if(!armed){ armed = true; $('#resetBtn').textContent = 'Tap again to erase everything'; sfx('warn'); clearTimeout(armT); armT = setTimeout(()=>{ armed=false; const b=$('#resetBtn'); if(b) b.textContent='Reset all data'; }, 3000); return; }
    ['save','stats','best','runs'].forEach(k=>store.set(k,null));
    sfx('rubble'); closeSettings(); run = null; cb = null; titleScreen(); toast('<b>Data reset</b><br>Your saved run and records were erased.', 'bones');
  };
  const ab = $('#abandonBtn');
  if(ab){ let a2=false; ab.onclick = ()=>{ if(!a2){ a2=true; ab.textContent='Tap again to abandon'; sfx('warn'); return; } store.set('save', null); closeSettings(); run=null; cb=null; titleScreen(); }; }
  $('#closeBtn').onclick = closeSettings;
  m.onclick = e=>{ if(e.target===m) closeSettings(); };
}
function closeSettings(){ $('#modal').hidden = true; $('#modal').innerHTML=''; sfx('click'); }
$('#gearBtn').onclick = openSettings;

/* ================= title & hero select ================= */
function titleScreen(){
  run = null; cb = null; show('title');
  const save = store.get('save', null), st = stats();
  view(`
    <div class="titlebar"><button class="iconbtn" id="gear2">${img('gear',28)}</button></div>
    <h1 class="logo"><span>BLOCK BOUND</span><span>DUNGEON</span></h1>
    <div class="heroes">${img('knight',76)}${img('rogue',76)}${img('mage',76)}</div>
    ${save?`<button class="btn" id="contBtn">Continue: ${CLASSES[save.cls].name}, Floor ${save.floor}</button>`:''}
    <button class="btn ${save?'ghost':''}" id="startBtn">${save?'New Run':'Enter the Dungeon'}</button>
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
        <li>Clear several lines at once or back-to-back for a <b>combo multiplier</b>. Lines of a single block type are <b>Pure</b> and score extra. Empty the whole grid for a <b>Perfect</b> clear.</li>
        <li>Clearing lines charges your hero's <b>special move</b>.</li>
        <li>Each piece you place is a turn. Watch the enemy's countdown.</li>
      </ul>
    </div>
    ${st.runs?`<p class="center muted" style="font-size:13px">${st.wins} wins in ${st.runs} runs · deepest floor ${st.bestFloor||1}</p>`:''}
  `);
  $('#startBtn').onclick = ()=>{ sfx('click'); if(save) store.set('save', null); heroScreen(); };
  if(save) $('#contBtn').onclick = ()=>{ sfx('door'); run = save; goMap(); };
  $('#gear2').onclick = openSettings;
}
function heroScreen(){
  show('heroes');
  view(`<div class="center"><h2 class="title">Choose your hero</h2></div>
    ${Object.entries(CLASSES).map(([id,C])=>{
      const R = RELICS[C.relic];
      return `<button class="choice hero" data-id="${id}"><span class="ic">${img(C.spr,70)}</span><span>
        <b>${C.name}</b><small>${C.desc}</small>
        <span class="stats"><span class="inline">${img('heart',20)}${C.hp}</span><span class="inline">${img('coin',20)}${C.gold}</span><span class="inline">${img(R.spr,20)}${R.name}</span><span class="inline">${C.potions.map(p=>img(POTIONS[p].spr,20)).join('')}</span></span>
        <span class="ult">Special: <b style="font-size:13px;display:inline">${C.ult.name}</b> - ${C.ult.desc}</span>
      </span></button>`; }).join('')}
    <button class="btn ghost" id="backBtn">Back</button>`);
  bindChoices(newRun); $('#backBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}

/* ================= map ================= */
function genChoices(){
  const s = run.step;
  if(s===STEPS-1) return ['boss'];
  if(s===0) return ['combat'];
  const w = [['combat',38],['elite',s>=2?14:0],['rest',s>=3?11:0],['shop',s>=2?12:0],['treasure',8],['event',16]].filter(e=>e[1]>0);
  const n = Math.random()<0.5?3:2; const out=[];
  if(s===STEPS-2) out.push('rest');
  let guard=0;
  while(out.length<n && guard++<60){ const r = weighted(w); if(!out.includes(r)) out.push(r); }
  return shuffle(out);
}
function goMap(){
  cb = null;
  if(!run.choices) run.choices = genChoices();
  saveRun();
  show('map');
  let dots=''; for(let i=0;i<STEPS;i++) dots += `<i class="${i<run.step?'done':i===run.step?'now':''} ${i===STEPS-1?'boss':''}"></i>`;
  view(`
    <div class="center"><h2 class="title">Floor ${run.floor}</h2><div class="muted" style="font-size:14px;margin-top:2px">${FLOOR_NAMES[run.floor-1]}</div></div>
    <div class="steps">${dots}</div>
    <p class="muted center">Choose your path</p>
    ${run.choices.map(k=>choiceBtn({id:k,...ROOMS[k]})).join('')}
  `);
  bindChoices(enterRoom);
}
function enterRoom(k){
  run.choices = null; sfx('door');
  if(k==='combat'||k==='elite'||k==='boss') startCombat(k);
  else if(k==='rest') restScreen();
  else if(k==='shop') shopScreen();
  else if(k==='treasure') treasureScreen();
  else if(k==='event') eventScreen();
}
function advance(){
  run.step++;
  if(run.step>=STEPS){
    run.floor++; run.step=0;
    bumpStats(s=>s.bestFloor=Math.max(s.bestFloor, Math.min(run.floor,FLOORS)));
    if(run.floor>FLOORS) return endScreen(true);
    heal(Math.round(run.maxHp*0.3));
    toast('You descend deeper and catch your breath. <b>+30% HP</b>', 'r_rest');
  }
  goMap();
}

/* ================= non-combat rooms ================= */
function restScreen(){
  show('rest');
  const amt = Math.round(run.maxHp*0.35);
  const up = pick(Object.keys(UPGRADES)); const U = UPGRADES[up];
  view(`${scene('r_rest','Campfire','The fire crackles. You have time for one thing.')}
    ${choiceBtn({id:'heal',spr:'heal_icon',name:'Rest',desc:`Heal ${amt} HP.`})}
    ${choiceBtn({id:'train',spr:'heart',name:'Train',desc:'+8 max HP.'})}
    ${choiceBtn({id:'up',spr:U.spr,name:U.name,desc:U.desc+' (permanent)'})}`);
  bindChoices(id=>{ if(id==='heal'){ heal(amt); sfx('heal'); } else if(id==='train'){ run.maxHp+=8; run.hp+=8; } else run.lvl[up]++; advance(); });
}
function treasureScreen(){
  show('treasure');
  const [id] = relicOffers(1); const g = rand(10,20);
  view(`${scene('r_treasure','Treasure!',`Inside the chest: ${g} gold and...`)}
    ${id?choiceBtn({id, ...RELICS[id]}):''}
    <button class="btn" id="takeBtn">Take it</button>`);
  const take = ()=>{ run.gold+=g; sfx('coin'); if(id) gainRelic(id); advance(); };
  $('#takeBtn').onclick = take; bindChoices(take);
}
function shopScreen(){
  show('shop');
  const stock = relicOffers(3).map(id=>({id, price:[0,55,80,115][RELICS[id].r]+rand(-5,5), sold:false}));
  const pots = shuffle(Object.keys(POTIONS)).slice(0,2).map(id=>({id, price:rand(18,26), sold:false}));
  const up = pick(Object.keys(UPGRADES)); let upPrice = 50, upSold=false;
  const render = ()=>{
    const full = run.potions.length>=run.potionSlots;
    view(`${scene('r_shop','The Merchant','"Gold for goods, friend."')}
      ${stock.map(s=>s.sold?'':choiceBtn({id:'r:'+s.id,...RELICS[s.id],price:s.price,disabled:run.gold<s.price})).join('')}
      ${pots.map(s=>s.sold?'':choiceBtn({id:'p:'+s.id,spr:POTIONS[s.id].spr,name:POTIONS[s.id].name,desc:POTIONS[s.id].desc+(full?' (potion slots full)':''),price:s.price,disabled:run.gold<s.price||full})).join('')}
      ${upSold?'':choiceBtn({id:'u:'+up,spr:UPGRADES[up].spr,name:UPGRADES[up].name,desc:UPGRADES[up].desc+' (permanent)',price:upPrice,disabled:run.gold<upPrice})}
      <button class="btn ghost" id="leaveBtn">Leave</button>`);
    bindChoices(key=>{
      const [kind,id] = key.split(':');
      if(kind==='r'){ const s=stock.find(x=>x.id===id); run.gold-=s.price; s.sold=true; gainRelic(id); }
      else if(kind==='p'){ const s=pots.find(x=>x.id===id); run.gold-=s.price; s.sold=true; givePotion(id); sfx('buy'); }
      else { run.gold-=upPrice; upSold=true; run.lvl[id]++; sfx('buy'); toast(`<b>${UPGRADES[id].name}</b><br>${UPGRADES[id].desc}`, UPGRADES[id].spr); }
      renderRunbar(); render(); saveRun();
    });
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
];
function eventScreen(){
  show('event');
  const ev = pick(EVENTS)();
  view(`${scene(ev.spr, ev.title, ev.text)}
    ${ev.opts.map((o,i)=>choiceBtn({id:i,spr:o.spr,name:o.name,desc:o.desc,disabled:o.ok&&!o.ok()})).join('')}`);
  bindChoices(i=>{
    const res = ev.opts[i].go();
    if(run.hp<=0) return endScreen(false);
    if(res==='mimic'){ const mm = ENEMIES[1].elite[1]; return startCombat('elite', {...mm, hp: Math.round(mm.hp*[0.6,1,1.35][run.floor-1])}); }
    advance();
  });
}

/* ================= rewards & end ================= */
function rewardScreen(kind){
  show('reward');
  let g = kind==='boss'?rand(55,70):kind==='elite'?rand(25,35):rand(10,18);
  if(has('magnet')) g = Math.round(g*1.4);
  run.gold += g;
  let extra = '';
  if(has('crown')){ const i = Math.min(15, Math.floor(run.gold/10)); run.gold += i; extra += ` +${i} interest.`; }
  if(Math.random() < (kind==='combat'?0.35:0.5)){ const p = givePotion(); if(p) extra += ` Found a ${POTIONS[p].name}!`; }
  renderRunbar(); saveRun();
  let offers;
  if(kind==='combat'){
    const pool = BOONS.filter(b=>!b.ok||b.ok());
    offers = [];
    while(offers.length<3){ const b = weighted(pool.map(x=>[x,x.w])); if(!offers.includes(b)) offers.push(b); }
    if(Math.random()<0.3){ const [id]=relicOffers(1); if(id) offers[2] = {id,...RELICS[id]}; }
  } else {
    offers = relicOffers(3, kind==='boss'?2:1).map(id=>({id,...RELICS[id]}));
  }
  view(`${scene(kind==='boss'?'r_boss':'r_treasure', kind==='boss'?'Boss defeated!':'Victory!', `+${g} gold.${extra} Choose a reward:`)}
    ${offers.map(o=>choiceBtn(o)).join('')}
    <button class="btn ghost" id="skipBtn">Skip</button>`);
  bindChoices(id=>{ const b = BOONS.find(x=>x.id===id); if(b){ b.apply(); sfx('heal'); } else gainRelic(id); advance(); });
  $('#skipBtn').onclick = ()=>{ sfx('click'); advance(); };
}
function endScreen(won){
  cb = null; store.set('save', null);
  bumpStats(s=>{ if(won) s.wins++; s.kills+=run.kills; s.bestFloor=Math.max(s.bestFloor, Math.min(run.floor,FLOORS)); s.bestLines=Math.max(s.bestLines, run.bestLines); s.bestHit=Math.max(s.bestHit, run.bestHit); });
  show('end'); Sound.music(won?'map':'menu');
  sfx(won?'victory':'defeat');
  view(`${scene(won?'r_boss':'bones', won?'You conquered the dungeon!':'You have fallen...', won?'The Ancient Dragon is slain. Legends will be told.':`${CLASSES[run.cls].name} fell on floor ${Math.min(run.floor,FLOORS)}, room ${run.step+1}.`)}
    <div class="card"><div class="stats3">
      <div>${run.kills}<small>foes slain</small></div>
      <div>${run.dmg}<small>damage</small></div>
      <div>${run.bestHit}<small>biggest hit</small></div>
      <div>${run.bestLines}<small>best clear</small></div>
    </div></div>
    <button class="btn" id="againBtn">New Run</button>
    <button class="btn ghost" id="titleBtn">Title</button>`);
  $('#againBtn').onclick = ()=>{ sfx('click'); heroScreen(); }; $('#titleBtn').onclick = ()=>{ sfx('click'); titleScreen(); };
}

/* ================= combat ================= */
function rollType(){
  const e = [['sword',46],['shield',22],['heal',13],['coin',10]];
  if(has('prism')||has('orb')) e.push(['rainbow',has('prism')&&has('orb')?20:12]);
  if(has('toxin')) e.push(['venom',12]);
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
function fits(p,r,c){
  for(const [dr,dc] of p.cells){ const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N||cb.board[rr*N+cc]) return false; }
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
  const tpl = forced || (kind==='boss' ? F.boss : pick(kind==='elite' ? F.elite : F.normal));
  const maxHp = Math.round(tpl.hp * [1.15,1.4,1.55][run.floor-1] * (kind==='boss'?1.1:(0.92+Math.random()*0.16)));
  const pas = tpl.passive || null;
  cb = {
    kind, board:Array(N*N).fill(null), hand:[], fx:[], parts:[], over:false, firstClear:true, doubleNext:false,
    streak: has('drum') ? 2 : 0,
    shield: (has('chainmail')?8:0) + (has('oath')?6:0),
    rerolls: 1+(has('dice')?1:0),
    enemy:{...tpl, maxHp, hp:maxHp, armor: pas&&pas.id==='armor'?pas.v:0, poison:0, rage:0, mi:0, intent:null},
  };
  if(run.floor>1) addBlocks('stone', (run.floor-1)*2, true);
  nextIntent(); dealHand();
  lastEnemySpr = null;
  show('combat'); layout(); renderHUD();
  $('#eArt').className = '';
  if(kind==='boss'){ flash('rgba(160,20,30,.5)'); sfx('rage'); toast(`<b>${tpl.name}</b><br>Guardian of ${FLOOR_NAMES[run.floor-1]}`, tpl.spr, 2000); }
}
const streakStep = () => has('daggers') ? 0.5 : 0.25;
function nextIntent(){
  const e = cb.enemy, m = e.moves[e.mi % e.moves.length]; e.mi++;
  e.intent = {...m, left: m.t + (has('hourglass')?1:0)};
}
function intentDamage(it){ return Math.round(it.v*[1.1,1.25,1.35][run.floor-1]) + cb.enemy.rage; }
function addBlocks(type, n, silent){
  const empty = []; cb.board.forEach((v,i)=>{ if(!v) empty.push(i); });
  shuffle(empty).slice(0,n).forEach(i=>{ cb.board[i]=type; if(!silent) cb.fx.push({i, t0:performance.now(), drop:true, type}); });
}
function place(idx, r, c){
  const p = cb.hand[idx];
  p.cells.forEach(([dr,dc])=>{ cb.board[(r+dr)*N + c+dc] = p.type; });
  p.used = true; selPotion = -1;
  sfx('place'); buzz(8);
  resolveClears();
  if(checkEnd()) return;
  enemyTick();
  if(checkEnd()) return;
  if(cb.hand.every(x=>x.used)) dealHand();
  checkStuck();
  if(checkEnd()) return;
  renderHUD();
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
function isPure(idxs){
  const t = cb.board[idxs[0]];
  return !!t && t!=='stone' && t!=='ice' && idxs.every(i=>cb.board[i]===t);
}
function resolveClears(){
  const {rows, cols} = fullLines(cb.board);
  const lines = rows.length + cols.length;
  if(!lines){ cb.streak = has('drum') ? 2 : 0; return; }
  let pure = 0;
  rows.forEach(r=>{ if(isPure([...Array(N).keys()].map(c=>r*N+c))) pure++; });
  cols.forEach(c=>{ if(isPure([...Array(N).keys()].map(r=>r*N+c))) pure++; });
  let mult = MULT[Math.min(lines,8)] + cb.streak*streakStep() + pure*(has('purist')?1:0.5);
  if(cb.firstClear && has('ring')) mult *= 2;
  if(cb.doubleNext){ mult *= 2; cb.doubleNext = false; }
  cb.firstClear = false;
  fireCells(lineCells(rows, cols), {lines, rows:rows.length, cols:cols.length, mult, pure});
  cb.streak++;
}
/* fires every block in `set`, clears them, applies all effects */
function fireCells(set, o){
  const cnt = {sword:0,shield:0,heal:0,coin:0,rainbow:0,venom:0,stone:0,ice:0};
  const now = performance.now();
  set.forEach(i=>{
    const t = cb.board[i]; if(!t) return; cnt[t]++;
    shards(i, t, o.lines>=3?7:5);
    if(t==='ice'){ cb.board[i]='stone'; cb.fx.push({i,type:'ice',t0:now}); }
    else { cb.fx.push({i, type:t, t0:now}); cb.board[i]=null; }
  });
  const lines = o.lines, mult = o.mult;
  run.bestLines = Math.max(run.bestLines, lines);
  const Lv = run.lvl;
  const swordVal = 2 + Lv.sword + (has('whetstone')?1:0) + (has('bloodpact')?2:0);
  const shieldVal = 2 + Lv.shield + (has('tower')?1:0) + (has('oath')?1:0);
  const healVal = 2 + Lv.heal;
  const coinVal = 1 + Lv.coin + (has('idol')?1:0) + (has('daggers')?1:0);
  let dmg = Math.round((cnt.sword*swordVal + cnt.rainbow*2) * mult);
  let sh  = Math.round((cnt.shield*shieldVal + cnt.rainbow) * mult);
  let hp  = Math.round((cnt.heal*healVal + cnt.rainbow) * mult);
  const poison = Math.round(cnt.venom * mult);
  const gold = cnt.coin*coinVal;
  if(has('sledge')) dmg += (cnt.stone+cnt.ice)*4;
  if(lines>=3){ if(has('powder')) dmg += 12; if(has('orb')) dmg += 8; }
  if(has('crossed') && o.rows && o.cols) dmg += 8;
  if(has('fang')) hp += 2*lines;
  const perfect = cb.board.every(t=>!t);
  if(perfect) dmg += 20 + 10*(run.floor-1);
  if(cb.enemy.passive && cb.enemy.passive.id==='ethereal' && lines===1) dmg = Math.floor(dmg/2);

  const C = CLASSES[run.cls].ult;
  if(!o.noCharge) run.charge = Math.min(C.need, run.charge + lines*(has('battery')?1.5:1));

  const boardEl = $('#board');
  sfx('clear', lines, mult); buzz(lines>=2?30:15);
  if(perfect){ floatText(boardEl, 'PERFECT!', '#ffffff', true); sfx('perfect'); flash('rgba(255,255,255,.45)'); }
  else if(o.label) floatText(boardEl, o.label, null, true);
  else if(lines>=2 || mult>1 || o.pure){
    const label = ['','','DOUBLE! ','TRIPLE! ','QUAD! ','PENTA! '][Math.min(lines,5)] || 'MEGA! ';
    floatText(boardEl, `${o.pure?'PURE! ':''}${lines>=2?label:''}x${fmt(mult)}`, null, true);
  }
  if(o.pure) sfx('pure');
  if(lines>=3 || mult>=3){ shake(); flash('rgba(255,180,80,.35)'); }
  if(dmg>0) damageEnemy(dmg);
  if(poison>0){ cb.enemy.poison += poison; floatText($('#eArt'), `+${poison} poison`, '#dcb6ff'); sfx('poison'); }
  if(sh>0){ cb.shield += sh; floatText($('#shieldStat'), `+${sh}`, '#a8ceff'); sfx('shield'); }
  if(hp>0){ const before=run.hp; heal(hp); const got=run.hp-before; if(got>0){ floatText($('#hpFill').parentElement, `+${got}`, '#86e6a8'); sfx('heal'); } }
  if(gold>0){ run.gold += gold; floatText($('#goldWrap'), `+${gold}`, '#ffe58a'); sfx('coin'); }
}
function damageEnemy(n, noThorns){
  const e = cb.enemy; let d = n;
  if(e.armor>0){ const a = Math.min(e.armor, d); e.armor -= a; d -= a; }
  e.hp = Math.max(0, e.hp - d); run.dmg += d; run.bestHit = Math.max(run.bestHit, d);
  const el = $('#eArt');
  floatText(el, d>0?`-${d}`:'Blocked', d>0?'#ff8a8d':'#c9c2d4', d>=25);
  el.classList.add('hitflash'); setTimeout(()=>el.classList.remove('hitflash'),110);
  sfx(d>0?'hit':'armor', d>=25);
  if(d>=25){ shake(); flash('rgba(255,255,255,.3)'); }
  if(!noThorns && d>0 && e.passive && e.passive.id==='thorns' && e.hp>0) hitPlayer(e.passive.v, true);
}
function hitPlayer(n, small){
  let v = n; if(has('thickskin')) v = Math.max(0, v-1);
  const absorbed = Math.min(cb.shield, v); cb.shield -= absorbed; v -= absorbed;
  if(absorbed>0 && has('spikes')) damageEnemy(5, true);
  run.hp -= v;
  floatText($('#hpFill').parentElement, v>0?`-${v}`:'Blocked!', v>0?'#ff6a6f':'#a8ceff');
  if(v>0){ sfx('hurt'); if(!small){ shake(); flash('rgba(200,20,30,.45)'); buzz(60); } }
  else sfx('block');
}
function enemyTick(){
  const e = cb.enemy;
  if(e.poison>0){ const p = e.poison; e.hp = Math.max(0, e.hp - p); run.dmg += p; e.poison--; floatText($('#eArt'), `-${p}`, '#dcb6ff'); if(e.hp<=0) return; }
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
    case 'drain': hitPlayer(dmg); e.hp = Math.min(e.maxHp, e.hp+dmg); floatText(art, `+${dmg}`, '#86e6a8'); break;
    case 'curse': addBlocks('stone', it.v); floatText($('#board'), `Rubble x${it.v}`, '#c9c2d4'); sfx('rubble'); shake(); break;
    case 'ice': addBlocks('ice', it.v); floatText($('#board'), `Ice x${it.v}`, '#c8f0ff'); sfx('ice'); break;
    case 'armor': e.armor += it.v; floatText(art, `+${it.v} armor`, '#c9c2d4'); sfx('armor'); break;
    case 'heal': e.hp = Math.min(e.maxHp, e.hp+it.v); floatText(art, `+${it.v}`, '#86e6a8'); sfx('heal'); break;
    case 'rage': e.rage += it.v; floatText(art, `Rage +${it.v}`, '#ff9d3c'); sfx('rage'); flash('rgba(255,90,20,.3)'); break;
  }
  nextIntent();
}
function checkStuck(){
  let guard = 0;
  while(!cb.hand.some(p=>!p.used && fitsAnyRot(p)) && guard++<5){
    toast('<b>Cave-in!</b> No room to move. The ceiling collapses.', 'rock');
    sfx('cavein'); flash('rgba(120,100,90,.5)');
    hitPlayer(4 + run.floor*2);
    const rows = [...Array(N).keys()].map(r=>[r, cb.board.slice(r*N,r*N+N).filter(Boolean).length]).sort((a,b)=>b[1]-a[1]).slice(0,2);
    const now = performance.now();
    rows.forEach(([r])=>{ for(let c=0;c<N;c++){ const i=r*N+c; if(cb.board[i]){ shards(i, cb.board[i], 4); cb.fx.push({i,type:cb.board[i],t0:now}); cb.board[i]=null; } } });
    cb.streak = 0;
    dealHand();
  }
}
function checkEnd(){
  if(!cb || cb.over) return true;
  if(run.hp<=0){
    if(has('phoenix') && !run.phoenixUsed){
      run.phoenixUsed = true; run.hp = Math.round(run.maxHp/2);
      flash('rgba(255,180,60,.6)'); sfx('ult');
      toast('<b>Phoenix Feather</b><br>You rise from the ashes!', 'phoenix'); renderHUD(); return false;
    }
    cb.over = true; renderHUD();
    const fight = cb; setTimeout(()=>{ if(cb===fight) endScreen(false); }, 1000); return true;
  }
  if(cb.enemy.hp<=0){
    cb.over = true; run.kills++; renderHUD();
    $('#eArt').classList.add('dead');
    floatText($('#eArt'), 'Defeated!', '#ffcf7a', true); sfx('kill'); buzz(40);
    const kind = cb.kind, fight = cb;
    setTimeout(()=>{ if(cb===fight) rewardScreen(kind); }, 1000); return true;
  }
  return false;
}

/* ---------- hero specials ---------- */
function useUlt(){
  if(!cb || cb.over) return;
  const C = CLASSES[run.cls].ult;
  if(run.charge < C.need){ toast(`<b>${C.name}</b><br>${C.desc}<br><span class="muted">Charge: ${Math.floor(run.charge)}/${C.need} lines cleared.</span>`, C.spr); return; }
  run.charge = 0; sfx('ult'); flash('rgba(255,200,120,.5)'); buzz(60);
  floatText($('#board'), C.name.toUpperCase()+'!', '#ffcf7a', true);
  if(run.cls==='knight'){
    const s = 18 + 6*(run.floor-1); cb.shield += s; floatText($('#shieldStat'), `+${s}`, '#a8ceff');
    const now = performance.now();
    cb.board.forEach((t,i)=>{ if(t==='stone'||t==='ice'){ shards(i,t,6); cb.fx.push({i,type:t,t0:now}); cb.board[i]=null; } });
  } else if(run.cls==='rogue'){
    dealHand(); cb.enemy.intent.left += 1; cb.doubleNext = true;
  } else {
    let br=0, bc=0, bn=-1, cn=-1;
    for(let r=0;r<N;r++){ const n = cb.board.slice(r*N,r*N+N).filter(Boolean).length; if(n>bn){ bn=n; br=r; } }
    for(let c=0;c<N;c++){ let n=0; for(let r=0;r<N;r++) if(cb.board[r*N+c]) n++; if(n>cn){ cn=n; bc=c; } }
    shake();
    fireCells(lineCells([br],[bc]), {lines:2, rows:1, cols:1, mult:2.5, label:'METEOR!', noCharge:true});
  }
  if(!checkEnd()){ checkStuck(); renderHUD(); }
}

/* ---------- HUD ---------- */
function intentInfo(it){
  const d = intentDamage(it);
  switch(it.k){
    case 'atk': return ['sword', `${d}`, `Attacks for ${d}`];
    case 'multi': return ['r_combat', `${d}x${it.n}`, `Attacks ${it.n} times for ${d}`];
    case 'drain': return ['drop', `${d}`, `Drains ${d} HP from you and heals itself`];
    case 'curse': return ['rock', `x${it.v}`, `Drops ${it.v} rubble blocks on your grid`];
    case 'ice': return ['snow', `x${it.v}`, `Freezes ${it.v} empty cells. Ice cracks into rubble when cleared`];
    case 'armor': return ['armor', `+${it.v}`, `Gains ${it.v} armor`];
    case 'heal': return ['heal_icon', `+${it.v}`, `Heals ${it.v}`];
    case 'rage': return ['rage', `+${it.v}`, `Enrages: all its attacks deal +${it.v} for the rest of the fight`];
  }
}
let lastEnemySpr = null;
function renderHUD(){
  if(!cb) return;
  const e = cb.enemy;
  if(lastEnemySpr !== e.spr){ $('#eArt').innerHTML = img(e.spr, 92); lastEnemySpr = e.spr; }
  $('#eName').textContent = e.name;
  let tags = cb.kind==='boss'?'<span class="tag boss">Boss</span>':cb.kind==='elite'?'<span class="tag">Elite</span>':'';
  if(e.passive) tags += `<span class="tag pass" id="passTag">${PASSIVES[e.passive.id].name}</span>`;
  $('#eTags').innerHTML = tags;
  if(e.passive) $('#passTag').onclick = ()=>toast(`<b>${PASSIVES[e.passive.id].name}</b><br>${PASSIVES[e.passive.id].desc(e.passive.v)}`, e.spr);
  $('#eHpFill').style.width = (100*e.hp/e.maxHp)+'%';
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
  const intent = $('#intent');
  intent.innerHTML = `${img(ic,28)}<span class="val">${val}</span><span class="cd">${e.intent.left===1?'NEXT TURN':`in ${e.intent.left} turns`}</span>`;
  intent.classList.toggle('urgent', e.intent.left===1);
  intent.onclick = ()=>toast(`<b>${e.name}</b><br>${desc} ${e.intent.left===1?'after your next move':`in ${e.intent.left} moves`}.`, ic);
  $('#shieldText').textContent = cb.shield;
  const m = cb.streak*streakStep();
  $('#streakText').textContent = m ? `+${fmt(m)}` : '-';
  $('#rerollText').textContent = cb.rerolls;
  $('#rerollBtn').disabled = cb.rerolls<=0 || cb.over;
  const C = CLASSES[run.cls].ult, pct = Math.min(100, 100*run.charge/C.need);
  const ub = $('#ultBtn'); ub.style.setProperty('--p', pct);
  ub.classList.toggle('ready', pct>=100);
  $('#ultIcon').innerHTML = img(C.spr, 30);
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

/* ================= block art (sticker candy blocks) ================= */
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
  if(px>=14){
    const gl = sprCanvas('g_'+type), k = Math.max(1, Math.floor(px*0.52/8)), gs = 8*k;
    const gx = Math.round((px-gs)/2), gy = Math.round((px-gs)/2 - px*0.05);
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = gs; const tx = tmp.getContext('2d');
    tx.imageSmoothingEnabled = false; tx.drawImage(gl, 0, 0, gs, gs);
    tx.globalCompositeOperation = 'source-in'; tx.fillStyle = 'rgba(0,0,0,.35)'; tx.fillRect(0,0,gs,gs);
    x.drawImage(tmp, gx, gy + Math.max(1,Math.round(k*0.75)));
    x.imageSmoothingEnabled = false; x.drawImage(gl, gx, gy, gs, gs);
  }
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
  const byHeight = (window.innerHeight - top - pad*2 - gap - 30)/(N + trayCells);
  const cs = Math.max(28, Math.floor(Math.min(byWidth, byHeight)));
  const bw = cs*N, W = Math.max(bw + pad*2, Math.min(wrapW, bw+pad*2+40));
  const trayH = Math.round(cs*trayCells), H = pad + bw + gap + trayH + pad;
  dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  cv.style.width = W+'px'; cv.style.height = H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  L = {W,H,cs,bx:(W-bw)/2,by:pad,bw,ty:pad+bw+gap,trayH,slotW:W/3};
}
window.addEventListener('resize', ()=>{ if(cb && !$('#combat').hidden) layout(); });

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
function frame(){
  requestAnimationFrame(frame);
  embers();
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
    const sim = cb.board.slice(); p.cells.forEach(([dr,dc])=>{ sim[(drag.r+dr)*N + drag.c+dc] = p.type; });
    const {rows, cols} = fullLines(sim);
    const pulse = 0.22 + 0.12*Math.sin(now/90);
    ctx.fillStyle = `rgba(255,207,122,${pulse})`;
    rows.forEach(r=>{ rrect(bx, by+r*cs, bw, cs, 8); ctx.fill(); });
    cols.forEach(c=>{ rrect(bx+c*cs, by, cs, bw, 8); ctx.fill(); });
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

/* ================= dungeon atmosphere ================= */
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
function sizeEmbers(){ emb.width = innerWidth; emb.height = innerHeight; }
sizeEmbers(); addEventListener('resize', sizeEmbers);
function embers(){
  if(EMB.length < 34 && Math.random()<0.25){
    const side = Math.random();
    EMB.push({x: side<0.5 ? Math.random()*innerWidth*0.25 : innerWidth*(0.75+Math.random()*0.25), y: innerHeight+10, vy: -(0.4+Math.random()*0.9), vx:(Math.random()-.5)*0.3, s: 1+Math.random()*2.2, life:1, ph:Math.random()*6});
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
requestAnimationFrame(frame);

/* ================= input: tap to rotate, drag to place ================= */
function pt(e){ const r = cv.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; }
function updateDrag(){
  const p = cb.hand[drag.idx], {cs,bx,by} = L;
  const ox = drag.x - p.w*cs/2, oy = drag.y - drag.lift - p.h*cs/2;
  drag.c = Math.round((ox-bx)/cs); drag.r = Math.round((oy-by)/cs);
  drag.valid = fits(p, drag.r, drag.c);
}
cv.addEventListener('pointerdown', e=>{
  if(!cb || cb.over) return;
  const {x,y} = pt(e);
  if(y < L.ty - 10) return;
  const i = Math.min(2, Math.max(0, Math.floor(x / L.slotW)));
  const p = cb.hand[i]; if(!p || p.used) return;
  press = {idx:i, x0:x, y0:y, mouse:e.pointerType==='mouse'};
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  e.preventDefault();
});
cv.addEventListener('pointermove', e=>{
  if(!cb) return;
  const {x,y} = pt(e);
  if(press && !drag && Math.hypot(x-press.x0, y-press.y0) > 8){
    drag = {idx:press.idx, x, y, lift: press.mouse ? 0 : L.cs*1.8, valid:false};
    sfx('pick');
  }
  if(!drag) return;
  drag.x=x; drag.y=y; updateDrag(); e.preventDefault();
});
cv.addEventListener('pointerup', ()=>{
  if(drag){ const d = drag; drag = null; press = null;
    if(d.valid && cb && !cb.over) place(d.idx, d.r, d.c); else if(d.y < L.ty) sfx('invalid');
    return; }
  if(press){ const i = press.idx; press = null; if(cb && !cb.over && !cb.hand[i].used) rotatePiece(i); }
});
cv.addEventListener('pointercancel', ()=>{ drag = null; press = null; });
addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('#modal').hidden) closeSettings(); });

/* ================= boot ================= */
titleScreen();
