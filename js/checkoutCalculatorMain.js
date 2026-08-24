/**
 * checkoutCalculatorMain.js
 * ---------------------------------------------------------
 * Wires up checkout-calculator.html: the numpad enters a target
 * score, the dart-count selector picks a max of 1/2/3 darts, and
 * "View checkout" asks checkoutEngine.js for the best route(s)
 * and renders them. Self-contained (this page has no session
 * stats, no generated questions, no timer) so - unlike the
 * counting-game pages - there's no separate "Ui" module; all the
 * DOM wiring lives here directly.
 *
 * Player-preference labelling: if either of the two displayed
 * routes finishes on one of the player's two favourite doubles
 * (set on the Lifetime Stats profile), it's labelled as their
 * preference. If neither does, the Alt route specifically is
 * replaced with a route that does - tried in order: favourite
 * double 1, favourite double 2, then (since a treble can only ever
 * appear as a non-final dart, never the finish) a route whose
 * non-final darts include favourite treble 1, then treble 2. Best
 * is never replaced, only re-labelled if it happens to already
 * qualify. If none of the four preferences turn up any route at
 * all, Best/Alt are left exactly as checkoutEngine originally
 * ranked them.
 * ---------------------------------------------------------
 */
(function () {
  const missing = [];
  if (!window.DartsTrainer) missing.push('all js/*.js files (window.DartsTrainer is undefined)');
  else {
    if (!window.DartsTrainer.checkoutEngine) missing.push('js/checkoutEngine.js');
    if (!window.DartsTrainer.lifetimeStats) missing.push('js/lifetimeStats.js');
  }

  if (missing.length > 0) {
    const message =
      'Checkout Calculator failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to this page.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const { getCheckoutRoutes, findAllRoutes, rankRoutes, MAX_SCORE, MIN_SCORE } = window.DartsTrainer.checkoutEngine;
  const { getProfile } = window.DartsTrainer.lifetimeStats;

  const MAX_DIGITS = 3; // scores only ever go up to 170

  const elements = {
    scoreInput: document.getElementById('score-input'),
    dartSelector: document.getElementById('dart-selector'),
    numpad: document.getElementById('numpad'),
    viewBtn: document.getElementById('view-checkout-btn'),
    result: document.getElementById('checkout-result'),
    impossible: document.getElementById('checkout-impossible'),
    routesContainer: document.getElementById('checkout-routes'),
  };

  let selectedDarts = 3;

  // --- Dart-count selector -------------------------------------------------

  function setSelectedDarts(darts) {
    selectedDarts = darts;
    const options = elements.dartSelector.querySelectorAll('.dart-selector__option');
    options.forEach((btn) => {
      const isActive = Number(btn.dataset.darts) === darts;
      btn.classList.toggle('dart-selector__option--active', isActive);
    });
  }

  elements.dartSelector.addEventListener('click', (event) => {
    const btn = event.target.closest('.dart-selector__option');
    if (!btn) return;
    setSelectedDarts(Number(btn.dataset.darts));
    // Switching dart count while a result is showing would leave a
    // stale answer on screen next to a now-different selector state -
    // hide it until the user re-checks with the new count.
    hideResult();
  });

  // --- Numpad ----------------------------------------------------------------

  function currentValue() {
    return elements.scoreInput.value;
  }

  function setValue(newValue) {
    elements.scoreInput.value = newValue;
  }

  function handleDigit(digit) {
    const next = currentValue() === '0' ? digit : currentValue() + digit;
    if (next.length > MAX_DIGITS) return;
    // Avoid values that can never be a valid score once complete
    // (e.g. leading toward absurdly large numbers) - simplest guard
    // is just the digit-length cap above; checkoutEngine itself
    // rejects anything outside MIN_SCORE..MAX_SCORE at "View checkout"
    // time, so no need to duplicate that validation here.
    setValue(next);
  }

  function handleBackspace() {
    const next = currentValue().slice(0, -1);
    setValue(next);
  }

  function handleClear() {
    setValue('');
  }

  elements.numpad.addEventListener('click', (event) => {
    const key = event.target.closest('.numpad__key');
    if (!key) return;
    const value = key.dataset.key;

    if (value === 'clear') handleClear();
    else if (value === 'backspace') handleBackspace();
    else handleDigit(value);

    hideResult();
  });

  // Physical keyboard support, same as the counting-game pages -
  // the input is readonly (so mobile's native keyboard never pops
  // up) but a desktop user can still type directly into it.
  elements.scoreInput.addEventListener('keydown', (event) => {
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      handleDigit(event.key);
      hideResult();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      handleBackspace();
      hideResult();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleViewCheckout();
    }
  });

  // --- Player-preference matching ---------------------------------------

  /**
   * @param {DartOption[]} route
   * @param {number} doubleValue - 1-20 (a favourite double slot's segment number, not its scoring value)
   * @returns {boolean} true if the route's FINISHING dart is that double.
   */
  function routeFinishesOnDouble(route, doubleValue) {
    const finish = route[route.length - 1];
    return finish.notation === `D${doubleValue}`;
  }

  /**
   * @param {DartOption[]} route
   * @param {number} trebleValue - 1-20 (a favourite treble slot's segment number)
   * @returns {boolean} true if the route uses that treble as one of its NON-FINAL darts -
   *   a treble can never be the finishing dart, so this deliberately excludes the last dart.
   */
  function routeUsesTrebleNonFinal(route, trebleValue) {
    const nonFinal = route.slice(0, -1);
    return nonFinal.some((dart) => dart.notation === `T${trebleValue}`);
  }

  /**
   * @param {DartOption[]} route
   * @returns {string} A route's segment set as an order-independent key, for equality checks.
   */
  function routeKey(route) {
    return route.map((d) => d.notation).slice().sort().join('-');
  }

  /**
   * Searches every legal route for the score (not just the top 2)
   * for one matching the given predicate, preferring fewest darts
   * then the usual best-first ranking among ties - see the file
   * header for why this order matches how the fallback is meant to
   * feel (closest to what checkoutEngine would have suggested
   * anyway, just constrained to routes that also satisfy the
   * player's preference).
   * @param {number} score
   * @param {number} maxDarts
   * @param {(route: DartOption[]) => boolean} predicate
   * @param {DartOption[]} excludeRoute - Never returned even if it matches -
   *   used to keep this from "finding" the Best route itself and
   *   silently turning Alt into a duplicate of it (see
   *   applyPlayerPreference, which only calls this once Best is
   *   already known not to be preferred - so a match equal to Best
   *   would be a coincidental collision on a DIFFERENT preference,
   *   not a genuine second qualifying route).
   * @returns {DartOption[]|null}
   */
  function findPreferredRoute(score, maxDarts, predicate, excludeRoute) {
    const excludeKey = routeKey(excludeRoute);
    const all = findAllRoutes(score, maxDarts);
    const matching = all.filter((route) => predicate(route) && routeKey(route) !== excludeKey);
    if (matching.length === 0) return null;
    return rankRoutes(matching, 1)[0];
  }

  /**
   * Given the normally-ranked Best/Alt routes, decides what to
   * actually display and why - see the file header for the full
   * rule set. Returns one entry per displayed route, each carrying
   * an optional preferenceLabel to render underneath it.
   * @param {DartOption[][]} routes - checkoutEngine's ranked routes (1 or 2 of them).
   * @param {number} score
   * @param {number} maxDarts
   * @returns {{route: DartOption[], preferenceLabel: string|null}[]}
   */
  function applyPlayerPreference(routes, score, maxDarts) {
    const profile = getProfile();
    const hasName = profile.name.trim().length > 0;
    const possessive = hasName ? `${profile.name.trim()}'s preference` : 'Your preference';

    // Only ever a real question when there's an Alt slot to
    // possibly replace (a 1-dart checkout, for instance, often
    // only has a single legal route at all - nothing to swap).
    if (routes.length < 2) {
      return routes.map((route) => ({
        route,
        preferenceLabel: routeFinishesOnDouble(route, profile.favoriteDoubles[0]) || routeFinishesOnDouble(route, profile.favoriteDoubles[1])
          ? possessive
          : null,
      }));
    }

    const [best, alt] = routes;
    const isPreferred = (route) =>
      routeFinishesOnDouble(route, profile.favoriteDoubles[0]) || routeFinishesOnDouble(route, profile.favoriteDoubles[1]);

    const bestIsPreferred = isPreferred(best);
    const altIsPreferred = isPreferred(alt);

    if (bestIsPreferred || altIsPreferred) {
      // At least one already qualifies - label whichever does, no swap needed.
      return [
        { route: best, preferenceLabel: bestIsPreferred ? possessive : null },
        { route: alt, preferenceLabel: altIsPreferred ? possessive : null },
      ];
    }

    // Neither qualifies - look for a fallback route to replace Alt
    // with, trying favourite double 1, then 2, then favourite
    // treble 1, then 2 (as a non-final dart), in that order. The
    // first one that turns up ANY matching route wins - we don't
    // keep searching later preferences once an earlier one hits.
    const fallbackSearches = [
      (route) => routeFinishesOnDouble(route, profile.favoriteDoubles[0]),
      (route) => routeFinishesOnDouble(route, profile.favoriteDoubles[1]),
      (route) => routeUsesTrebleNonFinal(route, profile.favoriteTrebles[0]),
      (route) => routeUsesTrebleNonFinal(route, profile.favoriteTrebles[1]),
    ];

    for (const predicate of fallbackSearches) {
      const found = findPreferredRoute(score, maxDarts, predicate, best);
      if (found) {
        return [
          { route: best, preferenceLabel: null },
          { route: found, preferenceLabel: possessive },
        ];
      }
    }

    // No preference-matching route exists anywhere for this score -
    // leave Best/Alt exactly as checkoutEngine originally ranked them.
    return [
      { route: best, preferenceLabel: null },
      { route: alt, preferenceLabel: null },
    ];
  }

  // --- Route rendering ---------------------------------------------------

  /** Renders a single route as a row of dart "chips", e.g. [T20] [T20] [Bull], plus an optional preference note underneath. */
  function buildRouteRow(route, rank, preferenceLabel) {
    const row = document.createElement('div');
    row.className = 'checkout-route';

    const main = document.createElement('div');
    main.className = 'checkout-route__main';

    const rankLabel = document.createElement('span');
    rankLabel.className = 'checkout-route__rank';
    rankLabel.textContent = rank === 0 ? 'Best' : 'Alt';
    main.appendChild(rankLabel);

    const darts = document.createElement('div');
    darts.className = 'checkout-route__darts';
    route.forEach((dart) => {
      const chip = document.createElement('span');
      chip.className = 'checkout-route__chip';
      if (dart.isDouble) chip.classList.add('checkout-route__chip--double');
      chip.textContent = dart.notation;
      darts.appendChild(chip);
    });
    main.appendChild(darts);
    row.appendChild(main);

    if (preferenceLabel) {
      const note = document.createElement('p');
      note.className = 'checkout-route__preference';
      note.textContent = preferenceLabel;
      row.appendChild(note);
    }

    return row;
  }

  function hideResult() {
    elements.result.hidden = true;
  }

  function showImpossible() {
    elements.impossible.hidden = false;
    elements.routesContainer.innerHTML = '';
    elements.result.hidden = false;
  }

  function showRoutes(routes, score, maxDarts) {
    elements.impossible.hidden = true;
    elements.routesContainer.innerHTML = '';

    const withPreference = applyPlayerPreference(routes, score, maxDarts);
    withPreference.forEach(({ route, preferenceLabel }, index) => {
      elements.routesContainer.appendChild(buildRouteRow(route, index, preferenceLabel));
    });
    elements.result.hidden = false;
  }

  function handleViewCheckout() {
    const score = Number(currentValue());

    if (currentValue() === '' || !Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
      showImpossible();
      return;
    }

    const { checkoutPossible, routes } = getCheckoutRoutes(score, selectedDarts, 2);
    if (checkoutPossible) {
      showRoutes(routes, score, selectedDarts);
    } else {
      showImpossible();
    }
  }

  elements.viewBtn.addEventListener('click', handleViewCheckout);

  setSelectedDarts(3);
})();
