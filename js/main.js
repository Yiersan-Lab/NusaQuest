class GameEngine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.currentMapId = 'village';
    this.currentMap = MAPS[this.currentMapId] || {
      id: 'village', name: 'Desa NusaQuest', width: 16, height: 10, tileSize: 48, spawnX: 7, spawnY: 4,
      ground: Array.from({ length: 10 }, () => Array(16).fill(0)),
      objects: Array.from({ length: 10 }, () => Array(16).fill('.')),
      collision: Array.from({ length: 10 }, () => Array(16).fill(0))
    };

    this.tileSize = this.currentMap.tileSize || 48;

    this.player = new Player(this.currentMap.spawnX || 7, this.currentMap.spawnY || 4, this.getTileSize());
    this.player.onPositionChange = () => this.savePlayerPosition();
    this.npcManager = new NpcManager();
    this.uiManager = new UIManager();
    this.questEngine = new QuestEngine(this.uiManager);
    this.uiManager.setQuestEngine(this.questEngine);

    this.activeDialogueNpc = null;
    this.activeDialogueStep = 0;
    this.isGeneratingQuiz = false;
    this.pendingQuiz = null;
    this.keysPressed = {};

    this.isWarping = false;
    this.warpPhase = null;
    this.warpStartTime = 0;
    this.warpDuration = 300;
    this.pendingWarp = null;
    this.warpCooldownArea = null;
    this.isTitleScreen = !!document.getElementById('startScreen');

    this.updateCanvasDimensions();
    this.bindInputs();
    this.bindTouchControls();
  }

  savePlayerPosition() {
    if (!this.player || !this.currentMapId) return;
    try {
      if (typeof localStorage !== 'undefined') {
        const data = {
          mapId: this.currentMapId,
          tileX: this.player.tileX,
          tileY: this.player.tileY,
          dir: this.player.dir
        };
        localStorage.setItem('NUSAQUEST_PLAYER_POSITION', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('[GameEngine] Failed to save player position to localStorage:', e);
    }
  }

  loadPlayerPosition() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('NUSAQUEST_PLAYER_POSITION');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.mapId === 'string' && MAPS[parsed.mapId]) {
            const map = MAPS[parsed.mapId];
            const tx = typeof parsed.tileX === 'number' ? parsed.tileX : (map.spawnX !== undefined ? map.spawnX : 7);
            const ty = typeof parsed.tileY === 'number' ? parsed.tileY : (map.spawnY !== undefined ? map.spawnY : 4);
            const dir = typeof parsed.dir === 'number' ? parsed.dir : (map.spawnDir !== undefined ? map.spawnDir : 0);

            if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
              if (!map.collision || !map.collision[ty] || map.collision[ty][tx] !== 1) {
                return {
                  mapId: parsed.mapId,
                  tileX: tx,
                  tileY: ty,
                  dir: dir
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[GameEngine] Failed to load player position from localStorage:', e);
    }
    return null;
  }

  clearPlayerPosition() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('NUSAQUEST_PLAYER_POSITION');
      }
    } catch (e) {
      console.warn('[GameEngine] Failed to clear player position:', e);
    }
  }

  getTileSize() {
    return this.tileSize || (this.currentMap && this.currentMap.tileSize) || 48;
  }

  setTileSize(newSize) {
    const size = parseInt(newSize, 10);
    if (!isNaN(size) && size >= 16 && size <= 128) {
      this.tileSize = size;
      if (this.currentMap) this.currentMap.tileSize = size;
      this.updateCanvasDimensions();
      this.player.updatePixelPosition(size);
      const select = document.getElementById('tileSizeSelect');
      if (select && select.value !== String(size)) {
        select.value = String(size);
      }
    }
  }

  updateCanvasDimensions() {
    const ts = this.getTileSize();
    const mapW = this.currentMap ? this.currentMap.width : 16;
    const mapH = this.currentMap ? this.currentMap.height : 10;

    this.canvas.width = mapW * ts;
    this.canvas.height = mapH * ts;

    const container = document.getElementById('canvasContainer');
    if (container) {
      container.style.width = `${this.canvas.width}px`;
      container.style.height = `${this.canvas.height}px`;
    }
  }

  initMap(mapId = 'village', spawnX = null, spawnY = null, spawnDir = null) {
    if (MAPS[mapId]) {
      this.currentMapId = mapId;
      this.currentMap = MAPS[mapId];
      if (this.currentMap.tileSize) {
        this.tileSize = this.currentMap.tileSize;
      }
      this.updateCanvasDimensions();
      const targetX = (spawnX !== null && spawnX !== undefined) ? spawnX : (this.currentMap.spawnX !== undefined ? this.currentMap.spawnX : 7);
      const targetY = (spawnY !== null && spawnY !== undefined) ? spawnY : (this.currentMap.spawnY !== undefined ? this.currentMap.spawnY : 4);
      const targetDir = (spawnDir !== null && spawnDir !== undefined) ? spawnDir : (this.currentMap.spawnDir !== undefined ? this.currentMap.spawnDir : 0);

      this.player.setPosition(
        targetX,
        targetY,
        targetDir,
        this.getTileSize()
      );
      if (window.SoundManager) {
        window.SoundManager.updateAmbientForMap(this.currentMapId, this.currentMap ? this.currentMap.name : '');
      }
      this.savePlayerPosition();
    }
  }

  showTitleScreen() {
    const startScreen = document.getElementById('startScreen');
    if (!startScreen) return;
    this.isTitleScreen = true;
    startScreen.classList.remove('start-exit');
    if (this.uiManager) {
      if (typeof this.uiManager.hideHudPanels === 'function') {
        this.uiManager.hideHudPanels();
      }
      this.uiManager.toggleNotebook(false);
      this.uiManager.toggleQuestTracker(false);
      this.uiManager.hideDialogue();
      this.uiManager.hideQuizModal();
      this.uiManager.hideQuestModalUI();
      if (typeof this.uiManager.hideStatsModal === 'function') {
        this.uiManager.hideStatsModal();
      }
      if (typeof this.uiManager.hideActivitySummary === 'function') {
        this.uiManager.hideActivitySummary();
      }
    }
  }

  hideTitleScreen() {
    if (!this.isTitleScreen) return;
    if (window.SoundManager) {
      window.SoundManager.initialized = true;
      if (this.currentMapId) {
        window.SoundManager.updateAmbientForMap(this.currentMapId, this.currentMap ? this.currentMap.name : '');
      }
    }
    if (this.uiManager) {
      if (typeof this.uiManager.showHudPanels === 'function') {
        this.uiManager.showHudPanels();
      }
      this.uiManager.toggleNotebook(false);
      this.uiManager.toggleQuestTracker(false);
    }
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
      startScreen.classList.add('start-exit');
    }
    setTimeout(() => {
      this.isTitleScreen = false;
    }, 600);
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (typeof window.handleKeybindCapture === 'function' && window.handleKeybindCapture(e)) {
        return;
      }

      this.keysPressed[e.code] = true;

      const binds = window.KEYBINDS || {
        interact: ['KeyE'],
        notebook: ['KeyN', 'Tab'],
        quest: ['KeyQ'],
        stats: ['KeyL', 'KeyP'],
        sound: ['KeyM']
      };

      const matches = (action) => {
        const list = binds[action] || [];
        return list.includes(e.code);
      };

      if (e.code === 'Escape') {
        e.preventDefault();
        const optionsModal = document.getElementById('optionsModal');
        if (optionsModal && !optionsModal.classList.contains('hidden')) {
          optionsModal.classList.add('hidden');
          return;
        }
        if (this.isTitleScreen) {
          this.hideTitleScreen();
          return;
        }
        if (this.uiManager) {
          if (this.uiManager.isActivitySummaryActive && this.uiManager.isActivitySummaryActive()) {
            this.uiManager.hideActivitySummary();
            return;
          }
          if (this.uiManager.isStatsModalActive && this.uiManager.isStatsModalActive()) {
            this.uiManager.hideStatsModal();
            return;
          }
          if (this.uiManager.isQuizActive()) {
            this.uiManager.hideQuizModal();
            return;
          }
          if (this.uiManager.isPronounceActive && this.uiManager.isPronounceActive()) {
            this.uiManager.hidePronounceModal(false);
            return;
          }
          if (this.uiManager.isQuestModalActive()) {
            this.uiManager.hideQuestModalUI();
            return;
          }
          if (this.activeDialogueNpc) {
            this.advanceDialogue();
            return;
          }
        }
        this.showTitleScreen();
        return;
      }

      if (this.isTitleScreen) {
        if (matches('sound') && window.SoundManager) {
          e.preventDefault();
          const isMuted = window.SoundManager.toggleMute();
          this.uiManager.showToast(isMuted ? 'Suara Dimatikan (Muted)' : 'Suara Diaktifkan (Unmuted)');
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        return;
      }

      if (matches('interact')) {
        this.handleInteractionKey();
      } else if (matches('notebook')) {
        e.preventDefault();
        this.uiManager.toggleNotebook();
      } else if (matches('quest')) {
        e.preventDefault();
        this.uiManager.toggleQuestModal();
      } else if (matches('stats')) {
        e.preventDefault();
        this.uiManager.toggleStatsModal();
      } else if (matches('sound')) {
        e.preventDefault();
        if (window.SoundManager) {
          const isMuted = window.SoundManager.toggleMute();
          this.uiManager.showToast(isMuted ? 'Suara Dimatikan (Muted)' : 'Suara Diaktifkan (Unmuted)');
        }
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.code] = false;
    });

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.advanceDialogue();
      });
    }

    const tileSizeSelect = document.getElementById('tileSizeSelect');
    if (tileSizeSelect) {
      tileSizeSelect.value = String(this.getTileSize());
      tileSizeSelect.addEventListener('change', (e) => {
        this.setTileSize(e.target.value);
      });
    }

    this.canvas.addEventListener('click', (e) => {
      if (e.shiftKey) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const ts = this.getTileSize();

        const tileX = Math.floor((clickX * scaleX) / ts);
        const tileY = Math.floor((clickY * scaleY) / ts);

        const npcs = this.npcManager.getNpcsForMap(this.currentMapId);
        if (npcs.length > 0) {
          const npcToMove = npcs[0];
          npcToMove.tileX = tileX;
          npcToMove.tileY = tileY;

          const currentMapNpcs = npcs.map(n => ({ id: n.id, tileX: n.tileX, tileY: n.tileY, dir: n.dir || 0 }));
          const mapPlacements = { [this.currentMapId]: currentMapNpcs };

          fetch('/api/npc-placements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mapPlacements)
          }).catch(err => console.warn('Auto-save NPC placement to server JSON failed:', err));

          this.uiManager.showToast(`Placed ${npcToMove.name} at tile (${tileX}, ${tileY})`);
        }
      }
    });
  }

  bindTouchControls() {
    const dpadButtons = {
      dpadUp: 'KeyW',
      dpadDown: 'KeyS',
      dpadLeft: 'KeyA',
      dpadRight: 'KeyD'
    };

    const handleDpadTouch = (e) => {
      e.preventDefault();
      const currentActiveKeys = new Set();

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element) {
          const btn = element.closest('.dpad-btn');
          if (btn && btn.id && dpadButtons[btn.id]) {
            currentActiveKeys.add(dpadButtons[btn.id]);
          }
        }
      }

      for (const [id, key] of Object.entries(dpadButtons)) {
        const btn = document.getElementById(id);
        const shouldBePressed = currentActiveKeys.has(key);
        this.keysPressed[key] = shouldBePressed;
        if (btn) {
          if (shouldBePressed) btn.classList.add('pressed');
          else btn.classList.remove('pressed');
        }
      }
    };

    const dpadContainer = document.getElementById('virtualDpad');
    if (dpadContainer) {
      dpadContainer.addEventListener('touchstart', handleDpadTouch, { passive: false });
      dpadContainer.addEventListener('touchmove', handleDpadTouch, { passive: false });
      dpadContainer.addEventListener('touchend', handleDpadTouch, { passive: false });
      dpadContainer.addEventListener('touchcancel', handleDpadTouch, { passive: false });
    }

    // Pointer/Mouse support on D-Pad buttons
    for (const [id, key] of Object.entries(dpadButtons)) {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this.keysPressed[key] = true;
          btn.classList.add('pressed');
        });
        const stopBtn = (e) => {
          this.keysPressed[key] = false;
          btn.classList.remove('pressed');
        };
        btn.addEventListener('mouseup', stopBtn);
        btn.addEventListener('mouseleave', stopBtn);
      }
    }

    // Action button (Gunem / Interact / Next)
    const touchInteractBtn = document.getElementById('touchInteractBtn');
    if (touchInteractBtn) {
      const triggerInteract = (e) => {
        e.preventDefault();
        touchInteractBtn.classList.add('pressed');
        this.handleInteractionKey();
      };
      const releaseInteract = (e) => {
        touchInteractBtn.classList.remove('pressed');
      };
      touchInteractBtn.addEventListener('touchstart', triggerInteract, { passive: false });
      touchInteractBtn.addEventListener('touchend', releaseInteract, { passive: false });
      touchInteractBtn.addEventListener('touchcancel', releaseInteract, { passive: false });
      touchInteractBtn.addEventListener('mousedown', triggerInteract);
      touchInteractBtn.addEventListener('mouseup', releaseInteract);
      touchInteractBtn.addEventListener('mouseleave', releaseInteract);
    }

    // Quick HUD Action Buttons
    const touchStatsBtn = document.getElementById('touchStatsBtn');
    if (touchStatsBtn) {
      touchStatsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isTitleScreen) return;
        if (this.uiManager) this.uiManager.toggleStatsModal();
      });
    }

    const touchQuestBtn = document.getElementById('touchQuestBtn');
    if (touchQuestBtn) {
      touchQuestBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isTitleScreen) return;
        if (this.uiManager) this.uiManager.toggleQuestTracker();
      });
    }

    const touchNotebookBtn = document.getElementById('touchNotebookBtn');
    if (touchNotebookBtn) {
      touchNotebookBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isTitleScreen) return;
        if (this.uiManager) this.uiManager.toggleNotebook();
      });
    }

    const touchSoundBtn = document.getElementById('touchSoundBtn');
    if (touchSoundBtn) {
      touchSoundBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.SoundManager) {
          const isMuted = window.SoundManager.toggleMute();
          if (this.uiManager) {
            this.uiManager.showToast(isMuted ? 'Suara Dimatikan (Muted)' : 'Suara Diaktifkan (Unmuted)');
          }
          touchSoundBtn.innerHTML = isMuted ? '<i data-lucide="volume-x" style="width: 16px; height: 16px;"></i>' : '<i data-lucide="volume-2" style="width: 16px; height: 16px;"></i>';
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }
      });
    }

    // Tapping on dialogue box advances dialogue or skips typing
    const dialogueBox = document.getElementById('dialogueBox');
    if (dialogueBox) {
      dialogueBox.addEventListener('click', (e) => {
        if (!e.target.closest('#nextBtn')) {
          this.advanceDialogue();
        }
      });
    }

    // Tapping on game canvas can interact with adjacent NPC or dismiss title
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.isTitleScreen) {
        this.hideTitleScreen();
        return;
      }
      if (this.activeDialogueNpc) {
        this.advanceDialogue();
      }
    }, { passive: true });
  }

  handleInteractionKey() {
    if (this.isTitleScreen || this.isGeneratingQuiz || this.isWarping || (this.uiManager && (this.uiManager.isQuizActive() || (this.uiManager.isPronounceActive && this.uiManager.isPronounceActive()) || this.uiManager.isQuestModalActive()))) return;

    if (this.activeDialogueNpc) {
      this.advanceDialogue();
      return;
    }

    const nearbyNpc = this.npcManager.getAdjacentNpc(this.player, this.currentMapId);
    if (nearbyNpc) {
      this.startDialogue(nearbyNpc);
    }
  }

  async startDialogue(npc) {
    this.activeDialogueNpc = npc;
    this.activeDialogueStep = 0;
    this.pendingQuiz = null;

    if (this.questEngine) {
      this.questEngine.onTalkNpc(npc.id);
    }

    if (DIALOGUES[npc.id] && DIALOGUES[npc.id].lines && DIALOGUES[npc.id].lines.length > 0) {
      npc.dialogue = DIALOGUES[npc.id].lines;
    }
    if (!npc.dialogue || npc.dialogue.length === 0) {
      npc.dialogue = [
        {
          javanese: `Sugeng rawuh! Kula ${npc.name || npc.id}.`,
          indonesian: `Selamat datang! Saya ${npc.name || npc.id}.`
        }
      ];
    }

    if (this.player.tileX < npc.tileX) { this.player.dir = 2; npc.dir = 1; }
    else if (this.player.tileX > npc.tileX) { this.player.dir = 1; npc.dir = 2; }
    else if (this.player.tileY < npc.tileY) { this.player.dir = 0; npc.dir = 3; }
    else if (this.player.tileY > npc.tileY) { this.player.dir = 3; npc.dir = 0; }

    this.uiManager.showDialogueLoading(npc);

    this.isGeneratingQuiz = true;
    try {
      console.log(`Requesting fresh quiz for NPC ${npc.id}...`);
      const quiz = await fetchNpcQuiz(npc.id);
      this.pendingQuiz = quiz;
    } catch (err) {
      console.error('Error generating quiz:', err);
    } finally {
      this.isGeneratingQuiz = false;
      this.uiManager.showDialogue(npc, this.activeDialogueStep);
    }
  }

  advanceDialogue() {
    if (!this.activeDialogueNpc || this.isGeneratingQuiz) return;

    if (this.uiManager && this.uiManager.isDialogueTyping()) {
      this.uiManager.completeDialogueTyping();
      return;
    }

    this.activeDialogueStep++;
    if (this.activeDialogueStep >= this.activeDialogueNpc.dialogue.length) {
      const finishedNpc = this.activeDialogueNpc;
      this.activeDialogueNpc = null;
      this.activeDialogueStep = 0;
      this.uiManager.hideDialogue();

      if (this.pendingQuiz) {
        this.uiManager.showQuizModal(this.pendingQuiz, (score) => {
          console.log(`Quiz completed for ${finishedNpc.id} with score ${score}`);
        });
      }
    } else {
      this.uiManager.showDialogue(this.activeDialogueNpc, this.activeDialogueStep);
    }
  }

  checkWarp(tileX, tileY) {
    if (this.isWarping) return;

    if (this.warpCooldownArea) {
      const cdWarp = this.warpCooldownArea.warp;
      const cdW = cdWarp.w || cdWarp.width || 1;
      const cdH = cdWarp.h || cdWarp.height || 1;
      const insideCd = (this.warpCooldownArea.mapId === this.currentMapId) &&
        (tileX >= cdWarp.x && tileX < cdWarp.x + cdW &&
          tileY >= cdWarp.y && tileY < cdWarp.y + cdH);
      if (!insideCd) {
        this.warpCooldownArea = null;
      }
    }

    if (!this.currentMap.warps) return;

    for (const warp of this.currentMap.warps) {
      const w = warp.w || warp.width || 1;
      const h = warp.h || warp.height || 1;

      if (tileX >= warp.x && tileX < warp.x + w && tileY >= warp.y && tileY < warp.y + h) {
        if (this.warpCooldownArea &&
          this.warpCooldownArea.mapId === this.currentMapId &&
          this.warpCooldownArea.warp === warp) {
          return;
        }

        this.warpToMap(warp.targetMap, warp.targetX, warp.targetY, warp.targetDir);
        break;
      }
    }
  }

  warpToMap(targetMapId, targetX, targetY, targetDir, immediate = false) {
    if (!MAPS[targetMapId]) return;

    if (immediate) {
      this.executeWarp(targetMapId, targetX, targetY, targetDir);
      return;
    }

    if (this.isWarping) return;

    this.isWarping = true;
    this.warpPhase = 'fade_out';
    this.warpStartTime = performance.now();
    this.pendingWarp = { targetMapId, targetX, targetY, targetDir };
  }

  executeWarp(targetMapId, targetX, targetY, targetDir) {
    this.currentMapId = targetMapId;
    this.currentMap = MAPS[targetMapId];
    if (this.currentMap.tileSize) {
      this.tileSize = this.currentMap.tileSize;
    }
    this.updateCanvasDimensions();
    this.player.setPosition(targetX, targetY, targetDir, this.getTileSize());
    this.savePlayerPosition();

    this.warpCooldownArea = null;
    if (this.currentMap.warps) {
      for (const warp of this.currentMap.warps) {
        const w = warp.w || warp.width || 1;
        const h = warp.h || warp.height || 1;
        if (targetX >= warp.x && targetX < warp.x + w && targetY >= warp.y && targetY < warp.y + h) {
          this.warpCooldownArea = { mapId: targetMapId, warp };
          break;
        }
      }
    }

    this.uiManager.showToast(`Memasuki: ${this.currentMap.name}`);
    if (window.SoundManager) {
      window.SoundManager.updateAmbientForMap(this.currentMapId, this.currentMap ? this.currentMap.name : '');
    }
    if (this.questEngine) {
      this.questEngine.onMapEnter(targetMapId);
    }
  }

  updateWarpTransition(now) {
    if (!this.isWarping) return;

    const elapsed = now - this.warpStartTime;
    if (this.warpPhase === 'fade_out') {
      if (elapsed >= this.warpDuration) {
        if (this.pendingWarp) {
          const { targetMapId, targetX, targetY, targetDir } = this.pendingWarp;
          this.executeWarp(targetMapId, targetX, targetY, targetDir);
          this.pendingWarp = null;
        }
        this.warpPhase = 'fade_in';
        this.warpStartTime = now;
      }
    } else if (this.warpPhase === 'fade_in') {
      if (elapsed >= this.warpDuration) {
        this.isWarping = false;
        this.warpPhase = null;
      }
    }
  }

  update(now) {
    if (this.isWarping) {
      this.updateWarpTransition(now);
      return;
    }

    const activeMapContext = {
      ...this.currentMap,
      activeNpcs: this.npcManager.getNpcsForMap(this.currentMapId)
    };

    const ts = this.getTileSize();

    this.player.update(
      now,
      activeMapContext,
      this.isTitleScreen || this.activeDialogueNpc || (this.uiManager && (this.uiManager.isQuizActive() || (this.uiManager.isPronounceActive && this.uiManager.isPronounceActive()) || this.uiManager.isQuestModalActive())),
      this.keysPressed,
      (tx, ty) => this.checkWarp(tx, ty),
      ts
    );
  }

  render(now) {
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderGround();
    this.renderEntities(now);
    this.renderPrompts(now);
    this.renderWarpTransition(now);
  }

  renderGround() {
    const map = this.currentMap;
    const ts = this.getTileSize();
    for (let r = 0; r < map.height; r++) {
      for (let c = 0; c < map.width; c++) {
        const type = map.ground[r][c];
        AssetManager.drawGroundTile(this.ctx, type, c * ts, r * ts, ts);
      }
    }
  }

  renderEntities(now) {
    const map = this.currentMap;
    const ts = this.getTileSize();
    const entities = [];

    const getObjectStack = (tileObj) => {
      if (!tileObj || tileObj === '.') return [];
      if (Array.isArray(tileObj)) {
        return tileObj.filter(c => c && c !== '.' && (typeof c === 'string' || (typeof c === 'object' && c.code && c.code !== '.')));
      }
      if (typeof tileObj === 'string') {
        const trimmed = tileObj.trim();
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.code && parsed.code !== '.') return [parsed];
          } catch (e) { }
        }
        return trimmed.split(',').map(s => s.trim()).filter(s => s && s !== '.');
      }
      if (typeof tileObj === 'object' && tileObj !== null && tileObj.code && tileObj.code !== '.') {
        return [tileObj];
      }
      return [];
    };

    for (let r = 0; r < map.height; r++) {
      for (let c = 0; c < map.width; c++) {
        const rawObj = map.objects ? map.objects[r][c] : '.';
        const stack = getObjectStack(rawObj);
        const isOverhead = map.collision && map.collision[r] && map.collision[r][c] === 2;

        if (stack.length > 0) {
          stack.forEach((objItem, layerIdx) => {
            const objCode = typeof objItem === 'object' ? objItem.code : objItem;
            const objDef = (typeof TILE_MAP !== 'undefined' && TILE_MAP.objects) ? TILE_MAP.objects[objCode] : null;
            let offsetRatio = 0.5;
            if (objDef && objDef.ySortRatio !== undefined) {
              offsetRatio = objDef.ySortRatio;
            } else if (objCode.startsWith('H') || objCode.startsWith('M') || objCode.startsWith('W') || objCode.startsWith('CT') || (objDef && objDef.yOffset && objDef.yOffset < 0)) {
              offsetRatio = 0.25;
            }
            const baseSortY = isOverhead ? (r * ts + ts - 1) : (r * ts + ts * offsetRatio);
            entities.push({
              type: 'object',
              item: objItem,
              code: objCode,
              tileX: c,
              tileY: r,
              layerIdx: layerIdx,
              sortY: baseSortY + (layerIdx * 0.01)
            });
          });
        } else if (isOverhead) {
          entities.push({
            type: 'ground_overhead',
            groundType: map.ground[r][c],
            tileX: c,
            tileY: r,
            sortY: r * ts + ts - 1
          });
        }
      }
    }

    const npcs = this.npcManager.getNpcsForMap(this.currentMapId);
    npcs.forEach(npc => {
      entities.push({
        type: 'npc',
        data: npc,
        sortY: npc.tileY * ts + ts * 0.66
      });
    });

    entities.push({
      type: 'player',
      sortY: this.player.pixelY + ts * 0.66
    });

    entities.sort((a, b) => a.sortY - b.sortY);

    entities.forEach(ent => {
      if (ent.type === 'object') AssetManager.drawObjectTile(this.ctx, ent.item || ent.code, ent.tileX, ent.tileY, ts);
      else if (ent.type === 'ground_overhead') AssetManager.drawGroundTile(this.ctx, ent.groundType, ent.tileX * ts, ent.tileY * ts, ts);
      else if (ent.type === 'npc') this.npcManager.drawNpc(this.ctx, ent.data, ts);
      else if (ent.type === 'player') this.player.draw(this.ctx, ts);
    });
  }

  renderPrompts(now) {
    if (this.isTitleScreen || this.activeDialogueNpc || this.isWarping || (this.uiManager && (this.uiManager.isQuizActive() || (this.uiManager.isPronounceActive && this.uiManager.isPronounceActive())))) return;

    const ts = this.getTileSize();
    const adjacentNpc = this.npcManager.getAdjacentNpc(this.player, this.currentMapId);
    if (adjacentNpc) {
      const px = adjacentNpc.tileX * ts + ts / 2;
      const py = adjacentNpc.tileY * ts - (ts * 0.4);
      const bounceY = Math.sin(now / 150) * 4;

      this.ctx.save();
      this.ctx.font = 'bold 12px "Quicksand", sans-serif';
      this.ctx.textAlign = 'center';

      const text = "Tekan E untuk Berbicara";
      const textWidth = this.ctx.measureText(text).width + 16;

      this.ctx.fillStyle = '#3a1e08';
      this.ctx.beginPath();
      this.ctx.roundRect(px - textWidth / 2, py + bounceY - 14, textWidth, 24, 6);
      this.ctx.fill();
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#fef3c7';
      this.ctx.fillText(text, px, py + bounceY + 2);
      this.ctx.restore();
    }
  }

  renderWarpTransition(now) {
    if (!this.isWarping || !this.warpPhase) return;

    const elapsed = Math.max(0, now - this.warpStartTime);
    const rawProgress = Math.min(elapsed / this.warpDuration, 1);

    // Smooth quadratic easing (easeInOut)
    const progress = rawProgress < 0.5
      ? 2 * rawProgress * rawProgress
      : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;

    let alpha = 0;
    if (this.warpPhase === 'fade_out') {
      alpha = progress;
    } else if (this.warpPhase === 'fade_in') {
      alpha = 1 - progress;
    }

    this.ctx.save();
    this.ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  start() {
    AssetManager.load(() => {
      console.log('NusaQuest modular assets loaded successfully.');
    });

    const loop = (timestamp) => {
      this.update(timestamp);
      this.render(timestamp);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

const DEFAULT_KEYBINDS = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  interact: 'KeyE',
  notebook: 'KeyN',
  quest: 'KeyQ',
  stats: 'KeyL',
  sound: 'KeyM'
};

const KEYBIND_LABELS = {
  up: 'Maju / Atas',
  down: 'Mundur / Bawah',
  left: 'Kiri',
  right: 'Kanan',
  interact: 'Bicara / Interaksi',
  notebook: 'Buku Kosakata',
  quest: 'Misi Budaya',
  stats: 'Statistik Belajar (L)',
  sound: 'Suara / Audio'
};

function getKeyName(code) {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ArrowUp') return '▲';
  if (code === 'ArrowDown') return '▼';
  if (code === 'ArrowLeft') return '◄';
  if (code === 'ArrowRight') return '►';
  if (code === 'Space') return 'Space';
  return code;
}

function loadKeybinds() {
  try {
    const saved = localStorage.getItem('nusaquest_keybinds');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_KEYBINDS, ...parsed };
    }
  } catch (e) { }
  return { ...DEFAULT_KEYBINDS };
}

function buildActiveKeybinds(binds) {
  const active = {};
  for (const [action, primaryKey] of Object.entries(binds)) {
    active[action] = [primaryKey];
  }
  if (!active.up.includes('ArrowUp')) active.up.push('ArrowUp');
  if (!active.down.includes('ArrowDown')) active.down.push('ArrowDown');
  if (!active.left.includes('ArrowLeft')) active.left.push('ArrowLeft');
  if (!active.right.includes('ArrowRight')) active.right.push('ArrowRight');
  if (active.notebook && !active.notebook.includes('Tab')) active.notebook.push('Tab');
  return active;
}

function saveKeybinds(binds) {
  try {
    localStorage.setItem('nusaquest_keybinds', JSON.stringify(binds));
  } catch (e) { }
  window.KEYBINDS = buildActiveKeybinds(binds);
}

window.USER_KEYBINDS = loadKeybinds();
window.KEYBINDS = buildActiveKeybinds(window.USER_KEYBINDS);

let activeListeningAction = null;

window.handleKeybindCapture = function (e) {
  if (!activeListeningAction) return false;
  if (e.code !== 'Escape') {
    window.USER_KEYBINDS[activeListeningAction] = e.code;
    saveKeybinds(window.USER_KEYBINDS);
  }
  activeListeningAction = null;
  renderKeybindsUI();
  e.preventDefault();
  return true;
};

function renderKeybindsUI() {
  const list = document.getElementById('keybindsList');
  if (!list) return;
  list.innerHTML = '';

  for (const [action, label] of Object.entries(KEYBIND_LABELS)) {
    const row = document.createElement('div');
    row.className = 'keybind-row';
    const currentKey = window.USER_KEYBINDS[action] || DEFAULT_KEYBINDS[action];
    const isListening = activeListeningAction === action;

    row.innerHTML = `
      <span>${label}</span>
      <button class="keybind-btn ${isListening ? 'listening' : ''}" data-action="${action}">
        ${isListening ? '...' : getKeyName(currentKey)}
      </button>
    `;

    const btn = row.querySelector('.keybind-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeListeningAction = isListening ? null : action;
      renderKeybindsUI();
    });

    list.appendChild(row);
  }
}

window.addEventListener('load', () => {
  window.game = new GameEngine();
  const mapsPromise = window.mapsLoadPromise || Promise.resolve();

  const startScreen = document.getElementById('startScreen');
  const startPlayBtn = document.getElementById('startPlayBtn');
  const startOptionsBtn = document.getElementById('startOptionsBtn');
  const optionsModal = document.getElementById('optionsModal');
  const closeOptionsBtn = document.getElementById('closeOptionsBtn');
  const resetKeybindsBtn = document.getElementById('resetKeybindsBtn');
  const optSoundBtn = document.getElementById('optSoundBtn');

  mapsPromise.then(() => {
    const savedPos = window.game.loadPlayerPosition();
    if (savedPos) {
      window.game.initMap(savedPos.mapId, savedPos.tileX, savedPos.tileY, savedPos.dir);
    } else {
      window.game.initMap('village');
    }
    window.game.start();
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  });

  if (startPlayBtn) {
    startPlayBtn.addEventListener('click', () => {
      if (window.game) {
        window.game.hideTitleScreen();
      }
    });
  }

  if (startOptionsBtn && optionsModal) {
    startOptionsBtn.addEventListener('click', () => {
      optionsModal.classList.remove('hidden');
      renderKeybindsUI();
      if (optSoundBtn && window.SoundManager) {
        const isMuted = window.SoundManager.isMuted();
        optSoundBtn.innerHTML = isMuted ? '<i data-lucide="volume-x" style="width: 14px; height: 14px;"></i> Suara (M)' : '<i data-lucide="volume-2" style="width: 14px; height: 14px;"></i> Suara (M)';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }
      }
    });
  }

  if (resetKeybindsBtn) {
    resetKeybindsBtn.addEventListener('click', () => {
      window.USER_KEYBINDS = { ...DEFAULT_KEYBINDS };
      saveKeybinds(window.USER_KEYBINDS);
      activeListeningAction = null;
      renderKeybindsUI();
    });
  }

  if (closeOptionsBtn && optionsModal) {
    closeOptionsBtn.addEventListener('click', () => {
      activeListeningAction = null;
      optionsModal.classList.add('hidden');
    });
  }

  if (optionsModal) {
    optionsModal.addEventListener('click', (e) => {
      if (e.target === optionsModal) {
        activeListeningAction = null;
        optionsModal.classList.add('hidden');
      }
    });
  }

  const optTouchControlsSelect = document.getElementById('optTouchControlsSelect');
  const savedTouchMode = localStorage.getItem('nusaquest_touch_mode') || 'auto';
  if (optTouchControlsSelect) {
    optTouchControlsSelect.value = savedTouchMode;
    applyTouchControlMode(savedTouchMode);
    optTouchControlsSelect.addEventListener('change', (e) => {
      applyTouchControlMode(e.target.value);
    });
  } else {
    applyTouchControlMode(savedTouchMode);
  }

  if (optSoundBtn) {
    optSoundBtn.addEventListener('click', () => {
      if (window.SoundManager) {
        const isMuted = window.SoundManager.toggleMute();
        optSoundBtn.innerHTML = isMuted ? '<i data-lucide="volume-x" style="width: 14px; height: 14px;"></i> Suara (M)' : '<i data-lucide="volume-2" style="width: 14px; height: 14px;"></i> Suara (M)';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
          lucide.createIcons();
        }
      }
    });
  }
});

function applyTouchControlMode(mode) {
  document.body.classList.remove('show-touch-controls', 'hide-touch-controls');
  if (mode === 'on') {
    document.body.classList.add('show-touch-controls');
  } else if (mode === 'off') {
    document.body.classList.add('hide-touch-controls');
  }
  try {
    localStorage.setItem('nusaquest_touch_mode', mode);
  } catch (e) { }
}
