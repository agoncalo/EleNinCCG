// ============================================================
// deck.js — Deck editor screen (3 decks: Z/X/C)
// ============================================================

const DeckEditor = {
  _deckZ: [],
  _deckX: [],
  _deckC: [],
  _activeTab: 'z',

  show() {
    ScreenManager.show('deck');
    const saved = Storage.getDeck();
    this._deckZ = [...saved.z];
    this._deckX = [...saved.x];
    this._deckC = [...saved.c];
    this._activeTab = 'z';
    this.buildUI();
  },

  _getActiveDeck() {
    if (this._activeTab === 'z') return this._deckZ;
    if (this._activeTab === 'x') return this._deckX;
    return this._deckC;
  },

  _getFilterTypes() {
    if (this._activeTab === 'x') return ['summon'];
    return null; // filtered manually below
  },

  _getTabLabel(tab) {
    if (tab === 'z') return 'Z \u2013 Attack';
    if (tab === 'x') return 'X \u2013 Summon';
    return 'C \u2013 Item';
  },

  _maxAvailableForSlot(tab) {
    const col = Storage.getCollection();
    let total = 0;
    for (const id of Object.keys(col)) {
      const card = CARD_DB[id];
      if (!card) continue;
      if (tab === 'z' && (card.type === 'attack' || (card.type === 'equipment' && card.damage))) total += col[id];
      else if (tab === 'x' && card.type === 'summon') total += col[id];
      else if (tab === 'c' && (card.type === 'item' || (card.type === 'equipment' && !card.damage))) total += col[id];
    }
    return total;
  },

  _minForSlot(tab) {
    return Math.min(10, this._maxAvailableForSlot(tab));
  },

  buildUI() {
    const container = document.getElementById('deck-editor');
    container.innerHTML = '';

    // ── Left panel: Collection ──────────────────────────────
    const colPanel = document.createElement('div');
    colPanel.id = 'collection-panel';

    // Tab buttons
    const tabBar = document.createElement('div');
    tabBar.className = 'filter-bar';
    for (const tab of ['z', 'x', 'c']) {
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (this._activeTab === tab ? ' active' : '');
      btn.textContent = this._getTabLabel(tab);
      btn.onclick = () => { this._activeTab = tab; this.buildUI(); };
      tabBar.appendChild(btn);
    }
    colPanel.appendChild(tabBar);

    // Card grid
    const grid = document.createElement('div');
    grid.className = 'collection-grid';
    const col = Storage.getCollection();
    const filterTypes = this._getFilterTypes();
    const activeDeck = this._getActiveDeck();

    const rarityOrder = { common: 0, uncommon: 1, rare: 2, ultra_rare: 3 };
    const cardIds = Object.keys(col).sort((a, b) => {
      const ca = CARD_DB[a], cb = CARD_DB[b];
      if (ca.type !== cb.type) return ca.type.localeCompare(cb.type);
      return (rarityOrder[ca.rarity] || 0) - (rarityOrder[cb.rarity] || 0);
    });

    for (const id of cardIds) {
      if (!CARD_DB[id]) continue;
      const card = CARD_DB[id];
      // Z shows attacks + damage equipment; C shows items + defensive equipment
      if (filterTypes) {
        if (!filterTypes.includes(card.type)) continue;
      } else if (this._activeTab === 'z') {
        if (!(card.type === 'attack' || (card.type === 'equipment' && card.damage))) continue;
      } else {
        if (!(card.type === 'item' || (card.type === 'equipment' && !card.damage))) continue;
      }
      const owned = col[id];
      const inDeck = activeDeck.filter(d => d === id).length;
      const canAdd = inDeck < owned && activeDeck.length < 10;

      const div = document.createElement('div');
      div.className = 'col-card' + (canAdd ? '' : ' maxed');
      div.style.borderColor = cardColor(card.type);

      let statsLine = '';
      if (card.type === 'attack')    statsLine = `\u2694 ${card.damage} DMG`;
      if (card.type === 'item')      statsLine = card.description;
      if (card.type === 'summon')    statsLine = `\u2665${card.hp} \u2694${card.atk}`;
      if (card.type === 'equipment') statsLine = card.description;

      div.innerHTML = `
        <div class="col-card-type" style="background:${cardColor(card.type)}">${card.type.toUpperCase()}</div>
        <div class="card-art small" data-card-id="${id}"><span class="sticker">${card.sticker}</span></div>
        <div class="col-card-name" style="color:${rarityColor(card.rarity)}">${card.name}</div>
        <div class="col-card-rarity" style="color:${rarityColor(card.rarity)}">${card.rarity.replace('_',' ')}</div>
        <div class="col-card-stats">${statsLine}</div>
        <div class="col-card-count">${inDeck} / ${owned}</div>
      `;
      if (canAdd) {
        div.onclick = () => { this._addCard(id); };
      }
      grid.appendChild(div);
    }
    colPanel.appendChild(grid);

    // ── Right panel: Current Deck ───────────────────────────
    const deckPanel = document.createElement('div');
    deckPanel.id = 'deck-panel';

    const deckHeader = document.createElement('div');
    deckHeader.className = 'deck-header';
    const minCards = this._minForSlot(this._activeTab);
    deckHeader.innerHTML = `<h3>${this._getTabLabel(this._activeTab)} (${activeDeck.length}/10)</h3><span class="deck-hint">Min ${minCards} | Max 10</span>`;
    deckPanel.appendChild(deckHeader);

    const deckList = document.createElement('div');
    deckList.className = 'deck-list';

    const deckGroups = {};
    for (const id of activeDeck) {
      deckGroups[id] = (deckGroups[id] || 0) + 1;
    }

    const sortedDeckIds = Object.keys(deckGroups).sort((a, b) => {
      const ca = CARD_DB[a], cb = CARD_DB[b];
      if (ca.type !== cb.type) return ca.type.localeCompare(cb.type);
      return ca.name.localeCompare(cb.name);
    });

    for (const id of sortedDeckIds) {
      const card = CARD_DB[id];
      if (!card) continue;
      const count = deckGroups[id];
      const row = document.createElement('div');
      row.className = 'deck-row';
      row.style.borderLeft = '4px solid ' + cardColor(card.type);
      row.innerHTML = `
        <span class="deck-row-name">${card.name}</span>
        <span class="deck-row-count">\u00d7${count}</span>
        <button class="deck-row-remove" title="Remove one">\u2212</button>
      `;
      row.querySelector('.deck-row-remove').onclick = () => { this._removeCard(id); };
      deckList.appendChild(row);
    }
    deckPanel.appendChild(deckList);

    // Deck overview (all 3 decks)
    const overview = document.createElement('div');
    overview.className = 'deck-overview';
    overview.innerHTML = `
      <div class="deck-ov-item ${this._activeTab==='z'?'active':''}">Z: ${this._deckZ.length}/10</div>
      <div class="deck-ov-item ${this._activeTab==='x'?'active':''}">X: ${this._deckX.length}/10</div>
      <div class="deck-ov-item ${this._activeTab==='c'?'active':''}">C: ${this._deckC.length}/10</div>
    `;
    deckPanel.appendChild(overview);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'deck-save-btn';
    saveBtn.textContent = 'Save All Decks';
    saveBtn.onclick = () => { this.save(); };
    deckPanel.appendChild(saveBtn);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'deck-clear-btn';
    clearBtn.textContent = 'Clear This Deck';
    clearBtn.onclick = () => {
      if (this._activeTab === 'z') this._deckZ = [];
      else if (this._activeTab === 'x') this._deckX = [];
      else this._deckC = [];
      this.buildUI();
    };
    deckPanel.appendChild(clearBtn);

    container.appendChild(colPanel);
    container.appendChild(deckPanel);
  },

  _addCard(id) {
    const deck = this._getActiveDeck();
    if (deck.length >= 10) return;
    deck.push(id);
    this.buildUI();
  },

  _removeCard(id) {
    const deck = this._getActiveDeck();
    const idx = deck.indexOf(id);
    if (idx !== -1) {
      deck.splice(idx, 1);
      this.buildUI();
    }
  },

  save() {
    const slots = ['z', 'x', 'c'];
    const decks = { z: this._deckZ, x: this._deckX, c: this._deckC };
    for (const tab of slots) {
      const min = this._minForSlot(tab);
      if (decks[tab].length < min) {
        alert(`${this._getTabLabel(tab)} needs at least ${min} cards!`);
        return;
      }
    }
    Storage.saveDeck({ z: [...this._deckZ], x: [...this._deckX], c: [...this._deckC] });
    alert('Decks saved!');
  }
};
