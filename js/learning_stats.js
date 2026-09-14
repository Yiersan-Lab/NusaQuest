/**
 * NusaQuest — Learning Progress & Statistics Engine
 * Tracks, persists, and computes educational metrics across Quests, Vocab, Quizzes, and Pronunciation.
 */

const LEARNING_STATS_VERSION = 2;

const LEVEL_RANKS = [
  { level: 1, title: 'Siswa Pemula', minXp: 0, maxXp: 150, icon: 'book-open', desc: 'Baru memulai perjalanan belajar tata krama dan bahasa Jawa.' },
  { level: 2, title: 'Penjelajah Bahasa', minXp: 150, maxXp: 350, icon: 'compass', desc: 'Mulai memahami tata krama dasar dan sapaan sehari-hari.' },
  { level: 3, title: 'Ksatria Budaya', minXp: 350, maxXp: 650, icon: 'shield', desc: 'Mampu berkomunikasi lancar di pasar dan lingkungan desa.' },
  { level: 4, title: 'Penutur Mahir', minXp: 650, maxXp: 1000, icon: 'award', desc: 'Fasih memahami bahasa krama alus dan sastra lisan tradisional.' },
  { level: 5, title: 'Pujangga Agung', minXp: 1000, maxXp: 99999, icon: 'crown', desc: 'Menguasai bahasa dan budaya Jawa dengan sangat baik!' }
];

class LearningStatsEngine {
  constructor() {
    this.storageKey = 'NUSAQUEST_LEARNING_STATS';
    this.stats = this.getDefaultStats();
    this.loadStats();
  }

  getDefaultStats() {
    return {
      version: LEARNING_STATS_VERSION,
      totalXp: 0,
      
      // Quests
      questsCompleted: 0,
      completedQuestIds: [],
      
      // Quizzes
      quizzesAttempted: 0,
      totalQuizQuestions: 0,
      correctQuizAnswers: 0,
      perfectQuizzes: 0,
      recentQuizzes: [],
      
      // Pronunciation (Gladhen Micara)
      pronounceSessions: 0,
      totalPronounceScore: 0,
      bestPronounceScore: 0,
      fluencyBreakdown: {
        excellent: 0,   // >= 88
        good: 0,        // 70 - 87
        fair: 0,        // 50 - 69
        needsPractice: 0 // < 50
      },
      recentPronunciations: [],
      
      // Streak & Sessions
      lastActivityDate: null,
      activityHistory: []
    };
  }

  loadStats() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          this.stats = { ...this.getDefaultStats(), ...parsed };
          if (!this.stats.fluencyBreakdown) {
            this.stats.fluencyBreakdown = { excellent: 0, good: 0, fair: 0, needsPractice: 0 };
          }
          if (!Array.isArray(this.stats.recentPronunciations)) {
            this.stats.recentPronunciations = [];
          }
          if (!Array.isArray(this.stats.recentQuizzes)) {
            this.stats.recentQuizzes = [];
          }
        }
      }
    } catch (e) {
      console.warn('[LearningStats] Failed to load stats from localStorage:', e);
    }
  }

  saveStats() {
    try {
      this.stats.version = LEARNING_STATS_VERSION;
      this.stats.lastActivityDate = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('[LearningStats] Failed to save stats:', e);
    }
  }

  // Calculate current player Level & XP progress
  getLevelProgress(playerXp = null) {
    const xp = (typeof playerXp === 'number') ? playerXp : this.stats.totalXp;
    let currentRank = LEVEL_RANKS[0];
    let nextRank = LEVEL_RANKS[1];

    for (let i = 0; i < LEVEL_RANKS.length; i++) {
      if (xp >= LEVEL_RANKS[i].minXp) {
        currentRank = LEVEL_RANKS[i];
        nextRank = LEVEL_RANKS[i + 1] || null;
      }
    }

    const currentMin = currentRank.minXp;
    const currentMax = nextRank ? nextRank.minXp : currentRank.maxXp;
    const range = Math.max(1, currentMax - currentMin);
    const xpInLevel = Math.max(0, xp - currentMin);
    const progressPercent = nextRank ? Math.min(100, Math.round((xpInLevel / range) * 100)) : 100;
    const xpNeededForNext = nextRank ? Math.max(0, nextRank.minXp - xp) : 0;

    return {
      level: currentRank.level,
      title: currentRank.title,
      icon: currentRank.icon,
      desc: currentRank.desc,
      currentXp: xp,
      currentMinXp: currentMin,
      nextLevelMinXp: currentMax,
      progressPercent,
      xpNeededForNext,
      isMaxLevel: !nextRank
    };
  }

  // Record completed Quest
  recordQuestCompletion(questId, questTitle, xpReward, badgeReward) {
    if (!this.stats.completedQuestIds.includes(questId)) {
      this.stats.completedQuestIds.push(questId);
      this.stats.questsCompleted = this.stats.completedQuestIds.length;
    }
    this.stats.totalXp += (xpReward || 0);

    this.logActivity('QUEST_COMPLETE', {
      questId,
      questTitle,
      xpReward,
      badgeReward,
      timestamp: new Date().toISOString()
    });

    this.saveStats();
  }

  // Record Quiz Result
  recordQuizResult(npcId, score, totalQuestions, xpEarned = 0) {
    this.stats.quizzesAttempted++;
    this.stats.totalQuizQuestions += totalQuestions;
    this.stats.correctQuizAnswers += score;
    if (score === totalQuestions && totalQuestions > 0) {
      this.stats.perfectQuizzes++;
    }
    if (xpEarned > 0) {
      this.stats.totalXp += xpEarned;
    }

    const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 100;

    const quizRecord = {
      npcId,
      score,
      totalQuestions,
      accuracy,
      xpEarned,
      timestamp: new Date().toISOString()
    };

    this.stats.recentQuizzes.unshift(quizRecord);
    if (this.stats.recentQuizzes.length > 10) {
      this.stats.recentQuizzes.pop();
    }

    this.logActivity('QUIZ_COMPLETE', quizRecord);
    this.saveStats();
  }

  // Record Pronunciation Practice Result
  recordPronunciationResult(targetText, translation, evalResult, xpBonus = 50) {
    if (!evalResult) return;

    this.stats.pronounceSessions++;
    const score = Math.round(evalResult.overall_score || 0);
    this.stats.totalPronounceScore += score;
    if (score > this.stats.bestPronounceScore) {
      this.stats.bestPronounceScore = score;
    }
    if (xpBonus > 0) {
      this.stats.totalXp += xpBonus;
    }

    // Fluency category breakdown
    const ratingBadge = evalResult.rating_badge || 'good';
    if (score >= 88 || ratingBadge === 'excellent') {
      this.stats.fluencyBreakdown.excellent++;
    } else if (score >= 70 || ratingBadge === 'good') {
      this.stats.fluencyBreakdown.good++;
    } else if (score >= 50 || ratingBadge === 'fair') {
      this.stats.fluencyBreakdown.fair++;
    } else {
      this.stats.fluencyBreakdown.needsPractice++;
    }

    const record = {
      text: targetText,
      translation: translation,
      score: score,
      accuracyScore: evalResult.accuracy_score || score,
      fluencyScore: evalResult.fluency_score || score,
      fluencyRating: evalResult.fluency_rating || 'Bagus',
      ratingBadge: ratingBadge,
      recognizedText: evalResult.recognized_text || '',
      xpBonus,
      timestamp: new Date().toISOString()
    };

    this.stats.recentPronunciations.unshift(record);
    if (this.stats.recentPronunciations.length > 10) {
      this.stats.recentPronunciations.pop();
    }

    this.logActivity('PRONOUNCE_COMPLETE', record);
    this.saveStats();
  }

  logActivity(type, data) {
    this.stats.activityHistory.unshift({
      type,
      data,
      date: new Date().toISOString()
    });
    if (this.stats.activityHistory.length > 20) {
      this.stats.activityHistory.pop();
    }
  }

  // Get aggregated summary statistics
  getSummaryStats(questEngine = null, uiManager = null) {
    const xp = questEngine ? questEngine.getPlayerXP() : this.stats.totalXp;
    const levelInfo = this.getLevelProgress(xp);

    const totalQuests = questEngine ? questEngine.getAllQuests().length : 4;
    const completedQuests = questEngine ? questEngine.getAllQuests().filter(q => q.status === 'COMPLETED').length : this.stats.questsCompleted;
    const questCompletionPercent = totalQuests > 0 ? Math.round((completedQuests / totalQuests) * 100) : 0;

    const vocabCount = (uiManager && uiManager.learnedVocab) ? uiManager.learnedVocab.size : 0;

    const quizAccuracy = this.stats.totalQuizQuestions > 0
      ? Math.round((this.stats.correctQuizAnswers / this.stats.totalQuizQuestions) * 100)
      : (this.stats.quizzesAttempted > 0 ? 100 : 0);

    const avgPronounceScore = this.stats.pronounceSessions > 0
      ? Math.round(this.stats.totalPronounceScore / this.stats.pronounceSessions)
      : 0;

    const badges = questEngine ? questEngine.getPlayerBadges() : [];
    const allBadges = questEngine ? questEngine.getAllBadges() : [];

    return {
      levelInfo,
      xp,
      quests: {
        total: totalQuests,
        completed: completedQuests,
        percent: questCompletionPercent,
        badgesUnlockedCount: badges.length,
        totalBadgesCount: allBadges.length || 4
      },
      quiz: {
        attempted: this.stats.quizzesAttempted,
        totalQuestions: this.stats.totalQuizQuestions,
        correctAnswers: this.stats.correctQuizAnswers,
        perfectCount: this.stats.perfectQuizzes,
        accuracy: quizAccuracy,
        recent: this.stats.recentQuizzes
      },
      pronunciation: {
        sessions: this.stats.pronounceSessions,
        avgScore: avgPronounceScore,
        bestScore: this.stats.bestPronounceScore,
        breakdown: this.stats.fluencyBreakdown,
        recent: this.stats.recentPronunciations
      },
      vocab: {
        count: vocabCount
      }
    };
  }

  resetAll() {
    this.stats = this.getDefaultStats();
    this.saveStats();
  }
}

window.LearningStats = new LearningStatsEngine();
