// ============================================================
// cards.js — Card database, chapter/enemy data, starter info
// ============================================================

const CARD_TYPES = { ATTACK: 'attack', ITEM: 'item', SUMMON: 'summon', EQUIPMENT: 'equipment' };

const RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, ultra_rare: 5 };

const CARD_DB = {
  // ── ATTACKS ──────────────────────────────────────────────
  shuriken:       { id: 'shuriken',       name: 'Shuriken',       type: 'attack', damage: 3,  rarity: 'common',     sticker: '⭐', description: 'A swift shuriken throw' },
  kunai:          { id: 'kunai',          name: 'Kunai',          type: 'attack', damage: 5,  rarity: 'common',     sticker: '🗡️', description: 'A sharp kunai strike' },
  shadow_strike:  { id: 'shadow_strike',  name: 'Shadow Strike',  type: 'attack', damage: 6,  rarity: 'common',     sticker: '🌑', description: 'Strike from the shadows', melee: true },
  wind_slash:     { id: 'wind_slash',     name: 'Wind Slash',     type: 'attack', damage: 7,  rarity: 'uncommon',   sticker: '🌪️', description: 'A cutting wind blade', melee: true },
  fireball:       { id: 'fireball',       name: 'Fireball',       type: 'attack', damage: 8,  rarity: 'uncommon',   sticker: '🔥', description: 'Burns both enemy tiles', areaEffect: 'burn', hitscan: true },
  poison_needle:  { id: 'poison_needle',  name: 'Poison Needle',  type: 'attack', damage: 4,  rarity: 'uncommon',   sticker: '💉', description: 'Poison puddle on hit', poison: 2, areaEffect: 'poison' },
  ice_shard:      { id: 'ice_shard',      name: 'Ice Shard',      type: 'attack', damage: 6,  rarity: 'uncommon',   sticker: '❄️', description: 'Ice path slides ninja', areaEffect: 'ice' },
  lightning_bolt: { id: 'lightning_bolt', name: 'Lightning Bolt', type: 'attack', damage: 10, rarity: 'rare',       sticker: '⚡', description: 'Strikes with lightning' },
  earth_spike:    { id: 'earth_spike',    name: 'Earth Spike',    type: 'attack', damage: 9,  rarity: 'rare',       sticker: '🪨', description: 'Erupts from the ground' },
  dark_pulse:     { id: 'dark_pulse',     name: 'Dark Pulse',     type: 'attack', damage: 12, rarity: 'ultra_rare', sticker: '👁️', description: 'A wave of dark energy' },

  // ── ITEMS ────────────────────────────────────────────────
  chakra_tea:     { id: 'chakra_tea',     name: 'Chakra Tea',     type: 'item', effect: 'heal',   value: 5,  rarity: 'common',     sticker: '🍵', description: 'Restores 5 HP' },
  heal_potion:    { id: 'heal_potion',    name: 'Heal Potion',    type: 'item', effect: 'heal',   value: 10, rarity: 'common',     sticker: '🧪', description: 'Restores 10 HP' },
  shield_scroll:  { id: 'shield_scroll',  name: 'Shield Scroll',  type: 'item', effect: 'shield', value: 5,  rarity: 'common',     sticker: '📜', description: 'Blocks next 5 damage' },
  smoke_bomb:     { id: 'smoke_bomb',     name: 'Smoke Bomb',     type: 'item', effect: 'dodge',  value: 1,  rarity: 'uncommon',   sticker: '💨', description: 'Dodge next attack' },
  power_pill:     { id: 'power_pill',     name: 'Power Pill',     type: 'item', effect: 'boost',  value: 4,  rarity: 'uncommon',   sticker: '💊', description: 'Next attack deals +4' },
  speed_scroll:   { id: 'speed_scroll',   name: 'Speed Scroll',   type: 'item', effect: 'speed',  value: 5000, rarity: 'uncommon', sticker: '🏃', description: 'Faster movement 5s' },
  mega_potion:    { id: 'mega_potion',    name: 'Mega Potion',    type: 'item', effect: 'heal',   value: 20, rarity: 'rare',       sticker: '✨', description: 'Restores 20 HP' },
  thunder_charm:  { id: 'thunder_charm',  name: 'Thunder Charm',  type: 'item', effect: 'aoe',    value: 4,  rarity: 'rare',       sticker: '🔮', description: 'Hits all enemy summons' },

  // ── SUMMONS ──────────────────────────────────────────────
  snake:          { id: 'snake',          name: 'Snake',          type: 'summon', hp: 3,  atk: 2, atkSpeed: 1500, rarity: 'common',     sticker: '🐍', description: 'Quick striking snake' },
  shadow_clone:   { id: 'shadow_clone',   name: 'Shadow Clone',   type: 'summon', hp: 5,  atk: 2, atkSpeed: 2000, rarity: 'common',     sticker: '👥', description: 'A clone that fights' },
  hawk:           { id: 'hawk',           name: 'Hawk',           type: 'summon', hp: 3,  atk: 4, atkSpeed: 1800, rarity: 'uncommon',   sticker: '🦅', description: 'Fast aerial striker' },
  wolf:           { id: 'wolf',           name: 'Wolf',           type: 'summon', hp: 8,  atk: 3, atkSpeed: 2500, rarity: 'uncommon',   sticker: '🐺', description: 'Loyal wolf companion' },
  toad:           { id: 'toad',           name: 'Toad',           type: 'summon', hp: 10, atk: 2, atkSpeed: 2500, rarity: 'uncommon',   sticker: '🐸', description: 'Tanky toad protector' },
  earth_golem:    { id: 'earth_golem',    name: 'Earth Golem',    type: 'summon', hp: 15, atk: 2, atkSpeed: 3000, rarity: 'rare',       sticker: '🗿', description: 'Slow but very tanky' },
  fire_spirit:    { id: 'fire_spirit',    name: 'Fire Spirit',    type: 'summon', hp: 4,  atk: 5, atkSpeed: 1500, rarity: 'rare',       sticker: '👻', description: 'Fast and fiery' },
  dragon_whelp:   { id: 'dragon_whelp',   name: 'Dragon Whelp',   type: 'summon', hp: 12, atk: 6, atkSpeed: 2000, rarity: 'ultra_rare', sticker: '🐲', description: 'A baby dragon' },

  // ── EQUIPMENT ────────────────────────────────────────────
  throwing_stars:  { id: 'throwing_stars',  name: 'Throwing Stars',  type: 'equipment', damage: 2, uses: 5, cooldown: 1000, rarity: 'common',   sticker: '🌟', description: '2 dmg, 5 uses' },
  bamboo_shield:   { id: 'bamboo_shield',   name: 'Bamboo Shield',   type: 'equipment', effect: 'block', value: 3, uses: 4, cooldown: 1500, rarity: 'common', sticker: '🎋', description: 'Block 3 dmg, 4 uses' },
  katana:          { id: 'katana',          name: 'Katana',          type: 'equipment', damage: 4, uses: 3, cooldown: 1500, rarity: 'uncommon', sticker: '⚔️', description: '4 dmg, 3 uses', melee: true },
  war_fan:         { id: 'war_fan',         name: 'War Fan',         type: 'equipment', damage: 3, uses: 3, cooldown: 2000, rarity: 'rare',     sticker: '🌀', description: '3 dmg + pushback, 3 uses', pushback: true, melee: true },
};

// ── Starter data ─────────────────────────────────────────────
const STARTER_COLLECTION = {
  shuriken: 4, kunai: 3, shadow_strike: 2, chakra_tea: 4,
  heal_potion: 3, shield_scroll: 3, snake: 5, shadow_clone: 5,
  throwing_stars: 2, bamboo_shield: 2
};

const STARTER_DECK = {
  z: ['shuriken','shuriken','shuriken','kunai','kunai','shadow_strike','shadow_strike','throwing_stars','throwing_stars','throwing_stars'],
  x: ['snake','snake','snake','snake','snake','shadow_clone','shadow_clone','shadow_clone','shadow_clone','shadow_clone'],
  c: ['chakra_tea','chakra_tea','chakra_tea','heal_potion','heal_potion','shield_scroll','shield_scroll','shield_scroll','bamboo_shield','bamboo_shield']
};

// ── Chapter & enemy data ─────────────────────────────────────
const CHAPTERS = [
  {
    id: 1, name: 'Forest Path', icon: '🌲',
    enemies: [
      { id:'ch1_e1', name:'Training Dummy', portrait:'🎯', hp:20, difficulty:0.2,
        deck:['shuriken','shuriken','shuriken','kunai','kunai','throwing_stars','snake','snake','snake','shadow_clone','shadow_clone','chakra_tea','chakra_tea','heal_potion','heal_potion','bamboo_shield','bamboo_shield'],
        reward:['kunai','wind_slash'] },
      { id:'ch1_e2', name:'Bandit Scout', portrait:'🗡️', hp:25, difficulty:0.3,
        deck:['kunai','kunai','kunai','shadow_strike','shadow_strike','throwing_stars','throwing_stars','snake','snake','shadow_clone','shadow_clone','hawk','chakra_tea','chakra_tea','heal_potion','heal_potion','bamboo_shield'],
        reward:['shadow_strike','hawk'] },
      { id:'ch1_e3', name:'Bandit Archer', portrait:'🏹', hp:25, difficulty:0.35,
        deck:['kunai','kunai','wind_slash','wind_slash','shadow_strike','throwing_stars','throwing_stars','hawk','hawk','snake','snake','heal_potion','heal_potion','shield_scroll','smoke_bomb','bamboo_shield'],
        reward:['wind_slash','smoke_bomb'] },
      { id:'ch1_e4', name:'Bandit Chief', portrait:'⚔️', hp:30, difficulty:0.4,
        deck:['kunai','kunai','shadow_strike','shadow_strike','wind_slash','fireball','katana','wolf','wolf','shadow_clone','shadow_clone','heal_potion','heal_potion','shield_scroll','shield_scroll','smoke_bomb','power_pill'],
        reward:['fireball','wolf'] },
      { id:'ch1_boss', name:'Shadow Fox', portrait:'🦊', hp:35, difficulty:0.5, isBoss:true,
        deck:['shadow_strike','shadow_strike','fireball','fireball','wind_slash','wind_slash','katana','katana','fire_spirit','wolf','shadow_clone','shadow_clone','smoke_bomb','smoke_bomb','heal_potion','heal_potion','power_pill','power_pill'],
        reward:['fire_spirit','power_pill','katana'] }
    ]
  },
  {
    id: 2, name: 'Mountain Pass', icon: '⛰️',
    enemies: [
      { id:'ch2_e1', name:'Mountain Monk', portrait:'🧘', hp:28, difficulty:0.4,
        deck:['kunai','kunai','earth_spike','shadow_strike','throwing_stars','toad','toad','shadow_clone','shadow_clone','heal_potion','heal_potion','mega_potion','shield_scroll','shield_scroll','bamboo_shield','bamboo_shield'],
        reward:['mega_potion','toad'] },
      { id:'ch2_e2', name:'Eagle Warrior', portrait:'🦅', hp:30, difficulty:0.45,
        deck:['wind_slash','wind_slash','wind_slash','shadow_strike','shadow_strike','ice_shard','throwing_stars','throwing_stars','hawk','hawk','hawk','fire_spirit','speed_scroll','heal_potion','heal_potion','smoke_bomb'],
        reward:['speed_scroll','hawk'] },
      { id:'ch2_e3', name:'Stone Guard', portrait:'🛡️', hp:40, difficulty:0.5,
        deck:['earth_spike','earth_spike','earth_spike','kunai','kunai','bamboo_shield','bamboo_shield','earth_golem','earth_golem','toad','toad','heal_potion','heal_potion','mega_potion','shield_scroll','shield_scroll','shield_scroll'],
        reward:['earth_golem','earth_spike'] },
      { id:'ch2_e4', name:'Wind Dancer', portrait:'💨', hp:28, difficulty:0.55,
        deck:['wind_slash','wind_slash','shadow_strike','shadow_strike','ice_shard','ice_shard','fireball','throwing_stars','hawk','hawk','fire_spirit','snake','smoke_bomb','smoke_bomb','speed_scroll','speed_scroll','heal_potion'],
        reward:['ice_shard','war_fan'] },
      { id:'ch2_boss', name:'Mountain Dragon', portrait:'🐉', hp:45, difficulty:0.6, isBoss:true,
        deck:['fireball','fireball','fireball','earth_spike','earth_spike','lightning_bolt','ice_shard','katana','dragon_whelp','earth_golem','fire_spirit','fire_spirit','wolf','mega_potion','mega_potion','power_pill','power_pill','war_fan'],
        reward:['dragon_whelp','lightning_bolt','war_fan'] }
    ]
  },
  {
    id: 3, name: 'Dark Swamp', icon: '🌿',
    enemies: [
      { id:'ch3_e1', name:'Swamp Frog', portrait:'🐸', hp:30, difficulty:0.5,
        deck:['poison_needle','poison_needle','poison_needle','kunai','kunai','fireball','toad','toad','toad','snake','snake','heal_potion','heal_potion','shield_scroll','shield_scroll','bamboo_shield'],
        reward:['poison_needle','toad'] },
      { id:'ch3_e2', name:'Snake Charmer', portrait:'🐍', hp:28, difficulty:0.55,
        deck:['poison_needle','poison_needle','poison_needle','shadow_strike','shadow_strike','ice_shard','throwing_stars','snake','snake','snake','hawk','hawk','smoke_bomb','smoke_bomb','heal_potion','speed_scroll','thunder_charm'],
        reward:['poison_needle','smoke_bomb'] },
      { id:'ch3_e3', name:'Mud Golem', portrait:'🗿', hp:45, difficulty:0.55,
        deck:['earth_spike','earth_spike','earth_spike','fireball','kunai','bamboo_shield','bamboo_shield','bamboo_shield','earth_golem','earth_golem','earth_golem','toad','toad','heal_potion','mega_potion','mega_potion','shield_scroll'],
        reward:['earth_golem','mega_potion'] },
      { id:'ch3_e4', name:'Witch Doctor', portrait:'🧙', hp:32, difficulty:0.6,
        deck:['poison_needle','poison_needle','fireball','fireball','dark_pulse','lightning_bolt','fire_spirit','fire_spirit','shadow_clone','shadow_clone','thunder_charm','thunder_charm','heal_potion','mega_potion','smoke_bomb','power_pill','power_pill'],
        reward:['thunder_charm','dark_pulse'] },
      { id:'ch3_boss', name:'Hydra', portrait:'🐲', hp:50, difficulty:0.65, isBoss:true,
        deck:['poison_needle','poison_needle','fireball','fireball','dark_pulse','dark_pulse','lightning_bolt','ice_shard','dragon_whelp','dragon_whelp','fire_spirit','earth_golem','wolf','mega_potion','mega_potion','power_pill','power_pill','smoke_bomb','katana','war_fan'],
        reward:['dragon_whelp','dark_pulse','mega_potion'] }
    ]
  },
  {
    id: 4, name: 'Fire Temple', icon: '🔥',
    enemies: [
      { id:'ch4_e1', name:'Temple Guard', portrait:'⛩️', hp:35, difficulty:0.6,
        deck:['fireball','fireball','fireball','earth_spike','earth_spike','katana','earth_golem','earth_golem','wolf','wolf','shadow_clone','heal_potion','mega_potion','shield_scroll','shield_scroll','bamboo_shield','power_pill'],
        reward:['fireball','earth_golem'] },
      { id:'ch4_e2', name:'Fire Acolyte', portrait:'🔥', hp:30, difficulty:0.65,
        deck:['fireball','fireball','fireball','lightning_bolt','wind_slash','wind_slash','katana','fire_spirit','fire_spirit','fire_spirit','hawk','hawk','power_pill','power_pill','heal_potion','mega_potion','smoke_bomb'],
        reward:['fire_spirit','lightning_bolt'] },
      { id:'ch4_e3', name:'Flame Warrior', portrait:'🗡️', hp:35, difficulty:0.65,
        deck:['fireball','fireball','shadow_strike','shadow_strike','lightning_bolt','lightning_bolt','earth_spike','katana','katana','wolf','wolf','fire_spirit','shadow_clone','heal_potion','mega_potion','power_pill','power_pill','war_fan'],
        reward:['katana','power_pill'] },
      { id:'ch4_e4', name:'Lava Beast', portrait:'🌋', hp:50, difficulty:0.7,
        deck:['fireball','fireball','fireball','dark_pulse','dark_pulse','earth_spike','earth_spike','lightning_bolt','ice_shard','dragon_whelp','earth_golem','earth_golem','fire_spirit','fire_spirit','mega_potion','mega_potion','power_pill','power_pill','katana','war_fan'],
        reward:['dark_pulse','dragon_whelp'] },
      { id:'ch4_boss', name:'Fire Lord', portrait:'👹', hp:55, difficulty:0.75, isBoss:true,
        deck:['dark_pulse','dark_pulse','dark_pulse','fireball','fireball','lightning_bolt','lightning_bolt','earth_spike','ice_shard','katana','dragon_whelp','dragon_whelp','fire_spirit','fire_spirit','fire_spirit','mega_potion','mega_potion','power_pill','power_pill','war_fan'],
        reward:['dark_pulse','dragon_whelp','fire_spirit'] }
    ]
  },
  {
    id: 5, name: 'Shadow Realm', icon: '🌑',
    enemies: [
      { id:'ch5_e1', name:'Shadow Scout', portrait:'👤', hp:35, difficulty:0.7,
        deck:['shadow_strike','shadow_strike','shadow_strike','dark_pulse','dark_pulse','ice_shard','ice_shard','throwing_stars','shadow_clone','shadow_clone','hawk','hawk','smoke_bomb','smoke_bomb','smoke_bomb','speed_scroll','heal_potion','mega_potion'],
        reward:['shadow_strike','smoke_bomb'] },
      { id:'ch5_e2', name:'Dark Ninja', portrait:'🥷', hp:35, difficulty:0.75,
        deck:['shadow_strike','shadow_strike','dark_pulse','dark_pulse','lightning_bolt','lightning_bolt','ice_shard','ice_shard','fireball','katana','fire_spirit','fire_spirit','shadow_clone','smoke_bomb','smoke_bomb','power_pill','power_pill','mega_potion','war_fan'],
        reward:['lightning_bolt','ice_shard'] },
      { id:'ch5_e3', name:'Void Walker', portrait:'👁️', hp:40, difficulty:0.8,
        deck:['dark_pulse','dark_pulse','dark_pulse','lightning_bolt','lightning_bolt','earth_spike','earth_spike','fireball','fireball','ice_shard','dragon_whelp','dragon_whelp','fire_spirit','earth_golem','mega_potion','mega_potion','power_pill','power_pill','smoke_bomb','war_fan'],
        reward:['earth_spike','mega_potion'] },
      { id:'ch5_e4', name:'Death Knight', portrait:'💀', hp:50, difficulty:0.85,
        deck:['dark_pulse','dark_pulse','dark_pulse','lightning_bolt','lightning_bolt','lightning_bolt','earth_spike','earth_spike','fireball','ice_shard','ice_shard','dragon_whelp','dragon_whelp','earth_golem','earth_golem','fire_spirit','mega_potion','mega_potion','power_pill','war_fan'],
        reward:['dark_pulse','lightning_bolt'] },
      { id:'ch5_boss', name:'Shadow Emperor', portrait:'🫅', hp:60, difficulty:0.9, isBoss:true,
        deck:['dark_pulse','dark_pulse','dark_pulse','dark_pulse','lightning_bolt','lightning_bolt','lightning_bolt','fireball','fireball','ice_shard','ice_shard','earth_spike','dragon_whelp','dragon_whelp','dragon_whelp','fire_spirit','fire_spirit','mega_potion','mega_potion','power_pill','power_pill','war_fan','war_fan'],
        reward:['dragon_whelp','dark_pulse','war_fan'] }
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
