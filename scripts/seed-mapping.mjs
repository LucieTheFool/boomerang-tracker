// Generator for the first version of data/save-mapping.json, keyed by the ids in
// data/checklist.json (looked up by category + row number, so names can change freely).
// After the first run, edit data/save-mapping.json by hand; this script refuses to
// overwrite it unless you pass --force.
import fs from 'node:fs';

const OUT = 'data/save-mapping.json';
if (fs.existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`${OUT} exists; edit it by hand (or pass --force to regenerate).`);
  process.exit(1);
}
const checklist = JSON.parse(fs.readFileSync('data/checklist.json', 'utf8'));
const cat = id => checklist.categories.find(c => c.id === id);

const out = {
  version: 2,
  notes: 'Keyed by data/checklist.json ids. confidence: confirmed = seen changing in a diff at the right moment; likely = the flag name says what it is (or an MIT editor maps it the same way) and all six slots agree; guess = indirect inference, needs a diff.',
  entries: {},
  counters: {},
};
const NAME = 'Flag name from game files';

/** Map row `n` of category `c`. */
function M(c, n, detect, confidence, evidence) {
  const item = cat(c).items.find(i => i.number === n);
  if (!item) throw new Error(`${c} #${n} not in checklist`);
  out.entries[item.id] = { label: item.name, detect, confidence, evidence };
}
const isGet = n => ({ name: `IsGet.${n}` });
const flag = n => ({ name: n });
const killed = n => ({ name: `DefeatedEnemyNum.Enemy_${n}`, gte: 1 });
const done = n => ({ name: n, eq: 'Complete' });
const likelyName = r => `${NAME}: ${r.name}`;
const L = (c, n, r, ev) => M(c, n, r, 'likely', ev ?? likelyName(r));
const G = (c, n, r, ev) => M(c, n, r, 'guess', ev);

// ---- Heart Pieces (only the event/minigame ones have names; the rest are probably 64-bit flags)
L('heart_pieces', 1, flag('Npc_Hylia_001_IsGetHeartPiece'), `${NAME}. Npc_Hylia_001 is the rooftop man (Npc_Hylia_001_IsOnTheRoof)`);
L('heart_pieces', 2, flag('GraveYard_DiggingHoleTour_Drop_HeartPiece'));
L('heart_pieces', 6, flag('MiniGame_Fishing_GetHeartPiece'));
L('heart_pieces', 7, flag('SubEvent_FindRichard_GetHeartPiece'));
L('heart_pieces', 8, flag('Minigame_SkullKidSession_IsGetHeartPiece'));
L('heart_pieces', 9, flag('Npc_SkullKid_Child_IsGetHeartPiece'));
L('heart_pieces', 10, flag('GoronLargePot_IsGetHeartPiece'));
L('heart_pieces', 19, flag('UnderTheGrave_DampeRace_HeartGeted'));
L('heart_pieces', 20, flag('KakarikoVillage_GatheringTokenGold_GetReward50'), `${NAME}: the 50-token House of Skulltula reward`);
G('heart_pieces', 28, flag('MiniGame_FrogTenors_InsectRepellent_ClearAfter'), 'Frogs\' fly game ("insect repellent") cleared. Needs a diff.');
L('heart_pieces', 29, flag('MiniGame_ChoiceTreasure_IsClear'), `${NAME}: Treasure Chest Shop game cleared`);
L('heart_pieces', 31, flag('MiniGame_HorsebackArchery_GotaHeart'));
L('heart_pieces', 34, flag('HyruleField_Enemy_Scrub_Business_HeartPiece_01'));
L('heart_pieces', 36, flag('DeathMountain_Enemy_Scrub_Business_HeartPiece_01'));

// ---- Heart Containers
L('heart_containers', 1, flag('InsideTheDekuTree_Heart_Container_Obtained'));
['DungeonBoss_Dodongo', 'DungeonBoss_Barinade', 'DungeonBoss_PhantomGanon', 'DungeonBoss_Volvagia', 'DungeonBoss_Morpha', 'DungeonBoss_BongoBongo', 'DungeonBoss_Twinrova']
  .forEach((b, i) => G('heart_containers', i + 2, killed(b),
    'Assumes the container was picked up once the boss is beaten. Slot_05 agrees (4 bosses beaten, max hearts 3 + 4). Only the Deku Tree has its own flag. Needs a diff.'));

// ---- Songs (checklist order)
['ZeldaLullaby', 'SunSong', 'EponaSong', 'SariaSong', 'TimeSong', 'StormSong', 'ForestMinuet', 'LightPrelude', 'FireBolero', 'WaterSerenade', 'ShadowNocturne', 'SpiritRequiem', 'ScarecrowSong']
  .forEach((s, i) => s === 'LightPrelude'
    ? M('songs', i + 1, isGet(`Item_Melody_${s}`), 'confirmed', 'slot_02 → slot_03 diff: set together with Market_Adult_GetLightPrelude and AllSage_MeetSheikCount 1→2')
    : L('songs', i + 1, isGet(`Item_Melody_${s}`)));

// ---- Equipment
const eq = ['Weapon_Sword_Kokiri', 'Weapon_Sword_Master', 'Weapon_Sword_Giant', 'Weapon_Sword_Biggoron', 'Weapon_Shield_Deku', 'Weapon_Shield_Hylian', 'Weapon_Shield_Mirror', null, 'Armor_Adult_Goron', 'Armor_Adult_Zora', 'Armor_Adult_HeavyBoot', 'Armor_Adult_HoverBoot'];
eq.forEach((n, i) => n ? L('equipment', i + 1, isGet(n)) : L('equipment', i + 1, { always: true }, 'Starting gear (IsGet.Obj_Armor_Child_Normal is true in every slot)'));

// ---- Items
const doubleMagic = { any: [isGet('Item_FairyBless_MPDouble'), { name: 'PlayerStatus.MPMax', gte: 480 }] };
const items = ['Weapon_Range_SlingShot', 'Weapon_Range_Bow', 'Item_Arrow_Fire', 'Item_Arrow_Ice', 'Item_Arrow_Light', 'Item_Boomerang', 'Item_Hookshot', 'Item_Longshot', 'Item_Hammer',
  'Armor_Child_Gauntlet_Goron', 'Armor_Adult_Gauntlet_Silver', 'Armor_Adult_Gauntlet_Gold', 'Item_BombBag_Small', 'Item_Bombchu', 'Item_DekuStick', 'Item_DekuNut',
  'Item_DinFire', 'Item_FaroreWind', 'Item_NayruLove', 'DOUBLE_MAGIC', 'Armor_GlassTruth', 'Item_Scale_Silver', 'Item_Scale_Gold', 'Item_AgonyStone', 'Item_Ocarina_Fairy', 'Item_Ocarina_Time', 'Item_MagicBean'];
items.forEach((n, i) => {
  if (n === 'DOUBLE_MAGIC') G('items', i + 1, doubleMagic, 'IsGet.Item_FairyBless_MPDouble, or the magic meter doubled (PlayerStatus.MPMax is 240 with single magic). IsGet.Item_FairyBless_MP stays false even with magic, so the IsGet flag alone may not be set. Needs a diff.');
  else if (n === 'Armor_GlassTruth') L('items', i + 1, isGet(n), `${NAME}: IsGet.Armor_GlassTruth ("glass of truth"); Step_SageOfShadow has GetGlassTruth / GotGlassTruth steps`);
  else if (n === 'Item_AgonyStone') L('items', i + 1, isGet(n), `${NAME}: IsGet.Item_AgonyStone. The checklist says the Echo Gem replaces the Stone of Agony, and the game also has KakarikoVillage_GatheringTokenGold_ActionGuide_AgonyStone_True`);
  else L('items', i + 1, isGet(n));
});

// ---- Key items
L('key_items', 1, isGet('Item_Token_Gerudo'));

// ---- Masks
['Keaton', 'Skull', 'Spooky', 'Bunny', 'Truth'].forEach((m, i) => L('masks', i + 1, isGet(`Armor_Child_Mask_${m}`)));

// ---- Bottles (by source)
L('bottles', 1, flag('Market_Item_Bottle_TutorialEvent_Cleared'), `${NAME}: the Market bottle "tutorial" event (catch the escaped bug) cleared`);
L('bottles', 2, flag('MiniGame_CatchCucco_IsCompleted'), `${NAME}: the Kakariko Cucco-pen game completed`);
M('bottles', 3, flag('IsClear_Minigame_FindOutCucco'), 'confirmed', "Talon's Cucco game at Lon Lon Ranch cleared (confirmed in play 2026-11-11)");
L('bottles', 4, isGet('Item_Bottle_Letter'), `${NAME}: IsGet.Item_Bottle_Letter. Slot_05 has it and one bottle slot in use`);
G('bottles', 5, { name: 'GhostShop_CouponNum', gte: 5 }, 'GhostShop_CouponNum (Poe buyer) ≥ 5. Assumes the number counts Big Poes sold. 0 in every slot so far. Needs a diff.');

// ---- Great Fairies
L('great_fairies', 1, { any: [flag('HavePlayedEvent.Dm_FairyFountain_Din'), isGet('Item_DinFire')] },
  'HavePlayedEvent.Dm_FairyFountain_Din or Din\'s Fire owned. Slot_05: the only fountain event played is Din\'s, and it has Din\'s Fire + a magic meter (MPMax 240), matching the checklist');
out.entries[cat('great_fairies').items[1].id] = { label: cat('great_fairies').items[1].name, detect: null, confidence: 'guess',
  evidence: 'Unmapped: one of HavePlayedEvent.Dm_FairyFountain_{Power,Wisdom,Courage}, but which one is unknown. One diff after this fairy settles it.' };
L('great_fairies', 3, { any: [flag('HavePlayedEvent.Dm_FairyFountain_Frore'), isGet('Item_FaroreWind')] }, "Fountain event Dm_FairyFountain_Frore (Farore) or Farore's Wind owned");
G('great_fairies', 4, doubleMagic, 'Same rule as Items: Double Magic');
L('great_fairies', 5, { any: [flag('HavePlayedEvent.Dm_FairyFountain_Nayru'), isGet('Item_NayruLove')] }, "Fountain event Dm_FairyFountain_Nayru or Nayru's Love owned");
G('great_fairies', 6, isGet('Item_FairyBless_DefenseDouble'), 'IsGet.Item_FairyBless_DefenseDouble. Its Magic counterpart (FairyBless_MP) never gets set, so this one may not either. Needs a diff.');

// ---- Capacity upgrades
const cap = [null, 'Item_Wallet_Medium', 'Item_Wallet_Large', 'Item_BombBag_Small', 'Item_BombBag_Medium', 'Item_BombBag_Large', 'Item_BulletBag_Medium', 'Item_BulletBag_Large',
  'Item_Quiver_Medium', 'Item_Quiver_Large', 'Item_StickBag_Medium', 'Item_StickBag_Large', 'Item_NutBag_Medium', 'Item_NutBag_Large'];
cap.forEach((n, i) => n ? L('capacity', i + 1, isGet(n), `${NAME}: IsGet.${n} (detected by capacity level, as the checklist asks)`)
  : L('capacity', i + 1, { always: true }, 'Starting wallet'));

// ---- Stones & medallions
['Item_Stone_Forest', 'Item_Stone_Fire', 'Item_Stone_Water', 'Item_Medal_Light', 'Item_Medal_Forest', 'Item_Medal_Fire', 'Item_Medal_Water', 'Item_Medal_Shadow', 'Item_Medal_Spirit']
  .forEach((n, i) => L('stones_medallions', i + 1, isGet(n)));

// ---- Dungeons cleared (checklist order)
const bossOut = d => flag(`HavePlayedEvent.Dm_${d}_BossOut`);
const BO = 'Boss-exit cutscene flag. In slot_05 it is true exactly for the dungeons whose bosses the kill counters show beaten';
L('dungeons', 1, bossOut('Deku'), BO); L('dungeons', 2, bossOut('DodongoCave'), BO); L('dungeons', 3, bossOut('InsideJabu_Jabu'), BO);
L('dungeons', 4, bossOut('ForestTemple'), BO); L('dungeons', 5, bossOut('FireTemple'), BO);
L('dungeons', 6, isGet('Armor_Adult_HeavyBoot'), 'No boss: done once you have its prize, the Iron Boots');
L('dungeons', 7, bossOut('WaterTemple'), BO);
L('dungeons', 8, isGet('Armor_GlassTruth'), 'No boss: done once you have its prize, the Lenses of Truth');
L('dungeons', 9, bossOut('ShadowTemple'), BO); L('dungeons', 10, bossOut('SpiritTemple'), BO);
L('dungeons', 11, isGet('Item_Arrow_Ice'), 'No boss: done once you have its prize, the Ice Arrows');
L('dungeons', 12, killed('DungeonBoss_Ganon'), 'Ganon beaten (kill counter). Dm_FinalBattle_BossOut probably means the same');

// ---- Bosses
['DungeonBoss_Gohma', 'DungeonBoss_Dodongo', 'DungeonBoss_Barinade', 'DungeonBoss_PhantomGanon', 'DungeonBoss_Volvagia', 'DungeonBoss_Morpha', 'DungeonBoss_BongoBongo', 'DungeonBoss_Twinrova', 'DungeonBoss_Ganondorf', 'DungeonBoss_Ganon']
  .forEach((b, i) => L('bosses', i + 1, killed(b), `Kill counter DefeatedEnemyNum.Enemy_${b} ≥ 1 (the HaveDefeatedEnemy_* bools stay false after a kill)`));

// ---- Mini-bosses
L('mini_bosses', 1, killed('MiddleBoss_BigOcto'), 'Kill counter');
L('mini_bosses', 2, killed('Moblin_Club'), 'Kill counter for the club-wielding Moblin (the Sacred Forest Meadow giant)');
L('mini_bosses', 3, killed('MiddleBoss_Poe_Meg'), 'Kill counter for Meg, the last Poe Sister');
L('mini_bosses', 4, killed('MiddleBoss_FlareDancer'), 'Kill counter');
L('mini_bosses', 5, killed('Wolfos_White'), 'Kill counter (IceCavern_Room04_WhiteWolfos_Appear also exists)');
L('mini_bosses', 6, killed('MiddleBoss_DarkLink'), 'Kill counter');
L('mini_bosses', 7, killed('DeadHand'), 'Kill counter');
L('mini_bosses', 8, { all: ['MiddleBoss_GerudoThief', 'MiddleBoss_GerudoThief_02', 'MiddleBoss_GerudoThief_03', 'MiddleBoss_GerudoThief_04'].map(killed) }, 'All four carpenter-cell guard counters');
G('mini_bosses', 9, { any: ['IronKnuckle_Silver', 'IronKnuckle_Black', 'IronKnuckle_White'].map(killed) }, 'Any of the three plain Iron Knuckle counters. Which colour the Spirit Temple one is needs a diff.');
L('mini_bosses', 10, killed('MiddleBoss_IronKnuckle_Nabooru'), 'Kill counter');

// ---- Side quests: the game's own quest-step enums reaching "Complete"
const SQ = n => `Quest step enum ${n} = Complete (the game's own ${n.replace('Step_', '')}_IsCompleted_Exp expression is exactly this test)`;
L('side_quests', 1, done('Step_Get_Epona'), SQ('Step_Get_Epona'));
L('side_quests', 2, done('Step_SubEvent_MaskSalesman'), SQ('Step_SubEvent_MaskSalesman'));
L('side_quests', 3, done('Step_Meet_GreatFairy'), 'Quest step enum Step_Meet_GreatFairy = Complete (steps: GoToTopOfMountain → GoToFountain → GetFairyBreath → GoToHyruleCastle)');
L('side_quests', 4, done('Step_SubEvent_GetScarecrow'), SQ('Step_SubEvent_GetScarecrow'));
L('side_quests', 5, done('Step_SubEvent_GetSwordBigGoron'), SQ('Step_SubEvent_GetSwordBigGoron'));
G('side_quests', 6, { key: '0x7A5B9537', eq: 'Complete' }, 'Unnamed quest enum whose first step is ReadyForGetStormSong; slot_05 (has Song of Storms) is at step02. Needs a diff.');

// ---- Part B
['GetReward10', 'GetReward20', 'GetReward30', 'GetReward40', 'GetReward50'].forEach((r, i) =>
  L('skulltula_rewards', i + 1, flag(`KakarikoVillage_GatheringTokenGold_${r}`), `${NAME}: KakarikoVillage_GatheringTokenGold_${r} (reward claimed)`));
L('skulltula_rewards', 6, done('Step_GatheringTokenGold'), 'Quest step Step_GatheringTokenGold = Complete (steps: CollectToken → Finish → Complete); no separate 100-token flag in the save');
['Item_WeirdEgg', 'Item_AlarmCucco', 'Item_ZeldaLetter'].forEach((n, i) => L('child_trade', i + 1, isGet(n), `${NAME}: IsGet.${n} ("AlarmCucco" = the Wake-up Cucco)`));
['Item_PocketEgg', 'Item_PocketCucco', 'Item_CojiroCucco', 'Item_OddMushroom', 'Item_OddPowder', 'Item_PoacherSaw', 'Item_BrokenSword', 'Item_Prescription', 'Item_EyeballFrog', 'Item_EyeDrop', 'Item_ClaimCheck']
  .forEach((n, i) => L('adult_trade', i + 1, isGet(n)));

// ---- Part C
const DUN = { great_deku_tree: 'InsideTheDekuTree', dodongos_cavern: 'DodongoCavern', lord_jabu_jabus_belly: 'InsideJabuJabuBelly', forest_temple: 'ForestTemple', fire_temple: 'FireTemple',
  water_temple: 'WaterTemple', shadow_temple: 'ShadowTemple', spirit_temple: 'SpiritTemple', ice_cavern: 'IceCavern', bottom_of_the_well: 'BottomOfTheWell', ganons_castle: 'InsideGanonCastle' };
for (const it of cat('dungeon_items').items) {
  const m = it.id.match(/^dungeon_items\.(.+)_(map|compass|boss_key)$/);
  const key = `DungeonInfo.${DUN[m[1]]}.${{ map: 'IsGetMap', compass: 'IsGetCompass', boss_key: 'IsGetBossKey' }[m[2]]}`;
  out.entries[it.id] = { label: it.name, detect: flag(key), confidence: 'likely', evidence: `${NAME}: ${key}` };
}
G('amiibo_masks', 1, isGet('Armor_Child_Mask_Amiibo0'), 'IsGet.Armor_Child_Mask_Amiibo0; which figure is 0 vs 1 is unknown');
G('amiibo_masks', 2, isGet('Armor_Child_Mask_Amiibo1'), 'IsGet.Armor_Child_Mask_Amiibo1; which figure is 0 vs 1 is unknown');

// ---- Counters (categories that are one number)
out.counters.big_poes = { value: { name: 'GhostShop_CouponNum' }, confidence: 'guess',
  evidence: 'GhostShop_CouponNum, the Poe buyer\'s count. 0 in every slot so far; its unit (Poes or points) needs a diff. HyruleField_Defeat_BigPoe_01–10 track Poes defeated, not sold.' };
const soils = ['KokiriForest', 'KokiriForest_LostWood', 'LostWood01', 'LostWood02', 'Graveyard', 'ZoraRiver', 'ZoraRiver02', 'LakeHylia', 'DeathMountainTrail', 'DeathMountainCrater', 'GerudoValley', 'DesertColossus'];
out.counters.magic_beans_planted = { countOf: soils.map(s => ({ name: `Gimmick_MagicBeanSoil_${s}` })), cap: 10, confidence: 'guess',
  evidence: 'Count of Gimmick_MagicBeanSoil_* flags (12 exist for 10 beans; some may be Skulltula soil only). All false so far. Needs a diff after planting.' };

out.derived = {
  maxHearts: { name: 'PlayerStatus.MaxLife', scale: 0.25, evidence: 'Quarter hearts; same key as the MIT editor. slot_05 = 28 = 7 hearts' },
  heartPiecesHeld: { name: 'PouchData.Obj_Heart_Piece.StockNum', evidence: 'Loose pieces toward the next heart (0–3)' },
  goldSkulltulaTokens: { name: 'PouchData.Item_Token_Gold.StockNum', evidence: 'Same hash (0x04735978) as the MIT editor' },
  skulltulaRewards: { evidence: 'From the checklist (House of Skulltula rewards)', list: [[10, "Adult's Wallet"], [20, 'Echo Gem'], [30, "Giant's Wallet"], [40, 'Bombchus (20)'], [50, 'Piece of Heart'], [100, 'Gold Rupee']] },
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`${Object.keys(out.entries).length} entries + ${Object.keys(out.counters).length} counters written to ${OUT}`);
