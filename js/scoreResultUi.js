/**
 * scoreResultUi.js
 * ---------------------------------------------------------
 * Shared rendering helpers for the "visit recap" result box used
 * by 3-Dart Practice and the 3-Dart (501) Game, in both their
 * flip-card and dartboard variants (practiceUi.js, ui.js,
 * practiceBoardUi.js, gameBoardUi.js). All four pages show the
 * same shape of result - a headline, the visit's darts as chips,
 * an optional Track-mode score progression, and the visit time -
 * so the DOM-building logic lives here once instead of being
 * copy-pasted four times with the same bugs to fix four times.
 *
 * Presentation only: this file has no opinion on question
 * generation, answer checking, or scoring - it only turns already-
 * computed values (a question object, whether the answer was
 * correct, the time taken) into DOM. Each page's own *Ui.js still
 * owns its element references and the correct/incorrect class
 * toggle; this just fills in the pieces that are identical
 * everywhere.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const MAXIMUM_VISIT = 180; // T20 + T20 + T20, the highest possible 3-dart score

  /**
   * @param {{notation: string, value: number}} throwItem
   * @returns {boolean} true for anything with a letter prefix (T20, D16, Bull) - a
   *   plain single's notation ("20") already IS its value, so there's no
   *   separate notation line to show underneath.
   */
  function needsValueSuffix(throwItem) {
    return !/^\d+$/.test(throwItem.notation);
  }

  /**
   * Builds the dart "chip" elements for a visit - the numeric value
   * (60, 20, 57...) as the prominent text, with its dart notation
   * underneath in smaller/lighter text. Value-first (not notation-
   * first) since the value is the number that actually feeds into
   * the maths - the notation is there to show WHERE that number
   * came from, which is secondary once the conversion's been made.
   * This is DOM built from elements (not a joined string) because
   * the two need to be two visually distinct weights within each
   * dart, which plain text can't express - see .answer-result__dart
   * in styles.css.
   *
   * A plain single (notation is just digits, e.g. "20") has nothing
   * to convert - its value already IS its notation - so those chips
   * skip the secondary line entirely rather than showing "20" twice.
   * @param {{notation: string, value: number}[]} throws
   * @returns {HTMLElement[]} one .answer-result__dart chip per throw, ready to insert
   */
  function buildDartChips(throws) {
    return throws.map((throwItem) => {
      const chip = document.createElement('span');
      chip.className = 'answer-result__dart';
      if (throwItem.notation.startsWith('T')) chip.classList.add('answer-result__dart--treble');

      const value = document.createElement('span');
      value.className = 'answer-result__dart-value';
      value.textContent = throwItem.value;
      chip.appendChild(value);

      if (needsValueSuffix(throwItem)) {
        const notation = document.createElement('span');
        notation.className = 'answer-result__dart-notation';
        notation.textContent = throwItem.notation;
        chip.appendChild(notation);
      }

      return chip;
    });
  }

  /**
   * Replaces a container's content with freshly-built dart chips.
   * The container passed in is expected to already BE the
   * .answer-result__darts element (see the HTML on each page) - this
   * fills it with chips directly rather than nesting another
   * .answer-result__darts wrapper inside it.
   * @param {HTMLElement} container
   * @param {{notation: string, value: number}[]} throws
   */
  function renderDartsRow(container, throws) {
    container.innerHTML = '';
    buildDartChips(throws).forEach((chip) => container.appendChild(chip));
  }

  /**
   * Builds the headline text for a visit result - correct and
   * incorrect share the same overall shape (a big primary number),
   * just different wording and colour (handled by the
   * .answer-result--correct/--incorrect classes applied elsewhere).
   *
   * On a wrong answer, the headline shows the CORRECT value (what
   * the player needs to actually walk away having read), not their
   * guess - the guess is secondary information, rendered dimmed
   * underneath instead (see renderUserAnswer below).
   *
   * Practice mode and Track mode ask for different things (the raw
   * visit total vs. the score remaining after it), so the headline
   * always stays anchored to whatever the player was actually
   * asked to answer - a Track-mode player typed a remaining-score
   * guess, so the correct REMAINING score is what's shown here, not
   * the visit total they never had to compute by hand.
   *
   * @param {Object} options
   * @param {boolean} options.wasCorrect
   * @param {number} options.correctValue - The right answer to what was actually asked
   *   (visitScore in Practice, remainingScore in Track).
   * @param {string} options.correctUnitLabel - Upper-case unit label for a CORRECT
   *   headline, e.g. "SCORED" or "REMAINING".
   * @param {string} options.incorrectUnitLabel - Label prefixing the correct value on an
   *   INCORRECT headline, e.g. "Actual Visit:" or "Actual Remaining:".
   * @returns {string}
   */
  function buildHeadlineText({ wasCorrect, correctValue, correctUnitLabel, incorrectUnitLabel }) {
    return wasCorrect ? `✓ ${correctValue} ${correctUnitLabel}` : `✕ ${incorrectUnitLabel} ${correctValue}`;
  }

  /**
   * Fills in the headline element for a visit result (see
   * buildHeadlineText for the parameters).
   * @param {HTMLElement} headlineEl
   * @param {Object} options - see buildHeadlineText
   */
  function renderHeadline(headlineEl, options) {
    headlineEl.textContent = buildHeadlineText(options);
  }

  /**
   * Renders what the player actually typed, as a dimmed secondary
   * line under the headline - only shown when they got it wrong
   * (hideUserAnswer hides it again on a correct answer, since it's
   * the SAME element reused question to question, not recreated
   * each time). Deliberately dimmed/subtle: the headline above
   * already carries the correct answer, which is the number that
   * actually matters here - the player's own wrong guess is just
   * context for what they typed, not something that needs to
   * compete with it for attention.
   * @param {HTMLElement} userAnswerEl
   * @param {string} userAnswer - The raw string the player submitted.
   */
  function renderUserAnswer(userAnswerEl, userAnswer) {
    userAnswerEl.textContent = `You answered ${userAnswer}`;
    userAnswerEl.hidden = false;
  }

  /** Hides the user's-answer line for a correct answer, where there's no mistake to show. */
  function hideUserAnswer(userAnswerEl) {
    userAnswerEl.hidden = true;
  }

  /** @param {{visitScore: number}} question @returns {boolean} true if this visit was the maximum possible (180). */
  function isMaximumVisit(question) {
    return question.visitScore === MAXIMUM_VISIT;
  }

  /**
   * Adds a small gold "180" badge onto an already-rendered headline
   * element, for the maximum-visit case - kept as a separate step
   * (rather than folded into buildHeadline) since it's orthogonal
   * to correct/incorrect and only some callers need it.
   * @param {HTMLElement} headlineEl
   */
  function appendMaximumBadge(headlineEl) {
    const badge = document.createElement('span');
    badge.className = 'answer-result__maximum-badge';
    badge.textContent = '180';
    headlineEl.appendChild(badge);
  }

  /**
   * Renders the Track-mode score progression line (401 -> 264),
   * replacing the old subtraction-equation presentation.
   * @param {HTMLElement} progressionEl
   * @param {number} startingScore
   * @param {number} remainingScore
   */
  function renderProgression(progressionEl, startingScore, remainingScore) {
    progressionEl.innerHTML = '';
    progressionEl.hidden = false;

    const from = document.createElement('span');
    from.className = 'answer-result__progression-from';
    from.textContent = startingScore;
    progressionEl.appendChild(from);

    const arrow = document.createElement('span');
    arrow.className = 'answer-result__progression-arrow';
    arrow.textContent = '→';
    progressionEl.appendChild(arrow);

    const to = document.createElement('span');
    to.className = 'answer-result__progression-to';
    to.textContent = remainingScore;
    progressionEl.appendChild(to);

    const label = document.createElement('span');
    label.className = 'answer-result__progression-label';
    label.textContent = 'Remaining';
    progressionEl.appendChild(label);
  }

  /**
   * Formats the visit-time line using darts-appropriate wording
   * ("Visit time" rather than "Answered in"/"Time taken").
   * @param {number} timeTakenSeconds
   * @returns {string}
   */
  function formatVisitTime(timeTakenSeconds) {
    return `Visit time ${timeTakenSeconds.toFixed(2)}s`;
  }

  window.DartsTrainer.scoreResultUi = {
    MAXIMUM_VISIT,
    renderDartsRow,
    renderHeadline,
    renderUserAnswer,
    hideUserAnswer,
    isMaximumVisit,
    appendMaximumBadge,
    renderProgression,
    formatVisitTime,
  };
})();
