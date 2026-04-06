// ============================================================
// cpu.js — CPU AI controller
// ============================================================

class CpuAI {
  constructor(game, difficulty) {
    this.game = game;
    this.difficulty = difficulty;          // 0.0 – 1.0
    this.moveTimer = 0;
    this.cardTimer = 0;
    this.thinkMove = this._thinkTime(700, 200);
    this.thinkCard = this._thinkTime(2400, 900);
  }

  _thinkTime(slow, fast) {
    return slow - (slow - fast) * this.difficulty;
  }

  // Check if a tile effect exists at (row, col) of the given type (or any if type is null)
  _tileAt(row, col, type) {
    return this.game.tileEffects.some(t => t.row === row && t.col === col && (!type || t.type === type));
  }

  // Check if any hazard tile (burn, poison) is under the CPU ninja
  _standingOnHazard() {
    const col = this.game.cpuNinja.col;
    return this._tileAt(0, col, 'burn') || this._tileAt(0, col, 'poison');
  }

  // Count player summons
  _playerSummonCount() {
    let count = 0;
    for (let c = 0; c < 4; c++) if (this.game.grid[2][c]) count++;
    return count;
  }

  // Find a safe adjacent column (no hazards), preferring direction toward target
  _safeMoveDir(preferTarget) {
    const g = this.game;
    const col = g.cpuNinja.col;
    const dirs = [];
    if (col > 0 && !this._tileAt(0, col - 1, 'burn') && !this._tileAt(0, col - 1, 'poison')) dirs.push(-1);
    if (col < 3 && !this._tileAt(0, col + 1, 'burn') && !this._tileAt(0, col + 1, 'poison')) dirs.push(1);
    if (dirs.length === 0) return col > 0 ? -1 : 1; // no safe option, move anyway
    if (dirs.length === 1) return dirs[0];
    // Prefer direction toward target
    if (preferTarget < col && dirs.includes(-1)) return -1;
    if (preferTarget > col && dirs.includes(1)) return 1;
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  update(dt) {
    if (this.game.cpuNinja.stunTimer > 0) return;
    this.moveTimer += dt;
    this.cardTimer += dt;

    // ── movement ─────────────────────────────────────────────
    if (this.moveTimer >= this.thinkMove) {
      this.moveTimer = 0;
      this._decideMove();
    }

    // ── card play ────────────────────────────────────────────
    if (this.cardTimer >= this.thinkCard) {
      this.cardTimer = 0;
      this._decideCard();
    }
  }

  // ── Movement AI ────────────────────────────────────────────
  _decideMove() {
    const g = this.game;
    const ninja = g.cpuNinja;

    // PRIORITY 1: Get off hazard tiles immediately (always, regardless of difficulty)
    if (this._standingOnHazard()) {
      g.moveCpu(this._safeMoveDir(g.playerNinja.col));
      return;
    }

    // PRIORITY 2: Dodge incoming projectiles aimed at our column
    if (Math.random() < this.difficulty) {
      const incoming = g.projectiles.some(p => !p.isPlayer && false) ||
                       g.projectiles.some(p => p.isPlayer && p.col === ninja.col);
      if (incoming) {
        g.moveCpu(this._safeMoveDir(ninja.col <= 1 ? 3 : 0));
        return;
      }
    }

    // PRIORITY 3: Avoid columns with player summons (they'll auto-attack us)
    if (Math.random() < this.difficulty * 0.6) {
      const playerSummon = g.grid[2][ninja.col];
      if (playerSummon) {
        g.moveCpu(this._safeMoveDir(g.playerNinja.col));
        return;
      }
    }

    // PRIORITY 4: Smart positioning — line up with player for attacks
    if (Math.random() < this.difficulty) {
      const target = g.playerNinja.col;
      if (ninja.col !== target) {
        const dir = ninja.col < target ? 1 : -1;
        // Don't walk into hazards
        const nextCol = ninja.col + dir;
        if (!this._tileAt(0, nextCol, 'burn') && !this._tileAt(0, nextCol, 'poison')) {
          g.moveCpu(dir);
        } else {
          g.moveCpu(-dir); // go the other way
        }
        return;
      }
    }

    // PRIORITY 5: Random juke (makes AI less predictable at higher difficulty)
    if (Math.random() < 0.15 + this.difficulty * 0.15) {
      g.moveCpu(this._safeMoveDir(Math.floor(Math.random() * 4)));
    }
  }

  // ── Card play AI ───────────────────────────────────────────
  _decideCard() {
    const g = this.game;
    const hp = g.cpuNinja;

    // ── Emergency items first (heal when low, shield when exposed) ──
    const itemSlot = g.cpuHand[2];
    if (itemSlot.card && itemSlot.state === 'ready') {
      const card = itemSlot.card;

      // Heal: scale threshold with difficulty (smart AI heals earlier)
      const healThreshold = 0.4 + this.difficulty * 0.25; // 0.4–0.65 of maxHp
      if (card.effect === 'heal' && hp.hp < hp.maxHp * healThreshold) {
        g.cpuPlayCard(2); return;
      }
      // Also heal if poisoned and below 70%
      if (card.effect === 'heal' && hp.poison > 0 && hp.hp < hp.maxHp * 0.7) {
        g.cpuPlayCard(2); return;
      }
      // Shield when we have none and will likely be attacked
      if (card.effect === 'shield' && hp.shield === 0) {
        g.cpuPlayCard(2); return;
      }
      // Dodge when aligned with player (they're about to hit us)
      if (card.effect === 'dodge' && g.playerNinja.col === hp.col && Math.random() < this.difficulty) {
        g.cpuPlayCard(2); return;
      }
      // Boost before attacking (if attack is ready in slot 0)
      if (card.effect === 'boost' && g.cpuHand[0].card && g.cpuHand[0].state === 'ready') {
        g.cpuPlayCard(2); return;
      }
      // Speed when we need to reposition
      if (card.effect === 'speed' && hp.speedTimer <= 0 && Math.random() < this.difficulty) {
        g.cpuPlayCard(2); return;
      }
      // AOE when player has 2+ summons
      if (card.effect === 'aoe' && this._playerSummonCount() >= 2) {
        g.cpuPlayCard(2); return;
      }
      // AOE with 1 summon at higher difficulty
      if (card.effect === 'aoe' && this._playerSummonCount() >= 1 && Math.random() < this.difficulty * 0.5) {
        g.cpuPlayCard(2); return;
      }
    }

    // ── Attacks — prefer when aligned or using ranged ──
    const atkSlot = g.cpuHand[0];
    if (atkSlot.card && atkSlot.state === 'ready') {
      const card = atkSlot.card;
      const aligned = hp.col === g.playerNinja.col;
      const hasSummonTarget = g.grid[2][hp.col] != null;

      // Melee/hitscan: only fire when aligned with a target
      if (card.melee || card.hitscan) {
        if (aligned || hasSummonTarget) {
          g.cpuPlayCard(0); return;
        }
      } else {
        // Projectile: fire if aligned, or fire anyway at decent difficulty
        if (aligned || hasSummonTarget || Math.random() < this.difficulty * 0.4) {
          g.cpuPlayCard(0); return;
        }
      }
    }

    // ── Summons — prefer player ninja column or columns with no hazards ──
    const sumSlot = g.cpuHand[1];
    if (sumSlot.card && sumSlot.state === 'ready') {
      // Try to summon in player ninja's column first (to block/attack)
      const preferred = g.playerNinja.col;
      if (!g.grid[1][preferred] && Math.random() < this.difficulty) {
        // Temporarily set cpu col to preferred for summon placement
        const origCol = hp.col;
        // Can only summon in own column, so skip if not aligned
        if (hp.col === preferred) {
          g.cpuPlayCard(1); return;
        }
      }
      // Otherwise summon in current column if open
      if (!g.grid[1][hp.col]) {
        g.cpuPlayCard(1); return;
      }
    }

    // ── Fallback: play what's available ──
    if (Math.random() < 0.25 + this.difficulty * 0.35) {
      for (const i of [2, 0, 1]) {
        if (g.cpuHand[i].card && g.cpuHand[i].state === 'ready') {
          g.cpuPlayCard(i); return;
        }
      }
    }
  }
}
