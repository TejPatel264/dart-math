/**
 * gameBoardUi.js
 * ---------------------------------------------------------
 * DOM layer for the "3-Dart Game (Dartboard)" page. Combines
 * ui.js's starting-score + addition/subtraction feedback with
 * practiceBoardUi.js's dartboard reveal - this page is really
 * the intersection of those two: same 501-style question as the
 * flip-square game, same board display as dartboard practice.
 *
 * Kept as its own file rather than adding more conditionals to
 * either sibling: see practiceBoardUi.js's header comment for the
 * fuller rationale on why these pages stay separate files.
 * Everything below the DOM layer (random, timer, aimData/
 * aimModel, revealSequence, gameEngine, stats, dartboard) is
 * fully shared, unchanged.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const MAX_ANSWER_DIGITS = 3; // scores never exceed 3 digits (max 500)
  const BOARD_SIZE = 190; // sane default; actual rendered size is controlled responsively via CSS clamp()

  // --- Element references, grabbed once ---
  const elements = {
    startingScore: document.getElementById('starting-score'),
    dartboardContainer: document.getElementById('dartboard-container'),

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

  // The board is built once and reused across questions - only the
  // dart markers on it change (see dartboard.js: clearDarts/placeDart).
  const board = window.DartsTrainer.dartboard.createBoard(elements.dartboardContainer, BOARD_SIZE);

  // Positions of the darts placed so far in the current question,
  // so each new dart can avoid landing on top of an earlier one.
  let placedPositions = [];

  /** Puts the page into "waiting for the reveal" state. */
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
   * Puts the page into "just answered" state: input/numpad lock
   * again, but the SAME button stays enabled and relabels itself
   * "Next question" (see ui.js for the fuller rationale).
   */
  function setAnswered() {
    elements.answerInput.disabled = true;
    elements.numpad.hidden = true;
    elements.checkBtn.disabled = false;
    elements.checkBtn.textContent = 'Next question →';
  }

  /** Moves keyboard focus to the answer input (safe on mobile - see index.html/readonly). */
  function focusAnswerInput() {
    setTimeout(() => elements.answerInput.focus(), 0);
  }

  /** Clears the answer input back to empty. */
  function clearAnswer() {
    elements.answerInput.value = '';
  }

  /**
   * Renders a new question: sets the starting score, clears any
   * darts left on the board from the previous question, and resets
   * the input/feedback area. The answer input stays disabled - the
   * main script re-enables it once all 3 darts have landed.
   * @param {{startingScore: number, throws: {notation: string, value: number}[]}} question
   * @param {() => void} onReady - Called once the board is cleared and ready for the next reveal sequence.
   */
  function renderQuestion(question, onReady) {
    elements.startingScore.textContent = question.startingScore;

    clearAnswer();
    setRevealing();
    elements.feedback.hidden = true;

    window.DartsTrainer.dartboard.clearDarts(board);
    placedPositions = [];

    if (onReady) onReady();
  }

  /**
   * Places one dart on the board for the given throw.
   * @param {{notation: string, value: number}} throwItem
   */
  function revealThrow(throwItem) {
    const position = window.DartsTrainer.dartboard.placeDart(board, throwItem.notation, placedPositions);
    placedPositions.push(position);
  }

  /** Enables the answer input once all 3 darts have landed, and focuses it. */
  function enableAnswerInput() {
    setReadyToAnswer();
    focusAnswerInput();
  }

  // --- Numpad / answer entry -------------------------------------
  // The answer input is `readonly` so mobile never shows a native
  // keyboard over it. All value changes go through these functions
  // instead, driven by either the on-screen numpad or a physical
  // keyboard (see the keydown listener further down).

  /**
   * Appends a digit to the answer input, ignoring the request if
   * the input is disabled (still waiting on the reveal) or already
   * at the max sensible length.
   * @param {string} digit - '0'-'9'
   */
  function appendDigit(digit) {
    if (elements.answerInput.disabled) return;
    if (elements.answerInput.value.length >= MAX_ANSWER_DIGITS) return;

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
   * Renders the result of a checked answer: both steps of the
   * mental maths (add the 3 throws, then subtract from the
   * starting score), same as the flip-square game.
   * @param {boolean} wasCorrect
   * @param {{throws: {notation: string, value: number}[], visitScore: number, remainingScore: number, startingScore: number}} question
   * @param {number} timeTakenSeconds
   */
  function renderFeedback(wasCorrect, question, timeTakenSeconds) {
    elements.feedback.hidden = false;

    elements.feedbackResult.textContent = wasCorrect ? 'Correct!' : 'Not quite';
    elements.feedbackResult.className = wasCorrect
      ? 'feedback__result feedback__result--correct'
      : 'feedback__result feedback__result--incorrect';

    const sumLine = question.throws.map((t) => `${t.notation} (${t.value})`).join(' + ');
    elements.feedbackAddition.textContent = `${sumLine} = ${question.visitScore}`;
    elements.feedbackSubtraction.textContent =
      `${question.startingScore} − ${question.visitScore} = ${question.remainingScore}`;

    elements.feedbackTime.textContent = `Answered in ${timeTakenSeconds.toFixed(2)}s`;

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
  }

  window.DartsTrainer.gameBoardUi = {
    elements,
    renderQuestion,
    revealThrow,
    enableAnswerInput,
    renderFeedback,
    renderStats,
    focusAnswerInput,
  };
})();
