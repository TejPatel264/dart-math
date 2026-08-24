/**
 * refereeTarget.js
 * ---------------------------------------------------------
 * Picks "the referee's score" for a Beat the Referee run - a
 * single whole number, sampled from a normal distribution built
 * around the player's own all-time best streak in this mode, so
 * the target scales with skill and stays a real (if occasionally
 * tough, occasionally generous) challenge rather than a fixed
 * number everyone either trivially beats or never touches.
 *
 * Curve: centred at 72.5% of the player's best streak, with a
 * standard deviation chosen so the 1st percentile lands at 40% of
 * best and the 99th percentile lands at 105% of best - see the
 * derivation below. A plain (symmetric) normal can't hit an
 * asymmetric pair of tail targets (40% below the mean, 105% above
 * it) around a mean of exactly 70%; moving the mean to 72.5%
 * makes the two distances symmetric (32.5% either side), which is
 * what lets a single sigma satisfy both tails exactly:
 *   sigma = (1.05 - 0.725) / z99 = (0.725 - 0.40) / z99 ≈ 0.13970 * best
 * (z99 = the 99th-percentile z-score of a standard normal, ≈2.3263)
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const MEAN_FRACTION = 0.725;
  const SIGMA_FRACTION = 0.1397039555547978; // see derivation above

  // A brand-new player has no best streak yet (0), which the
  // normal-distribution formula would turn into a target of 0 -
  // not a real challenge. First-ever run gets a small fixed target
  // instead, standing in for "the referee" until there's a real
  // personal best to build a curve around.
  const FIRST_RUN_TARGET = 3;

  /**
   * Samples one standard-normal value (mean 0, sigma 1) via the
   * Box-Muller transform - there's no built-in Gaussian RNG in JS,
   * and Box-Muller is the standard, well-tested way to get one from
   * Math.random()'s uniform output.
   * @returns {number}
   */
  function sampleStandardNormal() {
    // Math.random() can return exactly 0, which would make
    // Math.log(u1) = -Infinity - excluded via the lower bound.
    const u1 = Math.max(Math.random(), Number.EPSILON);
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Picks the referee's target score for a run.
   * @param {number} bestStreak - the player's all-time best streak in this mode (0 if none yet).
   * @returns {number} A whole number, always at least 1.
   */
  function sampleTarget(bestStreak) {
    if (bestStreak <= 0) return FIRST_RUN_TARGET;

    const mean = MEAN_FRACTION * bestStreak;
    const sigma = SIGMA_FRACTION * bestStreak;
    const raw = mean + sigma * sampleStandardNormal();

    return Math.max(1, Math.round(raw));
  }

  window.DartsTrainer.refereeTarget = {
    sampleTarget,
    FIRST_RUN_TARGET, // exposed for tests
    MEAN_FRACTION,
    SIGMA_FRACTION,
  };
})();
