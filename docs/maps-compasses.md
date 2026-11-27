# Maps & compasses

Status: logic done (2026-11-26), save flags mapped, in-game confirmations in progress
(runbook: "Maps & compasses checks"). The category stays where it is — part C, not
counted toward 100% — until the maintainer decides otherwise.

## What is tracked

The ten standard dungeons, each with a map and a compass (checklist rows
`dungeon_items#1`–`#20`, part C):

| Rows | Dungeon | Save flag (regular Bool entry) |
|---|---|---|
| #1, #2 | Great Deku Tree | `DungeonInfo.InsideTheDekuTree.IsGetMap` / `.IsGetCompass` |
| #3, #4 | Dodongo's Cavern | `DungeonInfo.DodongoCavern.IsGetMap` / `.IsGetCompass` |
| #5, #6 | Lord Jabu-Jabu's Belly | `DungeonInfo.InsideJabuJabuBelly.IsGetMap` / `.IsGetCompass` |
| #7, #8 | Forest Temple | `DungeonInfo.ForestTemple.IsGetMap` / `.IsGetCompass` |
| #9, #10 | Fire Temple | `DungeonInfo.FireTemple.IsGetMap` / `.IsGetCompass` |
| #11, #12 | Water Temple | `DungeonInfo.WaterTemple.IsGetMap` / `.IsGetCompass` |
| #13, #14 | Shadow Temple | `DungeonInfo.ShadowTemple.IsGetMap` / `.IsGetCompass` |
| #15, #16 | Spirit Temple | `DungeonInfo.SpiritTemple.IsGetMap` / `.IsGetCompass` |
| #17, #18 | Ice Cavern | `DungeonInfo.IceCavern.IsGetMap` / `.IsGetCompass` |
| #19, #20 | Bottom of the Well | `DungeonInfo.BottomOfTheWell.IsGetMap` / `.IsGetCompass` |

The Great Deku Tree pair was confirmed against the 2026-11-10 save snapshots; the
other eighteen were mapped from the game's name table and are *likely* until each is
picked up once with the change log on (see the runbook). In the 2026-11-19 playthrough
log, the Dodongo's Cavern map and compass also flipped at exactly the pickup moment —
see the runbook for which flags are still to be confirmed.

## Logic

Each pair is offered once its dungeon is reachable **and** the items that reach its
chest are held — never on a `<Dungeon>Done` macro: the map and compass chests sit
inside the dungeon, *before* the boss, so a Done gate would only offer them after the
player no longer needs them. The region graph already covers getting into the dungeon;
the gate below is what's needed beyond entry. Floors are from the Switch 2 remake
walkthroughs (several differ from the original); the `unsure` rows still need the
in-game runbook below.

| Rows | Dungeon | Age | Gate beyond entry |
|---|---|---|---|
| #1, #2 | Great Deku Tree | child | entry only |
| #3, #4 | Dodongo's Cavern | child | `Explosives` |
| #5, #6 | Lord Jabu-Jabu's Belly | child | `Boomerang` |
| #7 | Forest Temple | adult | entry only (map in the courtyard alcove; the Hookshot it takes is already in entry) |
| #8 | Forest Temple | adult | `Bow` (blue Poe's wing) |
| #9 | Fire Temple | adult | entry only (map in the 3F boulder-maze alcove) |
| #10 | Fire Temple | adult | `Bow` (eye switch in the walkway room) |
| #11 | Water Temple | adult | `WaterTempleGear and ZeldasLullaby` (lower the water, float up to the top floor) |
| #12 | Water Temple | adult | `Hookshot and Explosives` (remake: 1F bombable wall, switch, Hookshot over the Like Like — the original's spot moved) |
| #13 | Shadow Temple | adult | `Hookshot and Lens` (B1 false wall) |
| #14 | Shadow Temple | adult | `Hookshot and Lens and Explosives` (B2, past the Beamos) |
| #15 | Spirit Temple | adult* | `Sticks` (child-side 2F fountain hall; *the region graph only models the temple as adult-reachable, so the row keeps `age: adult` — open question, see runbook) |
| #16 | Spirit Temple | adult | `Strength2 and Explosives and ZeldasLullaby and (Hookshot or Longshot)` (push the block, Beamos, ceiling switch, Lullaby on the Triforce, shot to the chest) |
| #17, #18 | Ice Cavern | adult | `Bottle` |
| #19, #20 | Bottom of the Well | child | `ChildWeapon` |

Why the Deku Tree pair is gated on entry only: the 2026-11-10 snapshot series shows
the map picked up *before* the Slingshot, which the remake gives later than the
original did. Gating it on the Slingshot contradicted a real save, so the pair uses
the entry requirement (child with Kokiri Sword and a shield) that the region graph
already enforces.

The Done macros themselves remain in use by the dungeon stones (medallions); only the
map/compass rows stopped using them.

Verification (the audit method from `docs/logic-audit.md`): every fixture save was
run through the logic — no save shows a map or compass flag set that the logic says
was ungettable. Covered by a test that re-runs this on every fixture save present.

## Does the remake add maps & compasses elsewhere?

The question on the table: Gerudo Training Ground and Ganon's Castle. The game's name
table (6,688 keys, taken from the game files on 2026-11-11, kept in `local/names.json`)
contains, beyond the ten dungeons above:

- `DungeonInfo.GerudoFortress.IsGetMap` / `DungeonInfo.GerudoFortress.IsGetCompass`
- `DungeonInfo.InsideGanonCastle.IsGetMap` / `DungeonInfo.InsideGanonCastle.IsGetCompass`
- `DungeonInfo.FinalBattleField.IsGetMap` / `DungeonInfo.FinalBattleField.IsGetCompass`

So the remake's code *references* map/compass flags for the Gerudo Fortress (the
training ground is inside it), the Ganon's Castle interior and the final battle area —
the original had none of those. A name in the table is not proof the items exist in
game (the flag may be vestigial or serve some other purpose), so **no checklist rows
were added** — this is report-only.

State of those flags in the latest saves (Rekarina, 2026-11-23, all six slots):
`GerudoFortress` and `FinalBattleField` map/compass are false in every slot, including
slot 5, where the Water Temple, Ice Cavern and Bottom of the Well are already done —
well past the point where a Gerudo map would be picked up. That is consistent with the
flags being vestigial, but not proof (the flag might be tied to a pickup that simply
never happened). The change-log check on entering the fortress stays the decisive test.

To settle it: next time the Gerudo Fortress / training ground, the Ganon's Castle
interior or the final battle area are entered with the tracker open, watch the change
log. If `DungeonInfo.GerudoFortress.IsGetMap` (or the others) flips `true` at a pickup,
the remake does give a map and compass there — then the rows, mapping entry and logic
follow on their own card.
