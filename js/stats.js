/**
 * stats.js
 * ---------------------------------------------------------
 * Tracks session statistics: questions answered, correct
 * answers, accuracy, and average answer time. Kept as a small
 * class with no DOM access, so it's easy to later swap for a
 * version that persists to localStorage (for "practice
 * history" / long-term stats), without changing how it's used.
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
  }

  /**
   * Records the result of one answered question.
   * @param {boolean} wasCorrect
   * @param {number} timeTakenSeconds
   */
  recordAnswer(wasCorrect, timeTakenSeconds) {
    this.questionsAnswered += 1;
    if (wasCorrect) this.correctAnswers += 1;
    this.totalTimeSeconds += timeTakenSeconds;
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
