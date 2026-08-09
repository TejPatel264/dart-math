/**
 * ui.js
 * ---------------------------------------------------------
 * Everything that touches the DOM lives here: element
 * references and small render functions. main.js decides
 * *when* to call these; this module decides *how* the page
 * updates. Keeping this separate from gameEngine.js/stats.js
 * means the game logic stays testable and UI-agnostic, and
 * this file can later be swapped out (e.g. for a canvas-based
 * dartboard view) without touching the logic.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const THROW_SQUARE_COUNT = 3;
  const MAX_ANSWER_DIGITS = 3; // scores never exceed 3 digits (max 500)

  // Must match the CSS transition duration on .throw-square__inner
  // (see styles.css). Used to know when a flip-back animation has
  // finished before swapping in the next question's throw labels.
  const FLIP_TRANSITION_MS = 500;

  // --- Element references, grabbed once ---
  const elements = {
    startingScore: document.getElementById('starting-score'),

    throwSquares: [0, 1, 2].map((i) => document.getElementById(`throw-square-${i}`)),
    throwLabels: [0, 1, 2].map((i) => document.getElementById(`throw-square-${i}-label`)),

    answerForm: document.getElementById('answer-form'),
    answerInput: document.getElementById('answer-input'),
    checkBtn: document.getElementById('check-btn'),
    numpad: document.getElementById('numpad'),

    feedback: document.getElementById('feedback'),
    feedbackResult: document.getElementById('feedback-result'),
    feedbackAddition: document.getElementById('feedback-addition'),
    feedbackSubtraction: document.getElementById('feedback-subtraction'),
    feedbackTime: document.getElementById('feedback-time'),

    statAnswered: document.getElementById('stat-answered'),
    statCorrect: document.getElementById('stat-correct'),
    statAccuracy: document.getElementById('stat-accuracy'),
    statAvgTime: document.getElementById('stat-avg-time'),
    resetStatsBtn: document.getElementById('reset-stats-btn'),
  };

  /**
   * Puts the page into "waiting for the reveal" state: input and
   * numpad hidden/disabled, and the Check/Next button - the SAME
   * button throughout, just relabelled - is disabled too, since
   * there's nothing to do until all 3 throws are shown.
   */
  function setRevealing() {
    elements.answerInput.disabled = true;
    elements.numpad.hidden = true;
    elements.checkBtn.disabled = true;
    elements.checkBtn.textContent = 'Check';
  }

  /** Puts the page into "ready to answer" state once the reveal finishes. */
  function setReadyToAnswer() {
    elements.answerInput.disabled = false;
    elements.numpad.hidden = false;
    elements.checkBtn.disabled = false;
    elements.checkBtn.textContent = 'Check';
  }

  /**
   * Puts the page into "just answered" state: input and numpad lock
   * again, but - unlike setRevealing - the button STAYS enabled and
   * relabels itself "Next question". It's still the same <button
   * type="submit">, so clicking it (or pressing Enter) fires the
   * same form submit event as checking an answer does; main.js's
   * existing "already answered -> advance instead" branch handles
   * the rest, with no separate button or click listener needed.
   */
  function setAnswered() {
    elements.answerInput.disabled = true;
    elements.numpad.hidden = true;
    elements.checkBtn.disabled = false;
    elements.checkBtn.textContent = 'Next question →';
  }

  /**
   * Moves keyboard focus to the answer input, ready for the next
   * entry. Safe on mobile: the input is `readonly` (see index.html),
   * and readonly inputs don't trigger the native virtual keyboard
   * when focused - so this just shows a focus ring, not a keyboard.
   */
  function focusAnswerInput() {
    // Timeout avoids focus being stolen back by the just-clicked button on mobile.
    setTimeout(() => elements.answerInput.focus(), 0);
  }

  /**
   * Sets each square's label text and treble styling to match the
   * given throws. Assumes the squares are currently face-down (not
   * "revealed") - call this only once any flip-back animation has
   * finished, so the new values are never visible mid-spin.
   * @param {{notation: string, value: number}[]} throws
   */
  function applyThrowLabels(throws) {
    for (let i = 0; i < THROW_SQUARE_COUNT; i++) {
      elements.throwLabels[i].textContent = throws[i].notation;
      elements.throwSquares[i].classList.remove('throw-square--treble');
      if (throws[i].notation.startsWith('T')) {
        elements.throwSquares[i].classList.add('throw-square--treble');
      }
    }
  }

  /**
   * Resets the 3 throw squares ready for a new question, then calls
   * back once it's safe to start the reveal sequence.
   *
   * If any square is still showing its previous (revealed) value,
   * this flips them face-down FIRST and waits for that animation to
   * finish before swapping in the new labels underneath - otherwise
   * the new notation would flash into view mid-rotation, spoiling
   * the reveal. If the squares are already face-down (e.g. the very
   * first question on page load), the labels are applied immediately.
   * @param {{notation: string, value: number}[]} throws
   * @param {() => void} onReady
   */
  function resetThrowSquares(throws, onReady) {
    const anyRevealed = elements.throwSquares.some((square) =>
      square.classList.contains('throw-square--revealed')
    );

    if (!anyRevealed) {
      applyThrowLabels(throws);
      if (onReady) onReady();
      return;
    }

    elements.throwSquares.forEach((square) => square.classList.remove('throw-square--revealed'));

    setTimeout(() => {
      applyThrowLabels(throws);
      if (onReady) onReady();
    }, FLIP_TRANSITION_MS);
  }

  /**
   * Renders a new question: sets the starting score, resets the
   * throw squares (deferring the label swap past any flip-back
   * animation - see resetThrowSquares), and resets the input/
   * feedback area. The answer input stays disabled - main.js
   * re-enables it once all 3 throws are revealed.
   * @param {{startingScore: number, throws: {notation: string, value: number}[]}} question
   * @param {() => void} onReady - Called once squares are safely reset and ready to reveal.
   */
  function renderQuestion(question, onReady) {
    elements.startingScore.textContent = question.startingScore;

    clearAnswer();
    setRevealing();

    elements.feedback.hidden = true;

    resetThrowSquares(question.throws, onReady);
  }

  /**
   * Flips a single throw square to reveal its value.
   * @param {number} index - 0, 1, or 2.
   */
  function revealThrowSquare(index) {
    elements.throwSquares[index].classList.add('throw-square--revealed');
  }

  /** Enables the answer input once all 3 throws are revealed, and focuses it. */
  function enableAnswerInput() {
    setReadyToAnswer();
    focusAnswerInput();
  }

  // --- Numpad / answer entry -------------------------------------
  // The answer input is `readonly` so mobile never shows a native
  // keyboard over it. All value changes go through these functions
  // instead, driven by either the on-screen numpad or a physical
  // keyboard (see the keydown listener further down).

  /** Clears the answer input back to empty. */
  function clearAnswer() {
    elements.answerInput.value = '';
  }

  /**
   * Appends a digit to the answer input, ignoring the request if
   * the input is disabled (still waiting on the reveal) or already
   * at the max sensible length.
   * @param {string} digit - '0'-'9'
   */
  function appendDigit(digit) {
    if (elements.answerInput.disabled) return;
    if (elements.answerInput.value.length >= MAX_ANSWER_DIGITS) return;

    // Avoid awkward leading zeros (e.g. "0" + "5" -> "05") by
    // dropping them once a non-zero digit follows.
    const next = (elements.answerInput.value + digit).replace(/^0+(?=\d)/, '');
    elements.answerInput.value = next;
  }

  /** Removes the last digit from the answer input. */
  function removeLastDigit() {
    if (elements.answerInput.disabled) return;
    elements.answerInput.value = elements.answerInput.value.slice(0, -1);
  }

  // Event delegation: one listener for all 12 numpad buttons.
  elements.numpad.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-key]');
    if (!button) return;

    const key = button.dataset.key;
    if (key === 'clear') clearAnswer();
    else if (key === 'backspace') removeLastDigit();
    else appendDigit(key);
  });

  // Physical keyboard support: the input is readonly, so it won't
  // insert characters on its own - we handle digits/backspace here.
  // Enter is left to the browser's default "submit the form" behaviour.
  elements.answerInput.addEventListener('keydown', (event) => {
    if (event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      appendDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      removeLastDigit();
    }
  });

  /**
   * Renders the result of a checked answer.
   * @param {boolean} wasCorrect
   * @param {{throws: {notation: string, value: number}[], visitScore: number, remainingScore: number}} question
   * @param {number} timeTakenSeconds
   */
  function renderFeedback(wasCorrect, question, timeTakenSeconds) {
    elements.feedback.hidden = false;

    elements.feedbackResult.textContent = wasCorrect ? 'Correct!' : 'Not quite';
    elements.feedbackResult.className = wasCorrect
      ? 'feedback__result feedback__result--correct'
      : 'feedback__result feedback__result--incorrect';

    // Show both steps of the mental maths, always - not just when
    // wrong - since reinforcing the working is the whole point:
    // 1) add the 3 throws, 2) subtract that total from the starting
    // score. These are two separate lines (not one run-on sentence)
    // so the subtraction - the actual answer to the question - is
    // impossible to miss.
    const sumLine = question.throws.map((t) => `${t.notation} (${t.value})`).join(' + ');
    elements.feedbackAddition.textContent = `${sumLine} = ${question.visitScore}`;
    elements.feedbackSubtraction.textContent =
      `${question.startingScore} − ${question.visitScore} = ${question.remainingScore}`;

    elements.feedbackTime.textContent = `Answered in ${timeTakenSeconds.toFixed(2)}s`;

    // Lock the input/numpad, but relabel the SAME Check button as
    // "Next question" rather than showing a separate button below -
    // only one action is ever relevant at a time, so there's no need
    // for two buttons competing for space.
    setAnswered();

    // Re-focus the button so pressing Enter immediately advances,
    // matching the "Enter submits, Enter advances" spec.
    setTimeout(() => elements.checkBtn.focus(), 0);
  }

  /**
   * Updates the stats panel with current tracker values.
   * @param {{questionsAnswered: number, correctAnswers: number, getAccuracyPercent: Function, getAverageTimeSeconds: Function}} stats
   */
  function renderStats(stats) {
    elements.statAnswered.textContent = stats.questionsAnswered;
    elements.statCorrect.textContent = stats.correctAnswers;

    const accuracy = stats.getAccuracyPercent();
    elements.statAccuracy.textContent = accuracy === null ? '—' : `${accuracy.toFixed(0)}%`;

    const avgTime = stats.getAverageTimeSeconds();
    elements.statAvgTime.textContent = avgTime === null ? '—' : `${avgTime.toFixed(2)}s`;
  }

  window.DartsTrainer.ui = {
    elements,
    renderQuestion,
    revealThrowSquare,
    enableAnswerInput,
    renderFeedback,
    renderStats,
    focusAnswerInput,
  };
})();
