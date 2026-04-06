// ============================================================
// game.js — Core gameplay logic, rendering, input
// ============================================================

class Game {
  constructor(playerDecks, enemyData, onEnd) {
    this.onEnd = onEnd;
    this.enemyData = enemyData;

    // ── Ninjas ───────────────────────────────────────────────
    this.playerNinja = { col: 1, hp: 30, maxHp: 30, shield: 0, boost: 0, dodge: false, poison: 0, speedTimer: 0, stunTimer: 0 };
    this.cpuNinja    = { col: 2, hp: enemyData.hp, maxHp: enemyData.hp, shield: 0, boost: 0, dodge: false, poison: 0, speedTimer: 0, stunTimer: 0 };

    // Previous HP for flash effects
    this._prevPlayerHp = 30;
    this._prevCpuHp = enemyData.hp;

    // Per-cell sprite animations { 'r,c': { cls, time } }
    this._cellAnims = {};

    // ── 3 Decks per side (Z=attack, X=summon, C=item) ────────
    this.playerDeckZ = shuffleArray(playerDecks.z);
    this.playerDeckX = shuffleArray(playerDecks.x);
    this.playerDeckC = shuffleArray(playerDecks.c);

    // CPU: split enemy deck by card type
    const cpuZ = [], cpuX = [], cpuC = [];
    for (const id of enemyData.deck) {
      const card = CARD_DB[id];
      if (!card) continue;
      if (card.type === 'attack' || (card.type === 'equipment' && card.damage)) cpuZ.push(id);
      else if (card.type === 'summon') cpuX.push(id);
      else cpuC.push(id);
    }
    this.cpuDeckZ = shuffleArray(cpuZ);
    this.cpuDeckX = shuffleArray(cpuX);
    this.cpuDeckC = shuffleArray(cpuC);

    // ── Hands: slot 0=Z(atk), slot 1=X(summon), slot 2=C(item)
    this.playerHand = [this._emptySlot(), this._emptySlot(), this._emptySlot()];
    this.cpuHand    = [this._emptySlot(), this._emptySlot(), this._emptySlot()];

    // ── Grid 4×4: [row][col] ─────────────────────────────────
    this.grid = [[null,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]];

    // ── Discard piles per deck type ──────────────────────────
    this.playerDiscardZ = [];
    this.playerDiscardX = [];
    this.playerDiscardC = [];
    this.cpuDiscardZ = [];
    this.cpuDiscardX = [];
    this.cpuDiscardC = [];

    // ── Active effects ───────────────────────────────────────
    this.projectiles   = [];
    this.floatingTexts = [];
    this.slashArcs     = [];
    this.tileEffects   = [];  // { col, row, type:'burn'|'poison'|'ice', life, tickTimer }

    // ── Timers ───────────────────────────────────────────────
    this.poisonTimer = 0;
    this.running  = false;
    this.paused   = false;
    this.lastTime = 0;
    this.elapsed  = 0;

    // ── Input state ──────────────────────────────────────────
    this.moveCD = 0;
    this.baseMoveCD = 150;

    // ── CPU AI ───────────────────────────────────────────────
    this.cpu = new CpuAI(this, enemyData.difficulty);

    // ── DOM refs (set in buildDOM) ───────────────────────────
    this.el = {};
  }

  // ── Helpers ────────────────────────────────────────────────
  _emptySlot() { return { card: null, state: 'drawing', timer: 0, usesLeft: 0 }; }

  _drawFromDeck(deck, discard) {
    if (deck.length === 0 && discard && discard.length > 0) {
      deck.push(...shuffleArray(discard));
      discard.length = 0;
    }
    if (deck.length === 0) return null;
    const id = deck.pop();
    return { ...CARD_DB[id] };
  }

  _getDecksForSlot(slotIdx, isPlayer) {
    if (isPlayer) {
      if (slotIdx === 0) return { deck: this.playerDeckZ, discard: this.playerDiscardZ };
      if (slotIdx === 1) return { deck: this.playerDeckX, discard: this.playerDiscardX };
      return { deck: this.playerDeckC, discard: this.playerDiscardC };
    } else {
      if (slotIdx === 0) return { deck: this.cpuDeckZ, discard: this.cpuDiscardZ };
      if (slotIdx === 1) return { deck: this.cpuDeckX, discard: this.cpuDiscardX };
      return { deck: this.cpuDeckC, discard: this.cpuDiscardC };
    }
  }

  // ════════════════════════════════════════════════════════════
  //  DOM BUILDING
  // ════════════════════════════════════════════════════════════
  buildDOM() {
    const screen = document.getElementById('screen-game');
    screen.innerHTML = '';

    // Container
    const wrap = document.createElement('div');
    wrap.id = 'game-wrap';

    // CPU info bar
    const cpuBar = document.createElement('div');
    cpuBar.className = 'info-bar cpu-bar';
    cpuBar.innerHTML = `
      <span class="ninja-label enemy-color">${this.enemyData.portrait} ${this.enemyData.name}</span>
      <span class="hp-wrap"><span class="hp-bar enemy-hp" id="cpu-hp-bar"></span><span id="cpu-hp-text" class="hp-text"></span></span>
      <span class="deck-count" id="cpu-deck-count"></span>
    `;
    wrap.appendChild(cpuBar);

    // Grid
    const gridDiv = document.createElement('div');
    gridDiv.id = 'game-grid';
    this.el.cells = [];
    for (let r = 0; r < 4; r++) {
      this.el.cells[r] = [];
      for (let c = 0; c < 4; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        // Click-to-move: clicking a cell in the player row moves there
        cell.addEventListener('click', () => this._onCellClick(+cell.dataset.row, +cell.dataset.col));
        gridDiv.appendChild(cell);
        this.el.cells[r][c] = cell;
      }
    }
    wrap.appendChild(gridDiv);

    // Projectile overlay
    const projLayer = document.createElement('div');
    projLayer.id = 'proj-layer';
    wrap.appendChild(projLayer);
    this.el.projLayer = projLayer;

    // Floating text layer
    const ftLayer = document.createElement('div');
    ftLayer.id = 'ft-layer';
    wrap.appendChild(ftLayer);
    this.el.ftLayer = ftLayer;

    // Player info bar
    const plrBar = document.createElement('div');
    plrBar.className = 'info-bar player-bar';
    plrBar.innerHTML = `
      <span class="ninja-label player-color">🥷 You</span>
      <span class="hp-wrap"><span class="hp-bar player-hp" id="plr-hp-bar"></span><span id="plr-hp-text" class="hp-text"></span></span>
      <span class="deck-count" id="plr-deck-count"></span>
    `;
    wrap.appendChild(plrBar);

    // Hand area
    const handDiv = document.createElement('div');
    handDiv.id = 'hand-area';
    this.el.handSlots = [];
    const keys = ['Z', 'X', 'C'];
    for (let i = 0; i < 3; i++) {
      const slot = document.createElement('div');
      slot.className = 'hand-slot';
      slot.dataset.index = i;
      slot.innerHTML = `<div class="hand-key">${keys[i]}</div><div class="hand-card-inner"></div>`;
      // Tap to play card on mobile
      slot.addEventListener('click', () => this.playCard(i));
      handDiv.appendChild(slot);
      this.el.handSlots[i] = slot;
    }
    wrap.appendChild(handDiv);

    // Mobile move buttons
    const mobileControls = document.createElement('div');
    mobileControls.id = 'mobile-controls';
    mobileControls.innerHTML = `
      <button class="mobile-btn mobile-left" id="btn-move-left">◀</button>
      <span class="mobile-hint">Tap grid or cards</span>
      <button class="mobile-btn mobile-right" id="btn-move-right">▶</button>
    `;
    wrap.appendChild(mobileControls);

    // Mobile button handlers
    document.getElementById('btn-move-left').addEventListener('click', () => this.movePlayer(-1));
    document.getElementById('btn-move-right').addEventListener('click', () => this.movePlayer(1));

    // Controls hint
    const hint = document.createElement('div');
    hint.id = 'controls-hint';
    hint.textContent = '← A / D → Move   |   Z  X  C  Play Cards   |   Click grid to move';
    wrap.appendChild(hint);

    screen.appendChild(wrap);

    // Cache more refs
    this.el.cpuHpBar  = document.getElementById('cpu-hp-bar');
    this.el.cpuHpText = document.getElementById('cpu-hp-text');
    this.el.plrHpBar  = document.getElementById('plr-hp-bar');
    this.el.plrHpText = document.getElementById('plr-hp-text');
    this.el.cpuDeck   = document.getElementById('cpu-deck-count');
    this.el.plrDeck   = document.getElementById('plr-deck-count');
    this.el.grid      = gridDiv;
    this.el.wrap      = wrap;
  }

  // ════════════════════════════════════════════════════════════
  //  GAME LIFECYCLE
  // ════════════════════════════════════════════════════════════
  start() {
    this.buildDOM();

    // Draw initial hands (each slot from its own deck)
    for (let i = 0; i < 3; i++) {
      const pSlot = this._getDecksForSlot(i, true);
      this.playerHand[i].card  = this._drawFromDeck(pSlot.deck, pSlot.discard);
      this.playerHand[i].state = this.playerHand[i].card ? 'ready' : 'empty';
      const cSlot = this._getDecksForSlot(i, false);
      this.cpuHand[i].card     = this._drawFromDeck(cSlot.deck, cSlot.discard);
      this.cpuHand[i].state    = this.cpuHand[i].card ? 'ready' : 'empty';
    }

    this.running  = true;
    this.lastTime = performance.now();
    this._boundKey = (e) => this._onKey(e);
    document.addEventListener('keydown', this._boundKey);
    this._raf = requestAnimationFrame((t) => this._loop(t));
    this.render();
  }

  stop() {
    this.running = false;
    document.removeEventListener('keydown', this._boundKey);
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min(timestamp - this.lastTime, 100); // cap delta
    this.lastTime = timestamp;
    if (!this.paused) {
      this.elapsed += dt;
      this.update(dt);
      this.render();
    }
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  // ════════════════════════════════════════════════════════════
  //  UPDATE
  // ════════════════════════════════════════════════════════════
  update(dt) {
    this.moveCD = Math.max(0, this.moveCD - dt);

    // Speed buff timer
    if (this.playerNinja.speedTimer > 0) this.playerNinja.speedTimer -= dt;

    // Stun timers
    if (this.playerNinja.stunTimer > 0) this.playerNinja.stunTimer -= dt;
    if (this.cpuNinja.stunTimer > 0) this.cpuNinja.stunTimer -= dt;

    // Hand cooldowns / draws
    this._updateHandSlots(this.playerHand, true, dt);
    this._updateHandSlots(this.cpuHand, false, dt);

    // CPU AI
    this.cpu.update(dt);

    // Projectiles
    this._updateProjectiles(dt);

    // Summon auto-attacks
    this._updateSummons(dt);

    // Slash arc visuals
    this._updateSlashArcs(dt);

    // Tile effects (burn, poison, ice)
    this._updateTileEffects(dt);

    // Cell sprite animations
    for (const key in this._cellAnims) {
      this._cellAnims[key].time -= dt;
      if (this._cellAnims[key].time <= 0) delete this._cellAnims[key];
    }

    // Poison tick
    this.poisonTimer += dt;
    if (this.poisonTimer >= 1000) {
      this.poisonTimer -= 1000;
      if (this.playerNinja.poison > 0) {
        this._damageNinja(true, this.playerNinja.poison);
        this.playerNinja.poison = Math.max(0, this.playerNinja.poison - 1);
      }
      if (this.cpuNinja.poison > 0) {
        this._damageNinja(false, this.cpuNinja.poison);
        this.cpuNinja.poison = Math.max(0, this.cpuNinja.poison - 1);
      }
    }

    // Floating texts
    this._updateFloatingTexts(dt);

    // Win/lose check
    if (this.playerNinja.hp <= 0 && this.running) { this._endGame(false); }
    if (this.cpuNinja.hp   <= 0 && this.running) { this._endGame(true);  }
  }

  _updateHandSlots(hand, isPlayer, dt) {
    for (let i = 0; i < 3; i++) {
      const s = hand[i];
      if (s.state === 'drawing') {
        s.timer -= dt;
        if (s.timer <= 0) {
          const { deck, discard } = this._getDecksForSlot(i, isPlayer);
          s.card = this._drawFromDeck(deck, discard);
          s.state = s.card ? 'ready' : 'empty';
          s.timer = 0;
        }
      } else if (s.state === 'cooldown') {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.state = 'ready';
          s.timer = 0;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  INPUT
  // ════════════════════════════════════════════════════════════
  _onKey(e) {
    if (!this.running || this.paused) return;
    const key = e.key.toLowerCase();
    const code = e.code;

    // Movement
    if (key === 'a' || code === 'ArrowLeft')  { this.movePlayer(-1); e.preventDefault(); }
    if (key === 'd' || code === 'ArrowRight') { this.movePlayer(1);  e.preventDefault(); }

    // Card play
    if (key === 'z') { this.playCard(0); e.preventDefault(); }
    if (key === 'x') { this.playCard(1); e.preventDefault(); }
    if (key === 'c') { this.playCard(2); e.preventDefault(); }
  }

  movePlayer(dir) {
    const cd = this.playerNinja.speedTimer > 0 ? this.baseMoveCD * 0.5 : this.baseMoveCD;
    if (this.moveCD > 0) return;
    const newCol = this.playerNinja.col + dir;
    if (newCol >= 0 && newCol <= 3) {
      this.playerNinja.col = newCol;
      this.moveCD = cd;
      // Ice slide: if stepping onto ice tile, keep sliding in same direction
      this._checkIceSlide(this.playerNinja, 3, dir);
    }
  }

  // Click on grid cell to move player there (row 3 only, adjacent cells)
  _onCellClick(row, col) {
    if (!this.running || this.paused) return;
    // Only respond to clicks on the player row (row 3)
    if (row !== 3) return;
    const diff = col - this.playerNinja.col;
    if (diff === 0) return;
    // Move one step toward the clicked column
    this.movePlayer(diff > 0 ? 1 : -1);
  }

  moveCpu(dir) {
    const newCol = this.cpuNinja.col + dir;
    if (newCol >= 0 && newCol <= 3) {
      this.cpuNinja.col = newCol;
      this._checkIceSlide(this.cpuNinja, 0, dir);
    }
  }

  _checkIceSlide(ninja, row, dir) {
    const ice = this.tileEffects.find(t => t.type === 'ice' && t.row === row && t.col === ninja.col);
    if (ice) {
      const next = ninja.col + dir;
      if (next >= 0 && next <= 3) {
        ninja.col = next;
        this._spawnText('❄️Slide!', row, ninja.col, '#87ceeb');
        // Chain slide if next tile is also ice
        this._checkIceSlide(ninja, row, dir);
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  CARD PLAY (Player)
  // ════════════════════════════════════════════════════════════
  playCard(slot) {
    if (this.playerNinja.stunTimer > 0) return;
    const s = this.playerHand[slot];
    if (!s.card || s.state !== 'ready') return;

    const card = s.card;
    const col  = this.playerNinja.col;

    switch (card.type) {
      case 'attack':
        this._executeAttack(card, col, true);
        this._consumeSlot(s, slot, true);
        // Sprite lunge on player ninja
        this._triggerCellAnim(3, col, 'sprite-atk', 300);
        break;
      case 'item':
        this._executeItem(card, true);
        this._consumeSlot(s, slot, true);
        break;
      case 'summon':
        if (this._executeSummon(card, col, true)) {
          this._consumeSlot(s, slot, true);
        }
        break;
      case 'equipment':
        this._executeEquipment(card, col, true);
        // Equipment stays in hand
        s.usesLeft--;
        if (s.usesLeft <= 0) {
          this._consumeSlot(s, slot, true);
        } else {
          s.state = 'cooldown';
          s.timer = card.cooldown;
        }
        break;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  CARD PLAY (CPU)
  // ════════════════════════════════════════════════════════════
  cpuPlayCard(slot) {
    const s = this.cpuHand[slot];
    if (!s.card || s.state !== 'ready') return;

    const card = s.card;
    const col  = this.cpuNinja.col;

    switch (card.type) {
      case 'attack':
        this._executeAttack(card, col, false);
        this._consumeSlot(s, slot, false);
        // Sprite lunge on CPU ninja
        this._triggerCellAnim(0, col, 'sprite-atk', 300);
        break;
      case 'item':
        this._executeItem(card, false);
        this._consumeSlot(s, slot, false);
        break;
      case 'summon':
        // CPU tries current col, then any open col
        if (!this._executeSummon(card, col, false)) {
          for (let c = 0; c < 4; c++) {
            if (this._executeSummon(card, c, false)) break;
          }
        }
        this._consumeSlot(s, slot, false);
        break;
      case 'equipment':
        this._executeEquipment(card, col, false);
        s.usesLeft--;
        if (s.usesLeft <= 0) {
          this._consumeSlot(s, slot, false);
        } else {
          s.state = 'cooldown';
          s.timer = card.cooldown;
        }
        break;
    }
  }

  _consumeSlot(s, slotIdx, isPlayer) {
    if (s.card) {
      const { discard } = this._getDecksForSlot(slotIdx, isPlayer);
      discard.push(s.card.id);
    }
    s.card  = null;
    s.state = 'drawing';
    s.timer = 2000;
    s.usesLeft = 0;
  }

  // ════════════════════════════════════════════════════════════
  //  CARD EFFECTS
  // ════════════════════════════════════════════════════════════

  // ── Attack: melee (hitscan) or projectile ──────────────────
  _executeAttack(card, col, isPlayer) {
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    let dmg = card.damage;
    if (ninja.boost > 0) { dmg += ninja.boost; ninja.boost = 0; }
    if (card.melee) {
      this._executeMeleeHit(dmg, col, isPlayer, card.poison || 0, card.pushback || false);
    } else if (card.hitscan) {
      this._executeHitscanAttack(dmg, col, isPlayer, card);
    } else {
      this.projectiles.push({
        col: col,
        y: isPlayer ? 3 : 0,
        dir: isPlayer ? -1 : 1,
        damage: dmg,
        isPlayer: isPlayer,
        speed: 4.5,
        poison: card.poison || 0,
        pushback: card.pushback || false,
        areaEffect: card.areaEffect || null
      });
    }
  }

  // ── Hitscan: instant hit on both enemy rows + tile effects ──
  _executeHitscanAttack(dmg, col, isPlayer, card) {
    const summonRow = isPlayer ? 1 : 2;
    const ninjaRow  = isPlayer ? 0 : 3;
    const targetNinja = isPlayer ? this.cpuNinja : this.playerNinja;

    // Hit summon in that column
    if (this.grid[summonRow][col]) {
      this._damageSummon(summonRow, col, dmg);
    }
    // Hit ninja if in that column
    if (col === targetNinja.col) {
      this._damageNinja(!isPlayer, dmg);
      if (card.poison) targetNinja.poison += card.poison;
    }
    // Spawn tile effects on both enemy rows
    if (card.areaEffect) {
      this._spawnTileEffect(card.areaEffect, summonRow, col);
      this._spawnTileEffect(card.areaEffect, ninjaRow, col);
    }
  }

  // ── Melee hitscan: instant damage + stun + slash arc ───────
  _executeMeleeHit(dmg, col, isPlayer, poison, pushback) {
    let hitRow = isPlayer ? 1 : 2;
    if (isPlayer) {
      if (this.grid[1][col]) {
        this._damageSummon(1, col, dmg);
        if (this.grid[1][col]) this.grid[1][col].stunTimer = 600;
        hitRow = 1;
      } else if (col === this.cpuNinja.col) {
        this._damageNinja(false, dmg);
        if (poison) this.cpuNinja.poison += poison;
        if (pushback) { const dir = this.cpuNinja.col <= 1 ? 1 : -1; this.moveCpu(dir); }
        this.cpuNinja.stunTimer = 600;
        hitRow = 0;
      }
    } else {
      if (this.grid[2][col]) {
        this._damageSummon(2, col, dmg);
        if (this.grid[2][col]) this.grid[2][col].stunTimer = 600;
        hitRow = 2;
      } else if (col === this.playerNinja.col) {
        this._damageNinja(true, dmg);
        if (poison) this.playerNinja.poison += poison;
        if (pushback) { const dir = this.playerNinja.col <= 1 ? 1 : -1; this.movePlayer(dir); }
        this.playerNinja.stunTimer = 600;
        hitRow = 3;
      }
    }
    this.slashArcs.push({ col, row: hitRow, isPlayer, life: 350, maxLife: 350 });
  }

  // ── Item: instant effect ───────────────────────────────────
  _executeItem(card, isPlayer) {
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    switch (card.effect) {
      case 'heal':
        ninja.hp = Math.min(ninja.maxHp, ninja.hp + card.value);
        this._spawnText('+' + card.value, isPlayer ? 3 : 0, ninja.col, '#2ecc71');
        // Heal pulse on sprite + green vignette for player
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-heal', 500);
        if (isPlayer) {
          this.el.wrap.classList.remove('heal-vignette');
          void this.el.wrap.offsetWidth;
          this.el.wrap.classList.add('heal-vignette');
        }
        break;
      case 'shield':
        ninja.shield += card.value;
        this._spawnText('+🛡️' + card.value, isPlayer ? 3 : 0, ninja.col, '#3498db');
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-shield', 400);
        break;
      case 'dodge':
        ninja.dodge = true;
        this._spawnText('Dodge!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
        break;
      case 'boost':
        ninja.boost += card.value;
        this._spawnText('+⚔️' + card.value, isPlayer ? 3 : 0, ninja.col, '#e94560');
        break;
      case 'speed':
        ninja.speedTimer = card.value;
        this._spawnText('Speed!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
        break;
      case 'aoe': {
        // Damage all enemy summons
        const row = isPlayer ? 1 : 2;
        for (let c = 0; c < 4; c++) {
          if (this.grid[row][c]) {
            this._damageSummon(row, c, card.value);
          }
        }
        this._spawnText('⚡AOE ' + card.value, isPlayer ? 2 : 1, 1.5, '#f5a623');
        break;
      }
    }
  }

  // ── Summon: place in front row ─────────────────────────────
  _executeSummon(card, col, isPlayer) {
    const row = isPlayer ? 2 : 1;
    if (this.grid[row][col]) return false; // occupied
    this.grid[row][col] = {
      name: card.name,
      hp: card.hp,
      maxHp: card.hp,
      atk: card.atk,
      atkSpeed: card.atkSpeed,
      atkTimer: card.atkSpeed,
      isPlayer: isPlayer,
      id: card.id,
      sticker: card.sticker,
      stunTimer: 0
    };
    // Spawn pop-in animation
    this._triggerCellAnim(row, col, 'sprite-spawn', 400);
    return true;
  }

  // ── Equipment: attack or block ─────────────────────────────
  _executeEquipment(card, col, isPlayer) {
    if (card.damage) {
      const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
      let dmg = card.damage;
      if (ninja.boost > 0) { dmg += ninja.boost; ninja.boost = 0; }
      if (card.melee) {
        this._executeMeleeHit(dmg, col, isPlayer, 0, card.pushback || false);
      } else {
        this.projectiles.push({
          col: col, y: isPlayer ? 3 : 0,
          dir: isPlayer ? -1 : 1,
          damage: dmg, isPlayer: isPlayer,
          speed: 5, poison: 0,
          pushback: card.pushback || false
        });
      }
    }
    if (card.effect === 'block') {
      const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
      ninja.shield += card.value;
      this._spawnText('+🛡️' + card.value, isPlayer ? 3 : 0, ninja.col, '#3498db');
    }
    if (card.effect === 'pull') {
      // Pull enemy ninja to this column
      const target = isPlayer ? this.cpuNinja : this.playerNinja;
      target.col = col;
      this._spawnText('Pulled!', isPlayer ? 0 : 3, col, '#f5a623');
    }
  }

  // Set initial uses when card first enters ready state
  _initEquipmentUses(slot) {
    if (slot.card && slot.card.type === 'equipment' && slot.usesLeft === 0) {
      slot.usesLeft = slot.card.uses;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  PROJECTILES
  // ════════════════════════════════════════════════════════════
  _updateProjectiles(dt) {
    const toRemove = [];
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      p.y += p.dir * p.speed * (dt / 1000);

      // Check hits
      if (p.isPlayer && p.dir === -1) {
        // Player projectile going up
        // Check CPU summon row (1)
        if (p.y <= 1.5 && p.y > 0.5 && this.grid[1][p.col]) {
          this._damageSummon(1, p.col, p.damage);
          if (p.poison) {
            this._damageSummon(1, p.col, p.poison);
          }
          if (p.areaEffect) this._spawnTileEffect(p.areaEffect, 1, p.col);
          toRemove.push(i);
          continue;
        }
        // Check CPU ninja (row 0)
        if (p.y <= 0.5 && p.col === this.cpuNinja.col) {
          this._damageNinja(false, p.damage);
          if (p.poison) this.cpuNinja.poison += p.poison;
          if (p.pushback) {
            const dir = this.cpuNinja.col <= 1 ? 1 : -1;
            this.moveCpu(dir);
          }
          if (p.areaEffect) this._spawnTileEffect(p.areaEffect, 0, p.col);
          toRemove.push(i);
          continue;
        }
        // Out of bounds
        if (p.y < -0.5) { toRemove.push(i); continue; }
      } else if (!p.isPlayer && p.dir === 1) {
        // CPU projectile going down
        // Check player summon row (2)
        if (p.y >= 1.5 && p.y < 2.5 && this.grid[2][p.col]) {
          this._damageSummon(2, p.col, p.damage);
          if (p.poison) this._damageSummon(2, p.col, p.poison);
          if (p.areaEffect) this._spawnTileEffect(p.areaEffect, 2, p.col);
          toRemove.push(i);
          continue;
        }
        // Check player ninja (row 3)
        if (p.y >= 2.5 && p.col === this.playerNinja.col) {
          this._damageNinja(true, p.damage);
          if (p.poison) this.playerNinja.poison += p.poison;
          if (p.pushback) {
            const dir = this.playerNinja.col <= 1 ? 1 : -1;
            this.movePlayer(dir);
          }
          if (p.areaEffect) this._spawnTileEffect(p.areaEffect, 3, p.col);
          toRemove.push(i);
          continue;
        }
        if (p.y > 4.5) { toRemove.push(i); continue; }
      }
    }
    // Remove hit/oob projectiles (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.projectiles.splice(toRemove[i], 1);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  SUMMON AUTO-ATTACKS
  // ════════════════════════════════════════════════════════════
  _updateSummons(dt) {
    for (let r = 1; r <= 2; r++) {
      for (let c = 0; c < 4; c++) {
        const s = this.grid[r][c];
        if (!s) continue;
        if (s.stunTimer > 0) { s.stunTimer -= dt; continue; }
        s.atkTimer -= dt;
        if (s.atkTimer <= 0) {
          s.atkTimer = s.atkSpeed;
          // Attack forward
          if (s.isPlayer) {
            // Player summon attacks upward in same column
            if (this.grid[1][c] && !this.grid[1][c].isPlayer) {
              this._damageSummon(1, c, s.atk);
            } else if (c === this.cpuNinja.col) {
              this._damageNinja(false, s.atk);
            }
          } else {
            // CPU summon attacks downward
            if (this.grid[2][c] && this.grid[2][c].isPlayer) {
              this._damageSummon(2, c, s.atk);
            } else if (c === this.playerNinja.col) {
              this._damageNinja(true, s.atk);
            }
          }
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  DAMAGE
  // ════════════════════════════════════════════════════════════

  _triggerCellAnim(row, col, cls, duration) {
    this._cellAnims[row + ',' + col] = { cls, time: duration };
  }

  _damageNinja(isPlayer, amount) {
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    if (ninja.dodge) {
      ninja.dodge = false;
      this._spawnText('DODGE!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
      return;
    }
    let dmg = amount;
    if (ninja.shield > 0) {
      const blocked = Math.min(ninja.shield, dmg);
      ninja.shield -= blocked;
      dmg -= blocked;
      if (blocked > 0) this._spawnText('🛡️-' + blocked, isPlayer ? 3 : 0, ninja.col, '#3498db');
    }
    if (dmg > 0) {
      ninja.hp = Math.max(0, ninja.hp - dmg);
      this._spawnText('-' + dmg, isPlayer ? 3 : 0, ninja.col, '#e94560');
      // Sprite recoil + white flash on hit
      this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-hit', 350);
      const hitCell = this.el.cells[isPlayer ? 3 : 0][ninja.col];
      hitCell.classList.add('hit-flash');
      setTimeout(() => hitCell.classList.remove('hit-flash'), 150);
      // Grid shake + red vignette only when player is hit
      if (isPlayer) {
        this.el.grid.classList.remove('grid-shake');
        void this.el.grid.offsetWidth;
        this.el.grid.classList.add('grid-shake');
        this.el.wrap.classList.remove('dmg-vignette');
        void this.el.wrap.offsetWidth;
        this.el.wrap.classList.add('dmg-vignette');
      }
    }
  }

  _damageSummon(row, col, amount) {
    const s = this.grid[row][col];
    if (!s) return;
    s.hp -= amount;
    this._spawnText('-' + amount, row, col, '#e94560');
    // Sprite recoil + white flash on summon hit
    this._triggerCellAnim(row, col, 'sprite-hit', 300);
    const hitCell = this.el.cells[row][col];
    hitCell.classList.add('hit-flash');
    setTimeout(() => hitCell.classList.remove('hit-flash'), 150);
    if (s.hp <= 0) {
      this.grid[row][col] = null;
      this._spawnText('💥', row, col, '#f39c12');
    }
  }

  // ════════════════════════════════════════════════════════════
  //  FLOATING TEXT
  // ════════════════════════════════════════════════════════════
  _spawnText(text, row, col, color) {
    this.floatingTexts.push({ text, row, col, color, life: 1200, maxLife: 1200 });
  }

  _updateFloatingTexts(dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      this.floatingTexts[i].life -= dt;
      if (this.floatingTexts[i].life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  _spawnTileEffect(type, row, col) {
    // Don't stack same effect on same tile
    if (this.tileEffects.some(t => t.row === row && t.col === col && t.type === type)) return;
    const durations = { burn: 3000, poison: 4000, ice: 5000 };
    this.tileEffects.push({ type, row, col, life: durations[type] || 3000, tickTimer: 0 });
  }

  _updateSlashArcs(dt) {
    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      this.slashArcs[i].life -= dt;
      if (this.slashArcs[i].life <= 0) {
        this.slashArcs.splice(i, 1);
      }
    }
  }

  _updateTileEffects(dt) {
    for (let i = this.tileEffects.length - 1; i >= 0; i--) {
      const t = this.tileEffects[i];
      t.life -= dt;
      if (t.life <= 0) { this.tileEffects.splice(i, 1); continue; }

      t.tickTimer += dt;

      // Burn: damage anyone standing on it every 500ms
      if (t.type === 'burn' && t.tickTimer >= 500) {
        t.tickTimer -= 500;
        // Check ninja
        if (t.row === 3 && t.col === this.playerNinja.col) {
          this._damageNinja(true, 2);
          this._spawnText('🔥2', 3, t.col, '#e94560');
        }
        if (t.row === 0 && t.col === this.cpuNinja.col) {
          this._damageNinja(false, 2);
          this._spawnText('🔥2', 0, t.col, '#e94560');
        }
        // Check summon
        if ((t.row === 1 || t.row === 2) && this.grid[t.row][t.col]) {
          this._damageSummon(t.row, t.col, 2);
        }
      }

      // Poison: apply poison dot if ninja steps on it (check every 400ms)
      if (t.type === 'poison' && t.tickTimer >= 400) {
        t.tickTimer -= 400;
        if (t.row === 3 && t.col === this.playerNinja.col && this.playerNinja.poison < 3) {
          this.playerNinja.poison += 1;
          this._spawnText('☠️', 3, t.col, '#9b59b6');
        }
        if (t.row === 0 && t.col === this.cpuNinja.col && this.cpuNinja.poison < 3) {
          this.cpuNinja.poison += 1;
          this._spawnText('☠️', 0, t.col, '#9b59b6');
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  render() {
    this._renderGrid();
    this._renderSlashArcs();
    this._renderHand();
    this._renderHP();
    this._renderDeckCount();
    this._renderProjectiles();
    this._renderFloatingTexts();
  }

  _renderGrid() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = this.el.cells[r][c];
        cell.className = 'grid-cell';
        cell.innerHTML = '';

        // Ninja rows
        if (r === 0 && c === this.cpuNinja.col) {
          cell.classList.add('ninja-cell', 'enemy-ninja');
          if (this.cpuNinja.stunTimer > 0) cell.classList.add('stunned');
          cell.innerHTML = `<div class="ninja-icon">${this.enemyData.portrait}</div>`;
          if (this.cpuNinja.hp <= this.cpuNinja.maxHp * 0.2) cell.classList.add('near-death');
          if (this.cpuNinja.shield > 0) cell.innerHTML += `<div class="status-icon shield-icon">🛡️${this.cpuNinja.shield}</div>`;
          if (this.cpuNinja.poison > 0) cell.innerHTML += `<div class="status-icon poison-icon">☠️${this.cpuNinja.poison}</div>`;
        }
        if (r === 3 && c === this.playerNinja.col) {
          cell.classList.add('ninja-cell', 'player-ninja');
          if (this.playerNinja.stunTimer > 0) cell.classList.add('stunned');
          cell.innerHTML = `<div class="ninja-icon">🥷</div>`;
          if (this.playerNinja.hp <= this.playerNinja.maxHp * 0.2) cell.classList.add('near-death');
          if (this.playerNinja.shield > 0) cell.innerHTML += `<div class="status-icon shield-icon">🛡️${this.playerNinja.shield}</div>`;
          if (this.playerNinja.poison > 0) cell.innerHTML += `<div class="status-icon poison-icon">☠️${this.playerNinja.poison}</div>`;
          if (this.playerNinja.boost > 0) cell.innerHTML += `<div class="status-icon boost-icon">⚔️+${this.playerNinja.boost}</div>`;
          if (this.playerNinja.dodge) cell.innerHTML += `<div class="status-icon dodge-icon">💨</div>`;
        }

        // Summon rows
        const summon = this.grid[r][c];
        if (summon && (r === 1 || r === 2)) {
          cell.classList.add('summon-cell', summon.isPlayer ? 'player-summon' : 'enemy-summon');
          if (summon.stunTimer > 0) cell.classList.add('stunned');
          const hpPct = Math.max(0, summon.hp / summon.maxHp * 100);
          const hpColor = hpPct <= 25 ? '#e74c3c' : hpPct <= 50 ? '#f5a623' : 'var(--green)';
          if (hpPct <= 25) cell.classList.add('near-death');
          cell.innerHTML = `
            <div class="summon-sticker">${summon.sticker}</div>
            <div class="summon-hp-bar"><div class="summon-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
            <div class="summon-stats">♥${summon.hp} ⚔${summon.atk}</div>
          `;
        }

        // Row labels
        if (r === 1 && !this.grid[r][c]) cell.classList.add('cpu-zone');
        if (r === 2 && !this.grid[r][c]) cell.classList.add('player-zone');

        // Clickable movement indicators on player row
        if (r === 3 && c !== this.playerNinja.col) {
          const diff = Math.abs(c - this.playerNinja.col);
          if (diff === 1) cell.classList.add('move-target');
          else cell.classList.add('move-target-far');
        }

        // Tile effects overlay
        for (const t of this.tileEffects) {
          if (t.row === r && t.col === c) {
            cell.classList.add('tile-' + t.type);
          }
        }

        // Apply sprite-level animations from _cellAnims
        const animKey = r + ',' + c;
        const anim = this._cellAnims[animKey];
        if (anim) {
          const sprite = cell.querySelector('.ninja-icon, .summon-sticker');
          if (sprite) sprite.classList.add(anim.cls);
        }
      }
    }
  }

  _renderHand() {
    const keys = ['Z', 'X', 'C'];
    for (let i = 0; i < 3; i++) {
      const s = this.playerHand[i];
      const el = this.el.handSlots[i];
      const inner = el.querySelector('.hand-card-inner');

      // Init equipment uses when card first arrives
      this._initEquipmentUses(s);

      if (s.state === 'drawing') {
        el.className = 'hand-slot drawing';
        const pct = Math.max(0, s.timer / 2000 * 100);
        const deg = Math.round((100 - pct) / 100 * 360);
        inner.innerHTML = `<div class="draw-clock"><div class="clock-hand" style="transform:rotate(${deg}deg)"></div></div><div class="draw-label">Drawing...</div>`;
      } else if (s.state === 'empty') {
        el.className = 'hand-slot empty-slot';
        inner.innerHTML = `<div class="draw-label">Empty</div>`;
      } else if (s.card) {
        const card = s.card;
        const typeColor = cardColor(card.type);
        el.className = 'hand-slot has-card';
        el.style.borderColor = typeColor;

        let statsHtml = '';
        if (card.type === 'attack')    statsHtml = `<div class="card-stat atk">⚔ ${card.damage} DMG</div>`;
        if (card.type === 'item')      statsHtml = `<div class="card-stat itm">${card.description}</div>`;
        if (card.type === 'summon')    statsHtml = `<div class="card-stat sum">♥${card.hp} ⚔${card.atk}</div>`;
        if (card.type === 'equipment') {
          statsHtml = `<div class="card-stat eq">${card.damage ? '⚔'+card.damage : card.description}</div>`;
          statsHtml += `<div class="card-uses">${s.usesLeft}/${card.uses} uses</div>`;
        }

        let cdOverlay = '';
        if (s.state === 'cooldown') {
          const pct = Math.max(0, s.timer / card.cooldown * 100);
          cdOverlay = `<div class="cd-overlay" style="height:${pct}%"></div><div class="cd-label">CD</div>`;
          el.classList.add('on-cooldown');
        }

        inner.innerHTML = `
          ${cdOverlay}
          <div class="card-type-badge" style="background:${typeColor}">${card.type.toUpperCase()}</div>
          <div class="card-art" data-card-id="${card.id}">
            <span class="sticker">${card.sticker}</span>
            <span class="card-key-big">${keys[i]}</span>
          </div>
          <div class="card-title">${card.name}</div>
          ${statsHtml}
        `;
      }
    }
  }

  _renderHP() {
    const pHp = this.playerNinja, cHp = this.cpuNinja;
    const pPct = pHp.hp / pHp.maxHp * 100;
    const cPct = cHp.hp / cHp.maxHp * 100;

    this.el.plrHpBar.style.width = pPct + '%';
    this.el.plrHpText.textContent = pHp.hp + ' / ' + pHp.maxHp;
    this.el.cpuHpBar.style.width = cPct + '%';
    this.el.cpuHpText.textContent = cHp.hp + ' / ' + cHp.maxHp;

    // Player HP flash
    if (pHp.hp < this._prevPlayerHp) {
      this.el.plrHpBar.classList.remove('hp-flash-dmg', 'hp-flash-heal');
      void this.el.plrHpBar.offsetWidth;
      this.el.plrHpBar.classList.add('hp-flash-dmg');
    } else if (pHp.hp > this._prevPlayerHp) {
      this.el.plrHpBar.classList.remove('hp-flash-dmg', 'hp-flash-heal');
      void this.el.plrHpBar.offsetWidth;
      this.el.plrHpBar.classList.add('hp-flash-heal');
    }
    this._prevPlayerHp = pHp.hp;

    // CPU HP flash
    if (cHp.hp < this._prevCpuHp) {
      this.el.cpuHpBar.classList.remove('hp-flash-dmg', 'hp-flash-heal');
      void this.el.cpuHpBar.offsetWidth;
      this.el.cpuHpBar.classList.add('hp-flash-dmg');
    } else if (cHp.hp > this._prevCpuHp) {
      this.el.cpuHpBar.classList.remove('hp-flash-dmg', 'hp-flash-heal');
      void this.el.cpuHpBar.offsetWidth;
      this.el.cpuHpBar.classList.add('hp-flash-heal');
    }
    this._prevCpuHp = cHp.hp;

    // Base color class + near-death
    let plrClass = 'hp-bar player-hp';
    if (pPct < 20) plrClass += ' critical';
    else if (pPct < 35) plrClass += ' low';

    let cpuClass = 'hp-bar enemy-hp';
    if (cPct < 20) cpuClass += ' critical';
    else if (cPct < 35) cpuClass += ' low';

    // Preserve flash classes
    if (this.el.plrHpBar.classList.contains('hp-flash-dmg')) plrClass += ' hp-flash-dmg';
    if (this.el.plrHpBar.classList.contains('hp-flash-heal')) plrClass += ' hp-flash-heal';
    if (this.el.cpuHpBar.classList.contains('hp-flash-dmg')) cpuClass += ' hp-flash-dmg';
    if (this.el.cpuHpBar.classList.contains('hp-flash-heal')) cpuClass += ' hp-flash-heal';

    this.el.plrHpBar.className = plrClass;
    this.el.cpuHpBar.className = cpuClass;
  }

  _renderDeckCount() {
    const plrTotal = this.playerDeckZ.length + this.playerDeckX.length + this.playerDeckC.length;
    const cpuTotal = this.cpuDeckZ.length + this.cpuDeckX.length + this.cpuDeckC.length;
    this.el.plrDeck.textContent = '🃏 ' + plrTotal;
    this.el.cpuDeck.textContent = '🃏 ' + cpuTotal;
  }

  _renderProjectiles() {
    // Recycle DOM elements — clear and rebuild each frame (simple approach)
    this.el.projLayer.innerHTML = '';
    const gridRect = this.el.grid.getBoundingClientRect();
    const cellW = gridRect.width / 4;
    const cellH = gridRect.height / 4;

    for (const p of this.projectiles) {
      const div = document.createElement('div');
      div.className = 'projectile ' + (p.isPlayer ? 'proj-player' : 'proj-cpu');
      div.style.left = (p.col * cellW + cellW / 2 - 8) + 'px';
      div.style.top  = (p.y * cellH + cellH / 2 - 8) + 'px';
      div.textContent = p.isPlayer ? '🔹' : '🔸';
      this.el.projLayer.appendChild(div);
    }
  }

  _renderFloatingTexts() {
    this.el.ftLayer.innerHTML = '';
    const gridRect = this.el.grid.getBoundingClientRect();
    const cellW = gridRect.width / 4;
    const cellH = gridRect.height / 4;

    for (const ft of this.floatingTexts) {
      const div = document.createElement('div');
      div.className = 'floating-text';
      const progress = 1 - ft.life / ft.maxLife;
      div.style.left    = (ft.col * cellW + cellW / 2) + 'px';
      div.style.top     = (ft.row * cellH + cellH / 2 - progress * 40) + 'px';
      div.style.opacity = 1 - progress;
      div.style.color   = ft.color;
      div.textContent   = ft.text;
      this.el.ftLayer.appendChild(div);
    }
  }

  _renderSlashArcs() {
    for (const arc of this.slashArcs) {
      const cell = this.el.cells[arc.row] && this.el.cells[arc.row][arc.col];
      if (!cell) continue;
      const div = document.createElement('div');
      div.className = 'slash-arc';
      cell.appendChild(div);
    }
  }

  // ════════════════════════════════════════════════════════════
  //  GAME END
  // ════════════════════════════════════════════════════════════
  _endGame(playerWon) {
    this.running = false;
    document.removeEventListener('keydown', this._boundKey);

    // Build result overlay
    const overlay = document.createElement('div');
    overlay.id = 'game-result-overlay';

    let rewardHtml = '';
    if (playerWon) {
      // Track progress
      if (!Storage.isEnemyDefeated(this.enemyData.id)) {
        Storage.defeatEnemy(this.enemyData.id);
        if (this.enemyData.isBoss) {
          const chapterIdx = CHAPTERS.findIndex(ch => ch.enemies.some(e => e.id === this.enemyData.id));
          if (chapterIdx >= 0 && chapterIdx < CHAPTERS.length - 1) {
            Storage.unlockChapter(CHAPTERS[chapterIdx + 1].id);
          }
        }
      }
      // Roll 5 reward cards
      const rewardIds = rollRewardCards(5);
      Storage.addCardsToCollection(rewardIds);
      rewardHtml = `<div class="reward-section"><h3>🎁 Card Drops:</h3><div class="reward-cards">${
        rewardIds.map(id => {
          const c = CARD_DB[id];
          return `<div class="reward-card" style="border-color:${cardColor(c.type)}">
            <div class="card-type-badge" style="background:${cardColor(c.type)}">${c.type.toUpperCase()}</div>
            <div class="card-art small" data-card-id="${id}"><span class="sticker">${c.sticker}</span></div>
            <div class="card-title">${c.name}</div>
            <div class="reward-rarity" style="color:${rarityColor(c.rarity)}">${c.rarity.replace('_',' ').toUpperCase()}</div>
          </div>`;
        }).join('')
      }</div></div>`;
    }

    overlay.innerHTML = `
      <div class="result-box ${playerWon ? 'win' : 'lose'}">
        <h2>${playerWon ? '⚔️ VICTORY! ⚔️' : '💀 DEFEAT 💀'}</h2>
        ${rewardHtml}
        <div class="result-buttons">
          <button id="btn-retry">Retry</button>
          <button id="btn-result-back">Back to Menu</button>
        </div>
      </div>
    `;

    document.getElementById('screen-game').appendChild(overlay);

    document.getElementById('btn-retry').onclick = () => {
      overlay.remove();
      this.onEnd('retry');
    };
    document.getElementById('btn-result-back').onclick = () => {
      overlay.remove();
      this.onEnd('menu');
    };
  }
}
