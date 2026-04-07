// ============================================================
// game.js — Core gameplay logic, rendering, input
// ============================================================

class Game {
  constructor(playerDecks, enemyData, onEnd) {
    this.onEnd = onEnd;
    this.enemyData = enemyData;

    // ── Ninjas ───────────────────────────────────────────────
    this.playerNinja = { col: 1, hp: 30, maxHp: 30, shield: 0, boost: 0, dodge: false, poison: 0, speedTimer: 0, stunTimer: 0, regenTimer: 0, regenValue: 0, regenDuration: 0, bubbleTimer: 0, oilElement: null, oilTimer: 0, transformSprite: null, transformElement: null };
    this.cpuNinja    = { col: 2, hp: enemyData.hp, maxHp: enemyData.hp, shield: 0, boost: 0, dodge: false, poison: 0, speedTimer: 0, stunTimer: 0, regenTimer: 0, regenValue: 0, regenDuration: 0, bubbleTimer: 0, oilElement: null, oilTimer: 0, transformSprite: null, transformElement: null };

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

    // ── Trophy system ────────────────────────────────────────
    this.trophyLimit  = enemyData.trophyLimit || Math.round(10 + (enemyData.difficulty || 0.3) * 20);
    this.trophyPlayer = 0;
    this.trophyCpu    = 0;

    // ── DOM refs (set in buildDOM) ───────────────────────────
    this.el = {};

    // ── Multiplayer (set externally before start) ────────────
    this.isMultiplayer = false;
    this.isHost = false;
    this._mpSyncTimer = 0;
    this._cpuMoveCD = 0;
    this._lastGuestMoveTime = 0;
    this._remoteDeckCount = null;

    // ── Input buffering: queued card plays ────────────────────
    this._playerQueue = [null, null, null]; // buffered slot indices
    this._cpuQueue    = [null, null, null];
    this._guestLocalDt = 0; // for local cooldown tick

    // ── Item cooldown (shared per side, set by item strength) ──
    this._playerItemCD = 0;
    this._cpuItemCD = 0;
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
    const enemyEl = this.enemyData.element || 'normal';
    const enemyElInfo = ELEMENTS[enemyEl] || ELEMENTS.normal;
    cpuBar.innerHTML = `
      <span class="ninja-label enemy-color">${this.enemyData.portrait} ${this.enemyData.name}</span>
      <span class="elem-badge" style="background:${enemyElInfo.color}">${enemyElInfo.icon}</span>
      <span class="hp-wrap"><span class="hp-bar enemy-hp" id="cpu-hp-bar"></span><span id="cpu-hp-text" class="hp-text"></span></span>
      <span class="deck-count" id="cpu-deck-count"></span>
    `;
    wrap.appendChild(cpuBar);

    // Trophy bar
    const trophyBar = document.createElement('div');
    trophyBar.id = 'trophy-bar';
    trophyBar.innerHTML = `
      <div class="trophy-row">
        <span class="trophy-label trophy-player">🏆 You: <span id="trophy-plr-count">0</span></span>
        <div class="trophy-track"><div class="trophy-fill trophy-fill-player" id="trophy-fill-plr"></div></div>
      </div>
      <span class="trophy-goal" id="trophy-limit-label"></span>
      <div class="trophy-row">
        <div class="trophy-track"><div class="trophy-fill trophy-fill-cpu" id="trophy-fill-cpu"></div></div>
        <span class="trophy-label trophy-cpu"><span id="trophy-cpu-count">0</span> :Enemy 🏆</span>
      </div>
    `;
    wrap.appendChild(trophyBar);

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
      <span class="elem-badge" id="plr-elem-badge" style="background:#aaa">⚪</span>
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

    // Mobile button handlers (query within wrap since it's not in the DOM yet)
    mobileControls.querySelector('#btn-move-left').addEventListener('click', () => this.movePlayer(-1));
    mobileControls.querySelector('#btn-move-right').addEventListener('click', () => this.movePlayer(1));

    // Controls hint
    const hint = document.createElement('div');
    hint.id = 'controls-hint';
    hint.textContent = '← A / D → Move   |   Z  X  C  Play Cards   |   Click grid to move';
    wrap.appendChild(hint);

    // Ping display (multiplayer only)
    if (this.isMultiplayer) {
      const pingDiv = document.createElement('div');
      pingDiv.id = 'ping-display';
      pingDiv.innerHTML = '<span class="ping-icon">📡</span> <span id="ping-value">--</span>';
      wrap.appendChild(pingDiv);
      this.el.pingDisplay = pingDiv.querySelector('#ping-value');
    }

    screen.appendChild(wrap);

    // Cache more refs
    this.el.cpuHpBar  = document.getElementById('cpu-hp-bar');
    this.el.cpuHpText = document.getElementById('cpu-hp-text');
    this.el.plrHpBar  = document.getElementById('plr-hp-bar');
    this.el.plrHpText = document.getElementById('plr-hp-text');
    this.el.plrElemBadge = document.getElementById('plr-elem-badge');
    this.el.cpuDeck   = document.getElementById('cpu-deck-count');
    this.el.plrDeck   = document.getElementById('plr-deck-count');
    this.el.trophyPlr      = document.getElementById('trophy-plr-count');
    this.el.trophyCpu      = document.getElementById('trophy-cpu-count');
    this.el.trophyFillPlr  = document.getElementById('trophy-fill-plr');
    this.el.trophyFillCpu  = document.getElementById('trophy-fill-cpu');
    this.el.trophyLimitLbl = document.getElementById('trophy-limit-label');
    this.el.grid      = gridDiv;
    this.el.wrap      = wrap;
  }

  // ════════════════════════════════════════════════════════════
  //  GAME LIFECYCLE
  // ════════════════════════════════════════════════════════════
  start() {
    this.buildDOM();

    // Draw initial hands (skip for multiplayer guest — state comes from host)
    if (!this.isMultiplayer || this.isHost) {
      for (let i = 0; i < 3; i++) {
        const pSlot = this._getDecksForSlot(i, true);
        this.playerHand[i].card  = this._drawFromDeck(pSlot.deck, pSlot.discard);
        this.playerHand[i].state = this.playerHand[i].card ? 'ready' : 'empty';
        const cSlot = this._getDecksForSlot(i, false);
        this.cpuHand[i].card     = this._drawFromDeck(cSlot.deck, cSlot.discard);
        this.cpuHand[i].state    = this.cpuHand[i].card ? 'ready' : 'empty';
      }
    }

    this.running  = true;
    this.lastTime = performance.now();
    this._boundKey = (e) => this._onKey(e);
    document.addEventListener('keydown', this._boundKey);

    // Start battle music
    this._startMusic();

    // Only run game loop for host / single-player (guest renders from state)
    if (!this.isMultiplayer || this.isHost) {
      this._raf = requestAnimationFrame((t) => this._loop(t));
    }

    this.render();
  }

  stop() {
    this.running = false;
    document.removeEventListener('keydown', this._boundKey);
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _startMusic() {
    if (this.isMultiplayer) { Music.play('arena'); return; }
    if (this.enemyData.isBoss) {
      const idx = CHAPTERS.findIndex(ch => ch.enemies.some(e => e.id === this.enemyData.id));
      const bossTrack = GENERAL_BOSS_TRACKS[idx % GENERAL_BOSS_TRACKS.length] || 'boss';
      Music.play(bossTrack);
    } else {
      const idx = CHAPTERS.findIndex(ch => ch.enemies.some(e => e.id === this.enemyData.id));
      const stageTrack = ['stage1','stage2','stage3','tower','stage2'][idx] || 'stage1';
      Music.play(stageTrack);
    }
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
    if (this.isMultiplayer) this._cpuMoveCD = Math.max(0, this._cpuMoveCD - dt);

    // Speed buff timer
    if (this.playerNinja.speedTimer > 0) this.playerNinja.speedTimer -= dt;
    if (this.cpuNinja.speedTimer > 0) this.cpuNinja.speedTimer -= dt;

    // Bubble timers
    if (this.playerNinja.bubbleTimer > 0) this.playerNinja.bubbleTimer -= dt;
    if (this.cpuNinja.bubbleTimer > 0) this.cpuNinja.bubbleTimer -= dt;

    // Oil timers
    if (this.playerNinja.oilTimer > 0) { this.playerNinja.oilTimer -= dt; if (this.playerNinja.oilTimer <= 0) this.playerNinja.oilElement = null; }
    if (this.cpuNinja.oilTimer > 0) { this.cpuNinja.oilTimer -= dt; if (this.cpuNinja.oilTimer <= 0) this.cpuNinja.oilElement = null; }

    // Regen tick (once per second)
    this._updateRegen(this.playerNinja, true, dt);
    this._updateRegen(this.cpuNinja, false, dt);

    // Item cooldown timer (shared per side)
    if (this._playerItemCD > 0) this._playerItemCD -= (this.playerNinja.speedTimer > 0 ? dt * 2 : dt);
    if (this._cpuItemCD > 0) this._cpuItemCD -= (this.cpuNinja.speedTimer > 0 ? dt * 2 : dt);

    // Stun timers — flush queued inputs when stun ends
    if (this.playerNinja.stunTimer > 0) {
      this.playerNinja.stunTimer -= dt;
      if (this.playerNinja.stunTimer <= 0) {
        for (let i = 0; i < 3; i++) {
          if (this._playerQueue[i]) { this.playCard(i); break; }
        }
      }
    }
    if (this.cpuNinja.stunTimer > 0) {
      this.cpuNinja.stunTimer -= dt;
      if (this.cpuNinja.stunTimer <= 0) {
        for (let i = 0; i < 3; i++) {
          if (this._cpuQueue[i]) { this.cpuPlayCard(i); break; }
        }
      }
    }

    // Hand cooldowns / draws
    this._updateHandSlots(this.playerHand, true, dt);
    this._updateHandSlots(this.cpuHand, false, dt);

    // CPU AI (disabled in multiplayer — remote player controls CPU)
    if (!this.isMultiplayer) this.cpu.update(dt);

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

    // Trophy win check — first to reach the limit wins
    if (this.running && this.trophyPlayer >= this.trophyLimit) { this._endGame(true, 'trophy');  }
    if (this.running && this.trophyCpu    >= this.trophyLimit) { this._endGame(false, 'trophy'); }

    // Multiplayer: send state to guest
    if (this.isMultiplayer && this.isHost) {
      this._mpSyncTimer += dt;
      if (this._mpSyncTimer >= 50) {
        this._mpSyncTimer = 0;
        Multiplayer.send({ type: 'state', state: this._serializeState() });
      }
    }
  }

  _updateHandSlots(hand, isPlayer, dt) {
    const queue = isPlayer ? this._playerQueue : this._cpuQueue;
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    // Speed buff doubles cooldown tick rate for all slots
    const speedMult = ninja.speedTimer > 0 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      const s = hand[i];
      if (s.state === 'drawing') {
        s.timer -= dt * speedMult;
        if (s.timer <= 0) {
          const { deck, discard } = this._getDecksForSlot(i, isPlayer);
          s.card = this._drawFromDeck(deck, discard);
          s.state = s.card ? 'ready' : 'empty';
          if (s.card) SFX.play(600, 'triangle', 0.06, 0.05, 200);
          s.timer = 0;
        }
      } else if (s.state === 'cooldown') {
        s.timer -= dt * speedMult;
        if (s.timer <= 0) {
          s.state = 'ready';
          s.timer = 0;
        }
      }
      // Flush queued card play when slot becomes ready
      if (s.state === 'ready' && s.card && queue[i]) {
        queue[i] = null;
        if (isPlayer) this.playCard(i);
        else this.cpuPlayCard(i);
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
    // Multiplayer guest: send input to host + predict locally
    if (this.isMultiplayer && !this.isHost) {
      const now = performance.now();
      if (now - this._lastGuestMoveTime < this.baseMoveCD) return;
      this._lastGuestMoveTime = now;
      Multiplayer.sendInput('move', { dir });
      // Client-side prediction: move locally immediately
      const newCol = this.playerNinja.col + dir;
      if (newCol >= 0 && newCol <= 3) {
        this.playerNinja.col = newCol;
        this.render();
      }
      return;
    }
    const cd = this.baseMoveCD;
    if (this.moveCD > 0) return;
    const newCol = this.playerNinja.col + dir;
    if (newCol >= 0 && newCol <= 3) {
      this.playerNinja.col = newCol;
      SFX.jump();
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
    if (this.isMultiplayer) {
      if (this.cpuNinja.stunTimer > 0) return;
      if (this._cpuMoveCD > 0) return;
    }
    const newCol = this.cpuNinja.col + dir;
    if (newCol >= 0 && newCol <= 3) {
      this.cpuNinja.col = newCol;
      if (this.isMultiplayer) this._cpuMoveCD = this.baseMoveCD;
      this._checkIceSlide(this.cpuNinja, 0, dir);
    }
  }

  _checkIceSlide(ninja, row, dir) {
    const ice = this.tileEffects.find(t => t.type === 'ice' && t.row === row && t.col === ninja.col);
    if (ice) {
      const next = ninja.col + dir;
      if (next >= 0 && next <= 3) {
        ninja.col = next;
        SFX.chain();
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
    // Multiplayer guest: send input to host + buffer locally
    if (this.isMultiplayer && !this.isHost) {
      const s = this.playerHand[slot];
      // Buffer if not ready yet (cooldown/drawing) — will auto-fire
      if (s && s.card && s.state !== 'ready') {
        this._playerQueue[slot] = true;
        this.render(); // show queued indicator
      }
      Multiplayer.sendInput('playCard', { slot });
      return;
    }
    if (this.playerNinja.stunTimer > 0) {
      // Buffer during stun
      this._playerQueue[slot] = true;
      return;
    }
    const s = this.playerHand[slot];
    if (!s.card) return;
    // Buffer if not ready yet
    if (s.state !== 'ready') {
      this._playerQueue[slot] = true;
      return;
    }
    this._playerQueue[slot] = null;

    const card = s.card;
    const col  = this.playerNinja.col;

    switch (card.type) {
      case 'attack':
        SFX.attack();
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
    if (this.isMultiplayer && this.cpuNinja.stunTimer > 0) {
      this._cpuQueue[slot] = true;
      return;
    }
    const s = this.cpuHand[slot];
    if (!s.card) return;
    if (s.state !== 'ready') {
      this._cpuQueue[slot] = true;
      return;
    }
    this._cpuQueue[slot] = null;

    const card = s.card;
    const col  = this.cpuNinja.col;

    switch (card.type) {
      case 'attack':
        SFX.attack();
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
      // Apply item cooldown as extra draw time (stronger items = longer draw)
      if (s.card.type === 'item' && s.card.itemCooldown && s.card.itemCooldown > 0) {
        const cd = s.card.itemCooldown;
        s.card = null;
        s.state = 'drawing';
        s.timer = 2000 + cd;
        s.usesLeft = 0;
        return;
      }
      // Apply attack cooldown when attack slot is consumed
      if (s.card.type === 'attack' && s.card.atkCooldown && s.card.atkCooldown > 0) {
        const cd = s.card.atkCooldown;
        s.card = null;
        s.state = 'drawing';
        s.timer = 2000 + cd;
        s.usesLeft = 0;
        return;
      }
    }
    s.card  = null;
    s.state = 'drawing';
    s.timer = 2000;
    s.usesLeft = 0;
  }

  // ════════════════════════════════════════════════════════════
  //  CARD EFFECTS
  // ════════════════════════════════════════════════════════════

  // ── Elemental multiplier + on-hit effect helper ────────────
  _applyElementDamage(baseDmg, atkElement, defElement) {
    const mult = getElementMultiplier(atkElement || 'normal', defElement || 'normal');
    return { dmg: Math.round(baseDmg * mult), mult };
  }

  // Get defensive element for a ninja (respects transformation)
  _ninjaDefElement(isPlayer) {
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    if (ninja.transformElement) return ninja.transformElement;
    return isPlayer ? 'normal' : (this.enemyData.element || 'normal');
  }

  _applyElementOnHit(atkElement, isPlayer, targetRow, targetCol) {
    const effect = ELEMENT_ON_HIT[atkElement];
    if (!effect) return;
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    const target = isPlayer ? this.cpuNinja : this.playerNinja;
    switch (effect) {
      case 'burn':
        SFX.play(200, 'sawtooth', 0.15, 0.1, -50);
        this._spawnTileEffect('burn', targetRow, targetCol);
        break;
      case 'stun': {
        SFX.play(800, 'square', 0.12, 0.1, -400);
        // Stun the target ninja or summon
        if ((targetRow === 0 || targetRow === 3)) {
          const tgt = targetRow === 0 ? this.cpuNinja : this.playerNinja;
          tgt.stunTimer = Math.max(tgt.stunTimer, 800);
          this._spawnText('⚡Stun!', targetRow, targetCol, '#f1c40f');
        }
        const s = this.grid[targetRow] && this.grid[targetRow][targetCol];
        if (s) { s.stunTimer = Math.max(s.stunTimer, 800); }
        break;
      }
      case 'lifesteal': {
        SFX.pickup();
        const heal = Math.max(1, Math.round(ninja.maxHp * 0.08));
        ninja.hp = Math.min(ninja.maxHp, ninja.hp + heal);
        this._spawnText('+' + heal, isPlayer ? 3 : 0, ninja.col, '#2ecc71');
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-heal', 400);
        break;
      }
      case 'freeze':
        SFX.play(1200, 'triangle', 0.15, 0.08, -600);
        this._spawnTileEffect('ice', targetRow, targetCol);
        break;
      case 'poison': {
        SFX.play(100, 'sawtooth', 0.2, 0.06, 30);
        if (targetRow === 0) this.cpuNinja.poison = Math.min(5, this.cpuNinja.poison + 1);
        if (targetRow === 3) this.playerNinja.poison = Math.min(5, this.playerNinja.poison + 1);
        break;
      }
      case 'pushback': {
        if (targetRow === 0) { const dir = this.cpuNinja.col <= 1 ? 1 : -1; this.moveCpu(dir); }
        if (targetRow === 3) { const dir = this.playerNinja.col <= 1 ? 1 : -1; this.movePlayer(dir); }
        break;
      }
      case 'cleanse_enemy': {
        if (targetRow === 0) { this.cpuNinja.boost = 0; this.cpuNinja.dodge = false; this.cpuNinja.bubbleTimer = 0; this.cpuNinja.oilTimer = 0; this.cpuNinja.oilElement = null; }
        if (targetRow === 3) { this.playerNinja.boost = 0; this.playerNinja.dodge = false; this.playerNinja.bubbleTimer = 0; this.playerNinja.oilTimer = 0; this.playerNinja.oilElement = null; }
        this._spawnText('Cleanse!', targetRow, targetCol, '#3498db');
        break;
      }
      case 'shield': {
        ninja.bubbleTimer = Math.max(ninja.bubbleTimer, 1500);
        this._spawnText('+🛡️1.5s', isPlayer ? 3 : 0, ninja.col, '#b8860b');
        break;
      }
    }
  }

  _showMultiplierText(mult, row, col) {
    if (mult > 1) this._spawnText('💥Super!', row, col, '#f1c40f');
    else if (mult < 1) this._spawnText('🛡️Resist', row, col, '#87ceeb');
  }

  // ── Attack: melee (hitscan) or projectile ──────────────────
  _executeAttack(card, col, isPlayer) {
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    let dmg = card.damage;
    if (ninja.boost > 0) { dmg += ninja.boost; ninja.boost = 0; }
    // Oil imbue: override element if oil active
    let element = card.element || 'normal';
    if (ninja.oilElement) element = ninja.oilElement;
    if (card.melee) {
      SFX.backstab();
      this._executeMeleeHit(dmg, col, isPlayer, card.poison || 0, card.pushback || false, element);
    } else if (card.hitscan) {
      SFX.shuriken();
      this._executeHitscanAttack(dmg, col, isPlayer, card, element);
    } else {
      SFX.shuriken();
      // Projectile speed: weaker = faster (3 dmg → 7 speed, 12 dmg → 3 speed)
      const projSpeed = Math.max(3, 8 - (card.damage || 5) * 0.5);
      this.projectiles.push({
        col: col,
        y: isPlayer ? 3 : 0,
        dir: isPlayer ? -1 : 1,
        damage: dmg,
        isPlayer: isPlayer,
        speed: projSpeed,
        poison: card.poison || 0,
        pushback: card.pushback || false,
        areaEffect: card.areaEffect || null,
        element: element
      });
    }
  }

  // ── Hitscan: instant hit on both enemy rows + tile effects ──
  _executeHitscanAttack(dmg, col, isPlayer, card, element) {
    const summonRow = isPlayer ? 1 : 2;
    const ninjaRow  = isPlayer ? 0 : 3;
    const targetNinja = isPlayer ? this.cpuNinja : this.playerNinja;
    const atkEl = element || card.element || 'normal';

    // Hit summon in that column
    if (this.grid[summonRow][col]) {
      const defEl = this.grid[summonRow][col].element || 'normal';
      const { dmg: adjDmg, mult } = this._applyElementDamage(dmg, atkEl, defEl);
      this._damageSummon(summonRow, col, adjDmg);
      this._showMultiplierText(mult, summonRow, col);
      this._applyElementOnHit(atkEl, isPlayer, summonRow, col);
    }
    // Hit ninja if in that column
    if (col === targetNinja.col) {
      const actualDefEl = this._ninjaDefElement(!isPlayer);
      const { dmg: adjDmg, mult } = this._applyElementDamage(dmg, atkEl, actualDefEl);
      this._damageNinja(!isPlayer, adjDmg);
      this._showMultiplierText(mult, ninjaRow, col);
      if (card.poison) targetNinja.poison += card.poison;
      this._applyElementOnHit(atkEl, isPlayer, ninjaRow, col);
    }
    // Spawn tile effects on both enemy rows
    if (card.areaEffect) {
      this._spawnTileEffect(card.areaEffect, summonRow, col);
      this._spawnTileEffect(card.areaEffect, ninjaRow, col);
    }
  }

  // ── Melee hitscan: instant damage + stun + slash arc ───────
  _executeMeleeHit(dmg, col, isPlayer, poison, pushback, element) {
    const atkEl = element || 'normal';
    let hitRow = isPlayer ? 1 : 2;
    if (isPlayer) {
      if (this.grid[1][col]) {
        const defEl = this.grid[1][col].element || 'normal';
        const { dmg: adjDmg, mult } = this._applyElementDamage(dmg, atkEl, defEl);
        this._damageSummon(1, col, adjDmg);
        this._showMultiplierText(mult, 1, col);
        if (this.grid[1][col]) this.grid[1][col].stunTimer = 600;
        this._applyElementOnHit(atkEl, isPlayer, 1, col);
        hitRow = 1;
      } else if (col === this.cpuNinja.col) {
        const defEl = this._ninjaDefElement(false);
        const { dmg: adjDmg, mult } = this._applyElementDamage(dmg, atkEl, defEl);
        this._damageNinja(false, adjDmg);
        this._showMultiplierText(mult, 0, col);
        if (poison) this.cpuNinja.poison += poison;
        if (pushback) { const dir = this.cpuNinja.col <= 1 ? 1 : -1; this.moveCpu(dir); }
        this.cpuNinja.stunTimer = 600;
        this._applyElementOnHit(atkEl, isPlayer, 0, col);
        hitRow = 0;
      }
    } else {
      if (this.grid[2][col]) {
        const defEl = this.grid[2][col].element || 'normal';
        const { dmg: adjDmg, mult } = this._applyElementDamage(dmg, atkEl, defEl);
        this._damageSummon(2, col, adjDmg);
        this._showMultiplierText(mult, 2, col);
        if (this.grid[2][col]) this.grid[2][col].stunTimer = 600;
        this._applyElementOnHit(atkEl, false, 2, col);
        hitRow = 2;
      } else if (col === this.playerNinja.col) {
        const { dmg: adjDmg, mult } = this._applyElementDamage(dmg, atkEl, this._ninjaDefElement(true));
        this._damageNinja(true, adjDmg);
        this._showMultiplierText(mult, 3, col);
        if (poison) this.playerNinja.poison += poison;
        if (pushback) { const dir = this.playerNinja.col <= 1 ? 1 : -1; this.movePlayer(dir); }
        this.playerNinja.stunTimer = 600;
        this._applyElementOnHit(atkEl, false, 3, col);
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
        SFX.pickup();
        ninja.hp = Math.min(ninja.maxHp, ninja.hp + card.value);
        this._spawnText('+' + card.value, isPlayer ? 3 : 0, ninja.col, '#2ecc71');
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-heal', 500);
        if (isPlayer) {
          this.el.wrap.classList.remove('heal-vignette');
          void this.el.wrap.offsetWidth;
          this.el.wrap.classList.add('heal-vignette');
        }
        break;
      case 'regen':
        SFX.pickup();
        ninja.regenValue = card.value;
        ninja.regenDuration = card.duration;
        ninja.regenTimer = 0;
        this._spawnText('Regen +' + card.value + '/s', isPlayer ? 3 : 0, ninja.col, '#2ecc71');
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-heal', 500);
        break;
      case 'bubble':
        SFX.armor();
        ninja.bubbleTimer = card.value;
        ninja.shield = 0; // bubble replaces shield
        this._spawnText('🛡️Bubble ' + (card.value / 1000) + 's!', isPlayer ? 3 : 0, ninja.col, '#3498db');
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-shield', 400);
        break;
      case 'shield':
        // Legacy compat — treat as bubble (2s)
        SFX.armor();
        ninja.bubbleTimer = 2000;
        this._spawnText('🛡️Bubble!', isPlayer ? 3 : 0, ninja.col, '#3498db');
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-shield', 400);
        break;
      case 'dodge':
        SFX.special();
        ninja.dodge = true;
        this._spawnText('Dodge!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
        break;
      case 'boost':
        SFX.special();
        ninja.boost += card.value;
        this._spawnText('+⚔️' + card.value, isPlayer ? 3 : 0, ninja.col, '#e94560');
        break;
      case 'speed':
        SFX.special();
        ninja.speedTimer = card.value;
        this._spawnText('Fast CD!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
        break;
      case 'aoe': {
        SFX.slam();
        const row = isPlayer ? 1 : 2;
        const atkEl = card.element || 'normal';
        for (let c = 0; c < 4; c++) {
          if (this.grid[row][c]) {
            const defEl = this.grid[row][c].element || 'normal';
            const { dmg, mult } = this._applyElementDamage(card.value, atkEl, defEl);
            this._damageSummon(row, c, dmg);
            this._showMultiplierText(mult, row, c);
          }
        }
        this._spawnText('⚡AOE ' + card.value, isPlayer ? 2 : 1, 1.5, '#f5a623');
        break;
      }
      case 'oil':
        SFX.special();
        ninja.oilElement = card.oilElement;
        ninja.oilTimer = card.value;
        this._spawnText(elementIcon(card.oilElement) + ' Oil!', isPlayer ? 3 : 0, ninja.col, elementColor(card.oilElement));
        break;
      case 'food': {
        SFX.pickup();
        if (card.foodHp) {
          ninja.hp = Math.min(ninja.maxHp, ninja.hp + card.foodHp);
          this._spawnText('+' + card.foodHp + ' HP', isPlayer ? 3 : 0, ninja.col, '#2ecc71');
        }
        if (card.foodMaxHp) {
          ninja.maxHp += card.foodMaxHp;
          ninja.hp += card.foodMaxHp;
          this._spawnText('+' + card.foodMaxHp + ' maxHP', isPlayer ? 3 : 0, ninja.col, '#f5a623');
        }
        if (card.foodBoost) {
          ninja.boost += card.foodBoost;
          this._spawnText('+⚔️' + card.foodBoost, isPlayer ? 3 : 0, ninja.col, '#e94560');
        }
        if (card.foodSpeed) {
          ninja.speedTimer = Math.max(ninja.speedTimer, card.foodSpeed);
          this._spawnText('Fast CD!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
        }
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-heal', 500);
        if (isPlayer) {
          this.el.wrap.classList.remove('heal-vignette');
          void this.el.wrap.offsetWidth;
          this.el.wrap.classList.add('heal-vignette');
        }
        break;
      }
      case 'transform': {
        SFX.bossSpawn();
        // Preserve HP proportion
        const hpRatio = ninja.hp / ninja.maxHp;
        ninja.maxHp += card.transformMaxHp;
        ninja.hp = Math.max(1, Math.round(hpRatio * ninja.maxHp));
        ninja.transformSprite = card.transformSprite;
        ninja.transformElement = card.transformElement;
        this._spawnText('🔄 Transform!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
        this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-spawn', 500);
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
      element: card.element || 'normal',
      trophyPts: card.trophyPts || 1,
      stunTimer: 0
    };
    // Spawn pop-in animation
    SFX.bossSpawn();
    this._triggerCellAnim(row, col, 'sprite-spawn', 400);
    return true;
  }

  // ── Equipment: attack or block ─────────────────────────────
  _executeEquipment(card, col, isPlayer) {
    let element = card.element || 'normal';
    const ninja = isPlayer ? this.playerNinja : this.cpuNinja;
    // Oil imbue for equipment attacks
    if (ninja.oilElement && card.damage) element = ninja.oilElement;
    if (card.damage) {
      let dmg = card.damage;
      if (ninja.boost > 0) { dmg += ninja.boost; ninja.boost = 0; }
      if (card.melee) {
        this._executeMeleeHit(dmg, col, isPlayer, 0, card.pushback || false, element);
      } else {
        const projSpeed = Math.max(3, 8 - (card.damage || 3) * 0.5);
        this.projectiles.push({
          col: col, y: isPlayer ? 3 : 0,
          dir: isPlayer ? -1 : 1,
          damage: dmg, isPlayer: isPlayer,
          speed: projSpeed, poison: 0,
          pushback: card.pushback || false,
          element: element
        });
      }
    }
    if (card.effect === 'block') {
      const n = isPlayer ? this.playerNinja : this.cpuNinja;
      n.shield += card.value;
      this._spawnText('+🛡️' + card.value, isPlayer ? 3 : 0, n.col, '#3498db');
    }
    if (card.effect === 'bubble') {
      ninja.bubbleTimer = Math.max(ninja.bubbleTimer, card.value);
      this._spawnText('🛡️Bubble ' + (card.value / 1000) + 's!', isPlayer ? 3 : 0, ninja.col, '#3498db');
      this._triggerCellAnim(isPlayer ? 3 : 0, ninja.col, 'sprite-shield', 400);
    }
    if (card.effect === 'pull') {
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
      const pEl = p.element || 'normal';

      // Check hits
      if (p.isPlayer && p.dir === -1) {
        // Player projectile going up
        // Check CPU summon row (1)
        if (p.y <= 1.5 && p.y > 0.5 && this.grid[1][p.col]) {
          const defEl = this.grid[1][p.col].element || 'normal';
          const { dmg, mult } = this._applyElementDamage(p.damage, pEl, defEl);
          this._damageSummon(1, p.col, dmg);
          this._showMultiplierText(mult, 1, p.col);
          this._applyElementOnHit(pEl, true, 1, p.col);
          if (p.poison) this._damageSummon(1, p.col, p.poison);
          if (p.areaEffect) this._spawnTileEffect(p.areaEffect, 1, p.col);
          toRemove.push(i);
          continue;
        }
        // Check CPU ninja (row 0)
        if (p.y <= 0.5 && p.col === this.cpuNinja.col) {
          const defEl = this._ninjaDefElement(false);
          const { dmg, mult } = this._applyElementDamage(p.damage, pEl, defEl);
          this._damageNinja(false, dmg);
          this._showMultiplierText(mult, 0, p.col);
          this._applyElementOnHit(pEl, true, 0, p.col);
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
          const defEl = this.grid[2][p.col].element || 'normal';
          const { dmg, mult } = this._applyElementDamage(p.damage, pEl, defEl);
          this._damageSummon(2, p.col, dmg);
          this._showMultiplierText(mult, 2, p.col);
          this._applyElementOnHit(pEl, false, 2, p.col);
          if (p.poison) this._damageSummon(2, p.col, p.poison);
          if (p.areaEffect) this._spawnTileEffect(p.areaEffect, 2, p.col);
          toRemove.push(i);
          continue;
        }
        // Check player ninja (row 3)
        if (p.y >= 2.5 && p.col === this.playerNinja.col) {
          const { dmg, mult } = this._applyElementDamage(p.damage, pEl, this._ninjaDefElement(true));
          this._damageNinja(true, dmg);
          this._showMultiplierText(mult, 3, p.col);
          this._applyElementOnHit(pEl, false, 3, p.col);
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
          const atkEl = s.element || 'normal';
          // Attack forward
          if (s.isPlayer) {
            // Player summon attacks upward in same column
            if (this.grid[1][c] && !this.grid[1][c].isPlayer) {
              const defEl = this.grid[1][c].element || 'normal';
              const { dmg, mult } = this._applyElementDamage(s.atk, atkEl, defEl);
              this._damageSummon(1, c, dmg);
              this._showMultiplierText(mult, 1, c);
              this._applyElementOnHit(atkEl, true, 1, c);
            } else if (c === this.cpuNinja.col) {
              const defEl = this._ninjaDefElement(false);
              const { dmg, mult } = this._applyElementDamage(s.atk, atkEl, defEl);
              this._damageNinja(false, dmg);
              this._showMultiplierText(mult, 0, c);
              this._applyElementOnHit(atkEl, true, 0, c);
            }
          } else {
            // CPU summon attacks downward
            if (this.grid[2][c] && this.grid[2][c].isPlayer) {
              const defEl = this.grid[2][c].element || 'normal';
              const { dmg, mult } = this._applyElementDamage(s.atk, atkEl, defEl);
              this._damageSummon(2, c, dmg);
              this._showMultiplierText(mult, 2, c);
              this._applyElementOnHit(atkEl, false, 2, c);
            } else if (c === this.playerNinja.col) {
              const { dmg, mult } = this._applyElementDamage(s.atk, atkEl, this._ninjaDefElement(true));
              this._damageNinja(true, dmg);
              this._showMultiplierText(mult, 3, c);
              this._applyElementOnHit(atkEl, false, 3, c);
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
      SFX.miss();
      this._spawnText('DODGE!', isPlayer ? 3 : 0, ninja.col, '#f5a623');
      return;
    }
    // Bubble: blocks ALL damage while active
    if (ninja.bubbleTimer > 0) {
      SFX.parry();
      this._spawnText('🛡️Blocked!', isPlayer ? 3 : 0, ninja.col, '#3498db');
      return;
    }
    let dmg = amount;
    if (dmg > 0) {
      ninja.hp = Math.max(0, ninja.hp - dmg);
      if (isPlayer) SFX.playerHurt(); else SFX.hit();
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
    SFX.hit();
    this._spawnText('-' + amount, row, col, '#e94560');
    // Sprite recoil + white flash on summon hit
    this._triggerCellAnim(row, col, 'sprite-hit', 300);
    const hitCell = this.el.cells[row][col];
    hitCell.classList.add('hit-flash');
    setTimeout(() => hitCell.classList.remove('hit-flash'), 150);
    if (s.hp <= 0) {
      // Award trophy points to the killer
      const pts = (CARD_DB[s.id] && CARD_DB[s.id].trophyPts) || 1;
      if (s.isPlayer) {
        this.trophyCpu += pts;
      } else {
        this.trophyPlayer += pts;
      }
      SFX.enemyDie();
      this._spawnText('🏆+' + pts, row, col, '#f1c40f');
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
    this._renderTrophy();
    this._renderDeckCount();
    this._renderProjectiles();
    this._renderFloatingTexts();
  }

  _renderGrid() {
    const cpuCol = Math.round(this.cpuNinja.col);
    const plrCol = Math.round(this.playerNinja.col);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = this.el.cells[r][c];
        cell.className = 'grid-cell';
        cell.innerHTML = '';

        // Ninja rows
        if (r === 0 && c === cpuCol) {
          cell.classList.add('ninja-cell', 'enemy-ninja');
          if (this.cpuNinja.stunTimer > 0) cell.classList.add('stunned');
          if (this.cpuNinja.dodge) cell.classList.add('evasion-blink');
          if (this.cpuNinja.bubbleTimer > 0) cell.classList.add('bubble-active');
          const cpuSprite = this.cpuNinja.transformSprite || this.enemyData.portrait;
          cell.innerHTML = `<div class="ninja-icon">${cpuSprite}</div>`;
          if (this.cpuNinja.hp <= this.cpuNinja.maxHp * 0.2) cell.classList.add('near-death');
          if (this.cpuNinja.bubbleTimer > 0) cell.innerHTML += `<div class="status-icon shield-icon">🛡️${Math.ceil(this.cpuNinja.bubbleTimer / 1000)}s</div>`;
          if (this.cpuNinja.poison > 0) cell.innerHTML += `<div class="status-icon poison-icon">☠️${this.cpuNinja.poison}</div>`;
          if (this.cpuNinja.oilElement) cell.innerHTML += `<div class="status-icon oil-icon">${elementIcon(this.cpuNinja.oilElement)}🛢️</div>`;
          if (this.cpuNinja.regenDuration > 0) cell.innerHTML += `<div class="status-icon regen-icon">💚${this.cpuNinja.regenValue}</div>`;
        }
        if (r === 3 && c === plrCol) {
          cell.classList.add('ninja-cell', 'player-ninja');
          if (this.playerNinja.stunTimer > 0) cell.classList.add('stunned');
          if (this.playerNinja.dodge) cell.classList.add('evasion-blink');
          if (this.playerNinja.bubbleTimer > 0) cell.classList.add('bubble-active');
          const plrSprite = this.playerNinja.transformSprite || '🥷';
          cell.innerHTML = `<div class="ninja-icon">${plrSprite}</div>`;
          if (this.playerNinja.hp <= this.playerNinja.maxHp * 0.2) cell.classList.add('near-death');
          if (this.playerNinja.bubbleTimer > 0) cell.innerHTML += `<div class="status-icon shield-icon">🛡️${Math.ceil(this.playerNinja.bubbleTimer / 1000)}s</div>`;
          if (this.playerNinja.poison > 0) cell.innerHTML += `<div class="status-icon poison-icon">☠️${this.playerNinja.poison}</div>`;
          if (this.playerNinja.boost > 0) cell.innerHTML += `<div class="status-icon boost-icon">⚔️+${this.playerNinja.boost}</div>`;
          if (this.playerNinja.dodge) cell.innerHTML += `<div class="status-icon dodge-icon">💨</div>`;
          if (this.playerNinja.oilElement) cell.innerHTML += `<div class="status-icon oil-icon">${elementIcon(this.playerNinja.oilElement)}🛢️</div>`;
          if (this.playerNinja.regenDuration > 0) cell.innerHTML += `<div class="status-icon regen-icon">💚${this.playerNinja.regenValue}</div>`;
          if (this.playerNinja.speedTimer > 0) cell.innerHTML += `<div class="status-icon speed-icon">🏃</div>`;
        }

        // Summon rows
        const summon = this.grid[r][c];
        if (summon && (r === 1 || r === 2)) {
          cell.classList.add('summon-cell', summon.isPlayer ? 'player-summon' : 'enemy-summon');
          if (summon.stunTimer > 0) cell.classList.add('stunned');
          const hpPct = Math.max(0, summon.hp / summon.maxHp * 100);
          const hpColor = hpPct <= 25 ? '#e74c3c' : hpPct <= 50 ? '#f5a623' : 'var(--green)';
          if (hpPct <= 25) cell.classList.add('near-death');
          const sElIcon = elementIcon(summon.element || 'normal');
          cell.innerHTML = `
            <div class="summon-sticker">${summon.sticker}</div>
            <div class="summon-hp-bar"><div class="summon-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
            <div class="summon-stats">${sElIcon} ♥${summon.hp} ⚔${summon.atk} 🏆${summon.trophyPts || 1}</div>
          `;
        }

        // Row labels
        if (r === 1 && !this.grid[r][c]) cell.classList.add('cpu-zone');
        if (r === 2 && !this.grid[r][c]) cell.classList.add('player-zone');

        // Clickable movement indicators on player row
        if (r === 3 && c !== plrCol) {
          const diff = Math.abs(c - plrCol);
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
        const elIcon = elementIcon(card.element || 'normal');
        const elColor = elementColor(card.element || 'normal');
        el.className = 'hand-slot has-card';
        el.style.borderColor = typeColor;

        let statsHtml = '';
        if (card.type === 'attack')    statsHtml = `<div class="card-stat atk"><span class="stat-big">⚔${card.damage}</span></div>`;
        if (card.type === 'item') {
          if (card.effect === 'heal')          statsHtml = `<div class="card-stat itm"><span class="stat-big">💚+${card.value}</span></div>`;
          else if (card.effect === 'regen')    statsHtml = `<div class="card-stat itm"><span class="stat-big">💚+${card.value}/s</span></div>`;
          else if (card.effect === 'shield' || card.effect === 'bubble') statsHtml = `<div class="card-stat itm"><span class="stat-big">🛡️${(card.value/1000)}s</span></div>`;
          else if (card.effect === 'dodge')    statsHtml = `<div class="card-stat itm"><span class="stat-big">💨</span></div>`;
          else if (card.effect === 'boost')    statsHtml = `<div class="card-stat itm"><span class="stat-big">⚔+${card.value}</span></div>`;
          else if (card.effect === 'speed')    statsHtml = `<div class="card-stat itm"><span class="stat-big">🏃CD</span></div>`;
          else if (card.effect === 'aoe')      statsHtml = `<div class="card-stat itm"><span class="stat-big">⚡${card.value}</span></div>`;
          else if (card.effect === 'oil')      statsHtml = `<div class="card-stat itm"><span class="stat-big">${elementIcon(card.oilElement)}🛢️</span></div>`;
          else if (card.effect === 'food')     statsHtml = `<div class="card-stat itm"><span class="stat-big">${card.description}</span></div>`;
          else if (card.effect === 'transform') statsHtml = `<div class="card-stat itm"><span class="stat-big">${card.transformSprite}</span></div>`;
          else statsHtml = `<div class="card-stat itm"><span class="stat-big">${card.description}</span></div>`;
        }
        if (card.type === 'summon')    statsHtml = `<div class="card-stat sum"><span class="stat-big">♥${card.hp} ⚔${card.atk}</span><span class="stat-trophy">🏆${card.trophyPts || 1}</span></div>`;
        if (card.type === 'equipment') {
          const mainStat = card.damage ? `⚔${card.damage}` : card.effect === 'bubble' ? `🛡️${(card.value/1000)}s` : `🛡️${card.value}`;
          statsHtml = `<div class="card-stat eq"><span class="stat-big">${mainStat}</span><span class="stat-uses">×${s.usesLeft}</span></div>`;
        }

        let cdOverlay = '';
        if (s.state === 'cooldown') {
          const pct = Math.max(0, s.timer / card.cooldown * 100);
          cdOverlay = `<div class="cd-overlay" style="height:${pct}%"></div><div class="cd-label">CD</div>`;
          el.classList.add('on-cooldown');
        }

        // Queued indicator
        let queuedTag = '';
        if (this._playerQueue[i]) {
          el.classList.add('queued');
          queuedTag = '<div class="queued-label">QUEUED</div>';
        }

        inner.innerHTML = `
          ${cdOverlay}
          ${queuedTag}
          <div class="card-header-row">
            <span class="card-type-badge" style="background:${typeColor}">${card.type.toUpperCase()}</span>
            <span class="card-elem-badge" style="background:${elColor}">${elIcon}</span>
          </div>
          <div class="card-sticker-big">${card.sticker}</div>
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

    // Update player element badge for transformation
    const plrEl = this.playerNinja.transformElement || 'normal';
    const plrElInfo = ELEMENTS[plrEl] || ELEMENTS.normal;
    this.el.plrElemBadge.style.background = plrElInfo.color;
    this.el.plrElemBadge.textContent = plrElInfo.icon;
  }

  _renderTrophy() {
    const limit = this.trophyLimit;
    this.el.trophyPlr.textContent = this.trophyPlayer + '/' + limit;
    this.el.trophyCpu.textContent = this.trophyCpu + '/' + limit;
    this.el.trophyFillPlr.style.width = Math.min(100, this.trophyPlayer / limit * 100) + '%';
    this.el.trophyFillCpu.style.width = Math.min(100, this.trophyCpu / limit * 100) + '%';
    this.el.trophyLimitLbl.textContent = 'First to ' + limit;
  }

  _renderDeckCount() {
    if (this.isMultiplayer && !this.isHost && this._remoteDeckCount) {
      this.el.plrDeck.textContent = '🃏 ' + this._remoteDeckCount.plr;
      this.el.cpuDeck.textContent = '🃏 ' + this._remoteDeckCount.cpu;
      return;
    }
    const plrTotal = this.playerDeckZ.length + this.playerDeckX.length + this.playerDeckC.length;
    const cpuTotal = this.cpuDeckZ.length + this.cpuDeckX.length + this.cpuDeckC.length;
    this.el.plrDeck.textContent = '🃏 ' + plrTotal;
    this.el.cpuDeck.textContent = '🃏 ' + cpuTotal;
  }

  _renderProjectiles() {
    // Recycle DOM elements — clear and rebuild each frame (simple approach)
    this.el.projLayer.innerHTML = '';
    const gridRect = this.el.grid.getBoundingClientRect();
    const wrapRect = this.el.wrap.getBoundingClientRect();
    const offsetX = gridRect.left - wrapRect.left;
    const offsetY = gridRect.top - wrapRect.top;
    const cellW = gridRect.width / 4;
    const cellH = gridRect.height / 4;

    for (const p of this.projectiles) {
      const div = document.createElement('div');
      div.className = 'projectile ' + (p.isPlayer ? 'proj-player' : 'proj-cpu');
      div.style.left = (offsetX + p.col * cellW + cellW / 2 - 8) + 'px';
      div.style.top  = (offsetY + p.y * cellH + cellH / 2 - 8) + 'px';
      div.textContent = p.isPlayer ? '🔹' : '🔸';
      this.el.projLayer.appendChild(div);
    }
  }

  _renderFloatingTexts() {
    this.el.ftLayer.innerHTML = '';
    const gridRect = this.el.grid.getBoundingClientRect();
    const wrapRect = this.el.wrap.getBoundingClientRect();
    const offsetX = gridRect.left - wrapRect.left;
    const offsetY = gridRect.top - wrapRect.top;
    const cellW = gridRect.width / 4;
    const cellH = gridRect.height / 4;

    for (const ft of this.floatingTexts) {
      const div = document.createElement('div');
      div.className = 'floating-text';
      const progress = 1 - ft.life / ft.maxLife;
      div.style.left    = (offsetX + ft.col * cellW + cellW / 2) + 'px';
      div.style.top     = (offsetY + ft.row * cellH + cellH / 2 - progress * 40) + 'px';
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
  //  MULTIPLAYER STATE SYNC
  // ════════════════════════════════════════════════════════════

  /** Host: serialize full game state for sending to guest */
  _serializeState() {
    return {
      pN: this.playerNinja,
      cN: this.cpuNinja,
      grid: this.grid,
      proj: this.projectiles,
      ft: this.floatingTexts,
      sa: this.slashArcs,
      te: this.tileEffects,
      cH: this.cpuHand,
      tP: this.trophyPlayer,
      tC: this.trophyCpu,
      tL: this.trophyLimit,
      ca: this._cellAnims,
      pDC: this.playerDeckZ.length + this.playerDeckX.length + this.playerDeckC.length,
      cDC: this.cpuDeckZ.length + this.cpuDeckX.length + this.cpuDeckC.length
    };
  }

  /** Guest: apply mirrored host state and render */
  applyRemoteState(s) {
    // Host's CPU ninja → Guest's player ninja (bottom)
    this.playerNinja = s.cN;
    // Host's player ninja → Guest's enemy ninja (top)
    this.cpuNinja = s.pN;

    // Flip grid rows (0↔3, 1↔2) and invert isPlayer flags
    for (let r = 0; r < 4; r++) {
      const hostRow = 3 - r;
      const src = s.grid[hostRow];
      this.grid[r] = src.map(c => c ? Object.assign({}, c, { isPlayer: !c.isPlayer }) : null);
    }

    // Flip projectiles
    this.projectiles = (s.proj || []).map(p => ({
      col: p.col, y: 3 - p.y, dir: -p.dir,
      damage: p.damage, isPlayer: !p.isPlayer,
      speed: p.speed, poison: p.poison,
      pushback: p.pushback, areaEffect: p.areaEffect,
      element: p.element
    }));

    // Flip floating texts
    this.floatingTexts = (s.ft || []).map(ft => ({
      text: ft.text, row: 3 - ft.row, col: ft.col,
      color: ft.color, life: ft.life, maxLife: ft.maxLife
    }));

    // Flip slash arcs
    this.slashArcs = (s.sa || []).map(a => ({
      col: a.col, row: 3 - a.row, isPlayer: !a.isPlayer,
      life: a.life, maxLife: a.maxLife
    }));

    // Flip tile effects
    this.tileEffects = (s.te || []).map(t => ({
      type: t.type, row: 3 - t.row, col: t.col,
      life: t.life, tickTimer: t.tickTimer
    }));

    // Guest hand = host CPU hand
    this.playerHand = s.cH;
    // Reset local cooldown delta — we just got authoritative state
    this._guestLocalDt = 0;
    // If guest has queued inputs, check if they can fire now
    for (let i = 0; i < 3; i++) {
      if (this._playerQueue[i] && this.playerHand[i] && this.playerHand[i].state === 'ready' && this.playerHand[i].card) {
        // Card became ready on host, resend the buffered play
        Multiplayer.sendInput('playCard', { slot: i });
        this._playerQueue[i] = null;
      }
    }

    // Trophies (swapped)
    this.trophyPlayer = s.tC;
    this.trophyCpu = s.tP;
    this.trophyLimit = s.tL;

    // Deck counts (swapped)
    this._remoteDeckCount = { plr: s.cDC || 0, cpu: s.pDC || 0 };

    // Cell animations (flip rows)
    this._cellAnims = {};
    if (s.ca) {
      for (const key in s.ca) {
        const parts = key.split(',');
        this._cellAnims[(3 - parseInt(parts[0])) + ',' + parts[1]] = s.ca[key];
      }
    }

    this.render();
  }

  /** Host: apply input from remote guest player */
  applyRemoteInput(msg) {
    if (!this.running) return;
    switch (msg.action) {
      case 'move': this.moveCpu(msg.dir); break;
      case 'playCard': this.cpuPlayCard(msg.slot); break;
    }
  }

  // ── Regen tick helper ──────────────────────────────────────
  _updateRegen(ninja, isPlayer, dt) {
    if (ninja.regenDuration <= 0) return;
    ninja.regenDuration -= dt;
    ninja.regenTimer += dt;
    if (ninja.regenTimer >= 1000) {
      ninja.regenTimer -= 1000;
      const heal = ninja.regenValue;
      ninja.hp = Math.min(ninja.maxHp, ninja.hp + heal);
      this._spawnText('+' + heal, isPlayer ? 3 : 0, ninja.col, '#2ecc71');
    }
    if (ninja.regenDuration <= 0) {
      ninja.regenValue = 0;
      ninja.regenTimer = 0;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  GAME END
  // ════════════════════════════════════════════════════════════
  _endGame(playerWon, reason) {
    this.running = false;
    document.removeEventListener('keydown', this._boundKey);
    Music.stop();
    if (playerWon) SFX.victory(); else SFX.bossDie();

    // Multiplayer: notify remote player
    if (this.isMultiplayer && this.isHost) {
      Multiplayer.send({ type: 'game-end', playerWon, reason });
    }

    // Build result overlay
    const overlay = document.createElement('div');
    overlay.id = 'game-result-overlay';

    const trophyStr = reason === 'trophy'
      ? `<div class="trophy-result">🏆 Trophy Victory! (${playerWon ? this.trophyPlayer : this.trophyCpu}/${this.trophyLimit})</div>`
      : '';

    let rewardHtml = '';
    if (playerWon && !this.isMultiplayer) {
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
          const rElIcon = elementIcon(c.element || 'normal');
          const rElColor = elementColor(c.element || 'normal');
          return `<div class="reward-card" style="border-color:${cardColor(c.type)}">
            <div class="card-header-row"><span class="card-type-badge" style="background:${cardColor(c.type)}">${c.type.toUpperCase()}</span><span class="card-elem-badge" style="background:${rElColor}">${rElIcon}</span></div>
            <div class="reward-sticker">${c.sticker}</div>
            <div class="card-title">${c.name}</div>
            <div class="reward-rarity" style="color:${rarityColor(c.rarity)}">${c.rarity.replace('_',' ').toUpperCase()}</div>
          </div>`;
        }).join('')
      }</div></div>`;
    }

    overlay.innerHTML = `
      <div class="result-box ${playerWon ? 'win' : 'lose'}">
        <h2>${playerWon ? '⚔️ VICTORY! ⚔️' : '💀 DEFEAT 💀'}</h2>
        ${trophyStr}
        ${rewardHtml}
        <div class="result-buttons">
          ${!this.isMultiplayer ? '<button id="btn-retry">Retry</button>' : '<button id="btn-rematch">🔁 Rematch</button>'}
          <button id="btn-result-back">Back to Menu</button>
        </div>
        ${this.isMultiplayer ? '<div class="mp-status" id="rematch-status"></div>' : ''}
      </div>
    `;

    document.getElementById('screen-game').appendChild(overlay);

    if (!this.isMultiplayer) {
      document.getElementById('btn-retry').onclick = () => {
        overlay.remove();
        this.onEnd('retry');
      };
    } else {
      document.getElementById('btn-rematch').onclick = () => {
        Multiplayer.requestRematch();
        document.getElementById('btn-rematch').disabled = true;
        document.getElementById('rematch-status').textContent = '⏳ Waiting for opponent...';
      };
    }
    document.getElementById('btn-result-back').onclick = () => {
      overlay.remove();
      this.onEnd('menu');
    };
  }
}
