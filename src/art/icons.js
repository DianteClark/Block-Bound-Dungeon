/* Block tiles, intents, map rooms, specials, events and interface icons. */
import { shape, flat, gloss, ink, rope, eye, glowEye, circleD, ellD, rectD, starD, rotAt, scaleAt, PAL, INK } from './kit.js';
import { dagger, heater, coin } from './items.js';

const sm = { depth: 2.5, rim: 1.5 };
const tiny = { depth: 1.5, rim: 1, line: 3 };
const glyph = (d, line = 3.5) => `<path d="${d}" fill="#fff" stroke="${INK}" stroke-width="${line}" stroke-linejoin="round" stroke-linecap="round"/>`;

/* ---------- glyph paths (white symbols on block tiles) ---------- */
const G = {
  sword: 'M66 22L78 22L78 34L46 66L52 72L46 78L40 72L32 80L24 72L32 64L26 58L32 52L38 58Z',
  shield: 'M50 20L76 28C76 52 68 68 50 80C32 68 24 52 24 28Z',
  heart: 'M50 78C30 66 20 54 21 42C22 30 38 26 50 40C62 26 78 30 79 42C80 54 70 66 50 78Z',
  coin: circleD(50, 50, 24),
  star: starD(50, 52, 28, 12),
};

/* ---------- block tiles (drawn on the grid, so no sticker border) ---------- */
function tile(ramp, inner) {
  return shape(rectD(4, 4, 92, 92, 20), ramp, { depth: 9, rim: 6, line: 4, gloss: 0.6 })
    + gloss(24, 20, 9, 4, -10, 0.45) + inner;
}
const TILES = {
  b_sword: () => tile('red', glyph(G.sword)),
  b_shield: () => tile('blue', glyph(G.shield)),
  b_heart: () => tile('green', glyph(G.heart)),
  b_coin: () => tile('gold', glyph(G.coin) + flat(circleD(50, 50, 13), 'none', 3)),
  b_rainbow: () => tile(['#b06cff', '#6c35b8', '#ffd6ff'],
    glyph(G.star)),
  b_rubble: () => shape(rectD(4, 4, 92, 92, 20), 'stone', { depth: 9, rim: 4, line: 4 })
    + ink('M22 30L40 44L36 60L52 70M60 22L56 40L72 50L70 72', 3.5) + ink('M30 78L40 74', 3),
};

/* ---------- intents ---------- */
const INTENT = {
  i_atk: () => rotAt(shape('M50 4L60 16V62H40V16Z', 'steel', sm) + shape(rectD(26, 60, 48, 10, 5), 'gold', sm)
    + shape(rectD(44, 70, 12, 18, 3), 'red', tiny) + shape(circleD(50, 92, 6), 'gold', tiny), 40),
  i_multi: () => [18, 42, 66].map((x, k) => shape(`M${x} 14C${x + 18} 34 ${x + 22} 60 ${x + 10} 88C${x + 8} 62 ${x + 2} 36 ${x - 6} 18Z`, 'red', sm)).join(''),
  i_drain: () => shape('M50 6C62 30 82 46 82 66C82 84 68 96 50 96C32 96 18 84 18 66C18 46 38 30 50 6Z', 'red', { depth: 5, rim: 2.5 })
    + shape('M36 56L42 72L48 56Z', 'bone', tiny) + shape('M52 56L58 72L64 56Z', 'bone', tiny) + gloss(32, 66, 3, 9, 15, 0.6),
  i_armor: () => shape('M22 50C22 24 34 10 50 10C66 10 78 24 78 50V78C78 86 72 90 64 90H36C28 90 22 86 22 78Z', 'steel', { depth: 5, rim: 2.5 })
    + shape(rectD(28, 44, 44, 12, 6), 'dark', { depth: 1.5, rim: 0, line: 3 }) + ink('M50 14V40M50 60V86', 3)
    + gloss(32, 26, 3, 8, 25, 0.7),
  i_heal: () => shape('M38 10H62V38H90V62H62V90H38V62H10V38H38Z', 'green', { depth: 5, rim: 2.5 }) + gloss(28, 44, 3, 6, 0, 0.6),
  i_rubble: () => shape('M10 88L18 62L38 56L46 70L42 88Z', 'stone', sm) + shape('M40 88L46 58L64 46L82 58L90 88Z', 'stone', sm)
    + shape('M28 58L34 34L54 26L64 44L46 58Z', ['#a39cae', '#6d677a', '#d6d0de'], sm) + ink('M58 64L66 74M24 70L32 76', 2.5),
  i_rage: () => shape('M50 4C58 22 82 30 82 58C82 80 68 94 50 94C32 94 18 80 18 58C18 40 30 32 34 18C40 28 42 32 46 34C48 22 46 14 50 4Z', 'red', { depth: 5, rim: 2.5 })
    + ink('M34 52L46 58M66 52L54 58', 4.5) + glowEye(41, 64, 3.6, '#ffd23f') + glowEye(59, 64, 3.6, '#ffd23f') + ink('M42 80C46 76 54 76 58 80', 3.5),
  i_sap: () => shape('M58 6L22 54H46L34 94L80 40H54L66 6Z', 'violet', { depth: 5, rim: 2.5 }) + ink('M44 38L54 48L48 56', 3),
  i_gnaw: () => shape(rectD(14, 14, 72, 72, 16), 'blue', { depth: 5, rim: 2.5 })
    + shape('M62 14C62 26 70 30 86 30V50C74 52 66 46 60 34C56 26 56 20 58 14Z', 'shadow', { depth: 0, rim: 0, line: 0 })
    + shape(rectD(60, 40, 10, 14, 3), 'bone', tiny) + shape(rectD(70, 38, 10, 14, 3), 'bone', tiny),
  i_hex: () => shape(starD(50, 50, 44, 20, 6), 'purple', { depth: 5, rim: 2.5 })
    + shape(ellD(50, 50, 18, 12), 'white', tiny) + shape(circleD(50, 50, 7), ['#8cff6a', '#3fa23a', '#e6ffd9'], { depth: 1.5, rim: 0, line: 2.5 }) + flat(ellD(50, 50, 2.2, 5), INK),
  i_breath: () => shape('M10 70C22 64 30 50 46 50C38 40 42 24 56 14C54 26 62 32 72 30C68 40 80 44 92 40C86 60 74 82 50 88C32 92 16 84 10 70Z', 'ember', { depth: 5, rim: 2.5 })
    + shape('M30 74C38 68 44 60 56 60C52 52 56 44 64 40C64 50 72 52 80 52C74 66 64 78 50 80C42 82 34 80 30 74Z', 'gold', sm),
  i_frost: () => [0, 60, 120].map(a => rotAt(rope('M50 8V92M50 22L40 14M50 22L60 14M50 78L40 86M50 78L60 86', PAL.ice[0], 6), a)).join('')
    + shape(circleD(50, 50, 9), 'ice', tiny),
  i_flip: () => rope('M24 44C26 24 42 14 58 16C70 18 78 26 80 36', PAL.violet[0], 8) + shape('M70 30L90 30L82 50Z', 'violet', tiny)
    + rope('M76 56C74 76 58 86 42 84C30 82 22 74 20 64', PAL.violet[0], 8) + shape('M30 70L10 70L18 50Z', 'violet', tiny),
};

/* ---------- map rooms ---------- */
const swordD = 'M50 4L58 14V60H42V14Z';
function broadsword(rot) {
  return rotAt(shape(swordD, 'steel', sm) + shape(rectD(28, 58, 44, 9, 4.5), 'gold', sm)
    + shape(rectD(45, 66, 10, 18, 3), 'wood', tiny) + shape(circleD(50, 88, 5.5), 'gold', tiny), rot);
}
const ROOM = {
  room_combat: () => broadsword(-40) + broadsword(40),
  room_elite: () => shape('M16 34L6 6L32 22Z', 'bone', sm) + shape('M84 34L94 6L68 22Z', 'bone', sm)
    + shape('M22 50C22 28 34 16 50 16C66 16 78 28 78 50C78 62 72 68 66 70V84H34V70C28 68 22 62 22 50Z', 'red', { depth: 5, rim: 2.5 })
    + shape(ellD(39, 48, 8, 9), 'shadow', tiny) + shape(ellD(61, 48, 8, 9), 'shadow', tiny)
    + glowEye(39, 49, 3, '#ffd23f') + glowEye(61, 49, 3, '#ffd23f') + ink('M42 76V84M50 76V84M58 76V84', 2.5),
  room_boss: () => shape('M14 40L22 10L36 28L50 4L64 28L78 10L86 40Z', 'gold', sm)
    + shape('M18 56C18 38 32 30 50 30C68 30 82 38 82 56C82 70 74 78 66 80V94H34V80C26 78 18 70 18 56Z', 'bone', { depth: 5, rim: 2.5 })
    + shape(ellD(38, 56, 9, 10), 'shadow', tiny) + shape(ellD(62, 56, 9, 10), 'shadow', tiny)
    + glowEye(38, 57, 3.5, '#ff4d5a') + glowEye(62, 57, 3.5, '#ff4d5a') + ink('M42 84V94M50 84V94M58 84V94', 2.5)
    + shape(circleD(50, 22, 5), 'red', tiny),
  room_rest: () => rotAt(shape(rectD(14, 72, 72, 12, 6), 'wood', sm), 18, 50, 78) + rotAt(shape(rectD(14, 72, 72, 12, 6), 'wood', sm), -18, 50, 78)
    + shape('M50 6C58 24 80 32 80 56C80 74 66 84 50 84C34 84 20 74 20 56C20 42 30 34 34 22C40 32 42 36 46 38C48 26 46 18 50 6Z', 'ember', { depth: 5, rim: 2.5 })
    + shape('M50 38C58 50 66 56 64 68C62 78 56 82 50 82C44 82 36 76 36 66C36 56 46 52 50 38Z', 'gold', sm),
  room_shop: () => shape('M22 40C22 30 30 26 36 26H64C70 26 78 30 78 40L84 84C84 90 80 94 74 94H26C20 94 16 90 16 84Z', 'leather', { depth: 5, rim: 2.5 })
    + rope('M34 26C34 12 66 12 66 26', PAL.leather[1], 5)
    + scaleAt(coin('gold', flat(circleD(50, 50, 8), PAL.gold[1])), 0.42, 29, 46),
  room_treasure: () => shape(rectD(10, 44, 80, 46, 8), 'wood', { depth: 5, rim: 2.5 })
    + shape('M10 50C10 26 28 14 50 14C72 14 90 26 90 50Z', ['#c98a4b', '#8a5428', '#efc08e'], { depth: 5, rim: 2.5 })
    + shape(rectD(10, 44, 80, 10, 3), 'gold', tiny) + shape(rectD(42, 40, 16, 22, 4), 'gold', sm)
    + flat(circleD(50, 52, 3), INK) + ink('M50 52V58', 2.5),
  room_event: () => shape(rectD(16, 10, 68, 80, 10), ['#f1e6cd', '#c3b08a', '#fff'], { depth: 5, rim: 2.5 })
    + shape(ellD(16, 20, 8, 12), 'bone', tiny) + shape(ellD(84, 80, 8, 12), 'bone', tiny)
    + ink('M38 38C38 26 62 26 62 38C62 48 50 48 50 60', 8) + flat(circleD(50, 74, 5), INK),
};

/* ---------- hero specials ---------- */
const SPECIAL = {
  s_bulwark: () => scaleAt(heater('blue', 'white'), 0.86, 7, 6) + shape(starD(76, 20, 12, 5), 'gold', tiny),
  s_shadowstep: () => shape('M10 70C20 56 40 60 50 50C40 70 22 82 10 70Z', 'purple', sm)
    + shape('M18 86C30 76 46 80 56 70C48 88 30 96 18 86Z', 'violet', sm)
    + dagger(10, -6, 35, 'steel'),
  s_meteor: () => rope('M6 6L44 44', PAL.ember[0], 12) + rope('M20 4L50 34', PAL.gold[0], 6) + rope('M4 22L34 50', PAL.gold[0], 6)
    + shape(circleD(62, 62, 28), ['#7a5d4f', '#4a3329', '#b8978a'], { depth: 6, rim: 3 })
    + shape(circleD(54, 54, 6), ['#5a4339', '#352119', '#8d7266'], { depth: 2, rim: 0, line: 3 })
    + shape(circleD(72, 70, 4.5), ['#5a4339', '#352119', '#8d7266'], { depth: 2, rim: 0, line: 3 }),
};

/* ---------- events and their options ---------- */
const EVENT = {
  e_shrine: () => shape('M14 94V78H86V94Z', 'stone', sm) + shape('M22 78V44H78V78Z', ['#9a92a8', '#5f586c', '#cfc8da'], { depth: 5, rim: 2.5 })
    + shape('M16 44L50 26L84 44Z', 'stone', sm) + shape('M50 50C56 60 62 64 62 70C62 76 56 80 50 80C44 80 38 76 38 70C38 64 44 60 50 50Z', 'red', tiny),
  e_pool: () => shape(ellD(50, 64, 44, 26), 'stone', { depth: 5, rim: 2.5 })
    + shape(ellD(50, 62, 34, 17), ['#2b3a6b', '#151d3c', '#4f63a6'], { depth: -3, rim: 0, line: 3.5 })
    + [[36, 60], [54, 56], [62, 66], [44, 68]].map(([x, y]) => shape(ellD(x, y, 5, 3), 'gold', { depth: 1, rim: 0.6, line: 2.5 })).join('')
    + glowEye(68, 50, 3, '#ffd23f') + glowEye(76, 52, 2.4, '#ffd23f'),
  e_smith: () => shape('M14 40H86C86 50 78 54 68 54V66H76V80H24V66H32V54C22 54 14 50 14 40Z', 'iron', { depth: 5, rim: 2.5 })
    + rotAt(shape(rectD(46, 4, 8, 38, 3), 'wood', tiny) + shape(rectD(32, 0, 36, 14, 4), 'steel', sm), -30, 50, 30)
    + shape(starD(80, 30, 8, 3, 4), 'gold', tiny) + shape(starD(20, 28, 6, 2.5, 4), 'gold', tiny),
  e_gambler: () => rotAt(shape(rectD(10, 30, 46, 46, 10), 'white', { depth: 5, rim: 2.5 })
      + [[22, 42], [44, 64], [33, 53]].map(([x, y]) => flat(circleD(x, y, 4), INK)).join(''), -12)
    + rotAt(shape(rectD(46, 26, 44, 44, 10), 'red', { depth: 5, rim: 2.5 })
      + [[58, 38], [78, 38], [58, 58], [78, 58]].map(([x, y]) => flat(circleD(x, y, 4), '#fff')).join(''), 14)
    + scaleAt(coin('gold'), 0.3, 56, 66),
  e_chest: () => shape(rectD(10, 56, 80, 36, 8), 'wood', { depth: 5, rim: 2.5 })
    + shape(rectD(14, 40, 72, 20, 6), 'shadow', { depth: 2, rim: 0, line: 3.5 })
    + [22, 36, 50, 64].map(x => shape(`M${x} 41H${x + 10}L${x + 5} 51Z`, 'bone', { depth: 1, rim: 0, line: 2.5 })).join('')
    + [29, 43, 57].map(x => shape(`M${x} 59H${x + 10}L${x + 5} 50Z`, 'bone', { depth: 1, rim: 0, line: 2.5 })).join('')
    + shape('M10 42C10 22 28 10 50 10C72 10 90 22 90 42Z', ['#c98a4b', '#8a5428', '#efc08e'], { depth: 5, rim: 2.5 })
    + eye(38, 28, 5, [0.3, 0.2], '#fff6a8') + eye(62, 28, 5, [0.3, 0.2], '#fff6a8')
    + shape(rectD(10, 70, 80, 8, 3), 'gold', tiny),
  e_fountain: () => shape(ellD(50, 80, 42, 14), 'stone', { depth: 4, rim: 2 })
    + shape(ellD(50, 78, 32, 8), 'ice', { depth: -2, rim: 0, line: 3 })
    + shape(rectD(42, 38, 16, 40, 4), 'stone', sm) + shape(ellD(50, 38, 22, 7), 'stone', sm)
    + rope('M50 30C40 16 30 22 28 34', PAL.ice[0], 5) + rope('M50 30C60 16 70 22 72 34', PAL.ice[0], 5)
    + shape(circleD(50, 26, 6), 'ice', tiny),
};
const OPTION = {
  o_blood: () => rotAt(shape('M50 6L58 18V56H42V18Z', 'steel', sm) + shape(rectD(32, 54, 36, 9, 4), 'dark', sm) + shape(rectD(45, 62, 10, 18, 3), 'leather', tiny), -30, 40, 40)
    + shape('M70 54C76 64 84 70 84 80C84 88 78 94 70 94C62 94 56 88 56 80C56 70 64 64 70 54Z', 'red', sm),
  o_pray: () => shape(rectD(34, 38, 32, 54, 8), 'bone', { depth: 5, rim: 2.5 })
    + rope('M50 38V30', INK, 2) + shape('M50 6C56 16 60 20 60 26C60 32 56 34 50 34C44 34 40 32 40 26C40 20 44 16 50 6Z', 'gold', tiny),
  o_reach: () => shape('M30 94V56L22 34C20 28 28 24 32 30L38 46V18C38 12 46 12 46 18V44V12C46 6 54 6 54 12V44V16C54 10 62 10 62 16V46V26C62 20 70 20 70 26V64C70 82 62 94 50 94Z', 'skin', { depth: 5, rim: 2.5 }),
  o_leave: () => shape(rectD(20, 6, 52, 88, 8), 'stone', sm)
    + shape(rectD(28, 14, 36, 80, 4), 'shadow', { depth: 2, rim: 0, line: 3 })
    + shape('M28 14L54 22V92L28 94Z', 'wood', sm) + shape(circleD(48, 58, 3.5), 'gold', tiny)
    + rope('M68 56H92', PAL.green[0], 6) + shape('M84 44L98 56L84 68Z', 'green', tiny),
  o_hammer: () => rotAt(shape(rectD(45, 30, 10, 64, 4), 'wood', sm) + shape(rectD(22, 8, 56, 26, 6), 'steel', { depth: 5, rim: 2.5 })
    + shape(rectD(16, 12, 8, 18, 3), 'iron', tiny), -30),
  o_armor: () => shape('M22 18L40 10C44 18 56 18 60 10L78 18L84 40L72 44V88C60 94 40 94 28 88V44L16 40Z', 'steel', { depth: 5, rim: 2.5 })
    + ink('M50 22V88M36 40C44 46 56 46 64 40', 3) + gloss(34, 30, 3, 8, 20, 0.6),
  o_dice: () => rotAt(shape(rectD(14, 14, 72, 72, 14), 'white', { depth: 6, rim: 3 })
    + [[32, 32], [68, 32], [50, 50], [32, 68], [68, 68]].map(([x, y]) => flat(circleD(x, y, 6), INK)).join(''), 10),
  o_open: () => shape(rectD(10, 52, 80, 40, 8), 'wood', { depth: 5, rim: 2.5 })
    + shape('M10 52L18 18C30 12 70 12 82 18L90 52Z', ['#c98a4b', '#8a5428', '#efc08e'], sm)
    + [[30, 50], [44, 46], [58, 48], [70, 52], [38, 56], [62, 56]].map(([x, y]) => shape(circleD(x, y, 7), 'gold', { depth: 1.5, rim: 1, line: 2.5 })).join('')
    + shape(rectD(10, 58, 80, 8, 3), 'gold', tiny),
  o_drink: () => shape('M22 14H78C78 40 66 56 50 58C34 56 22 40 22 14Z', 'gold', { depth: 5, rim: 2.5 })
    + shape('M27 20H73C72 32 66 40 50 42C34 40 28 32 27 20Z', 'ice', { depth: 2, rim: 1, line: 0 })
    + shape(rectD(44, 56, 12, 24, 3), 'gold', sm) + shape(ellD(50, 86, 22, 7), 'gold', sm),
  o_flask: () => shape('M30 30C30 18 40 14 50 14C60 14 70 18 70 30V80C70 88 64 94 50 94C36 94 30 88 30 80Z', 'leather', { depth: 5, rim: 2.5 })
    + shape(rectD(42, 4, 16, 12, 4), 'wood', tiny) + rope('M30 40C40 46 60 46 70 40', PAL.gold[1], 3)
    + shape('M50 56C54 62 58 66 58 70C58 74 54 78 50 78C46 78 42 74 42 70C42 66 46 62 50 56Z', 'ice', tiny),
};

/* ---------- interface ---------- */
const UI = {
  ui_coin: () => coin('gold', flat(circleD(50, 50, 9), PAL.gold[1])),
  ui_heart: () => shape('M50 90C22 72 8 54 10 36C12 20 32 12 50 30C68 12 88 20 90 36C92 54 78 72 50 90Z', 'red', { depth: 6, rim: 3 }) + gloss(28, 34, 5, 9, 35, 0.7),
  ui_shield: () => shape('M50 6L88 18C88 56 76 80 50 94C24 80 12 56 12 18Z', 'blue', { depth: 6, rim: 3 }) + gloss(28, 28, 4, 10, 20, 0.6),
  ui_charge: () => shape(starD(50, 52, 46, 20, 4, -90), 'gold', { depth: 5, rim: 2.5 }) + shape(starD(50, 52, 18, 8, 4, -45), 'white', tiny),
  ui_gear: () => shape(starD(50, 50, 44, 34, 8, -90 + 22.5), 'stone', { depth: 5, rim: 2.5 })
    + shape(circleD(50, 50, 14), 'dark', { depth: -2, rim: 0, line: 3.5 }),
  ui_bag: () => shape('M24 36C24 28 32 26 38 30L50 22L62 30C68 26 76 28 76 36L86 82C86 90 80 94 72 94H28C20 94 14 90 14 82Z', ['#b88a56', '#7d5a33', '#e3c193'], { depth: 5, rim: 2.5 })
    + rope('M36 30C40 36 60 36 64 30', PAL.leather[1], 4)
    + shape(rectD(30, 52, 18, 18, 4), 'red', tiny) + shape(rectD(52, 52, 18, 18, 4), 'blue', tiny) + shape(rectD(41, 70, 18, 18, 4), 'green', tiny),
  ui_trophy: () => shape('M26 10H74V36C74 54 62 64 50 64C38 64 26 54 26 36Z', 'gold', { depth: 5, rim: 2.5 })
    + rope('M26 20C10 20 10 44 28 46', PAL.gold[1], 5) + rope('M74 20C90 20 90 44 72 46', PAL.gold[1], 5)
    + shape(rectD(44, 62, 12, 16, 3), 'gold', sm) + shape(rectD(28, 78, 44, 14, 5), 'wood', sm)
    + shape(starD(50, 34, 11, 5), 'white', tiny),
  ui_up: () => shape('M50 8L88 50H64V92H36V50H12Z', 'green', { depth: 5, rim: 2.5 }),
  ui_trash: () => shape(rectD(22, 30, 56, 62, 8), 'stone', { depth: 5, rim: 2.5 }) + shape(rectD(14, 18, 72, 12, 5), 'stone', sm)
    + shape(rectD(38, 8, 24, 12, 4), 'stone', tiny) + ink('M38 44V80M50 44V80M62 44V80', 3.5),
  ui_logo: () => shape(rectD(8, 8, 40, 40, 10), 'red', { depth: 5, rim: 3 }) + shape(rectD(52, 8, 40, 40, 10), 'blue', { depth: 5, rim: 3 })
    + shape(rectD(8, 52, 40, 40, 10), 'green', { depth: 5, rim: 3 }) + shape(rectD(52, 52, 40, 40, 10), 'gold', { depth: 5, rim: 3 })
    + glyph('M38 14L44 14L44 20L28 36L31 39L28 42L25 39L21 43L17 39L21 35L18 32L21 29L24 32Z', 2.5)
    + glyph('M72 16L84 20C84 32 80 38 72 44C64 38 60 32 60 20Z', 2.5)
    + glyph('M28 84C18 78 13 72 14 66C15 60 22 58 28 64C34 58 41 60 42 66C43 72 38 78 28 84Z', 2.5)
    + glyph(circleD(72, 72, 11), 2.5),
};

export const ICON_ART = { ...TILES, ...INTENT, ...ROOM, ...SPECIAL, ...EVENT, ...OPTION, ...UI };
