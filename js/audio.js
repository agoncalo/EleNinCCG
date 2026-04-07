// ── Sound System (Web Audio API) ─────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function ensureAudio() { if (audioCtx.state === 'suspended') audioCtx.resume(); }
document.addEventListener('keydown', ensureAudio, { once: true });
document.addEventListener('click', ensureAudio, { once: true });
document.addEventListener('mousedown', ensureAudio, { once: true });
document.addEventListener('mousemove', ensureAudio, { once: true });
document.addEventListener('touchstart', ensureAudio, { once: true });
document.addEventListener('pointerdown', ensureAudio, { once: true });

const SFX = {
  muted: false,
  play(freq, type, duration, vol = 0.15, slide = 0) {
    if (this.muted) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, audioCtx.currentTime + duration);
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + duration);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  },
  noise(duration, vol = 0.08) {
    if (this.muted) return;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    src.connect(g); g.connect(audioCtx.destination);
    src.start(); src.stop(audioCtx.currentTime + duration);
    src.onended = () => { src.disconnect(); g.disconnect(); };
  },
  attack() { this.play(320, 'square', 0.08, 0.1, 200); },
  hit() { this.play(200, 'square', 0.1, 0.12, -100); this.noise(0.1, 0.1); },
  enemyDie() { this.play(400, 'square', 0.12, 0.1, -300); this.noise(0.1, 0.08); },
  playerHurt() { this.play(150, 'sawtooth', 0.2, 0.12, -80); },
  jump() { this.play(260, 'square', 0.1, 0.06, 180); },
  special() { this.play(500, 'triangle', 0.15, 0.1, 200); },
  parry() { this.play(800, 'square', 0.06, 0.12); this.play(1200, 'square', 0.08, 0.08); },
  parryFail() { this.play(200, 'triangle', 0.1, 0.06, -50); },
  shuriken() { this.play(600, 'triangle', 0.08, 0.06, 300); },
  bossDie() { this.play(300, 'sawtooth', 0.3, 0.15, -250); this.noise(0.3, 0.12); this.play(150, 'square', 0.4, 0.1, -100); },
  bossSpawn() { this.play(100, 'sawtooth', 0.3, 0.12, 100); this.play(200, 'square', 0.4, 0.08, 50); },
  wave() { this.play(440, 'triangle', 0.15, 0.1); setTimeout(() => this.play(660, 'triangle', 0.15, 0.1), 120); setTimeout(() => this.play(880, 'triangle', 0.2, 0.1), 240); },
  armor() { this.play(600, 'triangle', 0.1, 0.1); this.play(900, 'triangle', 0.15, 0.08); },
  chain() { this.play(700, 'square', 0.05, 0.08, 200); },
  slam() { this.play(80, 'sawtooth', 0.2, 0.15, -40); this.noise(0.15, 0.1); },
  pickup() { this.play(520, 'triangle', 0.08, 0.1); setTimeout(() => this.play(780, 'triangle', 0.1, 0.1), 80); },
  reflect() { this.play(1000, 'square', 0.06, 0.1, -400); },
  miss() { this.play(180, 'triangle', 0.12, 0.06, -60); },
  backstab() { this.play(300, 'sawtooth', 0.05, 0.1); this.play(600, 'square', 0.1, 0.12, 200); },
  counterSwish() { this.noise(0.18, 0.12); this.play(900, 'sawtooth', 0.15, 0.1, -600); this.play(400, 'triangle', 0.1, 0.08, 300); },
  victory() { [440,550,660,880].forEach((f,i) => setTimeout(() => this.play(f, 'triangle', 0.25, 0.12), i * 150)); },
  bossRoar() {
    // Deep, sustained growl — layered low oscillators + rumble
    this.play(38, 'sawtooth', 0.9, 0.2, -15);
    this.play(42, 'square', 0.8, 0.1, -10);
    this.play(55, 'sawtooth', 0.7, 0.14, -25);
    this.noise(0.7, 0.18);
    setTimeout(() => {
      this.play(32, 'sawtooth', 0.6, 0.18, -12);
      this.play(48, 'square', 0.5, 0.08, -18);
      this.noise(0.5, 0.14);
    }, 250);
    setTimeout(() => {
      this.play(28, 'sawtooth', 0.5, 0.15, -8);
      this.noise(0.4, 0.1);
    }, 550);
  },
};
