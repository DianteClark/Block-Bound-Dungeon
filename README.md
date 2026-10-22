# Block Bound Dungeon

A block-blasting roguelike dungeon crawler that runs in a single HTML file — no build step, no dependencies.

## Play

Open `index.html` in any modern browser (desktop or phone). To host it for free, turn on **GitHub Pages** for this repo (Settings → Pages → Deploy from branch → `main` / root).

## How it works

- **Grid combat.** Drag pieces onto an 8×8 grid. Fill a full row or column to clear it — Block Blast style.
- **Blocks are actions.** When a line clears, every block in it fires:
  - 🟥 **Sword** — damages the enemy
  - 🟦 **Shield** — blocks incoming damage
  - 🟩 **Heart** — heals you
  - 🟨 **Coin** — earns gold
- **Combos.** Clearing several lines at once multiplies everything (×1.5, ×2, ×3…). Clearing on back-to-back moves builds a streak bonus on top.
- **Turns.** Every piece you place is one turn. Enemies telegraph their next move with a countdown: attacks, armor, healing, or dropping rubble onto your grid.
- **Cave-ins.** If none of your pieces fit, the ceiling collapses: you take damage and the two fullest rows are cleared.
- **The run.** 3 floors × 8 rooms. Pick your path through fights, elites, campfires, merchants, treasure and mystery events, then face each floor's boss: the Bone King, the Hydra, and the Ancient Dragon.
- **Relics.** 18 relics that bend the rules — Black Powder, Vampire Fang, Prism Shard (rainbow blocks), Phoenix Feather and more.

## Code layout

Everything lives in `index.html`:

| Section | What's there |
| --- | --- |
| `data` | Block types, piece shapes, relics, boons, enemies, room types |
| `run state` | Run setup, relic helpers |
| `map` / rooms | Path choices, campfire, shop, treasure, events |
| `combat` | Placement, line clears, damage/combo math, enemy intents |
| `canvas rendering` | Board, tray, drag preview, clear effects |
| `input` | Pointer-event drag and drop (mouse + touch) |

Tuning knobs worth knowing: `MULT` (combo multipliers), `ENEMIES` (HP and move patterns), the floor scaling in `startCombat`, and the weights in `rollType` / `shapeWeight`.
