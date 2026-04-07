// ============================================================
// multiplayer.js — PeerJS multiplayer networking + lobby
// ============================================================

const Multiplayer = {
  peer: null,
  conn: null,
  isHost: false,
  roomCode: '',
  _game: null,

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
        <div class="mp-code-label">Share this Room Code:</div>
        <div class="mp-code" id="mp-room-code">...</div>
        <div class="mp-status" id="mp-status">Setting up room...</div>
      </div>
    `;

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

  disconnect() {
    if (this._game) {
      this._game.stop();
      this._game = null;
    }
    if (this.conn) { try { this.conn.close(); } catch(e) {} }
    if (this.peer) { try { this.peer.destroy(); } catch(e) {} }
    this.conn = null;
    this.peer = null;
    this.isHost = false;
    this.roomCode = '';
  },

  // ══════════════════════════════════════════════════════════
  //  MESSAGE HANDLING
  // ══════════════════════════════════════════════════════════
  _onMessage(msg) {
    if (this.isHost) {
      if (msg.type === 'deck') {
        this._startHostGame(msg.deck);
      } else if (msg.type === 'input') {
        if (this._game) {
          this._game.applyRemoteInput(msg);
        }
      }
    } else {
      if (msg.type === 'game-start') {
        this._startGuestGame(msg.config);
      } else if (msg.type === 'state') {
        if (this._game) {
          this._game.applyRemoteState(msg.state);
        }
      } else if (msg.type === 'game-end') {
        if (this._game) {
          // Invert playerWon for guest perspective
          this._game._endGame(!msg.playerWon, msg.reason);
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

    const enemyData = {
      id: 'mp_guest',
      name: 'Player 2',
      portrait: '🥷',
      hp: 30,
      element: 'normal',
      deck: guestDeckFlat,
      difficulty: 0.5,
      trophyLimit: 15
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

    // Tell guest game is starting
    this.send({ type: 'game-start', config: { trophyLimit: 15 } });
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
    game.start(); // buildDOM + key listeners, no game loop for guest
  }
};
