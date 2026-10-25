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
- **Hero specials.** Clearing lines charges your hero's special move: Knight *Bulwark*, Rogue *Shadowstep*, Mage *Meteor*, Berserker *Rampage*, Necromancer *Raise Dead*, Alchemist *Transmute*, Paladin *Smite*, Ranger *Volley* and Bard *Encore*.
- **Turns.** Every piece you place is one turn. Enemies telegraph their next move with a countdown: attacks, multi-hits, life drain, armor, healing, rage, rubble, ice, petrify (turns your blocks to stone), sap (drains your special), shuffle (rerolls your hand) and steal (takes your gold). Bosses enter a tougher **Phase 2** at half HP.
- **Damage preview.** While you drag a piece over the grid, a pill shows exactly what the clear will do: multiplier, damage, shield, healing, gold and poison.
- **Enemy intents** show what the enemy does next, how many moves away it is, and the move after that.
- **Stash.** Drag a piece into the Stash beside your tray to save it for later; stashing doesn't cost a turn (once per move).
- **Cave-ins.** If no piece fits in any rotation, the ceiling collapses: you take damage and the two fullest rows are cleared.

## The run

- **9 heroes.** Knight, Rogue and Mage from the start; unlock the Berserker, Necromancer, Alchemist, Paladin, Ranger and Bard through play or with Soul Shards.
- **Hero Mastery.** Every hero levels up as you play them, unlocking perks up to Mastery 5.
- **Pets.** Adopt a companion in a Beast Den: Bat Familiar, Pet Slime, Shell Buddy, Friendly Wisp, Lucky Rat, Weaver or Ember Imp. Pets act on their own every few moves.
- **5 floors with a branching map.** Choose your route down through fights, elites, campfires, merchants, treasure, mystery events, Beast Dens and Forges to the boss at the bottom of each floor: the Bone King, the Hydra, the Ancient Dragon, the Frost Lich and the Demon Lord.
- **Daily Challenge.** One shared dungeon per day with a fixed hero, map and mutators. Score points, beat your best, and earn bonus Soul Shards on your first finish.
- **Mutators.** Optional run twists such as Glass Cannon, Hasty Foes or Teetotaler; harder mutators earn more Soul Shards.
- **Relic Sets.** Relics belong to six families (Gold, Blood, Arcane, Iron, Blast and Wild). Hold three from one family to unlock its set bonus.
- **Wardrobe.** Unlock and equip seven board themes.
- **Endless Depths.** After beating the Demon Lord, keep descending through ever-harder floors.
- **Treasure Goblins** sometimes appear in place of a fight. Catch them before they run off with their loot.
- **Heat levels.** Winning unlocks Heat 1 to 5, each adding a new challenge.
- **Enemy passives:** Armored, Regenerates, Ethereal, Thorns and Enrages.
- **Skill Tree.** Every run earns Soul Shards. Spend them on 10 permanent upgrades such as Vitality, Quick Hands, Focus and Treasure Sense.
- **59 relics**, **9 potions** (tap a potion twice to drink it), **Blast blocks** that set off everything around them, and permanent block upgrades.
- **15 mystery events**, and campfires where you can rest, train, upgrade or meditate to charge your special.
- **Codex** of every monster and relic you've discovered, and **33 trophies** to unlock.
- **First-fight tips** walk new players through the basics (replay them from Settings).
- **Daily Quests.** Three new quests every day, each worth Soul Shards, plus a bonus for finishing all three.
- **Journal** of your recent runs and lifetime records.
- **Auto-save.** Your run is saved constantly, even mid-fight, so you can close the app any time and continue exactly where you left off.
- **Settings** (gear icon): music, sound effect and ambience volume; screen shake, flashes, reduce motion, high-contrast blocks and damage numbers; game speed, left-handed layout, vibration and tips; **backup and restore codes** to move your progress between devices; abandon run and reset all data.
- **Sound.** Every action has its own synthesized sound, music shifts between menu, map, shop, campfire, combat, boss and Endless moods with crossfades, and a dungeon ambience layer adds wind, dripping water and campfire crackle.
- **Effects.** Cleared blocks launch projectiles at their targets, cleared lines flash with light beams, placed blocks pop in, and your hero marks your spot on the map. Tap an enemy to see its full move pattern.

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
