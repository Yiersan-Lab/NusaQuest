class SoundManager {
  constructor() {
    this.muted = false;
    this.initialized = false;
    this.currentAmbientMode = null;
    this.currentDialogueAudio = null;
    this.fadeInterval = null;

    try {
      const savedMute = localStorage.getItem('nusaquest_muted');
      if (savedMute !== null) {
        this.muted = savedMute === 'true';
      }
    } catch (e) { }

    this.sfx = {
      dialog: new Audio('/assets/sfx/dialog.mp3'),
      atif: new Audio('/assets/sfx/atip russia.mp3'),
      correct: new Audio('/assets/sfx/correct.mp3'),
      incorrect: new Audio('/assets/sfx/incorrect.wav'),
      btnHover: new Audio('/assets/sfx/2.mp3'),
      btnClick: new Audio('/assets/sfx/6.mp3')
    };

    this.ambient = {
      outdoor: new Audio('/assets/sfx/ambient_outdoor.mp3'),
      indoor: new Audio('/assets/sfx/ambient_indoor.wav')
    };

    this.sfx.dialog.loop = true;
    this.sfx.dialog.volume = 0.45;

    this.sfx.atif.loop = true;
    this.sfx.atif.volume = 0.50;

    this.sfx.correct.volume = 0.65;
    this.sfx.incorrect.volume = 0.55;
    this.sfx.btnHover.volume = 0.40;
    this.sfx.btnClick.volume = 0.55;

    this.ambient.outdoor.loop = true;
    this.ambient.outdoor.volume = 0;

    this.ambient.indoor.loop = true;
    this.ambient.indoor.volume = 0;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    } catch (e) {
      this.ctx = null;
    }

    // Set preload on all audio elements and load
    Object.values(this.sfx).forEach(audio => {
      audio.preload = 'auto';
      try { audio.load(); } catch (e) { }
    });
    Object.values(this.ambient).forEach(audio => {
      audio.preload = 'auto';
      try { audio.load(); } catch (e) { }
    });

    this.bindUnlockListener();
    this.bindMenuSfxListeners();

    // Attempt immediate autoplay on initialization
    this.tryImmediateAutoplay();
  }

  warmupAudioContext() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => { });
      }
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch (e) { }
  }

  tryImmediateAutoplay() {
    this.warmupAudioContext();
    if (this.currentAmbientMode) {
      this.playAmbient(this.currentAmbientMode);
    }
  }

  bindUnlockListener() {
    const unlock = () => {
      this.initialized = true;
      this.warmupAudioContext();

      if (this.ambient.outdoor && this.ambient.outdoor.muted) {
        this.ambient.outdoor.muted = false;
      }
      if (this.ambient.indoor && this.ambient.indoor.muted) {
        this.ambient.indoor.muted = false;
      }

      if (this.currentAmbientMode) {
        this.playAmbient(this.currentAmbientMode);
      }
      events.forEach(evt => window.removeEventListener(evt, unlock, true));
    };

    const events = [
      'click', 'keydown', 'touchstart', 'pointerdown', 'pointermove',
      'mousemove', 'mouseover', 'mouseenter', 'focus', 'wheel', 'scroll', 'visibilitychange'
    ];
    events.forEach(evt => window.addEventListener(evt, unlock, { once: true, capture: true, passive: true }));
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('nusaquest_muted', String(this.muted));
    } catch (e) { }

    if (this.muted) {
      this.stopDialogueSfx();
      if (this.ambient.outdoor) this.ambient.outdoor.volume = 0;
      if (this.ambient.indoor) this.ambient.indoor.volume = 0;
    } else {
      if (this.currentAmbientMode) {
        this.playAmbient(this.currentAmbientMode, true);
      }
    }

    this.updateMuteUI();
    return this.muted;
  }

  setMute(isMuted) {
    this.muted = !!isMuted;
    try {
      localStorage.setItem('nusaquest_muted', String(this.muted));
    } catch (e) { }

    if (this.muted) {
      this.stopDialogueSfx();
      if (this.ambient.outdoor) this.ambient.outdoor.volume = 0;
      if (this.ambient.indoor) this.ambient.indoor.volume = 0;
    } else {
      if (this.currentAmbientMode) {
        this.playAmbient(this.currentAmbientMode, true);
      }
    }
    this.updateMuteUI();
  }

  isMuted() {
    return this.muted;
  }

  updateAmbientForMap(mapId, mapName = '') {
    const isIndoor = this.isIndoorMap(mapId, mapName);
    const targetMode = isIndoor ? 'indoor' : 'outdoor';
    this.currentAmbientMode = targetMode;

    this.playAmbient(targetMode);
  }

  isIndoorMap(mapId, mapName = '') {
    const id = (mapId || '').toLowerCase();
    const name = (mapName || '').toLowerCase();
    return name.includes('indoor') || id.includes('indoor') || id.includes('rumah') || id.includes('istana') || id.includes('balai');
  }

  playAmbient(targetMode, immediate = false) {
    if (this.muted) return;

    const targetVolume = 0.26;
    const activeAudio = targetMode === 'indoor' ? this.ambient.indoor : this.ambient.outdoor;
    const inactiveAudio = targetMode === 'indoor' ? this.ambient.outdoor : this.ambient.indoor;

    try {
      if (activeAudio.paused) {
        const playPromise = activeAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay policy prevented unmuted playback. Start muted to stream in background immediately
            activeAudio.muted = true;
            activeAudio.play().catch(() => { });
          });
        }
      }
    } catch (e) { }

    if (immediate) {
      if (this.fadeInterval) clearInterval(this.fadeInterval);
      activeAudio.volume = targetVolume;
      inactiveAudio.volume = 0;
      try { inactiveAudio.pause(); } catch (e) { }
      return;
    }

    if (this.fadeInterval) clearInterval(this.fadeInterval);

    let step = 0;
    const totalSteps = 20;
    const initialActiveVol = activeAudio.volume;
    const initialInactiveVol = inactiveAudio.volume;

    this.fadeInterval = setInterval(() => {
      step++;
      const progress = Math.min(step / totalSteps, 1.0);

      activeAudio.volume = initialActiveVol + (targetVolume - initialActiveVol) * progress;
      inactiveAudio.volume = Math.max(0, initialInactiveVol * (1.0 - progress));

      if (step >= totalSteps) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        activeAudio.volume = targetVolume;
        inactiveAudio.volume = 0;
        try {
          inactiveAudio.pause();
        } catch (e) { }
      }
    }, 50);
  }

  startDialogueSfx(npc) {
    if (this.muted) return;

    this.stopDialogueSfx();

    const isRadenAtif = npc && (
      npc.id === 'raden_atif' ||
      (typeof npc.name === 'string' && npc.name.toLowerCase().includes('atif'))
    );

    const targetAudio = isRadenAtif ? this.sfx.atif : this.sfx.dialog;
    this.currentDialogueAudio = targetAudio;

    try {
      targetAudio.currentTime = 0;
      const playPromise = targetAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { });
      }
    } catch (err) { }
  }

  stopDialogueSfx() {
    if (this.currentDialogueAudio) {
      try {
        this.currentDialogueAudio.pause();
        this.currentDialogueAudio.currentTime = 0;
      } catch (e) { }
      this.currentDialogueAudio = null;
    }
    try {
      this.sfx.dialog.pause();
      this.sfx.dialog.currentTime = 0;
      this.sfx.atif.pause();
      this.sfx.atif.currentTime = 0;
    } catch (e) { }
  }

  playCorrect() {
    if (this.muted) return;
    try {
      const correctSound = this.sfx.correct.cloneNode();
      correctSound.volume = 0.65;
      const playPromise = correctSound.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { });
      }
    } catch (e) { }
  }

  playIncorrect() {
    if (this.muted) return;
    try {
      const wrongSound = this.sfx.incorrect.cloneNode();
      wrongSound.volume = 0.55;
      const playPromise = wrongSound.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { });
      }
    } catch (e) { }
  }

  playButtonHover() {
    if (this.muted) return;
    try {
      const sound = this.sfx.btnHover.cloneNode();
      sound.volume = 0.40;
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { });
      }
    } catch (e) { }
  }

  playButtonClick() {
    if (this.muted) return;
    try {
      const sound = this.sfx.btnClick.cloneNode();
      sound.volume = 0.55;
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => { });
      }
    } catch (e) { }
  }

  bindMenuSfxListeners() {
    // Restrict hover/click sound effects exclusively to the title screen buttons
    const selector = '#startScreen button, #startScreen .start-menu-item, #startPlayBtn, #startOptionsBtn';

    // Use capture phase mouseover to trigger hover sound on enter
    document.addEventListener('mouseover', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(selector) : null;
      if (btn && (!e.relatedTarget || !btn.contains(e.relatedTarget))) {
        this.playButtonHover();
      }
    }, true);

    // Use capture phase click to trigger click sound
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest(selector) : null;
      if (btn) {
        this.playButtonClick();
      }
    }, true);
  }

  updateMuteUI() {
    const btn = document.getElementById('soundToggleBtn');
    if (btn) {
      if (this.muted) {
        btn.innerHTML = '<i data-lucide="volume-x" style="width: 14px; height: 14px;"></i> Suara (M)';
        btn.classList.add('muted');
      } else {
        btn.innerHTML = '<i data-lucide="volume-2" style="width: 14px; height: 14px;"></i> Suara (M)';
        btn.classList.remove('muted');
      }
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  }
}

window.SoundManager = new SoundManager();
