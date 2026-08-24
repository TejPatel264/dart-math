/**
 * countdownTimer.js
 * ---------------------------------------------------------
 * A pausable countdown, used by Streak mode's per-question time
 * limit (which itself shrinks as the streak grows - see
 * js/streakTiming.js). Kept generic (no knowledge of darts,
 * streaks, or the DOM) alongside timer.js's Stopwatch, which
 * counts up for the "answered in X.XXs" stat - this one counts
 * down and can be paused/resumed, which a plain stopwatch has no
 * need for.
 *
 * Ticks on a 50ms interval so the displayed one-decimal-place
 * value changes right as it crosses each 0.1s boundary instead of
 * drifting, while staying cheap enough to run continuously.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

window.DartsTrainer.CountdownTimer = class CountdownTimer {
  /**
   * @param {Object} options
   * @param {number} options.durationSeconds - Length of the countdown. Used as
   *   the default whenever start() is called without an override.
   * @param {(secondsRemaining: number) => void} [options.onTick] - Called on every
   *   tick with the seconds remaining, rounded UP to one decimal place (e.g. a
   *   true 4.401s remaining renders as 4.5) - a countdown should never visually
   *   touch 0.0 before time is actually up, the same reasoning a whole-second
   *   ceil serves in a coarser display.
   * @param {() => void} [options.onExpire] - Called once, when the countdown reaches zero.
   */
  constructor({ durationSeconds, onTick, onExpire }) {
    this.durationSeconds = durationSeconds;
    this._onTick = onTick;
    this._onExpire = onExpire;

    this._intervalId = null;
    this._deadline = null; // performance.now() timestamp the countdown reaches 0
    this._remainingAtPause = null; // seconds left, captured whenever paused
    this._expired = false;
  }

  /** @returns {number} Seconds remaining right now (never negative). */
  _computeRemaining() {
    if (this._remainingAtPause !== null) return this._remainingAtPause;
    if (this._deadline === null) return this.durationSeconds;
    return Math.max(0, (this._deadline - performance.now()) / 1000);
  }

  _tick() {
    const remaining = this._computeRemaining();
    if (this._onTick) this._onTick(Math.ceil(remaining * 10) / 10);

    if (remaining <= 0 && !this._expired) {
      this._expired = true;
      this.stop();
      if (this._onExpire) this._onExpire();
    }
  }

  /**
   * Starts (or restarts) the countdown fresh.
   * @param {number} [durationSecondsOverride] - Runs the countdown at this length
   *   instead of the constructor's durationSeconds - Streak mode uses this every
   *   question, since the limit shrinks as the streak grows (see js/streakMain.js).
   */
  start(durationSecondsOverride) {
    this.stop();
    if (durationSecondsOverride !== undefined) this.durationSeconds = durationSecondsOverride;
    this._expired = false;
    this._remainingAtPause = null;
    this._deadline = performance.now() + this.durationSeconds * 1000;
    this._intervalId = setInterval(() => this._tick(), 50);
    this._tick(); // fire once immediately so the display shows the full duration without a 50ms blank gap
  }

  /**
   * Pauses the countdown, freezing the remaining time exactly
   * where it is (used once a question's answer has been checked,
   * so thinking time on the result screen doesn't cost the player
   * any of the next question's clock - see js/streakMain.js).
   */
  pause() {
    if (this._intervalId === null) return;
    this._remainingAtPause = this._computeRemaining();
    clearInterval(this._intervalId);
    this._intervalId = null;
  }

  /** Resumes a paused countdown from exactly where it left off. */
  resume() {
    if (this._remainingAtPause === null) return;
    this._deadline = performance.now() + this._remainingAtPause * 1000;
    this._remainingAtPause = null;
    this._intervalId = setInterval(() => this._tick(), 50);
  }

  /** Stops the countdown outright (no resume) - e.g. the run has ended. */
  stop() {
    if (this._intervalId !== null) clearInterval(this._intervalId);
    this._intervalId = null;
  }
};
