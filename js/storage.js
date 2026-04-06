// ============================================================
// storage.js — localStorage wrappers for collection, deck, progress
// ============================================================

const Storage = {
  _key(name) { return 'eleninccg_' + name; },

  _get(name, fallback) {
    try {
      const raw = localStorage.getItem(this._key(name));
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },

  _set(name, value) {
    localStorage.setItem(this._key(name), JSON.stringify(value));
  },

  // ── Collection: { cardId: count } ──────────────────────────
  getCollection() {
    return this._get('collection', null);
  },
  saveCollection(col) { this._set('collection', col); },

  // ── Deck: array of card IDs ────────────────────────────────
  getDeck() {
    const raw = this._get('deck', null);
    if (!raw) return null;
    // Migrate old single-array deck to 3-deck format
    if (Array.isArray(raw)) {
      const migrated = { z: [], x: [], c: [] };
      for (const id of raw) {
        const card = CARD_DB[id];
        if (!card) continue;
      if (card.type === 'attack' || (card.type === 'equipment' && card.damage)) migrated.z.push(id);
        else if (card.type === 'summon') migrated.x.push(id);
        else migrated.c.push(id);
      }
      this.saveDeck(migrated);
      return migrated;
    }
    return raw;
  },
  saveDeck(deck) { this._set('deck', deck); },

  // ── Progress ───────────────────────────────────────────────
  getProgress() {
    return this._get('progress', null);
  },
  saveProgress(prog) { this._set('progress', prog); },

  // ── Initialize defaults if first visit ─────────────────────
  init() {
    if (!this.getCollection()) {
      this.saveCollection({ ...STARTER_COLLECTION });
    }
    if (!this.getDeck()) {
      this.saveDeck({ z: [...STARTER_DECK.z], x: [...STARTER_DECK.x], c: [...STARTER_DECK.c] });
    }
    if (!this.getProgress()) {
      this.saveProgress({
        unlockedChapters: [1],
        defeatedEnemies: []
      });
    }
  },

  // ── Helpers ────────────────────────────────────────────────
  isEnemyDefeated(enemyId) {
    return this.getProgress().defeatedEnemies.includes(enemyId);
  },

  defeatEnemy(enemyId) {
    const prog = this.getProgress();
    if (!prog.defeatedEnemies.includes(enemyId)) {
      prog.defeatedEnemies.push(enemyId);
    }
    this.saveProgress(prog);
  },

  unlockChapter(chapterNum) {
    const prog = this.getProgress();
    if (!prog.unlockedChapters.includes(chapterNum)) {
      prog.unlockedChapters.push(chapterNum);
    }
    this.saveProgress(prog);
  },

  addCardsToCollection(cardIds) {
    const col = this.getCollection();
    for (const id of cardIds) {
      col[id] = (col[id] || 0) + 1;
    }
    this.saveCollection(col);
  },

  isChapterUnlocked(chapterNum) {
    return this.getProgress().unlockedChapters.includes(chapterNum);
  },

  isBossUnlocked(chapter) {
    const prog = this.getProgress();
    const nonBoss = chapter.enemies.filter(e => !e.isBoss);
    return nonBoss.every(e => prog.defeatedEnemies.includes(e.id));
  }
};
