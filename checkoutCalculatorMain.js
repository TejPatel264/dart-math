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
 * ---------------------------------------------------------
 */
(function () {
  const missing = [];
  if (!window.DartsTrainer) missing.push('all js/*.js files (window.DartsTrainer is undefined)');
  else if (!window.DartsTrainer.checkoutEngine) missing.push('js/checkoutEngine.js');

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

  const { getCheckoutRoutes, MAX_SCORE, MIN_SCORE } = window.DartsTrainer.checkoutEngine;

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

  // --- Route rendering ---------------------------------------------------

  /** Renders a single route as a row of dart "chips", e.g. [T20] [T20] [Bull] */
  function buildRouteRow(route, rank) {
    const row = document.createElement('div');
    row.className = 'checkout-route';

    const rankLabel = document.createElement('span');
    rankLabel.className = 'checkout-route__rank';
    rankLabel.textContent = rank === 0 ? 'Best' : 'Alt';
    row.appendChild(rankLabel);

    const darts = document.createElement('div');
    darts.className = 'checkout-route__darts';
    route.forEach((dart) => {
      const chip = document.createElement('span');
      chip.className = 'checkout-route__chip';
      if (dart.isDouble) chip.classList.add('checkout-route__chip--double');
      chip.textContent = dart.notation;
      darts.appendChild(chip);
    });
    row.appendChild(darts);

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

  function showRoutes(routes) {
    elements.impossible.hidden = true;
    elements.routesContainer.innerHTML = '';
    routes.forEach((route, index) => {
      elements.routesContainer.appendChild(buildRouteRow(route, index));
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
      showRoutes(routes);
    } else {
      showImpossible();
    }
  }

  elements.viewBtn.addEventListener('click', handleViewCheckout);

  setSelectedDarts(3);
})();
