# hyrule-tracker cross-reference (2026-11-21)

Second cross-reference, same process as zootr-nx (`zootr-crossref.md`).
Source: **https://github.com/jv-prado/hyrule-tracker** @ `5aa4239`, **v1.5.0**,
**MIT license** — full history fetched; first commit 2026-11-17 (squashed).

Unzipped to `local/hyrule-tracker/` (gitignored):
`crossref.json` (machine-readable summary of every diff below),
`placements.json` (their romfs extract, reproduced by us),
`all-actors.json` (full Banc actor dump, 120,598 unique actor hashes),
`extract-placements.ts` + `dump-all-actors.ts` (reproduction scripts).

## Provenance

hyrule-tracker is a **fork/descendant of our data**, not an independent reverse
engineer: **322 of our 323 save-mapping entries are byte-identical** (same
keys, same flags, same evidence), and their checklist is a strict subset of
ours. Their first commit already carried our schema and naming. The value of
this cross-reference is therefore not independent confirmation of flags —
it is **(a)** their placement-extraction pipeline, which lets us resolve our
64-bit "b64" flag values against the game's romfs, and **(b)** their logic
edits, which surface real gameplay questions for in-game verification.

## save-mapping.json

- **322/323 identical.** One divergence, one addition:
  - `side_quests.to_the_great_fairy` — they detect it via **three alternative
    save paths** (Great Fairy fountain flags for the three fairy locations);
    ours uses a single path. Candidate: confirm which path(s) actually flip
    in-game, then merge.
  - `mini_bosses.lizalfos` (only theirs) —
    `DefeatedEnemyNum.Enemy_MiddleBoss_Lizalfos`: the Lizalfos pair in
    Dodongo's Cavern (child). No counterpart in our data.
- **Not adopted automatically** — in-game confirmation is the bar for
  "confirmed" status. Both entries are listed in `crossref.json` as open.

## checklist.json

Ours: **25 categories / 359 items** (generatedAt 2026-11-19).
Theirs: **22 categories / 323 items** (generatedAt 2026-11-11).

- No categories exist only in theirs. Only in ours: `room_keys` (25 items —
  the remake's dungeon keys, which they do not track), `extra_masks` (2),
  `magic_beans_planted` (empty in both; absent in theirs).
- One item only in theirs: `mini_bosses.lizalfos` (number 11).
- Their item **numbers** follow their flag-observation order (Deku Tree GS
  first — the first flag they diffed) rather than area order. Numbers are
  display-only (`detect: null` everywhere), so no detection impact.
- **13 display-name differences** — their names read like the remake's actual
  in-game text (candidates for rename after in-game confirmation):

| id | ours | theirs |
|---|---|---|
| heart_containers.heart_container_bongo | Heart Container (Bongo) | Heart Container (Bongo Bongo) |
| bosses.bongo | Bongo | Bongo Bongo |
| equipment.biggorons_sword | Biggoron's Sword | Biggoron Sword |
| items.gorons_bracelet | Goron's Bracelet | Goron Bracelet |
| items.double_magic | Double Magic | Gift of Doubled Magic |
| key_items.gerudo_membership_card | Gerudo Membership Card | Gerudo Pass |
| great_fairies…spin_attack | …Enhanced (charged) Spin Attack | …Gift of Improved Spin |
| great_fairies…double_magic | …Double Magic | …Gift of Doubled Magic |
| great_fairies…double_defense | …Double Defense (halved damage) | …Gift of Halved Damage |
| adult_trade.odd_potion | Odd Potion | Odd Poultice |
| adult_trade.broken_gorons_sword | Broken Goron's Sword | Broken Goron Sword |
| adult_trade.worlds_finest_eye_drops | World's Finest Eye Drops | Specialty Eye Drops |
| adult_trade.claim_check | Claim Check | Biggoron Receipt |

Notable: the Great Fairy blessings are "Gift of …" in-game, and Odd Potion is
"Odd Poultice" — consistent with the remake's in-game naming.

## logic.json

Same schema (top-level dicts; `warps` the only list).
Ours: 90 items / 142 labels / 274 locations. Theirs: 86 / 138 / 275.
Identical: `version`, `start`, `canBeAdult`, `regions`, `warps`, `numbers`,
`regionAliases`, `categoryNeeds`, and all 86 shared items.

Substantive differences (all are in-game verification leads, none adopted):

1. **Frog songs (heart_pieces#28, the frog HP):** our macro `FrogSongs`
   requires **6 songs** (incl. Song of Storms); theirs requires **5** (no
   Song of Storms), label "the five songs the frogs want".
2. **Second nut-bag scrub (capacity#13 + `progressive.nuts` first source):**
   ours = Sacred Forest Meadow scrub, needs Song of Storms; theirs = Lost
   Woods grotto scrub, needs explosives.
3. **heart_pieces#14 (adult):** ours `child or HoverBoots`; theirs
   `(child and Explosives) or HoverBoots`.
4. **heart_pieces#21 (adult):** scarecrow route needs **Hookshot** (ours) vs
   **Longshot** (theirs).
5. **heart_pieces#30 (adult):** ours offers 3 routes (HoverBoots / scarecrow+
   Hookshot / Longshot); theirs only `ScarecrowSong and Longshot`.
6. **Masks (masks#2–5 + 4 items):** we model intermediate `*Held` items
   (mask in inventory, tradeable — `IsGet + StockNum==1`); theirs uses the
   raw mask items directly (e.g. `BunnyHood` for the hood trade, no
   AllStones pairing on the same entry).
7. **Only theirs: `mini_bosses#11`** — Dodongo's Cavern (child), the
   Lizalfos pair (pairs with their save-mapping addition above).
8. Cosmetic: 5 label renames (see name table) and our heart-piece notes say
   "Fairy Note" where theirs says "fairy thought" (the remake's in-game word).

## Placement-ID mechanism (the headline finding)

**122/122 of our observed b64 flag values are raw actor `Hash` values from
the game's romfs** (`romfs/Banc/**/*.bcett.byml.zs`), matching our
`save-mapping.json` `b64` entries for all 100 gold skulltulas, 14 heart
pieces, and all **8 boss heart containers** (resolved against the full
120,598-entry actor dump, not just their 240-entry extract):

| boss | b64 value |
|---|---|
| Gohma | 0xF914FA367471A3E3 |
| King Dodongo | 0x5262CEA56C53554D |
| Barinade | 0xF45F5319D88E7AC7 |
| Phantom Ganon | 0xFF11593A22778E7E |
| Volvagia | 0x8389CAFB1277D318 |
| Morpha | 0xC835E1D03656BF46 |
| Bongo Bongo | 0xF43CCB260F5576DC |
| Twinrova | 0x41811F125B1EEDD5 |

Their extract pipeline is **reproducible**: `npm ci && npx tsx
scripts/extract-placements.ts <romfs>` → 100 GS + 36 heart-piece anchors +
14 heart pieces + 190 chests (run against our romfs, results in
`local/hyrule-tracker/placements.json`).

- **GS dual-flag:** their `docs/live-memory.md` documents an **XOR 0x2
  (bit-1 flip)** that yields a second flag per GS placement ("seen" vs
  "collected"); verified by their Deku Tree 3F in-game diff. We cannot
  re-verify it from our current saves (all three slots are fresh — bool64
  flag lists empty), and zero XOR-2 partner pairs exist among our 122
  observed values. No contradiction; our data stores the base (actor Hash)
  value, which their mechanism confirms is the collected flag's partner.
- **Heart-piece anchors:** 36 `HeartPieceAnchor` actors in romfs, 16 named
  via `HeartPieceAnchor_GameDataPath`. **All 16 path names are present in our
  save-mapping** — e.g. `KakarikoVillage_IsAfterSave_Npc_Hylia_025` backs our
  `heart_pieces.020`; `MiniGame_FrogTenors_StormSong` /
  `MiniGame_FrogTenors_InsectRepellent` back the frog-HP sub-flags.

## What we did NOT take in

- No flag values — nothing here changes a `save-mapping.json` entry.
- No checklist or logic edits — all differences above are listed as
  verification leads (`crossref.json → open_verification_leads`), pending
  in-game confirmation per the usual bar.
- Their UI/`src/` code — Electron app, different layout; nothing reusable
  identified beyond the extract scripts.

## Open verification leads (in-game)

In priority order (biggest data impact first):
1. Frog HP: 6 songs (ours) vs 5 (theirs) — `heart_pieces#28`.
2. Nut-bag scrub location: Sacred Forest Meadow (ours) vs Lost Woods (theirs)
   — `capacity#13`.
3. `mini_bosses.lizalfos` flag — kill the Lizalfos pair, check save.
4. `side_quests.to_the_great_fairy` — which of the three paths flips.
5. Heart pieces #14 (child + explosives?), #21 (Hookshot vs Longshot),
   #30 (route set).
6. Mask `*Held` semantics — is "carried, not worn" a distinct save state?
7. The 13 display-name candidates above.
