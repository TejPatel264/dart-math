/**
 * gameEngine.js
 * ---------------------------------------------------------
 * Pure game logic for the Dart Maths Trainer: generating a
 * valid question and checking a submitted answer. Deliberately
 * has no DOM access - it just deals in plain data - so it can
 * be unit tested, reused by a future timed mode, or swapped
 * out entirely for a "checkout trainer" variant.
 *
 * A question is built from 3 individual throws (a full visit).
 * Each throw's *aim* depends on how the previous throw landed
 * (see aimModel.js / aimData.js) - the first dart always aims
 * for T20, and a hit keeps the next dart aiming at the same
 * treble more often than a miss does. This asks the player to
 * do two steps of mental maths: add the 3 throws, then subtract
 * from the starting score - just like scoring a real leg.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const { randomIntInclusive } = window.DartsTrainer.random;
  const { pickOutcomeForAim, pickNextAim } = window.DartsTrainer.aimModel;
  const { FIRST_AIM } = window.DartsTrainer.aimData;

  const MIN_STARTING_SCORE = 171;
  const MAX_STARTING_SCORE = 501;
  const THROWS_PER_VISIT = 3;
  const MAX_GENERATION_ATTEMPTS = 300;

  /**
   * @typedef {Object} Throw
   * @property {string} notation - Display label, e.g. "T20".
   * @property {number} value    - Point value, e.g. 60.
   */

  /**
   * @typedef {Object} Question
   * @property {number} startingScore  - Score at the start of the visit.
   * @property {Throw[]} throws        - The 3 individual darts thrown this visit.
   * @property {number} visitScore     - Total points scored this visit (sum of throws).
   * @property {number} remainingScore - Correct answer (startingScore - visitScore).
   */

  /**
   * Simulates one full visit (3 darts) using the aim model: the
   * first dart always aims for T20, and each subsequent dart's aim
   * is chosen based on whether the previous dart hit its treble.
   * @returns {Throw[]}
   */
  function simulateVisit() {
    const throws = [];
    let aim = FIRST_AIM;

    for (let dartIndex = 0; dartIndex < THROWS_PER_VISIT; dartIndex++) {
      const outcome = pickOutcomeForAim(aim);
      throws.push({ notation: outcome.notation, value: outcome.value });

      const isLastDart = dartIndex === THROWS_PER_VISIT - 1;
      if (!isLastDart) {
        aim = pickNextAim(aim, outcome.isTarget);
      }
    }

    return throws;
  }

  /**
   * Generates 3 throws (via the aim model) whose combined total
   * does not exceed the given starting score, so the remaining
   * score can never go negative. Uses simple rejection sampling:
   * re-simulates the whole visit until it fits.
   * @param {number} startingScore
   * @returns {Throw[]}
   */
  function generateThreeThrows(startingScore) {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const throws = simulateVisit();
      const total = throws.reduce((sum, t) => sum + t.value, 0);
      if (total <= startingScore) return throws;
    }

    // Extremely unlikely fallback (would need a very low starting
    // score): three single-1s always fits since it totals just 3.
    const fallback = { notation: '1', value: 1 };
    return [fallback, fallback, fallback];
  }

  /**
   * Generates a new 501-style question:
   * - starting score is between 171 and 501
   * - 3 throws are drawn from the aim model
   * - the throws' total is never larger than the starting score,
   *   so the remaining score is never negative
   *
   * @returns {Question}
   */
  function generateQuestion() {
    const startingScore = randomIntInclusive(MIN_STARTING_SCORE, MAX_STARTING_SCORE);
    const throws = generateThreeThrows(startingScore);
    const visitScore = throws.reduce((sum, t) => sum + t.value, 0);
    const remainingScore = startingScore - visitScore;

    return { startingScore, throws, visitScore, remainingScore };
  }

  /**
   * Generates a visit with no starting score attached - for
   * practice mode, where the player just adds up 3 throws with no
   * "leg" being played and so no possible-total constraint either
   * (there's no starting score to stay under).
   * @returns {{throws: Throw[], visitScore: number}}
   */
  function generateThrowsOnly() {
    const throws = simulateVisit();
    const visitScore = throws.reduce((sum, t) => sum + t.value, 0);
    return { throws, visitScore };
  }

  /**
   * Checks a user's answer against whatever value this mode is
   * asking for - the remaining score in the 501 game, or the raw
   * visit total in practice mode. Takes a plain expected number
   * rather than a whole question object, so it works for either.
   * @param {number} expectedValue
   * @param {number} userAnswer
   * @returns {boolean}
   */
  function checkAnswer(expectedValue, userAnswer) {
    return Number(userAnswer) === expectedValue;
  }

  window.DartsTrainer.gameEngine = { generateQuestion, generateThrowsOnly, checkAnswer };
})();
