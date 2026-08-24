/**
 * streakTiming.js
 * ---------------------------------------------------------
 * Works out how many seconds a Streak-mode question gets, based
 * on which question number it is (1st, 2nd, 3rd... in the current
 * run). The first 5 questions step down at fixed, hand-picked
 * values; from question 5 onward it's a smooth exponential decay
 * toward a 1s floor, fitted so question 15 lands at ~5s.
 *
 * The curve is deliberately two-piece rather than one exponential
 * across the whole range: fitting a single curve through all of
 * Q1=30s, Q5=10s, Q15=5s, and a Q-infinity floor of 1s over-
 * constrains a 2-parameter exponential (fixing the start and the
 * floor leaves only one knob - the decay rate - to hit two more
 * targets, which can't both be hit exactly). Fixing Q1-Q5 by hand
 * and only asking the exponential to carry Q5 onward removes that
 * conflict entirely: from Q5=10s, decaying to a 1s floor with
 * Q15=5s pins down the decay rate exactly, with no compromise.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  // Hand-picked steps for the first 5 questions.
  const FIXED_SECONDS = [30, 20, 15, 12, 10]; // index 0 = question 1

  const FLOOR_SECONDS = 2; // the time limit as question number -> infinity
  const DECAY_START_SECONDS = FIXED_SECONDS[FIXED_SECONDS.length - 1]; // 10, at question 5
  const DECAY_START_QUESTION = FIXED_SECONDS.length; // 5

  // Solved so that time(15) === 5:
  //   FLOOR + (DECAY_START - FLOOR) * e^(-k * (15 - 5)) = 5
  //   k = -ln((5 - FLOOR) / (DECAY_START - FLOOR)) / 10
  const DECAY_RATE = -Math.log((5 - FLOOR_SECONDS) / (DECAY_START_SECONDS - FLOOR_SECONDS)) / 10;

  /**
   * @param {number} questionNumber - 1-indexed position of the question within the current run.
   * @returns {number} The time limit in seconds, rounded UP to one decimal place -
   *   a player should never get slightly less time than the curve intends just
   *   because of rounding, the same reasoning the countdown's own display uses.
   */
  function secondsForQuestion(questionNumber) {
    let raw;
    if (questionNumber <= FIXED_SECONDS.length) {
      raw = FIXED_SECONDS[questionNumber - 1];
    } else {
      const stepsIntoDecay = questionNumber - DECAY_START_QUESTION;
      raw = FLOOR_SECONDS + (DECAY_START_SECONDS - FLOOR_SECONDS) * Math.exp(-DECAY_RATE * stepsIntoDecay);
    }
    return Math.ceil(raw * 10) / 10;
  }

  window.DartsTrainer.streakTiming = {
    secondsForQuestion,
    FLOOR_SECONDS,
    DECAY_RATE, // exposed for tests
  };
})();
