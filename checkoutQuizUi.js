/**
 * checkoutQuizUi.js
 * ---------------------------------------------------------
 * DOM layer for the 1-Dart Checkout Quiz. Same overall shape
 * as practiceUi.js (renderQuestion / renderFeedback / renderStats,
 * Check-button doubles as Next-question), but the answer-entry
 * widget is completely different: instead of a numeric keypad
 * building a number, this page has a "checkout keypad" that
 * builds a notation string like "D16" or "Bull" from separate
 * modifier (D/T) and number/Bull keys.
 * ---------------------------------------------------------
 */
window.DartsTrainer = window.DartsTrainer || {};

(function () {
  const elements = {
    quizScore: document.getElementById('quiz-score'),

    answerForm: document.getElementById('answer-form'),
    answerInput: document.getElementById('answer-input'),
    checkBtn: document.getElementById('check-btn'),

    keypad: document.getElementById('checkout-keypad'),
    modifierButtons: Array.from(document.querySelectorAll('.checkout-keypad__modifier')),
    numberButtons: Array.from(document.querySelectorAll('.checkout-keypad__key[data-number]')),
    bullButton: document.querySelector('.checkout-keypad__key[data-bull]'),
    clearButton: document.querySelector('.checkout-keypad__key[data-clear]'),

    answerResult: document.getElementById('answer-result'),
    feedbackResult: document.getElementById('feedback-result'),
    feedbackWorking: document.getElementById('feedback-working'),
    feedbackTime: document.getElementById('feedback-time'),

    statAnswered: document.getElementById('stat-answered'),
    statCorrect: document.getElementById('stat-correct'),
    statAccuracy: document.getElementById('stat-accuracy'),
    statAvgTime: document.getElementById('stat-avg-time'),
    statStreak: document.getElementById('stat-streak'),
  };

  // Which modifier (if any) is currently toggled on. Only one at a
  // time - selecting T while D is active swaps rather than stacks,
  // since a dart can't be a double and a treble at once.
  let activeModifier = null;

  /** Visually reflects `activeModifier` on the D/T buttons. */
  function renderModifierState() {
    elements.modifierButtons.forEach((btn) => {
      const isActive = btn.dataset.modifier === activeModifier;
      btn.classList.toggle('checkout-keypad__modifier--active', isActive);
    });
  }

  /** Clears the answer input and any active modifier. */
  function clearAnswer() {
    elements.answerInput.value = '';
    activeModifier = null;
    renderModifierState();
  }

  /**
   * Toggles a modifier (D or T) on/off. Tapping the already-active
   * one turns it off (back to a plain-number answer); tapping the
   * other one switches to it.
   * @param {'D'|'T'} modifier
   */
  function toggleModifier(modifier) {
    if (elements.answerInput.disabled) return;
    activeModifier = activeModifier === modifier ? null : modifier;
    renderModifierState();
  }

  /**
   * Sets the answer to a plain number, optionally prefixed by
   * whichever modifier is active - e.g. number "16" with D active
   * becomes "D16". Replaces any previous answer rather than
   * appending, since a checkout answer is always exactly one dart.
   * @param {string} number - '1'-'20'
   */
  function selectNumber(number) {
    if (elements.answerInput.disabled) return;
    const prefix = activeModifier || '';
    elements.answerInput.value = `${prefix}${number}`;
  }

  /** Sets the answer to "Bull" - a single fixed segment with no D/T variant. */
  function selectBull() {
    if (elements.answerInput.disabled) return;
    elements.answerInput.value = 'Bull';
    // Bull has no modifier variants; clear any active one so it
    // doesn't look "stuck on" after picking a key that ignores it.
    activeModifier = null;
    renderModifierState();
  }

  elements.modifierButtons.forEach((btn) => {
    btn.addEventListener('click', () => toggleModifier(btn.dataset.modifier));
  });

  elements.numberButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectNumber(btn.dataset.number));
  });

  elements.bullButton.addEventListener('click', selectBull);
  elements.clearButton.addEventListener('click', clearAnswer);

  // --- Question / state rendering -----------------------------------------

  /** Puts the page into "ready to answer" state for a new question. */
  function renderQuestion(question) {
    elements.quizScore.textContent = question.score;
    clearAnswer();

    elements.answerInput.hidden = false;
    elements.answerInput.disabled = false;
    elements.answerResult.hidden = true;
    elements.keypad.classList.remove('checkout-keypad--disabled');
    elements.checkBtn.disabled = false;
    elements.checkBtn.textContent = 'Check';

    focusAnswerInput();
  }

  /** Moves keyboard focus to the answer input (harmless on mobile - see index.html/readonly). */
  function focusAnswerInput() {
    setTimeout(() => elements.answerInput.focus(), 0);
  }

  /**
   * Renders the result of a checked answer into the answerResult
   * box (swapped into view in place of the plain input - see the
   * .answer-result rule in styles.css for why) and relabels the
   * Check button as "Next question" (same merged-button pattern as
   * the other counting games).
   * @param {boolean} wasCorrect
   * @param {{score: number, correctNotation: string}} question
   * @param {number} timeTakenSeconds
   */
  function renderFeedback(wasCorrect, question, timeTakenSeconds) {
    elements.answerResult.className = wasCorrect
      ? 'answer-result answer-result--correct'
      : 'answer-result answer-result--incorrect';

    elements.feedbackResult.textContent = wasCorrect ? 'Correct!' : 'Not quite';
    elements.feedbackWorking.textContent = `${question.score} → ${question.correctNotation}`;
    elements.feedbackTime.textContent = `Answered in ${timeTakenSeconds.toFixed(2)}s`;

    elements.answerInput.hidden = true;
    elements.answerInput.disabled = true;
    elements.answerResult.hidden = false;
    elements.keypad.classList.add('checkout-keypad--disabled');
    elements.checkBtn.disabled = false;
    elements.checkBtn.textContent = 'Next →';

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

  window.DartsTrainer.checkoutQuizUi = {
    elements,
    renderQuestion,
    renderFeedback,
    renderStats,
  };
})();
