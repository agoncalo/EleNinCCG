// ============================================================
// main.js — Entry point, screen management
// ============================================================

const ScreenManager = {
  screens: ['menu', 'chapters', 'enemies', 'deck', 'game'],
  show(id) {
    for (const s of this.screens) {
      document.getElementById('screen-' + s).classList.toggle('hidden', s !== id);
    }
  }
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Storage.init();

  // Main menu buttons
  document.getElementById('btn-play').onclick       = () => Menu.showChapters();
  document.getElementById('btn-deck').onclick       = () => DeckEditor.show();

  // Back buttons
  document.getElementById('btn-back-menu').onclick   = () => Menu.showMain();
  document.getElementById('btn-back-menu2').onclick  = () => Menu.showMain();
  document.getElementById('btn-back-chapters').onclick = () => Menu.showChapters();

  // Show main menu
  Menu.showMain();
});
