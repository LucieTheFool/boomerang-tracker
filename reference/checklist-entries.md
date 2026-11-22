# Checklist entries (per location)

Per kind of checklist entry, the keys a real pickup sets, with location-level entries.
Key data those recipes address lives in the
[OoT Switch 2 reference repo](https://github.com/LucieTheFool/oot-switch2-reference).
Generated — do not edit by hand.


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
| Poe Collector bottle (bottles.poe_collector_bottle) | all | Step_SubEvent_GhostShop set "Complete" | likely |
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
| Young Link amiibo mask (amiibo_masks.young_link) | all | IsGet.Armor_Child_Mask_Amiibo0 | guess |
| Young Zelda amiibo mask (amiibo_masks.young_zelda) | all | IsGet.Armor_Child_Mask_Amiibo1 | guess |
