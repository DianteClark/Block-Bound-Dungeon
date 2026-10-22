/* Block Bound Dungeon — vector sticker art.
 * Every illustration is hand-built SVG on a 100x100 canvas with a bold ink outline.
 * img(name, size) wraps it in a die-cut sticker (white border + drop shadow) via an SVG filter.
 */
'use strict';
const K = '#1d1424';
let SW = 4; // current outline width (scaled() adjusts it for scaled groups)
const st = () => `stroke="${K}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;
const p  = (d,f,o='') => `<path d="${d}" fill="${f}" ${st()} ${o}/>`;
const pn = (d,f,o='') => `<path d="${d}" fill="${f}" ${o}/>`;
const po = d => `<path d="${d}" fill="none" ${st()}/>`;
const c  = (x,y,r,f,o='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${st()} ${o}/>`;
const cn = (x,y,r,f,o='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${o}/>`;
const e  = (x,y,rx,ry,f,o='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${st()} ${o}/>`;
const en = (x,y,rx,ry,f,o='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${o}/>`;
const r  = (x,y,w,h,rx,f,o='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${st()} ${o}/>`;
const rn = (x,y,w,h,rx,f,o='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${o}/>`;
/* outlined stroke: a thick ink line with a colored line on top */
const ln = (d,col,w) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w+SW*2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const ink = (d,w=3) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const hl = (x,y,rx,ry,rot=-30,op=.6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${x} ${y})"/>`;
const mirror = s => `<g transform="translate(100 0) scale(-1 1)">${s}</g>`;
const both = s => s + mirror(s);
function scaled(s, tx, ty, fn){ const old = SW; SW = old/s; const out = `<g transform="translate(${tx} ${ty}) scale(${s})">${fn()}</g>`; SW = old; return out; }
function star(cx,cy,R,r2,n=5,rot=-90){ let d=''; for(let i=0;i<n*2;i++){ const a=(rot+i*180/n)*Math.PI/180, rr=i%2?r2:R; d+=(i?'L':'M')+(cx+Math.cos(a)*rr).toFixed(1)+' '+(cy+Math.sin(a)*rr).toFixed(1); } return d+'Z'; }
/* eyes */
const eye = (x,y,s=7) => e(x,y,s*0.82,s,'#fff') + cn(x+s*0.12,y+s*0.18,s*0.5,K) + cn(x-s*0.12,y-s*0.2,s*0.2,'#fff');
const glow = (x,y,s,col) => cn(x,y,s*1.9,col,'opacity=".25"') + cn(x,y,s,col) + cn(x-s*0.3,y-s*0.3,s*0.35,'#fff');
const brow = (x1,y1,x2,y2,w=5) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${K}" stroke-width="${w}" stroke-linecap="round"/>`;

/* ---------- reusable parts ---------- */
const HEART = 'M50 88 C22 70 8 52 10 34 C12 18 32 10 50 28 C68 10 88 18 90 34 C92 52 78 70 50 88Z';
const DROP = 'M50 8 C62 30 80 46 80 64 C80 81 67 92 50 92 C33 92 20 81 20 64 C20 46 38 30 50 8Z';
const SHIELD = 'M50 8 L86 20 C86 56 74 78 50 92 C26 78 14 56 14 20 Z';
const FLAME_O = 'M50 6 C56 24 80 34 80 60 C80 80 66 92 50 92 C34 92 20 80 20 60 C20 44 30 36 34 24 C40 34 42 38 46 40 C48 28 46 18 50 6Z';
const FLAME_I = 'M50 38 C58 52 68 58 66 72 C64 84 57 88 50 88 C43 88 34 82 34 70 C34 58 46 54 50 38Z';

function heartArt(f,d,l){ return pn(HEART,f) + pn('M90 34 C92 52 78 70 50 88 C68 70 80 54 80 38 C80 30 76 24 72 22 C82 22 89 27 90 34Z',d) + po(HEART) + hl(30,32,9,6,-35); }
function dropArt(f,d){ return pn(DROP,f) + pn('M62 32 C72 44 80 54 80 64 C80 81 67 92 50 92 C64 86 70 76 70 64 C70 54 66 44 62 32Z',d) + po(DROP) + hl(36,62,6,11,-15); }
function shieldArt(rim, f, dk, em){
  return pn(SHIELD,rim) + po(SHIELD)
    + pn('M50 18 L76 27 C76 54 67 70 50 81 C33 70 24 54 24 27 Z', f)
    + pn('M50 18 L76 27 C76 54 67 70 50 81 Z', dk)
    + `<path d="M50 18 L76 27 C76 54 67 70 50 81 C33 70 24 54 24 27 Z" fill="none" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`
    + p('M45 30 L55 30 L55 44 L66 44 L66 54 L55 54 L55 70 L45 70 L45 54 L34 54 L34 44 L45 44Z', em)
    + hl(32,28,5,8,-20,.5);
}
function flameArt(o,y,core){ return pn(FLAME_O,o) + po(FLAME_O) + pn(FLAME_I,y) + en(50,76,8,10,core) + hl(36,52,4,9,-20,.45); }
function swordArt(blade='#e4ebf3', edge='#aab6c6', guard='#f7c936', grip='#8a5a34'){
  return `<g transform="rotate(45 50 50)">`
    + pn('M50 2 L61 14 L61 64 L39 64 L39 14 Z', blade) + pn('M50 2 L61 14 L61 64 L50 64 Z', edge) + po('M50 2 L61 14 L61 64 L39 64 L39 14 Z')
    + `<path d="M50 14 L50 58" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>`
    + r(44,72,12,18,4,grip) + r(26,62,48,11,5.5,guard) + c(50,94,7,guard) + `</g>`;
}
function potionArt(f,d,l){
  return r(42,16,16,20,3,'#dfe9f5') + r(39,5,22,13,4,'#c98a4b')
    + cn(50,62,30,'#e6eef8')
    + pn('M21 64 C30 58 40 68 50 62 C60 56 70 66 79 62 C79 80 66 92 50 92 C34 92 21 80 21 64Z', f)
    + pn('M79 62 C79 80 66 92 50 92 C64 86 72 76 73 64 Z', d)
    + cn(40,74,3.5,l) + cn(56,80,2.5,l) + cn(62,70,2,l)
    + c(50,62,30,'none') + hl(36,50,5,10,20,.75);
}
function crownArt(g='#f7c936', d='#c99a0f', g1='#ef5258', g2='#4a98ff'){
  const body = 'M14 76 L16 30 L36 50 L50 20 L64 50 L84 30 L86 76 Z';
  return pn(body,g) + pn('M50 20 L64 50 L84 30 L86 76 L50 76Z',d) + po(body)
    + r(12,68,76,18,6,g) + pn('M50 70 L86 70 L86 84 L50 84Z',d,'opacity=".6"')
    + c(16,28,6,g) + c(50,18,6,g) + c(84,28,6,g)
    + c(50,77,7,g1) + c(28,77,5,g2) + c(72,77,5,g2) + hl(26,48,3,9,-15,.5);
}
function featherArt(v, s, dk){
  const vane = 'M82 8 C60 12 34 32 22 60 C18 72 20 82 24 86 C40 80 62 64 74 42 C84 24 86 14 82 8Z';
  return pn(vane, v) + pn('M82 8 C86 14 84 24 74 42 C62 64 40 80 24 86 C44 70 62 46 82 8Z', dk) + po(vane)
    + ink('M48 52 L36 46 M58 40 L48 30 M40 64 L30 62 M64 30 L60 20',2.5)
    + ln('M84 6 C66 30 42 60 14 94', s, 3);
}
function bone(x1,y1,x2,y2,col='#f3ead6'){
  const a = Math.atan2(y2-y1,x2-x1), px = Math.cos(a+Math.PI/2)*4.5, py = Math.sin(a+Math.PI/2)*4.5;
  const knobs = [[x1+px,y1+py],[x1-px,y1-py],[x2+px,y2+py],[x2-px,y2-py]];
  return ln(`M${x1} ${y1} L${x2} ${y2}`, col, 8) + knobs.map(([x,y])=>c(x,y,5,col)).join('')
    + `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${col}" stroke-width="8" stroke-linecap="round"/>` + knobs.map(([x,y])=>cn(x,y,3,col)).join('');
}
function skullArt(y0=0, bone_='#f3ead6', eyeCol='#7fd0ff'){
  const T = `translate(0 ${y0})`;
  const sk = 'M50 10 C72 10 84 26 82 46 C81 56 74 60 72 66 L28 66 C26 60 19 56 18 46 C16 26 28 10 50 10Z';
  return `<g transform="${T}">`
    + r(31,58,38,16,6,bone_) + ink('M40 64 L40 74 M50 64 L50 74 M60 64 L60 74',2.5)
    + pn(sk,bone_) + pn('M72 20 C80 28 84 38 82 46 C81 56 74 60 72 66 L60 66 C68 56 72 44 72 20Z','#d9ccb0') + po(sk)
    + e(37,42,9,10,'#2a1830') + e(63,42,9,10,'#2a1830') + glow(37,43,3.5,eyeCol) + glow(63,43,3.5,eyeCol)
    + p('M50 50 L55 58 L45 58Z','#2a1830') + ink('M60 14 L56 22 L60 26',2.5)
    + hl(32,22,5,9,-30,.55) + `</g>`;
}

function hydraHead(){
  return both(p('M36 22 L28 6 L44 18Z','#86e6a8'))
    + e(50,30,20,15,'#45c674') + pn('M50 15 C64 15 70 24 70 30 C70 38 62 45 50 45 C60 38 62 26 50 15Z','#2a9a58') + e(50,30,20,15,'none') + e(50,39,12,6.5,'#86e6a8')
    + e(42,27,4.5,5,'#ffe066') + rn(40.8,23,2.4,8,1.2,K) + e(58,27,4.5,5,'#ffe066') + rn(56.8,23,2.4,8,1.2,K)
    + both(pn('M43 42 L45 47 L47 43Z','#fff')) + ln('M50 45 L50 52 L46 56 M50 52 L54 56','#ef5258',2);
}
/* ---------- the art catalogue (inner SVG, 100x100) ---------- */
const ART = {
  /* UI */
  heart: () => heartArt('#ef5258','#b8323a'),
  heal_icon: () => heartArt('#45c674','#2a8a4c'),
  shield: () => shieldArt('#c9d2df','#4a98ff','#2f6fd0','#f7c936'),
  armor: () => shieldArt('#9a93a6','#c9d2df','#9aa5b5','#6b6476'),
  oath: () => shieldArt('#f7c936','#ef5258','#b8323a','#fff4c8'),
  coin: () => c(50,50,38,'#f7c936') + pn('M50 12 A38 38 0 0 1 50 88 A30 30 0 0 0 50 12Z','#d9a20f') + `<circle cx="50" cy="50" r="27" fill="none" stroke="#b8860b" stroke-width="4"/>` + p(star(50,51,15,7),'#ffe58a') + c(50,50,38,'none') + hl(32,30,6,10,-35,.7),
  sword: () => swordArt(),
  flame: () => flameArt('#ff8a3c','#ffd23f','#fff4c8'),
  rage: () => flameArt('#e5484d','#ff9d3c','#ffe58a'),
  dice: () => `<g transform="rotate(-8 50 50)">` + r(14,14,72,72,16,'#fbf8ff') + pn('M14 66 L86 66 L86 70 C86 79 79 86 70 86 L30 86 C21 86 14 79 14 70Z','#cfc6dc') + r(14,14,72,72,16,'none') + cn(32,32,7,K) + cn(50,50,7,K) + cn(68,68,7,K) + `</g>`,
  rock: () => { const d='M12 76 L20 46 L40 28 L62 26 L82 40 L90 70 L78 86 L26 88 Z'; return pn(d,'#8f879b') + pn('M20 46 L40 28 L62 26 L52 46 L30 54Z','#b8b0c4') + pn('M62 26 L82 40 L90 70 L78 86 L66 62 L52 46Z','#6b6476') + po(d) + ink('M52 46 L66 62 L60 82',2.5); },
  snow: () => { let d=''; for(let k=0;k<3;k++){ const a=k*Math.PI/3; const cx=Math.cos(a), sy=Math.sin(a); d+=`M${50-cx*38} ${50-sy*38} L${50+cx*38} ${50+sy*38} `; for(const s of [-1,1]){ const bx=50+s*cx*24, by=50+s*sy*24; for(const t of [-1,1]){ const aa=a+(s>0?0:Math.PI)+t*0.75; d+=`M${bx} ${by} L${(bx+Math.cos(aa)*12).toFixed(1)} ${(by+Math.sin(aa)*12).toFixed(1)} `; } } } return ln(d,'#c8f0ff',7) + c(50,50,9,'#ffffff'); },
  drop: () => dropArt('#ef5258','#b8323a'),
  poison: () => dropArt('#a259e6','#6a2c9e'),
  potion_health: () => potionArt('#ef5258','#b8323a','#ffb3b6'),
  potion_fire: () => potionArt('#ff8a3c','#d8650c','#ffe58a'),
  potion_iron: () => potionArt('#8f879b','#5a5068','#d8d2e2'),
  potion_smoke: () => potionArt('#7fbfff','#3e7ae0','#e0f0ff'),
  potion_venom: () => potionArt('#a259e6','#6a2c9e','#e2c4ff'),
  bomb: () => c(46,60,30,'#3d3550') + pn('M66 38 A30 30 0 0 1 46 90 A26 26 0 0 0 66 38Z','#28202f') + hl(34,48,6,11,-30,.35) + `<g transform="rotate(25 50 30)">` + r(40,24,18,12,3,'#8f879b') + `</g>` + ln('M56 26 C58 14 68 10 76 14','#d9a066',4) + p(star(78,13,11,5),'#ffd23f') + pn(star(78,13,5,2.5),'#fff'),
  gear: () => { let t=''; for(let k=0;k<8;k++) t += `<g transform="rotate(${k*45} 50 50)">${r(42,6,16,20,4,'#a59db1')}</g>`; return t + c(50,50,31,'#a59db1') + pn('M50 19 A31 31 0 0 1 50 81 A26 26 0 0 0 50 19Z','#857c93') + c(50,50,11,'#2a2235') + hl(36,36,5,9,-40,.5); },

  /* rooms */
  r_combat: () => swordArt() + mirror(swordArt()),
  daggers: () => swordArt('#ecc8ff','#c77dff','#ef5258','#3d3550') + mirror(swordArt('#ecc8ff','#c77dff','#ef5258','#3d3550')),
  r_elite: () => both(p('M30 30 C16 28 6 16 8 4 C16 16 26 20 38 22 Z','#efe4c8') + pn('M30 30 C22 28 14 22 10 14 C18 20 28 22 36 24Z','#c9b89a')) + skullArt(8,'#f3ead6','#ff4d4d'),
  r_rest: () => `<g transform="rotate(-14 50 80)">${r(12,74,76,13,6.5,'#8a5a34')}${c(16,80,5,'#d9a066')}</g><g transform="rotate(14 50 80)">${r(12,74,76,13,6.5,'#a8683a')}${c(84,80,5,'#d9a066')}</g>` + scaled(0.68, 16, 2, ()=>flameArt('#ff8a3c','#ffd23f','#fff4c8')),
  r_shop: () => { const s='M30 34 C12 50 12 74 22 84 C30 92 70 92 78 84 C88 74 88 50 70 34 Z'; return pn(s,'#d9a066') + pn('M70 34 C88 50 88 74 78 84 C72 90 60 92 54 92 C72 82 76 58 62 34Z','#b8844a') + po(s) + p('M34 30 L26 10 L42 20 L50 6 L58 20 L74 10 L66 30Z','#c98a4b') + r(32,26,36,10,5,'#8a5a34') + c(50,64,15,'#f7c936') + p(star(50,65,8,4),'#fff0a8') + hl(30,56,5,11,-15,.4); },
  r_treasure: () => r(12,46,76,42,8,'#a8683a') + pn('M50 48 L88 48 L88 80 C88 85 84 88 80 88 L50 88Z','#8a5230') + r(12,46,76,42,8,'none')
    + p('M12 50 L12 38 C12 22 28 14 50 14 C72 14 88 22 88 38 L88 50 Z','#c98a4b') + pn('M14 36 C16 24 28 18 44 17 C30 22 22 30 20 38Z','#e2a86a')
    + r(22,14,10,74,3,'#f7c936') + r(68,14,10,74,3,'#f7c936') + r(41,40,18,20,5,'#f7c936') + cn(50,48,3,K) + rn(48.5,48,3,7,1,K),
  r_event: () => r(18,14,64,74,6,'#f2e3c0') + pn('M60 14 L82 14 L82 88 L64 88Z','#e2cc9c') + r(18,14,64,74,6,'none') + r(12,6,76,14,7,'#e2cc9c') + r(12,82,76,14,7,'#e2cc9c')
    + ln('M38 38 C38 24 62 24 62 38 C62 48 50 48 50 60','#9d4edd',9) + c(50,72,5.5,'#9d4edd'),
  r_boss: () => crownArt(),
  crown: () => crownArt('#f7c936','#c99a0f','#45c674','#c77dff'),

  /* relics */
  whetstone: () => { const d='M12 62 L68 30 C78 25 90 34 86 44 L30 76 C20 80 8 72 12 62Z'; return pn(d,'#9a93a6') + pn('M86 44 L30 76 C22 79 14 76 12 70 C22 72 74 42 88 36Z','#6b6476') + po(d) + hl(40,50,4,16,60,.5) + p(star(76,16,12,4,4,0),'#ffe58a'); },
  fang: () => { const d='M22 18 C40 12 60 12 78 18 C76 46 62 72 50 90 C38 72 24 46 22 18Z'; return pn(d,'#fbf7ee') + pn('M50 14 C62 14 70 15 78 18 C76 46 62 72 50 90 C58 66 64 42 50 14Z','#e0d6c4') + po(d) + p('M22 18 C40 12 60 12 78 18 C78 26 22 26 22 18Z','#ef5258') + hl(36,40,4,12,-10,.6); },
  idol: () => r(22,10,56,80,20,'#f2c230') + pn('M50 10 L58 10 C70 10 78 18 78 30 L78 70 C78 82 70 90 58 90 L50 90Z','#d9a20f') + r(22,10,56,80,20,'none')
    + brow(30,30,44,34,5) + brow(70,30,56,34,5) + e(38,42,7,5,'#7a5608') + e(62,42,7,5,'#7a5608') + p('M46 46 L54 46 L56 60 L44 60Z','#e0b020')
    + r(32,66,36,12,5,'#7a5608') + ink('M40 66 L40 78 M50 66 L50 78 M60 66 L60 78',2.5) + hl(30,22,4,8,-20,.6),
  chainmail: () => { const d='M30 12 L42 12 C44 22 56 22 58 12 L70 12 L90 30 L80 44 L72 38 L72 90 L28 90 L28 38 L20 44 L10 30Z'; let rings=''; for(let y=30;y<=84;y+=9) for(let x=34+(y%18?4.5:0);x<=66;x+=9) rings += `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="#6b6476" stroke-width="2"/>`; return pn(d,'#c9c2d4') + rings + pn('M50 22 L58 12 L70 12 L90 30 L80 44 L72 38 L72 90 L50 90Z','#6b6476','opacity=".25"') + po(d); },
  turtle: () => both(e(22,32,9,7,'#9cd67a') + e(24,74,9,7,'#9cd67a')) + c(50,14,10,'#9cd67a') + cn(46,12,2,K) + cn(54,12,2,K)
    + e(50,52,30,36,'#3dbb6a') + pn('M50 16 A30 36 0 0 1 50 88 A24 32 0 0 0 50 16Z','#2a8a4c') + e(50,52,30,36,'none')
    + p('M50 36 L62 44 L62 58 L50 66 L38 58 L38 44Z','#86e6a8') + ink('M50 16 L50 36 M62 44 L78 36 M62 58 L78 68 M50 66 L50 88 M38 58 L22 68 M38 44 L22 36',3),
  feather: () => featherArt('#eef4ff','#c9d2df','#a8ceff'),
  phoenix: () => featherArt('#ffb347','#fff0a8','#ef5258'),
  magnet: () => { const d='M18 22 L42 22 L42 56 C42 62 46 66 50 66 C54 66 58 62 58 56 L58 22 L82 22 L82 56 C82 76 68 90 50 90 C32 90 18 76 18 56Z'; return pn(d,'#ef5258') + pn('M82 22 L82 56 C82 76 68 90 50 90 C64 82 72 70 72 56 L72 22Z','#b8323a') + po(d) + r(18,10,24,16,4,'#e4ebf3') + r(58,10,24,16,4,'#e4ebf3') + hl(28,58,4,12,0,.5); },
  hourglass: () => { const g='M30 18 L70 18 C70 34 56 44 54 50 C56 56 70 66 70 82 L30 82 C30 66 44 56 46 50 C44 44 30 34 30 18Z'; return pn(g,'#e6f6ff') + pn('M36 26 L64 26 C62 36 54 44 50 48 C46 44 38 36 36 26Z','#f7c936') + pn('M34 80 C38 68 46 62 50 62 C54 62 62 68 66 80Z','#f7c936') + `<path d="M50 48 L50 62" stroke="#f7c936" stroke-width="2.5"/>` + po(g) + hl(38,30,2.5,6,-20,.8)
    + r(18,8,64,12,5,'#8a5a34') + r(18,80,64,12,5,'#8a5a34') + ln('M24 20 L24 80','#a8683a',4) + ln('M76 20 L76 80','#a8683a',4); },
  hammer: () => `<g transform="rotate(-30 50 50)">${r(44,38,12,56,5,'#8a5a34')}${r(16,12,68,30,9,'#9a93a6')}${pn('M16 32 L84 32 L84 33 C84 38 80 42 75 42 L25 42 C20 42 16 38 16 33Z','#6b6476')}${r(16,12,68,30,9,'none')}${hl(30,20,3,10,90,.5)}</g>`,
  spikes: () => p('M26 46 L18 14 L40 38Z','#e4ebf3') + p('M43 34 L50 4 L57 34Z','#e4ebf3') + p('M74 46 L82 14 L60 38Z','#e4ebf3')
    + p('M10 76 C10 46 28 30 50 30 C72 30 90 46 90 76Z','#9a93a6') + pn('M50 30 C72 30 90 46 90 76 L70 76 C70 52 62 38 50 30Z','#6b6476') + po('M10 76 C10 46 28 30 50 30 C72 30 90 46 90 76Z')
    + r(6,70,88,16,7,'#6b6476') + cn(22,78,3,'#c9c2d4') + cn(50,78,3,'#c9c2d4') + cn(78,78,3,'#c9c2d4') + hl(30,46,4,10,40,.5),
  drum: () => ln('M20 6 L50 30','#d9a066',5) + ln('M80 6 L50 30','#d9a066',5) + c(20,6,5,'#fff') + c(80,6,5,'#fff')
    + r(16,36,68,50,8,'#ef5258') + pn('M60 36 L84 36 L84 78 C84 82 80 86 76 86 L60 86Z','#b8323a') + r(16,36,68,50,8,'none')
    + `<path d="M18 50 L30 70 L42 50 L54 70 L66 50 L78 70" fill="none" stroke="#f7c936" stroke-width="5" stroke-linejoin="round"/>` + e(50,36,34,10,'#fbf3e8'),
  gem: () => { const d='M22 36 L38 16 L62 16 L78 36 L50 88 Z'; return pn(d,'#c77dff') + pn('M38 16 L62 16 L66 36 L34 36Z','#ecc8ff') + pn('M62 16 L78 36 L50 88 L66 36Z','#8a3fd1') + pn('M22 36 L34 36 L50 88Z','#a259e6') + po(d) + ink('M22 36 L78 36 M34 36 L50 88 L66 36 M38 16 L34 36 M62 16 L66 36',2.5) + hl(44,24,3,6,0,.8); },
  cauldron: () => cn(30,24,6,'#7ee36b') + cn(62,16,4,'#7ee36b') + cn(48,8,3,'#7ee36b')
    + r(22,82,10,12,3,'#3d3550') + r(68,82,10,12,3,'#3d3550')
    + p('M12 40 L88 40 C90 68 74 88 50 88 C26 88 10 68 12 40Z','#3d3550') + pn('M88 40 C90 68 74 88 50 88 C66 78 74 60 74 40Z','#28202f') + po('M12 40 L88 40 C90 68 74 88 50 88 C26 88 10 68 12 40Z')
    + r(8,32,84,12,6,'#5a5068') + en(50,34,34,3,'#7ee36b') + p('M30 44 C30 52 36 52 36 46','#7ee36b') + hl(26,58,4,12,-10,.25),
  ring: () => `<circle cx="50" cy="60" r="27" fill="none" stroke="${K}" stroke-width="17"/><circle cx="50" cy="60" r="27" fill="none" stroke="#f7c936" stroke-width="9"/><path d="M34 82 A27 27 0 0 0 76 66" fill="none" stroke="#c99a0f" stroke-width="5"/>`
    + p('M38 30 L44 22 L56 22 L62 30 L50 44Z','#4a98ff') + pn('M44 22 L56 22 L58 30 L42 30Z','#a8ceff') + hl(32,52,3,8,-20,.7),
  orb: () => p('M28 92 L72 92 L64 74 L36 74Z','#8a5a34') + pn('M50 74 L64 74 L72 92 L56 92Z','#5a3820') + po('M28 92 L72 92 L64 74 L36 74Z')
    + c(50,44,32,'#9d4edd') + pn('M50 12 A32 32 0 0 1 50 76 A26 26 0 0 0 50 12Z','#6a2c9e') + pn('M30 50 C36 36 52 34 60 42 C52 40 42 44 38 54Z','#ecc8ff','opacity=".8"') + cn(58,56,6,'#ecc8ff','opacity=".5"') + c(50,44,32,'none') + hl(36,30,6,11,-35,.7),

  /* enemies — floor 1 */
  rat: () => ln('M72 80 C92 78 96 58 84 52','#ff9aa8',5)
    + both(c(28,26,14,'#a59db1') + cn(28,27,8,'#ffb3c1'))
    + p('M50 22 C72 22 84 40 84 60 C84 78 70 90 50 90 C30 90 16 78 16 60 C16 40 28 22 50 22Z','#a59db1') + pn('M50 22 C72 22 84 40 84 60 C84 78 70 90 50 90 C64 80 72 66 72 52 C72 38 64 28 50 22Z','#857c93') + po('M50 22 C72 22 84 40 84 60 C84 78 70 90 50 90 C30 90 16 78 16 60 C16 40 28 22 50 22Z')
    + en(50,74,18,12,'#d4cede') + eye(38,52,8) + eye(62,52,8) + brow(30,40,44,44) + brow(70,40,56,44)
    + e(50,64,6,4.5,'#ff8aa0') + r(45,70,10,9,2,'#fff') + ink('M50 70 L50 79',2)
    + ink('M30 66 L12 62 M30 70 L14 72 M70 66 L88 62 M70 70 L86 72',2),
  bat: () => both(p('M38 46 C28 28 14 24 2 28 C8 36 6 46 10 52 C16 48 22 52 24 58 C30 54 34 56 38 60Z','#6a2c9e') + p('M34 38 L28 12 L44 30Z','#8a4fc2'))
    + c(50,54,22,'#8a4fc2') + pn('M50 32 A22 22 0 0 1 50 76 A18 18 0 0 0 50 32Z','#6a2c9e') + c(50,54,22,'none')
    + e(42,50,6,7,'#fff') + cn(43,51,3.5,'#e5484d') + e(58,50,6,7,'#fff') + cn(57,51,3.5,'#e5484d')
    + ink('M42 64 Q50 68 58 64',2.5) + p('M43 64 L46 72 L48 65Z','#fff') + p('M57 64 L54 72 L52 65Z','#fff') + hl(40,40,3,6,-30,.4),
  slime: () => { const d='M12 80 C12 50 30 22 50 22 C70 22 88 50 88 80 C88 88 82 90 76 88 C70 92 62 86 56 90 C50 94 42 86 36 90 C28 94 12 90 12 80Z'; return pn(d,'#45c674') + pn('M50 22 C70 22 88 50 88 80 C88 88 82 90 76 88 C78 60 70 36 50 22Z','#2a9a58') + po(d) + hl(30,40,6,12,-30,.6) + cn(28,52,3,'#fff','opacity=".6"') + eye(38,58,8) + eye(62,58,8) + ink('M44 72 Q50 77 56 72',3); },
  spider: () => both(ln('M38 52 C26 38 16 38 6 46','#3d2a52',5) + ln('M38 58 C24 54 14 58 6 68','#3d2a52',5) + ln('M40 64 C28 68 20 76 16 88','#3d2a52',5) + ln('M42 48 C34 28 24 22 12 22','#3d2a52',5))
    + c(50,58,26,'#5a3a7a') + pn('M50 32 A26 26 0 0 1 50 84 A20 20 0 0 0 50 32Z','#3d2a52') + c(50,58,26,'none')
    + p('M44 70 L56 70 L50 78Z M44 86 L56 86 L50 78Z','#ef5258') + glow(42,52,5,'#ff4d4d') + glow(58,52,5,'#ff4d4d') + glow(45,42,3,'#ff4d4d') + glow(55,42,3,'#ff4d4d') + hl(38,44,3,7,-30,.3),
  ogre: () => both(p('M28 28 C16 22 12 10 16 2 C22 12 30 16 38 18Z','#efe4c8') + e(14,54,7,10,'#5a9a3c'))
    + p('M50 16 C76 16 88 34 88 56 C88 78 72 90 50 90 C28 90 12 78 12 56 C12 34 24 16 50 16Z','#6bb04a') + pn('M50 16 C76 16 88 34 88 56 C88 78 72 90 50 90 C66 80 76 64 76 48 C76 34 66 22 50 16Z','#4f8f34') + po('M50 16 C76 16 88 34 88 56 C88 78 72 90 50 90 C28 90 12 78 12 56 C12 34 24 16 50 16Z')
    + eye(36,50,6) + eye(64,50,6) + brow(26,40,44,46,6) + brow(74,40,56,46,6) + e(50,62,8,6,'#5a9a3c')
    + p('M30 72 C40 80 60 80 70 72 C66 84 34 84 30 72Z','#3a1a20') + both(p('M34 74 L36 60 L43 74Z','#fff')) + hl(30,30,5,10,-40,.4),
  shroom: () => p('M34 46 L66 46 C70 66 68 86 50 90 C32 86 30 66 34 46Z','#f3e3c4') + pn('M58 46 L66 46 C70 66 68 86 50 90 C62 80 62 62 58 46Z','#d9c4a0') + po('M34 46 L66 46 C70 66 68 86 50 90 C32 86 30 66 34 46Z')
    + eye(43,64,5) + eye(57,64,5) + brow(38,56,46,59,4) + brow(62,56,54,59,4) + e(50,76,4,3,'#3a1a20')
    + p('M6 50 C6 26 26 8 50 8 C74 8 94 26 94 50 C80 58 20 58 6 50Z','#ef5258') + pn('M50 8 C74 8 94 26 94 50 C88 53 80 55 70 56 C80 40 72 18 50 8Z','#b8323a') + po('M6 50 C6 26 26 8 50 8 C74 8 94 26 94 50 C80 58 20 58 6 50Z')
    + c(28,30,7,'#fff') + c(54,20,6,'#fff') + c(74,36,6,'#fff') + c(44,42,4,'#fff'),
  /* floor 2 */
  skeleton: () => r(32,72,36,22,7,'#f3ead6') + ink('M38 78 L62 78 M38 84 L62 84 M38 90 L62 90 M50 72 L50 94',2.5) + skullArt(0),
  goblin: () => both(p('M28 48 L2 30 L8 52 L26 62Z','#6bb04a') + pn('M24 50 L8 38 L12 52Z','#ff9aa8'))
    + p('M50 20 C72 20 80 36 80 56 C80 76 68 88 50 88 C32 88 20 76 20 56 C20 36 28 20 50 20Z','#6bb04a') + pn('M50 20 C72 20 80 36 80 56 C80 76 68 88 50 88 C62 78 68 66 68 52 C68 36 62 26 50 20Z','#4f8f34') + po('M50 20 C72 20 80 36 80 56 C80 76 68 88 50 88 C32 88 20 76 20 56 C20 36 28 20 50 20Z')
    + e(38,50,8,7,'#ffe066') + rn(37,45,3,10,1.5,K) + e(62,50,8,7,'#ffe066') + rn(61,45,3,10,1.5,K) + brow(28,40,44,46,5) + brow(72,40,56,46,5)
    + p('M46 52 C50 54 54 62 50 66 C46 62 46 56 46 52Z','#5a9a3c') + p('M32 70 C40 80 60 80 68 70 C60 74 40 74 32 70Z','#3a1a20') + both(pn('M38 72 L41 77 L44 73Z','#fff')),
  ghost: () => { const d='M20 50 C20 26 34 10 50 10 C66 10 80 26 80 50 L80 84 C74 92 70 80 64 86 C58 92 54 80 50 86 C46 92 42 80 36 86 C30 92 26 80 20 84Z'; return pn(d,'#f7f4fb') + pn('M50 10 C66 10 80 26 80 50 L80 84 C74 92 70 80 64 86 C68 70 70 40 50 10Z','#d8cfe6') + po(d) + e(39,44,6,9,K) + e(61,44,6,9,K) + cn(37,40,2.2,'#fff') + cn(59,40,2.2,'#fff') + e(50,64,6,8,K) + cn(30,56,5,'#ffb3c1','opacity=".6"') + cn(70,56,5,'#ffb3c1','opacity=".6"') + hl(32,26,5,10,-30,.7); },
  zombie: () => p('M16 94 C18 76 32 70 50 70 C68 70 82 76 84 94Z','#4a78b0') + pn('M60 70 C72 72 82 78 84 94 L70 94Z','#35598a') + po('M16 94 C18 76 32 70 50 70 C68 70 82 76 84 94Z') + p('M40 72 L46 84 L50 72Z','#9fc48a')
    + p('M50 12 C72 12 82 28 82 48 C82 68 70 80 50 80 C30 80 18 68 18 48 C18 28 28 12 50 12Z','#9fc48a') + pn('M50 12 C72 12 82 28 82 48 C82 68 70 80 50 80 C64 70 70 58 70 44 C70 30 64 18 50 12Z','#7aa266') + po('M50 12 C72 12 82 28 82 48 C82 68 70 80 50 80 C30 80 18 68 18 48 C18 28 28 12 50 12Z')
    + p('M26 26 C30 12 46 8 56 12 C50 16 44 16 40 22 C36 18 30 20 26 26Z','#4a3a2a')
    + ink('M28 32 L44 36 M32 30 L30 36 M38 32 L36 38',2.5) + eye(37,48,9) + c(64,48,6,'#fff') + ink('M60 44 L68 52 M68 44 L60 52',2.5)
    + p('M36 64 L46 62 L56 66 L66 62 L64 70 L38 70Z','#3a1a20') + pn('M46 63 L48 67 L50 64Z','#fff'),
  warlock: () => p('M50 4 C66 10 82 32 86 58 C88 74 84 88 82 94 L18 94 C16 88 12 74 14 58 C18 32 34 10 50 4Z','#6a2c9e') + pn('M50 4 C66 10 82 32 86 58 C88 74 84 88 82 94 L66 94 C72 70 70 34 50 4Z','#4f1f78') + po('M50 4 C66 10 82 32 86 58 C88 74 84 88 82 94 L18 94 C16 88 12 74 14 58 C18 32 34 10 50 4Z')
    + p('M50 26 C66 26 74 42 74 56 C74 68 64 76 50 76 C36 76 26 68 26 56 C26 42 34 26 50 26Z','#140a1c') + glow(40,50,5,'#7dff7a') + glow(60,50,5,'#7dff7a')
    + p('M34 64 C38 84 46 94 50 96 C54 94 62 84 66 64 C60 72 40 72 34 64Z','#ece6f4') + ink('M44 74 L46 86 M56 74 L54 86',2) + ln('M18 92 L82 92','#f7c936',3) + p(star(50,16,6,3),'#f7c936'),
  mimic: () => r(12,54,76,36,7,'#a8683a') + pn('M50 54 L88 54 L88 83 C88 87 85 90 81 90 L50 90Z','#8a5230') + r(12,54,76,36,7,'none')
    + rn(16,46,68,12,4,'#5a1020') + p('M44 52 C42 70 62 74 64 62 C64 56 58 52 54 52Z','#ff6b8a') + ink('M52 58 L54 68',2)
    + both(p('M18 56 L22 66 L26 56Z','#fff') + p('M28 56 L32 66 L36 56Z','#fff') + p('M22 48 L26 40 L30 48Z','#fff') + p('M34 48 L38 40 L42 48Z','#fff'))
    + p('M10 46 L14 26 C16 14 30 8 50 10 C70 8 84 14 86 26 L90 46 Z','#c98a4b') + po('M10 46 L14 26 C16 14 30 8 50 10 C70 8 84 14 86 26 L90 46 Z')
    + r(22,8,9,40,3,'#f7c936') + r(69,8,9,40,3,'#f7c936') + r(22,54,9,36,3,'#f7c936') + r(69,54,9,36,3,'#f7c936') + glow(40,28,5,'#ffe066') + glow(60,28,5,'#ffe066') + brow(32,20,46,25,4) + brow(68,20,54,25,4),
  /* floor 3 */
  imp: () => both(p('M32 52 L6 34 L12 54 L4 62 L30 66Z','#8f2227') + p('M34 34 L24 8 L44 28Z','#ffd27a'))
    + c(50,56,28,'#ef5258') + pn('M50 28 A28 28 0 0 1 50 84 A22 22 0 0 0 50 28Z','#b8323a') + c(50,56,28,'none')
    + e(40,52,7,7,'#ffe066') + cn(41,53,3.5,K) + e(60,52,7,7,'#ffe066') + cn(59,53,3.5,K) + brow(32,42,46,47,4.5) + brow(68,42,54,47,4.5)
    + p('M32 64 C42 76 58 76 68 64 C58 70 42 70 32 64Z','#3a1a20') + both(pn('M37 66 L40 72 L43 67Z','#fff')) + hl(36,38,4,7,-30,.4),
  cultist: () => p('M50 4 C68 8 84 30 86 56 L90 94 L10 94 L14 56 C16 30 32 8 50 4Z','#b8323a') + pn('M50 4 C68 8 84 30 86 56 L90 94 L72 94 C74 60 68 26 50 4Z','#8f2227') + po('M50 4 C68 8 84 30 86 56 L90 94 L10 94 L14 56 C16 30 32 8 50 4Z')
    + p('M50 24 C64 24 72 38 72 52 C72 62 62 68 50 68 C38 68 28 62 28 52 C28 38 36 24 50 24Z','#140a14') + glow(41,48,4.5,'#ffd23f') + glow(59,48,4.5,'#ffd23f')
    + p('M50 74 L58 82 L50 90 L42 82Z','#f7c936') + cn(50,82,2.5,K) + ln('M30 70 L36 92','#8f2227',3) + ln('M70 70 L64 92','#8f2227',3),
  wyrm: () => both(p('M30 30 L16 6 L40 24Z','#ecc8ff') + p('M26 44 L6 40 L18 56Z','#8a3fd1'))
    + p('M50 18 C70 18 82 32 82 48 C82 58 78 64 74 68 L74 74 C74 84 64 92 50 92 C36 92 26 84 26 74 L26 68 C22 64 18 58 18 48 C18 32 30 18 50 18Z','#a259e6') + pn('M50 18 C70 18 82 32 82 48 C82 58 78 64 74 68 L74 74 C74 84 64 92 50 92 C62 82 66 70 66 56 C66 40 62 26 50 18Z','#8a3fd1') + po('M50 18 C70 18 82 32 82 48 C82 58 78 64 74 68 L74 74 C74 84 64 92 50 92 C36 92 26 84 26 74 L26 68 C22 64 18 58 18 48 C18 32 30 18 50 18Z')
    + e(50,74,20,13,'#dcb6ff') + e(43,70,2.5,3.5,K) + e(57,70,2.5,3.5,K) + both(p('M38 84 L40 90 L43 85Z','#fff'))
    + e(37,46,8,9,'#ffe066') + rn(35.5,40,3,12,1.5,K) + e(63,46,8,9,'#ffe066') + rn(61.5,40,3,12,1.5,K) + p('M44 20 L50 10 L56 20Z','#ecc8ff'),
  gargoyle: () => both(p('M30 44 C16 26 6 24 2 28 C6 38 4 50 8 58 C14 54 20 58 24 64 Z','#6b6476') + p('M32 26 L26 8 L42 22Z','#b8b0c4'))
    + p('M50 18 C70 18 80 32 80 52 C80 72 68 86 50 86 C32 86 20 72 20 52 C20 32 30 18 50 18Z','#9a93a6') + pn('M50 18 C70 18 80 32 80 52 C80 72 68 86 50 86 C62 76 68 64 68 50 C68 34 62 24 50 18Z','#7a7387') + po('M50 18 C70 18 80 32 80 52 C80 72 68 86 50 86 C32 86 20 72 20 52 C20 32 30 18 50 18Z')
    + rn(26,38,48,8,4,'#6b6476') + glow(38,50,4.5,'#ff4d4d') + glow(62,50,4.5,'#ff4d4d') + p('M44 58 L56 58 L50 64Z','#6b6476')
    + p('M34 70 C42 76 58 76 66 70 L62 78 L38 78Z','#2a2233') + both(pn('M38 71 L41 77 L44 72Z','#fff')) + ink('M62 24 L58 32 L64 36 M28 64 L32 70',2),
  golem: () => { const d='M18 30 L38 14 L64 14 L84 32 L88 64 L72 90 L28 90 L12 64Z'; return pn(d,'#8f879b') + pn('M18 30 L38 14 L52 14 L40 34 L22 44Z','#b8b0c4') + pn('M64 14 L84 32 L88 64 L72 90 L60 90 L70 60 L66 34Z','#6b6476') + po(d)
    + pn('M38 14 L64 14 L70 22 C60 20 46 22 34 18Z','#5aa04a') + glow(38,40,5.5,'#ffb347') + glow(62,40,5.5,'#ffb347') + p('M50 56 L60 66 L50 78 L40 66Z','#ff9d3c') + pn('M50 61 L55 66 L50 72 L45 66Z','#fff4c8')
    + `<path d="M30 70 L36 76 L32 84 M70 48 L76 54" stroke="#ff9d3c" stroke-width="2.5" fill="none" stroke-linecap="round"/>`; },
  darkknight: () => p('M50 2 C64 0 76 10 70 24 L50 20Z','#b8323a') + pn('M56 4 C64 6 70 14 66 22 L58 21Z','#8f2227')
    + p('M50 14 C74 14 86 32 86 56 L86 80 C78 90 22 90 14 80 L14 56 C14 32 26 14 50 14Z','#3d3550') + pn('M50 14 C74 14 86 32 86 56 L86 80 C82 84 74 86 66 87 C72 60 70 30 50 14Z','#28202f') + po('M50 14 C74 14 86 32 86 56 L86 80 C78 90 22 90 14 80 L14 56 C14 32 26 14 50 14Z')
    + ink('M50 16 L50 44',3) + r(22,44,56,12,6,'#120a14') + glow(36,50,4,'#ff3b3b') + glow(64,50,4,'#ff3b3b')
    + cn(40,68,2.5,'#120a14') + cn(50,70,2.5,'#120a14') + cn(60,68,2.5,'#120a14') + cn(45,76,2.5,'#120a14') + cn(55,76,2.5,'#120a14') + hl(28,30,4,10,-30,.35),
  /* bosses */
  boneking: () => p('M10 96 C12 72 26 62 50 62 C74 62 88 72 90 96Z','#6a2c9e') + pn('M62 63 C76 66 88 76 90 96 L74 96Z','#4f1f78') + po('M10 96 C12 72 26 62 50 62 C74 62 88 72 90 96Z') + ln('M24 74 L76 74','#f7c936',3)
    + skullArt(12,'#f3ead6','#d08bff') + scaled(0.56, 22, -6, ()=>crownArt('#f7c936','#c99a0f','#ef5258','#7fd0ff')),
  hydra: () => p('M14 96 C18 78 82 78 86 96Z','#2a9a58')
    + ln('M50 96 C50 72 50 60 50 44','#45c674',16) + both(ln('M40 96 C30 76 22 64 22 50','#45c674',13))
    + scaled(0.74, 22-50*0.74, 46-30*0.74, hydraHead) + mirror(scaled(0.74, 22-50*0.74, 46-30*0.74, hydraHead)) + hydraHead(),
  dragon: () => both(p('M28 30 C16 22 12 8 16 0 C22 10 32 16 40 20Z','#efe4c8') + p('M20 44 L0 32 L8 56Z','#b8323a'))
    + p('M50 16 C72 16 86 32 86 50 C86 58 82 62 80 66 C84 76 80 86 72 90 L28 90 C20 86 16 76 20 66 C18 62 14 58 14 50 C14 32 28 16 50 16Z','#ef5258') + pn('M50 16 C72 16 86 32 86 50 C86 58 82 62 80 66 C84 76 80 86 72 90 L62 90 C72 76 74 62 72 48 C70 32 62 22 50 16Z','#b8323a') + po('M50 16 C72 16 86 32 86 50 C86 58 82 62 80 66 C84 76 80 86 72 90 L28 90 C20 86 16 76 20 66 C18 62 14 58 14 50 C14 32 28 16 50 16Z')
    + brow(24,36,44,42,6) + brow(76,36,56,42,6) + e(35,48,8,6,'#ffd23f') + rn(33.5,43,3,10,1.5,K) + e(65,48,8,6,'#ffd23f') + rn(63.5,43,3,10,1.5,K)
    + e(50,72,26,15,'#ff8a80') + e(41,67,3,4,K) + e(59,67,3,4,K) + ink('M30 78 Q50 86 70 78',3) + both(p('M32 78 L35 86 L38 79Z','#fff') + p('M42 81 L44 87 L46 82Z','#fff'))
    + pn('M44 24 L50 18 L56 24 L50 30Z','#ff8a80') + hl(28,32,4,9,-30,.4),

  /* heroes */
  knight: () => p('M14 96 C16 84 26 80 50 80 C74 80 84 84 86 96Z','#4a98ff') + p('M44 84 L56 84 L56 96 L44 96Z','#f7c936')
    + p('M50 2 C68 0 78 12 72 26 L50 22Z','#4a98ff') + pn('M58 4 C68 6 74 14 70 24 L62 23Z','#2f6fd0')
    + p('M50 14 C74 14 84 32 84 56 L84 74 C80 86 20 86 16 74 L16 56 C16 32 26 14 50 14Z','#d4dbe6') + pn('M50 14 C74 14 84 32 84 56 L84 74 C82 80 74 83 66 84 C72 60 70 30 50 14Z','#a9b4c4') + po('M50 14 C74 14 84 32 84 56 L84 74 C80 86 20 86 16 74 L16 56 C16 32 26 14 50 14Z')
    + ink('M50 16 L50 42',3) + r(22,44,56,13,6.5,'#1d1424') + cn(37,50,3,'#a8ceff') + cn(63,50,3,'#a8ceff')
    + ln('M18 62 L82 62','#f7c936',3) + cn(40,72,2.5,K) + cn(50,72,2.5,K) + cn(60,72,2.5,K) + hl(30,30,4,10,-30,.7),
  rogue: () => p('M50 6 C72 6 88 26 88 52 C88 72 80 86 74 94 L26 94 C20 86 12 72 12 52 C12 26 28 6 50 6Z','#3e9a5a') + pn('M50 6 C72 6 88 26 88 52 C88 72 80 86 74 94 L64 94 C74 70 74 30 50 6Z','#2a7a44') + po('M50 6 C72 6 88 26 88 52 C88 72 80 86 74 94 L26 94 C20 86 12 72 12 52 C12 26 28 6 50 6Z')
    + p('M50 28 C66 28 74 42 74 56 C74 70 64 80 50 80 C36 80 26 70 26 56 C26 42 34 28 50 28Z','#f0c8a0')
    + p('M26 58 C34 64 66 64 74 58 C74 72 64 82 50 82 C36 82 26 72 26 58Z','#2a2235') + e(40,50,4.5,5,K) + e(60,50,4.5,5,K) + cn(39,48,1.6,'#fff') + cn(59,48,1.6,'#fff')
    + brow(34,41,45,44,3.5) + brow(66,41,55,44,3.5) + ln('M22 90 L40 80','#8a5a34',3) + c(40,80,3,'#f7c936') + hl(30,24,4,10,-35,.4),
  mage: () => p('M24 56 C24 82 40 96 50 98 C60 96 76 82 76 56Z','#f4f0f8') + pn('M60 58 L76 56 C76 82 60 96 50 98 C62 88 66 74 60 58Z','#d8cfe6') + po('M24 56 C24 82 40 96 50 98 C60 96 76 82 76 56Z')
    + e(50,52,22,18,'#f0c8a0') + cn(42,52,3.5,K) + cn(58,52,3.5,K) + cn(41,51,1.2,'#fff') + cn(57,51,1.2,'#fff') + cn(50,60,4,'#e0a080')
    + p('M34 64 C40 60 46 62 50 64 C54 62 60 60 66 64 C60 70 54 68 50 66 C46 68 40 70 34 64Z','#f4f0f8')
    + `<g transform="translate(0 -6)">` + p('M20 36 C30 30 40 10 66 2 C60 14 66 26 80 36Z','#3e7ae0') + pn('M66 2 C60 14 66 26 80 36 L62 36 C58 24 60 12 66 2Z','#1c4c99') + po('M20 36 C30 30 40 10 66 2 C60 14 66 26 80 36Z')
    + e(50,38,40,9,'#2f62c4') + ln('M24 33 C40 38 60 38 76 33','#f7c936',3) + p(star(48,20,6,2.6),'#ffd23f') + pn(star(62,26,3.5,1.6),'#ffd23f') + `</g>`,

  /* event scenes */
  shrine: () => cn(50,30,22,'#c77dff','opacity=".25"') + r(12,78,76,14,4,'#6b6476') + r(22,46,56,34,5,'#8f879b') + pn('M60 46 L78 46 L78 75 C78 78 76 80 73 80 L60 80Z','#6b6476') + r(22,46,56,34,5,'none')
    + rn(22,46,56,6,3,'#b8b0c4') + p('M40 50 C40 58 44 60 44 66 C44 70 40 70 40 66Z','#ef5258') + both(r(14,34,8,14,2,'#f3ead6') + p('M18 24 C22 28 22 32 18 34 C14 32 14 28 18 24Z','#ffd23f'))
    + c(50,30,13,'#c77dff') + pn('M50 17 A13 13 0 0 1 50 43 A10 10 0 0 0 50 17Z','#8a3fd1') + c(50,30,13,'none') + hl(45,25,3,5,-30,.8),
  pool: () => e(50,60,42,26,'#8f879b') + en(50,64,40,22,'#6b6476') + e(50,58,33,17,'#3e8ef7') + en(50,62,30,12,'#2f6fd0')
    + en(40,62,5,3,'#f7c936','opacity=".85"') + en(58,66,4,2.5,'#f7c936','opacity=".85"') + en(52,56,4,2.5,'#f7c936','opacity=".7"')
    + `<ellipse cx="50" cy="58" rx="18" ry="7" fill="none" stroke="#a8ceff" stroke-width="2" opacity=".7"/>` + hl(34,52,6,2.5,0,.7) + p(star(72,30,8,3,4,0),'#fff') + p(star(26,34,5,2,4,0),'#ffe58a'),
  anvil: () => p('M6 34 L72 34 C82 34 92 38 94 44 L70 48 L64 56 L60 70 L74 84 L26 84 L40 70 L36 56 L20 52 C10 48 6 42 6 34Z','#6b6476') + pn('M6 34 L72 34 C82 34 92 38 94 44 L70 48 L20 48 C10 46 6 42 6 34Z','#9a93a6') + po('M6 34 L72 34 C82 34 92 38 94 44 L70 48 L64 56 L60 70 L74 84 L26 84 L40 70 L36 56 L20 52 C10 48 6 42 6 34Z')
    + r(20,84,60,10,4,'#4a4258') + p(star(30,16,9,3,4,0),'#ffd23f') + p(star(56,8,6,2.4,4,0),'#ff9d3c') + p(star(76,20,7,2.6,4,0),'#ffd23f'),
  bones: () => bone(14,88,62,66) + bone(86,88,38,68) + bone(18,70,82,78) + scaled(0.62, 19, 6, ()=>skullArt(0, '#f3ead6', '#2a1830')),
  dummy: () => r(45,48,10,46,4,'#8a5a34') + r(12,46,76,11,5,'#8a5a34') + e(50,62,20,24,'#d9a066') + pn('M50 38 A20 24 0 0 1 50 86 A14 20 0 0 0 50 38Z','#b8844a') + e(50,62,20,24,'none')
    + c(50,62,11,'#ef5258') + c(50,62,6,'#fff') + cn(50,62,2.5,'#ef5258') + ink('M36 50 L40 52 M36 72 L40 70 M64 50 L60 52 M64 72 L60 70',2)
    + c(50,24,15,'#e2c08a') + ink('M43 20 L47 24 M47 20 L43 24 M53 20 L57 24 M57 20 L53 24 M44 31 L56 31',2.5) + p('M36 14 C40 4 60 4 64 14 C58 10 42 10 36 14Z','#d9a066'),
};

/* ---------- rendering ---------- */
const STICKER_FILTER = `<filter id="s" x="-25%" y="-25%" width="150%" height="155%" color-interpolation-filters="sRGB">
<feMorphology in="SourceAlpha" operator="dilate" radius="5.5" result="d"/>
<feGaussianBlur in="d" stdDeviation=".6" result="db"/>
<feFlood flood-color="#ffffff"/><feComposite in2="db" operator="in" result="w"/>
<feOffset in="db" dy="5" result="o"/><feGaussianBlur in="o" stdDeviation="1.5" result="ob"/>
<feFlood flood-color="#000" flood-opacity=".45"/><feComposite in2="ob" operator="in" result="sh"/>
<feMerge><feMergeNode in="sh"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
const SVG_CACHE = {};
function artSVG(name, sticker=true){
  const k = name+'|'+sticker; if(SVG_CACHE[k]) return SVG_CACHE[k];
  const fn = ART[name]; if(!fn) throw new Error('missing art '+name);
  SW = 4;
  const inner = fn();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 120 124">${sticker?`<defs>${STICKER_FILTER}</defs><g filter="url(#s)">${inner}</g>`:inner}</svg>`;
  return (SVG_CACHE[k] = svg);
}
const URL_CACHE = {};
function artURL(name, sticker=true){ const k=name+'|'+sticker; return URL_CACHE[k] || (URL_CACHE[k] = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artSVG(name, sticker))); }
/* sticker <img>; size = rendered CSS width */
function img(name, size, cls){
  return `<img class="stk ${cls||''}" src="${artURL(name)}" width="${size}" height="${Math.round(size*124/120)}" alt="" draggable="false">`;
}
/* async: get a drawable Image for canvas use (icons) */
function artImage(name, sticker=true){ return new Promise((res,rej)=>{ const im = new Image(); im.onload=()=>res(im); im.onerror=rej; im.src = artURL(name, sticker); }); }

/* ---------- block glyphs (vector, drawn straight onto the board canvas) ---------- */
const GLYPHS = {
  sword:  {d:'M50 4 L61 16 L61 60 L74 60 L74 71 L56 71 L56 92 L44 92 L44 71 L26 71 L26 60 L39 60 L39 16Z', rot:45},
  shield: {d:SHIELD},
  heal:   {d:HEART},
  coin:   {d:'M50 10 A40 40 0 1 1 49.99 10Z M50 30 A20 20 0 1 0 50.01 30Z', rule:'evenodd'},
  rainbow:{d:star(50,54,44,19)},
  venom:  {d:DROP},
  stone:  {d:'M30 20 L44 42 L32 58 L48 82 M44 42 L66 38 L76 22 M66 38 L70 60', stroke:'rgba(20,14,26,.55)', w:7},
  ice:    {d:'M50 10 L50 90 M15 30 L85 70 M15 70 L85 30 M50 10 L40 2 M50 10 L60 2 M50 90 L40 98 M50 90 L60 98', stroke:'#fff', w:9},
};
const _P2D = {};
function drawGlyph(ctx, type, x, y, size, alpha){
  const g = GLYPHS[type]; if(!g) return;
  const path = _P2D[type] || (_P2D[type] = new Path2D(g.d));
  const draw = (dy, col) => {
    ctx.save(); ctx.translate(x, y+dy); ctx.scale(size/100, size/100);
    if(g.rot){ ctx.translate(50,50); ctx.rotate(g.rot*Math.PI/180); ctx.translate(-50,-50); }
    if(g.stroke){ ctx.strokeStyle = col||g.stroke; ctx.lineWidth = g.w; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(path); }
    else { ctx.fillStyle = col; ctx.fill(path, g.rule||'nonzero'); }
    ctx.restore();
  };
  ctx.globalAlpha = alpha==null?1:alpha;
  if(type!=='stone') draw(size*0.06, 'rgba(0,0,0,.28)');
  draw(0, g.stroke ? null : 'rgba(255,255,255,.95)');
  ctx.globalAlpha = 1;
}
