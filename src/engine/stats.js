/* Derived numbers: relic bonuses, block values, special cost. Pure functions of the run. */
import { RELICS } from '../data/relics.js';
import { BLOCKS } from '../data/blocks.js';
import { HEROES } from '../data/heroes.js';
import { STREAK_STEP } from '../data/rules.js';

/** Sum of a relic modifier across everything the hero carries. */
export function mod(run, key) {
  let total = 0;
  for (const id of run.relics) {
    const v = RELICS[id] && RELICS[id].mod[key];
    if (v) total += v;
  }
  return total;
}

/** What one block of `type` does when it fires (before the multiplier). */
export function blockValue(run, type) {
  const B = BLOCKS[type];
  if (!B) return 0;
  return B.base + (run.lvl[type] || 0) + mod(run, type);
}

/** Relics carrying a given modifier (used to show which relic just did something). */
export const relicsWith = (run, key) => run.relics.filter(id => RELICS[id] && RELICS[id].mod[key]);

export function specialNeed(run) {
  return Math.max(3, HEROES[run.hero].special.need - mod(run, 'specialCost'));
}

export function streakStep(run) {
  return STREAK_STEP + mod(run, 'streakStep');
}
