# Cross-reference materials

External data checks against other projects that work on the same game
(OoT Switch 2 remake on the Hookshot / Longshot / Triforce / NX2navi ports).
Each entry records the source (repo, commit, license), what was compared, and
what was confirmed. Sources are cloned or fetched read-only into a gitignored
`local/` directory — nothing from them is committed to this repo.

**License rules applied here**

- **GPL-3.0-or-later** (Longshot, OOTRR): facts extracted, re-verified, and
  attributed; no files copied.
- **MIT** (zootr-nx, hyrule-tracker, Links-Toolbox): facts and key names may be
  carried into our own data files with source attribution, where adopted.
- **Adoption bar:** in-game confirmation. Nothing below is merged into the
  live data files until it passes in-game verification; unconfirmed material
  is labeled as such in each doc.

| Entry | Source (commit / license) | What was compared | What it confirmed |
|---|---|---|---|
| [Longshot](longshot-crossref.md) | `git.magicbean.dev/MagicBeanDev/Longshot` @ `9af4808f` (2026-11-18), GPL-3.0-or-later | key hashes, caption.sav layout, live state | MurmurHash3 x86_32 seed 0 proven from the game's own code (nine inline hashes recompute exactly); caption.sav layout verified against a reference save; 9-flag live snapshot; songs confirmed as save Bool flags |
| [Longshot Mod API — draft PR #1958](longshot-modapi-crossref.md) | Longshot `mod-api` branch, draft PR #1958, GPL-3.0-or-later (2026-11-21) | small-key field names from the game's own code, write semantics | field names documented in the recompiled host that matches our own build; every entry resolves in our key table. Draft/preview status: their write path was not yet checked in the real game |
| [zootr-nx](zootr-crossref.md) | `TurtIeSocks/zootr-nx` @ `3ef1a5a`, MIT (2026-11-21) | hash schemes, key constants | FNV-1a 64-bit scheme verified and reproducible; 32 keys shared with `save-mapping.json` (names verified both sides); 508 zootr-only names recovered and FNV-verified (held back pending in-game confirmation) |
| [hyrule-tracker](hyrule-crossref.md) | `jv-prado/hyrule-tracker` @ `5aa4239` v1.5.0, MIT (2026-11-21) | placement IDs, save-mapping, checklist, logic | headline finding: the base-64 placement-ID mechanism, consistent with our placement-id model; diffs against all three data files; nothing auto-adopted |
| [Links-Toolbox](links-toolbox-crossref.md) | `losava/Links-Toolbox` @ `b8c635c` v1.6.1, MIT (2026-11-21) | item IDs, named fields, bottle-contents enum | their item IDs *are* our key table (strongest result); named fields verified; 13 of 14 bottle-contents values re-verified; 27 display-name diffs, labels only; same murmur3 x86_32 seed 0 — direct hash lookups |
| [OOTRR](ootrr-crossref.md) | `REALAZK/ootrr` @ `efc5841`, GPL-3.0 (2026-11-17) | 15,348-name save-key catalog, item-level data | all 15,348 simple flag hashes re-verified the same day (reproducible); 7 Beehives confirmed as Kakariko collectibles on 64-bit keys; per-GS location evidence explicitly not imported |

The derived area-name table lives in [../area-names.md](../area-names.md)
(checklist stage names → readable region names).

Machine-readable diffs per source (where produced) live in the gitignored
`local/` directory (`crossref.json` et al.).
