# Block Bound Dungeon

A block-blasting roguelike dungeon crawler for the browser. No build step and no dependencies. All art is hand-made pixel art defined in code.

**Play:** https://dianteclark.github.io/Block-Bound-Dungeon/

## How it plays

- **Grid combat.** Drag pieces onto an 8x8 grid. Fill a full row or column to clear it, Block Blast style.
- **Blocks are actions.** Every block in a cleared line fires its effect:
  - **Sword** (red): damages the enemy
  - **Shield** (blue): blocks incoming damage
  - **Heart** (green): heals you
  - **Coin** (gold): earns gold
  - **Rainbow** and **Venom** blocks unlock through relics
- **Combos.** Clearing several lines at once multiplies everything (x1.5, x2, x3...). Clearing on back-to-back moves adds a streak bonus on top.
- **Turns.** Every piece you place is one turn. Enemies telegraph their next move with a countdown: attacks, multi-hits, life drain, armor, healing, rage, dropping rubble onto your grid, or freezing cells into ice (ice cracks into rubble when cleared).
- **Cave-ins.** If none of your pieces fit, the ceiling collapses: you take damage and the two fullest rows are cleared.

## The run

- **3 heroes.** Knight (shields and starting armor), Rogue (fast combos, extra gold, two potions) and Mage (rainbow blocks, explosive big clears).
- **3 floors, 8 rooms each.** Choose your path through fights, elites, campfires, merchants, treasure and mystery events. Each floor has its own monsters and a boss: the Bone King, the Hydra and the Ancient Dragon.
- **Enemy passives.** Some foes are Armored, Regenerating, Ethereal (single-line clears do half damage) or have Thorns.
- **25 relics** that bend the rules, plus **6 potions** you can drink mid-fight (tap a potion twice).
- **Permanent block upgrades** from campfires, shops, events and rewards (Sharpen, Reinforce, Bless, Gild).
- **8 mystery events** with risk and reward choices.

## Files

| File | What's in it |
| --- | --- |
| `index.html` | Layout and styles |
| `sprites.js` | Palette, every pixel-art sprite and the sprite renderer |
| `game.js` | Game data (classes, relics, potions, enemies, events) and all game logic |

### Adding art

Sprites are grids of palette letters in `sprites.js`. `.` is transparent, and `{m:true}` means you only draw the left half and it gets mirrored. `variant()` makes a recolor of an existing sprite.

### Tuning knobs

`MULT` (combo multipliers), `ENEMIES` (per-floor HP and move patterns), the HP and damage scaling in `startCombat` and `intentDamage`, `CLASSES` (starting HP, gold, relic, potions), and the weights in `rollType` and `shapeWeight`.
