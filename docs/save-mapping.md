# Save mapping status

- Checklist: `data/checklist.json`, built from `docs/checklist-source.txt` by `npm run build-checklist`.
- Mapping: `data/save-mapping.json`, keyed by checklist ids. Each entry has a `detect` rule, a
  `confidence` level and an `evidence` note. Counter categories (Big Poes, bean spots) are under `counters`.

Check any time with:

```
npx tsx scripts/mapping-report.ts          # per-category summary
npx tsx scripts/mapping-report.ts --all    # every entry, per fixture slot
npm test                                   # includes: every rule reads keys that exist in a real save
```

## Confidence levels

| Level | Meaning |
|---|---|
| **confirmed** | Seen changing in a diff at the moment the thing was collected |
| **likely** | The flag name (recovered from the game files) says what it is, or an MIT save editor maps it the same way, and all six slots agree |
| **guess** | Indirect inference. Shown in the tracker, but needs a diff |

## Status per category

| Category | Part | Mapped | Confidence |
|---|---|---|---|
| Heart Pieces | A | 31/36 | 21 likely, 10 guess; 5 chest pieces unmapped |
| Heart Containers | A | 8/8 | 1 likely, 7 guess |
| Gold Skulltulas | A | 100/100 | 1 confirmed, 16 likely, 83 guess (area counts exact) |
| Songs | A | 13/13 | 1 confirmed, 12 likely |
| Equipment | A | 12/12 | 2 confirmed, 10 likely |
| Items | A | 27/27 | 3 confirmed, 23 likely, 1 guess (Double Magic) |
| Key Items | A | 1/1 | likely |
| Masks | A | 5/5 | likely |
| Bottles | A | 5/5 | 3 likely, 2 guess |
| Great Fairies | A | 5/6 | 3 likely, 2 guess (Hyrule Castle fairy unmapped) |
| Capacity Upgrades | A | 14/14 | likely |
| Stones & Medallions | A | 9/9 | likely |
| Dungeons Cleared | A | 12/12 | likely |
| Bosses | A | 10/10 | likely |
| Mini-bosses | A | 10/10 | 9 likely, 1 guess (Iron Knuckle) |
| Side Quests | A | 6/6 | 5 likely, 1 guess (windmill/well) |
| Big Poes Sold | A | counter | guess |
| House of Skulltula Rewards | B | 6/6 | likely |
| Child / Adult Trading Sequence | B | 3/3, 11/11 | likely |
| Magic Bean Spots Planted | B | counter | guess |
| Maps, Compasses & Boss Keys | C | 26/26 | 2 confirmed, 24 likely |
| amiibo Retro Masks | C | 2/2 | guess |

**Summary row:** max hearts = `PlayerStatus.MaxLife` / 4 (read directly), tokens =
`PouchData.Item_Token_Gold.StockNum`, next reward from the House of Skulltula table.

## How the main kinds of flags work

- `IsGet.<item>` = **ever obtained** (stays true after trading an item away). Used for items,
  equipment, masks, songs, stones, upgrades and trade items.
- `DefeatedEnemyNum.Enemy_<name>` = kill counters. Used for bosses and mini-bosses. The
  `HaveDefeatedEnemy_*` bools stay false after a kill, so they are not used.
- `HavePlayedEvent.Dm_<Dungeon>_BossOut` = the cutscene after a boss. Used for dungeon clears.
- **Quest steps.** Each quest is an enum key named `Step_<Quest>` whose value moves through named
  steps and ends at `Complete`. The game's own `<Quest>_IsCompleted_Exp` expressions (from the
  GameDataList) are exactly "`Step_<Quest>` == Complete", so the side quests use the same test.
- `DungeonInfo.<Dungeon>.IsGet{Map,Compass,BossKey}` for Part C.
- **Placed objects (Gold Skulltulas, heart pieces lying in the world)** use the 64-bit flags. The
  flag is the object's **placement id** from the level files (`romfs/Banc/**/*.bcett.byml.zs`).
  A Gold Skulltula sets two flags when its token is taken: its id, and its id with bit 1 flipped.
  Confirmed by diff (Deku Tree 3F → `0xBCE05898CE61F1C0`) and by the old playthrough: exactly 15
  Skulltula ids are set in every slot, matching its 15 tokens. Objects placed in both the child and
  adult maps share one id, which brings the 114 placements down to exactly 100.
  `npx tsx scripts/extract-placements.ts <romfs>` writes `local/placements.json` (gitignored);
  `npx tsx scripts/map-placements.ts` turns it into mapping entries.
- **Heart-piece anchors.** The level files have one `HeartPieceAnchor` per heart piece (36). Event
  pieces name their bool flag in the anchor (16 of them); 14 sit on a placed heart piece; 6 sit
  next to a chest.
- **Chests** do *not* store "opened" under their placement id (none of 190 chest ids is set in a
  save where many chests were opened), so chest heart pieces still need diffs.
- **Within one area**, the level files don't say which Skulltula is which checklist row. Those rows
  share a pool: the area's count is exact and tiles fill in order. Matched one-to-one where the
  area has a single candidate or the row says "Soft soil" (placement flag `IsMagicBeanSoil`).
- **Autosaves rotate across all six slots**, so the slots are usually the same playthrough at
  slightly different points. "Most recent" is the right default.
- Things that did **not** behave as named: `IsGet.Item_FairyBless_MP` stays false even with a
  magic meter (`PlayerStatus.MPMax` = 240 is used instead), and `IsGet.Item_NormalBoot` stays false.

## Diff tasks (along a normal route)

Use `npm run sav -- snap <label>` right **before** and right **after** each step (let the game
save first). It copies the most recent save and prints what changed. A baseline of slot_05 is in
`fixtures/snapshots/`.

Done 2026-11-10 (fresh save): Kokiri Sword, Deku Shield, Deku Sticks, Deku Nuts, Fairy Slingshot,
Deku Tree map and compass, Gold Skulltula Deku Tree 3F. All confirmed.

1. **Any Gold Skulltula in an area with several**: each before/after pair pins one pooled tile to
   its exact spot. Just label the snapshot with the checklist number (e.g. `after-gs-2`).
2. **A chest heart piece** (#4, #16, #30, #33, #35): shows how chests store "opened".
3. **Volvagia, split in two**: snap after the boss dies but *before* touching the Heart Container,
   then again after picking it up. Fixes the 7 guessed containers.
4. **Fire Temple mini-boss (Flare Dancer)**: confirms the kill counters.
5. **Hyrule Castle Great Fairy (child)**: tells us which of `Dm_FairyFountain_{Power,Wisdom,Courage}` it is.
6. **10-token House of Skulltula reward** (you already have 15): confirms `GetReward10` and the Adult's Wallet.
7. **Next bottle** (Potion Shop bug, Cucco Lady or Talon's game).
8. **Selling a Big Poe**: confirms what `GhostShop_CouponNum` counts.
9. **Planting a Magic Bean**: confirms the soft-soil flags.
10. **Double Magic / Double Defense fairies** when you get there: checks whether their `IsGet` flags get set.
11. **Song of Storms in the windmill**: confirms the unnamed windmill/well quest key `0x7A5B9537`.

## Still unknown

- Which pooled Skulltula / world heart piece is which checklist row (83 + 9 tiles).
- How chests store "opened" (5 chest heart pieces).
- The Hyrule Castle Great Fairy (spin attack).
