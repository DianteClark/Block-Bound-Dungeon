# Design and tuning notes

## Balance targets

The balance lab (`npm run lab`) plays full runs with a greedy bot that uses the real engine. The bot is a decent but not expert player: it does not plan combos or multi-line clears. Targets for the current base game:

- Each hero wins **about 45 to 60%** of bot runs.
- Deaths are spread across all five floors, and the floor bosses are the main killers.
- No single relic should swing win rate far above the rest.

Latest run (300 runs per hero):

| Hero | Win rate | Deaths by floor (1 / 2 / 3 / 4 / 5) | Top killers |
|---|---|---|---|
| Knight | 55% | 17 / 36 / 43 / 19 / 19 | Ancient Dragon, Grave Warden, Rat King |
| Rogue | 48% | 34 / 55 / 44 / 10 / 12 | Ancient Dragon, Rat King, Grave Warden |
| Mage | 48% | 8 / 29 / 62 / 14 / 44 | Ancient Dragon, Demon Lord, Abyssal Horror |

Real players should do better with the Rogue (combos) and the Mage (multi-line clears) than the bot does, since those heroes reward planning ahead.

## Where the numbers live

- `src/data/rules.js`: line multipliers, combo and pure-line bonuses, shield fade, cave-in damage, gold per fight, shop prices, campfire heal, upgrade cap. `ENEMY_HP` and `ENEMY_DMG` are lab knobs (per-floor multipliers, all 1 once tuned values are baked into the enemy table).
- `src/data/enemies.js`: enemy HP and move cycles. Each floor was authored to a damage budget per player move, rising each floor.
- `src/data/heroes.js`, `relics.js`, `potions.js`, `events.js`: content.

Sweep enemy strength without editing files:

```
LAB_DMG=1,1.1,1.2,1.3,1.4 LAB_HP=1.1 node tools/lab.js 200 knight,mage
```

## Tuning history

- Block upgrades were uncapped and the best hits reached about 300; upgrades are now capped at +3 per type and coins can't be upgraded.
- Shield used to stack all fight long; half of leftover shield now fades each time the enemy acts.
- Shield and heart blocks start at 1 (swords 2) so defense doesn't outpace enemy damage.
- Gold was cut to roughly 350 to 450 per run so relics stay a choice, not a collection.
- The Ancient Dragon's breath was softened; it is still the hardest wall of the run.

## Adding content back

Bring systems back one at a time and rerun the lab after each: more relics first, then more enemies per floor, then meta progression. Keep every new item's art unique (`npm test` checks this).
