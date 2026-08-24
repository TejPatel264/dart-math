/**
 * streakMain.js
 * ---------------------------------------------------------
 * Entry point for Beat the Referee (streak-practice.html). Same
 * generate -> reveal -> time -> check -> stats flow as
 * practiceMain.js, with these differences:
 *
 *   1. Each question carries its own independent countdown, which
 *      only starts once the final throw's flip animation has
 *      actually finished (not just started) - same timing
 *      practiceMain.js already uses for enabling the answer input,
 *      just also feeding the countdown now. The time limit itself
 *      shrinks as the run goes on - see js/streakTiming.js for the
 *      exact curve - so it's looked up fresh every question rather
 *      than being a fixed constant.
 *   2. A correct answer doesn't show the calculation or wait for a
 *      Next tap. The streak stat flashes/zooms instead, there's a
 *      brief fixed pause, then the next question loads on its own
 *      - answering correctly is meant to feel fast and continuous,
 *      not stop to review something the player already knows they
 *      got right.
 *   3. A wrong answer - or the countdown reaching zero - ends the
 *      run immediately. Both endings show the calculation for the
 *      question in progress (same answer-result box Unlimited
 *      practice uses) - "Not quite" with what was submitted for a
 *      wrong answer, "Time's up" with no submission for a timeout -
 *      since either way the player will want to see what the
 *      actual total was, not just on one of the two endings.
 *   4. The countdown pauses the moment an answer is checked (right
 *      or wrong) and resumes fresh (at that question's own time
 *      limit) for the next question, rather than continuing to run
 *      during the pause/feedback - so neither the flash-pause nor
 *      reading a wrong answer's calculation ever eats into the
 *      next question's time.
 *   5. There are two separate, differently-scoped tallies on
 *      screen: the live [Target | Streak | Timer] display tracks
 *      only the CURRENT run and resets every Play Again, while the
 *      stats bar's Best/Avg Time/Accuracy are scoped to every run
 *      played TODAY (see js/streakDailyStats.js) and persist across
 *      Play Again and page reloads, only rolling over at midnight.
 *      StatsTracker (stats.js) is still used, but purely as the
 *      simplest way to track "how many correct in a row right now"
 *      - its own questionsAnswered/accuracy fields go unused here,
 *      since those are exactly what the daily stats now own.
 *   6. Every run opens against a target - "the referee's score" -
 *      sampled from js/refereeTarget.js around the player's
 *      all-time best streak in this mode. The first 3 seconds show
 *      that target full-focus ("The referee got X. Can you beat
 *      it?"); it then settles into the compact Target cell in the
 *      live display, and the run itself doesn't actually start
 *      (throws/reveal/countdown) until that intro has played out.
 *      When the run ends, the final streak is compared against the
 *      target to report a win, draw, or loss, and by how much.
 * ---------------------------------------------------------
 */
(function () {
  const missing = [];
  if (!window.DartsTrainer) missing.push('all js/*.js files (window.DartsTrainer is undefined)');
  else {
    if (!window.DartsTrainer.random) missing.push('js/random.js');
    if (!window.DartsTrainer.Stopwatch) missing.push('js/timer.js');
    if (!window.DartsTrainer.CountdownTimer) missing.push('js/countdownTimer.js');
    if (!window.DartsTrainer.streakTiming) missing.push('js/streakTiming.js');
    if (!window.DartsTrainer.streakDailyStats) missing.push('js/streakDailyStats.js');
    if (!window.DartsTrainer.refereeTarget) missing.push('js/refereeTarget.js');
    if (!window.DartsTrainer.aimData) missing.push('js/aimData.js');
    if (!window.DartsTrainer.aimModel) missing.push('js/aimModel.js');
    if (!window.DartsTrainer.revealSequence) missing.push('js/revealSequence.js');
    if (!window.DartsTrainer.gameEngine) missing.push('js/gameEngine.js');
    if (!window.DartsTrainer.StatsTracker) missing.push('js/stats.js');
    if (!window.DartsTrainer.lifetimeStats) missing.push('js/lifetimeStats.js');
    if (!window.DartsTrainer.streakUi) missing.push('js/streakUi.js');
  }

  if (missing.length > 0) {
    const message =
      'Beat the Referee failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to this page.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const {
    gameEngine, StatsTracker, Stopwatch, CountdownTimer, streakUi, streakTiming,
    streakDailyStats, refereeTarget, revealSequence, lifetimeStats,
  } = window.DartsTrainer;
  const {
    elements, renderQuestion, revealThrowSquare, enableAnswerInput, markCorrect, renderEndingCalculation,
    flashStreak, renderCurrentStreak, renderTarget, showRefereeIntro, hideRefereeIntro, renderDailyStats,
    renderCountdown, setCountdownPaused, showStreakOver, hideStreakOver, FLIP_TRANSITION_MS,
  } = streakUi;

  const MODE_ID = 'streakPractice';

  // Pause between a correct answer and the next question loading -
  // just long enough for the streak flash (also 0.5s, see
  // stat-value-flash in styles.css) to fully play out.
  const CORRECT_ANSWER_PAUSE_MS = 500;

  // How long the full-focus referee intro is shown before settling
  // into the compact Target cell and starting the run for real.
  const REFEREE_INTRO_MS = 3000;

  // --- App state ---
  const stats = new StatsTracker(); // current-run streak tracking only - see file header
  const stopwatch = new Stopwatch();
  let currentQuestion = null;
  let currentQuestionNumber = 0; // 1-indexed position within this run, drives streakTiming
  let currentTarget = 0; // this run's referee target - sampled once per run, see startRun
  let isRunOver = false;
  let cancelCurrentReveal = null; // cancels pending reveal timers, if any
  let pendingStartTimer = null; // cancels a queued "start clock after flip finishes" call, if any
  let pendingAdvanceTimer = null; // cancels a queued "advance to next question" call, if any
  let pendingIntroTimer = null; // cancels a queued "intro finished, start the run" call, if any

  const countdown = new CountdownTimer({
    durationSeconds: streakTiming.secondsForQuestion(1),
    onTick: renderCountdown,
    onExpire: () => {
      // Timeout: no answer was ever submitted, so there's no
      // "wrong value" to show - just the calculation for what the
      // total actually was (see renderEndingCalculation's
      // timeTakenSeconds-omitted branch for the "Time's up" wording).
      // It still counts as an answered-but-wrong question for
      // today's Accuracy/Avg Time - running out the clock is a
      // failure to answer in time, not a non-event accuracy should
      // just ignore. The full time limit is recorded as the time
      // taken, since that's genuinely how long the player had.
      //
      // streakGoingIn is captured BEFORE recordAnswer, since
      // recording a wrong answer resets stats.currentStreak to 0 as
      // part of that call - this is the streak the player actually
      // reached going into the question that timed out (see
      // handleAnswerSubmit's identical pattern for the wrong-answer
      // path).
      const streakGoingIn = stats.currentStreak;
      const timeTakenSeconds = streakTiming.secondsForQuestion(currentQuestionNumber);
      stats.recordAnswer(false, timeTakenSeconds);
      streakDailyStats.recordAnswer(false, timeTakenSeconds);
      lifetimeStats.recordAnswer(MODE_ID, false, timeTakenSeconds);
      refreshDailyStats();

      renderEndingCalculation(currentQuestion);
      endRun(streakGoingIn);
    },
  });

  /** Re-reads today's totals from storage and refreshes the stats bar. */
  function refreshDailyStats() {
    renderDailyStats(
      streakDailyStats.getToday(),
      streakDailyStats.getAverageTimeSeconds(),
      streakDailyStats.getAccuracyPercent()
    );
  }

  /**
   * Begins a run: samples a fresh target from the player's all-time
   * best streak, shows the full-focus referee intro for
   * REFEREE_INTRO_MS, then settles the target into the live display
   * and starts the first question. Questions/reveal/countdown don't
   * begin until the intro has actually finished - the run hasn't
   * "started" yet while the player is still reading who they're up
   * against.
   */
  function startRun() {
    if (pendingIntroTimer) clearTimeout(pendingIntroTimer);

    const bestStreak = lifetimeStats.getModeStats(MODE_ID).bestStreak;
    currentTarget = refereeTarget.sampleTarget(bestStreak);

    showRefereeIntro(currentTarget);
    pendingIntroTimer = setTimeout(() => {
      hideRefereeIntro();
      renderTarget(currentTarget);
      startNewQuestion();
    }, REFEREE_INTRO_MS);
  }

  /**
   * Starts a fresh question: generates 3 throws, renders the
   * face-down squares, then reveals each one in turn. Both the
   * answer input and the countdown stay off until the final throw's
   * flip animation has actually finished playing - the question
   * isn't "askable" yet while a card is still mid-flip, so starting
   * the clock any earlier would cost the player thinking time they
   * never actually had a chance to use.
   */
  function startNewQuestion() {
    if (cancelCurrentReveal) cancelCurrentReveal();
    if (pendingStartTimer) clearTimeout(pendingStartTimer);
    if (pendingAdvanceTimer) clearTimeout(pendingAdvanceTimer);

    currentQuestionNumber += 1;
    currentQuestion = gameEngine.generateThrowsOnly();

    renderQuestion(currentQuestion, () => {
      cancelCurrentReveal = revealSequence(currentQuestion.throws, {
        onReveal: (throwItem, index) => revealThrowSquare(index),
        onComplete: () => {
          pendingStartTimer = setTimeout(() => {
            stopwatch.start();
            enableAnswerInput();
            countdown.start(streakTiming.secondsForQuestion(currentQuestionNumber));
            setCountdownPaused(false);
          }, FLIP_TRANSITION_MS);
        },
      });
    });
  }

  /**
   * Ends the run: freezes the countdown, records the final streak
   * against both today's and the lifetime best, and shows the
   * streak-over screen (including the win/draw/loss result against
   * this run's referee target).
   * @param {number} [streakOverride] - The streak actually reached,
   *   for the wrong-answer path where stats.currentStreak has
   *   already been reset to 0 by the time this runs (see
   *   handleAnswerSubmit). Omitted on timeout, where nothing has
   *   reset the streak yet, so stats.currentStreak is still correct.
   */
  function endRun(streakOverride) {
    if (isRunOver) return;
    isRunOver = true;

    countdown.stop();
    if (cancelCurrentReveal) cancelCurrentReveal();
    if (pendingStartTimer) clearTimeout(pendingStartTimer);
    if (pendingAdvanceTimer) clearTimeout(pendingAdvanceTimer);
    if (pendingIntroTimer) clearTimeout(pendingIntroTimer);

    const finalStreak = streakOverride !== undefined ? streakOverride : stats.currentStreak;
    const isNewBest = finalStreak > 0 && finalStreak >= streakDailyStats.getToday().bestStreak;
    if (finalStreak > 0) {
      streakDailyStats.recordStreakProgress(finalStreak);
      lifetimeStats.recordStreakProgress(MODE_ID, finalStreak);
      refreshDailyStats();
    }

    showStreakOver({
      finalStreak,
      questionsAnswered: stats.questionsAnswered,
      isNewBest,
      target: currentTarget,
    });
  }

  /**
   * Resets the current run back to a clean slate and starts a new
   * one (a fresh target, a fresh referee intro, everything). Today's
   * Best/Avg Time/Accuracy are untouched - they only change as
   * questions get answered, not on Play Again itself (see
   * js/streakDailyStats.js).
   */
  function playAgain() {
    isRunOver = false;
    currentQuestionNumber = 0;
    stats.reset();
    renderCurrentStreak(stats.currentStreak);
    hideStreakOver();
    startRun();
  }

  /** Handles the user submitting an answer for the current question. */
  function handleAnswerSubmit(event) {
    event.preventDefault();
    if (isRunOver) return;

    const rawValue = elements.answerInput.value.trim();
    if (rawValue === '') return; // ignore empty submissions

    const timeTakenSeconds = stopwatch.elapsedSeconds();
    const wasCorrect = gameEngine.checkAnswer(currentQuestion.visitScore, rawValue);

    // Pause the clock the instant an answer's been checked - right
    // or wrong, the player shouldn't lose time to the brief pause
    // (correct) or reading the calculation (wrong) that follows.
    countdown.pause();
    setCountdownPaused(true);

    // Captured BEFORE recordAnswer, since a wrong answer resets
    // stats.currentStreak to 0 as part of that call - this is the
    // streak the player actually reached going into this question.
    const streakGoingIn = stats.currentStreak;

    stats.recordAnswer(wasCorrect, timeTakenSeconds);
    streakDailyStats.recordAnswer(wasCorrect, timeTakenSeconds);
    lifetimeStats.recordAnswer(MODE_ID, wasCorrect, timeTakenSeconds);
    refreshDailyStats();

    if (!wasCorrect) {
      renderEndingCalculation(currentQuestion, { timeTakenSeconds });
      endRun(streakGoingIn);
      return;
    }

    // Correct: update + flash the live streak number, then move
    // straight on to the next question after a short fixed pause -
    // no calculation, no button tap required (see the file header).
    renderCurrentStreak(stats.currentStreak);
    markCorrect();
    flashStreak();
    pendingAdvanceTimer = setTimeout(() => {
      if (isRunOver) return;
      startNewQuestion();
    }, CORRECT_ANSWER_PAUSE_MS);
  }

  // --- Event wiring ---
  elements.answerForm.addEventListener('submit', handleAnswerSubmit);
  elements.playAgainBtn.addEventListener('click', playAgain);

  // --- Boot ---
  renderCurrentStreak(stats.currentStreak);
  refreshDailyStats();
  startRun();
})();
