/* Monsters, elites and bosses. Same kit, same light, same eyes. */
import { shape, flat, gloss, ink, rope, eye, glowEye, brow, cheek, circleD, ellD, rectD, starD, mirrorX, scaleAt, PAL, INK } from './kit.js';

const fang = (x, y, w = 5, h = 7) => shape(`M${x} ${y}L${x + w} ${y}L${x + w / 2} ${y + h}Z`, 'bone', { depth: 1, rim: 0, line: 2.5 });
const horn = (d, ramp = 'bone') => shape(d, ramp, { depth: 3, rim: 1.5 });
const crown = (x, y, w, ramp = 'gold') => {
  const h = w * 0.55;
  const d = `M${x} ${y + h}L${x} ${y + h * 0.25}L${x + w * 0.25} ${y + h * 0.55}L${x + w * 0.5} ${y}L${x + w * 0.75} ${y + h * 0.55}L${x + w} ${y + h * 0.25}L${x + w} ${y + h}Z`;
  return shape(d, ramp, { depth: 2.5, rim: 1.5 })
    + shape(circleD(x + w * 0.5, y + h * 0.62, w * 0.08), 'red', { depth: 1, rim: 0.8, line: 2.5 });
};
const wing = (d, ramp) => shape(d, ramp, { depth: 4, rim: 2 });

/* ---------- floor 1 ---------- */

function rat(withCrown) {
  const fur = ['#9b8f9f', '#655a6c', '#d2c8d6'];
  return rope('M24 82C8 84 6 66 16 62', PAL.flesh[0], 5)
    + shape(ellD(54, 70, 30, 22), fur)
    + shape(ellD(30, 30, 13, 13), fur) + shape(ellD(30, 30, 7, 7), 'flesh', { depth: 2, rim: 0, line: 0 })
    + shape(ellD(72, 30, 13, 13), fur) + shape(ellD(72, 30, 7, 7), 'flesh', { depth: 2, rim: 0, line: 0 })
    + shape('M24 50C24 32 38 24 52 24C68 24 80 34 80 50C80 60 70 70 52 70C34 70 24 62 24 50Z', fur)
    + shape(ellD(52, 58, 12, 9), ['#d9cfdc', '#a99fae', '#fff'], { depth: 2, rim: 1 })
    + shape(ellD(52, 53, 5, 4), 'pink', { depth: 1.5, rim: 1, line: 3 })
    + ink('M40 58L26 55M40 61L27 63M64 58L78 55M64 61L77 63', 2.2)
    + shape(rectD(47, 62, 10, 7, 2), 'bone', { depth: 1, rim: 0, line: 2.5 }) + ink('M52 62V69', 2)
    + eye(42, 45, 5.5) + eye(62, 45, 5.5)
    + shape(ellD(38, 88, 8, 5), fur, { depth: 2, rim: 1 }) + shape(ellD(68, 88, 8, 5), fur, { depth: 2, rim: 1 })
    + (withCrown ? crown(34, 8, 36) : '');
}

function ratking() {
  return shape('M14 92C18 62 30 54 52 54C74 54 86 62 90 92C70 98 34 98 14 92Z', 'red')
    + shape('M30 60C40 66 64 66 74 60L76 70C64 74 40 74 28 70Z', 'white', { depth: 2, rim: 1 })
    + flat(circleD(40, 67, 1.6), INK) + flat(circleD(52, 68, 1.6), INK) + flat(circleD(64, 67, 1.6), INK)
    + scaleAt(rat(true), 0.92, 4, -4);
}

function bat() {
  const fur = 'purple';
  const w = 'M48 46C34 30 16 26 4 34C12 38 12 44 10 50C18 48 22 52 22 58C28 54 34 56 36 62C40 56 46 54 50 56Z';
  return wing(w, 'violet') + mirrorX(wing(w, 'violet'))
    + shape(ellD(50, 54, 18, 19), fur)
    + horn('M36 40L34 22L46 36Z', fur) + horn('M64 40L66 22L54 36Z', fur)
    + eye(43, 50, 5.5) + eye(57, 50, 5.5)
    + ink('M44 63C47 66 53 66 56 63', 2.6) + fang(44, 63, 4, 6) + fang(52, 63, 4, 6)
    + shape(ellD(44, 74, 4, 4), fur, { depth: 1.5, rim: 1, line: 3 }) + shape(ellD(56, 74, 4, 4), fur, { depth: 1.5, rim: 1, line: 3 });
}

function slime(ramp = 'slime', ext = '') {
  return shape('M12 84C12 60 24 30 50 28C76 30 88 60 88 84C88 92 80 94 72 92C66 96 58 96 52 92C46 96 36 96 30 92C20 94 12 92 12 84Z', ramp, { depth: 6, rim: 4 })
    + gloss(30, 46, 5, 10, 30, 0.75) + gloss(38, 38, 2.5, 2.5, 0, 0.8)
    + eye(40, 60, 7) + eye(62, 60, 7)
    + ink('M44 76C48 80 54 80 58 76', 3)
    + cheek(32, 70, 5) + cheek(70, 70, 5) + ext;
}

function ogre() {
  const skin = ['#a9b56a', '#6f7a38', '#dbe5a6'];
  return shape('M10 96C10 70 26 58 50 58C74 58 90 70 90 96Z', 'leather')
    + shape(rectD(16, 74, 68, 10, 4), 'wood', { depth: 2, rim: 1 })
    + shape('M18 44C18 22 32 10 50 10C68 10 82 22 82 44C82 64 70 74 50 74C30 74 18 64 18 44Z', skin)
    + shape(ellD(16, 42, 7, 10), skin, { depth: 2, rim: 1 }) + shape(ellD(84, 42, 7, 10), skin, { depth: 2, rim: 1 })
    + brow(30, 30, 46, 36, 6) + brow(54, 36, 70, 30, 6)
    + eye(38, 40, 5, [0.1, 0.3]) + eye(62, 40, 5, [-0.1, 0.3])
    + shape(ellD(50, 50, 7, 5), skin, { depth: 2, rim: 1, line: 3 })
    + shape('M32 58C40 66 60 66 68 58C66 68 60 72 50 72C40 72 34 68 32 58Z', 'dark', { depth: 2, rim: 0, line: 3.5 })
    + shape('M34 60L38 48L42 60Z', 'bone', { depth: 1.5, rim: 1, line: 3 }) + shape('M58 60L62 48L66 60Z', 'bone', { depth: 1.5, rim: 1, line: 3 });
}

/* ---------- floor 2 ---------- */

function skull(cx, cy, k = 1, glow = '#7ef0ff') {
  const d = `M${cx - 22 * k} ${cy}C${cx - 22 * k} ${cy - 22 * k} ${cx - 10 * k} ${cy - 30 * k} ${cx} ${cy - 30 * k}C${cx + 10 * k} ${cy - 30 * k} ${cx + 22 * k} ${cy - 22 * k} ${cx + 22 * k} ${cy}C${cx + 22 * k} ${cy + 10 * k} ${cx + 16 * k} ${cy + 14 * k} ${cx + 12 * k} ${cy + 16 * k}V${cy + 24 * k}H${cx - 12 * k}V${cy + 16 * k}C${cx - 16 * k} ${cy + 14 * k} ${cx - 22 * k} ${cy + 10 * k} ${cx - 22 * k} ${cy}Z`;
  return shape(d, 'bone')
    + shape(ellD(cx - 9 * k, cy - 2 * k, 7 * k, 8 * k), 'shadow', { depth: 2, rim: 0, line: 3 })
    + shape(ellD(cx + 9 * k, cy - 2 * k, 7 * k, 8 * k), 'shadow', { depth: 2, rim: 0, line: 3 })
    + glowEye(cx - 9 * k, cy - 1 * k, 2.6 * k, glow) + glowEye(cx + 9 * k, cy - 1 * k, 2.6 * k, glow)
    + shape(`M${cx} ${cy + 6 * k}L${cx - 3.5 * k} ${cy + 11 * k}H${cx + 3.5 * k}Z`, 'shadow', { depth: 1, rim: 0, line: 2.5 })
    + ink(`M${cx - 7 * k} ${cy + 17 * k}V${cy + 23 * k}M${cx} ${cy + 17 * k}V${cy + 23 * k}M${cx + 7 * k} ${cy + 17 * k}V${cy + 23 * k}`, 2.2 * k)
    + gloss(cx - 12 * k, cy - 18 * k, 3 * k, 6 * k, 30, 0.7);
}

function skeleton() {
  return shape('M30 96L34 64H66L70 96Z', 'shadow', { depth: 3, rim: 0 })
    + shape(rectD(46, 62, 8, 32, 3), 'bone', { depth: 2, rim: 1 })
    + [70, 78, 86].map(y => shape(`M32 ${y}C40 ${y - 4} 60 ${y - 4} 68 ${y}C60 ${y + 2} 40 ${y + 2} 32 ${y}Z`, 'bone', { depth: 1.5, rim: 0.8, line: 3 })).join('')
    + shape('M76 30L84 72L80 73L72 32Z', 'steel', { depth: 1.5, rim: 1, line: 3.5 })
    + shape(rectD(70, 70, 18, 6, 3), 'rust', { depth: 1.5, rim: 1, line: 3.5 })
    + skull(48, 38, 1, '#7ef0ff');
}

function goblin() {
  const skin = ['#6fcf5a', '#3c8d34', '#bdf3a8'];
  const ear = 'M30 42L2 30L12 50L30 54Z';
  return shape('M16 96C16 76 30 66 50 66C70 66 84 76 84 96Z', 'leather')
    + shape(ear, skin) + mirrorX(shape(ear, skin))
    + shape('M26 46C26 26 36 16 50 16C64 16 74 26 74 46C74 62 64 72 50 72C36 72 26 62 26 46Z', skin)
    + brow(33, 34, 45, 40, 4.5) + brow(55, 40, 67, 34, 4.5)
    + eye(40, 45, 5.5, [0.35, 0.2], '#fff6a8') + eye(60, 45, 5.5, [0.35, 0.2], '#fff6a8')
    + shape('M47 50C44 58 56 58 53 50Z', skin, { depth: 1.5, rim: 1, line: 3 })
    + shape('M36 59C44 66 56 66 64 59C60 68 40 68 36 59Z', 'dark', { depth: 1.5, rim: 0, line: 3 })
    + fang(42, 60, 4, 5) + fang(54, 60, 4, 5)
    + shape('M26 30C30 12 70 12 74 30C62 24 38 24 26 30Z', 'red', { depth: 2, rim: 1.5 });
}

function banshee() {
  const ghost = ['#d9f0ff', '#8fb8dc', '#ffffff'];
  return shape('M18 50C18 24 32 10 50 10C68 10 82 24 82 50V88L72 80L62 92L50 80L38 92L28 80L18 88Z', ghost, { depth: 6, rim: 4 })
    + shape('M22 52C16 30 30 8 50 10C70 8 84 30 78 52C74 36 64 26 50 26C36 26 26 36 22 52Z', ['#c7d3ff', '#8090cc', '#eef1ff'], { depth: 3, rim: 2 })
    + glowEye(40, 44, 5, '#5ad1ff') + glowEye(60, 44, 5, '#5ad1ff')
    + shape(ellD(50, 62, 7, 10), 'shadow', { depth: 2, rim: 0, line: 3.5 })
    + gloss(28, 50, 3, 9, 15, 0.6);
}

function warlock() {
  const robe = ['#5a3f8f', '#36245c', '#9d84d4'];
  return shape('M14 96C18 66 30 52 50 52C70 52 82 66 86 96Z', robe)
    + shape('M44 56L50 96L56 56Z', 'gold', { depth: 2, rim: 1, line: 3 })
    + shape('M22 58C18 30 32 8 50 6C68 8 82 30 78 58C70 64 30 64 22 58Z', robe)
    + shape(ellD(50, 42, 17, 18), 'shadow', { depth: 3, rim: 0 })
    + glowEye(43, 42, 4, '#8cff6a') + glowEye(57, 42, 4, '#8cff6a')
    + shape(circleD(84, 70, 10), ['#8cff6a', '#3fa23a', '#e6ffd9'], { depth: 3, rim: 2 })
    + flat(circleD(84, 70, 16), '#8cff6a').replace('/>', ' opacity=".2"/>')
    + shape(rectD(80, 78, 8, 20, 3), 'wood', { depth: 2, rim: 1 });
}

function warden() {
  return shape('M8 98C10 70 26 58 50 58C74 58 90 70 92 98Z', 'iron')
    + shape(ellD(20, 66, 14, 10), 'iron') + shape(ellD(80, 66, 14, 10), 'iron')
    + rope('M18 74C30 84 40 80 50 88C60 80 70 84 82 74', PAL.steel[1], 4)
    + shape('M24 52C22 28 34 10 50 8C66 10 78 28 76 52C70 60 30 60 24 52Z', ['#3f8a87', '#245654', '#86d0c8'])
    + skull(50, 44, 0.78, '#7effc8')
    + shape(rectD(10, 72, 12, 16, 4), 'gold', { depth: 2, rim: 1 })
    + flat(circleD(16, 80, 9), '#ffd23f').replace('/>', ' opacity=".25"/>')
    + shape(circleD(16, 80, 4), 'gold', { depth: 1, rim: 1, line: 2.5 });
}

/* ---------- floor 3 ---------- */

function imp() {
  const skin = ['#ef4f4f', '#a82a35', '#ff9f9f'];
  const w = 'M34 50C24 36 10 36 4 44C10 46 10 52 8 56C14 54 18 58 18 62C24 60 28 62 30 66Z';
  return wing(w, 'dark') + mirrorX(wing(w, 'dark'))
    + rope('M60 80C76 88 84 80 80 70', skin[0], 4) + shape('M76 66L86 64L82 74Z', skin, { depth: 1, rim: 0, line: 3 })
    + shape(ellD(50, 76, 16, 14), skin)
    + horn('M34 32L28 14L42 26Z') + horn('M66 32L72 14L58 26Z')
    + shape(ellD(50, 46, 20, 19), skin)
    + eye(42, 44, 5.5, [0.2, 0.2], '#fff3a0') + eye(58, 44, 5.5, [-0.2, 0.2], '#fff3a0')
    + brow(35, 36, 46, 40) + brow(54, 40, 65, 36)
    + ink('M40 54C46 60 54 60 60 54', 3) + fang(43, 55, 4, 5) + fang(53, 55, 4, 5)
    + flat(circleD(82, 32, 14), '#ff9d3c').replace('/>', ' opacity=".25"/>')
    + shape('M82 20C86 26 92 30 92 36C92 42 88 46 82 46C76 46 72 42 72 36C72 30 78 28 82 20Z', 'ember', { depth: 2, rim: 1.5 });
}

function cultist() {
  const robe = ['#a8283c', '#6a1424', '#ec6b7c'];
  return shape('M12 96C16 66 30 52 50 52C70 52 84 66 88 96Z', robe)
    + shape('M22 58C18 30 32 8 50 6C68 8 82 30 78 58C70 64 30 64 22 58Z', robe)
    + shape(ellD(50, 42, 18, 19), 'shadow', { depth: 3, rim: 0 })
    + shape('M36 32C36 26 64 26 64 32V48C64 58 56 62 50 62C44 62 36 58 36 48Z', 'bone')
    + shape(ellD(44, 40, 3.6, 4.5), 'shadow', { depth: 1, rim: 0, line: 2.5 }) + shape(ellD(56, 40, 3.6, 4.5), 'shadow', { depth: 1, rim: 0, line: 2.5 })
    + ink('M50 46V54M46 50H54', 2.5)
    + rope('M38 62C44 74 56 74 62 62', PAL.gold[1], 3)
    + shape(starD(50, 78, 7, 3, 5), 'gold', { depth: 1.5, rim: 1, line: 3 });
}

function gargoyle() {
  const st = ['#9a98a8', '#626072', '#d2d0dc'];
  const w = 'M30 44C16 22 2 26 2 40C8 40 8 48 6 54C12 52 16 56 16 62C22 58 28 60 30 66Z';
  return wing(w, st) + mirrorX(wing(w, st))
    + shape('M22 94C22 70 34 60 50 60C66 60 78 70 78 94Z', st)
    + shape(ellD(34, 90, 10, 7), st, { depth: 2, rim: 1 }) + shape(ellD(66, 90, 10, 7), st, { depth: 2, rim: 1 })
    + horn('M32 28L22 6L42 22Z', st) + horn('M68 28L78 6L58 22Z', st)
    + shape('M26 44C26 26 36 18 50 18C64 18 74 26 74 44C74 58 64 66 50 66C36 66 26 58 26 44Z', st)
    + brow(32, 34, 46, 40, 5) + brow(54, 40, 68, 34, 5)
    + glowEye(41, 43, 4, '#ff9d3c') + glowEye(59, 43, 4, '#ff9d3c')
    + shape('M38 54H62L58 60H42Z', 'shadow', { depth: 1, rim: 0, line: 3 }) + fang(42, 54, 4, 5) + fang(54, 54, 4, 5)
    + ink('M60 72L64 78L60 84', 2);
}

function darkknight() {
  const arm = ['#4a4458', '#2a2533', '#857d99'];
  return shape('M16 98C10 76 20 60 50 60C80 60 90 76 84 98Z', 'red')
    + shape('M12 98C12 76 28 64 50 64C72 64 88 76 88 98Z', arm)
    + shape(ellD(22, 70, 14, 10), arm) + shape(ellD(78, 70, 14, 10), arm)
    + horn('M28 30L12 10L30 18Z', 'bone') + horn('M72 30L88 10L70 18Z', 'bone')
    + shape('M28 42C28 20 38 10 50 10C62 10 72 20 72 42V58C72 64 66 68 60 68H40C34 68 28 64 28 58Z', arm)
    + shape('M32 38H68L64 46H36Z', 'shadow', { depth: 1.5, rim: 0, line: 3 })
    + glowEye(42, 42, 3.4, '#ff4d5a') + glowEye(58, 42, 3.4, '#ff4d5a')
    + ink('M50 50V64M44 54V62M56 54V62', 2.5)
    + gloss(38, 22, 3, 7, 30, 0.45);
}

function dragon() {
  const sc = ['#e2453f', '#9a2229', '#ff9a8e'];
  return shape('M20 98C24 74 34 62 50 60C66 62 76 74 80 98Z', sc)
    + [70, 80, 90].map(y => shape(`M38 ${y}C44 ${y - 4} 56 ${y - 4} 62 ${y}C56 ${y + 4} 44 ${y + 4} 38 ${y}Z`, 'gold', { depth: 1.5, rim: 1, line: 3 })).join('')
    + horn('M30 26L10 2L36 16Z') + horn('M70 26L90 2L64 16Z')
    + shape('M16 40L4 34L14 50Z', sc, { depth: 2, rim: 1 }) + shape('M84 40L96 34L86 50Z', sc, { depth: 2, rim: 1 })
    + shape('M18 44C18 20 34 10 50 10C66 10 82 20 82 44C82 52 78 58 74 62L72 72C66 78 34 78 28 72L26 62C22 58 18 52 18 44Z', sc)
    + shape('M30 54C36 47 64 47 70 54C73 62 68 72 60 74H40C32 72 27 62 30 54Z', ['#f26d5b', '#b23a35', '#ffb3a6'], { depth: 2.5, rim: 1.5 })
    + flat(ellD(42, 56, 2.2, 3), INK) + flat(ellD(58, 56, 2.2, 3), INK)
    + brow(26, 30, 44, 38, 6) + brow(56, 38, 74, 30, 6)
    + eye(36, 40, 6, [0.25, 0.25], '#ffe066') + eye(64, 40, 6, [-0.25, 0.25], '#ffe066')
    + ink('M38 66C44 70 56 70 62 66', 3) + fang(40, 67, 4, 6) + fang(56, 67, 4, 6)
    + gloss(32, 22, 4, 9, 35, 0.5);
}

/* ---------- floor 4 ---------- */

function wraith() {
  const ice = ['#b9ecff', '#5ea6d6', '#ffffff'];
  return shape('M18 48C18 22 32 8 50 8C68 8 82 22 82 48V84L74 94L68 80L60 96L52 80L44 96L36 80L28 94L18 84Z', ice, { depth: 6, rim: 3 })
    + shape(ellD(50, 44, 19, 20), 'navy', { depth: 3, rim: 0 })
    + glowEye(42, 44, 4.5, '#6ff7ff') + glowEye(58, 44, 4.5, '#6ff7ff')
    + ink('M44 56C48 58 52 58 56 56', 2.5)
    + shape('M8 60L18 54L22 70Z', ice, { depth: 2, rim: 1 }) + shape('M92 60L82 54L78 70Z', ice, { depth: 2, rim: 1 });
}

function yeti() {
  const fur = ['#f3f6fb', '#b7c3d6', '#ffffff'];
  const face = ['#7fa8e0', '#4d72ad', '#c2dbff'];
  return shape('M10 96C8 70 24 54 50 54C76 54 92 70 90 96Z', fur, { depth: 6 })
    + shape(ellD(14, 82, 10, 13), fur) + shape(ellD(86, 82, 10, 13), fur)
    + horn('M26 26L18 8L34 18Z', 'bone') + horn('M74 26L82 8L66 18Z', 'bone')
    + shape('M18 44C18 22 32 12 50 12C68 12 82 22 82 44C82 64 68 74 50 74C32 74 18 64 18 44Z', fur, { depth: 6 })
    + shape('M30 40C30 30 40 26 50 30C60 26 70 30 70 40V54C70 64 62 70 50 70C38 70 30 64 30 54Z', face)
    + brow(32, 36, 46, 40, 5) + brow(54, 40, 68, 36, 5)
    + eye(41, 45, 5) + eye(59, 45, 5)
    + shape('M38 56C44 64 56 64 62 56C60 66 40 66 38 56Z', 'dark', { depth: 1, rim: 0, line: 3 })
    + fang(41, 56, 5, 7) + fang(54, 56, 5, 7);
}

function frostspider() {
  const body = ['#7cc7f0', '#3a7fb4', '#c8ecff'];
  const leg = d => rope(d, body[1], 5);
  const legs = leg('M38 62C24 50 14 54 8 70') + leg('M36 70C22 66 12 74 10 88') + leg('M40 76C30 80 24 90 26 98');
  return legs + mirrorX(legs)
    + shape(ellD(50, 44, 22, 20), body)
    + shape('M38 30L44 14L50 28L56 12L62 30Z', 'ice', { depth: 2, rim: 1.5 })
    + shape(ellD(50, 70, 18, 15), body)
    + eye(42, 66, 5) + eye(58, 66, 5) + eye(36, 58, 3) + eye(64, 58, 3)
    + fang(44, 78, 4, 6) + fang(52, 78, 4, 6)
    + gloss(38, 38, 3, 6, 30, 0.6);
}

function lich() {
  const robe = ['#4f3a86', '#2e2052', '#9580d1'];
  return shape('M12 98C14 70 28 56 50 56C72 56 86 70 88 98Z', robe)
    + shape('M38 58L50 72L62 58Z', 'gold', { depth: 2, rim: 1, line: 3 })
    + shape(rectD(80, 34, 7, 64, 3), 'wood', { depth: 2, rim: 1 })
    + flat(circleD(84, 30, 15), '#8cff6a').replace('/>', ' opacity=".22"/>')
    + shape(circleD(84, 30, 9), ['#8cff6a', '#3fa23a', '#e6ffd9'], { depth: 3, rim: 2 })
    + skull(46, 42, 0.86, '#8cff6a')
    + crown(30, 4, 32, 'gold');
}

function frostqueen() {
  const skin = ['#d6ecff', '#8fb3d9', '#ffffff'];
  const hair = ['#f4fbff', '#a9c6e0', '#ffffff'];
  return shape('M10 98C10 74 26 62 50 62C74 62 90 74 90 98Z', 'blue')
    + shape('M16 70L30 58L50 70L70 58L84 70L70 76L50 72L30 76Z', 'ice', { depth: 2.5, rim: 1.5 })
    + shape('M18 70C12 40 24 14 50 14C76 14 88 40 82 70C76 62 72 50 72 40H28C28 50 24 62 18 70Z', hair)
    + shape(ellD(50, 44, 18, 20), skin)
    + eye(42, 44, 5, [0.1, 0.2], '#fff') + eye(58, 44, 5, [-0.1, 0.2], '#fff')
    + ink('M36 37L46 39M54 39L64 37', 3)
    + ink('M45 56C48 58 52 58 55 56', 2.5)
    + cheek(38, 52, 3.5) + cheek(62, 52, 3.5)
    + shape('M28 26L34 6L40 22L50 0L60 22L66 6L72 26C60 22 40 22 28 26Z', 'ice', { depth: 3, rim: 2 })
    + shape(starD(50, 18, 4, 2, 4), 'white', { depth: 1, rim: 0, line: 2 });
}

/* ---------- floor 5 ---------- */

function voideye() {
  const flesh = ['#7b4bc4', '#4a2788', '#c49cff'];
  const t = d => rope(d, flesh[1], 6);
  return t('M30 70C22 82 30 92 20 98') + t('M44 76C42 88 50 92 46 100') + t('M58 76C62 88 54 94 60 100') + t('M70 70C80 80 72 92 82 96')
    + shape(circleD(50, 46, 34), flesh)
    + shape(ellD(50, 46, 24, 22), 'white', { depth: 3, rim: 1.5 })
    + shape(circleD(50, 47, 13), ['#ff4fa0', '#b5246a', '#ffb3d6'], { depth: 2.5, rim: 1.5 })
    + flat(ellD(50, 47, 4.5, 9), INK) + gloss(44, 41, 3, 3, 0, 0.9)
    + gloss(30, 26, 4, 8, 40, 0.5);
}

function demon() {
  const skin = ['#c43a5a', '#82203b', '#f08aa0'];
  return shape('M8 98C8 72 26 58 50 58C74 58 92 72 92 98Z', skin)
    + ink('M36 76C44 72 56 72 64 76M50 70V92', 2.5)
    + horn('M28 30C14 26 8 12 12 2C18 12 26 16 36 20Z', 'dark') + horn('M72 30C86 26 92 12 88 2C82 12 74 16 64 20Z', 'dark')
    + shape('M24 44C24 24 36 14 50 14C64 14 76 24 76 44C76 62 64 72 50 72C36 72 24 62 24 44Z', skin)
    + brow(31, 34, 46, 41, 5.5) + brow(54, 41, 69, 34, 5.5)
    + glowEye(40, 44, 4.2, '#ffd23f') + glowEye(60, 44, 4.2, '#ffd23f')
    + shape('M36 56C44 62 56 62 64 56C62 66 38 66 36 56Z', 'dark', { depth: 1, rim: 0, line: 3 })
    + fang(39, 56, 5, 6) + fang(56, 56, 5, 6);
}

function shade() {
  const sm = ['#3a2f52', '#1d1630', '#6d5a96'];
  return shape('M16 60C12 30 30 10 50 10C70 10 88 30 84 60C90 70 84 80 78 78C80 90 68 96 62 88C58 98 42 98 38 88C32 96 20 90 22 78C16 80 10 70 16 60Z', sm, { depth: 6, rim: 3 })
    + eye(40, 44, 6.5, [0, 0], '#f2ecff') + eye(60, 44, 6.5, [0, 0], '#f2ecff')
    + shape('M38 62C44 56 56 56 62 62C56 70 44 70 38 62Z', 'shadow', { depth: 1, rim: 0, line: 3 })
    + gloss(30, 30, 3, 8, 30, 0.35);
}

function horror() {
  const fl = ['#5d3a8f', '#36205c', '#a786d6'];
  const t = d => rope(d, fl[0], 7);
  return t('M24 70C10 76 6 90 14 98') + t('M76 70C90 76 94 90 86 98') + t('M38 80C34 92 40 96 36 100') + t('M62 80C66 92 60 96 64 100')
    + shape('M14 54C14 26 30 10 50 10C70 10 86 26 86 54C86 74 70 86 50 86C30 86 14 74 14 54Z', fl)
    + shape('M30 60C36 52 64 52 70 60C66 76 34 76 30 60Z', ['#8a1630', '#4f0a1a', '#d8475f'], { depth: 2, rim: 1 })
    + fang(34, 58, 5, 7) + fang(42, 56, 5, 8) + fang(52, 56, 5, 8) + fang(60, 58, 5, 7)
    + eye(36, 34, 6) + eye(56, 26, 7.5) + eye(70, 40, 4.5) + eye(28, 46, 3.5) + eye(48, 42, 4)
    + gloss(26, 24, 3, 7, 30, 0.4);
}

function demonlord() {
  const skin = ['#d4384a', '#8a1a2c', '#ff8f9a'];
  return shape('M6 98C6 70 26 56 50 56C74 56 94 70 94 98Z', 'dark')
    + shape('M14 70L30 60L50 70L70 60L86 70L80 80L50 74L20 80Z', 'gold', { depth: 2.5, rim: 1.5 })
    + shape(circleD(50, 76, 5), 'red', { depth: 1.5, rim: 1, line: 3 })
    + horn('M26 34C6 30 0 10 6 -2C12 12 22 18 36 22Z', 'shadow') + horn('M74 34C94 30 100 10 94 -2C88 12 78 18 64 22Z', 'shadow')
    + shape('M22 46C22 24 34 12 50 12C66 12 78 24 78 46C78 64 66 74 50 74C34 74 22 64 22 46Z', skin)
    + crown(32, 0, 36, 'gold')
    + brow(28, 36, 46, 43, 6) + brow(54, 43, 72, 36, 6)
    + glowEye(39, 46, 5, '#ffd23f') + glowEye(61, 46, 5, '#ffd23f')
    + shape('M34 58C44 66 56 66 66 58C64 70 36 70 34 58Z', 'shadow', { depth: 1, rim: 0, line: 3 })
    + fang(37, 58, 5, 7) + fang(58, 58, 5, 7)
    + gloss(32, 26, 3, 7, 35, 0.45);
}

export const MONSTER_ART = {
  m_rat: () => rat(false), m_bat: bat, m_slime: () => slime(), m_ogre: ogre, m_ratking: ratking,
  m_skeleton: skeleton, m_goblin: goblin, m_banshee: banshee, m_warlock: warlock, m_warden: warden,
  m_imp: imp, m_cultist: cultist, m_gargoyle: gargoyle, m_darkknight: darkknight, m_dragon: dragon,
  m_wraith: wraith, m_yeti: yeti, m_frostspider: frostspider, m_lich: lich, m_frostqueen: frostqueen,
  m_voideye: voideye, m_demon: demon, m_shade: shade, m_horror: horror, m_demonlord: demonlord,
};
