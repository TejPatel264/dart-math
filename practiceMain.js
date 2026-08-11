/**
 * practiceMain.js
 * ---------------------------------------------------------
 * Entry point for the 3-Dart Practice page. Structurally the
 * same flow as the 3-dart game's main.js (generate -> reveal ->
 * time -> check -> stats), just simpler: there's no starting
 * score, so the question is just 3 throws, and the correct
 * answer is their raw sum rather than a subtraction from a leg
 * total. See main.js for the fuller explanation of this flow -
 * comments here focus on what's different.
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
    if (!window.DartsTrainer.lifetimeStats) missing.push('js/lifetimeStats.js');
    if (!window.DartsTrainer.practiceUi) missing.push('js/practiceUi.js');
  }

  if (missing.length > 0) {
    const message =
      '3-Dart Practice failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to this page.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const { gameEngine, StatsTracker, Stopwatch, practiceUi, revealSequence, lifetimeStats } = window.DartsTrainer;
  const { elements, renderQuestion, revealThrowSquare, enableAnswerInput, renderFeedback, renderStats, FLIP_TRANSITION_MS } = practiceUi;

  // --- App state ---
  const stats = new StatsTracker();
  const stopwatch = new Stopwatch();
  let currentQuestion = null;
  let hasAnsweredCurrentQuestion = false;
  let cancelCurrentReveal = null; // cancels pending reveal timers, if any
  let pendingStartTimer = null; // cancels a queued "start timer after flip finishes" call, if any

  /**
   * Starts a fresh question: generates 3 throws, renders the
   * face-down squares, then - once it's safe to do so - reveals
   * each throw one by one (2s apart). The answer input stays
   * disabled and the timer doesn't start until the final throw's
   * flip animation has actually finished playing (not just
   * started) - see main.js for the fuller rationale.
   */
  function startNewQuestion() {
    if (cancelCurrentReveal) cancelCurrentReveal();
    if (pendingStartTimer) clearTimeout(pendingStartTimer);

    currentQuestion = gameEngine.generateThrowsOnly();
    hasAnsweredCurrentQuestion = false;

    renderQuestion(currentQuestion, () => {
      cancelCurrentReveal = revealSequence(currentQuestion.throws, {
        onReveal: (throwItem, index) => revealThrowSquare(index),
        onComplete: () => {
          pendingStartTimer = setTimeout(() => {
            stopwatch.start();
            enableAnswerInput();
          }, FLIP_TRANSITION_MS);
        },
      });
    });
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
    // The correct answer in practice mode is simply the sum of the
    // 3 throws - there's no starting score to subtract from.
    const wasCorrect = gameEngine.checkAnswer(currentQuestion.visitScore, rawValue);

    stats.recordAnswer(wasCorrect, timeTakenSeconds);
    lifetimeStats.recordAnswer('practice', wasCorrect, timeTakenSeconds);
    if (wasCorrect) lifetimeStats.recordStreakProgress('practice', stats.currentStreak);
    renderStats(stats);
    renderFeedback(wasCorrect, currentQuestion, timeTakenSeconds);

    hasAnsweredCurrentQuestion = true;
  }

  // --- Event wiring ---
  // Note: no separate "Next question" click listener needed - the
  // Check button (relabelled by practiceUi.js's setAnswered) is the
  // same <button type="submit">, so clicking it after answering
  // fires the same 'submit' event that handleAnswerSubmit already
  // routes to startNewQuestion via hasAnsweredCurrentQuestion.
  elements.answerForm.addEventListener('submit', handleAnswerSubmit);

  // --- Boot ---
  renderStats(stats);
  startNewQuestion();
})();
