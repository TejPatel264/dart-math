/**
 * gameCore.bundle.js
 * ---------------------------------------------------------
 * Concatenation of random.js + timer.js + aimData.js + aimModel.js
 * + revealSequence.js + gameEngine.js + stats.js - the "engine"
 * layer shared identically by every counting-game page (3-Dart
 * Practice, 3-Dart Game/Track, Beat the Referee, and both pages'
 * dartboard variants). Merging these seven small files into one
 * cuts six network requests + six parse/execute cycles off every
 * gameplay page load, which is where the app's navigation-to-
 * playable delay was most noticeable. Purely mechanical: each
 * original file's content is wrapped in its own IIFE below to
 * guarantee it can never collide with another's top-level
 * declarations, so this bundle behaves identically to loading the
 * seven files separately in order.
 *
 * If you need to edit engine logic, edit the individual files
 * (random.js, timer.js, aimData.js, aimModel.js, revealSequence.js,
 * gameEngine.js, stats.js - all still present in this folder for
 * reference/editing) and re-run build_bundles.py - do not hand-edit
 * this generated file, changes will be lost on the next rebuild.
 * ---------------------------------------------------------
 */

// ===== random.js =====
(function () {
/**
 * random.js
 * ---------------------------------------------------------
 * Generic random-selection helpers. Deliberately has no
 * knowledge of darts or scores — keeping it generic means it
 * can be reused by any future feature (checkout trainer,
 * dartboard visual input, etc.) without modification.
 *
 * Loaded as a plain script (not an ES module) so the app can
 * be opened directly from disk (file://) without needing a
 * local server. Everything attaches to the shared
 * `window.DartsTrainer` namespace instead of using
 * import/export.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

// Defined as plain functions (not object methods that rely on `this`)
// so they work correctly even when destructured elsewhere, e.g.
// `const { randomItem } = window.DartsTrainer.random`.

/**
 * Returns a random integer between min and max, inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random element from an array.
 * @param {Array<T>} items
 * @returns {T}
 * @template T
 */
function randomItem(items) {
  return items[randomIntInclusive(0, items.length - 1)];
}

/**
 * Returns a random element from an array, weighted by relative
 * weight rather than picked uniformly. Weights don't need to sum
 * to 1 or 100 - they're relative to each other (e.g. weights of
 * 4 and 1 mean the first option is 4x as likely as the second).
 * @param {{item: T, weight: number}[]} entries
 * @returns {T}
 * @template T
 */
function weightedRandomItem(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of entries) {
    if (roll < entry.weight) return entry.item;
    roll -= entry.weight;
  }

  // Floating-point safety net: rounding could theoretically leave
  // `roll` a hair past the last entry's weight.
  return entries[entries.length - 1].item;
}

window.DartsTrainer.random = { randomIntInclusive, randomItem, weightedRandomItem };

})();

// ===== timer.js =====
(function () {
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

})();

// ===== aimData.js =====
(function () {
/**
 * aimData.js
 * ---------------------------------------------------------
 * Models a real dart player "aiming" at a treble, and the
 * neighbouring segments a dart can realistically land in if
 * that aim is slightly off.
 *
 * On a physical board, the segments either side of a number are
 * fixed by the board's layout:
 *   - Aiming at T20 -> can land in 20, 1, or 5
 *   - Aiming at T19 -> can land in 19, 3, or 7
 *   - Aiming at T18 -> can land in 18, 1, or 4
 *
 * Each aim also carries the transition weights used to decide
 * what the *next* dart aims at, based on whether this dart hit
 * its intended treble or not (see aimModel.js for how these are
 * used). T18 has no transition table because a visit is only 3
 * darts, so nothing ever needs to aim "after" a T18 dart - if a
 * future feature adds a 4th dart, aimModel.js falls back to
 * repeating the same aim rather than guessing new numbers here.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

const AIM_DEFINITIONS = {
  T20: {
    target: { notation: 'T20', value: 60 },
    single: { notation: '20', value: 20 },
    wayward: [
      { notation: '1', value: 1 },
      { notation: 'T1', value: 3 },
      { notation: '5', value: 5 },
      { notation: 'T5', value: 15 },
    ],
    // Aim for the NEXT dart, given this dart hit the T20 / missed it.
    nextAimIfHit: { T20: 0.9, T19: 0.1 },
    nextAimIfMiss: { T20: 0.75, T19: 0.25 },
  },
  T19: {
    target: { notation: 'T19', value: 57 },
    single: { notation: '19', value: 19 },
    wayward: [
      { notation: '3', value: 3 },
      { notation: 'T3', value: 9 },
      { notation: '7', value: 7 },
      { notation: 'T7', value: 21 },
    ],
    nextAimIfHit: { T19: 0.9, T18: 0.1 },
    nextAimIfMiss: { T19: 0.75, T18: 0.25 },
  },
  T18: {
    target: { notation: 'T18', value: 54 },
    single: { notation: '18', value: 18 },
    wayward: [
      { notation: '1', value: 1 },
      { notation: 'T1', value: 3 },
      { notation: '4', value: 4 },
      { notation: 'T4', value: 12 },
    ],
    // No nextAimIfHit/nextAimIfMiss: never needed within a 3-dart visit.
  },
};

// The first dart of every visit always aims for T20.
const FIRST_AIM = 'T20';

window.DartsTrainer.aimData = { AIM_DEFINITIONS, FIRST_AIM };

})();

// ===== aimModel.js =====
(function () {
/**
 * aimModel.js
 * ---------------------------------------------------------
 * Turns the static probabilities in aimData.js into actual
 * random outcomes. Two jobs:
 *
 *  1. pickOutcomeForAim(aimKey) - given a dart aimed at e.g. T20,
 *     which segment does it actually land in?
 *
 *  2. pickNextAim(aimKey, wasHit) - given this dart's aim and
 *     whether it hit its target treble, what does the *next*
 *     dart aim for?
 *
 * Kept separate from aimData.js (the numbers) and gameEngine.js
 * (how a full visit/question is assembled), so each piece can be
 * reasoned about - and tuned - independently.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const { weightedRandomItem } = window.DartsTrainer.random;
  const { AIM_DEFINITIONS } = window.DartsTrainer.aimData;

  // Relative weights within a single aim, derived from the spec:
  // the single is most likely; the treble is half as likely as the
  // single; and hitting ANY ONE wayward segment is half as likely
  // as the treble (so the 4 wayward segments share that weight
  // equally, at a quarter each of the treble's weight).
  // Using whole numbers (16 : 8 : 1,1,1,1, total 28) avoids floating
  // point drift while keeping exactly the same ratios.
  const SINGLE_WEIGHT = 16;
  const TARGET_WEIGHT = 8;
  const WAYWARD_WEIGHT = 1; // each of the 4 wayward segments

  /**
   * @typedef {Object} ThrowOutcome
   * @property {string} notation - Display label, e.g. "T20".
   * @property {number} value    - Point value, e.g. 60.
   * @property {boolean} isTarget - True if this dart hit the treble it was aimed at.
   */

  /**
   * Resolves one dart thrown at the given aim into a landed segment.
   * @param {string} aimKey - "T20", "T19", or "T18".
   * @returns {ThrowOutcome}
   */
  function pickOutcomeForAim(aimKey) {
    const aim = AIM_DEFINITIONS[aimKey];

    const weightedOptions = [
      { item: { ...aim.single, isTarget: false }, weight: SINGLE_WEIGHT },
      { item: { ...aim.target, isTarget: true }, weight: TARGET_WEIGHT },
      ...aim.wayward.map((segment) => ({
        item: { ...segment, isTarget: false },
        weight: WAYWARD_WEIGHT,
      })),
    ];

    return weightedRandomItem(weightedOptions);
  }

  /**
   * Decides what the next dart aims for, based on whether this
   * dart hit its intended treble.
   * @param {string} aimKey - This dart's aim.
   * @param {boolean} wasHit - Whether this dart landed on its treble.
   * @returns {string} The next dart's aim.
   */
  function pickNextAim(aimKey, wasHit) {
    const aim = AIM_DEFINITIONS[aimKey];
    const transitionWeights = wasHit ? aim.nextAimIfHit : aim.nextAimIfMiss;

    // T18 has no transition table (never needed in a 3-dart visit) -
    // fall back to repeating the same aim rather than guessing.
    if (!transitionWeights) return aimKey;

    const weightedOptions = Object.entries(transitionWeights).map(([nextAimKey, weight]) => ({
      item: nextAimKey,
      weight,
    }));

    return weightedRandomItem(weightedOptions);
  }

  window.DartsTrainer.aimModel = { pickOutcomeForAim, pickNextAim };
})();

})();

// ===== revealSequence.js =====
(function () {
/**
 * revealSequence.js
 * ---------------------------------------------------------
 * Generic helper for revealing a list of items one at a time.
 * Used here to flip the three dart squares (or land the three
 * darts on the board) in sequence, but deliberately has no
 * knowledge of darts, squares, or the DOM - it just calls back
 * with each item in turn - so it can be reused by any future
 * feature that needs a staged reveal (e.g. a 3-dart checkout
 * sequence).
 *
 * The delay before each reveal is randomized within its own range
 * rather than fixed - a constant rhythm is easy to answer along to
 * without actually reading the throws, so each gap is redrawn per
 * question from a uniform distribution: 0.3-0.7s before the 1st
 * reveal, 1.0-2.0s between the 1st and 2nd, 1.3-2.0s between the
 * 2nd and 3rd. The ranges themselves are fixed (not randomized),
 * only where each individual gap lands within its range.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

/**
 * Returns a random number drawn uniformly from [min, max].
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Reveals each item in `items` one by one.
 * @param {Array<T>} items - The items to reveal, in order.
 * @param {Object} options
 * @param {[number, number]} [options.firstDelayRangeMs=[300, 700]] - Uniform range for the
 *   delay before the 1st reveal.
 * @param {[number, number]} [options.gap1to2RangeMs=[1000, 2000]] - Uniform range for the
 *   delay between the 1st and 2nd reveal.
 * @param {[number, number]} [options.gap2to3RangeMs=[1300, 2000]] - Uniform range for the
 *   delay between the 2nd and 3rd reveal.
 * @param {(item: T, index: number) => void} options.onReveal - Called for each item as it's revealed.
 * @param {() => void} [options.onComplete] - Called once, after the final item is revealed.
 * @returns {() => void} A cancel function that stops any remaining reveals.
 * @template T
 */
function revealSequence(
  items,
  {
    firstDelayRangeMs = [300, 700],
    gap1to2RangeMs = [1000, 2000],
    gap2to3RangeMs = [1300, 2000],
    onReveal,
    onComplete,
  }
) {
  // Each item's absolute delay builds on the previous one's, using
  // a freshly-drawn gap for each step - items beyond the 3rd (if
  // this is ever reused for a longer sequence) keep reusing the
  // 2nd-3rd range rather than erroring, since there's no 4th range
  // specified.
  const delays = [];
  items.forEach((item, index) => {
    if (index === 0) {
      delays.push(randomBetween(firstDelayRangeMs[0], firstDelayRangeMs[1]));
    } else {
      const range = index === 1 ? gap1to2RangeMs : gap2to3RangeMs;
      delays.push(delays[index - 1] + randomBetween(range[0], range[1]));
    }
  });

  const timers = items.map((item, index) =>
    setTimeout(() => {
      onReveal(item, index);
      if (index === items.length - 1 && onComplete) onComplete();
    }, delays[index])
  );

  // Returning a cancel function lets the caller stop a reveal in
  // progress - e.g. if a new question starts before the old one finishes.
  return function cancel() {
    timers.forEach(clearTimeout);
  };
}

window.DartsTrainer.revealSequence = revealSequence;

})();

// ===== gameEngine.js =====
(function () {
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

})();

// ===== stats.js =====
(function () {
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

})();
