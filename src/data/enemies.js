/* Enemies by floor. A move is { k: kind, v: value, t: moves until it fires, n: hits }. */
const m = (k, v, t, n) => (n ? { k, v, t, n } : { k, v, t });

export const MOVES = {
  atk:    { name: 'Attack',    desc: (it, d) => `Attacks for ${d}.` },
  multi:  { name: 'Flurry',    desc: (it, d) => `Attacks ${it.n} times for ${d}.` },
  drain:  { name: 'Drain',     desc: (it, d) => `Attacks for ${d} and heals by the damage that gets through.` },
  armor:  { name: 'Guard',     desc: it => `Gains ${it.v} armor. Armor soaks your damage until broken.` },
  heal:   { name: 'Mend',      desc: it => `Heals ${it.v} HP.` },
  rubble: { name: 'Rubble',    desc: it => `Drops ${it.v} rubble on your grid.` },
  rage:   { name: 'Enrage',    desc: it => `All its attacks deal +${it.v} for the rest of the fight.` },
  sap:    { name: 'Sap',       desc: it => `Drains ${it.v} charge from your special.` },
  gnaw:   { name: 'Gnaw',      desc: it => `Chews ${it.v} blocks off your grid.` },
  hex:    { name: 'Hex',       desc: it => `Turns ${it.v} unplayed pieces in your hand to rubble.` },
  breath: { name: 'Fire Breath', desc: (it, d) => `Burns your fullest column and deals ${d} plus ${it.v} for each block burned.` },
  frost:  { name: 'Frost Rise', desc: () => 'Pushes your grid up one row and fills the bottom with rubble, leaving one gap.' },
  flip:   { name: 'Upheaval',  desc: () => 'Turns your grid upside down.' },
};
/* which moves deal damage (and so scale with rage) */
export const ATTACKS = new Set(['atk', 'multi', 'drain', 'breath']);

export const FLOOR_INFO = [
  { name: 'The Damp Cellars', theme: 'cellar' },
  { name: 'The Bone Halls',   theme: 'bone' },
  { name: 'The Ember Depths', theme: 'ember' },
  { name: 'The Frozen Crypt', theme: 'frost' },
  { name: 'The Abyss',        theme: 'abyss' },
];

export const ENEMIES = {
  // floor 1
  rat:      { name: 'Cave Rat',    art: 'm_rat',      floor: 1, hp: 30,  moves: [m('atk', 9, 3), m('atk', 9, 3), m('rubble', 2, 2)] },
  bat:      { name: 'Vampire Bat', art: 'm_bat',      floor: 1, hp: 26,  moves: [m('atk', 4, 2), m('drain', 7, 3)] },
  slime:    { name: 'Gloop',       art: 'm_slime',    floor: 1, hp: 41,  moves: [m('rubble', 3, 3), m('atk', 11, 3)] },
  ogre:     { name: 'Ogre',        art: 'm_ogre',     floor: 1, hp: 92,  elite: true, moves: [m('armor', 10, 3), m('atk', 24, 4)] },
  ratking:  { name: 'The Rat King', art: 'm_ratking', floor: 1, hp: 162, boss: true, enrage: 3,
              moves: [m('atk', 13, 2), m('gnaw', 4, 3), m('multi', 6, 3, 3), m('rubble', 3, 2)] },
  // floor 2
  skeleton: { name: 'Skeleton',    art: 'm_skeleton', floor: 2, hp: 58,  moves: [m('armor', 8, 2), m('atk', 20, 3)] },
  goblin:   { name: 'Goblin',      art: 'm_goblin',   floor: 2, hp: 54,  moves: [m('atk', 13, 3), m('multi', 7, 4, 3)] },
  banshee:  { name: 'Banshee',     art: 'm_banshee',  floor: 2, hp: 50,  moves: [m('sap', 2, 2), m('atk', 16, 3)] },
  warlock:  { name: 'Warlock',     art: 'm_warlock',  floor: 2, hp: 130, elite: true, moves: [m('rubble', 5, 3), m('atk', 28, 2), m('heal', 15, 3)] },
  warden:   { name: 'The Grave Warden', art: 'm_warden', floor: 2, hp: 248, boss: true, enrage: 3,
              moves: [m('hex', 2, 3), m('atk', 25, 3), m('armor', 14, 2), m('multi', 8, 3, 3), m('rubble', 3, 2)] },
  // floor 3
  imp:      { name: 'Fire Imp',    art: 'm_imp',      floor: 3, hp: 65,  moves: [m('atk', 11, 2), m('multi', 6, 3, 3)] },
  cultist:  { name: 'Cultist',     art: 'm_cultist',  floor: 3, hp: 76,  moves: [m('rage', 2, 2), m('atk', 23, 3), m('drain', 14, 3)] },
  gargoyle: { name: 'Gargoyle',    art: 'm_gargoyle', floor: 3, hp: 86,  moves: [m('armor', 14, 3), m('atk', 29, 3)] },
  darkknight:{ name: 'Dark Knight', art: 'm_darkknight', floor: 3, hp: 173, elite: true, moves: [m('atk', 40, 4), m('armor', 14, 2), m('multi', 11, 3, 2)] },
  dragon:   { name: 'The Ancient Dragon', art: 'm_dragon', floor: 3, hp: 335, boss: true, enrage: 4,
              moves: [m('breath', 2, 3), m('atk', 37, 4), m('multi', 9, 4, 3), m('armor', 16, 2)] },
  // floor 4
  wraith:   { name: 'Ice Wraith',  art: 'm_wraith',   floor: 4, hp: 91,  moves: [m('rubble', 4, 3), m('atk', 29, 2)] },
  yeti:     { name: 'Yeti',        art: 'm_yeti',     floor: 4, hp: 108, moves: [m('atk', 43, 4), m('armor', 12, 2)] },
  frostspider:{ name: 'Frost Spider', art: 'm_frostspider', floor: 4, hp: 84, moves: [m('multi', 10, 3, 3), m('rubble', 3, 2)] },
  lich:     { name: 'Lich',        art: 'm_lich',     floor: 4, hp: 216, elite: true, moves: [m('heal', 18, 3), m('atk', 43, 3), m('rubble', 5, 3), m('multi', 13, 3, 2)] },
  frostqueen:{ name: 'The Frost Queen', art: 'm_frostqueen', floor: 4, hp: 454, boss: true, enrage: 4,
              moves: [m('frost', 0, 3), m('atk', 43, 3), m('armor', 18, 2), m('multi', 11, 3, 3)] },
  // floor 5
  voideye:  { name: 'Void Eye',    art: 'm_voideye',  floor: 5, hp: 114, moves: [m('sap', 3, 2), m('atk', 37, 2)] },
  demon:    { name: 'Demon',       art: 'm_demon',    floor: 5, hp: 134, moves: [m('multi', 13, 3, 3), m('rage', 2, 2), m('atk', 37, 3)] },
  shade:    { name: 'Abyss Shade', art: 'm_shade',    floor: 5, hp: 119, moves: [m('drain', 37, 3), m('rubble', 4, 2)] },
  horror:   { name: 'Abyssal Horror', art: 'm_horror', floor: 5, hp: 259, elite: true, moves: [m('multi', 15, 3, 3), m('armor', 20, 2), m('atk', 59, 4)] },
  demonlord:{ name: 'The Demon Lord', art: 'm_demonlord', floor: 5, hp: 583, boss: true, enrage: 5,
              moves: [m('flip', 0, 3), m('atk', 56, 3), m('multi', 15, 3, 3), m('rubble', 5, 2)] },
};

export function enemiesFor(floor, kind) {
  return Object.keys(ENEMIES).filter(id => {
    const E = ENEMIES[id];
    if (E.floor !== floor) return false;
    if (kind === 'boss') return !!E.boss;
    if (kind === 'elite') return !!E.elite;
    return !E.boss && !E.elite;
  });
}
