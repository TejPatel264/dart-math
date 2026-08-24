/**
 * streakDailyStats.js
 * ---------------------------------------------------------
 * Persists Streak mode's stats-bar figures (Best streak, Average
 * time, Accuracy) scoped to the current calendar day, so they
 * reflect "every run played today" rather than resetting with
 * each Play Again or page reload the way StatsTracker (stats.js)
 * does. Deliberately separate from lifetimeStats.js's all-time
 * per-mode totals - this is a different scope (today vs ever) for
 * a different purpose (an always-visible stats bar vs a lifetime
 * stats page), and layering a day boundary onto the all-time
 * store would complicate a module other pages also depend on.
 *
 * Storage shape (one localStorage key):
 * {
 *   dateKey: "2026-08-11",
 *   questionsAnswered, correctAnswers, totalTimeSeconds, bestStreak
 * }
 *
 * Whenever the stored dateKey doesn't match today, every read
 * transparently starts a fresh empty day - there's no explicit
 * "roll over" step to run at midnight, since the check happens
 * lazily on next use instead.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const STORAGE_KEY = 'dartsTrainer.streakDailyStats.v1';

  /**
   * Returns "today" as a plain YYYY-MM-DD string in the player's
   * local timezone - same helper lifetimeStats.js uses, duplicated
   * rather than shared since these two modules are meant to stay
   * independent (see the file header).
   * @returns {string}
   */
  function todayKey() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function emptyDay() {
    return { dateKey: todayKey(), questionsAnswered: 0, correctAnswers: 0, totalTimeSeconds: 0, bestStreak: 0 };
  }

  /** Reads today's stats, starting a fresh day if the stored date has rolled over (or nothing's stored yet). */
  function readToday() {
    let parsed = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch (err) {
      parsed = null; // corrupt JSON or localStorage unavailable - fall back to empty
    }

    if (!parsed || parsed.dateKey !== todayKey()) return emptyDay();

    return {
      dateKey: parsed.dateKey,
      questionsAnswered: Number(parsed.questionsAnswered) || 0,
      correctAnswers: Number(parsed.correctAnswers) || 0,
      totalTimeSeconds: Number(parsed.totalTimeSeconds) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
    };
  }

  function writeToday(day) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(day));
    } catch (err) {
      // Storage full/unavailable - silently no-op, same stance as lifetimeStats.js.
    }
  }

  /**
   * Records one answered question against today's totals.
   * @param {boolean} wasCorrect
   * @param {number} timeTakenSeconds
   */
  function recordAnswer(wasCorrect, timeTakenSeconds) {
    const day = readToday();
    day.questionsAnswered += 1;
    day.totalTimeSeconds += timeTakenSeconds;
    if (wasCorrect) day.correctAnswers += 1;
    writeToday(day);
  }

  /**
   * Updates today's best streak if the given run's streak beats it.
   * @param {number} streak
   */
  function recordStreakProgress(streak) {
    const day = readToday();
    if (streak > day.bestStreak) {
      day.bestStreak = streak;
      writeToday(day);
    }
  }

  /** @returns {{questionsAnswered:number, correctAnswers:number, totalTimeSeconds:number, bestStreak:number}} */
  function getToday() {
    const day = readToday();
    return {
      questionsAnswered: day.questionsAnswered,
      correctAnswers: day.correctAnswers,
      totalTimeSeconds: day.totalTimeSeconds,
      bestStreak: day.bestStreak,
    };
  }

  /** @returns {number|null} Accuracy as a 0-100 percentage, or null if nothing's been answered today. */
  function getAccuracyPercent() {
    const day = readToday();
    if (day.questionsAnswered === 0) return null;
    return (day.correctAnswers / day.questionsAnswered) * 100;
  }

  /** @returns {number|null} Average seconds per answered question today, or null if nothing's been answered today. */
  function getAverageTimeSeconds() {
    const day = readToday();
    if (day.questionsAnswered === 0) return null;
    return day.totalTimeSeconds / day.questionsAnswered;
  }

  window.DartsTrainer.streakDailyStats = {
    recordAnswer,
    recordStreakProgress,
    getToday,
    getAccuracyPercent,
    getAverageTimeSeconds,
  };
})();
