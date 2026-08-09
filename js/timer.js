/**
 * timer.js
 * ---------------------------------------------------------
 * A tiny stopwatch used to measure how long a player takes to
 * answer each question. Kept generic (no knowledge of darts
 * or DOM) so it can be reused by future timed-mode features.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

window.DartsTrainer.Stopwatch = class Stopwatch {
  constructor() {
    this._startTime = null;
  }

  /** Starts (or restarts) the stopwatch. */
  start() {
    this._startTime = performance.now();
  }

  /**
   * Returns the elapsed time in seconds since start() was called.
   * @returns {number}
   */
  elapsedSeconds() {
    if (this._startTime === null) return 0;
    return (performance.now() - this._startTime) / 1000;
  }
};
