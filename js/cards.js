// ============================================================
// cards.js — Card database, chapter/enemy data, starter info
// ============================================================

const CARD_TYPES = { ATTACK: 'attack', ITEM: 'item', SUMMON: 'summon', EQUIPMENT: 'equipment' };

const RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, ultra_rare: 5 };

// ── Elemental system ─────────────────────────────────────────
const ELEMENTS = {
  normal:   { icon: '⚪', name: 'Normal',   color: '#aaa' },
  fire:     { icon: '🔥', name: 'Fire',     color: '#e94560' },
  water:    { icon: '💧', name: 'Water',    color: '#3498db' },
  electric: { icon: '⚡', name: 'Electric', color: '#f1c40f' },
  grass:    { icon: '🌿', name: 'Grass',    color: '#2ecc71' },
  ice:      { icon: '❄️', name: 'Ice',      color: '#87ceeb' },
  earth:    { icon: '🪨', name: 'Earth',    color: '#b8860b' },
  dark:     { icon: '🌑', name: 'Dark',     color: '#9b59b6' },
  wind:     { icon: '🌪️', name: 'Wind',     color: '#1abc9c' },
};

// Multiplier table: ELEMENT_MATCHUPS[attacker][defender] → multiplier
// 1.5 = super effective, 0.5 = resisted, 1 = neutral
const ELEMENT_MATCHUPS = {
  normal:   { normal:1, fire:1, water:1, electric:1, grass:1, ice:1, earth:1, dark:1, wind:1 },
  fire:     { normal:1, fire:0.5, water:0.5, electric:1, grass:1.5, ice:1.5, earth:1, dark:1, wind:1 },
  water:    { normal:1, fire:1.5, water:0.5, electric:0.5, grass:0.5, ice:1, earth:1.5, dark:1, wind:1 },
  electric: { normal:1, fire:1, water:1.5, electric:0.5, grass:0.5, ice:1, earth:0.5, dark:1, wind:1.5 },
  grass:    { normal:1, fire:0.5, water:1.5, electric:1, grass:0.5, ice:0.5, earth:1.5, dark:1, wind:1 },
  ice:      { normal:1, fire:0.5, water:1, electric:1, grass:1.5, ice:0.5, earth:1, dark:1, wind:1.5 },
  earth:    { normal:1, fire:1, water:0.5, electric:1.5, grass:0.5, ice:1, earth:0.5, dark:1, wind:1.5 },
  dark:     { normal:1.5, fire:1, water:1, electric:1, grass:1, ice:1, earth:1, dark:0.5, wind:1 },
  wind:     { normal:1, fire:1, water:1, electric:0.5, grass:1.5, ice:0.5, earth:1, dark:1, wind:0.5 },
};

// Element passive effects applied on hit (for attacks/summons/equipment)
// fire: burn tile, electric: stun, grass: heal self, ice: ice tile, dark: poison, wind: pushback, water: remove buffs
const ELEMENT_ON_HIT = {
  fire:     'burn',      // leaves burn tile
  electric: 'stun',      // stuns target 0.8s
  grass:    'lifesteal',    // heals attacker 20% of damage
  ice:      'freeze',    // ice tile + slow
  dark:     'poison',    // applies 1 poison
  wind:     'pushback',  // pushes target
  water:    'cleanse_enemy', // removes target's boost/dodge
  earth:    'shield',    // grants 2 shield to self
};

function getElementMultiplier(atkElement, defElement) {
  return (ELEMENT_MATCHUPS[atkElement] && ELEMENT_MATCHUPS[atkElement][defElement]) || 1;
}

const CARD_DB = {
  // ── ATTACKS (atkCooldown: stronger attacks have longer cooldown) ──
  shuriken:       { id: 'shuriken',       name: 'Shuriken',       type: 'attack', element: 'normal',   damage: 3,  rarity: 'common',     sticker: '⭐', description: 'A swift shuriken throw', atkCooldown: 300 },
  kunai:          { id: 'kunai',          name: 'Kunai',          type: 'attack', element: 'normal',   damage: 5,  rarity: 'common',     sticker: '🗡️', description: 'A sharp kunai strike', atkCooldown: 500 },
  shadow_strike:  { id: 'shadow_strike',  name: 'Shadow Strike',  type: 'attack', element: 'dark',     damage: 6,  rarity: 'common',     sticker: '🌑', description: 'Strike from the shadows', melee: true, atkCooldown: 600 },
  wind_slash:     { id: 'wind_slash',     name: 'Wind Slash',     type: 'attack', element: 'wind',     damage: 7,  rarity: 'uncommon',   sticker: '🌪️', description: 'A cutting wind blade', melee: true, atkCooldown: 700 },
  fireball:       { id: 'fireball',       name: 'Fireball',       type: 'attack', element: 'fire',     damage: 8,  rarity: 'uncommon',   sticker: '🔥', description: 'Burns both enemy tiles', areaEffect: 'burn', hitscan: true, atkCooldown: 900 },
  poison_needle:  { id: 'poison_needle',  name: 'Poison Needle',  type: 'attack', element: 'dark',     damage: 4,  rarity: 'uncommon',   sticker: '💉', description: 'Poison puddle on hit', poison: 2, areaEffect: 'poison', atkCooldown: 500 },
  ice_shard:      { id: 'ice_shard',      name: 'Ice Shard',      type: 'attack', element: 'ice',      damage: 6,  rarity: 'uncommon',   sticker: '❄️', description: 'Ice path slides ninja', areaEffect: 'ice', atkCooldown: 700 },
  lightning_bolt: { id: 'lightning_bolt', name: 'Lightning Bolt', type: 'attack', element: 'electric', damage: 10, rarity: 'rare',       sticker: '⚡', description: 'Strikes with lightning', atkCooldown: 1200 },
  earth_spike:    { id: 'earth_spike',    name: 'Earth Spike',    type: 'attack', element: 'earth',    damage: 9,  rarity: 'rare',       sticker: '🪨', description: 'Erupts from the ground', atkCooldown: 1100 },
  dark_pulse:     { id: 'dark_pulse',     name: 'Dark Pulse',     type: 'attack', element: 'dark',     damage: 12, rarity: 'ultra_rare', sticker: '👁️', description: 'A wave of dark energy', atkCooldown: 1500 },
  water_jet:      { id: 'water_jet',      name: 'Water Jet',      type: 'attack', element: 'water',    damage: 7,  rarity: 'uncommon',   sticker: '💧', description: 'Pressurized water blast', atkCooldown: 700 },
  vine_whip:      { id: 'vine_whip',      name: 'Vine Whip',      type: 'attack', element: 'grass',    damage: 5,  rarity: 'common',     sticker: '🌿', description: 'Lashing vine strike', melee: true, atkCooldown: 500 },
  thunder_strike: { id: 'thunder_strike', name: 'Thunder Strike', type: 'attack', element: 'electric', damage: 8,  rarity: 'uncommon',   sticker: '🌩️', description: 'Shocking melee blow', melee: true, atkCooldown: 900 },
  flame_wave:     { id: 'flame_wave',     name: 'Flame Wave',     type: 'attack', element: 'fire',     damage: 6,  rarity: 'uncommon',   sticker: '🔥', description: 'Wave of fire', hitscan: true, atkCooldown: 700 },
  tidal_wave:     { id: 'tidal_wave',     name: 'Tidal Wave',     type: 'attack', element: 'water',    damage: 11, rarity: 'rare',       sticker: '🌊', description: 'Crashing water surge', hitscan: true, atkCooldown: 1400 },
  leaf_storm:     { id: 'leaf_storm',     name: 'Leaf Storm',     type: 'attack', element: 'grass',    damage: 9,  rarity: 'rare',       sticker: '🍃', description: 'Storm of razor leaves', atkCooldown: 1100 },

  // ── ITEMS (itemCooldown: stronger items add cooldown to C-slot) ──
  // Instant heals
  chakra_tea:     { id: 'chakra_tea',     name: 'Chakra Tea',     type: 'item', element: 'normal',   effect: 'heal',   value: 5,  rarity: 'common',     sticker: '🍵', description: '+5 HP', itemCooldown: 500 },
  heal_potion:    { id: 'heal_potion',    name: 'Heal Potion',    type: 'item', element: 'normal',   effect: 'heal',   value: 10, rarity: 'common',     sticker: '🧪', description: '+10 HP', itemCooldown: 1000 },
  mega_potion:    { id: 'mega_potion',    name: 'Mega Potion',    type: 'item', element: 'grass',    effect: 'heal',   value: 20, rarity: 'rare',       sticker: '✨', description: '+20 HP', itemCooldown: 2000 },
  // Regeneration items (heal over time)
  bandage:        { id: 'bandage',        name: 'Bandage',        type: 'item', element: 'normal',   effect: 'regen',  value: 2, duration: 5000,  rarity: 'common',     sticker: '🩹', description: '+2/s for 5s', itemCooldown: 800 },
  herbal_salve:   { id: 'herbal_salve',   name: 'Herbal Salve',   type: 'item', element: 'grass',    effect: 'regen',  value: 3, duration: 6000,  rarity: 'uncommon',   sticker: '🌿', sticker2: '💚', description: '+3/s for 6s', itemCooldown: 1500 },
  phoenix_balm:   { id: 'phoenix_balm',   name: 'Phoenix Balm',   type: 'item', element: 'fire',     effect: 'regen',  value: 5, duration: 8000,  rarity: 'rare',       sticker: '🔶', sticker2: '🔥', description: '+5/s for 8s', itemCooldown: 2500 },
  // Shields (now bubble: blocks all damage for a duration)
  shield_scroll:  { id: 'shield_scroll',  name: 'Shield Scroll',  type: 'item', element: 'normal',   effect: 'bubble', value: 2000,  rarity: 'common',     sticker: '📜', sticker2: '🛡️', description: '🛡️2s bubble', itemCooldown: 1000 },
  ice_armor:      { id: 'ice_armor',      name: 'Ice Armor',      type: 'item', element: 'ice',      effect: 'bubble', value: 4000,  rarity: 'rare',       sticker: '🧊', sticker2: '🛡️', description: '🛡️4s bubble', itemCooldown: 2000 },
  // Dodge
  smoke_bomb:     { id: 'smoke_bomb',     name: 'Smoke Bomb',     type: 'item', element: 'wind',     effect: 'dodge',  value: 1,  rarity: 'uncommon',   sticker: '💨', description: 'Dodge next hit', itemCooldown: 800 },
  // Boost
  power_pill:     { id: 'power_pill',     name: 'Power Pill',     type: 'item', element: 'normal',   effect: 'boost',  value: 4,  rarity: 'uncommon',   sticker: '💊', sticker2: '⚔️', description: '+4 ATK', itemCooldown: 600 },
  fire_elixir:    { id: 'fire_elixir',    name: 'Fire Elixir',    type: 'item', element: 'fire',     effect: 'boost',  value: 6,  rarity: 'rare',       sticker: '🧪', sticker2: '🔥', description: '+6 ATK', itemCooldown: 1000 },
  // Speed (now quickens cooldowns)
  speed_scroll:   { id: 'speed_scroll',   name: 'Speed Scroll',   type: 'item', element: 'wind',     effect: 'speed',  value: 5000, rarity: 'uncommon', sticker: '📜', sticker2: '💨', description: 'Fast CD 5s', itemCooldown: 800 },
  // AOE
  thunder_charm:  { id: 'thunder_charm',  name: 'Thunder Charm',  type: 'item', element: 'electric', effect: 'aoe',    value: 4,  rarity: 'rare',       sticker: '🔮', sticker2: '⚡', description: '⚡4 all summons', itemCooldown: 1200 },
  // Oils (imbue attacks with element for a duration)
  fire_oil:       { id: 'fire_oil',       name: 'Fire Oil',       type: 'item', element: 'fire',     effect: 'oil', oilElement: 'fire',     value: 8000, rarity: 'uncommon',   sticker: '🛢️', sticker2: '🔥', description: '🔥 imbue 8s', itemCooldown: 1000 },
  water_oil:      { id: 'water_oil',      name: 'Water Oil',      type: 'item', element: 'water',    effect: 'oil', oilElement: 'water',    value: 8000, rarity: 'uncommon',   sticker: '🛢️', sticker2: '💧', description: '💧 imbue 8s', itemCooldown: 1000 },
  electric_oil:   { id: 'electric_oil',   name: 'Electric Oil',   type: 'item', element: 'electric', effect: 'oil', oilElement: 'electric', value: 8000, rarity: 'uncommon',   sticker: '🛢️', sticker2: '⚡', description: '⚡ imbue 8s', itemCooldown: 1000 },
  ice_oil:        { id: 'ice_oil',        name: 'Ice Oil',        type: 'item', element: 'ice',      effect: 'oil', oilElement: 'ice',      value: 8000, rarity: 'uncommon',   sticker: '🛢️', sticker2: '❄️', description: '❄️ imbue 8s', itemCooldown: 1000 },
  dark_oil:       { id: 'dark_oil',       name: 'Dark Oil',       type: 'item', element: 'dark',     effect: 'oil', oilElement: 'dark',     value: 8000, rarity: 'uncommon',   sticker: '🛢️', sticker2: '🌑', description: '🌑 imbue 8s', itemCooldown: 1000 },
  // Food (gives a variety of stats)
  rice_ball:      { id: 'rice_ball',      name: 'Rice Ball',      type: 'item', element: 'normal',   effect: 'food', foodHp: 4, foodBoost: 1,  rarity: 'common',     sticker: '🍙', description: '+4 HP +1 ATK', itemCooldown: 600 },
  meat_skewer:    { id: 'meat_skewer',    name: 'Meat Skewer',    type: 'item', element: 'fire',     effect: 'food', foodHp: 3, foodBoost: 3,  rarity: 'uncommon',   sticker: '🍖', description: '+3 HP +3 ATK', itemCooldown: 800 },
  sushi_platter:  { id: 'sushi_platter',  name: 'Sushi Platter',  type: 'item', element: 'water',    effect: 'food', foodHp: 8, foodBoost: 2, foodSpeed: 3000, rarity: 'rare', sticker: '🍣', description: '+8 HP +2 ATK +Spd', itemCooldown: 1500 },
  golden_apple:   { id: 'golden_apple',   name: 'Golden Apple',   type: 'item', element: 'grass',    effect: 'food', foodHp: 6, foodMaxHp: 5,  rarity: 'rare',       sticker: '🍎', description: '+6 HP +5 maxHP', itemCooldown: 1500 },
  // Boss Transformation items (ultra_rare, drop from bosses)
  transform_shadow_fox:  { id: 'transform_shadow_fox',  name: 'Fox Spirit',      type: 'item', element: 'dark',     effect: 'transform', transformSprite: '🦊', transformElement: 'dark',     transformMaxHp: 10, rarity: 'ultra_rare', sticker: '🦊', description: 'Become Shadow Fox', itemCooldown: 0 },
  transform_mountain_dragon: { id: 'transform_mountain_dragon', name: 'Dragon Scale', type: 'item', element: 'fire', effect: 'transform', transformSprite: '🐉', transformElement: 'fire', transformMaxHp: 15, rarity: 'ultra_rare', sticker: '🐉', description: 'Become Mountain Dragon', itemCooldown: 0 },
  transform_hydra:       { id: 'transform_hydra',       name: 'Hydra Fang',      type: 'item', element: 'water',    effect: 'transform', transformSprite: '🐲', transformElement: 'water',    transformMaxHp: 15, rarity: 'ultra_rare', sticker: '🐲', description: 'Become Hydra', itemCooldown: 0 },
  transform_fire_lord:   { id: 'transform_fire_lord',   name: 'Inferno Core',    type: 'item', element: 'fire',     effect: 'transform', transformSprite: '👹', transformElement: 'fire',     transformMaxHp: 20, rarity: 'ultra_rare', sticker: '👹', description: 'Become Fire Lord', itemCooldown: 0 },
  transform_shadow_emperor: { id: 'transform_shadow_emperor', name: 'Emperor Soul', type: 'item', element: 'dark', effect: 'transform', transformSprite: '🫅', transformElement: 'dark', transformMaxHp: 20, rarity: 'ultra_rare', sticker: '🫅', description: 'Become Shadow Emperor', itemCooldown: 0 },

  // ── SUMMONS ──────────────────────────────────────────────
  snake:          { id: 'snake',          name: 'Snake',          type: 'summon', element: 'dark',     hp: 3,  atk: 2, atkSpeed: 1500, trophyPts: 1, rarity: 'common',     sticker: '🐍', description: 'Quick dark striker' },
  shadow_clone:   { id: 'shadow_clone',   name: 'Shadow Clone',   type: 'summon', element: 'normal',   hp: 5,  atk: 2, atkSpeed: 2000, trophyPts: 1, rarity: 'common',     sticker: '👥', description: 'Clone that fights' },
  hawk:           { id: 'hawk',           name: 'Hawk',           type: 'summon', element: 'wind',     hp: 3,  atk: 4, atkSpeed: 1800, trophyPts: 2, rarity: 'uncommon',   sticker: '🦅', description: 'Fast wind striker' },
  wolf:           { id: 'wolf',           name: 'Wolf',           type: 'summon', element: 'normal',   hp: 8,  atk: 3, atkSpeed: 2500, trophyPts: 2, rarity: 'uncommon',   sticker: '🐺', description: 'Loyal companion' },
  toad:           { id: 'toad',           name: 'Toad',           type: 'summon', element: 'water',    hp: 10, atk: 2, atkSpeed: 2500, trophyPts: 2, rarity: 'uncommon',   sticker: '🐸', description: 'Tanky water guardian' },
  earth_golem:    { id: 'earth_golem',    name: 'Earth Golem',    type: 'summon', element: 'earth',    hp: 15, atk: 2, atkSpeed: 3000, trophyPts: 3, rarity: 'rare',       sticker: '🗿', description: 'Slow but very tanky' },
  fire_spirit:    { id: 'fire_spirit',    name: 'Fire Spirit',    type: 'summon', element: 'fire',     hp: 4,  atk: 5, atkSpeed: 1500, trophyPts: 3, rarity: 'rare',       sticker: '👻', description: 'Fast fire attacker' },
  dragon_whelp:   { id: 'dragon_whelp',   name: 'Dragon Whelp',   type: 'summon', element: 'fire',     hp: 12, atk: 6, atkSpeed: 2000, trophyPts: 4, rarity: 'ultra_rare', sticker: '🐲', description: 'Baby dragon, fire' },
  frost_fox:      { id: 'frost_fox',      name: 'Frost Fox',      type: 'summon', element: 'ice',      hp: 6,  atk: 4, atkSpeed: 1600, trophyPts: 2, rarity: 'uncommon',   sticker: '🦊', description: 'Swift ice striker' },
  thunder_cat:    { id: 'thunder_cat',    name: 'Thunder Cat',    type: 'summon', element: 'electric', hp: 5,  atk: 5, atkSpeed: 1400, trophyPts: 3, rarity: 'rare',       sticker: '🐱', description: 'Fast shock attacks' },
  vine_creeper:   { id: 'vine_creeper',   name: 'Vine Creeper',   type: 'summon', element: 'grass',    hp: 8,  atk: 3, atkSpeed: 2200, trophyPts: 2, rarity: 'uncommon',   sticker: '🌱', description: 'Heals self on hit' },
  water_sprite:   { id: 'water_sprite',   name: 'Water Sprite',   type: 'summon', element: 'water',    hp: 7,  atk: 3, atkSpeed: 1800, trophyPts: 2, rarity: 'uncommon',   sticker: '🧜', description: 'Cleanses on attack' },

  // ── EQUIPMENT ────────────────────────────────────────────
  throwing_stars:  { id: 'throwing_stars',  name: 'Throwing Stars',  type: 'equipment', element: 'normal',   damage: 2, uses: 5, cooldown: 600,  rarity: 'common',   sticker: '🌟', description: '⚔2 ×5' },
  bamboo_shield:   { id: 'bamboo_shield',   name: 'Bamboo Shield',   type: 'equipment', element: 'normal',   effect: 'bubble', value: 1500, uses: 4, cooldown: 1200, rarity: 'common', sticker: '🎋', sticker2: '🛡️', description: '🛡️1.5s ×4' },
  katana:          { id: 'katana',          name: 'Katana',          type: 'equipment', element: 'normal',   damage: 4, uses: 3, cooldown: 1800, rarity: 'uncommon', sticker: '⚔️', description: '⚔4 ×3', melee: true },
  war_fan:         { id: 'war_fan',         name: 'War Fan',         type: 'equipment', element: 'wind',     damage: 3, uses: 3, cooldown: 1500, rarity: 'rare',     sticker: '🌀', sticker2: '💨', description: '⚔3+push ×3', pushback: true, melee: true },
  flame_kunai:     { id: 'flame_kunai',     name: 'Flame Kunai',     type: 'equipment', element: 'fire',     damage: 3, uses: 4, cooldown: 1000, rarity: 'uncommon', sticker: '�️', sticker2: '�🔥', description: '🔥3 ×4' },
  shock_gloves:    { id: 'shock_gloves',    name: 'Shock Gloves',    type: 'equipment', element: 'electric', damage: 3, uses: 3, cooldown: 1200, rarity: 'uncommon', sticker: '🧤', sticker2: '⚡', description: '⚡3+stun ×3', melee: true },
};

// ── Starter data ─────────────────────────────────────────────
const STARTER_COLLECTION = {
  shuriken: 4, kunai: 3, shadow_strike: 2, vine_whip: 2,
  chakra_tea: 4, heal_potion: 3, shield_scroll: 3, bandage: 2, rice_ball: 2,
  snake: 4, shadow_clone: 5,
  throwing_stars: 2, bamboo_shield: 2
};

const STARTER_DECK = {
  z: ['shuriken','shuriken','shuriken','kunai','kunai','shadow_strike','shadow_strike','vine_whip','throwing_stars','throwing_stars'],
  x: ['snake','snake','snake','snake','shadow_clone','shadow_clone','shadow_clone','shadow_clone','shadow_clone','shadow_clone'],
  c: ['chakra_tea','chakra_tea','chakra_tea','heal_potion','heal_potion','shield_scroll','shield_scroll','shield_scroll','bamboo_shield','bamboo_shield']
};

// ── Chapter & enemy data ─────────────────────────────────────
const CHAPTERS = [
  {
    id: 1, name: 'Forest Path', icon: '🌲',
    enemies: [
      { id:'ch1_e1', name:'Training Dummy', portrait:'🎯', hp:20, difficulty:0.2, element:'normal',
        deck:['shuriken','shuriken','shuriken','kunai','kunai','throwing_stars','snake','snake','snake','shadow_clone','shadow_clone','chakra_tea','chakra_tea','bandage','heal_potion','rice_ball','bamboo_shield'],
        reward:['kunai','wind_slash'] },
      { id:'ch1_e2', name:'Bandit Scout', portrait:'🗡️', hp:25, difficulty:0.3, element:'normal',
        deck:['kunai','kunai','kunai','shadow_strike','shadow_strike','throwing_stars','throwing_stars','snake','snake','shadow_clone','shadow_clone','hawk','chakra_tea','bandage','heal_potion','rice_ball','bamboo_shield'],
        reward:['shadow_strike','hawk'] },
      { id:'ch1_e3', name:'Vine Archer', portrait:'🏹', hp:25, difficulty:0.35, element:'grass',
        deck:['vine_whip','vine_whip','leaf_storm','kunai','wind_slash','throwing_stars','throwing_stars','vine_creeper','vine_creeper','hawk','snake','heal_potion','herbal_salve','shield_scroll','smoke_bomb','bamboo_shield'],
        reward:['vine_whip','vine_creeper'] },
      { id:'ch1_e4', name:'Bandit Chief', portrait:'⚔️', hp:30, difficulty:0.4, element:'normal',
        deck:['kunai','kunai','shadow_strike','shadow_strike','wind_slash','fireball','katana','wolf','wolf','shadow_clone','shadow_clone','heal_potion','rice_ball','shield_scroll','shield_scroll','smoke_bomb','power_pill'],
        reward:['fireball','wolf'] },
      { id:'ch1_boss', name:'Shadow Fox', portrait:'🦊', hp:35, difficulty:0.5, isBoss:true, element:'dark',
        deck:['shadow_strike','shadow_strike','dark_pulse','poison_needle','wind_slash','wind_slash','katana','katana','fire_spirit','wolf','snake','snake','smoke_bomb','smoke_bomb','heal_potion','dark_oil','power_pill','meat_skewer'],
        reward:['fire_spirit','power_pill','katana','transform_shadow_fox'] }
    ]
  },
  {
    id: 2, name: 'Mountain Pass', icon: '⛰️',
    enemies: [
      { id:'ch2_e1', name:'Mountain Monk', portrait:'🧘', hp:28, difficulty:0.4, element:'earth',
        deck:['earth_spike','earth_spike','kunai','shadow_strike','throwing_stars','earth_golem','toad','shadow_clone','shadow_clone','heal_potion','herbal_salve','mega_potion','shield_scroll','rice_ball','bamboo_shield','bamboo_shield'],
        reward:['mega_potion','toad'] },
      { id:'ch2_e2', name:'Eagle Warrior', portrait:'🦅', hp:30, difficulty:0.45, element:'wind',
        deck:['wind_slash','wind_slash','wind_slash','shadow_strike','shadow_strike','ice_shard','war_fan','throwing_stars','hawk','hawk','hawk','frost_fox','speed_scroll','heal_potion','meat_skewer','smoke_bomb'],
        reward:['speed_scroll','frost_fox'] },
      { id:'ch2_e3', name:'Stone Guard', portrait:'🛡️', hp:40, difficulty:0.5, element:'earth',
        deck:['earth_spike','earth_spike','earth_spike','kunai','kunai','bamboo_shield','bamboo_shield','earth_golem','earth_golem','toad','toad','heal_potion','bandage','mega_potion','shield_scroll','shield_scroll','ice_armor'],
        reward:['earth_golem','earth_spike'] },
      { id:'ch2_e4', name:'Storm Dancer', portrait:'💨', hp:28, difficulty:0.55, element:'electric',
        deck:['lightning_bolt','thunder_strike','thunder_strike','wind_slash','ice_shard','ice_shard','flame_kunai','throwing_stars','thunder_cat','hawk','frost_fox','snake','smoke_bomb','electric_oil','speed_scroll','speed_scroll','heal_potion'],
        reward:['thunder_strike','thunder_cat'] },
      { id:'ch2_boss', name:'Mountain Dragon', portrait:'🐉', hp:45, difficulty:0.6, isBoss:true, element:'fire',
        deck:['fireball','fireball','fireball','earth_spike','earth_spike','lightning_bolt','flame_wave','flame_kunai','dragon_whelp','earth_golem','fire_spirit','fire_spirit','wolf','mega_potion','phoenix_balm','fire_oil','power_pill','war_fan'],
        reward:['dragon_whelp','lightning_bolt','war_fan','transform_mountain_dragon'] }
    ]
  },
  {
    id: 3, name: 'Dark Swamp', icon: '🌿',
    enemies: [
      { id:'ch3_e1', name:'Swamp Frog', portrait:'🐸', hp:30, difficulty:0.5, element:'water',
        deck:['water_jet','water_jet','poison_needle','kunai','kunai','fireball','toad','toad','toad','water_sprite','snake','heal_potion','herbal_salve','shield_scroll','water_oil','bamboo_shield'],
        reward:['water_jet','water_sprite'] },
      { id:'ch3_e2', name:'Snake Charmer', portrait:'🐍', hp:28, difficulty:0.55, element:'dark',
        deck:['poison_needle','poison_needle','poison_needle','shadow_strike','shadow_strike','ice_shard','throwing_stars','snake','snake','snake','hawk','hawk','smoke_bomb','smoke_bomb','heal_potion','speed_scroll','dark_oil'],
        reward:['poison_needle','smoke_bomb'] },
      { id:'ch3_e3', name:'Mud Golem', portrait:'🗿', hp:45, difficulty:0.55, element:'earth',
        deck:['earth_spike','earth_spike','earth_spike','fireball','water_jet','bamboo_shield','bamboo_shield','bamboo_shield','earth_golem','earth_golem','earth_golem','toad','toad','heal_potion','mega_potion','golden_apple','shield_scroll'],
        reward:['earth_golem','mega_potion'] },
      { id:'ch3_e4', name:'Witch Doctor', portrait:'🧙', hp:32, difficulty:0.6, element:'dark',
        deck:['poison_needle','poison_needle','fireball','fireball','dark_pulse','lightning_bolt','fire_spirit','fire_spirit','shadow_clone','shadow_clone','thunder_charm','thunder_charm','heal_potion','sushi_platter','smoke_bomb','power_pill','dark_oil'],
        reward:['thunder_charm','dark_pulse'] },
      { id:'ch3_boss', name:'Hydra', portrait:'🐲', hp:50, difficulty:0.65, isBoss:true, element:'water',
        deck:['tidal_wave','tidal_wave','water_jet','water_jet','dark_pulse','dark_pulse','lightning_bolt','ice_shard','dragon_whelp','dragon_whelp','fire_spirit','water_sprite','water_sprite','mega_potion','phoenix_balm','water_oil','power_pill','smoke_bomb','katana','war_fan'],
        reward:['tidal_wave','dragon_whelp','ice_armor','transform_hydra'] }
    ]
  },
  {
    id: 4, name: 'Fire Temple', icon: '🔥',
    enemies: [
      { id:'ch4_e1', name:'Temple Guard', portrait:'⛩️', hp:35, difficulty:0.6, element:'fire',
        deck:['fireball','fireball','flame_wave','earth_spike','earth_spike','flame_kunai','earth_golem','earth_golem','wolf','wolf','shadow_clone','heal_potion','mega_potion','shield_scroll','fire_oil','bamboo_shield','power_pill'],
        reward:['flame_wave','flame_kunai'] },
      { id:'ch4_e2', name:'Fire Acolyte', portrait:'🔥', hp:30, difficulty:0.65, element:'fire',
        deck:['fireball','fireball','fireball','flame_wave','lightning_bolt','wind_slash','flame_kunai','fire_spirit','fire_spirit','fire_spirit','hawk','hawk','power_pill','fire_oil','heal_potion','meat_skewer','fire_elixir'],
        reward:['fire_spirit','fire_elixir'] },
      { id:'ch4_e3', name:'Flame Warrior', portrait:'🗡️', hp:35, difficulty:0.65, element:'fire',
        deck:['fireball','fireball','shadow_strike','shadow_strike','lightning_bolt','lightning_bolt','earth_spike','katana','flame_kunai','wolf','wolf','fire_spirit','shadow_clone','heal_potion','sushi_platter','power_pill','fire_oil','war_fan'],
        reward:['katana','power_pill'] },
      { id:'ch4_e4', name:'Lava Beast', portrait:'🌋', hp:50, difficulty:0.7, element:'fire',
        deck:['fireball','fireball','fireball','dark_pulse','dark_pulse','earth_spike','earth_spike','flame_wave','tidal_wave','dragon_whelp','earth_golem','earth_golem','fire_spirit','fire_spirit','mega_potion','phoenix_balm','power_pill','fire_elixir','flame_kunai','war_fan'],
        reward:['dark_pulse','dragon_whelp'] },
      { id:'ch4_boss', name:'Fire Lord', portrait:'👹', hp:55, difficulty:0.75, isBoss:true, element:'fire',
        deck:['dark_pulse','dark_pulse','dark_pulse','fireball','fireball','flame_wave','flame_wave','lightning_bolt','earth_spike','flame_kunai','dragon_whelp','dragon_whelp','fire_spirit','fire_spirit','fire_spirit','mega_potion','phoenix_balm','fire_elixir','fire_oil','war_fan'],
        reward:['dark_pulse','dragon_whelp','fire_spirit','transform_fire_lord'] }
    ]
  },
  {
    id: 5, name: 'Shadow Realm', icon: '🌑',
    enemies: [
      { id:'ch5_e1', name:'Shadow Scout', portrait:'👤', hp:35, difficulty:0.7, element:'dark',
        deck:['shadow_strike','shadow_strike','shadow_strike','dark_pulse','dark_pulse','ice_shard','ice_shard','shock_gloves','shadow_clone','shadow_clone','hawk','hawk','smoke_bomb','smoke_bomb','dark_oil','speed_scroll','heal_potion','meat_skewer'],
        reward:['shock_gloves','smoke_bomb'] },
      { id:'ch5_e2', name:'Dark Ninja', portrait:'🥷', hp:35, difficulty:0.75, element:'dark',
        deck:['shadow_strike','shadow_strike','dark_pulse','dark_pulse','lightning_bolt','thunder_strike','ice_shard','ice_shard','fireball','katana','fire_spirit','thunder_cat','shadow_clone','smoke_bomb','dark_oil','power_pill','ice_oil','sushi_platter','war_fan'],
        reward:['lightning_bolt','ice_shard'] },
      { id:'ch5_e3', name:'Void Walker', portrait:'👁️', hp:40, difficulty:0.8, element:'dark',
        deck:['dark_pulse','dark_pulse','dark_pulse','lightning_bolt','lightning_bolt','earth_spike','earth_spike','tidal_wave','fireball','leaf_storm','dragon_whelp','dragon_whelp','fire_spirit','earth_golem','mega_potion','golden_apple','power_pill','electric_oil','smoke_bomb','war_fan'],
        reward:['leaf_storm','mega_potion'] },
      { id:'ch5_e4', name:'Death Knight', portrait:'💀', hp:50, difficulty:0.85, element:'dark',
        deck:['dark_pulse','dark_pulse','dark_pulse','lightning_bolt','lightning_bolt','lightning_bolt','earth_spike','earth_spike','tidal_wave','ice_shard','ice_shard','dragon_whelp','dragon_whelp','earth_golem','earth_golem','thunder_cat','mega_potion','phoenix_balm','fire_elixir','war_fan'],
        reward:['dark_pulse','lightning_bolt'] },
      { id:'ch5_boss', name:'Shadow Emperor', portrait:'🫅', hp:60, difficulty:0.9, isBoss:true, element:'dark',
        deck:['dark_pulse','dark_pulse','dark_pulse','dark_pulse','lightning_bolt','lightning_bolt','lightning_bolt','tidal_wave','fireball','ice_shard','leaf_storm','earth_spike','dragon_whelp','dragon_whelp','dragon_whelp','thunder_cat','fire_spirit','mega_potion','phoenix_balm','fire_elixir','ice_armor','dark_oil','shock_gloves'],
        reward:['dragon_whelp','dark_pulse','war_fan','transform_shadow_emperor'] }
    ]
  }
];

// ── Utility ──────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardColor(type) {
  switch (type) {
    case 'attack':    return '#e94560';
    case 'item':      return '#2ecc71';
    case 'summon':    return '#3498db';
    case 'equipment': return '#f5a623';
    default:          return '#888';
  }
}

function elementColor(element) {
  return ELEMENTS[element] ? ELEMENTS[element].color : '#aaa';
}
function elementIcon(element) {
  return ELEMENTS[element] ? ELEMENTS[element].icon : '⚪';
}
function renderSticker(obj) {
  if (obj.sticker2) return `<span class="dual-sticker"><span class="sticker-base">${obj.sticker}</span><span class="sticker-over">${obj.sticker2}</span></span>`;
  return obj.sticker;
}
function elementName(element) {
  return ELEMENTS[element] ? ELEMENTS[element].name : 'Normal';
}

function rarityColor(rarity) {
  switch (rarity) {
    case 'common':    return '#aaa';
    case 'uncommon':  return '#2ecc71';
    case 'rare':      return '#3498db';
    case 'ultra_rare': return '#f5a623';
    default:          return '#aaa';
  }
}

function rollRewardCards(count) {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  const cardsByRarity = {};
  for (const id of Object.keys(CARD_DB)) {
    const r = CARD_DB[id].rarity;
    if (!cardsByRarity[r]) cardsByRarity[r] = [];
    cardsByRarity[r].push(id);
  }
  const rewards = [];
  for (let i = 0; i < count; i++) {
    let roll = Math.random() * totalWeight;
    let chosenRarity = 'common';
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
      roll -= weight;
      if (roll <= 0) { chosenRarity = rarity; break; }
    }
    const pool = cardsByRarity[chosenRarity] || cardsByRarity['common'];
    rewards.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return rewards;
}
