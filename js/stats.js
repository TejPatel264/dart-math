/**
 * stats.js
 * ---------------------------------------------------------
 * Tracks session statistics: questions answered, correct
 * answers, accuracy, average answer time, and the current/best
 * correct-answer streak for this session. Kept as a small class
 * with no DOM access, so it's easy to later swap for a version
 * that persists to localStorage (for "practice history" /
 * long-term stats), without changing how it's used.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

window.DartsTrainer.StatsTracker = class StatsTracker {
  constructor() {
    this.reset();
  }

  /** Resets all tracked statistics back to zero. */
  reset() {
    this.questionsAnswered = 0;
    this.correctAnswers = 0;
    this.totalTimeSeconds = 0;
    this.currentStreak = 0;
    this.bestStreak = 0;
  }

  /**
   * Records the result of one answered question. A correct answer
   * extends the current streak (and best streak, if it's now the
   * longest this session); any wrong answer resets the current
   * streak back to zero, same as a real leg of "how many in a row".
   * @param {boolean} wasCorrect
   * @param {number} timeTakenSeconds
   */
  recordAnswer(wasCorrect, timeTakenSeconds) {
    this.questionsAnswered += 1;
    this.totalTimeSeconds += timeTakenSeconds;

    if (wasCorrect) {
      this.correctAnswers += 1;
      this.currentStreak += 1;
      if (this.currentStreak > this.bestStreak) this.bestStreak = this.currentStreak;
    } else {
      this.currentStreak = 0;
    }
  }

  /** @returns {number|null} Accuracy as a percentage (0-100), or null if no data yet. */
  getAccuracyPercent() {
    if (this.questionsAnswered === 0) return null;
    return (this.correctAnswers / this.questionsAnswered) * 100;
  }

  /** @returns {number|null} Average time per answer in seconds, or null if no data yet. */
  getAverageTimeSeconds() {
    if (this.questionsAnswered === 0) return null;
    return this.totalTimeSeconds / this.questionsAnswered;
  }
};
