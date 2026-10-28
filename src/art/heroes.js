/* Hero portraits (head and shoulders). */
import { shape, flat, gloss, ink, eye, brow, cheek, circleD, ellD, rectD, starD, mirrorX, PAL } from './kit.js';

const hood = ['#3f9a63', '#246140', '#86d6a4'];

function knight() {
  const helm = 'M27 47C27 22 37 9 50 9C63 9 73 22 73 47V62C73 68 69 71 63 71H37C31 71 27 68 27 62Z';
  return shape('M13 97C13 80 28 70 50 70C72 70 87 80 87 97C87 99 86 100 84 100H16C14 100 13 99 13 97Z', 'blue')
    + shape('M38 100L42 72H58L62 100Z', 'gold', { depth: 3 })
    + shape(rectD(46, 80, 8, 18, 2), 'red', { depth: 2, rim: 1.5 })
    + shape(ellD(23, 79, 15, 11), 'steel') + shape(ellD(77, 79, 15, 11), 'steel')
    + shape('M46 16C40 0 60 -6 78 4C80 9 76 12 72 10C66 7 60 10 58 18Z', 'red', { depth: 3 })
    + shape(helm, 'steel')
    + flat('M50 11V36', 'none') + ink('M50 12V36', 3)
    + shape(rectD(31, 38, 38, 15, 7), 'dark', { depth: 2, rim: 0 })
    + eye(41, 45.5, 5.2) + eye(59, 45.5, 5.2)
    + flat(circleD(42, 61, 1.8), PAL.iron[1]) + flat(circleD(50, 62, 1.8), PAL.iron[1]) + flat(circleD(58, 61, 1.8), PAL.iron[1])
    + shape(rectD(27, 64, 46, 7, 3), 'gold', { depth: 2, rim: 1.5 })
    + gloss(36, 22, 4, 8, 30, 0.7);
}

function rogue() {
  return shape('M11 97C11 82 26 72 50 72C74 72 89 82 89 97C89 99 88 100 86 100H14C12 100 11 99 11 97Z', 'leather')
    + shape('M25 100L30 74C38 80 62 80 70 74L75 100Z', hood, { depth: 3 })
    + shape('M16 74C12 42 28 10 50 8C72 10 88 42 84 74C76 78 24 78 16 74Z', hood)
    + shape(ellD(50, 50, 23, 24), 'shadow', { depth: 3, rim: 0 })
    + shape(ellD(50, 50, 18, 19), 'skin', { depth: 3 })
    + shape('M31 53C40 60 60 60 69 53L68 68C60 74 40 74 32 68Z', 'dark', { depth: 3, rim: 1.5 })
    + ink('M38 62C44 64 56 64 62 62', 2)
    + eye(42, 46, 5.4, [0.3, 0.15]) + eye(58, 46, 5.4, [0.3, 0.15])
    + brow(35, 37, 47, 41, 4.5) + brow(53, 41, 65, 37, 4.5)
    + gloss(30, 30, 4, 9, 25, 0.5)
    + shape('M78 62L90 36L95 39L84 65Z', 'steel', { depth: 2, rim: 1, line: 3.5 })
    + shape(rectD(72, 60, 17, 6, 3), 'gold', { depth: 2, rim: 1, line: 3.5 })
    + shape('M75 65L83 66L80 82L72 80Z', 'wood', { depth: 2, rim: 1, line: 3.5 });
}

function mage() {
  return shape('M11 97C11 80 26 70 50 70C74 70 89 80 89 97C89 99 88 100 86 100H14C12 100 11 99 11 97Z', 'purple')
    + shape('M31 100L36 74H64L69 100Z', 'violet', { depth: 3 })
    + shape('M30 76C38 70 62 70 70 76L64 84H36Z', 'gold', { depth: 2, rim: 1.5 })
    + shape(ellD(50, 52, 19, 19), 'skin')
    + shape('M30 54C30 74 40 90 50 92C60 90 70 74 70 54C64 64 58 66 50 64C42 66 36 64 30 54Z', 'bone')
    + shape('M38 64C42 59 47 59 50 62C53 59 58 59 62 64C57 66 53 66 50 64C47 66 43 66 38 64Z', 'bone', { depth: 1.5, rim: 0, line: 2.5 })
    + shape(ellD(50, 55, 3.6, 3.2), 'skin', { depth: 1.5, rim: 1, line: 2.5 })
    + eye(42, 47, 5) + eye(58, 47, 5)
    + shape('M34 41C38 36 46 37 48 41C44 41 38 42 34 44Z', 'bone', { depth: 1.5, rim: 0, line: 2.5 })
    + mirrorX(shape('M34 41C38 36 46 37 48 41C44 41 38 42 34 44Z', 'bone', { depth: 1.5, rim: 0, line: 2.5 }))
    + cheek(36, 55, 4) + cheek(64, 55, 4)
    + shape(ellD(50, 35, 33, 8), 'purple', { depth: 3 })
    + shape('M30 34C34 22 42 8 56 3C63 1 71 5 76 0C71 10 66 20 69 34C58 38 42 38 30 34Z', 'purple')
    + shape('M31 30C42 34 58 34 69 30L69 36C58 39 42 39 31 36Z', 'gold', { depth: 2, rim: 1.5 })
    + shape(starD(52, 20, 7, 3), 'gold', { depth: 2, rim: 1, line: 3 })
    + gloss(41, 18, 3, 7, 30, 0.55);
}

export const HERO_ART = { h_knight: knight, h_rogue: rogue, h_mage: mage };
