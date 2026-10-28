export const HEROES = {
  knight: {
    name: 'Knight', art: 'h_knight', hp: 68, gold: 20, relic: 'oath', potions: ['iron'],
    bag: { sword: 5, shield: 4, heart: 2, coin: 3 },
    blurb: 'Sturdy and patient. Starts every fight behind a wall of shield.',
    special: { name: 'Bulwark', art: 's_bulwark', need: 7, desc: 'Gain 12 shield (+3 per floor) and clear all rubble from the grid.' },
  },
  rogue: {
    name: 'Rogue', art: 'h_rogue', hp: 64, gold: 40, relic: 'daggers', potions: ['smoke'],
    bag: { sword: 6, shield: 3, heart: 2, coin: 3 },
    blurb: 'Lives on momentum. Combos build twice as fast and coins pay more.',
    special: { name: 'Shadowstep', art: 's_shadowstep', need: 6, desc: 'Draw a fresh hand, delay the enemy by 2 moves, and double your next clear.' },
  },
  mage: {
    name: 'Mage', art: 'h_mage', hp: 58, gold: 20, relic: 'orb', potions: ['health'],
    bag: { sword: 5, shield: 3, heart: 2, coin: 2, rainbow: 2 },
    blurb: 'Fragile but explosive. Big multi-line clears hit much harder.',
    special: { name: 'Meteor', art: 's_meteor', need: 8, desc: 'Fire the fullest row and the fullest column at x2.5, even if they are not full.' },
  },
};
export const HERO_ORDER = ['knight', 'rogue', 'mage'];
