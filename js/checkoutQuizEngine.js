/**
 * checkoutQuizEngine.js
 * ---------------------------------------------------------
 * Pure logic for the 1-Dart Checkout Quiz: generates a random
 * question from the fixed pool of 1-dart-checkoutable scores
 * (evens 2-40, plus 50 for the bullseye), and checks a typed
 * answer against checkoutEngine.js's own routing logic rather
 * than a separate hardcoded table - so the quiz's "correct
 * answer" can never drift out of sync with what the checkout
 * calculator itself considers correct.
 *
 * Every score in this pool has exactly one valid 1-dart finish
 * (each even number 2-40 has exactly one double that produces
 * it, and 50 only has the bullseye) - see checkoutEngine.js's
 * FINISHING_DARTS list - so "the answer" is always unambiguous.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const { randomItem } = window.DartsTrainer.random;
  const { getCheckoutRoutes } = window.DartsTrainer.checkoutEngine;

  // Evens 2-40, plus 50 (the bullseye) - every score a single dart
  // can actually check out.
  const QUESTION_POOL = [
    ...Array.from({ length: 20 }, (_, i) => (i + 1) * 2),
    50,
  ];

  /**
   * @typedef {Object} CheckoutQuizQuestion
   * @property {number} score - the target score shown to the player
   * @property {string} correctNotation - e.g. "D16" or "Bull"
   */

  /**
   * Generates a new question by picking a random score from the
   * pool and looking up its (unique) 1-dart finish.
   * @returns {CheckoutQuizQuestion}
   */
  function generateQuestion() {
    const score = randomItem(QUESTION_POOL);
    const { routes } = getCheckoutRoutes(score, 1, 1);
    // Every pool value has exactly one 1-dart route by construction
    // (see file header) - routes[0] is always populated here.
    const correctNotation = routes[0][0].notation;
    return { score, correctNotation };
  }

  /**
   * Checks a submitted answer (built from the custom D/T/number/
   * Bull keypad) against the question's correct notation. Case
   * matters for "Bull" but the keypad only ever produces the
   * canonical casing, so a straight equality check is enough.
   * @param {string} correctNotation
   * @param {string} userAnswer
   * @returns {boolean}
   */
  function checkAnswer(correctNotation, userAnswer) {
    return userAnswer === correctNotation;
  }

  window.DartsTrainer.checkoutQuizEngine = { QUESTION_POOL, generateQuestion, checkAnswer };
})();
