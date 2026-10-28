/* Relics. `mod` values are summed by the engine (see engine/stats.js).
 * rarity: 0 starter, 1 common, 2 uncommon, 3 rare. */
export const RELICS = {
  // starters
  oath:     { name: 'Oath Shield',     art: 'r_oath',     rarity: 0, desc: 'Start each fight with 6 shield.', mod: { startShield: 6 } },
  daggers:  { name: 'Twin Daggers',    art: 'r_daggers',  rarity: 0, desc: 'Combos build faster (+0.15 per step). Coin blocks give +1 gold.', mod: { streakStep: 0.15, coin: 1 } },
  orb:      { name: "Seer's Orb",      art: 'r_orb',      rarity: 0, desc: 'Clearing 2 or more lines at once adds +1 to the multiplier.', mod: { multiLine: 1 } },
  // common
  whetstone:{ name: 'Whetstone',       art: 'r_whetstone', rarity: 1, desc: 'Sword blocks deal +1 damage.', mod: { sword: 1 } },
  tower:    { name: 'Tower Shield',    art: 'r_tower',    rarity: 1, desc: 'Shield blocks give +1 shield.', mod: { shield: 1 } },
  herb:     { name: 'Healing Herb',    art: 'r_herb',     rarity: 1, desc: 'Heart blocks heal +1.', mod: { heart: 1 } },
  luckycoin:{ name: 'Lucky Coin',      art: 'r_luckycoin', rarity: 1, desc: 'Coin blocks give +1 gold.', mod: { coin: 1 } },
  chainmail:{ name: 'Chainmail',       art: 'r_chainmail', rarity: 1, desc: 'Start each fight with 6 shield.', mod: { startShield: 6 } },
  locket:   { name: 'Heart Locket',    art: 'r_locket',   rarity: 1, desc: 'Heal 6 HP after every fight.', mod: { fightHeal: 6 } },
  thickhide:{ name: 'Troll Hide',      art: 'r_thickhide', rarity: 1, desc: '+10 max HP.', mod: { maxHp: 10 } },
  // uncommon
  feather:  { name: 'Light Feather',   art: 'r_feather',  rarity: 2, desc: 'Small pieces (3 blocks or fewer) appear more often.', mod: { smallPieces: 1 } },
  wardrum:  { name: 'War Drum',        art: 'r_wardrum',  rarity: 2, desc: 'Combos add +0.25 more to the multiplier per step.', mod: { streakStep: 0.25 } },
  purist:   { name: 'Purist Gem',      art: 'r_purist',   rarity: 2, desc: 'Pure lines (one block type) add +1 to the multiplier instead of +0.5.', mod: { pure: 0.5 } },
  spikes:   { name: 'Spiked Pauldron', art: 'r_spikes',   rarity: 2, desc: 'Whenever an enemy attacks you, deal 4 damage back.', mod: { thorns: 4 } },
  fang:     { name: 'Vampire Fang',    art: 'r_fang',     rarity: 2, desc: 'Heal 3 HP whenever you clear 2 or more lines at once.', mod: { fang: 3 } },
  battery:  { name: 'Storm Battery',   art: 'r_battery',  rarity: 2, desc: 'Start each fight with 3 special charge.', mod: { startCharge: 3 } },
  sledge:   { name: 'Sledgehammer',    art: 'r_sledge',   rarity: 2, desc: 'Rubble in a cleared line deals 5 damage each.', mod: { rubbleDmg: 5 } },
  sapper:   { name: "Sapper's Kit",    art: 'r_sapper',   rarity: 2, desc: 'Cave-ins cost no HP and deal 10 damage to the enemy.', mod: { sapper: 1 } },
  // rare
  ring:     { name: 'Ring of Ruin',    art: 'r_ring',     rarity: 3, desc: 'Your first clear each fight is doubled.', mod: { firstClear: 1 } },
  hourglass:{ name: 'Sand Hourglass',  art: 'r_hourglass', rarity: 3, desc: 'Enemy moves take 1 extra turn to arrive.', mod: { slowEnemy: 1 } },
  spellbook:{ name: 'Spellbook',       art: 'r_spellbook', rarity: 3, desc: 'Your special needs 2 fewer lines to charge.', mod: { specialCost: 2 } },
  phoenix:  { name: 'Phoenix Feather', art: 'r_phoenix',  rarity: 3, desc: 'Once per run, when you would die, revive with half your HP.', mod: { revive: 1 } },
};
