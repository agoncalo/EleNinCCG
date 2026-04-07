// ============================================================
// main.js — Entry point, screen management
// ============================================================

const ScreenManager = {
  screens: ['menu', 'chapters', 'enemies', 'deck', 'mp-lobby', 'how-to-play', 'game'],
  show(id) {
    for (const s of this.screens) {
      document.getElementById('screen-' + s).classList.toggle('hidden', s !== id);
    }
  }
};

// ── Toast notification (replaces alert) ──────────────────────
function showToast(msg, duration) {
  duration = duration || 2500;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    el.addEventListener('transitionend', () => el.remove());
  }, duration);
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Storage.init();

  // Main menu buttons
  document.getElementById('btn-play').onclick       = () => Menu.showChapters();
  document.getElementById('btn-mp').onclick         = () => Multiplayer.showLobby();
  document.getElementById('btn-deck').onclick       = () => DeckEditor.show();
  document.getElementById('btn-help').onclick       = () => ScreenManager.show('how-to-play');

  // Back buttons
  document.getElementById('btn-back-menu').onclick   = () => Menu.showMain();
  document.getElementById('btn-back-menu2').onclick  = () => Menu.showMain();
  document.getElementById('btn-back-menu3').onclick  = () => Menu.showMain();
  document.getElementById('btn-back-chapters').onclick = () => Menu.showChapters();
  document.getElementById('btn-back-mp').onclick     = () => { Multiplayer.disconnect(); Menu.showMain(); };

  // Audio toggles
  document.getElementById('btn-toggle-music').onclick = () => {
    const muted = !Music.muted;
    Music.setMuted(muted);
    document.getElementById('btn-toggle-music').textContent = muted ? '🎵 Music: OFF' : '🎵 Music: ON';
  };
  document.getElementById('btn-toggle-sfx').onclick = () => {
    SFX.muted = !SFX.muted;
    document.getElementById('btn-toggle-sfx').textContent = SFX.muted ? '🔇 SFX: OFF' : '🔊 SFX: ON';
  };

  // Show main menu
  Menu.showMain();
});
