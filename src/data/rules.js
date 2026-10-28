/* Core tuning numbers. Everything the balance lab adjusts lives here or in the data tables. */
export const GRID = 8;
export const HAND = 3;
export const FLOORS = 5;
export const MAP_ROWS = 7;              // per floor: start fights ... campfire, boss

export const LINE_MULT = [0, 1, 1.5, 2, 2.5, 3];   // by lines cleared at once (5+ = x3)
export const STREAK_STEP = 0.25;        // extra multiplier per step of a combo
export const COMBO_WINDOW = 2;          // a combo survives one move without a clear; two in a row end it
export const PURE_BONUS = 0.5;          // per line made of a single block type
export const CAVE_IN_DMG = floor => 4 + 2 * floor;
export const POTION_SLOTS = 3;
/* Break: big attacks (and boss signature moves) are cancelled if you deal enough damage before
 * they land. Threshold = total attack damage x mult, or a share of max HP for signature moves. */
export const BREAK = { mult: 2.2, min: 10, signature: 0.18 };
export const FLAWLESS_GOLD = floor => 4 + 2 * floor;          // won without losing HP
export const OVERKILL_GOLD = (excess, floor) => Math.min(6 + 2 * floor, Math.floor(excess / 4));
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
