# Block Bound Dungeon

A block-blasting roguelike dungeon crawler for the browser. No build step, no dependencies, no image or audio files: the vector sticker art, sound effects and music are all generated in code.

**Play:** https://dianteclark.github.io/Block-Bound-Dungeon/

**Install it like an app:** open the link on your phone, then use Share → *Add to Home Screen* (iPhone) or the browser menu → *Install app* (Android). It gets its own icon, runs full screen and works offline after the first visit.

## How it plays

- **Grid combat.** Drag pieces onto an 8x8 grid and **tap a piece to rotate it**. Fill a full row or column to clear it.
- **Blocks are actions.** Every block in a cleared line fires its effect:
  - **Sword** (red): damages the enemy
  - **Shield** (blue): blocks incoming damage
  - **Heart** (green): heals you
  - **Coin** (gold): earns gold
  - **Rainbow** and **Venom** blocks unlock through relics
- **Combos.** Clearing several lines at once multiplies everything (x1.5, x2, x3...). Clearing on back-to-back moves adds a streak bonus.
- **Pure lines.** A line made entirely of one block type adds +0.5 to the multiplier. Rotation makes these much easier to build.
- **Perfect clears.** Empty the whole grid for a big bonus hit.
- **Hero specials.** Clearing lines charges your hero's special move: Knight *Bulwark*, Rogue *Shadowstep* and Mage *Meteor*.
- **Turns.** Every piece you place is one turn. Enemies telegraph their next move with a countdown: attacks, multi-hits, life drain, armor, healing, rage, rubble or ice.
- **Cave-ins.** If no piece fits in any rotation, the ceiling collapses: you take damage and the two fullest rows are cleared.

## The run

- **3 heroes**, each with a starting relic, potions and a special move.
- **3 floors, 8 rooms each.** Fights, elites, campfires, merchants, treasure and mystery events, with a boss at the end of each floor: the Bone King, the Hydra and the Ancient Dragon.
- **Enemy passives:** Armored, Regenerates, Ethereal and Thorns.
- **27 relics**, **6 potions** (tap a potion twice to drink it) and permanent block upgrades.
- **Auto-save.** Your run is saved between rooms, so you can close the app and continue later.
- **Settings** (gear icon): music and sound volume, screen shake, vibration, lifetime records, abandon run, and **Reset all data**.

## Files

| File | What's in it |
| --- | --- |
| `index.html` | Layout, styles, dungeon atmosphere |
| `art.js` | Every illustration as hand-built SVG, the sticker filter and the block glyphs |
| `audio.js` | Synthesized sound effects and procedural music (menu, map, combat, boss) |
| `game.js` | Game data and all game logic |
| `manifest.webmanifest`, `sw.js`, `icons/` | Home Screen app install, offline support and app icons |

### Adding art

Each illustration in `art.js` is a small function that returns SVG on a 100x100 canvas, built from helpers like `p()` (outlined path), `c()` (outlined circle), `eye()`, `glow()` and `hl()` (highlight). `img(name, size)` turns any of them into a die-cut sticker with a white border and drop shadow.

### Tuning knobs

`MULT` (combo multipliers), `ENEMIES` (per-floor HP and move patterns), the HP and damage scaling in `startCombat` and `intentDamage`, `CLASSES` (HP, gold, relic, potions, special move cost), and the weights in `rollType` and `shapeWeight`.
