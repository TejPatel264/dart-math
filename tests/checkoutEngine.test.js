/**
 * checkoutEngine.test.js
 * ---------------------------------------------------------
 * Unit tests for js/checkoutEngine.js, the pure/deterministic
 * checkout-route logic. Loads the REAL production file via
 * tests/loadCheckoutEngine.js (a Node vm sandbox, not a copy or
 * reimplementation) so these tests exercise exactly what ships to
 * the browser.
 *
 * Scope, per the task this suite was written for:
 *  - Exhaustive coverage of every score 2-170.
 *  - Mathematical validity of every returned route (sums to the
 *    target, legal segments only, <=3 darts, finishes on a
 *    double/Bullseye).
 *  - Representative 1/2/3-dart cases and known edge scores.
 *  - Best/alternative route behaviour AS CURRENTLY IMPLEMENTED -
 *    no assumptions are made about what "should" count as better;
 *    routeScore()'s existing ranking is treated as ground truth.
 *  - Player-preference selection is NOT tested here: inspecting
 *    checkoutEngine.js's public API (MAX_SCORE, MIN_SCORE,
 *    getCheckoutRoutes, findAllRoutes, rankRoutes) confirms it has
 *    no knowledge of player preferences, doubles, trebles-by-name,
 *    or a player profile - that logic lives entirely in
 *    js/checkoutCalculatorMain.js, outside the engine, so it's out
 *    of scope for an engine-level test suite (see the task notes
 *    in this repo's conversation history for where that logic is
 *    instead, if UI-level tests are wanted later).
 *
 * This file must never modify js/checkoutEngine.js or change its
 * behaviour - only observe and assert against it.
 * ---------------------------------------------------------
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadCheckoutEngine } = require('./loadCheckoutEngine.js');

const engine = loadCheckoutEngine();
const { getCheckoutRoutes, findAllRoutes, rankRoutes, MAX_SCORE, MIN_SCORE } = engine;

// --- Shared route-validity assertions ------------------------------------

/** Every segment notation the board actually has - anything outside this set is not a legal dart. */
const VALID_SINGLE_NOTATIONS = new Set(Array.from({ length: 20 }, (_, i) => String(i + 1)));
const VALID_DOUBLE_NOTATIONS = new Set(Array.from({ length: 20 }, (_, i) => `D${i + 1}`));
const VALID_TREBLE_NOTATIONS = new Set(Array.from({ length: 20 }, (_, i) => `T${i + 1}`));
const VALID_NOTATIONS = new Set([
  ...VALID_SINGLE_NOTATIONS,
  ...VALID_DOUBLE_NOTATIONS,
  ...VALID_TREBLE_NOTATIONS,
  '25',   // outer bull, single
  'Bull', // inner bull / bullseye, 50, counts as a finishing double
]);

/**
 * Asserts that a single DartOption object is internally consistent
 * and represents a real board segment (right notation<->value<->isDouble mapping).
 */
function assertValidDartOption(dart, context) {
  assert.ok(dart && typeof dart === 'object', `${context}: dart option should be an object, got ${JSON.stringify(dart)}`);
  assert.ok(VALID_NOTATIONS.has(dart.notation), `${context}: "${dart.notation}" is not a valid board segment notation`);
  assert.equal(typeof dart.value, 'number', `${context}: dart.value should be a number`);
  assert.equal(typeof dart.isDouble, 'boolean', `${context}: dart.isDouble should be a boolean`);

  // Cross-check notation <-> value <-> isDouble agree with each other,
  // independent of however the engine internally derived them.
  if (dart.notation === 'Bull') {
    assert.equal(dart.value, 50, `${context}: Bull should be worth 50`);
    assert.equal(dart.isDouble, true, `${context}: Bull should count as a finishing double`);
  } else if (dart.notation === '25') {
    assert.equal(dart.value, 25, `${context}: outer bull (25) should be worth 25`);
    assert.equal(dart.isDouble, false, `${context}: outer bull (25) is not a double`);
  } else if (dart.notation.startsWith('D')) {
    const n = Number(dart.notation.slice(1));
    assert.equal(dart.value, n * 2, `${context}: ${dart.notation} should be worth ${n * 2}`);
    assert.equal(dart.isDouble, true, `${context}: ${dart.notation} should be flagged isDouble`);
  } else if (dart.notation.startsWith('T')) {
    const n = Number(dart.notation.slice(1));
    assert.equal(dart.value, n * 3, `${context}: ${dart.notation} should be worth ${n * 3}`);
    assert.equal(dart.isDouble, false, `${context}: ${dart.notation} is not a double`);
  } else {
    // plain single, "1".."20"
    const n = Number(dart.notation);
    assert.equal(dart.value, n, `${context}: single "${dart.notation}" should be worth ${n}`);
    assert.equal(dart.isDouble, false, `${context}: single "${dart.notation}" is not a double`);
  }
}

/**
 * Asserts a full route is a mathematically/legally valid checkout
 * for `score` within `maxDarts` - the core constraint set from the
 * task: sums correctly, only real segments, <=3 (and <=maxDarts)
 * darts, finishes on a double/Bullseye.
 */
function assertValidRoute(route, score, maxDarts, context) {
  assert.ok(Array.isArray(route), `${context}: route should be an array`);
  assert.ok(route.length >= 1, `${context}: route should have at least 1 dart`);
  assert.ok(route.length <= 3, `${context}: route should never use more than 3 darts, got ${route.length}`);
  assert.ok(route.length <= maxDarts, `${context}: route uses ${route.length} darts, exceeding the requested max of ${maxDarts}`);

  route.forEach((dart, i) => assertValidDartOption(dart, `${context} (dart #${i + 1})`));

  const sum = route.reduce((total, dart) => total + dart.value, 0);
  assert.equal(sum, score, `${context}: route darts sum to ${sum}, expected ${score}`);

  const finish = route[route.length - 1];
  assert.equal(finish.isDouble, true, `${context}: final dart "${finish.notation}" must be a finishing double or Bullseye`);
}

// --- 1. Exhaustive score coverage, 2-170 ----------------------------------

describe('exhaustive score coverage (2-170, 3-dart max)', () => {
  for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
    test(`score ${score}: checkoutPossible flag matches whether a route was actually returned`, () => {
      const { checkoutPossible, routes } = getCheckoutRoutes(score, 3);
      if (checkoutPossible) {
        assert.ok(routes.length > 0, `score ${score}: checkoutPossible=true but routes array is empty`);
      } else {
        assert.equal(routes.length, 0, `score ${score}: checkoutPossible=false but routes array is non-empty`);
      }
    });

    if (score >= MIN_SCORE) {
      test(`score ${score}: every returned route (if any) is mathematically valid`, () => {
        const { routes } = getCheckoutRoutes(score, 3);
        routes.forEach((route, i) => assertValidRoute(route, score, 3, `score ${score}, route #${i + 1}`));
      });
    }
  }
});

describe('known bogey scores (traditionally uncheckoutable in 3 darts)', () => {
  // These are the 7 scores real darts players know as "bogey
  // numbers" - no combination of 3 darts (including doubles/Bull as
  // the finish) can reach them. Verifying the engine agrees is a
  // strong sanity check on the whole route-search implementation,
  // not just an arbitrary spot-check.
  const KNOWN_BOGEY_SCORES = [169, 168, 166, 165, 163, 162, 159];

  KNOWN_BOGEY_SCORES.forEach((score) => {
    test(`score ${score} is correctly reported as NOT checkoutable`, () => {
      const { checkoutPossible, routes } = getCheckoutRoutes(score, 3);
      assert.equal(checkoutPossible, false, `score ${score}: expected checkoutPossible=false (bogey score), got true`);
      assert.deepEqual(routes, [], `score ${score}: expected no routes for a bogey score`);
    });
  });

  test('the engine\'s full 2-170 bogey set matches the traditional 7 bogey scores exactly', () => {
    const foundBogeys = [];
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { checkoutPossible } = getCheckoutRoutes(score, 3);
      if (!checkoutPossible) foundBogeys.push(score);
    }
    assert.deepEqual(
      foundBogeys,
      KNOWN_BOGEY_SCORES.slice().sort((a, b) => a - b),
      `Engine's bogey scores (${foundBogeys.join(', ')}) don't match the traditional 7 (${KNOWN_BOGEY_SCORES.join(', ')})`
    );
  });
});

describe('scores outside 2-170 and non-integer input are rejected', () => {
  const invalidScores = [0, 1, -5, 171, 180, 1.5, NaN, Infinity];
  invalidScores.forEach((score) => {
    test(`score ${JSON.stringify(score)} is not checkoutable`, () => {
      const { checkoutPossible, routes } = getCheckoutRoutes(score, 3);
      assert.equal(checkoutPossible, false);
      assert.deepEqual(routes, []);
    });
  });
});

// --- 2. Mathematical validity is already folded into the exhaustive sweep
//    above via assertValidRoute() on every non-bogey score. The tests
//    below add targeted checks on top of that for the specific
//    constraints called out in the task, so a regression in any one
//    of them fails with a clear, targeted message rather than only
//    showing up as a generic exhaustive-sweep failure.

describe('mathematical validity constraints, targeted checks', () => {
  test('no route ever contains a segment outside the real board (1-20 singles/doubles/trebles, 25, Bull)', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      routes.forEach((route) => {
        route.forEach((dart) => {
          assert.ok(VALID_NOTATIONS.has(dart.notation), `score ${score}: invalid segment "${dart.notation}" in a returned route`);
        });
      });
    }
  });

  test('no route ever exceeds 3 darts, across every score and every maxDarts setting', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      for (const maxDarts of [1, 2, 3]) {
        const { routes } = getCheckoutRoutes(score, maxDarts);
        routes.forEach((route) => {
          assert.ok(route.length <= 3, `score ${score}, maxDarts ${maxDarts}: route has ${route.length} darts`);
          assert.ok(route.length <= maxDarts, `score ${score}, maxDarts ${maxDarts}: route has ${route.length} darts, exceeding the cap`);
        });
      }
    }
  });

  test('the final dart of every route is always a double or Bullseye, never a plain single/treble/outer-bull', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      routes.forEach((route) => {
        const finish = route[route.length - 1];
        assert.equal(finish.isDouble, true, `score ${score}: route finishes on "${finish.notation}", not a double/Bullseye`);
      });
    }
  });

  test('every route\'s darts sum exactly to the requested score (no over/undershoot)', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      routes.forEach((route) => {
        const sum = route.reduce((t, d) => t + d.value, 0);
        assert.equal(sum, score, `score ${score}: route ${route.map((d) => d.notation).join(',')} sums to ${sum}`);
      });
    }
  });
});

// --- 3. One-, two-, three-dart checkouts + representative edge cases -----

describe('one-dart finishes', () => {
  test('a score matching a double is a valid 1-dart finish', () => {
    // 40 = D20, the most iconic 1-dart finish
    const { checkoutPossible, routes } = getCheckoutRoutes(40, 1);
    assert.equal(checkoutPossible, true);
    assert.ok(routes.some((r) => r.length === 1 && r[0].notation === 'D20'));
  });

  test('50 (Bullseye) is a valid 1-dart finish', () => {
    const { checkoutPossible, routes } = getCheckoutRoutes(50, 1);
    assert.equal(checkoutPossible, true);
    routes.forEach((r) => assertValidRoute(r, 50, 1, '50 at 1 dart'));
    assert.ok(routes.some((r) => r.length === 1 && r[0].notation === 'Bull'));
  });

  test('every single double D1-D20 is independently checkoutable in 1 dart at its own value', () => {
    for (let n = 1; n <= 20; n++) {
      const score = n * 2;
      const { checkoutPossible, routes } = getCheckoutRoutes(score, 1);
      assert.equal(checkoutPossible, true, `D${n} (score ${score}) should be a valid 1-dart finish`);
      assert.ok(
        routes.some((r) => r.length === 1 && r[0].notation === `D${n}`),
        `D${n} (score ${score}): expected a route consisting of exactly [D${n}]`
      );
    }
  });

  test('a score with no matching double/Bullseye is NOT a 1-dart finish (e.g. 7)', () => {
    const { checkoutPossible, routes } = getCheckoutRoutes(7, 1);
    assert.equal(checkoutPossible, false);
    assert.deepEqual(routes, []);
  });

  test('capping maxDarts at 1 never returns a multi-dart route', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 1);
      routes.forEach((r) => assert.equal(r.length, 1, `score ${score} at maxDarts=1 returned a ${r.length}-dart route`));
    }
  });
});

describe('two-dart checkouts', () => {
  test('99 requires exactly 3 darts (not checkoutable in 2)', () => {
    const twoDart = getCheckoutRoutes(99, 2);
    assert.equal(twoDart.checkoutPossible, false, '99 should not be a 2-dart finish');
    const threeDart = getCheckoutRoutes(99, 3);
    assert.equal(threeDart.checkoutPossible, true, '99 should be checkoutable in 3 darts');
    threeDart.routes.forEach((r) => assertValidRoute(r, 99, 3, '99 at 3 darts'));
  });

  test('100 is a valid finish within 3 darts, and if a 2-dart route exists it is preferred over 3', () => {
    const { checkoutPossible, routes } = getCheckoutRoutes(100, 3);
    assert.equal(checkoutPossible, true);
    routes.forEach((r) => assertValidRoute(r, 100, 3, '100'));
    // T20 + D20 = 100 is a legal 2-dart route, so the engine (which
    // prefers the shortest available dart count) should return only
    // 2-dart routes here, not pad with 3-dart alternatives.
    assert.ok(routes.every((r) => r.length === 2), `100: expected only 2-dart routes, got lengths ${routes.map((r) => r.length)}`);
  });

  test('107 is checkoutable via T19 + Bull, a valid 2-dart route', () => {
    // T19 (57) + Bull (50) = 107 - a legitimate 2-dart checkout,
    // even though it's less commonly thrown as one in practice than
    // a 3-dart route. checkoutEngine correctly finds it since it
    // searches exhaustively rather than from a fixed lookup table.
    const { checkoutPossible, routes } = getCheckoutRoutes(107, 2);
    assert.equal(checkoutPossible, true, '107 should be checkoutable in 2 darts (T19, Bull)');
    routes.forEach((r) => assertValidRoute(r, 107, 2, '107 at 2 darts'));
    assert.ok(
      routes.some((r) => r.length === 2 && r[0].notation === 'T19' && r[1].notation === 'Bull'),
      '107 at 2 darts: expected a [T19, Bull] route among the results'
    );
  });

  test('every returned 2-dart route is exactly 2 darts, first non-final + a finishing double/Bullseye', () => {
    // Sweep every score that findAllRoutes says has a genuine 2-dart option.
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const all = findAllRoutes(score, 2);
      const twoDartOnly = all.filter((r) => r.length === 2);
      twoDartOnly.forEach((route) => assertValidRoute(route, score, 2, `score ${score}, 2-dart route`));
    }
  });
});

describe('three-dart checkouts', () => {
  test('170 (T20, T20, Bull) is the maximum checkout and is valid', () => {
    const { checkoutPossible, routes } = getCheckoutRoutes(170, 3);
    assert.equal(checkoutPossible, true);
    routes.forEach((r) => assertValidRoute(r, 170, 3, '170'));
    assert.ok(routes.some((r) => r.length === 3), '170 should require 3 darts');
  });

  test('121 is a valid 3-dart checkout', () => {
    const { checkoutPossible, routes } = getCheckoutRoutes(121, 3);
    assert.equal(checkoutPossible, true);
    routes.forEach((r) => assertValidRoute(r, 121, 3, '121'));
  });

  test('167 is a valid 3-dart checkout (one of the few very-high non-bogey scores)', () => {
    const { checkoutPossible, routes } = getCheckoutRoutes(167, 3);
    assert.equal(checkoutPossible, true);
    routes.forEach((r) => assertValidRoute(r, 167, 3, '167'));
  });

  test('every returned 3-dart route is exactly 3 darts and only appears when 1-and-2-dart options are exhausted', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      const hasOneOrTwoDartOption = findAllRoutes(score, 2).length > 0;
      if (hasOneOrTwoDartOption) {
        assert.ok(
          routes.every((r) => r.length <= 2),
          `score ${score}: a <=2-dart route exists, but getCheckoutRoutes(score,3) returned a 3-dart route anyway (lengths: ${routes.map((r) => r.length)})`
        );
      }
    }
  });
});

describe('representative edge-case scores called out in the task (2, 3, 40, 50, 99, 100, 107, 121, 167, 170)', () => {
  const cases = [
    { score: 2, expectPossible: true },   // D1, the minimum checkoutable score
    { score: 3, expectPossible: true },   // no double is itself worth 3, but 1 + D1 = 3 is a legal 2-dart route
    { score: 40, expectPossible: true },  // D20, textbook 1-dart finish
    { score: 50, expectPossible: true },  // Bullseye, 1-dart finish
    { score: 99, expectPossible: true },  // classic 3-dart-only checkout
    { score: 100, expectPossible: true }, // classic 2-dart checkout (T20, D20)
    { score: 107, expectPossible: true }, // checkoutable via T19 + Bull (2 darts)
    { score: 121, expectPossible: true }, // 3-dart checkout
    { score: 167, expectPossible: true }, // high 3-dart checkout
    { score: 170, expectPossible: true }, // maximum possible checkout
  ];

  cases.forEach(({ score, expectPossible }) => {
    test(`score ${score}: checkoutPossible === ${expectPossible}`, () => {
      const { checkoutPossible, routes } = getCheckoutRoutes(score, 3);
      assert.equal(checkoutPossible, expectPossible, `score ${score}: expected checkoutPossible=${expectPossible}, got ${checkoutPossible}`);
      routes.forEach((r) => assertValidRoute(r, score, 3, `score ${score}`));
    });
  });
});

// --- 4. Best / alternative route behaviour, as currently implemented -----

describe('best/alternative route selection (existing behaviour only, not redefined)', () => {
  test('getCheckoutRoutes returns at most `limit` routes, defaulting to 2', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      assert.ok(routes.length <= 2, `score ${score}: expected at most 2 routes by default, got ${routes.length}`);
    }
  });

  test('when 2 routes are returned, both are independently valid checkouts for the same score/dart-cap', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      if (routes.length === 2) {
        assertValidRoute(routes[0], score, 3, `score ${score}, "best" route`);
        assertValidRoute(routes[1], score, 3, `score ${score}, "alternative" route`);
      }
    }
  });

  test('when 2 routes are returned, they use a different SET of segments (never the same darts reordered)', () => {
    // This mirrors dedupeRoutes()'s own documented behaviour - the
    // key used here (sorted notations) is exactly the key
    // dedupeRoutes() itself uses, so this test is checking that the
    // documented guarantee actually holds for getCheckoutRoutes'
    // public output, not re-deriving a new definition of "distinct".
    const routeKey = (route) => route.map((d) => d.notation).slice().sort().join('-');
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      if (routes.length === 2) {
        assert.notEqual(
          routeKey(routes[0]),
          routeKey(routes[1]),
          `score ${score}: "best" and "alternative" routes use the same set of segments (${routeKey(routes[0])})`
        );
      }
    }
  });

  test('the returned routes are always ordered best-first per the engine\'s own routeScore ranking (rankRoutes is idempotent/order-preserving on already-ranked input)', () => {
    // Re-run rankRoutes on the exact routes getCheckoutRoutes already
    // returned; if getCheckoutRoutes' internal ranking matches
    // rankRoutes' own criteria (which it must, since it calls
    // rankRoutes internally), re-ranking should be a no-op.
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      const { routes } = getCheckoutRoutes(score, 3);
      if (routes.length < 2) continue;
      const reRanked = rankRoutes(routes, routes.length);
      const key = (route) => route.map((d) => d.notation).join(',');
      assert.deepEqual(
        reRanked.map(key),
        routes.map(key),
        `score ${score}: re-ranking the already-returned routes changed their order, meaning getCheckoutRoutes' output isn't self-consistent with rankRoutes`
      );
    }
  });

  test('rankRoutes(routes, limit) never returns more than `limit` routes, and preserves relative order for a hand-picked case', () => {
    // 41 has many legal (but unequal) routes at its shortest dart
    // count (2 darts) - e.g. via single+double combinations - so
    // it's a good case for checking rankRoutes' behaviour in
    // isolation from getCheckoutRoutes' own dart-count-limiting
    // step. (40 itself is a poor choice here: it's a clean 1-dart
    // D20 finish, so findAllRoutes(40, 3) only ever returns that
    // single route - see findAllRoutes' documented "restricted to
    // the shortest dart count that works" behaviour.)
    const all = findAllRoutes(41, 3);
    assert.ok(all.length > 2, 'expected findAllRoutes(41, 3) to surface more than 2 candidate routes for this check to be meaningful');

    const top1 = rankRoutes(all, 1);
    const top3 = rankRoutes(all, 3);
    assert.equal(top1.length, 1);
    assert.ok(top3.length <= 3);
    // Whatever rankRoutes decides is #1 in a 1-limit call should
    // also be #1 in a wider call - the limit shouldn't change the ordering.
    assert.deepEqual(
      top1[0].map((d) => d.notation),
      top3[0].map((d) => d.notation),
      'rankRoutes\' #1 pick changed when only the `limit` argument changed'
    );
  });

  test('findAllRoutes + rankRoutes composed together reproduce getCheckoutRoutes\' output exactly (documented relationship holds)', () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score++) {
      for (const maxDarts of [1, 2, 3]) {
        const direct = getCheckoutRoutes(score, maxDarts, 2);
        const composed = rankRoutes(findAllRoutes(score, maxDarts), 2);
        const key = (route) => route.map((d) => d.notation).join(',');
        assert.deepEqual(
          direct.routes.map(key),
          composed.map(key),
          `score ${score}, maxDarts ${maxDarts}: getCheckoutRoutes and findAllRoutes+rankRoutes disagree`
        );
      }
    }
  });
});

// --- 5. Player-preference behaviour: confirmed NOT part of the engine ----

describe('player-preference selection is not part of checkoutEngine.js (by design, out of scope here)', () => {
  test('the engine\'s public API has no preference/profile-related functions', () => {
    const exportedKeys = Object.keys(engine);
    const preferenceLike = exportedKeys.filter((k) => /preference|favorite|favourite|profile/i.test(k));
    assert.deepEqual(
      preferenceLike,
      [],
      `Expected no preference-related exports on checkoutEngine.js, found: ${preferenceLike.join(', ')}. ` +
      'If player-preference logic has been moved INTO the engine since this suite was written, ' +
      'add real tests for it here rather than relying on this guard test.'
    );
  });

  test('getCheckoutRoutes accepts (score, maxDarts, limit) - limit is optional with a default', () => {
    // Function.prototype.length only counts parameters BEFORE the
    // first one with a default value, so getCheckoutRoutes(score,
    // maxDarts, limit = 2) correctly reports .length === 2, not 3 -
    // asserting the literal .length here would be asserting a JS
    // language quirk, not anything about the engine. What actually
    // matters (that a preference/profile object hasn't been slipped
    // in as an extra required argument) is checked by confirming
    // the function still behaves identically whether or not a 4th
    // argument is passed.
    const score = 40;
    const withoutExtraArg = getCheckoutRoutes(score, 3, 2);
    const withExtraArg = getCheckoutRoutes(score, 3, 2, { favoriteDoubles: [1, 2] });
    const key = (result) => result.routes.map((r) => r.map((d) => d.notation).join(',')).join('|');
    assert.equal(
      key(withoutExtraArg),
      key(withExtraArg),
      'getCheckoutRoutes\' output changed when a 4th argument was passed - a preference/profile parameter may have been added silently'
    );
  });
});
