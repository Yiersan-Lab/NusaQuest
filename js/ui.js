class UIManager {
  constructor() {
    this.learnedVocab = new Map();
    this.isNotebookCollapsed = true;
    this.isQuestTrackerCollapsed = true;
    
    this.currentQuiz = null;
    this.currentQuestionIdx = 0;
    this.selectedOptionIdx = null;
    this.answeredCurrentQuestion = false;
    this.score = 0;
    this.onQuizComplete = null;

    this.dialogueTyping = false;
    this.typingTimer = null;
    this.activeDialogueNpc = null;
    this.activeDialogueLine = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.dialogueBox = document.getElementById('dialogueBox');
    this.aiLoadingIndicator = document.getElementById('aiLoadingIndicator');
    this.dialogueContent = this.dialogueBox ? this.dialogueBox.querySelector('.dialogue-content') : null;
    this.dialogueFooter = this.dialogueBox ? this.dialogueBox.querySelector('.dialogue-footer') : null;
    this.portraitCanvas = document.getElementById('portraitCanvas');
    this.npcName = document.getElementById('npcName');
    this.javaneseText = document.getElementById('javaneseText');
    this.indonesianText = document.getElementById('indonesianText');
    this.nextBtn = document.getElementById('nextBtn');

    this.vocabNotebook = document.getElementById('vocabNotebook');
    this.toggleNotebookBtn = document.getElementById('toggleNotebookBtn');
    this.vocabCounter = document.getElementById('vocabCounter');
    this.vocabList = document.getElementById('vocabList');
    this.toastContainer = document.getElementById('toastContainer');

    this.quizModal = document.getElementById('quizModal');
    this.quizTitle = document.getElementById('quizTitle');
    this.quizProgress = document.getElementById('quizProgress');
    this.quizQuestion = document.getElementById('quizQuestion');
    this.quizOptions = document.getElementById('quizOptions');
    this.quizFeedback = document.getElementById('quizFeedback');
    this.nextQuizBtn = document.getElementById('nextQuizBtn');
    this.closeQuizBtn = document.getElementById('closeQuizBtn');

    // Gladhen Micara (NusaTTSE Pronunciation Modal) Elements
    this.pronounceModal = document.getElementById('pronounceModal');
    this.pronounceTitle = document.getElementById('pronounceTitle');
    this.pronounceTargetText = document.getElementById('pronounceTargetText');
    this.pronounceTranslation = document.getElementById('pronounceTranslation');
    this.pronounceListenBtn = document.getElementById('pronounceListenBtn');
    this.recordMicBtn = document.getElementById('recordMicBtn');
    this.recordingTimer = document.getElementById('recordingTimer');
    this.micLiveWave = document.getElementById('micLiveWave');
    this.micStatusText = document.getElementById('micStatusText');
    this.pronounceResultCard = document.getElementById('pronounceResultCard');
    this.evalOverallScore = document.getElementById('evalOverallScore');
    this.evalRatingBadge = document.getElementById('evalRatingBadge');
    this.evalFeedbackText = document.getElementById('evalFeedbackText');
    this.wordChipsContainer = document.getElementById('wordChipsContainer');
    this.skipPronounceBtn = document.getElementById('skipPronounceBtn');
    this.finishPronounceBtn = document.getElementById('finishPronounceBtn');
    this.closePronounceBtn = document.getElementById('closePronounceBtn');

    this.currentPronounceTarget = null;
    this.onPronounceComplete = null;
    this.isRecordingPronounce = false;
    this.recordTimerInterval = null;

    this.questTracker = document.getElementById('questTracker');
    this.toggleQuestTrackerBtn = document.getElementById('toggleQuestTrackerBtn');
    this.questTrackerText = document.getElementById('questTrackerText');
    this.questModal = document.getElementById('questModal');
    this.questHudBtn = document.getElementById('questHudBtn');
    this.closeQuestBtn = document.getElementById('closeQuestBtn');
    this.questList = document.getElementById('questList');
    this.questPlayerXp = document.getElementById('questPlayerXp');
    this.badgeContainer = document.getElementById('badgeContainer');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');

    // Learning Progress & Statistics Modal Elements
    this.statsModal = document.getElementById('learningStatsModal');
    this.statsHudBtn = document.getElementById('statsHudBtn');
    this.closeStatsBtn = document.getElementById('closeStatsBtn');
    this.closeStatsFooterBtn = document.getElementById('closeStatsFooterBtn');
    this.statsHeaderXp = document.getElementById('statsHeaderXp');
    this.statsTabBtns = document.querySelectorAll('.stats-tab-btn');
    this.vocabSearchInput = document.getElementById('vocabSearchInput');
    this.activeStatsTab = 'overview';

    // Activity Celebration / Summary Modal Elements
    this.activitySummaryModal = document.getElementById('activitySummaryModal');
    this.summaryContinueBtn = document.getElementById('summaryContinueBtn');
    this.summaryViewFullStatsBtn = document.getElementById('summaryViewFullStatsBtn');
    this.summaryMainTitle = document.getElementById('summaryMainTitle');
    this.summarySubTitle = document.getElementById('summarySubTitle');
    this.summaryHeroIconWrap = document.getElementById('summaryHeroIconWrap');
    this.summaryHeroIcon = document.getElementById('summaryHeroIcon');
    this.summaryXpEarnedText = document.getElementById('summaryXpEarnedText');
    this.summaryBadgeUnlockCard = document.getElementById('summaryBadgeUnlockCard');
    this.summaryBadgeIcon = document.getElementById('summaryBadgeIcon');
    this.summaryBadgeName = document.getElementById('summaryBadgeName');
    this.summaryStatLabel1 = document.getElementById('summaryStatLabel1');
    this.summaryStatVal1 = document.getElementById('summaryStatVal1');
    this.summaryStatLabel2 = document.getElementById('summaryStatLabel2');
    this.summaryStatVal2 = document.getElementById('summaryStatVal2');
    this.summaryFeedbackText = document.getElementById('summaryFeedbackText');

    this.lastPronounceEvalResult = null;
    this.questEngine = null;

    if (window.SoundManager) {
      window.SoundManager.updateMuteUI();
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  bindEvents() {
    if (this.toggleNotebookBtn) {
      this.toggleNotebookBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.toggleNotebook();
      });
    }

    if (this.toggleQuestTrackerBtn) {
      this.toggleQuestTrackerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.toggleQuestTracker();
      });
    }

    if (this.questTracker) {
      this.questTracker.addEventListener('click', (e) => {
        if (!e.target.closest('#toggleQuestTrackerBtn')) {
          this.toggleQuestTracker();
        }
      });
    }

    if (this.closeQuizBtn) {
      this.closeQuizBtn.addEventListener('click', () => this.hideQuizModal());
    }

    if (this.nextQuizBtn) {
      this.nextQuizBtn.addEventListener('click', () => this.handleNextQuestion());
    }

    // Pronunciation modal events
    if (this.pronounceListenBtn) {
      this.pronounceListenBtn.addEventListener('click', () => this.handlePronounceListen());
    }

    if (this.recordMicBtn) {
      this.recordMicBtn.addEventListener('click', () => this.handleTogglePronounceRecord());
    }

    if (this.skipPronounceBtn) {
      this.skipPronounceBtn.addEventListener('click', () => this.hidePronounceModal(false));
    }

    if (this.finishPronounceBtn) {
      this.finishPronounceBtn.addEventListener('click', () => this.hidePronounceModal(true));
    }

    if (this.closePronounceBtn) {
      this.closePronounceBtn.addEventListener('click', () => this.hidePronounceModal(false));
    }

    if (this.questHudBtn) {
      this.questHudBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (window.game && window.game.isTitleScreen) return;
        this.toggleQuestModal();
      });
    }

    if (this.closeQuestBtn) {
      this.closeQuestBtn.addEventListener('click', () => this.hideQuestModalUI());
    }

    if (this.questModal) {
      this.questModal.addEventListener('click', (e) => {
        if (e.target === this.questModal) {
          this.hideQuestModalUI();
        }
      });
    }

    // Learning Stats Modal events
    if (this.statsHudBtn) {
      this.statsHudBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (window.game && window.game.isTitleScreen) return;
        this.toggleStatsModal();
      });
    }

    if (this.closeStatsBtn) {
      this.closeStatsBtn.addEventListener('click', () => this.hideStatsModal());
    }

    if (this.closeStatsFooterBtn) {
      this.closeStatsFooterBtn.addEventListener('click', () => this.hideStatsModal());
    }

    if (this.statsModal) {
      this.statsModal.addEventListener('click', (e) => {
        if (e.target === this.statsModal) {
          this.hideStatsModal();
        }
      });
    }

    // Tabs switching
    if (this.statsTabBtns && this.statsTabBtns.length > 0) {
      this.statsTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tabName = btn.getAttribute('data-tab');
          this.switchStatsTab(tabName);
        });
      });
    }

    // Vocab search filter in Stats Modal
    if (this.vocabSearchInput) {
      this.vocabSearchInput.addEventListener('input', (e) => {
        this.renderVocabGlossary(e.target.value.trim());
      });
    }

    // Activity Celebration Modal events
    if (this.summaryContinueBtn) {
      this.summaryContinueBtn.addEventListener('click', () => this.hideActivitySummary());
    }

    if (this.summaryViewFullStatsBtn) {
      this.summaryViewFullStatsBtn.addEventListener('click', () => {
        this.hideActivitySummary();
        this.showStatsModal('overview');
      });
    }

    if (this.activitySummaryModal) {
      this.activitySummaryModal.addEventListener('click', (e) => {
        if (e.target === this.activitySummaryModal) {
          this.hideActivitySummary();
        }
      });
    }

    if (this.soundToggleBtn) {
      this.soundToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (window.SoundManager) {
          window.SoundManager.toggleMute();
        }
      });
    }
  }

  showDialogueLoading(npc) {
    if (!this.dialogueBox) return;
    this.dialogueBox.classList.remove('hidden');

    if (this.aiLoadingIndicator) this.aiLoadingIndicator.classList.remove('hidden');
    if (this.dialogueContent) this.dialogueContent.style.display = 'none';
    if (this.dialogueFooter) this.dialogueFooter.style.display = 'none';
  }

  setAiLoading(isLoading) {
    if (!this.aiLoadingIndicator) return;
    if (isLoading) {
      this.aiLoadingIndicator.classList.remove('hidden');
    } else {
      this.aiLoadingIndicator.classList.add('hidden');
    }
  }

  hideHudPanels() {
    if (this.vocabNotebook) this.vocabNotebook.classList.add('hidden');
    if (this.questTracker) this.questTracker.classList.add('hidden');
    if (window.game && window.game.isTitleScreen) {
      if (this.questHudBtn) this.questHudBtn.classList.add('hidden');
      if (this.statsHudBtn) this.statsHudBtn.classList.add('hidden');
    }
  }

  showHudPanels() {
    if (this.vocabNotebook) this.vocabNotebook.classList.remove('hidden');
    if (this.questTracker) this.questTracker.classList.remove('hidden');
    if (this.questHudBtn) this.questHudBtn.classList.remove('hidden');
    if (this.statsHudBtn) this.statsHudBtn.classList.remove('hidden');
  }

  toggleNotebook(forceOpen = null) {
    if (window.game && window.game.isTitleScreen) return;
    if (this.isStatsModalActive && this.isStatsModalActive()) return;
    if (this.isQuestModalActive && this.isQuestModalActive()) return;
    if (this.isActivitySummaryActive && this.isActivitySummaryActive()) return;

    if (forceOpen !== null) {
      this.isNotebookCollapsed = !forceOpen;
    } else {
      this.isNotebookCollapsed = !this.isNotebookCollapsed;
    }
    if (this.vocabNotebook) {
      this.vocabNotebook.classList.remove('hidden');
      if (this.isNotebookCollapsed) {
        this.vocabNotebook.classList.add('collapsed');
        if (this.toggleNotebookBtn) this.toggleNotebookBtn.innerText = '+';
      } else {
        this.vocabNotebook.classList.remove('collapsed');
        if (this.toggleNotebookBtn) this.toggleNotebookBtn.innerText = '−';
        if (!this.isQuestTrackerCollapsed && window.innerWidth <= 900) {
          this.toggleQuestTracker(false);
        }
      }
    }
  }

  toggleQuestTracker(forceOpen = null) {
    if (window.game && window.game.isTitleScreen) return;
    if (this.isStatsModalActive && this.isStatsModalActive()) return;
    if (this.isQuestModalActive && this.isQuestModalActive()) return;
    if (this.isActivitySummaryActive && this.isActivitySummaryActive()) return;

    if (forceOpen !== null) {
      this.isQuestTrackerCollapsed = !forceOpen;
    } else {
      this.isQuestTrackerCollapsed = !this.isQuestTrackerCollapsed;
    }
    if (this.questTracker) {
      this.questTracker.classList.remove('hidden');
      if (this.isQuestTrackerCollapsed) {
        this.questTracker.classList.add('collapsed');
        if (this.toggleQuestTrackerBtn) this.toggleQuestTrackerBtn.innerText = '+';
      } else {
        this.questTracker.classList.remove('collapsed');
        if (this.toggleQuestTrackerBtn) this.toggleQuestTrackerBtn.innerText = '−';
        if (!this.isNotebookCollapsed && window.innerWidth <= 900) {
          this.toggleNotebook(false);
        }
      }
    }
  }

  isDialogueTyping() {
    return this.dialogueTyping;
  }

  clearTypingTimer() {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  showDialogue(npc, lineIndex) {
    const line = npc.dialogue[lineIndex];
    if (!line) return;

    this.clearTypingTimer();
    this.activeDialogueNpc = npc;
    this.activeDialogueLine = line;

    this.dialogueBox.classList.remove('hidden');

    if (this.aiLoadingIndicator) this.aiLoadingIndicator.classList.add('hidden');
    if (this.dialogueContent) this.dialogueContent.style.display = 'flex';
    if (this.dialogueFooter) this.dialogueFooter.style.display = 'flex';

    this.npcName.innerText = `${npc.name} • ${npc.role}`;
    this.renderPortrait(npc);

    this.startTypewriter(npc, line);
  }

  startTypewriter(npc, line) {
    this.clearTypingTimer();
    this.dialogueTyping = true;

    this.javaneseText.innerText = '"';
    this.indonesianText.innerText = '';
    this.indonesianText.style.opacity = '0';
    this.indonesianText.style.transition = 'opacity 0.25s ease';

    if (window.SoundManager) {
      window.SoundManager.startDialogueSfx(npc);
    }

    const javText = line.javanese || '';
    let charIdx = 0;

    const typeNextChar = () => {
      if (!this.dialogueTyping) return;

      if (charIdx < javText.length) {
        charIdx++;
        this.javaneseText.innerText = `"${javText.substring(0, charIdx)}"`;
        const char = javText[charIdx - 1];

        let delay = 24;
        if (char === '.' || char === '!' || char === '?') {
          delay = 140;
        } else if (char === ',' || char === ';') {
          delay = 80;
        }

        this.typingTimer = setTimeout(typeNextChar, delay);
      } else {
        this.javaneseText.innerText = `"${javText}"`;
        this.indonesianText.innerText = `(${line.indonesian || ''})`;
        this.indonesianText.style.opacity = '1';

        this.dialogueTyping = false;
        if (window.SoundManager) {
          window.SoundManager.stopDialogueSfx();
        }

        if (line.teaches && line.teaches.word) {
          this.addVocab(line.teaches.word, line.teaches.meaning || line.indonesian || '');
        }
      }
    };

    typeNextChar();
  }

  completeDialogueTyping() {
    if (!this.dialogueTyping || !this.activeDialogueLine) return;

    this.clearTypingTimer();
    this.dialogueTyping = false;

    if (window.SoundManager) {
      window.SoundManager.stopDialogueSfx();
    }

    const line = this.activeDialogueLine;
    this.javaneseText.innerText = `"${line.javanese || ''}"`;
    this.indonesianText.innerText = `(${line.indonesian || ''})`;
    this.indonesianText.style.opacity = '1';

    if (line.teaches && line.teaches.word) {
      this.addVocab(line.teaches.word, line.teaches.meaning || line.indonesian || '');
    }
  }

  hideDialogue() {
    this.clearTypingTimer();
    this.dialogueTyping = false;
    if (window.SoundManager) {
      window.SoundManager.stopDialogueSfx();
    }
    this.dialogueBox.classList.add('hidden');
    if (this.aiLoadingIndicator) this.aiLoadingIndicator.classList.add('hidden');
  }

  renderPortrait(npc) {
    if (!this.portraitCanvas) return;
    const ctx = this.portraitCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);

    const img = AssetManager.images.characters;
    if (img && img.complete && img.naturalWidth !== 0) {
      let srcX, srcY;
      if (npc.col !== undefined && npc.col !== null && npc.row !== undefined && npc.row !== null) {
        srcX = npc.col * 26;
        srcY = npc.row * 36;
      } else {
        const cIdx = npc.charIndex !== undefined ? npc.charIndex : 0;
        const baseRow = Math.floor(cIdx / 4) * 4;
        const baseCol = (cIdx % 4) * 3 + 1;
        srcX = baseCol * 26;
        srcY = baseRow * 36;
      }
      ctx.drawImage(img, srcX, srcY, 26, 36, 6, 2, 52, 60);
    } else {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(8, 8, 48, 48);
      ctx.fillStyle = '#fff';
      ctx.font = '24px sans-serif';
      ctx.fillText(npc.name ? npc.name[0] : 'N', 22, 40);
    }
  }

  addVocab(word, meaning) {
    if (!word || this.learnedVocab.has(word)) return;

    this.learnedVocab.set(word, meaning);
    this.updateVocabUI(word, meaning);
    this.showToast(`+1 Kata Baru: ${word}!`);
    if (this.questEngine) {
      this.questEngine.onLearnVocab(this.learnedVocab);
    }
  }

  updateVocabUI(newWord, newMeaning) {
    const emptyMsg = this.vocabList.querySelector('.empty-msg');
    if (emptyMsg) {
      emptyMsg.remove();
    }

    const li = document.createElement('li');
    li.className = 'vocab-item';
    li.innerHTML = `
      <div class="vocab-javanese">${newWord}</div>
      <div class="vocab-indonesian">${newMeaning}</div>
    `;
    this.vocabList.appendChild(li);
    this.vocabList.scrollTop = this.vocabList.scrollHeight;

    this.vocabCounter.innerText = `${this.learnedVocab.size} kata`;
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  isQuizActive() {
    return !!this.currentQuiz && this.quizModal && !this.quizModal.classList.contains('hidden');
  }

  showQuizModal(quizData, onComplete = null) {
    if (!quizData || !quizData.questions || quizData.questions.length === 0) return;

    this.currentQuiz = quizData;
    this.currentQuestionIdx = 0;
    this.selectedOptionIdx = null;
    this.answeredCurrentQuestion = false;
    this.score = 0;
    this.onQuizComplete = onComplete;

    this.quizTitle.innerText = quizData.title || 'Kuis Kosakata NPC';
    this.quizModal.classList.remove('hidden');

    this.renderQuestion();
  }

  hideQuizModal() {
    const finishedQuiz = this.currentQuiz;
    const finalScore = this.score;
    this.quizModal.classList.add('hidden');
    this.currentQuiz = null;
    if (this.onQuizComplete) {
      this.onQuizComplete(finalScore);
    }
    if (this.questEngine && finishedQuiz) {
      const total = finishedQuiz.questions ? finishedQuiz.questions.length : 0;
      this.questEngine.onQuizComplete(finishedQuiz.npcId, finalScore, total);
    }
  }

  renderQuestion() {
    const q = this.currentQuiz.questions[this.currentQuestionIdx];
    const total = this.currentQuiz.questions.length;

    this.quizProgress.innerText = `Pertanyaan ${this.currentQuestionIdx + 1} dari ${total}`;
    this.quizQuestion.innerText = q.question;
    this.selectedOptionIdx = null;
    this.answeredCurrentQuestion = false;

    this.quizFeedback.classList.add('hidden');
    this.quizFeedback.innerHTML = '';

    this.nextQuizBtn.classList.add('hidden');

    this.quizOptions.innerHTML = '';
    q.options.forEach((optText, idx) => {
      const card = document.createElement('div');
      card.className = 'quiz-option-card';
      card.innerText = `${String.fromCharCode(65 + idx)}. ${optText}`;
      card.dataset.idx = idx;

      card.addEventListener('click', () => {
        if (this.answeredCurrentQuestion) return;
        this.selectAndCheckAnswer(idx, q);
      });

      this.quizOptions.appendChild(card);
    });
  }

  selectAndCheckAnswer(selectedIdx, q) {
    this.answeredCurrentQuestion = true;
    this.selectedOptionIdx = selectedIdx;
    const isCorrect = selectedIdx === q.answer;

    const cards = this.quizOptions.querySelectorAll('.quiz-option-card');
    cards.forEach((card, idx) => {
      if (idx === q.answer) {
        card.classList.add('correct');
      } else if (idx === selectedIdx && !isCorrect) {
        card.classList.add('incorrect');
      }
    });

    this.quizFeedback.classList.remove('hidden');
    if (isCorrect) {
      this.score++;
      if (window.SoundManager) {
        window.SoundManager.playCorrect();
      }

      const correctCard = this.quizOptions.querySelector(`.quiz-option-card[data-idx="${selectedIdx}"]`);
      if (correctCard) {
        correctCard.classList.add('correct-pulse');
      }

      this.quizFeedback.className = 'quiz-feedback success';
      this.quizFeedback.innerHTML = `<span class="feedback-badge"><i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Benar!</span> <span>${q.explanation || ''}</span>`;

      if (q.teaches && q.teaches.word) {
        this.addVocab(q.teaches.word, q.teaches.meaning);
      } else {
        this.extractAndAddVocabFromQuestion(q);
      }
    } else {
      if (window.SoundManager) {
        window.SoundManager.playIncorrect();
      }

      const wrongCard = this.quizOptions.querySelector(`.quiz-option-card[data-idx="${selectedIdx}"]`);
      if (wrongCard) {
        wrongCard.classList.add('shake-card');
      }

      this.quizFeedback.className = 'quiz-feedback error';
      this.quizFeedback.innerHTML = `<span class="feedback-badge"><i data-lucide="alert-circle" style="width: 14px; height: 14px;"></i> Kurang tepat.</span> <span>${q.explanation || ''}</span>`;
    }

    this.nextQuizBtn.classList.remove('hidden');
    if (this.currentQuestionIdx === this.currentQuiz.questions.length - 1) {
      this.nextQuizBtn.innerHTML = 'Selesai <i data-lucide="check" style="width: 14px; height: 14px;"></i>';
    } else {
      this.nextQuizBtn.innerHTML = 'Lanjut <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>';
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  extractAndAddVocabFromQuestion(q) {
    const vocabList = [
      { word: 'sedasa', meaning: 'sepuluh (10)' },
      { word: 'pinten', meaning: 'berapa' },
      { word: 'matur nuwun', meaning: 'terima kasih' },
      { word: 'mundhut', meaning: 'membeli' },
      { word: 'regine', meaning: 'harganya' },
      { word: 'sawah', meaning: 'sawah / ladang' },
      { word: 'pari', meaning: 'padi' },
      { word: 'toya', meaning: 'air' },
      { word: 'panen', meaning: 'panen' },
      { word: 'subur', meaning: 'subur' },
      { word: 'pripun kabare', meaning: 'apa kabar' },
      { word: 'sae', meaning: 'baik / sehat' },
      { word: 'bal-balan', meaning: 'main bola' },
      { word: 'kulawarga', meaning: 'keluarga' },
      { word: 'tentrem', meaning: 'tenteram / damai' }
    ];

    if (typeof DIALOGUES !== 'undefined') {
      for (const d of Object.values(DIALOGUES)) {
        if (Array.isArray(d.vocab)) {
          d.vocab.forEach(v => {
            if (v.word && v.meaning) vocabList.push(v);
          });
        }
        if (Array.isArray(d.lines)) {
          d.lines.forEach(l => {
            if (l.javanese && l.indonesian) {
              vocabList.push({ word: l.javanese, meaning: l.indonesian });
            }
          });
        }
      }
    }

    const textToSearch = `${q.question} ${q.explanation || ''}`.toLowerCase();
    for (const v of vocabList) {
      if (v && v.word && textToSearch.includes(v.word.toLowerCase())) {
        this.addVocab(v.word, v.meaning);
        break;
      }
    }
  }

  handleNextQuestion() {
    if (this.currentQuestionIdx < this.currentQuiz.questions.length - 1) {
      this.currentQuestionIdx++;
      this.renderQuestion();
    } else {
      const total = this.currentQuiz.questions.length;
      const quizFinalScore = this.score;
      const finishedQuiz = this.currentQuiz;
      
      this.showToast(`Kuis Selesai! Skor: ${quizFinalScore} / ${total}`);

      if (window.LearningStats && finishedQuiz) {
        window.LearningStats.recordQuizResult(finishedQuiz.npcId, quizFinalScore, total, 25);
      }
      
      // Extract target phrase for pronunciation practice
      let targetPhrase = 'Sugeng enjing sedherek sedaya.';
      let targetMeaning = 'Selamat pagi saudara sekalian.';
      const npcId = finishedQuiz.npcId || '';

      if (npcId === 'dimas') {
        targetPhrase = 'Sugeng enjing, pripun kabare?';
        targetMeaning = 'Selamat pagi, bagaimana kabarnya?';
      } else if (npcId === 'mbok_sari') {
        targetPhrase = 'Pinten regine sayur punika?';
        targetMeaning = 'Berapa harga sayur ini?';
      } else if (npcId === 'pak_joko') {
        targetPhrase = 'Sawah ing kidul iki subur banget.';
        targetMeaning = 'Sawah di sebelah selatan ini sangat subur.';
      } else if (npcId === 'mbah_kakung') {
        targetPhrase = 'Sugeng rawuh wonten ing Balai Joglo.';
        targetMeaning = 'Selamat datang di Balai Joglo.';
      } else if (finishedQuiz.questions && finishedQuiz.questions[0] && finishedQuiz.questions[0].teaches) {
        targetPhrase = finishedQuiz.questions[0].teaches.word;
        targetMeaning = finishedQuiz.questions[0].teaches.meaning;
      }

      // Extract NPC voice persona, speed, and pitch
      let npcVoice = 'jv-ID-SitiNeural';
      let npcSpeed = 1.0;
      let npcPitch = 0;

      if (typeof DIALOGUES !== 'undefined' && DIALOGUES[npcId]) {
        const d = DIALOGUES[npcId];
        if (d.voice) npcVoice = d.voice;
        if (d.speed !== undefined) npcSpeed = parseFloat(d.speed) || 1.0;
        if (d.pitch !== undefined) npcPitch = parseInt(d.pitch, 10) || 0;
      } else if (npcId === 'dimas' || npcId === 'pak_joko' || npcId === 'mbah_kakung' || npcId === 'budi' || npcId === 'pak_tyson' || npcId === 'raden_atif') {
        npcVoice = 'jv-ID-DimasNeural';
      }

      // Hide quiz modal
      this.quizModal.classList.add('hidden');
      this.currentQuiz = null;

      // Open Gladhen Micara (NusaTTSE Pronunciation Challenge) with NPC-specific voice, speed, and pitch
      this.showPronounceModal(targetPhrase, targetMeaning, (pronounceScore) => {
        if (this.onQuizComplete) {
          this.onQuizComplete(quizFinalScore);
        }
        if (this.questEngine && finishedQuiz) {
          this.questEngine.onQuizComplete(finishedQuiz.npcId, quizFinalScore, total);
        }
      }, npcVoice, npcSpeed, npcPitch);
    }
  }

  isPronounceActive() {
    return !!this.pronounceModal && !this.pronounceModal.classList.contains('hidden');
  }

  showPronounceModal(targetText, translation, onComplete = null, voice = 'jv-ID-SitiNeural', speed = 1.0, pitch = 0) {
    this.currentPronounceTarget = {
      text: targetText || 'Sugeng enjing sedherek sedaya.',
      translation: translation || 'Selamat pagi saudara sekalian.',
      voice: voice || 'jv-ID-SitiNeural',
      speed: speed !== undefined ? speed : 1.0,
      pitch: pitch !== undefined ? pitch : 0
    };
    this.onPronounceComplete = onComplete;
    this.isRecordingPronounce = false;
    this.lastPronounceEvalResult = null;

    if (this.pronounceTargetText) {
      this.pronounceTargetText.innerText = `"${this.currentPronounceTarget.text}"`;
    }
    if (this.pronounceTranslation) {
      this.pronounceTranslation.innerText = `(${this.currentPronounceTarget.translation})`;
    }

    if (this.pronounceResultCard) {
      this.pronounceResultCard.classList.add('hidden');
    }
    if (this.recordMicBtn) {
      this.recordMicBtn.classList.remove('recording');
    }
    if (this.micLiveWave) {
      this.micLiveWave.classList.add('hidden');
    }
    if (this.recordingTimer) {
      this.recordingTimer.classList.add('hidden');
      this.recordingTimer.innerText = '00:00';
    }
    if (this.micStatusText) {
      this.micStatusText.innerText = 'Tekan tombol mikrofon di bawah ini lalu ucapkan kalimat di atas dengan jelas:';
    }

    if (this.pronounceModal) {
      this.pronounceModal.classList.remove('hidden');
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  hidePronounceModal(completed = false) {
    if (window.SpeechEvaluator) {
      window.SpeechEvaluator.stopAudio();
      if (this.isRecordingPronounce) {
        window.SpeechEvaluator.stopRecording().catch(() => {});
        this.isRecordingPronounce = false;
      }
    }

    if (this.recordTimerInterval) {
      clearInterval(this.recordTimerInterval);
      this.recordTimerInterval = null;
    }

    if (this.pronounceModal) {
      this.pronounceModal.classList.add('hidden');
    }

    if (completed) {
      this.showToast('+50 XP Bonus Latihan Pengucapan!');
      if (this.questEngine) {
        this.questEngine.playerXP = (this.questEngine.playerXP || 0) + 50;
        this.questEngine.saveState();
        this.updateQuestTracker();
      }

      if (window.LearningStats && this.lastPronounceEvalResult && this.currentPronounceTarget) {
        window.LearningStats.recordPronunciationResult(
          this.currentPronounceTarget.text,
          this.currentPronounceTarget.translation,
          this.lastPronounceEvalResult,
          50
        );

        this.showActivitySummary('PRONOUNCE', {
          score: this.lastPronounceEvalResult.overall_score || 85,
          fluencyRating: this.lastPronounceEvalResult.fluency_rating || 'Sangat Fasih',
          ratingBadge: this.lastPronounceEvalResult.rating_badge || 'excellent',
          targetText: this.currentPronounceTarget.text,
          translation: this.currentPronounceTarget.translation,
          xpEarned: 50,
          feedback: (this.lastPronounceEvalResult.feedback && this.lastPronounceEvalResult.feedback[0]) || 'Pengucapan bahasa Jawa Anda sudah jelas!'
        });
      }
    }

    if (this.onPronounceComplete) {
      this.onPronounceComplete(completed ? 100 : 0);
      this.onPronounceComplete = null;
    }
  }

  async handlePronounceListen() {
    if (!this.currentPronounceTarget || !window.SpeechEvaluator) return;

    if (this.pronounceListenBtn) {
      this.pronounceListenBtn.classList.add('playing');
    }

    try {
      await window.SpeechEvaluator.playTts(
        this.currentPronounceTarget.text,
        this.currentPronounceTarget.voice || 'jv-ID-SitiNeural',
        this.currentPronounceTarget.speed !== undefined ? this.currentPronounceTarget.speed : 1.0,
        this.currentPronounceTarget.pitch !== undefined ? this.currentPronounceTarget.pitch : 0,
        () => {
          if (this.pronounceListenBtn) this.pronounceListenBtn.classList.add('playing');
        },
        () => {
          if (this.pronounceListenBtn) this.pronounceListenBtn.classList.remove('playing');
        }
      );
    } catch (e) {
      if (this.pronounceListenBtn) this.pronounceListenBtn.classList.remove('playing');
    }
  }

  async handleTogglePronounceRecord() {
    if (!window.SpeechEvaluator) return;

    if (!this.isRecordingPronounce) {
      // Start recording
      try {
        await window.SpeechEvaluator.startRecording();
        this.isRecordingPronounce = true;

        if (this.recordMicBtn) {
          this.recordMicBtn.classList.add('recording');
        }
        if (this.micLiveWave) {
          this.micLiveWave.classList.remove('hidden');
        }
        if (this.recordingTimer) {
          this.recordingTimer.classList.remove('hidden');
        }
        if (this.micStatusText) {
          this.micStatusText.innerText = '🎙️ Sedang merekam... Ucapkan kalimat tersebut sekarang!';
        }

        let seconds = 0;
        if (this.recordTimerInterval) clearInterval(this.recordTimerInterval);
        this.recordTimerInterval = setInterval(() => {
          seconds++;
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          if (this.recordingTimer) {
            this.recordingTimer.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          }
          if (seconds >= 8) {
            this.handleTogglePronounceRecord(); // Auto-stop after 8s
          }
        }, 1000);
      } catch (err) {
        this.showToast('Izin mikrofon diperlukan untuk latihan pengucapan.');
      }
    } else {
      // Stop recording and evaluate
      if (this.recordTimerInterval) {
        clearInterval(this.recordTimerInterval);
        this.recordTimerInterval = null;
      }

      this.isRecordingPronounce = false;
      if (this.recordMicBtn) {
        this.recordMicBtn.classList.remove('recording');
      }
      if (this.micLiveWave) {
        this.micLiveWave.classList.add('hidden');
      }
      if (this.micStatusText) {
        this.micStatusText.innerText = '⏳ Sedang mengevaluasi suara Anda...';
      }

      const recordedData = await window.SpeechEvaluator.stopRecording();
      const evalResult = await window.SpeechEvaluator.evaluatePronunciation(
        this.currentPronounceTarget ? this.currentPronounceTarget.text : '',
        recordedData
      );

      this.displayPronunciationResults(evalResult);
    }
  }

  displayPronunciationResults(evalResult) {
    if (!evalResult) return;
    this.lastPronounceEvalResult = evalResult;

    if (this.micStatusText) {
      this.micStatusText.innerText = 'Hasil Evaluasi Pengucapan:';
    }

    if (this.evalOverallScore) {
      this.evalOverallScore.innerText = evalResult.overall_score || 85;
    }

    if (this.evalRatingBadge) {
      this.evalRatingBadge.className = `eval-rating-badge ${evalResult.rating_badge || 'good'}`;
      this.evalRatingBadge.innerText = evalResult.fluency_rating || 'Sudah Bagus';
    }

    if (this.evalFeedbackText) {
      const fb = (evalResult.feedback && evalResult.feedback[0]) ||
        (evalResult.overall_score >= 80
          ? 'Luar biasa! Pengucapan dan intonasi bahasa Jawa Anda sudah lancar dan jelas.'
          : (evalResult.overall_score >= 60
              ? 'Sudah bagus! Ada beberapa kata yang masih bisa disempurnakan lagi.'
              : 'Ayo coba latihan lagi! Dengarkan contoh suara terlebih dahulu lalu ulangi.'));
      this.evalFeedbackText.innerText = fb;
    }

    if (this.wordChipsContainer && Array.isArray(evalResult.word_analysis)) {
      this.wordChipsContainer.innerHTML = '';
      evalResult.word_analysis.forEach(item => {
        const chip = document.createElement('span');
        chip.className = `word-chip ${item.status || 'correct'}`;
        
        let iconName = 'check';
        if (item.status === 'mispronounced') iconName = 'alert-triangle';
        else if (item.status === 'missing') iconName = 'x';

        chip.innerHTML = `<i data-lucide="${iconName}" style="width: 12px; height: 12px;"></i> ${item.word}`;
        chip.title = item.tip || '';
        this.wordChipsContainer.appendChild(chip);
      });
    }

    if (this.pronounceResultCard) {
      this.pronounceResultCard.classList.remove('hidden');
    }

    if (window.SoundManager && evalResult.overall_score >= 70) {
      window.SoundManager.playCorrect();
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  setQuestEngine(questEngine) {
    this.questEngine = questEngine;
    if (this.questEngine) {
      this.questEngine.setUiManager(this);
    }
    this.updateQuestTracker();
  }

  updateQuestTracker() {
    if (!this.questTrackerText) return;
    if (this.questEngine) {
      this.questTrackerText.innerText = this.questEngine.getActiveStepInstruction();
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  toggleQuestModal() {
    if (!this.questModal) return;
    if (window.game && window.game.isTitleScreen) return;
    const isHidden = this.questModal.classList.contains('hidden');
    if (isHidden) {
      this.showQuestModalUI();
    } else {
      this.hideQuestModalUI();
    }
  }

  showQuestModalUI() {
    if (!this.questModal) return;
    if (window.game && window.game.isTitleScreen) return;
    this.hideHudPanels();
    this.questModal.classList.remove('hidden');
    this.renderQuestLog();
  }

  hideQuestModalUI() {
    if (!this.questModal) return;
    this.questModal.classList.add('hidden');
    if (window.game && !window.game.isTitleScreen && !this.isStatsModalActive()) {
      this.showHudPanels();
    }
  }

  isQuestModalActive() {
    return this.questModal && !this.questModal.classList.contains('hidden');
  }

  getLucideIconForBadge(icon) {
    if (!icon) return 'award';
    if (icon === '🛍️' || icon === 'shopping-bag') return 'shopping-bag';
    if (icon === '🏛️' || icon === 'landmark') return 'landmark';
    if (icon === '🏅' || icon === 'medal') return 'medal';
    if (icon === '🏆' || icon === 'trophy') return 'trophy';
    if (icon === 'compass' || icon === 'sprout' || icon === 'sparkles' || icon === 'book-open') return icon;
    return icon;
  }

  renderQuestLog() {
    if (!this.questEngine || !this.questList) return;

    const quests = this.questEngine.getAllQuests();
    const xp = this.questEngine.getPlayerXP();
    const playerBadges = this.questEngine.getPlayerBadges();

    if (this.questPlayerXp) {
      this.questPlayerXp.innerHTML = `<i data-lucide="sparkles" style="width: 13px; height: 13px;"></i> ${xp} XP`;
    }

    this.questList.innerHTML = '';
    quests.forEach(quest => {
      const card = document.createElement('div');
      const statusClass = quest.status.toLowerCase();
      const statusHyphen = statusClass.replace('_', '-');
      card.className = `quest-card ${statusClass} ${statusHyphen}`;

      let statusLabel = 'Belum Dimulai';
      if (quest.status === 'IN_PROGRESS') statusLabel = 'Sedang Berjalan';
      if (quest.status === 'COMPLETED') statusLabel = 'Selesai';

      const stepsHtml = quest.steps.map((step, idx) => {
        let stepStatusClass = '';
        let stepIconName = 'circle';
        let stepIconClass = 'step-icon todo';

        if (step.completed) {
          stepStatusClass = 'completed';
          stepIconName = 'check-circle-2';
          stepIconClass = 'step-icon done';
        } else if (quest.status === 'IN_PROGRESS' && quest.steps.findIndex(s => !s.completed) === idx) {
          stepStatusClass = 'active';
          stepIconName = 'arrow-right-circle';
          stepIconClass = 'step-icon active';
        }

        return `<li class="quest-step-item ${stepStatusClass}"><i data-lucide="${stepIconName}" class="${stepIconClass}"></i> <span>${step.description}</span></li>`;
      }).join('');

      const rewardIcon = this.getLucideIconForBadge(quest.reward ? quest.reward.icon : null);

      card.innerHTML = `
        <div class="quest-card-header">
          <span class="quest-card-title">${quest.title}</span>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="quest-card-desc">${quest.description}</div>
        <ul class="quest-steps-list">
          ${stepsHtml}
        </ul>
        <div class="quest-card-reward">
          <i data-lucide="gift" style="width: 13px; height: 13px;"></i> Hadiah: +${quest.reward.xp} XP | <i data-lucide="${rewardIcon}" class="badge-icon"></i> ${quest.reward.badge}
        </div>
      `;

      this.questList.appendChild(card);
    });

    if (this.badgeContainer) {
      this.badgeContainer.innerHTML = '';
      const allPossibleBadges = (typeof this.questEngine.getAllBadges === 'function')
        ? this.questEngine.getAllBadges()
        : [
            { name: 'Lencana Pitepangan', icon: 'compass' },
            { name: 'Lencana Pasar Gede', icon: 'shopping-bag' },
            { name: 'Lencana Tani Makmur', icon: 'sprout' },
            { name: 'Lencana Tata Krama', icon: 'landmark' }
          ];

      allPossibleBadges.forEach(b => {
        const isUnlocked = playerBadges.includes(b.name);
        const item = document.createElement('div');
        item.className = `badge-item ${isUnlocked ? 'unlocked' : ''}`;
        const iconName = this.getLucideIconForBadge(b.icon);
        item.innerHTML = `<i data-lucide="${iconName}" class="badge-icon"></i> <span>${b.name}</span>`;
        this.badgeContainer.appendChild(item);
      });
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // =========================================================================
  // Learning Stats Modal & Activity Celebration Methods
  // =========================================================================

  toggleStatsModal() {
    if (!this.statsModal) return;
    if (window.game && window.game.isTitleScreen) return;
    const isHidden = this.statsModal.classList.contains('hidden');
    if (isHidden) {
      this.showStatsModal();
    } else {
      this.hideStatsModal();
    }
  }

  showStatsModal(initialTab = 'overview') {
    if (!this.statsModal) return;
    if (window.game && window.game.isTitleScreen) return;
    this.hideHudPanels();
    this.statsModal.classList.remove('hidden');
    this.switchStatsTab(initialTab);
    this.renderStatsDashboard();
  }

  hideStatsModal() {
    if (!this.statsModal) return;
    this.statsModal.classList.add('hidden');
    if (window.game && !window.game.isTitleScreen && !this.isQuestModalActive()) {
      this.showHudPanels();
    }
  }

  isStatsModalActive() {
    return this.statsModal && !this.statsModal.classList.contains('hidden');
  }

  switchStatsTab(tabName) {
    if (!tabName) return;
    this.activeStatsTab = tabName;

    if (this.statsTabBtns) {
      this.statsTabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    const panes = {
      overview: document.getElementById('statsTabOverview'),
      pronunciation: document.getElementById('statsTabPronunciation'),
      quiz: document.getElementById('statsTabQuiz'),
      quests: document.getElementById('statsTabQuests'),
      vocab: document.getElementById('statsTabVocab')
    };

    Object.entries(panes).forEach(([name, el]) => {
      if (el) {
        if (name === tabName) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    if (tabName === 'vocab') {
      this.renderVocabGlossary(this.vocabSearchInput ? this.vocabSearchInput.value.trim() : '');
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  renderStatsDashboard() {
    if (!window.LearningStats) return;

    const statsSummary = window.LearningStats.getSummaryStats(this.questEngine, this);
    const { levelInfo, xp, quests, quiz, pronunciation, vocab } = statsSummary;

    // Header XP
    if (this.statsHeaderXp) {
      this.statsHeaderXp.innerHTML = `<i data-lucide="sparkles" style="width: 13px; height: 13px;"></i> ${xp} XP`;
    }

    // Tab 1: Overview
    const playerRankIcon = document.getElementById('playerRankIcon');
    const playerLevelNumber = document.getElementById('playerLevelNumber');
    const playerRankTitle = document.getElementById('playerRankTitle');
    const levelProgressBar = document.getElementById('levelProgressBar');
    const levelXpRatio = document.getElementById('levelXpRatio');
    const levelXpRemaining = document.getElementById('levelXpRemaining');

    if (playerRankIcon) {
      playerRankIcon.setAttribute('data-lucide', levelInfo.icon || 'award');
    }
    if (playerLevelNumber) {
      playerLevelNumber.innerText = `LEVEL ${levelInfo.level}`;
    }
    if (playerRankTitle) {
      playerRankTitle.innerText = levelInfo.title;
    }
    if (levelProgressBar) {
      levelProgressBar.style.width = `${levelInfo.progressPercent}%`;
    }
    if (levelXpRatio) {
      levelXpRatio.innerText = `${xp} / ${levelInfo.nextLevelMinXp} XP`;
    }
    if (levelXpRemaining) {
      levelXpRemaining.innerText = levelInfo.isMaxLevel
        ? 'Level Maksimal Tercapai!'
        : `${levelInfo.xpNeededForNext} XP lagi menuju Level ${levelInfo.level + 1}`;
    }

    // Metric Grid
    const metricQuestsCompleted = document.getElementById('metricQuestsCompleted');
    const metricQuestsPercent = document.getElementById('metricQuestsPercent');
    const metricVocabMastered = document.getElementById('metricVocabMastered');
    const metricAvgPronounce = document.getElementById('metricAvgPronounce');
    const metricPronounceCount = document.getElementById('metricPronounceCount');
    const metricQuizAccuracy = document.getElementById('metricQuizAccuracy');
    const metricQuizCount = document.getElementById('metricQuizCount');

    if (metricQuestsCompleted) metricQuestsCompleted.innerText = `${quests.completed} / ${quests.total}`;
    if (metricQuestsPercent) metricQuestsPercent.innerText = `${quests.percent}% Selesai`;
    if (metricVocabMastered) metricVocabMastered.innerText = vocab.count;
    if (metricAvgPronounce) metricAvgPronounce.innerText = `${pronunciation.avgScore}%`;
    if (metricPronounceCount) metricPronounceCount.innerText = `${pronunciation.sessions} Sesi Latihan`;
    if (metricQuizAccuracy) metricQuizAccuracy.innerText = `${quiz.accuracy}%`;
    if (metricQuizCount) metricQuizCount.innerText = `${quiz.attempted} Kuis Diikuti`;

    // Tab 2: Pronunciation
    const tabPronounceAvgScore = document.getElementById('tabPronounceAvgScore');
    const tabPronounceTotalSessions = document.getElementById('tabPronounceTotalSessions');
    const tabPronounceBestScore = document.getElementById('tabPronounceBestScore');
    const distBarExcellent = document.getElementById('distBarExcellent');
    const distCountExcellent = document.getElementById('distCountExcellent');
    const distBarGood = document.getElementById('distBarGood');
    const distCountGood = document.getElementById('distCountGood');
    const distBarFair = document.getElementById('distBarFair');
    const distCountFair = document.getElementById('distCountFair');
    const recentPronounceList = document.getElementById('recentPronounceList');

    if (tabPronounceAvgScore) tabPronounceAvgScore.innerText = pronunciation.avgScore;
    if (tabPronounceTotalSessions) tabPronounceTotalSessions.innerText = `${pronunciation.sessions} kali`;
    if (tabPronounceBestScore) tabPronounceBestScore.innerText = `${pronunciation.bestScore} / 100`;

    const totalFluency = Math.max(1, pronunciation.sessions);
    if (distBarExcellent && distCountExcellent) {
      const cnt = pronunciation.breakdown.excellent || 0;
      distCountExcellent.innerText = cnt;
      distBarExcellent.style.width = `${Math.round((cnt / totalFluency) * 100)}%`;
    }
    if (distBarGood && distCountGood) {
      const cnt = pronunciation.breakdown.good || 0;
      distCountGood.innerText = cnt;
      distBarGood.style.width = `${Math.round((cnt / totalFluency) * 100)}%`;
    }
    if (distBarFair && distCountFair) {
      const cnt = pronunciation.breakdown.fair || 0;
      distCountFair.innerText = cnt;
      distBarFair.style.width = `${Math.round((cnt / totalFluency) * 100)}%`;
    }

    if (recentPronounceList) {
      if (!pronunciation.recent || pronunciation.recent.length === 0) {
        recentPronounceList.innerHTML = `<div class="recent-item-card" style="justify-content: center; color: #78716c; font-size: 11px;">Belum ada riwayat latihan pengucapan. Selesaikan kuis untuk mulai berbicara!</div>`;
      } else {
        recentPronounceList.innerHTML = pronunciation.recent.map(item => `
          <div class="recent-item-card">
            <div class="recent-item-left">
              <span class="recent-item-text">"${item.text}"</span>
              <span class="recent-item-sub">(${item.translation}) • ${item.fluencyRating || 'Bagus'}</span>
            </div>
            <div class="recent-item-right">
              <span class="score-chip ${item.ratingBadge || 'good'}">${item.score}%</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Tab 3: Quiz
    const tabQuizAccuracy = document.getElementById('tabQuizAccuracy');
    const tabQuizQuestionsCount = document.getElementById('tabQuizQuestionsCount');
    const tabQuizCorrectCount = document.getElementById('tabQuizCorrectCount');
    const tabQuizPerfectCount = document.getElementById('tabQuizPerfectCount');
    const recentQuizList = document.getElementById('recentQuizList');

    if (tabQuizAccuracy) tabQuizAccuracy.innerText = `${quiz.accuracy}%`;
    if (tabQuizQuestionsCount) tabQuizQuestionsCount.innerText = quiz.totalQuestions;
    if (tabQuizCorrectCount) tabQuizCorrectCount.innerText = `${quiz.correctAnswers} benar`;
    if (tabQuizPerfectCount) tabQuizPerfectCount.innerText = quiz.perfectCount;

    if (recentQuizList) {
      if (!quiz.recent || quiz.recent.length === 0) {
        recentQuizList.innerHTML = `<div class="recent-item-card" style="justify-content: center; color: #78716c; font-size: 11px;">Belum ada riwayat kuis. Bicara dengan warga desa untuk mengikuti kuis!</div>`;
      } else {
        recentQuizList.innerHTML = quiz.recent.map(item => `
          <div class="recent-item-card">
            <div class="recent-item-left">
              <span class="recent-item-text">Kuis Bersama ${item.npcId ? item.npcId.replace('_', ' ').toUpperCase() : 'Warga'}</span>
              <span class="recent-item-sub">Skor: ${item.score} / ${item.totalQuestions} (${item.accuracy}%)</span>
            </div>
            <div class="recent-item-right">
              <span class="score-chip ${item.accuracy >= 80 ? 'excellent' : (item.accuracy >= 50 ? 'good' : 'fair')}">${item.accuracy}%</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Tab 4: Quests & Badges
    const tabQuestsList = document.getElementById('tabQuestsList');
    const tabBadgesGrid = document.getElementById('tabBadgesGrid');
    if (this.questEngine && tabQuestsList) {
      const allQuests = this.questEngine.getAllQuests();
      tabQuestsList.innerHTML = allQuests.map(q => {
        let statusBadge = `<span class="score-chip fair">Belum Dimulai</span>`;
        if (q.status === 'IN_PROGRESS') statusBadge = `<span class="score-chip good">Sedang Berjalan</span>`;
        if (q.status === 'COMPLETED') statusBadge = `<span class="score-chip excellent">Selesai ✓</span>`;

        return `
          <div class="tab-quest-item ${q.status.toLowerCase()}">
            <div>
              <div class="tab-quest-title">${q.title}</div>
              <div style="font-size: 10px; color: #78716c;">${q.description}</div>
            </div>
            <div>${statusBadge}</div>
          </div>
        `;
      }).join('');
    }

    if (this.questEngine && tabBadgesGrid) {
      const playerBadges = this.questEngine.getPlayerBadges();
      const allPossibleBadges = (typeof this.questEngine.getAllBadges === 'function')
        ? this.questEngine.getAllBadges()
        : [
            { name: 'Lencana Pitepangan', icon: 'compass' },
            { name: 'Lencana Pasar Gede', icon: 'shopping-bag' },
            { name: 'Lencana Tani Makmur', icon: 'sprout' },
            { name: 'Lencana Tata Krama', icon: 'landmark' }
          ];

      tabBadgesGrid.innerHTML = allPossibleBadges.map(b => {
        const isUnlocked = playerBadges.includes(b.name);
        const iconName = this.getLucideIconForBadge(b.icon);
        return `
          <div class="tab-badge-card ${isUnlocked ? 'unlocked' : ''}">
            <i data-lucide="${iconName}" style="width: 24px; height: 24px;"></i>
            <span class="tab-badge-name">${b.name}</span>
            <span style="font-size: 8px; color: ${isUnlocked ? '#047857' : '#a8a29e'}; font-weight: bold;">
              ${isUnlocked ? 'Terbuka' : 'Terkunci'}
            </span>
          </div>
        `;
      }).join('');
    }

    // Tab 5: Vocab Glossary
    this.renderVocabGlossary();

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  renderVocabGlossary(query = '') {
    const container = document.getElementById('tabVocabCardsContainer');
    const counter = document.getElementById('vocabTabTotalCounter');
    if (!container) return;

    const vocabEntries = [];
    if (this.learnedVocab && this.learnedVocab.size > 0) {
      for (const [word, meaning] of this.learnedVocab.entries()) {
        vocabEntries.push({ word, meaning });
      }
    }

    if (counter) {
      counter.innerText = `${vocabEntries.length} Kata Dikuasai`;
    }

    const cleanQuery = (query || '').toLowerCase().trim();
    const filtered = cleanQuery
      ? vocabEntries.filter(v => v.word.toLowerCase().includes(cleanQuery) || v.meaning.toLowerCase().includes(cleanQuery))
      : vocabEntries;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 24px 12px; color: #78716c; font-size: 11px;">
          ${vocabEntries.length === 0 ? 'Belum ada kosakata yang dipelajari. Bicara dengan warga desa untuk mulai mengoleksi kata!' : 'Tidak ada kosakata yang cocok dengan pencarian.'}
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => `
      <div class="vocab-card-item">
        <div>
          <div class="vocab-card-word">"${item.word}"</div>
          <div class="vocab-card-meaning">${item.meaning}</div>
        </div>
        <button class="vocab-listen-audio-btn" data-word="${item.word}" title="Dengarkan pengucapan">
          <i data-lucide="volume-2" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    `).join('');

    // Attach TTS audio triggers to vocab cards
    container.querySelectorAll('.vocab-listen-audio-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = btn.getAttribute('data-word');
        if (word && window.SpeechEvaluator) {
          window.SpeechEvaluator.playTts(word, 'jv-ID-SitiNeural', 1.0, 0);
        }
      });
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // =========================================================================
  // Activity Celebration Popup Modal
  // =========================================================================

  showActivitySummary(type, data = {}) {
    if (!this.activitySummaryModal) return;
    this.hideHudPanels();

    const heroWrap = this.summaryHeroIconWrap;
    const heroIcon = this.summaryHeroIcon;
    const mainTitle = this.summaryMainTitle;
    const subTitle = this.summarySubTitle;
    const xpText = this.summaryXpEarnedText;
    const badgeCard = this.summaryBadgeUnlockCard;
    const badgeName = this.summaryBadgeName;
    const badgeIcon = this.summaryBadgeIcon;
    const row1Label = this.summaryStatLabel1;
    const row1Val = this.summaryStatVal1;
    const row2Label = this.summaryStatLabel2;
    const row2Val = this.summaryStatVal2;
    const feedbackBox = this.summaryFeedbackText;

    if (type === 'QUEST') {
      if (heroWrap) heroWrap.className = 'summary-hero-icon quest-mode';
      if (heroIcon) heroIcon.setAttribute('data-lucide', 'trophy');
      if (mainTitle) mainTitle.innerText = 'MISI BUDAYA SELESAI!';
      if (subTitle) subTitle.innerText = data.title || 'Kerja luar biasa! Kamu telah menuntaskan misi ini.';
      if (xpText) xpText.innerText = `+${data.xpEarned || 100} XP Diberikan!`;

      if (badgeCard && data.badgeEarned) {
        badgeCard.classList.remove('hidden');
        if (badgeName) badgeName.innerText = data.badgeEarned;
        if (badgeIcon) badgeIcon.setAttribute('data-lucide', this.getLucideIconForBadge(data.badgeIcon));
      } else if (badgeCard) {
        badgeCard.classList.add('hidden');
      }

      if (row1Label) row1Label.innerText = 'Status Misi:';
      if (row1Val) row1Val.innerText = 'Tuntas 100%';
      if (row2Label) row2Label.innerText = 'Misi Berikutnya:';
      if (row2Val) row2Val.innerText = data.nextQuestTitle || 'Semua Selesai';
      if (feedbackBox) feedbackBox.innerText = 'Pengetahuan budaya dan tata krama bahasa Jawa Anda semakin meningkat!';

    } else if (type === 'PRONOUNCE') {
      if (heroWrap) heroWrap.className = 'summary-hero-icon pronounce-mode';
      if (heroIcon) heroIcon.setAttribute('data-lucide', 'mic');
      if (mainTitle) mainTitle.innerText = 'LATIHAN PENGUCAPAN SELESAI!';
      if (subTitle) subTitle.innerText = `"${data.targetText || 'Sugeng enjing'}" (${data.translation || ''})`;
      if (xpText) xpText.innerText = `+${data.xpEarned || 50} XP Bonus Pengucapan!`;
      if (badgeCard) badgeCard.classList.add('hidden');

      if (row1Label) row1Label.innerText = 'Skor Pengucapan:';
      if (row1Val) row1Val.innerText = `${data.score || 85} / 100`;
      if (row2Label) row2Label.innerText = 'Kelancaran:';
      if (row2Val) row2Val.innerText = data.fluencyRating || 'Sangat Fasih';
      if (feedbackBox) feedbackBox.innerText = data.feedback || 'Luar biasa! Pengucapan bahasa Jawa Anda terdengar sangat natural.';

    } else if (type === 'QUIZ') {
      if (heroWrap) heroWrap.className = 'summary-hero-icon quiz-mode';
      if (heroIcon) heroIcon.setAttribute('data-lucide', 'help-circle');
      if (mainTitle) mainTitle.innerText = 'KUIS SELESAI!';
      if (subTitle) subTitle.innerText = `Kamu telah menyelesaikan kuis kosakata dengan baik.`;
      if (xpText) xpText.innerText = `+${data.xpEarned || 25} XP Diperoleh!`;
      if (badgeCard) badgeCard.classList.add('hidden');

      if (row1Label) row1Label.innerText = 'Skor Jawaban:';
      if (row1Val) row1Val.innerText = `${data.score || 0} / ${data.total || 3}`;
      if (row2Label) row2Label.innerText = 'Akurasi:';
      if (row2Val) row2Val.innerText = `${Math.round(((data.score || 0) / Math.max(1, data.total || 3)) * 100)}%`;
      if (feedbackBox) feedbackBox.innerText = 'Pertahankan prestasimu dan terus perkaya kosakata bahasa Jawa!';
    }

    if (window.SoundManager) {
      window.SoundManager.playCorrect();
    }

    this.activitySummaryModal.classList.remove('hidden');

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  hideActivitySummary() {
    if (!this.activitySummaryModal) return;
    this.activitySummaryModal.classList.add('hidden');
    if (window.game && !window.game.isTitleScreen && !this.isStatsModalActive() && !this.isQuestModalActive()) {
      this.showHudPanels();
    }
  }

  isActivitySummaryActive() {
    return this.activitySummaryModal && !this.activitySummaryModal.classList.contains('hidden');
  }
}
