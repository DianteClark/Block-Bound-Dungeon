/* Core tuning numbers. Everything the balance lab adjusts lives here or in the data tables. */
export const GRID = 8;
export const HAND = 3;
export const FLOORS = 5;
export const MAP_ROWS = 7;              // per floor: start fights ... campfire, boss

export const LINE_MULT = [0, 1, 1.5, 2, 2.5, 3];   // by lines cleared at once (5+ = x3)
export const STREAK_STEP = 0.25;        // extra multiplier per back-to-back clearing move
export const PURE_BONUS = 0.5;          // per line made of a single block type
export const CAVE_IN_DMG = floor => 4 + 2 * floor;
export const POTION_SLOTS = 3;
export const SHIELD_FADE = 0.5;        // share of leftover shield lost each time the enemy acts

export const GOLD = {
  combat: floor => 6 + 2 * floor,
  elite:  floor => 16 + 4 * floor,
  boss:   floor => 30 + 6 * floor,
};
export const PRICES = { relic: [0, 75, 110, 150], potion: 25, removeBase: 40, removeStep: 20 };
export const MAX_BLOCK_LEVEL = 3;
export const FIGHT_RELIC_CHANCE = 0.15;
/* lab knobs: scale enemy HP and damage per floor (baked into the enemy table once tuned) */
export const ENEMY_HP = [1, 1, 1, 1, 1];
export const ENEMY_DMG = [1, 1, 1, 1, 1];
export const REST_HEAL = 0.3;           // share of max HP
export const BOSS_HEAL = 0.25;
export const BAG_MIN = 8;
