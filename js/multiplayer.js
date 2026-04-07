// ============================================================
// multiplayer.js — PeerJS multiplayer networking + lobby
// ============================================================

const Multiplayer = {
  peer: null,
  conn: null,
  isHost: false,
  roomCode: '',
  _game: null,
  _trophyLimit: 15,

  // ── Netcode state ──────────────────────────────────────────
  _ping: 0,
  _pingTimer: 0,
  _pingSent: 0,
  _inputSeq: 0,
  _pendingInputs: [],   // guest: inputs awaiting server ack
  _lastStateTime: 0,
  _prevState: null,      // for interpolation
  _currState: null,
  _interpAlpha: 1,
  _lastGuestFrame: 0,

  // ── Room code generation ───────────────────────────────────
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  // ══════════════════════════════════════════════════════════
  //  LOBBY UI
  // ══════════════════════════════════════════════════════════
  showLobby() {
    ScreenManager.show('mp-lobby');
    const content = document.getElementById('mp-lobby-content');
    content.innerHTML = `
      <div class="mp-choice">
        <button id="btn-mp-host" class="big-btn mp-btn">🏠 Host Game</button>
        <button id="btn-mp-join" class="big-btn mp-btn">🔗 Join Game</button>
      </div>
    `;
    document.getElementById('btn-mp-host').onclick = () => this._hostGame();
    document.getElementById('btn-mp-join').onclick = () => this._showJoinView();
  },

  _hostGame() {
    // Check deck first
    if (!Storage.getDeck()) {
      alert('No deck found! Set up your deck first.');
      return;
    }

    const content = document.getElementById('mp-lobby-content');
    content.innerHTML = `
      <div class="mp-waiting">
        <div class="mp-setting">
          <label class="mp-code-label">🏆 Trophy Limit:</label>
          <div class="mp-trophy-picker">
            <button class="mp-trophy-btn" data-val="10">10</button>
            <button class="mp-trophy-btn active" data-val="15">15</button>
            <button class="mp-trophy-btn" data-val="20">20</button>
            <button class="mp-trophy-btn" data-val="25">25</button>
            <button class="mp-trophy-btn" data-val="30">30</button>
          </div>
        </div>
        <div class="mp-code-label">Share this Room Code:</div>
        <div class="mp-code" id="mp-room-code">...</div>
        <div class="mp-status" id="mp-status">Setting up room...</div>
      </div>
    `;

    // Trophy limit picker
    this._trophyLimit = 15;
    content.querySelectorAll('.mp-trophy-btn').forEach(btn => {
      btn.onclick = () => {
        content.querySelectorAll('.mp-trophy-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._trophyLimit = parseInt(btn.dataset.val);
      };
    });

    this.createRoom((event) => {
      const codeEl = document.getElementById('mp-room-code');
      const statusEl = document.getElementById('mp-status');
      if (!codeEl || !statusEl) return;

      switch (event.type) {
        case 'room-created':
          codeEl.textContent = event.code;
          statusEl.textContent = '⏳ Waiting for opponent...';
          break;
        case 'peer-connected':
          statusEl.textContent = '✅ Opponent connected! Starting game...';
          break;
        case 'error':
          statusEl.textContent = '❌ Error: ' + (event.error.type || event.error.message || 'Connection failed');
          break;
      }
    });
  },

  _showJoinView() {
    // Check deck first
    if (!Storage.getDeck()) {
      alert('No deck found! Set up your deck first.');
      return;
    }

    const content = document.getElementById('mp-lobby-content');
    content.innerHTML = `
      <div class="mp-join">
        <label class="mp-code-label">Enter Room Code:</label>
        <input type="text" id="mp-code-input" class="mp-code-input" maxlength="5" placeholder="ABCDE" autocomplete="off" spellcheck="false">
        <button id="btn-mp-connect" class="big-btn mp-btn">🔗 Connect</button>
        <div class="mp-status" id="mp-status"></div>
      </div>
    `;

    document.getElementById('btn-mp-connect').onclick = () => {
      const code = document.getElementById('mp-code-input').value.trim();
      if (code.length < 5) {
        document.getElementById('mp-status').textContent = 'Enter a 5-character room code';
        return;
      }
      document.getElementById('mp-status').textContent = '⏳ Connecting...';
      document.getElementById('btn-mp-connect').disabled = true;

      this.joinRoom(code, (event) => {
        const statusEl = document.getElementById('mp-status');
        if (!statusEl) return;

        switch (event.type) {
          case 'connected':
            statusEl.textContent = '✅ Connected! Sending deck...';
            this.send({ type: 'deck', deck: Storage.getDeck() });
            break;
          case 'error':
            statusEl.textContent = '❌ Error: ' + (event.error.type || event.error.message || 'Connection failed');
            const btn = document.getElementById('btn-mp-connect');
            if (btn) btn.disabled = false;
            break;
        }
      });
    };

    // Allow Enter key to connect
    document.getElementById('mp-code-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-mp-connect').click();
    });
  },

  // ══════════════════════════════════════════════════════════
  //  PEERJS NETWORKING
  // ══════════════════════════════════════════════════════════
  createRoom(callback) {
    this.isHost = true;
    this.roomCode = this._generateCode();
    this.peer = new Peer('eleninccg-' + this.roomCode);

    this.peer.on('open', () => {
      callback({ type: 'room-created', code: this.roomCode });
    });

    this.peer.on('connection', (conn) => {
      this.conn = conn;
      conn.on('open', () => {
        callback({ type: 'peer-connected' });
      });
      conn.on('data', (data) => this._onMessage(data));
      conn.on('close', () => this._onDisconnect());
    });

    this.peer.on('error', (err) => {
      callback({ type: 'error', error: err });
    });
  },

  joinRoom(code, callback) {
    this.isHost = false;
    this.roomCode = code.toUpperCase();
    this.peer = new Peer();

    this.peer.on('open', () => {
      this.conn = this.peer.connect('eleninccg-' + this.roomCode);
      this.conn.on('open', () => {
        callback({ type: 'connected' });
      });
      this.conn.on('data', (data) => this._onMessage(data));
      this.conn.on('close', () => this._onDisconnect());
    });

    this.peer.on('error', (err) => {
      callback({ type: 'error', error: err });
    });
  },

  send(data) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  },

  // ── Ping measurement ───────────────────────────────────────
  _startPing() {
    this._pingTimer = setInterval(() => {
      this._pingSent = performance.now();
      this.send({ type: 'ping', t: this._pingSent });
    }, 2000);
  },

  _stopPing() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = 0; }
  },

  disconnect() {
    if (this._game) {
      this._game.stop();
      this._game = null;
    }
    this._stopPing();
    if (this.conn) { try { this.conn.close(); } catch(e) {} }
    if (this.peer) { try { this.peer.destroy(); } catch(e) {} }
    this.conn = null;
    this.peer = null;
    this.isHost = false;
    this.roomCode = '';
    this._inputSeq = 0;
    this._pendingInputs = [];
    this._prevState = null;
    this._currState = null;
    this._interpAlpha = 1;
    this._lastGuestFrame = 0;
  },

  // ══════════════════════════════════════════════════════════
  //  MESSAGE HANDLING
  // ══════════════════════════════════════════════════════════
  _onMessage(msg) {
    // Ping/pong (both sides)
    if (msg.type === 'ping') {
      this.send({ type: 'pong', t: msg.t });
      return;
    }
    if (msg.type === 'pong') {
      this._ping = Math.round(performance.now() - msg.t);
      if (this._game && this._game.el.pingDisplay) {
        this._game.el.pingDisplay.textContent = this._ping + 'ms';
      }
      return;
    }

    if (this.isHost) {
      if (msg.type === 'deck') {
        this._startHostGame(msg.deck);
      } else if (msg.type === 'input') {
        if (this._game) {
          this._game.applyRemoteInput(msg);
          // Ack the input so guest can reconcile
          this.send({ type: 'input-ack', seq: msg.seq });
        }
      }
    } else {
      if (msg.type === 'game-start') {
        this._startGuestGame(msg.config);
      } else if (msg.type === 'state') {
        if (this._game) {
          // Store for interpolation
          this._prevState = this._currState;
          this._currState = msg.state;
          this._lastStateTime = performance.now();
          this._interpAlpha = 0;
          this._game.applyRemoteState(msg.state);
          // Reconcile: re-apply unacknowledged inputs
          this._reconcile(msg.state);
        }
      } else if (msg.type === 'input-ack') {
        // Remove acknowledged inputs
        this._pendingInputs = this._pendingInputs.filter(i => i.seq > msg.seq);
      } else if (msg.type === 'game-end') {
        if (this._game) {
          this._game._endGame(!msg.playerWon, msg.reason);
        }
      }
    }
  },

  // ── Guest: send input with sequence number ─────────────────
  sendInput(action, data) {
    this._inputSeq++;
    const msg = { type: 'input', action, seq: this._inputSeq, ...data };
    this._pendingInputs.push(msg);
    this.send(msg);
  },

  // ── Guest: reconcile predicted state with server state ─────
  _reconcile(serverState) {
    if (!this._game || this._pendingInputs.length === 0) return;
    // Re-apply pending (unacked) inputs on top of server state
    // This is limited to movement prediction for the guest's ninja
    // (which is the CPU ninja from host's perspective, so cN in state)
    const ninja = this._game.playerNinja;
    for (const input of this._pendingInputs) {
      if (input.action === 'move') {
        const newCol = ninja.col + input.dir;
        if (newCol >= 0 && newCol <= 3) {
          ninja.col = newCol;
        }
      }
    }
  },

  _onDisconnect() {
    if (this._game && this._game.running) {
      this._game.running = false;
      this._game.stop();
      const overlay = document.createElement('div');
      overlay.id = 'game-result-overlay';
      overlay.innerHTML = `
        <div class="result-box lose">
          <h2>📡 Disconnected</h2>
          <p style="margin:10px 0;color:#aaa">Your opponent has disconnected.</p>
          <div class="result-buttons">
            <button id="btn-result-back">Back to Menu</button>
          </div>
        </div>
      `;
      document.getElementById('screen-game').appendChild(overlay);
      document.getElementById('btn-result-back').onclick = () => {
        overlay.remove();
        Multiplayer.disconnect();
        Menu.showMain();
      };
    }
  },

  // ══════════════════════════════════════════════════════════
  //  GAME START
  // ══════════════════════════════════════════════════════════
  _startHostGame(guestDeck) {
    const hostDeck = Storage.getDeck();
    if (!hostDeck) { alert('No deck found!'); return; }

    // Flatten guest 3-deck format into single array for enemyData
    const guestDeckFlat = [
      ...(guestDeck.z || []),
      ...(guestDeck.x || []),
      ...(guestDeck.c || [])
    ];

    const tLimit = this._trophyLimit || 15;
    const enemyData = {
      id: 'mp_guest',
      name: 'Player 2',
      portrait: '🥷',
      hp: 30,
      element: 'normal',
      deck: guestDeckFlat,
      difficulty: 0.5,
      trophyLimit: tLimit
    };

    ScreenManager.show('game');

    const game = new Game(hostDeck, enemyData, () => {
      Multiplayer.disconnect();
      Menu.showMain();
    });
    game.isMultiplayer = true;
    game.isHost = true;
    this._game = game;
    game.start();
    this._startPing();

    // Tell guest game is starting
    this.send({ type: 'game-start', config: { trophyLimit: tLimit } });
  },

  _startGuestGame(config) {
    const fakeEnemy = {
      id: 'mp_host',
      name: 'Player 1',
      portrait: '🥷',
      hp: 30,
      element: 'normal',
      deck: [],
      difficulty: 0.5,
      trophyLimit: config.trophyLimit || 15
    };

    ScreenManager.show('game');

    const game = new Game({ z: [], x: [], c: [] }, fakeEnemy, () => {
      Multiplayer.disconnect();
      Menu.showMain();
    });
    game.isMultiplayer = true;
    game.isHost = false;
    this._game = game;
    game.start();
    this._startPing();

    // Start guest interpolation render loop
    this._guestRaf = requestAnimationFrame(() => this._guestLoop());
  },

  // ── Guest render loop: smooth interpolation between state snapshots ──
  _guestLoop() {
    if (!this._game || !this._game.running) return;
    const now = performance.now();

    // Local cooldown/draw timer tick (so the UI countdown stays smooth)
    if (this._lastGuestFrame) {
      const ldt = Math.min(now - this._lastGuestFrame, 100);
      this._game._guestLocalDt += ldt;
      for (let i = 0; i < 3; i++) {
        const s = this._game.playerHand[i];
        if (!s) continue;
        if (s.state === 'cooldown' && s.timer > 0) s.timer = Math.max(0, s.timer - ldt);
        if (s.state === 'drawing' && s.timer > 0) s.timer = Math.max(0, s.timer - ldt);
      }
    }
    this._lastGuestFrame = now;

    // Interpolate between prev and curr state for smooth visuals
    if (this._prevState && this._currState && this._interpAlpha < 1) {
      const elapsed = now - this._lastStateTime;
      this._interpAlpha = Math.min(1, elapsed / 50);
      this._interpolatePositions(this._prevState, this._currState, this._interpAlpha);
    }

    this._game.render();
    this._guestRaf = requestAnimationFrame(() => this._guestLoop());
  },

  // ── Lerp ninja/projectile positions for smooth guest rendering ──
  _interpolatePositions(prev, curr, t) {
    if (!this._game) return;
    const g = this._game;
    // Lerp player ninja col (guest's = host's cN)
    const prevPCol = prev.cN.col;
    const currPCol = curr.cN.col;
    g.playerNinja.col = prevPCol + (currPCol - prevPCol) * t;
    // Lerp enemy ninja col (guest's = host's pN)
    const prevECol = prev.pN.col;
    const currECol = curr.pN.col;
    g.cpuNinja.col = prevECol + (currECol - prevECol) * t;
    // Lerp projectile Y positions
    if (prev.proj && curr.proj) {
      for (let i = 0; i < g.projectiles.length && i < prev.proj.length && i < curr.proj.length; i++) {
        const pY = 3 - prev.proj[i].y;
        const cY = 3 - curr.proj[i].y;
        g.projectiles[i].y = pY + (cY - pY) * t;
      }
    }
  }
};
