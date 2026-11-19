# Changelog

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
