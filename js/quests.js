/**
 * NusaQuest — Quest Engine
 * Handles RPG storyline chapters, step tracking, rewards, and state persistence.
 */

const QUEST_STATE_VERSION = 4;

const DEFAULT_QUESTS = [
  {
    id: "quest_1",
    title: "Bab I: Perkenalan di Tengah Desa",
    description: "Mulai perjalananmu di Desa NusaQuest dengan menyapa Dimas dan mempelajari tata krama menanyakan kabar.",
    npcId: "dimas",
    npcName: "Dimas",
    status: "IN_PROGRESS",
    reward: {
      xp: 75,
      badge: "Lencana Pitepangan",
      icon: "compass"
    },
    steps: [
      {
        id: "step_1",
        description: "Sapa Dimas yang sedang bermain di tengah desa.",
        type: "TALK_NPC",
        targetNpc: "dimas",
        completed: false
      },
      {
        id: "step_2",
        description: "Catat kata perkenalan ('pripun kabare' & 'sae') di buku kosakata.",
        type: "LEARN_VOCAB",
        targetWords: ["pripun kabare", "sae"],
        completed: false
      },
      {
        id: "step_3",
        description: "Jawab pertanyaan Dimas dengan menyelesaikan Kuis Perkenalan.",
        type: "PERFECT_QUIZ",
        targetNpc: "dimas",
        completed: false
      }
    ]
  },
  {
    id: "quest_2",
    title: "Bab II: Belanja di Pasar Gede",
    description: "Mbok Sari di pasar butuh bantuan untuk menghitung pesanan sayur dan belajar bahasa Jawa seputar angka & harga.",
    npcId: "mbok_sari",
    npcName: "Mbok Sari",
    status: "UNSTARTED",
    reward: {
      xp: 125,
      badge: "Lencana Pasar Gede",
      icon: "shopping-bag"
    },
    steps: [
      {
        id: "step_1",
        description: "Temui Mbok Sari di kios pasar sebelah timur.",
        type: "TALK_NPC",
        targetNpc: "mbok_sari",
        completed: false
      },
      {
        id: "step_2",
        description: "Kuasai kata angka dan harga ('sedasa', 'pinten', 'regine').",
        type: "LEARN_VOCAB",
        targetWords: ["sedasa", "pinten", "regine"],
        completed: false
      },
      {
        id: "step_3",
        description: "Selesaikan Kuis Pasar Gede dengan sempurna.",
        type: "PERFECT_QUIZ",
        targetNpc: "mbok_sari",
        completed: false
      }
    ]
  },
  {
    id: "quest_3",
    title: "Bab III: Suburnya Sawah Selatan",
    description: "Kunjungi Pak Joko di sawah sebelah selatan untuk mempelajari pengetahuan pertanian, air irigasi, dan bibit padi unggul.",
    npcId: "pak_joko",
    npcName: "Pak Joko",
    status: "UNSTARTED",
    reward: {
      xp: 175,
      badge: "Lencana Tani Makmur",
      icon: "sprout"
    },
    steps: [
      {
        id: "step_1",
        description: "Kunjungi Pak Joko yang sedang menggarap sawah di selatan.",
        type: "TALK_NPC",
        targetNpc: "pak_joko",
        completed: false
      },
      {
        id: "step_2",
        description: "Pelajari istilah pertanian ('sawah', 'pari', 'toya') dari Pak Joko.",
        type: "LEARN_VOCAB",
        targetWords: ["sawah", "pari", "toya"],
        completed: false
      },
      {
        id: "step_3",
        description: "Buktikan pengetahuan pertanianmu di Kuis Pak Joko.",
        type: "PERFECT_QUIZ",
        targetNpc: "pak_joko",
        completed: false
      }
    ]
  },
  {
    id: "quest_4",
    title: "Bab IV: Bertamu ke Sesepuh Joglo",
    description: "Setelah mengenal lingkungan desa, bertamulah ke Mbah Kakung di Balai Joglo untuk mempelajari tata krama Krama Alus.",
    npcId: "mbah_kakung",
    npcName: "Mbah Kakung",
    status: "UNSTARTED",
    reward: {
      xp: 225,
      badge: "Lencana Tata Krama",
      icon: "landmark"
    },
    steps: [
      {
        id: "step_1",
        description: "Masuk ke dalam Balai Desa Joglo.",
        type: "VISIT_MAP",
        targetMap: "balai_indoor",
        completed: false
      },
      {
        id: "step_2",
        description: "Bertamu ke Mbah Kakung dan pelajari kosakata Krama ('sugeng rawuh', 'kulawarga', 'tentrem').",
        type: "LEARN_VOCAB",
        targetWords: ["sugeng rawuh", "kulawarga", "tentrem"],
        completed: false
      },
      {
        id: "step_3",
        description: "Selesaikan Ujian Bahasa Krama dari Mbah Kakung dengan skor sempurna.",
        type: "PERFECT_QUIZ",
        targetNpc: "mbah_kakung",
        completed: false
      }
    ]
  }
];

class QuestEngine {
  constructor(uiManager = null) {
    this.uiManager = uiManager;
    this.quests = [];
    this.playerXP = 0;
    this.badges = [];
    this.isLoaded = false;

    this.init();
  }

  setUiManager(uiManager) {
    this.uiManager = uiManager;
  }

  async init() {
    this.quests = JSON.parse(JSON.stringify(DEFAULT_QUESTS));

    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/quests').catch(() => fetch('/data/quests.json'));
        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            this.quests = data.map(q => ({
              ...q,
              status: q.status || 'UNSTARTED',
              steps: (q.steps || []).map(s => ({ ...s, completed: false }))
            }));
          }
        }
      }
    } catch (e) {
      console.warn('[QuestEngine] Using default fallback quests:', e.message);
    }

    this.loadState();
    this.isLoaded = true;

    if (this.uiManager) {
      this.uiManager.updateQuestTracker();
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem('NUSAQUEST_QUESTS_STATE');
      if (saved) {
        const parsed = JSON.parse(saved);

        // Version migration: if save is from older quest structure, start fresh with current quests
        if (parsed.version === QUEST_STATE_VERSION) {
          if (typeof parsed.playerXP === 'number') this.playerXP = parsed.playerXP;
          if (Array.isArray(parsed.badges)) this.badges = parsed.badges;

          if (parsed.questsState && typeof parsed.questsState === 'object') {
            this.quests.forEach(q => {
              const state = parsed.questsState[q.id];
              if (state) {
                if (state.status) q.status = state.status;
                if (Array.isArray(state.stepsCompleted)) {
                  q.steps.forEach((step, idx) => {
                    if (idx < state.stepsCompleted.length) {
                      step.completed = !!state.stepsCompleted[idx];
                    }
                  });
                }
              }
            });
          }
        } else {
          console.log('[QuestEngine] Migrating to quest version', QUEST_STATE_VERSION);
          this.saveState();
        }
      }
    } catch (e) {
      console.error('[QuestEngine] Error loading state:', e);
    }

    this.ensureActiveQuestExists();

    const activeQuest = this.getActiveQuest();
    if (activeQuest) {
      this.checkAutoProgress(activeQuest);
    }
  }

  saveState() {
    try {
      const questsState = {};
      this.quests.forEach(q => {
        questsState[q.id] = {
          status: q.status,
          stepsCompleted: q.steps.map(s => !!s.completed)
        };
      });

      const dataToSave = {
        version: QUEST_STATE_VERSION,
        playerXP: this.playerXP,
        badges: this.badges,
        questsState
      };

      localStorage.setItem('NUSAQUEST_QUESTS_STATE', JSON.stringify(dataToSave));
    } catch (e) {
      console.error('[QuestEngine] Error saving state:', e);
    }
  }

  ensureActiveQuestExists() {
    const hasActive = this.quests.some(q => q.status === 'IN_PROGRESS');
    if (!hasActive) {
      const firstUnstarted = this.quests.find(q => q.status === 'UNSTARTED');
      if (firstUnstarted) {
        firstUnstarted.status = 'IN_PROGRESS';
      }
    }
  }

  getActiveQuest() {
    return this.quests.find(q => q.status === 'IN_PROGRESS') || null;
  }

  getActiveStep(quest = null) {
    const activeQuest = quest || this.getActiveQuest();
    if (!activeQuest || activeQuest.status !== 'IN_PROGRESS') return null;
    return activeQuest.steps.find(s => !s.completed) || null;
  }

  getActiveStepInstruction() {
    const activeQuest = this.getActiveQuest();
    if (!activeQuest) {
      const allCompleted = this.quests.every(q => q.status === 'COMPLETED');
      return allCompleted ? "Semua Misi Budaya Telah Selesai!" : "Belum ada misi aktif";
    }

    const activeStep = this.getActiveStep(activeQuest);
    return activeStep ? `Misi: ${activeStep.description}` : `Misi: ${activeQuest.title}`;
  }

  onTalkNpc(npcId) {
    const activeQuest = this.getActiveQuest();
    if (!activeQuest) return;

    const activeStep = this.getActiveStep(activeQuest);
    if (!activeStep) return;

    if (activeStep.type === 'TALK_NPC' && activeStep.targetNpc === npcId) {
      this.completeStep(activeQuest, activeStep);
    } else if (activeStep.type === 'LEARN_VOCAB' && (activeQuest.npcId === npcId || activeStep.targetNpc === npcId)) {
      if (this.checkTargetWordsLearned(activeStep.targetWords)) {
        this.completeStep(activeQuest, activeStep);
      }
    }
  }

  onLearnVocab(learnedWordsMap) {
    const activeQuest = this.getActiveQuest();
    if (!activeQuest) return;

    const activeStep = this.getActiveStep(activeQuest);
    if (!activeStep) return;

    if (activeStep.type === 'LEARN_VOCAB' && this.checkTargetWordsLearned(activeStep.targetWords, learnedWordsMap)) {
      this.completeStep(activeQuest, activeStep);
    }
  }

  checkTargetWordsLearned(targetWords, wordsMap = null) {
    if (!targetWords || targetWords.length === 0) return true;

    let learnedMap = wordsMap;
    if (!learnedMap && this.uiManager && this.uiManager.learnedVocab) {
      learnedMap = this.uiManager.learnedVocab;
    }
    if (!learnedMap) return false;

    return targetWords.every(target => {
      const cleanTarget = target.trim().toLowerCase();
      for (const [word] of learnedMap.entries()) {
        const cleanWord = word.trim().toLowerCase();
        if (cleanWord === cleanTarget || cleanWord.includes(cleanTarget) || cleanTarget.includes(cleanWord)) {
          return true;
        }
      }
      return false;
    });
  }

  onQuizComplete(npcId, score, totalQuestions) {
    const activeQuest = this.getActiveQuest();
    if (!activeQuest) return;

    const activeStep = this.getActiveStep(activeQuest);
    if (!activeStep) return;

    const isTargetNpc = (activeStep.targetNpc === npcId || activeQuest.npcId === npcId);
    if (isTargetNpc && (activeStep.type === 'PERFECT_QUIZ' || activeStep.type === 'QUIZ_PASS')) {
      const passingScore = Math.max(1, Math.floor(totalQuestions * 0.5));
      if (score >= passingScore || score === totalQuestions) {
        this.completeStep(activeQuest, activeStep);
      } else if (this.uiManager) {
        this.uiManager.showToast(`Coba lagi kuis untuk menyelesaikan langkah misi! (Skor: ${score}/${totalQuestions})`);
      }
    }
  }

  onMapEnter(mapId) {
    const activeQuest = this.getActiveQuest();
    if (!activeQuest) return;

    const activeStep = this.getActiveStep(activeQuest);
    if (!activeStep) return;

    if (activeStep.type === 'VISIT_MAP' && activeStep.targetMap === mapId) {
      this.completeStep(activeQuest, activeStep);
    }
  }

  completeStep(quest, step) {
    if (step.completed) return;
    step.completed = true;

    if (this.uiManager) {
      this.uiManager.showToast(`Langkah Selesai: ${step.description}`);
    }

    const allStepsDone = quest.steps.every(s => s.completed);
    if (allStepsDone) {
      this.completeQuest(quest);
    } else {
      this.saveState();
      this.checkAutoProgress(quest);

      if (this.uiManager) {
        this.uiManager.updateQuestTracker();
        this.uiManager.renderQuestLog();
      }
    }
  }

  checkAutoProgress(quest) {
    const nextStep = this.getActiveStep(quest);
    if (!nextStep) return;

    if (nextStep.type === 'LEARN_VOCAB' && this.checkTargetWordsLearned(nextStep.targetWords)) {
      this.completeStep(quest, nextStep);
    }
  }

  completeQuest(quest) {
    quest.status = 'COMPLETED';

    const xpEarned = (quest.reward && quest.reward.xp) || 100;
    const badgeEarned = (quest.reward && quest.reward.badge) || 'Lencana Budaya';
    const badgeIcon = (quest.reward && quest.reward.icon) || 'trophy';

    this.playerXP += xpEarned;
    if (!this.badges.includes(badgeEarned)) {
      this.badges.push(badgeEarned);
    }

    if (window.LearningStats) {
      window.LearningStats.recordQuestCompletion(quest.id, quest.title, xpEarned, badgeEarned);
    }

    if (this.uiManager) {
      this.uiManager.showToast(`Misi Selesai: ${quest.title}!`);
      this.uiManager.showToast(`+${xpEarned} XP | Hadiah: ${badgeEarned}`);
    }

    const nextQuest = this.quests.find(q => q.status === 'UNSTARTED');
    if (nextQuest) {
      nextQuest.status = 'IN_PROGRESS';
      if (this.uiManager) {
        this.uiManager.showToast(`Misi Baru Terbuka: ${nextQuest.title}`);
      }
    }

    this.saveState();

    if (this.uiManager) {
      this.uiManager.updateQuestTracker();
      this.uiManager.renderQuestLog();
      this.uiManager.showActivitySummary('QUEST', {
        title: quest.title,
        description: quest.description,
        xpEarned: xpEarned,
        badgeEarned: badgeEarned,
        badgeIcon: badgeIcon,
        nextQuestTitle: nextQuest ? nextQuest.title : null
      });
    }
  }

  getAllQuests() {
    return this.quests;
  }

  getPlayerXP() {
    return this.playerXP;
  }

  getPlayerBadges() {
    return this.badges;
  }

  getAllBadges() {
    const badges = [];
    const seen = new Set();
    this.quests.forEach(q => {
      if (q.reward && q.reward.badge && !seen.has(q.reward.badge)) {
        seen.add(q.reward.badge);
        badges.push({
          name: q.reward.badge,
          icon: q.reward.icon || 'award',
          questId: q.id
        });
      }
    });
    return badges;
  }

  resetProgress() {
    localStorage.removeItem('NUSAQUEST_QUESTS_STATE');
    this.playerXP = 0;
    this.badges = [];
    this.quests = JSON.parse(JSON.stringify(DEFAULT_QUESTS));
    this.saveState();

    if (this.uiManager) {
      this.uiManager.updateQuestTracker();
      this.uiManager.renderQuestLog();
    }
  }
}
