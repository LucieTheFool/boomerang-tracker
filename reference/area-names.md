# Area names: game stage names → checklist regions

The tracker shows "Remaining here" by mapping the game's current-area string to a region
from `data/logic.json`. This document lists every adult/child area name the game reports
and where it belongs, so gaps like `IngoRanch` (adult Lon Lon Ranch) are findable in one
place.

## How the area string is formed

- **Stage part**: the game's current banc/stage name (`Sequence_CurrentBanc`; the key
  catalog's `HavePlayedEvent.Dm_SY_BancChangeArrive_<name>` events fire on arrival, so
  the event name is the stage name). The stage may carry an era suffix: `_Child`,
  `_Adult`, or none (e.g. `HyruleField_Adult`, `Market_Child`, `HyruleCastle`).
- **Sub part**: when the stage's location list names a place inside the stage, the
  tracker appends `/<last entry>` (`src/gamedata/live.ts areaFrom`):
  `HyruleField_Adult/IngoRanch`, `Market/TimeTemple`.
- The string is stored in `caption.sav` per slot (e.g. `"Market/TimeTemple"`) and read
  live from the location list while the emulator runs.
- **Resolution** (`src/core/areas.ts regionsForArea`): strip a trailing `_Child`/`_Adult`,
  lowercase, then exact slug match against the logic regions, then the `ALIASES` table
  (e.g. `market` → Hyrule Castle Town, `ingoranch` → Lon Lon Ranch), then region-slug
  prefix match. Anything unmatched leaves "Remaining here" empty — that was the
  IngoRanch bug (fixed in `a611262` with the `ingoranch` alias).

**Verified** by running `regionsForArea` over every name below (probe kept at
`local/probe/area-check.ts`). Evidence sources:

- Stage vocabulary: `Dm_SY_BancChangeArrive_*` events in the key catalog
  (`local/names.json`) plus its `IsVisitLocation.*` and `data/stage-names.json`
  (observed stages and sub-locations from live reads).
- Observed area strings: `caption.sav` of the rekarina-era saves (2026-11-20), dumped
  with `npm run sav -- dump`.

## Stage names (the area string without a sub)

| Game stage name | Region (data/logic.json) | Resolves via | Child era | Adult era |
|---|---|---|---|---|
| `KokiriForest` | Kokiri Forest | exact | observed (`KokiriForest_Child`) | — (adult Kokiri is `SacredForestMeadow`) |
| `Kokiri` | Kokiri Forest | exact (banc variant) | banc name | — |
| `SacredForestMeadow` | Sacred Forest Meadow | exact | — (child uses `KokiriForest`) | adult-era name, expected |
| `HyruleField` | Hyrule Field | exact | observed | observed |
| `HyruleCastle` | Hyrule Castle | exact | observed (no era suffix seen) | expected |
| `Market` | Hyrule Castle Town | alias `market` | observed | observed |
| `KakarikoVillage` | Kakariko Village | exact | observed | expected |
| `DeathMountainTrail` | Death Mountain Trail | exact | observed | expected |
| `DeathMountainCrater` | Death Mountain Crater | exact | observed | expected |
| `GoronCity` | Goron City | exact | observed | expected |
| `Graveyard` | Graveyard | exact | observed | expected |
| `UnderTheGrave` | Bottom of the Well | **alias needed** | child dungeon; banc `…_UnderTheGrave_02` | — |
| `UndetTheGrave` | Bottom of the Well | **alias needed** | typo'd banc variant `…_UndetTheGrave_01` (game's own key) | — |
| `BottomOfTheWell` | Bottom of the Well | exact | alternative runtime name (`IsVisitLocation`) | — |
| `IceCavern` | Ice Cavern | exact | — | — |
| `IceCaven` | Ice Cavern | **alias needed** | banc names `…_IceCaven_01/_02` (no "r"; the rest of the catalog spells it `IceCavern`) | — |
| `LostWood` | Lost Woods | alias `lostwood` | observed | expected |
| `ZoraFountain` | Zora's Fountain | exact | — | — |
| `ZoraDomain` | Zora's Domain | exact | — | — |
| `ZoraRiver` | Zora's River | exact | — | — |
| `GerudoValley` | Gerudo Valley | exact | — | — |
| `GerudoFortress` | Gerudo Fortress | exact | — | observed (sub `GerudoFortress_Adult`) |
| `GerudoTrainingGround` | Gerudo Training Ground | exact | — | — (rooms in key catalog) |
| `DesertColossus` | Desert Colossus | exact | observed | — |
| `GanonCastle` | Ganon's Castle | exact | — | — |
| `InsideGanonCastle` | Ganon's Castle | alias `insideganoncastle` | — | — |
| `InsideTheDekuTree` | Great Deku Tree | alias `insidethedekutree` | — | — |
| `DodongoCavern` | Dodongo's Cavern | exact | — | — |
| `FireTemple` | Fire Temple | exact | — | — |
| `WaterTemple` | Water Temple | exact | — | — |
| `ForestTemple` | Forest Temple | exact | — | — |
| `ShadowTemple` | Shadow Temple | exact | — | — |
| `SpiritTemple` | Spirit Temple | exact | — | — |
| `InsideJabuJabuBelly` | Lord Jabu-Jabu's Belly | alias `insidejabujabubelly` | — | — |
| `LakeHylia` | Lake Hylia | exact | — | — |

"observed" = seen live or in `caption.sav`; "expected" = follows from the game's era
suffixes (`_Child`/`_Adult`/none) but not yet seen; "—" = not an area for that era.

## Sub-locations (the part after the slash)

Location-list entries; can themselves carry era suffixes, which the resolution strips.

| Game name | Region | Resolves via | Era | Evidence |
|---|---|---|---|---|
| `LonLonRanch` | Lon Lon Ranch | exact | child (list of `HyruleField`) | `stage-names.json` subLocations; `LocationName` in caption.sav |
| `IngoRanch` | Lon Lon Ranch | alias `ingoranch` (`a611262`) | adult (list of `HyruleField`) | live report `HyruleField_Adult/IngoRanch` |
| `LakeHylia` | Lake Hylia | exact | child list; expected same adult name | `stage-names.json` subLocations |
| `TimeTemple` | Hyrule Castle Town | exact | both (list of `Market`) | caption.sav `Market/TimeTemple` (child and adult saves) |
| `GoronCity` | Goron City | exact | both (list of `GoronCity`) | `stage-names.json` subLocations |
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
