/**
 * main.js
 * ---------------------------------------------------------
 * Entry point for the Dart Maths Trainer. Wires together the
 * game engine (question generation/checking), the reveal
 * sequencer, the stopwatch, the stats tracker, and the UI
 * rendering functions.
 *
 * This file owns the *flow* of the app (what happens on
 * submit, what happens on "next", when the 3 throws reveal and
 * when the timer starts), while each imported module owns its
 * own concern. New modes later (checkout trainer, timed mode,
 * difficulty levels) can follow this same pattern: a small
 * main-*.js that composes the same building blocks.
 *
 * Loaded last (after all other js/*.js files) so that
 * window.DartsTrainer already has everything it needs attached.
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
    if (!window.DartsTrainer.scoreResultUi) missing.push('js/scoreResultUi.js');
    if (!window.DartsTrainer.ui) missing.push('js/ui.js');
  }

  if (missing.length > 0) {
    const message =
      'Dart Maths Trainer failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to index.html.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const { gameEngine, StatsTracker, Stopwatch, ui, revealSequence, lifetimeStats } = window.DartsTrainer;
  const { elements, renderQuestion, revealThrowSquare, enableAnswerInput, renderFeedback, renderStats, FLIP_TRANSITION_MS } = ui;

  // --- App state ---
  const stats = new StatsTracker();
  const stopwatch = new Stopwatch();
  let currentQuestion = null;
  let hasAnsweredCurrentQuestion = false;
  let cancelCurrentReveal = null; // cancels pending reveal timers, if any
  let pendingStartTimer = null; // cancels a queued "start timer after flip finishes" call, if any

  /**
   * Starts a fresh question: generates it, renders the starting
   * score and face-down throw squares, then - once it's safe to do
   * so (see renderQuestion/resetThrowSquares in ui.js) - reveals
   * each throw one by one (2s apart). The answer input stays
   * disabled and the timer doesn't start until the final throw's
   * flip animation has actually finished playing (not just
   * started) - otherwise the player is charged for time they spent
   * watching the card turn rather than reading/solving the question.
   */
  function startNewQuestion() {
    if (cancelCurrentReveal) cancelCurrentReveal();
    if (pendingStartTimer) clearTimeout(pendingStartTimer);

    currentQuestion = gameEngine.generateQuestion();
    hasAnsweredCurrentQuestion = false;

    renderQuestion(currentQuestion, () => {
      cancelCurrentReveal = revealSequence(currentQuestion.throws, {
        onReveal: (throwItem, index) => revealThrowSquare(index),
        onComplete: () => {
          // The final square has just started flipping - wait for
          // that flip to actually finish (same duration as the CSS
          // transition) before starting the clock or letting the
          // player answer, so the reveal animation itself doesn't
          // eat into their solving time.
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
    const wasCorrect = gameEngine.checkAnswer(currentQuestion.remainingScore, rawValue);

    stats.recordAnswer(wasCorrect, timeTakenSeconds);
    lifetimeStats.recordAnswer('game', wasCorrect, timeTakenSeconds);
    if (wasCorrect) lifetimeStats.recordStreakProgress('game', stats.currentStreak);
    renderStats(stats);
    renderFeedback(wasCorrect, currentQuestion, timeTakenSeconds, rawValue);

    hasAnsweredCurrentQuestion = true;
  }

  // --- Event wiring ---
  // Note: no separate "Next question" click listener needed - the
  // Check button (relabelled by ui.js's setAnswered) is the same
  // <button type="submit">, so clicking it after answering fires
  // the same 'submit' event, which handleAnswerSubmit's
  // hasAnsweredCurrentQuestion branch already routes to startNewQuestion.
  elements.answerForm.addEventListener('submit', handleAnswerSubmit);

  // --- Boot ---
  renderStats(stats);
  startNewQuestion();
})();
