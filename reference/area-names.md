# Area names: game stage names → checklist regions

The tracker shows "Remaining here" by mapping the game's current-area string to a region
from `data/logic.json`. This document lists the adult/child area names the game reports
and where they belong, so gaps like `IngoRanch` (adult Lon Lon Ranch) are findable in one
place.

Manually maintained — updated 2026-11-22 from the key catalog, live stage reads
(2026-11-17/18), and `caption.sav` area strings from reference saves.

## How the area string is formed

- **Stage part**: the game's current banc/stage name (`Sequence_CurrentBanc`; the key
  catalog's `HavePlayedEvent.Dm_SY_BancChangeArrive_<name>` events fire on arrival, so
  the event name is the stage name). The stage may carry an era suffix: `_Child`,
  `_Adult`, or none (e.g. `HyruleField_Adult`, `Market_Child`, `HyruleCastle`).
- **Sub part**: when the stage's location list names a place inside the stage, the
  tracker appends `/<last entry>` (`src/gamedata/live.ts areaFrom`):
  `HyruleField_Adult/IngoRanch`, `Market/TimeTemple`.
- The string is stored in `caption.sav` per slot (e.g. `"Market/TimeTemple"`) and read
  live from the location list while the game runs.
- **Resolution** (`src/core/areas.ts regionsForArea`): strip a trailing `_Child`/`_Adult`,
  lowercase, then the `ALIASES` table (e.g. `market` → Hyrule Castle Town, `ingoranch` →
  Lon Lon Ranch), then exact slug or prefix match against the region slugs. Anything
  unmatched leaves "Remaining here" empty — that was the IngoRanch bug (fixed in
  `a611262` with the `ingoranch` alias).

**Verified** by running `regionsForArea` over every name below (probe kept at
`local/probe/area-check.ts`). Evidence sources:

- Stage vocabulary: `Dm_SY_BancChangeArrive_*` events in the game's full key catalog
  (kept in the maintainer's local probes), plus its `IsVisitLocation.*` entries.
- Observed stages: live stage reads during in-game sessions (2026-11-17/18; the
  maintainer keeps a stage registry of observed stages, sub-locations, and predicted
  era variants derived from these reads).
- Observed area strings: `caption.sav` of the reference saves, dumped with
  `npm run sav -- dump`.

## Stage names (the area string without a sub)

The catalog contains 46 raw `BancChangeArrive` event names; they collapse to 27 unique
base areas. The numeric suffixes some catalog names carry (e.g.
`DeathMountainTrail01_02_Child`, `InsideGanonCastle02_Child`) are internal scene
identifiers — at runtime the banc name is the bare base area plus its era suffix, so
`DeathMountainTrail_Child` is the real stage, not `DeathMountainTrail01_02_Child`.

| Game stage name | Region (data/logic.json) | Resolves via | Child era | Adult era |
|---|---|---|---|---|
| `KokiriForest` | Kokiri Forest | exact | observed | — (adult Kokiri is `SacredForestMeadow`) |
| `Kokiri` | Kokiri Forest | exact (banc variant) | banc name | — |
| `SacredForestMeadow` | Kokiri Forest | exact | observed (live 2026-11-18) | expected |
| `HyruleField` | Hyrule Field | exact | observed | observed |
| `HyruleCastle` | Hyrule Castle | exact | observed (no era suffix seen) | expected |
| `Market` | Hyrule Castle Town | alias `market` | observed | observed |
| `KakarikoVillage` | Kakariko Village | exact | observed | expected |
| `DeathMountainTrail` | Death Mountain Trail | exact | observed | expected |
| `DeathMountainCrater` | Death Mountain Crater | exact | observed | expected |
| `InsideDeathMountainCrater` | Death Mountain Crater | exact | expected (catalog, `_Child`/`_Adult` present) | expected (catalog) |
| `GoronCity` | Goron City | exact | observed | expected |
| `Graveyard` | Graveyard | exact | observed | expected |
| `UnderTheGrave` | Bottom of the Well | **alias needed** | child dungeon; banc `…_UnderTheGrave_02` | — |
| `UndetTheGrave` | Bottom of the Well | **alias needed** | typo'd banc variant `…_UndetTheGrave_01` (game's own key) | — |
| `BottomOfTheWell` | Bottom of the Well | exact | alternative runtime name (`IsVisitLocation`) | — |
| `IceCavern` | Ice Cavern | exact | — | — |
| `IceCaven` | Ice Cavern | **alias needed** | banc names `…_IceCaven_01/_02` (no "r"; the rest of the catalog spells it `IceCavern`) | — |
| `LostWood` | Lost Woods | alias `lostwood` | observed | expected |
| `ZoraFountain` | Zora's Fountain | exact | expected (catalog) | expected (catalog) |
| `ZoraDomain` | Zora's Domain | exact | expected (catalog) | expected (catalog) |
| `ZoraRiver` | Zora's River | exact | expected (catalog) | expected (catalog) |
| `GerudoValley` | Gerudo Valley | exact | expected (catalog) | expected (catalog) |
| `GerudoFortress` | Gerudo Fortress | exact | expected | observed (live + caption.sav) |
| `GerudoTrainingGround` | Gerudo Training Ground | exact | — | — (rooms in key catalog) |
| `DesertColossus` | Desert Colossus | exact | observed | expected (catalog) |
| `GanonCastle` | Ganon's Castle | alias `ganoncastle` | — | — |
| `InsideGanonCastle` | Ganon's Castle | alias `insideganoncastle` | expected (catalog) | expected (catalog; a `…02` scene variant also appears in the catalog) |
| `InsideTheDekuTree` | Great Deku Tree | alias `insidethedekutree` | — | — |
| `DodongoCavern` | Dodongo's Cavern | alias `dodongocavern` | — | — |
| `FireTemple` | Fire Temple | exact | — | — |
| `WaterTemple` | Water Temple | exact | — | — |
| `ForestTemple` | Forest Temple | exact | — | — |
| `ShadowTemple` | Shadow Temple | exact | — | — |
| `SpiritTemple` | Spirit Temple | exact | — | — |
| `InsideJabuJabuBelly` | Lord Jabu-Jabu's Belly | alias `insidejabujabubelly` | expected (catalog) | expected (catalog) |
| `LakeHylia` | Lake Hylia | exact | expected (catalog) | expected (catalog) |

"observed" = seen live or in `caption.sav`; "expected" = follows from the game's era
suffixes (`_Child`/`_Adult`/none) or the catalog's `_Child`/`_Adult` variants but not
yet seen; "—" = not an area for that era.

Notes on the era suffix:

- Era-dependent stages carry `_Child`/`_Adult`; era-independent stages are bare.
  `HyruleCastle` was observed bare — consistent.
- `SacredForestMeadow_Child` was observed live, so the child-era name is direct rather
  than falling back to `KokiriForest` (both are real, separate stages: `KokiriForest`
  is the child's starting home, `SacredForestMeadow` its later form — mirroring the
  original game's naming).

## Sub-locations (the part after the slash)

Location-list entries; can themselves carry era suffixes, which the resolution strips.
Inside a stage, sub-locations are told apart by a per-position zone id (e.g.
`0x46920F1B`) plus coordinates; the location list the tracker reads is a separate table.

| Game name | Region | Resolves via | Era | Evidence |
|---|---|---|---|---|
| `LonLonRanch` | Lon Lon Ranch | exact | child (list of `HyruleField`) | stage registry sub-locations; `LocationName` in caption.sav |
| `IngoRanch` | Lon Lon Ranch | alias `ingoranch` (`a611262`) | adult (list of `HyruleField`) | live report `HyruleField_Adult/IngoRanch` |
| `LakeHylia` | Lake Hylia | exact | child list; expected same adult name | stage registry sub-locations |
| `TimeTemple` | Hyrule Castle Town | exact | both (list of `Market`) | caption.sav `Market/TimeTemple` (child and adult saves) |
| `GoronCity` | Goron City | exact | both (list of `GoronCity`) | stage registry sub-locations |
| `Market_Child` / `Market_Adult` | Hyrule Castle Town | era strip + alias `market` | both | caption.sav `Market/Market_Child` |
| `KokiriForest_Child` | Kokiri Forest | era strip + exact | child | caption.sav `KokiriForest/KokiriForest_Child` |
| `GerudoFortress_Adult` | Gerudo Fortress | era strip + exact | adult | caption.sav `GerudoFortress/GerudoFortress_Adult` |

The adult Hyrule Field location list is only partially known (IngoRanch confirmed, the
child entries LakeHylia/LonLonRanch unconfirmed for the adult era). If the game ever
reports a sub there that isn't listed, the same alias treatment applies.

## Area strings observed in real saves

| Area string | From |
|---|---|
| `KokiriForest/KokiriForest_Child` | caption.sav, child-era save (rekarina-ref, rekarina-door-of-time) |
| `Market/Market_Child` | caption.sav, child-era save (rekarina-adult slot_00) |
| `Market/TimeTemple` | caption.sav, child **and** adult saves (rekarina-adult, rekarina-door-opened) |
| `HyruleField/HyruleField_Child` | caption.sav, child-era save (rekarina-adult slot_00) |
| `HyruleField/HyruleField_Adult` | caption.sav, adult-era save (rekarina-gerudo slot_01) |
| `GerudoFortress/GerudoFortress_Adult` | caption.sav, adult-era save (rekarina-gerudo slot_00) |
| `HyruleField_Adult/IngoRanch` | live (reported in-game 2026-11-20) |

## Gaps found (aliases to add in `src/core/areas.ts` ALIASES)

Everything above resolves except these three names, which exist in the game's own key
catalog as stage/banc names but match no region slug:

| Lowercase key to add | Region value | Why |
|---|---|---|
| `underthegrave` | `Bottom of the Well` | banc `Dm_SY_BancChangeArrive_UnderTheGrave_02` |
| `undetthegrave` | `Bottom of the Well` | typo'd banc `Dm_SY_BancChangeArrive_UndetTheGrave_01` — the catalog genuinely has both spellings |
| `icecaven` | `Ice Cavern` | banc names `…_IceCaven_01/_02` (no "r"), while `IsVisitLocation.IceCavern` has the "r" |

No new sub-location aliases are needed beyond `ingoranch` (already added in `a611262`).
