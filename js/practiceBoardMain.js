/**
 * practiceBoardMain.js
 * ---------------------------------------------------------
 * Entry point for the "3-Dart Practice (Dartboard)" page. Same
 * generate -> reveal -> time -> check -> stats flow as
 * practiceMain.js; the only real difference is *what* gets
 * revealed each step - a dart landing on the board (needs the
 * throw's notation to know where) rather than a card flip (only
 * needs an index).
 * ---------------------------------------------------------
 */
(function () {
  // Defensive check: if any file failed to load (e.g. a broken path
  // after moving/downloading files), fail loudly with a clear
  // message instead of silently doing nothing.
  const missing = [];
  if (!window.DartsTrainer) missing.push('all js/*.js files (window.DartsTrainer is undefined)');
  else {
    if (!window.DartsTrainer.random) missing.push('js/random.js');
    if (!window.DartsTrainer.Stopwatch) missing.push('js/timer.js');
    if (!window.DartsTrainer.aimData) missing.push('js/aimData.js');
    if (!window.DartsTrainer.aimModel) missing.push('js/aimModel.js');
    if (!window.DartsTrainer.revealSequence) missing.push('js/revealSequence.js');
    if (!window.DartsTrainer.gameEngine) missing.push('js/gameEngine.js');
    if (!window.DartsTrainer.StatsTracker) missing.push('js/stats.js');
    if (!window.DartsTrainer.dartboard) missing.push('js/dartboard.js');
    if (!window.DartsTrainer.practiceBoardUi) missing.push('js/practiceBoardUi.js');
  }

  if (missing.length > 0) {
    const message =
      '3-Dart Practice (Dartboard) failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to this page.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const { gameEngine, StatsTracker, Stopwatch, practiceBoardUi, revealSequence } = window.DartsTrainer;
  const { elements, renderQuestion, revealThrow, enableAnswerInput, renderFeedback, renderStats } = practiceBoardUi;

  // --- App state ---
  const stats = new StatsTracker();
  const stopwatch = new Stopwatch();
  let currentQuestion = null;
  let hasAnsweredCurrentQuestion = false;
  let cancelCurrentReveal = null; // cancels pending reveal timers, if any

  /**
   * Starts a fresh question: generates 3 throws, clears the board,
   * then reveals each dart landing one by one (2s apart). The
   * answer input stays disabled and the timer doesn't start until
   * all 3 darts have landed.
   */
  function startNewQuestion() {
    if (cancelCurrentReveal) cancelCurrentReveal();

    currentQuestion = gameEngine.generateThrowsOnly();
    hasAnsweredCurrentQuestion = false;

    renderQuestion(currentQuestion, () => {
      cancelCurrentReveal = revealSequence(currentQuestion.throws, {
        onReveal: (throwItem) => revealThrow(throwItem),
        onComplete: () => {
          // Timer starts the moment the 3rd (final) dart lands.
          stopwatch.start();
          enableAnswerInput();
        },
      });
    });
  }

  /** Handles the user submitting an answer for the current question. */
  function handleAnswerSubmit(event) {
    event.preventDefault();

    if (hasAnsweredCurrentQuestion) {
      startNewQuestion();
      return;
    }

    const rawValue = elements.answerInput.value.trim();
    if (rawValue === '') return;

    const timeTakenSeconds = stopwatch.elapsedSeconds();
    const wasCorrect = gameEngine.checkAnswer(currentQuestion.visitScore, rawValue);

    stats.recordAnswer(wasCorrect, timeTakenSeconds);
    renderStats(stats);
    renderFeedback(wasCorrect, currentQuestion, timeTakenSeconds);

    hasAnsweredCurrentQuestion = true;
  }

  /** Resets all session statistics back to zero. */
  function handleResetStats() {
    stats.reset();
    renderStats(stats);
  }

  // --- Event wiring ---
  // Note: no separate "Next question" click listener needed - see
  // main.js for why the same Check button already covers both cases.
  elements.answerForm.addEventListener('submit', handleAnswerSubmit);
  elements.resetStatsBtn.addEventListener('click', handleResetStats);

  // --- Boot ---
  renderStats(stats);
  startNewQuestion();
})();
