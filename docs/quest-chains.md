# Quest chains: pickup and turn-in for every quest object

Every quest object the tracker shows, what the step's **pickup** is, what its **turn-in**
(hand it in, sell it, show it) is, the checklist row for each, and the save key the turn-in
is read from, with confidence. Pickups use `IsGet.<item>` ("ever obtained" — stays true after
the item is gone) and were already mapped; the turn-in rows are the new half of each step.

Confidence levels are the ones from `docs/save-mapping.md`: **confirmed** = seen changing at
the moment in a save diff, **likely** = the flag name says what it is and the saves agree,
**guess** = indirect inference.

Turn-ins that consume the item are read as **"ever owned and no longer held"**:
`IsGet.<item>` true plus `PouchData.<item>.StockNum == 0`. That pattern was watched flip in
the 2026-11-19 session (see below); the trade-sequence hand-ins not yet watched use the same
pattern and are `likely` until one is seen in game.

Quest steps are enums: `Step_<quest>` moves through named steps and ends at `Complete`
(value `0x4C0A63F4` in the saves; `Ready` is `0x17BFAA46`). A side-quest row that is itself a
completion test (step `== Complete`) needs no separate turn-in row.

## Child Trading Sequence (checklist `child_trade`, Part B)

| Step | Pickup row | Turn-in row | Turn-in save key | Confidence |
|---|---|---|---|---|
| Weird Egg | `child_trade.weird_egg` | `child_trade.weird_egg_hatched` | `IsGet.Item_WeirdEgg` + `PouchData.Item_WeirdEgg.StockNum == 0` | confirmed |
| Wake-up Cucco | `child_trade.wake_up_cucco` | `child_trade.wake_up_cucco_turned_in` | `IsGet.Item_AlarmCucco` + `PouchData.Item_AlarmCucco.StockNum == 0` | confirmed |
| Zelda's Letter | `child_trade.zeldas_letter` | `child_trade.zeldas_letter_turned_in` | `IsGet.Item_ZeldaLetter` + `PouchData.Item_ZeldaLetter.StockNum == 0` | confirmed |

- The egg **hatches** overnight into the Wake-up Cucco (01:09:44, Hyrule Castle: egg
  `StockNum 1→0`, cucco `0→1`). The cucco is turned in by waking Talon at the castle
  (01:11:23, `StockNum 1→0`). The letter is shown to the guard at Kakariko's gate
  (01:52:24, `StockNum 1→0` and the gate cutscene flag `HavePlayedEvent.Dm_Kakariko_0010`
  set; `Npc_Hylia_Soldier_003_GateOpen` true in the later saves).
- All three moments are from the maintainer's 2026-11-19 session (the change log digests in
  `local/rekarina-2026-11-19/`); the final 2026-11-23 saves agree (all three `StockNum` 0).

## Happy Mask Shop chain (checklist `masks`, Part A; quest: `side_quests.happy_mask_shopkeeper`)

The shop lends the next mask only after the previous one is **sold** (logic audit
2026-11-24). The quest row itself maps `Step_SubEvent_MaskSalesman == Complete`.

| Step | Pickup row | Turn-in row | Turn-in save key | Confidence |
|---|---|---|---|---|
| Keaton Mask | `masks.keaton_mask` | `masks.keaton_mask_sold` | `IsGet.Armor_Child_Mask_Keaton` + `PouchData.Armor_Child_Mask_Keaton.StockNum == 0` | confirmed |
| Skull Mask | `masks.skull_mask` | `masks.skull_mask_sold` | `IsGet.Armor_Child_Mask_Skull` + `PouchData.Armor_Child_Mask_Skull.StockNum == 0` | confirmed |
| Spooky Mask | `masks.spooky_mask` | `masks.spooky_mask_sold` | `IsGet.Armor_Child_Mask_Spooky` + `PouchData.Armor_Child_Mask_Spooky.StockNum == 0` | confirmed |
| Bunny Hood | `masks.bunny_hood` | `masks.bunny_hood_sold` | `IsAfterSell_Mask_Bunny` | likely |
| Mask of Truth | `masks.mask_of_truth` | — (no turn-in; the Bunny Hood paid off is the trigger) | — | — |

- Keaton sold to the guard at Kakariko's gate (02:11:42), Skull sold to the Skull Kid in the
  Lost Woods (02:41:21), Spooky sold to the boy in the graveyard (02:48:30) — each watched as
  `StockNum 1→0` in the 2026-11-19 session.
- The Bunny Hood sale (to the running man) was not in any diff at hand; the 2026-11-23 saves
  have `IsAfterSell_Mask_Bunny` true together with Bunny `StockNum` 0, Mask of Truth held and
  the salesman quest `Complete`, so the flag name is trusted, not yet watched.

## Adult Trading Sequence (checklist `adult_trade`, Part B; quest: `side_quests.from_a_pocket_egg_comes`)

Ends with Biggoron's Sword (`equipment.biggorons_sword`). None of these hand-ins was watched
flipping in a save diff at hand, so all turn-ins are the owned-and-gone pattern and are
`likely`. The quest row maps `Step_SubEvent_GetSwordBigGoron == Complete` (the 2026-11-23
saves still sit at `Ready`, so the sequence was not started there).

| Step | Pickup row | Turn-in row | Turn-in save key | Confidence |
|---|---|---|---|---|
| Pocket Egg | `adult_trade.pocket_egg` | `adult_trade.pocket_egg_hatched` | `IsGet.Item_PocketEgg` + `PouchData.Item_PocketEgg.StockNum == 0` | likely |
| Pocket Cucco | `adult_trade.pocket_cucco` | `adult_trade.pocket_cucco_turned_in` | `IsGet.Item_PocketCucco` + `PouchData.Item_PocketCucco.StockNum == 0` | likely |
| Cojiro | `adult_trade.cojiro` | `adult_trade.cojiro_turned_in` | `IsGet.Item_CojiroCucco` + `PouchData.Item_CojiroCucco.StockNum == 0` | likely |
| Odd Mushroom | `adult_trade.odd_mushroom` | `adult_trade.odd_mushroom_turned_in` | `IsGet.Item_OddMushroom` + `PouchData.Item_OddMushroom.StockNum == 0` | likely |
| Odd Potion | `adult_trade.odd_potion` | `adult_trade.odd_potion_turned_in` | `IsGet.Item_OddPowder` + `PouchData.Item_OddPowder.StockNum == 0` | likely |
| Poacher's Saw | `adult_trade.poachers_saw` | `adult_trade.poachers_saw_turned_in` | `IsGet.Item_PoacherSaw` + `PouchData.Item_PoacherSaw.StockNum == 0` | likely |
| Broken Goron's Sword | `adult_trade.broken_gorons_sword` | `adult_trade.broken_gorons_sword_turned_in` | `IsGet.Item_BrokenSword` + `PouchData.Item_BrokenSword.StockNum == 0` | likely |
| Prescription | `adult_trade.prescription` | `adult_trade.prescription_turned_in` | `IsGet.Item_Prescription` + `PouchData.Item_Prescription.StockNum == 0` | likely |
| Eyeball Frog | `adult_trade.eyeball_frog` | `adult_trade.eyeball_frog_turned_in` | `IsGet.Item_EyeballFrog` + `PouchData.Item_EyeballFrog.StockNum == 0` | likely |
| World's Finest Eye Drops | `adult_trade.worlds_finest_eye_drops` | `adult_trade.worlds_finest_eye_drops_turned_in` | `IsGet.Item_EyeDrop` + `PouchData.Item_EyeDrop.StockNum == 0` | likely |
| Claim Check | `adult_trade.claim_check` | `adult_trade.claim_check_turned_in` | `IsGet.Item_ClaimCheck` + `IsGet.Weapon_Sword_Biggoron` | likely |

Note the actor names from the game files: the Odd Potion is `Item_OddPowder`, Cojiro is
`Item_CojiroCucco`, the Eye Drops are `Item_EyeDrop` (the claim-check turn-in is read as
"the sword arrived", since the check is consumed in the same hand-off).

## Ruto's Letter (checklist `bottles`, Part A)

The letter object has no row of its own; the bottle row tracks the reward. The turn-in (show
the letter to King Zora) is a new row.

| Step | Pickup row | Turn-in row | Turn-in save key | Confidence |
|---|---|---|---|---|
| Ruto's Letter → King Zora | `bottles.rutos_letter_bottle` (the bottle, `IsGet.Item_Bottle_Letter`) | `bottles.rutos_letter_shown` | `Get_StoneOfWater_TalkedZoraAboutRutoLetter` | likely |

The 2026-11-23 saves have `Get_StoneOfWater_GetRutoLetter` true (letter picked up) while
`TalkedZoraAboutRutoLetter` and the bottle are still unset — the letter was not yet shown
there, so the flag was not watched flipping.

## Cucco Lady's bottle (checklist `bottles`, Part A)

| Step | Pickup row | Turn-in row | Turn-in save key | Confidence |
|---|---|---|---|---|
| Return all seven Cuccos | `bottles.cucco_lady_bottle` (`MiniGame_CatchCucco_IsCompleted`) | `bottles.seven_cuccos_returned` | `MiniGame_CatchCucco_PutsInFence` — all 7 of 7 indices set | likely |

## Big Poes / Poe Collector (checklist `big_poes` + `bottles`, Part A)

The ten `big_poes.NNN` rows **are** the turn-in: a Big Poe's soul is bottled and sold in the
same action, and each row's confirmed flag flips when that Poe is sold. No separate pickup
row exists. The bottle's turn-in is selling five Poes (500 points).

| Step | Pickup row | Turn-in row | Turn-in save key | Confidence |
|---|---|---|---|---|
| Sell 5 Big Poes | — | `bottles.five_poes_sold` | `GhostShop_CouponNum >= 500` (100 per Poe; `1000` observed with 10/10 sold) | likely |
| Bottle | `bottles.poe_collector_bottle` (`Step_SubEvent_GhostShop == Complete`) | — (the bottle is the reward) | — | — |

## Gerudo Membership Card (checklist `key_items`, Part A)

| Step | Pickup row | Turn-in row |
|---|---|---|
| Membership Card | `key_items.gerudo_membership_card` (`IsGet.Item_Token_Gerudo`) | — none: the card is a permanent key item and is never handed in (2026-11-23 saves: held, `StockNum` 1) |

## Side quests (checklist `side_quests`, Part A) — no new rows

Each side-quest row already **is** its own turn-in test (quest step at `Complete`), so adding
a second row would only duplicate it:

| Row | Save key (turn-in = completion) | Confidence |
|---|---|---|
| `side_quests.malons_friend` | `Step_Get_Epona == Complete` | likely |
| `side_quests.happy_mask_shopkeeper` | `Step_SubEvent_MaskSalesman == Complete` | likely |
| `side_quests.to_the_great_fairy` | fountain event / `Step_Meet_GreatFairy` at-or-past the castle step | confirmed |
| `side_quests.stir_the_scarecrows_soul` | `Step_SubEvent_GetScarecrow == Complete` | likely |
| `side_quests.from_a_pocket_egg_comes` | `Step_SubEvent_GetSwordBigGoron == Complete` | likely |
| `side_quests.broken_windmill_dry_well` | `Step_SubEvent_GetStormSong == Complete` | likely |

## What the mapping format had to supply

Nothing new. Every turn-in above is expressible with the existing detect rules
(`all` of an `IsGet` flag and a `StockNum == 0` comparison, an enum `eq "Complete"`, a
`count` of array indices, and `gte` on a number), so no mapping-format change was needed.
