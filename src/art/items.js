/* Relics and potions. */
import { shape, flat, gloss, ink, rope, circleD, ellD, rectD, starD, rotAt, PAL } from './kit.js';

const sm = { depth: 2.5, rim: 1.5 };
const tiny = { depth: 1.5, rim: 1, line: 3 };

/* ---------- shared pieces ---------- */
export function dagger(x = 0, y = 0, rot = 0, blade = 'steel') {
  const art = shape('M50 6L58 16V58H42V16Z', blade, sm) + ink('M50 14V54', 2)
    + shape(rectD(32, 56, 36, 9, 4.5), 'gold', sm)
    + shape(rectD(45, 64, 10, 20, 3), 'leather', tiny)
    + shape(circleD(50, 88, 6), 'gold', tiny);
  return `<g transform="translate(${x} ${y})">${rotAt(art, rot, 50, 50)}</g>`;
}

export function heater(ramp = 'blue', emblem = 'gold') {
  const d = 'M50 6L88 18C88 56 76 80 50 94C24 80 12 56 12 18Z';
  return shape(d, 'steel')
    + shape('M50 16L78 25C78 54 69 72 50 83C31 72 22 54 22 25Z', ramp, sm)
    + shape('M45 26H55V42H68V52H55V72H45V52H32V42H45Z', emblem, tiny)
    + gloss(26, 26, 3, 9, 20, 0.55);
}

export function coin(ramp = 'gold', mark = '') {
  return shape(circleD(50, 50, 38), ramp, { depth: 5, rim: 2.5 })
    + shape(circleD(50, 50, 27), ramp, { depth: -3, rim: 0, line: 3 })
    + mark + gloss(32, 30, 4, 9, 35, 0.7);
}

export function flask(liquid, extra = '') {
  const body = 'M40 32V18H60V32C74 38 82 50 82 64C82 82 68 94 50 94C32 94 18 82 18 64C18 50 26 38 40 32Z';
  return shape(body, ['#e7eef8', '#a8b7cc', '#ffffff'], { depth: 3, rim: 1.5 })
    + shape('M21 62C30 56 40 66 50 60C60 54 70 64 79 60C80 80 66 91 50 91C34 91 20 80 21 62Z', liquid, { depth: 4, rim: 0, line: 0 })
    + flat(body, 'none', 4.5)
    + shape(rectD(36, 8, 28, 13, 4), 'wood', sm)
    + gloss(30, 54, 3.5, 10, 20, 0.75)
    + extra;
}

/* ---------- relics ---------- */
const RELIC = {
  r_oath: () => heater('blue', 'gold'),
  r_daggers: () => dagger(-10, 0, -32) + dagger(10, 0, 32),
  r_orb: () => shape('M30 92C30 80 38 74 50 74C62 74 70 80 70 92Z', 'gold', sm)
    + shape(circleD(50, 44, 32), 'violet', { depth: 6, rim: 3 })
    + flat(starD(50, 44, 12, 4, 4), '#fff')
    + gloss(36, 30, 6, 11, 35, 0.75),
  r_whetstone: () => shape('M12 64L76 30L90 46L26 82Z', 'stone', { depth: 5, rim: 2 })
    + ink('M30 66L72 44', 2.5)
    + shape(starD(78, 22, 10, 3, 4), 'gold', tiny) + shape(starD(24, 36, 6, 2, 4), 'gold', tiny),
  r_tower: () => shape(rectD(20, 6, 60, 88, 12), 'steel', { depth: 5, rim: 2.5 })
    + shape(rectD(30, 16, 40, 68, 8), 'navy', sm)
    + shape('M50 26L62 42L50 74L38 42Z', 'gold', tiny)
    + [[26, 12], [74, 12], [26, 88], [74, 88]].map(([x, y]) => shape(circleD(x, y, 3.5), 'iron', { depth: 1, rim: 0, line: 2.5 })).join(''),
  r_herb: () => rope('M50 94C50 70 46 50 52 26', PAL.green[1], 4)
    + shape('M50 62C34 62 22 50 20 36C36 36 48 46 50 62Z', 'green', sm)
    + shape('M52 48C66 46 78 34 80 20C64 22 54 32 52 48Z', 'green', sm)
    + shape('M50 80C38 82 28 74 24 64C36 62 46 68 50 80Z', 'moss', sm)
    + [0, 72, 144, 216, 288].map(a => rotAt(shape(ellD(52, 14, 6, 9), 'pink', tiny), a, 52, 22)).join('')
    + shape(circleD(52, 22, 5), 'gold', tiny),
  r_luckycoin: () => coin('gold', [0, 90, 180, 270].map(a => rotAt(shape(ellD(50, 39, 7, 9), 'green', tiny), a)).join('') + shape(circleD(50, 50, 3), 'moss', { depth: 1, rim: 0, line: 2 })),
  r_chainmail: () => shape('M26 14L40 8C44 16 56 16 60 8L74 14L92 34L80 44L74 38V92H26V38L20 44L8 34Z', 'steel', { depth: 5, rim: 2.5 })
    + [20, 32, 44, 56, 68, 80].map(y => ink(`M30 ${y}C34 ${y + 4} 38 ${y + 4} 42 ${y}C46 ${y + 4} 50 ${y + 4} 54 ${y}C58 ${y + 4} 62 ${y + 4} 66 ${y}C68 ${y + 2} 69 ${y + 3} 70 ${y + 3}`, 2)).join(''),
  r_locket: () => rope('M30 10C30 30 70 30 70 10', PAL.gold[1], 3)
    + shape('M50 92C24 74 12 56 14 40C16 26 34 20 50 36C66 20 84 26 86 40C88 56 76 74 50 92Z', 'gold', { depth: 5, rim: 2.5 })
    + shape('M50 74C36 64 30 54 31 46C32 39 42 36 50 46C58 36 68 39 69 46C70 54 64 64 50 74Z', 'red', sm)
    + gloss(28, 40, 3.5, 7, 35, 0.75),
  r_thickhide: () => shape('M20 18C34 10 66 10 80 18C88 28 82 38 88 48C94 58 84 66 86 78C80 90 64 92 50 88C36 92 20 90 14 78C16 66 6 58 12 48C18 38 12 28 20 18Z', 'leather', { depth: 5, rim: 2.5 })
    + shape('M32 30C42 26 58 26 68 30C72 44 70 64 66 74C56 78 44 78 34 74C30 64 28 44 32 30Z', ['#b9845c', '#7a5236', '#e2b48e'], sm)
    + ink('M40 34L44 38M48 34L52 38M56 34L60 38M40 66L44 70M48 66L52 70M56 66L60 70', 2.2),
  r_feather: () => rotAt(shape('M50 4C70 20 74 50 64 78L50 92L36 78C26 50 30 20 50 4Z', 'teal', { depth: 4, rim: 2 })
    + ink('M50 14V94', 3) + ink('M50 30L62 22M50 44L64 36M50 58L64 52M50 30L38 22M50 44L36 36M50 58L36 52', 2), 30),
  r_wardrum: () => shape(ellD(50, 34, 36, 12), ['#f1e6cd', '#c3b08a', '#fff'], sm)
    + shape('M14 34V70C14 80 30 88 50 88C70 88 86 80 86 70V34C86 44 70 50 50 50C30 50 14 44 14 34Z', 'red', { depth: 4, rim: 2 })
    + ink('M18 50L30 82M34 52L42 86M58 52L50 88M74 50L66 86M84 46L76 80', 2.5)
    + rope('M60 22L88 4', PAL.wood[0], 5) + rope('M40 22L12 4', PAL.wood[0], 5)
    + shape(circleD(89, 4, 5), 'bone', tiny) + shape(circleD(11, 4, 5), 'bone', tiny),
  r_purist: () => shape('M50 6L84 30L72 86H28L16 30Z', 'teal', { depth: 5, rim: 2.5 })
    + ink('M16 30H84M34 30L50 86L66 30M50 6L34 30M50 6L66 30', 2.5)
    + gloss(34, 20, 3, 7, 40, 0.8),
  r_spikes: () => [[24, 30, -40], [50, 18, 0], [76, 30, 40]].map(([x, y, a]) => rotAt(shape(`M${x - 7} ${y + 16}L${x} ${y - 8}L${x + 7} ${y + 16}Z`, 'steel', tiny), a, x, y + 12)).join('')
    + shape('M10 70C10 44 28 30 50 30C72 30 90 44 90 70C90 78 84 82 76 80C66 76 34 76 24 80C16 82 10 78 10 70Z', 'iron', { depth: 5, rim: 2.5 })
    + shape('M18 72C30 66 70 66 82 72L80 84C68 80 32 80 20 84Z', 'gold', sm)
    + gloss(28, 46, 3, 8, 50, 0.5),
  r_fang: () => shape('M26 14C40 8 60 8 74 14C74 36 66 64 56 88C54 92 46 92 44 88C34 64 26 36 26 14Z', 'bone', { depth: 5, rim: 2.5 })
    + shape('M62 66C66 74 70 80 70 86C70 92 66 96 62 96C58 96 54 92 54 86C54 80 58 74 62 66Z', 'red', tiny)
    + gloss(38, 24, 3, 8, 15, 0.8),
  r_battery: () => shape(rectD(22, 18, 56, 74, 10), ['#d9f3ff', '#8ab8d9', '#fff'], { depth: 4, rim: 2 })
    + shape(rectD(32, 6, 36, 14, 4), 'iron', sm)
    + shape('M56 28L36 58H50L44 84L66 50H52Z', 'gold', sm)
    + gloss(30, 30, 3, 10, 0, 0.8),
  r_sledge: () => rotAt(shape(rectD(44, 34, 12, 62, 4), 'wood', sm) + shape(rectD(14, 8, 72, 32, 8), 'iron', { depth: 5, rim: 2.5 })
    + shape(rectD(10, 12, 10, 24, 3), 'steel', tiny) + shape(rectD(80, 12, 10, 24, 3), 'steel', tiny), -25),
  r_sapper: () => shape(circleD(44, 58, 30), 'dark', { depth: 5, rim: 2.5 })
    + shape(rectD(36, 22, 16, 10, 3), 'iron', tiny)
    + rope('M44 22C46 12 56 8 62 12', PAL.wood[0], 3)
    + shape(starD(66, 12, 9, 3.5, 6), 'ember', tiny)
    + gloss(32, 46, 4, 9, 35, 0.55)
    + rotAt(shape('M68 70L92 60L94 66L72 76Z', 'steel', tiny) + shape(rectD(64, 70, 6, 26, 2), 'wood', tiny), 10, 70, 80),
  r_ring: () => shape(ellD(50, 62, 34, 30), 'gold', { depth: 5, rim: 2.5 })
    + shape(ellD(50, 64, 22, 18), ['#2a2238', '#17111f', '#4e4263'], { depth: -2, rim: 0, line: 3.5 })
    + shape('M50 8L68 26L50 44L32 26Z', 'red', sm)
    + gloss(42, 20, 2.5, 5, 40, 0.8),
  r_hourglass: () => shape(rectD(18, 6, 64, 12, 5), 'wood', sm) + shape(rectD(18, 82, 64, 12, 5), 'wood', sm)
    + shape('M28 18H72C72 36 58 44 54 50C58 56 72 64 72 82H28C28 64 42 56 46 50C42 44 28 36 28 18Z', ['#e7f4ff', '#a7c3dc', '#fff'], { depth: 3, rim: 1.5 })
    + flat('M34 30H66C62 38 54 44 50 48C46 44 38 38 34 30Z', PAL.gold[0])
    + flat('M38 80C40 70 46 66 50 64C54 66 60 70 62 80Z', PAL.gold[0])
    + flat('M28 18H72C72 36 58 44 54 50C58 56 72 64 72 82H28C28 64 42 56 46 50C42 44 28 36 28 18Z', 'none', 4.5),
  r_spellbook: () => shape('M14 22C26 16 40 16 50 24C60 16 74 16 86 22V86C74 80 60 80 50 88C40 80 26 80 14 86Z', 'purple', { depth: 5, rim: 2.5 })
    + shape('M20 26C30 22 40 22 48 28V80C40 74 30 74 20 78Z', 'bone', sm)
    + shape('M80 26C70 22 60 22 52 28V80C60 74 70 74 80 78Z', 'bone', sm)
    + shape(starD(34, 50, 9, 4, 5), 'violet', tiny)
    + ink('M58 40H74M58 50H72M58 60H74', 2.5),
  r_phoenix: () => rotAt(shape('M50 4C76 22 76 56 62 80L50 94L38 80C24 56 24 22 50 4Z', 'ember', { depth: 4, rim: 2 })
    + shape('M50 26C62 38 62 60 54 74L50 80L46 74C38 60 38 38 50 26Z', 'gold', sm)
    + ink('M50 10V92', 2.5), 25),
};

/* ---------- potions ---------- */
const POTION = {
  p_health: () => flask('red', shape('M50 82C40 76 34 70 35 64C36 58 44 56 50 62C56 56 64 58 65 64C66 70 60 76 50 82Z', 'white', tiny)),
  p_iron: () => flask('steel', shape('M50 56L62 60C62 72 58 78 50 84C42 78 38 72 38 60Z', 'iron', tiny)),
  p_fire: () => flask('ember', shape('M50 54C54 62 62 66 62 74C62 80 56 86 50 86C44 86 38 80 38 74C38 68 46 64 50 54Z', 'gold', tiny)),
  p_smoke: () => shape(circleD(28, 30, 14), ['#d2cde0', '#9a93ad', '#fff'], { depth: 3, rim: 1.5 })
    + shape(circleD(44, 20, 12), ['#d2cde0', '#9a93ad', '#fff'], { depth: 3, rim: 1.5 })
    + shape(circleD(50, 64, 30), 'dark', { depth: 5, rim: 2.5 })
    + shape(rectD(42, 28, 16, 10, 3), 'iron', tiny)
    + gloss(38, 52, 4, 9, 35, 0.5),
  p_fresh: () => flask('teal', ink('M38 74C38 66 50 64 52 70C54 76 64 74 62 66', 3) + shape('M62 60L66 68L58 68Z', 'white', { depth: 0, rim: 0, line: 2 })),
};

export const ITEM_ART = { ...RELIC, ...POTION };
