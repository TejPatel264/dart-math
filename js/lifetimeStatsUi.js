/**
 * lifetimeStatsUi.js
 * ---------------------------------------------------------
 * Entry point + rendering for lifetime-stats.html. Reads
 * persisted totals from lifetimeStats.js (localStorage-backed)
 * and renders: a combined summary across all modes, then a
 * breakdown card per mode. Self-contained (no gameEngine/reveal/
 * stopwatch needed - this page only displays history), so it's
 * a single file rather than split into main/ui like the game
 * pages.
 * ---------------------------------------------------------
 */
(function () {
  const missing = [];
  if (!window.DartsTrainer) missing.push('all js/*.js files (window.DartsTrainer is undefined)');
  else if (!window.DartsTrainer.lifetimeStats) missing.push('js/lifetimeStats.js');

  if (missing.length > 0) {
    const message =
      'Lifetime Stats failed to start. Missing: ' + missing.join(', ') +
      '. Open the browser console (F12) and check the Network tab for 404s — ' +
      'this usually means the js/ folder is not sitting next to this page.';
    console.error(message);
    document.body.innerHTML =
      '<pre style="color:#F3ECD8;background:#17140F;padding:24px;white-space:pre-wrap;font-family:monospace;">' +
      message + '</pre>';
    return;
  }

  const { lifetimeStats } = window.DartsTrainer;

  const elements = {
    playStreakCurrent: document.getElementById('play-streak-current'),
    playStreakBest: document.getElementById('play-streak-best'),

    summaryAnswered: document.getElementById('summary-answered'),
    summaryAccuracy: document.getElementById('summary-accuracy'),
    summaryAvgTime: document.getElementById('summary-avg-time'),
    modesContainer: document.getElementById('lifetime-modes'),
    resetBtn: document.getElementById('lifetime-reset-btn'),
  };

  /** Formats a mode-stats object's accuracy as a string for display. */
  function formatAccuracy(modeStats) {
    const accuracy = lifetimeStats.accuracyPercent(modeStats);
    return accuracy === null ? '—' : `${accuracy.toFixed(0)}%`;
  }

  /** Formats a mode-stats object's average time as a string for display. */
  function formatAvgTime(modeStats) {
    const avgTime = lifetimeStats.averageTimeSeconds(modeStats);
    return avgTime === null ? '—' : `${avgTime.toFixed(2)}s`;
  }

  /** Builds the DOM for a single mode's breakdown card. */
  function buildModeCard(mode) {
    const card = document.createElement('div');
    card.className = 'lifetime-mode-card';

    const hasData = mode.questionsAnswered > 0;
    if (!hasData) card.classList.add('lifetime-mode-card--empty');

    card.innerHTML = `
      <div class="lifetime-mode-card__header">
        <h2 class="lifetime-mode-card__title">${mode.label}</h2>
      </div>
      <div class="lifetime-mode-card__grid">
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${mode.questionsAnswered}</span>
          <span class="lifetime-mode-card__label">Questions</span>
        </div>
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${formatAccuracy(mode)}</span>
          <span class="lifetime-mode-card__label">Accuracy</span>
        </div>
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${formatAvgTime(mode)}</span>
          <span class="lifetime-mode-card__label">Avg Time</span>
        </div>
        <div class="lifetime-mode-card__stat">
          <span class="lifetime-mode-card__value">${mode.bestStreak}</span>
          <span class="lifetime-mode-card__label">Best Streak</span>
        </div>
      </div>
      ${hasData ? '' : '<p class="lifetime-mode-card__empty-note">No questions answered yet</p>'}
    `;

    return card;
  }

  /** Renders the play streak, combined summary, and every mode's card from current storage. */
  function render() {
    const playStreak = lifetimeStats.getPlayStreak();
    elements.playStreakCurrent.textContent = playStreak.currentStreak;
    elements.playStreakBest.textContent = playStreak.bestStreak;

    const combined = lifetimeStats.getCombinedStats();
    elements.summaryAnswered.textContent = combined.questionsAnswered;
    elements.summaryAccuracy.textContent = formatAccuracy(combined);
    elements.summaryAvgTime.textContent = formatAvgTime(combined);

    elements.modesContainer.innerHTML = '';
    lifetimeStats.getAllModeStats().forEach((mode) => {
      elements.modesContainer.appendChild(buildModeCard(mode));
    });
  }

  function handleReset() {
    const confirmed = window.confirm(
      'Reset all lifetime stats? This clears totals, streaks, and your play streak for every mode and can\'t be undone.'
    );
    if (!confirmed) return;

    lifetimeStats.resetAll();
    render();
  }

  elements.resetBtn.addEventListener('click', handleReset);

  render();
})();
