# Longshot Mod API — cross-reference (PR #1958)

2026-11-21. Source: `git.magicbean.dev/MagicBeanDev/Longshot`, branch `mod-api`
(draft PR #1958 → main, 4,768 files). **GPL-3.0-or-later** (same as the 2026-11-18
cross-reference): facts extracted and re-verified below; nothing committed to this
repo, verbatim files kept only in gitignored `local/` for re-verification. The host
process is **Triforce — our own local install**, so this API targets the
exact build our saves come from. Extract (schemas, docs, host headers):
`local/longshot-modapi/` (gitignored).

Status to keep in mind: **draft/preview**. Their write path is "written and tested
against a fake game; not yet checked in the real game" (first real-game run
2026-11-20). Nothing here is merged to `main` yet.

## 1. Flag names sourced from the game's own code (the data win)

Longshot recompiles the game's code, so its flag names come from the game itself,
with function addresses. Two of our open questions are now named:

- **The small-key count field** — `host/game/items.c`: dungeon members are
  "ordinary saved flags named `DungeonInfo.<dungeon>.<member>`"; members are
  `IsGetMap`, `IsGetCompass`, `IsGetBossKey`, `SmallKeyNum`; small keys have **two**
  fields, `SmallKeyNum` (held now) and `SmallKeyTotalNum` (got ever). Read by
  `QueryDungeonGetSmallKeyNum` (`f_82a0bb10`), set by `OneShotDungeonGet*`.
  Neither name is in our key table yet — consistent with lazy materialization (the
  other three members *are* in the table, 64 `DungeonInfo.*` entries). This upgrades
  the Links-Toolbox candidate from "guess" to "named by the game's own recompiled
  code with its reader function". In-game bar unchanged: a small-key-pickup diff
  confirms it.
- **The is-child flag** — `player.setAge` writes `Sequence_IsChildhood` (in our
  key table, named in the 2026-11-18 cross-ref). The new fact: it is *the* flag the
  game's age change goes through — Links-Toolbox's `PlayerStatus.IsChild` guess is
  superseded.

Their item system's dungeon list is the same 13 `DungeonInfo.*` dungeons in our
table **plus `GerudoTrainingGround`** (no entries in our key table — either
lazy-materialized or not save-tracked; already in the 2026-11-18 banc table).

## 2. Corroboration — everything resolves in our key table

All of the following re-hash (Murmur3 x86_32, seed 0) to keys in `local/names.json`:

| Longshot name | What it is | In our table |
|---|---|---|
| `PlayerStatus.Life` / `MaxLife` / `CurrentRupee` | hearts / containers / rupees | yes (our trainer already uses these) |
| `Sequence_CurrentBanc`, `Sequence_IsLoadingBanc` | current map / map-loading | yes |
| `Sequence_IsChildhood` | child/adult | yes |
| `MapIconDeactivateByAreaActor` | minimap-hidden saved switch | yes |
| `KokiriForest_Npc_Kokiri_007_Child_Blocker_00` / `_Blocker` | open-forest state | yes |
| `Market_Child_TimeTempleDoor_Opened` | Door of Time | yes |
| `Npc_Hylia_Soldier_003_GateOpen` | Kakariko gate | yes |
| `IsGet.Item_Token_Gerudo` | Gerudo card | yes |
| `GanonCastle_IsOpenMainGate` | castle main gate | yes |
| `InsideGanonCastle_Dungeon_BarrierRemove_<trial>` ×5 | trial barriers (+ our `HavePlayedEvent.` variants) | yes |
| `InsideGanonCastle_IsAllBarrierClear` | all trials cleared | yes |
| `DungeonInfo.InsideGanonCastle.IsGetBossKey` | Ganon boss key | yes |
| `DungeonInfo.<D>.IsGetMap/IsGetCompass/IsGetBossKey` | dungeon items | yes (all 13 dungeons) |

Not in our table: `OptionData.VoiceLanguage` (options.sav side — expected).

## 3. Save-format facts (for docs/save-format.md)

- **The in-memory GameDataMgr is the save's GameData container, layout documented**
  by the host (`host/game/flags.c`). The container headers are the same six offsets
  found in the 2026-11-18 cross-reference (Bool `0x008`, Int `0x0c8`, Float `0x188`,
  Enum `0x248`, String64 `0x608`, UInt `0x788`; each header: count `+8`, entries
  `+16`, `{u32 hash, u32 entry}` table `+24`, size `+36`). What the mod-api host
  adds: the per-kind entry stride/value table (Bool `0x18`/`0x16`, Int `0x28`/`0x1c`,
  Float `0x28`/`0x1c`, Enum `0x38`/`0x1c`, String64 `0x108`/`0x68` pointer,
  UInt `0x28`/`0x1c` — matching our measured live records in
  docs/live-memory.md) and the **64-bit key table at `+0xc58`**: count `+0`,
  entries `+8`, 16 bytes each, placement id `+0`, value `+12` — the live twin of
  our u64-key table. A live-process reader can therefore walk the running game's
  state exactly the way we parse `progress.sav`.
- **How writes reach the save**: a Bool written through the game's own setter goes
  to the save's copy with it (the game saves as usual, next player save or
  autosave). Int counters are written in place — whether they reach the save is
  "not yet checked in the game". The save format never changes; a save a mod wrote
  to loads in the unmodded game.
- **The game's own ranges**: `PlayerStatus.Life` 0…`MaxLife` (quarter hearts),
  `PlayerStatus.CurrentRupee` 0…999 — 999 is the hard rupee cap, distinct from
  wallet size (which is read-only in their API).
- **Flags the game treats as write-dangerous** (refused for mods):
  `Sequence_IsChildhood`, `Sequence_IsLoadingBanc`, `MapIconDeactivateByAreaActor`
  ("set anywhere else, the minimap stays hidden in that save for good"),
  `PlayerStatus.MaxLife`, `OptionData.VoiceLanguage`.
- **Life quirk** (found in their first real-game run): the game copies Link's life
  component into `PlayerStatus.Life` every frame, so a flag-only write is undone a
  frame later; the host now writes the component too. Any live writer of hearts
  must write both the flag and the live component.

## 4. Use for the tracker / a live process

- **Tracker (read side)**: nothing to change in the tracker itself — it parses
  saves, and a Mod-API mod runs in a separate Longshot host, not in our Electron
  app. The value is (a) the named fields above, and (b) when the branch ships, the
  host's full community flag-name list (spec 9.2) plus its flag enumerator
  (`game_flag_slot`) would let us **bulk-name every key in progress.sav** — the
  1,000+ hash-only fields would get names in one import. The branch today ships
  only the ~11 flags the host itself uses (the generated
  `host/modapi/longshot_api.h` carries only deny/range/kinds tables).
- **Live process (trainer side, private project)**: the host documents the exact
  guest addresses it uses for this same build — GameDataMgr holder `0x84c9e180`,
  the game's Bool setter `0x806a2b20` (`host/modapi/flag_set.c`) — recorded in
  `local/longshot-modapi/flags.h`. The setter path is the safer write design:
  writing through the game's own setter makes the game queue the save's copy, so
  the write persists without touching saves. The container/Bool64bitKey offsets
  (§3) locate the live tables in-process the same way we parse the file.

## 5. Not useful yet

- Draft branch; the released Triforce build has no mod layer installed (no `mods/`
  in the install dir).
- API writes are preview-stage and exclude exactly what a trainer most needs:
  heart containers and the wallet are "not written, and why" (hearts are progress
  the game gives with items; wallet read-only).
- No bulk name list in the branch yet (see §4).

## 6. Follow-ups

1. Small-key diff (pick up one → in-game Save → diff): confirm
   `DungeonInfo.<D>.SmallKeyNum` / `SmallKeyTotalNum` → promotes the field to
   confirmed and closes the "Still unknown" entry.
2. When `mod-api` merges/releases: install the `flag-tracker` example mod, watch
   its named reads against our live reads (third independent live source), and look
   for the community name list for a bulk import.
