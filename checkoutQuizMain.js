/**
 * checkoutQuizMain.js
 * ---------------------------------------------------------
 * Entry point for the 1-Dart Checkout Quiz. Simpler flow than
 * the counting games: there's no throw-reveal animation, so the
 * timer starts the moment a new question is shown rather than
 * after a delayed reveal. Otherwise follows the same pattern as
 * practiceMain.js - generate -> time -> check -> stats - with
 * the Check button doubling as "Next question" once answered.
 * ---------------------------------------------------------
 */
(function () {
  const missing = [];
  if (!window.DartsTrainer) missing.push('all js/*.js files (window.DartsTrainer is undefined)');
  else {
    if (!window.DartsTrainer.Stopwatch) missing.push('js/timer.js');
    if (!window.DartsTrainer.StatsTracker) missing.push('js/stats.js');
    if (!window.DartsTrainer.lifetimeStats) missing.push('js/lifetimeStats.js');
    if (!window.DartsTrainer.checkoutEngine) missing.push('js/checkoutEngine.js');
    if (!window.DartsTrainer.checkoutQuizEngine) missing.push('js/checkoutQuizEngine.js');
    if (!window.DartsTrainer.checkoutQuizUi) missing.push('js/checkoutQuizUi.js');
  }

  if (missing.length > 0) {
    const message =
      'Checkout Quiz failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to this page.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const { StatsTracker, Stopwatch, lifetimeStats, checkoutQuizEngine, checkoutQuizUi } = window.DartsTrainer;
  const { elements, renderQuestion, renderFeedback, renderStats } = checkoutQuizUi;

  const LIFETIME_STATS_MODE_ID = 'checkoutQuiz1Dart';

  // --- App state ---
  const stats = new StatsTracker();
  const stopwatch = new Stopwatch();
  let currentQuestion = null;
  let hasAnsweredCurrentQuestion = false;

  /** Starts a fresh question and starts the timer immediately - no reveal delay here. */
  function startNewQuestion() {
    currentQuestion = checkoutQuizEngine.generateQuestion();
    hasAnsweredCurrentQuestion = false;

    renderQuestion(currentQuestion);
    stopwatch.start();
  }

  /** Handles the user submitting an answer for the current question. */
  function handleAnswerSubmit(event) {
    event.preventDefault();

    // If already answered, Enter/Check acts as "next question" instead.
    if (hasAnsweredCurrentQuestion) {
      startNewQuestion();
      return;
    }

    const rawValue = elements.answerInput.value.trim();
    if (rawValue === '') return; // ignore empty submissions

    const timeTakenSeconds = stopwatch.elapsedSeconds();
    const wasCorrect = checkoutQuizEngine.checkAnswer(currentQuestion.correctNotation, rawValue);

    stats.recordAnswer(wasCorrect, timeTakenSeconds);
    lifetimeStats.recordAnswer(LIFETIME_STATS_MODE_ID, wasCorrect, timeTakenSeconds);
    if (wasCorrect) lifetimeStats.recordStreakProgress(LIFETIME_STATS_MODE_ID, stats.currentStreak);
    renderStats(stats);
    renderFeedback(wasCorrect, currentQuestion, timeTakenSeconds);

    hasAnsweredCurrentQuestion = true;
  }

  // --- Event wiring ---
  elements.answerForm.addEventListener('submit', handleAnswerSubmit);

  // --- Boot ---
  renderStats(stats);
  startNewQuestion();
})();
