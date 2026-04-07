// ============================================================
// menu.js — Main menu, chapter select, enemy select screens
// ============================================================

const Menu = {

  // ── Main Menu ──────────────────────────────────────────────
  showMain() {
    ScreenManager.show('menu');
    Music.play('menu');
  },

  // ── Chapter Select ─────────────────────────────────────────
  showChapters() {
    ScreenManager.show('chapters');
    const list = document.getElementById('chapter-list');
    list.innerHTML = '';
    const progress = Storage.getProgress();

    for (const ch of CHAPTERS) {
      const unlocked = progress.unlockedChapters.includes(ch.id);
      const div = document.createElement('div');
      div.className = 'chapter-card' + (unlocked ? '' : ' locked');

      // Count defeated enemies for progress display
      const defeated = ch.enemies.filter(e => progress.defeatedEnemies.includes(e.id)).length;

      div.innerHTML = `
        <div class="chapter-icon">${ch.icon}</div>
        <div class="chapter-name">${ch.name}</div>
        <div class="chapter-progress">${defeated}/${ch.enemies.length}</div>
        ${unlocked ? '' : '<div class="lock-overlay">🔒</div>'}
      `;
      if (unlocked) {
        div.onclick = () => Menu.showEnemies(ch);
      }
      list.appendChild(div);
    }
  },

  // ── Enemy Select ───────────────────────────────────────────
  showEnemies(chapter) {
    ScreenManager.show('enemies');
    document.getElementById('chapter-title').textContent = chapter.icon + ' ' + chapter.name;

    const list = document.getElementById('enemy-list');
    list.innerHTML = '';
    const progress = Storage.getProgress();
    const bossUnlocked = Storage.isBossUnlocked(chapter);

    // Separate boss and non-boss
    const nonBoss = chapter.enemies.filter(e => !e.isBoss);
    const boss    = chapter.enemies.find(e => e.isBoss);

    // Render non-boss enemies in a row
    const row = document.createElement('div');
    row.className = 'enemy-row';
    for (const enemy of nonBoss) {
      const defeated = progress.defeatedEnemies.includes(enemy.id);
      const eEl = enemy.element || 'normal';
      const div = document.createElement('div');
      div.className = 'enemy-card' + (defeated ? ' defeated' : '');
      div.innerHTML = `
        <div class="enemy-portrait">${enemy.portrait}</div>
        <div class="enemy-name">${enemy.name}</div>
        <span class="elem-badge" style="background:${elementColor(eEl)}">${elementIcon(eEl)} ${elementName(eEl)}</span>
        <div class="enemy-hp">HP: ${enemy.hp}</div>
        ${defeated ? '<div class="check-mark">✓</div>' : ''}
      `;
      div.onclick = () => Menu.startBattle(enemy);
      row.appendChild(div);
    }
    list.appendChild(row);

    // Render boss centered below
    if (boss) {
      const bossDiv = document.createElement('div');
      bossDiv.className = 'boss-row';
      const bossCard = document.createElement('div');
      const bossDefeated = progress.defeatedEnemies.includes(boss.id);
      bossCard.className = 'enemy-card boss-card' + (bossUnlocked ? '' : ' locked') + (bossDefeated ? ' defeated' : '');
      const bEl = boss.element || 'normal';
      bossCard.innerHTML = `
        <div class="enemy-portrait boss-portrait">${boss.portrait}</div>
        <div class="enemy-name">${boss.name}</div>
        <span class="elem-badge" style="background:${elementColor(bEl)}">${elementIcon(bEl)} ${elementName(bEl)}</span>
        <div class="enemy-hp">HP: ${boss.hp}</div>
        ${!bossUnlocked ? '<div class="lock-overlay">🔒</div>' : ''}
        ${bossDefeated ? '<div class="check-mark">✓</div>' : ''}
      `;
      if (bossUnlocked) {
        bossCard.onclick = () => Menu.startBattle(boss);
      }
      bossDiv.appendChild(bossCard);
      list.appendChild(bossDiv);
    }

    // Store reference for back button
    Menu._currentChapter = chapter;
  },

  // ── Start a battle ─────────────────────────────────────────
  startBattle(enemy) {
    const deck = Storage.getDeck();
    if (!deck) {
      alert('No deck found! Edit your deck first.');
      return;
    }
    const col = Storage.getCollection();
    const slots = [
      { key: 'z', label: 'Z (Attack)', test: c => c.type === 'attack' || (c.type === 'equipment' && c.damage) },
      { key: 'x', label: 'X (Summon)', test: c => c.type === 'summon' },
      { key: 'c', label: 'C (Item)',   test: c => c.type === 'item' || (c.type === 'equipment' && !c.damage) }
    ];
    for (const s of slots) {
      let avail = 0;
      for (const id of Object.keys(col)) { const c = CARD_DB[id]; if (c && s.test(c)) avail += col[id]; }
      const min = Math.min(10, avail);
      if (deck[s.key].length < min) {
        alert(`${s.label} deck needs at least ${min} cards! Edit your deck first.`);
        return;
      }
    }

    ScreenManager.show('game');

    const game = new Game(deck, enemy, (action) => {
      if (action === 'retry') {
        Menu.startBattle(enemy);
      } else {
        Menu.showChapters();
      }
    });
    game.start();
  }
};
