/**
 * checkoutEngine.js
 * ---------------------------------------------------------
 * Pure logic for darts checkout routes: given a target score
 * and a maximum number of darts (1, 2, or 3), works out whether
 * the score is checkable and, if so, the best route(s) to
 * finish it - always ending on a double (or the bull, D25).
 * No DOM access, same pattern as gameEngine.js/stats.js, so it
 * can be unit tested and reused (e.g. a future "checkout
 * trainer" quiz mode) independently of this page's UI.
 *
 * Route-finding strategy:
 * Rather than a hardcoded lookup table (which would only cover
 * one "textbook" route per score and can't respect a dart-count
 * cap), this generates every legal route within the dart limit
 * via search, then ranks candidates the way real players would
 * choose between them - see rankRoutes() for the criteria.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const MAX_SCORE = 170; // highest possible checkout (T20, T20, Bull)
  const MIN_SCORE = 2;   // 1 is never checkoutable (no double covers it)

  /**
   * @typedef {Object} DartOption
   * @property {string} notation - e.g. "T20", "D16", "Bull", "25"
   * @property {number} value
   * @property {boolean} isDouble - true for any D* segment or the Bull (D25)
   */

  /** All single segments 1-20, e.g. {notation:'20', value:20}. */
  const SINGLES = Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    return { notation: String(n), value: n, isDouble: false };
  });

  /** All double segments D1-D20, plus the outer bull (25, not a double). */
  const DOUBLES = Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    return { notation: `D${n}`, value: n * 2, isDouble: true };
  });

  /** All treble segments T1-T20. */
  const TREBLES = Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    return { notation: `T${n}`, value: n * 3, isDouble: false };
  });

  const OUTER_BULL = { notation: '25', value: 25, isDouble: false };
  const BULLSEYE = { notation: 'Bull', value: 50, isDouble: true }; // counts as a double for finishing

  /** Every scoreable dart outcome, used when searching for non-final darts. */
  const ALL_DARTS = [...SINGLES, ...TREBLES, ...DOUBLES, OUTER_BULL, BULLSEYE];

  /** Only outcomes that can legally end a leg (any double, or the bullseye). */
  const FINISHING_DARTS = [...DOUBLES, BULLSEYE];

  /**
   * Finds every 1-dart finish for a score: only possible if the
   * score itself is a valid finishing dart's value.
   * @param {number} score
   * @returns {DartOption[][]} array of routes, each route being a 1-item array
   */
  function findOneDartFinishes(score) {
    return FINISHING_DARTS.filter((d) => d.value === score).map((d) => [d]);
  }

  /**
   * Finds every 2-dart finish: a first dart (any scoring segment)
   * followed by a finishing double/bullseye that exactly covers
   * the remainder.
   * @param {number} score
   * @returns {DartOption[][]}
   */
  function findTwoDartFinishes(score) {
    const routes = [];
    for (const first of ALL_DARTS) {
      if (first.value >= score) continue; // must leave a positive remainder
      const remainder = score - first.value;
      for (const finish of FINISHING_DARTS) {
        if (finish.value === remainder) {
          routes.push([first, finish]);
        }
      }
    }
    return routes;
  }

  /**
   * Finds every 3-dart finish: two non-final darts followed by a
   * finishing double/bullseye. Search space is naturally bounded
   * (62 dart options x 62 x 40 finishes) and only runs once per
   * "View checkout" tap, so a plain nested loop is fine here -
   * no need for anything cleverer.
   * @param {number} score
   * @returns {DartOption[][]}
   */
  function findThreeDartFinishes(score) {
    const routes = [];
    for (const first of ALL_DARTS) {
      if (first.value >= score) continue;
      const afterFirst = score - first.value;
      for (const second of ALL_DARTS) {
        if (second.value >= afterFirst) continue;
        const remainder = afterFirst - second.value;
        for (const finish of FINISHING_DARTS) {
          if (finish.value === remainder) {
            routes.push([first, second, finish]);
          }
        }
      }
    }
    return routes;
  }

  /**
   * Scores how "preferred" a route is, lower = better. Mirrors how
   * players actually choose between equally-legal routes:
   *  1. Fewer darts is always better (a 2-dart finish beats any
   *     3-dart one for the same score, if both are available at
   *     the current dart-count cap).
   *  2. Prefer routes that use treble 20/19 early (the two most
   *     practised big scoring shots) over odd/awkward numbers.
   *  3. Prefer finishing doubles players actually practise
   *     (D20, D16, D10, D8, Bull, D12, D4, D2 in roughly that
   *     order of commonness) over obscure ones like D1 or D19.
   *  4. Prefer routes that don't reuse the same segment twice in
   *     a row less than ones that do (slightly easier to picture
   *     as two different shots).
   * @param {DartOption[]} route
   * @returns {number}
   */
  const PREFERRED_DOUBLE_ORDER = [
    'D20', 'D16', 'Bull', 'D10', 'D8', 'D12', 'D18', 'D4', 'D2', 'D14', 'D6',
    'D20', 'D5', 'D1', 'D17', 'D9', 'D3', 'D11', 'D15', 'D7', 'D13', 'D19',
  ];

  function doubleRank(notation) {
    const idx = PREFERRED_DOUBLE_ORDER.indexOf(notation);
    return idx === -1 ? PREFERRED_DOUBLE_ORDER.length : idx;
  }

  function routeScore(route) {
    let score = route.length * 1000; // fewest darts dominates all else

    // The finishing double matters most after dart count: an
    // awkward double (D2, D1, D19...) is genuinely harder to hit
    // under pressure than a well-practised one, regardless of how
    // the earlier darts scored - so this is weighted well above
    // the scoring-shot preference below.
    const finish = route[route.length - 1];
    score += doubleRank(finish.notation) * 10;

    // Among routes with an equally good finishing double, mildly
    // prefer big, commonly-thrown scoring shots (T20/T19/T18) on
    // the non-final darts over odd/awkward numbers.
    const nonFinal = route.slice(0, -1);
    const bigShotBonus = { T20: 0, T19: 1, T18: 2 };
    nonFinal.forEach((dart) => {
      score += bigShotBonus[dart.notation] !== undefined ? bigShotBonus[dart.notation] : 5;
    });

    return score;
  }

  /**
   * Ranks and dedupes a list of routes, returning the best `limit`
   * (default 2) as the "most popular / best" suggestions.
   *
   * Routes are deduped by their SET of segments, not the exact
   * sequence: [T19, T20, Bull] and [T20, T19, Bull] are the same
   * three darts thrown in a different order, not two genuinely
   * different routes, so only one survives here. This also means
   * the alternative(s) returned are guaranteed to use a different
   * combination of segments from the best route, rather than just
   * a reordering of the same darts.
   * @param {DartOption[][]} routes
   * @param {number} limit
   * @returns {DartOption[][]}
   */
  function rankRoutes(routes, limit) {
    // Dedupe by sorted notation (order-independent) so a route
    // that only reorders the same darts as an already-seen route
    // is dropped, keeping whichever ordering sorts first.
    const seen = new Set();
    const unique = routes.filter((route) => {
      const key = route.map((d) => d.notation).slice().sort().join('-');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => routeScore(a) - routeScore(b));
    return unique.slice(0, limit);
  }

  /**
   * Main entry point: finds the best checkout route(s) for a score
   * within a maximum number of darts.
   * @param {number} score - target score, e.g. 121
   * @param {number} maxDarts - 1, 2, or 3
   * @param {number} [limit] - how many top routes to return (default 2)
   * @returns {{checkoutPossible: boolean, routes: DartOption[][]}}
   */
  function getCheckoutRoutes(score, maxDarts, limit = 2) {
    if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
      return { checkoutPossible: false, routes: [] };
    }

    let routes = [];
    if (maxDarts >= 1) routes = routes.concat(findOneDartFinishes(score));
    if (routes.length === 0 && maxDarts >= 2) routes = routes.concat(findTwoDartFinishes(score));
    if (routes.length === 0 && maxDarts >= 3) routes = routes.concat(findThreeDartFinishes(score));

    // If a shorter finish exists, prefer that dart count exclusively
    // (a 2-dart 40 shouldn't be crowded out by valid-but-pointless
    // 3-dart paddings to the same score).
    const best = rankRoutes(routes, limit);
    return { checkoutPossible: best.length > 0, routes: best };
  }

  window.DartsTrainer.checkoutEngine = {
    MAX_SCORE,
    MIN_SCORE,
    getCheckoutRoutes,
  };
})();
