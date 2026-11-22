# Grant recipes (OoT Switch 2)

The exact writes that give each item, equipment, song, or value.
Key data those writes address lives in the
[OoT Switch 2 reference repo](https://github.com/LucieTheFool/oot-switch2-reference).
Generated — do not edit by hand.


Per item: the writes, in order. `set` = write this value; `raiseTo` = write it only if the current value is lower (never lower a count); `atLeast` = raise an Int to at least this; `setValue` = any value in the range. Write every copy of the record.

### Ammo

| Item | Confidence | Verified in game |
|---|---|---|
| Fire arrows (count) | likely | no |
| Ice arrows (count) | likely | no |
| Light arrows (count) | likely | no |
| Arrows (count) | likely | no |
| Bombs (count) | confirmed | yes |
| Bombchus (count) | confirmed | yes |
| Scrub business seed (count) | likely | no |

**How to give it: Fire arrows (count)**

- setValue PouchData.Item_Arrow_Fire.StockNum (0x5E529AB9) [Int] = {"min":0} — store record (every copy)

**How to give it: Ice arrows (count)**

- setValue PouchData.Item_Arrow_Ice.StockNum (0x40735A8D) [Int] = {"min":0} — store record (every copy)

**How to give it: Light arrows (count)**

- setValue PouchData.Item_Arrow_Light.StockNum (0xBFB285C8) [Int] = {"min":0} — store record (every copy)

**How to give it: Arrows (count)**

- setValue PouchData.Item_Arrow_Normal.StockNum (0x518EC74B) [Int] = {"min":0,"maxFrom":"Capacity.Arrow"} — store record (every copy)
- Note: Damage or use lowers it again; re-write on a timer to hold it.

**How to give it: Bombs (count)**

- setValue PouchData.Item_Bomb.StockNum (0xDB1BCD4F) [Int] = {"min":0,"maxFrom":"Capacity.Bomb"} — store record (every copy)
- Note: Damage or use lowers it again; re-write on a timer to hold it.

**How to give it: Bombchus (count)**

- setValue PouchData.Item_Bombchu.StockNum (0xDF7C517A) [Int] = {"min":0,"maxFrom":"Capacity.Bomb"} — store record (every copy)
- Note: Damage or use lowers it again; re-write on a timer to hold it.

**How to give it: Scrub business seed (count)**

- setValue PouchData.Item_ScrubBusinessSeed.StockNum (0x600E29EB) [Int] = {"min":0,"max":50} — store record (every copy)
- Note: Damage or use lowers it again; re-write on a timer to hold it.

### Capacities

| Item | Confidence | Verified in game |
|---|---|---|
| Arrow capacity | likely | no |
| Bomb capacity | confirmed | yes |
| Deku Nut capacity | confirmed | yes |
| Deku Seed capacity | confirmed | yes |
| Deku Stick capacity | confirmed | yes |
| Wallet size | confirmed | yes |

**How to give it: Arrow capacity**

- setValue 0x418DB791 [Int] = {"min":0,"max":50} — store record (every copy)

**How to give it: Bomb capacity**

- setValue 0xE753508B [Int] = {"min":0,"max":40} — store record (every copy)

**How to give it: Deku Nut capacity**

- setValue 0x735B00F7 [Int] = {"min":0,"max":40} — store record (every copy)

**How to give it: Deku Seed capacity**

- setValue 0xAE8CC742 [Int] = {"min":0,"max":50} — store record (every copy)

**How to give it: Deku Stick capacity**

- setValue 0x457616B0 [Int] = {"min":0,"max":30} — store record (every copy)

**How to give it: Wallet size**

- setValue 0xE0010A50 [Int] = {"min":0,"max":999} — store record (every copy)

### Consumables

| Item | Confidence | Verified in game |
|---|---|---|
| Blue Fish | likely | no |
| Insect | likely | no |
| Bombs | likely | no |
| Bombchus | likely | no |
| Big Poe Bottle | likely | no |
| Blue Fire Bottle | likely | no |
| Blue Potion Bottle | likely | no |
| Bug Bottle | likely | no |
| Fairy Bottle | likely | no |
| Fish Bottle | likely | no |
| Green Potion Bottle | likely | no |
| Half-Milk Bottle | likely | no |
| Letter Bottle | likely | no |
| Milk Bottle | likely | no |
| Poe Bottle | likely | no |
| Red Potion Bottle | likely | no |
| Deku Nuts | confirmed | yes |
| Deku Seeds | confirmed | yes |
| Deku Sticks | confirmed | yes |
| Eyedropper | likely | no |
| Eyeball Frog | likely | no |
| Magic Beans | confirmed | yes |
| Odd Mushroom | likely | no |
| Odd Powder | likely | no |
| Pocket Cucco | likely | no |
| Pocket Egg | likely | no |
| Prescription | likely | no |
| Scrub Seeds | likely | no |
| Weird Egg | likely | no |

**How to give it: Blue Fish**

- set IsGet.Animal_Fish_Blue (0x40B68073) [Bool] = true — store record (every copy)

**How to give it: Insect**

- set IsGet.Animal_Insect (0x4506012D) [Bool] = true — store record (every copy)

**How to give it: Bombs**

- set IsGet.Item_Bomb (0x2BB00768) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Bomb.StockNum (0xDB1BCD4F) [Int] = 20 — store record (every copy)
- Note: defaultCount 20 is the N64 small-bag full capacity (assumption).

**How to give it: Bombchus**

- set IsGet.Item_Bombchu (0x5AB49C8E) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Bombchu.StockNum (0xDF7C517A) [Int] = 10 — store record (every copy)
- Note: defaultCount 10 is the N64 small-bag full capacity (assumption).

**How to give it: Big Poe Bottle**

- set IsGet.Item_Bottle_BigPoe (0x03463AB6) [Bool] = true — store record (every copy)

**How to give it: Blue Fire Bottle**

- set IsGet.Item_Bottle_BlueFire (0x53DB16A6) [Bool] = true — store record (every copy)

**How to give it: Blue Potion Bottle**

- set IsGet.Item_Bottle_BluePotion (0xEA0729FE) [Bool] = true — store record (every copy)

**How to give it: Bug Bottle**

- set IsGet.Item_Bottle_Bug (0xCF2D3DB4) [Bool] = true — store record (every copy)

**How to give it: Fairy Bottle**

- set IsGet.Item_Bottle_Fairy (0x124C4D3A) [Bool] = true — store record (every copy)

**How to give it: Fish Bottle**

- set IsGet.Item_Bottle_Fish (0xB46A0394) [Bool] = true — store record (every copy)

**How to give it: Green Potion Bottle**

- set IsGet.Item_Bottle_GreenPotion (0x75ABC14B) [Bool] = true — store record (every copy)

**How to give it: Half-Milk Bottle**

- set IsGet.Item_Bottle_HalfMilk (0x21FE9FFA) [Bool] = true — store record (every copy)

**How to give it: Letter Bottle**

- set IsGet.Item_Bottle_Letter (0x170B5DF2) [Bool] = true — store record (every copy)

**How to give it: Milk Bottle**

- set IsGet.Item_Bottle_Milk (0xF1232980) [Bool] = true — store record (every copy)

**How to give it: Poe Bottle**

- set IsGet.Item_Bottle_Poe (0xF2001CFD) [Bool] = true — store record (every copy)

**How to give it: Red Potion Bottle**

- set IsGet.Item_Bottle_RedPotion (0xD8FFAFD1) [Bool] = true — store record (every copy)

**How to give it: Deku Nuts**

- set IsGet.Item_DekuNut (0x00C2EE37) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_DekuNut.StockNum (0xF30D9F54) [Int] = 40 — store record (every copy) — capped by Capacity.DekuNut (0x735B00F7)

**How to give it: Deku Seeds**

- set IsGet.Item_DekuSeed (0x29888E1E) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_DekuSeed.StockNum (0x5FADF7FC) [Int] = 50 — store record (every copy) — capped by Capacity.DekuSeed (0xAE8CC742)

**How to give it: Deku Sticks**

- set IsGet.Item_DekuStick (0xC4E21AC2) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_DekuStick.StockNum (0xB9494411) [Int] = 30 — store record (every copy) — capped by Capacity.DekuStick (0x457616B0)

**How to give it: Eyedropper**

- set IsGet.Item_EyeDrop (0xB7BDD577) [Bool] = true — store record (every copy)

**How to give it: Eyeball Frog**

- set IsGet.Item_EyeballFrog (0x8E02D1CA) [Bool] = true — store record (every copy)

**How to give it: Magic Beans**

- set IsGet.Item_MagicBean (0x6D39C600) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_MagicBean.StockNum (0xB003124D) [Int] = 10 — store record (every copy)

**How to give it: Odd Mushroom**

- set IsGet.Item_OddMushroom (0xCBD7852A) [Bool] = true — store record (every copy)

**How to give it: Odd Powder**

- set IsGet.Item_OddPowder (0xB75ACAAD) [Bool] = true — store record (every copy)

**How to give it: Pocket Cucco**

- set IsGet.Item_PocketCucco (0xE82E6413) [Bool] = true — store record (every copy)

**How to give it: Pocket Egg**

- set IsGet.Item_PocketEgg (0xEC9C3136) [Bool] = true — store record (every copy)

**How to give it: Prescription**

- set IsGet.Item_Prescription (0xD8F1521E) [Bool] = true — store record (every copy)

**How to give it: Scrub Seeds**

- set IsGet.Item_ScrubBusinessSeed (0xCFBB16F6) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_ScrubBusinessSeed.StockNum (0x600E29EB) [Int] = 5 — store record (every copy)
- Note: defaultCount 5 is the N64 starting seed count (assumption).

**How to give it: Weird Egg**

- set IsGet.Item_WeirdEgg (0x44AB1487) [Bool] = true — store record (every copy)

### Equipment

| Item | Confidence | Verified in game |
|---|---|---|
| Golden Gauntlets | likely | no |
| Silver Gauntlets | likely | no |
| Goron Tunic | confirmed | yes |
| Iron Boots | confirmed | yes |
| Hover Boots | confirmed | yes |
| Adult Tunic | likely | no |
| Zora Tunic | confirmed | yes |
| Goron’s Bracelet | confirmed | yes |
| Lens of Truth | confirmed | yes |
| Broken Sword | likely | no |
| Fishing Rod | likely | no |
| Fishing Hat | likely | no |
| Kokiri Boots | likely | no |
| Poacher's Saw | likely | no |
| Golden Scale | likely | no |
| Silver Scale | likely | no |
| Dark Link's Shield | likely | no |
| Deku Shield | likely | no |
| Hylian Shield | confirmed | yes |
| Mirror Shield | confirmed | yes |
| Biggoron’s Sword | confirmed | yes |
| Giant's Sword (broken) | likely | no |
| Dark Link's Sword | likely | no |
| Giant's Knife | likely | no |
| Kokiri Sword | likely | no |
| Master Sword | confirmed | yes |

**How to give it: Golden Gauntlets**

- set IsGet.Armor_Adult_Gauntlet_Gold (0x3EF15EC4) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Adult_Gauntlet_Gold.StockNum (0x40AE1183) [Int] = 1 — store record (every copy)
- raiseTo 0x59979321 [Enum] = "High" — store record (every copy) — value = murmur3("High") = 0x165AF889; order low→high: None < Low < Middle < High (never lower it)
- Note: Adult only

**How to give it: Silver Gauntlets**

- set IsGet.Armor_Adult_Gauntlet_Silver (0x87E58DE3) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Adult_Gauntlet_Silver.StockNum (0x0012B8C0) [Int] = 1 — store record (every copy)
- raiseTo 0x59979321 [Enum] = "Middle" — store record (every copy) — value = murmur3("Middle") = 0xB6A1CCDF; order low→high: None < Low < Middle < High (never lower it)
- Note: Adult only

**How to give it: Goron Tunic**

- set IsGet.Armor_Adult_Goron (0xAE5611AF) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Adult_Goron.StockNum (0x21ECBD19) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Iron Boots**

- set IsGet.Armor_Adult_HeavyBoot (0x5FA190E6) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Adult_HeavyBoot.StockNum (0x2BAD189A) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Hover Boots**

- set IsGet.Armor_Adult_HoverBoot (0x1109C920) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Adult_HoverBoot.StockNum (0xC9220366) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Adult Tunic**

- set IsGet.Armor_Adult_Normal (0xDE513ABD) [Bool] = true — store record (every copy)

**How to give it: Zora Tunic**

- set IsGet.Armor_Adult_Zora (0x4F5A929C) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Adult_Zora.StockNum (0xB816AF94) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Goron’s Bracelet**

- set IsGet.Armor_Child_Gauntlet_Goron (0x9880707E) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Gauntlet_Goron.StockNum (0xD1317941) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Gauntlet_Goron (0x6FD3DD83) [Bool] = true — store record (every copy)
- raiseTo 0x59979321 [Enum] = "Low" — store record (every copy) — value = murmur3("Low") = 0xD9E40095; order low→high: None < Low < Middle < High (never lower it)

**How to give it: Lens of Truth**

- set IsGet.Armor_GlassTruth (0x7FE2A5B2) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_GlassTruth.StockNum (0x49D1C374) [Int] = 1 — store record (every copy)

**How to give it: Broken Sword**

- set IsGet.Item_BrokenSword (0x645A8175) [Bool] = true — store record (every copy)

**How to give it: Fishing Rod**

- set IsGet.Item_FishingRod (0x10C5B9BF) [Bool] = true — store record (every copy)

**How to give it: Fishing Hat**

- set IsGet.Item_Hat_FishingPondOwner (0xAF176AB2) [Bool] = true — store record (every copy)

**How to give it: Kokiri Boots**

- set IsGet.Item_NormalBoot (0x7215060C) [Bool] = true — store record (every copy)

**How to give it: Poacher's Saw**

- set IsGet.Item_PoacherSaw (0x888D5059) [Bool] = true — store record (every copy)

**How to give it: Golden Scale**

- set IsGet.Item_Scale_Gold (0xCCC1909A) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Scale_Gold.StockNum (0x4AEB140A) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Item_Scale_Gold (0x99394E23) [Bool] = true — store record (every copy)

**How to give it: Silver Scale**

- set IsGet.Item_Scale_Silver (0x1208FB3E) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Scale_Silver.StockNum (0x1240044B) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Item_Scale_Silver (0x131029C2) [Bool] = true — store record (every copy)

**How to give it: Dark Link's Shield**

- set IsGet.Weapon_Shield_DarkLinkShield (0x24570B07) [Bool] = true — store record (every copy)

**How to give it: Deku Shield**

- set IsGet.Weapon_Shield_Deku (0x5217DA1E) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Shield_Deku.StockNum (0x7CA64F23) [Int] = 1 — store record (every copy)

**How to give it: Hylian Shield**

- set IsGet.Weapon_Shield_Hylian (0x2F817D54) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Shield_Hylian.StockNum (0x08BEFD3A) [Int] = 1 — store record (every copy)

**How to give it: Mirror Shield**

- set IsGet.Weapon_Shield_Mirror (0x75E94E42) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Shield_Mirror.StockNum (0xF58E0E2F) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Biggoron’s Sword**

- set IsGet.Weapon_Sword_Biggoron (0x33466812) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Sword_Biggoron.StockNum (0xB0B3E399) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Giant's Sword (broken)**

- set IsGet.Weapon_Sword_BrokenGiant (0x720DF203) [Bool] = true — store record (every copy)

**How to give it: Dark Link's Sword**

- set IsGet.Weapon_Sword_DarkLinkSword (0xA54698C9) [Bool] = true — store record (every copy)

**How to give it: Giant's Knife**

- set IsGet.Weapon_Sword_Giant (0x1E824EFA) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Sword_Giant.StockNum (0x396A5C02) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Kokiri Sword**

- set IsGet.Weapon_Sword_Kokiri (0x405D8A0F) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Sword_Kokiri.StockNum (0xEEB495B9) [Int] = 1 — store record (every copy)

**How to give it: Master Sword**

- set IsGet.Weapon_Sword_Master (0x7AE38E5B) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Sword_Master.StockNum (0xF1C45294) [Int] = 1 — store record (every copy)
- Note: Adult only

### Health

| Item | Confidence | Verified in game |
|---|---|---|
| Hearts | confirmed | yes |
| Heart containers | confirmed | yes |

**How to give it: Hearts**

- setValue PlayerStatus.Life (0x31AB5580) [Int] = {"min":1,"maxFrom":"PlayerStatus.MaxLife"} — engine value object
- Note: The store record is only a copy the game refreshes every frame: write the engine value object (16 bytes: vtable, i32 value at +0x8, murmur3(key) at +0xC).
- Note: Damage or use lowers it again; re-write on a timer to hold it.

**How to give it: Heart containers**

- setValue PlayerStatus.MaxLife (0xFBE01DA1) [Int] = {"min":4,"max":80} — engine value object
- Note: The store record is only a copy the game refreshes every frame: write the engine value object (16 bytes: vtable, i32 value at +0x8, murmur3(key) at +0xC).
- Note: Damage or use lowers it again; re-write on a timer to hold it.

### Items

| Item | Confidence | Verified in game |
|---|---|---|
| Alarm Cucco | likely | no |
| Fire Arrows | confirmed | yes |
| Ice Arrows | confirmed | yes |
| Light Arrows | confirmed | yes |
| Normal Arrows | likely | no |
| Large Bomb Bag | likely | no |
| Medium Bomb Bag | likely | no |
| Small Bomb Bag | likely | no |
| Boomerang | confirmed | yes |
| Empty Bottle | likely | no |
| Large Bullet Bag | likely | no |
| Medium Bullet Bag | likely | no |
| Small Bullet Bag | likely | no |
| Claim Check | likely | no |
| Cojiro | likely | no |
| Din’s Fire | confirmed | yes |
| Double Defense | likely | no |
| Magic Meter | likely | no |
| Double Magic | likely | no |
| Farore’s Wind | confirmed | yes |
| Megaton Hammer | confirmed | yes |
| Hookshot | confirmed | yes |
| Longshot | likely | no |
| Nayru’s Love | confirmed | yes |
| Fairy Ocarina | likely | no |
| Ocarina of Time | confirmed | yes |
| Large Quiver | likely | no |
| Medium Quiver | likely | no |
| Small Quiver | likely | no |
| Large Wallet | likely | no |
| Medium Wallet | likely | no |
| Small Wallet | likely | no |
| Small Key (Treasure Chest) | likely | no |
| Lure | likely | no |
| Fairy Bow | confirmed | yes |
| Fairy Slingshot | confirmed | yes |
| Sinking Lure | likely | no |

**How to give it: Alarm Cucco**

- set IsGet.Item_AlarmCucco (0x14909166) [Bool] = true — store record (every copy)

**How to give it: Fire Arrows**

- set IsGet.Item_Arrow_Fire (0x4DB7EAE0) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Arrow_Fire.StockNum (0x5E529AB9) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Ice Arrows**

- set IsGet.Item_Arrow_Ice (0x5C8F3099) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Arrow_Ice.StockNum (0x40735A8D) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Light Arrows**

- set IsGet.Item_Arrow_Light (0x8637BAB4) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Arrow_Light.StockNum (0xBFB285C8) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Normal Arrows**

- set IsGet.Item_Arrow_Normal (0x572701EA) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Arrow_Normal.StockNum (0x518EC74B) [Int] = 1 — store record (every copy)

**How to give it: Large Bomb Bag**

- set IsGet.Item_BombBag_Large (0x968A5A79) [Bool] = true — store record (every copy)
- atLeast 0xE753508B [Int] = 40 — store record (every copy)
- Note: Bomb bag tier — bomb capacity is set by the also[] write (40). No stock record.

**How to give it: Medium Bomb Bag**

- set IsGet.Item_BombBag_Medium (0xB2C478DA) [Bool] = true — store record (every copy)
- atLeast 0xE753508B [Int] = 30 — store record (every copy)
- Note: Bomb bag tier — bomb capacity is set by the also[] write (30). No stock record.

**How to give it: Small Bomb Bag**

- set IsGet.Item_BombBag_Small (0xA63F1E2D) [Bool] = true — store record (every copy)
- atLeast 0xE753508B [Int] = 20 — store record (every copy)
- Note: Bomb bag tier — bomb capacity is set by the also[] write (20). No stock record.

**How to give it: Boomerang**

- set IsGet.Item_Boomerang (0x7F4CE38D) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Boomerang.StockNum (0xA1D76D31) [Int] = 1 — store record (every copy)

**How to give it: Empty Bottle**

- set IsGet.Item_Bottle (0x1106B082) [Bool] = true — store record (every copy)
- Note: No single count record exists: bottle contents are five named slots (PouchData.BottleA–E.StockNum, all present in the reference save). Grant writes the flag only.

**How to give it: Large Bullet Bag**

- set IsGet.Item_BulletBag_Large (0xB669F025) [Bool] = true — store record (every copy)
- Note: Deku Seed (slingshot) bag tier — slingshot seed capacity follows the tier (50; see the Deku Seed capacity value). No stock record.

**How to give it: Medium Bullet Bag**

- set IsGet.Item_BulletBag_Medium (0xE6CD55D2) [Bool] = true — store record (every copy)
- Note: Deku Seed (slingshot) bag tier — slingshot seed capacity follows the tier (40; see the Deku Seed capacity value). No stock record.

**How to give it: Small Bullet Bag**

- set IsGet.Item_BulletBag_Small (0x488CA1BE) [Bool] = true — store record (every copy)
- Note: Deku Seed (slingshot) bag tier — slingshot seed capacity follows the tier (30; see the Deku Seed capacity value). No stock record.

**How to give it: Claim Check**

- set IsGet.Item_ClaimCheck (0x8B54E680) [Bool] = true — store record (every copy)

**How to give it: Cojiro**

- set IsGet.Item_CojiroCucco (0xFB4442DE) [Bool] = true — store record (every copy)

**How to give it: Din’s Fire**

- set IsGet.Item_DinFire (0xFA04E611) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_DinFire.StockNum (0xB796C16D) [Int] = 1 — store record (every copy)
- Note: Needs magic - now settable via the Magic value (likely; live write pending in-game)

**How to give it: Double Defense**

- set IsGet.Item_FairyBless_DefenseDouble (0x944B78BE) [Bool] = true — store record (every copy)
- Note: Ability flag only; no stock record.

**How to give it: Magic Meter**

- set IsGet.Item_FairyBless_MP (0xB1309073) [Bool] = true — store record (every copy)
- Note: Ability flag only; no stock record.

**How to give it: Double Magic**

- set IsGet.Item_FairyBless_MPDouble (0x87CA4826) [Bool] = true — store record (every copy)
- Note: Ability flag only; no stock record. Requires the Magic Meter to matter.

**How to give it: Farore’s Wind**

- set IsGet.Item_FaroreWind (0xFFABF058) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_FaroreWind.StockNum (0x47F2CA87) [Int] = 1 — store record (every copy)
- Note: Needs magic - now settable via the Magic value (likely; live write pending in-game)

**How to give it: Megaton Hammer**

- set IsGet.Item_Hammer (0x7227EFD8) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Hammer.StockNum (0x1AAFDB66) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Hookshot**

- set IsGet.Item_Hookshot (0xFF98ED58) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Hookshot.StockNum (0x8573D2CD) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Longshot**

- set IsGet.Item_Longshot (0x38AEA3BB) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Longshot.StockNum (0x8499EA34) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Nayru’s Love**

- set IsGet.Item_NayruLove (0x00B44241) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_NayruLove.StockNum (0xF0828CD0) [Int] = 1 — store record (every copy)
- Note: Needs magic - now settable via the Magic value (likely; live write pending in-game)

**How to give it: Fairy Ocarina**

- set IsGet.Item_Ocarina_Fairy (0x42BD296F) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Ocarina_Fairy.StockNum (0xB7DF60F1) [Int] = 1 — store record (every copy)

**How to give it: Ocarina of Time**

- set IsGet.Item_Ocarina_Time (0x1DA2C511) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Ocarina_Time.StockNum (0x54E2A3D1) [Int] = 1 — store record (every copy)

**How to give it: Large Quiver**

- set IsGet.Item_Quiver_Large (0x21985B09) [Bool] = true — store record (every copy)
- atLeast 0x418DB791 [Int] = 50 — store record (every copy)
- Note: Quiver tier — arrow capacity is set by the also[] write (50). No stock record.

**How to give it: Medium Quiver**

- set IsGet.Item_Quiver_Medium (0x9D872202) [Bool] = true — store record (every copy)
- atLeast 0x418DB791 [Int] = 40 — store record (every copy)
- Note: Quiver tier — arrow capacity is set by the also[] write (40). No stock record.

**How to give it: Small Quiver**

- set IsGet.Item_Quiver_Small (0x0A550531) [Bool] = true — store record (every copy)
- atLeast 0x418DB791 [Int] = 30 — store record (every copy)
- Note: Quiver tier — arrow capacity is set by the also[] write (30). No stock record.

**How to give it: Large Wallet**

- set IsGet.Item_Wallet_Large (0xB5031190) [Bool] = true — store record (every copy)

**How to give it: Medium Wallet**

- set IsGet.Item_Wallet_Medium (0xD1360DE8) [Bool] = true — store record (every copy)

**How to give it: Small Wallet**

- set IsGet.Item_Wallet_Small (0xB6E5A3A5) [Bool] = true — store record (every copy)

**How to give it: Small Key (Treasure Chest)**

- set IsGet.Obj_MiniGame_SmallKey (0x8F7916A0) [Bool] = true — store record (every copy)

**How to give it: Lure**

- set IsGet.Weapon_Lure (0xE044B44F) [Bool] = true — store record (every copy)

**How to give it: Fairy Bow**

- set IsGet.Weapon_Range_Bow (0x69EC28BE) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Range_Bow.StockNum (0x938D56BF) [Int] = 1 — store record (every copy)
- Note: Adult only

**How to give it: Fairy Slingshot**

- set IsGet.Weapon_Range_SlingShot (0x0EC22EE1) [Bool] = true — store record (every copy)
- raiseTo PouchData.Weapon_Range_SlingShot.StockNum (0x80D34CE9) [Int] = 1 — store record (every copy)

**How to give it: Sinking Lure**

- set IsGet.Weapon_SinkingLure (0x474F9EB9) [Bool] = true — store record (every copy)

### Magic

| Item | Confidence | Verified in game |
|---|---|---|
| Magic | likely | no |
| Magic meter | likely | no |

**How to give it: Magic**

- setValue PlayerStatus.MP (0x76B18200) [Int] = {"min":0,"maxFrom":"PlayerStatus.MPMax"} — store record (every copy)
- Note: Damage or use lowers it again; re-write on a timer to hold it.

**How to give it: Magic meter**

- setValue PlayerStatus.MPMax (0x12D63A97) [Int] = {"min":0} — store record (every copy)

### Masks

| Item | Confidence | Verified in game |
|---|---|---|
| Fairy Kid Mask (amiibo A) | confirmed | yes |
| Young Zelda Mask (amiibo B) | confirmed | yes |
| Bunny Hood | likely | no |
| Gerudo Mask | likely | no |
| Goron Mask | likely | no |
| Keaton Mask | likely | no |
| Skull Mask | likely | no |
| Spooky Mask | likely | no |
| Mask of Truth | likely | no |
| Zora Mask | likely | no |

**How to give it: Fairy Kid Mask (amiibo A)**

- set IsGet.Armor_Child_Mask_Amiibo0 (0x06F13BB2) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Amiibo0.StockNum (0xF5E647DA) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Amiibo0 (0x826DB2F9) [Bool] = true — store record (every copy)

**How to give it: Young Zelda Mask (amiibo B)**

- set IsGet.Armor_Child_Mask_Amiibo1 (0x09DF9D25) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Amiibo1.StockNum (0x486C59A4) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Amiibo1 (0x62B873A9) [Bool] = true — store record (every copy)

**How to give it: Bunny Hood**

- set IsGet.Armor_Child_Mask_Bunny (0x65AEBE17) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Bunny.StockNum (0x7E607033) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Bunny (0x4641175C) [Bool] = true — store record (every copy)

**How to give it: Gerudo Mask**

- set IsGet.Armor_Child_Mask_Gerudo (0xB1FC4C1D) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Gerudo.StockNum (0x0E94A8DF) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Gerudo (0xDE002422) [Bool] = true — store record (every copy)

**How to give it: Goron Mask**

- set IsGet.Armor_Child_Mask_Goron (0xADFCCD91) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Goron.StockNum (0xFC508DA7) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Goron (0x006614D5) [Bool] = true — store record (every copy)

**How to give it: Keaton Mask**

- set IsGet.Armor_Child_Mask_Keaton (0x35C60E1D) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Keaton.StockNum (0xB5C10899) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Keaton (0xBCC6E7EE) [Bool] = true — store record (every copy)

**How to give it: Skull Mask**

- set IsGet.Armor_Child_Mask_Skull (0xD097482A) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Skull.StockNum (0x47B2D775) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Skull (0x52AD260A) [Bool] = true — store record (every copy)

**How to give it: Spooky Mask**

- set IsGet.Armor_Child_Mask_Spooky (0xC0CF68A7) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Spooky.StockNum (0xF046629E) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Spooky (0xEBD0F400) [Bool] = true — store record (every copy)

**How to give it: Mask of Truth**

- set IsGet.Armor_Child_Mask_Truth (0xF7D5BD9C) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Truth.StockNum (0x96459CD3) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Truth (0x7B320777) [Bool] = true — store record (every copy)

**How to give it: Zora Mask**

- set IsGet.Armor_Child_Mask_Zora (0x280EB00E) [Bool] = true — store record (every copy)
- raiseTo PouchData.Armor_Child_Mask_Zora.StockNum (0x924E9A46) [Int] = 1 — store record (every copy)
- set HavePlayedGetEvent.Armor_Child_Mask_Zora (0xE47CE994) [Bool] = true — store record (every copy)

### Quest

| Item | Confidence | Verified in game |
|---|---|---|
| Boss Key (Fire Temple) | likely | no |
| Boss Key (Forest Temple) | likely | no |
| Boss Key (Ganon's Castle) | likely | no |
| Boss Key (Shadow Temple) | likely | no |
| Boss Key (Spirit Temple) | likely | no |
| Boss Key (Water Temple) | likely | no |
| Echo Gem (Stone of Agony) | confirmed | yes |
| Boss Key | likely | no |
| Compass | likely | no |
| Dungeon Map | likely | no |
| Small Key | likely | no |
| Fire Medallion | confirmed | yes |
| Forest Medallion | confirmed | yes |
| Light Medallion | confirmed | yes |
| Shadow Medallion | confirmed | yes |
| Spirit Medallion | confirmed | yes |
| Water Medallion | confirmed | yes |
| Goron’s Ruby | confirmed | yes |
| Kokiri’s Emerald | confirmed | yes |
| Zora’s Sapphire | confirmed | yes |
| Gerudo Pass (Gerudo’s Card) | confirmed | yes |
| Skulltula Token | likely | no |
| Letter from Zelda | likely | no |
| Heart Container | likely | no |
| Heart Piece | likely | no |
| Small Key 1 (Bottom of the Well) | likely | no |
| Small Key 1 (Fire Temple) | likely | no |
| Small Key 2 (Fire Temple) | likely | no |
| Small Key 3 (Fire Temple) | likely | no |
| Small Key 4 (Fire Temple) | likely | no |
| Small Key 5 (Fire Temple) | likely | no |
| Small Key 6 (Fire Temple) | likely | no |
| Small Key 7 (Fire Temple) | likely | no |
| Small Key 8 (Fire Temple) | likely | no |
| Small Key 1 (Forest Temple) | likely | no |
| Small Key 2 (Forest Temple) | likely | no |
| Small Key 3 (Forest Temple) | likely | no |
| Small Key 4 (Forest Temple) | likely | no |
| Small Key 5 (Forest Temple) | likely | no |
| Small Key 1 (Gerudo Fortress) | likely | no |
| Small Key 2 (Gerudo Fortress) | likely | no |
| Small Key 3 (Gerudo Fortress) | likely | no |
| Small Key 4 (Gerudo Fortress) | likely | no |
| Small Key 1 (Water Temple) | likely | no |
| Small Key 2 (Water Temple) | likely | no |
| Small Key 3 (Water Temple) | likely | no |
| Small Key 4 (Water Temple) | likely | no |
| Small Key 5 (Water Temple) | likely | no |
| Small Key 6 (Water Temple) | likely | no |
| Small Key 7 (Water Temple) | likely | no |

**How to give it: Boss Key (Fire Temple)**

- set DungeonInfo.FireTemple.IsGetBossKey (0xB72D73DF) [Bool] = true — store record (every copy)

**How to give it: Boss Key (Forest Temple)**

- set DungeonInfo.ForestTemple.IsGetBossKey (0x427333A0) [Bool] = true — store record (every copy)

**How to give it: Boss Key (Ganon's Castle)**

- set DungeonInfo.InsideGanonCastle.IsGetBossKey (0x2FD59293) [Bool] = true — store record (every copy)

**How to give it: Boss Key (Shadow Temple)**

- set DungeonInfo.ShadowTemple.IsGetBossKey (0xC33C66CF) [Bool] = true — store record (every copy)

**How to give it: Boss Key (Spirit Temple)**

- set DungeonInfo.SpiritTemple.IsGetBossKey (0x1984C03F) [Bool] = true — store record (every copy)

**How to give it: Boss Key (Water Temple)**

- set DungeonInfo.WaterTemple.IsGetBossKey (0x79DAF80A) [Bool] = true — store record (every copy)

**How to give it: Echo Gem (Stone of Agony)**

- set IsGet.Item_AgonyStone (0xDD587ED8) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_AgonyStone.StockNum (0xF3B14CE2) [Int] = 1 — store record (every copy)

**How to give it: Boss Key**

- set IsGet.Item_Dungeon_BossKey (0x6AC27606) [Bool] = true — store record (every copy)

**How to give it: Compass**

- set IsGet.Item_Dungeon_Compass (0x14FCC563) [Bool] = true — store record (every copy)

**How to give it: Dungeon Map**

- set IsGet.Item_Dungeon_Map (0xFFE25805) [Bool] = true — store record (every copy)

**How to give it: Small Key**

- set IsGet.Item_Dungeon_SmallKey (0x154EF588) [Bool] = true — store record (every copy)

**How to give it: Fire Medallion**

- set IsGet.Item_Medal_Fire (0x103A0DC7) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Medal_Fire.StockNum (0x5CE254A6) [Int] = 1 — store record (every copy)

**How to give it: Forest Medallion**

- set IsGet.Item_Medal_Forest (0xFCD8D653) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Medal_Forest.StockNum (0x692D57CB) [Int] = 1 — store record (every copy)

**How to give it: Light Medallion**

- set IsGet.Item_Medal_Light (0x9026C187) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Medal_Light.StockNum (0x235C7D9A) [Int] = 1 — store record (every copy)

**How to give it: Shadow Medallion**

- set IsGet.Item_Medal_Shadow (0x12D63AC6) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Medal_Shadow.StockNum (0x204D2063) [Int] = 1 — store record (every copy)

**How to give it: Spirit Medallion**

- set IsGet.Item_Medal_Spirit (0xE269DF38) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Medal_Spirit.StockNum (0x0C7A5FD0) [Int] = 1 — store record (every copy)

**How to give it: Water Medallion**

- set IsGet.Item_Medal_Water (0xCF64E780) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Medal_Water.StockNum (0x0151A68F) [Int] = 1 — store record (every copy)

**How to give it: Goron’s Ruby**

- set IsGet.Item_Stone_Fire (0x8908D6AD) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Stone_Fire.StockNum (0x7D69AD47) [Int] = 1 — store record (every copy)

**How to give it: Kokiri’s Emerald**

- set IsGet.Item_Stone_Forest (0x110B83EC) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Stone_Forest.StockNum (0xCBD1E58C) [Int] = 1 — store record (every copy)

**How to give it: Zora’s Sapphire**

- set IsGet.Item_Stone_Water (0xEEC383F5) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Stone_Water.StockNum (0xB8E3BF45) [Int] = 1 — store record (every copy)

**How to give it: Gerudo Pass (Gerudo’s Card)**

- set IsGet.Item_Token_Gerudo (0x0E6264C7) [Bool] = true — store record (every copy)
- raiseTo PouchData.Item_Token_Gerudo.StockNum (0xFEB4D56B) [Int] = 1 — store record (every copy)

**How to give it: Skulltula Token**

- set IsGet.Item_Token_Gold (0x6BA394FE) [Bool] = true — store record (every copy)

**How to give it: Letter from Zelda**

- set IsGet.Item_ZeldaLetter (0xF19393B5) [Bool] = true — store record (every copy)

**How to give it: Heart Container**

- set IsGet.Obj_Heart_Container (0xBB4E20C9) [Bool] = true — store record (every copy)

**How to give it: Heart Piece**

- set IsGet.Obj_Heart_Piece (0xE6AAAB65) [Bool] = true — store record (every copy)

**How to give it: Small Key 1 (Bottom of the Well)**

- set BottomOfTheWell_Level_Room_03_Get_SmallKey (0x8028323F) [Bool] = true — store record (every copy)

**How to give it: Small Key 1 (Fire Temple)**

- set FireTemple_GetSmallKey_01 (0x57771BBD) [Bool] = true — store record (every copy)

**How to give it: Small Key 2 (Fire Temple)**

- set FireTemple_GetSmallKey_02 (0xF6544FD0) [Bool] = true — store record (every copy)

**How to give it: Small Key 3 (Fire Temple)**

- set FireTemple_GetSmallKey_03 (0x6669C4EB) [Bool] = true — store record (every copy)

**How to give it: Small Key 4 (Fire Temple)**

- set FireTemple_GetSmallKey_04 (0x24EF10FF) [Bool] = true — store record (every copy)

**How to give it: Small Key 5 (Fire Temple)**

- set FireTemple_GetSmallKey_05 (0xBE0BE4F3) [Bool] = true — store record (every copy)

**How to give it: Small Key 6 (Fire Temple)**

- set FireTemple_GetSmallKey_06 (0xF37FA0B2) [Bool] = true — store record (every copy)

**How to give it: Small Key 7 (Fire Temple)**

- set FireTemple_GetSmallKey_07 (0x49EE141A) [Bool] = true — store record (every copy)

**How to give it: Small Key 8 (Fire Temple)**

- set FireTemple_GetSmallKey_08 (0x7BA3C368) [Bool] = true — store record (every copy)

**How to give it: Small Key 1 (Forest Temple)**

- set ForestTemple_Room00_GetSmallKey (0xDAF141E8) [Bool] = true — store record (every copy)

**How to give it: Small Key 2 (Forest Temple)**

- set ForestTemple_Room06_GetSmallKey (0xA31DB95B) [Bool] = true — store record (every copy)

**How to give it: Small Key 3 (Forest Temple)**

- set ForestTemple_Room09_GetSmallKey (0x5CB887DC) [Bool] = true — store record (every copy)

**How to give it: Small Key 4 (Forest Temple)**

- set ForestTemple_Room12_GetSmallKey (0x21B0BD71) [Bool] = true — store record (every copy)

**How to give it: Small Key 5 (Forest Temple)**

- set ForestTemple_Room18_GetSmallKey (0xFBFD2CCC) [Bool] = true — store record (every copy)

**How to give it: Small Key 1 (Gerudo Fortress)**

- set IsGet_SmallKey_GerudoFortress.SmallKey01 (0xDC0010F6) [Bool] = true — store record (every copy)

**How to give it: Small Key 2 (Gerudo Fortress)**

- set IsGet_SmallKey_GerudoFortress.SmallKey02 (0x1EE8E249) [Bool] = true — store record (every copy)

**How to give it: Small Key 3 (Gerudo Fortress)**

- set IsGet_SmallKey_GerudoFortress.SmallKey03 (0x2815A352) [Bool] = true — store record (every copy)

**How to give it: Small Key 4 (Gerudo Fortress)**

- set IsGet_SmallKey_GerudoFortress.SmallKey04 (0x397957CA) [Bool] = true — store record (every copy)

**How to give it: Small Key 1 (Water Temple)**

- set WaterTemple_Room02_GetSmallKey (0xC56265F6) [Bool] = true — store record (every copy)

**How to give it: Small Key 2 (Water Temple)**

- set WaterTemple_Room08_GetSmallKey (0xD492A7AF) [Bool] = true — store record (every copy)

**How to give it: Small Key 3 (Water Temple)**

- set WaterTemple_Room16_GetSmallKey (0xE331F321) [Bool] = true — store record (every copy)

**How to give it: Small Key 4 (Water Temple)**

- set WaterTemple_Room17_GetSmallKey (0x24D15EA2) [Bool] = true — store record (every copy)

**How to give it: Small Key 5 (Water Temple)**

- set WaterTemple_Room18_GetSmallKey (0x588AB25F) [Bool] = true — store record (every copy)

**How to give it: Small Key 6 (Water Temple)**

- set WaterTemple_Room20_GetSmallKey (0x0EC96F6D) [Bool] = true — store record (every copy)

**How to give it: Small Key 7 (Water Temple)**

- set WaterTemple_Room21_GetSmallKey (0x177ADC78) [Bool] = true — store record (every copy)

### Rupees

| Item | Confidence | Verified in game |
|---|---|---|
| Rupees | confirmed | yes |

**How to give it: Rupees**

- setValue PlayerStatus.CurrentRupee (0xA77921D7) [Int] = {"maxFrom":"Capacity.Wallet"} — store record (every copy)
- Note: Damage or use lowers it again; re-write on a timer to hold it.

### Songs

| Item | Confidence | Verified in game |
|---|---|---|
| Epona’s Song | confirmed | yes |
| Bolero of Fire | confirmed | yes |
| Minuet of Forest | confirmed | yes |
| Prelude of Light | confirmed | yes |
| Saria’s Song | confirmed | yes |
| Scarecrow's Song | guess | no |
| Nocturne of Shadow | confirmed | yes |
| Requiem of Spirit | confirmed | yes |
| Song of Storms | confirmed | yes |
| Sun’s Song | confirmed | yes |
| Song of Time | confirmed | yes |
| Serenade of Water | confirmed | yes |
| Zelda’s Lullaby | confirmed | yes |

**How to give it: Epona’s Song**

- set IsGet.Item_Melody_EponaSong (0xB492AC33) [Bool] = true — store record (every copy)

**How to give it: Bolero of Fire**

- set IsGet.Item_Melody_FireBolero (0x49041AB9) [Bool] = true — store record (every copy)

**How to give it: Minuet of Forest**

- set IsGet.Item_Melody_ForestMinuet (0xDC0A0B54) [Bool] = true — store record (every copy)

**How to give it: Prelude of Light**

- set IsGet.Item_Melody_LightPrelude (0xD6320BA4) [Bool] = true — store record (every copy)

**How to give it: Saria’s Song**

- set IsGet.Item_Melody_SariaSong (0xD3F8BFCC) [Bool] = true — store record (every copy)

**How to give it: Scarecrow's Song**

- set AskBonooru_listentothesong (0xFDF0F4B8) [Bool] = true — store record (every copy)
- set 0xCC535536 [UIntArray] = [] — save file only (game closed) — button ids of the learned notes
- Note: A real learn also creates a Binary key 0x3339DF55 (not reproduced).

**How to give it: Nocturne of Shadow**

- set IsGet.Item_Melody_ShadowNocturne (0xC2FB95F4) [Bool] = true — store record (every copy)

**How to give it: Requiem of Spirit**

- set IsGet.Item_Melody_SpiritRequiem (0x802A36A8) [Bool] = true — store record (every copy)

**How to give it: Song of Storms**

- set IsGet.Item_Melody_StormSong (0x2B39DD4F) [Bool] = true — store record (every copy)

**How to give it: Sun’s Song**

- set IsGet.Item_Melody_SunSong (0x165DD1AD) [Bool] = true — store record (every copy)

**How to give it: Song of Time**

- set IsGet.Item_Melody_TimeSong (0x03B3450E) [Bool] = true — store record (every copy)

**How to give it: Serenade of Water**

- set IsGet.Item_Melody_WaterSerenade (0x3FA63986) [Bool] = true — store record (every copy)

**How to give it: Zelda’s Lullaby**

- set IsGet.Item_Melody_ZeldaLullaby (0x01C20002) [Bool] = true — store record (every copy)

### Tokens

| Item | Confidence | Verified in game |
|---|---|---|
| Gold Skulltula tokens (count) | likely | no |

**How to give it: Gold Skulltula tokens (count)**

- setValue PouchData.Item_Token_Gold.StockNum (0x04735978) [Int] = {"min":0,"max":100} — store record (every copy)
