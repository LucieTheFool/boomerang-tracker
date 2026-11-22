# Ocarina of Time (Switch 2) GameData reference

Generated 2026-11-22 from commit 6b01630 (format 1). Do not edit by hand: regenerate with `npm run reference`. The same facts, machine-readable, are in `oot-switch2-gamedata.json`.

This is what we have mapped of the game's GameData store: key hashes, names, types, what they mean, and grant recipes (the exact writes that give an item). It is meant for anyone building their own tools or mods for the Switch 2 recomps. Everything here was found by observing saves and the running game.

Counts: 405 keys, 122 64-bit keys, 184 grant recipes, 24 checklist recipe classes, 6 game processes, 58 stages.

## Confidence levels

- **confirmed**: seen in game, or in a save diff at the right moment.
- **likely**: the key name and the saves agree; not checked in game.
- **guess**: indirect inference; needs a diff before use.
- **verified in game** (grants): the write itself was tried in the running game and held.

## Reading vs writing

Reading a save or the live tables is safe. Writing live memory changes the running game: back up saves first, write only records you resolved through the hash map, check the vtable, write every copy and read it back. Write save files only with the game closed.

## Key hashes

MurmurHash3 x86_32, seed 0, over the UTF-8 bytes of the full key name, no terminator. Enum values: an Enum record holds murmur3(value name).

| Name | Hash |
|---|---|
| AttackByWeapon | 0xB58C29C3 |
| PlayerStatus.Life | 0x31AB5580 |
| IsGet.Item_Boomerang | 0x7F4CE38D |

Placed-object flags (Skulltulas, some heart pieces, chests) use 64-bit keys that are not a hash of a known name; they are listed raw in keys64. Some objects keep a second key for the other age (key xor 2, unverified).

## Finding the tables in a save

Little-endian. Header: magic 0x01020304 at 0x00, format version at 0x04, data-area start at 0x08. From 0x28 to the data area: 8-byte records {u32 key hash, u32 value}. A record with hash 0 starts a section; its value is the type id of the records that follow. The first section (Bool) has no separator. Inline types keep the value in the record (Bool: non-zero = true; Enum: murmur3 of the value name). Every other type stores an offset into the data area; offsets ascend and each value ends where the next begins.

Type ids: 0 Bool, 1 BoolArray, 2 Int, 3 IntArray, 4 Float, 5 FloatArray, 6 Enum, 7 EnumArray, 8 Vector2, 9 Vector2Array, 10 Vector3, 11 Vector3Array, 12 String16, 13 String16Array, 14 String32, 15 String32Array, 16 String64, 17 String64Array, 18 Binary, 19 BinaryArray, 20 UInt, 21 UIntArray, 22 Int64, 23 Int64Array, 24 UInt64, 25 UInt64Array, 26 WString16, 27 WString16Array, 28 WString32, 29 WString32Array, 30 WString64, 31 WString64Array, 32 Bool64bitKey.

- **String16_32_64**: fixed 16/32/64-byte NUL-padded text
- **WString**: UTF-16, 2 bytes per char (WString16 = 32 bytes)
- **Vector2_3**: 2 or 3 f32
- **Arrays**: u32 count, then the elements
- **BoolArray**: u32 bit count, then bits packed in u32 words (bit i = word i>>5, bit i&31)
- **Binary**: u32 size, then the bytes
- **Bool64bitKey**: one record; its offset points to an ascending list of u64 keys running to the end of the file. Only keys that are set are stored; offset 0 = none; a trailing 0 is padding.

## Finding the tables in memory

The live tables are a copy of the same GameData store (saves are written from it). Trust them only after they agree with the latest save. Records can move: re-check the vtable before every access.

| Process | Role | Where the game memory is |
|---|---|---|
| hookshot.exe | game | guest address G is at host 0x100000000000 + G |
| lichii.exe | emulator | placed somewhere new every run: sweep MEM_MAPPED regions (VirtualQueryEx) for the tables |
| Longshot.exe | launcher | starts the game; holds no game memory |
| relink-game.exe | game | guest address G is at host 0x100000000000 + G |
| ReLink.exe | launcher | starts the game; holds no game memory |
| Triforce.exe | game | guest address G is at host 0x100000000000 + G |

Tested with: Hookshot v2.1.0, Longshot v1.0.0, Triforce (NX2navi) v0.4.0, Project ReLink v0.7.7, Fritchii (lichii.exe).

| Table | Stride | Value at | Copies |
|---|---|---|---|
| Bool | 0x00000018 | 0x00000016 | 0x00000016, 0x00000017 |
| Int | 0x00000028 | 0x0000001C | 0x0000001C, 0x00000020 |
| Enum | 0x00000038 | 0x0000001C | 0x0000001C, 0x00000020 |
| String64 | 0x00000108 | 0x00000074 | 0x00000074 |
| Int64 | 0x00000030 | 0x00000020 | 0x00000020, 0x00000028 |

- Every record of a table starts with the same 8-byte pointer (the type's vtable). It is read at run time from the table itself, not hard-coded.
- Directly before each record array: a hash map of {u32 key hash, u32 record index}. Resolve a key through it; never guess an address.
- 64-bit keys: entries 0x00000010 apart, u64 key at +0x0, class byte at +0x8 (0x18 permanent, 0x58 respawning), set byte at 0x0000000C (1 = set), sorted by key.
- Locating: Scan readable memory (around the guest base, or every MEM_MAPPED region for emulators) for runs of records that share one 8-byte pointer at the type's stride, at least minRecords long. Read the hash map before the run and compare the values with the latest save; keep the best-scoring run per type. Use the tables only while they still match the save (≥90% of the save's true flags still true).
- Engine value objects (0x00000010 bytes): u64 vtable at +0x0, i32 value at 0x00000008, u32 murmur3(key) at 0x0000000C. Some values (current hearts) really live here; the store record is a per-frame copy. PlayerStatus.Life is directly followed by PlayerStatus.MaxLife with the same vtable. Address changes every run; find by key hash and re-check vtable + hash before each access.
- Writing: To change a value: key hash → hash map → record → check vtable → write every copy → read back. Possession flags do not equip wearables or grant their abilities by themselves.

## Grant recipes

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

## Checklist entries (per location)

What a real pickup sets, per kind of entry. Status "pending" means the full set of writes has not been recorded from a real pickup yet: the entry's own key below is what marks it collected, but the game may also change counters or other flags.

### Heart pieces

Status: pending, confidence: likely. Real pickup flips the location flag (Npc_/Room_/IsTreasureBoxOpen... per save-mapping v2) and adds 1 to PouchData.Obj_Heart_Piece.StockNum; every 4th piece should also add a heart container (PlayerStatus.MaxLife +4). Verify the MaxLife bump in the same write window.

Related keys (not yet confirmed): PlayerStatus.MaxLife, PouchData.Obj_Heart_Piece.StockNum

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Kakariko Village (heart_pieces.001) | all | Npc_Hylia_001_IsGetHeartPiece | likely |
| Graveyard (heart_pieces.002) | all | GraveYard_DiggingHoleTour_Drop_HeartPiece | likely |
| Lon Lon Ranch (heart_pieces.003) | all | 0x88358AF5B5300AA9 | likely |
| Gerudo Valley (heart_pieces.004) | all | 0x7001F17C | likely |
| Gerudo Valley (heart_pieces.005) | all | 0xDFD66C63357CDEA7 | likely |
| Lake Hylia (heart_pieces.006) | all | MiniGame_Fishing_GetHeartPiece | likely |
| Hyrule Castle Town (heart_pieces.007) | all | SubEvent_FindRichard_GetHeartPiece | likely |
| Lost Woods (heart_pieces.008) | all | Minigame_SkullKidSession_IsGetHeartPiece | likely |
| Lost Woods (heart_pieces.009) | all | Npc_SkullKid_Child_IsGetHeartPiece | likely |
| Goron City (heart_pieces.010) | all | GoronLargePot_IsGetHeartPiece | likely |
| Death Mountain Crater (heart_pieces.011) | all | 0x8F5F3D3321AEB7CD | likely |
| Kakariko Village (heart_pieces.012) | all | 0xF8C7601DA7DD887E | likely |
| Hyrule Castle Town (heart_pieces.013) | all | MiniGame_BombchuBowling_ClearThirdTime | likely |
| Zora's River (heart_pieces.014) | all | 0x9EFABD5B0516C341 | likely |
| Zora's River (heart_pieces.015) | all | 0x3A23B59EAEDC0510 | likely |
| Zora's Domain (heart_pieces.016) | all | IsTreasureBoxOpen.3130048366421939233 | likely |
| Graveyard (heart_pieces.017) | all | 0x1DF0DBF50C1732B7 | likely |
| Kakariko Village (heart_pieces.018) | all | 0xB9D0070B468F26D2 | likely |
| Graveyard (heart_pieces.019) | all | UnderTheGrave_DampeRace_HeartGeted | likely |
| Kakariko Village (heart_pieces.020) | any | KakarikoVillage_IsAfterSave_Npc_Hylia_025; KakarikoVillage_GatheringTokenGold_GetReward50 | likely |
| Lake Hylia (heart_pieces.021) | all | 0xBAEC91D6ED8DD96B | likely |
| Lake Hylia (heart_pieces.022) | all | Npc_Hylia_045_HasDived | likely |
| Death Mountain Trail (heart_pieces.023) | all | 0x09ECB6A0150FEE97 | likely |
| Death Mountain Crater (heart_pieces.024) | all | 0x0A564328FAF93C71 | likely |
| Zora's Fountain (heart_pieces.025) | all | 0xAC2E26B5EC7DA3A2 | likely |
| Zora's Fountain (heart_pieces.026) | all | 0x6F736FC80F7B0ACA | likely |
| Zora's River (heart_pieces.027) | all | MiniGame_FrogTenors_StormSong | likely |
| Zora's River (heart_pieces.028) | all | MiniGame_FrogTenors_InsectRepellent | likely |
| Hyrule Castle Town (heart_pieces.029) | all | MiniGame_ChoiceTreasure_IsClear | likely |
| Gerudo Fortress (heart_pieces.030) | all | IsTreasureBoxOpen.12343753510713797715 | likely |
| Gerudo Fortress (heart_pieces.031) | all | MiniGame_HorsebackArchery_GotaHeart | likely |
| Desert Colossus (heart_pieces.032) | all | 0x92FEAB9A9810C619 | likely |
| Graveyard (heart_pieces.033) | all | IsTreasureBoxOpen.9622128545943056087 | likely |
| Hyrule Field (heart_pieces.034) | all | HyruleField_Enemy_Scrub_Business_HeartPiece_01 | likely |
| Hyrule Field (near Gerudo Valley) (heart_pieces.035) | all | IsTreasureBoxOpen.2967378296224661060 | likely |
| Death Mountain Crater (heart_pieces.036) | all | DeathMountain_Enemy_Scrub_Business_HeartPiece_01 | likely |

### Heart containers

Status: pending, confidence: likely. Obtain flag from save-mapping v2 (defeat/event) plus PlayerStatus.MaxLife +4 (quarter-heart scale, derived.maxHearts). Boss containers are expected in the same window as the boss defeat (see bosses). Verify the game adds the container immediately vs on save/load.

Related keys (not yet confirmed): PlayerStatus.MaxLife

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Heart Container (Barinade) (heart_containers.heart_container_barinade) | any | 0xF45F5319D88E7AC7; DefeatedEnemyNum.Enemy_DungeonBoss_Barinade atLeast 1 | likely |
| Heart Container (Bongo) (heart_containers.heart_container_bongo) | any | 0xF43CCB260F5576DC; DefeatedEnemyNum.Enemy_DungeonBoss_BongoBongo atLeast 1 | likely |
| Heart Container (Gohma) (heart_containers.heart_container_gohma) | any | 0xF914FA367471A3E3; InsideTheDekuTree_Heart_Container_Obtained | likely |
| Heart Container (King Dodongo) (heart_containers.heart_container_king_dodongo) | any | 0x5262CEA56C53554D; DefeatedEnemyNum.Enemy_DungeonBoss_Dodongo atLeast 1 | likely |
| Heart Container (Morpha) (heart_containers.heart_container_morpha) | any | 0xC835E1D03656BF46; DefeatedEnemyNum.Enemy_DungeonBoss_Morpha atLeast 1 | likely |
| Heart Container (Phantom Ganon) (heart_containers.heart_container_phantom_ganon) | any | 0xFF11593A22778E7E; DefeatedEnemyNum.Enemy_DungeonBoss_PhantomGanon atLeast 1 | likely |
| Heart Container (Twinrova) (heart_containers.heart_container_twinrova) | any | 0x41811F125B1EEDD5; DefeatedEnemyNum.Enemy_DungeonBoss_Twinrova atLeast 1 | likely |
| Heart Container (Volvagia) (heart_containers.heart_container_volvagia) | any | 0x8389CAFB1277D318; DefeatedEnemyNum.Enemy_DungeonBoss_Volvagia atLeast 1 | likely |

### Gold Skulltulas

Status: pending, confidence: likely. Per-skulltula Bool64bitKey defeat row (100/100 hashes in save-mapping v2) + PouchData.Item_Token_Gold.StockNum +1 + DefeatedEnemyNum.Enemy_Skulltula_Gold +1 (cap: KillLimit). Clawshot v0.2.2 tokens.py: defeat saved under actor Hash H and H xor 2 (age copies) - verify the xor row appears for age-variant skulltulas.

Related keys (not yet confirmed): DefeatedEnemyNum.Enemy_Skulltula_Gold, PouchData.Item_Token_Gold.StockNum

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Great Deku Tree (gold_skulltulas.001) | all | 0xBCE05898CE61F1C0 | confirmed |
| Great Deku Tree (gold_skulltulas.002) | all | 0xDF73F3739CEF466B | confirmed |
| Great Deku Tree (gold_skulltulas.003) | all | 0xFAD8931A0011E1D4 | confirmed |
| Great Deku Tree (gold_skulltulas.004) | all | 0xF2E27D6A27026ACF | confirmed |
| Hyrule Castle Town (gold_skulltulas.005) | all | 0x7C1A05315F83C34D | likely |
| Hyrule Castle (gold_skulltulas.006) | all | 0x22C0F7DFF5EBB86D | confirmed |
| Kakariko Village (gold_skulltulas.007) | all | 0xC3C68D0AC4B85831 | confirmed |
| Kakariko Village (gold_skulltulas.008) | all | 0xD4883A16973B1D06 | confirmed |
| Kakariko Village (gold_skulltulas.009) | all | 0x6A8D9B2373D08FCB | confirmed |
| Kakariko Village (gold_skulltulas.010) | all | 0xD1CEF51CF294FB86 | confirmed |
| Graveyard (gold_skulltulas.011) | all | 0xE91F6BE796358FFC | likely |
| Kakariko Village (gold_skulltulas.012) | all | 0xA1632E322C612B97 | likely |
| Lon Lon Ranch (gold_skulltulas.013) | all | 0x04BE4A8FF29F2099 | confirmed |
| Lake Hylia (gold_skulltulas.014) | all | 0x61576BEFD16C499A | likely |
| Gerudo Valley (gold_skulltulas.015) | all | 0x738F5746CC517702 | likely |
| Kokiri Forest (gold_skulltulas.016) | all | 0xECDC46B409ED7D38 | confirmed |
| Lost Woods (gold_skulltulas.017) | all | 0x8186BCB07D6C2CF9 | confirmed |
| Lost Woods (gold_skulltulas.018) | all | 0xF6FA6EF0CA152948 | confirmed |
| Kokiri Forest (gold_skulltulas.019) | all | 0x858F5000AD57B2CC | likely |
| Death Mountain Trail (gold_skulltulas.020) | all | 0xF1D32C06612DA232 | likely |
| Dodongo's Cavern (gold_skulltulas.021) | all | 0x758CE7B4868447FB | likely |
| Dodongo's Cavern (gold_skulltulas.022) | all | 0x10434342A3917EBD | likely |
| Dodongo's Cavern (gold_skulltulas.023) | all | 0x3F5B150F16D84603 | likely |
| Dodongo's Cavern (gold_skulltulas.024) | all | 0xBDFE13C37F356829 | likely |
| Death Mountain Crater (gold_skulltulas.025) | all | 0xFCD7F04DCF755E8E | likely |
| Death Mountain Trail (gold_skulltulas.026) | all | 0x04E03AC27985E328 | likely |
| Goron City (gold_skulltulas.027) | all | 0x07E6E21142CC54DB | likely |
| Zora's River (gold_skulltulas.028) | all | 0xABAD0E9F0D471156 | likely |
| Zora's River (gold_skulltulas.029) | all | 0x78AE4FD90B3CFAAA | likely |
| Zora's Fountain (gold_skulltulas.030) | all | 0xF0DAC245E2FC448E | likely |
| Lord Jabu-Jabu's Belly (gold_skulltulas.031) | all | 0x9FC92497F014DBD5 | likely |
| Lord Jabu-Jabu's Belly (gold_skulltulas.032) | all | 0xC03F282FF60942B6 | likely |
| Lord Jabu-Jabu's Belly (gold_skulltulas.033) | all | 0x9C95FD41B89C058A | likely |
| Lord Jabu-Jabu's Belly (gold_skulltulas.034) | all | 0xDDD260AFB6F2989A | likely |
| Zora's Fountain (gold_skulltulas.035) | all | 0x63446D12663DAA83 | likely |
| Lake Hylia (gold_skulltulas.036) | all | 0xC1858A4FCD84A28E | likely |
| Lon Lon Ranch (gold_skulltulas.037) | all | 0xDC8113831C56B194 | likely |
| Lon Lon Ranch (gold_skulltulas.038) | all | 0x25E6072D4DF023B3 | likely |
| Hyrule Field (gold_skulltulas.039) | all | 0xA6A4E87DA18FA678 | likely |
| Gerudo Valley (gold_skulltulas.040) | all | 0xD3D86D3D6988ED8C | likely |
| Graveyard (gold_skulltulas.041) | all | 0x032F42F523BE6425 | likely |
| Hyrule Field (gold_skulltulas.042) | all | 0x1E38E8D23596EECF | likely |
| Hyrule Castle (outside Ganon's Castle) (gold_skulltulas.043) | all | 0x4E13CC311CD04DF4 | likely |
| Kokiri Forest (gold_skulltulas.044) | all | 0x62C340F0B876C195 | confirmed |
| Lost Woods (gold_skulltulas.045) | all | 0x3C2B585AC5C0443E | likely |
| Sacred Forest Meadow (gold_skulltulas.046) | all | 0xC8DB3346F78EA31B | likely |
| Forest Temple (gold_skulltulas.047) | all | 0x99CA89963485DF11 | likely |
| Forest Temple (gold_skulltulas.048) | all | 0xF46B1710ED0620D1 | likely |
| Forest Temple (gold_skulltulas.049) | all | 0x984021BC20419EBE | likely |
| Forest Temple (gold_skulltulas.050) | all | 0x2AA39F00AAA2D331 | likely |
| Forest Temple (gold_skulltulas.051) | all | 0x1BF5F0176EF03BDA | likely |
| Dodongo's Cavern (gold_skulltulas.052) | all | 0x0D53E429A1EF383D | likely |
| Goron City (gold_skulltulas.053) | all | 0xFBBC2D490276C68E | likely |
| Death Mountain Crater (gold_skulltulas.054) | all | 0x58C75BADF059CA54 | likely |
| Fire Temple (gold_skulltulas.055) | all | 0x5E3AE6A7CF3AC292 | likely |
| Fire Temple (gold_skulltulas.056) | all | 0xB0F77B17CFB37458 | likely |
| Fire Temple (gold_skulltulas.057) | all | 0xCC175A90E0014905 | likely |
| Fire Temple (gold_skulltulas.058) | all | 0x4D1B7E35CA0C6484 | likely |
| Fire Temple (gold_skulltulas.059) | all | 0x7F498ADA1C2E9C7A | likely |
| Death Mountain Trail (gold_skulltulas.060) | all | 0x0B8E43ABFA0B5F86 | likely |
| Death Mountain Trail (gold_skulltulas.061) | all | 0xF5359B24FC86AC22 | likely |
| Zora's River (gold_skulltulas.062) | all | 0x97824C2FFEAA877C | likely |
| Zora's Domain (gold_skulltulas.063) | all | 0x853B892663C0215D | likely |
| Ice Cavern (gold_skulltulas.064) | all | 0x63701A2CF70B201C | likely |
| Ice Cavern (gold_skulltulas.065) | all | 0xCDB49F5D0A67FCF6 | likely |
| Ice Cavern (gold_skulltulas.066) | all | 0x165FC0BC0ACA1F6C | likely |
| Gerudo Valley (gold_skulltulas.067) | all | 0xA017CE09904C2DCE | likely |
| Lake Hylia (Lakeside Laboratory) (gold_skulltulas.068) | all | 0x6689BDEBC95368EB | likely |
| Water Temple (gold_skulltulas.069) | all | 0xD731EA6A04D0FD01 | likely |
| Water Temple (gold_skulltulas.070) | all | 0xA0973706F6415ECD | likely |
| Water Temple (gold_skulltulas.071) | all | 0x02974596F92CF377 | likely |
| Water Temple (gold_skulltulas.072) | all | 0xE03A2965DF9F7B30 | likely |
| Water Temple (gold_skulltulas.073) | all | 0x3D0DE5ADAEB73CC9 | likely |
| Lake Hylia (gold_skulltulas.074) | all | 0x0AF4D6F063D3AE9F | likely |
| Hyrule Castle (gold_skulltulas.075) | all | 0x7F28485FA5D3688F | confirmed |
| Bottom of the Well (gold_skulltulas.076) | all | 0x35FB354FAC262D36 | likely |
| Bottom of the Well (gold_skulltulas.077) | all | 0xA8D6182A5C956E16 | likely |
| Bottom of the Well (gold_skulltulas.078) | all | 0x6789388E9FB9C92C | likely |
| Shadow Temple (gold_skulltulas.079) | all | 0xEAFE60E592E9A3FB | likely |
| Shadow Temple (gold_skulltulas.080) | all | 0xD23A7A2C9ECED9CE | likely |
| Shadow Temple (gold_skulltulas.081) | all | 0xD7FFBE169189E50D | likely |
| Shadow Temple (gold_skulltulas.082) | all | 0x7A74BC651F9FE024 | likely |
| Shadow Temple (gold_skulltulas.083) | all | 0x8E87908CB035E950 | likely |
| Gerudo Valley (gold_skulltulas.084) | all | 0xBC85EFCA2B222CD9 | likely |
| Gerudo Fortress (gold_skulltulas.085) | all | 0x81ED4ED76699E3D8 | likely |
| Haunted Wasteland (Mirage Desert) (gold_skulltulas.086) | all | 0xCEED596F17934971 | likely |
| Desert Colossus (gold_skulltulas.087) | all | 0xD0F7E5FFA76BA288 | likely |
| Desert Colossus (gold_skulltulas.088) | all | 0x0341F2C03598C861 | likely |
| Gerudo Fortress (gold_skulltulas.089) | all | 0xB4ECE769E6F3A206 | likely |
| Desert Colossus (gold_skulltulas.090) | all | 0x9AE3D0AC392E6CDA | likely |
| Spirit Temple (gold_skulltulas.091) | all | 0x9222E742B73D3D2C | likely |
| Spirit Temple (gold_skulltulas.092) | all | 0x8C8BB95471D20D02 | likely |
| Spirit Temple (gold_skulltulas.093) | all | 0xB3D9F353599EEA53 | likely |
| Spirit Temple (gold_skulltulas.094) | all | 0x70B0FCA66CA4808A | likely |
| Spirit Temple (gold_skulltulas.095) | all | 0x4696B2730DE0516C | likely |
| Kakariko Village (gold_skulltulas.096) | all | 0x2DF265292516BDF0 | likely |
| Zora's River (gold_skulltulas.097) | all | 0x8325FEA55EDFBE97 | likely |
| Lake Hylia (gold_skulltulas.098) | all | 0x781E0DE8EED42373 | likely |
| Hyrule Field (gold_skulltulas.099) | all | 0x7D8EC14BDD1F6341 | likely |
| Zora's Fountain (gold_skulltulas.100) | all | 0x845BA51DC18C855E | likely |

### Songs

Status: pending, confidence: likely. IsGet.Item_Melody_<Name> bool set, 13 songs; names cross-checked against Clawshot v0.2.2 item_actors.toml (match).

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Bolero of Fire (songs.bolero_of_fire) | all | IsGet.Item_Melody_FireBolero | likely |
| Epona's Song (songs.eponas_song) | all | IsGet.Item_Melody_EponaSong | likely |
| Minuet of Forest (songs.minuet_of_forest) | all | IsGet.Item_Melody_ForestMinuet | likely |
| Nocturne of Shadow (songs.nocturne_of_shadow) | all | IsGet.Item_Melody_ShadowNocturne | likely |
| Prelude of Light (songs.prelude_of_light) | all | IsGet.Item_Melody_LightPrelude | confirmed |
| Requiem of Spirit (songs.requiem_of_spirit) | all | IsGet.Item_Melody_SpiritRequiem | likely |
| Saria's Song (songs.sarias_song) | all | IsGet.Item_Melody_SariaSong | likely |
| Scarecrow's Song (songs.scarecrows_song) | all | IsGet.Item_Melody_ScarecrowSong | likely |
| Serenade of Water (songs.serenade_of_water) | all | IsGet.Item_Melody_WaterSerenade | likely |
| Song of Storms (songs.song_of_storms) | all | IsGet.Item_Melody_StormSong | likely |
| Song of Time (songs.song_of_time) | all | IsGet.Item_Melody_TimeSong | likely |
| Sun's Song (songs.suns_song) | all | IsGet.Item_Melody_SunSong | likely |
| Zelda's Lullaby (songs.zeldas_lullaby) | all | IsGet.Item_Melody_ZeldaLullaby | likely |

### Equipment

Status: pending, confidence: likely. IsGet flags per save-mapping v2 (12 entries). Clawshot item_actors match; gauntlet tiers use Armor_Child_Gauntlet_Goron / Armor_Adult_Gauntlet_Silver / Armor_Adult_Gauntlet_Gold. Verify a higher-tier grant also sets lower-tier flags.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Biggoron's Sword (equipment.biggorons_sword) | all | IsGet.Weapon_Sword_Biggoron | likely |
| Deku Shield (equipment.deku_shield) | all | IsGet.Weapon_Shield_Deku | confirmed |
| Giant's Knife (equipment.giants_knife) | all | IsGet.Weapon_Sword_Giant | likely |
| Goron Tunic (equipment.goron_tunic) | all | IsGet.Armor_Adult_Goron | likely |
| Hover Boots (equipment.hover_boots) | all | IsGet.Armor_Adult_HoverBoot | likely |
| Hylian Shield (equipment.hylian_shield) | all | IsGet.Weapon_Shield_Hylian | likely |
| Iron Boots (equipment.iron_boots) | all | IsGet.Armor_Adult_HeavyBoot | likely |
| Kokiri Sword (equipment.kokiri_sword) | all | IsGet.Weapon_Sword_Kokiri | confirmed |
| Kokiri Tunic (Hero's Clothes) (equipment.kokiri_tunic_heros_clothes) | always |  | likely |
| Master Sword (equipment.master_sword) | all | IsGet.Weapon_Sword_Master | likely |
| Mirror Shield (equipment.mirror_shield) | all | IsGet.Weapon_Shield_Mirror | likely |
| Zora Tunic (equipment.zora_tunic) | all | IsGet.Armor_Adult_Zora | likely |

### Items

Status: pending, confidence: likely. IsGet flags per save-mapping v2 (27 entries), names match Clawshot item_actors.toml. Magic bean: IsGet.Item_MagicBean + PouchData.Item_MagicBean.StockNum; planting flips Gimmick_MagicBeanSoil_<area> flags (12 named plots - see magic_beans_planted), that side is consumption, not acquisition.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Bomb Bag (items.bomb_bag) | all | IsGet.Item_BombBag_Small | likely |
| Bombchus (items.bombchus) | all | IsGet.Item_Bombchu | likely |
| Boomerang (items.boomerang) | all | IsGet.Item_Boomerang | likely |
| Deku Nuts (items.deku_nuts) | all | IsGet.Item_DekuNut | confirmed |
| Deku Sticks (items.deku_sticks) | all | IsGet.Item_DekuStick | confirmed |
| Din's Fire (items.dins_fire) | all | IsGet.Item_DinFire | likely |
| Double Magic (items.double_magic) | all | IsGet.Item_FairyBless_MPDouble | likely |
| Echo Gem (items.echo_gem) | all | IsGet.Item_AgonyStone | likely |
| Fairy Bow (items.fairy_bow) | all | IsGet.Weapon_Range_Bow | likely |
| Fairy Ocarina (items.fairy_ocarina) | all | IsGet.Item_Ocarina_Fairy | likely |
| Fairy Slingshot (items.fairy_slingshot) | all | IsGet.Weapon_Range_SlingShot | confirmed |
| Farore's Wind (items.farores_wind) | all | IsGet.Item_FaroreWind | likely |
| Fire Arrow (items.fire_arrow) | all | IsGet.Item_Arrow_Fire | likely |
| Golden Gauntlets (items.golden_gauntlets) | all | IsGet.Armor_Adult_Gauntlet_Gold | likely |
| Golden Scale (items.golden_scale) | all | IsGet.Item_Scale_Gold | likely |
| Goron's Bracelet (items.gorons_bracelet) | all | IsGet.Armor_Child_Gauntlet_Goron | likely |
| Hookshot (items.hookshot) | all | IsGet.Item_Hookshot | likely |
| Ice Arrow (items.ice_arrow) | all | IsGet.Item_Arrow_Ice | likely |
| Lenses of Truth (items.lenses_of_truth) | all | IsGet.Armor_GlassTruth | likely |
| Light Arrow (items.light_arrow) | all | IsGet.Item_Arrow_Light | likely |
| Longshot (items.longshot) | all | IsGet.Item_Longshot | likely |
| Magic Bean (items.magic_bean) | all | IsGet.Item_MagicBean | likely |
| Megaton Hammer (items.megaton_hammer) | all | IsGet.Item_Hammer | likely |
| Nayru's Love (items.nayrus_love) | all | IsGet.Item_NayruLove | likely |
| Ocarina of Time (items.ocarina_of_time) | all | IsGet.Item_Ocarina_Time | likely |
| Silver Gauntlets (items.silver_gauntlets) | all | IsGet.Armor_Adult_Gauntlet_Silver | likely |
| Silver Scale (items.silver_scale) | all | IsGet.Item_Scale_Silver | likely |

### Key items

Status: pending, confidence: likely. Ocarina of Time: IsGet flag per save-mapping v2.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Gerudo Membership Card (key_items.gerudo_membership_card) | all | IsGet.Item_Token_Gerudo | likely |

### Masks

Status: pending, confidence: likely. IsGet flags per save-mapping v2 (7 entries incl. Zora/Gerudo extras). Zora/Gerudo flag names are in-game-grant-confirmed but flag strings inferred - diff first. Goron Mask = Goron Bracelet (no separate flag).

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Bunny Hood (masks.bunny_hood) | all | IsGet.Armor_Child_Mask_Bunny | likely |
| Keaton Mask (masks.keaton_mask) | all | IsGet.Armor_Child_Mask_Keaton | likely |
| Mask of Truth (masks.mask_of_truth) | all | IsGet.Armor_Child_Mask_Truth | likely |
| Skull Mask (masks.skull_mask) | all | IsGet.Armor_Child_Mask_Skull | likely |
| Spooky Mask (masks.spooky_mask) | all | IsGet.Armor_Child_Mask_Spooky | likely |

### Bottles

Status: pending, confidence: likely. Bottle IsGet flags per save-mapping v2 (4 named + 1 step). Poe Collector: Step flag reaches Complete plus the bottle flag. Verify whether a new bottle type also bumps a bottle-count field.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Cucco Lady bottle (bottles.cucco_lady_bottle) | all | MiniGame_CatchCucco_IsCompleted | likely |
| Lon Lon Milk bottle (Talon) (bottles.lon_lon_milk_bottle_talon) | all | IsClear_Minigame_FindOutCucco | confirmed |
| Poe Collector bottle (bottles.poe_collector_bottle) | all | Step_SubEvent_GhostShop set "Complete" | confirmed |
| Potion Shop bottle (bottles.potion_shop_bottle) | all | Market_Item_Bottle_TutorialEvent_Cleared | likely |
| Ruto's Letter bottle (bottles.rutos_letter_bottle) | all | IsGet.Item_Bottle_Letter | likely |

### Great fairies

Status: pending, confidence: likely. HavePlayedGetEvent flags per save-mapping v2 (6 entries).

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Death Mountain Crater: Double Magic (great_fairies.death_mountain_crater_double_magic) | any | HavePlayedEvent.Dm_FairyFountain_Wisdom; IsGet.Item_FairyBless_MPDouble | likely |
| Death Mountain summit: Magic Meter + Din's Fire (great_fairies.death_mountain_summit_magic_meter_dins_fire) | any | HavePlayedEvent.Dm_FairyFountain_Din; IsGet.Item_DinFire | likely |
| Desert Colossus: Nayru's Love (great_fairies.desert_colossus_nayrus_love) | any | HavePlayedEvent.Dm_FairyFountain_Nayru; IsGet.Item_NayruLove | likely |
| Hyrule Castle grounds (child): Enhanced (charged) Spin Attack (great_fairies.hyrule_castle_grounds_child_enhanced_charged_spin_attack) | any | HavePlayedEvent.Dm_FairyFountain_Power; IsGet.Item_FairyBless_MP | likely |
| Outside Ganon's Castle (adult): Double Defense (halved damage) (great_fairies.outside_ganons_castle_adult_double_defense_halved_damage) | any | HavePlayedEvent.Dm_FairyFountain_Courage; IsGet.Item_FairyBless_DefenseDouble | likely |
| Zora's Fountain: Farore's Wind (great_fairies.zoras_fountain_farores_wind) | any | HavePlayedEvent.Dm_FairyFountain_Frore; IsGet.Item_FaroreWind | likely |

### Capacity upgrades

Status: pending, confidence: likely. Tier IsGet flags per save-mapping v2 (14 entries: bomb/bow/bug/slowbow/bottle-deku-shu). PouchData byte offsets corroborated. Verify a tier upgrade also sets lower-tier flags. Kokiri Wallet is owned from the start (no write).

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Adult's Wallet (capacity.adults_wallet) | all | IsGet.Item_Wallet_Medium | likely |
| Bigger Bomb Bag (capacity.bigger_bomb_bag) | all | IsGet.Item_BombBag_Medium | likely |
| Bigger Deku Seed Bag (capacity.bigger_deku_seed_bag) | all | IsGet.Item_BulletBag_Medium | likely |
| Bigger Quiver (capacity.bigger_quiver) | all | IsGet.Item_Quiver_Medium | likely |
| Biggest Bomb Bag (capacity.biggest_bomb_bag) | all | IsGet.Item_BombBag_Large | likely |
| Biggest Deku Seed Bag (capacity.biggest_deku_seed_bag) | all | IsGet.Item_BulletBag_Large | likely |
| Biggest Quiver (capacity.biggest_quiver) | all | IsGet.Item_Quiver_Large | likely |
| Bomb Bag (capacity.bomb_bag) | all | IsGet.Item_BombBag_Small | likely |
| Deku Nut capacity 30 (capacity.deku_nut_capacity_30) | all | IsGet.Item_NutBag_Medium | likely |
| Deku Nut capacity 40 (capacity.deku_nut_capacity_40) | all | IsGet.Item_NutBag_Large | likely |
| Deku Stick capacity 20 (capacity.deku_stick_capacity_20) | all | IsGet.Item_StickBag_Medium | likely |
| Deku Stick capacity 30 (capacity.deku_stick_capacity_30) | all | IsGet.Item_StickBag_Large | likely |
| Giant's Wallet (capacity.giants_wallet) | all | IsGet.Item_Wallet_Large | likely |
| Kokiri Wallet (capacity.kokiri_wallet) | always |  | likely |

### Stones & medallions

Status: pending, confidence: likely. Named event flags per save-mapping v2 (9 entries).

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Fire Medallion (stones_medallions.fire_medallion) | all | IsGet.Item_Medal_Fire | likely |
| Forest Medallion (stones_medallions.forest_medallion) | all | IsGet.Item_Medal_Forest | likely |
| Goron's Ruby (stones_medallions.gorons_ruby) | all | IsGet.Item_Stone_Fire | likely |
| Kokiri's Emerald (stones_medallions.kokiris_emerald) | all | IsGet.Item_Stone_Forest | likely |
| Light Medallion (stones_medallions.light_medallion) | all | IsGet.Item_Medal_Light | likely |
| Shadow Medallion (stones_medallions.shadow_medallion) | all | IsGet.Item_Medal_Shadow | likely |
| Spirit Medallion (stones_medallions.spirit_medallion) | all | IsGet.Item_Medal_Spirit | likely |
| Water Medallion (stones_medallions.water_medallion) | all | IsGet.Item_Medal_Water | likely |
| Zora's Sapphire (stones_medallions.zoras_sapphire) | all | IsGet.Item_Stone_Water | likely |

### Dungeon clears

Status: pending, confidence: likely. Boss-out HavePlayedEvent flag + boss defeat counter (see bosses). Per save-mapping v2 (12 entries).

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Bottom of the Well (dungeons.bottom_of_the_well) | all | IsGet.Armor_GlassTruth | likely |
| Dodongo's Cavern (dungeons.dodongos_cavern) | all | HavePlayedEvent.Dm_DodongoCave_BossOut | likely |
| Fire Temple (dungeons.fire_temple) | all | HavePlayedEvent.Dm_FireTemple_BossOut | likely |
| Forest Temple (dungeons.forest_temple) | all | HavePlayedEvent.Dm_ForestTemple_BossOut | likely |
| Ganon's Castle (dungeons.ganons_castle) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Ganon atLeast 1 | likely |
| Gerudo Training Ground (dungeons.gerudo_training_ground) | all | IsGet.Item_Arrow_Ice | likely |
| Great Deku Tree (dungeons.great_deku_tree) | all | HavePlayedEvent.Dm_Deku_BossOut | likely |
| Ice Cavern (dungeons.ice_cavern) | all | IsGet.Armor_Adult_HeavyBoot | likely |
| Lord Jabu-Jabu's Belly (dungeons.lord_jabu_jabus_belly) | all | HavePlayedEvent.Dm_InsideJabu_Jabu_BossOut | likely |
| Shadow Temple (dungeons.shadow_temple) | all | HavePlayedEvent.Dm_ShadowTemple_BossOut | likely |
| Spirit Temple (dungeons.spirit_temple) | all | HavePlayedEvent.Dm_SpiritTemple_BossOut | likely |
| Water Temple (dungeons.water_temple) | all | HavePlayedEvent.Dm_WaterTemple_BossOut | likely |

### Boss defeats

Status: pending, confidence: likely. DefeatedEnemyNum.Enemy_DungeonBoss_<Name> +1 (gte 1) per save-mapping v2 (10 entries); expected in the same window as the heart container.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Barinade (bosses.barinade) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Barinade atLeast 1 | likely |
| Bongo (bosses.bongo) | all | DefeatedEnemyNum.Enemy_DungeonBoss_BongoBongo atLeast 1 | likely |
| Ganon (bosses.ganon) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Ganon atLeast 1 | likely |
| Ganondorf (bosses.ganondorf) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Ganondorf atLeast 1 | likely |
| Gohma (bosses.gohma) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Gohma atLeast 1 | likely |
| King Dodongo (bosses.king_dodongo) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Dodongo atLeast 1 | likely |
| Morpha (bosses.morpha) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Morpha atLeast 1 | likely |
| Phantom Ganon (bosses.phantom_ganon) | all | DefeatedEnemyNum.Enemy_DungeonBoss_PhantomGanon atLeast 1 | likely |
| Twinrova (bosses.twinrova) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Twinrova atLeast 1 | likely |
| Volvagia (bosses.volvagia) | all | DefeatedEnemyNum.Enemy_DungeonBoss_Volvagia atLeast 1 | likely |

### Mini-boss defeats

Status: pending, confidence: likely. DefeatedEnemyNum counters per save-mapping v2 (10 entries).

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Big Octo (mini_bosses.big_octo) | all | DefeatedEnemyNum.Enemy_MiddleBoss_BigOcto atLeast 1 | likely |
| Dark Link (mini_bosses.dark_link) | all | DefeatedEnemyNum.Enemy_MiddleBoss_DarkLink atLeast 1 | likely |
| Dead Hand (mini_bosses.dead_hand) | all | DefeatedEnemyNum.Enemy_DeadHand atLeast 1 | likely |
| Flare Dancer (mini_bosses.flare_dancer) | all | DefeatedEnemyNum.Enemy_MiddleBoss_FlareDancer atLeast 1 | likely |
| Gerudo guards (carpenter cells) (mini_bosses.gerudo_guards_carpenter_cells) | all | DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief atLeast 1; DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief_02 atLeast 1; DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief_03 atLeast 1; DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief_04 atLeast 1 | likely |
| Great Moblin (mini_bosses.great_moblin) | all | DefeatedEnemyNum.Enemy_Moblin_Club atLeast 1 | likely |
| Iron Knuckle (mini_bosses.iron_knuckle) | any | DefeatedEnemyNum.Enemy_IronKnuckle_Silver atLeast 1; DefeatedEnemyNum.Enemy_IronKnuckle_Black atLeast 1; DefeatedEnemyNum.Enemy_IronKnuckle_White atLeast 1 | likely |
| Iron Knuckle (Nabooru) (mini_bosses.iron_knuckle_nabooru) | all | DefeatedEnemyNum.Enemy_MiddleBoss_IronKnuckle_Nabooru atLeast 1 | likely |
| Poe Sisters (mini_bosses.poe_sisters) | all | DefeatedEnemyNum.Enemy_MiddleBoss_Poe_Meg atLeast 1 | likely |
| White Wolfos (mini_bosses.white_wolfos) | all | DefeatedEnemyNum.Enemy_Wolfos_White atLeast 1 | likely |

### Side quests

Status: pending, confidence: likely. Step flags reach Complete per save-mapping v2 (6 entries). One step name (Step_SubEvent_GetStormSong) is NOT in the remake live key catalog - verify which key the dry-well windmill quest actually sets.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Broken Windmill, Dry Well (side_quests.broken_windmill_dry_well) | all | Step_SubEvent_GetStormSong set "Complete" | likely |
| From a Pocket Egg Comes… (side_quests.from_a_pocket_egg_comes) | all | Step_SubEvent_GetSwordBigGoron set "Complete" | likely |
| Happy Mask Shopkeeper (side_quests.happy_mask_shopkeeper) | all | Step_SubEvent_MaskSalesman set "Complete" | likely |
| Malon's Friend (side_quests.malons_friend) | all | Step_Get_Epona set "Complete" | likely |
| Stir the Scarecrow's Soul! (side_quests.stir_the_scarecrows_soul) | all | Step_SubEvent_GetScarecrow set "Complete" | likely |
| To the Great Fairy (side_quests.to_the_great_fairy) | all | Step_Meet_GreatFairy set "Complete" | likely |

### Big Poes

Status: pending, confidence: guess. Defeat flags HyruleField_Defeat_BigPoe_01..10 exist in the live catalog, but flag-to-location binding is unverified (10 locations per spreadsheet; in-game kill diff needed). Selling flips GhostShop_CouponNum - units (Poes vs points) unknown, 0 in every save so far.

Related keys (not yet confirmed): GhostShop_CouponNum, HyruleField_Defeat_BigPoe_01, HyruleField_Defeat_BigPoe_02, HyruleField_Defeat_BigPoe_03, HyruleField_Defeat_BigPoe_04, HyruleField_Defeat_BigPoe_05, HyruleField_Defeat_BigPoe_06, HyruleField_Defeat_BigPoe_07, HyruleField_Defeat_BigPoe_08, HyruleField_Defeat_BigPoe_09, HyruleField_Defeat_BigPoe_10

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Ruined bridge entrance (by the sign) (big_poes.001) | all | 0x40772671 | confirmed |
| Between Lon Lon Ranch and Hyrule Castle (big_poes.002) | all | 0x40772671 | confirmed |
| Lon Lon Ranch entrance (by a tree) (big_poes.003) | all | 0x40772671 | confirmed |
| Behind Lon Lon Ranch (big_poes.004) | all | 0x40772671 | confirmed |
| Base of the hill to Gerudo Valley (big_poes.005) | all | 0x40772671 | confirmed |
| Hill to Gerudo Valley (closer to the ranch) (big_poes.006) | all | 0x40772671 | confirmed |
| Woods south of Lon Lon Ranch (big_poes.007) | all | 0x40772671 | confirmed |
| South of the crab-shaped watering hole (big_poes.008) | all | 0x40772671 | confirmed |
| Left/south of the Kokiri entrance (big_poes.009) | all | 0x40772671 | confirmed |
| Field between Lon Lon Ranch and Kokiri Forest (big_poes.010) | all | 0x40772671 | confirmed |

### Skulltula rewards

Status: pending, confidence: likely. GetReward flag per save-mapping v2 (6 thresholds); Clawshot: the reward item also gets its own IsGet (e.g. Item_Wallet_Medium at 10) - verify both land.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| 100 tokens: Gold Rupee (200 Rupees, repeatable) (skulltula_rewards.100_tokens_gold_rupee_200_rupees_repeatable) | all | Step_GatheringTokenGold set "Complete" | likely |
| 10 tokens: Adult's Wallet (skulltula_rewards.10_tokens_adults_wallet) | all | KakarikoVillage_GatheringTokenGold_GetReward10 | likely |
| 20 tokens: Echo Gem (skulltula_rewards.20_tokens_echo_gem) | all | KakarikoVillage_GatheringTokenGold_GetReward20 | likely |
| 30 tokens: Giant's Wallet (skulltula_rewards.30_tokens_giants_wallet) | all | KakarikoVillage_GatheringTokenGold_GetReward30 | likely |
| 40 tokens: Bombchus (20) (skulltula_rewards.40_tokens_bombchus_20) | all | KakarikoVillage_GatheringTokenGold_GetReward40 | likely |
| 50 tokens: Piece of Heart (skulltula_rewards.50_tokens_piece_of_heart) | all | KakarikoVillage_GatheringTokenGold_GetReward50 | likely |

### Child trades

Status: pending, confidence: likely. Trade-item IsGet flags per save-mapping v2 (3 entries). Verify a trade step also flips the next trade item.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Wake-up Cucco (child_trade.wake_up_cucco) | all | IsGet.Item_AlarmCucco | likely |
| Weird Egg (child_trade.weird_egg) | all | IsGet.Item_WeirdEgg | likely |
| Zelda's Letter (child_trade.zeldas_letter) | all | IsGet.Item_ZeldaLetter | likely |

### Adult trades

Status: pending, confidence: likely. Trade-item IsGet flags per save-mapping v2 (11 entries). Verify a trade step also flips the next trade item.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Broken Goron's Sword (adult_trade.broken_gorons_sword) | all | IsGet.Item_BrokenSword | likely |
| Claim Check (adult_trade.claim_check) | all | IsGet.Item_ClaimCheck | likely |
| Cojiro (adult_trade.cojiro) | all | IsGet.Item_CojiroCucco | likely |
| Eyeball Frog (adult_trade.eyeball_frog) | all | IsGet.Item_EyeballFrog | likely |
| Odd Mushroom (adult_trade.odd_mushroom) | all | IsGet.Item_OddMushroom | likely |
| Odd Potion (adult_trade.odd_potion) | all | IsGet.Item_OddPowder | likely |
| Poacher's Saw (adult_trade.poachers_saw) | all | IsGet.Item_PoacherSaw | likely |
| Pocket Cucco (adult_trade.pocket_cucco) | all | IsGet.Item_PocketCucco | likely |
| Pocket Egg (adult_trade.pocket_egg) | all | IsGet.Item_PocketEgg | likely |
| Prescription (adult_trade.prescription) | all | IsGet.Item_Prescription | likely |
| World's Finest Eye Drops (adult_trade.worlds_finest_eye_drops) | all | IsGet.Item_EyeDrop | likely |

### Magic beans planted

Status: pending, confidence: likely. Per-plot Gimmick_MagicBeanSoil_<area> flags - 12 named plots in the live catalog (area names, not numbers). Bean stock: PouchData.Item_MagicBean.StockNum. 100% threshold unverified (spreadsheet=6, finalboss.io=10).

Related keys (not yet confirmed): Gimmick_MagicBeanSoil_DeathMountainCrater, Gimmick_MagicBeanSoil_DeathMountainTrail, Gimmick_MagicBeanSoil_DesertColossus, Gimmick_MagicBeanSoil_GerudoValley, Gimmick_MagicBeanSoil_Graveyard, Gimmick_MagicBeanSoil_KokiriForest, Gimmick_MagicBeanSoil_KokiriForest_LostWood, Gimmick_MagicBeanSoil_LakeHylia, Gimmick_MagicBeanSoil_LostWood01, Gimmick_MagicBeanSoil_LostWood02, Gimmick_MagicBeanSoil_ZoraRiver, Gimmick_MagicBeanSoil_ZoraRiver02, PouchData.Item_MagicBean.StockNum

### Maps, compasses, boss keys

Status: pending, confidence: likely. DungeonInfo.<D>.IsGetMap / IsGetCompass / IsGetBossKey bools. Live-catalog check 2026-11-18: all 20 map/compass names present; 5 of 6 boss keys present - WaterTemple.IsGetBossKey is ABSENT (12 of 16 dungeons have the key; the remake may have removed the Water Temple boss key, in-game check needed). See t_8f32a3da.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Bottom of the Well Compass (dungeon_items.bottom_of_the_well_compass) | all | DungeonInfo.BottomOfTheWell.IsGetCompass | likely |
| Bottom of the Well Map (dungeon_items.bottom_of_the_well_map) | all | DungeonInfo.BottomOfTheWell.IsGetMap | likely |
| Dodongo's Cavern Compass (dungeon_items.dodongos_cavern_compass) | all | DungeonInfo.DodongoCavern.IsGetCompass | likely |
| Dodongo's Cavern Map (dungeon_items.dodongos_cavern_map) | all | DungeonInfo.DodongoCavern.IsGetMap | likely |
| Fire Temple Boss Key (dungeon_items.fire_temple_boss_key) | all | DungeonInfo.FireTemple.IsGetBossKey | likely |
| Fire Temple Compass (dungeon_items.fire_temple_compass) | all | DungeonInfo.FireTemple.IsGetCompass | likely |
| Fire Temple Map (dungeon_items.fire_temple_map) | all | DungeonInfo.FireTemple.IsGetMap | likely |
| Forest Temple Boss Key (dungeon_items.forest_temple_boss_key) | all | DungeonInfo.ForestTemple.IsGetBossKey | likely |
| Forest Temple Compass (dungeon_items.forest_temple_compass) | all | DungeonInfo.ForestTemple.IsGetCompass | likely |
| Forest Temple Map (dungeon_items.forest_temple_map) | all | DungeonInfo.ForestTemple.IsGetMap | likely |
| Ganon's Castle Boss Key (dungeon_items.ganons_castle_boss_key) | all | DungeonInfo.InsideGanonCastle.IsGetBossKey | likely |
| Great Deku Tree Compass (dungeon_items.great_deku_tree_compass) | all | DungeonInfo.InsideTheDekuTree.IsGetCompass | confirmed |
| Great Deku Tree Map (dungeon_items.great_deku_tree_map) | all | DungeonInfo.InsideTheDekuTree.IsGetMap | confirmed |
| Ice Cavern Compass (dungeon_items.ice_cavern_compass) | all | DungeonInfo.IceCavern.IsGetCompass | likely |
| Ice Cavern Map (dungeon_items.ice_cavern_map) | all | DungeonInfo.IceCavern.IsGetMap | likely |
| Lord Jabu-Jabu's Belly Compass (dungeon_items.lord_jabu_jabus_belly_compass) | all | DungeonInfo.InsideJabuJabuBelly.IsGetCompass | likely |
| Lord Jabu-Jabu's Belly Map (dungeon_items.lord_jabu_jabus_belly_map) | all | DungeonInfo.InsideJabuJabuBelly.IsGetMap | likely |
| Shadow Temple Boss Key (dungeon_items.shadow_temple_boss_key) | all | DungeonInfo.ShadowTemple.IsGetBossKey | likely |
| Shadow Temple Compass (dungeon_items.shadow_temple_compass) | all | DungeonInfo.ShadowTemple.IsGetCompass | likely |
| Shadow Temple Map (dungeon_items.shadow_temple_map) | all | DungeonInfo.ShadowTemple.IsGetMap | likely |
| Spirit Temple Boss Key (dungeon_items.spirit_temple_boss_key) | all | DungeonInfo.SpiritTemple.IsGetBossKey | likely |
| Spirit Temple Compass (dungeon_items.spirit_temple_compass) | all | DungeonInfo.SpiritTemple.IsGetCompass | likely |
| Spirit Temple Map (dungeon_items.spirit_temple_map) | all | DungeonInfo.SpiritTemple.IsGetMap | likely |
| Water Temple Boss Key (dungeon_items.water_temple_boss_key) | all | DungeonInfo.WaterTemple.IsGetBossKey | likely |
| Water Temple Compass (dungeon_items.water_temple_compass) | all | DungeonInfo.WaterTemple.IsGetCompass | likely |
| Water Temple Map (dungeon_items.water_temple_map) | all | DungeonInfo.WaterTemple.IsGetMap | likely |

### Room keys

Status: pending, confidence: likely. Per-chest flags verified 25/25 in the live catalog: Forest 5 (Room00/06/09/12/18_GetSmallKey), Fire 8 (GetSmallKey_01..08), Water 7, Bottom of the Well 1, Gerudo Fortress 4 (IsGet_SmallKey_GerudoFortress.SmallKey01..04). No held-count field exists in the live table (Clawshot's DungeonInfo.<D>.SmallKeyNum is absent) - expected grant: set the specific chest flag for key N, the game presumably derives the count from the flags. Open: a hidden raw count byte may also change on pickup (checklist #4), and the first key may set the global IsGet.Item_Dungeon_SmallKey. Catalog extras not yet mapped: ShadowTemple_Level_Room_13_GetKey, BottomOfTheWell_Level_Room_03_Get_Key (special keys?).

Related keys (not yet confirmed): HavePlayedGetEvent.Item_Dungeon_SmallKey, IsGet.Item_Dungeon_SmallKey

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Bottom of the Well small key 1 (room_keys.bottom_of_the_well_1) | all | BottomOfTheWell_Level_Room_03_Get_SmallKey | likely |
| Fire Temple small key 1 (room_keys.fire_temple_1) | all | FireTemple_GetSmallKey_01 | likely |
| Fire Temple small key 2 (room_keys.fire_temple_2) | all | FireTemple_GetSmallKey_02 | likely |
| Fire Temple small key 3 (room_keys.fire_temple_3) | all | FireTemple_GetSmallKey_03 | likely |
| Fire Temple small key 4 (room_keys.fire_temple_4) | all | FireTemple_GetSmallKey_04 | likely |
| Fire Temple small key 5 (room_keys.fire_temple_5) | all | FireTemple_GetSmallKey_05 | likely |
| Fire Temple small key 6 (room_keys.fire_temple_6) | all | FireTemple_GetSmallKey_06 | likely |
| Fire Temple small key 7 (room_keys.fire_temple_7) | all | FireTemple_GetSmallKey_07 | likely |
| Fire Temple small key 8 (room_keys.fire_temple_8) | all | FireTemple_GetSmallKey_08 | likely |
| Forest Temple small key 1 (room_keys.forest_temple_1) | all | ForestTemple_Room00_GetSmallKey | likely |
| Forest Temple small key 2 (room_keys.forest_temple_2) | all | ForestTemple_Room06_GetSmallKey | likely |
| Forest Temple small key 3 (room_keys.forest_temple_3) | all | ForestTemple_Room09_GetSmallKey | likely |
| Forest Temple small key 4 (room_keys.forest_temple_4) | all | ForestTemple_Room12_GetSmallKey | likely |
| Forest Temple small key 5 (room_keys.forest_temple_5) | all | ForestTemple_Room18_GetSmallKey | likely |
| Gerudo Fortress small key 1 (room_keys.gerudo_fortress_1) | all | IsGet_SmallKey_GerudoFortress.SmallKey01 | likely |
| Gerudo Fortress small key 2 (room_keys.gerudo_fortress_2) | all | IsGet_SmallKey_GerudoFortress.SmallKey02 | likely |
| Gerudo Fortress small key 3 (room_keys.gerudo_fortress_3) | all | IsGet_SmallKey_GerudoFortress.SmallKey03 | likely |
| Gerudo Fortress small key 4 (room_keys.gerudo_fortress_4) | all | IsGet_SmallKey_GerudoFortress.SmallKey04 | likely |
| Water Temple small key 1 (room_keys.water_temple_1) | all | WaterTemple_Room02_GetSmallKey | likely |
| Water Temple small key 2 (room_keys.water_temple_2) | all | WaterTemple_Room08_GetSmallKey | likely |
| Water Temple small key 3 (room_keys.water_temple_3) | all | WaterTemple_Room16_GetSmallKey | likely |
| Water Temple small key 4 (room_keys.water_temple_4) | all | WaterTemple_Room17_GetSmallKey | likely |
| Water Temple small key 5 (room_keys.water_temple_5) | all | WaterTemple_Room18_GetSmallKey | likely |
| Water Temple small key 6 (room_keys.water_temple_6) | all | WaterTemple_Room20_GetSmallKey | likely |
| Water Temple small key 7 (room_keys.water_temple_7) | all | WaterTemple_Room21_GetSmallKey | likely |

### Amiibo masks

Status: pending, confidence: likely. IsGet flags from the in-game amiibo session (2026-11-17); flag strings cross-checked against save-mapping v2.

| Entry | Rule | Keys | Confidence |
|---|---|---|---|
| Young Link amiibo mask (amiibo_masks.young_link) | all | IsGet.Armor_Child_Mask_Amiibo0 | confirmed |
| Young Zelda amiibo mask (amiibo_masks.young_zelda) | all | IsGet.Armor_Child_Mask_Amiibo1 | confirmed |

## Keys

Every key we know something about, grouped by kind. Unnamed keys show our own label in italics.

### Cutscene / event seen

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| HavePlayedEvent.Dm_Deku_BossOut | 0x5882768C | Bool | dungeons.great_deku_tree | likely |
| HavePlayedEvent.Dm_DodongoCave_BossOut | 0x764B65D6 | Bool | dungeons.dodongos_cavern | likely |
| HavePlayedEvent.Dm_FairyFountain_Courage | 0x1330A253 | Bool | great_fairies.outside_ganons_castle_adult_double_defense_halved_damage | likely |
| HavePlayedEvent.Dm_FairyFountain_Din | 0x6D0523E3 | Bool | great_fairies.death_mountain_summit_magic_meter_dins_fire | likely |
| HavePlayedEvent.Dm_FairyFountain_Frore | 0xCA320C10 | Bool | great_fairies.zoras_fountain_farores_wind | likely |
| HavePlayedEvent.Dm_FairyFountain_Nayru | 0x75B6F007 | Bool | great_fairies.desert_colossus_nayrus_love | likely |
| HavePlayedEvent.Dm_FairyFountain_Power | 0x8FA2608E | Bool | great_fairies.hyrule_castle_grounds_child_enhanced_charged_spin_attack | likely |
| HavePlayedEvent.Dm_FairyFountain_Wisdom | 0xE36744CF | Bool | great_fairies.death_mountain_crater_double_magic | likely |
| HavePlayedEvent.Dm_FireTemple_BossOut | 0x9AED592A | Bool | dungeons.fire_temple | likely |
| HavePlayedEvent.Dm_ForestTemple_BossOut | 0xDA2C0485 | Bool | dungeons.forest_temple | likely |
| HavePlayedEvent.Dm_InsideJabu_Jabu_BossOut | 0x8AD33D7F | Bool | dungeons.lord_jabu_jabus_belly | likely |
| HavePlayedEvent.Dm_ShadowTemple_BossOut | 0x3DFBF016 | Bool | dungeons.shadow_temple | likely |
| HavePlayedEvent.Dm_SpiritTemple_BossOut | 0x9C48FB26 | Bool | dungeons.spirit_temple | likely |
| HavePlayedEvent.Dm_WaterTemple_BossOut | 0x65F3BA2E | Bool | dungeons.water_temple | likely |

### Dungeon map, compass & keys

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| DungeonInfo.BottomOfTheWell.IsGetCompass | 0x9D6EFAAC | Bool | dungeon_items.bottom_of_the_well_compass | likely |
| DungeonInfo.BottomOfTheWell.IsGetMap | 0x77C47EC9 | Bool | dungeon_items.bottom_of_the_well_map | likely |
| DungeonInfo.DodongoCavern.IsGetCompass | 0x8B93EDF9 | Bool | dungeon_items.dodongos_cavern_compass | likely |
| DungeonInfo.DodongoCavern.IsGetMap | 0xA52C3A19 | Bool | dungeon_items.dodongos_cavern_map | likely |
| DungeonInfo.FireTemple.IsGetBossKey | 0xB72D73DF | Bool | owned: Boss Key (Fire Temple) | likely |
| DungeonInfo.FireTemple.IsGetCompass | 0x0AA068B6 | Bool | dungeon_items.fire_temple_compass | likely |
| DungeonInfo.FireTemple.IsGetMap | 0x5B3AC0BA | Bool | dungeon_items.fire_temple_map | likely |
| DungeonInfo.ForestTemple.IsGetBossKey | 0x427333A0 | Bool | owned: Boss Key (Forest Temple) | likely |
| DungeonInfo.ForestTemple.IsGetCompass | 0xF240EEB2 | Bool | dungeon_items.forest_temple_compass | likely |
| DungeonInfo.ForestTemple.IsGetMap | 0xE704F9B4 | Bool | dungeon_items.forest_temple_map | likely |
| DungeonInfo.IceCavern.IsGetCompass | 0xEA1846E6 | Bool | dungeon_items.ice_cavern_compass | likely |
| DungeonInfo.IceCavern.IsGetMap | 0x322F2A94 | Bool | dungeon_items.ice_cavern_map | likely |
| DungeonInfo.InsideGanonCastle.IsGetBossKey | 0x2FD59293 | Bool | owned: Boss Key (Ganon's Castle) | likely |
| DungeonInfo.InsideJabuJabuBelly.IsGetCompass | 0x9A2218DB | Bool | dungeon_items.lord_jabu_jabus_belly_compass | likely |
| DungeonInfo.InsideJabuJabuBelly.IsGetMap | 0xFCADD210 | Bool | dungeon_items.lord_jabu_jabus_belly_map | likely |
| DungeonInfo.InsideTheDekuTree.IsGetCompass | 0x06C51FF2 | Bool | dungeon_items.great_deku_tree_compass | confirmed |
| DungeonInfo.InsideTheDekuTree.IsGetMap | 0x89787395 | Bool | dungeon_items.great_deku_tree_map | confirmed |
| DungeonInfo.ShadowTemple.IsGetBossKey | 0xC33C66CF | Bool | owned: Boss Key (Shadow Temple) | likely |
| DungeonInfo.ShadowTemple.IsGetCompass | 0x1E2FEEC5 | Bool | dungeon_items.shadow_temple_compass | likely |
| DungeonInfo.ShadowTemple.IsGetMap | 0xF6177B93 | Bool | dungeon_items.shadow_temple_map | likely |
| DungeonInfo.SpiritTemple.IsGetBossKey | 0x1984C03F | Bool | owned: Boss Key (Spirit Temple) | likely |
| DungeonInfo.SpiritTemple.IsGetCompass | 0x9BD1181C | Bool | dungeon_items.spirit_temple_compass | likely |
| DungeonInfo.SpiritTemple.IsGetMap | 0xB85002BA | Bool | dungeon_items.spirit_temple_map | likely |
| DungeonInfo.WaterTemple.IsGetBossKey | 0x79DAF80A | Bool | owned: Boss Key (Water Temple) | likely |
| DungeonInfo.WaterTemple.IsGetCompass | 0x2E82C8FE | Bool | dungeon_items.water_temple_compass | likely |
| DungeonInfo.WaterTemple.IsGetMap | 0x4A4402AB | Bool | dungeon_items.water_temple_map | likely |

### Enemies defeated (count)

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| DefeatedEnemyNum.Enemy_DeadHand | 0x5E1801C3 | Int | mini_bosses.dead_hand | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Barinade | 0x725379E3 | Int | bosses.barinade, heart_containers.heart_container_barinade | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_BongoBongo | 0xB4396BB4 | Int | bosses.bongo, heart_containers.heart_container_bongo | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Dodongo | 0x1DA458D0 | Int | bosses.king_dodongo, heart_containers.heart_container_king_dodongo | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Ganon | 0x6D834709 | Int | bosses.ganon, dungeons.ganons_castle | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Ganondorf | 0xE349F29F | Int | bosses.ganondorf | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Gohma | 0xEE850AD3 | Int | bosses.gohma | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Morpha | 0x88461890 | Int | bosses.morpha, heart_containers.heart_container_morpha | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_PhantomGanon | 0xC9175B2A | Int | bosses.phantom_ganon, heart_containers.heart_container_phantom_ganon | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Twinrova | 0x76EB9D9E | Int | bosses.twinrova, heart_containers.heart_container_twinrova | likely |
| DefeatedEnemyNum.Enemy_DungeonBoss_Volvagia | 0xF6BBB871 | Int | bosses.volvagia, heart_containers.heart_container_volvagia | likely |
| DefeatedEnemyNum.Enemy_IronKnuckle_Black | 0x41670C47 | Int | mini_bosses.iron_knuckle | likely |
| DefeatedEnemyNum.Enemy_IronKnuckle_Silver | 0xBABAA2D1 | Int | mini_bosses.iron_knuckle | likely |
| DefeatedEnemyNum.Enemy_IronKnuckle_White | 0x7E07F076 | Int | mini_bosses.iron_knuckle | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_BigOcto | 0x4F344BA7 | Int | mini_bosses.big_octo | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_DarkLink | 0x892D68DE | Int | mini_bosses.dark_link | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_FlareDancer | 0x8829B312 | Int | mini_bosses.flare_dancer | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief | 0x9C1A3136 | Int | mini_bosses.gerudo_guards_carpenter_cells | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief_02 | 0x5BAD7333 | Int | mini_bosses.gerudo_guards_carpenter_cells | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief_03 | 0xBB39C40A | Int | mini_bosses.gerudo_guards_carpenter_cells | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_GerudoThief_04 | 0x38F4D3D2 | Int | mini_bosses.gerudo_guards_carpenter_cells | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_IronKnuckle_Nabooru | 0xA3490368 | Int | mini_bosses.iron_knuckle_nabooru | likely |
| DefeatedEnemyNum.Enemy_MiddleBoss_Poe_Meg | 0x1381A973 | Int | mini_bosses.poe_sisters | likely |
| DefeatedEnemyNum.Enemy_Moblin_Club | 0x7FA0D226 | Int | mini_bosses.great_moblin | likely |
| DefeatedEnemyNum.Enemy_Skulltula_Gold | 0x080C4764 |  |  |  |
| DefeatedEnemyNum.Enemy_Wolfos_White | 0x38B6203F | Int | mini_bosses.white_wolfos | likely |

### Item owned

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| IsGet.Animal_Fish_Blue | 0x40B68073 | Bool | owned: Blue Fish | likely |
| IsGet.Animal_Insect | 0x4506012D | Bool | owned: Insect | likely |
| IsGet.Armor_Adult_Gauntlet_Gold | 0x3EF15EC4 | Bool | owned: Golden Gauntlets | likely |
| IsGet.Armor_Adult_Gauntlet_Silver | 0x87E58DE3 | Bool | owned: Silver Gauntlets | likely |
| IsGet.Armor_Adult_Goron | 0xAE5611AF | Bool | owned: Goron Tunic | confirmed |
| IsGet.Armor_Adult_HeavyBoot | 0x5FA190E6 | Bool | owned: Iron Boots | confirmed |
| IsGet.Armor_Adult_HoverBoot | 0x1109C920 | Bool | owned: Hover Boots | confirmed |
| IsGet.Armor_Adult_Normal | 0xDE513ABD | Bool | owned: Adult Tunic | likely |
| IsGet.Armor_Adult_Zora | 0x4F5A929C | Bool | owned: Zora Tunic | confirmed |
| IsGet.Armor_Child_Gauntlet_Goron | 0x9880707E | Bool | owned: Goron’s Bracelet | confirmed |
| IsGet.Armor_Child_Mask_Amiibo0 | 0x06F13BB2 | Bool | owned: Fairy Kid Mask (amiibo A) | confirmed |
| IsGet.Armor_Child_Mask_Amiibo1 | 0x09DF9D25 | Bool | owned: Young Zelda Mask (amiibo B) | confirmed |
| IsGet.Armor_Child_Mask_Bunny | 0x65AEBE17 | Bool | owned: Bunny Hood | likely |
| IsGet.Armor_Child_Mask_Gerudo | 0xB1FC4C1D | Bool | owned: Gerudo Mask | likely |
| IsGet.Armor_Child_Mask_Goron | 0xADFCCD91 | Bool | owned: Goron Mask | likely |
| IsGet.Armor_Child_Mask_Keaton | 0x35C60E1D | Bool | owned: Keaton Mask | likely |
| IsGet.Armor_Child_Mask_Skull | 0xD097482A | Bool | owned: Skull Mask | likely |
| IsGet.Armor_Child_Mask_Spooky | 0xC0CF68A7 | Bool | owned: Spooky Mask | likely |
| IsGet.Armor_Child_Mask_Truth | 0xF7D5BD9C | Bool | owned: Mask of Truth | likely |
| IsGet.Armor_Child_Mask_Zora | 0x280EB00E | Bool | owned: Zora Mask | likely |
| IsGet.Armor_GlassTruth | 0x7FE2A5B2 | Bool | owned: Lens of Truth | confirmed |
| IsGet.Item_AgonyStone | 0xDD587ED8 | Bool | owned: Echo Gem (Stone of Agony) | confirmed |
| IsGet.Item_AlarmCucco | 0x14909166 | Bool | owned: Alarm Cucco | likely |
| IsGet.Item_Arrow_Fire | 0x4DB7EAE0 | Bool | owned: Fire Arrows | confirmed |
| IsGet.Item_Arrow_Ice | 0x5C8F3099 | Bool | owned: Ice Arrows | confirmed |
| IsGet.Item_Arrow_Light | 0x8637BAB4 | Bool | owned: Light Arrows | confirmed |
| IsGet.Item_Arrow_Normal | 0x572701EA | Bool | owned: Normal Arrows | likely |
| IsGet.Item_Bomb | 0x2BB00768 | Bool | owned: Bombs | likely |
| IsGet.Item_BombBag_Large | 0x968A5A79 | Bool | owned: Large Bomb Bag | likely |
| IsGet.Item_BombBag_Medium | 0xB2C478DA | Bool | owned: Medium Bomb Bag | likely |
| IsGet.Item_BombBag_Small | 0xA63F1E2D | Bool | owned: Small Bomb Bag | likely |
| IsGet.Item_Bombchu | 0x5AB49C8E | Bool | owned: Bombchus | likely |
| IsGet.Item_Boomerang | 0x7F4CE38D | Bool | owned: Boomerang | confirmed |
| IsGet.Item_Bottle | 0x1106B082 | Bool | owned: Empty Bottle | likely |
| IsGet.Item_Bottle_BigPoe | 0x03463AB6 | Bool | owned: Big Poe Bottle | likely |
| IsGet.Item_Bottle_BlueFire | 0x53DB16A6 | Bool | owned: Blue Fire Bottle | likely |
| IsGet.Item_Bottle_BluePotion | 0xEA0729FE | Bool | owned: Blue Potion Bottle | likely |
| IsGet.Item_Bottle_Bug | 0xCF2D3DB4 | Bool | owned: Bug Bottle | likely |
| IsGet.Item_Bottle_Fairy | 0x124C4D3A | Bool | owned: Fairy Bottle | likely |
| IsGet.Item_Bottle_Fish | 0xB46A0394 | Bool | owned: Fish Bottle | likely |
| IsGet.Item_Bottle_GreenPotion | 0x75ABC14B | Bool | owned: Green Potion Bottle | likely |
| IsGet.Item_Bottle_HalfMilk | 0x21FE9FFA | Bool | owned: Half-Milk Bottle | likely |
| IsGet.Item_Bottle_Letter | 0x170B5DF2 | Bool | owned: Letter Bottle | likely |
| IsGet.Item_Bottle_Milk | 0xF1232980 | Bool | owned: Milk Bottle | likely |
| IsGet.Item_Bottle_Poe | 0xF2001CFD | Bool | owned: Poe Bottle | likely |
| IsGet.Item_Bottle_RedPotion | 0xD8FFAFD1 | Bool | owned: Red Potion Bottle | likely |
| IsGet.Item_BrokenSword | 0x645A8175 | Bool | owned: Broken Sword | likely |
| IsGet.Item_BulletBag_Large | 0xB669F025 | Bool | owned: Large Bullet Bag | likely |
| IsGet.Item_BulletBag_Medium | 0xE6CD55D2 | Bool | owned: Medium Bullet Bag | likely |
| IsGet.Item_BulletBag_Small | 0x488CA1BE | Bool | owned: Small Bullet Bag | likely |
| IsGet.Item_ClaimCheck | 0x8B54E680 | Bool | owned: Claim Check | likely |
| IsGet.Item_CojiroCucco | 0xFB4442DE | Bool | owned: Cojiro | likely |
| IsGet.Item_DekuNut | 0x00C2EE37 | Bool | owned: Deku Nuts | confirmed |
| IsGet.Item_DekuSeed | 0x29888E1E | Bool | owned: Deku Seeds | confirmed |
| IsGet.Item_DekuStick | 0xC4E21AC2 | Bool | owned: Deku Sticks | confirmed |
| IsGet.Item_DinFire | 0xFA04E611 | Bool | owned: Din’s Fire | confirmed |
| IsGet.Item_Dungeon_BossKey | 0x6AC27606 | Bool | owned: Boss Key | likely |
| IsGet.Item_Dungeon_Compass | 0x14FCC563 | Bool | owned: Compass | likely |
| IsGet.Item_Dungeon_Map | 0xFFE25805 | Bool | owned: Dungeon Map | likely |
| IsGet.Item_Dungeon_SmallKey | 0x154EF588 | Bool | owned: Small Key | likely |
| IsGet.Item_EyeDrop | 0xB7BDD577 | Bool | owned: Eyedropper | likely |
| IsGet.Item_EyeballFrog | 0x8E02D1CA | Bool | owned: Eyeball Frog | likely |
| IsGet.Item_FairyBless_DefenseDouble | 0x944B78BE | Bool | owned: Double Defense | likely |
| IsGet.Item_FairyBless_MP | 0xB1309073 | Bool | owned: Magic Meter | likely |
| IsGet.Item_FairyBless_MPDouble | 0x87CA4826 | Bool | owned: Double Magic | likely |
| IsGet.Item_FaroreWind | 0xFFABF058 | Bool | owned: Farore’s Wind | confirmed |
| IsGet.Item_FishingRod | 0x10C5B9BF | Bool | owned: Fishing Rod | likely |
| IsGet.Item_Hammer | 0x7227EFD8 | Bool | owned: Megaton Hammer | confirmed |
| IsGet.Item_Hat_FishingPondOwner | 0xAF176AB2 | Bool | owned: Fishing Hat | likely |
| IsGet.Item_Hookshot | 0xFF98ED58 | Bool | owned: Hookshot | confirmed |
| IsGet.Item_Longshot | 0x38AEA3BB | Bool | owned: Longshot | likely |
| IsGet.Item_MagicBean | 0x6D39C600 | Bool | owned: Magic Beans | confirmed |
| IsGet.Item_Medal_Fire | 0x103A0DC7 | Bool | owned: Fire Medallion | confirmed |
| IsGet.Item_Medal_Forest | 0xFCD8D653 | Bool | owned: Forest Medallion | confirmed |
| IsGet.Item_Medal_Light | 0x9026C187 | Bool | owned: Light Medallion | confirmed |
| IsGet.Item_Medal_Shadow | 0x12D63AC6 | Bool | owned: Shadow Medallion | confirmed |
| IsGet.Item_Medal_Spirit | 0xE269DF38 | Bool | owned: Spirit Medallion | confirmed |
| IsGet.Item_Medal_Water | 0xCF64E780 | Bool | owned: Water Medallion | confirmed |
| IsGet.Item_Melody_EponaSong | 0xB492AC33 | Bool | owned: Epona’s Song | confirmed |
| IsGet.Item_Melody_FireBolero | 0x49041AB9 | Bool | owned: Bolero of Fire | confirmed |
| IsGet.Item_Melody_ForestMinuet | 0xDC0A0B54 | Bool | owned: Minuet of Forest | confirmed |
| IsGet.Item_Melody_LightPrelude | 0xD6320BA4 | Bool | owned: Prelude of Light | confirmed |
| IsGet.Item_Melody_SariaSong | 0xD3F8BFCC | Bool | owned: Saria’s Song | confirmed |
| IsGet.Item_Melody_ScarecrowSong | 0x5E86FB4D | Bool | songs.scarecrows_song | likely |
| IsGet.Item_Melody_ShadowNocturne | 0xC2FB95F4 | Bool | owned: Nocturne of Shadow | confirmed |
| IsGet.Item_Melody_SpiritRequiem | 0x802A36A8 | Bool | owned: Requiem of Spirit | confirmed |
| IsGet.Item_Melody_StormSong | 0x2B39DD4F | Bool | owned: Song of Storms | confirmed |
| IsGet.Item_Melody_SunSong | 0x165DD1AD | Bool | owned: Sun’s Song | confirmed |
| IsGet.Item_Melody_TimeSong | 0x03B3450E | Bool | owned: Song of Time | confirmed |
| IsGet.Item_Melody_WaterSerenade | 0x3FA63986 | Bool | owned: Serenade of Water | confirmed |
| IsGet.Item_Melody_ZeldaLullaby | 0x01C20002 | Bool | owned: Zelda’s Lullaby | confirmed |
| IsGet.Item_NayruLove | 0x00B44241 | Bool | owned: Nayru’s Love | confirmed |
| IsGet.Item_NormalBoot | 0x7215060C | Bool | owned: Kokiri Boots | likely |
| IsGet.Item_NutBag_Large | 0x9A5DB0B6 | Bool | capacity.deku_nut_capacity_40 | likely |
| IsGet.Item_NutBag_Medium | 0x960820DB | Bool | capacity.deku_nut_capacity_30 | likely |
| IsGet.Item_Ocarina_Fairy | 0x42BD296F | Bool | owned: Fairy Ocarina | likely |
| IsGet.Item_Ocarina_Time | 0x1DA2C511 | Bool | owned: Ocarina of Time | confirmed |
| IsGet.Item_OddMushroom | 0xCBD7852A | Bool | owned: Odd Mushroom | likely |
| IsGet.Item_OddPowder | 0xB75ACAAD | Bool | owned: Odd Powder | likely |
| IsGet.Item_PoacherSaw | 0x888D5059 | Bool | owned: Poacher's Saw | likely |
| IsGet.Item_PocketCucco | 0xE82E6413 | Bool | owned: Pocket Cucco | likely |
| IsGet.Item_PocketEgg | 0xEC9C3136 | Bool | owned: Pocket Egg | likely |
| IsGet.Item_Prescription | 0xD8F1521E | Bool | owned: Prescription | likely |
| IsGet.Item_Quiver_Large | 0x21985B09 | Bool | owned: Large Quiver | likely |
| IsGet.Item_Quiver_Medium | 0x9D872202 | Bool | owned: Medium Quiver | likely |
| IsGet.Item_Quiver_Small | 0x0A550531 | Bool | owned: Small Quiver | likely |
| IsGet.Item_Scale_Gold | 0xCCC1909A | Bool | owned: Golden Scale | likely |
| IsGet.Item_Scale_Silver | 0x1208FB3E | Bool | owned: Silver Scale | likely |
| IsGet.Item_ScrubBusinessSeed | 0xCFBB16F6 | Bool | owned: Scrub Seeds | likely |
| IsGet.Item_StickBag_Large | 0xA10F2DCF | Bool | capacity.deku_stick_capacity_30 | likely |
| IsGet.Item_StickBag_Medium | 0xCBF00480 | Bool | capacity.deku_stick_capacity_20 | likely |
| IsGet.Item_Stone_Fire | 0x8908D6AD | Bool | owned: Goron’s Ruby | confirmed |
| IsGet.Item_Stone_Forest | 0x110B83EC | Bool | owned: Kokiri’s Emerald | confirmed |
| IsGet.Item_Stone_Water | 0xEEC383F5 | Bool | owned: Zora’s Sapphire | confirmed |
| IsGet.Item_Token_Gerudo | 0x0E6264C7 | Bool | owned: Gerudo Pass (Gerudo’s Card) | confirmed |
| IsGet.Item_Token_Gold | 0x6BA394FE | Bool | owned: Skulltula Token | likely |
| IsGet.Item_Wallet_Large | 0xB5031190 | Bool | owned: Large Wallet | likely |
| IsGet.Item_Wallet_Medium | 0xD1360DE8 | Bool | owned: Medium Wallet | likely |
| IsGet.Item_Wallet_Small | 0xB6E5A3A5 | Bool | owned: Small Wallet | likely |
| IsGet.Item_WeirdEgg | 0x44AB1487 | Bool | owned: Weird Egg | likely |
| IsGet.Item_ZeldaLetter | 0xF19393B5 | Bool | owned: Letter from Zelda | likely |
| IsGet.Obj_Heart_Container | 0xBB4E20C9 | Bool | owned: Heart Container | likely |
| IsGet.Obj_Heart_Piece | 0xE6AAAB65 | Bool | owned: Heart Piece | likely |
| IsGet.Obj_MiniGame_SmallKey | 0x8F7916A0 | Bool | owned: Small Key (Treasure Chest) | likely |
| IsGet.Weapon_Lure | 0xE044B44F | Bool | owned: Lure | likely |
| IsGet.Weapon_Range_Bow | 0x69EC28BE | Bool | owned: Fairy Bow | confirmed |
| IsGet.Weapon_Range_SlingShot | 0x0EC22EE1 | Bool | owned: Fairy Slingshot | confirmed |
| IsGet.Weapon_Shield_DarkLinkShield | 0x24570B07 | Bool | owned: Dark Link's Shield | likely |
| IsGet.Weapon_Shield_Deku | 0x5217DA1E | Bool | owned: Deku Shield | confirmed |
| IsGet.Weapon_Shield_Hylian | 0x2F817D54 | Bool | owned: Hylian Shield | confirmed |
| IsGet.Weapon_Shield_Mirror | 0x75E94E42 | Bool | owned: Mirror Shield | confirmed |
| IsGet.Weapon_SinkingLure | 0x474F9EB9 | Bool | owned: Sinking Lure | likely |
| IsGet.Weapon_Sword_Biggoron | 0x33466812 | Bool | owned: Biggoron’s Sword | confirmed |
| IsGet.Weapon_Sword_BrokenGiant | 0x720DF203 | Bool | owned: Giant's Sword (broken) | likely |
| IsGet.Weapon_Sword_DarkLinkSword | 0xA54698C9 | Bool | owned: Dark Link's Sword | likely |
| IsGet.Weapon_Sword_Giant | 0x1E824EFA | Bool | owned: Giant's Knife | likely |
| IsGet.Weapon_Sword_Kokiri | 0x405D8A0F | Bool | owned: Kokiri Sword | confirmed |
| IsGet.Weapon_Sword_Master | 0x7AE38E5B | Bool | owned: Master Sword | confirmed |

### Minigame

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| IsClear_Minigame_FindOutCucco | 0x084DA83F | Bool | bottles.lon_lon_milk_bottle_talon | confirmed |
| MiniGame_BombchuBowling_ClearThirdTime | 0x61CF7BA1 | Bool | heart_pieces.013 | likely |
| MiniGame_CatchCucco_IsCompleted | 0x7A7961C3 | Bool | bottles.cucco_lady_bottle | likely |
| MiniGame_ChoiceTreasure_IsClear | 0xB599AEED | Bool | heart_pieces.029 | likely |
| MiniGame_Fishing_GetHeartPiece | 0xF1891F6E | Bool | heart_pieces.006 | likely |
| MiniGame_FrogTenors_InsectRepellent | 0x8FFEC767 | Bool | heart_pieces.028 | likely |
| MiniGame_FrogTenors_StormSong | 0xD578DF95 | Bool | heart_pieces.027 | likely |
| MiniGame_HorsebackArchery_GotaHeart | 0x3F43245B | Bool | heart_pieces.031 | likely |
| Minigame_SkullKidSession_IsGetHeartPiece | 0x1657D7D8 | Bool | heart_pieces.008 | likely |
| UnderTheGrave_DampeRace_HeartGeted | 0x5A66513C | Bool | heart_pieces.019 | likely |

### Other

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| DeathMountain_Enemy_Scrub_Business_HeartPiece_01 | 0x6B8FC751 | Bool | heart_pieces.036 | likely |
| FireTemple_GetSmallKey_01 | 0x57771BBD | Bool | owned: Small Key 1 (Fire Temple) | likely |
| FireTemple_GetSmallKey_02 | 0xF6544FD0 | Bool | owned: Small Key 2 (Fire Temple) | likely |
| FireTemple_GetSmallKey_03 | 0x6669C4EB | Bool | owned: Small Key 3 (Fire Temple) | likely |
| FireTemple_GetSmallKey_04 | 0x24EF10FF | Bool | owned: Small Key 4 (Fire Temple) | likely |
| FireTemple_GetSmallKey_05 | 0xBE0BE4F3 | Bool | owned: Small Key 5 (Fire Temple) | likely |
| FireTemple_GetSmallKey_06 | 0xF37FA0B2 | Bool | owned: Small Key 6 (Fire Temple) | likely |
| FireTemple_GetSmallKey_07 | 0x49EE141A | Bool | owned: Small Key 7 (Fire Temple) | likely |
| FireTemple_GetSmallKey_08 | 0x7BA3C368 | Bool | owned: Small Key 8 (Fire Temple) | likely |
| GoronLargePot_IsGetHeartPiece | 0x1D1793E9 | Bool | heart_pieces.010 | likely |
| GraveYard_DiggingHoleTour_Drop_HeartPiece | 0xB5127E75 | Bool | heart_pieces.002 | likely |
| HyruleField_Defeat_BigPoe_01 | 0xACDFEFEF |  |  |  |
| HyruleField_Defeat_BigPoe_02 | 0xB00DEF69 |  |  |  |
| HyruleField_Defeat_BigPoe_03 | 0x8A46F40E |  |  |  |
| HyruleField_Defeat_BigPoe_04 | 0x491243A3 |  |  |  |
| HyruleField_Defeat_BigPoe_05 | 0xB65C3302 |  |  |  |
| HyruleField_Defeat_BigPoe_06 | 0x2B12BF2F |  |  |  |
| HyruleField_Defeat_BigPoe_07 | 0x2BB74CC4 |  |  |  |
| HyruleField_Defeat_BigPoe_08 | 0xE0666ED7 |  |  |  |
| HyruleField_Defeat_BigPoe_09 | 0x9A8C2AF8 |  |  |  |
| HyruleField_Defeat_BigPoe_10 | 0x7627AABB |  |  |  |
| HyruleField_Enemy_Scrub_Business_HeartPiece_01 | 0xE41E1597 | Bool | heart_pieces.034 | likely |
| InsideTheDekuTree_Heart_Container_Obtained | 0x98CA7AAB | Bool | heart_containers.heart_container_gohma | likely |
| IsGet_SmallKey_GerudoFortress.SmallKey01 | 0xDC0010F6 | Bool | owned: Small Key 1 (Gerudo Fortress) | likely |
| IsGet_SmallKey_GerudoFortress.SmallKey02 | 0x1EE8E249 | Bool | owned: Small Key 2 (Gerudo Fortress) | likely |
| IsGet_SmallKey_GerudoFortress.SmallKey03 | 0x2815A352 | Bool | owned: Small Key 3 (Gerudo Fortress) | likely |
| IsGet_SmallKey_GerudoFortress.SmallKey04 | 0x397957CA | Bool | owned: Small Key 4 (Gerudo Fortress) | likely |
| KakarikoVillage_GatheringTokenGold_GetReward10 | 0x9086A22E | Bool | skulltula_rewards.10_tokens_adults_wallet | likely |
| KakarikoVillage_GatheringTokenGold_GetReward20 | 0x39DAD76D | Bool | skulltula_rewards.20_tokens_echo_gem | likely |
| KakarikoVillage_GatheringTokenGold_GetReward30 | 0xCDCC9ADD | Bool | skulltula_rewards.30_tokens_giants_wallet | likely |
| KakarikoVillage_GatheringTokenGold_GetReward40 | 0x8DC37AC6 | Bool | skulltula_rewards.40_tokens_bombchus_20 | likely |
| KakarikoVillage_GatheringTokenGold_GetReward50 | 0xE3C6E4A3 | Bool | heart_pieces.020, skulltula_rewards.50_tokens_piece_of_heart | likely |
| KakarikoVillage_IsAfterSave_Npc_Hylia_025 | 0x85D8113A | Bool | heart_pieces.020 | likely |
| Npc_Hylia_001_IsGetHeartPiece | 0xA666BAA8 | Bool | heart_pieces.001 | likely |
| Npc_Hylia_045_HasDived | 0xAD7A21CE | Bool | heart_pieces.022 | likely |
| Npc_SkullKid_Child_IsGetHeartPiece | 0x5FF7AA30 | Bool | heart_pieces.009 | likely |
| *CurrentStage* | 0x1D6189DA | String64 | current stage name, e.g. "LostWood_Child" (also in the save) | confirmed |
| ** | 0x3339DF55 | Binary | created on a real learn: Scarecrow's Song |  |
| ** | 0x40772671 | array element | big_poes.001, big_poes.002, big_poes.003 +8 | confirmed |
| *Capacity.Arrow* | 0x418DB791 | Int | Arrow capacity | likely |
| *Capacity.DekuStick* | 0x457616B0 | Int | Deku Stick capacity | confirmed |
| ** | 0x59979321 | Enum |  |  |
| ** | 0x7001F17C | Bool | heart_pieces.004 | likely |
| *Capacity.DekuNut* | 0x735B00F7 | Int | Deku Nut capacity | confirmed |
| *Capacity.DekuSeed* | 0xAE8CC742 | Int | Deku Seed capacity | confirmed |
| *LocationList* | 0xC458F1EB | String64Array | where you are inside the stage, e.g. ["HyruleField","LakeHylia"] | confirmed |
| ** | 0xCC535536 | UIntArray | notes: Scarecrow's Song |  |
| *SunSongCount* | 0xD457EE3A | Int64 | goes up by one each time Sun's Song is played (cannot tell day from night) | confirmed |
| *Capacity.Wallet* | 0xE0010A50 | Int | Wallet size | confirmed |
| *Capacity.Bomb* | 0xE753508B | Int | Bomb capacity | confirmed |

### Player status

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| PlayerStatus.AnotherEraEquipShield | 0x2342B619 | String64 | equipped item id kept for the other era | likely |
| PlayerStatus.AnotherEraEquipWeapon | 0xA1F7EE2B | String64 | equipped item id kept for the other era | likely |
| PlayerStatus.AssignableItem.BottleInfo.BottleA.BottleItem | 0x7D48DF76 | Enum | bottle A content (BottleItem enum) |  |
| PlayerStatus.AssignableItem.BottleInfo.BottleB.BottleItem | 0x1EDD164A | Enum | bottle B content (BottleItem enum) |  |
| PlayerStatus.AssignableItem.BottleInfo.BottleC.BottleItem | 0xB80C70A8 | Enum | bottle C content (BottleItem enum) |  |
| PlayerStatus.AssignableItem.BottleInfo.BottleD.BottleItem | 0xE4C1B1FC | Enum | bottle D content (BottleItem enum) |  |
| PlayerStatus.AssignableItem.BottleInfo.BottleE.BottleItem | 0x365E1953 | Enum | bottle E content (BottleItem enum) |  |
| PlayerStatus.CurrentRupee | 0xA77921D7 | Int | Rupees | confirmed |
| PlayerStatus.EquipShield | 0xEE463235 | String64 | equipped item id (plain text, this era) | confirmed |
| PlayerStatus.EquipWeapon | 0xA95A3521 | String64 | equipped item id (plain text, this era) | confirmed |
| PlayerStatus.Life | 0x31AB5580 | Int | Hearts (quarter-hearts) | confirmed |
| PlayerStatus.MP | 0x76B18200 | Int | Magic (meter units) | likely |
| PlayerStatus.MPMax | 0x12D63A97 | Int | Magic meter (meter units) | likely |
| PlayerStatus.MaxLife | 0xFBE01DA1 | Int | maxHearts (value × 0.25) | confirmed |

### Pouch contents

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| PouchData.Armor_Adult_Gauntlet_Gold.StockNum | 0x40AE1183 | Int | held count: Golden Gauntlets | likely |
| PouchData.Armor_Adult_Gauntlet_Silver.StockNum | 0x0012B8C0 | Int | held count: Silver Gauntlets | likely |
| PouchData.Armor_Adult_Goron.StockNum | 0x21ECBD19 | Int | held count: Goron Tunic | confirmed |
| PouchData.Armor_Adult_HeavyBoot.StockNum | 0x2BAD189A | Int | held count: Iron Boots | confirmed |
| PouchData.Armor_Adult_HoverBoot.StockNum | 0xC9220366 | Int | held count: Hover Boots | confirmed |
| PouchData.Armor_Adult_Zora.StockNum | 0xB816AF94 | Int | held count: Zora Tunic | confirmed |
| PouchData.Armor_Child_Gauntlet_Goron.StockNum | 0xD1317941 | Int | held count: Goron’s Bracelet | confirmed |
| PouchData.Armor_Child_Mask_Amiibo0.StockNum | 0xF5E647DA | Int | held count: Fairy Kid Mask (amiibo A) | confirmed |
| PouchData.Armor_Child_Mask_Amiibo1.StockNum | 0x486C59A4 | Int | held count: Young Zelda Mask (amiibo B) | confirmed |
| PouchData.Armor_Child_Mask_Bunny.StockNum | 0x7E607033 | Int | held count: Bunny Hood | likely |
| PouchData.Armor_Child_Mask_Gerudo.StockNum | 0x0E94A8DF | Int | held count: Gerudo Mask | likely |
| PouchData.Armor_Child_Mask_Goron.StockNum | 0xFC508DA7 | Int | held count: Goron Mask | likely |
| PouchData.Armor_Child_Mask_Keaton.StockNum | 0xB5C10899 | Int | held count: Keaton Mask | likely |
| PouchData.Armor_Child_Mask_Skull.StockNum | 0x47B2D775 | Int | held count: Skull Mask | likely |
| PouchData.Armor_Child_Mask_Spooky.StockNum | 0xF046629E | Int | held count: Spooky Mask | likely |
| PouchData.Armor_Child_Mask_Truth.StockNum | 0x96459CD3 | Int | held count: Mask of Truth | likely |
| PouchData.Armor_Child_Mask_Zora.StockNum | 0x924E9A46 | Int | held count: Zora Mask | likely |
| PouchData.Armor_GlassTruth.StockNum | 0x49D1C374 | Int | held count: Lens of Truth | confirmed |
| PouchData.BottleA | 0x4E223C43 |  | bottle A pouch entry |  |
| PouchData.BottleA.StockNum | 0xD53CE3A7 | Int | bottle A held count |  |
| PouchData.BottleB | 0x6E9DFE86 |  | bottle B pouch entry |  |
| PouchData.BottleB.StockNum | 0xFCA29A04 | Int | bottle B held count |  |
| PouchData.BottleC | 0x50DEE82E |  | bottle C pouch entry |  |
| PouchData.BottleC.StockNum | 0x893216A1 | Int | bottle C held count |  |
| PouchData.BottleD | 0x578C41C6 |  | bottle D pouch entry |  |
| PouchData.BottleD.StockNum | 0x5324F9D3 | Int | bottle D held count |  |
| PouchData.BottleE | 0x40D16731 |  | bottle E pouch entry |  |
| PouchData.BottleE.StockNum | 0xC92B16BE | Int | bottle E held count |  |
| PouchData.Item_AgonyStone.StockNum | 0xF3B14CE2 | Int | held count: Echo Gem (Stone of Agony) | confirmed |
| PouchData.Item_Arrow_Fire.StockNum | 0x5E529AB9 | Int | Fire arrows (count) | confirmed |
| PouchData.Item_Arrow_Ice.StockNum | 0x40735A8D | Int | Ice arrows (count) | confirmed |
| PouchData.Item_Arrow_Light.StockNum | 0xBFB285C8 | Int | Light arrows (count) | confirmed |
| PouchData.Item_Arrow_Normal.StockNum | 0x518EC74B | Int | Arrows (count) | likely |
| PouchData.Item_Bomb.StockNum | 0xDB1BCD4F | Int | Bombs (count) | confirmed |
| PouchData.Item_Bombchu.StockNum | 0xDF7C517A | Int | Bombchus (count) | confirmed |
| PouchData.Item_Boomerang.StockNum | 0xA1D76D31 | Int | held count: Boomerang | confirmed |
| PouchData.Item_DekuNut.StockNum | 0xF30D9F54 | Int | held count: Deku Nuts | confirmed |
| PouchData.Item_DekuSeed.StockNum | 0x5FADF7FC | Int | held count: Deku Seeds | confirmed |
| PouchData.Item_DekuStick.StockNum | 0xB9494411 | Int | held count: Deku Sticks | confirmed |
| PouchData.Item_DinFire.StockNum | 0xB796C16D | Int | held count: Din’s Fire | confirmed |
| PouchData.Item_FaroreWind.StockNum | 0x47F2CA87 | Int | held count: Farore’s Wind | confirmed |
| PouchData.Item_Hammer.StockNum | 0x1AAFDB66 | Int | held count: Megaton Hammer | confirmed |
| PouchData.Item_Hookshot.StockNum | 0x8573D2CD | Int | held count: Hookshot | confirmed |
| PouchData.Item_Longshot.StockNum | 0x8499EA34 | Int | held count: Longshot | likely |
| PouchData.Item_MagicBean.StockNum | 0xB003124D | Int | held count: Magic Beans | confirmed |
| PouchData.Item_Medal_Fire.StockNum | 0x5CE254A6 | Int | held count: Fire Medallion | confirmed |
| PouchData.Item_Medal_Forest.StockNum | 0x692D57CB | Int | held count: Forest Medallion | confirmed |
| PouchData.Item_Medal_Light.StockNum | 0x235C7D9A | Int | held count: Light Medallion | confirmed |
| PouchData.Item_Medal_Shadow.StockNum | 0x204D2063 | Int | held count: Shadow Medallion | confirmed |
| PouchData.Item_Medal_Spirit.StockNum | 0x0C7A5FD0 | Int | held count: Spirit Medallion | confirmed |
| PouchData.Item_Medal_Water.StockNum | 0x0151A68F | Int | held count: Water Medallion | confirmed |
| PouchData.Item_NayruLove.StockNum | 0xF0828CD0 | Int | held count: Nayru’s Love | confirmed |
| PouchData.Item_Ocarina_Fairy.StockNum | 0xB7DF60F1 | Int | held count: Fairy Ocarina | likely |
| PouchData.Item_Ocarina_Time.StockNum | 0x54E2A3D1 | Int | held count: Ocarina of Time | confirmed |
| PouchData.Item_Scale_Gold.StockNum | 0x4AEB140A | Int | held count: Golden Scale | likely |
| PouchData.Item_Scale_Silver.StockNum | 0x1240044B | Int | held count: Silver Scale | likely |
| PouchData.Item_ScrubBusinessSeed.StockNum | 0x600E29EB | Int | Scrub business seed (count) | likely |
| PouchData.Item_Stone_Fire.StockNum | 0x7D69AD47 | Int | held count: Goron’s Ruby | confirmed |
| PouchData.Item_Stone_Forest.StockNum | 0xCBD1E58C | Int | held count: Kokiri’s Emerald | confirmed |
| PouchData.Item_Stone_Water.StockNum | 0xB8E3BF45 | Int | held count: Zora’s Sapphire | confirmed |
| PouchData.Item_Token_Gerudo.StockNum | 0xFEB4D56B | Int | held count: Gerudo Pass (Gerudo’s Card) | confirmed |
| PouchData.Item_Token_Gold.StockNum | 0x04735978 | Int | goldSkulltulaTokens | likely |
| PouchData.Obj_Heart_Piece.StockNum | 0x51EC97B3 | Int | heartPiecesHeld |  |
| PouchData.Weapon_Range_Bow.StockNum | 0x938D56BF | Int | held count: Fairy Bow | confirmed |
| PouchData.Weapon_Range_SlingShot.StockNum | 0x80D34CE9 | Int | held count: Fairy Slingshot | confirmed |
| PouchData.Weapon_Shield_Deku.StockNum | 0x7CA64F23 | Int | held count: Deku Shield | likely |
| PouchData.Weapon_Shield_Hylian.StockNum | 0x08BEFD3A | Int | held count: Hylian Shield | confirmed |
| PouchData.Weapon_Shield_Mirror.StockNum | 0xF58E0E2F | Int | held count: Mirror Shield | confirmed |
| PouchData.Weapon_Sword_Biggoron.StockNum | 0xB0B3E399 | Int | held count: Biggoron’s Sword | confirmed |
| PouchData.Weapon_Sword_Giant.StockNum | 0x396A5C02 | Int | held count: Giant's Knife | likely |
| PouchData.Weapon_Sword_Kokiri.StockNum | 0xEEB495B9 | Int | held count: Kokiri Sword | likely |
| PouchData.Weapon_Sword_Master.StockNum | 0xF1C45294 | Int | held count: Master Sword | confirmed |

### Quest / story progress

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| Step_GatheringTokenGold | 0x8C5E9F84 | Enum | skulltula_rewards.100_tokens_gold_rupee_200_rupees_repeatable | likely |
| Step_Get_Epona | 0x92431C55 | Enum | side_quests.malons_friend | likely |
| Step_Meet_GreatFairy | 0x682D1169 | Enum | side_quests.to_the_great_fairy | likely |
| Step_SubEvent_GetScarecrow | 0x9472302B | Enum | side_quests.stir_the_scarecrows_soul | likely |
| Step_SubEvent_GetStormSong | 0x7A5B9537 | Enum | side_quests.broken_windmill_dry_well | likely |
| Step_SubEvent_GetSwordBigGoron | 0x26A2E01C | Enum | side_quests.from_a_pocket_egg_comes | likely |
| Step_SubEvent_GhostShop | 0x6E9B2539 | Enum | bottles.poe_collector_bottle | confirmed |
| Step_SubEvent_MaskSalesman | 0xEA010310 | Enum | side_quests.happy_mask_shopkeeper | likely |
| SubEvent_FindRichard_GetHeartPiece | 0xF2FAB510 | Bool | heart_pieces.007 | likely |

### Room, door & puzzle

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| BottomOfTheWell_Level_Room_03_Get_SmallKey | 0x8028323F | Bool | owned: Small Key 1 (Bottom of the Well) | likely |
| ForestTemple_Room00_GetSmallKey | 0xDAF141E8 | Bool | owned: Small Key 1 (Forest Temple) | likely |
| ForestTemple_Room06_GetSmallKey | 0xA31DB95B | Bool | owned: Small Key 2 (Forest Temple) | likely |
| ForestTemple_Room09_GetSmallKey | 0x5CB887DC | Bool | owned: Small Key 3 (Forest Temple) | likely |
| ForestTemple_Room12_GetSmallKey | 0x21B0BD71 | Bool | owned: Small Key 4 (Forest Temple) | likely |
| ForestTemple_Room18_GetSmallKey | 0xFBFD2CCC | Bool | owned: Small Key 5 (Forest Temple) | likely |
| Gimmick_MagicBeanSoil_DeathMountainCrater | 0x8287759F | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_DeathMountainTrail | 0x74F0A711 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_DesertColossus | 0x1502F669 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_GerudoValley | 0xBBEB76D9 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_Graveyard | 0xAA592991 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_KokiriForest | 0xC591DE36 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_KokiriForest_LostWood | 0xED6F23F4 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_LakeHylia | 0x1294BB19 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_LostWood01 | 0xFEADCC3E | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_LostWood02 | 0x8B226009 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_ZoraRiver | 0x4CD73236 | Bool | counter:magic_beans_planted |  |
| Gimmick_MagicBeanSoil_ZoraRiver02 | 0x04C4A067 | Bool | counter:magic_beans_planted |  |
| IsTreasureBoxOpen.12343753510713797715 | 0x689CEBE8 | Bool | heart_pieces.030 | likely |
| IsTreasureBoxOpen.2967378296224661060 | 0xDA9DFF2C | Bool | heart_pieces.035 | likely |
| IsTreasureBoxOpen.3130048366421939233 | 0xA1678ED9 | Bool | heart_pieces.016 | likely |
| IsTreasureBoxOpen.9622128545943056087 | 0x9C89C565 | Bool | heart_pieces.033 | likely |
| Market_Item_Bottle_TutorialEvent_Cleared | 0x4D62DE75 | Bool | bottles.potion_shop_bottle | likely |
| WaterTemple_Room02_GetSmallKey | 0xC56265F6 | Bool | owned: Small Key 1 (Water Temple) | likely |
| WaterTemple_Room08_GetSmallKey | 0xD492A7AF | Bool | owned: Small Key 2 (Water Temple) | likely |
| WaterTemple_Room16_GetSmallKey | 0xE331F321 | Bool | owned: Small Key 3 (Water Temple) | likely |
| WaterTemple_Room17_GetSmallKey | 0x24D15EA2 | Bool | owned: Small Key 4 (Water Temple) | likely |
| WaterTemple_Room18_GetSmallKey | 0x588AB25F | Bool | owned: Small Key 5 (Water Temple) | likely |
| WaterTemple_Room20_GetSmallKey | 0x0EC96F6D | Bool | owned: Small Key 6 (Water Temple) | likely |
| WaterTemple_Room21_GetSmallKey | 0x177ADC78 | Bool | owned: Small Key 7 (Water Temple) | likely |

### Scarecrow

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| AskBonooru_listentothesong | 0xFDF0F4B8 | Bool | owned: Scarecrow's Song | guess |

### Shop

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| GhostShop_CouponNum | 0xE3407CEE |  |  |  |

### Where you got it

| Name | Hash | Type | Meaning | Confidence |
|---|---|---|---|---|
| HavePlayedGetEvent.Armor_Child_Gauntlet_Goron | 0x6FD3DD83 | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Amiibo0 | 0x826DB2F9 | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Amiibo1 | 0x62B873A9 | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Bunny | 0x4641175C | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Gerudo | 0xDE002422 | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Goron | 0x006614D5 | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Keaton | 0xBCC6E7EE | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Skull | 0x52AD260A | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Spooky | 0xEBD0F400 | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Truth | 0x7B320777 | Bool |  |  |
| HavePlayedGetEvent.Armor_Child_Mask_Zora | 0xE47CE994 | Bool |  |  |
| HavePlayedGetEvent.Item_Dungeon_SmallKey | 0xA879791F |  |  |  |
| HavePlayedGetEvent.Item_Scale_Gold | 0x99394E23 | Bool |  |  |
| HavePlayedGetEvent.Item_Scale_Silver | 0x131029C2 | Bool |  |  |

### 64-bit keys

| Key | Entry | Confidence |
|---|---|---|
| 0x02974596F92CF377 | Water Temple (gold_skulltulas.071) | likely |
| 0x032F42F523BE6425 | Graveyard (gold_skulltulas.041) | likely |
| 0x0341F2C03598C861 | Desert Colossus (gold_skulltulas.088) | likely |
| 0x04BE4A8FF29F2099 | Lon Lon Ranch (gold_skulltulas.013) | confirmed |
| 0x04E03AC27985E328 | Death Mountain Trail (gold_skulltulas.026) | likely |
| 0x07E6E21142CC54DB | Goron City (gold_skulltulas.027) | likely |
| 0x09ECB6A0150FEE97 | Death Mountain Trail (heart_pieces.023) | likely |
| 0x0A564328FAF93C71 | Death Mountain Crater (heart_pieces.024) | likely |
| 0x0AF4D6F063D3AE9F | Lake Hylia (gold_skulltulas.074) | likely |
| 0x0B8E43ABFA0B5F86 | Death Mountain Trail (gold_skulltulas.060) | likely |
| 0x0D53E429A1EF383D | Dodongo's Cavern (gold_skulltulas.052) | likely |
| 0x10434342A3917EBD | Dodongo's Cavern (gold_skulltulas.022) | likely |
| 0x165FC0BC0ACA1F6C | Ice Cavern (gold_skulltulas.066) | likely |
| 0x1BF5F0176EF03BDA | Forest Temple (gold_skulltulas.051) | likely |
| 0x1DF0DBF50C1732B7 | Graveyard (heart_pieces.017) | likely |
| 0x1E38E8D23596EECF | Hyrule Field (gold_skulltulas.042) | likely |
| 0x22C0F7DFF5EBB86D | Hyrule Castle (gold_skulltulas.006) | confirmed |
| 0x25E6072D4DF023B3 | Lon Lon Ranch (gold_skulltulas.038) | likely |
| 0x2AA39F00AAA2D331 | Forest Temple (gold_skulltulas.050) | likely |
| 0x2DF265292516BDF0 | Kakariko Village (gold_skulltulas.096) | likely |
| 0x35FB354FAC262D36 | Bottom of the Well (gold_skulltulas.076) | likely |
| 0x3A23B59EAEDC0510 | Zora's River (heart_pieces.015) | likely |
| 0x3C2B585AC5C0443E | Lost Woods (gold_skulltulas.045) | likely |
| 0x3D0DE5ADAEB73CC9 | Water Temple (gold_skulltulas.073) | likely |
| 0x3F5B150F16D84603 | Dodongo's Cavern (gold_skulltulas.023) | likely |
| 0x41811F125B1EEDD5 | Heart Container (Twinrova) (heart_containers.heart_container_twinrova) | likely |
| 0x4696B2730DE0516C | Spirit Temple (gold_skulltulas.095) | likely |
| 0x4D1B7E35CA0C6484 | Fire Temple (gold_skulltulas.058) | likely |
| 0x4E13CC311CD04DF4 | Hyrule Castle (outside Ganon's Castle) (gold_skulltulas.043) | likely |
| 0x5262CEA56C53554D | Heart Container (King Dodongo) (heart_containers.heart_container_king_dodongo) | likely |
| 0x58C75BADF059CA54 | Death Mountain Crater (gold_skulltulas.054) | likely |
| 0x5E3AE6A7CF3AC292 | Fire Temple (gold_skulltulas.055) | likely |
| 0x61576BEFD16C499A | Lake Hylia (gold_skulltulas.014) | likely |
| 0x62C340F0B876C195 | Kokiri Forest (gold_skulltulas.044) | confirmed |
| 0x63446D12663DAA83 | Zora's Fountain (gold_skulltulas.035) | likely |
| 0x63701A2CF70B201C | Ice Cavern (gold_skulltulas.064) | likely |
| 0x6689BDEBC95368EB | Lake Hylia (Lakeside Laboratory) (gold_skulltulas.068) | likely |
| 0x6789388E9FB9C92C | Bottom of the Well (gold_skulltulas.078) | likely |
| 0x6A8D9B2373D08FCB | Kakariko Village (gold_skulltulas.009) | confirmed |
| 0x6F736FC80F7B0ACA | Zora's Fountain (heart_pieces.026) | likely |
| 0x70B0FCA66CA4808A | Spirit Temple (gold_skulltulas.094) | likely |
| 0x738F5746CC517702 | Gerudo Valley (gold_skulltulas.015) | likely |
| 0x758CE7B4868447FB | Dodongo's Cavern (gold_skulltulas.021) | likely |
| 0x781E0DE8EED42373 | Lake Hylia (gold_skulltulas.098) | likely |
| 0x78AE4FD90B3CFAAA | Zora's River (gold_skulltulas.029) | likely |
| 0x7A74BC651F9FE024 | Shadow Temple (gold_skulltulas.082) | likely |
| 0x7C1A05315F83C34D | Hyrule Castle Town (gold_skulltulas.005) | likely |
| 0x7D8EC14BDD1F6341 | Hyrule Field (gold_skulltulas.099) | likely |
| 0x7F28485FA5D3688F | Hyrule Castle (gold_skulltulas.075) | confirmed |
| 0x7F498ADA1C2E9C7A | Fire Temple (gold_skulltulas.059) | likely |
| 0x8186BCB07D6C2CF9 | Lost Woods (gold_skulltulas.017) | confirmed |
| 0x81ED4ED76699E3D8 | Gerudo Fortress (gold_skulltulas.085) | likely |
| 0x8325FEA55EDFBE97 | Zora's River (gold_skulltulas.097) | likely |
| 0x8389CAFB1277D318 | Heart Container (Volvagia) (heart_containers.heart_container_volvagia) | likely |
| 0x845BA51DC18C855E | Zora's Fountain (gold_skulltulas.100) | likely |
| 0x853B892663C0215D | Zora's Domain (gold_skulltulas.063) | likely |
| 0x858F5000AD57B2CC | Kokiri Forest (gold_skulltulas.019) | likely |
| 0x88358AF5B5300AA9 | Lon Lon Ranch (heart_pieces.003) | likely |
| 0x8C8BB95471D20D02 | Spirit Temple (gold_skulltulas.092) | likely |
| 0x8E87908CB035E950 | Shadow Temple (gold_skulltulas.083) | likely |
| 0x8F5F3D3321AEB7CD | Death Mountain Crater (heart_pieces.011) | likely |
| 0x9222E742B73D3D2C | Spirit Temple (gold_skulltulas.091) | likely |
| 0x92FEAB9A9810C619 | Desert Colossus (heart_pieces.032) | likely |
| 0x97824C2FFEAA877C | Zora's River (gold_skulltulas.062) | likely |
| 0x984021BC20419EBE | Forest Temple (gold_skulltulas.049) | likely |
| 0x99CA89963485DF11 | Forest Temple (gold_skulltulas.047) | likely |
| 0x9AE3D0AC392E6CDA | Desert Colossus (gold_skulltulas.090) | likely |
| 0x9C95FD41B89C058A | Lord Jabu-Jabu's Belly (gold_skulltulas.033) | likely |
| 0x9EFABD5B0516C341 | Zora's River (heart_pieces.014) | likely |
| 0x9FC92497F014DBD5 | Lord Jabu-Jabu's Belly (gold_skulltulas.031) | likely |
| 0xA017CE09904C2DCE | Gerudo Valley (gold_skulltulas.067) | likely |
| 0xA0973706F6415ECD | Water Temple (gold_skulltulas.070) | likely |
| 0xA1632E322C612B97 | Kakariko Village (gold_skulltulas.012) | likely |
| 0xA6A4E87DA18FA678 | Hyrule Field (gold_skulltulas.039) | likely |
| 0xA8D6182A5C956E16 | Bottom of the Well (gold_skulltulas.077) | likely |
| 0xABAD0E9F0D471156 | Zora's River (gold_skulltulas.028) | likely |
| 0xAC2E26B5EC7DA3A2 | Zora's Fountain (heart_pieces.025) | likely |
| 0xB0F77B17CFB37458 | Fire Temple (gold_skulltulas.056) | likely |
| 0xB3D9F353599EEA53 | Spirit Temple (gold_skulltulas.093) | likely |
| 0xB4ECE769E6F3A206 | Gerudo Fortress (gold_skulltulas.089) | likely |
| 0xB9D0070B468F26D2 | Kakariko Village (heart_pieces.018) | likely |
| 0xBAEC91D6ED8DD96B | Lake Hylia (heart_pieces.021) | likely |
| 0xBC85EFCA2B222CD9 | Gerudo Valley (gold_skulltulas.084) | likely |
| 0xBCE05898CE61F1C0 | Great Deku Tree (gold_skulltulas.001) | confirmed |
| 0xBDFE13C37F356829 | Dodongo's Cavern (gold_skulltulas.024) | likely |
| 0xC03F282FF60942B6 | Lord Jabu-Jabu's Belly (gold_skulltulas.032) | likely |
| 0xC1858A4FCD84A28E | Lake Hylia (gold_skulltulas.036) | likely |
| 0xC3C68D0AC4B85831 | Kakariko Village (gold_skulltulas.007) | confirmed |
| 0xC835E1D03656BF46 | Heart Container (Morpha) (heart_containers.heart_container_morpha) | likely |
| 0xC8DB3346F78EA31B | Sacred Forest Meadow (gold_skulltulas.046) | likely |
| 0xCC175A90E0014905 | Fire Temple (gold_skulltulas.057) | likely |
| 0xCDB49F5D0A67FCF6 | Ice Cavern (gold_skulltulas.065) | likely |
| 0xCEED596F17934971 | Haunted Wasteland (Mirage Desert) (gold_skulltulas.086) | likely |
| 0xD0F7E5FFA76BA288 | Desert Colossus (gold_skulltulas.087) | likely |
| 0xD1CEF51CF294FB86 | Kakariko Village (gold_skulltulas.010) | confirmed |
| 0xD23A7A2C9ECED9CE | Shadow Temple (gold_skulltulas.080) | likely |
| 0xD3D86D3D6988ED8C | Gerudo Valley (gold_skulltulas.040) | likely |
| 0xD4883A16973B1D06 | Kakariko Village (gold_skulltulas.008) | confirmed |
| 0xD731EA6A04D0FD01 | Water Temple (gold_skulltulas.069) | likely |
| 0xD7FFBE169189E50D | Shadow Temple (gold_skulltulas.081) | likely |
| 0xDC8113831C56B194 | Lon Lon Ranch (gold_skulltulas.037) | likely |
| 0xDDD260AFB6F2989A | Lord Jabu-Jabu's Belly (gold_skulltulas.034) | likely |
| 0xDF73F3739CEF466B | Great Deku Tree (gold_skulltulas.002) | confirmed |
| 0xDFD66C63357CDEA7 | Gerudo Valley (heart_pieces.005) | likely |
| 0xE03A2965DF9F7B30 | Water Temple (gold_skulltulas.072) | likely |
| 0xE91F6BE796358FFC | Graveyard (gold_skulltulas.011) | likely |
| 0xEAFE60E592E9A3FB | Shadow Temple (gold_skulltulas.079) | likely |
| 0xECDC46B409ED7D38 | Kokiri Forest (gold_skulltulas.016) | confirmed |
| 0xF0DAC245E2FC448E | Zora's Fountain (gold_skulltulas.030) | likely |
| 0xF1D32C06612DA232 | Death Mountain Trail (gold_skulltulas.020) | likely |
| 0xF2E27D6A27026ACF | Great Deku Tree (gold_skulltulas.004) | confirmed |
| 0xF43CCB260F5576DC | Heart Container (Bongo) (heart_containers.heart_container_bongo) | likely |
| 0xF45F5319D88E7AC7 | Heart Container (Barinade) (heart_containers.heart_container_barinade) | likely |
| 0xF46B1710ED0620D1 | Forest Temple (gold_skulltulas.048) | likely |
| 0xF5359B24FC86AC22 | Death Mountain Trail (gold_skulltulas.061) | likely |
| 0xF6FA6EF0CA152948 | Lost Woods (gold_skulltulas.018) | confirmed |
| 0xF8C7601DA7DD887E | Kakariko Village (heart_pieces.012) | likely |
| 0xF914FA367471A3E3 | Heart Container (Gohma) (heart_containers.heart_container_gohma) | likely |
| 0xFAD8931A0011E1D4 | Great Deku Tree (gold_skulltulas.003) | confirmed |
| 0xFBBC2D490276C68E | Goron City (gold_skulltulas.053) | likely |
| 0xFCD7F04DCF755E8E | Death Mountain Crater (gold_skulltulas.025) | likely |
| 0xFF11593A22778E7E | Heart Container (Phantom Ganon) (heart_containers.heart_container_phantom_ganon) | likely |

## Enum and text values

### BottleItem

Empty slot = 0xBE69DE49. Values are murmur3 of the value name.

| Value | murmur3 | Status |
|---|---|---|
| AlarmCucco | 0x6B20E6DE |  |
| BigPoe | 0xCDC21471 |  |
| BluePotion | 0xF383D6E5 |  |
| Bomb | 0xC0F40041 |  |
| Bombchu | 0x98EECBDF |  |
| Bug | 0x74D62ECB |  |
| CojiroCucco | 0x06015CCF |  |
| DekuNut | 0x83D2E406 |  |
| DekuStick | 0xF9E54315 |  |
| EggHatched | 0x3E6C49BC |  |
| Empty | 0xBE69DE49 |  |
| EyeballFrog | 0xFCAE10B1 |  |
| Fairy | 0x6F49E357 |  |
| Fish | 0x1E834EF8 |  |
| GreenPotion | 0x049D37C1 |  |
| HalfMilk | 0xEEF6E4B0 |  |
| Letter | 0x0F24E808 |  |
| MagicBean | 0xC51A84D9 |  |
| MaxMilk | 0x73356827 |  |
| NormalLure | 0xED604064 |  |
| OddMushroom | 0x7AA43B67 |  |
| OddPowder | 0xB386C0E6 |  |
| PocketCucco | 0xB239AE0E |  |
| PocketEgg | 0x27F82799 |  |
| Poe | 0x02084F9E |  |
| Prescription | 0x4C922EA3 |  |
| RedPotion | 0xEABA6067 |  |
| SinkLure | 0x80C8163D |  |
| SinkingLure | 0x0005FA8A |  |
| Water | 0xD21B65B6 |  |
| WeirdEgg | 0xBF9564DA |  |

### PlayerStatus.EquipWeapon

String64 text, not a hash. The hash shown is only for matching enum tables.

| Value | murmur3 | Status |
|---|---|---|
| Weapon_Base | 0xCEF0D9FE | candidate (from key names) |
| Weapon_Lure | 0x27D2FDE5 | candidate (from key names) |
| Weapon_Range_Bow | 0xEDA9B3D8 | candidate (from key names) |
| Weapon_Range_SlingShot | 0xFE3EF78E | candidate (from key names) |
| Weapon_SinkingLure | 0x791406DD | candidate (from key names) |
| Weapon_Sword_Biggoron | 0xA135A65C | candidate (from key names) |
| Weapon_Sword_BrokenGiant | 0x1E8BA898 | candidate (from key names) |
| Weapon_Sword_DarkLinkSword | 0xFF39AFB1 | candidate (from key names) |
| Weapon_Sword_Giant | 0xD8BF1A86 | candidate (from key names) |
| Weapon_Sword_Kokiri | 0x67805FDC | seen in a save |
| Weapon_Sword_Master | 0x788667A1 | candidate (from key names) |

### PlayerStatus.EquipShield

String64 text, not a hash. The hash shown is only for matching enum tables.

| Value | murmur3 | Status |
|---|---|---|
| Weapon_Shield_DarkLinkShield | 0x32218914 | candidate (from key names) |
| Weapon_Shield_Deku | 0x63F5AAFB | candidate (from key names) |
| Weapon_Shield_Hylian | 0x9C540F59 | seen in a save |
| Weapon_Shield_Mirror | 0x7463009D | in the game enum table |

### Equipment (tunics, bracelets, masks, other head/boots)

Candidate item ids for the not-yet-identified head/armor records; short-form alternates also exist in the enum table.

| Value | murmur3 | Status |
|---|---|---|
| Armor_Adult_Default_Head | 0x0DEB8542 | candidate (from key names) |
| Armor_Adult_Gauntlet_Gold | 0x165720D4 | candidate (from key names) |
| Armor_Adult_Gauntlet_Silver | 0x348480E7 | candidate (from key names) |
| Armor_Adult_Goron | 0x50B5CA70 | in the game enum table |
| Armor_Adult_HeavyBoot | 0xE8CD8170 | candidate (from key names) |
| Armor_Adult_HoverBoot | 0x79D961B0 | candidate (from key names) |
| Armor_Adult_Normal | 0xEE123AF9 | candidate (from key names) |
| Armor_Adult_Zora | 0xD140FE79 | in the game enum table |
| Armor_Child_Default_Head | 0x711A0D06 | candidate (from key names) |
| Armor_Child_Gauntlet_Goron | 0x23745682 | candidate (from key names) |
| Armor_Child_Mask_Amiibo0 | 0x7405E423 | candidate (from key names) |
| Armor_Child_Mask_Amiibo1 | 0xB4B87B0E | candidate (from key names) |
| Armor_Child_Mask_Bunny | 0x938423B7 | candidate (from key names) |
| Armor_Child_Mask_Gerudo | 0x01BA2992 | candidate (from key names) |
| Armor_Child_Mask_Goron | 0xBFB786D0 | candidate (from key names) |
| Armor_Child_Mask_Keaton | 0xB4EDEDDF | candidate (from key names) |
| Armor_Child_Mask_Skull | 0x25DEC978 | candidate (from key names) |
| Armor_Child_Mask_Spooky | 0xA620B286 | candidate (from key names) |
| Armor_Child_Mask_Truth | 0x4A4171C9 | candidate (from key names) |
| Armor_Child_Mask_Zora | 0x168B40D4 | candidate (from key names) |
| Armor_GlassTruth | 0x52B6A71E | candidate (from key names) |
| Armor_Mask_Base | 0xD30AA7E7 | candidate (from key names) |
| BunnyMask | 0x6ADF66BF | short form in the game enum table |
| GerudoMask | 0x271EEF30 | short form in the game enum table |
| GoronMask | 0x27A5B0B4 | short form in the game enum table |
| HeavyBoot | 0xFFAD4BB9 | short form in the game enum table |
| HoverBoot | 0x3118CF3D | short form in the game enum table |
| KeatonMask | 0xA0D31259 | short form in the game enum table |
| SkullMask | 0xF7469FCE | short form in the game enum table |
| SpookyMask | 0x04427794 | short form in the game enum table |
| TruthMask | 0x5A4F9388 | short form in the game enum table |
| ZoraMask | 0x081F0856 | short form in the game enum table |

### 0x59979321

| Value | murmur3 | Status |
|---|---|---|
| High | 0x165AF889 |  |
| Low | 0xD9E40095 |  |
| Middle | 0xB6A1CCDF |  |
| None | 0xB6EEDE09 |  |

### Step_GatheringTokenGold

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

### Step_Get_Epona

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

### Step_Meet_GreatFairy

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

### Step_SubEvent_GetScarecrow

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

### Step_SubEvent_GetStormSong

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

### Step_SubEvent_GetSwordBigGoron

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

### Step_SubEvent_GhostShop

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

### Step_SubEvent_MaskSalesman

| Value | murmur3 | Status |
|---|---|---|
| Complete | 0x4C0A63F4 |  |

## Areas

Current stage: String64 key 0x1D6189DA; position inside the stage: String64Array key 0xC458F1EB. Era-dependent stages are the base name + "_Child" or "_Adult"; era-independent stages use the bare base name.

| Stage id | Name | Status |
|---|---|---|
| DeathMountainCrater_02 | Death Mountain Crater | internal name from event keys (not a runtime stage name) |
| DeathMountainCrater_Child | Death Mountain Crater (child) | seen in game |
| DeathMountainTrail_01 | Death Mountain Trail 01 | internal name from event keys (not a runtime stage name) |
| DeathMountainTrail_02 | Death Mountain Trail 02 | internal name from event keys (not a runtime stage name) |
| DeathMountainTrail_03 | Death Mountain Trail 03 | internal name from event keys (not a runtime stage name) |
| DeathMountainTrail_Child | Death Mountain Trail (child) | seen in game |
| DesertColossus_01 | Desert Colossus 01 | internal name from event keys (not a runtime stage name) |
| DesertColossus_Child | Desert Colossus (child) | seen in game |
| GanonCastle_01 | Ganon's Castle | internal name from event keys (not a runtime stage name) |
| GanonCastle_02 | Ganon's Castle | internal name from event keys (not a runtime stage name) |
| GerudoFortress_01 | Gerudo Fortress 01 | internal name from event keys (not a runtime stage name) |
| GerudoFortress_02 | Gerudo Fortress 02 | internal name from event keys (not a runtime stage name) |
| GerudoFortress_03 | Gerudo Fortress 03 | internal name from event keys (not a runtime stage name) |
| GerudoValley_01 | Gerudo Valley 01 | internal name from event keys (not a runtime stage name) |
| GoronCity_01 | Goron City 01 | internal name from event keys (not a runtime stage name) |
| GoronCity_02 | Goron City 02 | internal name from event keys (not a runtime stage name) |
| GoronCity_02_before | Goron City 02 before | internal name from event keys (not a runtime stage name) |
| GoronCity_Child | Goron City (child) | seen in game |
| Graveyard_01 | Graveyard | internal name from event keys (not a runtime stage name) |
| Graveyard_Child | Graveyard (child) | seen in game |
| HyruleCastle | Hyrule Castle | seen in game |
| HyruleCastle_01 | Hyrule Castle | internal name from event keys (not a runtime stage name) |
| HyruleField | Hyrule Field | internal name from event keys (not a runtime stage name) |
| HyruleField_01 | Hyrule Field | internal name from event keys (not a runtime stage name) |
| HyruleField_02 | Hyrule Field | internal name from event keys (not a runtime stage name) |
| HyruleField_03 | Hyrule Field | internal name from event keys (not a runtime stage name) |
| HyruleField_03_Land | Hyrule Field 03 Land | internal name from event keys (not a runtime stage name) |
| HyruleField_Adult | Hyrule Field (adult) | seen in game |
| HyruleField_Child | Hyrule Field (child) | seen in game |
| IceCaven_01 | Ice Caven 01 | internal name from event keys (not a runtime stage name) |
| IceCaven_02 | Ice Caven 02 | internal name from event keys (not a runtime stage name) |
| InsideGanonCastle_01 | Ganon's Castle | internal name from event keys (not a runtime stage name) |
| InsideTheDekuTree_01 | Great Deku Tree | internal name from event keys (not a runtime stage name) |
| KakarikoVillage_01 | Kakariko Village 01 | internal name from event keys (not a runtime stage name) |
| KakarikoVillage_02 | Kakariko Village 02 | internal name from event keys (not a runtime stage name) |
| KakarikoVillage_Child | Kakariko Village (child) | seen in game |
| Kokiri | Kokiri | internal name from event keys (not a runtime stage name) |
| KokiriForest_01 | Kokiri Forest 01 | internal name from event keys (not a runtime stage name) |
| LakeHylia_01 | Lake Hylia | internal name from event keys (not a runtime stage name) |
| LakeHylia_02 | Lake Hylia | internal name from event keys (not a runtime stage name) |
| LostWood | Lost Woods | internal name from event keys (not a runtime stage name) |
| LostWood_01 | Lost Woods | internal name from event keys (not a runtime stage name) |
| LostWood_Child | Lost Woods (child) | seen in game |
| Market | Hyrule Castle Town | internal name from event keys (not a runtime stage name) |
| Market_01 | Hyrule Castle Town | internal name from event keys (not a runtime stage name) |
| Market_02 | Hyrule Castle Town | internal name from event keys (not a runtime stage name) |
| Market_03 | Hyrule Castle Town | internal name from event keys (not a runtime stage name) |
| Market_Child | Hyrule Castle Town (child) | seen in game |
| SacredForestMeadow_01 | Sacred Forest Meadow 01 | internal name from event keys (not a runtime stage name) |
| SacredForestMeadow_Child | Sacred Forest Meadow (child) | seen in game |
| ShadowTemple_01 | Shadow Temple 01 | internal name from event keys (not a runtime stage name) |
| SpiritTemple_01 | Spirit Temple 01 | internal name from event keys (not a runtime stage name) |
| SpiritTemple_02 | Spirit Temple 02 | internal name from event keys (not a runtime stage name) |
| UnderTheGrave_02 | Under The Grave 02 | internal name from event keys (not a runtime stage name) |
| UndetTheGrave_01 | Undet The Grave 01 | internal name from event keys (not a runtime stage name) |
| ZoraDomain_01 | Zora's Domain | internal name from event keys (not a runtime stage name) |
| ZoraFountain_01 | Zora's Fountain | internal name from event keys (not a runtime stage name) |
| ZoraRiver_01_Under | Zora River 01 Under | internal name from event keys (not a runtime stage name) |

Area groups: BottomOfTheWell (Bottom Of The Well), DodongoCavern (Dodongo's Cavern), FireTemple (Fire Temple), ForestTemple (Forest Temple), GanonCastle (Ganon's Castle), GerudoFortress (Gerudo Fortress), GerudoValley (Gerudo Valley), HyruleCastle (Hyrule Castle), IceCavern (Ice Cavern), InsideGanonCastle (Ganon's Castle), InsideJabuJabuBelly (Lord Jabu-Jabu's Belly), InsideTheDekuTree (Great Deku Tree), LakeHylia (Lake Hylia), Market (Hyrule Castle Town), ShadowTemple (Shadow Temple), SpiritTemple (Spirit Temple), TimeTemple (Hyrule Castle Town), WaterTemple (Water Temple).

## How to contribute corrections

Found a key that behaves differently, a better name, or a confirmation? Open an issue or pull request with the key hash, the game build, what you did in game, and the before/after values (a save diff is ideal). Please send facts in your own words: no game files, assets or extracted text.
