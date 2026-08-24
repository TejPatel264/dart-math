/**
 * practiceUi.js
 * ---------------------------------------------------------
 * DOM layer for the 3-Dart Practice page. This is deliberately
 * a separate (smaller) sibling of ui.js rather than a shared
 * module with conditionals in it: the two pages' DOM genuinely
 * differs (no starting score, no score-progression line), and
 * keeping them as two plain files is easier to read and safer to
 * change than one file branching on "which page am I" everywhere.
 * The result-box rendering itself is shared logic, though - see
 * js/scoreResultUi.js, which both this file and ui.js delegate to.
 *
 * Everything below the DOM layer (random.js, timer.js, aimData/
 * aimModel.js, revealSequence.js, gameEngine.js, stats.js) is
 * shared as-is with the 3-dart game - only this file and
 * practiceMain.js are practice-specific.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const THROW_SQUARE_COUNT = 3;
  const MAX_ANSWER_DIGITS = 3; // a 3-dart visit tops out at 180 (T20+T20+T20)

  // Must match the CSS transition duration on .throw-square__inner
  // (see styles.css). Used to know when a flip-back animation has
  // finished before swapping in the next question's throw labels.
  const FLIP_TRANSITION_MS = 300;

  // --- Element references, grabbed once ---
  const elements = {
    throwSquares: [0, 1, 2].map((i) => document.getElementById(`throw-square-${i}`)),
    throwLabels: [0, 1, 2].map((i) => document.getElementById(`throw-square-${i}-label`)),

    answerForm: document.getElementById('answer-form'),
    answerInput: document.getElementById('answer-input'),
    checkBtn: document.getElementById('check-btn'),
    numpad: document.getElementById('numpad'),

    answerResult: document.getElementById('answer-result'),
    feedbackResult: document.getElementById('feedback-result'),
    feedbackUserAnswer: document.getElementById('feedback-user-answer'),
    feedbackDarts: document.getElementById('feedback-darts'),
    feedbackTime: document.getElementById('feedback-time'),

    statAnswered: document.getElementById('stat-answered'),
    statCorrect: document.getElementById('stat-correct'),
    statAccuracy: document.getElementById('stat-accuracy'),
    statAvgTime: document.getElementById('stat-avg-time'),
    statStreak: document.getElementById('stat-streak'),
  };

  /** Puts the page into "waiting for the reveal" state. */
  function setRevealing() {
    elements.answerInput.hidden = false;
    elements.answerInput.disabled = true;
    elements.answerResult.hidden = true;
    elements.numpad.classList.add('numpad--disabled');
    elements.checkBtn.disabled = true;
    elements.checkBtn.textContent = '✓';
    elements.checkBtn.setAttribute('aria-label', 'Check answer');
  }

  /** Puts the page into "ready to answer" state once the reveal finishes. */
  function setReadyToAnswer() {
    elements.answerInput.hidden = false;
    elements.answerInput.disabled = false;
    elements.answerResult.hidden = true;
    elements.numpad.classList.remove('numpad--disabled');
    elements.checkBtn.disabled = false;
    elements.checkBtn.textContent = '✓';
    elements.checkBtn.setAttribute('aria-label', 'Check answer');
  }

  /**
   * Puts the page into "just answered" state: numpad dims/locks
   * again (still visible, not hidden), but the SAME button stays
   * enabled and relabels itself "Next" (see ui.js for the fuller
   * rationale). The plain input is swapped for the answerResult box
   * in the same spot, so the result shows there instead of pushing
   * new content further down the page.
   */
  function setAnswered() {
    elements.answerInput.hidden = true;
    elements.answerInput.disabled = true;
    elements.answerResult.hidden = false;
    elements.numpad.classList.add('numpad--disabled');
    elements.checkBtn.disabled = false;
    elements.checkBtn.textContent = '→';
    elements.checkBtn.setAttribute('aria-label', 'Next question');
  }

  /** Moves keyboard focus to the answer input (safe on mobile - see index.html/readonly). */
  function focusAnswerInput() {
    setTimeout(() => elements.answerInput.focus(), 0);
  }

  /**
   * Sets each square's label text and treble styling to match the
   * given throws. Call only once any flip-back animation has
   * finished, so new values never appear mid-spin.
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
   * back once it's safe to start the reveal sequence. See ui.js's
   * resetThrowSquares for the full rationale (avoids a flash of the
   * new values during the flip-back animation).
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
   * Renders a new question: resets the throw squares (deferring
   * the label swap past any flip-back animation) and resets the
   * input/feedback area. The answer input stays disabled - the
   * main script re-enables it once all 3 throws are revealed.
   * @param {{throws: {notation: string, value: number}[]}} question
   * @param {() => void} onReady - Called once squares are safely reset and ready to reveal.
   */
  function renderQuestion(question, onReady) {
    clearAnswer();
    setRevealing();

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

  // Event delegation: one listener for all number/backspace keys
  // (Check/Next is a real <button type="submit">, not a data-key -
  // see the HTML - so it's unaffected by this delegation and just
  // submits the form natively).
  elements.numpad.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-key]');
    if (!button) return;

    const key = button.dataset.key;
    if (key === 'backspace') removeLastDigit();
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
   * Renders the result of a checked answer as a darts "visit
   * recap": a headline (the correct total, always - even on a
   * wrong answer, since that's the number the player most needs to
   * read), a dimmed line underneath showing what the player
   * actually typed (only on a wrong answer), the visit's darts as
   * chips, and the visit time - see js/scoreResultUi.js for the
   * shared DOM-building helpers this delegates to. Practice mode
   * asks for the raw visit total, so that's what both the headline
   * and the wrong-answer comparison are anchored to (contrast with
   * ui.js's Track-mode version, which is anchored to the remaining
   * score instead, since that's what THAT mode asks for).
   * @param {boolean} wasCorrect
   * @param {{throws: {notation: string, value: number}[], visitScore: number}} question
   * @param {number} timeTakenSeconds
   * @param {string} userAnswer - The raw string the player submitted (only shown when wasCorrect is false).
   */
  function renderFeedback(wasCorrect, question, timeTakenSeconds, userAnswer) {
    const {
      renderHeadline, renderUserAnswer, hideUserAnswer, renderDartsRow,
      isMaximumVisit, appendMaximumBadge, formatVisitTime,
    } = window.DartsTrainer.scoreResultUi;

    const isMaximum = isMaximumVisit(question);

    let className = wasCorrect
      ? 'answer-result answer-result--correct'
      : 'answer-result answer-result--incorrect';
    if (isMaximum) className += ' answer-result--maximum';
    // The correct-flash animation is layered on only for a correct
    // answer (see the file header + task: no scale/flash on wrong
    // answers) - a separate class rather than folding into
    // --correct so a re-render (e.g. immediately re-showing this
    // same box) can still re-trigger the animation deliberately if
    // ever needed, without it being implied by every correct state.
    if (wasCorrect) className += ' answer-result--correct-flash';
    elements.answerResult.className = className;

    renderHeadline(elements.feedbackResult, {
      wasCorrect,
      correctValue: question.visitScore,
      correctUnitLabel: 'SCORED',
      incorrectUnitLabel: 'Actual Visit:',
    });
    if (isMaximum) appendMaximumBadge(elements.feedbackResult);

    if (wasCorrect) hideUserAnswer(elements.feedbackUserAnswer);
    else renderUserAnswer(elements.feedbackUserAnswer, userAnswer);

    renderDartsRow(elements.feedbackDarts, question.throws);

    elements.feedbackTime.textContent = formatVisitTime(timeTakenSeconds);

    // Relabel the SAME Check button as "Next question" instead of
    // showing a separate button below (see ui.js for the rationale).
    setAnswered();

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

    // Session streak: how many correct answers in a row right now.
    // Resets to 0 the moment a wrong answer breaks it (see stats.js).
    elements.statStreak.textContent = stats.currentStreak;
  }

  window.DartsTrainer.practiceUi = {
    elements,
    renderQuestion,
    revealThrowSquare,
    enableAnswerInput,
    renderFeedback,
    renderStats,
    focusAnswerInput,
    FLIP_TRANSITION_MS,
  };
})();
