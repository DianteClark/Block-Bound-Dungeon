/* Block types. `base` is what one block in a cleared line does before upgrades and multipliers. */
export const BLOCKS = {
  sword:   { name: 'Sword',   art: 'b_sword',   does: 'damage', base: 2, desc: 'Deals damage.' },
  shield:  { name: 'Shield',  art: 'b_shield',  does: 'shield', base: 1, desc: 'Gives shield, which blocks enemy damage this fight.' },
  heart:   { name: 'Heart',   art: 'b_heart',   does: 'heal',   base: 1, desc: 'Heals you.' },
  coin:    { name: 'Coin',    art: 'b_coin',    does: 'gold',   base: 1, desc: 'Earns gold.' },
  rainbow: { name: 'Rainbow', art: 'b_rainbow', does: 'all',    base: 1, desc: 'Deals damage, shields and heals, and matches any type in a pure line.' },
  rubble:  { name: 'Rubble',  art: 'b_rubble',  does: 'none',   base: 0, junk: true, desc: 'Dropped by enemies. Does nothing, but clears with its line.' },
};
export const UPGRADABLE = ['sword', 'shield', 'heart'];
