/**
 * streakUi.js
 * ---------------------------------------------------------
 * DOM layer for Streak mode (streak-practice.html). A sibling of
 * practiceUi.js with the same throw-squares/answer-form/numpad
 * plumbing, plus what Unlimited practice doesn't need: a live
 * [Streak | Timer] display above the throw squares, a today-
 * scoped stats bar (Best/Avg Time/Accuracy), and a full-card "run
 * over" screen. Kept as its own file rather than branching
 * practiceUi.js on "which mode am I", for the same reason
 * practiceUi.js is its own file rather than branching ui.js - the
 * two DOMs genuinely differ enough that one file with conditionals
 * everywhere would be harder to follow than two plain ones.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const THROW_SQUARE_COUNT = 3;
  const MAX_ANSWER_DIGITS = 3; // a 3-dart visit tops out at 180 (T20+T20+T20)

  // Must match the CSS transition duration on .throw-square__inner (see styles.css).
  const FLIP_TRANSITION_MS = 300;

  // Below this many seconds remaining, the countdown switches to
  // its "urgent" red styling - see .streak-live--urgent in styles.css.
  const URGENT_THRESHOLD_SECONDS = 3;

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
    feedbackWorking: document.getElementById('feedback-working'),
    feedbackTime: document.getElementById('feedback-time'),

    statBest: document.getElementById('stat-best'),
    statAvgTime: document.getElementById('stat-avg-time'),
    statAccuracy: document.getElementById('stat-accuracy'),

    statStreak: document.getElementById('stat-streak'),
    statTarget: document.getElementById('stat-target'),
    streakTimer: document.getElementById('streak-timer'),
    streakTimerValue: document.getElementById('streak-timer-value'),

    refereeIntro: document.getElementById('referee-intro'),
    refereeIntroTarget: document.getElementById('referee-intro-target'),

    trainerCard: document.getElementById('trainer-card'),
    streakOver: document.getElementById('streak-over'),
    streakOverValue: document.getElementById('streak-over-value'),
    streakOverDetail: document.getElementById('streak-over-detail'),
    streakOverRefereeResult: document.getElementById('streak-over-referee-result'),
    playAgainBtn: document.getElementById('play-again-btn'),
  };

  /** Puts the page into "waiting for the reveal" state. The live Target/Streak/Timer row stays visible throughout a run - see showRefereeIntro/showStreakOver for the only two places it's actually hidden. */
  function setRevealing() {
    elements.answerInput.hidden = false;
    elements.answerInput.disabled = true;
    elements.answerResult.hidden = true;
    elements.numpad.classList.add('numpad--disabled');
    elements.checkBtn.disabled = true;
    elements.checkBtn.textContent = '✓';
    elements.checkBtn.setAttribute('aria-label', 'Check answer');
  }

  /** Puts the page into "ready to answer" state once the reveal finishes and the countdown starts. */
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
   * Puts the page into "just answered correctly, pausing before
   * the next question" state. Unlike Unlimited practice, this
   * doesn't show the calculation or wait for a Next tap - the
   * numpad and input just go quiet for the brief pause (see
   * js/streakMain.js) while the streak number flashes instead.
   */
  function setAnswered() {
    elements.answerInput.hidden = false;
    elements.answerInput.disabled = true;
    elements.answerResult.hidden = true;
    elements.numpad.classList.add('numpad--disabled');
    elements.checkBtn.disabled = true;
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
  function clearAnswer() {
    elements.answerInput.value = '';
  }

  function appendDigit(digit) {
    if (elements.answerInput.disabled) return;
    if (elements.answerInput.value.length >= MAX_ANSWER_DIGITS) return;
    const next = (elements.answerInput.value + digit).replace(/^0+(?=\d)/, '');
    elements.answerInput.value = next;
  }

  function removeLastDigit() {
    if (elements.answerInput.disabled) return;
    elements.answerInput.value = elements.answerInput.value.slice(0, -1);
  }

  elements.numpad.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-key]');
    if (!button) return;
    const key = button.dataset.key;
    if (key === 'backspace') removeLastDigit();
    else appendDigit(key);
  });

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
   * Puts the UI into its brief "correct, pausing before next
   * question" state - no calculation or headline shown (see
   * setAnswered's doc comment above). Streak mode only ever calls
   * this on a correct answer; a wrong one calls renderIncorrect
   * instead (see js/streakMain.js).
   */
  function markCorrect() {
    setAnswered();
  }

  /**
   * Renders the calculation/working for the question that just
   * ended the run - shown for BOTH ways a run can end (a wrong
   * answer, or the countdown reaching zero), so the player always
   * gets to see what the actual total was, not just on one of the
   * two paths. Left in place (not hidden) once showStreakOver runs
   * immediately after - see js/streakMain.js.
   * @param {{throws: {notation: string, value: number}[], visitScore: number}} question
   * @param {Object} [options]
   * @param {number} [options.timeTakenSeconds] - Omitted on a timeout, since
   *   nothing was ever submitted for "answered in Xs" to describe.
   */
  function renderEndingCalculation(question, { timeTakenSeconds } = {}) {
    elements.answerInput.hidden = true;
    elements.answerResult.className = 'answer-result answer-result--incorrect answer-result--compact';
    elements.feedbackResult.textContent = timeTakenSeconds === undefined ? "Time's up" : 'Not quite';

    const sumLine = question.throws
      .map((t) => (/^\d+$/.test(t.notation) ? t.notation : `${t.notation} (${t.value})`))
      .join(' + ');
    elements.feedbackWorking.textContent = `${sumLine} = ${question.visitScore}`;

    // Omitted entirely (not just left blank) on a timeout - an
    // empty <p> still claims a line's worth of height, which works
    // against fitting the whole end-of-run screen on one page (see
    // js/streakMain.js / showStreakOver).
    elements.feedbackTime.hidden = timeTakenSeconds === undefined;
    elements.feedbackTime.textContent = timeTakenSeconds === undefined ? '' : `Answered in ${timeTakenSeconds.toFixed(2)}s`;

    elements.answerResult.hidden = false;
  }

  /**
   * Flashes the streak stat: removing then re-adding the animation
   * class (rather than just adding it) forces the browser to
   * restart the @keyframes from scratch even if the previous
   * flash's animation is still finishing - otherwise back-to-back
   * correct answers within the same 0.5s pause window could shrink
   * or skip the animation on the second one. A reflow between the
   * remove and re-add is what makes the restart actually take
   * effect (see the MDN "restart a CSS animation" pattern).
   */
  function flashStreak() {
    elements.statStreak.classList.remove('stat__value--flash');
    void elements.statStreak.offsetWidth; // force reflow
    elements.statStreak.classList.add('stat__value--flash');
  }

  /**
   * Updates the current-run streak number (the live [Target |
   * Streak | Timer] display above the throw squares) - separate
   * from renderStats, since this changes every question while the
   * stats bar below only changes on a correct/incorrect answer
   * being recorded for the day.
   * @param {number} streak
   */
  function renderCurrentStreak(streak) {
    elements.statStreak.textContent = streak;
  }

  /**
   * Sets the Target cell's value in the live [Target | Streak |
   * Timer] display. Called once per run (the target doesn't
   * change mid-run), separately from showRefereeIntro since the
   * intro and the settled Target cell are populated at different
   * points - see js/streakMain.js.
   * @param {number} target
   */
  function renderTarget(target) {
    elements.statTarget.textContent = target;
  }

  /**
   * Shows the full-focus "The referee got X. Can you beat it?"
   * intro in place of the throws/prompt, for the first few seconds
   * of a run - see js/streakMain.js for the timing. The live
   * Target/Streak/Timer row stays hidden until hideRefereeIntro -
   * it has nothing settled to show yet.
   * @param {number} target
   */
  function showRefereeIntro(target) {
    elements.refereeIntroTarget.textContent = target;
    elements.refereeIntro.hidden = false;
    elements.streakTimer.hidden = true;
    document.querySelector('.throws').hidden = true;
    document.querySelector('.prompt').hidden = true;
  }

  /**
   * Swaps the referee intro back out for the normal throws/prompt
   * layout, and reveals the live Target/Streak/Timer row - from
   * here on it stays visible for the rest of the run (see
   * setRevealing/setReadyToAnswer, neither of which touch it any
   * more), only hiding again once the run ends (showStreakOver) or
   * a new one's intro begins (showRefereeIntro above).
   */
  function hideRefereeIntro() {
    elements.refereeIntro.hidden = true;
    elements.streakTimer.hidden = false;
    document.querySelector('.throws').hidden = false;
    document.querySelector('.prompt').hidden = false;
  }

  /**
   * Updates the stats bar with today's Best/Avg Time/Accuracy -
   * scoped to every run played today, not the current run, so
   * Play Again and page reloads don't reset it (see
   * js/streakDailyStats.js).
   * @param {{bestStreak: number, questionsAnswered: number}} daily - from streakDailyStats.getToday()
   * @param {number|null} avgTimeSeconds - from streakDailyStats.getAverageTimeSeconds()
   * @param {number|null} accuracyPercent - from streakDailyStats.getAccuracyPercent()
   */
  function renderDailyStats(daily, avgTimeSeconds, accuracyPercent) {
    elements.statBest.textContent = daily.bestStreak;
    elements.statAvgTime.textContent = avgTimeSeconds === null ? '—' : `${avgTimeSeconds.toFixed(1)}s`;
    elements.statAccuracy.textContent = accuracyPercent === null ? '—' : `${accuracyPercent.toFixed(0)}%`;
  }

  /**
   * Updates the countdown display to the given value (already
   * rounded up to one decimal place by CountdownTimer), toggling
   * the urgent (red) styling once it drops low enough. Always
   * shown with exactly one decimal - toFixed(1) rather than trusting
   * the incoming number's own formatting, since a whole-second value
   * like 9 needs to render as "9.0" to match every other tick.
   * @param {number} secondsRemaining
   */
  function renderCountdown(secondsRemaining) {
    elements.streakTimerValue.textContent = secondsRemaining.toFixed(1);
    elements.streakTimer.classList.toggle('streak-live--urgent', secondsRemaining <= URGENT_THRESHOLD_SECONDS);
  }

  /** Marks the countdown as paused (dimmed) - called while an answer's result is on screen. */
  function setCountdownPaused(isPaused) {
    elements.streakTimer.classList.toggle('streak-live--paused', isPaused);
  }

  /**
   * Replaces the throws/prompt/numpad with the run-over screen:
   * final streak, a short detail line, the result against the
   * referee's target, and Play Again. The answer result box is
   * deliberately left alone here (not hidden) - by this point
   * renderEndingCalculation has already populated it (on both the
   * wrong-answer AND timeout paths - see js/streakMain.js), and
   * it's meant to stay visible alongside the final streak, not get
   * wiped out by it.
   * @param {{finalStreak: number, questionsAnswered: number, isNewBest: boolean, target: number}} result
   */
  function showStreakOver({ finalStreak, questionsAnswered, isNewBest, target }) {
    elements.streakTimer.hidden = true;
    elements.answerInput.hidden = true;
    elements.numpad.hidden = true;
    document.querySelector('.throws').hidden = true;
    document.querySelector('.prompt').hidden = true;

    elements.streakOverValue.textContent = finalStreak;
    elements.streakOverDetail.textContent = isNewBest
      ? 'New best streak!'
      : `${questionsAnswered} question${questionsAnswered === 1 ? '' : 's'} answered this run`;

    const margin = Math.abs(finalStreak - target);
    let resultClass;
    let resultText;
    if (finalStreak > target) {
      resultClass = 'streak-over__referee-result--win';
      resultText = `You beat the referee by ${margin}!`;
    } else if (finalStreak < target) {
      resultClass = 'streak-over__referee-result--loss';
      resultText = `The referee beat you by ${margin}`;
    } else {
      resultClass = 'streak-over__referee-result--draw';
      resultText = "You drew with the referee";
    }
    elements.streakOverRefereeResult.className = `streak-over__referee-result ${resultClass}`;
    elements.streakOverRefereeResult.textContent = resultText;
    elements.streakOverRefereeResult.hidden = false;

    elements.streakOver.hidden = false;

    setTimeout(() => elements.playAgainBtn.focus(), 0);
  }

  /** Reverses showStreakOver, restoring the normal in-question layout for a fresh run. */
  function hideStreakOver() {
    elements.streakOver.hidden = true;
    elements.streakOverRefereeResult.hidden = true;
    elements.answerResult.hidden = true;
    elements.feedbackTime.hidden = false; // undo renderEndingCalculation's timeout-only hide, ready for reuse
    elements.numpad.hidden = false;
    document.querySelector('.throws').hidden = false;
    document.querySelector('.prompt').hidden = false;
  }

  window.DartsTrainer.streakUi = {
    elements,
    renderQuestion,
    revealThrowSquare,
    enableAnswerInput,
    markCorrect,
    renderEndingCalculation,
    flashStreak,
    renderCurrentStreak,
    renderTarget,
    showRefereeIntro,
    hideRefereeIntro,
    renderDailyStats,
    renderCountdown,
    setCountdownPaused,
    showStreakOver,
    hideStreakOver,
    focusAnswerInput,
    FLIP_TRANSITION_MS,
  };
})();
