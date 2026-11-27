# Changelog

## 0.6.0 (2026-11-27)

The biggest update so far: the tracker can now update itself (only if you opt in), follows every
quest to its turn-in, knows where maps and compasses can be picked up, and tracks each Magic Bean
patch. It also has a new look, its own icons and a first-run tour.

### New

- **In-app updates (opt-in).** Windows now has an installer
  (`Boomerang-Tracker-<version>-setup.exe`) next to the portable exe.
  - Settings → Updates: *Check for updates*, *Download updates automatically* and a **Check now**
    button. Both switches are **off** by default. The first step of the setup tour asks whether
    to turn them on, and the box starts unticked.
  - When an update is ready, a banner offers **Restart now**: the new version installs quietly
    and the tracker opens again. If you ignore it, it installs when you quit. The banner can show
    the release notes and links to the release page.
  - The portable exe and the Linux `.tar.gz` only check: they say a new version is out, link to
    it, and never download anything. The Linux AppImage can update itself.
  - With updates off, the app never goes online by itself. Details under *Updates and privacy*
    in the README.
- **Quest turn-ins.** Every quest object now shows both picking it up and handing it in:
  - the child trading sequence (Weird Egg hatched, Cucco turned in, Zelda's Letter shown);
  - the four Happy Mask Shop sales;
  - all eleven adult trading hand-ins, up to the Claim Check;
  - Ruto's Letter shown to King Zora, the Cucco Lady's seven Cuccos, and the Poe Collector's
    five Big Poes.

  Turn-ins count toward 100%. Each one is read from its own save key; the chain-by-chain table
  with keys and confidence is in `docs/quest-chains.md`.
- **Quest logic follows the chain.** The next step needs the previous turn-in, not just the item
  in hand. For example, the Skull Mask only appears after the Keaton Mask is sold, and selling
  the Bunny Hood needs all three Spiritual Stones.
- **Maps & compasses.** Each dungeon map and compass has its own logic and shows as "can get now"
  once you can reach its chest, not only after the dungeon is done. Most are marked *unsure*
  until checked in game (`docs/maps-compasses.md`).
- **Magic Bean spots.** The ten planting spots are tracked one by one from the save. Reachable
  unplanted spots show up in "can get now" and in the overlay's *Remaining here*, so you get a
  reminder to plant. Bean-ride checks need their own patch planted.
- **Controller overlay toggle (Windows).** Show or hide the overlay with a controller button
  (L3 by default, or a button you pick), with tap or hold, set in Settings.
- **First-run tour.** A short, skippable walkthrough of the sidebar, the cards, "can get now" and
  the overlay. You can replay it from Settings.

### Changed

- **New look.** A category sidebar with per-category show/hide, a compact top bar, "can get now"
  in its own right-hand column, our own drawn icon for every checklist row, the Inter typeface,
  and Settings in its own window.
- **Amiibo masks** are now *likely* instead of *confirmed*. The masks were checked in game, but
  the flag the game reads to detect them hasn't been isolated yet.

### Fixed

- The Deku Tree's Gold Skulltulas no longer ask for bombs.
- Upgrade sources (horseback archery, the Lost Woods stick scrub) are read from their own
  "done" flags, so a finished upgrade game no longer shows as still to do. Eleven capacity
  upgrade mappings were confirmed from real play.
- The Death Mountain Great Fairy ticks once the summit fountain is done.
- The Gerudo guards are detected.
- Area names: a few misspelled stage names in the game data (the graveyard and the Ice Cavern)
  now map to the right area.

### For developers

- `docs/rederive-layout.md`: a step-by-step guide for when an emulator, port or game update
  breaks live tracking.
- Tests now guard that every checklist row has its own icon.

## 0.5.1 (2026-11-20)

- **Mask chain logic:** each Happy Mask Shop mask now appears as "can get now" while you
  hold the previous one (the mask you hand in for it), instead of showing up the moment the
  previous mask was owned and staying up even after it has been turned in (Keaton → Skull →
  Spooky → Bunny chain). See `docs/logic-notes.md`.
- **Mask of Truth logic:** the Mask of Truth now also requires all three child dungeon
  bosses beaten (all three Spiritual Stones) in addition to trading in the Bunny Hood,
  matching when the Mask Salesman will actually sell it. See `docs/logic-notes.md`.
- **Linux (saves only):** AppImage and `.tar.gz` builds
  (`Boomerang-Tracker-<version>-x86_64.AppImage` / `.tar.gz`). Live tracking is Windows-only
  for now, so on Linux the tracker follows the save files and updates each time the game
  saves. It looks for Hookshot's saves in `~/.local/share/hookshot/save/<id>`, game folders in
  `~/Games` or `~/Applications` (Rekarina: `game/profile/save/<account id>`), and emulator
  data folders in `~/.config`, `~/.local/share` and Flatpak's `~/.var/app/<id>/{config,data}`;
  anything it can't find can be chosen in Settings. Ryujinx-style saves aren't picked up
  automatically (their folder doesn't say which game they belong to) — choose that folder by
  hand. Settings live in `~/.config/Boomerang Tracker`.

## 0.5.0 (2026-11-19)

- **Rekarina support** — [Rekarina](https://git.rekarina.dev/rekarina/rekarina), the native PC port
  of OoT (checked on 1.2.1), is now a supported game:
  - **Saves:** the tracker finds Rekarina installs (`Games\Rekarina`, or any `*rekarina*` folder
    under `Games` on a drive) and reads the saves in `game\profile\save\<account id>\`. Rekarina
    journals its saves: a finished commit waiting in `save-tx\ready-<n>` is the newest save, and
    the tracker reads it instead of the slot's copy. The tracker only reads those saves and never
    keeps them open, so it can't block the game's save writes. Real 1.2.1 saves read with no
    warnings.
  - **Live tracking (read-only):** per-game memory layout support; on Rekarina 1.2.1 the live
    check found all the tables in under 10 seconds and agreed 100% with the newest save.
- **Following the running game:** when a game starts, the tracker now keeps checking every few
  seconds until it's live, instead of trying once. Before, a missed first try (for example
  while Rekarina was swapping in a save) left it on the wrong game's saves until you restarted
  the tracker. A pinned slot, or a folder you chose yourself while that game is running, is
  still respected.
- **App icon:** the exe and its windows now have their own icon (a plain boomerang mark).
- **Keys panel:** per-dungeon key status, plus a Room Keys category. The 25 room-key pickup flags
  are mapped by name (likely — not yet confirmed in game).
- **Extras: Zora + Gerudo masks** are now tracked under Extras, outside the 100% figure
  (mapping likely — not yet confirmed in game).
- **Big Poes card:** shows the sold count plus the 10 Big Poe locations as tiles (todo/unmapped).
  The locations and the "beans count toward 100%" rule come from a route sheet and are pending an
  in-game check.
- **Mapping corrections:** the amiibo mask figure mapping is confirmed (in game); the Water
  Temple boss key and the four chest heart pieces are downgraded to guesses (their flags don't
  appear in the remake's key catalog — the remake may have removed them); a few pass-counter
  checklist rows are now display-only spots.
