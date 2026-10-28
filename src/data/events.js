/* Mystery events. Each option has an optional `need` (gold / hp it requires), a `cost`,
 * and weighted `outcomes` whose `gain` the engine applies (see engine/run.js applyGain). */
export const EVENTS = {
  shrine: {
    title: 'Ancient Shrine', art: 'e_shrine', text: 'A blood-stained altar hums with old power.',
    options: [
      { label: 'Offer blood', art: 'o_blood', text: 'Lose 10 HP. Gain a relic.', need: { hp: 11 }, cost: { hp: 10 }, outcomes: [{ gain: { relic: 1 } }] },
      { label: 'Pray', art: 'o_pray', text: 'Heal 10 HP.', outcomes: [{ gain: { heal: 10 } }] },
    ],
  },
  pool: {
    title: 'Glittering Pool', art: 'e_pool', text: 'Coins shimmer at the bottom of a black pool. Something moves below.',
    options: [
      { label: 'Reach in', art: 'o_reach', text: '60%: +45 gold. 40%: lose 9 HP.', outcomes: [
        { w: 6, gain: { gold: 45 }, say: 'You come up with a fistful of gold.' },
        { w: 4, gain: { hurt: 9 }, say: 'Something bites!' }] },
      { label: 'Walk away', art: 'o_leave', text: 'Nothing happens.', outcomes: [{ gain: {} }] },
    ],
  },
  smith: {
    title: 'Wandering Smith', art: 'e_smith', text: 'A dwarf with a portable anvil offers his services.',
    options: [
      { label: 'Hone a block', art: 'o_hammer', text: 'Pay 40 gold: upgrade a block type of your choice.', need: { gold: 40 }, cost: { gold: 40 }, outcomes: [{ gain: { upgrade: 1 } }] },
      { label: 'Reforge armor', art: 'o_armor', text: 'Pay 30 gold: +8 max HP.', need: { gold: 30 }, cost: { gold: 30 }, outcomes: [{ gain: { maxHp: 8 } }] },
      { label: 'Move on', art: 'o_leave', text: 'Nothing happens.', outcomes: [{ gain: {} }] },
    ],
  },
  gambler: {
    title: 'Goblin Gambler', art: 'e_gambler', text: '"Double or nothing, eh? Gimme 25 gold."',
    options: [
      { label: 'Gamble', art: 'o_dice', text: '50%: win 25 gold. 50%: lose 25 gold.', need: { gold: 25 }, outcomes: [
        { w: 1, gain: { gold: 25 }, say: 'You win! The goblin grumbles.' },
        { w: 1, gain: { gold: -25 }, say: 'The goblin cackles and pockets your gold.' }] },
      { label: 'Decline', art: 'o_leave', text: 'Nothing happens.', outcomes: [{ gain: {} }] },
    ],
  },
  chest: {
    title: 'Suspicious Chest', art: 'e_chest', text: 'A chest sits alone in the corridor. Did it just breathe?',
    options: [
      { label: 'Open it', art: 'o_open', text: '50%: a relic. 50%: it bites for 12.', outcomes: [
        { w: 1, gain: { relic: 1 }, say: 'Treasure!' },
        { w: 1, gain: { hurt: 12 }, say: 'It was a mimic! It bites and scurries off.' }] },
      { label: 'Leave it', art: 'o_leave', text: 'Nothing happens.', outcomes: [{ gain: {} }] },
    ],
  },
  fountain: {
    title: 'Fountain of Youth', art: 'e_fountain', text: 'Crystal water bubbles up from the stone. It smells of flowers.',
    options: [
      { label: 'Drink deeply', art: 'o_drink', text: 'Heal to full HP.', outcomes: [{ gain: { healFull: 1 } }] },
      { label: 'Fill a flask', art: 'o_flask', text: 'Gain a Health Potion.', outcomes: [{ gain: { potion: 'health' } }] },
    ],
  },
};
