/**
 * setupPicker.js
 * ---------------------------------------------------------
 * Drives the combined Game Mode + View picker screen that now
 * sits in front of both scoring modes (practice-picker.html for
 * COUNT, game-picker.html for TRACK). Replaces the old picker
 * pages' plain "tap a card to navigate immediately" behaviour:
 * tapping a Game Mode or View card now just updates selection
 * state and the Play button's destination, and only the Play
 * button itself actually navigates - see index.html's COUNT/TRACK
 * buttons, which link straight to these pages rather than
 * skipping them.
 *
 * Both Game Mode and View default to a pre-selected option on
 * load (Unlimited, Flip Cards) so Play is always immediately
 * navigable - there's no disabled/inert state to wait out, since
 * every screen this leads to already has a valid destination the
 * moment the page renders.
 *
 * Each page declares its own view/mode destinations declaratively
 * via data attributes (see the HTML), so this one script drives
 * both pages instead of duplicating near-identical logic twice.
 *
 * The selected card in each row is also sized larger than its
 * sibling(s) - 40/30/30 for the 3-card Game Mode row, 60/40 for
 * the 2-card View row - via flex-grow (see .setup-card's
 * transition on flex-grow in styles.css, which is what makes the
 * resize animate rather than snap). This is driven purely by each
 * card's position within its row, not by any per-card data
 * attribute, since the split only depends on "how many cards share
 * this row" and "which index is currently selected" - identical
 * logic serves both the 3-way Game Mode row and the 2-way View
 * row without needing to special-case either.
 * ---------------------------------------------------------
 */
(function () {
  const viewCards = Array.from(document.querySelectorAll('.setup-card[data-view]'));
  const modeCards = Array.from(document.querySelectorAll('.setup-card[data-mode-href]'));
  const playBtn = document.getElementById('setup-play-btn');

  if (!playBtn || viewCards.length === 0 || modeCards.length === 0) {
    // Markup didn't come through as expected - fail quietly rather
    // than throwing, same defensive stance as pickerIconsInit.js.
    return;
  }

  // All mode cards - including disabled ones (Timer, and Streak on
  // the TRACK/game-picker page) - participate in the Game Mode
  // row's width split; a disabled card just never ends up on the
  // receiving end of the "selected" share, since it can never
  // become selectedModeHref. Read from the DOM in the order the
  // cards actually appear, so the split lines up with what the
  // player sees left-to-right regardless of which ones are wired
  // up with a real href.
  const allModeCards = Array.from(document.querySelectorAll('.setup-card--mode'));

  // Flip Cards is the auto-selected default view, and Unlimited
  // the auto-selected default game mode, per spec - whichever card
  // carries the matching *-default="true" attribute wins if
  // present, otherwise the first card in each group does. Both
  // groups always have a selection, so Play always has a real
  // destination from the moment the page loads.
  let selectedView = (viewCards.find((c) => c.dataset.viewDefault === 'true') || viewCards[0]).dataset.view;
  let selectedModeHref = (modeCards.find((c) => c.dataset.modeDefault === 'true') || modeCards[0]).dataset.modeHref;

  /**
   * Sets each card's flex-grow so the selected one is enlarged and
   * the rest are evenly-sized "runners-up" - e.g. for 3 cards:
   * selected gets `majorShare`, the other two split the remaining
   * (100 - majorShare) between them; for 2 cards: selected gets
   * `majorShare`, the other gets the rest outright.
   * @param {HTMLElement[]} cards - All cards in one row, in display order.
   * @param {(card: HTMLElement) => boolean} isSelected
   * @param {number} majorShare - The selected card's percentage share (e.g. 40 or 60).
   */
  function applyRowSizing(cards, isSelected, majorShare) {
    const minorShare = (100 - majorShare) / (cards.length - 1);
    cards.forEach((card) => {
      card.style.flexGrow = isSelected(card) ? majorShare : minorShare;
    });
  }

  function applyViewSelection() {
    viewCards.forEach((card) => {
      const selected = card.dataset.view === selectedView;
      card.classList.toggle('setup-card--selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    applyRowSizing(viewCards, (card) => card.dataset.view === selectedView, 60);
  }

  function applyModeSelection() {
    modeCards.forEach((card) => {
      if (card.disabled) return;
      const isSelected = card.dataset.modeHref === selectedModeHref;
      card.classList.toggle('setup-card--selected', isSelected);
      card.setAttribute('aria-pressed', String(isSelected));
    });
    applyRowSizing(allModeCards, (card) => card.dataset.modeHref === selectedModeHref, 40);
  }

  function updatePlayButton() {
    const modeCard = modeCards.find((c) => c.dataset.modeHref === selectedModeHref);

    // Each mode card carries both a flip-cards and a dartboard
    // destination (data-mode-href / data-mode-href-board) - which
    // one Play actually goes to depends on the currently selected
    // View, so this is recomputed on every selection change rather
    // than baked in once.
    const href = selectedView === 'dartboard' && modeCard.dataset.modeHrefBoard
      ? modeCard.dataset.modeHrefBoard
      : modeCard.dataset.modeHref;

    playBtn.href = href;

    // Prefetch whatever Play currently points to, so by the time
    // the player actually taps it, the page (and its own script
    // bundles) are already in the browser's cache - re-targets
    // automatically as the player tries different Game Mode/View
    // combinations before committing (see js/prefetch.js).
    if (window.DartsTrainer.prefetchPage) window.DartsTrainer.prefetchPage(href);
  }

  viewCards.forEach((card) => {
    card.addEventListener('click', () => {
      selectedView = card.dataset.view;
      applyViewSelection();
      updatePlayButton();
    });
  });

  modeCards.forEach((card) => {
    if (card.disabled) return;
    card.addEventListener('click', () => {
      selectedModeHref = card.dataset.modeHref;
      applyModeSelection();
      updatePlayButton();
    });
  });

  applyViewSelection();
  applyModeSelection();
  updatePlayButton();
})();
