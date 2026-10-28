# Block Bound Dungeon

A block-puzzle roguelike. Drag pieces onto an 8x8 grid, clear full rows and columns, and every block in a cleared line fires at the monster in front of you. Fight down five dungeon floors to the Demon Lord.

Play it at **https://dianteclark.github.io/Block-Bound-Dungeon/**. On iPhone, tap Share, then Add to Home Screen, to play it as a full-screen app that works offline.

This is the rebuilt core of the game: three heroes and five floors, tuned with a balance lab before anything else gets added back. The previous, larger version is kept on the `classic` branch.

## How it plays

- **Pieces and lines.** You hold three pieces. Drag one onto the grid, or tap it to rotate. Fill a whole row or column to clear it.
- **Blocks fire.** Swords deal damage, shields block, hearts heal and coins pay gold. Clearing several lines at once multiplies everything, and clearing on back-to-back moves builds a combo. Lines made of a single block type are worth extra.
- **Enemies act on a countdown.** Every piece you place is one move. The intent box shows the enemy's next move, how many moves until it lands, what it will cost you after shield, and the move after that.
- **Break big attacks.** Big attacks and boss signature moves show a Break bar. Deal that much damage before they land and they never happen.
- **Combos.** Clear again within 2 moves to keep a combo going; each step adds to the multiplier. The combo meter shows how long you have.
- **Telegraphs.** Rubble and gnawing teeth mark the cells they will hit; fire breath and frost light up their column or row.
- **Shield** soaks enemy damage. Half of any leftover shield fades each time the enemy acts.
- **Bonus gold** for winning without losing HP (Flawless) and for overkill damage on the final blow.
- **Stash** one piece for later by dragging it into the Stash slot (free, once per move).
- **Cave-ins.** If nothing in your hand fits, the ceiling collapses: you take damage and the two fullest rows are cleared.
- **Specials.** Cleared lines charge your hero's special. Tap it when it glows.

## Heroes

| Hero | HP | Starter relic | Special |
|---|---|---|---|
| Knight | 68 | Oath Shield: start each fight with 6 shield | Bulwark: big shield and clears all rubble |
| Rogue | 64 | Twin Daggers: combos build faster, coins +1 | Shadowstep: fresh hand, enemy delayed, next clear doubled |
| Mage | 58 | Seer's Orb: multi-line clears get +1 to the multiplier; Rainbow blocks in the bag | Meteor: fires the fullest row and column at x2.5 |

## The run

- **5 floors**, each a branching map of fights, elites, mystery events, merchants, treasure and campfires, ending in a boss: the Rat King, the Grave Warden, the Ancient Dragon, the Frost Queen and the Demon Lord. Every boss has its own signature move and enrages at half health.
- **20 monsters and elites**, each with a readable move cycle (tap an enemy to see it).
- **19 relics** plus three starter relics, **5 potions**, **6 mystery events**.
- **Upgrades.** Fights, campfires and the smith upgrade a block type so each of those blocks fires for more (up to +3).
- **Merchant** sells relics and potions, and can remove a block from your bag.
- **Auto-save.** The run saves after every move; close the app any time and continue where you left off.
- **Settings:** music and sound volume, vibration, screen shake, reduce motion, fast animations.

## Code

Plain ES modules, no build step. The game logic never touches the page, so it runs the same in the browser and in Node.

```
index.html, styles/main.css   page shell and design system
src/data/     heroes, enemies, relics, potions, events, block types, shapes, tuning numbers (rules.js)
src/engine/   combat rules and run flow (pure logic; every action returns a list of events)
src/art/      all art, drawn as SVG in code from one sticker kit (kit.js)
src/audio/    synthesized sound effects and procedural music
src/ui/       screens, the combat canvas and input, sheets
tools/        balance lab, test bot, engine tests, art preview sheet
```

```
npm test        # engine checks (reproducibility, save/resume, previews, art coverage)
npm run lab     # balance lab: simulated runs per hero, win rates, killers, relic impact
```

To work on it locally, serve the folder (for example `python3 -m http.server`) and open `http://localhost:8000`. Open `tools/artsheet.html` to preview every sprite.
